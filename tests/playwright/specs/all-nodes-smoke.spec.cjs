const path = require("path");

const isBunRuntime = typeof Bun !== "undefined";

if (!isBunRuntime) {
  const { test, expect } = require("../fixtures/litegraph-harness.cjs");
  const manifest = require("../data/static-node-manifest.cjs");
  const { summarizeNodeCoverage } = require("../utils/node-invoker.cjs");
  const { writeJsonReport } = require("../utils/coverage-recorder.cjs");

  const coverageRecords = [];

  function getNodePos(index) {
    const col = index % 5;
    const row = Math.floor(index / 5) % 4;
    return [80 + col * 220, 120 + row * 170];
  }

  async function resetGraph(lgPage) {
    await lgPage.page.evaluate(() => {
      window.graph.stop();
      window.graph.clear();
      window.graphcanvas.setDirty(true, true);
      window.graphcanvas.draw(true, true);
    });
    await lgPage.clearRuntimeErrors();
    await lgPage.clearExecutionTrace();
  }

  test.describe.serial("all static nodes smoke", () => {
    test("@core static inventory contains 207 nodes", async ({ lgPage }) => {
      const runtimeManifest = await lgPage.getStaticNodeManifest();
      expect(runtimeManifest.count).toBe(manifest.count);
      expect(runtimeManifest.expectedCount).toBe(207);
      expect(runtimeManifest.count).toBe(runtimeManifest.expectedCount);
    });

    const families = Object.keys(manifest.categories).sort((a, b) => a.localeCompare(b));
    for (const family of families) {
      const familyTag = family === "(root)" ? "root" : family;
      const familyTypes = manifest.nodeTypes.filter((item) => item.family === family);

      test(`@core @family:${familyTag} smoke invoke static nodes in family ${family}`, async ({ lgPage }) => {
        test.slow();
        await lgPage.page.evaluate(() => {
          window.LiteGraph.catch_exceptions = true;
        });

        for (let i = 0; i < familyTypes.length; i += 1) {
          const item = familyTypes[i];
          await resetGraph(lgPage);

          const record = {
            type: item.type,
            family: item.family,
            created: false,
            nodeId: null,
            invokedExecute: false,
            invokedAction: false,
            modeResults: {},
            diffPaths: [],
            errors: [],
          };

          const created = await lgPage.createNodeByType(item.type, getNodePos(i), `Smoke ${item.type}`);
          if (created.created && created.nodeId != null) {
            record.created = true;
            record.nodeId = created.nodeId;

            const before = await lgPage.snapshotRaw();
            const invoked = await lgPage.invokeNode(created.nodeId, "auto");
            const diff = await lgPage.diffFrom(before);

            record.invokedExecute = !!invoked.invokedExecute;
            record.invokedAction = !!invoked.invokedAction;
            record.diffPaths = [
              ...diff.changedPaths,
              ...diff.addedPaths,
              ...diff.removedPaths,
            ];

            const modeLabels = ["Always", "On Event", "Never", "On Trigger"];
            for (const modeLabel of modeLabels) {
              const modeResult = await lgPage.setNodeMode(created.nodeId, modeLabel);
              record.modeResults[modeLabel] = !!modeResult.ok;
            }
          } else {
            record.errors.push(created.reason || "create failed");
          }

          const runtimeErrors = await lgPage.getRuntimeErrors();
          if (runtimeErrors.length) {
            record.errors.push(...runtimeErrors.map((entry) => `${entry.source}: ${entry.message}`));
          }
          await lgPage.clearRuntimeErrors();

          if (record.nodeId != null) {
            await lgPage.page.evaluate((id) => {
              const node = window.graph.getNodeById(id);
              if (node) {
                window.graph.remove(node);
              }
              window.graphcanvas.setDirty(true, true);
              window.graphcanvas.draw(true, true);
            }, record.nodeId);
          }

          coverageRecords.push(record);
        }

        await lgPage.clearRuntimeErrors();
      });
    }

    test("@core write static node coverage report", async ({ lgPage }) => {
      const summary = summarizeNodeCoverage(coverageRecords);
      const failures = coverageRecords
        .filter((entry) => !entry.created)
        .map((entry) => `${entry.type}: ${entry.errors.join(" | ") || "create failed"}`);

      const reportPath = path.resolve(process.cwd(), "tests/playwright/reports/node-coverage.json");
      writeJsonReport(reportPath, {
        generatedAt: new Date().toISOString(),
        expectedCount: manifest.expectedCount,
        staticCount: manifest.count,
        summary,
        records: coverageRecords,
        failures,
      });

      expect(coverageRecords.length).toBe(manifest.count);
      expect(manifest.count).toBe(manifest.expectedCount);
      expect(summary.createdCount + failures.length).toBe(manifest.expectedCount);
      await lgPage.clearRuntimeErrors();
    });
  });
}
