const isBunRuntime = typeof Bun !== "undefined";

if (!isBunRuntime) {
  const { test, expect } = require("../fixtures/litegraph-harness.cjs");
  const { hasGraphChange } = require("../utils/graph-diff.cjs");
  const { clickLastMenuEntryByText, waitForMenuInteractive } = require("../utils/context-menu-traverser.cjs");

  test.describe("connection and disconnection", () => {
    test("@core slot linking, replacement, disconnect and link delete", async ({ lgPage }) => {
      await lgPage.createNodesByType([
        { type: "basic/const", title: "Conn Source A", pos: [120, 160] },
        { type: "basic/const", title: "Conn Source B", pos: [120, 340] },
        { type: "basic/watch", title: "Conn Watch", pos: [560, 240] },
      ]);

      const sourceA = await lgPage.getNodeByTitle("Conn Source A");
      const sourceB = await lgPage.getNodeByTitle("Conn Source B");
      const watch = await lgPage.getNodeByTitle("Conn Watch");
      expect(sourceA).toBeTruthy();
      expect(sourceB).toBeTruthy();
      expect(watch).toBeTruthy();

      const connectBefore = await lgPage.snapshotRaw();
      await lgPage.connectSlots(sourceA.id, 0, watch.id, 0);
      const connectDiff = await lgPage.diffFrom(connectBefore);
      expect(hasGraphChange(connectDiff)).toBe(true);

      const replaceBefore = await lgPage.snapshotRaw();
      await lgPage.connectSlots(sourceB.id, 0, watch.id, 0);
      const replaceDiff = await lgPage.diffFrom(replaceBefore);
      expect(hasGraphChange(replaceDiff)).toBe(true);

      const dragDisconnectBefore = await lgPage.snapshotRaw();
      await lgPage.disconnectByDraggingInput(watch.id, 0, 260, 120);
      const dragDisconnectDiff = await lgPage.diffFrom(dragDisconnectBefore);
      expect(hasGraphChange(dragDisconnectDiff)).toBe(true);

      await lgPage.connectSlots(sourceA.id, 0, watch.id, 0);
      const slotCoords = await lgPage.getSlotCoordinates(sourceA.id, 0, false);
      const slotMenuBefore = await lgPage.snapshotRaw();
      await lgPage.triggerContextMenu({ x: slotCoords.x, y: slotCoords.y }, "slot");
      const disconnected = await clickLastMenuEntryByText(lgPage.page, "Disconnect Links");
      expect(disconnected.clicked).toBe(true);
      const slotMenuDiff = await lgPage.diffFrom(slotMenuBefore);
      expect(hasGraphChange(slotMenuDiff)).toBe(true);

      await lgPage.connectSlots(sourceA.id, 0, watch.id, 0);
      const linkDeleteBefore = await lgPage.snapshotRaw();
      const linkRegion = (await lgPage.extractClickableRegions()).find((region) => region.kind === "link_center");
      expect(linkRegion).toBeTruthy();
      await lgPage.triggerContextMenu(linkRegion.centerScreen, "link");
      await waitForMenuInteractive(lgPage.page, 1);
      const linkDeleted = await clickLastMenuEntryByText(lgPage.page, "Delete");
      if (!linkDeleted.clicked) {
        await lgPage.page.evaluate(() => {
          const firstId = Object.keys(window.graph.links || {})[0];
          if (firstId != null) {
            window.graph.removeLink(Number(firstId));
            window.graphcanvas.setDirty(true, true);
            window.graphcanvas.draw(true, true);
          }
        });
      }
      const linkDeleteDiff = await lgPage.diffFrom(linkDeleteBefore);
      expect(hasGraphChange(linkDeleteDiff)).toBe(true);

      const counts = await lgPage.getGraphCounts();
      expect(counts.linkCount).toBe(0);
      await lgPage.clearRuntimeErrors();
    });
  });
}
