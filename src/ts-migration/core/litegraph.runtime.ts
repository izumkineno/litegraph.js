// TODO: Import LGraphNode from its future module
// TODO: Import LiteGraph runtime host from its future module

import type {
    LGraphNodeConstructorLike,
    LGraphNodeLike,
} from "./litegraph.registry";

type SlotType = string | number;

interface SlotTypeBucket {
    nodes: string[];
}

interface BuildNodeClassFromObjectShape {
    title?: string;
    desc?: string;
    inputs?: Array<[string, SlotType]>;
    outputs?: Array<[string, SlotType]>;
    properties?: Record<string, unknown>;
    [key: string]: unknown;
}

type FetchFileType = "text" | "string" | "arraybuffer" | "json" | "blob";

interface GeneratedNodeClassLike extends LGraphNodeConstructorLike {
    desc?: string;
}

interface LGraphNodeRuntimeLike extends LGraphNodeLike {
    addInput: (name: string, type: SlotType) => void;
    addOutput: (name: string, type: SlotType) => void;
    addProperty: (name: string, value: unknown) => void;
    getInputData: (index: number) => unknown;
    setOutputData: (index: number, value: unknown) => void;
    onCreate?: () => void;
    onExecute?: () => void;
}

export interface LiteGraphRuntimeHost {
    EVENT: number;
    ACTION: number;
    proxy: string | null;
    debug: boolean;
    throw_errors: boolean;

    registered_node_types: Record<string, LGraphNodeConstructorLike>;
    registered_slot_in_types: Record<string, SlotTypeBucket>;
    registered_slot_out_types: Record<string, SlotTypeBucket>;
    slot_types_in: string[];
    slot_types_out: string[];
    searchbox_extras: Record<
        string,
        {
            type: string;
            desc: string;
            data: unknown;
        }
    >;

    registerNodeType: (type: string, baseClass: LGraphNodeConstructorLike) => void;
    getParameterNames: (func: (...args: unknown[]) => unknown) => string[];
}

/**
 * LiteGraph 运行辅助 API 迁移层（Task 06）。
 * 来源：`registerNodeAndSlotType`、`buildNodeClassFromObject`、`wrapFunctionAsNode`、
 * `isValidConnection`、`fetchFile` 等。
 */
export class LiteGraphRuntime {
    private readonly host: LiteGraphRuntimeHost;

    constructor(host: LiteGraphRuntimeHost) {
        this.host = host;
    }

