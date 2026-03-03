const isBunRuntime = typeof Bun !== "undefined";

if (!isBunRuntime) {
const path = require("path");
const { test, expect } = require("../fixtures/litegraph-harness.cjs");
const { diffGraphSnapshots } = require("../utils/graph-diff.cjs");
const { writeJsonReport } = require("../utils/coverage-recorder.cjs");
const {
  traverseContextMenuTree,
  closeAllContextMenus,
} = require("../utils/context-menu-traverser.cjs");

test.describe("recursive context menu traversal", () => {
  test("walks all reachable menu paths from canvas/node/slot/link", async ({ lgPage }) => {
    test.slow();

    await lgPage.createNodesByType([
      { type: "basic/const", title: "Menu Source", pos: [160, 180] },
      { type: "basic/watch", title: "Menu Watch", pos: [520, 180] },
    ]);

    const source = await lgPage.getNodeByTitle("Menu Source");
    const watch = await lgPage.getNodeByTitle("Menu Watch");

    await lgPage.connectSlots(source.id, 0, watch.id, 0);

    const baseline = await lgPage.snapshotRaw();
    const maxLeaves = Number(process.env.LG_MENU_MAX_LEAVES || 100);

    async function runTraversal(name, openRootMenu) {
      const records = [];
      await lgPage.clearRuntimeErrors();

      const result = await traverseContextMenuTree(lgPage.page, {
        openRootMenu,
        maxDepth: 8,
        maxLeaves,
        onLeaf: async ({ path }) => {
          const after = await lgPage.snapshotRaw();
          const diff = diffGraphSnapshots(baseline, after);
          records.push({
            path,
            changedPaths: diff.changedPaths.length,
            addedPaths: diff.addedPaths.length,
            removedPaths: diff.removedPaths.length,
            hasChange:
              diff.changedPaths.length > 0 ||
              diff.addedPaths.length > 0 ||
              diff.removedPaths.length > 0,
          });

          await lgPage.cleanupTransientUi();
          await lgPage.restoreGraph(baseline);
          await lgPage.clearRuntimeErrors();
        },
      });

      expect(result.leafPaths.length).toBeGreaterThan(0);
      expect(records.length).toBe(result.leafPaths.length);
      for (const record of records) {
        expect(record).toHaveProperty("hasChange");
      }

      return {
        name,
        records,
        leafCount: result.leafPaths.length,
        leafPaths: result.leafPaths,
      };
    }

    const summaries = [];

    summaries.push(
      await runTraversal("canvas", async () => {
        await lgPage.triggerContextMenu([220, 120], "canvas");
      })
    );

    summaries.push(
      await runTraversal("node", async () => {
        const regions = await lgPage.extractClickableRegions();
        const titleRegion = regions.find((region) => region.id === `node:${source.id}:title`);
        if (!titleRegion) {
          throw new Error("Node title region not found for node context traversal");
        }
        await lgPage.triggerContextMenu(titleRegion.centerScreen, "node");
      })
    );

    summaries.push(
      await runTraversal("slot", async () => {
        const slot = await lgPage.getSlotCoordinates(source.id, 0, false);
        await lgPage.triggerContextMenu({ x: slot.x, y: slot.y }, "slot");
      })
    );

    summaries.push(
      await runTraversal("link", async () => {
        const regions = await lgPage.extractClickableRegions();
        const linkRegion = regions.find((region) => region.kind === "link_center");
        if (!linkRegion) {
          throw new Error("Link center region not found for link context traversal");
        }
        await lgPage.triggerContextMenu(linkRegion.centerScreen, "link");
      })
    );

    await closeAllContextMenus(lgPage.page);
    await lgPage.cleanupTransientUi();
    await lgPage.clearRuntimeErrors();

    const totalLeafCount = summaries.reduce((sum, item) => sum + item.leafCount, 0);
    expect(totalLeafCount).toBeGreaterThan(0);

    const byName = summaries.reduce((acc, item) => {
      acc[item.name] = item;
      return acc;
    }, {});

    function containsToken(paths, token) {
      return paths.some((leafPath) => leafPath.some((segment) => segment === token));
    }

    const requiredTokens = [
      { scope: "canvas", token: "Add Node" },
      { scope: "node", token: "Mode" },
      { scope: "node", token: "Collapse" },
      { scope: "node", token: "Pin" },
      { scope: "node", token: "Clone" },
      { scope: "node", token: "Remove" },
    ];

    const requiredChecks = requiredTokens.map((item) => {
      const scopeSummary = byName[item.scope];
      const hit = !!scopeSummary && containsToken(scopeSummary.leafPaths || [], item.token);
      return {
        ...item,
        hit,
      };
    });

    for (const check of requiredChecks) {
      expect(check.hit, `Missing required context-menu token: ${check.scope}/${check.token}`).toBe(true);
    }

    const reportPath = path.resolve(process.cwd(), "tests/playwright/reports/context-menu-recursive-report.json");
    writeJsonReport(reportPath, {
      generatedAt: new Date().toISOString(),
      maxLeaves,
      totalLeafCount,
      summaries,
      requiredChecks,
    });
  });
});
}
