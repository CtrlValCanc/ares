#!/usr/bin/env python3
"""Run ARES and generate the Embench i-cache sweep used by Table 5.4."""

from __future__ import annotations

import argparse
import csv
import os
import re
import subprocess
import tempfile
from concurrent.futures import Future, ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]      # .../ares/thesis
ARES_ROOT = ROOT.parent                         # .../ares
DEFAULT_ARES = ARES_ROOT / "bin" / "ares"
DEFAULT_EMBENCH = ROOT / "embench-iot"
DEFAULT_OUTPUT = ROOT / "LaTex" / "data" / "embench_icache_sweep.csv"
DEFAULT_CACHE_LINES = (1, 2, 4, 8, 16, 32)
LINE_SIZE_BYTES = 32

# wikisort is not part of the 18-program dataset analyzed in Chapter 5.
THESIS_BENCHMARKS = (
    "aha-mont64",
    "crc32",
    "depthconv",
    "edn",
    "huffbench",
    "matmult-int",
    "md5sum",
    "nettle-aes",
    "nettle-sha256",
    "nsichneu",
    "picojpeg",
    "qrduino",
    "sglib-combined",
    "slre",
    "statemate",
    "tarfind",
    "ud",
    "xgboost",
)


@dataclass(frozen=True)
class Measurement:
    benchmark: str
    cache_lines: int
    isa: str
    clock: int
    hits: int
    misses: int


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate LaTex/data/embench_icache_sweep.csv with ARES."
    )
    parser.add_argument("--ares", type=Path, default=DEFAULT_ARES)
    parser.add_argument("--embench", type=Path, default=DEFAULT_EMBENCH)
    parser.add_argument("--rv32im-build", default="bd")
    parser.add_argument("--rv32imc-build", default="bd_rvc")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument(
        "--cache-lines",
        type=int,
        nargs="+",
        default=DEFAULT_CACHE_LINES,
        metavar="N",
        help="cache sizes in lines (default: 1 2 4 8 16 32)",
    )
    parser.add_argument(
        "--benchmark",
        action="append",
        dest="benchmarks",
        help="run only this benchmark; repeat to select several",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        help="optional timeout in seconds for each ARES execution",
    )
    parser.add_argument(
        "--jobs",
        type=int,
        default=os.cpu_count() or 1,
        metavar="N",
        help="maximum concurrent ARES executions (default: number of CPUs)",
    )
    return parser.parse_args()


def require_executable(path: Path) -> None:
    if not path.is_file():
        raise SystemExit(f"ARES executable not found: {path}")
    if not os.access(path, os.X_OK):
        raise SystemExit(f"ARES is not executable: {path}")


def parse_stat(output: str, names: tuple[str, ...]) -> int | None:
    alternatives = "|".join(re.escape(name) for name in names)
    match = re.search(
        rf"\b(?:{alternatives})\b\s*[:=]\s*([0-9][0-9,_]*)",
        output,
        flags=re.IGNORECASE,
    )
    if match is None:
        return None
    return int(match.group(1).replace(",", "").replace("_", ""))


def parse_stats(output: str) -> tuple[int | None, int | None, int | None]:
    clock = parse_stat(
        output,
        ("cache_clock", "icache_clock", "instruction_cache_clock", "clocks"),
    )
    hits = parse_stat(output, ("cache_hits", "icache_hits", "hits"))
    misses = parse_stat(output, ("cache_misses", "icache_misses", "misses"))
    return clock, hits, misses


def benchmark_binary(build_dir: Path, benchmark: str) -> Path:
    return build_dir / "src" / benchmark / benchmark


def run_ares(
    ares: Path,
    binary: Path,
    benchmark: str,
    isa: str,
    cache_lines: int,
    timeout: float | None,
) -> Measurement:
    env = os.environ.copy()
    env["ARES_CACHE_STATS"] = "1"
    command = [str(ares), "--cache-size", str(cache_lines), "--run", str(binary)]

    try:
        process = subprocess.run(
            command,
            env=env,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            check=False,
            timeout=timeout,
        )
    except subprocess.TimeoutExpired as error:
        raise SystemExit(
            f"ARES timed out for {benchmark} {isa}, cache={cache_lines}"
        ) from error

    clock, hits, misses = parse_stats(process.stdout)
    if process.returncode != 0 or None in (clock, hits, misses):
        details = process.stdout.strip() or "<no output>"
        raise SystemExit(
            f"ARES failed for {benchmark} {isa}, cache={cache_lines} "
            f"(exit {process.returncode}).\n{details}"
        )

    assert clock is not None and hits is not None and misses is not None
    return Measurement(benchmark, cache_lines, isa, clock, hits, misses)


