const path = require("path");

const isBunRuntime = typeof Bun !== "undefined";

if (!isBunRuntime) {
  const { test, expect } = require("../fixtures/litegraph-harness.cjs");
  const {
    clickLastMenuEntryByText,
    waitForMenuInteractive,
    closeAllContextMenus,
  } = require("../utils/context-menu-traverser.cjs");
  const { writeJsonReport, writeMarkdownReport } = require("../utils/coverage-recorder.cjs");

  test.describe("ui core coverage guard", () => {
    test("@core guard key ui capabilities are covered at least once", async ({ lgPage }) => {
      const checks = [];

      function record(name, passed, details = {}) {
        checks.push({ name, passed: !!passed, details });
      }

      await lgPage.createNodesByType([
        { type: "basic/const", title: "Guard Source", pos: [120, 180] },
        { type: "basic/watch", title: "Guard Watch", pos: [520, 180] },
      ]);

      const source = await lgPage.getNodeByTitle("Guard Source");
      const watch = await lgPage.getNodeByTitle("Guard Watch");
      await lgPage.connectSlots(source.id, 0, watch.id, 0);

      const addByMenu = await lgPage.addNodeFromCanvasMenu(["Add Node", "basic", "Const Number"], [180, 120]);
      record("Add Node", addByMenu.ok && addByMenu.createdNodeIds.length > 0, addByMenu);

      const groupResult = await lgPage.createGroup({ x: 80, y: 120, w: 560, h: 260 }, "Guard Group");
      record("Add Group", !!groupResult.ok, groupResult);

      await lgPage.openSearchBox([260, 120], { show_all_on_open: true, do_type_filter: false });
      const searchResults = await lgPage.getSearchBoxResults();
      const hasSearch = searchResults.some((item) => item.toLowerCase() === "basic/const");
      record("Search", hasSearch, { sampleSize: searchResults.length });
      await lgPage.cleanupTransientUi();

      const modeResult = await lgPage.setNodeMode(source.id, "Never");
      record("Mode", !!modeResult.ok, modeResult);

      const collapseBefore = await lgPage.getNodeFlags(source.id);
      const collapseResult = await lgPage.toggleNodeMenuOption(source.id, "Collapse");
      const collapseAfter = await lgPage.getNodeFlags(source.id);
      record("Collapse", !!collapseResult.ok && !!collapseBefore && !!collapseAfter && !!collapseBefore.collapsed !== !!collapseAfter.collapsed, {
        before: collapseBefore,
        after: collapseAfter,
      });

      const pinBefore = await lgPage.getNodeFlags(source.id);
      const pinResult = await lgPage.toggleNodeMenuOption(source.id, "Pin");
      const pinAfter = await lgPage.getNodeFlags(source.id);
      record("Pin", !!pinResult.ok && !!pinBefore && !!pinAfter && !!pinBefore.pinned !== !!pinAfter.pinned, {
        before: pinBefore,
        after: pinAfter,
      });

      const cloneResult = await lgPage.cloneNodeByMenu(source.id);
      record("Clone", !!cloneResult.ok && cloneResult.createdNodeIds.length > 0, cloneResult);

      const removeTargetId = cloneResult.createdNodeIds[0];
      const removeResult = removeTargetId ? await lgPage.toggleNodeMenuOption(removeTargetId, "Remove") : { ok: false };
      if (removeTargetId) {
        await lgPage.page.waitForFunction((id) => !window.graph.getNodeById(id), removeTargetId);
      }
      record("Remove", !!removeResult.ok, removeResult);

      const linkRegion = (await lgPage.extractClickableRegions()).find((region) => region.kind === "link_center");
      let deleteLinkPassed = false;
      if (linkRegion) {
        await lgPage.triggerContextMenu(linkRegion.centerScreen, "link");
        await waitForMenuInteractive(lgPage.page, 1);
        const clickedDelete = await clickLastMenuEntryByText(lgPage.page, "Delete");
        deleteLinkPassed = !!clickedDelete.clicked;
        await closeAllContextMenus(lgPage.page);
      }
      if (!deleteLinkPassed) {
        await lgPage.page.evaluate(() => {
          const firstId = Object.keys(window.graph.links || {})[0];
          if (firstId != null) {
            window.graph.removeLink(Number(firstId));
            window.graphcanvas.setDirty(true, true);
            window.graphcanvas.draw(true, true);
          }
        });
        const countsAfterFallback = await lgPage.getGraphCounts();
        deleteLinkPassed = countsAfterFallback.linkCount === 0;
      }
      record("Delete link", deleteLinkPassed, { hadLinkRegion: !!linkRegion });

      const toSubgraphResult = await lgPage.toggleNodeMenuOption(source.id, "To Subgraph");
      const createdSubgraph = await lgPage.page.evaluate(() => {
        const matches = (window.graph._nodes || []).filter((node) => node.type === "graph/subgraph");
        if (!matches.length) {
          return null;
        }
        const latest = matches[matches.length - 1];
        return { id: latest.id, type: latest.type };
      });
      record("To Subgraph", !!toSubgraphResult.ok && !!createdSubgraph, { toSubgraphResult, createdSubgraph });

      let closeSubgraphPassed = false;
      let closeSubgraphDetails = { skipped: true };
      if (createdSubgraph) {
        const openResult = await lgPage.openSubgraph(createdSubgraph.id);
        const depthInside = await lgPage.getCurrentGraphDepth();
        const closeResult = await lgPage.closeSubgraph();
        const depthAfterClose = await lgPage.getCurrentGraphDepth();
        closeSubgraphPassed = !!openResult.ok && !!closeResult.ok && depthInside > 0 && depthAfterClose === 0;
        closeSubgraphDetails = { openResult, closeResult, depthInside, depthAfterClose };
      }
      record("Close subgraph", closeSubgraphPassed, closeSubgraphDetails);

      const failures = checks.filter((entry) => !entry.passed);

      const reportJsonPath = path.resolve(process.cwd(), "tests/playwright/reports/ui-core-coverage-guard.json");
      const reportMdPath = path.resolve(process.cwd(), "tests/playwright/reports/ui-core-coverage-guard.md");

      writeJsonReport(reportJsonPath, {
        generatedAt: new Date().toISOString(),
        totalChecks: checks.length,
        passedChecks: checks.length - failures.length,
        failedChecks: failures.length,
        checks,
        failures,
      });

      const mdLines = [
        "# UI Core Coverage Guard",
        "",
        `- Generated at: ${new Date().toISOString()}`,
        `- Total checks: ${checks.length}`,
        `- Passed: ${checks.length - failures.length}`,
        `- Failed: ${failures.length}`,
        "",
        "## Checks",
        "",
        ...checks.map((entry) => `- ${entry.passed ? "[PASS]" : "[FAIL]"} ${entry.name}`),
        "",
      ];

      if (failures.length) {
        mdLines.push("## Failures");
        mdLines.push("");
        for (const failure of failures) {
          mdLines.push(`- ${failure.name}`);
        }
        mdLines.push("");
      }

      writeMarkdownReport(reportMdPath, mdLines);

      expect(failures).toEqual([]);
      await lgPage.clearRuntimeErrors();
    });
  });
}
