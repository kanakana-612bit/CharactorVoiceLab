#!/usr/bin/env python3
"""Own and switch the local audio.cpp server after a model is selected."""

from __future__ import annotations

import csv
import json
import os
import shutil
import socket
import subprocess
import threading
import time
import urllib.error
import urllib.request
from contextlib import AbstractContextManager
from pathlib import Path
from typing import Any


class AudioCppRuntimeError(RuntimeError):
    """Raised when the managed audio.cpp process cannot satisfy a request."""


def _is_within(path: Path, root: Path) -> bool:
    try:
        path.resolve().relative_to(root.resolve())
    except ValueError:
        return False
    return True


def _find_free_port(preferred: int = 8080) -> int:
    for port in range(preferred, preferred + 101):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            try:
                sock.bind(("127.0.0.1", port))
            except OSError:
                continue
            return port
    raise AudioCppRuntimeError(f"No free local port was found near {preferred}.")


def _http_ready(url: str) -> bool:
    try:
        with urllib.request.urlopen(url, timeout=2) as response:
            return 200 <= response.status < 300
    except (OSError, urllib.error.URLError):
        return False


def _nvidia_process_memory_mib(pid: int) -> int | None:
    executable = shutil.which("nvidia-smi")
    if not executable:
        return None
    try:
        result = subprocess.run(
            [
                executable,
                "--query-compute-apps=pid,used_memory",
                "--format=csv,noheader,nounits",
            ],
            check=False,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=5,
        )
    except (OSError, subprocess.SubprocessError):
        return None
    if result.returncode:
        return None
    total = 0
    found = False
    for row in csv.reader(result.stdout.splitlines(), skipinitialspace=True):
        if len(row) < 2:
            continue
        try:
            if int(row[0].strip()) == pid:
                total += int(row[1].strip())
                found = True
        except ValueError:
            continue
    return total if found else 0


class _VramGuard(AbstractContextManager["_VramGuard"]):
    def __init__(self, manager: "AudioCppRuntimeManager") -> None:
        self.manager = manager
        self.limit_mib = manager.active_vram_limit_mib
        self.pid = manager.active_pid
        self.device = manager.active_device
        self.exceeded_mib: int | None = None
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None

    def __enter__(self) -> "_VramGuard":
        if self.limit_mib > 0 and self.pid and self.device.startswith("cuda:"):
            self._thread = threading.Thread(target=self._monitor, daemon=True)
            self._thread.start()
        return self

    def _monitor(self) -> None:
        while not self._stop.wait(0.2):
            used = _nvidia_process_memory_mib(self.pid)
            if used is None:
                continue
            if used > self.limit_mib:
                self.exceeded_mib = used
                self.manager.stop(
                    reason=(
                        f"audio.cpp used {used} MiB VRAM, exceeding the configured "
                        f"{self.limit_mib} MiB safety limit."
                    )
                )
                return

    def __exit__(self, *exc_info: object) -> None:
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=1)

    def raise_if_exceeded(self) -> None:
        if self.exceeded_mib is not None:
            raise AudioCppRuntimeError(
                f"audio.cpp was stopped after VRAM usage reached {self.exceeded_mib} MiB "
                f"(configured limit: {self.limit_mib} MiB)."
            )


