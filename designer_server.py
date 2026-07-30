#!/usr/bin/env python3
"""Local CharacterVoiceDesigner server and narrow audio.cpp HTTP bridge."""

from __future__ import annotations

import argparse
import json
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

from audio_postprocess import (
    AudioPostprocessError,
    analyze_wav_f0,
    correct_wav_f0,
    postprocess_dependency_status,
    psola_available,
)
from generation_observation import (
    ObservationCapture,
    ObservationStore,
    load_model_metadata,
    validate_observation_options,
)
from speaker_condition_reference import (
    SpeakerConditionError,
    inspect_embedding,
    speaker_condition_capabilities,
)
from experiment_jobs import (
    ExperimentBusyError,
    ExperimentError,
    ExperimentJobManager,
    ExperimentNotFoundError,
    MAX_UPLOAD_BYTES,
)


PROJECT_ROOT = Path(__file__).resolve().parent
MODEL_ID_PATTERN = re.compile(r"^[A-Za-z0-9_.:-]{1,128}$")
LANGUAGE_PATTERN = re.compile(r"^[A-Za-z][A-Za-z0-9-]{1,15}$")
SPEAKER_CONDITION_NAME_PATTERN = re.compile(
    r"^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}\.speaker\.safetensors$"
)
MAX_JSON_BYTES = 128 * 1024
MAX_AUDIO_BYTES = 256 * 1024 * 1024
STATIC_EXTENSIONS = {
    ".html",
    ".js",
    ".css",
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".gif",
    ".svg",
    ".ico",
    ".wav",
}
BLOCKED_STATIC_PREFIXES = ("/.git", "/data/", "/scripts/", "/tests/", "/runtime/")
SPEAKER_CONDITION_ROOT = PROJECT_ROOT / "runtime" / "speaker_conditions"


class DesignerServer(ThreadingHTTPServer):
    audio_cpp_base_url: str
    upstream_timeout_seconds: float
    observation_store: ObservationStore
    experiment_manager: ExperimentJobManager


