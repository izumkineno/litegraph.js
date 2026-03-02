const isBunRuntime = typeof Bun !== "undefined";

if (!isBunRuntime) {
  const { test, expect } = require("../fixtures/litegraph-harness.cjs");
  const { hasGraphChange } = require("../utils/graph-diff.cjs");

  async function getNodePos(lgPage, nodeId) {
    return lgPage.page.evaluate((id) => {
      const node = window.graph.getNodeById(id);
      return node ? [node.pos[0], node.pos[1]] : null;
    }, nodeId);
  }

  test.describe("group lifecycle", () => {
    test("@core create/move/rename/add/delete group with nodes", async ({ lgPage }) => {
      await lgPage.createNodesByType([
        { type: "basic/const", title: "Group A", pos: [120, 180] },
        { type: "basic/watch", title: "Group B", pos: [340, 180] },
      ]);

      const nodeA = await lgPage.getNodeByTitle("Group A");
      const nodeB = await lgPage.getNodeByTitle("Group B");
      expect(nodeA).toBeTruthy();
      expect(nodeB).toBeTruthy();

      const createBefore = await lgPage.snapshotRaw();
      const group = await lgPage.createGroup({ x: 80, y: 120, w: 420, h: 220 }, "Primary Group");
      const createDiff = await lgPage.diffFrom(createBefore);
      expect(group.ok).toBe(true);
      expect(hasGraphChange(createDiff)).toBe(true);

      const stateAfterCreate = await lgPage.getGroupsState();
      const createdGroup = stateAfterCreate.find((entry) => entry.groupId === group.groupId);
      expect(createdGroup).toBeTruthy();
      expect(createdGroup.nodeIds).toContain(nodeA.id);
      expect(createdGroup.nodeIds).toContain(nodeB.id);

      const posABefore = await getNodePos(lgPage, nodeA.id);
      const posBBefore = await getNodePos(lgPage, nodeB.id);

      const moveBefore = await lgPage.snapshotRaw();
      const moved = await lgPage.moveGroup(group.groupId, 150, 90, false);
      const moveDiff = await lgPage.diffFrom(moveBefore);
      expect(moved.ok).toBe(true);
      expect(hasGraphChange(moveDiff)).toBe(true);

      const posAAfter = await getNodePos(lgPage, nodeA.id);
      const posBAfter = await getNodePos(lgPage, nodeB.id);
      expect(posAAfter[0] - posABefore[0]).toBeCloseTo(150, 0);
      expect(posAAfter[1] - posABefore[1]).toBeCloseTo(90, 0);
      expect(posBAfter[0] - posBBefore[0]).toBeCloseTo(150, 0);
      expect(posBAfter[1] - posBBefore[1]).toBeCloseTo(90, 0);

      const renameBefore = await lgPage.snapshotRaw();
      const renamed = await lgPage.renameGroup(group.groupId, "Renamed Group");
      const renameDiff = await lgPage.diffFrom(renameBefore);
      expect(renamed.ok).toBe(true);
      expect(hasGraphChange(renameDiff)).toBe(true);

      const movedGroupState = await lgPage.getGroupsState();
      const renamedGroup = movedGroupState.find((entry) => entry.groupId === group.groupId);
      expect(renamedGroup.title).toBe("Renamed Group");

      const addInsideBefore = await lgPage.snapshotRaw();
      const addInside = await lgPage.createNodeByType(
        "basic/boolean",
        [renamedGroup.bounding[0] + 80, renamedGroup.bounding[1] + 100],
        "Group C"
      );
      const addInsideDiff = await lgPage.diffFrom(addInsideBefore);
      expect(addInside.created).toBe(true);
      expect(hasGraphChange(addInsideDiff)).toBe(true);

      const stateWithAdded = await lgPage.getGroupsState();
      const groupWithAdded = stateWithAdded.find((entry) => entry.groupId === group.groupId);
      expect(groupWithAdded.nodeIds).toContain(addInside.nodeId);

      const deleteBefore = await lgPage.snapshotRaw();
      const removed = await lgPage.deleteGroup(group.groupId);
      const deleteDiff = await lgPage.diffFrom(deleteBefore);
      expect(removed.ok).toBe(true);
      expect(hasGraphChange(deleteDiff)).toBe(true);

      const finalGroups = await lgPage.getGroupsState();
      expect(finalGroups.find((entry) => entry.groupId === group.groupId)).toBeFalsy();

      const finalCounts = await lgPage.getGraphCounts();
      expect(finalCounts.nodeCount).toBe(3);
      expect(finalCounts.groupCount).toBe(0);

      await lgPage.clearRuntimeErrors();
    });
  });
}

