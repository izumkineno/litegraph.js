const isBunRuntime = typeof Bun !== "undefined";

if (!isBunRuntime) {
  const { test, expect } = require("@playwright/test");

  test.describe("dialog and prompt", () => {
    test("@core ts-migration prompt and property-value dialog smoke", async ({ page }) => {
      await page.goto("/editor/index-ts.html");
      await page.waitForFunction(() => !!window.graph && !!window.graphcanvas);

      const source = await page.evaluate(() => {
        const graph = window.graph;
        const LiteGraph = window.LiteGraph;
        graph.stop();
        graph.clear();

        const node = LiteGraph.createNode("basic/const");
        node.pos = [180, 180];
        node.title = "Prompt Const";
        graph.add(node);
        window.graphcanvas.setDirty(true, true);
        window.graphcanvas.draw(true, true);
        return { id: node.id };
      });
      expect(source && source.id != null).toBeTruthy();

      await page.evaluate(() => {
        window.__promptProbe = null;
        window.graphcanvas.prompt("Value", "12", (value) => {
          window.__promptProbe = value;
        });
      });

      const promptDialog = page.locator(".graphdialog").last();
      await expect(promptDialog).toBeVisible();
      await promptDialog.locator(".value").fill("34");
      await promptDialog.getByRole("button", { name: "OK" }).click();
      await page.waitForFunction(() => window.__promptProbe === "34");

      const propertyName = await page.evaluate((nodeId) => {
        const node = window.graph.getNodeById(nodeId);
        if (!node) {
          return null;
        }
        if (Object.prototype.hasOwnProperty.call(node.properties || {}, "value")) {
          return "value";
        }
        const keys = Object.keys(node.properties || {});
        return keys.length ? keys[0] : null;
      }, source.id);
      expect(propertyName).toBeTruthy();

      await page.evaluate(({ nodeId, prop }) => {
        const node = window.graph.getNodeById(nodeId);
        window.graphcanvas.showEditPropertyValue(node, prop, {});
      }, { nodeId: source.id, prop: propertyName });

      const propertyDialog = page.locator(".graphdialog").last();
      await expect(propertyDialog).toBeVisible();
      const valueInput = propertyDialog.locator(".value");
      await valueInput.fill("56");
      await propertyDialog.getByRole("button", { name: "OK" }).click();

      await page.waitForFunction(({ nodeId, prop }) => {
        const node = window.graph.getNodeById(nodeId);
        return !!node && String(node.properties[prop]) === "56";
      }, { nodeId: source.id, prop: propertyName });
    });
  });
}
