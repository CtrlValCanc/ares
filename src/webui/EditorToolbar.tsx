import { Component, Show } from "solid-js";
import { prefixStr, testsuiteName } from "./App";
import { continueStep, nextStep, quitDebug, reverseStep, runNormal, runTestSuite, setWasmRuntime, singleStep, startStep, wasmRuntime } from "./EmulatorState";
import { doChangeTheme } from "./Theme";

export const EditorToolbar: Component<{ textGetter: () => string }> = (props) => {
    return (
        <div class="flex-none flex border-b theme-border h-9 pr-1">
            <h1 class="select-none text-lg font-bold tracking-wide ml-2 mr-3 flex content-center" style={{
                "text-transform": "uppercase",
                "display": "inline-block",
                "line-height": 1,
            }}>ARES</h1>

            <div class="flex-grow"></div>

            <div class="flex items-center gap-0.5">
                <Show when={wasmRuntime.status == "debug" ? wasmRuntime : null}>{debugRuntime => <>
                    <div class="w-px h-5 theme-separator mx-1"></div>
                    <ToolbarBtn
                        icon="step_into"
                        title={`Step into (${prefixStr}-S)`}
                        onClick={() => singleStep(debugRuntime(), setWasmRuntime)}
                    />
                    <ToolbarBtn
                        icon="step_over"
                        title={`Step over/Next (${prefixStr}-N)`}
                        onClick={() => nextStep(debugRuntime(), setWasmRuntime)}
                    />
                    <ToolbarBtn
                        icon="resume"
                        title={`Continue (${prefixStr}-C)`}
                        onClick={() => continueStep(debugRuntime(), setWasmRuntime)}
                    />
                    <ToolbarBtn
                        icon="undo"
                        title={`Reverse step (${prefixStr}-Z)`}
                        onClick={() => reverseStep(debugRuntime(), setWasmRuntime)}
                    />
                    <ToolbarBtn
                        icon="stop"
                        title={`Exit debugging (${prefixStr}-X)`}
                        onClick={() => quitDebug(debugRuntime(), setWasmRuntime)}
                    />
                </>}</Show>

                <div class="w-px h-5 theme-separator mx-1"></div>

                <Show when={testsuiteName}>
                    <ToolbarBtn
                        icon="play_circle"
                        title={`Run tests (${prefixStr}-R)`}
                        onClick={() => runTestSuite(wasmRuntime, setWasmRuntime, props.textGetter())}
                    />
                </Show>
                <Show when={!testsuiteName}>
                    <ToolbarBtn
                        icon="play_circle"
                        title={`Run (${prefixStr}-R)`}
                        onClick={() => runNormal(wasmRuntime, setWasmRuntime, props.textGetter())}
                    />
                    <ToolbarBtn
                        icon="arrow_forward"
                        title={`Debug (${prefixStr}-D)`}
                        onClick={() => startStep(wasmRuntime, setWasmRuntime, props.textGetter())}
                    />
                </Show>


                <ToolbarBtn
                    icon="dark_mode"
                    title="Change theme"
                    onClick={doChangeTheme}
                />
            </div>
        </div>
    );
};

const ToolbarBtn: Component<{ icon: string; title: string; onClick: () => void }> = (props) => (
    <button
        on:click={props.onClick}
        class="cursor-pointer flex items-center justify-center w-7 h-7 rounded material-symbols-outlined theme-fg theme-bg-hover theme-bg-active"
        style={{ "font-size": "26px" }}
        title={props.title}
    >
        {props.icon}
    </button>
);