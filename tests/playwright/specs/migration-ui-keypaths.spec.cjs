const path = require("path");

const isBunRuntime = typeof Bun !== "undefined";

if (!isBunRuntime) {
  const { test, expect } = require("../fixtures/litegraph-harness.cjs");
  const {
    clickLastMenuEntryByText,
    getLastMenuEntries,
    waitForMenuInteractive,
    closeAllContextMenus,
  } = require("../utils/context-menu-traverser.cjs");
  const { writeJsonReport, writeMarkdownReport } = require("../utils/coverage-recorder.cjs");

  async function openNodeMenuPath(lgPage, nodeId, pathSegments) {
    const regions = await lgPage.extractClickableRegions();
    const titleRegion = regions.find((region) => region.id === `node:${nodeId}:title`);
    if (!titleRegion) {
      throw new Error(`Node title region not found for node ${nodeId}`);
    }

    await lgPage.triggerContextMenu(titleRegion.centerScreen, "node");

    let expectedMenus = 1;
    for (const segment of pathSegments) {
      const clicked = await clickLastMenuEntryByText(lgPage.page, segment);
      expect(clicked.clicked, `Node menu segment not found: ${segment}`).toBe(true);
      if (clicked.hasSubmenu) {
        expectedMenus += 1;
        await waitForMenuInteractive(lgPage.page, expectedMenus);
      } else {
        await lgPage.page.waitForTimeout(100);
      }
    }
  }

  test.describe("migration ui key paths", () => {
    test("@core align menu + to-subgraph + property printable path", async ({ lgPage }) => {
      const checks = [];
      const record = (name, passed, details = {}) => {
        checks.push({ name, passed: !!passed, details });
      };

      await lgPage.createNodesByType([
        { type: "basic/const", title: "Align Anchor", pos: [180, 180] },
        { type: "basic/watch", title: "Align Target", pos: [520, 300] },
        { type: "basic/const", title: "Subgraph Source", pos: [220, 420] },
        { type: "basic/watch", title: "Subgraph Sink", pos: [520, 420] },
      ]);

      const anchor = await lgPage.getNodeByTitle("Align Anchor");
      const target = await lgPage.getNodeByTitle("Align Target");
      const source = await lgPage.getNodeByTitle("Subgraph Source");
      const sink = await lgPage.getNodeByTitle("Subgraph Sink");

      expect(anchor).toBeTruthy();
      expect(target).toBeTruthy();
      expect(source).toBeTruthy();
      expect(sink).toBeTruthy();

      await lgPage.connectSlots(source.id, 0, sink.id, 0);

      const alignBefore = await lgPage.page.evaluate(
        ({ anchorId, targetId }) => {
          const graph = window.graph;
          const canvas = window.graphcanvas;
          const anchorNode = graph.getNodeById(anchorId);
          const targetNode = graph.getNodeById(targetId);
          canvas.deselectAllNodes();
          canvas.selectNode(anchorNode, false);
          canvas.selectNode(targetNode, true);
          canvas.setDirty(true, true);
          canvas.draw(true, true);
          return {
            anchorX: anchorNode.pos[0],
            targetX: targetNode.pos[0],
            selectedCount: Object.keys(canvas.selected_nodes || {}).length,
          };
        },
        { anchorId: anchor.id, targetId: target.id }
      );

      await openNodeMenuPath(lgPage, anchor.id, ["Align Selected To", "Left"]);
      await closeAllContextMenus(lgPage.page);

      const alignAfter = await lgPage.page.evaluate(
        ({ anchorId, targetId }) => {
          const graph = window.graph;
          const anchorNode = graph.getNodeById(anchorId);
          const targetNode = graph.getNodeById(targetId);
          return {
            anchorX: anchorNode.pos[0],
            targetX: targetNode.pos[0],
          };
        },
        { anchorId: anchor.id, targetId: target.id }
      );

      record(
        "菜单对齐",
        alignBefore.selectedCount > 1 &&
          alignBefore.anchorX !== alignBefore.targetX &&
          alignAfter.anchorX === alignAfter.targetX,
        { alignBefore, alignAfter }
      );

      await lgPage.page.evaluate((nodeId) => {
        const graph = window.graph;
        const canvas = window.graphcanvas;
        const node = graph.getNodeById(nodeId);
        canvas.deselectAllNodes();
        canvas.selectNode(node, false);
        canvas.setDirty(true, true);
        canvas.draw(true, true);
      }, source.id);

      await openNodeMenuPath(lgPage, source.id, ["To Subgraph"]);
      await closeAllContextMenus(lgPage.page);

      const createdSubgraphNode = await lgPage.page.evaluate(() => {
        const nodes = window.graph._nodes || [];
        const matches = nodes.filter((node) => node && node.type === "graph/subgraph");
        if (!matches.length) {
          return null;
        }
        const latest = matches[matches.length - 1];
        return { id: latest.id, type: latest.type };
      });

      let subgraphDetails = { createdSubgraphNode };
      let subgraphPassed = false;
      if (createdSubgraphNode) {
        const depthBefore = await lgPage.getCurrentGraphDepth();
        const opened = await lgPage.openSubgraph(createdSubgraphNode.id);
        const depthInside = await lgPage.getCurrentGraphDepth();
        const closed = await lgPage.closeSubgraph();
        const depthAfter = await lgPage.getCurrentGraphDepth();

        subgraphDetails = {
          createdSubgraphNode,
          depthBefore,
          opened,
          depthInside,
          closed,
          depthAfter,
        };

        subgraphPassed =
          depthBefore === 0 &&
          opened.ok &&
          depthInside > 0 &&
          closed.ok &&
          depthAfter === 0;
      }

      record("子图转换", subgraphPassed, subgraphDetails);

      const printableNodeId = await lgPage.page.evaluate(() => {
        const LiteGraph = window.LiteGraph;
        const graph = window.graph;
        const canvas = window.graphcanvas;

        if (!LiteGraph.registered_node_types["tests/enum_printable"]) {
          function EnumPrintableNode() {
            this.addOutput("value", "number");
            this.properties = { mode: 2 };
            this.properties_info = [
              {
                name: "mode",
                type: "enum",
                values: { Slow: 1, Fast: 2 },
              },
            ];
          }
          EnumPrintableNode.title = "Enum Printable";
          EnumPrintableNode.prototype.onExecute = function() {
            this.setOutputData(0, this.properties.mode);
          };
          LiteGraph.registerNodeType("tests/enum_printable", EnumPrintableNode);
        }

        const node = LiteGraph.createNode("tests/enum_printable");
        node.title = "Printable Enum";
        node.pos = [300, 560];
        graph.add(node);
        canvas.setDirty(true, true);
        canvas.draw(true, true);
        return node.id;
      });

      await openNodeMenuPath(lgPage, printableNodeId, ["Properties"]);
      const propertyEntries = await getLastMenuEntries(lgPage.page);
      await closeAllContextMenus(lgPage.page);

      const modeEntry = propertyEntries.find((entry) => entry.text.toLowerCase().includes("mode"));
      const printablePassed =
        !!modeEntry && /fast/i.test(modeEntry.text) && modeEntry.text.includes("2");

      record("属性打印值路径", printablePassed, {
        entries: propertyEntries,
        modeEntry,
      });

      const failures = checks.filter((item) => !item.passed);

      const reportJsonPath = path.resolve(
        process.cwd(),
        "tests/playwright/reports/migration-ui-keypaths-report.json"
      );
      const reportMdPath = path.resolve(
        process.cwd(),
        "tests/playwright/reports/migration-ui-keypaths-report.md"
      );

      writeJsonReport(reportJsonPath, {
        generatedAt: new Date().toISOString(),
        totalChecks: checks.length,
        passedChecks: checks.length - failures.length,
        failedChecks: failures.length,
        checks,
        failures,
      });

      const lines = [
        "# Migration UI Keypaths Report",
        "",
        `- Generated at: ${new Date().toISOString()}`,
        `- Total checks: ${checks.length}`,
        `- Passed: ${checks.length - failures.length}`,
        `- Failed: ${failures.length}`,
        "",
        "## Checks",
        "",
        ...checks.map((item) => `- ${item.passed ? "[PASS]" : "[FAIL]"} ${item.name}`),
        "",
      ];

      if (failures.length) {
        lines.push("## Failures");
        lines.push("");
        for (const failure of failures) {
          lines.push(`- ${failure.name}`);
        }
        lines.push("");
      }

      writeMarkdownReport(reportMdPath, lines);

      expect(failures).toEqual([]);
      await lgPage.clearRuntimeErrors();
    });
  });
}
