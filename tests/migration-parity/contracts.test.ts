import fs from "fs";
import path from "path";
import {
    applyLiteGraphApiCompatAliases,
    invokeGraphOnNodeAddedCompatHook,
    LITEGRAPH_API_DIFF_MATRIX,
    normalizeSerializedLLinkTuple,
} from "../../src/ts-migration/types/litegraph-compat";
import {
    CONTEXT_MENU_CLOSE_ALL_DIFF_ID,
    isContextMenuCloseAllCompatSynced,
} from "../../src/ts-migration/ui/context-menu-compat";
import { GRID_SQUARE_SHAPE_DIFF_ID } from "../../src/ts-migration/core/litegraph.constants.compat";
import { LLINK_SERIALIZATION_DIFF_ID } from "../../src/ts-migration/models/LLink.serialization.compat";
import { LGRAPHGROUP_SERIALIZATION_DIFF_ID } from "../../src/ts-migration/models/LGraphGroup.serialization.compat";
import { LGRAPH_ON_NODE_ADDED_DIFF_ID } from "../../src/ts-migration/models/LGraph.hooks";
import {
    hasRequiredLGraphCanvasStaticApis,
    LGRAPHCANVAS_STATIC_MISSING_APIS_DIFF_ID,
    LGRAPHCANVAS_STATIC_RESIZE_DIFF_ID,
    LGRAPHCANVAS_STATIC_SUBGRAPH_MENU_DIFF_ID,
} from "../../src/ts-migration/canvas/LGraphCanvas.static.compat";

describe("migration parity: contracts snapshot", () => {
    const expectedDiffIds = [
        "constants.grid-square-alias",
        "canvas-static.resize",
        "canvas-static.subgraph-menu",
        "canvas-instance.deselected",
        "canvas-instance.slot-graphic",
        "canvas-instance.touch-handler",
        "serialization.link-tuple-order",
        "serialization.group-font-field",
        "ui.close-all-context-menus",
        "graph-hooks.on-node-added",
        "canvas-static.missing-apis",
    ] as const;

    test("LITEGRAPH_API_DIFF_MATRIX ID 快照稳定", () => {
        const ids = LITEGRAPH_API_DIFF_MATRIX.map((item) => item.id);
        expect(ids).toEqual(expectedDiffIds);
        expect(new Set(ids).size).toBe(ids.length);
    });

    test("契约矩阵文档与运行时矩阵保持同步", () => {
        const matrixPath = path.resolve(
            __dirname,
            "../../src/ts-migration/types/contract-diff-matrix.md"
        );
        const content = fs.readFileSync(matrixPath, "utf8");
        const docIds = content
            .split(/\r?\n/)
            .filter((line) => line.startsWith("| `"))
            .map((line) => line.split("|")[1].trim().replace(/`/g, ""));

        expect(docIds).toEqual(expectedDiffIds);
    });

    test("Phase E 模块差异 ID 全量挂接到总矩阵", () => {
        const matrixIds = new Set(LITEGRAPH_API_DIFF_MATRIX.map((item) => item.id));
        const phaseEIds = [
            GRID_SQUARE_SHAPE_DIFF_ID,
            LLINK_SERIALIZATION_DIFF_ID,
            LGRAPHGROUP_SERIALIZATION_DIFF_ID,
            CONTEXT_MENU_CLOSE_ALL_DIFF_ID,
            LGRAPH_ON_NODE_ADDED_DIFF_ID,
            LGRAPHCANVAS_STATIC_RESIZE_DIFF_ID,
            LGRAPHCANVAS_STATIC_SUBGRAPH_MENU_DIFF_ID,
            LGRAPHCANVAS_STATIC_MISSING_APIS_DIFF_ID,
        ];

        phaseEIds.forEach((id) => {
            expect(matrixIds.has(id)).toBe(true);
        });
    });

    test("统一兼容入口契约快照（Phase E 聚合）", () => {
        const closeAll = jest.fn();
        const onMenuResizeNode = jest.fn();
        const onMenuNodeToSubgraph = jest.fn();
        const deselectNode = jest.fn();
        const onNodeAdded = jest.fn();

        const targets = {
            liteGraph: {
                SQUARE_SHAPE: 9,
                ContextMenu: { closeAllContextMenus: closeAll },
            },
            canvasStatic: {
                onMenuResizeNode,
                onMenuNodeToSubgraph,
            },
            canvasPrototype: {
                deselectNode,
            },
        } as Record<string, any>;

        applyLiteGraphApiCompatAliases(targets);
        invokeGraphOnNodeAddedCompatHook({ onNodeAdded }, { id: 1 });

        const snapshot = {
            gridShape: targets.liteGraph.GRID_SHAPE,
            squareShape: targets.liteGraph.SQUARE_SHAPE,
            closeAllSynced: isContextMenuCloseAllCompatSynced(targets.liteGraph),
            canvasStaticHasRequiredApis: hasRequiredLGraphCanvasStaticApis(
                targets.canvasStatic
            ),
            canvasStaticAliases: {
                onResizeNode: targets.canvasStatic.onResizeNode === onMenuResizeNode,
                onNodeToSubgraph:
                    targets.canvasStatic.onNodeToSubgraph === onMenuNodeToSubgraph,
            },
            canvasPrototypeShims: {
                processNodeDeselected:
                    typeof targets.canvasPrototype.processNodeDeselected === "function",
                drawSlotGraphic:
                    typeof targets.canvasPrototype.drawSlotGraphic === "function",
                touchHandler: typeof targets.canvasPrototype.touchHandler === "function",
            },
            normalizedLink: normalizeSerializedLLinkTuple([1, "number", 2, 3, 4, 5]),
            nodeAddedCalls: onNodeAdded.mock.calls.length,
        };

        expect(snapshot).toMatchInlineSnapshot(`
{
  "canvasPrototypeShims": {
    "drawSlotGraphic": true,
    "processNodeDeselected": true,
    "touchHandler": true,
  },
  "canvasStaticAliases": {
    "onNodeToSubgraph": true,
    "onResizeNode": true,
  },
  "canvasStaticHasRequiredApis": true,
  "closeAllSynced": true,
  "gridShape": 9,
  "nodeAddedCalls": 1,
  "normalizedLink": [
    1,
    2,
    3,
    4,
    5,
    "number",
  ],
  "squareShape": 9,
}
`);
    });
});
