const { diffGraphSnapshots } = require("../utils/graph-diff.cjs");
const {
  closeAllContextMenus,
  waitForMenuInteractive,
  clickLastMenuEntryByText,
} = require("../utils/context-menu-traverser.cjs");

class LiteGraphCanvasPage {
  constructor(page) {
    this.page = page;
    this.snapshotCounter = 0;
    this.snapshots = new Map();
  }

  async gotoEditor() {
    await this.page.goto("/editor/index.html");
    await this.waitForReady(false);
  }

  async waitForReady(requireHarness = true) {
    if (requireHarness) {
      await this.page.waitForFunction(() => !!window.graph && !!window.graphcanvas && !!window.__lgHarness);
      return;
    }
    await this.page.waitForFunction(() => !!window.graph && !!window.graphcanvas);
  }

  async getState() {
    return this.page.evaluate(() => window.__lgHarness.getState());
  }

  async findNodeCenter(title) {
    const center = await this.page.evaluate((nodeTitle) => window.__lgHarness.findNodeCenter(nodeTitle), title);
    if (!center) {
      throw new Error(`Node with title not found: ${title}`);
    }
    return center;
  }

  async getSlotCoordinates(nodeId, slotIndex, isInput) {
    const coords = await this.page.evaluate(
      ({ id, index, input }) => window.__lgHarness.getSlotCoordinates(id, index, input),
      { id: nodeId, index: slotIndex, input: Boolean(isInput) }
    );
    if (!coords) {
      throw new Error(`Slot coordinates not found for node=${nodeId}, slot=${slotIndex}, isInput=${isInput}`);
    }
    return coords;
  }

  async triggerContextMenu(pos, target = "canvas") {
    let screen = null;

    if (Array.isArray(pos)) {
      screen = await this.page.evaluate((graphPos) => window.__lgHarness.toScreen(graphPos), pos);
    } else if (typeof pos === "object" && pos !== null) {
      if (typeof pos.gx === "number" && typeof pos.gy === "number") {
        screen = await this.page.evaluate((graphPos) => window.__lgHarness.toScreen([graphPos.gx, graphPos.gy]), pos);
      } else if (typeof pos.x === "number" && typeof pos.y === "number") {
        screen = { x: pos.x, y: pos.y };
      }
    }

    if (!screen) {
      throw new Error(`Invalid context menu position for target '${target}'`);
    }

    await closeAllContextMenus(this.page);
    await this.page.mouse.click(screen.x, screen.y, { button: "right" });
    try {
      await waitForMenuInteractive(this.page, 1, 3000);
    } catch (error) {
      const graphPos = await this.page.evaluate((screenPos) => window.__lgHarness.toGraph(screenPos), screen);
      await this.page.evaluate(
        (graphPoint) => window.__lgHarness.triggerContextMenuAtGraphPos(graphPoint, "right"),
        graphPos
      );
      await waitForMenuInteractive(this.page, 1, 3000);
    }
    return screen;
  }

  async extractClickableRegions() {
    return this.page.evaluate(() => window.__lgHarness.extractClickableRegions());
  }

  async snapshotGraph(name = "") {
    const snapshot = await this.page.evaluate(() => window.__lgHarness.graphSnapshot());
    const id = `${name || "snapshot"}-${this.snapshotCounter}`;
    this.snapshotCounter += 1;
    this.snapshots.set(id, snapshot);
    return id;
  }

  async snapshotRaw() {
    return this.page.evaluate(() => window.__lgHarness.graphSnapshot());
  }

  async diffSince(snapshotId) {
    const before = this.snapshots.get(snapshotId);
    if (!before) {
      throw new Error(`Unknown snapshot id: ${snapshotId}`);
    }
    const after = await this.page.evaluate(() => window.__lgHarness.graphSnapshot());
    return diffGraphSnapshots(before, after);
  }

  async diffFrom(beforeSnapshot) {
    const after = await this.page.evaluate(() => window.__lgHarness.graphSnapshot());
    return diffGraphSnapshots(beforeSnapshot, after);
  }

