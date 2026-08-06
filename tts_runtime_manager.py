#!/usr/bin/env python3
"""Coordinate mutually exclusive local TTS inference runtimes."""

from __future__ import annotations

import threading
from pathlib import Path
from typing import Any

from audio_cpp_runtime import AudioCppRuntimeError, AudioCppRuntimeManager
from official_v4_resident import OfficialV4ResidentError, OfficialV4ResidentManager
from official_v4_runtime import OfficialV4Result
from tts_backend_registry import OFFICIAL_V4_MODEL_ID


class TtsRuntimeError(RuntimeError):
    """Raised when a managed TTS runtime cannot be switched or used."""


class TtsRuntimeManager:
    def __init__(
        self,
        project_root: Path,
        audio_manifest: Path,
        *,
        audio_runtime: AudioCppRuntimeManager | None = None,
        official_runtime: OfficialV4ResidentManager | None = None,
    ) -> None:
        self._lock = threading.RLock()
        self.audio = audio_runtime or AudioCppRuntimeManager(project_root, audio_manifest)
        self.official = official_runtime or OfficialV4ResidentManager(project_root)
        self._last_status: dict[str, Any] = {
            "managed": True,
            "running": False,
            "model": None,
            "runtime_kind": None,
            "last_error": None,
        }

    def _device(self, device_id: str | None) -> dict[str, Any]:
        catalog = self.audio.catalog()
        selected = device_id or str(catalog.get("default_device") or "cpu")
        device = next(
            (item for item in catalog.get("devices", []) if item.get("id") == selected),
            None,
        )
        if not isinstance(device, dict):
            raise TtsRuntimeError("The selected compute device is not available.")
        return device

    def status(self) -> dict[str, Any]:
        official = self.official.status()
        if official.get("running"):
            return official
        audio = self.audio.status()
        if audio.get("running"):
            return {**audio, "runtime_kind": "audio_cpp"}
        return dict(self._last_status)

    def catalog(self) -> dict[str, Any]:
        catalog = self.audio.catalog()
        catalog["status"] = self.status()
        return catalog

    def activate(
        self,
        model_id: str,
        device_id: str | None = None,
        vram_limit_mib: int = 0,
    ) -> dict[str, Any]:
        with self._lock:
            try:
                if model_id == OFFICIAL_V4_MODEL_ID:
                    device = self._device(device_id)
                    self.audio.stop(reason="runtime selection changed")
                    status = self.official.activate(device, vram_limit_mib)
                else:
                    self.official.stop(reason="runtime selection changed")
                    status = self.audio.activate(model_id, device_id, vram_limit_mib)
                    status = {**status, "runtime_kind": "audio_cpp"}
            except (AudioCppRuntimeError, OfficialV4ResidentError, ValueError) as error:
                self._last_status = {
                    "managed": True,
                    "running": False,
                    "model": model_id,
                    "runtime_kind": (
                        "official_python_resident"
                        if model_id == OFFICIAL_V4_MODEL_ID
                        else "audio_cpp"
                    ),
                    "device_id": device_id,
                    "vram_limit_mib": int(vram_limit_mib or 0),
                    "last_error": str(error),
                }
                raise TtsRuntimeError(str(error)) from error
            self._last_status = dict(status)
            return status

    def ensure_for_request(
        self, runtime: dict[str, Any] | None, model_id: str
    ) -> dict[str, Any]:
        settings = runtime or {}
        return self.activate(
            model_id,
            str(settings.get("device_id") or self.audio.catalog().get("default_device") or "cpu"),
            int(settings.get("vram_limit_mib") or 0),
        )

    def render_official_v4(
        self,
        request: dict[str, Any],
        runtime: dict[str, Any] | None,
        embedding: str | None,
        *,
        timeout_seconds: float,
    ) -> OfficialV4Result:
        self.ensure_for_request(runtime, OFFICIAL_V4_MODEL_ID)
        try:
            return self.official.render(request, embedding, timeout_seconds=timeout_seconds)
        except OfficialV4ResidentError as error:
            raise TtsRuntimeError(str(error)) from error

    def request_url(self, path: str) -> str:
        return self.audio.request_url(path)

    def vram_guard(self):
        return self.audio.vram_guard()

    def stop(self, *, reason: str = "") -> None:
        with self._lock:
            self.official.stop(reason=reason)
            self.audio.stop(reason=reason)
            self._last_status = {
                "managed": True,
                "running": False,
                "model": None,
                "runtime_kind": None,
                "last_error": reason or None,
            }

    def shutdown(self) -> None:
        self.stop()
