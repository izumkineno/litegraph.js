const fs = require("fs");

const isBunRuntime = typeof Bun !== "undefined";

if (!isBunRuntime) {
  const { test, expect } = require("@playwright/test");

  const runtimes = [
    { name: "legacy", path: "/editor/index.html", runtime: "legacy" },
    { name: "ts-migration", path: "/editor/index-ts.html", runtime: "ts-migration" },
  ];

  async function gotoRuntime(page, runtimePath) {
    await page.goto(runtimePath);
    await page.waitForFunction(
      () => !!window.graph && !!window.graphcanvas && !!window.editor && !!document.querySelector("#benchmark_button")
    );
  }

  async function seedGraph(page, options = {}) {
    await page.evaluate(({ running, liveMode, scale, offset }) => {
      const graph = window.graph;
      const graphcanvas = window.graphcanvas;
      const LiteGraph = window.LiteGraph;

      graph.stop();
      graph.clear();

      const source = LiteGraph.createNode("basic/const");
      source.pos = [160, 180];
      source.title = "Benchmark Seed Source";
      const watch = LiteGraph.createNode("basic/watch");
      watch.pos = [520, 180];
      watch.title = "Benchmark Seed Watch";

      graph.add(source);
      graph.add(watch);
      source.connect(0, watch, 0);

      graphcanvas.ds.scale = scale;
      graphcanvas.ds.offset[0] = offset[0];
      graphcanvas.ds.offset[1] = offset[1];
      graphcanvas.live_mode = !!liveMode;
      graphcanvas.editor_alpha = liveMode ? 0 : 1;
      graphcanvas.allow_interaction = true;
      graphcanvas.canvas.style.pointerEvents = "";
      graphcanvas.setDirty(true, true);
      graphcanvas.draw(true, true);

      if (running) {
        graph.start();
      }
      if (window.editor && typeof window.editor.refreshRuntimeButtons === "function") {
        window.editor.refreshRuntimeButtons({
          running: !!running,
          live_mode: !!liveMode,
        });
      }
    }, {
      running: !!options.running,
      liveMode: !!options.liveMode,
      scale: options.scale || 1.2,
      offset: options.offset || [180, -40],
    });
  }

  async function captureState(page) {
    return page.evaluate(() => ({
      serialized: JSON.stringify(window.graph.serialize()),
      status: window.graph.status,
      liveMode: !!window.graphcanvas.live_mode,
      scale: window.graphcanvas.ds.scale,
      offset: [window.graphcanvas.ds.offset[0], window.graphcanvas.ds.offset[1]],
      nodeCount: window.graph._nodes.length,
    }));
  }

  async function getDownloadJson(download) {
    const filePath = await download.path();
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  }

  async function assertMetrics(page, runtimeLabel, expectedNodes) {
    const report = await page.evaluate(() => window.editor.benchmark.lastResults);
    expect(report.runtime).toBe(runtimeLabel);
    expect(report.preset).toBe("quick");
    expect(report.scenarios).toHaveLength(4);

    for (const scenario of report.scenarios) {
      expect(scenario.id).toBeTruthy();
      expect(scenario.config.nodes).toBe(expectedNodes);
      if (scenario.id === "data-runtime" || scenario.id === "event-runtime") {
        expect(scenario.config.links).toBe(expectedNodes - 1);
      }
      for (const value of Object.values(scenario.metrics)) {
        expect(Number.isFinite(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(0);
      }
    }
  }

  test.describe("benchmark panel", () => {
    for (const runtime of runtimes) {
      test(`@core benchmark run/export/restore on ${runtime.name}`, async ({ page }) => {
        await gotoRuntime(page, runtime.path);
        await seedGraph(page, { running: true, liveMode: true, scale: 1.35, offset: [240, -80] });
        const before = await captureState(page);

        await expect(page.locator("#benchmark_button")).toBeVisible();
        await page.locator("#benchmark_button").click();
        await expect(page.locator("#benchmark-panel")).toBeVisible();
        await page.locator("#benchmark-node-count").fill("128");

        await page.locator("#benchmark-run").click();
        await page.waitForFunction(() => window.editor.benchmark && window.editor.benchmark.state === "running");

        const lockState = await page.evaluate(() => ({
          allowInteraction: window.graphcanvas.allow_interaction,
          demoDisabled: document.querySelector("#lg-demo-selector").disabled,
          saveDisabled: document.querySelector("#save").disabled,
          loadDisabled: document.querySelector("#load").disabled,
          downloadDisabled: document.querySelector("#download").disabled,
          playDisabled: document.querySelector("#playnode_button").disabled,
          stepDisabled: document.querySelector("#playstepnode_button").disabled,
          liveDisabled: document.querySelector("#livemode_button").disabled,
        }));
        expect(lockState.allowInteraction).toBe(false);
        expect(lockState.demoDisabled).toBe(true);
        expect(lockState.saveDisabled).toBe(true);
        expect(lockState.loadDisabled).toBe(true);
        expect(lockState.downloadDisabled).toBe(true);
        expect(lockState.playDisabled).toBe(true);
        expect(lockState.stepDisabled).toBe(true);
        expect(lockState.liveDisabled).toBe(true);

        await page.waitForFunction(() => window.editor.benchmark && window.editor.benchmark.state === "idle", null, {
          timeout: 120000,
        });
        await assertMetrics(page, runtime.runtime, 128);

        const after = await captureState(page);
        expect(after.serialized).toBe(before.serialized);
        expect(after.status).toBe(before.status);
        expect(after.liveMode).toBe(before.liveMode);
        expect(after.scale).toBe(before.scale);
        expect(after.offset).toEqual(before.offset);
        expect(after.nodeCount).toBe(before.nodeCount);

        const downloadPromise = page.waitForEvent("download");
        await page.locator("#benchmark-export").click();
        const download = await downloadPromise;
        expect(download.suggestedFilename()).toContain(`litegraph-benchmark-${runtime.runtime}-quick-`);
        const json = await getDownloadJson(download);
        expect(json.runtime).toBe(runtime.runtime);
        expect(json.preset).toBe("quick");
        expect(json.scenarios).toHaveLength(4);
        expect(json.scenarios[0].config.nodes).toBe(128);
      });

      test(`@core benchmark stop restores graph on ${runtime.name}`, async ({ page }) => {
        await gotoRuntime(page, runtime.path);
        await seedGraph(page, { running: false, liveMode: false, scale: 0.95, offset: [120, 60] });
        const before = await captureState(page);

        await page.locator("#benchmark_button").click();
        await expect(page.locator("#benchmark-panel")).toBeVisible();
        await page.locator("#benchmark-preset").selectOption("stress");
        await page.locator("#benchmark-run").click();
        await page.waitForFunction(() => window.editor.benchmark && window.editor.benchmark.state === "running");
        await page.locator("#benchmark-stop").click();
        await page.waitForFunction(() => window.editor.benchmark && window.editor.benchmark.state === "idle", null, {
          timeout: 120000,
        });

        const after = await captureState(page);
        expect(after.serialized).toBe(before.serialized);
        expect(after.status).toBe(before.status);
        expect(after.liveMode).toBe(before.liveMode);
        expect(after.scale).toBe(before.scale);
        expect(after.offset).toEqual(before.offset);
        expect(after.nodeCount).toBe(before.nodeCount);
        await expect(page.locator("#benchmark-panel .benchmark-message")).toHaveText(/已停止/);
      });
    }
  });
}
