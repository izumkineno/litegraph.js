// TODO: Import LiteGraph runtime host from its future module

export type TimeSource = () => number;

export interface TimeSourceHost {
    getTime: TimeSource;
}

/**
 * timer that works everywhere
 */
export function createTimeSource(): TimeSource {
    if (typeof performance != "undefined") {
        return performance.now.bind(performance);
    }
    if (typeof Date != "undefined" && Date.now) {
        return Date.now.bind(Date);
    }

    const processLike = (globalThis as { process?: { hrtime?: () => [number, number] } }).process;
    if (typeof processLike != "undefined") {
        return function(): number {
            const t = processLike.hrtime!();
            return t[0] * 0.001 + t[1] * 1e-6;
        };
    }

    return function getTime(): number {
        return new Date().getTime();
    };
}

export function attachTimeSource(host: TimeSourceHost): void {
    host.getTime = createTimeSource();
}
