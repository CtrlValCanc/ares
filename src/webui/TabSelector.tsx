import { Component } from "solid-js";

export const TabSelector: Component<{
    tab: string;
    setTab: (newTab: string) => void;
    tabs: string[];
}> = (props) => {
    return (
        <div class="flex-none flex flex-wrap theme-gutter border-b theme-border min-h-9">
            <div class="flex flex-wrap ml-2">
                {props.tabs.map((currTab) => (
                    <button
                        class={`px-2 pb-0.5 font-semibold ${
                            props.tab === currTab 
                                ? "theme-fg theme-tab theme-fg border-t-2 theme-border-strong" 
                                : "theme-fg border-t-2 border-transparent "
                        }`}
                        onClick={() => props.setTab(currTab)}
                    >
                        {currTab}
                    </button>
                ))}
            </div>
        </div>
    );
}