import { LGraphExecution } from "../../src/ts-migration/models/LGraph.execution";
import { LGraphNodeExecution } from "../../src/ts-migration/models/LGraphNode.execution";

describe("LGraph execution runtime", () => {
    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    test("start(0) uses an immediate first tick and keeps Leafer scheduling for subsequent frames", async () => {
        const graph = new LGraphExecution();
        const scheduledFrames: Array<() => void> = [];
        const leaferApp = {
            nextRender: jest.fn((item: () => void, bind?: object) => {
                scheduledFrames.push(bind ? item.bind(bind) : item);
            }),
            removeNextRender: jest.fn(),
            requestRender: jest.fn(),
        };

        (graph as unknown as { list_of_graphcanvas: unknown[] }).list_of_graphcanvas =
            [
                {
                    renderRuntime: "leafer",
                    leaferAppHost: { app: leaferApp },
                },
            ];

        const flushSpy = jest.spyOn(graph, "flushRuntimeExecutionRender");
        const runStepSpy = jest.spyOn(graph, "runStep").mockImplementation(() => {
            graph.iteration += 1;
        });

        graph.start(0);

        expect(leaferApp.nextRender).not.toHaveBeenCalled();
        expect(leaferApp.requestRender).not.toHaveBeenCalled();
        expect(runStepSpy).not.toHaveBeenCalled();

        await Promise.resolve();

        expect(runStepSpy).toHaveBeenCalledWith(1, !graph.catch_errors);
        expect(flushSpy).toHaveBeenCalledTimes(1);
        expect(leaferApp.nextRender).toHaveBeenCalledTimes(1);
        expect(leaferApp.requestRender).toHaveBeenCalledTimes(1);

        scheduledFrames.shift()?.();

        expect(runStepSpy).toHaveBeenCalledTimes(2);
        expect(flushSpy).toHaveBeenCalledTimes(2);
        expect(leaferApp.nextRender).toHaveBeenCalledTimes(2);
        expect(leaferApp.requestRender).toHaveBeenCalledTimes(2);

        graph.stop();
        expect(leaferApp.removeNextRender).toHaveBeenCalled();
    });

    test("start(interval) uses self-scheduling timeouts instead of setInterval", () => {
        jest.useFakeTimers();

        const graph = new LGraphExecution();
        const setIntervalSpy = jest.spyOn(global, "setInterval");
        const runStepSpy = jest.spyOn(graph, "runStep").mockImplementation(() => {
            graph.iteration += 1;
        });

        graph.start(5);
        jest.advanceTimersByTime(16);

        expect(setIntervalSpy).not.toHaveBeenCalled();
        expect(runStepSpy).toHaveBeenCalledTimes(3);

        graph.stop();
        jest.advanceTimersByTime(20);

        expect(runStepSpy).toHaveBeenCalledTimes(3);
    });

    test("runStep uses doExecute in both catch and non-catch paths", () => {
        const graph = new LGraphExecution();
        const node = new LGraphNodeExecution("Runtime");

        node.id = 5;
        node.mode = 0;
        node.order = 0;
        node.graph = graph as unknown as typeof node.graph;
        node.onExecute = jest.fn();

        const doExecuteSpy = jest.spyOn(node, "doExecute");

        (graph as unknown as { _nodes_executable: unknown[] })._nodes_executable = [
            node,
        ];

        graph.runStep(1, false);
        graph.runStep(1, true);

        expect(doExecuteSpy).toHaveBeenCalledTimes(2);
        expect(node.onExecute).toHaveBeenCalledTimes(2);
        expect(node.execute_triggered).toBe(2);
    });

    test("runStep defers dirty node forwarding until explicit runtime flush", () => {
        const graph = new LGraphExecution();
        const requestRuntimeRender = jest.fn();
        const flushDeferredNodeDirtySignals = jest.fn();

        (graph as unknown as { list_of_graphcanvas: unknown[] }).list_of_graphcanvas =
            [
                {
                    renderRuntime: "leafer",
                    requestRuntimeRender,
                    sceneSyncController: {
                        flushDeferredNodeDirtySignals,
                    },
                },
            ];

        const cleanNode = {
            id: 1,
            mode: 0,
            order: 0,
            constructor: {},
            pos: [0, 0],
            size: [140, 60],
            getInputNode: () => null,
            onExecute: jest.fn(),
            doExecute: jest.fn(),
        };

        (graph as unknown as { _nodes_executable: unknown[] })._nodes_executable = [
            cleanNode,
        ];
        graph.runStep(1, false);

        expect(cleanNode.doExecute).toHaveBeenCalledTimes(1);
        expect(requestRuntimeRender).not.toHaveBeenCalled();

        const dirtyNode = new LGraphNodeExecution("Dirty");
        dirtyNode.id = 7;
        dirtyNode.mode = 0;
        dirtyNode.order = 0;
        dirtyNode.graph = graph as unknown as typeof dirtyNode.graph;
        dirtyNode.onExecute = jest.fn();

        (graph as unknown as { _nodes_executable: unknown[] })._nodes_executable = [
            dirtyNode,
        ];
        graph.runStep(1, false);

        expect(requestRuntimeRender).not.toHaveBeenCalled();
        graph.flushRuntimeExecutionRender();
        expect(flushDeferredNodeDirtySignals).toHaveBeenCalledTimes(1);
        expect(requestRuntimeRender).toHaveBeenCalledWith(true, [7]);

        graph.flushRuntimeExecutionRender();
        expect(flushDeferredNodeDirtySignals).toHaveBeenCalledTimes(2);
        expect(requestRuntimeRender).toHaveBeenCalledTimes(1);
    });
});