class DesignerHandler(SimpleHTTPRequestHandler):
    server_version = "CharacterVoiceDesigner/0.1"

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, directory=str(PROJECT_ROOT), **kwargs)

    def end_headers(self) -> None:
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Cross-Origin-Resource-Policy", "same-origin")
        self.send_header(
            "Content-Security-Policy",
            "default-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; "
            "connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
        )
        super().end_headers()

    def do_GET(self) -> None:  # noqa: N802 - stdlib handler API
        path = urllib.parse.urlsplit(self.path).path
        if path == "/api/experiments/catalog":
            self._send_json(HTTPStatus.OK, self.server.experiment_manager.catalog())
            return
        if path == "/api/experiments/resources":
            self._send_json(HTTPStatus.OK, self.server.experiment_manager.resources())
            return
        if path == "/api/experiments/jobs":
            self._send_json(HTTPStatus.OK, self.server.experiment_manager.list_jobs())
            return
        experiment_match = re.fullmatch(
            r"/api/experiments/jobs/([^/]+)(?:/artifacts/([^/]+))?",
            path,
        )
        if experiment_match:
            job_id, artifact_id = experiment_match.groups()
            try:
                if artifact_id:
                    artifact_path, media_type = self.server.experiment_manager.artifact_path(
                        job_id,
                        artifact_id,
                    )
                    self._send_file(artifact_path, media_type)
                else:
                    self._send_json(
                        HTTPStatus.OK,
                        self.server.experiment_manager.get_job(job_id),
                    )
            except ExperimentNotFoundError as error:
                self._send_json(HTTPStatus.NOT_FOUND, {"error": str(error)})
            return
        if path == "/api/runtime/health":
            self._send_json(
                HTTPStatus.OK,
                {
                    "app": "CharacterVoiceDesigner",
                    "psola_available": psola_available(),
                    "postprocess_dependencies": postprocess_dependency_status(),
                },
            )
            return
        if path == "/api/runtime/observation-capabilities":
            query = urllib.parse.parse_qs(urllib.parse.urlsplit(self.path).query)
            model = query.get("model", ["irodori-vdes"])[0]
            if not MODEL_ID_PATTERN.fullmatch(model):
                self._send_json(HTTPStatus.BAD_REQUEST, {"error": "model is invalid."})
                return
            metadata = load_model_metadata(PROJECT_ROOT, model)
            architecture = metadata.get("architecture", {})
            self._send_json(
                HTTPStatus.OK,
                {
                    "schema_version": "cvd_observation_capabilities_0.1",
                    "model": metadata,
                    "storage": {
                        "local_only": True,
                        "opt_in": True,
                        "stores_audio": False,
                        "stores_text_by_default": False,
                    },
                    "available": {
                        "request_conditions": True,
                        "generation_timing": True,
                        "output_wav_hash": True,
                        "output_wav_analysis": True,
                        "speaker_condition": False,
                        "caption_condition": False,
                        "initial_audio_latent": False,
                        "latent_snapshots": False,
                        "duration_prediction": False,
                    },
                    "expected_dimensions": {
                        "speaker_condition": architecture.get("speaker_dim"),
                        "caption_condition": architecture.get("caption_dim"),
                        "audio_latent": architecture.get("latent_dim"),
                    },
                    "internal_runtime_note": (
                        "The pinned audio.cpp runtime does not expose internal tensors yet. "
                        "The observation schema is ready to ingest hashes and duration metadata "
                        "when the native hook is available."
                    ),
                },
            )
            return
        if path == "/api/runtime/speaker-condition-capabilities":
            query = urllib.parse.parse_qs(urllib.parse.urlsplit(self.path).query)
            model = query.get("model", ["irodori-vdes"])[0]
            if not MODEL_ID_PATTERN.fullmatch(model):
                self._send_json(HTTPStatus.BAD_REQUEST, {"error": "model is invalid."})
                return
            metadata = load_model_metadata(PROJECT_ROOT, model)
            self._send_json(
                HTTPStatus.OK,
                speaker_condition_capabilities(PROJECT_ROOT, metadata),
            )
            return
        if path.startswith("/api/runtime/observations/"):
            observation_id = path.rsplit("/", 1)[-1]
            record = self.server.observation_store.read(observation_id)
            if record is None:
                self._send_json(HTTPStatus.NOT_FOUND, {"error": "Observation was not found."})
                return
            self._send_json(HTTPStatus.OK, record)
            return
        if path == "/api/audio-cpp/health":
            self._proxy_get("/health")
            return
        if path == "/api/audio-cpp/models":
            self._proxy_get("/v1/models")
            return
        if not self._static_path_allowed(path):
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        super().do_GET()

    def do_HEAD(self) -> None:  # noqa: N802 - stdlib handler API
        path = urllib.parse.urlsplit(self.path).path
        if not self._static_path_allowed(path):
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        super().do_HEAD()

    def do_POST(self) -> None:  # noqa: N802 - stdlib handler API
        parsed = urllib.parse.urlsplit(self.path)
        path = parsed.path
        if path == "/api/experiments/jobs":
            try:
                payload = self._read_json()
                job = self.server.experiment_manager.start(
                    payload.get("tool"),
                    payload.get("options", {}),
                )
                self._send_json(HTTPStatus.ACCEPTED, job)
            except ExperimentBusyError as error:
                self._send_json(HTTPStatus.CONFLICT, {"error": str(error)})
            except (ExperimentError, ValueError) as error:
                self._send_json(HTTPStatus.BAD_REQUEST, {"error": str(error)})
            return
        cancel_match = re.fullmatch(r"/api/experiments/jobs/([^/]+)/cancel", path)
        if cancel_match:
            try:
                job = self.server.experiment_manager.cancel(cancel_match.group(1))
                self._send_json(HTTPStatus.OK, job)
            except ExperimentNotFoundError as error:
                self._send_json(HTTPStatus.NOT_FOUND, {"error": str(error)})
            return
        if path == "/api/experiments/uploads":
            query = urllib.parse.parse_qs(parsed.query)
            kind = query.get("kind", [""])[0]
            name = query.get("name", [""])[0]
            try:
                body = self._read_body(MAX_UPLOAD_BYTES)
                resource = self.server.experiment_manager.store_upload(kind, name, body)
                self._send_json(HTTPStatus.CREATED, resource)
            except (ExperimentError, ValueError) as error:
                self._send_json(HTTPStatus.BAD_REQUEST, {"error": str(error)})
            return
        if path != "/api/audio-cpp/speech":
            self._send_json(HTTPStatus.NOT_FOUND, {"error": "Unknown API route."})
            return
        try:
            payload = self._read_json()
            request = validate_speech_request(payload)
        except ValueError as error:
            self._send_json(HTTPStatus.BAD_REQUEST, {"error": str(error)})
            return
        postprocess = request.pop("_cvd_postprocess", None)
        observation_options = request.pop("_cvd_observation", None)
        speaker_condition = request.pop("_cvd_speaker_condition", None)
        observation = (
            self.server.observation_store.begin(request, postprocess, observation_options)
            if observation_options
            else None
        )
        if observation and speaker_condition:
            observation.record["request"]["speaker_condition"] = dict(
                speaker_condition
            )
            observation.record["internal_conditions"]["speaker_condition"].update(
                {
                    "requested": True,
                    "input_sha256": speaker_condition["sha256"],
                    "input_state_f32le_sha256": speaker_condition[
                        "state_f32le_sha256"
                    ],
                    "input_shape": speaker_condition["shape"],
                }
            )
        self._proxy_json(
            "/v1/audio/speech",
            request,
            postprocess,
            observation,
            speaker_condition,
        )

    def _static_path_allowed(self, raw_path: str) -> bool:
        path = urllib.parse.unquote(raw_path)
        normalized = path.replace("\\", "/")
        if any(normalized.startswith(prefix) for prefix in BLOCKED_STATIC_PREFIXES):
            return False
        if normalized in ("", "/") or normalized.endswith("/"):
            return True
        return Path(normalized).suffix.lower() in STATIC_EXTENSIONS

    def _read_json(self) -> dict[str, Any]:
        body = self._read_body(MAX_JSON_BYTES)
        try:
            payload = json.loads(body.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            raise ValueError("Request body must be UTF-8 JSON.") from error
        if not isinstance(payload, dict):
            raise ValueError("JSON request root must be an object.")
        return payload

    def _read_body(self, maximum: int) -> bytes:
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError as error:
            raise ValueError("Invalid Content-Length header.") from error
        if length <= 0 or length > maximum:
            raise ValueError("Request size is invalid.")
        return self.rfile.read(length)

    def _proxy_get(self, upstream_path: str) -> None:
        request = urllib.request.Request(
            self.server.audio_cpp_base_url + upstream_path,
            headers={"Accept": "application/json"},
            method="GET",
        )
        self._perform_upstream_request(request)

    def _proxy_json(
        self,
        upstream_path: str,
        payload: dict[str, Any],
        postprocess: dict[str, Any] | None = None,
        observation: ObservationCapture | None = None,
        speaker_condition: dict[str, Any] | None = None,
    ) -> None:
        body = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        request = urllib.request.Request(
            self.server.audio_cpp_base_url + upstream_path,
            data=body,
            headers={"Content-Type": "application/json", "Accept": "audio/wav"},
            method="POST",
        )
        self._perform_upstream_request(
            request,
            postprocess,
            observation,
            speaker_condition,
        )

    def _perform_upstream_request(
        self,
        request: urllib.request.Request,
        postprocess: dict[str, Any] | None = None,
        observation: ObservationCapture | None = None,
        speaker_condition: dict[str, Any] | None = None,
    ) -> None:
        upstream_started = time.perf_counter()
        try:
            with urllib.request.urlopen(request, timeout=self.server.upstream_timeout_seconds) as response:
                body = response.read(MAX_AUDIO_BYTES + 1)
                upstream_body = body
                upstream_seconds = time.perf_counter() - upstream_started
                if len(body) > MAX_AUDIO_BYTES:
                    raise ValueError("audio.cpp response exceeded the local size limit.")
                correction_metadata = None
                postprocess_seconds = 0.0
                if postprocess and response.headers.get_content_type() == "audio/wav":
                    postprocess_started = time.perf_counter()
                    body, correction_metadata = correct_wav_f0(
                        body,
                        target_hz=postprocess["target_hz"],
                        strength=postprocess["strength"],
                    )
                    postprocess_seconds = time.perf_counter() - postprocess_started
                observation_written = False
                if observation:
                    observation_written = observation.finalize_success(
                        upstream_body=upstream_body,
                        body=body,
                        status=response.status,
                        content_type=response.headers.get_content_type(),
                        upstream_seconds=upstream_seconds,
                        postprocess_seconds=postprocess_seconds,
                        correction_metadata=correction_metadata,
                        upstream_headers=response.headers,
                        f0_analyzer=analyze_wav_f0,
                    )
                self.send_response(response.status)
                self.send_header("Content-Type", response.headers.get_content_type())
                self.send_header("Content-Length", str(len(body)))
                self.send_header("Cache-Control", "no-store")
                if observation_written:
                    self.send_header("X-CVD-Observation-ID", observation.id)
                if speaker_condition:
                    self.send_header(
                        "X-CVD-Speaker-Condition-SHA256",
                        speaker_condition["sha256"],
                    )
                    self.send_header(
                        "X-CVD-Speaker-Artifact-SHA256",
                        speaker_condition["sha256"],
                    )
                    self.send_header(
                        "X-CVD-Speaker-Condition-Shape",
                        "x".join(str(value) for value in speaker_condition["shape"]),
                    )
                    native_state_sha = response.headers.get(
                        "X-AudioCpp-Speaker-Condition-SHA256"
                    )
                    if native_state_sha and re.fullmatch(
                        r"[a-fA-F0-9]{64}", native_state_sha
                    ):
                        self.send_header(
                            "X-CVD-Speaker-State-SHA256",
                            native_state_sha.lower(),
                        )
                    native_shape = response.headers.get(
                        "X-AudioCpp-Speaker-Condition-Shape"
                    )
                    if native_shape and re.fullmatch(
                        r"[1-9][0-9]*x[1-9][0-9]*", native_shape
                    ):
                        self.send_header(
                            "X-CVD-Speaker-State-Shape",
                            native_shape,
                        )
                    native_mode = response.headers.get(
                        "X-AudioCpp-Speaker-Condition-Mode"
                    )
                    if native_mode in {"none", "reference_audio", "speaker_inversion"}:
                        self.send_header(
                            "X-CVD-Speaker-Condition-Mode",
                            native_mode,
                        )
                if correction_metadata:
                    self.send_header("X-CVD-F0-Measured-Hz", str(correction_metadata["measured_hz"]))
                    self.send_header("X-CVD-F0-Target-Hz", str(correction_metadata["target_hz"]))
                    self.send_header("X-CVD-F0-Output-Hz", str(correction_metadata["output_hz"]))
                    self.send_header("X-CVD-F0-Shift-Semitones", str(correction_metadata["applied_semitones"]))
                    self.send_header("X-CVD-F0-Method", str(correction_metadata["method"]))
                self.end_headers()
                self.wfile.write(body)
        except urllib.error.HTTPError as error:
            if observation:
                observation.finalize_error(
                    "upstream_http",
                    f"HTTP {error.code}",
                    time.perf_counter() - upstream_started,
                )
            body = error.read(MAX_JSON_BYTES)
            content_type = error.headers.get_content_type() if error.headers else "application/json"
            self.send_response(error.code)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)
        except AudioPostprocessError as error:
            if observation:
                observation.finalize_error(
                    "postprocess",
                    str(error),
                    time.perf_counter() - upstream_started,
                )
            self._send_json(HTTPStatus.UNPROCESSABLE_ENTITY, {"error": str(error)})
        except (urllib.error.URLError, TimeoutError, ValueError) as error:
            reason = getattr(error, "reason", error)
            if observation:
                observation.finalize_error(
                    "upstream",
                    str(reason),
                    time.perf_counter() - upstream_started,
                )
            self._send_json(
                HTTPStatus.BAD_GATEWAY,
                {"error": f"audio.cpp is unavailable at {self.server.audio_cpp_base_url}: {reason}"},
            )

    def _send_json(self, status: HTTPStatus | int, payload: dict[str, Any]) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(int(status))
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _send_file(self, path: Path, media_type: str) -> None:
        size = path.stat().st_size
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", media_type)
        self.send_header("Content-Length", str(size))
        self.send_header("Cache-Control", "no-store")
        self.send_header(
            "Content-Disposition",
            f'attachment; filename="{path.name.replace(chr(34), "")}"',
        )
        self.end_headers()
        with path.open("rb") as stream:
            while chunk := stream.read(1024 * 1024):
                self.wfile.write(chunk)


