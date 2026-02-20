import { Decoration, WidgetType } from "@codemirror/view";
import { highlightTree } from "@lezer/highlight";
import { EditorView } from "codemirror";
import { Component } from "solid-js";
import { setWasmRuntime, startStepTestSuite, testData, TestSuiteTableEntry, wasmRuntime } from "./EmulatorState";
import { githubHighlightStyle } from "./GithubTheme";
import { riscvLanguage } from "./RiscVLanguage";

class HeaderWidget extends WidgetType {
    constructor() {
        super();
    }

    toDOM(view: EditorView) {
        const container = document.createElement("div");
        container.className = "cm-header-widget";
        let tdata = testData;
        if (tdata) container.style = "padding-bottom: 1.5rem";
        let assignment = tdata ? tdata.assignment : "";
        parseFormat(assignment, container);
        return container;
    }

    ignoreEvent() {
        return true;
    }
}

export function headerDecoration() {
    return EditorView.decorations.of(Decoration.set([
        Decoration.widget({
            widget: new HeaderWidget(),
            side: -1,
            block: true
        }).range(0)
    ]))
}

function createHighlightedText(code: string, syntaxHighlight: boolean) {
    let block = document.createElement("div")
    block.className = "cm-header-code"

    let pos = 0
    if (syntaxHighlight) {
        let tree = riscvLanguage.parser.parse(code)
        highlightTree(tree, githubHighlightStyle, (from, to, classes) => {
            if (from > pos) block.appendChild(document.createTextNode(code.slice(pos, from)))
            let span = document.createElement("span")
            span.className = classes
            span.textContent = code.slice(from, to)
            block.appendChild(span)

            pos = to
        })
    }
    if (pos < code.length) block.appendChild(document.createTextNode(code.slice(pos)))
    return block
}

function parseFormat(fmt: string, container: HTMLElement): void {
    const parts = fmt.split(/(```[\s\S]*?```)/);

    for (const part of parts) {
        if (part.startsWith('```') && part.endsWith('```')) {
            let codeContent = part.slice(3, -3);
            let highlight = false;
            if (codeContent.startsWith("riscv")) {
                highlight = true;
                codeContent = codeContent.slice(5);
            }
            if (codeContent.startsWith('\r\n')) {
                codeContent = codeContent.slice(2);
            } else if (codeContent.startsWith('\n')) {
                codeContent = codeContent.slice(1);
            }

            const highlightedElement = createHighlightedText(codeContent, highlight);
            container.appendChild(highlightedElement);
        } else {
            parseInlineCode(part, container);
        }
    }
}

function parseInlineCode(text: string, container: HTMLElement): void {
    // Split by single backticks to handle inline code
    const parts = text.split(/(`[^`]+`)/);

    for (const part of parts) {
        if (part.startsWith('`') && part.endsWith('`')) {
            const codeContent = part.slice(1, -1);
            const anchor = document.createElement('a');
            anchor.textContent = codeContent;
            container.appendChild(anchor);
        } else if (part) {
            const textNode = document.createTextNode(part);
            container.appendChild(textNode);
        }
    }
}

// NOTE: all characters heights are precalculated and valid since it is using monospace fonts entirely
export const TestSuiteViewer: Component<{ table: TestSuiteTableEntry[], currentDebuggingEntry: number, textGetter: () => string }> = props => {
    return (
        <div class="theme-scrollbar theme-bg theme-fg overflow-x-auto overflow-y-auto w-full h-full">
            <table class="table w-full max-w-full h-full min-w-full border-collapse rounded-lg ">
                <thead class=" ">
                    <tr class="  text-left theme-fg border-b theme-border">
                        <th class="w-[8ch] theme-mono px-2 py-1 font-semibold theme-fg">status</th>
                        <th class="w-[14ch] theme-mono px-2 py-1 font-semibold theme-fg">input</th>
                        <th class="w-[8ch] theme-mono px-2 py-1 font-semibold theme-fg whitespace-nowrap">expected</th>
                        <th class="w-[14ch] theme-mono px-2 py-1 font-semibold theme-fg whitespace-nowrap">yours</th>
                    </tr>
                </thead>
                <tbody class=" ">
                    {props.table.map((testcase, index) => {
                        const passed = testcase.output === testcase.userOutput;
                        const errorType = testcase.runErr ? "crashed" : "mismatched";
                        return (
                            <tr
                                class={`  border-b theme-mono theme-border ${passed ? 'theme-testsuccess' : 'theme-testfail'}`}
                            >
                                <td class="px-2">
                                    {passed ?
                                        <div class="flex flex-col">
                                            <span class="text-sm font-semibold">success</span>
                                            <button class="text-left text-sm hover:font-semibold " on:click={() => startStepTestSuite(wasmRuntime, setWasmRuntime, index, props.textGetter())}>
                                                {props.currentDebuggingEntry === index ? "debugging" : "debug it"}
                                            </button>
                                        </div> :
                                        <div class="flex flex-col">
                                            <span class="text-sm font-semibold">{errorType}</span>
                                            <button class="text-left text-sm underline hover:font-semibold " on:click={() => startStepTestSuite(wasmRuntime, setWasmRuntime, index, props.textGetter())}>
                                                {props.currentDebuggingEntry === index ? "debugging" : "debug it"}
                                            </button>
                                        </div>}
                                </td>
                                <td class="px-1 py-1.5 text-sm">
                                    <code class="text-xs theme-mono rounded whitespace-pre-wrap break-words max-w-full block">
                                        {testcase.input}
                                    </code>
                                </td>
                                <td class="px-1 py-1.5 text-sm">
                                    <code class="px-1 py-1.5 rounded text-xs theme-mono whitespace-pre-wrap break-words max-w-full block">
                                        {testcase.output}
                                    </code>
                                </td>
                                <td class="px-1 py-1.5 text-sm">
                                    <code class={`px-1 py-1.5 rounded text-xs theme-mono whitespace-pre-wrap break-words max-w-full block `}>
                                        {testcase.userOutput}
                                    </code>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};
