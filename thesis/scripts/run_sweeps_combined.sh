#!/usr/bin/env bash
set -euo pipefail

MAX_JOBS="${MAX_JOBS:-4}"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="${SCRIPT:-${SCRIPT_DIR}/embench_tex_sweep_combined.py}"

run_limited() {
    while [ "$(jobs -rp | wc -l)" -ge "$MAX_JOBS" ]; do
        sleep 1
    done

    "$@" &
}

run_combined_sweep() {
    local benchmark="$1"
    local stop="$2"

    run_limited python3 "$SCRIPT" --stop "$stop" "$benchmark"
}

run_combined_sweep statemate 80
run_combined_sweep nettle-sha256 260
run_combined_sweep picojpeg 65
run_combined_sweep nsichneu 400

run_limited python3 "$SCRIPT" --stop 200 --doom

wait

echo "Tutti gli sweep combined sono terminati."
