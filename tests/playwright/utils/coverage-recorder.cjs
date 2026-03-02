const fs = require("fs");
const path = require("path");

function ensureParentDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function writeJsonReport(filePath, payload) {
  ensureParentDir(filePath);
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function writeMarkdownReport(filePath, lines) {
  ensureParentDir(filePath);
  fs.writeFileSync(filePath, `${lines.join("\n")}\n`, "utf8");
}

function buildSummaryMarkdown({
  title,
  generatedAt,
  totals,
  highlights,
  failures,
}) {
  const lines = [];
  lines.push(`# ${title}`);
  lines.push("");
  lines.push(`- Generated at: ${generatedAt}`);
  lines.push(`- Total checks: ${totals.total}`);
  lines.push(`- Passed: ${totals.passed}`);
  lines.push(`- Failed: ${totals.failed}`);
  lines.push("");

  if (highlights && highlights.length) {
    lines.push("## Highlights");
    lines.push("");
    for (const highlight of highlights) {
      lines.push(`- ${highlight}`);
    }
    lines.push("");
  }

  if (failures && failures.length) {
    lines.push("## Failures");
    lines.push("");
    for (const failure of failures) {
      lines.push(`- ${failure}`);
    }
    lines.push("");
  }

  return lines;
}

function recordCoverageBundle(baseDir, bundle) {
  const root = path.resolve(baseDir);
  const generatedAt = new Date().toISOString();

  const nodeCoveragePath = path.join(root, "node-coverage.json");
  const featureCoveragePath = path.join(root, "feature-coverage.json");
  const eventCoveragePath = path.join(root, "event-coverage.json");
  const summaryPath = path.join(root, "final-normal-usage-summary.md");

  const nodeCoverage = bundle.nodeCoverage || { records: [] };
  const featureCoverage = bundle.featureCoverage || { records: [] };
  const eventCoverage = bundle.eventCoverage || { records: [] };

  writeJsonReport(nodeCoveragePath, {
    generatedAt,
    ...nodeCoverage,
  });
  writeJsonReport(featureCoveragePath, {
    generatedAt,
    ...featureCoverage,
  });
  writeJsonReport(eventCoveragePath, {
    generatedAt,
    ...eventCoverage,
  });

  const totalChecks =
    (nodeCoverage.records ? nodeCoverage.records.length : 0) +
    (featureCoverage.records ? featureCoverage.records.length : 0) +
    (eventCoverage.records ? eventCoverage.records.length : 0);

  const totalFailures =
    (nodeCoverage.failures ? nodeCoverage.failures.length : 0) +
    (featureCoverage.failures ? featureCoverage.failures.length : 0) +
    (eventCoverage.failures ? eventCoverage.failures.length : 0);

  const lines = buildSummaryMarkdown({
    title: "LiteGraph Full Coverage Summary",
    generatedAt,
    totals: {
      total: totalChecks,
      passed: totalChecks - totalFailures,
      failed: totalFailures,
    },
    highlights: bundle.highlights || [],
    failures: [
      ...(nodeCoverage.failures || []),
      ...(featureCoverage.failures || []),
      ...(eventCoverage.failures || []),
    ],
  });

  writeMarkdownReport(summaryPath, lines);

  return {
    nodeCoveragePath,
    featureCoveragePath,
    eventCoveragePath,
    summaryPath,
  };
}

module.exports = {
  writeJsonReport,
  writeMarkdownReport,
  buildSummaryMarkdown,
  recordCoverageBundle,
};
