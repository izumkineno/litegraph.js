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
}

interface ActiveLinkPresentationRequestMessage {
    readonly type: "compute-active-link-presentations";
    readonly requestId: number;
    readonly now: number;
    readonly tasks: ReadonlyArray<LeaferActiveLinkPresentationTask>;
}

interface ActiveLinkPresentationResultMessage {
    readonly type: "compute-active-link-presentations-result";
    readonly requestId: number;
    readonly results: ReadonlyArray<LeaferActiveLinkPresentationResult>;
}

type LeaferTaskWorkerMessage =
    | ActiveLinkPresentationRequestMessage
    | ActiveLinkPresentationResultMessage;

const WORKER_SOURCE = `
const PORT_DIRECTION_LEFT = 1
const PORT_DIRECTION_UP = 2
const PORT_DIRECTION_RIGHT = 3
const PORT_DIRECTION_DOWN = 4
const CURVE_CACHE_LIMIT = 4096
const ACTIVE_LINK_WINDOW_MS = 180
const ACTIVE_LINK_OPACITY_BUCKETS = 6
const curveCache = new Map()

const clamp01 = (value) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
const quantizeOpacity = (value) => {
  if (!(value > 0)) return 0
  return Math.round(clamp01(value) * ACTIVE_LINK_OPACITY_BUCKETS) / ACTIVE_LINK_OPACITY_BUCKETS
}
const resolveActiveLinkOpacity = (lastTime, now) => {
  const elapsed = now - lastTime
  if (elapsed < 0 || elapsed >= ACTIVE_LINK_WINDOW_MS) return 0
  return quantizeOpacity(1 - elapsed / ACTIVE_LINK_WINDOW_MS)
}

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

const buildActiveLinkPresentation = (task, now) => {
  const { layoutKey, curve } = getOrCreateCurve(task)
  const midpoint = cubicPointAt(curve.start, curve.c1, curve.c2, curve.end, 0.5)
  const lastTime = Number.isFinite(task.lastTime) ? task.lastTime : 0
  const opacity = lastTime ? resolveActiveLinkOpacity(lastTime, now) : 0
  const active = opacity > 0
  return {
    linkId: String(task.linkId),
    layoutKey,
    cacheKey: buildPresentationCacheKey(task),
    active,
    opacity,
    curve,
    midpoint
  }
}

self.onmessage = (event) => {
  const data = event.data
  if (!data) return

  if (data.type !== 'compute-active-link-presentations') return

  const now = Number.isFinite(data.now) ? data.now : 0
  const results = (Array.isArray(data.tasks) ? data.tasks : []).map((task) =>
    buildActiveLinkPresentation(task, now)
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
        this.activeLinkPresentationListener = null;
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
        tasks: ReadonlyArray<LeaferActiveLinkPresentationTask>
    ): number | null {
        if (!this.worker || !tasks.length) {
            return null;
        }

        const requestId = this.nextRequestId++;
        this.worker.postMessage({
            type: "compute-active-link-presentations",
            requestId,
            now,
            tasks,
        } satisfies ActiveLinkPresentationRequestMessage);
        return requestId;
    }
}
