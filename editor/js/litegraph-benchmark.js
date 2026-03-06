(function(global) {
    var LiteGraph = global.LiteGraph;

    if (!LiteGraph) {
        return;
    }

    var BENCHMARK_PRESETS = {
        quick: { id: "quick", label: "快速", nodes: 100, links: 99, warmupSteps: 10, sampleFrames: 120 },
        balanced: { id: "balanced", label: "均衡", nodes: 300, links: 299, warmupSteps: 20, sampleFrames: 180 },
        stress: { id: "stress", label: "压力", nodes: 600, links: 599, warmupSteps: 30, sampleFrames: 240 }
    };

    var BENCHMARK_SCENARIOS = [
        { id: "node-create", label: "节点创建" },
        { id: "node-delete", label: "节点删除" },
        { id: "data-runtime", label: "数据连线运行" },
        { id: "event-runtime", label: "事件连线运行" }
    ];

    var BENCHMARK_CONTROL_SELECTORS = [
        "#lg-demo-selector",
        "#save",
        "#load",
        "#download",
        "#webgl",
        "#multiview",
        "#playnode_button",
        "#playstepnode_button",
        "#livemode_button",
        "#maximize_button"
    ];

    var STATUS_LABELS = {
        idle: "空闲",
        running: "运行中",
        restoring: "恢复中",
        error: "错误"
    };

    function now() {
        if (global.performance && typeof global.performance.now === "function") {
            return global.performance.now();
        }
        return Date.now();
    }

    function cloneSerializable(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function round(value) {
        return Number(Number(value || 0).toFixed(4));
    }

    function normalizeNodeCount(value, fallback) {
        var parsed = Math.round(Number(value));
        if (!Number.isFinite(parsed)) {
            parsed = fallback;
        }
        if (parsed < 2) {
            parsed = 2;
        }
        return parsed;
    }

    function formatMs(value) {
        if (!Number.isFinite(value)) {
            return "--";
        }
        return round(value).toFixed(2) + " ms";
    }

    function formatFps(value) {
        if (!Number.isFinite(value)) {
            return "--";
        }
        return round(value).toFixed(1);
    }

    function average(values) {
        if (!values || !values.length) {
            return 0;
        }
        var total = 0;
        for (var i = 0; i < values.length; i += 1) {
            total += values[i];
        }
        return total / values.length;
    }

    function max(values) {
        if (!values || !values.length) {
            return 0;
        }
        return Math.max.apply(Math, values);
    }

    function min(values) {
        if (!values || !values.length) {
            return 0;
        }
        return Math.min.apply(Math, values);
    }

    function percentile(values, p) {
        if (!values || !values.length) {
            return 0;
        }
        var sorted = values.slice().sort(function(a, b) {
            return a - b;
        });
        var index = Math.ceil((p / 100) * sorted.length) - 1;
        if (index < 0) {
            index = 0;
        }
        if (index >= sorted.length) {
            index = sorted.length - 1;
        }
        return sorted[index];
    }

    function toMilliseconds(valueInSeconds) {
        return Number(valueInSeconds || 0) * 1000;
    }

    function nextFrame() {
        return new Promise(function(resolve) {
            global.requestAnimationFrame(function() {
                resolve();
            });
        });
    }

    function delay(ms) {
        return new Promise(function(resolve) {
            global.setTimeout(resolve, ms);
        });
    }

    function ensureBenchmarkNodesRegistered() {
        if (LiteGraph.__editorBenchmarkNodesRegistered) {
            return;
        }

        function register(type, ctor) {
            if (LiteGraph.registered_node_types && LiteGraph.registered_node_types[type]) {
                return;
            }
            LiteGraph.registerNodeType(type, ctor);
        }

        function BenchmarkEmpty() {
            this.addInput("in", "number");
            this.addOutput("out", "number");
            this.size = [110, 36];
        }
        BenchmarkEmpty.title = "基准空节点";
        BenchmarkEmpty.desc = "性能基准使用的最小节点壳";

        function BenchmarkDataSource() {
            this.addOutput("value", "number");
            this.size = [120, 40];
            this._tick = 0;
        }
        BenchmarkDataSource.title = "基准数据源";
        BenchmarkDataSource.prototype.onExecute = function() {
            this._tick += 1;
            this.setOutputData(0, this._tick);
        };

        function BenchmarkDataPipe() {
            this.addInput("in", "number");
            this.addOutput("out", "number");
            this.size = [100, 36];
        }
        BenchmarkDataPipe.title = "基准数据中继";
        BenchmarkDataPipe.prototype.onExecute = function() {
            this.setOutputData(0, this.getInputData(0));
        };

        function BenchmarkDataSink() {
            this.addInput("in", "number");
            this.size = [100, 36];
            this.lastValue = 0;
        }
        BenchmarkDataSink.title = "基准数据终点";
        BenchmarkDataSink.prototype.onExecute = function() {
            this.lastValue = this.getInputData(0);
        };

        function BenchmarkEventPulse() {
            this.addOutput("event", LiteGraph.EVENT);
            this.size = [120, 40];
            this._tick = 0;
        }
        BenchmarkEventPulse.title = "基准事件脉冲";
        BenchmarkEventPulse.prototype.onExecute = function() {
            this._tick += 1;
            this.triggerSlot(0, this._tick);
        };

        function BenchmarkEventPipe() {
            this.addInput("event", LiteGraph.ACTION);
            this.addOutput("event", LiteGraph.EVENT);
            this.size = [100, 36];
        }
        BenchmarkEventPipe.title = "基准事件中继";
        BenchmarkEventPipe.prototype.onAction = function(action, param, options) {
            this.triggerSlot(0, param, null, options);
        };

        function BenchmarkEventSink() {
            this.addInput("event", LiteGraph.ACTION);
            this.size = [100, 36];
            this.eventCount = 0;
        }
        BenchmarkEventSink.title = "基准事件终点";
        BenchmarkEventSink.prototype.onAction = function() {
            this.eventCount += 1;
        };

        register("benchmark/empty", BenchmarkEmpty);
        register("benchmark/data_source", BenchmarkDataSource);
        register("benchmark/data_pipe", BenchmarkDataPipe);
        register("benchmark/data_sink", BenchmarkDataSink);
        register("benchmark/event_pulse", BenchmarkEventPulse);
        register("benchmark/event_pipe", BenchmarkEventPipe);
        register("benchmark/event_sink", BenchmarkEventSink);

        LiteGraph.__editorBenchmarkNodesRegistered = true;
    }

    function EditorBenchmark(editor) {
        this.editor = editor;
        this.graph = editor.graph;
        this.graphcanvas = editor.graphcanvas;
        this.panel = null;
        this.ui = null;
        this.state = "idle";
        this.lastResults = null;
        this.lastError = null;
        this.abortRequested = false;
        this.activeRuntimeCanceler = null;
        this.disabledControls = [];
        this.canvasPointerEvents = "";
    }

    EditorBenchmark.prototype.getRuntimeLabel = function() {
        return global.__liteGraphTsDemoBundle ? "ts-migration" : "legacy";
    };

    EditorBenchmark.prototype.getRuntimeDisplayLabel = function() {
        return this.getRuntimeLabel() === "ts-migration" ? "TS 迁移版" : "经典版";
    };

    EditorBenchmark.prototype.isBusy = function() {
        return this.state === "running" || this.state === "restoring";
    };

    EditorBenchmark.prototype.isEphemeralStateActive = function() {
        return this.isBusy();
    };

    EditorBenchmark.prototype.openBenchmarkPanel = function() {
        ensureBenchmarkNodesRegistered();
        var panel = this.ensurePanel();
        this.renderResults();
        this.syncUi();
        if (panel.parentNode !== this.editor.root) {
            this.editor.root.appendChild(panel);
        } else {
            this.editor.root.appendChild(panel);
        }
        return panel;
    };

    EditorBenchmark.prototype.ensurePanel = function() {
        if (this.panel && this.panel.parentNode) {
            return this.panel;
        }

        var panel = this.graphcanvas.createPanel("性能基准", { closable: true, width: 840 });
        var that = this;
        panel.id = "benchmark-panel";
        panel.classList.add("benchmark-panel");
        panel.style.position = "absolute";
        panel.style.top = "46px";
        panel.style.right = "12px";
        panel.style.width = "min(880px, calc(100% - 24px))";
        panel.style.maxHeight = "calc(100% - 96px)";
        panel.style.overflow = "hidden";
        panel.style.zIndex = 5;

        var controls = panel.addHTML(
            "<div class='benchmark-toolbar'>" +
                "<label class='benchmark-label' for='benchmark-preset'>预设</label>" +
                "<select id='benchmark-preset' class='benchmark-select'>" +
                    "<option value='quick'>快速</option>" +
                    "<option value='balanced'>均衡</option>" +
                    "<option value='stress'>压力</option>" +
                "</select>" +
                "<label class='benchmark-label' for='benchmark-node-count'>节点数</label>" +
                "<input id='benchmark-node-count' class='benchmark-number' type='number' min='2' step='1' value='100' />" +
                "<span class='benchmark-runtime badge'></span>" +
                "<span class='benchmark-status' data-state='idle'>空闲</span>" +
            "</div>" +
            "<div class='benchmark-config-note'></div>" +
            "<div class='benchmark-message'></div>",
            "benchmark-section benchmark-controls"
        );

        var summary = panel.addHTML(
            "<div class='benchmark-summary-grid'>" +
                "<div class='benchmark-summary-card' data-key='next-step'><span class='benchmark-summary-label'>下一步延迟</span><strong class='benchmark-summary-value'>--</strong></div>" +
                "<div class='benchmark-summary-card' data-key='start-latency'><span class='benchmark-summary-label'>启动延迟</span><strong class='benchmark-summary-value'>--</strong></div>" +
                "<div class='benchmark-summary-card' data-key='fps'><span class='benchmark-summary-label'>帧率</span><strong class='benchmark-summary-value'>--</strong></div>" +
                "<div class='benchmark-summary-card' data-key='create-clear'><span class='benchmark-summary-label'>创建 / 清理</span><strong class='benchmark-summary-value'>--</strong></div>" +
            "</div>",
            "benchmark-section"
        );

        var tableWrap = panel.addHTML(
            "<div class='benchmark-table-wrap'>" +
                "<table class='benchmark-results-table'>" +
                    "<thead><tr>" +
                        "<th>场景</th>" +
                        "<th>节点数</th>" +
                        "<th>连线数</th>" +
                        "<th>创建 / 构建</th>" +
                        "<th>下一步</th>" +
                        "<th>启动</th>" +
                        "<th>帧率</th>" +
                        "<th>删除 / 清理</th>" +
                    "</tr></thead>" +
                    "<tbody></tbody>" +
                "</table>" +
            "</div>",
            "benchmark-section benchmark-table"
        );

        var runButton = panel.addButton("开始", function() {
            that.runBenchmarkSuite();
        });
        runButton.id = "benchmark-run";

        var stopButton = panel.addButton("停止", function() {
            that.requestStop();
        });
        stopButton.id = "benchmark-stop";

        var exportButton = panel.addButton("导出 JSON", function() {
            that.exportBenchmarkResults();
        });
        exportButton.id = "benchmark-export";

        var closeButton = panel.addButton("关闭", function() {
            panel.close();
        });
        closeButton.id = "benchmark-close";

        panel.onClose = function() {
            if (that.isBusy()) {
                that.requestStop();
            }
            that.panel = null;
            that.ui = null;
        };

        this.editor.root.appendChild(panel);
        this.panel = panel;
        this.ui = {
            preset: controls.querySelector("#benchmark-preset"),
            nodeCount: controls.querySelector("#benchmark-node-count"),
            runtime: controls.querySelector(".benchmark-runtime"),
            status: controls.querySelector(".benchmark-status"),
            configNote: controls.querySelector(".benchmark-config-note"),
            message: controls.querySelector(".benchmark-message"),
            summary: {
                nextStep: summary.querySelector("[data-key='next-step'] .benchmark-summary-value"),
                startLatency: summary.querySelector("[data-key='start-latency'] .benchmark-summary-value"),
                fps: summary.querySelector("[data-key='fps'] .benchmark-summary-value"),
                createClear: summary.querySelector("[data-key='create-clear'] .benchmark-summary-value")
            },
            tbody: tableWrap.querySelector("tbody"),
            run: runButton,
            stop: stopButton,
            exportButton: exportButton,
            close: closeButton
        };
        this.ui.runtime.textContent = this.getRuntimeDisplayLabel();
        this.ui.preset.addEventListener("change", function() {
            that.applyPresetSelection();
        });
        this.ui.nodeCount.addEventListener("change", function() {
            that.syncNodeCountInput();
            that.renderConfigNote();
        });
        this.applyPresetSelection();
        return panel;
    };

    EditorBenchmark.prototype.setState = function(nextState, message, error) {
        this.state = nextState;
        this.lastError = error || null;
        if (this.ui) {
            this.ui.status.textContent = STATUS_LABELS[nextState] || nextState;
            this.ui.status.dataset.state = nextState;
            this.ui.message.textContent = message || (error ? (error.message || String(error)) : "");
        }
        this.syncUi();
    };

    EditorBenchmark.prototype.applyPresetSelection = function() {
        if (!this.ui) {
            return;
        }
        var preset = BENCHMARK_PRESETS[this.ui.preset.value] || BENCHMARK_PRESETS.quick;
        this.ui.nodeCount.value = preset.nodes;
        this.renderConfigNote();
    };

    EditorBenchmark.prototype.syncNodeCountInput = function(defaultCount) {
        if (!this.ui) {
            return defaultCount || BENCHMARK_PRESETS.quick.nodes;
        }
        var fallback = defaultCount || BENCHMARK_PRESETS[this.ui.preset.value].nodes;
        var count = normalizeNodeCount(this.ui.nodeCount.value, fallback);
        this.ui.nodeCount.value = count;
        return count;
    };

    EditorBenchmark.prototype.renderConfigNote = function(config) {
        if (!this.ui || !this.ui.configNote) {
            return;
        }
        var preset = config || this.resolvePresetConfig(BENCHMARK_PRESETS[this.ui.preset.value] || BENCHMARK_PRESETS.quick);
        this.ui.configNote.textContent =
            "当前将使用 " +
            preset.nodes +
            " 个节点，数据/事件场景按链式生成 " +
            preset.links +
            " 条连线，预热 " +
            preset.warmupSteps +
            " 步，采样 " +
            preset.sampleFrames +
            " 帧。";
    };

    EditorBenchmark.prototype.syncUi = function() {
        if (!this.ui) {
            return;
        }
        var busy = this.isBusy();
        this.ui.run.disabled = busy;
        this.ui.preset.disabled = busy;
        this.ui.nodeCount.disabled = busy;
        this.ui.stop.disabled = !busy;
        this.ui.exportButton.disabled = busy || !this.lastResults;
        this.ui.close.disabled = busy;
    };

    EditorBenchmark.prototype.renderResults = function() {
        if (!this.ui) {
            return;
        }

        var tbody = this.ui.tbody;
        tbody.innerHTML = "";

        for (var i = 0; i < BENCHMARK_SCENARIOS.length; i += 1) {
            var scenario = BENCHMARK_SCENARIOS[i];
            var result = null;
            if (this.lastResults && this.lastResults.scenarios) {
                for (var j = 0; j < this.lastResults.scenarios.length; j += 1) {
                    if (this.lastResults.scenarios[j].id === scenario.id) {
                        result = this.lastResults.scenarios[j];
                        break;
                    }
                }
            }

            var metrics = result ? result.metrics : {};
            var config = result ? result.config : {};
            var row = document.createElement("tr");
            row.innerHTML =
                "<td>" + scenario.label + "</td>" +
                "<td>" + (config.nodes || "--") + "</td>" +
                "<td>" + (config.links || "--") + "</td>" +
                "<td>" + this.formatCreateOrBuild(result, metrics) + "</td>" +
                "<td>" + (result && Number.isFinite(metrics.step_avg_ms) ? formatMs(metrics.step_avg_ms) : "--") + "</td>" +
                "<td>" + (result && Number.isFinite(metrics.first_frame_ms) ? formatMs(metrics.first_frame_ms) : "--") + "</td>" +
                "<td>" + (result && Number.isFinite(metrics.fps_avg) ? formatFps(metrics.fps_avg) : "--") + "</td>" +
                "<td>" + this.formatRemoveOrClear(result, metrics) + "</td>";
            tbody.appendChild(row);
        }

        if (!this.lastResults) {
            this.ui.summary.nextStep.textContent = "--";
            this.ui.summary.startLatency.textContent = "--";
            this.ui.summary.fps.textContent = "--";
            this.ui.summary.createClear.textContent = "--";
            this.syncUi();
            return;
        }

        var summary = this.lastResults.summary || {};
        this.ui.summary.nextStep.textContent =
            "D " + formatMs(summary.data_step_avg_ms).replace(" ms", "") +
            " / E " + formatMs(summary.event_step_avg_ms).replace(" ms", "");
        this.ui.summary.startLatency.textContent =
            "D " + formatMs(summary.data_first_frame_ms).replace(" ms", "") +
            " / E " + formatMs(summary.event_first_frame_ms).replace(" ms", "");
        this.ui.summary.fps.textContent =
            "D " + formatFps(summary.data_fps_avg) +
            " / E " + formatFps(summary.event_fps_avg);
        this.ui.summary.createClear.textContent =
            formatMs(summary.create_total_ms).replace(" ms", "") +
            " / " + formatMs(summary.clear_total_ms).replace(" ms", "") + " ms";
        this.syncUi();
    };

    EditorBenchmark.prototype.formatCreateOrBuild = function(result, metrics) {
        if (!result) {
            return "--";
        }
        if (result.id === "node-create") {
            return formatMs(metrics.create_total_ms);
        }
        if (Number.isFinite(metrics.build_total_ms)) {
            return formatMs(metrics.build_total_ms);
        }
        return "--";
    };

    EditorBenchmark.prototype.formatRemoveOrClear = function(result, metrics) {
        if (!result) {
            return "--";
        }
        if (result.id === "node-delete") {
            return formatMs(metrics.remove_total_ms).replace(" ms", "") +
                " / " + formatMs(metrics.clear_total_ms);
        }
        return "--";
    };

    EditorBenchmark.prototype.captureSnapshot = function() {
        return {
            graphData: cloneSerializable(this.graph.serialize()),
            wasRunning: this.graph.status === LGraph.STATUS_RUNNING,
            liveMode: !!this.graphcanvas.live_mode,
            allowInteraction: this.graphcanvas.allow_interaction,
            scale: this.graphcanvas.ds.scale,
            offset: [this.graphcanvas.ds.offset[0], this.graphcanvas.ds.offset[1]],
            pointerEvents: this.graphcanvas.canvas.style.pointerEvents || ""
        };
    };

    EditorBenchmark.prototype.applyRunLock = function(enabled) {
        var controls = [];
        for (var i = 0; i < BENCHMARK_CONTROL_SELECTORS.length; i += 1) {
            var element = this.editor.root.querySelector(BENCHMARK_CONTROL_SELECTORS[i]);
            if (!element) {
                continue;
            }
            if (enabled) {
                controls.push({ element: element, disabled: !!element.disabled });
                element.disabled = true;
            }
        }

        if (enabled) {
            this.disabledControls = controls;
            this.canvasPointerEvents = this.graphcanvas.canvas.style.pointerEvents || "";
            this.graphcanvas.allow_interaction = false;
            this.graphcanvas.canvas.style.pointerEvents = "none";
            this.editor.root.classList.add("benchmark-running");
            return;
        }

        for (var j = 0; j < this.disabledControls.length; j += 1) {
            this.disabledControls[j].element.disabled = this.disabledControls[j].disabled;
        }
        this.disabledControls = [];
        this.graphcanvas.canvas.style.pointerEvents = this.canvasPointerEvents;
        this.editor.root.classList.remove("benchmark-running");
    };

    EditorBenchmark.prototype.restoreSnapshot = async function(snapshot) {
        this.graph.stop();
        this.graph.clear();
        this.graph.configure(cloneSerializable(snapshot.graphData));
        this.graphcanvas.allow_interaction = snapshot.allowInteraction;
        this.graphcanvas.ds.scale = snapshot.scale;
        this.graphcanvas.ds.offset[0] = snapshot.offset[0];
        this.graphcanvas.ds.offset[1] = snapshot.offset[1];
        this.graphcanvas.live_mode = !!snapshot.liveMode;
        this.graphcanvas.editor_alpha = snapshot.liveMode ? 0 : 1;
        this.graphcanvas.canvas.style.pointerEvents = snapshot.pointerEvents;
        this.graphcanvas.setDirty(true, true);
        this.graphcanvas.draw(true, true);
        if (snapshot.wasRunning) {
            this.graph.start();
        }
        if (typeof this.editor.refreshRuntimeButtons === "function") {
            this.editor.refreshRuntimeButtons({
                running: snapshot.wasRunning,
                live_mode: snapshot.liveMode
            });
        }
        await nextFrame();
    };

    EditorBenchmark.prototype.resolvePresetConfig = function(preset) {
        var resolved = {
            id: preset.id,
            label: preset.label,
            nodes: preset.nodes,
            links: preset.links,
            warmupSteps: preset.warmupSteps,
            sampleFrames: preset.sampleFrames
        };
        resolved.nodes = this.syncNodeCountInput(preset.nodes);
        resolved.links = Math.max(resolved.nodes - 1, 0);
        return resolved;
    };

    EditorBenchmark.prototype.runBenchmarkSuite = async function(presetId) {
        ensureBenchmarkNodesRegistered();
        this.openBenchmarkPanel();

        if (this.isBusy()) {
            return this.lastResults;
        }

        var selectedPreset = BENCHMARK_PRESETS[presetId || (this.ui && this.ui.preset.value) || "quick"];
        if (!selectedPreset) {
            selectedPreset = BENCHMARK_PRESETS.quick;
        }
        selectedPreset = this.resolvePresetConfig(selectedPreset);

        if (this.ui) {
            this.ui.preset.value = selectedPreset.id;
        }
        this.renderConfigNote(selectedPreset);

        var snapshot = this.captureSnapshot();
        this.abortRequested = false;
        this.lastError = null;
        this.setState("running", "正在运行 " + selectedPreset.label + " 预设...");
        this.applyRunLock(true);
        this.graph.stop();
        if (typeof this.editor.refreshRuntimeButtons === "function") {
            this.editor.refreshRuntimeButtons();
        }

        try {
            var scenarios = [];
            scenarios.push(await this.measureNodeCreate(selectedPreset));
            this.throwIfAborted();
            scenarios.push(await this.measureNodeDelete(selectedPreset));
            this.throwIfAborted();
            scenarios.push(await this.measureRuntimeScenario(selectedPreset, "data-runtime"));
            this.throwIfAborted();
            scenarios.push(await this.measureRuntimeScenario(selectedPreset, "event-runtime"));
            this.throwIfAborted();

            this.lastResults = this.buildExportPayload(selectedPreset, scenarios);
            this.setState("restoring", "正在恢复原始图...");
            await this.restoreSnapshot(snapshot);
            this.applyRunLock(false);
            this.setState("idle", "性能基准已完成。");
            this.renderResults();
            return this.lastResults;
        } catch (error) {
            this.setState("restoring", this.abortRequested ? "正在停止并恢复原始图..." : "正在恢复原始图...");
            try {
                await this.restoreSnapshot(snapshot);
            } finally {
                this.applyRunLock(false);
            }

            if (error && error.__benchmarkAborted) {
                this.setState("idle", "性能基准已停止。");
                this.renderResults();
                return this.lastResults;
            }

            this.setState("error", "性能基准运行失败。", error);
            this.renderResults();
            throw error;
        }
    };

    EditorBenchmark.prototype.requestStop = function() {
        this.abortRequested = true;
        if (typeof this.activeRuntimeCanceler === "function") {
            this.activeRuntimeCanceler();
        }
    };

    EditorBenchmark.prototype.throwIfAborted = function() {
        if (!this.abortRequested) {
            return;
        }
        var error = new Error("性能基准已中断");
        error.__benchmarkAborted = true;
        throw error;
    };

    EditorBenchmark.prototype.buildGridPositions = function(count) {
        var positions = [];
        var columns = Math.ceil(Math.sqrt(count));
        var gapX = 150;
        var gapY = 90;
        for (var i = 0; i < count; i += 1) {
            positions.push([
                80 + (i % columns) * gapX,
                80 + Math.floor(i / columns) * gapY
            ]);
        }
        return positions;
    };

    EditorBenchmark.prototype.createNodes = function(type, count) {
        var positions = this.buildGridPositions(count);
        var nodes = [];
        for (var i = 0; i < count; i += 1) {
            this.throwIfAborted();
            var node = LiteGraph.createNode(type);
            node.pos = positions[i];
            this.graph.add(node);
            nodes.push(node);
        }
        this.graphcanvas.setDirty(true, true);
        this.graphcanvas.draw(true, true);
        return nodes;
    };

    EditorBenchmark.prototype.measureNodeCreate = async function(preset) {
        this.graph.stop();
        this.graph.clear();
        await nextFrame();
        var startedAt = now();
        this.createNodes("benchmark/empty", preset.nodes);
        var createTotalMs = now() - startedAt;
        await nextFrame();
        return {
            id: "node-create",
            label: "节点创建",
            config: {
                nodes: preset.nodes,
                links: 0,
                warmupSteps: 0,
                sampleFrames: 0
            },
            metrics: {
                create_total_ms: round(createTotalMs),
                create_per_node_ms: round(createTotalMs / preset.nodes)
            },
            samples: {}
        };
    };

    EditorBenchmark.prototype.measureNodeDelete = async function(preset) {
        this.graph.stop();
        this.graph.clear();
        this.createNodes("benchmark/empty", preset.nodes);
        await nextFrame();
        var nodes = this.graph._nodes.slice();
        var removeStart = now();
        for (var i = nodes.length - 1; i >= 0; i -= 1) {
            this.throwIfAborted();
            this.graph.remove(nodes[i]);
        }
        var removeTotalMs = now() - removeStart;
        this.graphcanvas.setDirty(true, true);
        this.graphcanvas.draw(true, true);

        this.graph.clear();
        this.createNodes("benchmark/empty", preset.nodes);
        await nextFrame();
        var clearStart = now();
        this.graph.clear();
        var clearTotalMs = now() - clearStart;
        await nextFrame();

        return {
            id: "node-delete",
            label: "节点删除",
            config: {
                nodes: preset.nodes,
                links: 0,
                warmupSteps: 0,
                sampleFrames: 0
            },
            metrics: {
                remove_total_ms: round(removeTotalMs),
                remove_per_node_ms: round(removeTotalMs / preset.nodes),
                clear_total_ms: round(clearTotalMs)
            },
            samples: {}
        };
    };

    EditorBenchmark.prototype.createRuntimeGraph = function(preset, mode) {
        var sourceType = mode === "event-runtime" ? "benchmark/event_pulse" : "benchmark/data_source";
        var pipeType = mode === "event-runtime" ? "benchmark/event_pipe" : "benchmark/data_pipe";
        var sinkType = mode === "event-runtime" ? "benchmark/event_sink" : "benchmark/data_sink";
        var graph = this.graph;
        var totalNodes = preset.nodes;

        var source = LiteGraph.createNode(sourceType);
        source.pos = [80, 200];
        graph.add(source);

        var previous = source;
        for (var i = 1; i < totalNodes - 1; i += 1) {
            var pipe = LiteGraph.createNode(pipeType);
            pipe.pos = [80 + i * 140, 200];
            graph.add(pipe);
            previous.connect(0, pipe, 0);
            previous = pipe;
        }

        var sink = LiteGraph.createNode(sinkType);
        sink.pos = [80 + (totalNodes - 1) * 140, 200];
        graph.add(sink);
        previous.connect(0, sink, 0);

        if (typeof graph.updateExecutionOrder === "function") {
            graph.updateExecutionOrder();
        }
        this.graphcanvas.setDirty(true, true);
        this.graphcanvas.draw(true, true);

        return {
            nodes: totalNodes,
            links: Math.max(totalNodes - 1, 0)
        };
    };

    EditorBenchmark.prototype.measureStepSamples = function(sampleFrames) {
        var samples = [];
        for (var i = 0; i < sampleFrames; i += 1) {
            this.throwIfAborted();
            var startedAt = now();
            this.graph.runStep(1);
            samples.push(now() - startedAt);
        }
        return samples;
    };

    EditorBenchmark.prototype.collectRuntimeSamples = function(sampleFrames) {
        var that = this;
        return new Promise(function(resolve, reject) {
            var executionMs = [];
            var renderMs = [];
            var fps = [];
            var firstFrameMs = null;
            var frameCount = 0;
            var startAt = now();
            var originalAfterStep = that.graph.onAfterStep;
            var resolved = false;

            function cleanup(payload) {
                if (resolved) {
                    return;
                }
                resolved = true;
                that.activeRuntimeCanceler = null;
                that.graph.onAfterStep = originalAfterStep;
                if (that.graph.status === LGraph.STATUS_RUNNING) {
                    that.graph.stop();
                }
                resolve(payload);
            }

            that.activeRuntimeCanceler = function() {
                cleanup({
                    first_frame_ms: firstFrameMs == null ? 0 : firstFrameMs,
                    executionMs: executionMs,
                    renderMs: renderMs,
                    fps: fps
                });
            };

            that.graph.onAfterStep = function() {
                if (typeof originalAfterStep === "function") {
                    originalAfterStep.apply(that.graph, arguments);
                }

                var current = now();
                if (firstFrameMs == null) {
                    firstFrameMs = current - startAt;
                }

                executionMs.push(toMilliseconds(that.graph.execution_time));
                renderMs.push(toMilliseconds(that.graphcanvas.render_time));
                fps.push(Number(that.graphcanvas.fps || 0));
                frameCount += 1;

                if (that.abortRequested || frameCount >= sampleFrames) {
                    cleanup({
                        first_frame_ms: firstFrameMs,
                        executionMs: executionMs,
                        renderMs: renderMs,
                        fps: fps
                    });
                }
            };

            try {
                that.graph.start(0);
            } catch (error) {
                that.graph.onAfterStep = originalAfterStep;
                that.activeRuntimeCanceler = null;
                reject(error);
            }
        });
    };

    EditorBenchmark.prototype.measureRuntimeScenario = async function(preset, mode) {
        this.graph.stop();
        this.graph.clear();
        await nextFrame();

        var buildStart = now();
        var graphInfo = this.createRuntimeGraph(preset, mode);
        var buildTotalMs = now() - buildStart;
        await nextFrame();

        for (var i = 0; i < preset.warmupSteps; i += 1) {
            this.throwIfAborted();
            this.graph.runStep(1);
        }

        var stepSamples = this.measureStepSamples(preset.sampleFrames);
        await delay(10);
        var runtimeSamples = await this.collectRuntimeSamples(preset.sampleFrames);

        return {
            id: mode,
            label: mode === "event-runtime" ? "事件连线运行" : "数据连线运行",
            config: {
                nodes: graphInfo.nodes,
                links: graphInfo.links,
                warmupSteps: preset.warmupSteps,
                sampleFrames: preset.sampleFrames
            },
            metrics: {
                build_total_ms: round(buildTotalMs),
                first_frame_ms: round(runtimeSamples.first_frame_ms),
                step_avg_ms: round(average(stepSamples)),
                step_p95_ms: round(percentile(stepSamples, 95)),
                step_max_ms: round(max(stepSamples)),
                exec_avg_ms: round(average(runtimeSamples.executionMs)),
                exec_p95_ms: round(percentile(runtimeSamples.executionMs, 95)),
                render_avg_ms: round(average(runtimeSamples.renderMs)),
                render_p95_ms: round(percentile(runtimeSamples.renderMs, 95)),
                fps_avg: round(average(runtimeSamples.fps)),
                fps_min: round(min(runtimeSamples.fps))
            },
            samples: {
                stepMs: stepSamples.map(round),
                executionMs: runtimeSamples.executionMs.map(round),
                renderMs: runtimeSamples.renderMs.map(round),
                fps: runtimeSamples.fps.map(round)
            }
        };
    };

    EditorBenchmark.prototype.buildExportPayload = function(preset, scenarios) {
        var byId = {};
        for (var i = 0; i < scenarios.length; i += 1) {
            byId[scenarios[i].id] = scenarios[i];
        }

        return {
            version: 1,
            runtime: this.getRuntimeLabel(),
            preset: preset.id,
            generatedAt: new Date().toISOString(),
            userAgent: global.navigator && global.navigator.userAgent ? global.navigator.userAgent : "",
            scenarios: scenarios,
            summary: {
                create_total_ms: byId["node-create"] ? byId["node-create"].metrics.create_total_ms : 0,
                remove_total_ms: byId["node-delete"] ? byId["node-delete"].metrics.remove_total_ms : 0,
                clear_total_ms: byId["node-delete"] ? byId["node-delete"].metrics.clear_total_ms : 0,
                data_step_avg_ms: byId["data-runtime"] ? byId["data-runtime"].metrics.step_avg_ms : 0,
                data_first_frame_ms: byId["data-runtime"] ? byId["data-runtime"].metrics.first_frame_ms : 0,
                data_fps_avg: byId["data-runtime"] ? byId["data-runtime"].metrics.fps_avg : 0,
                event_step_avg_ms: byId["event-runtime"] ? byId["event-runtime"].metrics.step_avg_ms : 0,
                event_first_frame_ms: byId["event-runtime"] ? byId["event-runtime"].metrics.first_frame_ms : 0,
                event_fps_avg: byId["event-runtime"] ? byId["event-runtime"].metrics.fps_avg : 0
            }
        };
    };

    EditorBenchmark.prototype.exportBenchmarkResults = function() {
        this.openBenchmarkPanel();
        if (!this.lastResults) {
            return null;
        }

        var filename =
            "litegraph-benchmark-" +
            this.lastResults.runtime +
            "-" +
            this.lastResults.preset +
            "-" +
            this.lastResults.generatedAt.replace(/[:.]/g, "-") +
            ".json";
        var blob = new Blob([JSON.stringify(this.lastResults, null, 2)], {
            type: "application/json"
        });
        var url = URL.createObjectURL(blob);
        var link = document.createElement("a");
        link.href = url;
        link.download = filename;
        link.style.display = "none";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(function() {
            URL.revokeObjectURL(url);
        }, 1000);
        return this.lastResults;
    };

    LiteGraph.EditorBenchmark = EditorBenchmark;
})(window);