def bounded_number(value: Any, field: str, minimum: float, maximum: float) -> float:
    if isinstance(value, bool):
        raise ValueError(f"{field} must be numeric.")
    try:
        number = float(value)
    except (TypeError, ValueError) as error:
        raise ValueError(f"{field} must be numeric.") from error
    if not minimum <= number <= maximum:
        raise ValueError(f"{field} must be between {minimum} and {maximum}.")
    return number


def resolve_speaker_condition(
    project_root: Path,
    model_id: str,
    value: Any,
) -> tuple[Path, dict[str, Any]] | None:
    if value is None:
        return None
    if not isinstance(value, dict):
        raise ValueError("speaker_condition must be an object.")
    name = value.get("file")
    if not isinstance(name, str) or not SPEAKER_CONDITION_NAME_PATTERN.fullmatch(name):
        raise ValueError(
            "speaker_condition.file must be a managed .speaker.safetensors filename."
        )
    root = (project_root / "runtime" / "speaker_conditions").resolve()
    path = (root / name).resolve()
    if path.parent != root or not path.is_file():
        raise ValueError("The managed speaker condition was not found.")

    metadata = load_model_metadata(project_root, model_id)
    architecture = metadata.get("architecture", {})
    model_contract = {
        "config_sha256": metadata.get("model_config_sha256"),
        "checkpoint": {"sha256": None},
        "speaker_condition": {
            "enabled": bool(architecture.get("use_speaker_condition", False)),
            "dimension": architecture.get("speaker_dim"),
        },
    }
    try:
        artifact = inspect_embedding(path, model=model_contract)
    except SpeakerConditionError as error:
        raise ValueError(f"The speaker condition could not be read: {error}") from error
    if not artifact["upstream_file_contract_compatible"]:
        raise ValueError(
            "The speaker condition does not satisfy the Speaker Inversion file contract."
        )
    if not artifact["target_model_contract_compatible"]:
        raise ValueError(
            "The speaker condition is incompatible with the selected model."
        )
    sidecar = artifact.get("sidecar") or {}
    if sidecar.get("provenance", {}).get("semantic_voice") is False:
        raise ValueError("A non-semantic format fixture cannot be used for speech.")
    if artifact["model_binding_status"] in {"invalid", "incompatible"}:
        raise ValueError(
            "The speaker condition provenance does not match the selected model."
        )
    return path, {
        "file": name,
        "sha256": artifact["sha256"],
        "state_f32le_sha256": artifact["state_f32le_sha256"],
        "shape": artifact["shape"],
        "model_binding_status": artifact["model_binding_status"],
    }


