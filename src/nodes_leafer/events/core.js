(function(global, factory) {
    var moduleDefinition = factory();
    if (typeof module !== "undefined" && module.exports) {
        module.exports = moduleDefinition;
    }

    var support = global && global.__litegraphNodesLeaferModuleSupport;
    if (support) {
        if (typeof support.installNodeSetModule === "function") {
            support.installNodeSetModule("events", moduleDefinition);
        } else if (typeof support.installBaseNodeModule === "function") {
            support.installBaseNodeModule(moduleDefinition);
        }
    }
})(typeof window !== "undefined" ? window : globalThis, function() {
    function requestPatch(node, ModernNodeChangeMask, mask) {
        if (!node || typeof node.requestModernPatch !== "function") {
            return;
        }
        node.requestModernPatch(
            mask ||
                (ModernNodeChangeMask.Data | ModernNodeChangeMask.Style)
        );
    }

    function requestPortPatch(node, ModernNodeChangeMask) {
        requestPatch(
            node,
            ModernNodeChangeMask,
            ModernNodeChangeMask.Layout |
                ModernNodeChangeMask.Ports |
                ModernNodeChangeMask.Data |
                ModernNodeChangeMask.Style
        );
    }

    function clampIndex(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    return {
        id: "events/core",
        define: function(api) {
            var LiteGraph = api.liteGraph;
            var BaseNode = api.DefaultModernNodeBase;
            var ModernNodeChangeMask = api.ModernNodeChangeMask;
            var truncateText = api.utils.truncateText;

            class LogEvent extends BaseNode {
                constructor(title) {
                    super(title);
                    this.size = [80, 34];
                    this.addInput("event", LiteGraph.ACTION);
                }

                onAction(action, param) {
                    console.log(action, param);
                }

                getShellState(context) {
                    var shellState = BaseNode.prototype.getShellState.call(
                        this,
                        context
                    );
                    shellState.headerMetaText = "LOG";
                    shellState.minimumWidth = 138;
                    return shellState;
                }
            }

            LogEvent.type = "events/log";
            LogEvent.title = "Log Event";
            LogEvent.desc = "Log event in console";

            class TriggerEvent extends BaseNode {
                constructor(title) {
                    super(title);
                    this.size = [120, 70];
                    this.addInput("if", "");
                    this.addOutput("true", LiteGraph.EVENT);
                    this.addOutput("change", LiteGraph.EVENT);
                    this.addOutput("false", LiteGraph.EVENT);
                    this.properties = { only_on_change: true };
                    this.prev = 0;
                }

                defineWidgets() {
                    return [
                        {
                            id: "only_on_change",
                            type: "toggle",
                            name: "only_on_change",
                            label: "On Change",
                            value: this.properties.only_on_change,
                            property: "only_on_change",
                        },
                    ];
                }

                onExecute(param, options) {
                    var value = this.getInputData(0);
                    var changed = value != this.prev;
                    if (this.prev === 0) {
                        changed = false;
                    }
                    var mustResend =
                        (changed && this.properties.only_on_change) ||
                        (!changed && !this.properties.only_on_change);
                    if (value && mustResend) {
                        this.triggerSlot(0, param, null, options);
                    }
                    if (!value && mustResend) {
                        this.triggerSlot(2, param, null, options);
                    }
                    if (changed) {
                        this.triggerSlot(1, param, null, options);
                    }
                    this.prev = value;
                }

                getShellState(context) {
                    var shellState = BaseNode.prototype.getShellState.call(
                        this,
                        context
                    );
                    shellState.headerMetaText = this.properties.only_on_change
                        ? "CHANGE"
                        : "LEVEL";
                    shellState.minimumWidth = 162;
                    return shellState;
                }
            }

            TriggerEvent.type = "events/trigger";
            TriggerEvent.title = "TriggerEvent";
            TriggerEvent.desc = "Triggers event if input evaluates to true";

            class Sequence extends BaseNode {
                constructor(title) {
                    super(title);
                    this.addInput("", LiteGraph.ACTION);
                    this.addInput("", LiteGraph.ACTION);
                    this.addInput("", LiteGraph.ACTION);
                    this.addOutput("", LiteGraph.EVENT);
                    this.addOutput("", LiteGraph.EVENT);
                    this.addOutput("", LiteGraph.EVENT);
                    this.size = [120, 74];
                    this.flags = { horizontal: true, render_box: false };
                }

                defineWidgets() {
                    return [
                        {
                            id: "add",
                            type: "button",
                            name: "add",
                            label: "+",
                            value: null,
                            options: {
                                callback: this.addChannel.bind(this),
                            },
                        },
                    ];
                }

                addChannel() {
                    this.addInput("", LiteGraph.ACTION);
                    this.addOutput("", LiteGraph.EVENT);
                    requestPortPatch(this, ModernNodeChangeMask);
                }

                getTitle() {
                    return "";
                }

                onAction(action, param, options) {
                    if (!this.outputs) {
                        return;
                    }
                    options = options || {};
                    for (var i = 0; i < this.outputs.length; ++i) {
                        if (options.action_call) {
                            options.action_call =
                                options.action_call + "_seq_" + i;
                        } else {
                            options.action_call =
                                this.id +
                                "_" +
                                (action ? action : "action") +
                                "_seq_" +
                                i +
                                "_" +
                                Math.floor(Math.random() * 9999);
                        }
                        this.triggerSlot(i, param, null, options);
                    }
                }

                getShellState(context) {
                    var shellState = BaseNode.prototype.getShellState.call(
                        this,
                        context
                    );
                    shellState.headerMetaText = "SEQ";
                    shellState.minimumWidth = 132;
                    shellState.summaryText = this.outputs
                        ? this.outputs.length + " steps"
                        : "0 steps";
                    return shellState;
                }
            }

            Sequence.type = "events/sequence";
            Sequence.title = "Sequence";
            Sequence.desc = "Triggers a sequence of events when an event arrives";

            class WaitAll extends BaseNode {
                constructor(title) {
                    super(title);
                    this.addInput("", LiteGraph.ACTION);
                    this.addInput("", LiteGraph.ACTION);
                    this.addOutput("", LiteGraph.EVENT);
                    this.size = [120, 74];
                    this.ready = [];
                }

                defineWidgets() {
                    return [
                        {
                            id: "add",
                            type: "button",
                            name: "add",
                            label: "+",
                            value: null,
                            options: {
                                callback: this.addGuard.bind(this),
                            },
                        },
                    ];
                }

                addGuard() {
                    this.addInput("", LiteGraph.ACTION);
                    this.size[0] = 120;
                    requestPortPatch(this, ModernNodeChangeMask);
                }

                getTitle() {
                    return "";
                }

                onAction(action, param, options, slotIndex) {
                    if (slotIndex == null) {
                        return;
                    }

                    this.ready.length = this.inputs ? this.inputs.length : 0;
                    this.ready[slotIndex] = true;
                    for (var i = 0; i < this.ready.length; ++i) {
                        if (!this.ready[i]) {
                            requestPatch(this, ModernNodeChangeMask);
                            return;
                        }
                    }
                    this.reset();
                    this.triggerSlot(0, param, null, options);
                    requestPatch(this, ModernNodeChangeMask);
                }

                reset() {
                    this.ready.length = 0;
                    requestPatch(this, ModernNodeChangeMask);
                }

                getShellState(context) {
                    var shellState = BaseNode.prototype.getShellState.call(
                        this,
                        context
                    );
                    var total = this.inputs ? this.inputs.length : 0;
                    var readyCount = 0;
                    for (var i = 0; i < this.ready.length; ++i) {
                        if (this.ready[i]) {
                            readyCount += 1;
                        }
                    }
                    shellState.headerMetaText = "WAIT";
                    shellState.minimumWidth = 136;
                    shellState.summaryText = readyCount + "/" + total + " ready";
                    return shellState;
                }
            }

            WaitAll.type = "events/waitAll";
            WaitAll.title = "WaitAll";
            WaitAll.desc = "Wait until all input events arrive then triggers output";

            class Stepper extends BaseNode {
                constructor(title) {
                    super(title);
                    this.properties = { index: 0 };
                    this.addInput("index", "number");
                    this.addInput("step", LiteGraph.ACTION);
                    this.addInput("reset", LiteGraph.ACTION);
                    this.addOutput("index", "number");
                    this.addOutput("", LiteGraph.EVENT);
                    this.addOutput("", LiteGraph.EVENT);
                    this.addOutput("", LiteGraph.EVENT, { removable: true });
                    this.size = [150, 124];
                    this.flags = { render_box: false };
                }

                defineWidgets() {
                    return [
                        {
                            id: "add",
                            type: "button",
                            name: "add",
                            label: "+",
                            value: null,
                            options: {
                                callback: this.addStep.bind(this),
                            },
                        },
                    ];
                }

                addStep() {
                    this.addOutput("", LiteGraph.EVENT, { removable: true });
                    requestPortPatch(this, ModernNodeChangeMask);
                }

                onExecute() {
                    var index = this.getInputData(0);
                    if (index != null) {
                        index = Math.floor(index);
                        index = clampIndex(
                            index,
                            0,
                            this.outputs ? this.outputs.length - 2 : 0
                        );
                        if (index != this.properties.index) {
                            this.properties.index = index;
                            this.triggerSlot(index + 1);
                            requestPatch(this, ModernNodeChangeMask);
                        }
                    }

                    this.setOutputData(0, this.properties.index);
                }

                onAction(action, param) {
                    if (action == "reset") {
                        this.properties.index = 0;
                        requestPatch(this, ModernNodeChangeMask);
                    } else if (action == "step") {
                        this.triggerSlot(this.properties.index + 1, param);
                        var count = this.outputs ? this.outputs.length - 1 : 0;
                        this.properties.index =
                            count > 0
                                ? (this.properties.index + 1) % count
                                : 0;
                        requestPatch(this, ModernNodeChangeMask);
                    }
                }

                getShellState(context) {
                    var shellState = BaseNode.prototype.getShellState.call(
                        this,
                        context
                    );
                    var count = this.outputs
                        ? Math.max(0, this.outputs.length - 1)
                        : 0;
                    shellState.headerMetaText = "STEP";
                    shellState.minimumWidth = 160;
                    shellState.summaryText =
                        count > 0
                            ? "step " +
                              (this.properties.index + 1) +
                              " / " +
                              count
                            : "no outputs";
                    return shellState;
                }
            }

            Stepper.type = "events/stepper";
            Stepper.title = "Stepper";
            Stepper.desc = "Trigger events sequentially when an tick arrives";

            class FilterEvent extends BaseNode {
                constructor(title) {
                    super(title);
                    this.size = [180, 78];
                    this.addInput("event", LiteGraph.ACTION);
                    this.addOutput("event", LiteGraph.EVENT);
                    this.properties = {
                        equal_to: "",
                        has_property: "",
                        property_equal_to: "",
                    };
                }

                defineWidgets() {
                    return [
                        {
                            id: "equal_to",
                            type: "text",
                            name: "equal_to",
                            label: "Equals",
                            value: this.properties.equal_to,
                            property: "equal_to",
                        },
                        {
                            id: "has_property",
                            type: "text",
                            name: "has_property",
                            label: "Prop",
                            value: this.properties.has_property,
                            property: "has_property",
                        },
                        {
                            id: "property_equal_to",
                            type: "text",
                            name: "property_equal_to",
                            label: "Prop =",
                            value: this.properties.property_equal_to,
                            property: "property_equal_to",
                        },
                    ];
                }

                onAction(action, param, options) {
                    if (param == null) {
                        return;
                    }

                    if (
                        this.properties.equal_to &&
                        this.properties.equal_to != param
                    ) {
                        return;
                    }

                    if (this.properties.has_property) {
                        var prop = param[this.properties.has_property];
                        if (prop == null) {
                            return;
                        }

                        if (
                            this.properties.property_equal_to &&
                            this.properties.property_equal_to != prop
                        ) {
                            return;
                        }
                    }

                    this.triggerSlot(0, param, null, options);
                }

                getShellState(context) {
                    var shellState = BaseNode.prototype.getShellState.call(
                        this,
                        context
                    );
                    shellState.headerMetaText = "FILTER";
                    shellState.minimumWidth = 220;
                    return shellState;
                }
            }

            FilterEvent.type = "events/filter";
            FilterEvent.title = "Filter Event";
            FilterEvent.desc = "Blocks events that do not match the filter";

            class EventBranch extends BaseNode {
                constructor(title) {
                    super(title);
                    this.addInput("in", LiteGraph.ACTION);
                    this.addInput("cond", "boolean");
                    this.addOutput("true", LiteGraph.EVENT);
                    this.addOutput("false", LiteGraph.EVENT);
                    this.size = [140, 60];
                    this._value = false;
                }

                onExecute() {
                    this._value = this.getInputData(1);
                    requestPatch(
                        this,
                        ModernNodeChangeMask,
                        ModernNodeChangeMask.Data
                    );
                }

                onAction(action, param, options) {
                    this._value = this.getInputData(1);
                    this.triggerSlot(this._value ? 0 : 1, param, null, options);
                    requestPatch(this, ModernNodeChangeMask);
                }

                getShellState(context) {
                    var shellState = BaseNode.prototype.getShellState.call(
                        this,
                        context
                    );
                    shellState.headerMetaText = this._value ? "TRUE" : "FALSE";
                    shellState.minimumWidth = 160;
                    return shellState;
                }
            }

            EventBranch.type = "events/branch";
            EventBranch.title = "Branch";
            EventBranch.desc =
                "If condition is true, outputs triggers true, otherwise false";

            class EventCounter extends BaseNode {
                constructor(title) {
                    super(title);
                    this.addInput("inc", LiteGraph.ACTION);
                    this.addInput("dec", LiteGraph.ACTION);
                    this.addInput("reset", LiteGraph.ACTION);
                    this.addOutput("change", LiteGraph.EVENT);
                    this.addOutput("num", "number");
                    this.addProperty(
                        "doCountExecution",
                        false,
                        "boolean",
                        { name: "Count Executions" }
                    );
                    this.num = 0;
                    this.size = [150, 80];
                }

                defineWidgets() {
                    return [
                        {
                            id: "doCountExecution",
                            type: "toggle",
                            name: "doCountExecution",
                            label: "Count Exec.",
                            value: this.properties.doCountExecution,
                            property: "doCountExecution",
                        },
                    ];
                }

                getTitle() {
                    if (this.flags.collapsed) {
                        return String(this.num);
                    }
                    return this.title;
                }

                onAction(action) {
                    var previous = this.num;
                    if (action == "inc") {
                        this.num += 1;
                    } else if (action == "dec") {
                        this.num -= 1;
                    } else if (action == "reset") {
                        this.num = 0;
                    }
                    if (this.num != previous) {
                        this.trigger("change", this.num);
                        requestPatch(this, ModernNodeChangeMask);
                    }
                }

                onExecute() {
                    if (this.properties.doCountExecution) {
                        this.num += 1;
                        requestPatch(this, ModernNodeChangeMask);
                    }
                    this.setOutputData(1, this.num);
                }

                getShellState(context) {
                    var shellState = BaseNode.prototype.getShellState.call(
                        this,
                        context
                    );
                    shellState.headerMetaText = "COUNT";
                    shellState.minimumWidth = 150;
                    shellState.summaryText = String(this.num);
                    return shellState;
                }
            }

            EventCounter.type = "events/counter";
            EventCounter.title = "Counter";
            EventCounter.desc = "Counts events";

            class DelayEvent extends BaseNode {
                constructor(title) {
                    super(title);
                    this.size = [140, 60];
                    this.addProperty("time_in_ms", 1000);
                    this.addInput("event", LiteGraph.ACTION);
                    this.addOutput("on_time", LiteGraph.EVENT);
                    this._pending = [];
                }

                defineWidgets() {
                    return [
                        {
                            id: "time_in_ms",
                            type: "number",
                            name: "time_in_ms",
                            label: "Delay",
                            value: this.properties.time_in_ms,
                            property: "time_in_ms",
                            options: {
                                min: 0,
                                precision: 0,
                                step: 50,
                            },
                        },
                    ];
                }

                onAction(action, param, options) {
                    var time = this.properties.time_in_ms;
                    if (time <= 0) {
                        this.trigger(null, param, options);
                    } else {
                        this._pending.push([time, param]);
                        requestPatch(this, ModernNodeChangeMask);
                    }
                }

                onExecute(param, options) {
                    var dt =
                        ((this.graph && this.graph.elapsed_time) || 0) * 1000;

                    if (this.isInputConnected(1)) {
                        this.properties.time_in_ms = this.getInputData(1);
                    }

                    var changed = false;
                    for (var i = 0; i < this._pending.length; ++i) {
                        var actionPass = this._pending[i];
                        actionPass[0] -= dt;
                        if (actionPass[0] > 0) {
                            continue;
                        }

                        this._pending.splice(i, 1);
                        --i;
                        this.trigger(null, actionPass[1], options);
                        changed = true;
                    }

                    if (changed) {
                        requestPatch(this, ModernNodeChangeMask);
                    }
                }

                onGetInputs() {
                    return [["time_in_ms", "number"]];
                }

                getShellState(context) {
                    var shellState = BaseNode.prototype.getShellState.call(
                        this,
                        context
                    );
                    shellState.headerMetaText = "DELAY";
                    shellState.minimumWidth = 156;
                    shellState.summaryText =
                        String(this.properties.time_in_ms) +
                        " ms" +
                        (this._pending.length
                            ? " • " + this._pending.length + " queued"
                            : "");
                    return shellState;
                }
            }

            DelayEvent.type = "events/delay";
            DelayEvent.title = "Delay";
            DelayEvent.desc = "Delays one event";

            class TimerEvent extends BaseNode {
                constructor(title) {
                    super(title);
                    this.addProperty("interval", 1000);
                    this.addProperty("event", "tick");
                    this.addOutput("on_tick", LiteGraph.EVENT);
                    this.time = 0;
                    this.last_interval = 1000;
                    this.triggered = false;
                }

                defineWidgets() {
                    return [
                        {
                            id: "interval",
                            type: "number",
                            name: "interval",
                            label: "Interval",
                            value: this.properties.interval,
                            property: "interval",
                            options: {
                                min: 1,
                                precision: 0,
                                step: 50,
                            },
                        },
                        {
                            id: "event",
                            type: "text",
                            name: "event",
                            label: "Event",
                            value: this.properties.event,
                            property: "event",
                        },
                    ];
                }

                onStart() {
                    this.time = 0;
                    this.triggered = false;
                    this.boxcolor = TimerEvent.off_color;
                    requestPatch(this, ModernNodeChangeMask);
                }

                getTitle() {
                    return "Timer: " + this.last_interval.toString() + "ms";
                }

                onExecute() {
                    var dt =
                        ((this.graph && this.graph.elapsed_time) || 0) * 1000;
                    var trigger = this.time == 0;

                    this.time += dt;
                    this.last_interval = Math.max(
                        1,
                        this.getInputOrProperty("interval") | 0
                    );

                    if (
                        !trigger &&
                        (this.time < this.last_interval ||
                            isNaN(this.last_interval))
                    ) {
                        this.boxcolor = TimerEvent.off_color;
                        if (
                            this.outputs &&
                            this.outputs.length > 1 &&
                            this.outputs[1]
                        ) {
                            this.setOutputData(1, false);
                        }
                        requestPatch(this, ModernNodeChangeMask);
                        return;
                    }

                    this.triggered = true;
                    this.time = this.time % this.last_interval;
                    this.boxcolor = TimerEvent.on_color;
                    this.trigger("on_tick", this.properties.event);
                    if (
                        this.outputs &&
                        this.outputs.length > 1 &&
                        this.outputs[1]
                    ) {
                        this.setOutputData(1, true);
                    }
                    requestPatch(this, ModernNodeChangeMask);
                    this.triggered = false;
                }

                onGetInputs() {
                    return [["interval", "number"]];
                }

                onGetOutputs() {
                    return [["tick", "boolean"]];
                }

                getShellState(context) {
                    var shellState = BaseNode.prototype.getShellState.call(
                        this,
                        context
                    );
                    shellState.headerMetaText = "TIMER";
                    shellState.minimumWidth = 184;
                    shellState.summaryText =
                        truncateText(this.properties.event || "tick", 16) +
                        " • " +
                        this.last_interval +
                        " ms";
                    return shellState;
                }
            }

            TimerEvent.type = "events/timer";
            TimerEvent.title = "Timer";
            TimerEvent.desc = "Sends an event every N milliseconds";
            TimerEvent.on_color = "#AAA";
            TimerEvent.off_color = "#222";

            class SemaphoreEvent extends BaseNode {
                constructor(title) {
                    super(title);
                    this.addInput("go", LiteGraph.ACTION);
                    this.addInput("green", LiteGraph.ACTION);
                    this.addInput("red", LiteGraph.ACTION);
                    this.addOutput("continue", LiteGraph.EVENT);
                    this.addOutput("blocked", LiteGraph.EVENT);
                    this.addOutput("is_green", "boolean");
                    this._ready = false;
                    this.properties = {};
                    this.size = [150, 74];
                }

                defineWidgets() {
                    return [
                        {
                            id: "reset",
                            type: "button",
                            name: "reset",
                            label: "Reset",
                            value: null,
                            options: {
                                callback: this.resetReady.bind(this),
                            },
                        },
                    ];
                }

                resetReady() {
                    this._ready = false;
                    requestPatch(this, ModernNodeChangeMask);
                }

                onExecute() {
                    this.setOutputData(2, this._ready);
                    this.boxcolor = this._ready ? "#9F9" : "#FA5";
                    requestPatch(
                        this,
                        ModernNodeChangeMask,
                        ModernNodeChangeMask.Data | ModernNodeChangeMask.Style
                    );
                }

                onAction(action, param) {
                    if (action == "go") {
                        this.triggerSlot(this._ready ? 0 : 1, param);
                    } else if (action == "green") {
                        this._ready = true;
                    } else if (action == "red") {
                        this._ready = false;
                    }
                    requestPatch(this, ModernNodeChangeMask);
                }

                getShellState(context) {
                    var shellState = BaseNode.prototype.getShellState.call(
                        this,
                        context
                    );
                    shellState.headerMetaText = this._ready ? "OPEN" : "STOP";
                    shellState.minimumWidth = 170;
                    shellState.summaryText = this._ready
                        ? "continuing"
                        : "blocked";
                    return shellState;
                }
            }

            SemaphoreEvent.type = "events/semaphore";
            SemaphoreEvent.title = "Semaphore Event";
            SemaphoreEvent.desc =
                "Until both events are not triggered, it doesnt continue.";

            class OnceEvent extends BaseNode {
                constructor(title) {
                    super(title);
                    this.addInput("in", LiteGraph.ACTION);
                    this.addInput("reset", LiteGraph.ACTION);
                    this.addOutput("out", LiteGraph.EVENT);
                    this._once = false;
                    this.properties = {};
                    this.size = [140, 64];
                }

                defineWidgets() {
                    return [
                        {
                            id: "reset",
                            type: "button",
                            name: "reset",
                            label: "Reset",
                            value: null,
                            options: {
                                callback: this.resetOnce.bind(this),
                            },
                        },
                    ];
                }

                resetOnce() {
                    this._once = false;
                    requestPatch(this, ModernNodeChangeMask);
                }

                onAction(action, param) {
                    if (action == "in" && !this._once) {
                        this._once = true;
                        this.triggerSlot(0, param);
                    } else if (action == "reset") {
                        this._once = false;
                    }
                    requestPatch(this, ModernNodeChangeMask);
                }

                getShellState(context) {
                    var shellState = BaseNode.prototype.getShellState.call(
                        this,
                        context
                    );
                    shellState.headerMetaText = this._once ? "LOCK" : "OPEN";
                    shellState.minimumWidth = 146;
                    shellState.summaryText = this._once
                        ? "waiting reset"
                        : "armed";
                    return shellState;
                }
            }

            OnceEvent.type = "events/once";
            OnceEvent.title = "Once";
            OnceEvent.desc = "Only passes an event once, then gets locked";

            class DataStore extends BaseNode {
                constructor(title) {
                    super(title);
                    this.addInput("data", 0);
                    this.addInput("assign", LiteGraph.ACTION);
                    this.addOutput("data", 0);
                    this._last_value = null;
                    this.properties = { data: null, serialize: true };
                    this.size = [170, 72];
                }

                defineWidgets() {
                    return [
                        {
                            id: "store",
                            type: "button",
                            name: "store",
                            label: "Store",
                            value: null,
                            options: {
                                callback: this.storeValue.bind(this),
                            },
                        },
                        {
                            id: "serialize",
                            type: "toggle",
                            name: "serialize",
                            label: "Serialize",
                            value: this.properties.serialize,
                            property: "serialize",
                        },
                    ];
                }

                storeValue() {
                    this.properties.data = this._last_value;
                    requestPatch(this, ModernNodeChangeMask);
                }

                onExecute() {
                    this._last_value = this.getInputData(0);
                    this.setOutputData(0, this.properties.data);
                }

                onAction() {
                    this.properties.data = this._last_value;
                    requestPatch(this, ModernNodeChangeMask);
                }

                onSerialize(serialized) {
                    if (serialized.data == null) {
                        return;
                    }
                    if (
                        this.properties.serialize == false ||
                        (serialized.data.constructor !== String &&
                            serialized.data.constructor !== Number &&
                            serialized.data.constructor !== Boolean &&
                            serialized.data.constructor !== Array &&
                            serialized.data.constructor !== Object)
                    ) {
                        serialized.data = null;
                    }
                }

                getShellState(context) {
                    var shellState = BaseNode.prototype.getShellState.call(
                        this,
                        context
                    );
                    shellState.headerMetaText = "STORE";
                    shellState.minimumWidth = 188;
                    shellState.summaryText =
                        this.properties.data == null
                            ? "empty"
                            : truncateText(
                                  String(this.properties.data),
                                  18
                              );
                    return shellState;
                }
            }

            DataStore.type = "basic/data_store";
            DataStore.title = "Data Store";
            DataStore.desc =
                "Stores data and only changes when event is received";

            return [
                LogEvent,
                TriggerEvent,
                Sequence,
                WaitAll,
                Stepper,
                FilterEvent,
                EventBranch,
                EventCounter,
                DelayEvent,
                TimerEvent,
                SemaphoreEvent,
                OnceEvent,
                DataStore,
            ];
        },
    };
});
