/* @refresh reload */
import './index.css';
import { render } from 'solid-js/web';
import App from './App';
import { WasmInterface } from './core/RiscV';
import { Emulator, TestData } from './core/EmulatorState';
import wasmUrl from "./main.wasm?url";

const root = document.getElementById('root');

export async function fetchTestData(): Promise<TestData | null> {
  const testsuiteName = new URLSearchParams(window.location.search).get("testsuite");
  if (!testsuiteName) return null;
  const [asmRes, jsonRes, txtRes] = await Promise.all([
    fetch(`${testsuiteName}.S`),
    fetch(`${testsuiteName}.json`),
    fetch(`${testsuiteName}.txt`),
  ]);
  if (!asmRes.ok || !jsonRes.ok || !txtRes.ok) {
    throw new Error("Failed to load test suite files");
  }
  return {
    testPrefix: await asmRes.text(),
    testcases: await jsonRes.json(),
    assignment: (await txtRes.text()).trim(),
  };
}

export let wasmInterface!: WasmInterface;
export let emulator!: Emulator;
export let testData!: TestData;

declare global {
  interface Window { __wasmFetch: Promise<Response>; }
}

async function initEmulator() {
  if (import.meta.hot?.data.emulator) {
    wasmInterface = import.meta.hot.data.wasmInterface;
    emulator = import.meta.hot.data.emulator;
    testData = import.meta.hot.data.testData;
    return;
  }

  let wasmFetch = window.__wasmFetch ?? fetch(wasmUrl);
  const [wi, tc] = await Promise.all([
    WasmInterface.loadModule(await wasmFetch.then(r => r.arrayBuffer())),
    fetchTestData(),
  ]);
  wasmInterface = wi;
  testData = tc!;
  emulator = new Emulator(wasmInterface, testData);

  if (import.meta.hot) {
    import.meta.hot.data.wasmInterface = wasmInterface;
    import.meta.hot.data.emulator = emulator;
    import.meta.hot.data.testData = testData;
  }
}

initEmulator().then(() => render(() => <App />, root!));