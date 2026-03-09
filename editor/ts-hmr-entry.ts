import * as LiteGraphTSMigration from "../src/ts-migration/index";

declare global {
    interface Window {
        LiteGraphTSMigration?: typeof LiteGraphTSMigration;
        __liteGraphTsDemoBundle?: ReturnType<
            typeof LiteGraphTSMigration.assembleLiteGraph
        >;
    }
}

const CLASSIC_BOOTSTRAP_SCRIPT_PATHS = [
    "./js/libs/jquery-1.6.2.min.js",
    "./js/libs/gl-matrix-min.js",
    "./js/libs/litegl.js",
    "./js/libs/audiosynth.js",
    "./js/libs/midi-parser.js",
    "../src/nodes_leafer/base/shared/module.js",
];

const CLASSIC_SCRIPT_PATHS = [
    "../src/nodes_leafer/base/basic-value.js",
    "../src/nodes_leafer/base/basic-data.js",
    "../src/nodes_leafer/base/basic-io.js",
    "../src/nodes_leafer/base/basic-script.js",
    "../src/nodes_leafer/base/basic-compare.js",
    "../src/nodes_leafer/base.js",
    "../src/nodes/events.js",
    "../src/nodes/interface.js",
    "../src/nodes/input.js",
    "../src/nodes/math.js",
    "../src/nodes/math3d.js",
    "../src/nodes/strings.js",
    "../src/nodes/logic.js",
    "../src/nodes/graphics.js",
    "../src/nodes/gltextures.js",
    "../src/nodes/glshaders.js",
    "../src/nodes/geometry.js",
    "../src/nodes/glfx.js",
    "../src/nodes/midi.js",
    "../src/nodes/audio.js",
    "../src/nodes/network.js",
    "../src/nodes/others.js",
    "./js/litegraph-editor.js",
    "./js/defaults.js",
    "./js/litegraph-benchmark.js",
    "./js/demos.js",
    "./js/code.js",
] as const;

let bootPromise: Promise<void> | null = null;
const FULL_RELOAD_PATH_PATTERN = /(?:^|[\\/])(editor|src)[\\/]/i;

function resolveScriptUrl(relativePath: string): string {
    return new URL(relativePath, import.meta.url).href;
}

function loadClassicScript(relativePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = resolveScriptUrl(relativePath);
        script.async = false;
        script.dataset.litegraphEditorClassic = relativePath;
        script.onload = () => resolve();
        script.onerror = () =>
            reject(new Error(`Failed to load editor script: ${relativePath}`));
        document.body.appendChild(script);
    });
}

async function loadClassicScriptsWithTsGraphModule(): Promise<void> {
    for (const relativePath of CLASSIC_BOOTSTRAP_SCRIPT_PATHS) {
        await loadClassicScript(relativePath);
    }

    LiteGraphTSMigration.registerLeaferGraphBaseModule(window);

    for (const relativePath of CLASSIC_SCRIPT_PATHS) {
        await loadClassicScript(relativePath);
    }
}

function removeClassicScripts(): void {
    const scripts = document.querySelectorAll<HTMLScriptElement>(
        "script[data-litegraph-editor-classic]"
    );
    scripts.forEach((script) => script.remove());
}

function teardownEditor(): void {
    try {
        (window as typeof window & {
            graph?: { stop?: () => void };
            graphcanvas?: { clear?: () => void };
            editor?: { graph?: { stop?: () => void } };
        }).graph?.stop?.();
        (window as typeof window & {
            editor?: { graph?: { stop?: () => void } };
        }).editor?.graph?.stop?.();
        (window as typeof window & {
            graphcanvas?: { clear?: () => void };
        }).graphcanvas?.clear?.();
    } catch {
        // Ignore teardown failures during dev reloads.
    }

    removeClassicScripts();
    document.getElementById("main")?.replaceChildren();
}

async function bootEditor(): Promise<void> {
    window.LiteGraphTSMigration = LiteGraphTSMigration;
    window.__liteGraphTsDemoBundle = LiteGraphTSMigration.assembleLiteGraph({
        attachToGlobal: true,
        attachCommonJsExports: true,
    });

    await loadClassicScriptsWithTsGraphModule();
}

if (!bootPromise) {
    bootPromise = bootEditor();
}

if (import.meta.hot) {
    import.meta.hot.on("vite:beforeUpdate", (payload) => {
        const shouldForceReload = payload.updates.some((update) =>
            FULL_RELOAD_PATH_PATTERN.test(update.path)
        );

        if (shouldForceReload) {
            import.meta.hot?.invalidate(
                "[litegraph-editor] source update requires full reload"
            );
        }
    });

    import.meta.hot.dispose(() => {
        bootPromise = null;
        teardownEditor();
    });
}
