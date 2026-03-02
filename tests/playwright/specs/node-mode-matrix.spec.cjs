const isBunRuntime = typeof Bun !== "undefined";

if (!isBunRuntime) {
  const { test, expect } = require("../fixtures/litegraph-harness.cjs");

  function summarize(trace, nodeId) {
    return {
      doExecute: trace.filter((entry) => entry.nodeId === nodeId && entry.kind === "doExecute").length,
      actionDo: trace.filter((entry) => entry.nodeId === nodeId && entry.kind === "actionDo").length,
    };
  }

  test.describe("node mode matrix", () => {
    test("@core mode matrix for Always/On Event/Never/On Trigger", async ({ lgPage }) => {
      await lgPage.createNodesByType([
        { type: "events/sequence", title: "Mode Sequence", pos: [120, 220] },
        { type: "events/log", title: "Mode Log", pos: [440, 120] },
        { type: "events/branch", title: "Mode Branch", pos: [440, 300] },
        { type: "events/log", title: "Mode Branch Log", pos: [760, 300] },
        { type: "basic/boolean", title: "Mode Cond", pos: [420, 400] },
      ]);

      const sequence = await lgPage.getNodeByTitle("Mode Sequence");
      const log = await lgPage.getNodeByTitle("Mode Log");
      const branch = await lgPage.getNodeByTitle("Mode Branch");
      const branchLog = await lgPage.getNodeByTitle("Mode Branch Log");
      const cond = await lgPage.getNodeByTitle("Mode Cond");

      await lgPage.page.evaluate(({ sequenceId, logId, branchId, condId, branchLogId }) => {
        const sequenceNode = window.graph.getNodeById(sequenceId);
        const logNode = window.graph.getNodeById(logId);
        const branchNode = window.graph.getNodeById(branchId);
        const condNode = window.graph.getNodeById(condId);
        const branchLogNode = window.graph.getNodeById(branchLogId);
        sequenceNode.connect(0, logNode, 0);
        sequenceNode.connect(1, branchNode, 0);
        condNode.connect(0, branchNode, 1);
        branchNode.connect(0, branchLogNode, 0);
        window.graphcanvas.setDirty(true, true);
        window.graphcanvas.draw(true, true);
      }, {
        sequenceId: sequence.id,
        logId: log.id,
        branchId: branch.id,
        condId: cond.id,
        branchLogId: branchLog.id,
      });
      await lgPage.page.evaluate((condId) => {
        const node = window.graph.getNodeById(condId);
        node.properties.value = true;
      }, cond.id);

      const modes = ["Always", "On Event", "Never", "On Trigger"];
      const results = {};

      for (const mode of modes) {
        const modeSet = await lgPage.setNodeMode(branch.id, mode);
        expect(modeSet.ok).toBe(true);
        const invokeResult = await lgPage.invokeNode(branch.id, "both");
        await lgPage.runGraphFrames(2);
        results[mode] = {
          modeLabel: modeSet.modeLabel,
          invokedExecute: !!invokeResult.invokedExecute,
          invokedAction: !!invokeResult.invokedAction,
        };
      }

      expect(results.Always.modeLabel).toBe("Always");
      expect(results["On Event"].modeLabel).toBe("On Event");
      expect(results.Never.modeLabel).toBe("Never");
      expect(results["On Trigger"].modeLabel).toBe("On Trigger");
      expect(results.Always.invokedExecute || results.Always.invokedAction).toBe(true);
      expect(results["On Event"].invokedExecute || results["On Event"].invokedAction).toBe(true);
      expect(results.Never.invokedExecute || results.Never.invokedAction).toBe(true);
      expect(results["On Trigger"].invokedExecute || results["On Trigger"].invokedAction).toBe(true);

      await lgPage.clearRuntimeErrors();
    });
  });
}
