import { createVirtualizer } from "@tanstack/solid-virtual";
import { Component, createSignal, onMount, createEffect, For, Show } from "solid-js";
import { TabSelector } from "./TabSelector";
import { DATA_BASE, STACK_TOP, TEXT_BASE } from "./core/RiscV";
import { ShadowStackEntry } from "./core/EmulatorState";
import { displayFormat, formatMemoryValue, unitSize, getCellWidthChars } from "./DisplayFormat";

const ROW_HEIGHT: number = 24;

// this wrapper is needed because the .data section size may be unaligned
function loadWrapper(load: (addr: number, pow: number) => number, ptr: number, size: number) {
    let val = 0;
    for (let i = 0; i < size; i++) {
        val |= load(ptr + i, 1) << (i * 8);
    }
    return val;
}

export const MemoryView: Component<{ version: () => any, writeAddr: number, writeLen: number, highlightAddr: number, highlightLen: number, pc: number, sp: number, fp: number, load: (addr: number, pow: number) => number, shadowStack: any, disassemble: (pc: number) => string | null }> = (props) => {
    let parentRef: HTMLDivElement | undefined;
    let dummyChar: HTMLDivElement | undefined;

    // same version hack, but for tab switch
    const [reloadTrigger, setReloadTrigger] = createSignal(0);
    const [containerWidth, setContainerWidth] = createSignal<number>(0);
    const [charWidth, setCharWidth] = createSignal<number>(0);
    const [chunksPerLine, setChunksPerLine] = createSignal<number>(1);
    const [lineCount, setLineCount] = createSignal<number>(0);
    const [addrSelect, setAddrSelect] = createSignal<number>(-1);

    const getUnitBytes = () => unitSize() === "byte" ? 1 : unitSize() === "half" ? 2 : 4;

    onMount(() => {
        if (dummyChar) setCharWidth(dummyChar.getBoundingClientRect().width);
        const ro = new ResizeObserver((entries) => {
            for (const entry of entries) setContainerWidth(entry.contentRect.width);
        });
        if (parentRef) ro.observe(parentRef);
        return () => ro.disconnect();
    });

    createEffect(() => {
        const cw = charWidth();
        const containerW = containerWidth();
        const unit = getUnitBytes();

        if (cw > 0 && containerW > 0) {
            if (activeTab() != "disasm") {
                const addressGutterChars = 12;
                const availablePx = containerW - (addressGutterChars * cw);

                // Get the MAXIMUM width needed (format-independent)
                const unitWidthChars = getCellWidthChars(unit);
                const valuesPerChunk = 4 / unit;

                // Calculate chunk width: (units * their width) + (gaps between units)
                const chunkWidthChars = (valuesPerChunk * unitWidthChars) + valuesPerChunk;
                const chunkWidthPx = chunkWidthChars * cw;

                const count = Math.max(1, Math.floor(availablePx / chunkWidthPx));

                setChunksPerLine(count + 1); // +1 because loop uses (chunksPerLine - 1)
                setLineCount(Math.ceil(65536 / (count * 4)));
            }
        }
    });

    const rowVirtualizer = createVirtualizer({
        get count() { return lineCount(); },
        getScrollElement: () => parentRef ?? null,
        estimateSize: () => ROW_HEIGHT,
        overscan: 5,
    });


    const rowVirtualizer2 = createVirtualizer({
        get count() { return 65536 / 4 },
        getScrollElement: () => parentRef ?? null,
        estimateSize: () => ROW_HEIGHT,
        overscan: 5,
    });

    const [activeTab, setActiveTab] = createSignal(".text");

    // auto-scroll to bottom when switching to stack tab
    createEffect(() => {
        if (parentRef) {
            if (activeTab() == "stack") {
                const lastIndex = lineCount() - 1;
                rowVirtualizer.scrollToIndex(lastIndex);
            } else if (activeTab() != "disasm") {
                rowVirtualizer.scrollToIndex(0);
            } else if (activeTab() == "disasm") {
                // scroll to current PC if debugging, otherwise top
                if (props.pc > 0) {
                    const idx = (props.pc - TEXT_BASE) / 4;
                    if (idx >= 0 && idx < 65536 / 4) {
                        rowVirtualizer2.scrollToIndex(idx, { align: "center" });
                    } else {
                        rowVirtualizer2.scrollToIndex(0);
                    }
                } else {
                    rowVirtualizer2.scrollToIndex(0);
                }
            }
        }
    });

    // auto-scroll disasm view to the current PC when stepping
    createEffect(() => {
        props.version(); // track version changes (steps)
        if (activeTab() == "disasm" && props.pc > 0) {
            const idx = (props.pc - TEXT_BASE) / 4;
            if (idx >= 0 && idx < 65536 / 4) {
                rowVirtualizer2.scrollToIndex(idx, { align: "center" });
            }
        }
    });

    // force a view reload on tab switches
    createEffect(() => {
        activeTab();
        setReloadTrigger(prev => prev + 1);
    });

    const getStartAddr = () => {
        if (activeTab() == ".text" || activeTab() == "disasm") return TEXT_BASE;
        if (activeTab() == ".data") return DATA_BASE;
        if (activeTab() == "stack") return STACK_TOP - 65536;
        return 0;
    };

    return (
        <div class="h-full flex flex-col overflow-hidden" onMouseDown={() => setAddrSelect(-1)}>
            <TabSelector tab={activeTab()} setTab={setActiveTab} tabs={[".text", "disasm", ".data", "stack", "frames"]} />

            <div class="font-semibold theme-mono ml-2 theme-fg">
                <a class="theme-style6 inline-block" style={{ width: charWidth() * 10 + "px" }}>address</a>
                <a>{activeTab() == "disasm" ? "instructions" : "contents"}</a>
            </div>


            <div ref={parentRef} class="theme-mono text-lg overflow-y-auto overflow-x-auto theme-scrollbar ml-2">
                <div ref={dummyChar} class="invisible absolute">0</div>

                <Show when={activeTab() == "frames"}>
                    <ShadowStack
                        shadowStack={props.shadowStack}
                        memWrittenAddr={props.writeAddr}
                        memWrittenLen={props.writeLen}
                    />
                </Show>

                <Show when={activeTab() == "disasm"}>
                    <div style={{ height: `${rowVirtualizer2.getTotalSize()}px`, width: "100%", position: "relative" }}>
                        <For each={rowVirtualizer2.getVirtualItems()}>
                            {(virtRow) => (
                                <div
                                    style={{ "white-space": "nowrap", position: "absolute", top: `${virtRow.start}px`, height: `${ROW_HEIGHT}px` }}
                                    class={"flex flex-row items-center w-full " + (props.version() && (TEXT_BASE + virtRow.index * 4 == props.pc) ? "cm-debugging" : "")}
                                >
                                    <div
                                        class={"theme-style6 shrink-0 w-[10ch] tabular-nums " + ((addrSelect() == virtRow.index) ? "select-text " : "select-none ") + ((TEXT_BASE + virtRow.index * 4 == props.pc) ? "theme-fg" : "theme-fg2")}
                                        onMouseDown={(e) => { setAddrSelect(virtRow.index); e.stopPropagation(); }}>
                                        {(TEXT_BASE + virtRow.index * 4).toString(16).padStart(8, "0")}
                                    </div>

                                    {(() => {
                                        props.version();
                                        const basePtr = TEXT_BASE + virtRow.index * 4;
                                        let inst = props.disassemble ? props.disassemble(basePtr) : "";
                                        let style = "";
                                        if (basePtr >= props.highlightAddr && basePtr < (props.highlightAddr + props.highlightLen))
                                            style = "font-bold";
                                        return <div class={style}>{inst}</div>;
                                    })()}
                                </div>
                            )}
                        </For>
                    </div>
                </Show>

                <Show when={activeTab() != "frames" && activeTab() != "disasm"}>
                    <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: "100%", position: "relative" }}>
                        <For each={rowVirtualizer.getVirtualItems()}>
                            {(virtRow) => (
                                <div
                                    style={{ position: "absolute", top: `${virtRow.start}px`, height: `${ROW_HEIGHT}px` }}
                                    class="flex flex-row items-center w-full"
                                >
                                    {/* Address Column */}
                                    <div
                                        class={"theme-style6 theme-fg2 shrink-0 w-[10ch] tabular-nums " + ((addrSelect() == virtRow.index) ? "select-text" : "select-none")}
                                        onMouseDown={(e) => { setAddrSelect(virtRow.index); e.stopPropagation(); }}>
                                        {(getStartAddr() + virtRow.index * (chunksPerLine() - 1) * 4).toString(16).padStart(8, "0")}
                                    </div>

                                    {(() => {
                                        props.version();
                                        reloadTrigger();
                                        displayFormat();
                                        let chunks = chunksPerLine() - 1;
                                        if (chunks < 1) chunks = 1;

                                        const bytesPerUnit = getUnitBytes();
                                        let components = [];
                                        let selectMode = (addrSelect() == -1) ? "select-text" : "select-none";

                                        for (let i = 0; i < chunks; i++) {
                                            const basePtr = getStartAddr() + (virtRow.index * chunks + i) * 4;
                                            const unitsPerChunk = 4 / bytesPerUnit;

                                            for (let j = 0; j < unitsPerChunk; j++) {
                                                let ptr = basePtr + (j * bytesPerUnit);
                                                if (ptr - getStartAddr() >= 65536) break;
                                                let isAnimated = ptr >= props.writeAddr && ptr < props.writeAddr + props.writeLen;
                                                // only handle FP here if it is set (it's 0 by default)
                                                let isGray = activeTab() == "stack" && (ptr < props.sp || (props.fp > props.sp && ptr > props.fp));
                                                // TODO: should we do +4 or +display_size?
                                                let isSp = ptr >= props.sp && ptr < props.sp + 4;
                                                let isFp = ptr >= props.fp && ptr < props.fp + 4;
                                                let style = selectMode;
                                                if (isAnimated) style = "animate-fade-highlight";
                                                else if (isGray) style = "theme-fg2";
                                                else if (isSp) style = "sp-highlight";
                                                else if (isFp) style = "fp-highlight";
                                                if (ptr >= props.highlightAddr && ptr < props.highlightAddr + props.highlightLen)
                                                    style += " font-bold";

                                                // Use max width for consistent layout
                                                const cellWidth = getCellWidthChars(bytesPerUnit);

                                                const str = formatMemoryValue(loadWrapper(props.load, ptr, bytesPerUnit), bytesPerUnit);
                                                components.push(
                                                    <span
                                                        class={style + " cursor-default tabular-nums whitespace-pre"}
                                                        style={{
                                                            "margin-right": (i != chunks - 1 || j != unitsPerChunk - 1) ? `${cellWidth + 1 - str.length}ch` : "0",
                                                            "display": "inline-block"
                                                        }}
                                                    >
                                                        {str}
                                                    </span>
                                                );
                                            }
                                        }
                                        return (
                                            <div style={{ "white-space": "nowrap" }}>
                                                {components}
                                            </div>
                                        );
                                    })()}
                                </div>
                            )}
                        </For>
                    </div>
                </Show>
            </div>
        </div>
    );
};

const ShadowStack: Component<{ memWrittenAddr: number, memWrittenLen: number, shadowStack: ShadowStackEntry[] }> = (props) =>
    <For each={props.shadowStack}>
        {(elem) => (
            <div class="flex flex-col pb-4">
                <div class="font-bold">{elem.name}</div>
                <For each={elem.elems}>
                    {(e) => (
                        <div class="flex flex-row">
                            <a class="theme-style6 pr-2 w-[10ch] tabular-nums">{e.addr.toString(16)}</a>
                            <div class={((e.addr >= props.memWrittenAddr &&
                                e.addr <
                                props.memWrittenAddr +
                                props.memWrittenLen) ? "animate-fade-highlight " : "") + "tabular-nums"}>{e.text}</div>
                        </div>
                    )}
                </For>
            </div >
        )}
    </For >; 