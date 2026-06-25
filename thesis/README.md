# Thesis reproducibility package

This repository contains the code and scripts used to reproduce the instruction-cache experiments in Chapter 5 of the thesis. The experiments compare RV32IM and RV32IMC binaries, with and without next-line prefetch, using the modified ARES emulator.

## Repository contents

- `ares/`: modified ARES emulator and cache model.
- `embench-iot/`: Embench sources and RV32IM/RV32IMC builds.
- `doomgeneric/`: DoomGeneric case study and its two RISC-V builds.
- `scripts/`: experiment drivers and table-generation utilities.
- `data/`: generated CSV and pgfplots `.dat` files (created by the scripts).

## Scripts

The reproducibility workflow requires these scripts:

- `scripts/ares_cache_sweep.py`: low-level runner for one RV32IM/RV32IMC cache sweep.
- `scripts/embench_tex_sweep_combined.py`: generates the four curves used in the thesis: RV32IM and RV32IMC, with and without prefetch, using one ARES executable.
- `scripts/run_sweeps_combined.sh`: runs the combined sweep for all representative benchmarks and Doom.
- `scripts/embench_penalty_sweep.py`: reproduces the miss-penalty sensitivity experiment for `nettle-sha256`.
- `scripts/recalc_tables_prefetch.py`: recalculates the prefetch-interaction tables from the combined `.dat` files.

## Requirements

- Linux
- Python 3.10 or newer
- A C compiler and `make`
- Zig with the `riscv32-linux-musl` target
- SCons for building Embench
- Optional: a LaTeX installation with TikZ/pgfplots to compile the plots

The experiment scripts use only the Python standard library. Matplotlib is optional and only needed when requesting PNG output from the low-level runner.

## Build the benchmark binaries

The experiments require two versions of every workload:

- `rv`: RV32IM, using `generic_rv32+m`;
- `rvc`: RV32IMC, using `generic_rv32+m+c`.

The thesis binaries were compiled with Zig
`0.17.0-dev.813+2153f8143`. Install that version, or a compatible Zig version
with the `riscv32-linux-musl` target, and ensure `zig` is available in `PATH`:

```bash
zig version
```

For an exact reproduction, `zig version` should print:

```text
0.17.0-dev.813+2153f8143
```

### Compile Embench

Install SCons if it is not already available, then run the two builds from the
repository root:

```bash
cd embench-iot
./build.sh rv
./build.sh rvc
cd ..
```

The commands use `-Os`, the ILP32 ABI, static freestanding linking, and the
ARES board support in `examples/riscv32/rv32ares`. They produce:

```text
embench-iot/bd/src/<benchmark>/<benchmark>
embench-iot/bd_rvc/src/<benchmark>/<benchmark>
```

Check the ISA flags on one pair:

```bash
readelf -h embench-iot/bd/src/statemate/statemate
readelf -h embench-iot/bd_rvc/src/statemate/statemate
```

The second binary should report the RVC flag.

### Compile DoomGeneric

The DoomGeneric Makefile supports the same two architecture names:

```bash
make -C doomgeneric/doomgeneric clean
make -C doomgeneric/doomgeneric ARCH=rv
make -C doomgeneric/doomgeneric ARCH=rvc
```

This produces:

```text
doomgeneric/doomgeneric/doom_rv
doomgeneric/doomgeneric/doom_rvc
```

The object directories are architecture-specific, so the two builds can
coexist. `doom1.wad` is runtime game data and is not linked into either ELF.

## Reproduce the experiments

Run the following commands from the `thesis/` directory. First build ARES,
which is located in the parent directory:

```bash
make -C .. bin/ares
```

### List available Embench programs

After compiling both Embench variants, list the benchmarks found in both build
directories:

```bash
python3 scripts/embench_tex_sweep_combined.py --list
```

### Run one combined cache sweep

`embench_tex_sweep_combined.py` is the main experiment script. It runs RV32IM
and RV32IMC with prefetch enabled and disabled, then combines the four curves
into one pgfplots data file.

For example:

```bash
python3 scripts/embench_tex_sweep_combined.py \
  statemate --start 3 --stop 80 --step 3
```

For DoomGeneric:

```bash
python3 scripts/embench_tex_sweep_combined.py \
  doom --start 3 --stop 200 --step 3
```

The script writes:

```text
data/prefetch/<benchmark>_icache_sweep.csv
data/no_prefetch/<benchmark>_icache_sweep.csv
data/<benchmark>_icache_sweep_combined.dat
```

It also prints a LaTeX pgfplots figure that can be copied into the thesis.

Useful options:

- `--start`, `--stop`, `--step`: cache capacities to test, expressed in
  32-byte lines;
- `--data-dir PATH`: select a different output directory;
- `--embench PATH`: select another Embench checkout;
- `--doom-dir PATH`: directory containing `doom_rv` and `doom_rvc`;
- `--ares-prefetch PATH`: select another ARES executable.

### Run all representative sweeps

The shell wrapper runs `statemate`, `nettle-sha256`, `picojpeg`, `nsichneu`,
and DoomGeneric:

```bash
MAX_JOBS=4 ./scripts/run_sweeps_combined.sh
```

`MAX_JOBS` limits the number of concurrent experiments. Lower it if the machine
has limited CPU or memory.

### Run a low-level sweep

`ares_cache_sweep.py` runs one pair of explicitly selected ELF files. This is
useful for custom programs or debugging:

```bash
python3 scripts/ares_cache_sweep.py \
  --rv32 embench-iot/bd/src/statemate/statemate \
  --rv32c embench-iot/bd_rvc/src/statemate/statemate \
  --start 3 --stop 80 --step 3 \
  --miss-penalty 50 \
  --csv data/statemate_manual.csv
```

Add `--no-prefetch` to disable next-line prefetch. Add
`--png data/statemate_manual.png` to generate a plot when Matplotlib is
installed.

### Run the miss-penalty sensitivity experiment

`embench_penalty_sweep.py` repeats a benchmark with and without prefetch at
multiple miss penalties:

```bash
python3 scripts/embench_penalty_sweep.py nettle-sha256
```

The thesis configuration uses penalties of 10, 25, 50, 100, and 200 cycles.
To select another set:

```bash
python3 scripts/embench_penalty_sweep.py nettle-sha256 \
  --penalties 10 50 100 --jobs 3
```

The final data file is:

```text
data/penalty_sweeps/nettle_sha256_penalty_sweep.dat
```

### Recalculate the prefetch tables

Run this after generating the combined data files:

```bash
python3 scripts/recalc_tables_prefetch.py
```

Output the values in machine-readable CSV form:

```bash
python3 scripts/recalc_tables_prefetch.py --csv
```

Output complete LaTeX tables:

```bash
python3 scripts/recalc_tables_prefetch.py --latex
```

### Quick smoke test

Before running every benchmark, test two small cache configurations:

```bash
python3 scripts/embench_tex_sweep_combined.py \
  statemate --start 3 --stop 6 --step 3
```

Every Python script supports `--help`, for example:

```bash
python3 scripts/embench_tex_sweep_combined.py --help
```

## Metrics

- `clocks` / `cache_clock`
- `cache_hits`
- `cache_misses`
- `icache_lookups`
- `icache_crossline_fetches`
