# Wrapper Makefile for embench-iot integration with rv32emu
#
# This translates the rv32emu build system's CC/BINDIR variables
# into the scons-based build system used by embench-iot.

BINDIR  ?= bin
CC      ?= riscv-none-elf-gcc
CFLAGS  ?=
LDFLAGS ?=

EMBENCH_BUILD_DIR := $(abspath $(BINDIR))/embench-iot-build
EMBENCH_CONFIG    := examples/riscv32/rv32emu

SHELL_HACK := $(shell mkdir -p $(abspath $(BINDIR)))

.PHONY: all clean

all:
	scons \
	    --config-dir=$(EMBENCH_CONFIG) \
	    --build-dir=$(EMBENCH_BUILD_DIR) \
	    cc=$(CC) \
	    cflags="$(CFLAGS) -std=c99" \
	    ldflags="$(CFLAGS)" \
	    user_libs="$(LDFLAGS)" \
	    
	find $(EMBENCH_BUILD_DIR)/src -maxdepth 2 -type f ! -name '*.*' \
	    -exec cp {} $(abspath $(BINDIR)) \;

clean:
	$(RM) -r $(EMBENCH_BUILD_DIR)
