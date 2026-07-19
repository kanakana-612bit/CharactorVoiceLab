#!/usr/bin/env python3
"""Local CharacterVoiceDesigner server and narrow audio.cpp HTTP bridge."""

from __future__ import annotations

import argparse
import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

from audio_postprocess import AudioPostprocessError, correct_wav_f0


PROJECT_ROOT = Path(__file__).resolve().parent
MODEL_ID_PATTERN = re.compile(r"^[A-Za-z0-9_.:-]{1,128}$")
LANGUAGE_PATTERN = re.compile(r"^[A-Za-z][A-Za-z0-9-]{1,15}$")
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


class DesignerServer(ThreadingHTTPServer):
    audio_cpp_base_url: str
    upstream_timeout_seconds: float


class DesignerHandler(SimpleHTTPRequestHandler):
    server_version = "CharacterVoiceDesigner/0.1"

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, directory=str(PROJECT_ROOT), **kwargs)

    def end_headers(self) -> None:
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Cross-Origin-Resource-Policy", "same-origin")
        super().end_headers()

    def do_GET(self) -> None:  # noqa: N802 - stdlib handler API
        path = urllib.parse.urlsplit(self.path).path
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
        path = urllib.parse.urlsplit(self.path).path
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
        self._proxy_json("/v1/audio/speech", request, postprocess)

    def _static_path_allowed(self, raw_path: str) -> bool:
        path = urllib.parse.unquote(raw_path)
        normalized = path.replace("\\", "/")
        if any(normalized.startswith(prefix) for prefix in BLOCKED_STATIC_PREFIXES):
            return False
        if normalized in ("", "/") or normalized.endswith("/"):
            return True
        return Path(normalized).suffix.lower() in STATIC_EXTENSIONS

    def _read_json(self) -> dict[str, Any]:
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError as error:
            raise ValueError("Invalid Content-Length header.") from error
        if length <= 0 or length > MAX_JSON_BYTES:
            raise ValueError("JSON request size is invalid.")
        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            raise ValueError("Request body must be UTF-8 JSON.") from error
        if not isinstance(payload, dict):
            raise ValueError("JSON request root must be an object.")
        return payload

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
    ) -> None:
        body = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        request = urllib.request.Request(
            self.server.audio_cpp_base_url + upstream_path,
            data=body,
            headers={"Content-Type": "application/json", "Accept": "audio/wav"},
            method="POST",
        )
        self._perform_upstream_request(request, postprocess)

    def _perform_upstream_request(
        self,
        request: urllib.request.Request,
        postprocess: dict[str, Any] | None = None,
    ) -> None:
        try:
            with urllib.request.urlopen(request, timeout=self.server.upstream_timeout_seconds) as response:
                body = response.read(MAX_AUDIO_BYTES + 1)
                if len(body) > MAX_AUDIO_BYTES:
                    raise ValueError("audio.cpp response exceeded the local size limit.")
                correction_metadata = None
                if postprocess and response.headers.get_content_type() == "audio/wav":
                    body, correction_metadata = correct_wav_f0(
                        body,
                        target_hz=postprocess["target_hz"],
                        strength=postprocess["strength"],
                    )
                self.send_response(response.status)
                self.send_header("Content-Type", response.headers.get_content_type())
                self.send_header("Content-Length", str(len(body)))
                self.send_header("Cache-Control", "no-store")
                if correction_metadata:
                    self.send_header("X-CVD-F0-Measured-Hz", str(correction_metadata["measured_hz"]))
                    self.send_header("X-CVD-F0-Target-Hz", str(correction_metadata["target_hz"]))
                    self.send_header("X-CVD-F0-Output-Hz", str(correction_metadata["output_hz"]))
                    self.send_header("X-CVD-F0-Shift-Semitones", str(correction_metadata["applied_semitones"]))
                    self.send_header("X-CVD-F0-Method", str(correction_metadata["method"]))
                self.end_headers()
                self.wfile.write(body)
        except urllib.error.HTTPError as error:
            body = error.read(MAX_JSON_BYTES)
            content_type = error.headers.get_content_type() if error.headers else "application/json"
            self.send_response(error.code)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)
        except AudioPostprocessError as error:
            self._send_json(HTTPStatus.UNPROCESSABLE_ENTITY, {"error": str(error)})
        except (urllib.error.URLError, TimeoutError, ValueError) as error:
            reason = getattr(error, "reason", error)
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


def main() -> None:
    args = parse_args()
    server = DesignerServer((args.host, args.port), DesignerHandler)
    server.audio_cpp_base_url = normalize_upstream_url(args.audio_cpp_url)
    server.upstream_timeout_seconds = max(1, args.upstream_timeout)
    print(f"CharacterVoiceDesigner: http://{args.host}:{args.port}/")
    print(f"audio.cpp upstream: {server.audio_cpp_base_url}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
