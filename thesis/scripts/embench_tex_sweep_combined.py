#!/usr/bin/env python3
"""Generate one Embench/Doom i-cache sweep figure with four curves:
RV32IM/RV32IMC, with and without prefetch.
"""

from __future__ import annotations

import argparse
import csv
import math
import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]      # .../ares/thesis
ARES_ROOT = ROOT.parent                         # .../ares

DEFAULT_ARES_PREFETCH = ARES_ROOT / "bin" / "ares"
DEFAULT_EMBENCH = ROOT / "embench-iot"
DEFAULT_DOOM = ROOT / "doomgeneric" / "doomgeneric"
DEFAULT_DATA_DIR = ROOT / "data"
SWEEP = ROOT / "scripts" / "ares_cache_sweep.py"

LINE_SIZE_BYTES = 32

def display_path(path: Path) -> Path:
    try:
        return path.resolve().relative_to(ROOT)
    except ValueError:
        return path.resolve()


def tex_escape(value: str) -> str:
    return value.replace("_", r"\_")


def stem_for(benchmark: str) -> str:
    return benchmark.replace("-", "_")


def discover_benchmarks(rv32_dir: Path, rv32c_dir: Path) -> list[str]:
    if not rv32_dir.is_dir():
        raise SystemExit(f"RV32 directory not found: {rv32_dir}")
    if not rv32c_dir.is_dir():
        raise SystemExit(f"RV32IC directory not found: {rv32c_dir}")

    rv32 = {path.parent.name for path in rv32_dir.glob("*/*") if path.is_file()}
    rv32c = {path.parent.name for path in rv32c_dir.glob("*/*") if path.is_file()}
    return sorted(rv32 & rv32c)


def choose_benchmark(benchmarks: list[str]) -> str:
    print("Available Embench benchmarks:")
    for index, benchmark in enumerate(benchmarks, start=1):
        print(f"{index:2d}. {benchmark}")

    while True:
        answer = input("Choose benchmark by number or name: ").strip()
        if answer.isdigit():
            index = int(answer)
            if 1 <= index <= len(benchmarks):
                return benchmarks[index - 1]
        if answer in benchmarks:
            return answer
        print("Invalid benchmark selection.")


def require_file(path: Path, description: str) -> None:
    if not path.is_file():
        raise SystemExit(f"{description} not found: {path}")


def require_executable(path: Path, description: str) -> None:
    require_file(path, description)
    if not os.access(path, os.X_OK):
        raise SystemExit(
            f"{description} is not executable: {path}\nRun: chmod +x {path}"
        )


def run_sweep(
    ares: Path,
    rv32_binary: Path,
    rv32c_binary: Path,
    csv_path: Path,
    title: str,
    start: int,
    stop: int,
    step: int,
    no_prefetch: bool = False,
) -> None:
    csv_path.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        sys.executable,
        str(SWEEP),
        "--ares",
        str(ares),
        "--rv32",
        str(rv32_binary),
        "--rv32c",
        str(rv32c_binary),
        "--start",
        str(start),
        "--stop",
        str(stop),
        "--step",
        str(step),
        "--csv",
        str(csv_path),
        "--title",
        title,
    ]
    if no_prefetch:
        cmd.append("--no-prefetch")

    result = subprocess.run(cmd, check=False)
    if result.returncode != 0:
        raise SystemExit(result.returncode)


def read_sweep_csv(csv_path: Path) -> dict[tuple[int, str], int]:
    values: dict[tuple[int, str], int] = {}

    with csv_path.open(newline="") as file:
        reader = csv.DictReader(file)
        for row in reader:
            clock = row.get("clock", "")
            if not clock:
                continue
            cache_lines = int(row.get("cache_lines") or row["cache_size"])
            values[(cache_lines, row["isa"])] = int(clock)

    return values