  async restoreGraph(snapshot) {
    await this.page.evaluate((snap) => window.__lgHarness.restoreGraph(snap), snapshot);
    await this.page.waitForTimeout(80);
  }

  async restoreSnapshot(snapshotId) {
    const snapshot = this.snapshots.get(snapshotId);
    if (!snapshot) {
      throw new Error(`Unknown snapshot id: ${snapshotId}`);
    }
    await this.restoreGraph(snapshot);
  }

  async openNodePanel(nodeId) {
    const regions = await this.extractClickableRegions();
    const titleRegion = regions.find((region) => region.id === `node:${nodeId}:title`);
    const target = titleRegion ? titleRegion.centerScreen : null;

    if (!target) {
      throw new Error(`Title region not found for node ${nodeId}`);
    }

    await this.page.mouse.dblclick(target.x, target.y, { button: "left" });
    await this.page.locator("#node-panel").waitFor({ state: "visible" });
  }

  async renameNodeViaPanel(nodeId, nextTitle) {
    await this.openNodePanel(nodeId);

    const row = this.page
      .locator("#node-panel .property")
      .filter({ has: this.page.locator(".property_name", { hasText: "Title" }) })
      .first();
    const value = row.locator(".property_value");

    await value.click();
    await this.page.keyboard.press("Control+A");
    await this.page.keyboard.type(nextTitle);
    await this.page.keyboard.press("Tab");

    await this.page.waitForFunction(
      ({ id, title }) => {
        const node = window.graph.getNodeById(id);
        return !!node && node.title === title;
      },
      { id: nodeId, title: nextTitle }
    );
  }

  async deleteNodeViaPanel(nodeId) {
    await this.openNodePanel(nodeId);
    await this.page.locator("#node-panel .btn.delete").click();
    await this.page.waitForFunction((id) => !window.graph.getNodeById(id), nodeId);
  }

  async clickRegion(regionId, options = {}) {
    const regions = await this.extractClickableRegions();
    const target = regions.find((region) => region.id === regionId);
    if (!target) {
      throw new Error(`Region not found: ${regionId}`);
    }

    await this.page.mouse.click(target.centerScreen.x, target.centerScreen.y, options);
    return target;
  }

  async dragGraphPoint(fromGraphPos, toGraphPos, options = {}) {
    const from = await this.page.evaluate((p) => window.__lgHarness.toScreen(p), fromGraphPos);
    const to = await this.page.evaluate((p) => window.__lgHarness.toScreen(p), toGraphPos);

    await this.page.mouse.move(from.x, from.y);
    await this.page.mouse.down({ button: options.button || "left" });
    await this.page.mouse.move(to.x, to.y, { steps: options.steps || 18 });
    await this.page.mouse.up({ button: options.button || "left" });
  }

  async connectSlots(fromNodeId, fromOutputSlot, toNodeId, toInputSlot) {
    const from = await this.getSlotCoordinates(fromNodeId, fromOutputSlot, false);
    const to = await this.getSlotCoordinates(toNodeId, toInputSlot, true);

    await this.page.mouse.move(from.x, from.y);
    await this.page.mouse.down();
    await this.page.mouse.move(to.x, to.y, { steps: 20 });
    await this.page.mouse.up();
  }

  async disconnectByDraggingInput(nodeId, inputSlot, deltaX = 200, deltaY = 100) {
    const input = await this.getSlotCoordinates(nodeId, inputSlot, true);

    await this.page.mouse.move(input.x, input.y);
    await this.page.mouse.down();
    await this.page.mouse.move(input.x + deltaX, input.y + deltaY, { steps: 14 });
    await this.page.mouse.up();

    await closeAllContextMenus(this.page);
  }

