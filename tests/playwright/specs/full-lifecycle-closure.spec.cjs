const isBunRuntime = typeof Bun !== "undefined";

if (!isBunRuntime) {
const { test, expect } = require("../fixtures/litegraph-harness.cjs");
const { hasGraphChange } = require("../utils/graph-diff.cjs");
const { clickLastMenuEntryByText } = require("../utils/context-menu-traverser.cjs");

test.describe("full lifecycle closure", () => {
  test("create nodes from canvas menu, edit widget, connect, and delete by UI menu", async ({ lgPage }) => {
    await lgPage.createNodesByType([]);

    async function captureLastNodeWithTitle(title) {
      const lastNode = await lgPage.page.evaluate(() => {
        const node = window.graph._nodes[window.graph._nodes.length - 1];
        if (!node) {
          return null;
        }
        return { id: node.id, type: node.type, title: node.title };
      });
      if (!lastNode) {
        throw new Error("No node created");
      }
      await lgPage.page.evaluate(
        ({ id, nextTitle }) => {
          const node = window.graph.getNodeById(id);
          node.title = nextTitle;
          window.graphcanvas.setDirty(true, true);
          window.graphcanvas.draw(true, true);
        },
        { id: lastNode.id, nextTitle: title }
      );
      return { ...lastNode, title };
    }

    const addConstBefore = await lgPage.snapshotRaw();
    await lgPage.addNodeByMenuPath(["Add Node", "basic", "Const Number"], [140, 130]);
    const constNode = await captureLastNodeWithTitle("Lifecycle Number");
    const addConstDiff = await lgPage.diffFrom(addConstBefore);
    expect(hasGraphChange(addConstDiff)).toBe(true);

    const addSliderBefore = await lgPage.snapshotRaw();
    await lgPage.addNodeByMenuPath(["Add Node", "widget", "Inner Slider"], [430, 130]);
    const sliderNode = await captureLastNodeWithTitle("Lifecycle Slider");
    const addSliderDiff = await lgPage.diffFrom(addSliderBefore);
    expect(hasGraphChange(addSliderDiff)).toBe(true);

    const addWatchBefore = await lgPage.snapshotRaw();
    await lgPage.addNodeByMenuPath(["Add Node", "basic", "Watch"], [760, 130]);
    const watchNode = await captureLastNodeWithTitle("Lifecycle Watch");
    const addWatchDiff = await lgPage.diffFrom(addWatchBefore);
    expect(hasGraphChange(addWatchDiff)).toBe(true);

    const regions = await lgPage.extractClickableRegions();
    const sliderWidgetRegion = regions.find(
      (region) => region.kind === "widget" && region.nodeId === sliderNode.id && region.meta.widgetType === "slider"
    );
    expect(sliderWidgetRegion).toBeTruthy();

    const sliderEditBefore = await lgPage.snapshotRaw();
    await lgPage.page.mouse.move(sliderWidgetRegion.bboxScreen.x + 8, sliderWidgetRegion.centerScreen.y);
    await lgPage.page.mouse.down();
    await lgPage.page.mouse.move(
      sliderWidgetRegion.bboxScreen.x + sliderWidgetRegion.bboxScreen.w - 8,
      sliderWidgetRegion.centerScreen.y,
      { steps: 20 }
    );
    await lgPage.page.mouse.up();
    const sliderEditDiff = await lgPage.diffFrom(sliderEditBefore);
    expect(hasGraphChange(sliderEditDiff)).toBe(true);

    const connectBefore = await lgPage.snapshotRaw();
    await lgPage.connectSlots(sliderNode.id, 0, watchNode.id, 0);
    const connectDiff = await lgPage.diffFrom(connectBefore);
    expect(hasGraphChange(connectDiff)).toBe(true);

    const deleteBefore = await lgPage.snapshotRaw();
    const latestRegions = await lgPage.extractClickableRegions();
    const constTitleRegion = latestRegions.find((region) => region.id === `node:${constNode.id}:title`);
    expect(constTitleRegion).toBeTruthy();

    await lgPage.triggerContextMenu(constTitleRegion.centerScreen, "node");
    const removed = await clickLastMenuEntryByText(lgPage.page, "Remove");
    expect(removed.clicked).toBe(true);
    await lgPage.page.waitForFunction((id) => !window.graph.getNodeById(id), constNode.id);

    const deleteDiff = await lgPage.diffFrom(deleteBefore);
    expect(hasGraphChange(deleteDiff)).toBe(true);

    const finalCounts = await lgPage.getGraphCounts();
    expect(finalCounts.nodeCount).toBe(2);
    expect(finalCounts.linkCount).toBe(1);
  });
});
}