def csvs_to_combined_dat(prefetch_csv: Path, no_prefetch_csv: Path, dat_path: Path) -> None:
    prefetch = read_sweep_csv(prefetch_csv)
    no_prefetch = read_sweep_csv(no_prefetch_csv)

    all_lines = sorted(
        {cache_lines for cache_lines, _isa in prefetch}
        & {cache_lines for cache_lines, _isa in no_prefetch}
    )

    dat_path.parent.mkdir(parents=True, exist_ok=True)
    with dat_path.open("w", newline="\n") as file:
        file.write(
            "cache_lines cache_bytes "
            "rv32im_prefetch rv32imc_prefetch "
            "rv32im_no_prefetch rv32imc_no_prefetch\n"
        )
        for cache_lines in all_lines:
            rv32im_prefetch = prefetch.get((cache_lines, "RV32"))
            rv32imc_prefetch = prefetch.get((cache_lines, "RV32C"))
            rv32im_no_prefetch = no_prefetch.get((cache_lines, "RV32"))
            rv32imc_no_prefetch = no_prefetch.get((cache_lines, "RV32C"))

            if None in (
                rv32im_prefetch,
                rv32imc_prefetch,
                rv32im_no_prefetch,
                rv32imc_no_prefetch,
            ):
                continue

            file.write(
                f"{cache_lines} {cache_lines * LINE_SIZE_BYTES} "
                f"{rv32im_prefetch} {rv32imc_prefetch} "
                f"{rv32im_no_prefetch} {rv32imc_no_prefetch}\n"
            )


def max_clock_millions(dat_path: Path) -> float:
    maximum = 0
    with dat_path.open() as file:
        next(file)
        for line in file:
            fields = line.split()
            if len(fields) >= 6:
                maximum = max(maximum, *(int(value) for value in fields[2:6]))
    if maximum == 0:
        return 1.0
    return math.ceil((maximum / 1_000_000) * 1.10)


