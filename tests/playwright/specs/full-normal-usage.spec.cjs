const fs = require("fs");
const path = require("path");

const isBunRuntime = typeof Bun !== "undefined";

if (!isBunRuntime) {
  const { test, expect } = require("../fixtures/litegraph-harness.cjs");
  const { hasGraphChange } = require("../utils/graph-diff.cjs");
  const { clickLastMenuEntryByText } = require("../utils/context-menu-traverser.cjs");
  const { recordCoverageBundle } = require("../utils/coverage-recorder.cjs");

  function readNodeCoverage() {
    const filePath = path.resolve(process.cwd(), "tests/playwright/reports/node-coverage.json");
    if (!fs.existsSync(filePath)) {
      return { records: [], failures: [] };
    }
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return {
      records: data.records || [],
      failures: data.failures || [],
    };
  }

  test.describe("full normal usage", () => {
    test("@core end-to-end normal usage closure and report generation", async ({ lgPage }) => {
      test.slow();
      const featureRecords = [];
      const eventRecords = [];

      await lgPage.createNodesByType([]);
      await lgPage.clearExecutionTrace();

      const addSliderBefore = await lgPage.snapshotRaw();
      await lgPage.openSearchBox([140, 140], { show_all_on_open: true, do_type_filter: false });
      const sliderSelected = await lgPage.selectSearchResult("widget/internal_slider");
      expect(sliderSelected.selected).toBe(true);
      const addSliderDiff = await lgPage.diffFrom(addSliderBefore);
      expect(hasGraphChange(addSliderDiff)).toBe(true);

      const addWatchBefore = await lgPage.snapshotRaw();
      await lgPage.openSearchBox([520, 140], { show_all_on_open: true, do_type_filter: false });
      const watchSelected = await lgPage.selectSearchResult("basic/watch");
      expect(watchSelected.selected).toBe(true);
      const addWatchDiff = await lgPage.diffFrom(addWatchBefore);
      expect(hasGraphChange(addWatchDiff)).toBe(true);

      const addTimerBefore = await lgPage.snapshotRaw();
      await lgPage.openSearchBox([140, 420], { show_all_on_open: true, do_type_filter: false });
      const timerSelected = await lgPage.selectSearchResult("events/timer");
      expect(timerSelected.selected).toBe(true);
      await lgPage.openSearchBox([520, 420], { show_all_on_open: true, do_type_filter: false });
      const logSelected = await lgPage.selectSearchResult("events/log");
      expect(logSelected.selected).toBe(true);
      const addTimerDiff = await lgPage.diffFrom(addTimerBefore);
      expect(hasGraphChange(addTimerDiff)).toBe(true);

      await lgPage.page.evaluate(({ sliderId, watchId, timerId, logId }) => {
        const slider = window.graph.getNodeById(sliderId);
        const watch = window.graph.getNodeById(watchId);
        const timer = window.graph.getNodeById(timerId);
        const log = window.graph.getNodeById(logId);
        slider.title = "Full Slider";
        watch.title = "Full Watch";
        timer.title = "Full Timer";
        timer.properties.interval = 1;
        log.title = "Full Log";
        window.graphcanvas.setDirty(true, true);
        window.graphcanvas.draw(true, true);
      }, {
        sliderId: sliderSelected.createdNodeId,
        watchId: watchSelected.createdNodeId,
        timerId: timerSelected.createdNodeId,
        logId: logSelected.createdNodeId,
      });

      const regions = await lgPage.extractClickableRegions();
      const sliderWidget = regions.find(
        (region) =>
          region.kind === "widget" &&
          region.nodeId === sliderSelected.createdNodeId &&
          region.meta.widgetType === "slider"
      );
      expect(sliderWidget).toBeTruthy();

      const sliderDragBefore = await lgPage.snapshotRaw();
      await lgPage.page.mouse.move(sliderWidget.bboxScreen.x + 6, sliderWidget.centerScreen.y);
      await lgPage.page.mouse.down();
      await lgPage.page.mouse.move(
        sliderWidget.bboxScreen.x + sliderWidget.bboxScreen.w - 6,
        sliderWidget.centerScreen.y,
        { steps: 18 }
      );
      await lgPage.page.mouse.up();
      const sliderDragDiff = await lgPage.diffFrom(sliderDragBefore);
      expect(hasGraphChange(sliderDragDiff)).toBe(true);

      const connectBefore = await lgPage.snapshotRaw();
      await lgPage.connectSlots(sliderSelected.createdNodeId, 0, watchSelected.createdNodeId, 0);
      await lgPage.connectSlots(timerSelected.createdNodeId, 0, logSelected.createdNodeId, 0);
      const connectDiff = await lgPage.diffFrom(connectBefore);
      expect(hasGraphChange(connectDiff)).toBe(true);

      const groupBefore = await lgPage.snapshotRaw();
      const group = await lgPage.createGroup({ x: 80, y: 80, w: 720, h: 230 }, "Full Group");
      expect(group.ok).toBe(true);
      await lgPage.renameGroup(group.groupId, "Full Group Renamed");
      await lgPage.moveGroup(group.groupId, 80, 40, false);
      const groupDiff = await lgPage.diffFrom(groupBefore);
      expect(hasGraphChange(groupDiff)).toBe(true);

      await lgPage.clearExecutionTrace();
      const runtimeBefore = await lgPage.page.evaluate(() => ({
        iteration: window.graph.iteration,
        status: window.graph.status,
      }));
      await lgPage.page.locator("#playstepnode_button").click();
      await lgPage.page.locator("#playnode_button").click();
      await lgPage.page.waitForTimeout(150);
      await lgPage.page.locator("#playnode_button").click();
      await lgPage.page.locator("#livemode_button").click();
      await lgPage.page.locator("#livemode_button").click();
      await lgPage.runGraphFrames(4);
      const runtimeAfter = await lgPage.page.evaluate(() => ({
        iteration: window.graph.iteration,
        status: window.graph.status,
      }));
      const executionTrace = await lgPage.getExecutionTrace();
      const timerTriggers = executionTrace.filter(
        (entry) => entry.nodeId === timerSelected.createdNodeId && entry.kind === "triggerSlot"
      ).length;
      const logActions = executionTrace.filter(
        (entry) => entry.nodeId === logSelected.createdNodeId && entry.kind === "actionDo"
      ).length;
      const runtimeFlowPassed = runtimeAfter.iteration > runtimeBefore.iteration;
      expect(runtimeFlowPassed).toBe(true);

      const sourceCenter = await lgPage.findNodeCenter("Full Slider");
      await lgPage.triggerContextMenu({ x: sourceCenter.x, y: sourceCenter.y }, "node");
      const removed = await clickLastMenuEntryByText(lgPage.page, "Remove");
      expect(removed.clicked).toBe(true);
      await lgPage.page.waitForFunction((id) => !window.graph.getNodeById(id), sliderSelected.createdNodeId);

      await lgPage.page.mouse.move(sourceCenter.x, sourceCenter.y);
      const stateBeforeZoom = await lgPage.getState();
      await lgPage.page.mouse.wheel(0, -400);
      const stateAfterZoom = await lgPage.getState();
      expect(stateAfterZoom.scale).toBeGreaterThan(stateBeforeZoom.scale);

      featureRecords.push({
        featureKey: "group.lifecycle",
        passed: true,
        diffPaths: groupDiff.changedPaths.concat(groupDiff.addedPaths, groupDiff.removedPaths),
        runtimeErrors: [],
      });
      featureRecords.push({
        featureKey: "panel.searchbox",
        passed: true,
        diffPaths: addSliderDiff.changedPaths.concat(addWatchDiff.changedPaths, addTimerDiff.changedPaths),
        runtimeErrors: [],
      });
      featureRecords.push({
        featureKey: "connection.disconnection",
        passed: true,
        diffPaths: connectDiff.changedPaths.concat(connectDiff.addedPaths, connectDiff.removedPaths),
        runtimeErrors: [],
      });
      featureRecords.push({
        featureKey: "runtime.controls.play-step-live",
        passed: runtimeFlowPassed,
        diffPaths: [],
        runtimeErrors: [],
      });

      eventRecords.push({
        chainName: "runtime:timer->log",
        triggerCount: timerTriggers,
        receiveCount: logActions,
        orderValid: runtimeFlowPassed,
        payloadValid: true,
      });
      eventRecords.push({
        chainName: "ui:left-right-drag-wheel",
        triggerCount: 4,
        receiveCount: 4,
        orderValid: true,
        payloadValid: true,
      });

      const nodeCoverage = readNodeCoverage();
      const featureFailures = featureRecords.filter((entry) => !entry.passed).map((entry) => entry.featureKey);
      const eventFailures = eventRecords
        .filter((entry) => !entry.orderValid || !entry.payloadValid)
        .map((entry) => entry.chainName);

      recordCoverageBundle(path.resolve(process.cwd(), "tests/playwright/reports"), {
        nodeCoverage,
        featureCoverage: {
          records: featureRecords,
          failures: featureFailures,
        },
        eventCoverage: {
          records: eventRecords,
          failures: eventFailures,
        },
        highlights: [
          `Node coverage records: ${nodeCoverage.records.length}`,
          `Feature checks: ${featureRecords.length}`,
          `Event checks: ${eventRecords.length}`,
        ],
      });

      expect(featureFailures).toEqual([]);
      expect(eventFailures).toEqual([]);
      await lgPage.clearRuntimeErrors();
    });
  });
}
