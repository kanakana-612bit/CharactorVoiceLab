#!/usr/bin/env python3
"""Apply a selected CUDA device and PyTorch VRAM ceiling before running upstream code."""

from __future__ import annotations

import argparse
import os
import runpy
import sys
from pathlib import Path


def forwarded_arguments(values: list[str]) -> list[str]:
    """Remove argparse's explicit end-of-options marker before target dispatch."""
    return values[1:] if values[:1] == ["--"] else list(values)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--gpu-index", type=int, required=True)
    parser.add_argument("--vram-limit-mib", type=int, default=0)
    parser.add_argument("--target", type=Path, required=True)
    parser.add_argument("arguments", nargs=argparse.REMAINDER)
    args = parser.parse_args()
    if args.gpu_index < 0:
        parser.error("--gpu-index must be zero or greater.")
    if args.vram_limit_mib < 0:
        parser.error("--vram-limit-mib must be zero or greater.")
    target = args.target.resolve()
    if not target.is_file():
        parser.error(f"Target script was not found: {target}")

    os.environ["CUDA_VISIBLE_DEVICES"] = str(args.gpu_index)
    os.environ.setdefault("PYTHONUNBUFFERED", "1")
    try:
        import torch
    except ImportError as error:
        raise SystemExit(f"PyTorch is unavailable in the Speaker Inversion environment: {error}")
    if not torch.cuda.is_available() or torch.cuda.device_count() < 1:
        raise SystemExit(
            f"CUDA GPU {args.gpu_index} is not available to the Speaker Inversion process."
        )
    properties = torch.cuda.get_device_properties(0)
    total_mib = int(properties.total_memory // (1024 * 1024))
    if args.vram_limit_mib:
        if not 512 <= args.vram_limit_mib <= total_mib:
            raise SystemExit(
                f"VRAM limit must be 0 or 512-{total_mib} MiB for {properties.name}."
            )
        fraction = args.vram_limit_mib * 1024 * 1024 / properties.total_memory
        torch.cuda.set_per_process_memory_fraction(fraction, 0)
        print(
            f"[compute] CUDA physical GPU {args.gpu_index} -> visible cuda:0 / "
            f"{properties.name} / PyTorch limit {args.vram_limit_mib} MiB",
            flush=True,
        )
    else:
        print(
            f"[compute] CUDA physical GPU {args.gpu_index} -> visible cuda:0 / "
            f"{properties.name} / VRAM limit disabled",
            flush=True,
        )
    sys.argv = [str(target), *forwarded_arguments(args.arguments)]
    runpy.run_path(str(target), run_name="__main__")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
