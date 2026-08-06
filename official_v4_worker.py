#!/usr/bin/env python3
"""Resident local-only Irodori-TTS v4 inference worker."""

from __future__ import annotations

import argparse
import json
import signal
import sys
import tempfile
import threading
import traceback
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from typing import Any


MAX_REQUEST_BYTES = 128 * 1024
MAX_AUDIO_BYTES = 256 * 1024 * 1024


def _inside(path: Path, root: Path) -> bool:
    try:
        path.resolve().relative_to(root.resolve())
    except ValueError:
        return False
    return True


class ResidentRuntime:
    def __init__(self, source: Path, checkpoint: Path, embedding_root: Path, work_root: Path) -> None:
        self.source = source.resolve()
        self.checkpoint = checkpoint.resolve()
        self.embedding_root = embedding_root.resolve()
        self.work_root = work_root.resolve()
        if not (self.source / "irodori_tts").is_dir():
            raise RuntimeError("Official Irodori-TTS source package was not found.")
        if not self.checkpoint.is_file():
            raise RuntimeError("Official Irodori-TTS v4 checkpoint was not found.")
        self.embedding_root.mkdir(parents=True, exist_ok=True)
        self.work_root.mkdir(parents=True, exist_ok=True)
        source_text = str(self.source)
        if source_text in sys.path:
            sys.path.remove(source_text)
        sys.path.insert(0, source_text)

        from irodori_tts.inference_runtime import InferenceRuntime, RuntimeKey

        self._runtime = InferenceRuntime.from_key(
            RuntimeKey(
                checkpoint=str(self.checkpoint),
                model_device="cuda",
                codec_repo="Aratako/Semantic-DACVAE-Japanese-32dim",
                model_precision="bf16",
                codec_device="cuda",
                codec_precision="fp32",
                codec_deterministic_encode=True,
                codec_deterministic_decode=True,
                compile_model=False,
                compile_dynamic=False,
            )
        )
        self._lock = threading.Lock()

    def _embedding(self, name: Any) -> Path | None:
        if name in (None, ""):
            return None
        if not isinstance(name, str) or Path(name).name != name:
            raise ValueError("Speaker Inversion embedding name is invalid.")
        path = (self.embedding_root / name).resolve()
        if not _inside(path, self.embedding_root) or not path.is_file():
            raise ValueError("Speaker Inversion embedding was not found.")
        return path

    def synthesize(self, payload: dict[str, Any]) -> tuple[bytes, dict[str, str]]:
        from irodori_tts.inference_runtime import SamplingRequest, resolve_cfg_scales, save_wav

        text = payload.get("text")
        caption = payload.get("caption")
        if not isinstance(text, str) or not text.strip():
            raise ValueError("text is required.")
        if caption is not None and not isinstance(caption, str):
            raise ValueError("caption must be text.")
        embedding = self._embedding(payload.get("embedding"))
        use_caption = bool(caption and caption.strip())
        use_speaker = embedding is not None
        cfg_text, cfg_caption, cfg_speaker, messages = resolve_cfg_scales(
            cfg_guidance_mode="independent",
            cfg_scale_text=float(payload.get("text_guidance", 3.0)),
            cfg_scale_caption=float(payload.get("caption_guidance", 2.0)),
            cfg_scale_speaker=float(payload.get("speaker_guidance", 5.0)),
            cfg_scale=None,
            use_caption_condition=use_caption,
            use_speaker_condition=use_speaker,
        )
        for message in messages:
            print(message, flush=True)
        with self._lock:
            result = self._runtime.synthesize(
                SamplingRequest(
                    text=text.strip(),
                    caption=caption.strip() if use_caption else None,
                    ref_embed=str(embedding) if embedding else None,
                    no_ref=not use_speaker,
                    num_candidates=1,
                    decode_mode="sequential",
                    duration_scale=float(payload.get("duration_scale", 1.0)),
                    num_steps=int(payload.get("steps", 20)),
                    cfg_scale_text=cfg_text,
                    cfg_scale_caption=cfg_caption,
                    cfg_scale_speaker=cfg_speaker,
                    cfg_guidance_mode="independent",
                    context_kv_cache=True,
                    seed=int(payload.get("seed", 20260719)),
                    trim_tail=True,
                ),
                log_fn=lambda message: print(message, flush=True),
            )
            with tempfile.NamedTemporaryFile(
                prefix="official-v4-", suffix=".wav", dir=self.work_root, delete=False
            ) as temporary:
                output = Path(temporary.name)
            try:
                save_wav(output, result.audio, result.sample_rate)
                wav = output.read_bytes()
            finally:
                output.unlink(missing_ok=True)
        if len(wav) > MAX_AUDIO_BYTES or not wav.startswith(b"RIFF"):
            raise RuntimeError("Official v4 worker produced an invalid WAV response.")
        return wav, {
            "X-CVD-Used-Seed": str(result.used_seed),
            "X-CVD-Speaker-Condition-Mode": "speaker_inversion" if embedding else "none",
        }

    def unload(self) -> None:
        self._runtime.unload()


