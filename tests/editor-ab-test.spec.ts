import { type Page } from "@playwright/test";
import { test, expect } from "./fixtures/baseline";

type Target = {
    name: string;
    url: string;
};

type NodeState = {
    id: number | string;
    title: string | null;
    type: string | null;
    pos: [number, number];
    size: [number, number];
    screenCenter: [number, number];
};

type GraphSnapshot = {
    nodeCount: number;
    lastNode: NodeState | null;
};

const targets: Target[] = [
    { name: "legacy", url: "http://127.0.0.1:5500/editor/" },
    { name: "ts-migration", url: "http://127.0.0.1:5500/editor/index-ts.html" },
];

const baselineCoords = {
    stepA: { x: 717, y: 444 },
    stepBAddNode: { x: 757, y: 445 },
    stepBBasic: { x: 857, y: 466 },
    stepBConstNumber: { x: 957, y: 539 },
    stepCDragStart: { x: 807, y: 419 },
    stepCDragEnd: { x: 1027, y: 559 },
    stepDOpen: { x: 1027, y: 559 },
    stepDClose: { x: 392, y: 67 },
} as const;

async function snapshotGraph(page: Page): Promise<GraphSnapshot> {
    return await page.evaluate(() => {
        type RuntimeNode = {
            id: number | string;
            title?: string | null;
            type?: string | null;
            pos?: [number, number];
            size?: [number, number];
        };

        type RuntimeGraph = {
            _nodes?: RuntimeNode[];
        };

        type RuntimeGraphCanvas = {
            graph?: RuntimeGraph;
            ds?: {
                convertOffsetToCanvas?: (offset: [number, number]) => [number, number];
            };
        };

        const win = window as unknown as {
            graphcanvas?: RuntimeGraphCanvas;
            graph?: RuntimeGraph;
        };

        const graph = win.graphcanvas?.graph || win.graph;
        const nodes = Array.isArray(graph?._nodes) ? graph._nodes : [];
        const last = nodes.length ? nodes[nodes.length - 1] : null;

        if (!last || !last.pos || !last.size) {
            return {
                nodeCount: nodes.length,
                lastNode: null,
            };
        }

        let center: [number, number] = [
            Math.round(last.pos[0] + last.size[0] / 2),
            Math.round(last.pos[1] + last.size[1] / 2),
        ];

        const toCanvas = win.graphcanvas?.ds?.convertOffsetToCanvas;
        if (toCanvas) {
            const p = toCanvas([
                last.pos[0] + last.size[0] / 2,
                last.pos[1] + last.size[1] / 2,
            ]);
            center = [Math.round(p[0]), Math.round(p[1])];
        }

        return {
            nodeCount: nodes.length,
            lastNode: {
                id: last.id,
                title: last.title || null,
                type: last.type || null,
                pos: [last.pos[0], last.pos[1]],
                size: [last.size[0], last.size[1]],
                screenCenter: center,
            },
        };
    });
}

test.describe("editor A/B baseline replay", () => {
    for (const target of targets) {
        test(`${target.name}: right-click menu -> add node -> drag without console error`, async ({
            page,
        }) => {
            await page.goto(target.url);
            await page.setViewportSize({ width: 1440, height: 900 });

            await expect(page.locator("canvas").first()).toBeVisible();

            // Step A: right click in baseline center to open context menu.
            await page.mouse.click(baselineCoords.stepA.x, baselineCoords.stepA.y, {
                button: "right",
            });
            const menu = page.locator(".litecontextmenu").first();
            await expect(menu).toBeVisible();
            await expect(menu).toContainText(/Add Node/i);

            // Step B: replay baseline menu coordinates to create node.
            const before = await snapshotGraph(page);
            await page.mouse.click(
                baselineCoords.stepBAddNode.x,
                baselineCoords.stepBAddNode.y
            );
            await page.waitForTimeout(250);
            await page.mouse.click(
                baselineCoords.stepBBasic.x,
                baselineCoords.stepBBasic.y
            );
            await page.waitForTimeout(250);
            await page.mouse.click(
                baselineCoords.stepBConstNumber.x,
                baselineCoords.stepBConstNumber.y
            );
            await page.waitForTimeout(400);

            const afterCreate = await snapshotGraph(page);
            expect(afterCreate.nodeCount).toBeGreaterThan(before.nodeCount);
            expect(afterCreate.lastNode).not.toBeNull();

            // Step C: replay baseline drag.
            await page.mouse.move(
                baselineCoords.stepCDragStart.x,
                baselineCoords.stepCDragStart.y
            );
            await page.mouse.down({ button: "left" });
            await page.mouse.move(
                baselineCoords.stepCDragEnd.x,
                baselineCoords.stepCDragEnd.y,
                { steps: 12 }
            );
            await page.mouse.up({ button: "left" });
            await page.waitForTimeout(300);

            const afterDrag = await snapshotGraph(page);
            expect(afterDrag.lastNode).not.toBeNull();
            if (afterCreate.lastNode && afterDrag.lastNode) {
                expect(afterDrag.lastNode.pos[0]).not.toBe(afterCreate.lastNode.pos[0]);
                expect(afterDrag.lastNode.pos[1]).not.toBe(afterCreate.lastNode.pos[1]);
            }

            // Optional sanity check aligned with baseline map Step D.
            await page.mouse.dblclick(
                baselineCoords.stepDOpen.x,
                baselineCoords.stepDOpen.y
            );
            const settingsDialog = page.locator(".litegraph.dialog.settings").first();
            await expect(settingsDialog).toBeVisible();
            await page.mouse.click(
                baselineCoords.stepDClose.x,
                baselineCoords.stepDClose.y
            );
            await expect(page.locator(".litegraph.dialog.settings")).toHaveCount(0);
        });
    }
});

