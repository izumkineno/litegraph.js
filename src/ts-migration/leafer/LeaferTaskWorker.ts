export type LeaferWorkerPoint = readonly [number, number];

export interface LeaferLinkFlowSampleTask {
    readonly linkId: string;
    readonly start: LeaferWorkerPoint;
    readonly c1: LeaferWorkerPoint;
    readonly c2: LeaferWorkerPoint;
    readonly end: LeaferWorkerPoint;
}

export interface LeaferLinkFlowSampleResult {
    readonly linkId: string;
    readonly dots: ReadonlyArray<LeaferWorkerPoint>;
}

interface LinkFlowSampleRequestMessage {
    readonly type: "sample-link-flow-dots";
    readonly requestId: number;
    readonly now: number;
    readonly dotCount: number;
    readonly tasks: ReadonlyArray<LeaferLinkFlowSampleTask>;
}

interface LinkFlowSampleResultMessage {
    readonly type: "sample-link-flow-dots-result";
    readonly requestId: number;
    readonly results: ReadonlyArray<LeaferLinkFlowSampleResult>;
}

type LeaferTaskWorkerMessage =
    | LinkFlowSampleRequestMessage
    | LinkFlowSampleResultMessage;

const WORKER_SOURCE = `
const cubicPointAt = (start, c1, c2, end, t) => {
  const clampedT = Math.max(0, Math.min(1, Number.isFinite(t) ? t : 0))
  const oneMinusT = 1 - clampedT
  const c1w = oneMinusT * oneMinusT * oneMinusT
  const c2w = 3 * oneMinusT * oneMinusT * clampedT
  const c3w = 3 * oneMinusT * clampedT * clampedT
  const c4w = clampedT * clampedT * clampedT
  return [
    c1w * start[0] + c2w * c1[0] + c3w * c2[0] + c4w * end[0],
    c1w * start[1] + c2w * c1[1] + c3w * c2[1] + c4w * end[1]
  ]
}

self.onmessage = (event) => {
  const data = event.data
  if (!data || data.type !== "sample-link-flow-dots") return

  const now = Number.isFinite(data.now) ? data.now : 0
  const dotCount = Math.max(1, Number.isFinite(data.dotCount) ? data.dotCount : 5)
  const results = (Array.isArray(data.tasks) ? data.tasks : []).map((task) => {
    const dots = []
    for (let index = 0; index < dotCount; ++index) {
      const t = (now * 0.001 + index * 0.2) % 1
      dots.push(cubicPointAt(task.start, task.c1, task.c2, task.end, t))
    }
    return { linkId: String(task.linkId), dots }
  })

  self.postMessage({
    type: "sample-link-flow-dots-result",
    requestId: data.requestId,
    results
  })
}
`;

function createWorkerUrl(): string | null {
    if (typeof URL === "undefined" || typeof Blob === "undefined") {
        return null;
    }
    const blob = new Blob([WORKER_SOURCE], {
        type: "text/javascript",
    });
    return URL.createObjectURL(blob);
}

export class LeaferTaskWorker {
    static isSupported(): boolean {
        return (
            typeof Worker !== "undefined" &&
            typeof URL !== "undefined" &&
            typeof Blob !== "undefined"
        );
    }

    private readonly worker: Worker | null;
    private readonly workerUrl: string | null;
    private nextRequestId = 1;
    private linkFlowListener:
        | ((
              requestId: number,
              results: ReadonlyArray<LeaferLinkFlowSampleResult>
          ) => void)
        | null = null;

    constructor(enabled = true) {
        if (!enabled || !LeaferTaskWorker.isSupported()) {
            this.worker = null;
            this.workerUrl = null;
            return;
        }

        const workerUrl = createWorkerUrl();
        if (!workerUrl) {
            this.worker = null;
            this.workerUrl = null;
            return;
        }

        this.workerUrl = workerUrl;
        this.worker = new Worker(workerUrl, { name: "litegraph-leafer-task-worker" });
        this.worker.onmessage = (event: MessageEvent<LeaferTaskWorkerMessage>) => {
            const data = event.data;
            if (!data || data.type !== "sample-link-flow-dots-result") {
                return;
            }
            this.linkFlowListener?.(data.requestId, data.results);
        };
    }

    destroy(): void {
        this.worker?.terminate();
        if (this.workerUrl && typeof URL !== "undefined") {
            URL.revokeObjectURL(this.workerUrl);
        }
        this.linkFlowListener = null;
    }

    onLinkFlowSample(
        listener:
            | ((
                  requestId: number,
                  results: ReadonlyArray<LeaferLinkFlowSampleResult>
              ) => void)
            | null
    ): void {
        this.linkFlowListener = listener;
    }

    requestLinkFlowSample(
        now: number,
        tasks: ReadonlyArray<LeaferLinkFlowSampleTask>,
        dotCount = 5
    ): number | null {
        if (!this.worker || !tasks.length) {
            return null;
        }

        const requestId = this.nextRequestId++;
        this.worker.postMessage({
            type: "sample-link-flow-dots",
            requestId,
            now,
            dotCount,
            tasks,
        } satisfies LinkFlowSampleRequestMessage);
        return requestId;
    }
}
