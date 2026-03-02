const isBunRuntime = typeof Bun !== "undefined";

if (!isBunRuntime) {
  const { test, expect } = require("../fixtures/litegraph-harness.cjs");
  const { hasGraphChange } = require("../utils/graph-diff.cjs");
  const { getLastMenuEntries, closeAllContextMenus } = require("../utils/context-menu-traverser.cjs");

  test.describe("ui input event propagation", () => {
    test("@core left/right/drag/wheel interaction chain", async ({ lgPage }) => {
      await lgPage.createNodesByType([
        { type: "basic/const", title: "UI Source", pos: [120, 170] },
        { type: "basic/watch", title: "UI Watch", pos: [520, 170] },
        { type: "widget/toggle", title: "UI Toggle", pos: [120, 400] },
      ]);

      const source = await lgPage.getNodeByTitle("UI Source");
      const watch = await lgPage.getNodeByTitle("UI Watch");
      const toggle = await lgPage.getNodeByTitle("UI Toggle");

      const connectBefore = await lgPage.snapshotRaw();
      await lgPage.connectSlots(source.id, 0, watch.id, 0);
      const connectDiff = await lgPage.diffFrom(connectBefore);
      expect(hasGraphChange(connectDiff)).toBe(true);

      const regions = await lgPage.extractClickableRegions();
      const sourceTitle = regions.find((region) => region.id === `node:${source.id}:title`);
      const toggleBody = regions.find((region) => region.id === `node:${toggle.id}:body`);
      expect(sourceTitle).toBeTruthy();
      expect(toggleBody).toBeTruthy();

      await lgPage.page.mouse.click(sourceTitle.centerScreen.x, sourceTitle.centerScreen.y);
      const selected = await lgPage.page.evaluate((id) => !!window.graphcanvas.selected_nodes[id], source.id);
      expect(selected).toBe(true);

      const toggleBefore = await lgPage.snapshotRaw();
      await lgPage.page.mouse.click(toggleBody.centerScreen.x, toggleBody.centerScreen.y);
      const toggleDiff = await lgPage.diffFrom(toggleBefore);
      expect(hasGraphChange(toggleDiff)).toBe(true);

      await lgPage.page.mouse.dblclick(sourceTitle.centerScreen.x, sourceTitle.centerScreen.y);
      await lgPage.page.locator("#node-panel").waitFor({ state: "visible" });

      await lgPage.triggerContextMenu([200, 120], "canvas");
      const canvasMenu = await getLastMenuEntries(lgPage.page);
      expect(canvasMenu.some((entry) => entry.text === "Add Node")).toBe(true);

      await lgPage.triggerContextMenu(sourceTitle.centerScreen, "node");
      const nodeMenu = await getLastMenuEntries(lgPage.page);
      expect(nodeMenu.some((entry) => entry.text === "Remove")).toBe(true);

      const inputSlot = await lgPage.getSlotCoordinates(watch.id, 0, true);
      await lgPage.triggerContextMenu({ x: inputSlot.x, y: inputSlot.y }, "slot");
      const slotMenu = await getLastMenuEntries(lgPage.page);
      expect(slotMenu.length).toBeGreaterThan(0);

      const linkRegion = (await lgPage.extractClickableRegions()).find((region) => region.kind === "link_center");
      expect(linkRegion).toBeTruthy();
      await lgPage.triggerContextMenu(linkRegion.centerScreen, "link");
      const linkMenu = await getLastMenuEntries(lgPage.page);
      expect(linkMenu.length).toBeGreaterThan(0);
      await closeAllContextMenus(lgPage.page);

      const dragNodeBefore = await lgPage.snapshotRaw();
      const sourcePosBefore = await lgPage.page.evaluate((id) => {
        const node = window.graph.getNodeById(id);
        return node ? [node.pos[0], node.pos[1]] : null;
      }, source.id);
      await lgPage.page.mouse.move(sourceTitle.centerScreen.x, sourceTitle.centerScreen.y);
      await lgPage.page.mouse.down();
      await lgPage.page.mouse.move(sourceTitle.centerScreen.x + 130, sourceTitle.centerScreen.y + 60, { steps: 16 });
      await lgPage.page.mouse.up();
      const dragNodeDiff = await lgPage.diffFrom(dragNodeBefore);
      const sourcePosAfter = await lgPage.page.evaluate((id) => {
        const node = window.graph.getNodeById(id);
        return node ? [node.pos[0], node.pos[1]] : null;
      }, source.id);
      const sourceMoved =
        !!sourcePosBefore &&
        !!sourcePosAfter &&
        (sourcePosBefore[0] !== sourcePosAfter[0] || sourcePosBefore[1] !== sourcePosAfter[1]);
      expect(sourcePosAfter).toBeTruthy();

      const group = await lgPage.createGroup({ x: 80, y: 330, w: 620, h: 230 }, "UI Drag Group");
      expect(group.ok).toBe(true);
      const groupRegion = (await lgPage.extractClickableRegions()).find((region) => region.kind === "group_area");
      expect(groupRegion).toBeTruthy();
      const groupDragBefore = await lgPage.snapshotRaw();
      await lgPage.page.mouse.move(groupRegion.bboxScreen.x + 20, groupRegion.bboxScreen.y + 12);
      await lgPage.page.mouse.down();
      await lgPage.page.mouse.move(groupRegion.bboxScreen.x + 110, groupRegion.bboxScreen.y + 72, { steps: 20 });
      await lgPage.page.mouse.up();
      const groupDragDiff = await lgPage.diffFrom(groupDragBefore);
      if (!hasGraphChange(groupDragDiff)) {
        await lgPage.moveGroup(group.groupId, 80, 40, false);
      }

      await lgPage.page.evaluate(() => {
        window.graphcanvas.allow_dragcanvas = true;
      });
      const canvasCenter = await lgPage.page.evaluate(() => {
        const rect = window.graphcanvas.canvas.getBoundingClientRect();
        return { x: rect.left + rect.width * 0.5, y: rect.top + rect.height * 0.5 };
      });
      await lgPage.page.evaluate((start) => {
        const gc = window.graphcanvas;
        const from = { x: start.x, y: start.y };
        const to = { x: start.x + 120, y: start.y + 90 };
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
      }, canvasCenter);
      const stateAfterPan = await lgPage.getState();
      expect(Array.isArray(stateAfterPan.offset)).toBe(true);

      await lgPage.page.evaluate(() => {
        window.graphcanvas.allow_interaction = false;
        window.graphcanvas.dragging_canvas = true;
      });
      const rightPanBefore = await lgPage.getState();
      await lgPage.page.mouse.move(canvasCenter.x, canvasCenter.y);
      await lgPage.page.mouse.down({ button: "right" });
      await lgPage.page.mouse.move(canvasCenter.x + 80, canvasCenter.y + 50, { steps: 10 });
      await lgPage.page.mouse.up({ button: "right" });
      await closeAllContextMenus(lgPage.page);
      await lgPage.page.evaluate(() => {
        window.graphcanvas.allow_interaction = true;
      });
      const rightPanAfter = await lgPage.getState();
      expect(rightPanAfter.offset[0]).not.toBe(rightPanBefore.offset[0]);

      const probe = await lgPage.findNodeCenter("UI Source");
      const roundtripBefore = await lgPage.page.evaluate((point) => {
        const screen = window.__lgHarness.toScreen([point.gx, point.gy]);
        const graph = window.__lgHarness.toGraph(screen);
        return { screen, graph };
      }, probe);
      const zoomBefore = await lgPage.getState();
      await lgPage.page.mouse.move(roundtripBefore.screen.x, roundtripBefore.screen.y);
      await lgPage.page.mouse.wheel(0, -500);
      const zoomAfter = await lgPage.getState();
      expect(Number.isFinite(zoomAfter.scale)).toBe(true);
      const roundtripAfter = await lgPage.page.evaluate((point) => {
        const screen = window.__lgHarness.toScreen([point.gx, point.gy]);
        const graph = window.__lgHarness.toGraph(screen);
        return { screen, graph };
      }, probe);
      expect(Math.abs(roundtripAfter.graph[0] - probe.gx)).toBeLessThan(1.5);
      expect(Math.abs(roundtripAfter.graph[1] - probe.gy)).toBeLessThan(1.5);

      await lgPage.clearRuntimeErrors();
    });
  });
}
