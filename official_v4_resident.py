#!/usr/bin/env python3
"""Own a resident official Irodori-TTS v4 worker process."""

from __future__ import annotations

import json
import os
import socket
import subprocess
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

from official_v4_runtime import OfficialV4Result
from speaker_inversion_pipeline import _runtime_paths


class OfficialV4ResidentError(RuntimeError):
    """Raised when the resident official runtime cannot serve a request."""


def _find_free_port(preferred: int = 8090) -> int:
    for port in range(preferred, preferred + 101):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            try:
                sock.bind(("127.0.0.1", port))
            except OSError:
                continue
            return port
    raise OfficialV4ResidentError(f"No free local port was found near {preferred}.")


def _http_json(url: str, *, timeout: float = 2.0) -> dict[str, Any] | None:
    try:
        with urllib.request.urlopen(url, timeout=timeout) as response:
            payload = json.load(response)
        return payload if isinstance(payload, dict) else None
    except (OSError, ValueError, urllib.error.URLError):
        return None


class OfficialV4ResidentManager:
    def __init__(self, project_root: Path) -> None:
        self.project_root = project_root.resolve()
        self.paths = _runtime_paths(self.project_root)
        self._lock = threading.RLock()
        self._process: subprocess.Popen[bytes] | None = None
        self._stdout_handle: Any = None
        self._stderr_handle: Any = None
        self._active: dict[str, Any] = {}
        self._last_error = ""

    @property
    def active_pid(self) -> int | None:
        process = self._process
        return process.pid if process and process.poll() is None else None

    @property
    def base_url(self) -> str | None:
        port = self._active.get("port")
        return f"http://127.0.0.1:{port}" if port and self.active_pid else None

    def status(self) -> dict[str, Any]:
        running = self.active_pid is not None
        return {
            "managed": True,
            "running": running,
            "model": "irodori-v4-small" if running else None,
            "runtime_kind": "official_python_resident" if running else None,
            "device_id": self._active.get("device_id") if running else None,
            "device_label": self._active.get("device_label") if running else None,
            "vram_limit_mib": int(self._active.get("vram_limit_mib") or 0) if running else 0,
            "pid": self.active_pid,
            "port": self._active.get("port") if running else None,
            "last_error": self._last_error or None,
        }

    def _required_paths(self) -> list[Path]:
        return [
            self.paths["uv"],
            self.paths["source"] / "irodori_tts" / "inference_runtime.py",
            self.paths["model"],
            self.paths["compute_launcher"],
            self.project_root / "official_v4_worker.py",
        ]

    def activate(self, device: dict[str, Any], vram_limit_mib: int = 0) -> dict[str, Any]:
        with self._lock:
            if device.get("backend") != "cuda":
                raise OfficialV4ResidentError("Irodori v4-Small requires an NVIDIA CUDA GPU.")
            total = int(device.get("memory_mib") or 0)
            limit = int(vram_limit_mib or 0)
            if limit and not 512 <= limit <= total:
                raise OfficialV4ResidentError(
                    f"VRAM limit must be 0 or 512-{total} MiB for this GPU."
                )
            if (
                self.active_pid
                and self._active.get("device_id") == device.get("id")
                and int(self._active.get("vram_limit_mib") or 0) == limit
                and self.base_url
                and _http_json(self.base_url + "/health")
            ):
                return self.status()
            self.stop(reason="runtime selection changed")
            missing = [str(path) for path in self._required_paths() if not path.exists()]
            if missing:
                raise OfficialV4ResidentError(
                    "Official v4 runtime is incomplete: " + ", ".join(missing)
                )
            port = _find_free_port()
            log_root = self.project_root / "runtime" / "logs"
            log_root.mkdir(parents=True, exist_ok=True)
            work_root = self.project_root / "runtime" / "official_v4_worker"
            work_root.mkdir(parents=True, exist_ok=True)
            command = [
                str(self.paths["uv"]),
                "run",
                "--no-sync",
                "python",
                str(self.paths["compute_launcher"]),
                "--gpu-index",
                str(int(device.get("physical_index"))),
                "--vram-limit-mib",
                str(limit),
                "--target",
                str(self.project_root / "official_v4_worker.py"),
                "--",
                "--source",
                str(self.paths["source"]),
                "--checkpoint",
                str(self.paths["model"]),
                "--embedding-root",
                str(self.paths["embeddings"]),
                "--work-root",
                str(work_root),
                "--port",
                str(port),
            ]
            self._stdout_handle = (log_root / "official_v4.active.stdout.log").open("wb")
            self._stderr_handle = (log_root / "official_v4.active.stderr.log").open("wb")
            kwargs: dict[str, Any] = {
                "cwd": str(self.paths["source"]),
                "env": {**os.environ, "PYTHONUNBUFFERED": "1"},
                "stdout": self._stdout_handle,
                "stderr": self._stderr_handle,
            }
            if os.name == "nt":
                kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP
            else:
                kwargs["start_new_session"] = True
            self._process = subprocess.Popen(command, **kwargs)
            self._active = {
                "device_id": device.get("id"),
                "device_label": device.get("label") or device.get("id"),
                "vram_limit_mib": limit,
                "port": port,
            }
            deadline = time.monotonic() + 600
            while time.monotonic() < deadline:
                if self._process.poll() is not None:
                    code = self._process.returncode
                    detail = self._log_tail()
                    self._last_error = f"Official v4 runtime exited during startup ({code}): {detail}"
                    self.stop(reason=self._last_error)
                    raise OfficialV4ResidentError(self._last_error)
                health = _http_json(f"http://127.0.0.1:{port}/health")
                if health and health.get("ready"):
                    self._last_error = ""
                    return self.status()
                time.sleep(0.5)
            self._last_error = "Timed out loading the resident official v4 runtime."
            self.stop(reason=self._last_error)
            raise OfficialV4ResidentError(self._last_error)

    def _log_tail(self, limit: int = 16) -> str:
        path = self.project_root / "runtime" / "logs" / "official_v4.active.stderr.log"
        try:
            lines = [line.strip() for line in path.read_text(encoding="utf-8", errors="replace").splitlines() if line.strip()]
        except OSError:
            return "no worker log"
        return " | ".join(lines[-limit:])[-8000:] or "no worker diagnostic"

    def render(
        self,
        request: dict[str, Any],
        embedding: str | None,
        *,
        timeout_seconds: float,
    ) -> OfficialV4Result:
        base_url = self.base_url
        if not base_url:
            raise OfficialV4ResidentError("Official v4 resident runtime is not running.")
        options = request.get("options") or {}
        payload = {
            "text": str(request["input"]),
            "caption": str(options.get("caption") or ""),
            "steps": int(request["num_inference_steps"]),
            "seed": int(request["seed"]),
            "text_guidance": 3.0,
            "caption_guidance": float(options.get("caption_guidance_scale", 2.0)),
            "speaker_guidance": float(options.get("speaker_guidance_scale", 5.0)),
            "duration_scale": float(options.get("duration_scale", 1.0)),
            "embedding": embedding,
        }
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        http_request = urllib.request.Request(
            base_url + "/synthesize",
            data=body,
            headers={"Content-Type": "application/json", "Accept": "audio/wav"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(http_request, timeout=max(1.0, timeout_seconds)) as response:
                wav = response.read(256 * 1024 * 1024 + 1)
                headers = {name: value for name, value in response.headers.items()}
        except urllib.error.HTTPError as error:
            try:
                detail = json.loads(error.read().decode("utf-8", "replace")).get("error")
            except (ValueError, AttributeError):
                detail = None
            raise OfficialV4ResidentError(detail or f"Official v4 worker returned HTTP {error.code}.") from error
        except (OSError, TimeoutError, urllib.error.URLError) as error:
            raise OfficialV4ResidentError(f"Official v4 resident runtime is unavailable: {error}") from error
        if len(wav) > 256 * 1024 * 1024 or not wav.startswith(b"RIFF"):
            raise OfficialV4ResidentError("Official v4 resident runtime returned invalid audio.")
        headers.update(
            {
                "Content-Type": "audio/wav",
                "X-CVD-Backend-ID": "irodori-v4-small",
                "X-CVD-Backend-Runtime": "official_python_resident",
                "X-CVD-Watermark-State": "not_declared_by_pinned_inference_runtime",
            }
        )
        return OfficialV4Result(wav_bytes=wav, headers=headers, log="resident worker")

    def stop(self, *, reason: str = "") -> None:
        with self._lock:
            process = self._process
            base_url = self.base_url
            self._process = None
            if process and process.poll() is None and base_url:
                try:
                    request = urllib.request.Request(base_url + "/shutdown", data=b"{}", method="POST")
                    urllib.request.urlopen(request, timeout=3).read()
                except OSError:
                    pass
            if process and process.poll() is None:
                try:
                    process.wait(timeout=20)
                except subprocess.TimeoutExpired:
                    process.terminate()
                    try:
                        process.wait(timeout=10)
                    except subprocess.TimeoutExpired:
                        process.kill()
                        process.wait(timeout=5)
            for handle_name in ("_stdout_handle", "_stderr_handle"):
                handle = getattr(self, handle_name)
                if handle:
                    handle.close()
                    setattr(self, handle_name, None)
            self._active = {}
            if reason and reason != "runtime selection changed":
                self._last_error = reason

    def shutdown(self) -> None:
        self.stop()
