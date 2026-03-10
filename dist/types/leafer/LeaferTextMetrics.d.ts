import { Group } from "leafer-ui";
export interface LeaferTextMetricsApi {
    measureTextWidth(text: string, font?: string): number;
    attachRoot(root: Group): void;
    detachRoot(root: Group): void;
    clearCache(): void;
}
export declare const MODERN_NODE_TITLE_MEASURE_FONT = "600 13px \"Aptos\", \"Segoe UI\", \"PingFang SC\", \"Microsoft YaHei\", sans-serif";
export declare function getSharedLeaferTextMetrics(): LeaferTextMetricsApi;
export declare function measureLeaferTextWidth(text: string, font?: string): number;
