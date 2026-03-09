export type LeaferWorkerPoint = readonly [number, number];

export interface LeaferWorkerLinkCurve {
    readonly start: LeaferWorkerPoint;
    readonly end: LeaferWorkerPoint;
    readonly startDir: number;
    readonly endDir: number;
    readonly c1: LeaferWorkerPoint;
    readonly c2: LeaferWorkerPoint;
    readonly path: string;
}

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

export interface LeaferActiveLinkPresentationTask {
    readonly linkId: string;
    readonly start: LeaferWorkerPoint;
    readonly end: LeaferWorkerPoint;
    readonly startDir: number;
    readonly endDir: number;
    readonly lastTime: number;
}

export interface LeaferActiveLinkPresentationResult {
    readonly linkId: string;
    readonly layoutKey: string;
    readonly cacheKey: string;
    readonly active: boolean;
    readonly opacity: number;
    readonly curve: LeaferWorkerLinkCurve;
    readonly midpoint: LeaferWorkerPoint;
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

interface ActiveLinkPresentationRequestMessage {
    readonly type: "compute-active-link-presentations";
    readonly requestId: number;
    readonly now: number;
    readonly dotCount: number;
    readonly tasks: ReadonlyArray<LeaferActiveLinkPresentationTask>;
}

interface ActiveLinkPresentationResultMessage {
    readonly type: "compute-active-link-presentations-result";
    readonly requestId: number;
    readonly results: ReadonlyArray<LeaferActiveLinkPresentationResult>;
}

type LeaferTaskWorkerMessage =
    | LinkFlowSampleRequestMessage
    | LinkFlowSampleResultMessage
    | ActiveLinkPresentationRequestMessage
    | ActiveLinkPresentationResultMessage;

const WORKER_SOURCE = `
const PORT_DIRECTION_LEFT = 1
const PORT_DIRECTION_UP = 2
const PORT_DIRECTION_RIGHT = 3
const PORT_DIRECTION_DOWN = 4
const CURVE_CACHE_LIMIT = 4096
const curveCache = new Map()

const clamp01 = (value) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))

const cacheSet = (map, key, value, limit) => {
  if (map.has(key)) map.delete(key)
  map.set(key, value)
  if (map.size > limit) {
    const first = map.keys().next()
    if (!first.done) map.delete(first.value)
  }
}

const cubicPointAt = (start, c1, c2, end, t) => {
  const clampedT = clamp01(t)
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

const formatPoint = (point) => \`\${point[0]},\${point[1]}\`

const buildLayoutKey = (task) =>
  [
    String(task.linkId),
    formatPoint(task.start),
    formatPoint(task.end),
    Number(task.startDir) || 0,
    Number(task.endDir) || 0
  ].join('|')

const buildPresentationCacheKey = (task) => {
  const lastTime = Number.isFinite(task.lastTime) ? task.lastTime : 0
  const lastTimeBucket = Math.max(0, Math.floor(lastTime / 16))
  return \`\${buildLayoutKey(task)}|\${lastTimeBucket}\`
}

const buildLinkCurve = (start, end, startDir, endDir) => {
  const safeStart = [Number(start[0]) || 0, Number(start[1]) || 0]
  const safeEnd = [Number(end[0]) || 0, Number(end[1]) || 0]
  const dx = safeEnd[0] - safeStart[0]
  const dy = safeEnd[1] - safeStart[1]
  const dist = Math.max(Math.hypot(dx, dy), 16)
  const c1 = [safeStart[0], safeStart[1]]
  const c2 = [safeEnd[0], safeEnd[1]]

  if (startDir === PORT_DIRECTION_LEFT) c1[0] += dist * -0.25
  else if (startDir === PORT_DIRECTION_RIGHT) c1[0] += dist * 0.25
  else if (startDir === PORT_DIRECTION_UP) c1[1] += dist * -0.25
  else if (startDir === PORT_DIRECTION_DOWN) c1[1] += dist * 0.25

  if (endDir === PORT_DIRECTION_LEFT) c2[0] += dist * -0.25
  else if (endDir === PORT_DIRECTION_RIGHT) c2[0] += dist * 0.25
  else if (endDir === PORT_DIRECTION_UP) c2[1] += dist * -0.25
  else if (endDir === PORT_DIRECTION_DOWN) c2[1] += dist * 0.25

  return {
    start: safeStart,
    end: safeEnd,
    startDir,
    endDir,
    c1,
    c2,
    path: \`M \${safeStart[0]} \${safeStart[1]} C \${c1[0]} \${c1[1]} \${c2[0]} \${c2[1]} \${safeEnd[0]} \${safeEnd[1]}\`
  }
}

const getOrCreateCurve = (task) => {
  const layoutKey = buildLayoutKey(task)
  const cached = curveCache.get(layoutKey)
  if (cached) {
    return { layoutKey, curve: cached }
  }

  const curve = buildLinkCurve(task.start, task.end, task.startDir, task.endDir)
  cacheSet(curveCache, layoutKey, curve, CURVE_CACHE_LIMIT)
  return { layoutKey, curve }
}

const buildActiveLinkPresentation = (task, now, dotCount) => {
  const { layoutKey, curve } = getOrCreateCurve(task)
  const midpoint = cubicPointAt(curve.start, curve.c1, curve.c2, curve.end, 0.5)
  const lastTime = Number.isFinite(task.lastTime) ? task.lastTime : 0
  const elapsed = now - lastTime
  const active = !!lastTime && elapsed >= 0 && elapsed < 1000
  const opacity = active ? Math.max(0, Math.min(1, 2 - elapsed * 0.002)) : 0
  const dots = []
  if (active) {
    for (let index = 0; index < dotCount; ++index) {
      const t = (now * 0.001 + index * 0.2) % 1
      dots.push(cubicPointAt(curve.start, curve.c1, curve.c2, curve.end, t))
    }
  }
  return {
    linkId: String(task.linkId),
    layoutKey,
    cacheKey: buildPresentationCacheKey(task),
    active,
    opacity,
    curve,
    midpoint,
    dots
  }
}

self.onmessage = (event) => {
  const data = event.data
  if (!data) return

  if (data.type === 'sample-link-flow-dots') {
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
      type: 'sample-link-flow-dots-result',
      requestId: data.requestId,
      results
    })
    return
  }

  if (data.type !== 'compute-active-link-presentations') return

  const now = Number.isFinite(data.now) ? data.now : 0
  const dotCount = Math.max(1, Number.isFinite(data.dotCount) ? data.dotCount : 5)
  const results = (Array.isArray(data.tasks) ? data.tasks : []).map((task) =>
    buildActiveLinkPresentation(task, now, dotCount)
  )

  self.postMessage({
    type: 'compute-active-link-presentations-result',
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
    private activeLinkPresentationListener:
        | ((
              requestId: number,
              results: ReadonlyArray<LeaferActiveLinkPresentationResult>
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
            if (!data) {
                return;
            }
            if (data.type === "sample-link-flow-dots-result") {
                this.linkFlowListener?.(data.requestId, data.results);
                return;
            }
            if (data.type === "compute-active-link-presentations-result") {
                this.activeLinkPresentationListener?.(data.requestId, data.results);
            }
        };
    }

    destroy(): void {
        this.worker?.terminate();
        if (this.workerUrl && typeof URL !== "undefined") {
            URL.revokeObjectURL(this.workerUrl);
        }
        this.linkFlowListener = null;
        this.activeLinkPresentationListener = null;
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

    onActiveLinkPresentation(
        listener:
            | ((
                  requestId: number,
                  results: ReadonlyArray<LeaferActiveLinkPresentationResult>
              ) => void)
            | null
    ): void {
        this.activeLinkPresentationListener = listener;
    }

    requestActiveLinkPresentations(
        now: number,
        tasks: ReadonlyArray<LeaferActiveLinkPresentationTask>,
        dotCount = 5
    ): number | null {
        if (!this.worker || !tasks.length) {
            return null;
        }

        const requestId = this.nextRequestId++;
        this.worker.postMessage({
            type: "compute-active-link-presentations",
            requestId,
            now,
            dotCount,
            tasks,
        } satisfies ActiveLinkPresentationRequestMessage);
        return requestId;
    }
}
