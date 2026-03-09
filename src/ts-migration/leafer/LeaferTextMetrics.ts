import { Group, Text } from "leafer-ui";

const DEFAULT_FONT_TOKEN =
    '600 13px "Aptos", "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif';
const DEFAULT_FONT_SIZE = 13;
const DEFAULT_FONT_WEIGHT = 600;
const DEFAULT_FONT_FAMILY =
    '"Aptos", "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif';

interface ParsedFontToken {
    readonly token: string;
    readonly fontSize: number;
    readonly fontWeight: string | number;
    readonly fontFamily: string;
    readonly italic: boolean;
}

export interface LeaferTextMetricsApi {
    measureTextWidth(text: string, font?: string): number;
    attachRoot(root: Group): void;
    detachRoot(root: Group): void;
    clearCache(): void;
}

function normalizeWhitespace(value: string): string {
    return value.replace(/\s+/g, " ").trim();
}

function parseFontToken(font?: string): ParsedFontToken {
    const token = normalizeWhitespace(font || DEFAULT_FONT_TOKEN) || DEFAULT_FONT_TOKEN;
    const sizeMatch = token.match(/(\d+(?:\.\d+)?)px/);
    const fontSize = sizeMatch ? Number(sizeMatch[1]) : DEFAULT_FONT_SIZE;
    const sizeIndex = sizeMatch ? sizeMatch.index || 0 : -1;
    const sizeLength = sizeMatch ? sizeMatch[0].length : 0;
    const head = sizeMatch ? normalizeWhitespace(token.slice(0, sizeIndex)) : "";
    let tail = sizeMatch
        ? normalizeWhitespace(token.slice(sizeIndex + sizeLength))
        : DEFAULT_FONT_FAMILY;

    if (tail.startsWith("/")) {
        tail = normalizeWhitespace(tail.replace(/^\/[^\s]+\s*/, ""));
    }

    const fontWeightMatch = head.match(/\b(?:normal|bold|bolder|lighter|[1-9]00)\b/i);
    const fontStyleMatch = head.match(/\b(?:italic|oblique)\b/i);
    const resolvedWeight = fontWeightMatch?.[0] || DEFAULT_FONT_WEIGHT;
    const resolvedStyle = fontStyleMatch?.[0];

    return {
        token,
        fontSize: Number.isFinite(fontSize) && fontSize > 0 ? fontSize : DEFAULT_FONT_SIZE,
        fontWeight: /^\d+$/.test(String(resolvedWeight))
            ? Number(resolvedWeight)
            : resolvedWeight,
        fontFamily: tail || DEFAULT_FONT_FAMILY,
        italic: resolvedStyle === "italic" || resolvedStyle === "oblique",
    };
}

function approximateTextWidth(text: string, font: ParsedFontToken): number {
    if (!text) {
        return 0;
    }

    let units = 0;
    for (const character of text) {
        if (character === " ") {
            units += 0.34;
            continue;
        }
        if (/[\u0000-\u00ff]/.test(character)) {
            units += /[ilI1.,'`|]/.test(character) ? 0.34 : 0.58;
            continue;
        }
        units += 1;
    }

    const weightScale =
        typeof font.fontWeight === "number" && font.fontWeight >= 600 ? 1.02 : 0.96;
    return units * font.fontSize * weightScale;
}

class LeaferTextMetrics implements LeaferTextMetricsApi {
    private readonly widthCache = new Map<string, number>();
    private measurementRoot: Group | null = null;
    private probeText: Text | null = null;

    measureTextWidth(text: string, font?: string): number {
        const safeText = String(text || "");
        const parsedFont = parseFontToken(font);
        const cacheKey = `${parsedFont.token}\n${safeText}`;
        const cachedWidth = this.widthCache.get(cacheKey);
        if (cachedWidth != null) {
            return cachedWidth;
        }

        const measuredWidth = this.measureWithLeafer(safeText, parsedFont);
        const resolvedWidth =
            measuredWidth != null ? measuredWidth : approximateTextWidth(safeText, parsedFont);
        this.widthCache.set(cacheKey, resolvedWidth);
        return resolvedWidth;
    }

    attachRoot(root: Group): void {
        if (this.measurementRoot === root) {
            return;
        }
        this.measurementRoot = root;
        this.probeText = null;
    }

    detachRoot(root: Group): void {
        if (this.measurementRoot !== root) {
            return;
        }
        this.measurementRoot = null;
        this.probeText = null;
    }

    clearCache(): void {
        this.widthCache.clear();
    }

    private measureWithLeafer(
        text: string,
        font: ParsedFontToken
    ): number | null {
        if (!this.measurementRoot) {
            return null;
        }

        const probeText = this.ensureProbeText();
        probeText.text = text;
        probeText.fontSize = font.fontSize;
        probeText.fontWeight = font.fontWeight as never;
        probeText.fontFamily = font.fontFamily;
        probeText.italic = font.italic;

        const bounds = probeText.boxBounds;
        const width =
            bounds && Number.isFinite(bounds.width) ? Number(bounds.width) : NaN;
        return Number.isFinite(width) ? width : null;
    }

    private ensureProbeText(): Text {
        if (
            this.measurementRoot &&
            this.probeText &&
            (this.probeText.parent as unknown) !== this.measurementRoot
        ) {
            this.probeText = null;
        }
        if (this.probeText) {
            return this.probeText;
        }

        const probeText = new Text({
            name: "litegraph-text-metrics-probe",
            text: "",
            visible: false,
            hittable: false,
            textWrap: "none",
            opacity: 0,
            fontSize: DEFAULT_FONT_SIZE,
            fontWeight: DEFAULT_FONT_WEIGHT,
            fontFamily: DEFAULT_FONT_FAMILY,
        });
        this.measurementRoot?.add(probeText);
        this.probeText = probeText;
        return probeText;
    }
}

const sharedLeaferTextMetrics = new LeaferTextMetrics();

export const MODERN_NODE_TITLE_MEASURE_FONT = DEFAULT_FONT_TOKEN;

export function getSharedLeaferTextMetrics(): LeaferTextMetricsApi {
    return sharedLeaferTextMetrics;
}

export function measureLeaferTextWidth(text: string, font?: string): number {
    return sharedLeaferTextMetrics.measureTextWidth(text, font);
}
