import {
	onMount,
	type Component,
} from "solid-js";

import { wasmInterface } from ".";
import { BacktraceView } from "./BacktraceView";
import { Editor, EditorInterface } from "./Editor";
import { consoleText, continueStep, doBuildForLinter, getCurrentLine, initialRegs, nextStep, quitDebug, reverseStep, runNormal, runTestSuite, setBreakpointLines, setWasmRuntime, singleStep, startStep, testData, TEXT_BASE, wasmRuntime, wasmTestsuite, wasmTestsuiteIdx } from "./EmulatorState";
import { EditorToolbar } from "./EditorToolbar";
import { MemoryView } from "./MemoryView";
import { PaneResize } from "./PaneResize";
import { RegisterTable } from "./RegisterTable";
import { TestSuiteViewer } from "./TestSuite";
import { currentTheme } from "./Theme";

// TODO: exporting those to access them in Theme.ts, but if i do 
// theming with constant CSS classes i shouldn't need this anyways
export const testsuiteName = (new URLSearchParams(window.location.search)).get('testsuite');
export const isMac = navigator.platform.toLowerCase().includes('mac');
export const prefixStr = isMac ? "Ctrl-Shift" : "Ctrl-Alt"
const localStorageKey = testsuiteName ? ("savedtext-" + testsuiteName) : "savedtext";
const origText = localStorage.getItem(localStorageKey) || "";
let editorInterface = new EditorInterface();

const App: Component = () => {
	onMount(() => {
		window.addEventListener('keydown', (event) => {
			// FIXME: this is deprecated but i'm not sure what is the correct successor
			const prefix = isMac ? (event.ctrlKey && event.shiftKey) : (event.ctrlKey && event.altKey);

			if (wasmRuntime.status == "debug" && prefix && event.key.toUpperCase() == 'S') {
				event.preventDefault();
				singleStep(wasmRuntime, setWasmRuntime);
			}
			else if (wasmRuntime.status == "debug" && prefix && event.key.toUpperCase() == 'N') {
				event.preventDefault();
				nextStep(wasmRuntime, setWasmRuntime);
			}
			else if (wasmRuntime.status == "debug" && prefix && event.key.toUpperCase() == 'C') {
				event.preventDefault();
				continueStep(wasmRuntime, setWasmRuntime);
			}
			else if (wasmRuntime.status == "debug" && prefix && event.key.toUpperCase() == 'Z') {
				event.preventDefault();
				reverseStep(wasmRuntime, setWasmRuntime);
			}
			else if (wasmRuntime.status == "debug" && prefix && event.key.toUpperCase() == 'X') {
				event.preventDefault();
				quitDebug(wasmRuntime, setWasmRuntime);
			}
			if (testData) {
				if (prefix && event.key.toUpperCase() == 'R') {
					event.preventDefault();
					runTestSuite(wasmRuntime, setWasmRuntime, editorInterface.getText());
				}
			} else {
				if (prefix && event.key.toUpperCase() == 'R') {
					event.preventDefault();
					runNormal(wasmRuntime, setWasmRuntime, editorInterface.getText());
				}
				else if (prefix && event.key.toUpperCase() == 'D') {
					event.preventDefault();
					startStep(wasmRuntime, setWasmRuntime, editorInterface.getText());
				}
			}
		});
	});
	return (
		<div class="fullsize flex flex-row overflow-hidden">
			<PaneResize firstSize={0.5} direction="horizontal" second={true}>
				{() =>
					<div class="flex flex-col h-full w-full">
						<EditorToolbar textGetter={editorInterface.getText} setText={editorInterface.setText} />
						<div class="flex-grow overflow-hidden">
							<PaneResize firstSize={0.65} direction="vertical"
								second={wasmTestsuite().length > 0 ? true : null}>
								{() => <PaneResize firstSize={0.85} direction="vertical"
									second={((wasmRuntime && (wasmRuntime.status == "debug" || wasmRuntime.status == "error")) && wasmRuntime.shadowStack.length > 0) ? wasmRuntime : null}>
									{() => <Editor origText={origText} storeText={text => localStorage.setItem(localStorageKey, text)} asmLinterOn={wasmRuntime.status != "debug" && wasmRuntime.status != "error"}
										editorBlocked={wasmRuntime.status == "debug"}
										highlightedLine={(wasmRuntime.status == "debug" || wasmRuntime.status == "error") ? getCurrentLine(wasmRuntime) : undefined}
										editorInterfaceRef={editorInterface} setBreakpoints={setBreakpointLines}
										diagnostics={wasmRuntime.status == "asmerr" ? { line: wasmRuntime.line, message: wasmRuntime.message } : undefined}
										doBuild={(s) => doBuildForLinter(wasmRuntime, setWasmRuntime, s)}
										theme={currentTheme()}
									/>}
									{wasmRuntime => BacktraceView(wasmRuntime)}
								</PaneResize>}
								{() => <TestSuiteViewer table={wasmTestsuite()} currentDebuggingEntry={wasmTestsuiteIdx()} textGetter={editorInterface.getText} />}
							</PaneResize>
						</div>
					</div>
				}

				{() => <PaneResize firstSize={0.75} direction="vertical" second={true}>
					{() => <PaneResize firstSize={0.55} direction="horizontal" second={true}>
						{() => <MemoryView version={() => wasmRuntime.version}
							writeAddr={wasmRuntime.status == "debug" ? wasmRuntime.memWrittenAddr : 0}
							writeLen={wasmRuntime.status == "debug" ? wasmRuntime.memWrittenLen : 0}
							sp={wasmInterface.regsArr[2 - 1]}
							fp={wasmInterface.regsArr[8 - 1]}
							pc={wasmRuntime.status == "debug" ? wasmInterface.pc[0] : 0}
							load={wasmInterface.emu_load}
							disassemble={(pc) => wasmInterface.disassemble(pc)}
						/>}
						{() => <RegisterTable pc={(wasmRuntime.status == "idle" || wasmRuntime.status == "asmerr" || wasmRuntime.status == "testsuite") ? TEXT_BASE : wasmRuntime.pc}
							regs={(wasmRuntime.status == "idle" || wasmRuntime.status == "asmerr" || wasmRuntime.status == "testsuite") ? initialRegs : wasmRuntime.regs}
							regWritten={wasmInterface ? wasmInterface.regWritten[0] : 0} />}
					</PaneResize>}
					{() => (<div
						innerText={consoleText(wasmRuntime) ? consoleText(wasmRuntime) : "Console output will go here..."}
						class={"w-full h-full theme-mono ml-2 mt-1 text-md overflow-auto theme-scrollbar theme-bg theme-fg"}
					></div>)}
				</PaneResize>}
			</PaneResize>
		</div>
	);
};

export default App;