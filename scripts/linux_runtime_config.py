#!/usr/bin/env python3
"""Select the isolated Linux audio.cpp runtime configuration."""

from __future__ import annotations

import argparse
import csv
import json
import os
import platform
import re
import shutil
import subprocess
import sys
from dataclasses import asdict, dataclass


MIN_CUDA_DRIVER = (580, 65, 6)
MIN_CUDA_COMPUTE_CAPABILITY = (7, 5)
DEFAULT_THREAD_CAP = 10
RECOMMENDED_FREE_VRAM_MIB = 6144


class RuntimeConfigError(ValueError):
    pass


@dataclass(frozen=True)
class GpuInfo:
    index: int
    name: str
    driver_version: str
    compute_capability: str
    memory_mib: int
    free_memory_mib: int


@dataclass(frozen=True)
class RuntimeConfig:
    backend: str
    device: int
    threads: int
    cuda_architectures: str
    gpu_name: str
    gpu_memory_mib: int
    gpu_free_memory_mib: int
    driver_version: str
    selection_reason: str


def parse_version(value: str, *, field: str) -> tuple[int, ...]:
    match = re.fullmatch(r"\s*(\d+)(?:\.(\d+))?(?:\.(\d+))?\s*", value)
    if not match:
        raise RuntimeConfigError(f"Invalid {field}: {value!r}")
    return tuple(int(part or 0) for part in match.groups())


def version_at_least(actual: tuple[int, ...], minimum: tuple[int, ...]) -> bool:
    width = max(len(actual), len(minimum))
    return actual + (0,) * (width - len(actual)) >= minimum + (0,) * (width - len(minimum))


def normalize_cuda_architectures(value: str) -> str:
    normalized = value.strip().replace(",", ";")
    if not normalized:
        return ""
    if normalized == "native":
        return normalized
    parts = normalized.split(";")
    if not all(re.fullmatch(r"\d{2,3}", part) for part in parts):
        raise RuntimeConfigError(
            "CVD_CUDA_ARCHITECTURES must be 'native' or a semicolon-separated list such as '86'."
        )
    return ";".join(dict.fromkeys(parts))


def physical_core_count() -> int:
    lscpu = shutil.which("lscpu")
    if lscpu:
        result = subprocess.run(
            [lscpu, "-p=CORE,SOCKET"],
            capture_output=True,
            check=False,
            text=True,
        )
        if result.returncode == 0:
            cores: set[tuple[str, str]] = set()
            for line in result.stdout.splitlines():
                if not line or line.startswith("#"):
                    continue
                fields = line.split(",")
                if len(fields) == 2 and all(field != "-" for field in fields):
                    cores.add((fields[0], fields[1]))
            if cores:
                return len(cores)
    return max(1, os.cpu_count() or 1)


def recommended_threads(value: str, *, detected_cores: int | None = None) -> int:
    if value.strip():
        try:
            threads = int(value)
        except ValueError as exc:
            raise RuntimeConfigError("CVD_INFERENCE_THREADS must be a positive integer.") from exc
        if threads < 1:
            raise RuntimeConfigError("CVD_INFERENCE_THREADS must be a positive integer.")
        return threads
    cores = max(1, detected_cores if detected_cores is not None else physical_core_count())
    return min(DEFAULT_THREAD_CAP, cores)


def parse_nvidia_smi_output(output: str) -> list[GpuInfo]:
    gpus: list[GpuInfo] = []
    for row in csv.reader(output.splitlines(), skipinitialspace=True):
        if len(row) != 6:
            continue
        try:
            gpus.append(
                GpuInfo(
                    index=int(row[0].strip()),
                    name=row[1].strip(),
                    driver_version=row[2].strip(),
                    compute_capability=row[3].strip(),
                    memory_mib=int(row[4].strip()),
                    free_memory_mib=int(row[5].strip()),
                )
            )
        except (RuntimeConfigError, ValueError):
            continue
    return gpus


