#!/usr/bin/env python3
"""Run one Embench i-cache sweep at several penalties, with/without prefetch."""

from __future__ import annotations

import argparse
import csv
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]      # .../ares/thesis
ARES_ROOT = ROOT.parent                         # .../ares

LINE_SIZE_BYTES = 32
SWEEP = ROOT / "scripts" / "ares_cache_sweep.py"
DEFAULT_ARES = ARES_ROOT  / "bin" / "ares"
DEFAULT_EMBENCH = ROOT / "embench-iot"
DEFAULT_OUTPUT_DIR = ROOT / "data" / "penalty_sweeps"
LINE_SIZE_BYTES = 32


def display_path(path: Path) -> Path:
    try:
        return path.resolve().relative_to(ROOT)
    except ValueError:
        return path.resolve()


def run_penalty(
    penalty: int,
    mode: str,
    ares: Path,
    rv32: Path,
    rv32c: Path,
    start: int,
    stop: int,
    step: int,
    csv_path: Path,
    no_prefetch: bool,
) -> None:
    command = [
        sys.executable,
        str(SWEEP),
        "--ares", str(ares),
        "--rv32", str(rv32),
        "--rv32c", str(rv32c),
        "--start", str(start),
        "--stop", str(stop),
        "--step", str(step),
        "--miss-penalty", str(penalty),
        "--csv", str(csv_path),
        "--title", f"miss penalty = {penalty}, {mode}",
    ]
    if no_prefetch:
        command.append("--no-prefetch")
    result = subprocess.run(command, text=True, capture_output=True, check=False)
    if result.returncode != 0:
        raise RuntimeError(
            f"penalty {penalty} ({mode}) failed with exit code {result.returncode}\n"
            f"{result.stdout}\n{result.stderr}"
        )
    print(f"Completed miss penalty {penalty} ({mode})")


def read_csv(path: Path) -> dict[tuple[int, str], int]:
    values: dict[tuple[int, str], int] = {}
    with path.open(newline="") as file:
        for row in csv.DictReader(file):
            if not row["clock"]:
                continue
            values[(int(row["cache_lines"]), row["isa"])] = int(row["clock"])
    return values


def write_dat(
    output: Path,
    penalties: list[int],
    measurements: dict[str, dict[int, dict[tuple[int, str], int]]],
) -> None:
    common_lines = set.intersection(
        *[
            {cache_lines for cache_lines, _ in values}
            for by_penalty in measurements.values()
            for values in by_penalty.values()
        ]
    )
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", newline="\n") as file:
        columns = ["cache_lines", "cache_bytes"]
        for penalty in penalties:
            columns.extend([
                f"rv32c_p{penalty}",
                f"rv32_p{penalty}",
                f"gain_p{penalty}",
                f"rv32c_np_p{penalty}",
                f"rv32_np_p{penalty}",
                f"gain_np_p{penalty}",
            ])
        file.write(" ".join(columns) + "\n")

        for cache_lines in sorted(common_lines):
            fields: list[str] = [str(cache_lines), str(cache_lines * LINE_SIZE_BYTES)]
            for penalty in penalties:
                prefetch = measurements["prefetch"][penalty]
                no_prefetch = measurements["no_prefetch"][penalty]
                rv32c = prefetch[(cache_lines, "RV32C")]
                rv32 = prefetch[(cache_lines, "RV32")]
                rv32c_np = no_prefetch[(cache_lines, "RV32C")]
                rv32_np = no_prefetch[(cache_lines, "RV32")]
                gain = (rv32 - rv32c) / rv32 * 100.0
                gain_np = (rv32_np - rv32c_np) / rv32_np * 100.0
                fields.extend([
                    str(rv32c),
                    str(rv32),
                    f"{gain:.6f}",
                    str(rv32c_np),
                    str(rv32_np),
                    f"{gain_np:.6f}",
                ])
            file.write(" ".join(fields) + "\n")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("benchmark", default="nettle-sha256", nargs="?")
    parser.add_argument("--penalties", type=int, nargs="+", default=[10, 25, 50, 100, 200])
    parser.add_argument("--ares", type=Path, default=DEFAULT_ARES)
    parser.add_argument("--embench", type=Path, default=DEFAULT_EMBENCH)
    parser.add_argument("--rv32-build", default="bd")
    parser.add_argument("--rv32c-build", default="bd_rvc")
    parser.add_argument("--start", type=int, default=3)
    parser.add_argument("--stop", type=int, default=260)
    parser.add_argument("--step", type=int, default=3)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--jobs", type=int, default=5)
    args = parser.parse_args()

    penalties = list(dict.fromkeys(args.penalties))
    if not penalties or any(penalty <= 0 for penalty in penalties):
        parser.error("all penalties must be positive")
    if args.jobs <= 0:
        parser.error("--jobs must be positive")

    rv32 = args.embench / args.rv32_build / "src" / args.benchmark / args.benchmark
    rv32c = args.embench / args.rv32c_build / "src" / args.benchmark / args.benchmark
    for path, description in (
        (args.ares, "ARES with prefetch"),
        (rv32, "RV32 binary"),
        (rv32c, "RV32C binary"),
    ):
        if not path.is_file():
            raise SystemExit(f"{description} not found: {path}")

    stem = args.benchmark.replace("-", "_")
    args.output_dir.mkdir(parents=True, exist_ok=True)
    csv_paths = {
        ("prefetch", penalty): args.output_dir / f"{stem}_penalty_{penalty}.csv"
        for penalty in penalties
    }
    csv_paths.update({
        ("no_prefetch", penalty): args.output_dir / f"{stem}_penalty_{penalty}_noprefetch.csv"
        for penalty in penalties
    })

    jobs = [
        (mode, penalty)
        for mode in ("prefetch", "no_prefetch")
        for penalty in penalties
    ]

    with ThreadPoolExecutor(max_workers=min(args.jobs, len(jobs))) as executor:
        futures = {
            executor.submit(
                run_penalty,
                penalty,
                mode,
                args.ares,
                rv32,
                rv32c,
                args.start,
                args.stop,
                args.step,
                csv_paths[(mode, penalty)],
                mode == "no_prefetch",
            ): (mode, penalty)
            for mode, penalty in jobs
        }
        for future in as_completed(futures):
            future.result()

    measurements = {
        mode: {
            penalty: read_csv(csv_paths[(mode, penalty)])
            for penalty in penalties
        }
        for mode in ("prefetch", "no_prefetch")
    }
    dat_path = args.output_dir / f"{stem}_penalty_sweep.dat"
    write_dat(dat_path, penalties, measurements)
    print(f"Wrote {display_path(dat_path)}")


if __name__ == "__main__":
    main()
