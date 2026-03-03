const isBunRuntime = typeof Bun !== "undefined";

if (!isBunRuntime) {
  const { test, expect } = require("../fixtures/litegraph-harness.cjs");

  test.describe("toolbar and shortcuts", () => {
    test("@core toolbar play/step/live/maximize basic flow", async ({ lgPage }) => {
      await lgPage.createNodesByType([
        { type: "basic/time", title: "TB Time", pos: [120, 180] },
        { type: "basic/watch", title: "TB Watch", pos: [440, 180] },
      ]);
      const time = await lgPage.getNodeByTitle("TB Time");
      const watch = await lgPage.getNodeByTitle("TB Watch");
      await lgPage.connectSlots(time.id, 0, watch.id, 0);

      const toolbar = {
        play: lgPage.page.locator("#playnode_button"),
        step: lgPage.page.locator("#playstepnode_button"),
        live: lgPage.page.locator("#livemode_button"),
        maximize: lgPage.page.locator("#maximize_button"),
      };

      await expect(toolbar.play).toBeVisible();
      await expect(toolbar.step).toBeVisible();
      await expect(toolbar.live).toBeVisible();
      await expect(toolbar.maximize).toBeVisible();

      const iterationBeforeStep = await lgPage.page.evaluate(() => window.graph.iteration);
      await toolbar.step.click();
      const iterationAfterStep = await lgPage.page.evaluate(() => window.graph.iteration);
      expect(iterationAfterStep).toBeGreaterThan(iterationBeforeStep);

      const statusBeforePlay = await lgPage.page.evaluate(() => window.graph.status);
      await toolbar.play.click();
      const statusRunning = await lgPage.page.evaluate(() => window.graph.status);
      expect(statusRunning).not.toBe(statusBeforePlay);

      await lgPage.page.waitForTimeout(80);
      await toolbar.play.click();
      const statusStopped = await lgPage.page.evaluate(() => window.graph.status);
      expect(statusStopped).toBe(1);

      const liveBefore = await lgPage.page.evaluate(() => !!window.graphcanvas.live_mode);
      await toolbar.live.click();
      await lgPage.page.waitForFunction((before) => !!window.graphcanvas.live_mode !== before, liveBefore);
      const liveAfterFirstToggle = await lgPage.page.evaluate(() => !!window.graphcanvas.live_mode);
      expect(liveAfterFirstToggle).toBe(!liveBefore);
      await toolbar.live.click();
      await lgPage.page.waitForFunction((before) => !!window.graphcanvas.live_mode === before, liveBefore);
      const liveAfterSecondToggle = await lgPage.page.evaluate(() => !!window.graphcanvas.live_mode);
      expect(liveAfterSecondToggle).toBe(liveBefore);

      await lgPage.page.evaluate(() => {
        const root = document.querySelector(".litegraph-editor");
        root.__lgFullscreenCallCount = 0;
        root.requestFullscreen = async function mockRequestFullscreen() {
          this.__lgFullscreenCallCount += 1;
        };
      });
      await toolbar.maximize.click();
      const fullscreenCalls = await lgPage.page.evaluate(
        () => document.querySelector(".litegraph-editor").__lgFullscreenCallCount || 0
      );
      expect(fullscreenCalls).toBeGreaterThan(0);

      await lgPage.clearRuntimeErrors();
    });

    test("@core keyboard select-all/delete/copy-paste flow", async ({ lgPage }) => {
      await lgPage.createNodesByType([
        { type: "basic/const", title: "KB Source", pos: [120, 170] },
        { type: "basic/watch", title: "KB Watch", pos: [520, 170] },
        { type: "basic/boolean", title: "KB Bool", pos: [220, 360] },
      ]);

      const source = await lgPage.getNodeByTitle("KB Source");
      const watch = await lgPage.getNodeByTitle("KB Watch");
      await lgPage.connectSlots(source.id, 0, watch.id, 0);

      const countsBefore = await lgPage.getGraphCounts();
      const selectedAll = await lgPage.dispatchCanvasKeyChord("Ctrl+A");
      expect(selectedAll.ok).toBe(true);

      const selectedAfterAll = await lgPage.getSelectedNodeIds();
      expect(selectedAfterAll.length).toBe(countsBefore.nodeCount);

      const copyResult = await lgPage.dispatchCanvasKeyChord("Ctrl+C");
      expect(copyResult.ok).toBe(true);

      const pasteResult = await lgPage.dispatchCanvasKeyChord("Ctrl+V");
      expect(pasteResult.ok).toBe(true);
      const countsAfterPaste = await lgPage.getGraphCounts();
      expect(countsAfterPaste.nodeCount).toBeGreaterThan(countsBefore.nodeCount);

      const pasteWithLinksResult = await lgPage.dispatchCanvasKeyChord("Ctrl+Shift+V");
      expect(pasteWithLinksResult.ok).toBe(true);
      const countsAfterSecondPaste = await lgPage.getGraphCounts();
      expect(countsAfterSecondPaste.nodeCount).toBeGreaterThanOrEqual(countsAfterPaste.nodeCount);

      const deleteResult = await lgPage.dispatchCanvasKeyChord("Delete");
      expect(deleteResult.ok).toBe(true);
      const countsAfterDelete = await lgPage.getGraphCounts();
      expect(countsAfterDelete.nodeCount).toBeLessThan(countsAfterSecondPaste.nodeCount);

      await lgPage.clearRuntimeErrors();
    });

    test("@core keyboard space-drag canvas pan", async ({ lgPage }) => {
      await lgPage.createNodesByType([
        { type: "basic/const", title: "Pan Probe", pos: [240, 220] },
      ]);

      const canvasCenter = await lgPage.page.evaluate(() => {
        const rect = window.graphcanvas.canvas.getBoundingClientRect();
        return {
          x: rect.left + rect.width * 0.5,
          y: rect.top + rect.height * 0.5,
        };
      });

      const stateBefore = await lgPage.getState();
      await lgPage.page.evaluate((origin) => {
        const gc = window.graphcanvas;
        const from = { x: origin.x, y: origin.y };
        const to = { x: origin.x + 140, y: origin.y + 90 };

        function keyLike(type, keyCode) {
          return {
            type,
            keyCode,
            ctrlKey: false,
            shiftKey: false,
            altKey: false,
            metaKey: false,
            target: gc.canvas,
            preventDefault() {},
            stopPropagation() {},
            stopImmediatePropagation() {},
          };
        }

        function pointerLike(type, point) {
          return {
            type,
            clientX: point.x,
            clientY: point.y,
            which: 1,
            isPrimary: true,
            button: 0,
            buttons: 1,
            shiftKey: false,
            ctrlKey: false,
            altKey: false,
            metaKey: false,
            preventDefault() {},
            stopPropagation() {},
            stopImmediatePropagation() {},
          };
        }

        gc.processKey(keyLike("keydown", 32));
        gc.processMouseDown(pointerLike("mousedown", from));
        gc.processMouseMove(pointerLike("mousemove", to));
        gc.processMouseUp(pointerLike("mouseup", to));
        gc.processKey(keyLike("keyup", 32));
      }, canvasCenter);

      const stateAfter = await lgPage.getState();
      expect(stateAfter.offset[0]).not.toBe(stateBefore.offset[0]);
      expect(stateAfter.offset[1]).not.toBe(stateBefore.offset[1]);

      await lgPage.clearRuntimeErrors();
    });
  });
}
