/**
 * Convert normalized rgb/rgba array to css rgba string.
 */
export function colorToString(c: string): string;
export function colorToString(c: ReadonlyArray<number>): string;
export function colorToString(c: string | ReadonlyArray<number>): string {
    const source = c as ReadonlyArray<number>;
    return (
        "rgba(" +
        Math.round(source[0] * 255).toFixed() +
        "," +
        Math.round(source[1] * 255).toFixed() +
        "," +
        Math.round(source[2] * 255).toFixed() +
        "," +
        (source.length == 4 ? source[3].toFixed(2) : "1.0") +
        ")"
    );
}

// Convert a hex value to its decimal value - the inputted hex must be in the
// format of a hex triplet - the kind we use for HTML colours. The function
// will return an array with three values.
export function hex2num(hex: string): [number, number, number] {
    if (hex.charAt(0) == "#") {
        hex = hex.slice(1);
    } // Remove the '#' char - if there is one.
    hex = hex.toUpperCase();
    const hexAlphabets = "0123456789ABCDEF";
    const value: [number, number, number] = [0, 0, 0];
    let k = 0;
    let int1: number;
    let int2: number;
    for (let i = 0; i < 6; i += 2) {
        int1 = hexAlphabets.indexOf(hex.charAt(i));
        int2 = hexAlphabets.indexOf(hex.charAt(i + 1));
        value[k] = int1 * 16 + int2;
        k++;
    }
    return value;
}

// Give a array with three values as the argument and the function will return
// the corresponding hex triplet.
export function num2hex(triplet: [number, number, number]): string {
    const hexAlphabets = "0123456789ABCDEF";
    let hex = "#";
    let int1: number;
    let int2: number;
    for (let i = 0; i < 3; i++) {
        int1 = triplet[i] / 16;
        int2 = triplet[i] % 16;

        hex += hexAlphabets.charAt(int1) + hexAlphabets.charAt(int2);
    }
    return hex;
}
