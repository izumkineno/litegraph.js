import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { transformWithEsbuild } from "vite";
import { bundleManifest, outputNames } from "./bundle-manifest.mjs";

const scriptDir = fileURLToPath(new URL(".", import.meta.url));
const rootDir = resolve(scriptDir, "..");
const distDir = resolve(rootDir, "dist");

async function getBundleSource(inputFiles) {
  const sections = [];

  for (const relativePath of inputFiles) {
    const absolutePath = resolve(rootDir, relativePath);
    const source = await readFile(absolutePath, "utf8");
    sections.push(`// ---- ${relativePath} ----\n${source.trimEnd()}\n`);
  }

  return sections.join("\n");
}

async function buildBundle(bundleName, inputFiles) {
  const outputStem = outputNames[bundleName];
  if (!outputStem) {
    throw new Error(`Unknown bundle name: ${bundleName}`);
  }

  const source = await getBundleSource(inputFiles);
  const outputPath = resolve(distDir, `${outputStem}.js`);
  const minifiedPath = resolve(distDir, `${outputStem}.min.js`);

  await writeFile(outputPath, `${source}\n`, "utf8");

  const minified = await transformWithEsbuild(source, `${outputStem}.js`, {
    loader: "js",
    minify: true,
    legalComments: "none",
    target: "es2018",
  });

  await writeFile(minifiedPath, `${minified.code.trimEnd()}\n`, "utf8");
  console.log(`Built ${outputStem}.js and ${outputStem}.min.js`);
}

async function main() {
  await rm(distDir, { recursive: true, force: true });
  await mkdir(distDir, { recursive: true });

  const tasks = Object.entries(bundleManifest).map(([bundleName, inputFiles]) =>
    buildBundle(bundleName, inputFiles)
  );
  await Promise.all(tasks);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
