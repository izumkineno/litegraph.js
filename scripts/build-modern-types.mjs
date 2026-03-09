import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const scriptDir = fileURLToPath(new URL(".", import.meta.url));
const rootDir = resolve(scriptDir, "..");
const distDir = resolve(rootDir, "dist");
const tscBin = resolve(rootDir, "node_modules", "typescript", "bin", "tsc");

async function main() {
  await mkdir(distDir, { recursive: true });
  await execFileAsync(process.execPath, [tscBin, "-p", "tsconfig.modern-types.json"], {
    cwd: rootDir,
  });
  await writeFile(resolve(distDir, "modern-types.js"), "export {};\n", "utf8");
  console.log("Built modern-types.d.ts");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