    /**
    * Save a slot type and his node
    * @method registerSlotType
    * @param {String|Object} type name of the node or the node constructor itself
    * @param {String} slot_type name of the slot type (variable type), eg. string, number, array, boolean, ..
    */
    registerNodeAndSlotType(
        type: string | LGraphNodeConstructorLike,
        slotType: SlotType,
        out?: boolean
    ): void {
        out = out || false;
        const registeredType = (
            this.host.registered_node_types as Record<string, unknown>
        )[String(type)];
        const baseClass =
            typeof type === "string" && registeredType != "anonymous"
                ? registeredType
                : type;

        const classType = (baseClass as unknown as { constructor: { type: string } })
            .constructor.type;

        let allTypes: string[] = [];
        if (typeof slotType === "string") {
            allTypes = slotType.split(",");
        } else if (slotType == this.host.EVENT || slotType == this.host.ACTION) {
            allTypes = ["_event_"];
        } else {
            allTypes = ["*"];
        }

        for (let i = 0; i < allTypes.length; ++i) {
            let normalizedSlotType = allTypes[i];
            if (normalizedSlotType === "") {
                normalizedSlotType = "*";
            }
            const registerTo = out
                ? this.host.registered_slot_out_types
                : this.host.registered_slot_in_types;
            if (registerTo[normalizedSlotType] === undefined) {
                registerTo[normalizedSlotType] = { nodes: [] };
            }
            if (!registerTo[normalizedSlotType].nodes.includes(classType)) {
                registerTo[normalizedSlotType].nodes.push(classType);
            }

            // check if is a new type
            if (!out) {
                if (
                    !this.host.slot_types_in.includes(
                        normalizedSlotType.toLowerCase()
                    )
                ) {
                    this.host.slot_types_in.push(normalizedSlotType.toLowerCase());
                    this.host.slot_types_in.sort();
                }
            } else if (
                !this.host.slot_types_out.includes(normalizedSlotType.toLowerCase())
            ) {
                this.host.slot_types_out.push(normalizedSlotType.toLowerCase());
                this.host.slot_types_out.sort();
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
    buildNodeClassFromObject(
        name: string,
        object: BuildNodeClassFromObjectShape
    ): LGraphNodeConstructorLike {
        let ctorCode = "";
        if (object.inputs) {
            for (let i = 0; i < object.inputs.length; ++i) {
                const inputName = object.inputs[i][0];
                let inputType: unknown = object.inputs[i][1];
                if (inputType && inputType.constructor === String) {
                    inputType = '"' + inputType + '"';
                }
                ctorCode += "this.addInput('" + inputName + "'," + inputType + ");\n";
            }
        }
        if (object.outputs) {
            for (let i = 0; i < object.outputs.length; ++i) {
                const outputName = object.outputs[i][0];
                let outputType: unknown = object.outputs[i][1];
                if (outputType && outputType.constructor === String) {
                    outputType = '"' + outputType + '"';
                }
                ctorCode +=
                    "this.addOutput('" + outputName + "'," + outputType + ");\n";
            }
        }
        if (object.properties) {
            for (const key in object.properties) {
                let prop = object.properties[key];
                if (prop && (prop as { constructor?: unknown }).constructor === String) {
                    prop = '"' + prop + '"';
                }
                ctorCode += "this.addProperty('" + key + "'," + prop + ");\n";
            }
        }
        ctorCode += "if(this.onCreate)this.onCreate()";

        const classObject = Function(ctorCode) as unknown as GeneratedNodeClassLike;
        for (const key in object) {
            if (key !== "inputs" && key !== "outputs" && key !== "properties") {
                classObject.prototype[key] = object[key];
            }
        }
        classObject.title = object.title || name.split("/").pop();
        classObject.desc = (object.desc as string) || "Generated from object";
        this.host.registerNodeType(name, classObject);
        return classObject;
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
    wrapFunctionAsNode(
        name: string,
        func: (...args: unknown[]) => unknown,
        paramTypes?: Array<string | number | null> | null,
        returnType?: string | number | null,
        properties?: object
    ): LGraphNodeConstructorLike {
        const params = Array(func.length);
        let code = "";
        if (paramTypes !== null) {
            // null means no inputs
            const names = this.host.getParameterNames(func);
            for (let i = 0; i < names.length; ++i) {
                let type: string | number = 0;
                if (paramTypes) {
                    if (paramTypes[i] != null && paramTypes[i]?.constructor === String) {
                        type = "'" + paramTypes[i] + "'";
                    } else if (paramTypes[i] != null) {
                        type = paramTypes[i] as number;
                    }
                }
                code += "this.addInput('" + names[i] + "'," + type + ");\n";
            }
        }
        if (returnType !== null) {
            // null means no output
            code +=
                "this.addOutput('out'," +
                (returnType != null
                    ? returnType.constructor === String
                        ? "'" + returnType + "'"
                        : returnType
                    : 0) +
                ");\n";
        }
        if (properties) {
            code += "this.properties = " + JSON.stringify(properties) + ";\n";
        }
        const classObject = Function(code) as unknown as GeneratedNodeClassLike;
        classObject.title = name.split("/").pop();
        classObject.desc = "Generated from " + func.name;
        classObject.prototype.onExecute = function onExecute(
            this: LGraphNodeRuntimeLike
        ): void {
            for (let i = 0; i < params.length; ++i) {
                params[i] = this.getInputData(i);
            }
            const result = func.apply(this, params);
            this.setOutputData(0, result);
        };
        this.host.registerNodeType(name, classObject);
        return classObject;
    }

    // debug purposes: reloads all the js scripts that matches a wildcard
    reloadNodes(folderWildcard: string): void {
        const scripts = document.getElementsByTagName("script");
        // weird, this array changes by its own, so we use a copy
        const scriptFiles: HTMLScriptElement[] = [];
        for (let i = 0; i < scripts.length; i++) {
            scriptFiles.push(scripts[i]);
        }

        const docHeadObj = document.getElementsByTagName("head")[0];
        folderWildcard = document.location.href + folderWildcard;

        for (let i = 0; i < scriptFiles.length; i++) {
            const src = scriptFiles[i].src;
            if (!src || src.substr(0, folderWildcard.length) !== folderWildcard) {
                continue;
            }

            try {
                if (this.host.debug) {
                    console.log("Reloading: " + src);
                }
                const dynamicScript = document.createElement("script");
                dynamicScript.type = "text/javascript";
                dynamicScript.src = src;
                docHeadObj.appendChild(dynamicScript);
                docHeadObj.removeChild(scriptFiles[i]);
            } catch (err) {
                if (this.host.throw_errors) {
                    throw err;
                }
                if (this.host.debug) {
                    console.log("Error while reloading " + src);
                }
            }
        }

        if (this.host.debug) {
            console.log("Nodes reloaded");
        }
    }

    // separated just to improve if it does not work
    cloneObject<TSource extends object, TTarget extends object | undefined>(
        obj: TSource | null | undefined,
        target?: TTarget
    ): TSource | TTarget | null {
        if (obj == null) {
            return null;
        }
        const cloned = JSON.parse(JSON.stringify(obj)) as TSource;
        if (!target) {
            return cloned;
        }

        for (const key in cloned) {
            (target as Record<string, unknown>)[key] = (
                cloned as Record<string, unknown>
            )[key];
        }
        return target;
    }

    /*
     * https://gist.github.com/jed/982883?permalink_comment_id=852670#gistcomment-852670
     */
    uuidv4(): string {
        const pattern = "10000000-1000-4000-8000-100000000000";
        return pattern
            .replace(/[018]/g, (a: string) =>
                (
                    (Number(a) ^ ((Math.random() * 16) >> (Number(a) / 4)))
                ).toString(16)
            );
    }

    /**
     * Returns if the types of two slots are compatible (taking into account wildcards, etc)
     * @method isValidConnection
     * @param {String} type_a
     * @param {String} type_b
     * @return {Boolean} true if they can be connected
     */
    isValidConnection(typeA: SlotType, typeB: SlotType): boolean {
        if (typeA == "" || typeA === "*") {
            typeA = 0;
        }
        if (typeB == "" || typeB === "*") {
            typeB = 0;
        }
        if (
            !typeA || // generic output
            !typeB || // generic input
            typeA == typeB || // same type (is valid for triggers)
            (typeA == this.host.EVENT && typeB == this.host.ACTION)
        ) {
            return true;
        }

        // Enforce string type to handle toLowerCase call (-1 number not ok)
        let normalizedA = String(typeA).toLowerCase();
        let normalizedB = String(typeB).toLowerCase();

        // For nodes supporting multiple connection types
        if (normalizedA.indexOf(",") === -1 && normalizedB.indexOf(",") === -1) {
            return normalizedA === normalizedB;
        }

        // Check all permutations to see if one is valid
        const supportedTypesA = normalizedA.split(",");
        const supportedTypesB = normalizedB.split(",");
        for (let i = 0; i < supportedTypesA.length; ++i) {
            for (let j = 0; j < supportedTypesB.length; ++j) {
                if (
                    this.isValidConnection(
                        supportedTypesA[i],
                        supportedTypesB[j]
                    )
                ) {
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
    registerSearchboxExtra(nodeType: string, description: string, data: unknown): void {
        this.host.searchbox_extras[description.toLowerCase()] = {
            type: nodeType,
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
    fetchFile(
        url: string | File | Blob | null | undefined,
        type: FetchFileType = "text",
        onComplete?: (data: unknown) => void,
        onError?: (error: unknown) => void
    ): Promise<void> | void | null {
        if (!url) {
            return null;
        }

        if (url.constructor === String) {
            let normalizedUrl = url as string;
            if (
                normalizedUrl.substr(0, 4) === "http" &&
                this.host.proxy
            ) {
                normalizedUrl =
                    this.host.proxy + normalizedUrl.substr(normalizedUrl.indexOf(":") + 3);
            }
            return fetch(normalizedUrl)
                .then((response) => {
                    if (!response.ok) {
                        throw new Error("File not found"); // it will be catch below
                    }
                    if (type === "arraybuffer") {
                        return response.arrayBuffer();
                    }
                    if (type === "text" || type === "string") {
                        return response.text();
                    }
                    if (type === "json") {
                        return response.json();
                    }
                    if (type === "blob") {
                        return response.blob();
                    }
                })
                .then((data) => {
                    if (onComplete) {
                        onComplete(data);
                    }
                })
                .catch((error) => {
                    console.error("error fetching file:", normalizedUrl);
                    if (onError) {
                        onError(error);
                    }
                });
        }
        if (url.constructor === File || url.constructor === Blob) {
            const reader = new FileReader();
            reader.onload = (event) => {
                let value: unknown = event.target?.result;
                if (type === "json") {
                    value = JSON.parse(String(value));
                }
                if (onComplete) {
                    onComplete(value);
                }
            };
            if (type === "arraybuffer") {
                return reader.readAsArrayBuffer(url);
            }
            if (type === "text" || type === "json") {
                return reader.readAsText(url);
            }
            if (type === "blob") {
                return reader.readAsBinaryString(url);
            }
        }
        return null;
    }
}
