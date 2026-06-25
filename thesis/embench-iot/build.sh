#!/bin/bash

ARCH=$1
CPU=""

if [ "$ARCH" = "rv" ]; then
    CPU="generic_rv32+m"
    BUILD_DIR="bd"
elif [ "$ARCH" = "rvc" ]; then
    CPU="generic_rv32+m+c"
    BUILD_DIR="bd_rvc"
else
    echo "Usage: $0 [rv|rvc]"
    exit 1
fi

scons --config-dir=examples/riscv32/rv32ares/ \
    --build-dir="$BUILD_DIR" \
    user_libs= cc="$(pwd)/zcc" \
    gsf=1 cflags="-target riscv32-linux-musl -Os -fdata-sections -ffunction-sections -mabi=ilp32 -mcpu=$CPU -ffreestanding -static" \
    ldflags="-target riscv32-linux-musl -nostdlib -mabi=ilp32 -nostartfiles -mcpu=$CPU"
