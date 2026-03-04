import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const scriptDir = fileURLToPath(new URL(".", import.meta.url));
const rootDir = resolve(scriptDir, "..");
const distDir = resolve(rootDir, "dist");
const entryFile = resolve(rootDir, "src", "ts-migration", "index.ts");

const tsMigrationBundleName = "litegraph.core.ts.js";
const tsMigrationMinBundleName = "litegraph.core.ts.min.js";

async function buildTsMigrationBundle(filename, minify) {
  await build({
    configFile: false,
    root: rootDir,
    publicDir: false,
    logLevel: "error",
    build: {
      lib: {
        entry: entryFile,
        name: "LiteGraphTSMigration",
        formats: ["iife"],
        fileName: () => filename,
      },
      outDir: distDir,
      emptyOutDir: false,
      target: "es2018",
      minify,
      sourcemap: false,
      cssCodeSplit: false,
      reportCompressedSize: false,
    },
    esbuild: {
      legalComments: "none",
    },
  });
}

async function main() {
  await mkdir(distDir, { recursive: true });

  await buildTsMigrationBundle(tsMigrationBundleName, false);
  console.log(`Built ${tsMigrationBundleName}`);

  await buildTsMigrationBundle(tsMigrationMinBundleName, "esbuild");
  console.log(`Built ${tsMigrationMinBundleName}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