  async addNodeByMenuPath(path, graphPos = [140, 120]) {
    if (!Array.isArray(path) || !path.length) {
      throw new Error("path must be a non-empty array");
    }

    await this.triggerContextMenu(graphPos, "canvas");

    let expectedMenus = 1;
    for (let i = 0; i < path.length; i += 1) {
      const segment = path[i];
      const result = await clickLastMenuEntryByText(this.page, segment);
      if (!result.clicked) {
        throw new Error(`Context menu path segment not found: ${segment}`);
      }

      if (result.hasSubmenu) {
        expectedMenus += 1;
        await waitForMenuInteractive(this.page, expectedMenus);
      } else {
        await this.page.waitForTimeout(100);
      }
    }

    await this.page.waitForTimeout(120);
  }

  async createNodesByType(nodes) {
    return this.page.evaluate((defs) => {
      const created = [];
      window.graph.clear();
      for (const def of defs) {
        const node = window.LiteGraph.createNode(def.type);
        if (!node) {
          continue;
        }
        node.pos = def.pos.slice();
        if (def.title) {
          node.title = def.title;
        }
        window.graph.add(node);
        created.push({
          id: node.id,
          type: node.type,
          title: node.title,
        });
      }
      window.graphcanvas.setDirty(true, true);
      window.graphcanvas.draw(true, true);
      return created;
    }, nodes);
  }

  async getStaticNodeManifest() {
    return this.page.evaluate(() => window.__lgHarness.getStaticNodeManifest());
  }

  async createNodeByType(type, pos = null, title = null) {
    return this.page.evaluate(
      ({ nodeType, graphPos, nodeTitle }) => window.__lgHarness.createNodeByType(nodeType, graphPos, nodeTitle),
      { nodeType: type, graphPos: pos, nodeTitle: title }
    );
  }

  async invokeNode(nodeId, mode = "auto") {
    return this.page.evaluate(
      ({ id, invokeMode }) => window.__lgHarness.invokeNode(id, invokeMode),
      { id: nodeId, invokeMode: mode }
    );
  }

  async setNodeMode(nodeId, modeName) {
    return this.page.evaluate(
      ({ id, mode }) => window.__lgHarness.setNodeMode(id, mode),
      { id: nodeId, mode: modeName }
    );
  }

  async getSelectedNodeIds() {
    return this.page.evaluate(() => window.__lgHarness.getSelectedNodeIds());
  }

  async getNodeFlags(nodeId) {
    return this.page.evaluate((id) => window.__lgHarness.getNodeFlags(id), nodeId);
  }

  async getNodeStyle(nodeId) {
    return this.page.evaluate((id) => window.__lgHarness.getNodeStyle(id), nodeId);
  }

  async cloneNodeByMenu(nodeId) {
    return this.page.evaluate((id) => window.__lgHarness.cloneNodeByMenu(id), nodeId);
  }

  async toggleNodeMenuOption(nodeId, optionText, optionValue = null) {
    return this.page.evaluate(
      ({ id, option, value }) => window.__lgHarness.toggleNodeMenuOption(id, option, value),
      { id: nodeId, option: optionText, value: optionValue }
    );
  }

  async openSubgraph(nodeId) {
    return this.page.evaluate((id) => window.__lgHarness.openSubgraph(id), nodeId);
  }

  async closeSubgraph() {
    return this.page.evaluate(() => window.__lgHarness.closeSubgraph());
  }

  async getCurrentGraphDepth() {
    return this.page.evaluate(() => window.__lgHarness.getCurrentGraphDepth());
  }

  async dispatchCanvasKeyChord(chord) {
    return this.page.evaluate((value) => window.__lgHarness.dispatchCanvasKeyChord(value), chord);
  }

  async addNodeFromCanvasMenu(path, at = null) {
    return this.page.evaluate(
      ({ menuPath, position }) => window.__lgHarness.addNodeFromCanvasMenu(menuPath, position),
      { menuPath: path, position: at }
    );
  }

  async openSearchBox(at = null, options = {}) {
    return this.page.evaluate(
      ({ position, searchOptions }) => window.__lgHarness.openSearchBox(position, searchOptions),
      { position: at, searchOptions: options }
    );
  }

  async getSearchBoxResults() {
    return this.page.evaluate(() => window.__lgHarness.getSearchBoxResults());
  }