class AudioCppRuntimeManager:
    """Manage one lazy audio.cpp process selected by model and compute device."""

    def __init__(self, project_root: Path, manifest_path: Path) -> None:
        self.project_root = project_root.resolve()
        self.manifest_path = manifest_path.resolve()
        self._lock = threading.RLock()
        self._process: subprocess.Popen[bytes] | None = None
        self._stdout_handle: Any = None
        self._stderr_handle: Any = None
        self._active: dict[str, Any] = {}
        self._last_error = ""
        self.manifest = self._load_manifest()

    def _load_manifest(self) -> dict[str, Any]:
        if not _is_within(self.manifest_path, self.project_root):
            raise AudioCppRuntimeError("audio.cpp runtime manifest must be inside the project root.")
        try:
            value = json.loads(self.manifest_path.read_text(encoding="utf-8-sig"))
        except (OSError, json.JSONDecodeError) as error:
            raise AudioCppRuntimeError(f"audio.cpp runtime manifest is invalid: {error}") from error
        if not isinstance(value, dict):
            raise AudioCppRuntimeError("audio.cpp runtime manifest must contain an object.")
        executable = Path(str(value.get("executable", ""))).resolve()
        working_directory = Path(str(value.get("working_directory", ""))).resolve()
        if not _is_within(executable, self.project_root) or not executable.is_file():
            raise AudioCppRuntimeError("Managed audio.cpp executable was not found.")
        if not _is_within(working_directory, self.project_root) or not working_directory.is_dir():
            raise AudioCppRuntimeError("Managed audio.cpp working directory was not found.")
        models = value.get("models")
        devices = value.get("devices")
        if not isinstance(models, list) or not models:
            raise AudioCppRuntimeError("No managed audio.cpp model is configured.")
        if not isinstance(devices, list) or not devices:
            raise AudioCppRuntimeError("No audio.cpp compute device is configured.")
        return value

    @property
    def active_pid(self) -> int | None:
        process = self._process
        return process.pid if process and process.poll() is None else None

    @property
    def active_device(self) -> str:
        return str(self._active.get("device_id") or "")

    @property
    def active_vram_limit_mib(self) -> int:
        return int(self._active.get("vram_limit_mib") or 0)

    @property
    def base_url(self) -> str | None:
        port = self._active.get("port")
        if not port or self.active_pid is None:
            return None
        return f"http://127.0.0.1:{port}"

    def catalog(self) -> dict[str, Any]:
        return {
            "schema_version": "cvd_audio_cpp_runtime_catalog_0.1",
            "models": [dict(item) for item in self.manifest["models"]],
            "devices": [dict(item) for item in self.manifest["devices"]],
            "default_device": self.manifest.get("default_device", "cpu"),
            "vram_limit_policy": {
                "training": "pytorch_allocator_hard_limit",
                "generation": "process_monitor_stop_on_exceed",
                "generation_poll_interval_ms": 200,
            },
            "status": self.status(),
        }

    def status(self) -> dict[str, Any]:
        running = self.active_pid is not None
        return {
            "managed": True,
            "running": running,
            "model": self._active.get("model") if running else None,
            "device_id": self._active.get("device_id") if running else None,
            "device_label": self._active.get("device_label") if running else None,
            "vram_limit_mib": self.active_vram_limit_mib if running else 0,
            "pid": self.active_pid,
            "port": self._active.get("port") if running else None,
            "last_error": self._last_error or None,
        }

    def _model(self, model_id: str) -> dict[str, Any]:
        model = next((item for item in self.manifest["models"] if item.get("id") == model_id), None)
        if not isinstance(model, dict):
            raise AudioCppRuntimeError("The selected audio.cpp model is not configured.")
        return model

    def _device(self, device_id: str) -> dict[str, Any]:
        device = next((item for item in self.manifest["devices"] if item.get("id") == device_id), None)
        if not isinstance(device, dict):
            raise AudioCppRuntimeError("The selected compute device is not available.")
        return device

    def activate(
        self,
        model_id: str,
        device_id: str | None = None,
        vram_limit_mib: int = 0,
    ) -> dict[str, Any]:
        with self._lock:
            model = self._model(model_id)
            selected_id = device_id or str(self.manifest.get("default_device") or "cpu")
            device = self._device(selected_id)
            try:
                limit = int(vram_limit_mib or 0)
            except (TypeError, ValueError) as error:
                raise AudioCppRuntimeError("VRAM limit must be an integer number of MiB.") from error
            if device.get("backend") == "cpu":
                limit = 0
            else:
                total = int(device.get("memory_mib") or 0)
                if limit and not 512 <= limit <= total:
                    raise AudioCppRuntimeError(
                        f"VRAM limit must be 0 (unlimited) or 512-{total} MiB for this GPU."
                    )
            if (
                self.active_pid is not None
                and self._active.get("model") == model_id
                and self._active.get("device_id") == selected_id
                and self.active_vram_limit_mib == limit
                and self.base_url
                and _http_ready(self.base_url + "/health")
            ):
                return self.status()
            self.stop(reason="runtime selection changed")
            self._start(model, device, limit)
            return self.status()

    def _start(self, model: dict[str, Any], device: dict[str, Any], limit: int) -> None:
        executable = Path(self.manifest["executable"])
        working_directory = Path(self.manifest["working_directory"])
        runtime_root = self.project_root / "runtime"
        log_root = Path(str(self.manifest.get("log_root") or runtime_root / "logs"))
        log_root.mkdir(parents=True, exist_ok=True)
        port = _find_free_port(int(self.manifest.get("preferred_port") or 8080))
        config_path = runtime_root / "audio_cpp.active.json"
        backend = str(device.get("backend"))
        server_config = {
            "host": "127.0.0.1",
            "port": port,
            "backend": backend,
            "device": 0,
            "threads": int(self.manifest.get("threads") or 4),
            "lazy_load": True,
            "models": [{key: value for key, value in model.items() if key not in {"label"}}],
        }
        config_path.write_text(
            json.dumps(server_config, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        environment = os.environ.copy()
        for key, value in dict(self.manifest.get("environment") or {}).items():
            if isinstance(key, str) and isinstance(value, str):
                environment[key] = value
        if backend == "cuda":
            environment["CUDA_VISIBLE_DEVICES"] = str(device.get("physical_index"))
        else:
            environment["CUDA_VISIBLE_DEVICES"] = ""
        self._stdout_handle = (log_root / "audio_cpp.active.stdout.log").open("wb")
        self._stderr_handle = (log_root / "audio_cpp.active.stderr.log").open("wb")
        kwargs: dict[str, Any] = {
            "cwd": str(working_directory),
            "env": environment,
            "stdout": self._stdout_handle,
            "stderr": self._stderr_handle,
        }
        if os.name == "nt":
            kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP
        else:
            kwargs["start_new_session"] = True
        self._process = subprocess.Popen(
            [str(executable), "--config", str(config_path)],
            **kwargs,
        )
        self._active = {
            "model": model["id"],
            "device_id": device["id"],
            "device_label": device.get("label") or device["id"],
            "vram_limit_mib": limit,
            "port": port,
        }
        deadline = time.monotonic() + 90
        while time.monotonic() < deadline:
            if self._process.poll() is not None:
                self._last_error = f"audio.cpp exited during startup with status {self._process.returncode}."
                self.stop(reason=self._last_error)
                raise AudioCppRuntimeError(self._last_error)
            if _http_ready(f"http://127.0.0.1:{port}/health"):
                self._last_error = ""
                return
            time.sleep(0.25)
        self._last_error = "Timed out waiting for the selected audio.cpp runtime."
        self.stop(reason=self._last_error)
        raise AudioCppRuntimeError(self._last_error)

    def ensure_for_request(self, runtime: dict[str, Any] | None, model_id: str) -> dict[str, Any]:
        settings = runtime or {}
        return self.activate(
            model_id,
            str(settings.get("device_id") or self.manifest.get("default_device") or "cpu"),
            int(settings.get("vram_limit_mib") or 0),
        )

    def request_url(self, path: str) -> str:
        base = self.base_url
        if not base:
            raise AudioCppRuntimeError("audio.cpp is not running. Select a model and compute device first.")
        return base + path

    def vram_guard(self) -> _VramGuard:
        return _VramGuard(self)

    def stop(self, *, reason: str = "") -> None:
        with self._lock:
            process = self._process
            self._process = None
            if process and process.poll() is None:
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
