#!/usr/bin/env python3
"""Turn a telemetry.jsonl produced by monitor.py into memory-summary.json.

Same fields as the 2026-10-06 community run: sample count and duration, host-RAM
peak (MemTotal - MemAvailable), GPU memory peak, swap start/peak/end, the number
of samples with GPU utilisation >= 1%, and peak GPU power draw.
"""
import argparse
import json
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("telemetry", type=Path)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--method", default="nominal 1 s; /proc/meminfo and nvidia-smi")
    args = parser.parse_args()

    rows = [json.loads(line) for line in args.telemetry.read_text().splitlines() if line.strip()]
    ram = [(r["memory"]["MemTotal_KiB"] - r["memory"]["MemAvailable_KiB"]) / 1048576 for r in rows]
    gpu = [[float(x) for x in r["gpu"].split(",")] for r in rows]  # used, total, util, power, temp
    swap = [(r["memory"]["SwapTotal_KiB"] - r["memory"]["SwapFree_KiB"]) / 1024 for r in rows]

    summary = {
        "samples": len(rows),
        "sample_duration_s": rows[-1]["epoch_s"] - rows[0]["epoch_s"],
        "sampling_method": args.method,
        "ram_peak_GiB": max(ram),
        "gpu_peak_MiB": max(g[0] for g in gpu),
        "swap_start_MiB": swap[0],
        "swap_peak_MiB": max(swap),
        "swap_end_MiB": swap[-1],
        "gpu_util_pct_at_least_1": sum(1 for g in gpu if g[2] >= 1),
        "gpu_power_peak_W": max(g[3] for g in gpu),
    }
    args.out.write_text(json.dumps(summary, indent=2) + "\n")
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