  async selectSearchResult(label, exact = true) {
    return this.page.evaluate(
      ({ value, exactMatch }) => window.__lgHarness.selectSearchResult(value, exactMatch),
      { value: label, exactMatch: exact }
    );
  }

  async createGroup(bbox, title = "Group") {
    return this.page.evaluate(
      ({ groupBbox, groupTitle }) => window.__lgHarness.createGroup(groupBbox, groupTitle),
      { groupBbox: bbox, groupTitle: title }
    );
  }

  async renameGroup(groupId, title) {
    return this.page.evaluate(
      ({ id, groupTitle }) => window.__lgHarness.renameGroup(id, groupTitle),
      { id: groupId, groupTitle: title }
    );
  }

  async moveGroup(groupId, dx, dy, ignoreNodes = false) {
    return this.page.evaluate(
      ({ id, deltaX, deltaY, ignore }) => window.__lgHarness.moveGroup(id, deltaX, deltaY, ignore),
      { id: groupId, deltaX: dx, deltaY: dy, ignore: ignoreNodes }
    );
  }

  async deleteGroup(groupId) {
    return this.page.evaluate((id) => window.__lgHarness.deleteGroup(id), groupId);
  }

  async getGroupsState() {
    return this.page.evaluate(() => window.__lgHarness.getGroupsState());
  }

  async runGraphFrames(frameCount = 1) {
    return this.page.evaluate((count) => window.__lgHarness.runGraphFrames(count), frameCount);
  }

  async startGraph() {
    return this.page.evaluate(() => window.__lgHarness.startGraph());
  }

  async stopGraph() {
    return this.page.evaluate(() => window.__lgHarness.stopGraph());
  }

  async getExecutionTrace() {
    return this.page.evaluate(() => window.__lgHarness.getExecutionTrace());
  }

  async clearExecutionTrace() {
    await this.page.evaluate(() => window.__lgHarness.clearExecutionTrace());
  }

  async openGraphOptionsPanel() {
    return this.page.evaluate(() => window.__lgHarness.openGraphOptionsPanel());
  }

  async openNodePanelById(nodeId) {
    return this.page.evaluate((id) => window.__lgHarness.openNodePanel(id), nodeId);
  }

  async getNodeByTitle(title) {
    return this.page.evaluate((nodeTitle) => {
      const node = window.graph.findNodeByTitle(nodeTitle);
      if (!node) {
        return null;
      }
      return {
        id: node.id,
        type: node.type,
        title: node.title,
      };
    }, title);
  }

  async getGraphCounts() {
    return this.page.evaluate(() => {
      if (window.__lgHarness && typeof window.__lgHarness.getGraphCounts === "function") {
        return window.__lgHarness.getGraphCounts();
      }
      return {
        nodeCount: window.graph._nodes.length,
        linkCount: Object.keys(window.graph.links || {}).length,
        groupCount: (window.graph._groups || []).length,
      };
    });
  }

  async getRuntimeErrors() {
    return this.page.evaluate(() => window.__lgHarness.getErrors());
  }

  async clearRuntimeErrors() {
    await this.page.evaluate(() => window.__lgHarness.clearErrors());
  }

  async cleanupTransientUi() {
    await this.page.evaluate(() => {
      if (window.LiteGraph && typeof window.LiteGraph.closeAllContextMenus === "function") {
        window.LiteGraph.closeAllContextMenus(window);
      }

      for (const dialog of Array.from(document.querySelectorAll(".graphdialog"))) {
        if (typeof dialog.close === "function") {
          dialog.close();
        } else {
          dialog.remove();
        }
      }

      const nodePanel = document.querySelector("#node-panel");
      if (nodePanel && typeof nodePanel.close === "function") {
        nodePanel.close();
      }
      const optionPanel = document.querySelector("#option-panel");
      if (optionPanel && typeof optionPanel.close === "function") {
        optionPanel.close();
      }
    });
  }
}

module.exports = {
  LiteGraphCanvasPage,
};
