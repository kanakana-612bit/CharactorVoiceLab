#!/usr/bin/env python3
"""Allowlisted local experiment jobs for CharacterVoiceDesigner."""

from __future__ import annotations

import hashlib
import json
import mimetypes
import os
import re
import subprocess
import sys
import threading
import uuid
from collections import deque
from datetime import datetime
from pathlib import Path
from typing import Any

from speaker_condition_reference import (
    SpeakerConditionError,
    inspect_embedding,
    sidecar_path,
)


JOB_ID_PATTERN = re.compile(r"^[0-9]{8}T[0-9]{6}-[a-f0-9]{8}$")
SPEAKER_NAME_PATTERN = re.compile(
    r"^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}\.speaker\.safetensors$"
)
SAFE_FILENAME_PATTERN = re.compile(r"[^A-Za-z0-9_.-]+")
ALLOWED_ARTIFACT_SUFFIXES = {".csv", ".json", ".md", ".wav", ".yaml", ".yml"}
TERMINAL_STATES = {"complete", "failed", "cancelled", "interrupted"}
MAX_LOG_LINES = 500
MAX_REPORT_BYTES = 256 * 1024
MAX_UPLOAD_BYTES = 128 * 1024 * 1024


class ExperimentError(ValueError):
    """Invalid experiment request."""


class ExperimentBusyError(ExperimentError):
    """A GPU-intensive experiment is already active."""


class ExperimentNotFoundError(ExperimentError):
    """Experiment job or artifact was not found."""


def _now() -> str:
    return datetime.now().astimezone().isoformat()


def _number(
    value: Any,
    name: str,
    minimum: float,
    maximum: float,
    *,
    integer: bool = False,
) -> int | float:
    if isinstance(value, bool):
        raise ExperimentError(f"{name} must be numeric.")
    try:
        result = float(value)
    except (TypeError, ValueError) as error:
        raise ExperimentError(f"{name} must be numeric.") from error
    if not minimum <= result <= maximum:
        raise ExperimentError(f"{name} must be between {minimum} and {maximum}.")
    return int(result) if integer else result


def _optional_number(
    value: Any,
    name: str,
    minimum: float,
    maximum: float,
) -> float | None:
    if value in (None, ""):
        return None
    return float(_number(value, name, minimum, maximum))


def _text(value: Any, name: str, maximum: int, *, required: bool = False) -> str:
    if value is None:
        value = ""
    if not isinstance(value, str):
        raise ExperimentError(f"{name} must be text.")
    result = value.strip()
    if required and not result:
        raise ExperimentError(f"{name} is required.")
    if len(result) > maximum:
        raise ExperimentError(f"{name} must be at most {maximum} characters.")
    return result


def _bool(value: Any, name: str, default: bool = False) -> bool:
    if value is None:
        return default
    if not isinstance(value, bool):
        raise ExperimentError(f"{name} must be true or false.")
    return value


def _safe_name(value: str, fallback: str) -> str:
    name = Path(value).name
    cleaned = SAFE_FILENAME_PATTERN.sub("-", name).strip(".-")
    return (cleaned or fallback)[:128]


def _is_within(path: Path, root: Path) -> bool:
    try:
        path.relative_to(root)
        return True
    except ValueError:
        return False