class WorkerServer(HTTPServer):
    runtime: ResidentRuntime


class WorkerHandler(BaseHTTPRequestHandler):
    server: WorkerServer

    def _json(self, status: int, payload: dict[str, Any]) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:  # noqa: N802
        if self.path != "/health":
            self._json(HTTPStatus.NOT_FOUND, {"error": "Not found."})
            return
        self._json(
            HTTPStatus.OK,
            {"ready": True, "runtime_kind": "official_python_resident", "model": "irodori-v4-small"},
        )

    def do_POST(self) -> None:  # noqa: N802
        if self.path == "/shutdown":
            self._json(HTTPStatus.OK, {"stopping": True})
            threading.Thread(target=self.server.shutdown, daemon=True).start()
            return
        if self.path != "/synthesize":
            self._json(HTTPStatus.NOT_FOUND, {"error": "Not found."})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= MAX_REQUEST_BYTES:
                raise ValueError("Request size is invalid.")
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
            if not isinstance(payload, dict):
                raise ValueError("Request root must be an object.")
            wav, headers = self.server.runtime.synthesize(payload)
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", "audio/wav")
            self.send_header("Content-Length", str(len(wav)))
            self.send_header("Cache-Control", "no-store")
            for name, value in headers.items():
                self.send_header(name, value)
            self.end_headers()
            self.wfile.write(wav)
        except (ValueError, json.JSONDecodeError) as error:
            self._json(HTTPStatus.BAD_REQUEST, {"error": str(error)})
        except Exception as error:
            traceback.print_exc()
            self._json(
                HTTPStatus.INTERNAL_SERVER_ERROR,
                {"error": f"Official v4 resident inference failed: {type(error).__name__}: {error}"},
            )

    def log_message(self, format: str, *args: object) -> None:
        print(f"[worker-http] {format % args}", flush=True)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--checkpoint", type=Path, required=True)
    parser.add_argument("--embedding-root", type=Path, required=True)
    parser.add_argument("--work-root", type=Path, required=True)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, required=True)
    args = parser.parse_args()
    if args.host not in {"127.0.0.1", "localhost"}:
        parser.error("Worker must bind to loopback.")
    runtime = ResidentRuntime(args.source, args.checkpoint, args.embedding_root, args.work_root)
    server = WorkerServer((args.host, args.port), WorkerHandler)
    server.runtime = runtime

    def stop_on_signal(*_: object) -> None:
        threading.Thread(target=server.shutdown, daemon=True).start()

    if hasattr(signal, "SIGTERM"):
        signal.signal(signal.SIGTERM, stop_on_signal)
    print(f"[worker] official v4 resident runtime ready on {args.host}:{args.port}", flush=True)
    try:
        server.serve_forever()
    finally:
        server.server_close()
        runtime.unload()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
