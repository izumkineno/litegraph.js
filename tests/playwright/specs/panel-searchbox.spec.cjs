const isBunRuntime = typeof Bun !== "undefined";

if (!isBunRuntime) {
  const { test, expect } = require("../fixtures/litegraph-harness.cjs");
  const { hasGraphChange } = require("../utils/graph-diff.cjs");

  test.describe("panel and searchbox", () => {
    test("@core panel edit/delete and searchbox create paths", async ({ lgPage }) => {
      await lgPage.createNodesByType([]);

      const addBySearchBefore = await lgPage.snapshotRaw();
      await lgPage.openSearchBox([160, 140], {
        show_all_on_open: true,
        do_type_filter: false,
      });
      const searchResults = await lgPage.getSearchBoxResults();
      expect(searchResults.some((item) => item.toLowerCase() === "basic/const")).toBe(true);

      const selectedConst = await lgPage.selectSearchResult("basic/const");
      expect(selectedConst.selected).toBe(true);
      const addBySearchDiff = await lgPage.diffFrom(addBySearchBefore);
      expect(hasGraphChange(addBySearchDiff)).toBe(true);

      const createdConst = await lgPage.page.evaluate((nodeId) => {
        const node = window.graph.getNodeById(nodeId);
        if (!node) {
          return null;
        }
        node.title = "Search Const";
        window.graphcanvas.setDirty(true, true);
        window.graphcanvas.draw(true, true);
        return { id: node.id, type: node.type, title: node.title };
      }, selectedConst.createdNodeId);
      expect(createdConst).toBeTruthy();

      const renameBefore = await lgPage.snapshotRaw();
      await lgPage.renameNodeViaPanel(createdConst.id, "Search Const Renamed");
      const renameDiff = await lgPage.diffFrom(renameBefore);
      expect(hasGraphChange(renameDiff)).toBe(true);

      const openNodePanel = await lgPage.openNodePanelById(createdConst.id);
      expect(openNodePanel.ok).toBe(true);
      await lgPage.page.locator("#node-panel").waitFor({ state: "visible" });

      const watchCreate = await lgPage.createNodeByType("basic/watch", [520, 180], "Search Watch");
      expect(watchCreate.created).toBe(true);

      const watchInput = await lgPage.getSlotCoordinates(watchCreate.nodeId, 0, true);
      const typeFilterBefore = await lgPage.snapshotRaw();
      await lgPage.openSearchBox({ x: watchInput.x, y: watchInput.y }, {
        show_all_on_open: true,
        do_type_filter: true,
        type_filter_out: "number",
      });
      await lgPage.page.locator(".litesearchbox input").fill("const");
      await lgPage.page.waitForTimeout(350);
      const filteredResults = await lgPage.getSearchBoxResults();
      expect(filteredResults.some((item) => item.toLowerCase().includes("const"))).toBe(true);
      const selectedFiltered = await lgPage.selectSearchResult("basic/const", false);
      expect(selectedFiltered.selected).toBe(true);
      const typeFilterDiff = await lgPage.diffFrom(typeFilterBefore);
      expect(hasGraphChange(typeFilterDiff)).toBe(true);

      const panelDeleteBefore = await lgPage.snapshotRaw();
      await lgPage.deleteNodeViaPanel(createdConst.id);
      const panelDeleteDiff = await lgPage.diffFrom(panelDeleteBefore);
      expect(hasGraphChange(panelDeleteDiff)).toBe(true);

      await lgPage.cleanupTransientUi();
      await lgPage.clearRuntimeErrors();
    });
  });
}
