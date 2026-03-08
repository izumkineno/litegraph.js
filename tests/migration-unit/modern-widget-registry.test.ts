import {
    ModernNodeBase,
    getModernWidgetRenderer,
    registerModernWidget,
    registerModernWidgets,
} from "../../src/ts-migration/leafer";
import {
    ensureDefaultModernWidgetRenderers,
    resolveModernWidgetRenderer,
} from "../../src/ts-migration/leafer/ModernWidgetRegistry";

class WidgetTestNode extends ModernNodeBase {
    static type = "modern/widget_test";

    protected definePorts() {
        return { inputs: [], outputs: [] };
    }

    protected mountView(): unknown {
        return null;
    }
}

describe("modern widget registry", () => {
    test("ModernNodeBase.defineWidgets defaults to an empty schema list", () => {
        const node = new WidgetTestNode();
        expect(node.defineWidgets()).toEqual([]);
    });

    test("registerModernWidget and getModernWidgetRenderer share one global registry", () => {
        const renderer = {
            createView: jest.fn(() => ({
                root: {},
                bounds: { x: 0, y: 0, width: 10, height: 10 },
            })),
            patchView: jest.fn(),
        };
        const replacement = {
            createView: jest.fn(() => ({
                root: {},
                bounds: { x: 0, y: 0, width: 12, height: 12 },
            })),
            patchView: jest.fn(),
        };

        expect(registerModernWidget("test/widget", renderer)).toBe("test/widget");
        expect(getModernWidgetRenderer("test/widget")).toBe(renderer);

        registerModernWidget("test/widget", replacement);
        expect(getModernWidgetRenderer("test/widget")).toBe(replacement);
    });

    test("registerModernWidgets batch-registers renderers", () => {
        const alpha = {
            createView: jest.fn(() => ({
                root: {},
                bounds: { x: 0, y: 0, width: 8, height: 8 },
            })),
            patchView: jest.fn(),
        };
        const beta = {
            createView: jest.fn(() => ({
                root: {},
                bounds: { x: 0, y: 0, width: 9, height: 9 },
            })),
            patchView: jest.fn(),
        };

        expect(
            registerModernWidgets({
                "test/widget_alpha": alpha,
                "test/widget_beta": beta,
            })
        ).toEqual(["test/widget_alpha", "test/widget_beta"]);
        expect(getModernWidgetRenderer("test/widget_alpha")).toBe(alpha);
        expect(getModernWidgetRenderer("test/widget_beta")).toBe(beta);
    });

    test("default modern widget renderers are available for the five built-in widget types", () => {
        ensureDefaultModernWidgetRenderers();

        expect(resolveModernWidgetRenderer("button")).toBeDefined();
        expect(resolveModernWidgetRenderer("toggle")).toBeDefined();
        expect(resolveModernWidgetRenderer("text")).toBeDefined();
        expect(resolveModernWidgetRenderer("number")).toBeDefined();
        expect(resolveModernWidgetRenderer("combo")).toBeDefined();
    });
});
