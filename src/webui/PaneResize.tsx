import { createSignal, onMount, onCleanup, Show, createEffect } from "solid-js";
import { JSX } from "solid-js/jsx-runtime";

export const PaneResize = <T,>(props: {
    firstSize: number;
    direction: "vertical" | "horizontal";
    second: T | null;
    children: [() => JSX.Element, (data: T) => JSX.Element];
}) => {
    let handle: HTMLDivElement;
    let container: HTMLDivElement;

    const [size, setSize] = createSignal<number>(0);
    const [containerSize, setContainerSize] = createSignal<number>(0);
    const [resizeState, setResizeState] = createSignal<{ origSize: number; orig: number } | null>(null);

    const resizeUp = () => {
        setResizeState(null);
    }

    const resizeDown = (e: MouseEvent | TouchEvent) => {
        // inhibit the click to scroll event too
        e.preventDefault();
        e.stopImmediatePropagation();
        const client = e instanceof MouseEvent
            ? (props.direction === "vertical" ? e.clientY : e.clientX)
            : (props.direction === "vertical" ? e.touches[0].clientY : e.touches[0].clientX);
        setResizeState({ origSize: size(), orig: client });
    };

    const resizeMove = (e: MouseEvent | TouchEvent) => {
        if (!resizeState()) return;
        e.preventDefault();
        const client = e instanceof MouseEvent
            ? (props.direction === "vertical" ? e.clientY : e.clientX)
            : (props.direction === "vertical" ? e.touches[0].clientY : e.touches[0].clientX);

        const calcSize = resizeState()!.origSize + (client - resizeState()!.orig);
        const dim = props.direction === "vertical" ? container.clientHeight : container.clientWidth;
        setSize(Math.max(0, Math.min(calcSize, dim - 4)));
    };

    const updateSize = () => {
        const newSize = props.direction === "vertical" ? container.clientHeight : container.clientWidth;
        if (!newSize) return;
        setSize((size() / containerSize()) * newSize);
        setContainerSize(newSize);
    };

    onMount(() => {
        const initialSize = props.direction === "vertical" ? container.clientHeight : container.clientWidth;
        setContainerSize(initialSize);
        setSize(initialSize * props.firstSize);

        const ro = new ResizeObserver(updateSize);
        ro.observe(container);

        const options = { passive: false };
        document.addEventListener("mousemove", resizeMove, options);
        document.addEventListener("touchmove", resizeMove, options);
        document.addEventListener("mouseup", resizeUp, options);
        document.addEventListener("touchend", resizeUp, options);

        onCleanup(() => {
            ro.disconnect();
            document.removeEventListener("mousemove", resizeMove);
            document.removeEventListener("touchmove", resizeMove);
            document.removeEventListener("mouseup", resizeUp);
            document.removeEventListener("touchend", resizeUp);
        });
    });

    createEffect(() => {
        if (props.second !== null) {
            const currentContainerSize = props.direction === "vertical"
                ? container?.clientHeight
                : container?.clientWidth;
            if (currentContainerSize)
                setSize(currentContainerSize * props.firstSize);
        }
    });

    return (
        <div
            class="flex w-full h-full max-h-full max-w-full theme-fg theme-bg"
            ref={el => container = el}
            classList={{
                "flex-col": props.direction === "vertical",
                "flex-row": props.direction === "horizontal",
            }}
        >
            <div
                class="theme-bg theme-fg flex-shrink overflow-hidden"
                style={{
                    height: props.direction === "vertical" ? `${props.second !== null ? size() : containerSize()}px` : "auto",
                    "min-height": props.direction === "vertical" ? `${props.second !== null ? size() : containerSize()}px` : "auto",
                    width: props.direction === "horizontal" ? `${props.second !== null ? size() : containerSize()}px` : "auto",
                    "min-width": props.direction === "horizontal" ? `${props.second !== null ? size() : containerSize()}px` : "auto",
                }}
            >
                {props.children[0]()}
            </div>
            <div
                on:mousedown={resizeDown}
                on:touchstart={resizeDown}
                ref={el => handle = el}
                class={
                    props.second === null
                        ? "hidden"
                        : props.direction === "vertical"
                            ? "relative w-full h-[12px] flex-shrink-0 cursor-ns-resize touch-none flex items-center -my-[6px] z-10"
                            : "relative h-full w-[12px] flex-shrink-0 cursor-ew-resize touch-none flex justify-center -mx-[6px] z-10"
                }
            >
                <div class={
                    props.direction === "vertical"
                        ? "w-full h-px theme-border border-t pointer-events-none"
                        : "h-full w-px theme-border border-l pointer-events-none"
                } />
            </div>
            <div class={props.second === null ? "hidden" : "theme-bg theme-fg flex-grow flex-shrink overflow-hidden"}>
                <Show when={props.second}>{(s) => props.children[1](s())}</Show>
            </div>
        </div>);
};