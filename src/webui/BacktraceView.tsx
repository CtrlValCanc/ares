import { Component } from "solid-js";
import { DebugState, ErrorState } from "./EmulatorState";

function toHex(arg: number): string {
    return "0x" + arg.toString(16).padStart(8, "0");
}

const BacktraceCall: Component<{ name: string, args: number[], sp: number }> = (props) => {
    return <div class="flex">
        <div class="font-bold pr-1">{props.name}</div>
        <div class="flex flex-row flex-wrap">
            <div class="theme-fg2">args=</div>
            <div class="pr-1">{toHex(props.args[0])}</div>
            <div class="pr-1">{toHex(props.args[1])}</div>
            <div class="pr-1">{toHex(props.args[2])}</div>
            <div class="pr-1">{toHex(props.args[3])}</div>
            <div class="pr-1">{toHex(props.args[4])}</div>
            <div class="pr-1">{toHex(props.args[5])}</div>
            <div class="pr-1">{toHex(props.args[6])}</div>
            <div class="pr-1">{toHex(props.args[7])}</div>
            <div class="theme-fg2">sp=</div>
            <div class="pr-1">{toHex(props.sp)}</div>
        </div>
    </div>
};


export const BacktraceView = (state: DebugState | ErrorState) => {
    return <div class="w-full h-full theme-mono text-sm overflow-auto theme-scrollbar-slim flex flex-col">
        {[...state.shadowStack].reverse().map(ent => <BacktraceCall name={ent.name} args={ent.args} sp={ent.sp} />)}
    </div>;
};