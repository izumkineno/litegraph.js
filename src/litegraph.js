import { LLink } from "./llink.js";
import { LGraph } from "./lgraph.js";
import { LGraphNode } from "./lgraphnode.js";
import { LGraphGroup } from "./lgraphgroup.js";
import { LGraphCanvas } from "./lgraphcanvas.js";
import { DragAndScale } from "./dragandscale.js";
import { ContextMenu } from "./contextmenu.js";

/**
 * @class LiteGraph
 *
 * @NOTE:
 * Try to avoid adding things to this class.
 * https://dzone.com/articles/singleton-anti-pattern
 */
export var LiteGraph = new class {
    constructor() {

        this.VERSION = "0.10.2";

        // from OG LiteGraph, just bringing it back for compatibility
        this.LLink = LLink;
        this.LGraph = LGraph;
        this.LGraphNode = LGraphNode;
        this.LGraphGroup = LGraphGroup;
        this.LGraphCanvas = LGraphCanvas;
        this.DragAndScale = DragAndScale;
        this.ContextMenu = ContextMenu;

        this.CANVAS_GRID_SIZE = 10;
        this.NODE_TITLE_HEIGHT = 30;
        this.NODE_TITLE_TEXT_Y = 20;
        this.NODE_SLOT_HEIGHT = 20;
        this.NODE_WIDGET_HEIGHT = 20;
        this.NODE_WIDTH = 140;
        this.NODE_MIN_WIDTH = 50;
        this.NODE_COLLAPSED_RADIUS = 10;
        this.NODE_COLLAPSED_WIDTH = 80;
        this.NODE_TITLE_COLOR = "#999";
        this.NODE_SELECTED_TITLE_COLOR = "#FFF";
        this.NODE_TEXT_SIZE = 14;
        this.NODE_TEXT_COLOR = "#AAA";
        this.NODE_SUBTEXT_SIZE = 12;
        this.NODE_DEFAULT_COLOR = "#333";
        this.NODE_DEFAULT_BGCOLOR = "#353535";
        this.NODE_DEFAULT_BOXCOLOR = "#666";
        this.NODE_DEFAULT_SHAPE = "box";
        this.NODE_BOX_OUTLINE_COLOR = "#FFF";
        this.DEFAULT_SHADOW_COLOR = "rgba(0,0,0,0.5)";
        this.DEFAULT_GROUP_FONT = 24;

        this.WIDGET_BGCOLOR = "#222";
        this.WIDGET_OUTLINE_COLOR = "#666";
        this.WIDGET_TEXT_COLOR = "#DDD";
        this.WIDGET_SECONDARY_TEXT_COLOR = "#999";

        this.LINK_COLOR = "#9A9";
        this.EVENT_LINK_COLOR = "#A86";
        this.CONNECTING_LINK_COLOR = "#AFA";

        this.MAX_NUMBER_OF_NODES = 1000; // avoid infinite loops
        this.DEFAULT_POSITION = [100, 100]; // default node position
        this.VALID_SHAPES = ["default", "box", "round", "card"]; // ,"circle"

        // shapes are used for nodes but also for slots
        this.BOX_SHAPE = 1;
        this.ROUND_SHAPE = 2;
        this.CIRCLE_SHAPE = 3;
        this.CARD_SHAPE = 4;
        this.ARROW_SHAPE = 5;
        this.GRID_SHAPE = 6; // intended for slot arrays

        // enums
        this.INPUT = 1;
        this.OUTPUT = 2;

        this.EVENT = -1; // for outputs
        this.ACTION = -1; // for inputs

        this.NODE_MODES = ["Always", "On Event", "Never", "On Trigger", "On Request"]; // helper, will add "On Request" and more in the future
        this.NODE_MODES_COLORS = ["#666","#422","#333","#224","#626"]; // use with node_box_coloured_by_mode
        this.ALWAYS = 0;
        this.ON_EVENT = 1;
        this.NEVER = 2;
        this.ON_TRIGGER = 3;
        this.ON_REQUEST = 4; // used from event-based nodes, where ancestors are recursively executed on needed

        this.UP = 1;
        this.DOWN = 2;
        this.LEFT = 3;
        this.RIGHT = 4;
        this.CENTER = 5;

        this.LINK_RENDER_MODES = ["Straight", "Linear", "Spline"]; // helper
        this.STRAIGHT_LINK = 0;
        this.LINEAR_LINK = 1;
        this.SPLINE_LINK = 2;

        this.NORMAL_TITLE = 0;
        this.NO_TITLE = 1;
        this.TRANSPARENT_TITLE = 2;
        this.AUTOHIDE_TITLE = 3;
        this.VERTICAL_LAYOUT = "vertical"; // arrange nodes vertically

        this.proxy = null; // used to redirect calls
        this.node_images_path = "";

        this.catch_exceptions = true;
        this.throw_errors = true;
        // 如果设置为true,一些节点(如Formula)将被允许评估来自不安全源(如节点配置)的代码,这可能导致漏洞
        this.allow_scripts = false;
        // 在图执行流程中执行操作
        this.use_deferred_actions = true;
        // 按字符串存储节点类型
        this.registered_node_types = {};
        // 用于在画布上拖放文件
        this.node_types_by_file_extension = {};
        // 按类名存储节点类型
        this.Nodes = {};
        // 用于在图之间存储变量
        this.Globals = {};
        // 用于向搜索框添加额外功能
        this.searchbox_extras = {};
        // 如果设置为true,将自动对上下文菜单中的节点类型/类别进行排序
        this.auto_sort_node_types = false; // [true!]

        // 当触发时(执行/动作)使节点框(左上角圆圈)变色,提供视觉反馈
        this.node_box_coloured_when_on = false; // [true!]
        // 根据节点模式为节点框着色,提供视觉反馈
        this.node_box_coloured_by_mode = false; // [true!]

        // 鼠标离开时关闭对话框,在非触摸设备上最好为true
        this.dialog_close_on_mouse_leave = true; // [false on mobile]
        this.dialog_close_on_mouse_leave_delay = 500;

        // 如果结果太容易断开链接,最好设为false - 用ALT或自定义键实现
        this.shift_click_do_break_link_from = false; // [false!]
        // 最好为false,断开链接太容易了
        this.click_do_break_link_to = false; // [false!]

        // 鼠标离开时隐藏搜索,在非触摸设备上最好为true
        this.search_hide_on_mouse_leave = true; // [false on mobile]
        // 在搜索小部件中启用插槽类型过滤,需要auto_load_slot_types或手动设置registered_slot_[in/out]_types和slot_types_[in/out]
        this.search_filter_enabled = false; // [true!]
        // 打开搜索小部件时显示所有结果
        this.search_show_all_on_open = true; // [true!]

        // 在选定的节点上显示带有节点属性"tooltip"的工具提示
        this.show_node_tooltip = false; // [true!]
        // 当未设置属性tooltip时,从desc启用工具提示
        this.show_node_tooltip_use_descr_property = false;

        // 需要计算节点类型和nodeclass与节点类型的关联,如果不想这样,计算一次并设置registered_slot_[in/out]_types和slot_types_[in/out]
        this.auto_load_slot_types = false; // [if want false, use true, run, get vars values to be statically set, than disable]

        // 如果不使用auto_load_slot_types,请设置这些值
        // nodeclass的插槽类型
        this.registered_slot_in_types = {};
        this.registered_slot_out_types = {};
        // 输入插槽类型
        this.slot_types_in = [];
        // 输出插槽类型
        this.slot_types_out = [];
        // 为每个输入插槽类型指定一个(或多个)默认节点,使用单个字符串、数组或对象(带有node、title、parameters等),如搜索
        this.slot_types_default_in = [];
        // 为每个输出插槽类型指定一个(或多个)默认节点,使用单个字符串、数组或对象(带有node、title、parameters等),如搜索
        this.slot_types_default_out = [];

        this.graphDefaultConfig = {
            align_to_grid: true,
            links_ontop: false,
        };

        // 非常方便,ALT点击克隆并拖动新节点
        this.alt_drag_do_clone_nodes = false; // [true!]
        // 非常方便,克隆时使用SHIFT保持输入连接
        this.alt_shift_drag_connect_clone_with_input = true; // [true!]

        // 使用动作/事件连接时将创建并连接事件插槽,使用onTrigger时将更改节点模式(启用模式颜色),onExecuted不需要这个
        this.do_add_triggers_slots = false; // [true!]

        // 强烈建议按顺序一个接一个地使用事件
        this.allow_multi_output_for_events = true; // [false!]

        // 允许使用第三个按钮(滚轮)点击创建和连接节点
        this.middle_click_slot_add_default_node = false; // [true!]

        // 将链接拖到空白处将打开菜单,从列表、搜索或默认值中添加
        this.release_link_on_empty_shows_menu = false; // [true!]
        // 使用指针事件isPrimary,当不是主要时模拟右键点击
        this.two_fingers_opens_menu = false; // [true!]

        // 删除键就足够了,不要干扰文本编辑和自定义
        this.backspace_delete = true; // [false!]

        // 允许使用ctrl + shift + v粘贴节点,并将未选中节点的输出与新粘贴节点的输入连接
        this.ctrl_shift_v_paste_connect_unselected_outputs = false; // [true!]

        // cntrlZ, cntrlY
        this.actionHistory_enabled = false;
        this.actionHistoryMaxSave = 40;

        /* 更新值后执行操作 - 祖先 */
        // 在触发器上刷新祖先
        this.refreshAncestorsOnTriggers = false; // [true!]
        // 在动作上刷新祖先
        this.refreshAncestorsOnActions = false; // [true!]
        // 新技术..让它发挥最佳效果
        this.ensureUniqueExecutionAndActionCall = false; // [true!]

        // 如果为true,所有新创建的节点/链接将使用字符串UUID作为其id字段,而不是整数。
        // 如果您必须在所有图形和子图中使用唯一的节点ID,请使用此选项。
        this.use_uuids = false;

        // 启用使用按键过滤上下文菜单元素(+箭头导航,Esc关闭)
        this.context_menu_filter_enabled = false; // FIX event handler removal

        this.showCanvasOptions = false; // [true!] customize availableCanvasOptions
        this.availableCanvasOptions = [
            "allow_addOutSlot_onExecuted",
            "free_resize",
            "highquality_render",
            "use_gradients", // set to true to render titlebar with gradients
            "pause_rendering",
            "clear_background",
            "read_only", // if set to true users cannot modify the graph
            // "render_only_selected", // not implemented
            "live_mode",
            "show_info",
            "allow_dragcanvas",
            "allow_dragnodes",
            "allow_interaction", // allow to control widgets, buttons, collapse, etc
            "allow_searchbox",
            "move_destination_link_without_shift", // rename: old allow_reconnect_links //allows to change a connection, no need to hold shift
            "set_canvas_dirty_on_mouse_event", // forces to redraw the canvas if the mouse does anything
            "always_render_background",
            "render_shadows",
            "render_canvas_border",
            "render_connections_shadows", // too much cpu
            "render_connections_border",
            // ,"render_curved_connections", // always on, or specific fixed graph
            "render_connection_arrows",
            "render_collapsed_slots",
            "render_execution_order",
            "render_title_colored",
            "render_link_tooltip",
        ];
        // ,"editor_alpha" //= 1; //used for transition

        this.actionHistoryMaxSave = 40;

        this.canRemoveSlots = true;
        this.canRemoveSlots_onlyOptional = true;
        this.canRenameSlots = true;
        this.canRenameSlots_onlyOptional = true;

        this.ensureNodeSingleExecution = false; // OLD this will prevent nodes to be executed more than once for step (comparing graph.iteration)
        this.ensureNodeSingleAction = false; // OLD this will prevent nodes to be executed more than once for action call!
        this.preventAncestorRecalculation = false; // OLD(?) when calculating the ancestors, set a flag to prevent recalculate the subtree

        this.ensureUniqueExecutionAndActionCall = true; // NEW ensure single event execution

        this.allowMultiOutputForEvents = false; // being events, it is strongly reccomended to use them sequentually, one by one


        this.log_methods = ['error', 'warn', 'info', 'log', 'debug'];
        // this.loggingSetup();

        // this.debug = 1; // has custom get set, in this.debug_level is stored the actual numeric value
        // this.debug_level = 1;
        this.logging_set_level(2);
    }

    // get and set debug (log)level
    // from -1 (none), 0 (error), .. to 4 (debug) based on console methods 'error', 'warn', 'info', 'log', 'debug'
    logging_set_level(v) {
        this.debug_level = Number(v);
    }

    // entrypoint to debug log
    logging(lvl/**/) { // arguments

        if(lvl > this.debug_level)
            return; // -- break, debug only below or equal current --

        function clean_args(args) {
            let aRet = [];
            for(let iA=1; iA<args.length; iA++) {
                if(typeof(args[iA])!=="undefined") aRet.push(args[iA]);
            }
            return aRet;
        }

        let lvl_txt = "debug";
        if(lvl>=0&&lvl<=4) lvl_txt = ['error', 'warn', 'info', 'log', 'debug'][lvl];

        if(typeof(console[lvl_txt])!=="function") {
            console.warn("[LG-log] invalid console method",lvl_txt,clean_args(arguments));
            throw new RangeError;
        }

        console[lvl_txt]("[LG]",...clean_args(arguments));
    }
    error() {
        this.logging(0,...arguments);
    }
    warn() {
        this.logging(1,...arguments);
    }
    info() {
        this.logging(2,...arguments);
    }
    log() {
        this.logging(3,...arguments);
    }
    debug() {
        this.logging(4,...arguments);
    }

    /**
     * Register a node class so it can be listed when the user wants to create a new one
     * @method registerNodeType
     * @param {String} type name of the node and path
     * @param {Class} base_class class containing the structure of a node
     */
    // 注册一个节点类,以便在用户想要创建新节点时可以列出
    registerNodeType(type, base_class) {
        if (!base_class.prototype) {
            throw new Error("Cannot register a simple object, it must be a class with a prototype");
        }
        base_class.type = type;

        this.debug?.("registerNodeType","start",type);

        const classname = base_class.name;

        const pos = type.lastIndexOf("/");
        base_class.category = type.substring(0, pos);

        if (!base_class.title) {
            base_class.title = classname;
        }

        const propertyDescriptors = Object.getOwnPropertyDescriptors(LGraphNode.prototype);

        // Iterate over each property descriptor
        // 遍历每个属性描述符
        Object.keys(propertyDescriptors).forEach((propertyName) => {
            // Check if the property already exists on the target prototype
            // 检查目标原型上是否已存在该属性
            if (!base_class.prototype.hasOwnProperty(propertyName)) {
                // If the property doesn't exist, copy it from the source to the target
                // 如果属性不存在,则从源复制到目标
                Object.defineProperty(base_class.prototype, propertyName, propertyDescriptors[propertyName]);
            }
        });

        const prev = this.registered_node_types[type];
        if(prev) {
            this.debug?.("registerNodeType","replacing node type",type,prev);
        }
        if( !Object.prototype.hasOwnProperty.call( base_class.prototype, "shape") ) {
            Object.defineProperty(base_class.prototype, "shape", {
                set: function(v) {
                    switch (v) {
                        case "default":
                            delete this._shape;
                            break;
                        case "box":
                            this._shape = LiteGraph.BOX_SHAPE;
                            break;
                        case "round":
                            this._shape = LiteGraph.ROUND_SHAPE;
                            break;
                        case "circle":
                            this._shape = LiteGraph.CIRCLE_SHAPE;
                            break;
                        case "card":
                            this._shape = LiteGraph.CARD_SHAPE;
                            break;
                        default:
                            this._shape = v;
                    }
                },
                get: function() {
                    return this._shape;
                },
                enumerable: true,
                configurable: true,
            });


            // used to know which nodes to create when dragging files to the canvas
            // 用于知道在将文件拖到画布上时要创建哪些节点
            if (base_class.supported_extensions) {
                for (let i in base_class.supported_extensions) {
                    const ext = base_class.supported_extensions[i];
                    if(ext && ext.constructor === String) {
                        this.node_types_by_file_extension[ext.toLowerCase()] = base_class;
                    }
                }
            }
        }

        this.registered_node_types[type] = base_class;
        if (base_class.constructor.name) {
            this.Nodes[classname] = base_class;
        }
        LiteGraph.onNodeTypeRegistered?.(type, base_class);
        if (prev) {
            LiteGraph.onNodeTypeReplaced?.(type, base_class, prev);
        }

        // warnings
        // 警告
        if (base_class.prototype.onPropertyChange) {
            LiteGraph.warn("LiteGraph node class " +
                    type +
                    " has onPropertyChange method, it must be called onPropertyChanged with d at the end");
        }

        // used to know which nodes create when dragging files to the canvas
        // 用于知道在将文件拖到画布上时要创建哪些节点
        if (base_class.supported_extensions) {
            for (var i=0; i < base_class.supported_extensions.length; i++) {
                var ext = base_class.supported_extensions[i];
                if(ext && ext.constructor === String)
                    this.node_types_by_file_extension[ext.toLowerCase()] = base_class;
            }
        }

        this.debug?.("registerNodeType","type registered",type);

        if (this.auto_load_slot_types)
            this.debug?.("registerNodeType","do auto_load_slot_types",type);
        new base_class(base_class.title ?? "tmpnode");
    }

    /**
     * removes a node type from the system
     * 从系统中移除一个节点类型
     * @method unregisterNodeType
     * @param {String|Object} type name of the node or the node constructor itself
     * 节点的名称或节点构造函数本身
     */
    unregisterNodeType(type) {
        // 确定要移除的基类
        const base_class =
            type.constructor === String
                ? this.registered_node_types[type]
                : type;
        // 如果找不到基类，抛出错误
        if (!base_class) {
            throw new Error("node type not found: " + type);
        }
        // 从已注册的节点类型中删除该类型
        delete this.registered_node_types[base_class.type];
        // 如果基类有构造函数名，从Nodes对象中删除该类型
        if (base_class.constructor.name) {
            delete this.Nodes[base_class.constructor.name];
        }
    }

    /**
    * Save a slot type and his node
    * 保存插槽类型及其节点
    * @method registerSlotType
    * @param {String|Object} type name of the node or the node constructor itself
    * @param {String} slot_type name of the slot type (variable type), eg. string, number, array, boolean, ..
    */
    registerNodeAndSlotType(type, slot_type, out = false) {
        // 确定基类
        const base_class =
            type.constructor === String &&
            this.registered_node_types[type] !== "anonymous"
                ? this.registered_node_types[type]
                : type;

        // 获取类型
        const class_type = base_class.constructor.type;

        // 处理插槽类型
        let allTypes = [];
        if (typeof slot_type === "string") {
            allTypes = slot_type.split(",");
        } else if (slot_type == this.EVENT || slot_type == this.ACTION) {
            allTypes = ["_event_"];
        } else {
            allTypes = ["*"];
        }

        // 遍历所有类型
        for (let i = 0; i < allTypes.length; ++i) {
            let slotType = allTypes[i];
            if (slotType === "") {
                slotType = "*";
            }
            // 确定注册目标
            const registerTo = out
                ? "registered_slot_out_types"
                : "registered_slot_in_types";
            // 初始化注册对象
            if (this[registerTo][slotType] === undefined) {
                this[registerTo][slotType] = { nodes: [] };
            }
            // 添加类型到注册对象
            if (!this[registerTo][slotType].nodes.includes(class_type)) {
                this[registerTo][slotType].nodes.push(class_type);
            }

            // 检查是否为新类型
            if (!out) {
                // 处理输入插槽类型
                if (!this.slot_types_in.includes(slotType.toLowerCase())) {
                    this.slot_types_in.push(slotType.toLowerCase());
                    this.slot_types_in.sort();
                }
            } else {
                // 处理输出插槽类型
                if (!this.slot_types_out.includes(slotType.toLowerCase())) {
                    this.slot_types_out.push(slotType.toLowerCase());
                    this.slot_types_out.sort();
                }
            }
        }
    }

    /**
     * Create a new nodetype by passing an object with some properties
     * like onCreate, inputs:Array, outputs:Array, properties, onExecute
     * @method buildNodeClassFromObject
     * @param {String} name node name with namespace (p.e.: 'math/sum')
     * @param {Object} object methods expected onCreate, inputs, outputs, properties, onExecute
     */
    // 通过传递一个包含某些属性的对象来创建新的节点类型
    buildNodeClassFromObject(
        name,
        object,
    ) {
        var ctor_code = "";
        // 处理输入
        if(object.inputs)
            for(let i=0; i < object.inputs.length; ++i) {
                let _name = object.inputs[i][0];
                let _type = object.inputs[i][1];
                if(_type && _type.constructor === String)
                    _type = '"'+_type+'"';
                ctor_code += "this.addInput('"+_name+"',"+_type+");\n";
            }
        // 处理输出
        if(object.outputs)
            for(let i=0; i < object.outputs.length; ++i) {
                let _name = object.outputs[i][0];
                let _type = object.outputs[i][1];
                if(_type && _type.constructor === String)
                    _type = '"'+_type+'"';
                ctor_code += "this.addOutput('"+_name+"',"+_type+");\n";
            }
        // 处理属性
        if(object.properties)
            for(let i in object.properties) {
                let prop = object.properties[i];
                if(prop && prop.constructor === String)
                    prop = '"'+prop+'"';
                ctor_code += "this.addProperty('"+i+"',"+prop+");\n";
            }
        ctor_code += "if(this.onCreate)this.onCreate()";
        // 创建类对象
        var classobj = Function(ctor_code);
        // 添加方法到类原型
        for(let i in object)
            if(i!="inputs" && i!="outputs" && i!="properties")
                classobj.prototype[i] = object[i];
        // 设置类标题和描述
        classobj.title = object.title || name.split("/").pop();
        classobj.desc = object.desc || "Generated from object";
        // 注册节点类型
        this.registerNodeType(name, classobj);
        return classobj;
    }

    /**
     * Create a new nodetype by passing a function, it wraps it with a proper class and generates inputs according to the parameters of the function.
     * Useful to wrap simple methods that do not require properties, and that only process some input to generate an output.
     * @method wrapFunctionAsNode
     * @param {String} name node name with namespace (p.e.: 'math/sum')
     * @param {Function} func
     * @param {Array} param_types [optional] an array containing the type of every parameter, otherwise parameters will accept any type
     * @param {String} return_type [optional] string with the return type, otherwise it will be generic
     * @param {Object} properties [optional] properties to be configurable
     */
    wrapFunctionAsNode(name, func, param_types, return_type, properties) {
        // 获取函数参数名称
        const names = LiteGraph.getParameterNames(func);

        // 生成添加输入的代码
        const code = names.map((name, i) => {
            const paramType = param_types?.[i] ? `'${param_types[i]}'` : "0";
            return `this.addInput('${name}', ${paramType});`;
        }).join("\n");

        // 处理返回类型
        const returnTypeStr = return_type ? `'${return_type}'` : 0;
        // 处理属性
        const propertiesStr = properties ? `this.properties = ${JSON.stringify(properties)};` : "";

        // 创建类对象
        const classObj = new Function(`
            ${code}
            this.addOutput('out', ${returnTypeStr});
            ${propertiesStr}
        `);

        // 设置类标题和描述
        classObj.title = name.split("/").pop();
        classObj.desc = `Generated from ${func.name}`;

        // 定义onExecute方法
        classObj.prototype.onExecute = function() {
            // 获取输入参数
            const params = names.map((name, i) => this.getInputData(i));
            // 执行函数并设置输出
            const result = func.apply(this, params);
            this.setOutputData(0, result);
        };

        // 注册节点类型
        this.registerNodeType(name, classObj);

        return classObj;
    }


    /**
     * Removes all previously registered node's types
     */
    clearRegisteredTypes() {
        this.registered_node_types = {};
        this.node_types_by_file_extension = {};
        this.Nodes = {};
        this.searchbox_extras = {};
    }

    /**
     * Adds this method to all nodetypes, existing and to be created
     * (You can add it to LGraphNode.prototype but then existing node types wont have it)
     * @method addNodeMethod
     * @param {Function} func
     */
    addNodeMethod(name, func) {
        // 将方法添加到所有节点类型中，包括现有类型和将要创建的类型
        LGraphNode.prototype[name] = func;
        for (var i in this.registered_node_types) {
            var type = this.registered_node_types[i];
            // 如果类型原型上已存在该方法，则创建一个同名但带下划线前缀的备份
            if (type.prototype[name]) {
                type.prototype["_" + name] = type.prototype[name];
            } // keep old in case of replacing
            type.prototype[name] = func;
        }
    }

    /**
     * Create a node of a given type with a name. The node is not attached to any graph yet.
     * @method createNode
     * @param {String} type full name of the node class. p.e. "math/sin"
     * @param {String} name a name to distinguish from other nodes
     * @param {Object} options to set options
     */
    // 创建一个给定类型和名称的节点。该节点尚未附加到任何图表上。
    createNode(type, title, options = {}) {
        // 从已注册的节点类型中获取基类
        const base_class = this.registered_node_types[type] ?? null;

        // 如果找不到基类，记录错误并返回null
        if (!base_class) {
            this.log?.(`GraphNode type "${type}" not registered.`);
            return null;
        }

        // 设置节点标题，优先级：传入的title > 基类的title > 类型名
        title = title ?? base_class.title ?? type;

        let node = null;

        // 如果启用了异常捕获，则在try-catch块中创建节点
        if (LiteGraph.catch_exceptions) {
            try {
                node = new base_class(title);
            } catch (err) {
                this.error?.(err);
                return null;
            }
        } else {
            // 否则直接创建节点
            node = new base_class(title);
        }

        // 设置节点的各种属性
        node.type = type;
        node.title ??= title;
        node.properties ??= {};
        node.properties_info ??= [];
        node.flags ??= {};
        node.size ??= node.computeSize();
        node.pos ??= LiteGraph.DEFAULT_POSITION.concat();
        node.mode ??= LiteGraph.ALWAYS;

        // 应用额外的选项
        Object.assign(node, options);

        // 调用节点创建后的回调函数（如果存在）
        node.onNodeCreated?.();
        return node;
    }


    /**
     * Returns a registered node type with a given name
     * @method getNodeType
     * @param {String} type full name of the node class. p.e. "math/sin"
     * @return {Class} the node class
     */
    getNodeType(type) {
        return this.registered_node_types[type];
    }

    /**
     * Returns a list of node types matching one category
     * @method getNodeType
     * @param {String} category category name
     * @return {Array} array with all the node classes
     */
    getNodeTypesInCategory(category, filter) {
        // 根据注册的节点类型筛选符合条件的类型
        const filteredTypes = Object.values(this.registered_node_types).filter((type) => {
            // 检查过滤器是否匹配
            if (type.filter !== filter) {
                return false;
            }

            // 检查类别是否匹配
            if (category === "") {
                return type.category === null;
            } else {
                return type.category === category;
            }
        });

        // 如果启用了自动排序，则按标题字母顺序排序
        if (this.auto_sort_node_types) {
            filteredTypes.sort((a, b) => a.title.localeCompare(b.title));
        }

        // 返回筛选后的节点类型列表
        return filteredTypes;
    }


    /**
     * Returns a list with all the node type categories
     * @method getNodeTypesCategories
     * @param {String} filter only nodes with ctor.filter equal can be shown
     * @return {Array} array with all the names of the categories
     */
    getNodeTypesCategories(filter) {
        const categories = { "": 1 };

        Object.values(this.registered_node_types).forEach((type) => {
            if (type.category && !type.skip_list && type.filter === filter) {
                categories[type.category] = 1;
            }
        });

        const result = Object.keys(categories);

        return this.auto_sort_node_types ? result.sort() : result;
    }


    // debug purposes: reloads all the js scripts that matches a wildcard
    reloadNodes(folder_wildcard) {
        var tmp = document.getElementsByTagName("script");
        // weird, this array changes by its own, so we use a copy
        var script_files = [];
        for (let i=0; i < tmp.length; i++) {
            script_files.push(tmp[i]);
        }

        var docHeadObj = document.getElementsByTagName("head")[0];
        folder_wildcard = document.location.href + folder_wildcard;

        for (let i=0; i < script_files.length; i++) {
            var src = script_files[i].src;
            if (
                !src ||
                src.substr(0, folder_wildcard.length) != folder_wildcard
            ) {
                continue;
            }

            try {
                this.log?.("Reloading: " + src);
                var dynamicScript = document.createElement("script");
                dynamicScript.type = "text/javascript";
                dynamicScript.src = src;
                docHeadObj.appendChild(dynamicScript);
                docHeadObj.removeChild(script_files[i]);
            } catch (err) {
                if (LiteGraph.throw_errors) {
                    throw err;
                }
                this.log?.("Error while reloading " + src);
            }
        }
        this.log?.("Nodes reloaded");
    }

    // separated just to improve if it doesn't work
    cloneObject(obj, target) {
        if (obj == null) {
            return null;
        }

        const clonedObj = JSON.parse(JSON.stringify(obj));

        if (!target) {
            return clonedObj;
        }
        for (const key in clonedObj) {
            if (Object.prototype.hasOwnProperty.call(clonedObj, key)) {
                target[key] = clonedObj[key];
            }
        }
        return target;
    }


    /*
        * https://gist.github.com/jed/982883?permalink_comment_id=852670#gistcomment-852670
        */
    uuidv4() {
        return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g,(a) => (a^Math.random()*16>>a/4).toString(16));
    }

    /**
     * Returns if the types of two slots are compatible (taking into account wildcards, etc)
     * @method isValidConnection
     * @param {String} type_a
     * @param {String} type_b
     * @return {Boolean} true if they can be connected
     */
    isValidConnection(type_a, type_b) {
        if (type_a === "" || type_a === "*") type_a = 0;
        if (type_b === "" || type_b === "*") type_b = 0;

        if (!type_a || !type_b || type_a === type_b || (type_a === LiteGraph.EVENT && type_b === LiteGraph.ACTION)) {
            return true;
        }

        type_a = String(type_a).toLowerCase();
        type_b = String(type_b).toLowerCase();

        if (!type_a.includes(",") && !type_b.includes(",")) {
            return type_a === type_b;
        }

        const supported_types_a = type_a.split(",");
        const supported_types_b = type_b.split(",");

        for (const supported_type_a of supported_types_a) {
            for (const supported_type_b of supported_types_b) {
                if (this.isValidConnection(supported_type_a, supported_type_b)) {
                    return true;
                }
            }
        }

        return false;
    }


    /**
     * Register a string in the search box so when the user types it it will recommend this node
     * @method registerSearchboxExtra
     * @param {String} node_type the node recommended
     * @param {String} description text to show next to it
     * @param {Object} data it could contain info of how the node should be configured
     * @return {Boolean} true if they can be connected
     */
    registerSearchboxExtra(node_type, description, data) {
        this.searchbox_extras[description.toLowerCase()] = {
            type: node_type,
            desc: description,
            data: data,
        };
    }

    /**
     * Wrapper to load files (from url using fetch or from file using FileReader)
     * @method fetchFile
     * @param {String|File|Blob} url the url of the file (or the file itself)
     * @param {String} type an string to know how to fetch it: "text","arraybuffer","json","blob"
     * @param {Function} on_complete callback(data)
     * @param {Function} on_error in case of an error
     * @return {FileReader|Promise} returns the object used to
     */
    fetchFile( url, type, on_complete, on_error ) {
        if(!url)
            return null;

        type = type || "text";
        if( url.constructor === String ) {
            if (url.substr(0, 4) == "http" && LiteGraph.proxy) {
                url = LiteGraph.proxy + url.substr(url.indexOf(":") + 3);
            }
            return fetch(url)
                .then((response) => {
                    if(!response.ok)
                        throw new Error("File not found"); // it will be catch below
                    if(type == "arraybuffer")
                        return response.arrayBuffer();
                    else if(type == "text" || type == "string")
                        return response.text();
                    else if(type == "json")
                        return response.json();
                    else if(type == "blob")
                        return response.blob();
                })
                .then((data) => {
                    if(on_complete)
                        on_complete(data);
                })
                .catch((error) => {
                    this.error?.("error fetching file:",url);
                    if(on_error)
                        on_error(error);
                });
        } else if( url.constructor === File || url.constructor === Blob) {
            var reader = new FileReader();
            reader.onload = (e) => {
                var v = e.target.result;
                if( type == "json" )
                    v = JSON.parse(v);
                if(on_complete)
                    on_complete(v);
            }
            if(type == "arraybuffer")
                return reader.readAsArrayBuffer(url);
            else if(type == "text" || type == "json")
                return reader.readAsText(url);
            else if(type == "blob")
                return reader.readAsBinaryString(url);
        }
        return null;
    }

    // @TODO These weren't even directly bound, so could be used as free functions
    compareObjects(a, b) {
        const aKeys = Object.keys(a);

        if (aKeys.length !== Object.keys(b).length) {
            return false;
        }

        return aKeys.every((key) => a[key] === b[key]);
    }

    distance(a, b) {
        const [xA, yA] = a;
        const [xB, yB] = b;

        return Math.sqrt((xB - xA) ** 2 + (yB - yA) ** 2);
    }


    colorToString(c) {
        return (
            "rgba(" +
            Math.round(c[0] * 255).toFixed() +
            "," +
            Math.round(c[1] * 255).toFixed() +
            "," +
            Math.round(c[2] * 255).toFixed() +
            "," +
            (c.length == 4 ? c[3].toFixed(2) : "1.0") +
            ")"
        );
    }

    canvasFillTextMultiline(context, text, x, y, maxWidth, lineHeight) {
        var words = (text+"").trim().split(' ');
        var line = '';
        var ret = {lines: [], maxW: 0, height: 0};
        if (words.length>1) {
            for(var n = 0; n < words.length; n++) {
                var testLine = line + words[n] + ' ';
                var metrics = context.measureText(testLine);
                var testWidth = metrics.width;
                if (testWidth > maxWidth && n > 0) {
                    context.fillText(line, x, y+(lineHeight*ret.lines.length));
                    line = words[n] + ' ';
                    // y += lineHeight;
                    ret.max = testWidth;
                    ret.lines.push(line);
                }else{
                    line = testLine;
                }
            }
        } else {
            line = words[0];
        }
        context.fillText(line, x, y+(lineHeight*ret.lines.length));
        ret.lines.push(line);
        ret.height = lineHeight*ret.lines.length || lineHeight;
        return ret;
    }

    isInsideRectangle(x, y, left, top, width, height) {
        return x > left && x < left + width && y > top && y < top + height;
    }

    // [minx,miny,maxx,maxy]
    growBounding(bounding, x, y) {
        if (x < bounding[0]) {
            bounding[0] = x;
        } else if (x > bounding[2]) {
            bounding[2] = x;
        }

        if (y < bounding[1]) {
            bounding[1] = y;
        } else if (y > bounding[3]) {
            bounding[3] = y;
        }
    }

    // point inside bounding box
    isInsideBounding(p, bb) {
        return p[0] >= bb[0][0] && p[1] >= bb[0][1] && p[0] <= bb[1][0] && p[1] <= bb[1][1];
    }

    // bounding overlap, format: [ startx, starty, width, height ]
    overlapBounding(a, b) {
        const A_end_x = a[0] + a[2];
        const A_end_y = a[1] + a[3];
        const B_end_x = b[0] + b[2];
        const B_end_y = b[1] + b[3];

        return !(a[0] > B_end_x || a[1] > B_end_y || A_end_x < b[0] || A_end_y < b[1]);
    }

    // Convert a hex value to its decimal value - the inputted hex must be in the
    //	format of a hex triplet - the kind we use for HTML colours. The function
    //	will return an array with three values.
    hex2num(hex) {
        if (hex.charAt(0) == "#") {
            hex = hex.slice(1);
        } // Remove the '#' char - if there is one.
        hex = hex.toUpperCase();
        var hex_alphabets = "0123456789ABCDEF";
        var value = new Array(3);
        var k = 0;
        var int1, int2;
        for (var i = 0; i < 6; i += 2) {
            int1 = hex_alphabets.indexOf(hex.charAt(i));
            int2 = hex_alphabets.indexOf(hex.charAt(i + 1));
            value[k] = int1 * 16 + int2;
            k++;
        }
        return value;
    }

    // Give a array with three values as the argument and the function will return
    //	the corresponding hex triplet.
    num2hex(triplet) {
        var hex_alphabets = "0123456789ABCDEF";
        var hex = "#";
        var int1, int2;
        for (var i = 0; i < 3; i++) {
            int1 = triplet[i] / 16;
            int2 = triplet[i] % 16;

            hex += hex_alphabets.charAt(int1) + hex_alphabets.charAt(int2);
        }
        return hex;
    }

    extendClass = (target, origin) => {
        for (let i in origin) {
            // copy class properties
            if (target.hasOwnProperty(i)) {
                continue;
            }
            target[i] = origin[i];
        }

        if (origin.prototype) {
            // copy prototype properties
            for (let i in origin.prototype) {
                // only enumerable
                if (!origin.prototype.hasOwnProperty(i)) {
                    continue;
                }

                if (target.prototype.hasOwnProperty(i)) {
                    // avoid overwriting existing ones
                    continue;
                }

                // copy getters
                if (origin.prototype.__lookupGetter__(i)) {
                    target.prototype.__defineGetter__(
                        i,
                        origin.prototype.__lookupGetter__(i),
                    );
                } else {
                    target.prototype[i] = origin.prototype[i];
                }

                // and setters
                if (origin.prototype.__lookupSetter__(i)) {
                    target.prototype.__defineSetter__(
                        i,
                        origin.prototype.__lookupSetter__(i),
                    );
                }
            }
        }
    }

    // used to create nodes from wrapping functions
    getParameterNames = (func) => { // split & filter [""]
        return (func + "")
            .replace(/[/][/].*$/gm, "") // strip single-line comments
            .replace(/\s+/g, "") // strip white space
            .replace(/[/][*][^/*]*[*][/]/g, "") // strip multi-line comments  /**/
            .split("){", 1)[0]
            .replace(/^[^(]*[(]/, "") // extract the parameters
            .replace(/=[^,]+/g, "") // strip any ES6 defaults
            .split(",")
            .filter(Boolean);
    }

    clamp = (v, a, b) => {
        return a > v ? a : b < v ? b : v;
    };

    // @BUG: Re-add these
    pointerAddListener = () => {
        console.error?.("Removed and being re-integrated sorta");
    };
    pointerRemoveListener = () => {
        console.error?.("Removed and being re-integrated sorta");
    };
    set pointerevents_method(v) {
        console.error?.("Removed and being re-integrated sorta");
    }
    get pointerevents_method() {
        console.error?.("Removed and being re-integrated sorta");
    }

    closeAllContextMenus = () => {
        LiteGraph.warn('LiteGraph.closeAllContextMenus is deprecated in favor of ContextMenu.closeAll()');
        ContextMenu.closeAll();
    };
}

// timer that works everywhere
if (typeof performance != "undefined") {
    LiteGraph.getTime = performance.now.bind(performance);
} else if (typeof Date != "undefined" && Date.now) {
    LiteGraph.getTime = Date.now.bind(Date);
} else if (typeof process != "undefined") {
    LiteGraph.getTime = () => {
        var t = process.hrtime();
        return t[0] * 0.001 + t[1] * 1e-6;
    };
} else {
    LiteGraph.getTime = function getTime() {
        return new Date().getTime();
    };
}

if (typeof window != "undefined" && !window["requestAnimationFrame"]) {
    window.requestAnimationFrame =
        window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        ((callback) => {
            window.setTimeout(callback, 1000 / 60);
        });
}
