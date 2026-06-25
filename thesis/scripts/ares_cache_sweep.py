#!/usr/bin/env python3
"""Run an ARES instruction-cache sweep for two binaries and plot the result."""

from __future__ import annotations

import argparse
import csv
import os
import re
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def parse_stats(output: str) -> dict[str, int | None]:
    stats = {
        "clock": None,
        "hits": None,
        "misses": None,
    }

    clock_patterns = [
        r"cache_clock\s*=\s*(\d+)",
        r"clocks\s*=\s*(\d+)",
    ]
    for pattern in clock_patterns:
        match = re.search(pattern, output)
        if match:
            stats["clock"] = int(match.group(1))
            break

    match = re.search(r"cache_hits\s*=\s*(\d+)", output)
    if match:
        stats["hits"] = int(match.group(1))

    match = re.search(r"cache_misses\s*=\s*(\d+)", output)
    if match:
        stats["misses"] = int(match.group(1))

    return stats


def run_one(
    ares: Path,
    binary: Path,
    cache_lines: int,
    miss_penalty: int,
    no_prefetch: bool,
) -> tuple[dict[str, int | None], str]:
    env = os.environ.copy()
    env["ARES_CACHE_STATS"] = "1"
    cmd = [
        str(ares),
        "--cache-size", str(cache_lines),
        "--cache-miss-penalty", str(miss_penalty),
        "--run", str(binary),
    ]
    if no_prefetch:
        cmd.insert(-2, "--no-prefetch")
    proc = subprocess.run(
        cmd,
        env=env,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        check=False,
    )
    return parse_stats(proc.stdout), proc.stdout.strip()


def plot(csv_path: Path, png_path: Path, title: str) -> None:
    try:
        import matplotlib.pyplot as plt
    except ModuleNotFoundError:
        print("matplotlib is not installed; CSV was generated, PNG skipped")
        return

    series: dict[str, list[tuple[int, int]]] = {"RV32C": [], "RV32": []}
    with csv_path.open(newline="") as file:
        for row in csv.DictReader(file):
            if row["clock"]:
                cache_lines = row.get("cache_lines") or row["cache_size"]
                series[row["isa"]].append((int(cache_lines), int(row["clock"])))

    plt.figure(figsize=(10, 6))
    for label in ("RV32C", "RV32"):
        points = series[label]
        if not points:
            continue
        xs, ys = zip(*points)
        plt.plot(xs, ys, marker="o", label=label)

    plt.title(title)
    plt.xlabel("Cache size [lines, 32 B/line]")
    plt.ylabel("Clock cycles")
    plt.legend()
    plt.grid(True)
    plt.tight_layout()
    png_path.parent.mkdir(parents=True, exist_ok=True)
    plt.savefig(png_path, dpi=160)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--ares", type=Path, default=ROOT / "ares" / "bin" / "ares")
    parser.add_argument("--rv32", type=Path, required=True)
    parser.add_argument("--rv32c", type=Path, required=True)
    parser.add_argument("--start", type=int, default=2)
    parser.add_argument("--stop", type=int, default=65)
    parser.add_argument("--step", type=int, default=3)
    parser.add_argument("--miss-penalty", type=int, default=50)
    parser.add_argument("--no-prefetch", action="store_true")
    parser.add_argument("--csv", type=Path, required=True)
    parser.add_argument("--png", type=Path)
    parser.add_argument("--title", default="ARES icache sweep (miss = 50 clocks, prefetch on)")
    args = parser.parse_args()
    if args.miss_penalty <= 0:
        parser.error("--miss-penalty must be positive")

    rows = []
    line_size_bytes = 32
    points = list(range(args.start, args.stop, args.step))
    if not points or points[-1] != args.stop:
        points.append(args.stop)

    for cache_lines in points:
        for isa, binary in (("RV32C", args.rv32c), ("RV32", args.rv32)):
            stats, output = run_one(
                args.ares,
                binary,
                cache_lines,
                args.miss_penalty,
                args.no_prefetch,
            )
            if stats["clock"] is None:
                print(output)
            rows.append(
                {
                    "cache_lines": cache_lines,
                    "cache_bytes": cache_lines * line_size_bytes,
                    "cache_size": cache_lines,
                    "isa": isa,
                    "clock": "" if stats["clock"] is None else stats["clock"],
                    "hits": "" if stats["hits"] is None else stats["hits"],
                    "misses": "" if stats["misses"] is None else stats["misses"],
                    "output": output.replace("\n", " | "),
                }
            )
            status = "failed" if stats["clock"] is None else str(stats["clock"])
            print(
                f"{isa:5s} cache={cache_lines:3d} lines "
                f"({cache_lines * line_size_bytes:4d} B): {status}"
            )

    args.csv.parent.mkdir(parents=True, exist_ok=True)
    with args.csv.open("w", newline="") as file:
        writer = csv.DictWriter(
            file,
            fieldnames=[
                "cache_lines",
                "cache_bytes",
                "cache_size",
                "isa",
                "clock",
                "hits",
                "misses",
                "output",
            ],
        )
        writer.writeheader()
        writer.writerows(rows)

    if args.png:
        plot(args.csv, args.png, args.title)


if __name__ == "__main__":
    main()
