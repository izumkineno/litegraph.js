const base = require("@playwright/test");
const { LiteGraphCanvasPage } = require("../page-objects/litegraph-canvas.po.cjs");
const staticNodeManifest = require("../data/static-node-manifest.cjs");

async function installHarness(page, manifest) {
  await page.evaluate((staticManifest) => {
    if (!window.graph || !window.graphcanvas) {
      throw new Error("LiteGraph globals are missing on editor page");
    }

    if (window.__lgHarness && window.__lgHarness.__installed) {
      return;
    }

    const graph = window.graph;
    const graphcanvas = window.graphcanvas;
    const canvas = graphcanvas.canvas;
    const LiteGraph = window.LiteGraph;

    const bootstrap = window.__lgHarnessBootstrap || { errors: [] };
    if (!window.__lgHarnessBootstrap) {
      window.__lgHarnessBootstrap = bootstrap;
    }
    if (!bootstrap.executionTrace) {
      bootstrap.executionTrace = [];
    }
    if (!bootstrap.groupSeq) {
      bootstrap.groupSeq = 1;
    }
    if (!bootstrap.staticManifest && staticManifest) {
      bootstrap.staticManifest = staticManifest;
    }

    function pushErrorRecord(payload) {
      bootstrap.errors.push({
        at: Date.now(),
        ...payload,
      });
    }

    function pushExecutionTrace(payload) {
      bootstrap.executionTrace.push({
        at: Date.now(),
        ...payload,
      });
      if (bootstrap.executionTrace.length > 5000) {
        bootstrap.executionTrace.splice(0, bootstrap.executionTrace.length - 5000);
      }
    }

    function cloneSerializable(value) {
      try {
        return structuredClone(value);
      } catch (error) {
        return JSON.parse(JSON.stringify(value));
      }
    }

    function toScreen(graphPos) {
      const rect = canvas.getBoundingClientRect();
      const local = graphcanvas.convertOffsetToCanvas(graphPos);
      return {
        x: rect.left + local[0],
        y: rect.top + local[1],
      };
    }

    function toGraph(screenPos) {
      const rect = canvas.getBoundingClientRect();
      return graphcanvas.convertCanvasToOffset([
        screenPos.x - rect.left,
        screenPos.y - rect.top,
      ]);
    }

    const DEFAULT_BY_TYPE = {
      "": 1,
      "*": 1,
      number: 42,
      float: 0.5,
      int: 7,
      integer: 7,
      bool: true,
      boolean: true,
      string: "lg-test",
      object: { foo: "bar", n: 1 },
      array: [1, 2, 3],
      vec2: [0.1, 0.2],
      vec3: [0.1, 0.2, 0.3],
      vec4: [0.1, 0.2, 0.3, 0.4],
      mat4: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
      event: { event: "tick" },
      action: { action: "tick" },
      texture: { kind: "mock-texture" },
      image: { kind: "mock-image" },
      audio: { kind: "mock-audio" },
    };

    function normalizeType(type) {
      const raw = String(type == null ? "" : type).trim().toLowerCase();
      if (!raw) {
        return "*";
      }
      if (raw.includes("|")) {
        return normalizeType(raw.split("|")[0]);
      }
      if (raw.endsWith("[]")) {
        return "array";
      }
      if (raw === "_event_") {
        return "event";
      }
      if (raw === "_action_") {
        return "action";
      }
      if (raw.includes("vec2")) {
        return "vec2";
      }
      if (raw.includes("vec3")) {
        return "vec3";
      }
      if (raw.includes("vec4")) {
        return "vec4";
      }
      if (raw.includes("mat4")) {
        return "mat4";
      }
      if (raw.includes("bool")) {
        return "boolean";
      }
      if (raw.includes("int")) {
        return "int";
      }
      if (raw.includes("float") || raw.includes("double")) {
        return "float";
      }
      if (raw.includes("num")) {
        return "number";
      }
      if (raw.includes("string") || raw.includes("text")) {
        return "string";
      }
      if (raw.includes("event")) {
        return "event";
      }
      if (raw.includes("action")) {
        return "action";
      }
      if (raw.includes("texture")) {
        return "texture";
      }
      if (raw.includes("audio")) {
        return "audio";
      }
      if (raw.includes("image")) {
        return "image";
      }
      if (raw.includes("array") || raw.includes("list")) {
        return "array";
      }
      if (raw.includes("object") || raw.includes("json") || raw.includes("dict")) {
        return "object";
      }
      return raw;
    }

    function pickDefaultValue(slotType) {
      const normalized = normalizeType(slotType);
      if (Object.prototype.hasOwnProperty.call(DEFAULT_BY_TYPE, normalized)) {
        return DEFAULT_BY_TYPE[normalized];
      }
      return DEFAULT_BY_TYPE["*"];
    }

    function makeGraphDiff(beforeValue, afterValue) {
      const changedPaths = [];
      const addedPaths = [];
      const removedPaths = [];

      function isPlainObject(value) {
        return value !== null && typeof value === "object" && !Array.isArray(value);
      }

      function pathJoin(basePath, key, isIndex) {
        if (!basePath) {
          return isIndex ? `[${key}]` : String(key);
        }
        return isIndex ? `${basePath}[${key}]` : `${basePath}.${key}`;
      }

      function pushPath(target, path) {
        target.push(path || "$root");
      }

      function walk(beforeNode, afterNode, path) {
        if (beforeNode === afterNode) {
          return;
        }

        const beforeIsArray = Array.isArray(beforeNode);
        const afterIsArray = Array.isArray(afterNode);

        if (beforeIsArray || afterIsArray) {
          if (!beforeIsArray || !afterIsArray) {
            pushPath(changedPaths, path);
            return;
          }

          const max = Math.max(beforeNode.length, afterNode.length);
          for (let i = 0; i < max; i += 1) {
            const nextPath = pathJoin(path, i, true);
            const hasBefore = i < beforeNode.length;
            const hasAfter = i < afterNode.length;
            if (!hasBefore && hasAfter) {
              pushPath(addedPaths, nextPath);
              continue;
            }
            if (hasBefore && !hasAfter) {
              pushPath(removedPaths, nextPath);
              continue;
            }
            walk(beforeNode[i], afterNode[i], nextPath);
          }
          return;
        }

        const beforeIsObject = isPlainObject(beforeNode);
        const afterIsObject = isPlainObject(afterNode);

        if (beforeIsObject || afterIsObject) {
          if (!beforeIsObject || !afterIsObject) {
            pushPath(changedPaths, path);
            return;
          }

          const keys = new Set([...Object.keys(beforeNode), ...Object.keys(afterNode)]);
          for (const key of keys) {
            const nextPath = pathJoin(path, key, false);
            const hasBefore = Object.prototype.hasOwnProperty.call(beforeNode, key);
            const hasAfter = Object.prototype.hasOwnProperty.call(afterNode, key);
            if (!hasBefore && hasAfter) {
              pushPath(addedPaths, nextPath);
              continue;
            }
            if (hasBefore && !hasAfter) {
              pushPath(removedPaths, nextPath);
              continue;
            }
            walk(beforeNode[key], afterNode[key], nextPath);
          }
          return;
        }

        if (!Object.is(beforeNode, afterNode)) {
          pushPath(changedPaths, path);
        }
      }

      walk(beforeValue, afterValue, "");
      return { changedPaths, addedPaths, removedPaths };
    }

    function extractClickableRegions() {
      graphcanvas.draw(true, true);

      const regions = [];
      const titleHeight = LiteGraph.NODE_TITLE_HEIGHT;
      const slotHitWidth = 30;
      const slotHitHeight = 20;
      const widgetDefaultHeight = LiteGraph.NODE_WIDGET_HEIGHT;

      function addRegion(id, kind, nodeId, bboxGraph, meta = null) {
        if (!bboxGraph || !Number.isFinite(bboxGraph.x) || !Number.isFinite(bboxGraph.y) || !Number.isFinite(bboxGraph.w) || !Number.isFinite(bboxGraph.h)) {
          return;
        }

        const centerGraph = {
          x: bboxGraph.x + bboxGraph.w * 0.5,
          y: bboxGraph.y + bboxGraph.h * 0.5,
        };
        const topLeftScreen = toScreen([bboxGraph.x, bboxGraph.y]);
        const bottomRightScreen = toScreen([bboxGraph.x + bboxGraph.w, bboxGraph.y + bboxGraph.h]);
        const centerScreen = toScreen([centerGraph.x, centerGraph.y]);

        regions.push({
          id,
          kind,
          nodeId: nodeId == null ? null : nodeId,
          bboxGraph,
          centerGraph,
          bboxScreen: {
            x: Math.min(topLeftScreen.x, bottomRightScreen.x),
            y: Math.min(topLeftScreen.y, bottomRightScreen.y),
            w: Math.abs(bottomRightScreen.x - topLeftScreen.x),
            h: Math.abs(bottomRightScreen.y - topLeftScreen.y),
          },
          centerScreen,
          meta,
        });
      }

      const nodes = graphcanvas.visible_nodes || [];
      for (const node of nodes) {
        const nodeId = node.id;
        const collapsed = !!(node.flags && node.flags.collapsed);
        const titleWidth = collapsed
          ? node._collapsed_width || LiteGraph.NODE_COLLAPSED_WIDTH
          : node.size[0];

        addRegion(
          `node:${nodeId}:title`,
          "node_title",
          nodeId,
          { x: node.pos[0], y: node.pos[1] - titleHeight, w: titleWidth, h: titleHeight },
          { collapsed }
        );

        addRegion(
          `node:${nodeId}:body`,
          "node_body",
          nodeId,
          { x: node.pos[0], y: node.pos[1], w: node.size[0], h: node.size[1] },
          { collapsed }
        );

        addRegion(
          `node:${nodeId}:collapse_box`,
          "collapse_box",
          nodeId,
          { x: node.pos[0], y: node.pos[1] - titleHeight, w: titleHeight, h: titleHeight },
          null
        );

        if (!collapsed && node.resizable !== false) {
          addRegion(
            `node:${nodeId}:resize`,
            "resize_handle",
            nodeId,
            {
              x: node.pos[0] + node.size[0] - 10,
              y: node.pos[1] + node.size[1] - 10,
              w: 10,
              h: 10,
            },
            null
          );
        }

        if (!collapsed && node.subgraph && !node.skip_subgraph_button) {
          addRegion(
            `node:${nodeId}:subgraph_button`,
            "subgraph_button",
            nodeId,
            {
              x: node.pos[0] + node.size[0] - titleHeight,
              y: node.pos[1] - titleHeight,
              w: titleHeight,
              h: titleHeight,
            },
            null
          );
        }

        if (Array.isArray(node.inputs)) {
          for (let i = 0; i < node.inputs.length; i += 1) {
            const pos = node.getConnectionPos(true, i);
            addRegion(
              `node:${nodeId}:slot:in:${i}`,
              "slot_input",
              nodeId,
              {
                x: pos[0] - slotHitWidth * 0.5,
                y: pos[1] - slotHitHeight * 0.5,
                w: slotHitWidth,
                h: slotHitHeight,
              },
              {
                slotIndex: i,
                isInput: true,
                slotName: node.inputs[i] ? node.inputs[i].name : "",
              }
            );
          }
        }

        if (Array.isArray(node.outputs)) {
          for (let i = 0; i < node.outputs.length; i += 1) {
            const pos = node.getConnectionPos(false, i);
            addRegion(
              `node:${nodeId}:slot:out:${i}`,
              "slot_output",
              nodeId,
              {
                x: pos[0] - slotHitWidth * 0.5,
                y: pos[1] - slotHitHeight * 0.5,
                w: slotHitWidth,
                h: slotHitHeight,
              },
              {
                slotIndex: i,
                isInput: false,
                slotName: node.outputs[i] ? node.outputs[i].name : "",
              }
            );
          }
        }

        if (!collapsed && Array.isArray(node.widgets) && node.widgets.length) {
          const nodeWidth = node.size[0];
          for (let i = 0; i < node.widgets.length; i += 1) {
            const widget = node.widgets[i];
            if (!widget || widget.last_y == null) {
              continue;
            }
            const widgetWidth = widget.width || nodeWidth;
            const widgetHeight = widget.computeSize
              ? widget.computeSize(widgetWidth)[1]
              : widgetDefaultHeight;

            addRegion(
              `node:${nodeId}:widget:${i}`,
              "widget",
              nodeId,
              {
                x: node.pos[0] + 6,
                y: node.pos[1] + widget.last_y,
                w: Math.max(1, widgetWidth - 18),
                h: widgetHeight,
              },
              {
                widgetIndex: i,
                widgetType: widget.type,
                widgetName: widget.name || "",
              }
            );
          }
        }
      }

      const links = graphcanvas.visible_links || [];
      for (const link of links) {
        if (!link || !link._pos) {
          continue;
        }
        addRegion(
          `link:${link.id}:center`,
          "link_center",
          null,
          {
            x: link._pos[0] - 4,
            y: link._pos[1] - 4,
            w: 8,
            h: 8,
          },
          { linkId: link.id }
        );
      }

      const groups = graph._groups || [];
      for (let i = 0; i < groups.length; i += 1) {
        const group = groups[i];
        const bounding = group._bounding || [group.pos[0], group.pos[1], group.size[0], group.size[1]];
        addRegion(
          `group:${i}:area`,
          "group_area",
          null,
          {
            x: bounding[0],
            y: bounding[1],
            w: bounding[2],
            h: bounding[3],
          },
          { groupTitle: group.title || "" }
        );
      }

      const visibleArea = graphcanvas.visible_area || [0, 0, 0, 0];
      addRegion(
        "canvas:visible-area",
        "canvas_background",
        null,
        {
          x: visibleArea[0],
          y: visibleArea[1],
          w: visibleArea[2],
          h: visibleArea[3],
        },
        null
      );

      return regions;
    }

    if (!graphcanvas.__lgHarnessDrawPatched) {
      const originalDraw = graphcanvas.draw;
      graphcanvas.draw = function patchedDraw(...args) {
        try {
          return originalDraw.apply(this, args);
        } catch (error) {
          pushErrorRecord({
            source: "draw",
            message: error && error.message ? error.message : String(error),
            stack: error && error.stack ? String(error.stack) : "",
          });
          throw error;
        }
      };
      graphcanvas.__lgHarnessDrawPatched = true;
    }

    function getModeIndex(modeName) {
      if (typeof modeName === "number") {
        return modeName;
      }
      const value = String(modeName || "").trim().toLowerCase();
      const fromLabels = LiteGraph.NODE_MODES.findIndex(
        (label) => String(label || "").trim().toLowerCase() === value
      );
      if (fromLabels !== -1) {
        return fromLabels;
      }
      if (value === "on event" || value === "on_event" || value === "event") {
        return LiteGraph.ON_EVENT;
      }
      if (value === "on trigger" || value === "on_trigger" || value === "trigger") {
        return LiteGraph.ON_TRIGGER;
      }
      if (value === "always") {
        return LiteGraph.ALWAYS;
      }
      if (value === "never") {
        return LiteGraph.NEVER;
      }
      return -1;
    }

    function getActionInput(node) {
      if (!node || !Array.isArray(node.inputs)) {
        return { index: -1, name: "action" };
      }
      for (let i = 0; i < node.inputs.length; i += 1) {
        const input = node.inputs[i];
        const type = input ? input.type : null;
        const isAction =
          type === LiteGraph.ACTION ||
          type === LiteGraph.EVENT ||
          String(type || "").toLowerCase().includes("action") ||
          String(type || "").toLowerCase().includes("event");
        if (isAction) {
          return { index: i, name: input && input.name ? input.name : "action" };
        }
      }
      return { index: 0, name: node.inputs[0] && node.inputs[0].name ? node.inputs[0].name : "action" };
    }

    function findGroupById(groupId) {
      const groups = graph._groups || [];
      const numeric = Number(groupId);
      for (let i = 0; i < groups.length; i += 1) {
        const group = groups[i];
        if (!group) {
          continue;
        }
        if (group.__lgGroupId === groupId || group.__lgGroupId === numeric) {
          return group;
        }
      }
      if (Number.isFinite(numeric)) {
        if (groups[numeric]) {
          return groups[numeric];
        }
        const byOneBased = numeric - 1;
        if (groups[byOneBased]) {
          return groups[byOneBased];
        }
      }
      return null;
    }

    function getGroupsState() {
      const groups = graph._groups || [];
      const out = [];
      for (let i = 0; i < groups.length; i += 1) {
        const group = groups[i];
        if (!group) {
          continue;
        }
        if (!group.__lgGroupId) {
          group.__lgGroupId = bootstrap.groupSeq++;
        }
        if (typeof group.recomputeInsideNodes === "function") {
          group.recomputeInsideNodes();
        }
        out.push({
          groupId: group.__lgGroupId,
          index: i,
          title: group.title,
          bounding: Array.from(group._bounding || [group.pos[0], group.pos[1], group.size[0], group.size[1]]),
          nodeIds: (group._nodes || []).map((node) => node.id),
        });
      }
      return out;
    }

    function makeSyntheticCanvasEvent(at, options = {}) {
      const rect = canvas.getBoundingClientRect();
      let screen = null;
      let graphPos = null;
      if (Array.isArray(at)) {
        graphPos = [at[0], at[1]];
        screen = toScreen(graphPos);
      } else if (at && typeof at === "object" && typeof at.gx === "number" && typeof at.gy === "number") {
        graphPos = [at.gx, at.gy];
        screen = toScreen(graphPos);
      } else if (at && typeof at === "object" && typeof at.x === "number" && typeof at.y === "number") {
        screen = { x: at.x, y: at.y };
        graphPos = toGraph(screen);
      } else {
        screen = { x: rect.left + rect.width * 0.5, y: rect.top + rect.height * 0.5 };
        graphPos = toGraph(screen);
      }

      return {
        type: "mousedown",
        clientX: screen.x,
        clientY: screen.y,
        canvasX: graphPos[0],
        canvasY: graphPos[1],
        pageX: screen.x,
        pageY: screen.y,
        layerX: screen.x - rect.left,
        layerY: screen.y - rect.top,
        isPrimary: true,
        button: options.button || 0,
        buttons: options.buttons || 1,
        shiftKey: !!options.shiftKey,
        ctrlKey: !!options.ctrlKey,
        altKey: !!options.altKey,
        metaKey: !!options.metaKey,
        preventDefault() {},
        stopPropagation() {},
        stopImmediatePropagation() {},
      };
    }

    function ensureActiveCanvas() {
      LiteGraph.LGraphCanvas.active_canvas = graphcanvas;
      graphcanvas.constructor.active_canvas = graphcanvas;
    }

    function getMenuEntriesFor(menu) {
      if (!menu) {
        return [];
      }
      return Array.from(menu.querySelectorAll(".litemenu-entry")).filter((entry) => {
        if (entry.classList.contains("separator") || entry.classList.contains("disabled")) {
          return false;
        }
        const text = (entry.textContent || "").trim();
        return !!text;
      });
    }

    function clickLastMenuEntryByText(menuText) {
      const menus = Array.from(document.querySelectorAll(".litecontextmenu"));
      const menu = menus[menus.length - 1];
      if (!menu) {
        return { clicked: false, hasSubmenu: false };
      }

      const entries = getMenuEntriesFor(menu);
      const found = entries.find((entry) => (entry.textContent || "").trim() === menuText);
      if (!found) {
        return { clicked: false, hasSubmenu: false };
      }

      const hasSubmenu = found.classList.contains("has_submenu");
      found.click();
      return { clicked: true, hasSubmenu };
    }

    function invokeCanvasMenuPath(path, at = null) {
      if (!Array.isArray(path) || !path.length) {
        return { ok: false, reason: "path must be non-empty array" };
      }

      ensureActiveCanvas();
      LiteGraph.closeAllContextMenus(window);

      const evtData = makeSyntheticCanvasEvent(at, { button: 2, buttons: 2 });
      const eventLike = new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        clientX: evtData.clientX,
        clientY: evtData.clientY,
        button: 2,
        buttons: 2,
        view: window,
      });
      eventLike.canvasX = evtData.canvasX;
      eventLike.canvasY = evtData.canvasY;
      eventLike.pageX = evtData.pageX;
      eventLike.pageY = evtData.pageY;
      eventLike.layerX = evtData.layerX;
      eventLike.layerY = evtData.layerY;
      const mouseDown = new MouseEvent("mousedown", {
        bubbles: true,
        cancelable: true,
        clientX: evtData.clientX,
        clientY: evtData.clientY,
        button: 2,
        buttons: 2,
        view: window,
      });
      const mouseUp = new MouseEvent("mouseup", {
        bubbles: true,
        cancelable: true,
        clientX: evtData.clientX,
        clientY: evtData.clientY,
        button: 2,
        buttons: 2,
        view: window,
      });
      canvas.dispatchEvent(mouseDown);
      canvas.dispatchEvent(mouseUp);
      canvas.dispatchEvent(eventLike);

      for (let i = 0; i < path.length; i += 1) {
        const segment = String(path[i] || "").trim();
        if (!segment) {
          return { ok: false, reason: `invalid path segment at ${i}` };
        }
        const clicked = clickLastMenuEntryByText(segment);
        if (!clicked.clicked) {
          LiteGraph.closeAllContextMenus(window);
          return { ok: false, reason: `menu entry not found: ${segment}`, failedAt: i };
        }
      }

      return { ok: true };
    }

    function findNodeInKnownGraphs(nodeId) {
      if (nodeId == null) {
        return null;
      }
      const current = graphcanvas.graph ? graphcanvas.graph.getNodeById(nodeId) : null;
      if (current) {
        return current;
      }
      return graph.getNodeById(nodeId);
    }

    function keyCodeFromToken(token) {
      const t = String(token || "").trim().toUpperCase();
      if (t.length === 1) {
        return t.charCodeAt(0);
      }
      const table = {
        SPACE: 32,
        ESC: 27,
        ESCAPE: 27,
        DELETE: 46,
        DEL: 46,
        BACKSPACE: 8,
        ENTER: 13,
        TAB: 9,
      };
      return table[t] || 0;
    }

    function dispatchSyntheticKey(type, keyCode, mods = {}) {
      const evt = {
        type,
        keyCode,
        ctrlKey: !!mods.ctrlKey,
        shiftKey: !!mods.shiftKey,
        altKey: !!mods.altKey,
        metaKey: !!mods.metaKey,
        target: canvas,
        preventDefault() {},
        stopPropagation() {},
        stopImmediatePropagation() {},
      };
      graphcanvas.processKey(evt);
    }

    if (!LiteGraph.LGraphNode.prototype.__lgHarnessTracePatched) {
      const proto = LiteGraph.LGraphNode.prototype;
      const originalDoExecute = proto.doExecute;
      const originalActionDo = proto.actionDo;
      const originalTriggerSlot = proto.triggerSlot;

      proto.doExecute = function tracedDoExecute(param, options) {
        pushExecutionTrace({
          kind: "doExecute",
          nodeId: this.id,
          nodeType: this.type,
          nodeTitle: this.title,
          mode: this.mode,
        });
        return originalDoExecute.call(this, param, options);
      };

      proto.actionDo = function tracedActionDo(action, param, options, actionSlot) {
        pushExecutionTrace({
          kind: "actionDo",
          nodeId: this.id,
          nodeType: this.type,
          nodeTitle: this.title,
          mode: this.mode,
          action: action || "",
          actionSlot: typeof actionSlot === "number" ? actionSlot : null,
        });
        return originalActionDo.call(this, action, param, options, actionSlot);
      };

      proto.triggerSlot = function tracedTriggerSlot(slot, param, linkId, options) {
        pushExecutionTrace({
          kind: "triggerSlot",
          nodeId: this.id,
          nodeType: this.type,
          nodeTitle: this.title,
          mode: this.mode,
          slot,
          linkId: linkId == null ? null : linkId,
        });
        return originalTriggerSlot.call(this, slot, param, linkId, options);
      };

      LiteGraph.LGraphNode.prototype.__lgHarnessTracePatched = true;
    }

    window.__lgHarness = {
      __installed: true,
      getState() {
        graphcanvas.draw(true, true);
        return {
          scale: graphcanvas.ds.scale,
          offset: [graphcanvas.ds.offset[0], graphcanvas.ds.offset[1]],
          visibleNodeIds: (graphcanvas.visible_nodes || []).map((node) => node.id),
        };
      },
      getStaticNodeManifest() {
        return cloneSerializable(bootstrap.staticManifest || null);
      },
      graphSnapshot() {
        return cloneSerializable(graph.serialize());
      },
      graphDiff(beforeSnapshot, afterSnapshot) {
        return makeGraphDiff(beforeSnapshot, afterSnapshot);
      },
      toScreen(graphPos) {
        const point = toScreen(graphPos);
        return { x: point.x, y: point.y };
      },
      toGraph(screenPos) {
        const point = toGraph(screenPos);
        return [point[0], point[1]];
      },
      findNodeCenter(title) {
        graphcanvas.draw(true, true);
        const visible = graphcanvas.visible_nodes || [];
        let node = visible.find((item) => (item.getTitle ? item.getTitle() : item.title) === title);
        if (!node) {
          node = graph.findNodeByTitle(title);
        }
        if (!node) {
          return null;
        }

        const centerGraph = [node.pos[0] + node.size[0] * 0.5, node.pos[1] + node.size[1] * 0.5];
        const centerScreen = toScreen(centerGraph);
        return {
          x: centerScreen.x,
          y: centerScreen.y,
          gx: centerGraph[0],
          gy: centerGraph[1],
          nodeId: node.id,
        };
      },
      getSlotCoordinates(nodeId, slotIndex, isInput) {
        const node = graph.getNodeById(nodeId);
        if (!node) {
          return null;
        }
        const graphPos = node.getConnectionPos(Boolean(isInput), slotIndex);
        const screenPos = toScreen(graphPos);
        return {
          x: screenPos.x,
          y: screenPos.y,
          gx: graphPos[0],
          gy: graphPos[1],
          nodeId,
          slotIndex,
          isInput: Boolean(isInput),
        };
      },
      getSelectedNodeIds() {
        return Object.keys(graphcanvas.selected_nodes || {})
          .map((id) => Number(id))
          .filter((id) => Number.isFinite(id));
      },
      getNodeFlags(nodeId) {
        const node = findNodeInKnownGraphs(nodeId);
        if (!node) {
          return null;
        }
        return cloneSerializable(node.flags || {});
      },
      getNodeStyle(nodeId) {
        const node = findNodeInKnownGraphs(nodeId);
        if (!node) {
          return null;
        }
        return {
          color: node.color || null,
          bgcolor: node.bgcolor || null,
          boxcolor: node.boxcolor || null,
          shape: node.shape != null ? node.shape : null,
        };
      },
      createNodeByType(type, pos = null, title = null) {
        const graphPos = Array.isArray(pos) ? [pos[0], pos[1]] : [80, 80];
        try {
          const node = LiteGraph.createNode(type, title || undefined);
          if (!node) {
            return { created: false, type, reason: "createNode returned null" };
          }
          node.pos = graphPos.slice();
          if (title) {
            node.title = title;
          }
          graph.add(node);
          graphcanvas.setDirty(true, true);
          graphcanvas.draw(true, true);
          return {
            created: true,
            nodeId: node.id,
            type: node.type,
            title: node.title,
            pos: [node.pos[0], node.pos[1]],
            inputs: (node.inputs || []).map((slot, index) => ({
              index,
              name: slot && slot.name ? slot.name : "",
              type: slot && slot.type != null ? slot.type : "",
            })),
            outputs: (node.outputs || []).map((slot, index) => ({
              index,
              name: slot && slot.name ? slot.name : "",
              type: slot && slot.type != null ? slot.type : "",
            })),
          };
        } catch (error) {
          pushErrorRecord({
            source: "createNodeByType",
            nodeType: type,
            message: error && error.message ? error.message : String(error),
            stack: error && error.stack ? String(error.stack) : "",
          });
          return {
            created: false,
            type,
            reason: error && error.message ? error.message : String(error),
          };
        }
      },
      invokeNode(nodeId, mode = "auto") {
        const node = graph.getNodeById(nodeId);
        if (!node) {
          return {
            nodeId,
            invokedExecute: false,
            invokedAction: false,
            reason: "node not found",
          };
        }

        const result = {
          nodeId,
          nodeType: node.type,
          modeRequested: mode,
          modeLabel: LiteGraph.NODE_MODES[node.mode] || String(node.mode),
          invokedExecute: false,
          invokedAction: false,
          reason: "",
        };

        const shouldExecute = mode === "auto" || mode === "execute" || mode === "both";
        const shouldAction = mode === "auto" || mode === "action" || mode === "both";
        const payload = {};
        for (let i = 0; i < (node.inputs || []).length; i += 1) {
          const input = node.inputs[i];
          const key = input && input.name ? input.name : `in_${i}`;
          payload[key] = pickDefaultValue(input ? input.type : "");
        }

        try {
          if (shouldExecute && typeof node.doExecute === "function") {
            pushExecutionTrace({
              kind: "doExecute",
              nodeId: node.id,
              nodeType: node.type,
              nodeTitle: node.title,
              mode: node.mode,
              source: "invokeNode",
            });
            node.doExecute(payload, { action_call: `${node.id}_invoke_exec` });
            result.invokedExecute = true;
          } else if (shouldExecute && typeof node.onExecute === "function") {
            pushExecutionTrace({
              kind: "doExecute",
              nodeId: node.id,
              nodeType: node.type,
              nodeTitle: node.title,
              mode: node.mode,
              source: "invokeNode.fallback",
            });
            node.onExecute(payload, { action_call: `${node.id}_invoke_exec_fallback` });
            result.invokedExecute = true;
          }
        } catch (error) {
          result.reason = `execute:${error && error.message ? error.message : String(error)}`;
          pushErrorRecord({
            source: "invokeNode.execute",
            nodeId: node.id,
            nodeType: node.type,
            message: error && error.message ? error.message : String(error),
            stack: error && error.stack ? String(error.stack) : "",
          });
        }

        try {
          if (shouldAction && typeof node.actionDo === "function") {
            const action = getActionInput(node);
            pushExecutionTrace({
              kind: "actionDo",
              nodeId: node.id,
              nodeType: node.type,
              nodeTitle: node.title,
              mode: node.mode,
              action: action.name || "action",
              source: "invokeNode",
            });
            node.actionDo(
              action.name || "action",
              payload,
              { action_call: `${node.id}_invoke_action` },
              action.index
            );
            result.invokedAction = true;
          } else if (shouldAction && typeof node.onAction === "function") {
            const action = getActionInput(node);
            pushExecutionTrace({
              kind: "actionDo",
              nodeId: node.id,
              nodeType: node.type,
              nodeTitle: node.title,
              mode: node.mode,
              action: action.name || "action",
              source: "invokeNode.fallback",
            });
            node.onAction(action.name || "action", payload, { action_call: `${node.id}_invoke_action_fallback` }, action.index);
            result.invokedAction = true;
          }
        } catch (error) {
          result.reason = result.reason
            ? `${result.reason};action:${error && error.message ? error.message : String(error)}`
            : `action:${error && error.message ? error.message : String(error)}`;
          pushErrorRecord({
            source: "invokeNode.action",
            nodeId: node.id,
            nodeType: node.type,
            message: error && error.message ? error.message : String(error),
            stack: error && error.stack ? String(error.stack) : "",
          });
        }

        try {
          graph.runStep(1, false);
        } catch (error) {
          pushErrorRecord({
            source: "invokeNode.runStep",
            nodeId: node.id,
            nodeType: node.type,
            message: error && error.message ? error.message : String(error),
            stack: error && error.stack ? String(error.stack) : "",
          });
        }

        graphcanvas.setDirty(true, true);
        graphcanvas.draw(true, true);
        result.modeLabel = LiteGraph.NODE_MODES[node.mode] || String(node.mode);
        return result;
      },
      setNodeMode(nodeId, modeName) {
        const node = graph.getNodeById(nodeId);
        if (!node) {
          return { ok: false, reason: "node not found", nodeId };
        }
        const modeIndex = getModeIndex(modeName);
        if (modeIndex < 0) {
          return { ok: false, reason: `invalid mode ${modeName}`, nodeId };
        }
        node.changeMode(modeIndex);
        graphcanvas.setDirty(true, true);
        graphcanvas.draw(true, true);
        return {
          ok: true,
          nodeId,
          mode: node.mode,
          modeLabel: LiteGraph.NODE_MODES[node.mode] || String(node.mode),
        };
      },
      cloneNodeByMenu(nodeId) {
        const node = findNodeInKnownGraphs(nodeId);
        if (!node || !node.graph) {
          return { ok: false, reason: "node not found", nodeId };
        }

        ensureActiveCanvas();
        const ownerGraph = node.graph;
        const before = new Set((ownerGraph._nodes || []).map((item) => item.id));
        LiteGraph.LGraphCanvas.onMenuNodeClone(null, {}, null, null, node);
        const createdNodes = (ownerGraph._nodes || []).filter((item) => !before.has(item.id));
        ownerGraph.setDirtyCanvas && ownerGraph.setDirtyCanvas(true, true);
        graphcanvas.setDirty(true, true);
        graphcanvas.draw(true, true);
        return {
          ok: true,
          nodeId,
          createdNodeIds: createdNodes.map((item) => item.id),
        };
      },
      toggleNodeMenuOption(nodeId, optionText, optionValue = null) {
        const node = findNodeInKnownGraphs(nodeId);
        if (!node) {
          return { ok: false, reason: "node not found", nodeId };
        }

        ensureActiveCanvas();
        const option = String(optionText || "").trim().toLowerCase();

        if (option === "collapse") {
          LiteGraph.LGraphCanvas.onMenuNodeCollapse(null, {}, null, null, node);
        } else if (option === "pin") {
          LiteGraph.LGraphCanvas.onMenuNodePin(null, {}, null, null, node);
        } else if (option === "colors" || option === "color") {
          const colorKey = String(optionValue || "").trim();
          const color = colorKey ? LiteGraph.LGraphCanvas.node_colors[colorKey] : null;
          if (color) {
            if (node.constructor === LiteGraph.LGraphGroup) {
              node.color = color.groupcolor;
            } else {
              node.color = color.color;
              node.bgcolor = color.bgcolor;
            }
          } else {
            delete node.color;
            delete node.bgcolor;
          }
        } else if (option === "shapes" || option === "shape") {
          node.shape = optionValue || "default";
        } else if (option === "remove") {
          LiteGraph.LGraphCanvas.onMenuNodeRemove(null, {}, null, null, node);
        } else if (option === "clone") {
          LiteGraph.LGraphCanvas.onMenuNodeClone(null, {}, null, null, node);
        } else if (option === "to subgraph" || option === "tosubgraph") {
          LiteGraph.LGraphCanvas.onMenuNodeToSubgraph(null, {}, null, null, node);
        } else {
          return { ok: false, reason: `unsupported option: ${optionText}`, nodeId };
        }

        graphcanvas.setDirty(true, true);
        graphcanvas.draw(true, true);
        return {
          ok: true,
          nodeId,
          option: optionText,
          flags: cloneSerializable(node.flags || {}),
          style: {
            color: node.color || null,
            bgcolor: node.bgcolor || null,
            boxcolor: node.boxcolor || null,
            shape: node.shape != null ? node.shape : null,
          },
        };
      },
      openSubgraph(nodeId) {
        const node = findNodeInKnownGraphs(nodeId);
        if (!node || !node.subgraph) {
          return { ok: false, reason: "subgraph node not found", nodeId };
        }
        ensureActiveCanvas();
        graphcanvas.openSubgraph(node.subgraph);
        graphcanvas.setDirty(true, true);
        graphcanvas.draw(true, true);
        return {
          ok: true,
          nodeId,
          depth: (graphcanvas._graph_stack || []).length,
        };
      },
      closeSubgraph() {
        ensureActiveCanvas();
        if (!graphcanvas._graph_stack || graphcanvas._graph_stack.length === 0) {
          return { ok: false, reason: "already at root graph", depth: 0 };
        }
        graphcanvas.closeSubgraph();
        graphcanvas.setDirty(true, true);
        graphcanvas.draw(true, true);
        return {
          ok: true,
          depth: (graphcanvas._graph_stack || []).length,
        };
      },
      getCurrentGraphDepth() {
        return (graphcanvas._graph_stack || []).length;
      },
      dispatchCanvasKeyChord(chord) {
        const raw = String(chord || "").trim();
        if (!raw) {
          return { ok: false, reason: "empty chord" };
        }

        let suffix = "";
        let value = raw;
        const suffixMatch = raw.match(/:(DOWN|UP)$/i);
        if (suffixMatch) {
          suffix = suffixMatch[1].toUpperCase();
          value = raw.slice(0, raw.length - suffixMatch[0].length);
        }

        const tokens = value.split("+").map((part) => part.trim()).filter(Boolean);
        const keyToken = tokens[tokens.length - 1];
        const keyCode = keyCodeFromToken(keyToken);
        if (!keyCode) {
          return { ok: false, reason: `unsupported key token: ${keyToken}` };
        }

        const mods = {
          ctrlKey: tokens.slice(0, -1).some((token) => /^(CTRL|CONTROL)$/i.test(token)),
          shiftKey: tokens.slice(0, -1).some((token) => /^SHIFT$/i.test(token)),
          altKey: tokens.slice(0, -1).some((token) => /^ALT$/i.test(token)),
          metaKey: tokens.slice(0, -1).some((token) => /^(META|CMD|COMMAND)$/i.test(token)),
        };

        if (suffix === "DOWN") {
          dispatchSyntheticKey("keydown", keyCode, mods);
        } else if (suffix === "UP") {
          dispatchSyntheticKey("keyup", keyCode, mods);
        } else {
          dispatchSyntheticKey("keydown", keyCode, mods);
          dispatchSyntheticKey("keyup", keyCode, mods);
        }

        graphcanvas.setDirty(true, true);
        graphcanvas.draw(true, true);
        return {
          ok: true,
          chord: raw,
          selectedNodeIds: Object.keys(graphcanvas.selected_nodes || {}).map((id) => Number(id)),
        };
      },
      addNodeFromCanvasMenu(path, at = null) {
        const activeGraph = graphcanvas.graph || graph;
        const beforeIds = new Set((activeGraph._nodes || []).map((item) => item.id));
        const result = invokeCanvasMenuPath(path, at);
        LiteGraph.closeAllContextMenus(window);

        if (!result.ok) {
          return result;
        }

        graphcanvas.setDirty(true, true);
        graphcanvas.draw(true, true);

        const created = (activeGraph._nodes || []).filter((item) => !beforeIds.has(item.id));
        return {
          ok: true,
          path: cloneSerializable(path),
          createdNodeIds: created.map((item) => item.id),
          createdNodeTypes: created.map((item) => item.type),
        };
      },
      openSearchBox(at = null, options = {}) {
        const eventLike = makeSyntheticCanvasEvent(at);
        const searchOptions = Object.assign({}, options || {});
        if (typeof searchOptions.node_from === "number") {
          searchOptions.node_from = graph.getNodeById(searchOptions.node_from);
        }
        if (typeof searchOptions.node_to === "number") {
          searchOptions.node_to = graph.getNodeById(searchOptions.node_to);
        }
        LiteGraph.LGraphCanvas.active_canvas = graphcanvas;
        graphcanvas.constructor.active_canvas = graphcanvas;
        graphcanvas.showSearchBox(eventLike, searchOptions);
        return {
          x: eventLike.clientX,
          y: eventLike.clientY,
          gx: eventLike.canvasX,
          gy: eventLike.canvasY,
        };
      },
      getSearchBoxResults() {
        const root = document.querySelector(".litesearchbox");
        if (!root) {
          return [];
        }
        return Array.from(root.querySelectorAll(".lite-search-item"))
          .map((item) => (item.textContent || "").trim())
          .filter(Boolean);
      },
      selectSearchResult(label, exact = true) {
        const root = document.querySelector(".litesearchbox");
        if (!root) {
          return { selected: false, reason: "searchbox not open" };
        }
        const entries = Array.from(root.querySelectorAll(".lite-search-item"));
        const needle = String(label || "").trim().toLowerCase();
        const entry = entries.find((el) => {
          const text = (el.textContent || "").trim().toLowerCase();
          return exact ? text === needle : text.includes(needle);
        });
        if (!entry) {
          return { selected: false, reason: `item not found: ${label}` };
        }
        const before = graph._nodes ? graph._nodes.length : 0;
        entry.click();
        graphcanvas.setDirty(true, true);
        graphcanvas.draw(true, true);
        const after = graph._nodes ? graph._nodes.length : 0;
        const node = after > before ? graph._nodes[graph._nodes.length - 1] : null;
        return {
          selected: true,
          createdNodeId: node ? node.id : null,
          createdNodeType: node ? node.type : null,
        };
      },
      createGroup(bbox = null, title = "Group") {
        const group = new LiteGraph.LGraphGroup(title || "Group");
        if (bbox) {
          if (Array.isArray(bbox)) {
            group.pos = [bbox[0], bbox[1]];
            group.size = [bbox[2], bbox[3]];
          } else {
            group.pos = [bbox.x, bbox.y];
            group.size = [bbox.w, bbox.h];
          }
        }
        graph.add(group);
        group.__lgGroupId = bootstrap.groupSeq++;
        if (typeof group.recomputeInsideNodes === "function") {
          group.recomputeInsideNodes();
        }
        graphcanvas.setDirty(true, true);
        graphcanvas.draw(true, true);
        return {
          ok: true,
          groupId: group.__lgGroupId,
          title: group.title,
          bounding: Array.from(group._bounding),
          nodeIds: (group._nodes || []).map((node) => node.id),
        };
      },
      renameGroup(groupId, title) {
        const group = findGroupById(groupId);
        if (!group) {
          return { ok: false, reason: "group not found", groupId };
        }
        group.title = title;
        graphcanvas.setDirty(true, true);
        graphcanvas.draw(true, true);
        return { ok: true, groupId: group.__lgGroupId, title: group.title };
      },
      moveGroup(groupId, dx, dy, ignoreNodes = false) {
        const group = findGroupById(groupId);
        if (!group) {
          return { ok: false, reason: "group not found", groupId };
        }
        if (typeof group.recomputeInsideNodes === "function") {
          group.recomputeInsideNodes();
        }
        group.move(dx, dy, ignoreNodes);
        graphcanvas.setDirty(true, true);
        graphcanvas.draw(true, true);
        return {
          ok: true,
          groupId: group.__lgGroupId,
          bounding: Array.from(group._bounding),
          nodeIds: (group._nodes || []).map((node) => node.id),
        };
      },
      deleteGroup(groupId) {
        const group = findGroupById(groupId);
        if (!group) {
          return { ok: false, reason: "group not found", groupId };
        }
        graph.remove(group);
        graphcanvas.setDirty(true, true);
        graphcanvas.draw(true, true);
        return { ok: true, groupId };
      },
      getGroupsState,
      runGraphFrames(frameCount = 1) {
        const steps = Math.max(1, Number(frameCount) || 1);
        for (let i = 0; i < steps; i += 1) {
          const prevExec = {};
          const prevAction = {};
          for (const node of graph._nodes) {
            prevExec[node.id] = node.exec_version || null;
            prevAction[node.id] = node.action_call || null;
          }
          graph.runStep(1, false);
          for (const node of graph._nodes) {
            if (
              node.exec_version != null &&
              node.exec_version === graph.iteration &&
              prevExec[node.id] !== node.exec_version
            ) {
              pushExecutionTrace({
                kind: "doExecute",
                nodeId: node.id,
                nodeType: node.type,
                nodeTitle: node.title,
                mode: node.mode,
                source: "runGraphFrames",
              });
            }
            if (
              node.action_call &&
              prevAction[node.id] !== node.action_call
            ) {
              pushExecutionTrace({
                kind: "actionDo",
                nodeId: node.id,
                nodeType: node.type,
                nodeTitle: node.title,
                mode: node.mode,
                action_call: node.action_call,
                source: "runGraphFrames",
              });
            }
          }
        }
        graphcanvas.setDirty(true, true);
        graphcanvas.draw(true, true);
        return { frameCount: steps, iteration: graph.iteration };
      },
      startGraph() {
        graph.start();
        return { status: graph.status };
      },
      stopGraph() {
        graph.stop();
        return { status: graph.status };
      },
      getExecutionTrace() {
        return cloneSerializable(bootstrap.executionTrace);
      },
      clearExecutionTrace() {
        bootstrap.executionTrace.length = 0;
      },
      getGraphCounts() {
        return {
          nodeCount: graph._nodes.length,
          linkCount: Object.keys(graph.links || {}).length,
          groupCount: (graph._groups || []).length,
        };
      },
      openNodePanel(nodeId) {
        const node = graph.getNodeById(nodeId);
        if (!node) {
          return { ok: false, reason: "node not found", nodeId };
        }
        graphcanvas.showShowNodePanel(node);
        return { ok: true, nodeId };
      },
      openGraphOptionsPanel() {
        if (!Array.isArray(LiteGraph.availableCanvasOptions)) {
          LiteGraph.availableCanvasOptions = [
            "allow_dragcanvas",
            "allow_dragnodes",
            "allow_interaction",
            "allow_reconnect_links",
            "allow_searchbox",
          ];
        }
        graphcanvas.showShowGraphOptionsPanel();
        return { ok: true };
      },
      triggerContextMenuAtGraphPos(graphPos, button = "right") {
        const screenPos = toScreen(graphPos);
        const buttonCode = button === "right" ? 2 : 0;
        const eventInit = {
          bubbles: true,
          cancelable: true,
          clientX: screenPos.x,
          clientY: screenPos.y,
          button: buttonCode,
          buttons: buttonCode === 2 ? 2 : 1,
          view: window,
        };

        canvas.dispatchEvent(new MouseEvent("mousedown", eventInit));
        canvas.dispatchEvent(new MouseEvent("mouseup", eventInit));
        if (buttonCode === 2) {
          canvas.dispatchEvent(new MouseEvent("contextmenu", eventInit));
        }
        return screenPos;
      },
      extractClickableRegions,
      getErrors() {
        return cloneSerializable(bootstrap.errors);
      },
      clearErrors() {
        bootstrap.errors.length = 0;
      },
      restoreGraph(snapshot) {
        graph.configure(cloneSerializable(snapshot));
        for (const group of graph._groups || []) {
          if (!group.__lgGroupId) {
            group.__lgGroupId = bootstrap.groupSeq++;
          }
        }
        graphcanvas.setDirty(true, true);
        graphcanvas.draw(true, true);
      },
    };
  }, manifest);
}

