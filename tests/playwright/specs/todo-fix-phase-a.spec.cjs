const isBunRuntime = typeof Bun !== "undefined";

if (!isBunRuntime) {
  const { test, expect } = require("../fixtures/litegraph-harness.cjs");

  test.describe("todo fix phase a", () => {
    test("@todo-fix @core createDialog close policy: leave/offside/esc", async ({ lgPage }) => {
      await lgPage.page.evaluate(() => {
        window.LiteGraph.dialog_close_on_mouse_leave = false;
        const gc = window.graphcanvas;
        gc.createDialog("<span class='name'>Probe</span><input class='value' value='x'/>", {
          checkForInput: true,
        });
      });

      const dialog = lgPage.page.locator(".graphdialog").last();
      await expect(dialog).toBeVisible();
      const box = await dialog.boundingBox();
      expect(box).toBeTruthy();

      await lgPage.page.mouse.move(box.x + 6, box.y + 6);
      await lgPage.page.mouse.move(box.x + box.width + 120, box.y + box.height + 120);
      await lgPage.page.waitForTimeout(650);
      await expect(dialog).toBeVisible();

      const canvasBox = await lgPage.page.evaluate(() => {
        const rect = window.graphcanvas.canvas.getBoundingClientRect();
        return { x: rect.left, y: rect.top };
      });
      await lgPage.page.waitForTimeout(40);
      await lgPage.page.evaluate((pt) => {
        const target = window.graphcanvas.canvas;
        target.dispatchEvent(
          new MouseEvent("mousedown", {
            bubbles: true,
            cancelable: true,
            clientX: pt.x + 16,
            clientY: pt.y + 16,
            button: 0,
            buttons: 1,
            view: window,
          })
        );
      }, canvasBox);
      await expect(dialog).toHaveCount(0);

      await lgPage.page.evaluate(() => {
        const gc = window.graphcanvas;
        gc.createDialog("<span class='name'>Probe 2</span><input class='value' value='y'/>", {
          checkForInput: true,
        });
      });
      await expect(lgPage.page.locator(".graphdialog").last()).toBeVisible();
      await lgPage.page.keyboard.press("Escape");
      await expect(lgPage.page.locator(".graphdialog")).toHaveCount(0);

      await lgPage.clearRuntimeErrors();
    });

    test("@todo-fix @core break-link modifier and overlap top-node hit", async ({ lgPage }) => {
      await lgPage.createNodesByType([
        { type: "basic/const", title: "Break Source", pos: [130, 180] },
        { type: "basic/watch", title: "Break Watch", pos: [460, 180] },
      ]);
      const source = await lgPage.getNodeByTitle("Break Source");
      const watch = await lgPage.getNodeByTitle("Break Watch");
      await lgPage.connectSlots(source.id, 0, watch.id, 0);

      await lgPage.page.evaluate(() => {
        window.LiteGraph.shift_click_do_break_link_from = true;
        window.LiteGraph.click_do_break_link_from_key = "alt";
      });

      const modifierCheck = await lgPage.page.evaluate(() => {
        return {
          plain: window.LiteGraph.isBreakLinkModifierPressed({
            shiftKey: false,
            altKey: false,
            ctrlKey: false,
            metaKey: false,
          }),
          alt: window.LiteGraph.isBreakLinkModifierPressed({
            shiftKey: false,
            altKey: true,
            ctrlKey: false,
            metaKey: false,
          }),
          shift: window.LiteGraph.isBreakLinkModifierPressed({
            shiftKey: true,
            altKey: false,
            ctrlKey: false,
            metaKey: false,
          }),
        };
      });
      expect(modifierCheck.plain).toBe(false);
      expect(modifierCheck.alt).toBe(true);
      expect(modifierCheck.shift).toBe(false);

      await lgPage.createNodesByType([
        { type: "basic/const", title: "Overlap Base", pos: [240, 340] },
        { type: "basic/watch", title: "Overlap Top", pos: [240, 340] },
      ]);

      const overlapProbe = await lgPage.page.evaluate(() => {
        const nodes = window.graph._nodes || [];
        const topNode = nodes[nodes.length - 1];
        const screen = window.__lgHarness.toScreen([topNode.pos[0] + 32, topNode.pos[1] - 8]);
        return {
          x: screen.x,
          y: screen.y,
          topNodeId: topNode.id,
        };
      });
      await lgPage.page.mouse.click(overlapProbe.x, overlapProbe.y);
      const selectedId = await lgPage.page.evaluate(() => {
        const selected = Object.keys(window.graphcanvas.selected_nodes || {});
        return selected.length ? Number(selected[0]) : null;
      });
      expect(selectedId).toBe(overlapProbe.topNodeId);

      await lgPage.clearRuntimeErrors();
    });

    test("@todo-fix @core searchbox close policy and type-filter guard", async ({ lgPage }) => {
      await lgPage.page.evaluate(() => {
        const lg = window.LiteGraph;
        lg.search_filter_enabled = true;
        lg.slot_types_in = null;
        lg.slot_types_out = null;
        lg.registered_slot_in_types = {};
        lg.registered_slot_out_types = {};
      });

      await lgPage.openSearchBox([160, 140], {
        show_all_on_open: true,
        do_type_filter: true,
      });
      await expect(lgPage.page.locator(".litesearchbox")).toBeVisible();
      await expect(lgPage.page.locator(".litesearchbox .slot_in_type_filter")).toHaveCount(0);
      await expect(lgPage.page.locator(".litesearchbox .slot_out_type_filter")).toHaveCount(0);

      await lgPage.page.keyboard.press("Escape");
      await expect(lgPage.page.locator(".litesearchbox")).toHaveCount(0);

      await lgPage.page.evaluate(() => {
        window.LiteGraph.search_hide_on_mouse_leave = true;
      });
      await lgPage.openSearchBox([170, 150], {
        hide_on_mouse_leave: true,
        show_all_on_open: true,
      });
      const searchDialog = lgPage.page.locator(".litesearchbox").last();
      await expect(searchDialog).toBeVisible();
      const box = await searchDialog.boundingBox();
      await lgPage.page.mouse.move(box.x + 10, box.y + 10);
      await lgPage.page.mouse.move(box.x + box.width + 140, box.y + box.height + 140);
      await lgPage.page.waitForTimeout(650);
      await expect(lgPage.page.locator(".litesearchbox")).toHaveCount(0);

      await lgPage.clearRuntimeErrors();
    });

    test("@todo-fix @core slot auto-load + invalid title color fallback", async ({ lgPage }) => {
      const probe = await lgPage.page.evaluate(() => {
        const lg = window.LiteGraph;
        const gc = window.graphcanvas;
        const g = window.graph;
        const marker = `tests/slot_probe_${Date.now()}`;
        const markerColor = `tests/bad_color_${Date.now()}`;

        lg.auto_load_slot_types = true;
        lg.slot_types_in = [];
        lg.slot_types_out = [];
        lg.registered_slot_in_types = {};
        lg.registered_slot_out_types = {};

        function SlotProbeNode() {
          this.addInput("in", "slot_probe_in");
          this.addOutput("out", "slot_probe_out");
        }

        function BadTitleColorNode() {
          this.addInput("in", "number");
          this.addOutput("out", "number");
        }
        BadTitleColorNode.title_color = "not-a-valid-color(";

        lg.registerNodeType(marker, SlotProbeNode);
        lg.registerNodeType(markerColor, BadTitleColorNode);

        const hasIn = lg.slot_types_in.includes("slot_probe_in");
        const hasOut = lg.slot_types_out.includes("slot_probe_out");

        g.clear();
        const node = lg.createNode(markerColor);
        node.pos = [180, 180];
        g.add(node);

        let drawOk = true;
        let drawError = "";
        try {
          gc.draw(true, true);
        } catch (error) {
          drawOk = false;
          drawError = error && error.message ? error.message : String(error);
        }

        return { hasIn, hasOut, drawOk, drawError };
      });

      expect(probe.hasIn).toBe(true);
      expect(probe.hasOut).toBe(true);
      expect(probe.drawOk).toBe(true);

      await lgPage.clearRuntimeErrors();
    });

    test("@todo-fix @core to-subgraph menu enabled + context menu leave close + touch/pointer-cancel", async ({ lgPage }) => {
      await lgPage.createNodesByType([
        { type: "basic/const", title: "Menu Base", pos: [180, 210] },
        { type: "graph/subgraph", title: "Menu Subgraph", pos: [440, 210] },
      ]);
      const baseNode = await lgPage.getNodeByTitle("Menu Base");
      const subgraphNode = await lgPage.getNodeByTitle("Menu Subgraph");

      const menuCheck = await lgPage.page.evaluate(
        ({ baseId, subId }) => {
          const gc = window.graphcanvas;
          const base = window.graph.getNodeById(baseId);
          const sub = window.graph.getNodeById(subId);
          const baseOpts = gc.getNodeMenuOptions(base) || [];
          const subOpts = gc.getNodeMenuOptions(sub) || [];
          const find = (arr) =>
            arr.find((item) => item && typeof item === "object" && item.content && String(item.content).toLowerCase().includes("subgraph"));
          return {
            base: find(baseOpts),
            sub: find(subOpts),
            baseLabels: baseOpts.filter(Boolean).map((item) => (item.content ? String(item.content) : String(item))),
            subLabels: subOpts.filter(Boolean).map((item) => (item.content ? String(item.content) : String(item))),
          };
        },
        { baseId: baseNode.id, subId: subgraphNode.id }
      );

      expect(menuCheck.base).toBeTruthy();
      expect(menuCheck.base.disabled).not.toBe(true);
      expect(menuCheck.sub).toBeTruthy();
      expect(menuCheck.sub.disabled).toBe(true);

      await lgPage.triggerContextMenu([220, 120], "canvas");
      const openedMenu = lgPage.page.locator(".litecontextmenu").last();
      await expect(openedMenu).toBeVisible();
      const mbox = await openedMenu.boundingBox();
      await lgPage.page.mouse.move(mbox.x + 8, mbox.y + 8);
      await lgPage.page.mouse.move(mbox.x + mbox.width + 160, mbox.y + mbox.height + 160);
      await lgPage.page.waitForTimeout(700);
      await expect(lgPage.page.locator(".litecontextmenu")).toHaveCount(0);

      const pointerAndTouch = await lgPage.page.evaluate(() => {
        const gc = window.graphcanvas;
        const node = window.graph._nodes[0];
        const startScreen = window.__lgHarness.toScreen([node.pos[0] + 20, node.pos[1] - 8]);
        const before = node.pos.slice();

        function touchLike(type, x, y) {
          const touch = {
            identifier: 1,
            clientX: x,
            clientY: y,
            pageX: x,
            pageY: y,
            screenX: x,
            screenY: y,
            target: gc.canvas,
          };
          return {
            type,
            changedTouches: [touch],
            touches: type === "touchend" ? [] : [touch],
            target: gc.canvas,
            cancelable: true,
            preventDefault() {},
            stopPropagation() {},
            stopImmediatePropagation() {},
          };
        }

        gc.processTouch(touchLike("touchstart", startScreen.x, startScreen.y));
        gc.processTouch(touchLike("touchmove", startScreen.x + 100, startScreen.y + 50));
        gc.processTouch(touchLike("touchend", startScreen.x + 100, startScreen.y + 50));

        gc.pointer_is_down = true;
        gc.dragging_canvas = true;
        gc.processPointerCancel({
          type: "pointercancel",
          clientX: startScreen.x + 100,
          clientY: startScreen.y + 50,
          which: 1,
          button: 0,
          buttons: 0,
          isPrimary: true,
          target: gc.canvas,
          preventDefault() {},
          stopPropagation() {},
          stopImmediatePropagation() {},
        });

        return {
          before,
          after: node.pos.slice(),
          pointerIsDown: gc.pointer_is_down,
          draggingCanvas: gc.dragging_canvas,
        };
      });

      expect(pointerAndTouch.after[0]).not.toBe(pointerAndTouch.before[0]);
      expect(pointerAndTouch.after[1]).not.toBe(pointerAndTouch.before[1]);
      expect(pointerAndTouch.pointerIsDown).toBe(false);
      expect(pointerAndTouch.draggingCanvas).toBe(false);

      await lgPage.clearRuntimeErrors();
    });
  });
}
