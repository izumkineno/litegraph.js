import { defineConfig } from "vite";
import { resolve } from "node:path";

const entry = resolve(
    process.cwd(),
    "examples/standalone-modern-node/ts-counter-node.ts"
);

export default defineConfig({
    build: {
        lib: {
            entry,
            name: "LiteGraphStandaloneCounterNode",
            formats: ["es", "iife"],
            fileName: (format) =>
                format === "es"
                    ? "standalone-counter-node.esm.js"
                    : "standalone-counter-node.iife.js",
        },
        outDir: resolve(process.cwd(), "examples/standalone-modern-node/dist"),
        emptyOutDir: true,
        target: "es2018",
    },
});
