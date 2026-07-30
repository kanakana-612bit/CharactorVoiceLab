#!/usr/bin/env python3
"""Manual parity smoke test against a running local audio.cpp server."""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
import threading
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from designer_server import (
    PROJECT_ROOT,
    DesignerHandler,
    DesignerServer,
    ObservationStore,
    normalize_upstream_url,
)


def request_wav(base_url: str, payload: dict) -> tuple[bytes, str | None]:
    request = urllib.request.Request(
        base_url + "/api/audio-cpp/speech",
        data=json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8"),
        headers={"Content-Type": "application/json", "Accept": "audio/wav"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=600) as response:
            return response.read(), response.headers.get("X-CVD-Observation-ID")
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Local bridge returned HTTP {error.code}: {detail}") from error


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--audio-cpp-url", default="http://127.0.0.1:8080")
    parser.add_argument("--steps", type=int, default=4)
    args = parser.parse_args()

    server = DesignerServer(("127.0.0.1", 0), DesignerHandler)
    server.audio_cpp_base_url = normalize_upstream_url(args.audio_cpp_url)
    server.upstream_timeout_seconds = 600
    server.observation_store = ObservationStore(
        PROJECT_ROOT / "runtime" / "observations",
        PROJECT_ROOT,
    )
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base_url = f"http://127.0.0.1:{server.server_port}"
    payload = {
        "model": "irodori-vdes",
        "input": "これは観測機能の試験です。",
        "language": "ja",
        "seed": 20260730,
        "num_inference_steps": args.steps,
        "options": {
            "no_ref": True,
            "caption": "自然で聞き取りやすい日本語音声。",
            "duration_scale": 1.0,
            "caption_guidance_scale": 2.0,
            "trim_tail": True,
        },
    }
    try:
        plain_wav, plain_id = request_wav(base_url, payload)
        payload["observation"] = {
            "enabled": True,
            "label": "runtime-parity",
            "include_text": False,
            "analyze_f0": True,
            "capture_internal_conditions": True,
            "latent_snapshot_steps": [4, 8, 12, 16, 20],
        }
        observed_wav, observation_id = request_wav(base_url, payload)
        if plain_id is not None or observation_id is None:
            raise RuntimeError("Observation response headers were not opt-in.")
        if plain_wav != observed_wav:
            raise RuntimeError("Observation changed the generated WAV bytes.")
        record = server.observation_store.read(observation_id)
        if record is None:
            raise RuntimeError("Observation record was not persisted.")
        output = {
            "observation_id": observation_id,
            "wav_sha256": hashlib.sha256(observed_wav).hexdigest(),
            "wav_bytes_identical": True,
            "record_status": record.get("status"),
            "speaker_condition_observed": record["internal_conditions"]["speaker_condition"]["observed"],
            "caption_condition_observed": record["internal_conditions"]["caption_condition"]["observed"],
            "latent_snapshots_observed": record["internal_conditions"]["latent_snapshots"]["observed_steps"],
            "record_path": str(
                Path("runtime") / "observations" / f"{observation_id}.json"
            ),
        }
        print(json.dumps(output, ensure_ascii=False, indent=2))
    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    main()
