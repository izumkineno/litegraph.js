const isBunRuntime = typeof Bun !== "undefined";

if (!isBunRuntime) {
  const { test, expect } = require("../fixtures/litegraph-harness.cjs");

  test.describe("self-aware clickable region discovery", () => {
    test("extracts dynamic bounding boxes and can interact with discovered points", async ({ lgPage }) => {
      await lgPage.createNodesByType([
        { type: "basic/const", title: "SA Number", pos: [80, 120] },
        { type: "basic/boolean", title: "SA Toggle", pos: [340, 120] },
        { type: "widget/internal_slider", title: "SA Slider", pos: [80, 300] },
        { type: "widget/combo", title: "SA Combo", pos: [320, 300] },
        { type: "basic/watch", title: "SA Watch", pos: [600, 220] },
      ]);

      const regions = await lgPage.extractClickableRegions();
      expect(regions.length).toBeGreaterThan(0);

      const kinds = new Set(regions.map((region) => region.kind));
      expect(kinds.has("node_title")).toBe(true);
      expect(kinds.has("slot_input")).toBe(true);
      expect(kinds.has("slot_output")).toBe(true);
      expect(kinds.has("widget")).toBe(true);

      const baseline = await lgPage.snapshotRaw();

      const sampled = regions
        .filter((region) => region.kind !== "canvas_background")
        .slice(0, 18);

      for (const region of sampled) {
        const { x, y } = region.centerScreen;
        await lgPage.page.mouse.click(x, y, { button: "left" });
        await lgPage.cleanupTransientUi();
        await lgPage.restoreGraph(baseline);
      }

      const regionsAfterRestore = await lgPage.extractClickableRegions();
      expect(regionsAfterRestore.length).toBeGreaterThan(0);
    });
  });
}
