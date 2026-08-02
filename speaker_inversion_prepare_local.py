#!/usr/bin/env python3
"""Prepare official Irodori-TTS latents from managed local WAV files."""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any


class LocalManifestError(RuntimeError):
    """Raised when a managed local training sample cannot be prepared."""


def _add_upstream_import_path(path: Path) -> Path:
    source = path.resolve()
    if not (source / "irodori_tts").is_dir():
        raise LocalManifestError(f"Official Irodori-TTS source was not found under {source}.")
    source_text = str(source)
    if source_text not in sys.path:
        sys.path.insert(0, source_text)
    return source


def _load_source_rows(path: Path) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except OSError as error:
        raise LocalManifestError(f"Could not read the local sample list: {error}") from error
    for line_number, line in enumerate(lines, start=1):
        if not line.strip():
            continue
        try:
            value = json.loads(line)
        except json.JSONDecodeError as error:
            raise LocalManifestError(f"Invalid sample JSON on line {line_number}.") from error
        if not isinstance(value, dict):
            raise LocalManifestError(f"Invalid sample row on line {line_number}.")
        audio = str(value.get("audio", "")).strip()
        text = str(value.get("text", "")).strip()
        if not audio or not text:
            raise LocalManifestError(f"Sample line {line_number} requires audio and text.")
        rows.append({"audio": audio, "text": text})
    if not rows:
        raise LocalManifestError("At least one local training sample is required.")
    return rows


def prepare_manifest(args: argparse.Namespace) -> None:
    _add_upstream_import_path(args.upstream_source)
    import soundfile
    import torch

    from irodori_tts.codec import DACVAECodec
    from irodori_tts.text_normalization import normalize_text

    rows = _load_source_rows(args.samples.resolve())
    device = torch.device(args.device)
    if device.type == "cuda" and not torch.cuda.is_available():
        raise LocalManifestError("CUDA was requested but is not available.")
    if device.type == "cuda" and device.index is None:
        device = torch.device("cuda:0")
    torch.manual_seed(args.seed)

    output_manifest = args.output_manifest.resolve()
    output_manifest.parent.mkdir(parents=True, exist_ok=True)
    latent_dir = args.latent_dir.resolve()
    latent_dir.mkdir(parents=True, exist_ok=True)
    codec = DACVAECodec.load(
        repo_id=args.codec_repo,
        device=str(device),
        deterministic_encode=True,
        deterministic_decode=True,
        normalize_db=-16.0,
    )

    payloads: list[dict[str, Any]] = []
    for index, row in enumerate(rows):
        audio_path = Path(row["audio"]).expanduser().resolve()
        if not audio_path.is_file():
            raise LocalManifestError(f"Training WAV was not found: {audio_path.name}")
        try:
            samples, sample_rate = soundfile.read(
                audio_path,
                dtype="float32",
                always_2d=True,
            )
        except Exception as error:
            raise LocalManifestError(
                f"Could not decode {audio_path.name} with SoundFile: {type(error).__name__}: {error}"
            ) from error
        if sample_rate <= 0 or samples.shape[0] <= 0 or samples.shape[1] <= 0:
            raise LocalManifestError(f"Training WAV is empty or invalid: {audio_path.name}")
        waveform = torch.as_tensor(samples.T).float().contiguous()
        if not bool(torch.isfinite(waveform).all()):
            raise LocalManifestError(f"Training WAV contains non-finite samples: {audio_path.name}")
        text = normalize_text(row["text"]).strip()
        if not text:
            raise LocalManifestError(f"Transcript became empty after normalization: {audio_path.name}")
        try:
            with torch.inference_mode():
                latent = codec.encode_waveform(waveform, sample_rate=int(sample_rate))[0].cpu()
        except Exception as error:
            raise LocalManifestError(
                f"DACVAE encoding failed for {audio_path.name}: {type(error).__name__}: {error}"
            ) from error
        if latent.ndim < 1 or latent.shape[0] <= 0:
            raise LocalManifestError(f"DACVAE returned an empty latent for {audio_path.name}")
        latent_path = latent_dir / f"{index:08d}_{index:08d}.pt"
        torch.save(latent, latent_path)
        payloads.append(
            {
                "text": text,
                "latent_path": os.path.relpath(latent_path, start=output_manifest.parent),
                "num_frames": int(latent.shape[0]),
            }
        )
        print(f"[local-wav {index + 1}/{len(rows)}] {audio_path.name}", flush=True)

    temporary = output_manifest.with_suffix(output_manifest.suffix + ".tmp")
    temporary.write_text(
        "".join(json.dumps(payload, ensure_ascii=False) + "\n" for payload in payloads),
        encoding="utf-8",
    )
    temporary.replace(output_manifest)
    print(
        f"Prepared {len(payloads)} local WAV samples; manifest={output_manifest}",
        flush=True,
    )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--samples", type=Path, required=True)
    parser.add_argument("--upstream-source", type=Path, required=True)
    parser.add_argument("--output-manifest", type=Path, required=True)
    parser.add_argument("--latent-dir", type=Path, required=True)
    parser.add_argument("--codec-repo", default="Aratako/Semantic-DACVAE-Japanese-32dim")
    parser.add_argument("--device", default="cuda")
    parser.add_argument("--seed", type=int, default=0)
    return parser


def main() -> int:
    args = build_parser().parse_args()
    try:
        prepare_manifest(args)
    except LocalManifestError as error:
        print(f"Local Speaker Inversion manifest preparation failed: {error}", flush=True)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
