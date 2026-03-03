const isBunRuntime = typeof Bun !== "undefined";

if (!isBunRuntime) {
  const { test, expect } = require("../fixtures/litegraph-harness.cjs");
  const {
    clickLastMenuEntryByText,
    waitForMenuInteractive,
    closeAllContextMenus,
  } = require("../utils/context-menu-traverser.cjs");

  async function clickNodeMenuPath(lgPage, nodeId, path) {
    const regions = await lgPage.extractClickableRegions();
    const titleRegion = regions.find((region) => region.id === `node:${nodeId}:title`);
    if (!titleRegion) {
      throw new Error(`Node title region not found for node ${nodeId}`);
    }

    await lgPage.triggerContextMenu(titleRegion.centerScreen, "node");

    let expectedMenus = 1;
    for (let i = 0; i < path.length; i += 1) {
      const segment = path[i];
      const clicked = await clickLastMenuEntryByText(lgPage.page, segment);
      expect(clicked.clicked).toBe(true);
      if (clicked.hasSubmenu) {
        expectedMenus += 1;
        await waitForMenuInteractive(lgPage.page, expectedMenus);
      } else {
        await lgPage.page.waitForTimeout(80);
      }
    }

    await closeAllContextMenus(lgPage.page);
  }

  test.describe("node advanced menu and subgraph", () => {
    test("@core node menu collapse/pin/colors/shapes", async ({ lgPage }) => {
      await lgPage.createNodesByType([
        { type: "basic/watch", title: "Menu Advanced", pos: [260, 220] },
      ]);

      const node = await lgPage.getNodeByTitle("Menu Advanced");
      expect(node).toBeTruthy();

      const flagsBefore = await lgPage.getNodeFlags(node.id);
      expect(!!flagsBefore.collapsed).toBe(false);
      expect(!!flagsBefore.pinned).toBe(false);

      await clickNodeMenuPath(lgPage, node.id, ["Collapse"]);
      const flagsCollapsed = await lgPage.getNodeFlags(node.id);
      expect(!!flagsCollapsed.collapsed).toBe(true);

      await clickNodeMenuPath(lgPage, node.id, ["Collapse"]);
      const flagsExpanded = await lgPage.getNodeFlags(node.id);
      expect(!!flagsExpanded.collapsed).toBe(false);

      await clickNodeMenuPath(lgPage, node.id, ["Pin"]);
      const flagsPinned = await lgPage.getNodeFlags(node.id);
      expect(!!flagsPinned.pinned).toBe(true);

      await clickNodeMenuPath(lgPage, node.id, ["Pin"]);
      const flagsUnpinned = await lgPage.getNodeFlags(node.id);
      expect(!!flagsUnpinned.pinned).toBe(false);

      const styleBefore = await lgPage.getNodeStyle(node.id);
      await clickNodeMenuPath(lgPage, node.id, ["Colors", "red"]);
      const styleAfterColor = await lgPage.getNodeStyle(node.id);
      expect(styleAfterColor.color).not.toBe(styleBefore.color);
      expect(styleAfterColor.bgcolor).not.toBe(styleBefore.bgcolor);

      await clickNodeMenuPath(lgPage, node.id, ["Shapes", "round"]);
      const styleAfterShape = await lgPage.getNodeStyle(node.id);
      expect(styleAfterShape.shape).not.toBe(styleBefore.shape);

      await lgPage.clearRuntimeErrors();
    });

    test("@core node clone and remove consistency", async ({ lgPage }) => {
      await lgPage.createNodesByType([
        { type: "basic/const", title: "Clone Source", pos: [220, 210] },
      ]);

      const source = await lgPage.getNodeByTitle("Clone Source");
      expect(source).toBeTruthy();

      const countsBeforeClone = await lgPage.getGraphCounts();
      const cloneResult = await lgPage.cloneNodeByMenu(source.id);
      expect(cloneResult.ok).toBe(true);
      expect(cloneResult.createdNodeIds.length).toBeGreaterThan(0);

      const countsAfterClone = await lgPage.getGraphCounts();
      expect(countsAfterClone.nodeCount).toBe(countsBeforeClone.nodeCount + cloneResult.createdNodeIds.length);

      const clonedNode = await lgPage.page.evaluate((id) => {
        const node = window.graph.getNodeById(id);
        return node ? { id: node.id, type: node.type } : null;
      }, cloneResult.createdNodeIds[0]);
      expect(clonedNode).toBeTruthy();
      expect(clonedNode.type).toBe(source.type);

      const removeResult = await lgPage.toggleNodeMenuOption(clonedNode.id, "Remove");
      expect(removeResult.ok).toBe(true);

      await lgPage.page.waitForFunction((id) => !window.graph.getNodeById(id), clonedNode.id);
      const countsAfterRemove = await lgPage.getGraphCounts();
      expect(countsAfterRemove.nodeCount).toBe(countsAfterClone.nodeCount - 1);

      await lgPage.clearRuntimeErrors();
    });

    test("@core to-subgraph and open-close subgraph", async ({ lgPage }) => {
      await lgPage.createNodesByType([
        { type: "basic/const", title: "Sub Source", pos: [120, 200] },
        { type: "basic/watch", title: "Sub Watch", pos: [480, 200] },
      ]);

      const source = await lgPage.getNodeByTitle("Sub Source");
      const watch = await lgPage.getNodeByTitle("Sub Watch");
      await lgPage.connectSlots(source.id, 0, watch.id, 0);

      const convert = await lgPage.toggleNodeMenuOption(source.id, "To Subgraph");
      expect(convert.ok).toBe(true);

      const subgraphNode = await lgPage.page.evaluate(() => {
        const matches = (window.graph._nodes || []).filter((node) => node.type === "graph/subgraph");
        if (!matches.length) {
          return null;
        }
        const node = matches[matches.length - 1];
        return { id: node.id, type: node.type };
      });
      expect(subgraphNode).toBeTruthy();

      const depthBefore = await lgPage.getCurrentGraphDepth();
      expect(depthBefore).toBe(0);

      const opened = await lgPage.openSubgraph(subgraphNode.id);
      expect(opened.ok).toBe(true);
      const depthInSubgraph = await lgPage.getCurrentGraphDepth();
      expect(depthInSubgraph).toBeGreaterThan(0);

      const closed = await lgPage.closeSubgraph();
      expect(closed.ok).toBe(true);
      const depthAfterClose = await lgPage.getCurrentGraphDepth();
      expect(depthAfterClose).toBe(0);

      await lgPage.clearRuntimeErrors();
    });

    test("@core subgraph io panels basic operations", async ({ lgPage }) => {
      const created = await lgPage.createNodeByType("graph/subgraph", [220, 180], "Subgraph IO");
      expect(created.created).toBe(true);

      const opened = await lgPage.openSubgraph(created.nodeId);
      expect(opened.ok).toBe(true);

      await lgPage.page.evaluate(() => {
        const parentNode = window.graphcanvas.graph._subgraph_node;
        window.graphcanvas.showSubgraphPropertiesDialog(parentNode);
      });
      await expect(lgPage.page.locator(".dialog").filter({ hasText: "Subgraph Inputs" }).first()).toBeVisible();

      await lgPage.page.evaluate(() => {
        const parentNode = window.graphcanvas.graph._subgraph_node;
        window.graphcanvas.showSubgraphPropertiesDialogRight(parentNode);
      });
      await expect(lgPage.page.locator(".dialog").filter({ hasText: "Subgraph Outputs" }).first()).toBeVisible();

      const ioState = await lgPage.page.evaluate(() => {
        const sg = window.graphcanvas.graph;
        const parent = sg._subgraph_node;

        const names = () => ({
          inputs: (parent.inputs || []).map((slot) => slot.name),
          outputs: (parent.outputs || []).map((slot) => slot.name),
        });

        sg.addInput("alpha", "number");
        sg.addOutput("omega", "number");
        const afterAdd = names();

        sg.renameInput("alpha", "alpha2");
        sg.renameOutput("omega", "omega2");
        const afterRename = names();

        sg.removeInput("alpha2");
        sg.removeOutput("omega2");
        const afterRemove = names();

        return { afterAdd, afterRename, afterRemove };
      });

      expect(ioState.afterAdd.inputs).toContain("alpha");
      expect(ioState.afterAdd.outputs).toContain("omega");
      expect(ioState.afterRename.inputs).toContain("alpha2");
      expect(ioState.afterRename.outputs).toContain("omega2");
      expect(ioState.afterRemove.inputs).not.toContain("alpha2");
      expect(ioState.afterRemove.outputs).not.toContain("omega2");

      const closed = await lgPage.closeSubgraph();
      expect(closed.ok).toBe(true);
      expect(await lgPage.getCurrentGraphDepth()).toBe(0);

      await lgPage.cleanupTransientUi();
      await lgPage.clearRuntimeErrors();
    });
  });
}