def validate_speech_request(payload: dict[str, Any]) -> dict[str, Any]:
    model = payload.get("model")
    text = payload.get("input")
    language = payload.get("language", "ja")
    if not isinstance(model, str) or not MODEL_ID_PATTERN.fullmatch(model):
        raise ValueError("model must be a configured audio.cpp model id.")
    if not isinstance(text, str) or not text.strip() or len(text) > 5000:
        raise ValueError("input must contain 1 to 5000 characters.")
    if not isinstance(language, str) or not LANGUAGE_PATTERN.fullmatch(language):
        raise ValueError("language is invalid.")

    request: dict[str, Any] = {
        "model": model,
        "input": text.strip(),
        "language": language,
        "seed": int(bounded_number(payload.get("seed", 20260719), "seed", 0, 2147483647)),
        "num_inference_steps": int(
            bounded_number(payload.get("num_inference_steps", 40), "num_inference_steps", 4, 100)
        ),
    }
    raw_options = payload.get("options", {})
    if not isinstance(raw_options, dict):
        raise ValueError("options must be an object.")
    caption = raw_options.get("caption", "")
    if not isinstance(caption, str) or len(caption) > 2000:
        raise ValueError("options.caption must be text up to 2000 characters.")
    no_ref = raw_options.get("no_ref", True)
    trim_tail = raw_options.get("trim_tail", True)
    if not isinstance(no_ref, bool) or not isinstance(trim_tail, bool):
        raise ValueError("options.no_ref and options.trim_tail must be boolean.")
    request["options"] = {
        "no_ref": no_ref,
        "caption": caption.strip(),
        "duration_scale": bounded_number(raw_options.get("duration_scale", 1), "options.duration_scale", 0.5, 2),
        "caption_guidance_scale": bounded_number(
            raw_options.get("caption_guidance_scale", 2), "options.caption_guidance_scale", 0.5, 10
        ),
        "trim_tail": trim_tail,
    }
    speaker_condition = resolve_speaker_condition(
        PROJECT_ROOT,
        model,
        payload.get("speaker_condition"),
    )
    if speaker_condition is not None:
        speaker_path, speaker_metadata = speaker_condition
        request["options"]["no_ref"] = False
        request["options"]["speaker_embedding_path"] = str(speaker_path)
        request["_cvd_speaker_condition"] = speaker_metadata
    raw_postprocess = payload.get("postprocess", {})
    if not isinstance(raw_postprocess, dict):
        raise ValueError("postprocess must be an object.")
    raw_f0 = raw_postprocess.get("f0", {})
    if not isinstance(raw_f0, dict):
        raise ValueError("postprocess.f0 must be an object.")
    f0_enabled = raw_f0.get("enabled", False)
    if not isinstance(f0_enabled, bool):
        raise ValueError("postprocess.f0.enabled must be boolean.")
    if f0_enabled:
        request["_cvd_postprocess"] = {
            "target_hz": bounded_number(raw_f0.get("target_hz"), "postprocess.f0.target_hz", 60, 500),
            "strength": bounded_number(raw_f0.get("strength", 1), "postprocess.f0.strength", 0, 1),
        }
    observation = validate_observation_options(payload.get("observation"))
    if observation:
        request["_cvd_observation"] = observation
    return request


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Serve CharacterVoiceDesigner and proxy a local audio.cpp server.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument(
        "--audio-cpp-url",
        default=os.environ.get("AUDIOCPP_BASE_URL", "http://127.0.0.1:8080"),
        help="Fixed local audio.cpp server origin.",
    )
    parser.add_argument("--upstream-timeout", type=float, default=600)
    return parser.parse_args()


