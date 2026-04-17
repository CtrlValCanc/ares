import { Component, createSignal } from "solid-js";
import { DisplayFormat, formatRegister, UnitSize } from "./DisplayFormat";

export const [displayFormat, setDisplayFormat] = createSignal<DisplayFormat>("hex");
export const [unitSize, setUnitSize] = createSignal<UnitSize>(4);

export const RegisterTable: Component<{ pc: number, regs: number[], regWritten: number }> = (props) => {
  const regnames = [
    "ra",
    "sp",
    "gp",
    "tp",
    "t0",
    "t1",
    "t2",
    "fp",
    "s1",
    "a0",
    "a1",
    "a2",
    "a3",
    "a4",
    "a5",
    "a6",
    "a7",
    "s2",
    "s3",
    "s4",
    "s5",
    "s6",
    "s7",
    "s8",
    "s9",
    "s10",
    "s11",
    "t3",
    "t4",
    "t5",
    "t6",
  ];

  // setting ascii will force unit size to byte
  // the alternative would have been to only show ascii while unit size is byte
  // but that is less discoverable

  const handleFormatChange = (format: DisplayFormat) => {
    if (format === "ascii") {
      setUnitSize(1);
    }
    setDisplayFormat(format);
  };

  const handleUnitChange = (size: UnitSize) => {
    setUnitSize(size);
    if (size !== 1 && displayFormat() === "ascii") {
      setDisplayFormat("hex");
    }
  };
  // all units being ch makes so that the precise sum is 1ch (left pad) + 7ch (x27/a10) + 10ch (0xdeadbeef) + 1ch (right pad)
  // round to 20ch so it has some padding between regname and hex
  // now i have the precise size in a font-independent format, as long as it's monospace
  // webkit workaround for lack of select styling (particularly apparent in dark mode)
  // using google material icons keyboard_arrow_down as it matches Chromium's native
  return (
    <div class="overflow-hidden flex-grow h-full self-start flex-shrink flex flex-col">
      <div class="flex-none flex items-center justify-end theme-gutter border-b theme-border min-h-9">
        <div class="flex flex-wrap items-center gap-1">
          <div class="pb-0.5 relative inline-block">
            <select
              class="appearance-none font-semibold theme-fg theme-gutter px-2 pr-6 rounded theme-border focus:outline-none cursor-pointer"
              title="Memory unit size"
              value={unitSize()}
              onChange={(e) => handleUnitChange(Number(e.currentTarget.value) as UnitSize)}
            >
              <option value={1}>byte</option>
              <option value={2}>half</option>
              <option value={4}>word</option>
            </select>
            <svg class="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 w-4 h-4 theme-fg"
              xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M480-344 240-584l56-56 184 184 184-184 56 56-240 240Z" /></svg>
          </div>
          <div class="pb-0.5 relative inline-block">
            <select
              class="appearance-none font-semibold theme-fg theme-gutter px-2 pr-6 rounded theme-border focus:outline-none cursor-pointer"
              title="Number format"
              value={displayFormat()}
              onChange={(e) => handleFormatChange(e.currentTarget.value as DisplayFormat)}
            >
              <option value="hex">hex</option>
              <option value="unsigned">unsigned</option>
              <option value="signed">signed</option>
            </select>
            <svg class="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 w-4 h-4 theme-fg"
              xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M480-344 240-584l56-56 184 184 184-184 56 56-240 240Z" /></svg>
          </div>
        </div>
      </div>

      <div class="overflow-auto flex-grow text-md theme-mono theme-scrollbar-slim theme-border">
        <div class="ml-[-1px] grid-cols-[repeat(auto-fit,minmax(20ch,1fr))] grid">
          <div class="justify-between flex flex-row box-content theme-border border-l py-[0.5ch] ">
            <div class="self-center pl-[1ch] font-bold">pc</div>
            <div class="self-center pr-[1ch]">{formatRegister(props.pc, "hex")}</div>
          </div>
          {/* using Index here would optimize it, but it gets messy with animations
            naively keeping it as is and making regWritten a signal would still cause everything to be recomputed
        */}
          {props.regs.slice(1).map((reg, idx) => (
            <div class="justify-between flex flex-row box-content theme-border border-l py-[0.5ch]">
              <div class="self-center pl-[1ch] font-bold">
                {regnames[idx]}/x{idx + 1}
              </div>
              <div class={"self-center mr-[1ch] " + (idx + 1 == props.regWritten ? "animate-fade-highlight" : "")}>
                {formatRegister(reg, displayFormat())}
              </div>
            </div>
          ))}

          {/* dummy left border of the last element */}
          <div class="theme-border border-l"></div>
        </div>

      </div>
    </div>
  );
};