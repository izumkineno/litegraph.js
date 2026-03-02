const base = require("@playwright/test");
const { LiteGraphCanvasPage } = require("../page-objects/litegraph-canvas.po.cjs");

async function installHarness(page) {
  await page.evaluate(() => {
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

    function pushErrorRecord(payload) {
      bootstrap.errors.push({
        at: Date.now(),
        ...payload,
      });
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
        graphcanvas.setDirty(true, true);
        graphcanvas.draw(true, true);
      },
    };
  });
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
    });

    const lgPage = new LiteGraphCanvasPage(page);
    await lgPage.gotoEditor();
    await installHarness(page);
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