const test = base.test.extend({
  lgPage: async ({ page }, use) => {
    await page.addInitScript(() => {
      if (window.__lgHarnessBootstrap) {
        return;
      }

      const errors = [];
      function pushError(payload) {
        errors.push({
          at: Date.now(),
          ...payload,
        });
      }

      window.__lgHarnessBootstrap = { errors };

      window.addEventListener("error", (event) => {
        pushError({
          source: "window.onerror",
          message: event && event.message ? event.message : "Unknown error",
          stack:
            event && event.error && event.error.stack
              ? String(event.error.stack)
              : "",
        });
      });

      window.addEventListener("unhandledrejection", (event) => {
        const reason = event && event.reason ? event.reason : "Unknown rejection";
        pushError({
          source: "window.unhandledrejection",
          message: reason && reason.message ? reason.message : String(reason),
          stack: reason && reason.stack ? String(reason.stack) : "",
        });
      });

      const originalConsoleError = console.error.bind(console);
      console.error = (...args) => {
        const serialized = args.map((arg) => {
          if (typeof arg === "string") {
            return arg;
          }
          try {
            return JSON.stringify(arg);
          } catch (error) {
            return String(arg);
          }
        });
        pushError({
          source: "console.error",
          message: serialized.join(" "),
          stack: "",
        });
        return originalConsoleError(...args);
      };

      window.alert = () => {};
      window.confirm = () => true;
      window.prompt = (_message, defaultValue = "") => defaultValue;

      let mediaDevices = navigator.mediaDevices;
      if (!mediaDevices) {
        mediaDevices = {};
        try {
          Object.defineProperty(navigator, "mediaDevices", {
            configurable: true,
            value: mediaDevices,
          });
        } catch (error) {
          // ignore readonly navigator quirks
        }
      }
      if (navigator.mediaDevices) {
        navigator.mediaDevices.getUserMedia = async () => ({
          id: "mock-stream",
          active: true,
          getTracks: () => [],
          getAudioTracks: () => [],
          getVideoTracks: () => [],
        });
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        mediaDevices.getUserMedia = async () => ({
          id: "mock-stream",
          active: true,
          getTracks: () => [],
          getAudioTracks: () => [],
          getVideoTracks: () => [],
        });
      }

      if (!navigator.requestMIDIAccess) {
        navigator.requestMIDIAccess = async () => ({
          inputs: new Map(),
          outputs: new Map(),
          sysexEnabled: false,
        });
      }

      if (!window.__lgHarnessOriginalWebSocket) {
        window.__lgHarnessOriginalWebSocket = window.WebSocket;
      }
      class MockWebSocket {
        constructor(url) {
          this.url = url;
          this.readyState = 1;
          this.bufferedAmount = 0;
          this.extensions = "";
          this.protocol = "";
          this.onopen = null;
          this.onmessage = null;
          this.onerror = null;
          this.onclose = null;
          setTimeout(() => {
            if (typeof this.onopen === "function") {
              this.onopen({ type: "open", target: this });
            }
          }, 0);
        }

        send(data) {
          if (typeof this.onmessage === "function") {
            this.onmessage({ data, target: this });
          }
        }

        close() {
          this.readyState = 3;
          if (typeof this.onclose === "function") {
            this.onclose({ type: "close", target: this });
          }
        }

        addEventListener() {}

        removeEventListener() {}
      }
      window.WebSocket = MockWebSocket;
    });

    const lgPage = new LiteGraphCanvasPage(page);
    await lgPage.gotoEditor();
    await installHarness(page, staticNodeManifest);
    await lgPage.waitForReady();
    await lgPage.clearRuntimeErrors();

    await use(lgPage);
  },

  _runtimeErrorGuard: [
    async ({ lgPage }, use) => {
      await use();
      const errors = await lgPage.getRuntimeErrors();
      base.expect(errors, `Runtime errors detected:\n${JSON.stringify(errors, null, 2)}`).toEqual([]);
    },
    { auto: true },
  ],
});

const expect = base.expect;

module.exports = {
  test,
  expect,
};