class ExperimentJobManager:
    """Run a single local experiment at a time and expose bounded job records."""

    CATALOG = [
        {
            "id": "runtime_observation",
            "label": "生成観測・話者状態疎通",
            "description": "通常生成と観測付き生成の同一性、および話者状態の消費を確認します。",
            "requires_audio_cpp": True,
        },
        {
            "id": "speaker_compatibility",
            "label": "Speaker Inversion 互換性",
            "description": "管理済み話者状態の形式、モデル結合、audio.cpp実装状態を検査します。",
            "requires_audio_cpp": False,
        },
        {
            "id": "seed_f0",
            "label": "Seed / F0 ベンチマーク",
            "description": "低ステップ候補と最終生成のF0相関、時間、品質指標を比較します。",
            "requires_audio_cpp": True,
        },
        {
            "id": "step_stability",
            "label": "段階別安定性",
            "description": "同一seedを4/8/12/16/20 Stepで生成し、音響proxyの確定時点を調べます。",
            "requires_audio_cpp": True,
        },
        {
            "id": "voice_evaluation",
            "label": "生成音声評価",
            "description": "WAVのF0、波形品質、スペクトル距離をローカルで数値化します。",
            "requires_audio_cpp": False,
        },
        {
            "id": "runtime_diagnostics",
            "label": "実行環境診断",
            "description": "F0解析・補正に必要なPython依存関係を確認します。",
            "requires_audio_cpp": False,
        },
    ]

    def __init__(
        self,
        project_root: Path,
        *,
        bridge_base_url: str,
        audio_cpp_base_url: str,
        python_executable: str | None = None,
    ) -> None:
        self.project_root = project_root.resolve()
        self.bridge_base_url = bridge_base_url.rstrip("/")
        self.audio_cpp_base_url = audio_cpp_base_url.rstrip("/")
        self.python_executable = python_executable or sys.executable
        self.job_root = self.project_root / "runtime" / "experiment_jobs"
        self.output_root = self.project_root / "runtime" / "experiment_outputs"
        self.upload_root = self.project_root / "runtime" / "experiment_inputs"
        self.excluded_voice_inputs_path = self.upload_root / "excluded_voice_inputs.json"
        self.speaker_root = self.project_root / "runtime" / "speaker_conditions"
        for root in (self.job_root, self.output_root, self.upload_root, self.speaker_root):
            root.mkdir(parents=True, exist_ok=True)
        self._lock = threading.RLock()
        self._jobs: dict[str, dict[str, Any]] = {}
        self._commands: dict[str, list[str]] = {}
        self._processes: dict[str, subprocess.Popen[str]] = {}
        self._cancel_requested: set[str] = set()
        self._load_history()

    def catalog(self) -> dict[str, Any]:
        return {
            "schema_version": "cvd_experiment_catalog_0.1",
            "local_only": True,
            "max_parallel_jobs": 1,
            "tools": self.CATALOG,
        }

    def resources(self) -> dict[str, Any]:
        speakers = self._speaker_resources()
        profiles: list[dict[str, str]] = []
        voice_inputs: list[dict[str, str]] = []
        manifests: list[dict[str, str]] = []
        for path in sorted(self.upload_root.glob("*/*")):
            if not path.is_file():
                continue
            relative = path.relative_to(self.upload_root).as_posix()
            if path.parent.name == "wav" and path.suffix.lower() == ".wav":
                voice_inputs.append(
                    {"id": f"upload-wav:{relative}", "label": f"アップロード / {path.name}"}
                )
            elif path.parent.name == "profile" and path.suffix.lower() in {".json", ".zip"}:
                profiles.append(
                    {"id": f"upload-profile:{relative}", "label": f"アップロード / {path.name}"}
                )
            elif path.parent.name == "manifest" and path.suffix.lower() == ".json":
                manifests.append(
                    {"id": f"upload-manifest:{relative}", "label": f"アップロード / {path.name}"}
                )

        sample_root = self.project_root / "samples"
        if sample_root.is_dir() and any(sample_root.rglob("*.wav")):
            voice_inputs.append({"id": "sample:.", "label": "samples ディレクトリ"})
        benchmark_root = self.project_root / "benchmark_results"
        if benchmark_root.is_dir():
            candidates = {
                path.parent
                for path in benchmark_root.rglob("*.wav")
                if path.is_file()
            }
            for path in sorted(candidates, key=lambda value: str(value), reverse=True)[:100]:
                relative = path.relative_to(benchmark_root).as_posix()
                voice_inputs.append(
                    {"id": f"benchmark:{relative}", "label": f"ベンチマーク / {relative}"}
                )
        stored_excluded_voice_inputs = self._excluded_voice_inputs()
        available_voice_input_ids = {item["id"] for item in voice_inputs}
        excluded_voice_inputs = stored_excluded_voice_inputs & available_voice_input_ids
        if excluded_voice_inputs != stored_excluded_voice_inputs:
            self._write_excluded_voice_inputs(excluded_voice_inputs)
        voice_inputs = [
            item for item in voice_inputs if item["id"] not in excluded_voice_inputs
        ]
        return {
            "schema_version": "cvd_experiment_resources_0.1",
            "speaker_conditions": speakers,
            "speech_speaker_conditions": [
                item for item in speakers if item.get("speech_usable")
            ],
            "profiles": profiles,
            "voice_inputs": voice_inputs,
            "excluded_voice_input_count": len(excluded_voice_inputs),
            "manifests": manifests,
        }

    def exclude_voice_input(self, resource_id: Any) -> dict[str, Any]:
        normalized = _text(resource_id, "voice resource", 512, required=True)
        self._resolve_voice_resource(normalized)
        excluded = self._excluded_voice_inputs()
        excluded.add(normalized)
        self._write_excluded_voice_inputs(excluded)
        return {"id": normalized, "excluded": True}

    def restore_voice_inputs(self) -> dict[str, Any]:
        restored = len(self._excluded_voice_inputs())
        self._write_excluded_voice_inputs(set())
        return {"restored": restored}

    def discard_reference_upload(self, resource_id: Any) -> dict[str, Any]:
        normalized = _text(resource_id, "reference resource", 512, required=True)
        path = self._resolve_upload(normalized, "reference-wav")
        path.unlink(missing_ok=True)
        return {"id": normalized, "discarded": True}

    def store_upload(
        self,
        kind: str,
        filename: str,
        body: bytes,
        *,
        target: str = "",
    ) -> dict[str, Any]:
        if len(body) <= 0 or len(body) > MAX_UPLOAD_BYTES:
            raise ExperimentError("Upload size is invalid.")
        if kind == "speaker":
            return self._store_speaker(filename, body)
        if kind == "speaker-sidecar":
            return self._store_speaker_sidecar(target, filename, body)
        if kind not in {"wav", "reference-wav", "profile", "manifest"}:
            raise ExperimentError("Upload kind is invalid.")
        name = _safe_name(filename, f"{kind}.dat")
        suffix = Path(name).suffix.lower()
        if kind in {"wav", "reference-wav"}:
            if suffix != ".wav" or not (
                body.startswith(b"RIFF") and len(body) >= 12 and body[8:12] == b"WAVE"
            ):
                raise ExperimentError("Voice input must be a RIFF/WAVE file.")
        elif kind == "profile":
            if suffix == ".json":
                self._validate_json_upload(body, "Profile")
            elif suffix != ".zip" or not body.startswith(b"PK"):
                raise ExperimentError("Profile must be JSON or ZIP.")
        else:
            if suffix != ".json":
                raise ExperimentError("Manifest must be JSON.")
            self._validate_json_upload(body, "Manifest")

        digest = hashlib.sha256(body).hexdigest()
        destination = self.upload_root / kind / f"{digest[:12]}-{name}"
        destination.parent.mkdir(parents=True, exist_ok=True)
        if not destination.exists():
            destination.write_bytes(body)
        relative = destination.relative_to(self.upload_root).as_posix()
        return {
            "id": f"upload-{kind}:{relative}",
            "label": f"アップロード / {destination.name}",
            "sha256": digest,
        }

    def _speaker_resources(self) -> list[dict[str, Any]]:
        resources = []
        for path in sorted(self.speaker_root.glob("*.speaker.safetensors")):
            if not SPEAKER_NAME_PATTERN.fullmatch(path.name):
                continue
            try:
                artifact = inspect_embedding(path)
                semantic_voice = (
                    artifact.get("sidecar", {})
                    .get("provenance", {})
                    .get("semantic_voice")
                    if artifact.get("sidecar")
                    else None
                )
                shape = artifact.get("shape") or []
                shape_label = "x".join(str(value) for value in shape) or "shape unknown"
                binding = artifact.get("model_binding_status", "unbound")
                file_compatible = bool(artifact.get("upstream_file_contract_compatible"))
                speech_usable = file_compatible and semantic_voice is not False
                resources.append(
                    {
                        "id": path.name,
                        "label": f"{path.name} / {shape_label} / {binding}",
                        "shape": shape,
                        "file_contract_compatible": file_compatible,
                        "model_binding_status": binding,
                        "has_sidecar": artifact.get("sidecar") is not None,
                        "speech_usable": speech_usable,
                        "warnings": artifact.get("warnings", []),
                        "errors": artifact.get("errors", []),
                    }
                )
            except SpeakerConditionError as error:
                resources.append(
                    {
                        "id": path.name,
                        "label": f"{path.name} / 読み取り不可",
                        "shape": [],
                        "file_contract_compatible": False,
                        "model_binding_status": "invalid",
                        "has_sidecar": sidecar_path(path).is_file(),
                        "speech_usable": False,
                        "warnings": [],
                        "errors": [str(error)],
                    }
                )
        return resources

    def _store_speaker(self, filename: str, body: bytes) -> dict[str, Any]:
        name = _safe_name(filename, "speaker.speaker.safetensors")
        if not SPEAKER_NAME_PATTERN.fullmatch(name):
            raise ExperimentError(
                "Speaker condition filename must end with .speaker.safetensors."
            )
        digest = hashlib.sha256(body).hexdigest()
        temporary_root = self.upload_root / "speaker"
        temporary_root.mkdir(parents=True, exist_ok=True)
        temporary = temporary_root / f".{uuid.uuid4().hex}-{name}"
        temporary.write_bytes(body)
        try:
            artifact = inspect_embedding(temporary)
        except SpeakerConditionError as error:
            temporary.unlink(missing_ok=True)
            raise ExperimentError(f"Speaker condition is invalid: {error}") from error
        if not artifact["upstream_file_contract_compatible"]:
            temporary.unlink(missing_ok=True)
            raise ExperimentError(
                "Speaker condition does not satisfy the direct-state file contract: "
                + ", ".join(artifact["file_errors"])
            )

        destination = self.speaker_root / name
        if destination.exists():
            existing_digest = hashlib.sha256(destination.read_bytes()).hexdigest()
            if existing_digest == digest:
                temporary.unlink(missing_ok=True)
            else:
                base = name[: -len(".speaker.safetensors")]
                destination = self.speaker_root / (
                    f"{base}-{digest[:8]}.speaker.safetensors"
                )
                temporary.replace(destination)
        else:
            temporary.replace(destination)
        return {
            "id": destination.name,
            "label": destination.name,
            "sha256": digest,
            "shape": artifact["shape"],
            "sidecar_name": sidecar_path(destination).name,
            "speech_usable": True,
        }

    def _store_speaker_sidecar(
        self,
        target: str,
        filename: str,
        body: bytes,
    ) -> dict[str, Any]:
        if not SPEAKER_NAME_PATTERN.fullmatch(target):
            raise ExperimentError("Speaker sidecar target is invalid.")
        if Path(filename).suffix.lower() != ".json":
            raise ExperimentError("Speaker sidecar must be JSON.")
        try:
            value = json.loads(body.decode("utf-8-sig"))
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            raise ExperimentError("Speaker sidecar must be valid UTF-8 JSON.") from error
        if not isinstance(value, dict):
            raise ExperimentError("Speaker sidecar JSON root must be an object.")
        embedding_path = (self.speaker_root / target).resolve()
        if embedding_path.parent != self.speaker_root.resolve() or not embedding_path.is_file():
            raise ExperimentError("Managed speaker condition was not found.")
        expected_sha = hashlib.sha256(embedding_path.read_bytes()).hexdigest()
        if value.get("embedding", {}).get("sha256") != expected_sha:
            raise ExperimentError("Speaker sidecar embedding SHA-256 does not match.")
        destination = sidecar_path(embedding_path)
        temporary = destination.with_suffix(".tmp")
        temporary.write_text(
            json.dumps(value, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        temporary.replace(destination)
        return {
            "id": target,
            "label": target,
            "sidecar_name": destination.name,
            "sha256": expected_sha,
        }

    @staticmethod
    def _validate_json_upload(body: bytes, label: str) -> None:
        try:
            value = json.loads(body.decode("utf-8-sig"))
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            raise ExperimentError(f"{label} must be valid UTF-8 JSON.") from error
        if not isinstance(value, (dict, list)):
            raise ExperimentError(f"{label} JSON root must be an object or array.")

    def list_jobs(self) -> dict[str, Any]:
        with self._lock:
            jobs = sorted(
                (self._snapshot(job) for job in self._jobs.values()),
                key=lambda item: item["created_at"],
                reverse=True,
            )[:50]
        return {"jobs": jobs}

    def get_job(self, job_id: str) -> dict[str, Any]:
        if not JOB_ID_PATTERN.fullmatch(job_id):
            raise ExperimentNotFoundError("Experiment job was not found.")
        with self._lock:
            job = self._jobs.get(job_id)
            if job is None:
                raise ExperimentNotFoundError("Experiment job was not found.")
            return self._snapshot(job)

    def start(self, tool: str, options: Any) -> dict[str, Any]:
        if tool not in {entry["id"] for entry in self.CATALOG}:
            raise ExperimentError("Experiment tool is not allowlisted.")
        if not isinstance(options, dict):
            raise ExperimentError("Experiment options must be an object.")
        with self._lock:
            if any(job["status"] in {"queued", "running", "cancelling"} for job in self._jobs.values()):
                raise ExperimentBusyError("Another experiment is already running.")
            job_id = datetime.now().strftime("%Y%m%dT%H%M%S") + "-" + uuid.uuid4().hex[:8]
            command, output_dir, safe_options = self._build_command(job_id, tool, options)
            label = next(entry["label"] for entry in self.CATALOG if entry["id"] == tool)
            job = {
                "id": job_id,
                "tool": tool,
                "label": label,
                "status": "queued",
                "created_at": _now(),
                "started_at": None,
                "finished_at": None,
                "returncode": None,
                "progress": {"phase": "queued", "current": 0, "total": None, "ratio": None},
                "options": safe_options,
                "output_directory": (
                    output_dir.relative_to(self.project_root).as_posix()
                    if output_dir is not None and _is_within(output_dir, self.project_root)
                    else None
                ),
                "log_lines": [],
                "error": None,
                "summary": None,
                "report_text": None,
                "artifacts": [],
            }
            self._jobs[job_id] = job
            self._commands[job_id] = command
            self._persist(job)
            threading.Thread(
                target=self._run_job,
                args=(job_id, output_dir),
                daemon=True,
                name=f"cvd-experiment-{job_id}",
            ).start()
            return self._snapshot(job)

    def cancel(self, job_id: str) -> dict[str, Any]:
        with self._lock:
            job = self._jobs.get(job_id)
            if job is None:
                raise ExperimentNotFoundError("Experiment job was not found.")
            if job["status"] in TERMINAL_STATES:
                return self._snapshot(job)
            self._cancel_requested.add(job_id)
            job["status"] = "cancelling"
            job["progress"]["phase"] = "cancelling"
            process = self._processes.get(job_id)
            if process is not None:
                process.terminate()
            self._persist(job)
            return self._snapshot(job)

    def artifact_path(self, job_id: str, artifact_id: str) -> tuple[Path, str]:
        job = self.get_job(job_id)
        match = next(
            (item for item in job["artifacts"] if item["id"] == artifact_id),
            None,
        )
        if match is None:
            raise ExperimentNotFoundError("Experiment artifact was not found.")
        path = (self.project_root / match["relative_path"]).resolve()
        if not _is_within(path, self.project_root) or not path.is_file():
            raise ExperimentNotFoundError("Experiment artifact was not found.")
        return path, match["media_type"]

    def shutdown(self) -> None:
        with self._lock:
            processes = list(self._processes.values())
        for process in processes:
            if process.poll() is None:
                process.terminate()

    def _build_command(
        self,
        job_id: str,
        tool: str,
        options: dict[str, Any],
    ) -> tuple[list[str], Path | None, dict[str, Any]]:
        python = self.python_executable
        stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        safe: dict[str, Any] = {}
        output: Path | None = None

        if tool == "runtime_observation":
            steps = _number(options.get("steps", 4), "steps", 4, 100, integer=True)
            speaker = _text(options.get("speaker_condition"), "speaker_condition", 160)
            command = [
                python,
                str(self.project_root / "tests" / "observation_runtime_smoke.py"),
                "--audio-cpp-url",
                self.audio_cpp_base_url,
                "--steps",
                str(steps),
            ]
            if speaker:
                self._resolve_speaker(speaker)
                command.extend(["--speaker-condition", speaker])
            output = self.output_root / job_id
            output.mkdir(parents=True, exist_ok=False)
            command.extend(["--output-json", str(output / "observation_runtime.json")])
            safe = {"steps": steps, "speaker_condition": speaker or None}
            return command, output, safe

        if tool == "speaker_compatibility":
            output = self.project_root / "speaker_condition_results" / f"{stamp}-{job_id[-8:]}"
            tokens = _number(options.get("tokens", 16), "tokens", 1, 1024, integer=True)
            seed = _number(options.get("seed", 0), "seed", 0, 2147483647, integer=True)
            init_std = _number(options.get("init_std", 0.02), "init_std", 0.0001, 1)
            create_fixture = _bool(options.get("create_format_fixture"), "create_format_fixture")
            hash_model = _bool(options.get("hash_model"), "hash_model")
            raw_embeddings = options.get("embeddings", [])
            if not isinstance(raw_embeddings, list) or len(raw_embeddings) > 16:
                raise ExperimentError("embeddings must be a list of up to 16 managed files.")
            embeddings = []
            command = [
                python,
                str(self.project_root / "verify_speaker_inversion.py"),
                "--output",
                str(output),
                "--tokens",
                str(tokens),
                "--seed",
                str(seed),
                "--init-std",
                str(init_std),
            ]
            for value in raw_embeddings:
                name, path = self._resolve_speaker(value)
                embeddings.append(name)
                command.extend(["--embedding", str(path)])
            if create_fixture:
                command.append("--create-format-fixture")
            if hash_model:
                command.append("--hash-model")
            safe = {
                "embeddings": embeddings,
                "create_format_fixture": create_fixture,
                "hash_model": hash_model,
                "tokens": tokens,
                "seed": seed,
                "init_std": init_std,
            }
            return command, output, safe

        if tool == "seed_f0":
            output = self.project_root / "benchmark_results" / f"{stamp}-{job_id[-8:]}-seed-f0"
            samples = _number(options.get("samples", 10), "samples", 2, 100, integer=True)
            seed_start = _number(
                options.get("seed_start", 20260719),
                "seed_start",
                0,
                2147483647 - samples,
                integer=True,
            )
            low_steps = _number(options.get("low_steps", 4), "low_steps", 4, 99, integer=True)
            final_steps = _number(options.get("final_steps", 40), "final_steps", 5, 100, integer=True)
            if low_steps >= final_steps:
                raise ExperimentError("low_steps must be smaller than final_steps.")
            analysis_seconds = _number(
                options.get("analysis_seconds", 3),
                "analysis_seconds",
                0.2,
                60,
            )
            target_f0 = _optional_number(options.get("target_f0"), "target_f0", 60, 500)
            text = _text(options.get("text"), "text", 5000, required=True)
            caption = _text(options.get("caption"), "caption", 2000)
            model = _text(options.get("model", "irodori-vdes"), "model", 128, required=True)
            if not re.fullmatch(r"[A-Za-z0-9_.:-]{1,128}", model):
                raise ExperimentError("model is invalid.")
            caption_guidance = _number(
                options.get("caption_guidance", 2),
                "caption_guidance",
                0.5,
                10,
            )
            duration_scale = _number(
                options.get("duration_scale", 1),
                "duration_scale",
                0.5,
                2,
            )
            command = [
                python,
                str(self.project_root / "seed_f0_benchmark.py"),
                "--samples",
                str(samples),
                "--seed-start",
                str(seed_start),
                "--low-steps",
                str(low_steps),
                "--final-steps",
                str(final_steps),
                "--analysis-seconds",
                str(analysis_seconds),
                "--text",
                text,
                "--caption",
                caption,
                "--model",
                model,
                "--caption-guidance",
                str(caption_guidance),
                "--duration-scale",
                str(duration_scale),
                "--bridge-url",
                self.bridge_base_url,
                "--output",
                str(output),
            ]
            profile_id = _text(options.get("profile_id"), "profile_id", 256)
            if profile_id:
                profile = self._resolve_upload(profile_id, "profile")
                command.extend(["--profile", str(profile)])
            if target_f0 is not None:
                command.extend(["--target-f0", str(target_f0)])
            safe = {
                "samples": samples,
                "seed_start": seed_start,
                "low_steps": low_steps,
                "final_steps": final_steps,
                "analysis_seconds": analysis_seconds,
                "target_f0": target_f0,
                "model": model,
                "caption_guidance": caption_guidance,
                "duration_scale": duration_scale,
                "profile_id": profile_id or None,
                "text_characters": len(text),
                "caption_characters": len(caption),
            }
            return command, output, safe

        if tool == "step_stability":
            output = (
                self.project_root
                / "benchmark_results"
                / f"{stamp}-{job_id[-8:]}-step-stability"
            )
            samples = _number(options.get("samples", 3), "samples", 1, 10, integer=True)
            seed_start = _number(
                options.get("seed_start", 20260719),
                "seed_start",
                0,
                2147483647 - samples,
                integer=True,
            )
            target_f0 = _optional_number(options.get("target_f0"), "target_f0", 60, 500)
            text = _text(options.get("text"), "text", 5000, required=True)
            caption = _text(options.get("caption"), "caption", 2000)
            model = _text(options.get("model", "irodori-vdes"), "model", 128, required=True)
            if not re.fullmatch(r"[A-Za-z0-9_.:-]{1,128}", model):
                raise ExperimentError("model is invalid.")
            caption_guidance = _number(
                options.get("caption_guidance", 2),
                "caption_guidance",
                0.5,
                10,
            )
            duration_scale = _number(
                options.get("duration_scale", 1),
                "duration_scale",
                0.5,
                2,
            )
            command = [
                python,
                str(self.project_root / "step_stability_benchmark.py"),
                "--samples",
                str(samples),
                "--seed-start",
                str(seed_start),
                "--text",
                text,
                "--caption",
                caption,
                "--model",
                model,
                "--caption-guidance",
                str(caption_guidance),
                "--duration-scale",
                str(duration_scale),
                "--bridge-url",
                self.bridge_base_url,
                "--output",
                str(output),
            ]
            profile_id = _text(options.get("profile_id"), "profile_id", 256)
            if profile_id:
                profile = self._resolve_upload(profile_id, "profile")
                command.extend(["--profile", str(profile)])
            speaker = _text(options.get("speaker_condition"), "speaker_condition", 160)
            speaker_name = None
            if speaker:
                speaker_name, _ = self._resolve_speaker(speaker)
                command.extend(["--speaker-condition", speaker_name])
            if target_f0 is not None:
                command.extend(["--target-f0", str(target_f0)])
            safe = {
                "samples": samples,
                "seed_start": seed_start,
                "step_schedule": [4, 8, 12, 16, 20],
                "target_f0": target_f0,
                "model": model,
                "caption_guidance": caption_guidance,
                "duration_scale": duration_scale,
                "profile_id": profile_id or None,
                "speaker_condition": speaker_name,
                "text_characters": len(text),
                "caption_characters": len(caption),
            }
            return command, output, safe

        if tool == "voice_evaluation":
            output = self.project_root / "evaluation_results" / f"{stamp}-{job_id[-8:]}"
            inputs = self._resolve_resource_list(options.get("inputs"), "inputs", required=True)
            references = self._resolve_resource_list(options.get("references", []), "references")
            target_f0 = _optional_number(options.get("target_f0"), "target_f0", 60, 500)
            command = [
                python,
                str(self.project_root / "evaluate_voice.py"),
                "--speaker-backend",
                "none",
                "--output",
                str(output),
            ]
            for path in inputs:
                command.extend(["--input", str(path)])
            for path in references:
                command.extend(["--reference", str(path)])
            manifest_id = _text(options.get("manifest_id"), "manifest_id", 256)
            if manifest_id:
                command.extend(["--manifest", str(self._resolve_upload(manifest_id, "manifest"))])
            if target_f0 is not None:
                command.extend(["--target-f0", str(target_f0)])
            safe = {
                "inputs": list(options.get("inputs", [])),
                "references": list(options.get("references", [])),
                "manifest_id": manifest_id or None,
                "target_f0": target_f0,
                "speaker_backend": "none",
            }
            return command, output, safe

        command = [
            python,
            str(self.project_root / "audio_postprocess.py"),
            "--check",
        ]
        return command, None, {}

    def _resolve_speaker(self, value: Any) -> tuple[str, Path]:
        name = _text(value, "speaker_condition", 160, required=True)
        if not SPEAKER_NAME_PATTERN.fullmatch(name):
            raise ExperimentError("Speaker condition filename is invalid.")
        path = (self.speaker_root / name).resolve()
        if path.parent != self.speaker_root.resolve() or not path.is_file():
            raise ExperimentError("Managed speaker condition was not found.")
        return name, path

    def _resolve_upload(self, resource_id: str, kind: str) -> Path:
        prefix = f"upload-{kind}:"
        if not resource_id.startswith(prefix):
            raise ExperimentError(f"{kind} resource is invalid.")
        relative = resource_id[len(prefix):]
        path = (self.upload_root / relative).resolve()
        expected_parent = (self.upload_root / kind).resolve()
        if path.parent != expected_parent or not path.is_file():
            raise ExperimentError(f"{kind} resource was not found.")
        return path

    def _resolve_resource_list(
        self,
        values: Any,
        name: str,
        *,
        required: bool = False,
    ) -> list[Path]:
        if not isinstance(values, list) or len(values) > 16:
            raise ExperimentError(f"{name} must be a list of up to 16 resources.")
        if required and not values:
            raise ExperimentError(f"{name} requires at least one resource.")
        paths = [self._resolve_voice_resource(value) for value in values]
        return paths

    def _resolve_voice_resource(self, value: Any) -> Path:
        resource_id = _text(value, "voice resource", 512, required=True)
        if resource_id.startswith("upload-wav:"):
            return self._resolve_upload(resource_id, "wav")
        if resource_id.startswith("upload-reference-wav:"):
            return self._resolve_upload(resource_id, "reference-wav")
        if resource_id.startswith("benchmark:"):
            root = (self.project_root / "benchmark_results").resolve()
            relative = resource_id[len("benchmark:"):]
        elif resource_id.startswith("sample:"):
            root = (self.project_root / "samples").resolve()
            relative = resource_id[len("sample:"):]
        else:
            raise ExperimentError("Voice resource is invalid.")
        path = (root / relative).resolve()
        if not _is_within(path, root) or not path.exists():
            raise ExperimentError("Voice resource was not found.")
        if path.is_file() and path.suffix.lower() != ".wav":
            raise ExperimentError("Voice resource must be WAV or a WAV directory.")
        if path.is_dir() and not any(path.rglob("*.wav")):
            raise ExperimentError("Voice resource directory contains no WAV files.")
        return path

    def _excluded_voice_inputs(self) -> set[str]:
        try:
            value = json.loads(self.excluded_voice_inputs_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return set()
        if not isinstance(value, list):
            return set()
        return {
            item for item in value
            if isinstance(item, str) and len(item) <= 512
        }

    def _write_excluded_voice_inputs(self, values: set[str]) -> None:
        self.excluded_voice_inputs_path.parent.mkdir(parents=True, exist_ok=True)
        temporary = self.excluded_voice_inputs_path.with_suffix(".tmp")
        temporary.write_text(
            json.dumps(sorted(values), ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        temporary.replace(self.excluded_voice_inputs_path)

    def _cleanup_job_reference_uploads(self, job_id: str) -> None:
        with self._lock:
            references = list(self._jobs.get(job_id, {}).get("options", {}).get("references", []))
        for resource_id in references:
            if not isinstance(resource_id, str) or not resource_id.startswith("upload-reference-wav:"):
                continue
            try:
                path = self._resolve_upload(resource_id, "reference-wav")
            except ExperimentError:
                continue
            path.unlink(missing_ok=True)

    def _run_job(self, job_id: str, output_dir: Path | None) -> None:
        with self._lock:
            job = self._jobs[job_id]
            command = self._commands.pop(job_id)
            job["status"] = "running"
            job["started_at"] = _now()
            job["progress"] = {"phase": "starting", "current": 0, "total": None, "ratio": None}
            self._persist(job)
        environment = os.environ.copy()
        environment["PYTHONUNBUFFERED"] = "1"
        try:
            process = subprocess.Popen(
                command,
                cwd=str(self.project_root),
                env=environment,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding="utf-8",
                errors="replace",
                bufsize=1,
            )
            with self._lock:
                self._processes[job_id] = process
            assert process.stdout is not None
            for line in process.stdout:
                self._append_log(job_id, line.rstrip())
            returncode = process.wait()
            with self._lock:
                job = self._jobs[job_id]
                job["returncode"] = returncode
                if job_id in self._cancel_requested:
                    job["status"] = "cancelled"
                    job["error"] = "Cancelled by the user."
                elif returncode == 0:
                    job["status"] = "complete"
                    job["progress"] = {"phase": "complete", "current": 1, "total": 1, "ratio": 1}
                    self._collect_results(job, output_dir)
                else:
                    job["status"] = "failed"
                    job["error"] = (
                        job["log_lines"][-1] if job["log_lines"] else f"Process exited with {returncode}."
                    )
                job["finished_at"] = _now()
                self._processes.pop(job_id, None)
                self._cancel_requested.discard(job_id)
                self._persist(job)
        except OSError as error:
            with self._lock:
                job = self._jobs[job_id]
                job["status"] = "failed"
                job["error"] = str(error)
                job["finished_at"] = _now()
                self._processes.pop(job_id, None)
                self._persist(job)
        finally:
            self._cleanup_job_reference_uploads(job_id)

    def _append_log(self, job_id: str, line: str) -> None:
        with self._lock:
            job = self._jobs[job_id]
            lines = deque(job["log_lines"], maxlen=MAX_LOG_LINES)
            lines.append(line[:4000])
            job["log_lines"] = list(lines)
            generic_match = re.search(r"\[progress\s+([0-9]+)/([0-9]+)\]", line)
            match = re.search(r"\[(low|final)\s+([0-9]+)/([0-9]+)\]", line)
            if generic_match:
                current, total = generic_match.groups()
                current_int = int(current)
                total_int = int(total)
                job["progress"] = {
                    "phase": "step stability",
                    "current": current_int,
                    "total": total_int,
                    "ratio": current_int / total_int,
                }
            elif match:
                phase, current, total = match.groups()
                current_int = int(current)
                total_int = int(total)
                offset = 0 if phase == "low" else total_int
                denominator = total_int * 2
                job["progress"] = {
                    "phase": phase,
                    "current": offset + current_int,
                    "total": denominator,
                    "ratio": (offset + current_int) / denominator,
                }
            else:
                job["progress"]["phase"] = "running"
            self._persist(job)

    def _collect_results(self, job: dict[str, Any], output_dir: Path | None) -> None:
        if output_dir is None or not output_dir.exists():
            return
        artifacts = []
        for path in sorted(output_dir.rglob("*")):
            if not path.is_file() or path.suffix.lower() not in ALLOWED_ARTIFACT_SUFFIXES:
                continue
            relative = path.relative_to(self.project_root).as_posix()
            artifact_id = hashlib.sha256(relative.encode("utf-8")).hexdigest()[:16]
            media_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
            artifacts.append(
                {
                    "id": artifact_id,
                    "name": path.name,
                    "relative_path": relative,
                    "media_type": media_type,
                    "bytes": path.stat().st_size,
                    "url": f"/api/experiments/jobs/{job['id']}/artifacts/{artifact_id}",
                }
            )
        job["artifacts"] = artifacts[:500]
        summary_names = {
            "seed_f0": "summary.json",
            "step_stability": "summary.json",
            "voice_evaluation": "evaluation.json",
            "speaker_compatibility": "compatibility.json",
            "runtime_observation": "observation_runtime.json",
        }
        summary_name = summary_names.get(job["tool"])
        if summary_name:
            summary_path = output_dir / summary_name
            if summary_path.is_file() and summary_path.stat().st_size <= 2 * 1024 * 1024:
                try:
                    job["summary"] = json.loads(summary_path.read_text(encoding="utf-8-sig"))
                except (OSError, json.JSONDecodeError):
                    pass
        report_names = {
            "seed_f0": "BENCHMARK_REPORT.md",
            "step_stability": "STEP_STABILITY_REPORT.md",
            "voice_evaluation": "EVALUATION_REPORT.md",
            "speaker_compatibility": "SPEAKER_INVERSION_COMPATIBILITY_REPORT.md",
        }
        report_name = report_names.get(job["tool"])
        if report_name:
            report_path = output_dir / report_name
            if report_path.is_file() and report_path.stat().st_size <= MAX_REPORT_BYTES:
                job["report_text"] = report_path.read_text(encoding="utf-8", errors="replace")

    def _snapshot(self, job: dict[str, Any]) -> dict[str, Any]:
        result = {key: value for key, value in job.items() if key != "log_lines"}
        result["log"] = "\n".join(job.get("log_lines", []))
        result["can_cancel"] = job["status"] in {"queued", "running", "cancelling"}
        return json.loads(json.dumps(result, ensure_ascii=False))

    def _persist(self, job: dict[str, Any]) -> None:
        path = self.job_root / f"{job['id']}.json"
        temporary = path.with_suffix(".tmp")
        temporary.write_text(
            json.dumps(job, ensure_ascii=False, indent=2, allow_nan=False) + "\n",
            encoding="utf-8",
        )
        temporary.replace(path)

    def _load_history(self) -> None:
        for path in sorted(self.job_root.glob("*.json"))[-50:]:
            try:
                job = json.loads(path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                continue
            if not isinstance(job, dict) or not JOB_ID_PATTERN.fullmatch(str(job.get("id", ""))):
                continue
            if job.get("status") in {"queued", "running", "cancelling"}:
                job["status"] = "interrupted"
                job["error"] = "The local service stopped before this job completed."
                job["finished_at"] = _now()
                self._persist(job)
            job.setdefault("log_lines", [])
            job.setdefault("artifacts", [])
            self._jobs[job["id"]] = job
