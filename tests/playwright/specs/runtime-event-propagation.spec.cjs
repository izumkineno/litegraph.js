const isBunRuntime = typeof Bun !== "undefined";

if (!isBunRuntime) {
  const { test, expect } = require("../fixtures/litegraph-harness.cjs");

  test.describe("runtime event propagation", () => {
    test("@core runtime chain coverage: trigger/sequence/timer/waitAll/delay/once", async ({ lgPage }) => {
      test.slow();

      await lgPage.createNodesByType([
        { type: "events/trigger", title: "RT Trigger", pos: [80, 120] },
        { type: "events/sequence", title: "RT Sequence", pos: [320, 120] },
        { type: "events/log", title: "RT Log 1", pos: [560, 120] },

        { type: "events/timer", title: "RT Timer", pos: [80, 320] },
        { type: "events/counter", title: "RT Counter", pos: [320, 320] },
        { type: "events/branch", title: "RT Branch", pos: [560, 320] },
        { type: "events/log", title: "RT Log 2", pos: [820, 320] },
        { type: "basic/boolean", title: "RT Cond", pos: [560, 470] },

        { type: "events/sequence", title: "RT Sync Sequence", pos: [80, 560] },
        { type: "events/waitAll", title: "RT WaitAll", pos: [320, 560] },
        { type: "events/semaphore", title: "RT Semaphore", pos: [560, 560] },
        { type: "events/log", title: "RT Log 3", pos: [820, 560] },

        { type: "events/once", title: "RT Once", pos: [80, 760] },
        { type: "events/delay", title: "RT Delay", pos: [320, 760] },
        { type: "events/log", title: "RT Log 4", pos: [560, 760] },
      ]);

      const trigger = await lgPage.getNodeByTitle("RT Trigger");
      const sequence = await lgPage.getNodeByTitle("RT Sequence");
      const log1 = await lgPage.getNodeByTitle("RT Log 1");
      const timer = await lgPage.getNodeByTitle("RT Timer");
      const counter = await lgPage.getNodeByTitle("RT Counter");
      const branch = await lgPage.getNodeByTitle("RT Branch");
      const log2 = await lgPage.getNodeByTitle("RT Log 2");
      const cond = await lgPage.getNodeByTitle("RT Cond");
      const syncSequence = await lgPage.getNodeByTitle("RT Sync Sequence");
      const waitAll = await lgPage.getNodeByTitle("RT WaitAll");
      const semaphore = await lgPage.getNodeByTitle("RT Semaphore");
      const log3 = await lgPage.getNodeByTitle("RT Log 3");
      const once = await lgPage.getNodeByTitle("RT Once");
      const delay = await lgPage.getNodeByTitle("RT Delay");
      const log4 = await lgPage.getNodeByTitle("RT Log 4");

      await lgPage.page.evaluate((ids) => {
        const byId = (id) => window.graph.getNodeById(id);
        byId(ids.trigger).connect(0, byId(ids.sequence), 0);
        byId(ids.sequence).connect(0, byId(ids.log1), 0);

        byId(ids.timer).connect(0, byId(ids.counter), 0);
        byId(ids.counter).connect(0, byId(ids.branch), 0);
        byId(ids.cond).connect(0, byId(ids.branch), 1);
        byId(ids.branch).connect(0, byId(ids.log2), 0);

        byId(ids.syncSequence).connect(0, byId(ids.waitAll), 0);
        byId(ids.syncSequence).connect(1, byId(ids.waitAll), 1);
        byId(ids.waitAll).connect(0, byId(ids.semaphore), 1);
        byId(ids.semaphore).connect(0, byId(ids.log3), 0);

        byId(ids.once).connect(0, byId(ids.delay), 0);
        byId(ids.delay).connect(0, byId(ids.log4), 0);

        window.graphcanvas.setDirty(true, true);
        window.graphcanvas.draw(true, true);
      }, {
        trigger: trigger.id,
        sequence: sequence.id,
        log1: log1.id,
        timer: timer.id,
        counter: counter.id,
        branch: branch.id,
        log2: log2.id,
        cond: cond.id,
        syncSequence: syncSequence.id,
        waitAll: waitAll.id,
        semaphore: semaphore.id,
        log3: log3.id,
        once: once.id,
        delay: delay.id,
        log4: log4.id,
      });

      await lgPage.page.evaluate(({ timerId, condId, delayId }) => {
        const timerNode = window.graph.getNodeById(timerId);
        const condNode = window.graph.getNodeById(condId);
        const delayNode = window.graph.getNodeById(delayId);
        timerNode.properties.interval = 1;
        timerNode.properties.event = "tick";
        condNode.properties.value = true;
        delayNode.properties.time_in_ms = 1;
      }, { timerId: timer.id, condId: cond.id, delayId: delay.id });

      const chain1Invoke = await lgPage.invokeNode(sequence.id, "action");
      await lgPage.runGraphFrames(3);
      expect(chain1Invoke.invokedAction).toBe(true);

      const counterBefore = await lgPage.page.evaluate((counterId) => {
        const node = window.graph.getNodeById(counterId);
        return node ? node.num : 0;
      }, counter.id);
      await lgPage.runGraphFrames(8);
      const counterAfter = await lgPage.page.evaluate((counterId) => {
        const node = window.graph.getNodeById(counterId);
        return node ? node.num : 0;
      }, counter.id);
      expect(counterAfter).toBeGreaterThan(counterBefore);

      await lgPage.invokeNode(semaphore.id, "action");
      const syncInvoke = await lgPage.invokeNode(syncSequence.id, "action");
      await lgPage.invokeNode(semaphore.id, "action");
      await lgPage.runGraphFrames(3);
      expect(syncInvoke.invokedAction).toBe(true);
      const semaphoreReady = await lgPage.page.evaluate((semaphoreId) => {
        const node = window.graph.getNodeById(semaphoreId);
        return !!(node && node._ready);
      }, semaphore.id);
      expect(semaphoreReady).toBe(true);

      await lgPage.invokeNode(once.id, "action");
      await lgPage.runGraphFrames(4);
      const onceLocked = await lgPage.page.evaluate((onceId) => {
        const node = window.graph.getNodeById(onceId);
        return !!(node && node._once);
      }, once.id);
      expect(onceLocked).toBe(true);

      await lgPage.page.evaluate((onceId) => {
        const node = window.graph.getNodeById(onceId);
        node.actionDo("reset", null, { action_call: `${node.id}_manual_reset` }, 1);
      }, once.id);
      const onceReset = await lgPage.page.evaluate((onceId) => {
        const node = window.graph.getNodeById(onceId);
        return !!(node && node._once);
      }, once.id);
      expect(onceReset).toBe(false);

      await lgPage.clearRuntimeErrors();
    });
  });
}
