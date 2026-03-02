const isBunRuntime = typeof Bun !== "undefined";

if (!isBunRuntime) {
const { test, expect } = require("../fixtures/litegraph-harness.cjs");
const { diffGraphSnapshots } = require("../utils/graph-diff.cjs");
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
    const maxLeaves = Number(process.env.LG_MENU_MAX_LEAVES || Number.POSITIVE_INFINITY);

    async function runTraversal(name, openRootMenu) {
      const records = [];

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

    const totalLeafCount = summaries.reduce((sum, item) => sum + item.leafCount, 0);
    expect(totalLeafCount).toBeGreaterThan(0);
  });
});
}