def query_nvidia_gpus() -> list[GpuInfo]:
    nvidia_smi = shutil.which("nvidia-smi")
    if not nvidia_smi:
        return []
    result = subprocess.run(
        [
            nvidia_smi,
            "--query-gpu=index,name,driver_version,compute_cap,memory.total,memory.free",
            "--format=csv,noheader,nounits",
        ],
        capture_output=True,
        check=False,
        text=True,
    )
    if result.returncode != 0:
        return []
    return parse_nvidia_smi_output(result.stdout)


def select_runtime(
    requested_backend: str,
    architecture: str,
    gpus: list[GpuInfo],
    threads: int,
    cuda_architectures_override: str = "",
) -> RuntimeConfig:
    requested = requested_backend.strip().lower() or "auto"
    if requested not in {"auto", "cpu", "cuda"}:
        raise RuntimeConfigError("CVD_BACKEND must be auto, cpu, or cuda.")
    if requested == "cpu":
        return RuntimeConfig("cpu", 0, threads, "", "", 0, 0, "", "CPU was explicitly selected.")

    normalized_arch = architecture.lower()
    if normalized_arch not in {"x86_64", "amd64"}:
        if requested == "cuda":
            raise RuntimeConfigError("The isolated CUDA 13.0 build currently supports Linux x86_64 only.")
        return RuntimeConfig(
            "cpu", 0, threads, "", "", 0, 0, "", f"CUDA is not configured for {architecture}; using CPU."
        )

    compatible: list[GpuInfo] = []
    incompatibility = "No NVIDIA GPU was reported by nvidia-smi."
    for gpu in gpus:
        try:
            driver = parse_version(gpu.driver_version, field="NVIDIA driver version")
            capability = parse_version(gpu.compute_capability, field="CUDA compute capability")
        except RuntimeConfigError as exc:
            incompatibility = str(exc)
            continue
        if not version_at_least(driver, MIN_CUDA_DRIVER):
            incompatibility = (
                f"NVIDIA driver {gpu.driver_version} is below the CUDA 13.0 minimum "
                f"{'.'.join(map(str, MIN_CUDA_DRIVER))}."
            )
            continue
        if not version_at_least(capability, MIN_CUDA_COMPUTE_CAPABILITY):
            incompatibility = (
                f"GPU {gpu.name} has compute capability {gpu.compute_capability}; CUDA 13.0 builds require 7.5 or newer."
            )
            continue
        compatible.append(gpu)

    if not compatible:
        if requested == "cuda":
            raise RuntimeConfigError(incompatibility)
        return RuntimeConfig("cpu", 0, threads, "", "", 0, 0, "", f"{incompatibility} Using CPU.")

    gpu = max(compatible, key=lambda item: item.memory_mib)
    capability = parse_version(gpu.compute_capability, field="CUDA compute capability")
    detected_architecture = f"{capability[0]}{capability[1]}"
    cuda_architectures = normalize_cuda_architectures(cuda_architectures_override) or detected_architecture
    reason = f"Selected {gpu.name} with NVIDIA driver {gpu.driver_version} for CUDA 13.0."
    if gpu.free_memory_mib < RECOMMENDED_FREE_VRAM_MIB:
        reason += (
            f" WARNING: only {gpu.free_memory_mib} MiB VRAM is currently free; "
            f"free at least {RECOMMENDED_FREE_VRAM_MIB} MiB before inference."
        )
    return RuntimeConfig(
        "cuda",
        gpu.index,
        threads,
        cuda_architectures,
        gpu.name,
        gpu.memory_mib,
        gpu.free_memory_mib,
        gpu.driver_version,
        reason,
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--requested-backend", default="auto")
    parser.add_argument("--threads", default="")
    parser.add_argument("--cuda-architectures", default="")
    args = parser.parse_args()
    try:
        config = select_runtime(
            args.requested_backend,
            platform.machine(),
            query_nvidia_gpus(),
            recommended_threads(args.threads),
            args.cuda_architectures,
        )
    except RuntimeConfigError as exc:
        print(f"CharacterVoiceDesigner Linux runtime configuration error: {exc}", file=sys.stderr)
        return 2
    print(json.dumps(asdict(config), ensure_ascii=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
