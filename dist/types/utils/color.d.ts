/**
 * Convert normalized rgb/rgba array to css rgba string.
 */
export declare function colorToString(c: string): string;
export declare function colorToString(c: ReadonlyArray<number>): string;
export declare function hex2num(hex: string): [number, number, number];
export declare function num2hex(triplet: [number, number, number]): string;