def select_benchmarks(requested: list[str] | None) -> tuple[str, ...]:
    if not requested:
        return THESIS_BENCHMARKS

    unknown = sorted(set(requested).difference(THESIS_BENCHMARKS))
    if unknown:
        available = ", ".join(THESIS_BENCHMARKS)
        raise SystemExit(
            f"Unknown benchmark(s): {', '.join(unknown)}\nAvailable: {available}"
        )
    requested_set = set(requested)
    return tuple(name for name in THESIS_BENCHMARKS if name in requested_set)


def write_csv(path: Path, measurements: list[Measurement]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = (
        "benchmark",
        "cache_lines",
        "cache_bytes",
        "isa",
        "clock",
        "hits",
        "misses",
    )

    temporary_name: str | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            newline="",
            encoding="utf-8",
            dir=path.parent,
            prefix=f".{path.name}.",
            delete=False,
        ) as output_file:
            temporary_name = output_file.name
            writer = csv.DictWriter(output_file, fieldnames=fieldnames)
            writer.writeheader()
            for measurement in measurements:
                writer.writerow(
                    {
                        "benchmark": measurement.benchmark,
                        "cache_lines": measurement.cache_lines,
                        "cache_bytes": measurement.cache_lines * LINE_SIZE_BYTES,
                        "isa": measurement.isa,
                        "clock": measurement.clock,
                        "hits": measurement.hits,
                        "misses": measurement.misses,
                    }
                )
        Path(temporary_name).replace(path)
    finally:
        if temporary_name is not None:
            Path(temporary_name).unlink(missing_ok=True)


def main() -> None:
    args = parse_args()
    require_executable(args.ares)

    cache_lines_values = tuple(dict.fromkeys(args.cache_lines))
    if any(value <= 0 for value in cache_lines_values):
        raise SystemExit("--cache-lines values must be positive")
    if args.jobs <= 0:
        raise SystemExit("--jobs must be positive")

    benchmarks = select_benchmarks(args.benchmarks)
    builds = (
        ("RV32IM", args.embench / args.rv32im_build),
        ("RV32IMC", args.embench / args.rv32imc_build),
    )

    binaries: dict[tuple[str, str], Path] = {}
    for benchmark in benchmarks:
        for isa, build_dir in builds:
            binary = benchmark_binary(build_dir, benchmark)
            if not binary.is_file():
                raise SystemExit(f"{isa} binary not found for {benchmark}: {binary}")
            binaries[(benchmark, isa)] = binary

    tasks = []
    for benchmark in benchmarks:
        for cache_lines in cache_lines_values:
            for isa, _ in builds:
                tasks.append(
                    (
                        args.ares,
                        binaries[(benchmark, isa)],
                        benchmark,
                        isa,
                        cache_lines,
                        args.timeout,
                    )
                )

    measurements: list[Measurement | None] = [None] * len(tasks)
    completed = 0
    worker_count = min(args.jobs, len(tasks))
    with ThreadPoolExecutor(max_workers=worker_count) as executor:
        futures: dict[Future[Measurement], int] = {
            executor.submit(run_ares, *task): index
            for index, task in enumerate(tasks)
        }
        for future in as_completed(futures):
            index = futures[future]
            try:
                measurement = future.result()
            except BaseException:
                for pending in futures:
                    pending.cancel()
                raise
            measurements[index] = measurement
            completed += 1
            print(
                f"[{completed:3d}/{len(tasks)}] {measurement.benchmark:20s} "
                f"{measurement.isa:7s} cache={measurement.cache_lines:2d} "
                f"clock={measurement.clock}"
            )

    ordered_measurements = [
        measurement for measurement in measurements if measurement is not None
    ]
    write_csv(args.output, ordered_measurements)
    print(f"Wrote {args.output}")


if __name__ == "__main__":
    main()
