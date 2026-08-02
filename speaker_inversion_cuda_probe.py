#!/usr/bin/env python3
"""Inspect the isolated Speaker Inversion CUDA runtime."""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any


def collect_diagnostics() -> dict[str, Any]:
    diagnostics: dict[str, Any] = {
        "ready": False,
        "python_executable": sys.executable,
        "cuda_visible_devices": os.environ.get("CUDA_VISIBLE_DEVICES"),
        "nvidia_smi": {"available": False},
        "torch": {"imported": False},
        "allocation_test": {"passed": False},
    }

    nvidia_smi = shutil.which("nvidia-smi")
    if nvidia_smi:
        try:
            result = subprocess.run(
                [
                    nvidia_smi,
                    "--query-gpu=name,driver_version,memory.total",
                    "--format=csv,noheader,nounits",
                ],
                check=False,
                capture_output=True,
                text=True,
                timeout=10,
            )
            rows = [row.strip() for row in result.stdout.splitlines() if row.strip()]
            diagnostics["nvidia_smi"] = {
                "available": result.returncode == 0 and bool(rows),
                "path": nvidia_smi,
                "gpus": rows,
                "error": result.stderr.strip() or None,
            }
        except (OSError, subprocess.SubprocessError) as error:
            diagnostics["nvidia_smi"] = {
                "available": False,
                "path": nvidia_smi,
                "error": str(error),
            }

    try:
        import torch
    except Exception as error:  # PyTorch may fail while loading native CUDA libraries.
        diagnostics["failure_kind"] = "torch_import"
        diagnostics["message"] = f"PyTorch could not be imported: {type(error).__name__}: {error}"
        return diagnostics

    build_cuda = torch.version.cuda
    available = bool(torch.cuda.is_available())
    device_count = int(torch.cuda.device_count()) if available else 0
    diagnostics["torch"] = {
        "imported": True,
        "version": torch.__version__,
        "build_cuda": build_cuda,
        "cuda_available": available,
        "device_count": device_count,
    }
    if not build_cuda:
        diagnostics["failure_kind"] = "cpu_torch"
        diagnostics["message"] = "The installed PyTorch wheel has no CUDA runtime."
        return diagnostics
    if not available or device_count < 1:
        diagnostics["failure_kind"] = "gpu_unavailable"
        diagnostics["message"] = (
            "CUDA PyTorch is installed, but no CUDA device is visible to this process."
        )
        return diagnostics

    try:
        device = torch.cuda.current_device()
        properties = torch.cuda.get_device_properties(device)
        value = (torch.ones(1, device=device) + 1).item()
        torch.cuda.synchronize(device)
        diagnostics["torch"].update(
            {
                "current_device": int(device),
                "device_name": properties.name,
                "device_capability": list(torch.cuda.get_device_capability(device)),
                "device_memory_bytes": int(properties.total_memory),
            }
        )
        diagnostics["allocation_test"] = {"passed": value == 2.0}
    except Exception as error:
        diagnostics["failure_kind"] = "cuda_allocation"
        diagnostics["message"] = f"CUDA allocation test failed: {type(error).__name__}: {error}"
        return diagnostics

    diagnostics["ready"] = True
    diagnostics["failure_kind"] = None
    diagnostics["message"] = "CUDA runtime is ready."
    return diagnostics


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--require-cuda-wheel", action="store_true")
    parser.add_argument("--require-cuda", action="store_true")
    args = parser.parse_args()
    diagnostics = collect_diagnostics()
    encoded = json.dumps(diagnostics, ensure_ascii=False, indent=2, allow_nan=False) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        temporary = args.output.with_suffix(args.output.suffix + ".tmp")
        temporary.write_text(encoded, encoding="utf-8")
        temporary.replace(args.output)
    print(encoded, end="")
    if args.require_cuda_wheel and not diagnostics.get("torch", {}).get("build_cuda"):
        return 3
    if args.require_cuda and not diagnostics.get("ready"):
        return 4
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
