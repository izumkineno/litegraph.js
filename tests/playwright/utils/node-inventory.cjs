const fs = require("fs");
const path = require("path");

const DEPENDENCY_TAGS_BY_FILE = {
  "audio.js": ["audio"],
  "midi.js": ["midi"],
  "network.js": ["network"],
  "gltextures.js": ["webgl"],
  "glfx.js": ["webgl"],
  "glshaders.js": ["webgl"],
  "geometry.js": ["webgl"],
  "math3d.js": ["math3d"],
  "graphics.js": ["media"],
  "input.js": ["input-device"],
};

function inferTypeTags(type) {
  const lower = String(type || "").toLowerCase();
  const tags = [];

  if (lower.includes("webcam") || lower.includes("video")) {
    tags.push("media");
  }
  if (lower.includes("audio")) {
    tags.push("audio");
  }
  if (lower.includes("midi")) {
    tags.push("midi");
  }
  if (lower.includes("websocket") || lower.includes("http") || lower.includes("network")) {
    tags.push("network");
  }
  if (lower.includes("texture") || lower.includes("shader") || lower.includes("geometry") || lower.includes("gl")) {
    tags.push("webgl");
  }

  return tags;
}

function parseTypesFromFile(content) {
  const regex = /registerNodeType\(\s*["']([^"']+)["']/g;
  const types = [];
  let match = regex.exec(content);
  while (match) {
    types.push(match[1]);
    match = regex.exec(content);
  }
  return types;
}

function collectStaticNodeInventory(rootDir = process.cwd()) {
  const nodesDir = path.join(rootDir, "src", "nodes");
  const files = fs.readdirSync(nodesDir)
    .filter((name) => name.endsWith(".js"))
    .sort();

  const nodeTypes = [];
  const categories = {};
  const fileIndex = {};

  for (const file of files) {
    const absPath = path.join(nodesDir, file);
    const content = fs.readFileSync(absPath, "utf8");
    const types = parseTypesFromFile(content);

    for (const type of types) {
      const family = type.includes("/") ? type.split("/")[0] : "(root)";
      const tags = [
        ...(DEPENDENCY_TAGS_BY_FILE[file] || []),
        ...inferTypeTags(type),
      ];
      const uniqueTags = [...new Set(tags)].sort();

      nodeTypes.push({
        type,
        file: path.relative(rootDir, absPath).replace(/\\/g, "/"),
        family,
        tags: uniqueTags,
      });

      categories[family] = (categories[family] || 0) + 1;
      fileIndex[file] = (fileIndex[file] || 0) + 1;
    }
  }

  nodeTypes.sort((a, b) => a.type.localeCompare(b.type));

  return {
    generatedAt: new Date().toISOString(),
    source: "src/nodes/**/*.js",
    count: nodeTypes.length,
    categories,
    fileIndex,
    nodeTypes,
  };
}

function deriveSelectionFromChangedFiles(changedFiles, inventory) {
  const files = Array.isArray(changedFiles) ? changedFiles : [];
  const normalized = files.map((file) => String(file).replace(/\\/g, "/"));

  const selectedFamilies = new Set();
  const selectedTypes = new Set();

  for (const file of normalized) {
    const match = file.match(/^src\/nodes\/([^/]+\.js)$/);
    if (!match) {
      continue;
    }
    const familyFile = match[1];
    for (const node of inventory.nodeTypes) {
      if (node.file.endsWith(`/nodes/${familyFile}`)) {
        selectedFamilies.add(node.family);
        selectedTypes.add(node.type);
      }
    }
  }

  const fullRunReasons = [];
  if (normalized.some((file) => file === "src/litegraph.js")) {
    fullRunReasons.push("src/litegraph.js changed");
  }
  if (normalized.some((file) => file.startsWith("editor/"))) {
    fullRunReasons.push("editor/** changed");
  }
  if (normalized.some((file) => /^dist\/litegraph.*\.js$/.test(file))) {
    fullRunReasons.push("dist/litegraph*.js changed");
  }

  const changedNodeFiles = normalized.filter((file) => /^src\/nodes\/.+\.js$/.test(file));
  if (changedNodeFiles.length >= 8) {
    fullRunReasons.push(">=8 node files changed");
  }

  if (selectedFamilies.size >= 3) {
    fullRunReasons.push(">=3 node families changed");
  }

  const coreInfraChanged = normalized.filter((file) => {
    return (
      file.startsWith("tests/playwright/fixtures/") ||
      file.startsWith("tests/playwright/page-objects/") ||
      file.startsWith("tests/playwright/utils/")
    );
  });
  if (coreInfraChanged.length > 3) {
    fullRunReasons.push("playwright core infra changed >3 files");
  }

  return {
    runFull: fullRunReasons.length > 0,
    fullRunReasons,
    selectedFamilies: [...selectedFamilies].sort(),
    selectedTypes: [...selectedTypes].sort(),
  };
}

module.exports = {
  collectStaticNodeInventory,
  deriveSelectionFromChangedFiles,
};