def normalize_upstream_url(value: str) -> str:
    parsed = urllib.parse.urlsplit(value)
    if parsed.scheme != "http" or parsed.hostname not in {"127.0.0.1", "localhost", "::1"}:
        raise ValueError("audio.cpp URL must be an explicit local HTTP origin.")
    if parsed.path not in ("", "/") or parsed.query or parsed.fragment or parsed.username or parsed.password:
        raise ValueError("audio.cpp URL must not include a path, credentials, query, or fragment.")
    return value.rstrip("/")


def normalize_bind_host(value: str) -> str:
    if value not in {"127.0.0.1", "localhost", "::1"}:
        raise ValueError("CharacterVoiceDesigner must bind to an explicit loopback host.")
    return value


def main() -> None:
    args = parse_args()
    bind_host = normalize_bind_host(args.host)
    server = DesignerServer((bind_host, args.port), DesignerHandler)
    server.audio_cpp_base_url = normalize_upstream_url(args.audio_cpp_url)
    server.upstream_timeout_seconds = max(1, args.upstream_timeout)
    server.observation_store = ObservationStore(PROJECT_ROOT / "runtime" / "observations", PROJECT_ROOT)
    server.experiment_manager = ExperimentJobManager(
        PROJECT_ROOT,
        bridge_base_url=f"http://{bind_host}:{server.server_port}",
        audio_cpp_base_url=server.audio_cpp_base_url,
    )
    SPEAKER_CONDITION_ROOT.mkdir(parents=True, exist_ok=True)
    print(f"CharacterVoiceDesigner: http://{bind_host}:{args.port}/")
    print(f"audio.cpp upstream: {server.audio_cpp_base_url}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.experiment_manager.shutdown()
        server.server_close()


if __name__ == "__main__":
    main()