def label_for(benchmark: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", benchmark.lower()).strip("-")


def cache_line_bounds(dat_path: Path) -> tuple[int, int]:
    cache_lines: list[int] = []
    with dat_path.open() as file:
        next(file)
        for line in file:
            fields = line.split()
            if fields:
                cache_lines.append(int(fields[0]))
    if not cache_lines:
        raise SystemExit(f"No plotted points found in {dat_path}")
    return min(cache_lines), max(cache_lines)


def make_tex(benchmark: str, dat_path: Path, ymax: float) -> str:
    try:
        relative_dat = dat_path.resolve().relative_to(ROOT)
    except ValueError:
        relative_dat = dat_path.resolve()
    label = label_for(benchmark)
    escaped_benchmark = tex_escape(benchmark)
    min_cache_line, max_cache_line = cache_line_bounds(dat_path)
    return rf"""\begin{{figure}}[htbp]
\centering
\begin{{tikzpicture}}
\begin{{axis}}[
    width=0.9\textwidth,
    height=6.5cm,
    xlabel={{Dimensione cache [linee, 32 B/linea]}},
    ylabel={{Clock [$10^6$]}},
    xmin={max(0, min_cache_line)},
    xmax={max_cache_line},
    ymin=0,
    ymax={ymax:g},
    ymajorgrids=true,
    xmajorgrids=true,
    legend style={{at={{(rel axis cs:1,1)}},anchor=north east, xshift=-3pt, yshift=-3pt, legend columns=1,fill=white,draw=black,font=\tiny,inner sep=1pt, legend cell align=left}},
    legend image post style={{xscale=0.6}}
]
\addplot+[mark=*,mark size=1.5pt]
table[x=cache_lines,y expr=\thisrow{{rv32imc_prefetch}}/1000000]
{{{relative_dat.as_posix()}}};
\addlegendentry{{RV32IMC, con prefetch}}

\addplot+[mark=*,mark size=1.5pt]
table[x=cache_lines,y expr=\thisrow{{rv32im_prefetch}}/1000000]
{{{relative_dat.as_posix()}}};
\addlegendentry{{RV32IM, con prefetch}}

\addplot+[mark=o,mark size=1.5pt, blue!50!white, dashed]
table[x=cache_lines,y expr=\thisrow{{rv32imc_no_prefetch}}/1000000]
{{{relative_dat.as_posix()}}};
\addlegendentry{{RV32IMC, senza prefetch}}

\addplot+[mark=o,mark size=1.5pt, orange, dashed]
table[x=cache_lines,y expr=\thisrow{{rv32im_no_prefetch}}/1000000]
{{{relative_dat.as_posix()}}};
\addlegendentry{{RV32IM, senza prefetch}}
\end{{axis}}
\end{{tikzpicture}}
\caption{{Sweep prestazionale della instruction cache per \texttt{{{escaped_benchmark}}}: confronto tra RV32IM e RV32IMC con e senza prefetch; l'asse \(x\) indica linee da 32 byte.}}
\label{{fig:{label}-sweep-prefetch-comparison}}
\end{{figure}}"""


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Run an Embench or Doom RV32/RV32IC ARES cache sweep and print "
            "one LaTeX pgfplots figure with prefetch and no-prefetch curves."
        )
    )
    parser.add_argument("benchmark", nargs="?", help="Embench benchmark name, or 'doom'")
    parser.add_argument("--ares-prefetch", type=Path, default=DEFAULT_ARES_PREFETCH)
    parser.add_argument("--embench", type=Path, default=DEFAULT_EMBENCH)
    parser.add_argument("--doom-dir", type=Path, default=DEFAULT_DOOM)
    parser.add_argument("--rv32-build", default="bd")
    parser.add_argument("--rv32c-build", default="bd_rvc")
    parser.add_argument("--data-dir", type=Path, default=DEFAULT_DATA_DIR)
    parser.add_argument("--start", type=int, help="First cache line to test")
    parser.add_argument("--stop", type=int, help="Inclusive last cache line to test")
    parser.add_argument("--step", type=int)
    parser.add_argument("--doom", action="store_true", help="Use DoomGeneric binaries")
    parser.add_argument(
        "--list",
        action="store_true",
        help="List benchmarks available in both RV32 and RV32IC builds",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    use_doom = args.doom or args.benchmark == "doom"

    require_executable(args.ares_prefetch, "ARES binary with prefetch")
    require_file(SWEEP, "Cache sweep helper")

    if use_doom:
        benchmark = "doom"
        rv32_binary = args.doom_dir / "doom_rv"
        rv32c_binary = args.doom_dir / "doom_rvc"
        start = 3 if args.start is None else args.start
        stop = 300 if args.stop is None else args.stop
        step = 3 if args.step is None else args.step
    else:
        rv32_dir = args.embench / args.rv32_build / "src"
        rv32c_dir = args.embench / args.rv32c_build / "src"
        benchmarks = discover_benchmarks(rv32_dir, rv32c_dir)
        if not benchmarks:
            raise SystemExit("No common benchmarks found in the RV32/RV32IC builds")

        if args.list:
            print("\n".join(benchmarks))
            return

        benchmark = args.benchmark or choose_benchmark(benchmarks)
        if benchmark not in benchmarks:
            available = ", ".join(benchmarks)
            raise SystemExit(f"Unknown benchmark '{benchmark}'. Available: {available}")

        rv32_binary = rv32_dir / benchmark / benchmark
        rv32c_binary = rv32c_dir / benchmark / benchmark
        start = 3 if args.start is None else args.start
        stop = 65 if args.stop is None else args.stop
        step = 3 if args.step is None else args.step

    require_file(rv32_binary, "RV32 benchmark binary")
    require_file(rv32c_binary, "RV32IC benchmark binary")

    stem = stem_for(benchmark)
    prefetch_csv = args.data_dir / "prefetch" / f"{stem}_icache_sweep.csv"
    no_prefetch_csv = args.data_dir / "no_prefetch" / f"{stem}_icache_sweep.csv"
    dat_path = args.data_dir / f"{stem}_icache_sweep_combined.dat"

    run_sweep(
        args.ares_prefetch,
        rv32_binary,
        rv32c_binary,
        prefetch_csv,
        f"{benchmark} icache sweep (miss = 50 clocks, prefetch on)",
        start,
        stop,
        step,
    )
    run_sweep(
        args.ares_prefetch,
        rv32_binary,
        rv32c_binary,
        no_prefetch_csv,
        f"{benchmark} icache sweep (miss = 50 clocks, prefetch off)",
        start,
        stop,
        step,
        no_prefetch=True,
    )
    csvs_to_combined_dat(prefetch_csv, no_prefetch_csv, dat_path)

    print()
    print(f"Wrote {display_path(prefetch_csv)}")
    print(f"Wrote {display_path(no_prefetch_csv)}")
    print(f"Wrote {display_path(dat_path)}")
    print()
    print(make_tex(benchmark, dat_path, max_clock_millions(dat_path)))


if __name__ == "__main__":
    main()
