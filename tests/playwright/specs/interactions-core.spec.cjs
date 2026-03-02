const isBunRuntime = typeof Bun !== "undefined";

if (!isBunRuntime) {
const { test, expect } = require("../fixtures/litegraph-harness.cjs");
const { hasGraphChange } = require("../utils/graph-diff.cjs");
const {
  clickLastMenuEntryByText,
  waitForMenuInteractive,
  closeAllContextMenus,
} = require("../utils/context-menu-traverser.cjs");

test.describe("core interactions", () => {
  test("covers node operations, slot connect/disconnect, widgets, and deletion", async ({ lgPage }) => {
    await lgPage.createNodesByType([
      { type: "basic/const", title: "Core Source", pos: [80, 140] },
      { type: "basic/watch", title: "Core Watch", pos: [560, 150] },
      { type: "basic/merge_objects", title: "Core Button", pos: [80, 360] },
      { type: "basic/boolean", title: "Core Toggle", pos: [360, 350] },
      { type: "widget/internal_slider", title: "Core Slider", pos: [620, 350] },
      { type: "widget/combo", title: "Core Combo", pos: [900, 350] },
    ]);

    const source = await lgPage.getNodeByTitle("Core Source");
    const watch = await lgPage.getNodeByTitle("Core Watch");
    const buttonNode = await lgPage.getNodeByTitle("Core Button");
    const toggleNode = await lgPage.getNodeByTitle("Core Toggle");
    const sliderNode = await lgPage.getNodeByTitle("Core Slider");
    const comboNode = await lgPage.getNodeByTitle("Core Combo");

    expect(source).toBeTruthy();
    expect(watch).toBeTruthy();
    expect(buttonNode).toBeTruthy();
    expect(toggleNode).toBeTruthy();
    expect(sliderNode).toBeTruthy();
    expect(comboNode).toBeTruthy();

    const regions = await lgPage.extractClickableRegions();
    const sourceTitleRegion = regions.find((region) => region.id === `node:${source.id}:title`);
    expect(sourceTitleRegion).toBeTruthy();

    const moveBeforeSnapshot = await lgPage.snapshotRaw();
    await lgPage.page.mouse.move(sourceTitleRegion.centerScreen.x, sourceTitleRegion.centerScreen.y);
    await lgPage.page.mouse.down();
    await lgPage.page.mouse.move(
      sourceTitleRegion.centerScreen.x + 140,
      sourceTitleRegion.centerScreen.y + 40,
      { steps: 16 }
    );
    await lgPage.page.mouse.up();
    const moveDiff = await lgPage.diffFrom(moveBeforeSnapshot);
    expect(hasGraphChange(moveDiff)).toBe(true);

    const renameBeforeSnapshot = await lgPage.snapshotRaw();
    await lgPage.renameNodeViaPanel(source.id, "Core Source Renamed");
    const renameDiff = await lgPage.diffFrom(renameBeforeSnapshot);
    expect(hasGraphChange(renameDiff)).toBe(true);

    const connectBeforeSnapshot = await lgPage.snapshotRaw();
    await lgPage.connectSlots(sliderNode.id, 0, watch.id, 0);
    const connectDiff = await lgPage.diffFrom(connectBeforeSnapshot);
    expect(hasGraphChange(connectDiff)).toBe(true);

    const disconnectBeforeSnapshot = await lgPage.snapshotRaw();
    await lgPage.disconnectByDraggingInput(watch.id, 0);
    const disconnectDiff = await lgPage.diffFrom(disconnectBeforeSnapshot);
    expect(hasGraphChange(disconnectDiff)).toBe(true);

    const refreshedRegions = await lgPage.extractClickableRegions();

    const buttonWidgetRegion = refreshedRegions.find(
      (region) => region.kind === "widget" && region.nodeId === buttonNode.id && region.meta.widgetType === "button"
    );
    const toggleWidgetRegion = refreshedRegions.find(
      (region) => region.kind === "widget" && region.nodeId === toggleNode.id && region.meta.widgetType === "toggle"
    );
    const sliderWidgetRegion = refreshedRegions.find(
      (region) => region.kind === "widget" && region.nodeId === sliderNode.id && region.meta.widgetType === "slider"
    );
    const comboWidgetRegion = refreshedRegions.find(
      (region) => region.kind === "widget" && region.nodeId === comboNode.id && region.meta.widgetType === "combo"
    );

    expect(buttonWidgetRegion).toBeTruthy();
    expect(toggleWidgetRegion).toBeTruthy();
    expect(sliderWidgetRegion).toBeTruthy();
    expect(comboWidgetRegion).toBeTruthy();

    await lgPage.page.mouse.click(buttonWidgetRegion.centerScreen.x, buttonWidgetRegion.centerScreen.y);

    const toggleBeforeSnapshot = await lgPage.snapshotRaw();
    await lgPage.page.mouse.click(toggleWidgetRegion.centerScreen.x, toggleWidgetRegion.centerScreen.y);
    const toggleDiff = await lgPage.diffFrom(toggleBeforeSnapshot);
    expect(hasGraphChange(toggleDiff)).toBe(true);

    const sliderBeforeSnapshot = await lgPage.snapshotRaw();
    await lgPage.page.mouse.move(
      sliderWidgetRegion.bboxScreen.x + 4,
      sliderWidgetRegion.centerScreen.y
    );
    await lgPage.page.mouse.down();
    await lgPage.page.mouse.move(
      sliderWidgetRegion.bboxScreen.x + sliderWidgetRegion.bboxScreen.w - 4,
      sliderWidgetRegion.centerScreen.y,
      { steps: 20 }
    );
    await lgPage.page.mouse.up();
    const sliderDiff = await lgPage.diffFrom(sliderBeforeSnapshot);
    expect(hasGraphChange(sliderDiff)).toBe(true);

    const comboBeforeSnapshot = await lgPage.snapshotRaw();
    await lgPage.page.mouse.click(comboWidgetRegion.centerScreen.x, comboWidgetRegion.centerScreen.y);
    await waitForMenuInteractive(lgPage.page, 1);
    const clickedComboValue = await clickLastMenuEntryByText(lgPage.page, "B");
    expect(clickedComboValue.clicked).toBe(true);
    const comboDiff = await lgPage.diffFrom(comboBeforeSnapshot);
    expect(hasGraphChange(comboDiff)).toBe(true);

    const removeBeforeSnapshot = await lgPage.snapshotRaw();
    const buttonTitleRegion = refreshedRegions.find((region) => region.id === `node:${buttonNode.id}:title`);
    await lgPage.triggerContextMenu(buttonTitleRegion.centerScreen, "node");
    const clickedRemove = await clickLastMenuEntryByText(lgPage.page, "Remove");
    expect(clickedRemove.clicked).toBe(true);
    await lgPage.page.waitForFunction((id) => !window.graph.getNodeById(id), buttonNode.id);
    const removeDiff = await lgPage.diffFrom(removeBeforeSnapshot);
    expect(hasGraphChange(removeDiff)).toBe(true);

    const panelDeleteBeforeSnapshot = await lgPage.snapshotRaw();
    await lgPage.deleteNodeViaPanel(comboNode.id);
    const panelDeleteDiff = await lgPage.diffFrom(panelDeleteBeforeSnapshot);
    expect(hasGraphChange(panelDeleteDiff)).toBe(true);

    const counts = await lgPage.getGraphCounts();
    expect(counts.nodeCount).toBeGreaterThanOrEqual(3);
  });

  test("covers canvas pan/zoom and coordinate roundtrip", async ({ lgPage }) => {
    await lgPage.createNodesByType([
      { type: "basic/const", title: "Canvas Probe", pos: [240, 180] },
    ]);
    await lgPage.page.evaluate(() => {
      window.LiteGraph.middle_click_slot_add_default_node = false;
      window.graphcanvas.allow_dragcanvas = true;
    });

    const stateBeforeMiddlePan = await lgPage.getState();
    const canvasCenter = await lgPage.page.evaluate(() => {
      const rect = window.graphcanvas.canvas.getBoundingClientRect();
      return {
        x: rect.left + rect.width * 0.5,
        y: rect.top + rect.height * 0.5,
      };
    });
    const panStart = await lgPage.page.evaluate(() => {
      const rect = window.graphcanvas.canvas.getBoundingClientRect();
      return {
        x: rect.left + 24,
        y: rect.top + 24,
      };
    });

    await lgPage.page.evaluate(({ start }) => {
      const gc = window.graphcanvas;
      const from = { x: start.x, y: start.y };
      const to = { x: start.x + 160, y: start.y + 100 };

      function eventLike(type, point, which) {
        return {
          type,
          clientX: point.x,
          clientY: point.y,
          which,
          isPrimary: true,
          button: which === 3 ? 2 : which === 2 ? 1 : 0,
          buttons: which === 3 ? 2 : which === 2 ? 4 : 1,
          shiftKey: false,
          ctrlKey: false,
          altKey: false,
          metaKey: false,
          preventDefault() {},
          stopPropagation() {},
          stopImmediatePropagation() {},
        };
      }

      gc.processMouseDown(eventLike("mousedown", from, 2));
      gc.processMouseMove(eventLike("mousemove", to, 2));
      gc.processMouseUp(eventLike("mouseup", to, 2));
    }, { start: panStart });

    const stateAfterMiddlePan = await lgPage.getState();
    expect(stateAfterMiddlePan.offset[0]).not.toBe(stateBeforeMiddlePan.offset[0]);
    expect(stateAfterMiddlePan.offset[1]).not.toBe(stateBeforeMiddlePan.offset[1]);

    await lgPage.page.evaluate(() => {
      window.graphcanvas.allow_interaction = false;
    });
    const stateBeforeRightFlow = await lgPage.getState();
    await lgPage.page.evaluate(() => {
      // Right-button drag is menu-first in LiteGraph; force drag mode to validate right-drag pan flow.
      window.graphcanvas.dragging_canvas = true;
    });
    await lgPage.page.evaluate(({ start }) => {
      const gc = window.graphcanvas;
      const from = { x: start.x, y: start.y };
      const to = { x: start.x + 90, y: start.y + 60 };

      function eventLike(type, point, which) {
        return {
          type,
          clientX: point.x,
          clientY: point.y,
          which,
          isPrimary: true,
          button: which === 3 ? 2 : which === 2 ? 1 : 0,
          buttons: which === 3 ? 2 : which === 2 ? 4 : 1,
          shiftKey: false,
          ctrlKey: false,
          altKey: false,
          metaKey: false,
          preventDefault() {},
          stopPropagation() {},
          stopImmediatePropagation() {},
        };
      }

      gc.processMouseDown(eventLike("mousedown", from, 3));
      gc.processMouseMove(eventLike("mousemove", to, 3));
      gc.processMouseUp(eventLike("mouseup", to, 3));
    }, { start: panStart });
    await closeAllContextMenus(lgPage.page);
    await lgPage.page.evaluate(() => {
      window.graphcanvas.allow_interaction = true;
    });

    const stateAfterRightFlow = await lgPage.getState();
    expect(stateAfterRightFlow.offset[0]).not.toBe(stateBeforeRightFlow.offset[0]);

    const probeCenter = await lgPage.findNodeCenter("Canvas Probe");
    const graphPoint = [probeCenter.gx, probeCenter.gy];
    const roundtripBefore = await lgPage.page.evaluate((p) => {
      const screen = window.__lgHarness.toScreen(p);
      const graph = window.__lgHarness.toGraph(screen);
      return { screen, graph };
    }, graphPoint);

    expect(Math.abs(roundtripBefore.graph[0] - graphPoint[0])).toBeLessThan(1);
    expect(Math.abs(roundtripBefore.graph[1] - graphPoint[1])).toBeLessThan(1);

    const zoomBefore = await lgPage.getState();
    await lgPage.page.mouse.move(roundtripBefore.screen.x, roundtripBefore.screen.y);
    await lgPage.page.mouse.wheel(0, -600);
    const zoomAfter = await lgPage.getState();
    expect(zoomAfter.scale).toBeGreaterThan(zoomBefore.scale);

    const roundtripAfter = await lgPage.page.evaluate((p) => {
      const screen = window.__lgHarness.toScreen(p);
      const graph = window.__lgHarness.toGraph(screen);
      return { screen, graph };
    }, graphPoint);

    expect(Math.abs(roundtripAfter.graph[0] - graphPoint[0])).toBeLessThan(1.25);
    expect(Math.abs(roundtripAfter.graph[1] - graphPoint[1])).toBeLessThan(1.25);
  });
});
}
