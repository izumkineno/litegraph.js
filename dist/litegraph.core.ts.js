var LiteGraphTSMigration = (function(exports) {
  "use strict";
  var _a, _b, _c, _d;
  class DefaultContextMenu {
    constructor(_values, _options, _ref_window) {
    }
    getFirstEvent() {
      return {};
    }
  }
  const defaultHost$1 = {
    EVENT: -1,
    ACTION: -1,
    ALWAYS: 0,
    EVENT_LINK_COLOR: "#A86",
    NODE_MODES: ["Always", "On Event", "Never", "On Trigger"],
    VALID_SHAPES: ["default", "box", "round", "card"],
    do_add_triggers_slots: false,
    dialog_close_on_mouse_leave: true,
    dialog_close_on_mouse_leave_delay: 500,
    ContextMenu: DefaultContextMenu,
    createNode: () => null,
    getNodeTypesCategories: () => [],
    getNodeTypesInCategory: () => [],
    slot_types_default_in: {},
    slot_types_default_out: {}
  };
  let LGraphCanvas$1 = (_a = class {
    static host() {
      return { ...defaultHost$1, ...this.liteGraph || {} };
    }
    static callbackHost() {
      var _a2;
      const activeCtor = (_a2 = _a.active_canvas) == null ? void 0 : _a2.constructor;
      if (activeCtor && typeof activeCtor.host === "function") {
        return activeCtor.host();
      }
      return _a.host();
    }
    /** Create menu for `Add Group` */
    static onGroupAdd(_info, _entry, mouse_event) {
      const canvas = _a.active_canvas;
      if (!canvas) {
        return;
      }
      canvas.getCanvasWindow();
      const host = _a.callbackHost();
      const group = new host.LGraphGroup();
      group.pos = canvas.convertEventToCanvasOffset(mouse_event);
      canvas.graph.add(group);
    }
    /**
     * Determines the furthest nodes in each direction
     * @param nodes {LGraphNode[]} the nodes to from which boundary nodes will be extracted
     * @return {{left: LGraphNode, top: LGraphNode, right: LGraphNode, bottom: LGraphNode}}
     */
    static getBoundaryNodes(nodes) {
      let top = null;
      let right = null;
      let bottom = null;
      let left = null;
      const source = nodes;
      for (const nID in source) {
        const node2 = source[nID];
        const [x2, y2] = node2.pos;
        const [width2, height] = node2.size;
        if (top === null || y2 < top.pos[1]) {
          top = node2;
        }
        if (right === null || x2 + width2 > right.pos[0] + right.size[0]) {
          right = node2;
        }
        if (bottom === null || y2 + height > bottom.pos[1] + bottom.size[1]) {
          bottom = node2;
        }
        if (left === null || x2 < left.pos[0]) {
          left = node2;
        }
      }
      return { top, right, bottom, left };
    }
    /**
     *
     * @param nodes {LGraphNode[]} a list of nodes
     * @param direction {"top"|"bottom"|"left"|"right"} Direction to align the nodes
     * @param align_to {LGraphNode?} Node to align to (if null, align to the furthest node in the given direction)
     */
    static alignNodes(nodes, direction, align_to) {
      if (!nodes) {
        return;
      }
      const canvas = _a.active_canvas;
      let boundaryNodes;
      if (align_to === void 0) {
        boundaryNodes = _a.getBoundaryNodes(nodes);
      } else {
        boundaryNodes = {
          top: align_to,
          right: align_to,
          bottom: align_to,
          left: align_to
        };
      }
      for (const [, node2] of Object.entries(canvas.selected_nodes || {})) {
        switch (direction) {
          case "right":
            node2.pos[0] = boundaryNodes.right.pos[0] + boundaryNodes.right.size[0] - node2.size[0];
            break;
          case "left":
            node2.pos[0] = boundaryNodes.left.pos[0];
            break;
          case "top":
            node2.pos[1] = boundaryNodes.top.pos[1];
            break;
          case "bottom":
            node2.pos[1] = boundaryNodes.bottom.pos[1] + boundaryNodes.bottom.size[1] - node2.size[1];
            break;
        }
      }
      canvas.dirty_canvas = true;
      canvas.dirty_bgcanvas = true;
    }
    static onNodeAlign(_value, _options, event2, prev_menu, node2) {
      const host = _a.callbackHost();
      new host.ContextMenu(["Top", "Bottom", "Left", "Right"], {
        event: event2,
        callback: inner_clicked,
        parentMenu: prev_menu
      });
      function inner_clicked(value) {
        _a.alignNodes(
          _a.active_canvas.selected_nodes,
          value.toLowerCase(),
          node2
        );
      }
    }
    static onGroupAlign(_value, _options, event2, prev_menu) {
      const host = _a.callbackHost();
      new host.ContextMenu(["Top", "Bottom", "Left", "Right"], {
        event: event2,
        callback: inner_clicked,
        parentMenu: prev_menu
      });
      function inner_clicked(value) {
        _a.alignNodes(
          _a.active_canvas.selected_nodes,
          value.toLowerCase()
        );
      }
    }
    /** Create menu for `Add Node` */
    static onMenuAdd(_node, _options, e, prev_menu, callback) {
      const canvas = _a.active_canvas;
      const ref_window2 = canvas.getCanvasWindow();
      const graph = canvas.graph;
      const host = _a.callbackHost();
      function inner_onMenuAdded(base_category, menuRef) {
        const categories = host.getNodeTypesCategories(canvas.filter || graph.filter).filter((category) => category.startsWith(base_category));
        const entries = [];
        categories.map((category) => {
          if (!category) {
            return;
          }
          const base_category_regex = new RegExp("^(" + base_category + ")");
          const category_name = category.replace(base_category_regex, "").split("/")[0];
          const category_path = base_category === "" ? category_name + "/" : base_category + category_name + "/";
          let name = category_name;
          if (name.indexOf("::") != -1) {
            name = name.split("::")[1];
          }
          const index = entries.findIndex((entry) => entry.value === category_path);
          if (index === -1) {
            entries.push({
              value: category_path,
              content: name,
              has_submenu: true,
              callback: (value, _event, _mouseEvent, contextMenu) => {
                const selected = value;
                inner_onMenuAdded(selected.value || "", contextMenu);
              }
            });
          }
        });
        const nodes = host.getNodeTypesInCategory(
          base_category.slice(0, -1),
          canvas.filter || graph.filter
        );
        nodes.map((nodeType) => {
          if (nodeType.skip_list) {
            return;
          }
          entries.push({
            value: nodeType.type,
            content: nodeType.title,
            has_submenu: false,
            callback: (value, _event, _mouseEvent, contextMenu) => {
              const selected = value;
              const first_event = contextMenu.getFirstEvent();
              canvas.graph.beforeChange();
              const newNode = host.createNode(selected.value || "");
              if (newNode) {
                newNode.pos = canvas.convertEventToCanvasOffset(first_event);
                canvas.graph.add(newNode);
              }
              if (callback) {
                callback(newNode);
              }
              canvas.graph.afterChange();
            }
          });
        });
        new host.ContextMenu(entries, { event: e, parentMenu: menuRef }, ref_window2);
      }
      inner_onMenuAdded("", prev_menu);
      return false;
    }
    static onMenuCollapseAll() {
    }
    static onMenuNodeEdit() {
    }
    static showMenuNodeOptionalInputs(_v, _options, e, prev_menu, node2) {
      if (!node2) {
        return;
      }
      const that2 = this;
      const canvas = _a.active_canvas;
      if (!canvas) {
        return;
      }
      const ref_window2 = canvas.getCanvasWindow();
      const host = _a.callbackHost();
      let optInputs = node2.optional_inputs;
      if (node2.onGetInputs) {
        optInputs = node2.onGetInputs();
      }
      let entries = [];
      if (optInputs) {
        for (let i2 = 0; i2 < optInputs.length; i2++) {
          const entry = optInputs[i2];
          if (!entry) {
            entries.push(null);
            continue;
          }
          let label = entry[0];
          if (!entry[2]) {
            entry[2] = {};
          }
          if (entry[2].label) {
            label = String(entry[2].label);
          }
          entry[2].removable = true;
          const data = { content: label, value: entry };
          if (entry[1] == host.ACTION) {
            data.className = "event";
          }
          entries.push(data);
        }
      }
      if (node2.onMenuNodeInputs) {
        const retEntries = node2.onMenuNodeInputs(entries);
        if (retEntries) {
          entries = retEntries;
        }
      }
      if (!entries.length) {
        return;
      }
      new host.ContextMenu(
        entries,
        {
          event: e,
          callback: inner_clicked,
          parentMenu: prev_menu,
          node: node2
        },
        ref_window2
      );
      function inner_clicked(v2, _e, prev) {
        if (!node2) {
          return;
        }
        const valueObj = v2;
        if (valueObj.callback) {
          valueObj.callback.call(that2, node2, valueObj, e, prev);
        }
        if (valueObj.value) {
          node2.graph.beforeChange();
          const addEntry = valueObj.value;
          node2.addInput(addEntry[0], addEntry[1], addEntry[2]);
          if (node2.onNodeInputAdd) {
            node2.onNodeInputAdd(valueObj.value);
          }
          node2.setDirtyCanvas(true, true);
          node2.graph.afterChange();
        }
      }
      return false;
    }
    static showMenuNodeOptionalOutputs(_v, _options, e, prev_menu, node2) {
      if (!node2) {
        return;
      }
      const that2 = this;
      const canvas = _a.active_canvas;
      if (!canvas) {
        return;
      }
      const ref_window2 = canvas.getCanvasWindow();
      const host = _a.callbackHost();
      let optOutputs = node2.optional_outputs;
      if (node2.onGetOutputs) {
        optOutputs = node2.onGetOutputs();
      }
      let entries = [];
      if (optOutputs) {
        for (let i2 = 0; i2 < optOutputs.length; i2++) {
          const entry = optOutputs[i2];
          if (!entry) {
            entries.push(null);
            continue;
          }
          if (node2.flags && node2.flags.skip_repeated_outputs && node2.findOutputSlot && node2.findOutputSlot(entry[0]) != -1) {
            continue;
          }
          let label = entry[0];
          if (!entry[2]) {
            entry[2] = {};
          }
          if (entry[2].label) {
            label = String(entry[2].label);
          }
          entry[2].removable = true;
          const data = { content: label, value: entry };
          if (entry[1] == host.EVENT) {
            data.className = "event";
          }
          entries.push(data);
        }
      }
      const thisLike = this;
      if (thisLike.onMenuNodeOutputs) {
        entries = thisLike.onMenuNodeOutputs(entries);
      }
      if (host.do_add_triggers_slots && node2.findOutputSlot && node2.findOutputSlot("onExecuted") == -1) {
        entries.push({
          content: "On Executed",
          value: ["onExecuted", host.EVENT, { nameLocked: true }],
          className: "event"
        });
      }
      if (node2.onMenuNodeOutputs) {
        const retEntries = node2.onMenuNodeOutputs(entries);
        if (retEntries) {
          entries = retEntries;
        }
      }
      if (!entries.length) {
        return;
      }
      new host.ContextMenu(
        entries,
        {
          event: e,
          callback: inner_clicked,
          parentMenu: prev_menu,
          node: node2
        },
        ref_window2
      );
      function inner_clicked(v2, _e, prev) {
        if (!node2) {
          return;
        }
        const valueObj = v2;
        if (valueObj.callback) {
          valueObj.callback.call(that2, node2, valueObj, e, prev);
        }
        if (!valueObj.value) {
          return;
        }
        const packed = valueObj.value;
        const value = packed[1];
        if (value && (Array.isArray(value) || value.constructor === Object)) {
          const submenuEntries = [];
          for (const i2 in value) {
            submenuEntries.push({
              content: i2,
              value: value[i2]
            });
          }
          new host.ContextMenu(submenuEntries, {
            event: e,
            callback: inner_clicked,
            parentMenu: prev,
            node: node2
          });
          return false;
        }
        node2.graph.beforeChange();
        node2.addOutput(packed[0], packed[1], packed[2]);
        if (node2.onNodeOutputAdd) {
          node2.onNodeOutputAdd(valueObj.value);
        }
        node2.setDirtyCanvas(true, true);
        node2.graph.afterChange();
      }
      return false;
    }
    static onShowMenuNodeProperties(_value, _options, e, prev_menu, node2) {
      if (!node2 || !node2.properties) {
        return;
      }
      const canvas = _a.active_canvas;
      if (!canvas) {
        return;
      }
      const ref_window2 = canvas.getCanvasWindow();
      const entries = [];
      for (const i2 in node2.properties) {
        let value = node2.properties[i2] !== void 0 ? node2.properties[i2] : " ";
        if (typeof value == "object") {
          value = JSON.stringify(value);
        }
        const info = node2.getPropertyInfo(i2);
        if (info.type == "enum" || info.type == "combo") {
          value = _a.getPropertyPrintableValue(
            value,
            info.values
          );
        }
        value = _a.decodeHTML(String(value));
        entries.push({
          content: "<span class='property_name'>" + (info.label ? info.label : i2) + "</span><span class='property_value'>" + value + "</span>",
          value: i2
        });
      }
      if (!entries.length) {
        return;
      }
      new (_a.callbackHost()).ContextMenu(
        entries,
        {
          event: e,
          callback: inner_clicked,
          parentMenu: prev_menu,
          allow_html: true,
          node: node2
        },
        ref_window2
      );
      function inner_clicked(v2) {
        if (!node2) {
          return;
        }
        const valueObj = v2;
        const rect = this.getBoundingClientRect();
        canvas.showEditPropertyValue(node2, String(valueObj.value || ""), {
          position: [rect.left, rect.top]
        });
      }
      return false;
    }
    static decodeHTML(str) {
      const e = document.createElement("div");
      e.innerText = str;
      return e.innerHTML;
    }
    static onMenuResizeNode(_value, _options, _e, _menu, node2) {
      if (!node2) {
        return;
      }
      const fApplyMultiNode = (target) => {
        target.size = target.computeSize();
        if (target.onResize) {
          target.onResize(target.size);
        }
      };
      const graphcanvas = _a.active_canvas;
      if (!graphcanvas.selected_nodes || Object.keys(graphcanvas.selected_nodes).length <= 1) {
        fApplyMultiNode(node2);
      } else {
        for (const i2 in graphcanvas.selected_nodes) {
          fApplyMultiNode(graphcanvas.selected_nodes[i2]);
        }
      }
      node2.setDirtyCanvas(true, true);
    }
    static onResizeNode(value, options, e, menu, node2) {
      _a.onMenuResizeNode(value, options, e, menu, node2);
    }
    // TODO refactor :: this is used fot title but not for properties!
    static onShowPropertyEditor(item, _options, e, _menu, node2) {
      var _a2;
      const property = item.property || "title";
      const value = node2[property];
      const dialog = document.createElement("div");
      dialog.is_modified = false;
      dialog.className = "graphdialog";
      dialog.innerHTML = "<span class='name'></span><input autofocus type='text' class='value'/><button>OK</button>";
      dialog.close = function() {
        if (dialog.parentNode) {
          dialog.parentNode.removeChild(dialog);
        }
      };
      const title = dialog.querySelector(".name");
      if (title) {
        title.textContent = property;
      }
      const input = dialog.querySelector(".value");
      if (input) {
        input.value = String(value != null ? value : "");
        input.addEventListener("blur", function() {
          this.focus();
        });
        input.addEventListener("keydown", function(ev) {
          var _a3;
          dialog.is_modified = true;
          if (ev.keyCode == 27) {
            (_a3 = dialog.close) == null ? void 0 : _a3.call(dialog);
          } else if (ev.keyCode == 13) {
            inner();
          } else if (ev.keyCode != 13 && ev.target.localName != "textarea") {
            return;
          }
          ev.preventDefault();
          ev.stopPropagation();
        });
      }
      const graphcanvas = _a.active_canvas;
      if (!graphcanvas) {
        return;
      }
      const canvas = graphcanvas.canvas;
      const rect = canvas.getBoundingClientRect();
      let offsetx = -20;
      let offsety = -20;
      if (rect) {
        offsetx -= rect.left;
        offsety -= rect.top;
      }
      const evt = e || globalThis.event;
      if (evt) {
        dialog.style.left = evt.clientX + offsetx + "px";
        dialog.style.top = evt.clientY + offsety + "px";
      } else {
        dialog.style.left = canvas.width * 0.5 + offsetx + "px";
        dialog.style.top = canvas.height * 0.5 + offsety + "px";
      }
      const button = dialog.querySelector("button");
      if (button) {
        button.addEventListener("click", inner);
      }
      (_a2 = canvas.parentNode) == null ? void 0 : _a2.appendChild(dialog);
      input == null ? void 0 : input.focus();
      const host = _a.callbackHost();
      let dialogCloseTimer = null;
      dialog.addEventListener("mouseleave", function() {
        if (host.dialog_close_on_mouse_leave) {
          if (!dialog.is_modified && host.dialog_close_on_mouse_leave) {
            dialogCloseTimer = setTimeout(
              () => {
                var _a3;
                return (_a3 = dialog.close) == null ? void 0 : _a3.call(dialog);
              },
              host.dialog_close_on_mouse_leave_delay
            );
          }
        }
      });
      dialog.addEventListener("mouseenter", function() {
        if (host.dialog_close_on_mouse_leave) {
          if (dialogCloseTimer) {
            clearTimeout(dialogCloseTimer);
          }
        }
      });
      function inner() {
        if (input) {
          setValue(input.value);
        }
      }
      function setValue(nextValue) {
        var _a3;
        let safeValue = nextValue;
        if (item.type == "Number") {
          safeValue = Number(safeValue);
        } else if (item.type == "Boolean") {
          safeValue = Boolean(safeValue);
        }
        node2[property] = safeValue;
        if (dialog.parentNode) {
          dialog.parentNode.removeChild(dialog);
        }
        (_a3 = node2.setDirtyCanvas) == null ? void 0 : _a3.call(node2, true, true);
      }
    }
    static getPropertyPrintableValue(value, values) {
      if (!values) {
        return String(value);
      }
      if (Array.isArray(values)) {
        return String(value);
      }
      if (values.constructor === Object) {
        let desc_value = "";
        for (const k in values) {
          if (values[k] != value) {
            continue;
          }
          desc_value = k;
          break;
        }
        return String(value) + " (" + desc_value + ")";
      }
    }
    static onMenuNodeCollapse(_value, _options, _e, _menu, node2) {
      node2.graph.beforeChange();
      const fApplyMultiNode = (target) => {
        target.collapse();
      };
      const graphcanvas = _a.active_canvas;
      if (!graphcanvas.selected_nodes || Object.keys(graphcanvas.selected_nodes).length <= 1) {
        fApplyMultiNode(node2);
      } else {
        for (const i2 in graphcanvas.selected_nodes) {
          fApplyMultiNode(graphcanvas.selected_nodes[i2]);
        }
      }
      node2.graph.afterChange();
    }
    static onMenuNodePin(_value, _options, _e, _menu, node2) {
      node2.pin();
    }
    static onMenuNodeMode(_value, _options, e, menu, node2) {
      const host = _a.callbackHost();
      new host.ContextMenu(host.NODE_MODES, {
        event: e,
        callback: inner_clicked,
        parentMenu: menu,
        node: node2
      });
      function inner_clicked(v2) {
        if (!node2) {
          return;
        }
        const kV = Object.values(host.NODE_MODES).indexOf(String(v2));
        const fApplyMultiNode = (target) => {
          if (kV >= 0 && Object.values(host.NODE_MODES)[kV]) {
            target.changeMode(kV);
          } else {
            target.changeMode(host.ALWAYS);
          }
        };
        const graphcanvas = _a.active_canvas;
        if (!graphcanvas.selected_nodes || Object.keys(graphcanvas.selected_nodes).length <= 1) {
          fApplyMultiNode(node2);
        } else {
          for (const i2 in graphcanvas.selected_nodes) {
            fApplyMultiNode(graphcanvas.selected_nodes[i2]);
          }
        }
      }
      return false;
    }
    static onMenuNodeColors(_value, _options, e, menu, node2) {
      if (!node2) {
        throw "no node for color";
      }
      const host = _a.callbackHost();
      const values = [];
      values.push({
        value: null,
        content: "<span style='display: block; padding-left: 4px;'>No color</span>"
      });
      for (const i2 in _a.node_colors) {
        const color = _a.node_colors[i2];
        values.push({
          value: i2,
          content: "<span style='display: block; color: #999; padding-left: 4px; border-left: 8px solid " + color.color + "; background-color:" + color.bgcolor + "'>" + i2 + "</span>"
        });
      }
      new host.ContextMenu(values, {
        event: e,
        callback: inner_clicked,
        parentMenu: menu,
        node: node2
      });
      function inner_clicked(v2) {
        if (!node2) {
          return;
        }
        const valueObj = v2;
        const color = valueObj.value ? _a.node_colors[valueObj.value] : null;
        const fApplyColor = (target) => {
          if (color) {
            if (host.LGraphGroup && target.constructor === host.LGraphGroup) {
              target.color = color.groupcolor;
            } else {
              target.color = color.color;
              target.bgcolor = color.bgcolor;
            }
          } else {
            delete target.color;
            delete target.bgcolor;
          }
        };
        const graphcanvas = _a.active_canvas;
        if (!graphcanvas.selected_nodes || Object.keys(graphcanvas.selected_nodes).length <= 1) {
          fApplyColor(node2);
        } else {
          for (const i2 in graphcanvas.selected_nodes) {
            fApplyColor(graphcanvas.selected_nodes[i2]);
          }
        }
        node2.setDirtyCanvas(true, true);
      }
      return false;
    }
    static onMenuNodeShapes(_value, _options, e, menu, node2) {
      if (!node2) {
        throw "no node passed";
      }
      const host = _a.callbackHost();
      new host.ContextMenu(host.VALID_SHAPES, {
        event: e,
        callback: inner_clicked,
        parentMenu: menu,
        node: node2
      });
      function inner_clicked(v2) {
        if (!node2) {
          return;
        }
        node2.graph.beforeChange();
        const fApplyMultiNode = (target) => {
          target.shape = v2;
        };
        const graphcanvas = _a.active_canvas;
        if (!graphcanvas.selected_nodes || Object.keys(graphcanvas.selected_nodes).length <= 1) {
          fApplyMultiNode(node2);
        } else {
          for (const i2 in graphcanvas.selected_nodes) {
            fApplyMultiNode(graphcanvas.selected_nodes[i2]);
          }
        }
        node2.graph.afterChange();
        node2.setDirtyCanvas(true);
      }
      return false;
    }
    static onMenuNodeRemove(_value, _options, _e, _menu, node2) {
      if (!node2) {
        throw "no node passed";
      }
      const graph = node2.graph;
      graph.beforeChange();
      const fApplyMultiNode = (target) => {
        if (target.removable === false) {
          return;
        }
        graph.remove(target);
      };
      const graphcanvas = _a.active_canvas;
      if (!graphcanvas.selected_nodes || Object.keys(graphcanvas.selected_nodes).length <= 1) {
        fApplyMultiNode(node2);
      } else {
        for (const i2 in graphcanvas.selected_nodes) {
          fApplyMultiNode(graphcanvas.selected_nodes[i2]);
        }
      }
      graph.afterChange();
      node2.setDirtyCanvas(true, true);
    }
    static onMenuNodeToSubgraph(_value, _options, _e, _menu, node2) {
      const graph = node2.graph;
      const graphcanvas = _a.active_canvas;
      if (!graphcanvas) {
        return;
      }
      let nodes_list = Object.values(graphcanvas.selected_nodes || {});
      if (!nodes_list.length) {
        nodes_list = [node2];
      }
      const subgraph_node = _a.callbackHost().createNode("graph/subgraph");
      subgraph_node.pos = [node2.pos[0], node2.pos[1]];
      graph.add(subgraph_node);
      subgraph_node.buildFromNodes(nodes_list);
      graphcanvas.deselectAllNodes();
      node2.setDirtyCanvas(true, true);
    }
    static onMenuNodeClone(_value, _options, _e, _menu, node2) {
      node2.graph.beforeChange();
      const newSelected = {};
      const fApplyMultiNode = (target) => {
        if (target.clonable === false) {
          return;
        }
        const newnode = target.clone();
        if (!newnode) {
          return;
        }
        newnode.pos = [target.pos[0] + 5, target.pos[1] + 5];
        target.graph.add(newnode);
        newSelected[String(newnode.id)] = newnode;
      };
      const graphcanvas = _a.active_canvas;
      if (!graphcanvas.selected_nodes || Object.keys(graphcanvas.selected_nodes).length <= 1) {
        fApplyMultiNode(node2);
      } else {
        for (const i2 in graphcanvas.selected_nodes) {
          fApplyMultiNode(graphcanvas.selected_nodes[i2]);
        }
      }
      if (Object.keys(newSelected).length) {
        graphcanvas.selectNodes(newSelected);
      }
      node2.graph.afterChange();
      node2.setDirtyCanvas(true, true);
    }
    static getFileExtension(url) {
      const question = url.indexOf("?");
      if (question != -1) {
        url = url.substr(0, question);
      }
      const point = url.lastIndexOf(".");
      if (point == -1) {
        return "";
      }
      return url.substr(point + 1).toLowerCase();
    }
  }, _a.DEFAULT_BACKGROUND_IMAGE = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAIAAAD/gAIDAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAQBJREFUeNrs1rEKwjAUhlETUkj3vP9rdmr1Ysammk2w5wdxuLgcMHyptfawuZX4pJSWZTnfnu/lnIe/jNNxHHGNn//HNbbv+4dr6V+11uF527arU7+u63qfa/bnmh8sWLBgwYJlqRf8MEptXPBXJXa37BSl3ixYsGDBMliwFLyCV/DeLIMFCxYsWLBMwSt4Be/NggXLYMGCBUvBK3iNruC9WbBgwYJlsGApeAWv4L1ZBgsWLFiwYJmCV/AK3psFC5bBggULloJX8BpdwXuzYMGCBctgwVLwCl7Be7MMFixYsGDBsu8FH1FaSmExVfAxBa/gvVmwYMGCZbBg/W4vAQYA5tRF9QYlv/QAAAAASUVORK5CYII=", _a.link_type_colors = {
    "-1": defaultHost$1.EVENT_LINK_COLOR,
    number: "#AAA",
    node: "#DCA"
  }, _a.gradients = {}, _a.search_limit = -1, _a.node_colors = {
    red: { color: "#322", bgcolor: "#533", groupcolor: "#A88" },
    brown: { color: "#332922", bgcolor: "#593930", groupcolor: "#b06634" },
    green: { color: "#232", bgcolor: "#353", groupcolor: "#8A8" },
    blue: { color: "#223", bgcolor: "#335", groupcolor: "#88A" },
    pale_blue: {
      color: "#2a363b",
      bgcolor: "#3f5159",
      groupcolor: "#3f789e"
    },
    cyan: { color: "#233", bgcolor: "#355", groupcolor: "#8AA" },
    purple: { color: "#323", bgcolor: "#535", groupcolor: "#a1309b" },
    yellow: { color: "#432", bgcolor: "#653", groupcolor: "#b58b2a" },
    black: { color: "#222", bgcolor: "#000", groupcolor: "#444" }
  }, _a.active_canvas = null, _a.active_node = null, _a);
  function clamp(v2, a, b) {
    return a > v2 ? a : b < v2 ? b : v2;
  }
  function compareObjects(a, b) {
    for (const i2 in a) {
      if (a[i2] != b[i2]) {
        return false;
      }
    }
    return true;
  }
  function distance(a, b) {
    return Math.sqrt(
      (b[0] - a[0]) * (b[0] - a[0]) + (b[1] - a[1]) * (b[1] - a[1])
    );
  }
  function isInsideRectangle$1(x2, y2, left, top, width2, height) {
    if (left < x2 && left + width2 > x2 && top < y2 && top + height > y2) {
      return true;
    }
    return false;
  }
  function growBounding(bounding, x2, y2) {
    if (x2 < bounding[0]) {
      bounding[0] = x2;
    } else if (x2 > bounding[2]) {
      bounding[2] = x2;
    }
    if (y2 < bounding[1]) {
      bounding[1] = y2;
    } else if (y2 > bounding[3]) {
      bounding[3] = y2;
    }
    return bounding;
  }
  function isInsideBounding(p, bb) {
    if (Array.isArray(bb[0])) {
      const corners = bb;
      if (p[0] < corners[0][0] || p[1] < corners[0][1] || p[0] > corners[1][0] || p[1] > corners[1][1]) {
        return false;
      }
      return true;
    }
    const flat = bb;
    if (p[0] < flat[0] || p[1] < flat[1] || p[0] > flat[2] || p[1] > flat[3]) {
      return false;
    }
    return true;
  }
  function overlapBounding(a, b) {
    const aEndX = a[0] + a[2];
    const aEndY = a[1] + a[3];
    const bEndX = b[0] + b[2];
    const bEndY = b[1] + b[3];
    if (a[0] > bEndX || a[1] > bEndY || aEndX < b[0] || aEndY < b[1]) {
      return false;
    }
    return true;
  }
  function createPointerEventsHost(pointerevents_method = "mouse") {
    const host = {
      pointerevents_method,
      _pointer_listener_registry: /* @__PURE__ */ new WeakMap(),
      _normalizeTouchEvent,
      _resolvePointerEventName(event_name) {
        return resolvePointerEventName$1(host, event_name);
      },
      _pointerListenerOptions,
      pointerListenerAdd(oDOM, sEvIn, fCall, capture = false) {
        pointerListenerAdd(host, oDOM, sEvIn, fCall, capture);
      },
      pointerListenerRemove(oDOM, sEvent, fCall, capture = false) {
        pointerListenerRemove(host, oDOM, sEvent, fCall, capture);
      }
    };
    return host;
  }
  function _normalizeTouchEvent(e) {
    const touch = e.changedTouches && e.changedTouches.length && e.changedTouches[0] || e.touches && e.touches.length && e.touches[0];
    if (!touch) {
      return null;
    }
    return {
      type: e.type,
      clientX: touch.clientX,
      clientY: touch.clientY,
      pageX: touch.pageX,
      pageY: touch.pageY,
      screenX: touch.screenX,
      screenY: touch.screenY,
      which: 1,
      button: 0,
      buttons: e.type == "touchend" || e.type == "touchcancel" ? 0 : 1,
      isPrimary: true,
      pointerId: touch.identifier || 1,
      shiftKey: !!e.shiftKey,
      ctrlKey: !!e.ctrlKey,
      altKey: !!e.altKey,
      metaKey: !!e.metaKey,
      target: e.target,
      originalEvent: e,
      preventDefault: function() {
        if (e.cancelable && e.preventDefault) {
          e.preventDefault();
        }
      },
      stopPropagation: function() {
        if (e.stopPropagation) {
          e.stopPropagation();
        }
      },
      stopImmediatePropagation: function() {
        if (e.stopImmediatePropagation) {
          e.stopImmediatePropagation();
        }
      }
    };
  }
  function resolvePointerEventName$1(host, event_name) {
    const requested = String(event_name || "").toLowerCase();
    let method = host.pointerevents_method || "mouse";
    if (method == "pointer" && (typeof window === "undefined" || !window.PointerEvent)) {
      method = "touch";
    }
    const maps = {
      mouse: {
        down: "mousedown",
        move: "mousemove",
        up: "mouseup",
        over: "mouseover",
        out: "mouseout",
        enter: "mouseenter",
        leave: "mouseleave",
        cancel: "mouseup"
      },
      pointer: {
        down: "pointerdown",
        move: "pointermove",
        up: "pointerup",
        over: "pointerover",
        out: "pointerout",
        enter: "pointerenter",
        leave: "pointerleave",
        cancel: "pointercancel",
        gotpointercapture: "gotpointercapture",
        lostpointercapture: "lostpointercapture"
      },
      touch: {
        down: "touchstart",
        move: "touchmove",
        up: "touchend",
        cancel: "touchcancel"
      }
    };
    if (requested.indexOf("mouse") === 0 || requested.indexOf("pointer") === 0 || requested.indexOf("touch") === 0) {
      return {
        dom_event: requested,
        use_touch_wrapper: requested.indexOf("touch") === 0
      };
    }
    const map = maps[method || "mouse"] || maps.mouse;
    let dom_event = map[requested];
    if (!dom_event) {
      if (method == "touch" && (requested == "enter" || requested == "leave" || requested == "over" || requested == "out")) {
        return null;
      }
      dom_event = requested;
    }
    return {
      dom_event,
      use_touch_wrapper: dom_event.indexOf("touch") === 0
    };
  }
  function _pointerListenerOptions(dom_event, capture) {
    if (dom_event && dom_event.indexOf("touch") === 0) {
      return { capture: !!capture, passive: false };
    }
    return !!capture;
  }
  function pointerListenerAdd(host, oDOM, sEvIn, fCall, capture = false) {
    if (!oDOM || !("addEventListener" in oDOM) || !sEvIn || typeof fCall !== "function") {
      return;
    }
    const resolved = host._resolvePointerEventName(sEvIn);
    if (!resolved || !resolved.dom_event) {
      return;
    }
    const dom_event = resolved.dom_event;
    let registry2 = host._pointer_listener_registry.get(oDOM);
    if (!registry2) {
      registry2 = {};
      host._pointer_listener_registry.set(oDOM, registry2);
    }
    const key = dom_event + "|" + (capture ? "1" : "0");
    if (!registry2[key]) {
      registry2[key] = [];
    }
    const existing = registry2[key].find((entry) => entry.original === fCall);
    if (existing) {
      return;
    }
    let wrapped = fCall;
    if (resolved.use_touch_wrapper) {
      const semantic_event = String(sEvIn || "").toLowerCase();
      wrapped = function(ev) {
        const normalized = host._normalizeTouchEvent(ev);
        if (!normalized) {
          return;
        }
        if (semantic_event == "down" || semantic_event == "move" || semantic_event == "up" || semantic_event == "cancel" || semantic_event == "enter" || semantic_event == "leave" || semantic_event == "over" || semantic_event == "out" || semantic_event == "gotpointercapture" || semantic_event == "lostpointercapture") {
          normalized.type = (host.pointerevents_method || "mouse") + semantic_event;
        }
        return fCall.call(this, normalized);
      };
    }
    registry2[key].push({
      original: fCall,
      wrapped
    });
    oDOM.addEventListener(
      dom_event,
      wrapped,
      host._pointerListenerOptions(dom_event, capture)
    );
  }
  function pointerListenerRemove(host, oDOM, sEvent, fCall, capture = false) {
    if (!oDOM || !("removeEventListener" in oDOM) || !sEvent || typeof fCall !== "function") {
      return;
    }
    const resolved = host._resolvePointerEventName(sEvent);
    if (!resolved || !resolved.dom_event) {
      return;
    }
    const dom_event = resolved.dom_event;
    const key = dom_event + "|" + (capture ? "1" : "0");
    let wrapped = fCall;
    const registry2 = host._pointer_listener_registry.get(oDOM);
    if (registry2 && registry2[key]) {
      const index = registry2[key].findIndex((entry) => entry.original === fCall);
      if (index >= 0) {
        wrapped = registry2[key][index].wrapped;
        registry2[key].splice(index, 1);
      }
    }
    oDOM.removeEventListener(
      dom_event,
      wrapped,
      host._pointerListenerOptions(dom_event, capture)
    );
  }
  let DragAndScale$1 = class DragAndScale {
    constructor(element, skipEvents) {
      this.offset = new Float32Array([0, 0]);
      this.scale = 1;
      this.max_scale = 10;
      this.min_scale = 0.1;
      this.onredraw = null;
      this.enabled = true;
      this.last_mouse = [0, 0];
      this.element = null;
      this.visible_area = new Float32Array(4);
      this.pointerHost = createPointerEventsHost("mouse");
      if (element) {
        this.element = element;
        if (!skipEvents) {
          this.bindEvents(element);
        }
      }
    }
    getHost() {
      const injected = this.constructor.liteGraph || {};
      if (injected.pointerevents_method) {
        this.pointerHost.pointerevents_method = injected.pointerevents_method;
      }
      return {
        pointerevents_method: injected.pointerevents_method || this.pointerHost.pointerevents_method,
        pointerListenerAdd: injected.pointerListenerAdd || this.pointerHost.pointerListenerAdd,
        pointerListenerRemove: injected.pointerListenerRemove || this.pointerHost.pointerListenerRemove
      };
    }
    bindEvents(element) {
      this.last_mouse = new Float32Array(2);
      this._binded_mouse_callback = this.onMouse.bind(this);
      const host = this.getHost();
      host.pointerListenerAdd(element, "down", this._binded_mouse_callback);
      host.pointerListenerAdd(element, "move", this._binded_mouse_callback);
      host.pointerListenerAdd(element, "up", this._binded_mouse_callback);
      const wheelEventOptions = { passive: false };
      element.addEventListener(
        "wheel",
        this._binded_mouse_callback,
        wheelEventOptions
      );
      if (!("onwheel" in element)) {
        element.addEventListener(
          "mousewheel",
          this._binded_mouse_callback,
          wheelEventOptions
        );
      }
    }
    computeVisibleArea(viewport) {
      const element = this.element;
      if (!element) {
        this.visible_area[0] = this.visible_area[1] = this.visible_area[2] = this.visible_area[3] = 0;
        return;
      }
      let width2 = element.width;
      let height = element.height;
      let startx = -this.offset[0];
      let starty = -this.offset[1];
      if (viewport) {
        startx += viewport[0] / this.scale;
        starty += viewport[1] / this.scale;
        width2 = viewport[2];
        height = viewport[3];
      }
      const endx = startx + width2 / this.scale;
      const endy = starty + height / this.scale;
      this.visible_area[0] = startx;
      this.visible_area[1] = starty;
      this.visible_area[2] = endx - startx;
      this.visible_area[3] = endy - starty;
    }
    onMouse(e) {
      if (!this.enabled) {
        return;
      }
      const canvas = this.element;
      const host = this.getHost();
      const rect = canvas.getBoundingClientRect();
      const x2 = e.clientX - rect.left;
      const y2 = e.clientY - rect.top;
      e.canvasx = x2;
      e.canvasy = y2;
      e.dragging = this.dragging;
      const is_inside = !this.viewport || x2 >= this.viewport[0] && x2 < this.viewport[0] + this.viewport[2] && y2 >= this.viewport[1] && y2 < this.viewport[1] + this.viewport[3];
      let ignore = false;
      if (this.onmouse) {
        ignore = !!this.onmouse(e);
      }
      if (e.type == host.pointerevents_method + "down" && is_inside) {
        this.dragging = true;
        host.pointerListenerRemove(canvas, "move", this._binded_mouse_callback);
        host.pointerListenerAdd(document, "move", this._binded_mouse_callback);
        host.pointerListenerAdd(document, "up", this._binded_mouse_callback);
      } else if (e.type == host.pointerevents_method + "move") {
        if (!ignore) {
          const deltax = x2 - this.last_mouse[0];
          const deltay = y2 - this.last_mouse[1];
          if (this.dragging) {
            this.mouseDrag(deltax, deltay);
          }
        }
      } else if (e.type == host.pointerevents_method + "up") {
        this.dragging = false;
        host.pointerListenerRemove(document, "move", this._binded_mouse_callback);
        host.pointerListenerRemove(document, "up", this._binded_mouse_callback);
        host.pointerListenerAdd(canvas, "move", this._binded_mouse_callback);
      } else if (is_inside && (e.type == "mousewheel" || e.type == "wheel" || e.type == "DOMMouseScroll")) {
        e.eventType = "mousewheel";
        if (e.type == "wheel") {
          e.wheel = -e.deltaY;
        } else {
          e.wheel = e.wheelDeltaY != null ? e.wheelDeltaY : e.detail * -60;
        }
        e.delta = e.wheelDelta ? e.wheelDelta / 40 : e.deltaY ? -e.deltaY / 3 : 0;
        this.changeDeltaScale(1 + e.delta * 0.05);
      }
      this.last_mouse[0] = x2;
      this.last_mouse[1] = y2;
      if (is_inside) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    }
    toCanvasContext(ctx) {
      ctx.scale(this.scale, this.scale);
      ctx.translate(this.offset[0], this.offset[1]);
    }
    convertOffsetToCanvas(pos2) {
      return [
        (pos2[0] + this.offset[0]) * this.scale,
        (pos2[1] + this.offset[1]) * this.scale
      ];
    }
    convertCanvasToOffset(pos2, out) {
      const target = out || [0, 0];
      target[0] = pos2[0] / this.scale - this.offset[0];
      target[1] = pos2[1] / this.scale - this.offset[1];
      return target;
    }
    mouseDrag(x2, y2) {
      this.offset[0] += x2 / this.scale;
      this.offset[1] += y2 / this.scale;
      if (this.onredraw) {
        this.onredraw(this);
      }
    }
    changeScale(value, zooming_center) {
      if (value < this.min_scale) {
        value = this.min_scale;
      } else if (value > this.max_scale) {
        value = this.max_scale;
      }
      if (value == this.scale) {
        return;
      }
      const element = this.element;
      if (!element) {
        return;
      }
      const rect = element.getBoundingClientRect();
      if (!rect) {
        return;
      }
      const centerOnCanvas = zooming_center || [rect.width * 0.5, rect.height * 0.5];
      const center = this.convertCanvasToOffset(centerOnCanvas);
      this.scale = value;
      if (Math.abs(this.scale - 1) < 0.01) {
        this.scale = 1;
      }
      const new_center = this.convertCanvasToOffset(centerOnCanvas);
      const delta_offset = [
        new_center[0] - center[0],
        new_center[1] - center[1]
      ];
      this.offset[0] += delta_offset[0];
      this.offset[1] += delta_offset[1];
      if (this.onredraw) {
        this.onredraw(this);
      }
    }
    changeDeltaScale(value, zooming_center) {
      this.changeScale(this.scale * value, zooming_center);
    }
    reset() {
      this.scale = 1;
      this.offset[0] = 0;
      this.offset[1] = 0;
    }
  };
  const pointerEventNameMaps = {
    mouse: {
      down: "mousedown",
      move: "mousemove",
      up: "mouseup",
      cancel: "mouseup",
      gotpointercapture: "mousedown",
      lostpointercapture: "mouseup"
    },
    pointer: {
      down: "pointerdown",
      move: "pointermove",
      up: "pointerup",
      cancel: "pointercancel",
      gotpointercapture: "gotpointercapture",
      lostpointercapture: "lostpointercapture"
    },
    touch: {
      down: "touchstart",
      move: "touchmove",
      up: "touchend",
      cancel: "touchcancel",
      gotpointercapture: "touchstart",
      lostpointercapture: "touchend"
    }
  };
  function resolvePointerEventName(method, semanticName) {
    const requested = String(semanticName || "").toLowerCase();
    if (requested.startsWith("mouse") || requested.startsWith("pointer") || requested.startsWith("touch")) {
      return requested;
    }
    const group = pointerEventNameMaps[method] || pointerEventNameMaps.mouse;
    return group[requested] || null;
  }
  function defaultPointerListenerAdd(method, dom, eventName, callback, capture = false) {
    if (!("addEventListener" in dom)) {
      return;
    }
    const resolved = resolvePointerEventName(method, eventName);
    if (!resolved) {
      return;
    }
    dom.addEventListener(
      resolved,
      callback,
      resolved.startsWith("touch") ? { capture: !!capture, passive: false } : !!capture
    );
  }
  function defaultPointerListenerRemove(method, dom, eventName, callback, capture = false) {
    if (!("removeEventListener" in dom)) {
      return;
    }
    const resolved = resolvePointerEventName(method, eventName);
    if (!resolved) {
      return;
    }
    dom.removeEventListener(
      resolved,
      callback,
      resolved.startsWith("touch") ? { capture: !!capture, passive: false } : !!capture
    );
  }
  const defaultLifecycleHost = {
    NODE_TEXT_SIZE: 14,
    NODE_SUBTEXT_SIZE: 12,
    NODE_TITLE_COLOR: "#999",
    LINK_COLOR: "#9A9",
    SPLINE_LINK: 2,
    pointerevents_method: "mouse",
    isTouchDevice: () => typeof window !== "undefined" && ("ontouchstart" in window || typeof navigator !== "undefined" && navigator.maxTouchPoints > 0),
    pointerListenerAdd: (dom, eventName, callback, capture) => {
      defaultPointerListenerAdd(
        defaultLifecycleHost.pointerevents_method,
        dom,
        eventName,
        callback,
        capture
      );
    },
    pointerListenerRemove: (dom, eventName, callback, capture) => {
      defaultPointerListenerRemove(
        defaultLifecycleHost.pointerevents_method,
        dom,
        eventName,
        callback,
        capture
      );
    }
  };
  class LGraphCanvasLifecycle extends LGraphCanvas$1 {
    constructor(canvas, graph, options) {
      super();
      this.options = options || {};
      this.graph = null;
      this._graph_stack = null;
      this._events_binded = false;
      this.is_rendering = false;
      this.background_image = LGraphCanvasLifecycle.DEFAULT_BACKGROUND_IMAGE;
      let targetCanvas = canvas || null;
      if (targetCanvas && targetCanvas.constructor === String) {
        targetCanvas = document.querySelector(
          targetCanvas
        );
      }
      this.ds = new DragAndScale$1();
      this.zoom_modify_alpha = true;
      const host = this.host();
      this.title_text_font = "" + host.NODE_TEXT_SIZE + "px Arial";
      this.inner_text_font = "normal " + host.NODE_SUBTEXT_SIZE + "px Arial";
      this.node_title_color = host.NODE_TITLE_COLOR;
      this.default_link_color = host.LINK_COLOR;
      this.default_connection_color = {
        input_off: "#778",
        input_on: "#7F7",
        output_off: "#778",
        output_on: "#7F7"
      };
      this.default_connection_color_byType = {};
      this.default_connection_color_byTypeOff = {};
      this.highquality_render = true;
      this.use_gradients = false;
      this.editor_alpha = 1;
      this.pause_rendering = false;
      this.clear_background = true;
      this.clear_background_color = "#222";
      this.read_only = false;
      this.render_only_selected = true;
      this.live_mode = false;
      this.show_info = true;
      this.allow_dragcanvas = true;
      this.allow_dragnodes = true;
      this.allow_interaction = true;
      this.multi_select = false;
      this.allow_searchbox = true;
      this.allow_reconnect_links = true;
      this.align_to_grid = false;
      this.drag_mode = false;
      this.dragging_rectangle = null;
      this.filter = null;
      this.set_canvas_dirty_on_mouse_event = true;
      this.always_render_background = false;
      this.render_shadows = true;
      this.render_canvas_border = true;
      this.render_connections_shadows = false;
      this.render_connections_border = true;
      this.render_curved_connections = false;
      this.render_connection_arrows = false;
      this.render_collapsed_slots = true;
      this.render_execution_order = false;
      this.render_title_colored = true;
      this.render_link_tooltip = true;
      this.links_render_mode = host.SPLINE_LINK;
      this.mouse = [0, 0];
      this.graph_mouse = [0, 0];
      this.canvas_mouse = this.graph_mouse;
      this.onSearchBox = null;
      this.onSearchBoxSelection = null;
      this.onMouse = null;
      this.onDrawBackground = null;
      this.onDrawForeground = null;
      this.onDrawOverlay = null;
      this.onDrawLinkTooltip = null;
      this.onNodeMoved = null;
      this.onSelectionChange = null;
      this.onConnectingChange = null;
      this.onBeforeChange = null;
      this.onAfterChange = null;
      this.connections_width = 3;
      this.round_radius = 8;
      this.current_node = null;
      this.node_widget = null;
      this.over_link_center = null;
      this.last_mouse_position = [0, 0];
      this.visible_area = this.ds.visible_area;
      this.visible_links = [];
      this.viewport = this.options.viewport || null;
      this.canvas = null;
      this.bgcanvas = null;
      this.ctx = null;
      this.bgctx = null;
      this.frame = 0;
      this.last_draw_time = 0;
      this.render_time = 0;
      this.fps = 0;
      this.selected_nodes = {};
      this.selected_group = null;
      this.visible_nodes = [];
      this.node_dragged = null;
      this.node_over = null;
      this.node_capturing_input = null;
      this.connecting_node = null;
      this.highlighted_links = {};
      this.dragging_canvas = false;
      this.dirty_canvas = true;
      this.dirty_bgcanvas = true;
      this.dirty_area = null;
      this.node_in_panel = null;
      this.last_mouse = [0, 0];
      this.last_mouseclick = 0;
      this.pointer_is_down = false;
      this.pointer_is_double = false;
      this._mousedown_callback = null;
      this._mousewheel_callback = null;
      this._mousemove_callback = null;
      this._mouseup_callback = null;
      this._pointercancel_callback = null;
      this._pointercapture_callback = null;
      this._touch_callback = null;
      this._key_callback = null;
      this._ondrop_callback = null;
      if (graph) {
        graph.attachCanvas(this);
      }
      this.setCanvas(targetCanvas, this.options.skip_events);
      this.clear();
      if (!this.options.skip_render) {
        this.startRendering();
      }
      this.autoresize = this.options.autoresize;
    }
    host() {
      const injected = this.constructor.liteGraph;
      const merged = { ...defaultLifecycleHost, ...injected || {} };
      return {
        ...merged,
        pointerListenerAdd: merged.pointerListenerAdd || ((dom, ev, cb, capture) => defaultPointerListenerAdd(
          merged.pointerevents_method,
          dom,
          ev,
          cb,
          capture
        )),
        pointerListenerRemove: merged.pointerListenerRemove || ((dom, ev, cb, capture) => defaultPointerListenerRemove(
          merged.pointerevents_method,
          dom,
          ev,
          cb,
          capture
        ))
      };
    }
    clear() {
      var _a2;
      this.frame = 0;
      this.last_draw_time = 0;
      this.render_time = 0;
      this.fps = 0;
      this.dragging_rectangle = null;
      this.selected_nodes = {};
      this.selected_group = null;
      this.visible_nodes = [];
      this.node_dragged = null;
      this.node_over = null;
      this.node_capturing_input = null;
      this.connecting_node = null;
      this.highlighted_links = {};
      this.dragging_canvas = false;
      this.dirty_canvas = true;
      this.dirty_bgcanvas = true;
      this.dirty_area = null;
      this.node_in_panel = null;
      this.node_widget = null;
      this.last_mouse = [0, 0];
      this.last_mouseclick = 0;
      this.pointer_is_down = false;
      this.pointer_is_double = false;
      this.visible_area.set([0, 0, 0, 0]);
      const self = this;
      (_a2 = self.onClear) == null ? void 0 : _a2.call(self);
    }
    setGraph(graph, skip_clear) {
      if (this.graph == graph) {
        return;
      }
      if (!skip_clear) {
        this.clear();
      }
      if (!graph && this.graph) {
        this.graph.detachCanvas(this);
        return;
      }
      graph.attachCanvas(this);
      if (this._graph_stack) {
        this._graph_stack = null;
      }
      this.setDirty(true, true);
    }
    getTopGraph() {
      if (this._graph_stack.length) {
        return this._graph_stack[0];
      }
      return this.graph;
    }
    openSubgraph(graph) {
      if (!graph) {
        throw "graph cannot be null";
      }
      if (this.graph == graph) {
        throw "graph cannot be the same";
      }
      this.clear();
      if (this.graph) {
        if (!this._graph_stack) {
          this._graph_stack = [];
        }
        this._graph_stack.push(this.graph);
      }
      graph.attachCanvas(this);
      this.checkPanels();
      this.setDirty(true, true);
    }
    closeSubgraph() {
      if (!this._graph_stack || this._graph_stack.length == 0) {
        return;
      }
      const subgraph_node = this.graph._subgraph_node;
      const graph = this._graph_stack.pop();
      this.selected_nodes = {};
      this.highlighted_links = {};
      graph.attachCanvas(this);
      this.setDirty(true, true);
      if (subgraph_node) {
        const self = this;
        self.centerOnNode(subgraph_node);
        self.selectNodes([subgraph_node]);
      }
      this.ds.offset = [0, 0];
      this.ds.scale = 1;
    }
    getCurrentGraph() {
      return this.graph;
    }
    setCanvas(canvas, skip_events) {
      let targetCanvas = canvas;
      if (targetCanvas) {
        if (targetCanvas.constructor === String) {
          targetCanvas = document.getElementById(
            targetCanvas
          );
          if (!targetCanvas) {
            throw "Error creating LiteGraph canvas: Canvas not found";
          }
        }
      }
      if (targetCanvas === this.canvas) {
        return;
      }
      if (!targetCanvas && this.canvas) {
        if (!skip_events) {
          this.unbindEvents();
        }
      }
      this.canvas = targetCanvas || null;
      this.ds.element = targetCanvas || null;
      if (!targetCanvas) {
        return;
      }
      const canvasRef = targetCanvas;
      canvasRef.className += " lgraphcanvas";
      canvasRef.data = this;
      canvasRef.tabIndex = 1;
      this.bgcanvas = null;
      if (!this.bgcanvas) {
        const bg = document.createElement("canvas");
        bg.width = canvasRef.width;
        bg.height = canvasRef.height;
        this.bgcanvas = bg;
      }
      if (canvasRef.getContext == null) {
        if (canvasRef.localName != "canvas") {
          throw "Element supplied for LGraphCanvas must be a <canvas> element, you passed a " + canvasRef.localName;
        }
        throw "This browser doesn't support Canvas";
      }
      const ctx = canvasRef.getContext("2d");
      this.ctx = ctx;
      if (ctx == null) {
        if (!canvasRef.webgl_enabled) {
          console.warn(
            "This canvas seems to be WebGL, enabling WebGL renderer"
          );
        }
        this.enableWebGL();
      }
      if (!skip_events) {
        this.bindEvents();
      }
    }
    _doNothing(e) {
      e.preventDefault();
      return false;
    }
    _doReturnTrue(e) {
      e.preventDefault();
      return true;
    }
    bindEvents() {
      if (this._events_binded) {
        console.warn("LGraphCanvas: events already binded");
        return;
      }
      const canvas = this.canvas;
      const ref_window2 = this.getCanvasWindow();
      const doc = ref_window2.document;
      const host = this.host();
      this._mousedown_callback = this.processMouseDown.bind(this);
      this._mousewheel_callback = this.processMouseWheel.bind(this);
      this._mousemove_callback = this.processMouseMove.bind(this);
      this._mouseup_callback = this.processMouseUp.bind(this);
      this._pointercancel_callback = this.processPointerCancel.bind(this);
      this._pointercapture_callback = this.processPointerCapture.bind(this);
      this._touch_callback = this.processTouch.bind(this);
      host.pointerListenerAdd(canvas, "down", this._mousedown_callback, true);
      const wheelEventOptions = { passive: false };
      canvas.addEventListener(
        "wheel",
        this._mousewheel_callback,
        wheelEventOptions
      );
      if (!("onwheel" in canvas)) {
        canvas.addEventListener(
          "mousewheel",
          this._mousewheel_callback,
          wheelEventOptions
        );
      }
      host.pointerListenerAdd(canvas, "up", this._mouseup_callback, true);
      host.pointerListenerAdd(canvas, "move", this._mousemove_callback);
      host.pointerListenerAdd(
        canvas,
        "cancel",
        this._pointercancel_callback,
        true
      );
      host.pointerListenerAdd(
        canvas,
        "gotpointercapture",
        this._pointercapture_callback,
        true
      );
      host.pointerListenerAdd(
        canvas,
        "lostpointercapture",
        this._pointercancel_callback,
        true
      );
      canvas.addEventListener("contextmenu", this._doNothing);
      if (!("onwheel" in canvas)) {
        canvas.addEventListener(
          "DOMMouseScroll",
          this._mousewheel_callback,
          wheelEventOptions
        );
      }
      if (host.pointerevents_method === "mouse" && host.isTouchDevice()) {
        const options = { capture: true, passive: false };
        canvas.addEventListener(
          "touchstart",
          this._touch_callback,
          options
        );
        canvas.addEventListener(
          "touchmove",
          this._touch_callback,
          options
        );
        canvas.addEventListener(
          "touchend",
          this._touch_callback,
          options
        );
        canvas.addEventListener(
          "touchcancel",
          this._touch_callback,
          options
        );
      }
      this._key_callback = this.processKey.bind(this);
      canvas.setAttribute("tabindex", "1");
      canvas.addEventListener("keydown", this._key_callback, true);
      doc.addEventListener("keyup", this._key_callback, true);
      this._ondrop_callback = this.processDrop.bind(this);
      canvas.addEventListener("dragover", this._doNothing, false);
      canvas.addEventListener("dragend", this._doNothing, false);
      canvas.addEventListener("drop", this._ondrop_callback, false);
      canvas.addEventListener("dragenter", this._doReturnTrue, false);
      this._events_binded = true;
    }
    unbindEvents() {
      if (!this._events_binded) {
        console.warn("LGraphCanvas: no events binded");
        return;
      }
      const canvas = this.canvas;
      const ref_window2 = this.getCanvasWindow();
      const doc = ref_window2.document;
      const host = this.host();
      host.pointerListenerRemove(
        canvas,
        "move",
        this._mousemove_callback
      );
      host.pointerListenerRemove(
        canvas,
        "up",
        this._mouseup_callback,
        true
      );
      host.pointerListenerRemove(
        canvas,
        "down",
        this._mousedown_callback,
        true
      );
      host.pointerListenerRemove(
        canvas,
        "cancel",
        this._pointercancel_callback,
        true
      );
      host.pointerListenerRemove(
        canvas,
        "gotpointercapture",
        this._pointercapture_callback,
        true
      );
      host.pointerListenerRemove(
        canvas,
        "lostpointercapture",
        this._pointercancel_callback,
        true
      );
      canvas.removeEventListener(
        "wheel",
        this._mousewheel_callback
      );
      canvas.removeEventListener(
        "mousewheel",
        this._mousewheel_callback
      );
      canvas.removeEventListener(
        "DOMMouseScroll",
        this._mousewheel_callback
      );
      canvas.removeEventListener("keydown", this._key_callback);
      doc.removeEventListener("keyup", this._key_callback);
      canvas.removeEventListener("contextmenu", this._doNothing);
      canvas.removeEventListener("drop", this._ondrop_callback);
      canvas.removeEventListener("dragenter", this._doReturnTrue);
      canvas.removeEventListener(
        "touchstart",
        this._touch_callback,
        true
      );
      canvas.removeEventListener(
        "touchmove",
        this._touch_callback,
        true
      );
      canvas.removeEventListener(
        "touchend",
        this._touch_callback,
        true
      );
      canvas.removeEventListener(
        "touchcancel",
        this._touch_callback,
        true
      );
      this._mousedown_callback = null;
      this._mousewheel_callback = null;
      this._mousemove_callback = null;
      this._mouseup_callback = null;
      this._pointercancel_callback = null;
      this._pointercapture_callback = null;
      this._touch_callback = null;
      this._key_callback = null;
      this._ondrop_callback = null;
      this._events_binded = false;
    }
    processPointerCapture(e) {
      if (!e || e.isPrimary === false) {
        return;
      }
      this.pointer_is_down = true;
    }
    processPointerCancel(e) {
      if (!e || !this.graph) {
        return;
      }
      if (e.which == null) {
        e.which = 1;
      }
      if (e.button == null) {
        e.button = 0;
      }
      if (e.buttons == null) {
        e.buttons = 0;
      }
      return this.processMouseUp(e);
    }
    processTouch(event2) {
      if (!event2 || !this.graph) {
        return;
      }
      const changed = event2.changedTouches && event2.changedTouches.length ? event2.changedTouches[0] : null;
      const active = event2.touches && event2.touches.length ? event2.touches[0] : null;
      const touch = changed || active;
      if (!touch) {
        return;
      }
      let type = null;
      if (event2.type == "touchstart") {
        type = "mousedown";
      } else if (event2.type == "touchmove") {
        type = "mousemove";
      } else if (event2.type == "touchend" || event2.type == "touchcancel") {
        type = "mouseup";
      } else {
        return;
      }
      const synthetic = {
        type,
        clientX: touch.clientX,
        clientY: touch.clientY,
        pageX: touch.pageX,
        pageY: touch.pageY,
        screenX: touch.screenX,
        screenY: touch.screenY,
        which: 1,
        button: 0,
        buttons: type == "mouseup" ? 0 : 1,
        isPrimary: true,
        pointerId: touch.identifier || 1,
        shiftKey: event2.shiftKey,
        ctrlKey: event2.ctrlKey,
        altKey: event2.altKey,
        metaKey: event2.metaKey,
        target: event2.target || this.canvas,
        originalEvent: event2,
        preventDefault: () => {
          if (event2.cancelable && event2.preventDefault) {
            event2.preventDefault();
          }
        },
        stopPropagation: () => {
          if (event2.stopPropagation) {
            event2.stopPropagation();
          }
        },
        stopImmediatePropagation: () => {
          if (event2.stopImmediatePropagation) {
            event2.stopImmediatePropagation();
          }
        }
      };
      if (type == "mousedown") {
        return this.processMouseDown(synthetic);
      }
      if (type == "mousemove") {
        return this.processMouseMove(synthetic);
      }
      return this.processMouseUp(synthetic);
    }
    getCanvasWindow() {
      if (!this.canvas) {
        return window;
      }
      const doc = this.canvas.ownerDocument;
      return doc.defaultView || doc.parentWindow;
    }
    setDirty(fgcanvas, bgcanvas) {
      if (fgcanvas) {
        this.dirty_canvas = true;
      }
      if (bgcanvas) {
        this.dirty_bgcanvas = true;
      }
    }
    startRendering() {
      if (this.is_rendering) {
        return;
      }
      this.is_rendering = true;
      const renderFrame = function() {
        if (!this.pause_rendering) {
          this.draw();
        }
        const windowRef = this.getCanvasWindow();
        if (this.is_rendering) {
          windowRef.requestAnimationFrame(renderFrame.bind(this));
        }
      };
      renderFrame.call(this);
    }
    stopRendering() {
      this.is_rendering = false;
    }
    enableWebGL() {
    }
    // placeholder methods consumed by bindEvents/processTouch until Task24 migrates input stack.
    processMouseDown(_e) {
      return void 0;
    }
    processMouseMove(_e) {
      return void 0;
    }
    processMouseUp(_e) {
      return void 0;
    }
    processMouseWheel(_e) {
      return void 0;
    }
    processKey(_e) {
      return void 0;
    }
    processDrop(_e) {
    }
  }
  const defaultLiteGraphHost = {
    NODE_TITLE_HEIGHT: 30,
    EVENT: -1,
    alt_drag_do_clone_nodes: false,
    middle_click_slot_add_default_node: false,
    release_link_on_empty_shows_menu: false,
    click_do_break_link_to: false,
    ctrl_shift_v_paste_connect_unselected_outputs: false,
    node_types_by_file_extension: {},
    isBreakLinkModifierPressed: (e) => !!(e == null ? void 0 : e.shiftKey),
    isValidConnection: (..._args) => true,
    createNode: (_type) => null,
    getTime: () => Date.now(),
    closeAllContextMenus: (..._args) => {
    },
    pointerListenerAdd: (dom, eventName, callback, capture) => {
      if ("addEventListener" in dom) {
        dom.addEventListener(eventName, callback, !!capture);
      }
    },
    pointerListenerRemove: (dom, eventName, callback, capture) => {
      if ("removeEventListener" in dom) {
        dom.removeEventListener(eventName, callback, !!capture);
      }
    }
  };
  const temp = new Float32Array(4);
  class LGraphCanvasInput extends LGraphCanvasLifecycle {
    constructor() {
      super(...arguments);
      this.block_click = false;
      this.last_click_position = null;
      this.last_mouse_dragging = false;
      this.selected_group_resizing = false;
      this.resizing_node = null;
      this.connecting_output = null;
      this.connecting_input = null;
      this.connecting_pos = null;
      this.connecting_slot = -1;
      this._highlight_input = null;
      this._highlight_output = null;
      this._highlight_input_slot = null;
    }
    getLiteGraphHost() {
      const injected = this.constructor.liteGraph || {};
      return { ...defaultLiteGraphHost, ...injected };
    }
    graphRef() {
      return this.graph;
    }
    selectedNodesRef() {
      return this.selected_nodes || {};
    }
    callProcessNodeWidgets(node2, pos2, event2, active_widget2) {
      return this.processNodeWidgets(node2, pos2, event2, active_widget2);
    }
    dispatchNodeKeyHook(selected_nodes, hook_name, key_event) {
      let consumed = false;
      if (!selected_nodes) {
        return consumed;
      }
      for (const id in selected_nodes) {
        const selected_node = selected_nodes[id];
        if (selected_node && selected_node[hook_name]) {
          const result = selected_node[hook_name](key_event);
          if (result === true) {
            consumed = true;
          }
        }
      }
      return consumed;
    }
    // used to block future mouse events (because of im gui)
    blockClick() {
      this.block_click = true;
      this.last_mouseclick = 0;
    }
    processMouseDown(e) {
      if (this.set_canvas_dirty_on_mouse_event) {
        this.dirty_canvas = true;
      }
      const graph = this.graphRef();
      if (!graph) {
        return;
      }
      this.adjustMouseEvent(e);
      const ref_window2 = this.getCanvasWindow();
      const LiteGraph2 = this.getLiteGraphHost();
      LGraphCanvasInput.active_canvas = this;
      const x2 = e.clientX;
      const y2 = e.clientY;
      this.ds.viewport = this.viewport;
      const is_inside = !this.viewport || this.viewport && x2 >= this.viewport[0] && x2 < this.viewport[0] + this.viewport[2] && y2 >= this.viewport[1] && y2 < this.viewport[1] + this.viewport[3];
      if (!this.options.skip_events) {
        LiteGraph2.pointerListenerRemove(this.canvas, "move", this._mousemove_callback, false);
        LiteGraph2.pointerListenerAdd(ref_window2.document, "move", this._mousemove_callback, true);
        LiteGraph2.pointerListenerAdd(ref_window2.document, "up", this._mouseup_callback, true);
      }
      if (!is_inside) {
        return;
      }
      let node2 = graph.getNodeOnPos(e.canvasX, e.canvasY, this.visible_nodes, 5);
      let skip_action = false;
      let block_drag_node;
      const now = LiteGraph2.getTime();
      const is_primary = e.isPrimary === void 0 || !e.isPrimary;
      const is_double_click = now - this.last_mouseclick < 300 && is_primary;
      this.mouse[0] = e.clientX;
      this.mouse[1] = e.clientY;
      this.graph_mouse[0] = e.canvasX;
      this.graph_mouse[1] = e.canvasY;
      this.last_click_position = [this.mouse[0], this.mouse[1]];
      if (this.pointer_is_down && is_primary) {
        this.pointer_is_double = true;
      } else {
        this.pointer_is_double = false;
      }
      this.pointer_is_down = true;
      this.canvas.focus();
      LiteGraph2.closeAllContextMenus(ref_window2);
      if (this.onMouse) {
        if (this.onMouse(e) == true) {
          return;
        }
      }
      if (e.which == 1 && !this.pointer_is_double) {
        if (e.ctrlKey) {
          this.dragging_rectangle = new Float32Array(4);
          this.dragging_rectangle[0] = e.canvasX;
          this.dragging_rectangle[1] = e.canvasY;
          this.dragging_rectangle[2] = 1;
          this.dragging_rectangle[3] = 1;
          skip_action = true;
        }
        if (LiteGraph2.alt_drag_do_clone_nodes && e.altKey && node2 && this.allow_interaction && !skip_action && !this.read_only) {
          const cloned = node2.clone();
          if (cloned) {
            cloned.pos[0] += 5;
            cloned.pos[1] += 5;
            graph.add(cloned, false, { doCalcSize: false });
            node2 = cloned;
            skip_action = true;
            if (!block_drag_node) {
              if (this.allow_dragnodes) {
                graph.beforeChange();
                this.node_dragged = node2;
              }
              const selected_nodes = this.selectedNodesRef();
              if (!selected_nodes[String(node2.id)]) {
                this.processNodeSelected(node2, e);
              }
            }
          }
        }
        let clicking_canvas_bg = false;
        if (node2 && (this.allow_interaction || node2.flags.allow_interaction) && !skip_action && !this.read_only) {
          if (!this.live_mode && !node2.flags.pinned) {
            this.bringToFront(node2);
          }
          if (this.allow_interaction && !this.connecting_node && !node2.flags.collapsed && !this.live_mode) {
            if (!skip_action && node2.resizable !== false && isInsideRectangle$1(
              e.canvasX,
              e.canvasY,
              node2.pos[0] + node2.size[0] - 5,
              node2.pos[1] + node2.size[1] - 5,
              10,
              10
            )) {
              graph.beforeChange();
              this.resizing_node = node2;
              if (this.canvas) {
                this.canvas.style.cursor = "se-resize";
              }
              skip_action = true;
            } else {
              if (node2.outputs) {
                for (let i2 = 0, l = node2.outputs.length; i2 < l; ++i2) {
                  const output = node2.outputs[i2];
                  const link_pos = node2.getConnectionPos(false, i2);
                  if (isInsideRectangle$1(
                    e.canvasX,
                    e.canvasY,
                    link_pos[0] - 15,
                    link_pos[1] - 10,
                    30,
                    20
                  )) {
                    this.connecting_node = node2;
                    this.connecting_output = output;
                    this.connecting_output.slot_index = i2;
                    this.connecting_pos = node2.getConnectionPos(false, i2);
                    this.connecting_slot = i2;
                    if (LiteGraph2.isBreakLinkModifierPressed(e)) {
                      node2.disconnectOutput(i2);
                    }
                    if (is_double_click) {
                      if (node2.onOutputDblClick) {
                        node2.onOutputDblClick(i2, e);
                      }
                    } else {
                      if (node2.onOutputClick) {
                        node2.onOutputClick(i2, e);
                      }
                    }
                    skip_action = true;
                    break;
                  }
                }
              }
              if (node2.inputs) {
                for (let i2 = 0, l = node2.inputs.length; i2 < l; ++i2) {
                  const input = node2.inputs[i2];
                  const link_pos = node2.getConnectionPos(true, i2);
                  if (isInsideRectangle$1(
                    e.canvasX,
                    e.canvasY,
                    link_pos[0] - 15,
                    link_pos[1] - 10,
                    30,
                    20
                  )) {
                    if (is_double_click) {
                      if (node2.onInputDblClick) {
                        node2.onInputDblClick(i2, e);
                      }
                    } else {
                      if (node2.onInputClick) {
                        node2.onInputClick(i2, e);
                      }
                    }
                    if (input.link !== null) {
                      const link_info = graph.links[input.link];
                      if (LiteGraph2.click_do_break_link_to) {
                        node2.disconnectInput(i2);
                        this.dirty_bgcanvas = true;
                        skip_action = true;
                      }
                      if (this.allow_reconnect_links || e.shiftKey) {
                        if (!LiteGraph2.click_do_break_link_to) {
                          node2.disconnectInput(i2);
                        }
                        this.connecting_node = graph._nodes_by_id[link_info.origin_id];
                        this.connecting_slot = link_info.origin_slot;
                        this.connecting_output = this.connecting_node.outputs[this.connecting_slot];
                        this.connecting_pos = this.connecting_node.getConnectionPos(
                          false,
                          this.connecting_slot
                        );
                        this.dirty_bgcanvas = true;
                        skip_action = true;
                      }
                    }
                    if (!skip_action) {
                      this.connecting_node = node2;
                      this.connecting_input = input;
                      this.connecting_input.slot_index = i2;
                      this.connecting_pos = node2.getConnectionPos(true, i2);
                      this.connecting_slot = i2;
                      this.dirty_bgcanvas = true;
                      skip_action = true;
                    }
                  }
                }
              }
            }
          }
          if (!skip_action) {
            block_drag_node = false;
            const pos2 = [e.canvasX - node2.pos[0], e.canvasY - node2.pos[1]];
            const widget = this.callProcessNodeWidgets(node2, this.graph_mouse, e);
            if (widget) {
              block_drag_node = true;
              this.node_widget = [node2, widget];
            }
            const selected_nodes = this.selectedNodesRef();
            if (this.allow_interaction && is_double_click && selected_nodes[String(node2.id)]) {
              if (node2.onDblClick) {
                node2.onDblClick(e, pos2, this);
              }
              this.processNodeDblClicked(node2);
              block_drag_node = true;
            }
            if (node2.onMouseDown && node2.onMouseDown(e, pos2, this)) {
              block_drag_node = true;
            } else {
              if (node2.subgraph && !node2.skip_subgraph_button) {
                if (!node2.flags.collapsed && pos2[0] > node2.size[0] - LiteGraph2.NODE_TITLE_HEIGHT && pos2[1] < 0) {
                  setTimeout(() => {
                    this.openSubgraph(node2.subgraph);
                  }, 10);
                }
              }
              if (this.live_mode) {
                clicking_canvas_bg = true;
                block_drag_node = true;
              }
            }
            if (!block_drag_node) {
              if (this.allow_dragnodes) {
                graph.beforeChange();
                this.node_dragged = node2;
              }
              this.processNodeSelected(node2, e);
            } else {
              if (!node2.is_selected) {
                this.processNodeSelected(node2, e);
              }
            }
            this.dirty_canvas = true;
          }
        } else {
          if (!skip_action) {
            if (!this.read_only) {
              for (let i2 = 0; i2 < this.visible_links.length; ++i2) {
                const link = this.visible_links[i2];
                const center = link._pos;
                if (!center || e.canvasX < center[0] - 4 || e.canvasX > center[0] + 4 || e.canvasY < center[1] - 4 || e.canvasY > center[1] + 4) {
                  continue;
                }
                this.showLinkMenu(link, e);
                this.over_link_center = null;
                break;
              }
            }
            this.selected_group = graph.getGroupOnPos(e.canvasX, e.canvasY);
            this.selected_group_resizing = false;
            if (this.selected_group && !this.read_only) {
              if (e.ctrlKey) {
                this.dragging_rectangle = null;
              }
              const dist = distance(
                [e.canvasX, e.canvasY],
                [
                  this.selected_group.pos[0] + this.selected_group.size[0],
                  this.selected_group.pos[1] + this.selected_group.size[1]
                ]
              );
              if (dist * this.ds.scale < 10) {
                this.selected_group_resizing = true;
              } else {
                this.selected_group.recomputeInsideNodes();
              }
            }
            if (is_double_click && !this.read_only && this.allow_searchbox) {
              this.showSearchBox(e);
              e.preventDefault();
              e.stopPropagation();
            }
            clicking_canvas_bg = true;
          }
        }
        if (!skip_action && clicking_canvas_bg && this.allow_dragcanvas) {
          this.dragging_canvas = true;
        }
      } else if (e.which == 2) {
        if (LiteGraph2.middle_click_slot_add_default_node) {
          if (node2 && this.allow_interaction && !skip_action && !this.read_only) {
            if (!this.connecting_node && !node2.flags.collapsed && !this.live_mode) {
              let mClikSlot = false;
              let mClikSlot_index = false;
              let mClikSlot_isOut = false;
              if (node2.outputs) {
                for (let i2 = 0, l = node2.outputs.length; i2 < l; ++i2) {
                  const output = node2.outputs[i2];
                  const link_pos = node2.getConnectionPos(false, i2);
                  if (isInsideRectangle$1(e.canvasX, e.canvasY, link_pos[0] - 15, link_pos[1] - 10, 30, 20)) {
                    mClikSlot = output;
                    mClikSlot_index = i2;
                    mClikSlot_isOut = true;
                    break;
                  }
                }
              }
              if (node2.inputs) {
                for (let i2 = 0, l = node2.inputs.length; i2 < l; ++i2) {
                  const input = node2.inputs[i2];
                  const link_pos = node2.getConnectionPos(true, i2);
                  if (isInsideRectangle$1(e.canvasX, e.canvasY, link_pos[0] - 15, link_pos[1] - 10, 30, 20)) {
                    mClikSlot = input;
                    mClikSlot_index = i2;
                    mClikSlot_isOut = false;
                    break;
                  }
                }
              }
              if (mClikSlot && mClikSlot_index !== false) {
                const slot_length = mClikSlot_isOut ? node2.outputs.length : node2.inputs.length;
                const alphaPosY = 0.5 - (mClikSlot_index + 1) / slot_length;
                const node_bounding = node2.getBounding();
                const posRef = [
                  !mClikSlot_isOut ? node_bounding[0] : node_bounding[0] + node_bounding[2],
                  e.canvasY - 80
                ];
                this.createDefaultNodeForSlot({
                  nodeFrom: !mClikSlot_isOut ? null : node2,
                  slotFrom: !mClikSlot_isOut ? null : mClikSlot_index,
                  nodeTo: !mClikSlot_isOut ? node2 : null,
                  slotTo: !mClikSlot_isOut ? mClikSlot_index : null,
                  position: posRef,
                  nodeType: "AUTO",
                  posAdd: [!mClikSlot_isOut ? -30 : 30, -alphaPosY * 130],
                  posSizeFix: [!mClikSlot_isOut ? -1 : 0, 0]
                });
              }
            }
          }
        } else if (!skip_action && this.allow_dragcanvas) {
          this.dragging_canvas = true;
        }
      } else if (e.which == 3 || this.pointer_is_double) {
        if (this.allow_interaction && !skip_action && !this.read_only) {
          if (node2) {
            const selected_nodes = this.selectedNodesRef();
            if (Object.keys(selected_nodes).length && (selected_nodes[String(node2.id)] || e.shiftKey || e.ctrlKey || e.metaKey)) {
              if (!selected_nodes[String(node2.id)]) {
                this.selectNodes([node2], true);
              }
            } else {
              this.selectNodes([node2]);
            }
          }
          this.processContextMenu(node2, e);
        }
      }
      this.last_mouse[0] = e.clientX;
      this.last_mouse[1] = e.clientY;
      this.last_mouseclick = LiteGraph2.getTime();
      this.last_mouse_dragging = true;
      graph.change();
      const active = ref_window2.document.activeElement;
      const node_name = active && "nodeName" in active ? String(active.nodeName).toLowerCase() : "";
      if (!active || node_name != "input" && node_name != "textarea") {
        e.preventDefault();
      }
      e.stopPropagation();
      if (this.onMouseDown) {
        this.onMouseDown(e);
      }
      return false;
    }
    /**
     * Called when a mouse move event has to be processed
     * @method processMouseMove
     **/
    processMouseMove(e) {
      if (this.autoresize) {
        this.resize();
      }
      if (this.set_canvas_dirty_on_mouse_event) {
        this.dirty_canvas = true;
      }
      const graph = this.graphRef();
      if (!graph) {
        return;
      }
      const LiteGraph2 = this.getLiteGraphHost();
      LGraphCanvasInput.active_canvas = this;
      this.adjustMouseEvent(e);
      const mouse = [e.clientX, e.clientY];
      this.mouse[0] = mouse[0];
      this.mouse[1] = mouse[1];
      const delta2 = [mouse[0] - this.last_mouse[0], mouse[1] - this.last_mouse[1]];
      this.last_mouse = mouse;
      this.graph_mouse[0] = e.canvasX;
      this.graph_mouse[1] = e.canvasY;
      if (this.block_click) {
        e.preventDefault();
        return false;
      }
      e.dragging = this.last_mouse_dragging;
      if (this.node_widget) {
        const widget_context = this.node_widget;
        this.callProcessNodeWidgets(widget_context[0], this.graph_mouse, e, widget_context[1]);
        this.dirty_canvas = true;
      }
      const node2 = graph.getNodeOnPos(e.canvasX, e.canvasY, this.visible_nodes);
      if (this.dragging_rectangle) {
        this.dragging_rectangle[2] = e.canvasX - this.dragging_rectangle[0];
        this.dragging_rectangle[3] = e.canvasY - this.dragging_rectangle[1];
        this.dirty_canvas = true;
      } else if (this.selected_group && !this.read_only) {
        if (this.selected_group_resizing) {
          this.selected_group.size = [
            e.canvasX - this.selected_group.pos[0],
            e.canvasY - this.selected_group.pos[1]
          ];
        } else {
          const deltax = delta2[0] / this.ds.scale;
          const deltay = delta2[1] / this.ds.scale;
          this.selected_group.move(deltax, deltay, e.ctrlKey);
          if (this.selected_group._nodes.length) {
            this.dirty_canvas = true;
          }
        }
        this.dirty_bgcanvas = true;
      } else if (this.dragging_canvas) {
        this.ds.offset[0] += delta2[0] / this.ds.scale;
        this.ds.offset[1] += delta2[1] / this.ds.scale;
        this.dirty_canvas = true;
        this.dirty_bgcanvas = true;
      } else if ((this.allow_interaction || node2 && node2.flags.allow_interaction) && !this.read_only) {
        if (this.connecting_node) {
          this.dirty_canvas = true;
        }
        for (let i2 = 0, l = graph._nodes.length; i2 < l; ++i2) {
          if (graph._nodes[i2].mouseOver && node2 != graph._nodes[i2]) {
            graph._nodes[i2].mouseOver = false;
            if (this.node_over && this.node_over.onMouseLeave) {
              this.node_over.onMouseLeave(e);
            }
            this.node_over = null;
            this.dirty_canvas = true;
          }
        }
        if (node2) {
          if (node2.redraw_on_mouse) {
            this.dirty_canvas = true;
          }
          if (!node2.mouseOver) {
            node2.mouseOver = true;
            this.node_over = node2;
            this.dirty_canvas = true;
            if (node2.onMouseEnter) {
              node2.onMouseEnter(e);
            }
          }
          if (node2.onMouseMove) {
            node2.onMouseMove(e, [e.canvasX - node2.pos[0], e.canvasY - node2.pos[1]], this);
          }
          if (this.connecting_node) {
            if (this.connecting_output) {
              const pos2 = this._highlight_input || [0, 0];
              if (!this.isOverNodeBox(node2, e.canvasX, e.canvasY)) {
                const slot = this.isOverNodeInput(node2, e.canvasX, e.canvasY, pos2);
                if (slot != -1 && node2.inputs[slot]) {
                  const slot_type = node2.inputs[slot].type;
                  if (LiteGraph2.isValidConnection(this.connecting_output.type, slot_type)) {
                    this._highlight_input = pos2;
                    this._highlight_input_slot = node2.inputs[slot];
                  }
                } else {
                  this._highlight_input = null;
                  this._highlight_input_slot = null;
                }
              }
            } else if (this.connecting_input) {
              const pos2 = this._highlight_output || [0, 0];
              if (!this.isOverNodeBox(node2, e.canvasX, e.canvasY)) {
                const slot = this.isOverNodeOutput(node2, e.canvasX, e.canvasY, pos2);
                if (slot != -1 && node2.outputs[slot]) {
                  const slot_type = node2.outputs[slot].type;
                  if (LiteGraph2.isValidConnection(this.connecting_input.type, slot_type)) {
                    this._highlight_output = pos2;
                  }
                } else {
                  this._highlight_output = null;
                }
              }
            }
          }
          if (this.canvas) {
            if (isInsideRectangle$1(
              e.canvasX,
              e.canvasY,
              node2.pos[0] + node2.size[0] - 5,
              node2.pos[1] + node2.size[1] - 5,
              5,
              5
            )) {
              this.canvas.style.cursor = "se-resize";
            } else {
              this.canvas.style.cursor = "crosshair";
            }
          }
        } else {
          let over_link = null;
          for (let i2 = 0; i2 < this.visible_links.length; ++i2) {
            const link = this.visible_links[i2];
            const center = link._pos;
            if (!center || e.canvasX < center[0] - 4 || e.canvasX > center[0] + 4 || e.canvasY < center[1] - 4 || e.canvasY > center[1] + 4) {
              continue;
            }
            over_link = link;
            break;
          }
          if (over_link != this.over_link_center) {
            this.over_link_center = over_link;
            this.dirty_canvas = true;
          }
          if (this.canvas) {
            this.canvas.style.cursor = "";
          }
        }
        if (this.node_capturing_input && this.node_capturing_input != node2 && this.node_capturing_input.onMouseMove) {
          this.node_capturing_input.onMouseMove(
            e,
            [e.canvasX - this.node_capturing_input.pos[0], e.canvasY - this.node_capturing_input.pos[1]],
            this
          );
        }
        if (this.node_dragged && !this.live_mode) {
          const selected_nodes = this.selectedNodesRef();
          for (const i2 in selected_nodes) {
            const n = selected_nodes[i2];
            n.pos[0] += delta2[0] / this.ds.scale;
            n.pos[1] += delta2[1] / this.ds.scale;
            if (!n.is_selected) {
              this.processNodeSelected(n, e);
            }
          }
          this.dirty_canvas = true;
          this.dirty_bgcanvas = true;
        }
        if (this.resizing_node && !this.live_mode) {
          const desired_size = [
            e.canvasX - this.resizing_node.pos[0],
            e.canvasY - this.resizing_node.pos[1]
          ];
          const min_size = this.resizing_node.computeSize();
          desired_size[0] = Math.max(min_size[0], desired_size[0]);
          desired_size[1] = Math.max(min_size[1], desired_size[1]);
          this.resizing_node.setSize(desired_size);
          this.canvas.style.cursor = "se-resize";
          this.dirty_canvas = true;
          this.dirty_bgcanvas = true;
        }
      }
      e.preventDefault();
      return false;
    }
    /**
     * Called when a mouse up event has to be processed
     * @method processMouseUp
     **/
    processMouseUp(e) {
      const is_primary = e.isPrimary === void 0 || e.isPrimary;
      if (!is_primary) {
        return false;
      }
      if (this.set_canvas_dirty_on_mouse_event) {
        this.dirty_canvas = true;
      }
      const graph = this.graphRef();
      if (!graph) {
        return;
      }
      const ref_window2 = this.getCanvasWindow();
      const document2 = ref_window2.document;
      const LiteGraph2 = this.getLiteGraphHost();
      LGraphCanvasInput.active_canvas = this;
      if (!this.options.skip_events) {
        LiteGraph2.pointerListenerRemove(document2, "move", this._mousemove_callback, true);
        LiteGraph2.pointerListenerAdd(this.canvas, "move", this._mousemove_callback);
        LiteGraph2.pointerListenerRemove(document2, "up", this._mouseup_callback, true);
      }
      this.adjustMouseEvent(e);
      const now = LiteGraph2.getTime();
      e.click_time = now - this.last_mouseclick;
      this.last_mouse_dragging = false;
      this.last_click_position = null;
      if (this.block_click) {
        this.block_click = false;
      }
      if (e.which == 1) {
        if (this.node_widget) {
          const widget_context = this.node_widget;
          this.callProcessNodeWidgets(widget_context[0], this.graph_mouse, e);
        }
        this.node_widget = null;
        if (this.selected_group) {
          const diffx = this.selected_group.pos[0] - Math.round(this.selected_group.pos[0]);
          const diffy = this.selected_group.pos[1] - Math.round(this.selected_group.pos[1]);
          this.selected_group.move(diffx, diffy, e.ctrlKey);
          this.selected_group.pos[0] = Math.round(this.selected_group.pos[0]);
          this.selected_group.pos[1] = Math.round(this.selected_group.pos[1]);
          if (this.selected_group._nodes.length) {
            this.dirty_canvas = true;
          }
          this.selected_group = null;
        }
        this.selected_group_resizing = false;
        const node2 = graph.getNodeOnPos(e.canvasX, e.canvasY, this.visible_nodes);
        if (this.dragging_rectangle) {
          const nodes = graph._nodes;
          const node_bounding = new Float32Array(4);
          const w2 = Math.abs(this.dragging_rectangle[2]);
          const h = Math.abs(this.dragging_rectangle[3]);
          const startx = this.dragging_rectangle[2] < 0 ? this.dragging_rectangle[0] - w2 : this.dragging_rectangle[0];
          const starty = this.dragging_rectangle[3] < 0 ? this.dragging_rectangle[1] - h : this.dragging_rectangle[1];
          this.dragging_rectangle[0] = startx;
          this.dragging_rectangle[1] = starty;
          this.dragging_rectangle[2] = w2;
          this.dragging_rectangle[3] = h;
          if (!node2 || w2 > 10 && h > 10) {
            const to_select = [];
            for (let i2 = 0; i2 < nodes.length; ++i2) {
              const nodeX = nodes[i2];
              nodeX.getBounding(node_bounding);
              if (!overlapBounding(this.dragging_rectangle, node_bounding)) {
                continue;
              }
              to_select.push(nodeX);
            }
            if (to_select.length) {
              this.selectNodes(to_select, e.shiftKey);
            }
          } else {
            this.selectNodes([node2], e.shiftKey || e.ctrlKey);
          }
          this.dragging_rectangle = null;
        } else if (this.connecting_node) {
          this.dirty_canvas = true;
          this.dirty_bgcanvas = true;
          const connInOrOut = this.connecting_output || this.connecting_input;
          const connType = connInOrOut.type;
          if (node2) {
            if (this.connecting_output) {
              const slot = this.isOverNodeInput(node2, e.canvasX, e.canvasY);
              if (slot != -1) {
                this.connecting_node.connect(this.connecting_slot, node2, slot);
              } else {
                this.connecting_node.connectByType(this.connecting_slot, node2, connType);
              }
            } else if (this.connecting_input) {
              const slot = this.isOverNodeOutput(node2, e.canvasX, e.canvasY);
              if (slot != -1) {
                node2.connect(slot, this.connecting_node, this.connecting_slot);
              } else {
                this.connecting_node.connectByTypeOutput(this.connecting_slot, node2, connType);
              }
            }
          } else {
            if (LiteGraph2.release_link_on_empty_shows_menu) {
              if (e.shiftKey && this.allow_searchbox) {
                if (this.connecting_output) {
                  this.showSearchBox(e, {
                    node_from: this.connecting_node,
                    slot_from: this.connecting_output,
                    type_filter_in: this.connecting_output.type
                  });
                } else if (this.connecting_input) {
                  this.showSearchBox(e, {
                    node_to: this.connecting_node,
                    slot_from: this.connecting_input,
                    type_filter_out: this.connecting_input.type
                  });
                }
              } else {
                if (this.connecting_output) {
                  this.showConnectionMenu({
                    nodeFrom: this.connecting_node,
                    slotFrom: this.connecting_output,
                    e
                  });
                } else if (this.connecting_input) {
                  this.showConnectionMenu({
                    nodeTo: this.connecting_node,
                    slotTo: this.connecting_input,
                    e
                  });
                }
              }
            }
          }
          this.connecting_output = null;
          this.connecting_input = null;
          this.connecting_pos = null;
          this.connecting_node = null;
          this.connecting_slot = -1;
        } else if (this.resizing_node) {
          this.dirty_canvas = true;
          this.dirty_bgcanvas = true;
          graph.afterChange(this.resizing_node);
          this.resizing_node = null;
        } else if (this.node_dragged) {
          const node_dragged = this.node_dragged;
          if (node_dragged && e.click_time < 300 && isInsideRectangle$1(
            e.canvasX,
            e.canvasY,
            node_dragged.pos[0],
            node_dragged.pos[1] - LiteGraph2.NODE_TITLE_HEIGHT,
            LiteGraph2.NODE_TITLE_HEIGHT,
            LiteGraph2.NODE_TITLE_HEIGHT
          )) {
            node_dragged.collapse();
          }
          this.dirty_canvas = true;
          this.dirty_bgcanvas = true;
          this.node_dragged.pos[0] = Math.round(this.node_dragged.pos[0]);
          this.node_dragged.pos[1] = Math.round(this.node_dragged.pos[1]);
          if (graph.config.align_to_grid || this.align_to_grid) {
            this.node_dragged.alignToGrid();
          }
          if (this.onNodeMoved) {
            this.onNodeMoved(this.node_dragged);
          }
          graph.afterChange(this.node_dragged);
          this.node_dragged = null;
        } else {
          const node_over = graph.getNodeOnPos(e.canvasX, e.canvasY, this.visible_nodes);
          if (!node_over && e.click_time < 300) {
            this.deselectAllNodes();
          }
          this.dirty_canvas = true;
          this.dragging_canvas = false;
          if (this.node_over && this.node_over.onMouseUp) {
            this.node_over.onMouseUp(
              e,
              [e.canvasX - this.node_over.pos[0], e.canvasY - this.node_over.pos[1]],
              this
            );
          }
          if (this.node_capturing_input && this.node_capturing_input.onMouseUp) {
            this.node_capturing_input.onMouseUp(e, [
              e.canvasX - this.node_capturing_input.pos[0],
              e.canvasY - this.node_capturing_input.pos[1]
            ]);
          }
        }
      } else if (e.which == 2) {
        this.dirty_canvas = true;
        this.dragging_canvas = false;
      } else if (e.which == 3) {
        this.dirty_canvas = true;
        this.dragging_canvas = false;
      }
      if (is_primary) {
        this.pointer_is_down = false;
        this.pointer_is_double = false;
      }
      graph.change();
      e.stopPropagation();
      e.preventDefault();
      return false;
    }
    /**
     * Called when a mouse wheel event has to be processed
     * @method processMouseWheel
     **/
    processMouseWheel(e) {
      if (!this.graph || !this.allow_dragcanvas) {
        return;
      }
      const delta2 = e.wheelDeltaY != null ? e.wheelDeltaY : e.wheelDelta != null ? e.wheelDelta : e.deltaY != null ? -e.deltaY : e.detail != null ? e.detail * -60 : 0;
      this.adjustMouseEvent(e);
      const x2 = e.clientX;
      const y2 = e.clientY;
      const is_inside = !this.viewport || this.viewport && x2 >= this.viewport[0] && x2 < this.viewport[0] + this.viewport[2] && y2 >= this.viewport[1] && y2 < this.viewport[1] + this.viewport[3];
      if (!is_inside) {
        return;
      }
      let scale = this.ds.scale;
      if (delta2 > 0) {
        scale *= 1.1;
      } else if (delta2 < 0) {
        scale *= 1 / 1.1;
      }
      this.ds.changeScale(scale, [e.clientX, e.clientY]);
      this.graph.change();
      e.preventDefault();
      return false;
    }
    /**
     * returns true if a position (in graph space) is on top of a node little corner box
     * @method isOverNodeBox
     **/
    isOverNodeBox(node2, canvasx, canvasy) {
      const title_height = this.getLiteGraphHost().NODE_TITLE_HEIGHT;
      if (isInsideRectangle$1(
        canvasx,
        canvasy,
        node2.pos[0] + 2,
        node2.pos[1] + 2 - title_height,
        title_height - 4,
        title_height - 4
      )) {
        return true;
      }
      return false;
    }
    /**
     * returns the INDEX if a position (in graph space) is on top of a node input slot
     * @method isOverNodeInput
     **/
    isOverNodeInput(node2, canvasx, canvasy, slot_pos) {
      if (node2.inputs) {
        for (let i2 = 0, l = node2.inputs.length; i2 < l; ++i2) {
          const link_pos = node2.getConnectionPos(true, i2);
          let is_inside = false;
          if (node2.horizontal) {
            is_inside = isInsideRectangle$1(canvasx, canvasy, link_pos[0] - 5, link_pos[1] - 10, 10, 20);
          } else {
            is_inside = isInsideRectangle$1(canvasx, canvasy, link_pos[0] - 10, link_pos[1] - 5, 40, 10);
          }
          if (is_inside) {
            if (slot_pos) {
              slot_pos[0] = link_pos[0];
              slot_pos[1] = link_pos[1];
            }
            return i2;
          }
        }
      }
      return -1;
    }
    /**
     * returns the INDEX if a position (in graph space) is on top of a node output slot
     * @method isOverNodeOutput
     **/
    isOverNodeOutput(node2, canvasx, canvasy, slot_pos) {
      if (node2.outputs) {
        for (let i2 = 0, l = node2.outputs.length; i2 < l; ++i2) {
          const link_pos = node2.getConnectionPos(false, i2);
          let is_inside = false;
          if (node2.horizontal) {
            is_inside = isInsideRectangle$1(canvasx, canvasy, link_pos[0] - 5, link_pos[1] - 10, 10, 20);
          } else {
            is_inside = isInsideRectangle$1(canvasx, canvasy, link_pos[0] - 10, link_pos[1] - 5, 40, 10);
          }
          if (is_inside) {
            if (slot_pos) {
              slot_pos[0] = link_pos[0];
              slot_pos[1] = link_pos[1];
            }
            return i2;
          }
        }
      }
      return -1;
    }
    /**
     * process a key event
     * @method processKey
     **/
    processKey(e) {
      if (!this.graph) {
        return;
      }
      let block_default = false;
      let node_consumed = false;
      const target = e.target;
      if (target.localName == "input") {
        return;
      }
      if (e.type == "keydown") {
        if (e.keyCode == 32) {
          this.dragging_canvas = true;
          block_default = true;
        }
        if (e.keyCode == 27) {
          if (this.node_panel) {
            this.node_panel.close();
          }
          if (this.options_panel) {
            this.options_panel.close();
          }
          block_default = true;
        }
        if (e.keyCode == 65 && e.ctrlKey) {
          this.selectNodes();
          block_default = true;
        }
        if (e.keyCode === 67 && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
          if (this.selected_nodes) {
            this.copyToClipboard();
            block_default = true;
          }
        }
        if (e.keyCode === 86 && (e.metaKey || e.ctrlKey)) {
          this.pasteFromClipboard(e.shiftKey);
          block_default = true;
        }
        if (e.keyCode == 46 || e.keyCode == 8) {
          if (target.localName != "input" && target.localName != "textarea") {
            this.deleteSelectedNodes();
            block_default = true;
          }
        }
        node_consumed = this.dispatchNodeKeyHook(this.selectedNodesRef(), "onKeyDown", e);
      } else if (e.type == "keyup") {
        if (e.keyCode == 32) {
          this.dragging_canvas = false;
        }
        node_consumed = this.dispatchNodeKeyHook(this.selectedNodesRef(), "onKeyUp", e);
      }
      this.graph.change();
      if (block_default || node_consumed) {
        e.preventDefault();
        e.stopImmediatePropagation();
        return false;
      }
    }
    copyToClipboard() {
      const clipboard_info = {
        nodes: [],
        links: []
      };
      let index = 0;
      const selected_nodes_array = [];
      for (const i2 in this.selected_nodes) {
        const node2 = this.selected_nodes[i2];
        if (node2.clonable === false) {
          continue;
        }
        node2._relative_id = index;
        selected_nodes_array.push(node2);
        index += 1;
      }
      for (let i2 = 0; i2 < selected_nodes_array.length; ++i2) {
        const node2 = selected_nodes_array[i2];
        if (node2.clonable === false) {
          continue;
        }
        const cloned = node2.clone();
        if (!cloned) {
          console.warn("node type not found: " + node2.type);
          continue;
        }
        clipboard_info.nodes.push(cloned.serialize());
        if (node2.inputs && node2.inputs.length) {
          for (let j = 0; j < node2.inputs.length; ++j) {
            const input = node2.inputs[j];
            if (!input || input.link == null) {
              continue;
            }
            const link_info = this.graph.links[input.link];
            if (!link_info) {
              continue;
            }
            const target_node = this.graph.getNodeById(link_info.origin_id);
            if (!target_node) {
              continue;
            }
            clipboard_info.links.push([
              target_node._relative_id,
              link_info.origin_slot,
              node2._relative_id,
              link_info.target_slot,
              target_node.id
            ]);
          }
        }
      }
      localStorage.setItem("litegrapheditor_clipboard", JSON.stringify(clipboard_info));
    }
    pasteFromClipboard(isConnectUnselected = false) {
      const LiteGraph2 = this.getLiteGraphHost();
      if (!LiteGraph2.ctrl_shift_v_paste_connect_unselected_outputs && isConnectUnselected) {
        return;
      }
      const data = localStorage.getItem("litegrapheditor_clipboard");
      if (!data) {
        return;
      }
      this.graph.beforeChange();
      const clipboard_info = JSON.parse(data);
      let posMin = false;
      for (let i2 = 0; i2 < clipboard_info.nodes.length; ++i2) {
        if (posMin) {
          if (posMin[0] > clipboard_info.nodes[i2].pos[0]) {
            posMin[0] = clipboard_info.nodes[i2].pos[0];
          }
          if (posMin[1] > clipboard_info.nodes[i2].pos[1]) {
            posMin[1] = clipboard_info.nodes[i2].pos[1];
          }
        } else {
          posMin = [clipboard_info.nodes[i2].pos[0], clipboard_info.nodes[i2].pos[1]];
        }
      }
      const nodes = [];
      for (let i2 = 0; i2 < clipboard_info.nodes.length; ++i2) {
        const node_data = clipboard_info.nodes[i2];
        const node2 = LiteGraph2.createNode(node_data.type);
        if (node2) {
          node2.configure(node_data);
          node2.pos[0] += this.graph_mouse[0] - posMin[0];
          node2.pos[1] += this.graph_mouse[1] - posMin[1];
          this.graph.add(node2, { doProcessChange: false });
          nodes.push(node2);
        }
      }
      for (let i2 = 0; i2 < clipboard_info.links.length; ++i2) {
        const link_info = clipboard_info.links[i2];
        let origin_node;
        const origin_node_relative_id = link_info[0];
        if (origin_node_relative_id != null) {
          origin_node = nodes[origin_node_relative_id];
        } else if (LiteGraph2.ctrl_shift_v_paste_connect_unselected_outputs && isConnectUnselected) {
          const origin_node_id = link_info[4];
          if (origin_node_id) {
            origin_node = this.graph.getNodeById(origin_node_id);
          }
        }
        const target_node = nodes[link_info[2]];
        if (origin_node && target_node) {
          origin_node.connect(link_info[1], target_node, link_info[3]);
        } else {
          console.warn("Warning, nodes missing on pasting");
        }
      }
      this.selectNodes(nodes);
      this.graph.afterChange();
    }
    /**
     * process a item drop event on top the canvas
     * @method processDrop
     **/
    processDrop(e) {
      e.preventDefault();
      this.adjustMouseEvent(e);
      const x2 = e.clientX;
      const y2 = e.clientY;
      const is_inside = !this.viewport || this.viewport && x2 >= this.viewport[0] && x2 < this.viewport[0] + this.viewport[2] && y2 >= this.viewport[1] && y2 < this.viewport[1] + this.viewport[3];
      if (!is_inside) {
        return;
      }
      const pos2 = [e.canvasX, e.canvasY];
      const node2 = this.graph ? this.graph.getNodeOnPos(pos2[0], pos2[1]) : null;
      if (!node2) {
        let r = null;
        if (this.onDropItem) {
          r = this.onDropItem(event);
        }
        if (!r) {
          this.checkDropItem(e);
        }
        return;
      }
      if (node2.onDropFile || node2.onDropData) {
        const files = e.dataTransfer.files;
        if (files && files.length) {
          for (let i2 = 0; i2 < files.length; i2++) {
            const file = e.dataTransfer.files[0];
            const filename = file.name;
            this.constructor.getFileExtension(filename);
            if (node2.onDropFile) {
              node2.onDropFile(file);
            }
            if (node2.onDropData) {
              const reader = new FileReader();
              reader.onload = function(event2) {
                const data = event2.target.result;
                node2.onDropData(data, filename, file);
              };
              const type = file.type.split("/")[0];
              if (type == "text" || type == "") {
                reader.readAsText(file);
              } else if (type == "image") {
                reader.readAsDataURL(file);
              } else {
                reader.readAsArrayBuffer(file);
              }
            }
          }
        }
      }
      if (node2.onDropItem) {
        if (node2.onDropItem(event)) {
          return;
        }
      }
      if (this.onDropItem) {
        this.onDropItem(event);
        return;
      }
    }
    // called if the graph doesn't have a default drop item behaviour
    checkDropItem(e) {
      const LiteGraph2 = this.getLiteGraphHost();
      if (e.dataTransfer.files.length) {
        const file = e.dataTransfer.files[0];
        const ext = this.constructor.getFileExtension(file.name).toLowerCase();
        const nodetype = LiteGraph2.node_types_by_file_extension[ext];
        if (nodetype) {
          this.graph.beforeChange();
          const node2 = LiteGraph2.createNode(nodetype.type);
          node2.pos = [e.canvasX, e.canvasY];
          this.graph.add(node2);
          if (node2.onDropFile) {
            node2.onDropFile(file);
          }
          this.graph.afterChange();
        }
      }
    }
    processNodeDblClicked(n) {
      if (this.onShowNodePanel) {
        this.onShowNodePanel(n);
      } else {
        this.showShowNodePanel(n);
      }
      if (this.onNodeDblClicked) {
        this.onNodeDblClicked(n);
      }
      this.setDirty(true);
    }
    processNodeSelected(node2, e) {
      this.selectNode(node2, !!(e && (e.shiftKey || e.ctrlKey || this.multi_select)));
      if (this.onNodeSelected) {
        this.onNodeSelected(node2);
      }
    }
    /**
     * selects a given node (or adds it to the current selection)
     * @method selectNode
     **/
    selectNode(node2, add_to_current_selection) {
      if (node2 == null) {
        this.deselectAllNodes();
      } else {
        this.selectNodes([node2], add_to_current_selection);
      }
    }
    /**
     * selects several nodes (or adds them to the current selection)
     * @method selectNodes
     **/
    selectNodes(nodes, add_to_current_selection) {
      if (!add_to_current_selection) {
        this.deselectAllNodes();
      }
      nodes = nodes || this.graph._nodes;
      if (typeof nodes == "string") {
        nodes = [nodes];
      }
      for (const i2 in nodes) {
        const node2 = nodes[i2];
        if (node2.is_selected) {
          this.deselectNode(node2);
          continue;
        }
        if (!node2.is_selected && node2.onSelected) {
          node2.onSelected();
        }
        node2.is_selected = true;
        this.selected_nodes[node2.id] = node2;
        if (node2.inputs) {
          for (let j = 0; j < node2.inputs.length; ++j) {
            this.highlighted_links[node2.inputs[j].link] = true;
          }
        }
        if (node2.outputs) {
          for (let j = 0; j < node2.outputs.length; ++j) {
            const out = node2.outputs[j];
            if (out.links) {
              for (let k = 0; k < out.links.length; ++k) {
                this.highlighted_links[out.links[k]] = true;
              }
            }
          }
        }
      }
      if (this.onSelectionChange) {
        this.onSelectionChange(this.selected_nodes);
      }
      this.setDirty(true, false);
    }
    /**
     * removes a node from the current selection
     * @method deselectNode
     **/
    deselectNode(node2) {
      if (!node2.is_selected) {
        return;
      }
      if (node2.onDeselected) {
        node2.onDeselected();
      }
      node2.is_selected = false;
      if (this.onNodeDeselected) {
        this.onNodeDeselected(node2);
      }
      if (node2.inputs) {
        for (let i2 = 0; i2 < node2.inputs.length; ++i2) {
          delete this.highlighted_links[node2.inputs[i2].link];
        }
      }
      if (node2.outputs) {
        for (let i2 = 0; i2 < node2.outputs.length; ++i2) {
          const out = node2.outputs[i2];
          if (out.links) {
            for (let j = 0; j < out.links.length; ++j) {
              delete this.highlighted_links[out.links[j]];
            }
          }
        }
      }
    }
    /**
     * removes all nodes from the current selection
     * @method deselectAllNodes
     **/
    deselectAllNodes() {
      if (!this.graph) {
        return;
      }
      const nodes = this.graph._nodes;
      for (let i2 = 0, l = nodes.length; i2 < l; ++i2) {
        const node2 = nodes[i2];
        if (!node2.is_selected) {
          continue;
        }
        if (node2.onDeselected) {
          node2.onDeselected();
        }
        node2.is_selected = false;
        if (this.onNodeDeselected) {
          this.onNodeDeselected(node2);
        }
      }
      this.selected_nodes = {};
      this.current_node = null;
      this.highlighted_links = {};
      if (this.onSelectionChange) {
        this.onSelectionChange(this.selected_nodes);
      }
      this.setDirty(true, false);
    }
    /**
     * deletes all nodes in the current selection from the graph
     * @method deleteSelectedNodes
     **/
    deleteSelectedNodes() {
      const LiteGraph2 = this.getLiteGraphHost();
      this.graph.beforeChange();
      for (const i2 in this.selected_nodes) {
        const node2 = this.selected_nodes[i2];
        if (node2.block_delete) {
          continue;
        }
        if (node2.inputs && node2.inputs.length && node2.outputs && node2.outputs.length && LiteGraph2.isValidConnection(node2.inputs[0].type, node2.outputs[0].type) && node2.inputs[0].link && node2.outputs[0].links && node2.outputs[0].links.length) {
          const input_link = node2.graph.links[node2.inputs[0].link];
          const output_link = node2.graph.links[node2.outputs[0].links[0]];
          const input_node = node2.getInputNode(0);
          const output_node = node2.getOutputNodes(0)[0];
          if (input_node && output_node) {
            input_node.connect(input_link.origin_slot, output_node, output_link.target_slot);
          }
        }
        this.graph.remove(node2);
        if (this.onNodeDeselected) {
          this.onNodeDeselected(node2);
        }
      }
      this.selected_nodes = {};
      this.current_node = null;
      this.highlighted_links = {};
      this.setDirty(true, false);
      this.graph.afterChange();
    }
    /**
     * centers the camera on a given node
     * @method centerOnNode
     **/
    centerOnNode(node2) {
      this.ds.offset[0] = -node2.pos[0] - node2.size[0] * 0.5 + this.canvas.width * 0.5 / this.ds.scale;
      this.ds.offset[1] = -node2.pos[1] - node2.size[1] * 0.5 + this.canvas.height * 0.5 / this.ds.scale;
      this.setDirty(true, true);
    }
    /**
     * adds some useful properties to a mouse event, like the position in graph coordinates
     * @method adjustMouseEvent
     **/
    adjustMouseEvent(e) {
      let clientX_rel = 0;
      let clientY_rel = 0;
      if (this.canvas) {
        const b = this.canvas.getBoundingClientRect();
        clientX_rel = e.clientX - b.left;
        clientY_rel = e.clientY - b.top;
      } else {
        clientX_rel = e.clientX;
        clientY_rel = e.clientY;
      }
      this.last_mouse_position[0] = clientX_rel;
      this.last_mouse_position[1] = clientY_rel;
      e.canvasX = clientX_rel / this.ds.scale - this.ds.offset[0];
      e.canvasY = clientY_rel / this.ds.scale - this.ds.offset[1];
    }
    /**
     * changes the zoom level of the graph (default is 1), you can pass also a place used to pivot the zoom
     * @method setZoom
     **/
    setZoom(value, zooming_center) {
      this.ds.changeScale(value, zooming_center);
      this.dirty_canvas = true;
      this.dirty_bgcanvas = true;
    }
    /**
     * converts a coordinate from graph coordinates to canvas2D coordinates
     * @method convertOffsetToCanvas
     **/
    convertOffsetToCanvas(pos2, out) {
      return this.ds.convertOffsetToCanvas(pos2, out);
    }
    /**
     * converts a coordinate from Canvas2D coordinates to graph space
     * @method convertCanvasToOffset
     **/
    convertCanvasToOffset(pos2, out) {
      return this.ds.convertCanvasToOffset(pos2, out);
    }
    // converts event coordinates from canvas2D to graph coordinates
    convertEventToCanvasOffset(e) {
      const rect = this.canvas.getBoundingClientRect();
      return this.convertCanvasToOffset([e.clientX - rect.left, e.clientY - rect.top]);
    }
    /**
     * brings a node to front (above all other nodes)
     * @method bringToFront
     **/
    bringToFront(node2) {
      const i2 = this.graph._nodes.indexOf(node2);
      if (i2 == -1) {
        return;
      }
      this.graph._nodes.splice(i2, 1);
      this.graph._nodes.push(node2);
    }
    /**
     * sends a node to the back (below all other nodes)
     * @method sendToBack
     **/
    sendToBack(node2) {
      const i2 = this.graph._nodes.indexOf(node2);
      if (i2 == -1) {
        return;
      }
      this.graph._nodes.splice(i2, 1);
      this.graph._nodes.unshift(node2);
    }
    /**
     * checks which nodes are visible (inside the camera area)
     * @method computeVisibleNodes
     **/
    computeVisibleNodes(nodes, out) {
      const visible_nodes = out || [];
      visible_nodes.length = 0;
      nodes = nodes || this.graph._nodes;
      for (let i2 = 0, l = nodes.length; i2 < l; ++i2) {
        const n = nodes[i2];
        if (this.live_mode && !n.onDrawBackground && !n.onDrawForeground) {
          continue;
        }
        if (!overlapBounding(this.visible_area, n.getBounding(temp, true))) {
          continue;
        }
        visible_nodes.push(n);
      }
      return visible_nodes;
    }
  }
  const temp_vec2 = new Float32Array(2);
  const tmp_area = new Float32Array(4);
  const margin_area = new Float32Array(4);
  const link_bounding = new Float32Array(4);
  const tempA = new Float32Array(2);
  const tempB = new Float32Array(2);
  const temp_point = new Float32Array(2);
  class LGraphCanvasRender extends LGraphCanvasInput {
    constants() {
      var _a2, _b2, _c2, _d2, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _A, _B, _C, _D, _E, _F, _G, _H, _I, _J;
      const host = this.getLiteGraphHost();
      return {
        ...host,
        RIGHT: (_a2 = host.RIGHT) != null ? _a2 : 2,
        LEFT: (_b2 = host.LEFT) != null ? _b2 : 4,
        UP: (_c2 = host.UP) != null ? _c2 : 1,
        DOWN: (_d2 = host.DOWN) != null ? _d2 : 3,
        CENTER: (_e = host.CENTER) != null ? _e : 5,
        BOX_SHAPE: (_f = host.BOX_SHAPE) != null ? _f : 1,
        ROUND_SHAPE: (_g = host.ROUND_SHAPE) != null ? _g : 2,
        CARD_SHAPE: (_h = host.CARD_SHAPE) != null ? _h : 4,
        CIRCLE_SHAPE: (_i = host.CIRCLE_SHAPE) != null ? _i : 3,
        ARROW_SHAPE: (_j = host.ARROW_SHAPE) != null ? _j : 5,
        GRID_SHAPE: (_k = host.GRID_SHAPE) != null ? _k : 6,
        NO_TITLE: (_l = host.NO_TITLE) != null ? _l : 0,
        TRANSPARENT_TITLE: (_m = host.TRANSPARENT_TITLE) != null ? _m : 1,
        AUTOHIDE_TITLE: (_n = host.AUTOHIDE_TITLE) != null ? _n : 2,
        NODE_TEXT_COLOR: (_o = host.NODE_TEXT_COLOR) != null ? _o : "#AAA",
        NODE_TITLE_HEIGHT: (_p = host.NODE_TITLE_HEIGHT) != null ? _p : 30,
        NODE_TITLE_TEXT_Y: (_q = host.NODE_TITLE_TEXT_Y) != null ? _q : 20,
        NODE_DEFAULT_COLOR: (_r = host.NODE_DEFAULT_COLOR) != null ? _r : "#333",
        NODE_DEFAULT_BGCOLOR: (_s = host.NODE_DEFAULT_BGCOLOR) != null ? _s : "#353535",
        NODE_DEFAULT_BOXCOLOR: (_t = host.NODE_DEFAULT_BOXCOLOR) != null ? _t : "#666",
        NODE_SELECTED_TITLE_COLOR: (_u = host.NODE_SELECTED_TITLE_COLOR) != null ? _u : "#FFF",
        NODE_BOX_OUTLINE_COLOR: (_v = host.NODE_BOX_OUTLINE_COLOR) != null ? _v : "#FFF",
        EVENT_LINK_COLOR: (_w = host.EVENT_LINK_COLOR) != null ? _w : "#A86",
        CONNECTING_LINK_COLOR: (_x = host.CONNECTING_LINK_COLOR) != null ? _x : "#AFA",
        DEFAULT_SHADOW_COLOR: (_y = host.DEFAULT_SHADOW_COLOR) != null ? _y : "rgba(0,0,0,0.4)",
        NODE_SLOT_HEIGHT: (_z = host.NODE_SLOT_HEIGHT) != null ? _z : 20,
        NODE_WIDGET_HEIGHT: (_A = host.NODE_WIDGET_HEIGHT) != null ? _A : 20,
        DEFAULT_GROUP_FONT_SIZE: (_B = host.DEFAULT_GROUP_FONT_SIZE) != null ? _B : 24,
        WIDGET_OUTLINE_COLOR: (_C = host.WIDGET_OUTLINE_COLOR) != null ? _C : "#666",
        WIDGET_BGCOLOR: (_D = host.WIDGET_BGCOLOR) != null ? _D : "#222",
        WIDGET_TEXT_COLOR: (_E = host.WIDGET_TEXT_COLOR) != null ? _E : "#DDD",
        WIDGET_SECONDARY_TEXT_COLOR: (_F = host.WIDGET_SECONDARY_TEXT_COLOR) != null ? _F : "#999",
        pointerevents_method: (_G = host.pointerevents_method) != null ? _G : "mouse",
        SPLINE_LINK: (_H = host.SPLINE_LINK) != null ? _H : 2,
        LINEAR_LINK: (_I = host.LINEAR_LINK) != null ? _I : 1,
        STRAIGHT_LINK: (_J = host.STRAIGHT_LINK) != null ? _J : 0,
        node_box_coloured_by_mode: !!host.node_box_coloured_by_mode,
        node_box_coloured_when_on: !!host.node_box_coloured_when_on,
        NODE_MODES_COLORS: host.NODE_MODES_COLORS || {},
        isInsideRectangle: host.isInsideRectangle || ((x2, y2, left, top, width2, height) => isInsideRectangle$1(x2, y2, left, top, width2, height)),
        getTime: host.getTime || (() => Date.now())
      };
    }
    /**
     * renders the whole canvas content, by rendering in two separated canvas, one containing the background grid and the connections, and one containing the nodes)
     * @method draw
     **/
    draw(force_canvas, force_bgcanvas) {
      if (!this.canvas || this.canvas.width == 0 || this.canvas.height == 0) {
        return;
      }
      const LiteGraph2 = this.constants();
      const now = LiteGraph2.getTime();
      this.render_time = (now - this.last_draw_time) * 1e-3;
      this.last_draw_time = now;
      if (this.graph) {
        this.ds.computeVisibleArea(this.viewport);
      }
      if (this.dirty_bgcanvas || force_bgcanvas || this.always_render_background || this.graph && this.graph._last_trigger_time && now - this.graph._last_trigger_time < 1e3) {
        this.drawBackCanvas();
      }
      if (this.dirty_canvas || force_canvas) {
        this.drawFrontCanvas();
      }
      this.fps = this.render_time ? 1 / this.render_time : 0;
      this.frame += 1;
    }
    /**
     * draws the front canvas (the one containing all the nodes)
     * @method drawFrontCanvas
     **/
    drawFrontCanvas() {
      var _a2, _b2, _c2;
      this.dirty_canvas = false;
      if (!this.ctx && this.bgcanvas) {
        this.ctx = this.bgcanvas.getContext("2d");
      }
      const ctx = this.ctx;
      if (!ctx) {
        return;
      }
      const LiteGraph2 = this.constants();
      const canvas = this.canvas;
      if (ctx.start2D && !this.viewport) {
        ctx.start2D();
        ctx.restore();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
      }
      const area = this.viewport || this.dirty_area;
      if (area) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(area[0], area[1], area[2], area[3]);
        ctx.clip();
      }
      if (this.clear_background) {
        if (area) {
          ctx.clearRect(area[0], area[1], area[2], area[3]);
        } else {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
      if (this.bgcanvas == this.canvas) {
        this.drawBackCanvas();
      } else if (this.bgcanvas) {
        ctx.drawImage(this.bgcanvas, 0, 0);
      }
      (_a2 = this.onRender) == null ? void 0 : _a2.call(this, canvas, ctx);
      if (this.show_info) {
        this.renderInfo(ctx, area ? area[0] : 0, area ? area[1] : 0);
      }
      if (this.graph) {
        ctx.save();
        this.ds.toCanvasContext(ctx);
        const visible_nodes = this.computeVisibleNodes(null, this.visible_nodes);
        for (let i2 = 0; i2 < visible_nodes.length; ++i2) {
          const node2 = visible_nodes[i2];
          ctx.save();
          ctx.translate(node2.pos[0], node2.pos[1]);
          this.drawNode(node2, ctx);
          ctx.restore();
        }
        if (this.render_execution_order) {
          this.drawExecutionOrder(ctx);
        }
        if (((_b2 = this.graph.config) == null ? void 0 : _b2.links_ontop) && !this.live_mode) {
          this.drawConnections(ctx);
        }
        if (this.connecting_pos != null) {
          ctx.lineWidth = this.connections_width;
          let link_color = null;
          const connInOrOut = this.connecting_output || this.connecting_input;
          const connType = connInOrOut.type;
          let connDir = connInOrOut.dir;
          if (connDir == null) {
            connDir = this.connecting_output ? this.connecting_node.horizontal ? LiteGraph2.DOWN : LiteGraph2.RIGHT : this.connecting_node.horizontal ? LiteGraph2.UP : LiteGraph2.LEFT;
          }
          const connShape = connInOrOut.shape;
          link_color = connType === LiteGraph2.EVENT ? LiteGraph2.EVENT_LINK_COLOR : LiteGraph2.CONNECTING_LINK_COLOR;
          this.renderLink(
            ctx,
            this.connecting_pos,
            [this.graph_mouse[0], this.graph_mouse[1]],
            null,
            false,
            null,
            link_color,
            connDir,
            LiteGraph2.CENTER
          );
          ctx.beginPath();
          if (connType === LiteGraph2.EVENT || connShape === LiteGraph2.BOX_SHAPE) {
            ctx.rect(this.connecting_pos[0] - 6 + 0.5, this.connecting_pos[1] - 5 + 0.5, 14, 10);
            ctx.fill();
            ctx.beginPath();
            ctx.rect(this.graph_mouse[0] - 6 + 0.5, this.graph_mouse[1] - 5 + 0.5, 14, 10);
          } else {
            ctx.arc(this.connecting_pos[0], this.connecting_pos[1], 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(this.graph_mouse[0], this.graph_mouse[1], 4, 0, Math.PI * 2);
          }
          ctx.fill();
        }
        if (this.dragging_rectangle) {
          ctx.strokeStyle = "#FFF";
          ctx.strokeRect(
            this.dragging_rectangle[0],
            this.dragging_rectangle[1],
            this.dragging_rectangle[2],
            this.dragging_rectangle[3]
          );
        }
        if (this.over_link_center && this.render_link_tooltip) {
          this.drawLinkTooltip(ctx, this.over_link_center);
        } else if (this.onDrawLinkTooltip) {
          this.onDrawLinkTooltip(ctx, null);
        }
        if (this.onDrawForeground) {
          this.onDrawForeground(ctx, this.visible_rect);
        }
        ctx.restore();
      }
      if (this._graph_stack && this._graph_stack.length) {
        this.drawSubgraphPanel(ctx);
      }
      (_c2 = this.onDrawOverlay) == null ? void 0 : _c2.call(this, ctx);
      if (area) {
        ctx.restore();
      }
      if (ctx.finish2D) {
        ctx.finish2D();
      }
    }
    /**
     * draws some useful stats in the corner of the canvas
     * @method renderInfo
     **/
    renderInfo(ctx, x2, y2) {
      x2 = x2 || 10;
      y2 = y2 || (this.canvas ? this.canvas.height - 80 : 0);
      ctx.save();
      ctx.translate(x2, y2);
      ctx.font = "10px Arial";
      ctx.fillStyle = "#888";
      ctx.textAlign = "left";
      if (this.graph) {
        ctx.fillText("T: " + this.graph.globaltime.toFixed(2) + "s", 5, 13 * 1);
        ctx.fillText("I: " + this.graph.iteration, 5, 13 * 2);
        ctx.fillText(
          "N: " + this.graph._nodes.length + " [" + (this.visible_nodes ? this.visible_nodes.length : 0) + "]",
          5,
          13 * 3
        );
        ctx.fillText("V: " + this.graph._version, 5, 13 * 4);
        ctx.fillText("FPS:" + this.fps.toFixed(2), 5, 13 * 5);
      } else {
        ctx.fillText("No graph selected", 5, 13 * 1);
      }
      ctx.restore();
    }
    /**
     * draws the back canvas (the one containing the background and the connections)
     * @method drawBackCanvas
     **/
    drawBackCanvas() {
      var _a2, _b2;
      this.constants();
      const canvas = this.bgcanvas;
      if (!canvas || !this.canvas) {
        return;
      }
      if (canvas.width != this.canvas.width || canvas.height != this.canvas.height) {
        canvas.width = this.canvas.width;
        canvas.height = this.canvas.height;
      }
      if (!this.bgctx) {
        this.bgctx = this.bgcanvas.getContext("2d");
      }
      const ctx = this.bgctx;
      if (!ctx) {
        return;
      }
      if (ctx.start) {
        ctx.start();
      }
      const viewport = this.viewport || [0, 0, ctx.canvas.width, ctx.canvas.height];
      if (this.clear_background) {
        ctx.clearRect(viewport[0], viewport[1], viewport[2], viewport[3]);
      }
      if (this._graph_stack && this._graph_stack.length) {
        ctx.save();
        const subgraph_node = this.graph._subgraph_node;
        ctx.strokeStyle = subgraph_node.bgcolor;
        ctx.lineWidth = 10;
        ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
        ctx.lineWidth = 1;
        ctx.font = "40px Arial";
        ctx.textAlign = "center";
        ctx.fillStyle = subgraph_node.bgcolor || "#AAA";
        let title = "";
        for (let i2 = 1; i2 < this._graph_stack.length; ++i2) {
          title += this._graph_stack[i2]._subgraph_node.getTitle() + " >> ";
        }
        ctx.fillText(title + subgraph_node.getTitle(), canvas.width * 0.5, 40);
        ctx.restore();
      }
      let bg_already_painted = false;
      if (this.onRenderBackground) {
        bg_already_painted = this.onRenderBackground(canvas, ctx);
      }
      if (!this.viewport) {
        ctx.restore();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
      }
      this.visible_links.length = 0;
      if (this.graph) {
        ctx.save();
        this.ds.toCanvasContext(ctx);
        if (this.ds.scale < 1.5 && !bg_already_painted && this.clear_background_color) {
          ctx.fillStyle = this.clear_background_color;
          ctx.fillRect(
            this.visible_area[0],
            this.visible_area[1],
            this.visible_area[2],
            this.visible_area[3]
          );
        }
        if (this.background_image && this.ds.scale > 0.5 && !bg_already_painted) {
          if (this.zoom_modify_alpha) {
            ctx.globalAlpha = (1 - 0.5 / this.ds.scale) * this.editor_alpha;
          } else {
            ctx.globalAlpha = this.editor_alpha;
          }
          ctx.imageSmoothingEnabled = false;
          if (!this._bg_img || this._bg_img.name != this.background_image) {
            this._bg_img = new Image();
            this._bg_img.name = this.background_image;
            this._bg_img.src = this.background_image;
            this._bg_img.onload = () => {
              this.draw(true, true);
            };
          }
          let pattern = null;
          if (this._pattern == null && this._bg_img.width > 0) {
            pattern = ctx.createPattern(this._bg_img, "repeat");
            this._pattern_img = this._bg_img;
            this._pattern = pattern;
          } else {
            pattern = this._pattern;
          }
          if (pattern) {
            ctx.fillStyle = pattern;
            ctx.fillRect(
              this.visible_area[0],
              this.visible_area[1],
              this.visible_area[2],
              this.visible_area[3]
            );
            ctx.fillStyle = "transparent";
          }
          ctx.globalAlpha = 1;
          ctx.imageSmoothingEnabled = true;
        }
        if (((_a2 = this.graph._groups) == null ? void 0 : _a2.length) && !this.live_mode) {
          this.drawGroups(canvas, ctx);
        }
        (_b2 = this.onDrawBackground) == null ? void 0 : _b2.call(this, ctx, this.visible_area);
        if (this.render_canvas_border) {
          ctx.strokeStyle = "#235";
          ctx.strokeRect(0, 0, canvas.width, canvas.height);
        }
        if (this.render_connections_shadows) {
          ctx.shadowColor = "#000";
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;
          ctx.shadowBlur = 6;
        } else {
          ctx.shadowColor = "rgba(0,0,0,0)";
        }
        if (!this.live_mode) {
          this.drawConnections(ctx);
        }
        ctx.shadowColor = "rgba(0,0,0,0)";
        ctx.restore();
      }
      if (ctx.finish) {
        ctx.finish();
      }
      this.dirty_bgcanvas = false;
      this.dirty_canvas = true;
    }
    /**
     * draws the given node inside the canvas
     * @method drawNode
     **/
    drawNode(node2, ctx) {
      const LiteGraph2 = this.constants();
      this.current_node = node2;
      const color = node2.color || node2.constructor.color || LiteGraph2.NODE_DEFAULT_COLOR;
      let bgcolor = node2.bgcolor || node2.constructor.bgcolor || LiteGraph2.NODE_DEFAULT_BGCOLOR;
      if (node2.mouseOver) ;
      const low_quality = this.ds.scale < 0.6;
      if (this.live_mode) {
        if (!node2.flags.collapsed) {
          ctx.shadowColor = "transparent";
          if (node2.onDrawForeground) {
            node2.onDrawForeground(ctx, this, this.canvas);
          }
        }
        return;
      }
      const editor_alpha = this.editor_alpha;
      ctx.globalAlpha = editor_alpha;
      if (this.render_shadows && !low_quality) {
        ctx.shadowColor = LiteGraph2.DEFAULT_SHADOW_COLOR;
        ctx.shadowOffsetX = 2 * this.ds.scale;
        ctx.shadowOffsetY = 2 * this.ds.scale;
        ctx.shadowBlur = 3 * this.ds.scale;
      } else {
        ctx.shadowColor = "transparent";
      }
      if (node2.flags.collapsed && node2.onDrawCollapsed && node2.onDrawCollapsed(ctx, this) == true) {
        return;
      }
      const shape = node2._shape || LiteGraph2.BOX_SHAPE;
      const size = temp_vec2;
      size[0] = node2.size[0];
      size[1] = node2.size[1];
      const horizontal = node2.horizontal;
      if (node2.flags.collapsed) {
        ctx.font = this.inner_text_font;
        const title = node2.getTitle ? node2.getTitle() : node2.title;
        if (title != null) {
          node2._collapsed_width = Math.min(
            node2.size[0],
            ctx.measureText(title).width + LiteGraph2.NODE_TITLE_HEIGHT * 2
          );
          size[0] = node2._collapsed_width;
          size[1] = 0;
        }
      }
      if (node2.clip_area) {
        ctx.save();
        ctx.beginPath();
        if (shape == LiteGraph2.BOX_SHAPE) {
          ctx.rect(0, 0, size[0], size[1]);
        } else if (shape == LiteGraph2.ROUND_SHAPE) {
          ctx.roundRect(0, 0, size[0], size[1], [10]);
        } else if (shape == LiteGraph2.CIRCLE_SHAPE) {
          ctx.arc(size[0] * 0.5, size[1] * 0.5, size[0] * 0.5, 0, Math.PI * 2);
        }
        ctx.clip();
      }
      if (node2.has_errors) {
        bgcolor = "red";
      }
      this.drawNodeShape(
        node2,
        ctx,
        size,
        color,
        bgcolor,
        node2.is_selected,
        node2.mouseOver
      );
      ctx.shadowColor = "transparent";
      if (node2.onDrawForeground) {
        node2.onDrawForeground(ctx, this, this.canvas);
      }
      ctx.textAlign = horizontal ? "center" : "left";
      ctx.font = this.inner_text_font;
      const render_text = !low_quality;
      const out_slot = this.connecting_output;
      const in_slot = this.connecting_input;
      ctx.lineWidth = 1;
      let max_y = 0;
      const slot_pos = new Float32Array(2);
      let slot = null;
      if (!node2.flags.collapsed) {
        if (node2.inputs) {
          for (let i2 = 0; i2 < node2.inputs.length; i2++) {
            slot = node2.inputs[i2];
            const slot_type = slot.type;
            let slot_shape = slot.shape;
            ctx.globalAlpha = editor_alpha;
            if (this.connecting_output && !LiteGraph2.isValidConnection(slot.type, out_slot.type)) {
              ctx.globalAlpha = 0.4 * editor_alpha;
            }
            ctx.fillStyle = slot.link != null ? slot.color_on || this.default_connection_color_byType[slot_type] || this.default_connection_color.input_on : slot.color_off || this.default_connection_color_byTypeOff[slot_type] || this.default_connection_color_byType[slot_type] || this.default_connection_color.input_off;
            const pos2 = node2.getConnectionPos(true, i2, slot_pos);
            pos2[0] -= node2.pos[0];
            pos2[1] -= node2.pos[1];
            if (max_y < pos2[1] + LiteGraph2.NODE_SLOT_HEIGHT * 0.5) {
              max_y = pos2[1] + LiteGraph2.NODE_SLOT_HEIGHT * 0.5;
            }
            ctx.beginPath();
            if (slot_type == "array") {
              slot_shape = LiteGraph2.GRID_SHAPE;
            }
            if (slot.type === LiteGraph2.EVENT || slot.shape === LiteGraph2.BOX_SHAPE) {
              if (horizontal) {
                ctx.rect(pos2[0] - 5 + 0.5, pos2[1] - 8 + 0.5, 10, 14);
              } else {
                ctx.rect(pos2[0] - 6 + 0.5, pos2[1] - 5 + 0.5, 14, 10);
              }
            } else if (slot_shape === LiteGraph2.ARROW_SHAPE) {
              ctx.moveTo(pos2[0] + 8, pos2[1] + 0.5);
              ctx.lineTo(pos2[0] - 4, pos2[1] + 6 + 0.5);
              ctx.lineTo(pos2[0] - 4, pos2[1] - 6 + 0.5);
              ctx.closePath();
            } else if (slot_shape === LiteGraph2.GRID_SHAPE) {
              ctx.rect(pos2[0] - 4, pos2[1] - 4, 2, 2);
              ctx.rect(pos2[0] - 1, pos2[1] - 4, 2, 2);
              ctx.rect(pos2[0] + 2, pos2[1] - 4, 2, 2);
              ctx.rect(pos2[0] - 4, pos2[1] - 1, 2, 2);
              ctx.rect(pos2[0] - 1, pos2[1] - 1, 2, 2);
              ctx.rect(pos2[0] + 2, pos2[1] - 1, 2, 2);
              ctx.rect(pos2[0] - 4, pos2[1] + 2, 2, 2);
              ctx.rect(pos2[0] - 1, pos2[1] + 2, 2, 2);
              ctx.rect(pos2[0] + 2, pos2[1] + 2, 2, 2);
            } else {
              if (low_quality) {
                ctx.rect(pos2[0] - 4, pos2[1] - 4, 8, 8);
              } else {
                ctx.arc(pos2[0], pos2[1], 4, 0, Math.PI * 2);
              }
            }
            ctx.fill();
            if (render_text) {
              const text = slot.label != null ? slot.label : slot.name;
              if (text) {
                ctx.fillStyle = LiteGraph2.NODE_TEXT_COLOR;
                if (horizontal || slot.dir == LiteGraph2.UP) {
                  ctx.fillText(text, pos2[0], pos2[1] - 10);
                } else {
                  ctx.fillText(text, pos2[0] + 10, pos2[1] + 5);
                }
              }
            }
          }
        }
        ctx.textAlign = horizontal ? "center" : "right";
        ctx.strokeStyle = "black";
        if (node2.outputs) {
          for (let i2 = 0; i2 < node2.outputs.length; i2++) {
            slot = node2.outputs[i2];
            const slot_type = slot.type;
            let slot_shape = slot.shape;
            if (this.connecting_input && !LiteGraph2.isValidConnection(slot_type, in_slot.type)) {
              ctx.globalAlpha = 0.4 * editor_alpha;
            }
            const pos2 = node2.getConnectionPos(false, i2, slot_pos);
            pos2[0] -= node2.pos[0];
            pos2[1] -= node2.pos[1];
            if (max_y < pos2[1] + LiteGraph2.NODE_SLOT_HEIGHT * 0.5) {
              max_y = pos2[1] + LiteGraph2.NODE_SLOT_HEIGHT * 0.5;
            }
            ctx.fillStyle = slot.links && slot.links.length ? slot.color_on || this.default_connection_color_byType[slot_type] || this.default_connection_color.output_on : slot.color_off || this.default_connection_color_byTypeOff[slot_type] || this.default_connection_color_byType[slot_type] || this.default_connection_color.output_off;
            ctx.beginPath();
            if (slot_type == "array") {
              slot_shape = LiteGraph2.GRID_SHAPE;
            }
            let doStroke = true;
            if (slot_type === LiteGraph2.EVENT || slot_shape === LiteGraph2.BOX_SHAPE) {
              if (horizontal) {
                ctx.rect(pos2[0] - 5 + 0.5, pos2[1] - 8 + 0.5, 10, 14);
              } else {
                ctx.rect(pos2[0] - 6 + 0.5, pos2[1] - 5 + 0.5, 14, 10);
              }
            } else if (slot_shape === LiteGraph2.ARROW_SHAPE) {
              ctx.moveTo(pos2[0] + 8, pos2[1] + 0.5);
              ctx.lineTo(pos2[0] - 4, pos2[1] + 6 + 0.5);
              ctx.lineTo(pos2[0] - 4, pos2[1] - 6 + 0.5);
              ctx.closePath();
            } else if (slot_shape === LiteGraph2.GRID_SHAPE) {
              ctx.rect(pos2[0] - 4, pos2[1] - 4, 2, 2);
              ctx.rect(pos2[0] - 1, pos2[1] - 4, 2, 2);
              ctx.rect(pos2[0] + 2, pos2[1] - 4, 2, 2);
              ctx.rect(pos2[0] - 4, pos2[1] - 1, 2, 2);
              ctx.rect(pos2[0] - 1, pos2[1] - 1, 2, 2);
              ctx.rect(pos2[0] + 2, pos2[1] - 1, 2, 2);
              ctx.rect(pos2[0] - 4, pos2[1] + 2, 2, 2);
              ctx.rect(pos2[0] - 1, pos2[1] + 2, 2, 2);
              ctx.rect(pos2[0] + 2, pos2[1] + 2, 2, 2);
              doStroke = false;
            } else {
              if (low_quality) {
                ctx.rect(pos2[0] - 4, pos2[1] - 4, 8, 8);
              } else {
                ctx.arc(pos2[0], pos2[1], 4, 0, Math.PI * 2);
              }
            }
            ctx.fill();
            if (!low_quality && doStroke) {
              ctx.stroke();
            }
            if (render_text) {
              const text = slot.label != null ? slot.label : slot.name;
              if (text) {
                ctx.fillStyle = LiteGraph2.NODE_TEXT_COLOR;
                if (horizontal || slot.dir == LiteGraph2.DOWN) {
                  ctx.fillText(text, pos2[0], pos2[1] - 8);
                } else {
                  ctx.fillText(text, pos2[0] - 10, pos2[1] + 5);
                }
              }
            }
          }
        }
        ctx.textAlign = "left";
        ctx.globalAlpha = 1;
        if (node2.widgets) {
          let widgets_y = max_y;
          if (horizontal || node2.widgets_up) {
            widgets_y = 2;
          }
          if (node2.widgets_start_y != null) {
            widgets_y = node2.widgets_start_y;
          }
          this.drawNodeWidgets(
            node2,
            widgets_y,
            ctx,
            this.node_widget && this.node_widget[0] == node2 ? this.node_widget[1] : null
          );
        }
      } else if (this.render_collapsed_slots) {
        let input_slot = null;
        let output_slot = null;
        if (node2.inputs) {
          for (let i2 = 0; i2 < node2.inputs.length; i2++) {
            slot = node2.inputs[i2];
            if (slot.link == null) {
              continue;
            }
            input_slot = slot;
            break;
          }
        }
        if (node2.outputs) {
          for (let i2 = 0; i2 < node2.outputs.length; i2++) {
            slot = node2.outputs[i2];
            if (!slot.links || !slot.links.length) {
              continue;
            }
            output_slot = slot;
          }
        }
        if (input_slot) {
          let x2 = 0;
          let y2 = LiteGraph2.NODE_TITLE_HEIGHT * -0.5;
          if (horizontal) {
            x2 = node2._collapsed_width * 0.5;
            y2 = -LiteGraph2.NODE_TITLE_HEIGHT;
          }
          ctx.fillStyle = "#686";
          ctx.beginPath();
          if (slot.type === LiteGraph2.EVENT || slot.shape === LiteGraph2.BOX_SHAPE) {
            ctx.rect(x2 - 7 + 0.5, y2 - 4, 14, 8);
          } else if (slot.shape === LiteGraph2.ARROW_SHAPE) {
            ctx.moveTo(x2 + 8, y2);
            ctx.lineTo(x2 + -4, y2 - 4);
            ctx.lineTo(x2 + -4, y2 + 4);
            ctx.closePath();
          } else {
            ctx.arc(x2, y2, 4, 0, Math.PI * 2);
          }
          ctx.fill();
        }
        if (output_slot) {
          let x2 = node2._collapsed_width;
          let y2 = LiteGraph2.NODE_TITLE_HEIGHT * -0.5;
          if (horizontal) {
            x2 = node2._collapsed_width * 0.5;
            y2 = 0;
          }
          ctx.fillStyle = "#686";
          ctx.strokeStyle = "black";
          ctx.beginPath();
          if (slot.type === LiteGraph2.EVENT || slot.shape === LiteGraph2.BOX_SHAPE) {
            ctx.rect(x2 - 7 + 0.5, y2 - 4, 14, 8);
          } else if (slot.shape === LiteGraph2.ARROW_SHAPE) {
            ctx.moveTo(x2 + 6, y2);
            ctx.lineTo(x2 - 6, y2 - 4);
            ctx.lineTo(x2 - 6, y2 + 4);
            ctx.closePath();
          } else {
            ctx.arc(x2, y2, 4, 0, Math.PI * 2);
          }
          ctx.fill();
        }
      }
      if (node2.clip_area) {
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }
    // used by this.over_link_center
    drawLinkTooltip(ctx, link) {
      const pos2 = link._pos;
      ctx.fillStyle = "black";
      ctx.beginPath();
      ctx.arc(pos2[0], pos2[1], 3, 0, Math.PI * 2);
      ctx.fill();
      if (link.data == null) {
        return;
      }
      if (this.onDrawLinkTooltip && this.onDrawLinkTooltip(ctx, link, this) == true) {
        return;
      }
      const data = link.data;
      let text = null;
      if (data.constructor === Number) {
        text = data.toFixed(2);
      } else if (data.constructor === String) {
        text = '"' + data + '"';
      } else if (data.constructor === Boolean) {
        text = String(data);
      } else if (data.toToolTip) {
        text = data.toToolTip();
      } else {
        text = "[" + data.constructor.name + "]";
      }
      if (text == null) {
        return;
      }
      text = text.substr(0, 30);
      ctx.font = "14px Courier New";
      const info = ctx.measureText(text);
      const w2 = info.width + 20;
      const h = 24;
      ctx.shadowColor = "black";
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;
      ctx.shadowBlur = 3;
      ctx.fillStyle = "#454";
      ctx.beginPath();
      ctx.roundRect(pos2[0] - w2 * 0.5, pos2[1] - 15 - h, w2, h, [3]);
      ctx.moveTo(pos2[0] - 10, pos2[1] - 15);
      ctx.lineTo(pos2[0] + 10, pos2[1] - 15);
      ctx.lineTo(pos2[0], pos2[1] - 5);
      ctx.fill();
      ctx.shadowColor = "transparent";
      ctx.textAlign = "center";
      ctx.fillStyle = "#CEC";
      ctx.fillText(text, pos2[0], pos2[1] - 15 - h * 0.3);
    }
    drawSlotGraphic(ctx, pos2, shape, _horizontal) {
      const LiteGraph2 = this.constants();
      if (shape === LiteGraph2.GRID_SHAPE) {
        ctx.rect(pos2[0] - 4, pos2[1] - 4, 2, 2);
        ctx.rect(pos2[0] - 1, pos2[1] - 4, 2, 2);
        ctx.rect(pos2[0] + 2, pos2[1] - 4, 2, 2);
        ctx.rect(pos2[0] - 4, pos2[1] - 1, 2, 2);
        ctx.rect(pos2[0] - 1, pos2[1] - 1, 2, 2);
        ctx.rect(pos2[0] + 2, pos2[1] - 1, 2, 2);
        ctx.rect(pos2[0] - 4, pos2[1] + 2, 2, 2);
        ctx.rect(pos2[0] - 1, pos2[1] + 2, 2, 2);
        ctx.rect(pos2[0] + 2, pos2[1] + 2, 2, 2);
        return;
      }
      ctx.arc(pos2[0], pos2[1], 4, 0, Math.PI * 2);
    }
    /**
     * draws the shape of the given node in the canvas
     * @method drawNodeShape
     **/
    drawNodeShape(node2, ctx, size, fgcolor, bgcolor, selected, mouse_over) {
      const LiteGraph2 = this.constants();
      ctx.strokeStyle = fgcolor;
      ctx.fillStyle = bgcolor;
      const title_height = LiteGraph2.NODE_TITLE_HEIGHT;
      const low_quality = this.ds.scale < 0.5;
      const shape = node2._shape || node2.constructor.shape || LiteGraph2.ROUND_SHAPE;
      const title_mode = node2.constructor.title_mode;
      let render_title = true;
      if (title_mode == LiteGraph2.TRANSPARENT_TITLE || title_mode == LiteGraph2.NO_TITLE) {
        render_title = false;
      } else if (title_mode == LiteGraph2.AUTOHIDE_TITLE && mouse_over) {
        render_title = true;
      }
      const area = tmp_area;
      area[0] = 0;
      area[1] = render_title ? -title_height : 0;
      area[2] = size[0] + 1;
      area[3] = render_title ? size[1] + title_height : size[1];
      const old_alpha = ctx.globalAlpha;
      {
        ctx.beginPath();
        if (shape == LiteGraph2.BOX_SHAPE || low_quality) {
          ctx.fillRect(area[0], area[1], area[2], area[3]);
        } else if (shape == LiteGraph2.ROUND_SHAPE || shape == LiteGraph2.CARD_SHAPE) {
          ctx.roundRect(
            area[0],
            area[1],
            area[2],
            area[3],
            shape == LiteGraph2.CARD_SHAPE ? [this.round_radius, this.round_radius, 0, 0] : [this.round_radius]
          );
        } else if (shape == LiteGraph2.CIRCLE_SHAPE) {
          ctx.arc(
            size[0] * 0.5,
            size[1] * 0.5,
            size[0] * 0.5,
            0,
            Math.PI * 2
          );
        }
        ctx.fill();
        if (!node2.flags.collapsed && render_title) {
          ctx.shadowColor = "transparent";
          ctx.fillStyle = "rgba(0,0,0,0.2)";
          ctx.fillRect(0, -1, area[2], 2);
        }
      }
      ctx.shadowColor = "transparent";
      if (node2.onDrawBackground) {
        node2.onDrawBackground(ctx, this, this.canvas, this.graph_mouse);
      }
      if (render_title || title_mode == LiteGraph2.TRANSPARENT_TITLE) {
        if (node2.onDrawTitleBar) {
          node2.onDrawTitleBar(ctx, title_height, size, this.ds.scale, fgcolor);
        } else if (title_mode != LiteGraph2.TRANSPARENT_TITLE && (node2.constructor.title_color || this.render_title_colored)) {
          const title_color = node2.constructor.title_color || fgcolor;
          if (node2.flags.collapsed) {
            ctx.shadowColor = LiteGraph2.DEFAULT_SHADOW_COLOR;
          }
          if (this.use_gradients) {
            const hostClass = this.constructor;
            let grad = hostClass.gradients[title_color];
            if (!grad) {
              grad = ctx.createLinearGradient(0, 0, 400, 0);
              try {
                grad.addColorStop(0, title_color);
                grad.addColorStop(1, "#000");
                hostClass.gradients[title_color] = grad;
              } catch (err) {
                const fallback_color = fgcolor || LiteGraph2.NODE_DEFAULT_COLOR || "#888";
                grad = hostClass.gradients[fallback_color];
                if (!grad) {
                  grad = ctx.createLinearGradient(0, 0, 400, 0);
                  grad.addColorStop(0, fallback_color);
                  grad.addColorStop(1, "#000");
                  hostClass.gradients[fallback_color] = grad;
                }
                hostClass.gradients[title_color] = grad;
              }
            }
            ctx.fillStyle = grad;
          } else {
            ctx.fillStyle = title_color;
          }
          ctx.beginPath();
          if (shape == LiteGraph2.BOX_SHAPE || low_quality) {
            ctx.rect(0, -title_height, size[0] + 1, title_height);
          } else if (shape == LiteGraph2.ROUND_SHAPE || shape == LiteGraph2.CARD_SHAPE) {
            ctx.roundRect(
              0,
              -title_height,
              size[0] + 1,
              title_height,
              node2.flags.collapsed ? [this.round_radius] : [this.round_radius, this.round_radius, 0, 0]
            );
          }
          ctx.fill();
          ctx.shadowColor = "transparent";
        }
        let colState = false;
        if (LiteGraph2.node_box_coloured_by_mode) {
          if (LiteGraph2.NODE_MODES_COLORS[node2.mode]) {
            colState = LiteGraph2.NODE_MODES_COLORS[node2.mode];
          }
        }
        if (LiteGraph2.node_box_coloured_when_on) {
          colState = node2.action_triggered ? "#FFF" : node2.execute_triggered ? "#AAA" : colState;
        }
        const box_size = 10;
        if (node2.onDrawTitleBox) {
          node2.onDrawTitleBox(ctx, title_height, size, this.ds.scale);
        } else if (shape == LiteGraph2.ROUND_SHAPE || shape == LiteGraph2.CIRCLE_SHAPE || shape == LiteGraph2.CARD_SHAPE) {
          if (low_quality) {
            ctx.fillStyle = "black";
            ctx.beginPath();
            ctx.arc(
              title_height * 0.5,
              title_height * -0.5,
              box_size * 0.5 + 1,
              0,
              Math.PI * 2
            );
            ctx.fill();
          }
          ctx.fillStyle = node2.boxcolor || colState || LiteGraph2.NODE_DEFAULT_BOXCOLOR;
          if (low_quality) {
            ctx.fillRect(
              title_height * 0.5 - box_size * 0.5,
              title_height * -0.5 - box_size * 0.5,
              box_size,
              box_size
            );
          } else {
            ctx.beginPath();
            ctx.arc(
              title_height * 0.5,
              title_height * -0.5,
              box_size * 0.5,
              0,
              Math.PI * 2
            );
            ctx.fill();
          }
        } else {
          if (low_quality) {
            ctx.fillStyle = "black";
            ctx.fillRect(
              (title_height - box_size) * 0.5 - 1,
              (title_height + box_size) * -0.5 - 1,
              box_size + 2,
              box_size + 2
            );
          }
          ctx.fillStyle = node2.boxcolor || colState || LiteGraph2.NODE_DEFAULT_BOXCOLOR;
          ctx.fillRect(
            (title_height - box_size) * 0.5,
            (title_height + box_size) * -0.5,
            box_size,
            box_size
          );
        }
        ctx.globalAlpha = old_alpha;
        if (node2.onDrawTitleText) {
          node2.onDrawTitleText(
            ctx,
            title_height,
            size,
            this.ds.scale,
            this.title_text_font,
            selected
          );
        }
        if (!low_quality) {
          ctx.font = this.title_text_font;
          const title = String(node2.getTitle());
          if (title) {
            if (selected) {
              ctx.fillStyle = LiteGraph2.NODE_SELECTED_TITLE_COLOR;
            } else {
              ctx.fillStyle = node2.constructor.title_text_color || this.node_title_color;
            }
            if (node2.flags.collapsed) {
              ctx.textAlign = "left";
              ctx.measureText(title);
              ctx.fillText(
                title.substr(0, 20),
                title_height,
                LiteGraph2.NODE_TITLE_TEXT_Y - title_height
              );
              ctx.textAlign = "left";
            } else {
              ctx.textAlign = "left";
              ctx.fillText(
                title,
                title_height,
                LiteGraph2.NODE_TITLE_TEXT_Y - title_height
              );
            }
          }
        }
        if (!node2.flags.collapsed && node2.subgraph && !node2.skip_subgraph_button) {
          const w2 = LiteGraph2.NODE_TITLE_HEIGHT;
          const x2 = node2.size[0] - w2;
          const over = LiteGraph2.isInsideRectangle(
            this.graph_mouse[0] - node2.pos[0],
            this.graph_mouse[1] - node2.pos[1],
            x2 + 2,
            -w2 + 2,
            w2 - 4,
            w2 - 4
          );
          ctx.fillStyle = over ? "#888" : "#555";
          if (shape == LiteGraph2.BOX_SHAPE || low_quality) {
            ctx.fillRect(x2 + 2, -w2 + 2, w2 - 4, w2 - 4);
          } else {
            ctx.beginPath();
            ctx.roundRect(x2 + 2, -w2 + 2, w2 - 4, w2 - 4, [4]);
            ctx.fill();
          }
          ctx.fillStyle = "#333";
          ctx.beginPath();
          ctx.moveTo(x2 + w2 * 0.2, -w2 * 0.6);
          ctx.lineTo(x2 + w2 * 0.8, -w2 * 0.6);
          ctx.lineTo(x2 + w2 * 0.5, -w2 * 0.3);
          ctx.fill();
        }
        if (node2.onDrawTitle) {
          node2.onDrawTitle(ctx);
        }
      }
      if (selected) {
        if (node2.onBounding) {
          node2.onBounding(area);
        }
        if (title_mode == LiteGraph2.TRANSPARENT_TITLE) {
          area[1] -= title_height;
          area[3] += title_height;
        }
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        if (shape == LiteGraph2.BOX_SHAPE) {
          ctx.rect(
            -6 + area[0],
            -6 + area[1],
            12 + area[2],
            12 + area[3]
          );
        } else if (shape == LiteGraph2.ROUND_SHAPE || shape == LiteGraph2.CARD_SHAPE && node2.flags.collapsed) {
          ctx.roundRect(
            -6 + area[0],
            -6 + area[1],
            12 + area[2],
            12 + area[3],
            [this.round_radius * 2]
          );
        } else if (shape == LiteGraph2.CARD_SHAPE) {
          ctx.roundRect(
            -6 + area[0],
            -6 + area[1],
            12 + area[2],
            12 + area[3],
            [this.round_radius * 2, 2, this.round_radius * 2, 2]
          );
        } else if (shape == LiteGraph2.CIRCLE_SHAPE) {
          ctx.arc(
            size[0] * 0.5,
            size[1] * 0.5,
            size[0] * 0.5 + 6,
            0,
            Math.PI * 2
          );
        }
        ctx.strokeStyle = LiteGraph2.NODE_BOX_OUTLINE_COLOR;
        ctx.stroke();
        ctx.strokeStyle = fgcolor;
        ctx.globalAlpha = 1;
      }
      if (node2.execute_triggered > 0) {
        node2.execute_triggered--;
      }
      if (node2.action_triggered > 0) {
        node2.action_triggered--;
      }
    }
    /**
     * draws every connection visible in the canvas
     * @method drawConnections
     **/
    drawConnections(ctx) {
      const LiteGraph2 = this.constants();
      const now = LiteGraph2.getTime();
      const visible_area = this.visible_area;
      margin_area[0] = visible_area[0] - 20;
      margin_area[1] = visible_area[1] - 20;
      margin_area[2] = visible_area[2] + 40;
      margin_area[3] = visible_area[3] + 40;
      ctx.lineWidth = this.connections_width;
      ctx.fillStyle = "#AAA";
      ctx.strokeStyle = "#AAA";
      ctx.globalAlpha = this.editor_alpha;
      const nodes = this.graph._nodes;
      for (let n = 0, l = nodes.length; n < l; ++n) {
        const node2 = nodes[n];
        if (!node2.inputs || !node2.inputs.length) {
          continue;
        }
        for (let i2 = 0; i2 < node2.inputs.length; ++i2) {
          const input = node2.inputs[i2];
          if (!input || input.link == null) {
            continue;
          }
          const link = this.graph.links[input.link];
          if (!link) {
            continue;
          }
          const start_node = this.graph.getNodeById(link.origin_id);
          if (!start_node) {
            continue;
          }
          const start_node_slot = link.origin_slot;
          const start_node_slotpos = start_node_slot == -1 ? [start_node.pos[0] + 10, start_node.pos[1] + 10] : start_node.getConnectionPos(false, start_node_slot, tempA);
          const end_node_slotpos = node2.getConnectionPos(true, i2, tempB);
          link_bounding[0] = start_node_slotpos[0];
          link_bounding[1] = start_node_slotpos[1];
          link_bounding[2] = end_node_slotpos[0] - start_node_slotpos[0];
          link_bounding[3] = end_node_slotpos[1] - start_node_slotpos[1];
          if (link_bounding[2] < 0) {
            link_bounding[0] += link_bounding[2];
            link_bounding[2] = Math.abs(link_bounding[2]);
          }
          if (link_bounding[3] < 0) {
            link_bounding[1] += link_bounding[3];
            link_bounding[3] = Math.abs(link_bounding[3]);
          }
          if (!overlapBounding(link_bounding, margin_area)) {
            continue;
          }
          const start_slot = start_node.outputs[start_node_slot];
          const end_slot = node2.inputs[i2];
          if (!start_slot || !end_slot) {
            continue;
          }
          const start_dir = start_slot.dir || (start_node.horizontal ? LiteGraph2.DOWN : LiteGraph2.RIGHT);
          const end_dir = end_slot.dir || (node2.horizontal ? LiteGraph2.UP : LiteGraph2.LEFT);
          this.renderLink(
            ctx,
            start_node_slotpos,
            end_node_slotpos,
            link,
            false,
            0,
            null,
            start_dir,
            end_dir
          );
          if (link._last_time && now - link._last_time < 1e3) {
            const f = 2 - (now - link._last_time) * 2e-3;
            const tmp = ctx.globalAlpha;
            ctx.globalAlpha = tmp * f;
            this.renderLink(
              ctx,
              start_node_slotpos,
              end_node_slotpos,
              link,
              true,
              f,
              "white",
              start_dir,
              end_dir
            );
            ctx.globalAlpha = tmp;
          }
        }
      }
      ctx.globalAlpha = 1;
    }
    /**
     * draws a link between two points
     * @method renderLink
     **/
    renderLink(ctx, a, b, link, skip_border, flow, color, start_dir, end_dir, num_sublines) {
      var _a2;
      const LiteGraph2 = this.constants();
      if (link) {
        this.visible_links.push(link);
      }
      if (!color && link) {
        color = link.color || ((_a2 = this.constructor.link_type_colors) == null ? void 0 : _a2[link.type]);
      }
      if (!color) {
        color = this.default_link_color;
      }
      if (link != null && this.highlighted_links[link.id]) {
        color = "#FFF";
      }
      start_dir = start_dir || LiteGraph2.RIGHT;
      end_dir = end_dir || LiteGraph2.LEFT;
      const dist = distance(a, b);
      if (this.render_connections_border && this.ds.scale > 0.6) {
        ctx.lineWidth = this.connections_width + 4;
      }
      ctx.lineJoin = "round";
      num_sublines = num_sublines || 1;
      if (num_sublines > 1) {
        ctx.lineWidth = 0.5;
      }
      ctx.beginPath();
      for (let i2 = 0; i2 < num_sublines; i2 += 1) {
        const offsety = (i2 - (num_sublines - 1) * 0.5) * 5;
        ctx.moveTo(a[0], a[1] + offsety);
        const start_offset_x = start_dir == LiteGraph2.LEFT ? dist * -0.25 : start_dir == LiteGraph2.RIGHT ? dist * 0.25 : 0;
        const start_offset_y = start_dir == LiteGraph2.UP ? dist * -0.25 : start_dir == LiteGraph2.DOWN ? dist * 0.25 : 0;
        const end_offset_x = end_dir == LiteGraph2.LEFT ? dist * -0.25 : end_dir == LiteGraph2.RIGHT ? dist * 0.25 : 0;
        const end_offset_y = end_dir == LiteGraph2.UP ? dist * -0.25 : end_dir == LiteGraph2.DOWN ? dist * 0.25 : 0;
        if (this.links_render_mode == LiteGraph2.LINEAR_LINK) {
          const l = 15;
          ctx.lineTo(a[0] + Math.sign(start_offset_x || 1) * l, a[1] + Math.sign(start_offset_y || 1) * l + offsety);
          ctx.lineTo(b[0] + Math.sign(end_offset_x || 1) * l, b[1] + Math.sign(end_offset_y || 1) * l + offsety);
          ctx.lineTo(b[0], b[1] + offsety);
        } else {
          ctx.bezierCurveTo(
            a[0] + start_offset_x,
            a[1] + start_offset_y + offsety,
            b[0] + end_offset_x,
            b[1] + end_offset_y + offsety,
            b[0],
            b[1] + offsety
          );
        }
      }
      if (this.render_connections_border && this.ds.scale > 0.6 && !skip_border) {
        ctx.strokeStyle = "rgba(0,0,0,0.5)";
        ctx.stroke();
      }
      ctx.lineWidth = this.connections_width;
      ctx.fillStyle = ctx.strokeStyle = color;
      ctx.stroke();
      const pos2 = this.computeConnectionPoint(a, b, 0.5, start_dir, end_dir);
      if (link && link._pos) {
        link._pos[0] = pos2[0];
        link._pos[1] = pos2[1];
      }
      if (flow) {
        ctx.fillStyle = color;
        for (let i2 = 0; i2 < 5; ++i2) {
          const f = (LiteGraph2.getTime() * 1e-3 + i2 * 0.2) % 1;
          const p = this.computeConnectionPoint(a, b, f, start_dir, end_dir);
          ctx.beginPath();
          ctx.arc(p[0], p[1], 5, 0, 2 * Math.PI);
          ctx.fill();
        }
      }
    }
    computeConnectionPoint(a, b, t, start_dir, end_dir) {
      const LiteGraph2 = this.constants();
      start_dir = start_dir || LiteGraph2.RIGHT;
      end_dir = end_dir || LiteGraph2.LEFT;
      const dist = distance(a, b);
      const p0 = a;
      const p1 = [a[0], a[1]];
      const p2 = [b[0], b[1]];
      const p3 = b;
      if (start_dir == LiteGraph2.LEFT) p1[0] += dist * -0.25;
      if (start_dir == LiteGraph2.RIGHT) p1[0] += dist * 0.25;
      if (start_dir == LiteGraph2.UP) p1[1] += dist * -0.25;
      if (start_dir == LiteGraph2.DOWN) p1[1] += dist * 0.25;
      if (end_dir == LiteGraph2.LEFT) p2[0] += dist * -0.25;
      if (end_dir == LiteGraph2.RIGHT) p2[0] += dist * 0.25;
      if (end_dir == LiteGraph2.UP) p2[1] += dist * -0.25;
      if (end_dir == LiteGraph2.DOWN) p2[1] += dist * 0.25;
      const c1 = (1 - t) * (1 - t) * (1 - t);
      const c2 = 3 * ((1 - t) * (1 - t)) * t;
      const c3 = 3 * (1 - t) * (t * t);
      const c4 = t * t * t;
      temp_point[0] = c1 * p0[0] + c2 * p1[0] + c3 * p2[0] + c4 * p3[0];
      temp_point[1] = c1 * p0[1] + c2 * p1[1] + c3 * p2[1] + c4 * p3[1];
      return temp_point;
    }
    drawExecutionOrder(ctx) {
      const LiteGraph2 = this.constants();
      ctx.shadowColor = "transparent";
      ctx.globalAlpha = 0.25;
      ctx.textAlign = "center";
      ctx.strokeStyle = "white";
      ctx.globalAlpha = 0.75;
      const visible_nodes = this.visible_nodes || [];
      for (let i2 = 0; i2 < visible_nodes.length; ++i2) {
        const node2 = visible_nodes[i2];
        ctx.fillStyle = "black";
        ctx.fillRect(
          node2.pos[0] - LiteGraph2.NODE_TITLE_HEIGHT,
          node2.pos[1] - LiteGraph2.NODE_TITLE_HEIGHT,
          LiteGraph2.NODE_TITLE_HEIGHT,
          LiteGraph2.NODE_TITLE_HEIGHT
        );
        if (node2.order == 0) {
          ctx.strokeRect(
            node2.pos[0] - LiteGraph2.NODE_TITLE_HEIGHT + 0.5,
            node2.pos[1] - LiteGraph2.NODE_TITLE_HEIGHT + 0.5,
            LiteGraph2.NODE_TITLE_HEIGHT,
            LiteGraph2.NODE_TITLE_HEIGHT
          );
        }
        ctx.fillStyle = "#FFF";
        ctx.fillText(node2.order, node2.pos[0] + LiteGraph2.NODE_TITLE_HEIGHT * -0.5, node2.pos[1] - 6);
      }
      ctx.globalAlpha = 1;
    }
    drawNodeWidgets(node2, posY, ctx, active_widget2) {
      const LiteGraph2 = this.constants();
      if (!node2.widgets || !node2.widgets.length) {
        return;
      }
      const width2 = node2.size[0];
      const widgets = node2.widgets;
      posY += 2;
      const H = LiteGraph2.NODE_WIDGET_HEIGHT;
      const show_text = this.ds.scale > 0.5;
      ctx.save();
      ctx.globalAlpha = this.editor_alpha;
      const outline_color = LiteGraph2.WIDGET_OUTLINE_COLOR;
      const background_color = LiteGraph2.WIDGET_BGCOLOR;
      const text_color = LiteGraph2.WIDGET_TEXT_COLOR;
      const secondary_text_color = LiteGraph2.WIDGET_SECONDARY_TEXT_COLOR;
      const margin = 15;
      for (let i2 = 0; i2 < widgets.length; ++i2) {
        const w2 = widgets[i2];
        let y2 = posY;
        if (w2.y) {
          y2 = w2.y;
        }
        w2.last_y = y2;
        ctx.strokeStyle = outline_color;
        ctx.fillStyle = "#222";
        ctx.textAlign = "left";
        if (w2.disabled) {
          ctx.globalAlpha *= 0.5;
        }
        const widget_width2 = w2.width || width2;
        switch (w2.type) {
          case "button":
            if (w2.clicked) {
              ctx.fillStyle = "#AAA";
              w2.clicked = false;
              this.dirty_canvas = true;
            }
            ctx.fillRect(margin, y2, widget_width2 - margin * 2, H);
            if (show_text && !w2.disabled) {
              ctx.strokeRect(margin, y2, widget_width2 - margin * 2, H);
            }
            if (show_text) {
              ctx.textAlign = "center";
              ctx.fillStyle = text_color;
              ctx.fillText(w2.label || w2.name, widget_width2 * 0.5, y2 + H * 0.7);
            }
            break;
          case "toggle":
            ctx.textAlign = "left";
            ctx.strokeStyle = outline_color;
            ctx.fillStyle = background_color;
            ctx.beginPath();
            if (show_text) {
              ctx.roundRect(margin, y2, widget_width2 - margin * 2, H, [H * 0.5]);
            } else {
              ctx.rect(margin, y2, widget_width2 - margin * 2, H);
            }
            ctx.fill();
            if (show_text && !w2.disabled) {
              ctx.stroke();
            }
            ctx.fillStyle = w2.value ? "#89A" : "#333";
            ctx.beginPath();
            ctx.arc(widget_width2 - margin * 2, y2 + H * 0.5, H * 0.36, 0, Math.PI * 2);
            ctx.fill();
            if (show_text) {
              ctx.fillStyle = secondary_text_color;
              const label = w2.label || w2.name;
              if (label != null) {
                ctx.fillText(label, margin * 2, y2 + H * 0.7);
              }
              ctx.fillStyle = w2.value ? text_color : secondary_text_color;
              ctx.textAlign = "right";
              ctx.fillText(
                w2.value ? w2.options.on || "true" : w2.options.off || "false",
                widget_width2 - 40,
                y2 + H * 0.7
              );
            }
            break;
          case "slider": {
            ctx.fillStyle = background_color;
            ctx.fillRect(margin, y2, widget_width2 - margin * 2, H);
            const range = w2.options.max - w2.options.min;
            let nvalue = (w2.value - w2.options.min) / range;
            if (nvalue < 0) nvalue = 0;
            if (nvalue > 1) nvalue = 1;
            ctx.fillStyle = w2.options.hasOwnProperty("slider_color") ? w2.options.slider_color : active_widget2 == w2 ? "#89A" : "#678";
            ctx.fillRect(margin, y2, nvalue * (widget_width2 - margin * 2), H);
            if (show_text && !w2.disabled) {
              ctx.strokeRect(margin, y2, widget_width2 - margin * 2, H);
            }
            if (w2.marker) {
              let marker_nvalue = (w2.marker - w2.options.min) / range;
              if (marker_nvalue < 0) marker_nvalue = 0;
              if (marker_nvalue > 1) marker_nvalue = 1;
              ctx.fillStyle = w2.options.hasOwnProperty("marker_color") ? w2.options.marker_color : "#AA9";
              ctx.fillRect(margin + marker_nvalue * (widget_width2 - margin * 2), y2, 2, H);
            }
            if (show_text) {
              ctx.textAlign = "center";
              ctx.fillStyle = text_color;
              ctx.fillText(
                w2.label || w2.name + "  " + Number(w2.value).toFixed(
                  w2.options.precision != null ? w2.options.precision : 3
                ),
                widget_width2 * 0.5,
                y2 + H * 0.7
              );
            }
            break;
          }
          case "number":
          case "combo":
            ctx.textAlign = "left";
            ctx.strokeStyle = outline_color;
            ctx.fillStyle = background_color;
            ctx.beginPath();
            if (show_text) {
              ctx.roundRect(margin, y2, widget_width2 - margin * 2, H, [H * 0.5]);
            } else {
              ctx.rect(margin, y2, widget_width2 - margin * 2, H);
            }
            ctx.fill();
            if (show_text) {
              if (!w2.disabled) {
                ctx.stroke();
              }
              ctx.fillStyle = text_color;
              if (!w2.disabled) {
                ctx.beginPath();
                ctx.moveTo(margin + 16, y2 + 5);
                ctx.lineTo(margin + 6, y2 + H * 0.5);
                ctx.lineTo(margin + 16, y2 + H - 5);
                ctx.fill();
                ctx.beginPath();
                ctx.moveTo(widget_width2 - margin - 16, y2 + 5);
                ctx.lineTo(widget_width2 - margin - 6, y2 + H * 0.5);
                ctx.lineTo(widget_width2 - margin - 16, y2 + H - 5);
                ctx.fill();
              }
              ctx.fillStyle = secondary_text_color;
              ctx.fillText(w2.label || w2.name, margin * 2 + 5, y2 + H * 0.7);
              ctx.fillStyle = text_color;
              ctx.textAlign = "right";
              if (w2.type == "number") {
                ctx.fillText(
                  Number(w2.value).toFixed(
                    w2.options.precision !== void 0 ? w2.options.precision : 3
                  ),
                  widget_width2 - margin * 2 - 20,
                  y2 + H * 0.7
                );
              } else {
                let v2 = w2.value;
                if (w2.options.values) {
                  let values = w2.options.values;
                  if (values.constructor === Function) {
                    values = values();
                  }
                  if (values && values.constructor !== Array) {
                    v2 = values[w2.value];
                  }
                }
                ctx.fillText(v2, widget_width2 - margin * 2 - 20, y2 + H * 0.7);
              }
            }
            break;
          case "string":
          case "text":
            ctx.textAlign = "left";
            ctx.strokeStyle = outline_color;
            ctx.fillStyle = background_color;
            ctx.beginPath();
            if (show_text) {
              ctx.roundRect(margin, y2, widget_width2 - margin * 2, H, [H * 0.5]);
            } else {
              ctx.rect(margin, y2, widget_width2 - margin * 2, H);
            }
            ctx.fill();
            if (show_text) {
              if (!w2.disabled) {
                ctx.stroke();
              }
              ctx.save();
              ctx.beginPath();
              ctx.rect(margin, y2, widget_width2 - margin * 2, H);
              ctx.clip();
              ctx.fillStyle = secondary_text_color;
              const label = w2.label || w2.name;
              if (label != null) {
                ctx.fillText(label, margin * 2, y2 + H * 0.7);
              }
              ctx.fillStyle = text_color;
              ctx.textAlign = "right";
              ctx.fillText(String(w2.value).substr(0, 30), widget_width2 - margin * 2, y2 + H * 0.7);
              ctx.restore();
            }
            break;
          default:
            if (w2.draw) {
              w2.draw(ctx, node2, widget_width2, y2, H);
            }
            break;
        }
        posY += (w2.computeSize ? w2.computeSize(widget_width2)[1] : H) + 4;
        ctx.globalAlpha = this.editor_alpha;
      }
      ctx.restore();
      ctx.textAlign = "left";
    }
    processNodeWidgets(node, pos, event, active_widget) {
      const LiteGraph = this.constants();
      if (!node.widgets || !node.widgets.length || !this.allow_interaction && !node.flags.allow_interaction) {
        return null;
      }
      const x = pos[0] - node.pos[0];
      const y = pos[1] - node.pos[1];
      const width = node.size[0];
      const deltaX = event.deltaX || event.deltax || 0;
      const that = this;
      const ref_window = this.getCanvasWindow();
      for (let i = 0; i < node.widgets.length; ++i) {
        const w = node.widgets[i];
        if (!w || w.disabled) {
          continue;
        }
        const widget_height = w.computeSize ? w.computeSize(width)[1] : LiteGraph.NODE_WIDGET_HEIGHT;
        const widget_width = w.width || width;
        if (w != active_widget && (x < 6 || x > widget_width - 12 || y < w.last_y || y > w.last_y + widget_height || w.last_y === void 0)) {
          continue;
        }
        const old_value = w.value;
        switch (w.type) {
          case "button":
            if (event.type === LiteGraph.pointerevents_method + "down") {
              if (w.callback) {
                setTimeout(function() {
                  w.callback(w, that, node, pos, event);
                }, 20);
              }
              w.clicked = true;
              this.dirty_canvas = true;
            }
            break;
          case "slider": {
            const nvalue = clamp((x - 15) / (widget_width - 30), 0, 1);
            if (w.options.read_only) break;
            w.value = w.options.min + (w.options.max - w.options.min) * nvalue;
            if (old_value != w.value) {
              setTimeout(function() {
                inner_value_change(w, w.value);
              }, 20);
            }
            this.dirty_canvas = true;
            break;
          }
          case "number":
          case "combo":
            if (event.type == LiteGraph.pointerevents_method + "move" && w.type == "number") {
              if (deltaX) {
                w.value += deltaX * 0.1 * (w.options.step || 1);
              }
              if (w.options.min != null && w.value < w.options.min) {
                w.value = w.options.min;
              }
              if (w.options.max != null && w.value > w.options.max) {
                w.value = w.options.max;
              }
            } else if (event.type == LiteGraph.pointerevents_method + "down") {
              let values = w.options.values;
              if (values && values.constructor === Function) {
                values = w.options.values(w, node);
              }
              let values_list = null;
              if (w.type != "number") {
                values_list = values.constructor === Array ? values : Object.keys(values);
              }
              const delta2 = x < 40 ? -1 : x > widget_width - 40 ? 1 : 0;
              if (w.type == "number") {
                w.value += delta2 * 0.1 * (w.options.step || 1);
                if (w.options.min != null && w.value < w.options.min) {
                  w.value = w.options.min;
                }
                if (w.options.max != null && w.value > w.options.max) {
                  w.value = w.options.max;
                }
              } else if (delta2) {
                let index = -1;
                this.last_mouseclick = 0;
                if (values.constructor === Object) {
                  index = values_list.indexOf(String(w.value)) + delta2;
                } else {
                  index = values_list.indexOf(w.value) + delta2;
                }
                if (index >= values_list.length) {
                  index = values_list.length - 1;
                }
                if (index < 0) {
                  index = 0;
                }
                if (values.constructor === Array) {
                  w.value = values[index];
                } else {
                  w.value = index;
                }
              } else {
                const text_values = values != values_list ? Object.values(values) : values;
                const inner_clicked = function(v2) {
                  if (values != values_list) {
                    v2 = text_values.indexOf(v2);
                  }
                  this.value = v2;
                  inner_value_change(this, v2);
                  that.dirty_canvas = true;
                  return false;
                };
                new LiteGraph.ContextMenu(
                  text_values,
                  {
                    scale: Math.max(1, this.ds.scale),
                    event,
                    className: "dark",
                    callback: inner_clicked.bind(w)
                  },
                  ref_window
                );
              }
            } else if (event.type == LiteGraph.pointerevents_method + "up" && w.type == "number") {
              const delta = x < 40 ? -1 : x > widget_width - 40 ? 1 : 0;
              if (event.click_time < 200 && delta == 0) {
                this.prompt(
                  "Value",
                  w.value,
                  function(v) {
                    if (/^[0-9+\-*/()\s]+|\d+\.\d+$/.test(v)) {
                      try {
                        v = eval(v);
                      } catch (e) {
                      }
                    }
                    this.value = Number(v);
                    inner_value_change(this, this.value);
                  }.bind(w),
                  event
                );
              }
            }
            if (old_value != w.value) {
              setTimeout(
                function() {
                  inner_value_change(this, this.value);
                }.bind(w),
                20
              );
            }
            this.dirty_canvas = true;
            break;
          case "toggle":
            if (event.type == LiteGraph.pointerevents_method + "down") {
              w.value = !w.value;
              setTimeout(function() {
                inner_value_change(w, w.value);
              }, 20);
            }
            break;
          case "string":
          case "text":
            if (event.type == LiteGraph.pointerevents_method + "down") {
              this.prompt(
                "Value",
                w.value,
                function(v2) {
                  inner_value_change(this, v2);
                }.bind(w),
                event,
                w.options ? w.options.multiline : false
              );
            }
            break;
          default:
            if (w.mouse) {
              this.dirty_canvas = w.mouse(event, [x, y], node);
            }
            break;
        }
        if (old_value != w.value) {
          if (node.onWidgetChanged) {
            node.onWidgetChanged(w.name, w.value, old_value, w);
          }
          node.graph._version++;
        }
        return w;
      }
      function inner_value_change(widget, value) {
        if (widget.type == "number") {
          value = Number(value);
        }
        widget.value = value;
        if (widget.options && widget.options.property && node.properties[widget.options.property] !== void 0) {
          node.setProperty(widget.options.property, value);
        }
        if (widget.callback) {
          widget.callback(widget.value, that, node, pos, event);
        }
      }
      return null;
    }
    drawGroups(_canvas, ctx) {
      const LiteGraph2 = this.constants();
      if (!this.graph) {
        return;
      }
      const groups = this.graph._groups;
      ctx.save();
      ctx.globalAlpha = 0.5 * this.editor_alpha;
      for (let i2 = 0; i2 < groups.length; ++i2) {
        const group = groups[i2];
        if (!overlapBounding(this.visible_area, group._bounding)) {
          continue;
        }
        ctx.fillStyle = group.color || "#335";
        ctx.strokeStyle = group.color || "#335";
        const pos2 = group._pos;
        const size = group._size;
        ctx.globalAlpha = 0.25 * this.editor_alpha;
        ctx.beginPath();
        ctx.rect(pos2[0] + 0.5, pos2[1] + 0.5, size[0], size[1]);
        ctx.fill();
        ctx.globalAlpha = this.editor_alpha;
        ctx.stroke();
        const font_size = group.font_size || LiteGraph2.DEFAULT_GROUP_FONT_SIZE;
        ctx.font = font_size + "px Arial";
        ctx.textAlign = "left";
        ctx.fillText(group.title, pos2[0] + 4, pos2[1] + font_size);
      }
      ctx.restore();
    }
    adjustNodesSize() {
      if (!this.graph) return;
      const nodes = this.graph._nodes;
      for (let i2 = 0; i2 < nodes.length; ++i2) {
        nodes[i2].size = nodes[i2].computeSize();
      }
      this.setDirty(true, true);
    }
    resize(width2, height) {
      if (!this.canvas || !this.bgcanvas) {
        return;
      }
      if (!width2 && !height) {
        const parent = this.canvas.parentNode;
        width2 = parent.offsetWidth;
        height = parent.offsetHeight;
      }
      if (this.canvas.width == width2 && this.canvas.height == height) {
        return;
      }
      this.canvas.width = width2;
      this.canvas.height = height;
      this.bgcanvas.width = this.canvas.width;
      this.bgcanvas.height = this.canvas.height;
      this.setDirty(true, true);
    }
    switchLiveMode(transition) {
      if (!transition) {
        this.live_mode = !this.live_mode;
        this.dirty_canvas = true;
        this.dirty_bgcanvas = true;
        return;
      }
      const delta2 = this.live_mode ? 1.1 : 0.9;
      if (this.live_mode) {
        this.live_mode = false;
        this.editor_alpha = 0.1;
      }
      const t = setInterval(() => {
        this.editor_alpha *= delta2;
        this.dirty_canvas = true;
        this.dirty_bgcanvas = true;
        if (delta2 < 1 && this.editor_alpha < 0.01) {
          clearInterval(t);
          if (delta2 < 1) {
            this.live_mode = true;
          }
        }
        if (delta2 > 1 && this.editor_alpha > 0.99) {
          clearInterval(t);
          this.editor_alpha = 1;
        }
      }, 1);
    }
    onNodeSelectionChange(_node) {
      return;
    }
    touchHandler(_event) {
    }
    drawSubgraphPanel(ctx) {
      const subgraph = this.graph;
      const subnode = subgraph._subgraph_node;
      if (!subnode) {
        console.warn("subgraph without subnode");
        return;
      }
      this.drawSubgraphPanelLeft(subgraph, subnode, ctx);
      this.drawSubgraphPanelRight(subgraph, subnode, ctx);
    }
    drawSubgraphPanelLeft(subgraph, subnode, ctx) {
      const LiteGraph2 = this.constants();
      const num = subnode.inputs ? subnode.inputs.length : 0;
      const w2 = 200;
      const h = Math.floor(LiteGraph2.NODE_SLOT_HEIGHT * 1.6);
      ctx.fillStyle = "#111";
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.roundRect(10, 10, w2, (num + 1) * h + 50, [8]);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#888";
      ctx.font = "14px Arial";
      ctx.textAlign = "left";
      ctx.fillText("Graph Inputs", 20, 34);
      if (this.drawButton(w2 - 20, 20, 20, 20, "X", "#151515")) {
        this.closeSubgraph();
        return;
      }
      let y2 = 50;
      ctx.font = "14px Arial";
      if (subnode.inputs) {
        for (let i2 = 0; i2 < subnode.inputs.length; ++i2) {
          const input = subnode.inputs[i2];
          if (input.not_subgraph_input) {
            continue;
          }
          if (this.drawButton(20, y2 + 2, w2 - 20, h - 2)) {
            const type = subnode.constructor.input_node_type || "graph/input";
            this.graph.beforeChange();
            const newnode = LiteGraph2.createNode(type);
            if (newnode) {
              subgraph.add(newnode);
              this.block_click = false;
              this.last_click_position = null;
              this.selectNodes([newnode]);
              this.node_dragged = newnode;
              this.dragging_canvas = false;
              newnode.setProperty("name", input.name);
              newnode.setProperty("type", input.type);
              this.node_dragged.pos[0] = this.graph_mouse[0] - 5;
              this.node_dragged.pos[1] = this.graph_mouse[1] - 5;
              this.graph.afterChange();
            } else {
              console.error("graph input node not found:", type);
            }
          }
          ctx.fillStyle = "#9C9";
          ctx.beginPath();
          ctx.arc(w2 - 16, y2 + h * 0.5, 5, 0, 2 * Math.PI);
          ctx.fill();
          ctx.fillStyle = "#AAA";
          ctx.fillText(input.name, 30, y2 + h * 0.75);
          ctx.fillStyle = "#777";
          ctx.fillText(input.type, 130, y2 + h * 0.75);
          y2 += h;
        }
      }
      if (this.drawButton(20, y2 + 2, w2 - 20, h - 2, "+", "#151515", "#222")) {
        this.showSubgraphPropertiesDialog(subnode);
      }
    }
    drawSubgraphPanelRight(subgraph, subnode, ctx) {
      const LiteGraph2 = this.constants();
      const num = subnode.outputs ? subnode.outputs.length : 0;
      const canvas_w = this.bgcanvas.width;
      const w2 = 200;
      const h = Math.floor(LiteGraph2.NODE_SLOT_HEIGHT * 1.6);
      ctx.fillStyle = "#111";
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.roundRect(canvas_w - w2 - 10, 10, w2, (num + 1) * h + 50, [8]);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#888";
      ctx.font = "14px Arial";
      ctx.textAlign = "left";
      const title_text = "Graph Outputs";
      const tw = ctx.measureText(title_text).width;
      ctx.fillText(title_text, canvas_w - tw - 20, 34);
      if (this.drawButton(canvas_w - w2, 20, 20, 20, "X", "#151515")) {
        this.closeSubgraph();
        return;
      }
      let y2 = 50;
      ctx.font = "14px Arial";
      if (subnode.outputs) {
        for (let i2 = 0; i2 < subnode.outputs.length; ++i2) {
          const output = subnode.outputs[i2];
          if (output.not_subgraph_input) {
            continue;
          }
          if (this.drawButton(canvas_w - w2, y2 + 2, w2 - 20, h - 2)) {
            const type = subnode.constructor.output_node_type || "graph/output";
            this.graph.beforeChange();
            const newnode = LiteGraph2.createNode(type);
            if (newnode) {
              subgraph.add(newnode);
              this.block_click = false;
              this.last_click_position = null;
              this.selectNodes([newnode]);
              this.node_dragged = newnode;
              this.dragging_canvas = false;
              newnode.setProperty("name", output.name);
              newnode.setProperty("type", output.type);
              this.node_dragged.pos[0] = this.graph_mouse[0] - 5;
              this.node_dragged.pos[1] = this.graph_mouse[1] - 5;
              this.graph.afterChange();
            } else {
              console.error("graph input node not found:", type);
            }
          }
          ctx.fillStyle = "#9C9";
          ctx.beginPath();
          ctx.arc(canvas_w - w2 + 16, y2 + h * 0.5, 5, 0, 2 * Math.PI);
          ctx.fill();
          ctx.fillStyle = "#AAA";
          ctx.fillText(output.name, canvas_w - w2 + 30, y2 + h * 0.75);
          ctx.fillStyle = "#777";
          ctx.fillText(output.type, canvas_w - w2 + 130, y2 + h * 0.75);
          y2 += h;
        }
      }
      if (this.drawButton(canvas_w - w2, y2 + 2, w2 - 20, h - 2, "+", "#151515", "#222")) {
        this.showSubgraphPropertiesDialogRight(subnode);
      }
    }
    drawButton(x2, y2, w2, h, text, bgcolor, hovercolor, textcolor) {
      const LiteGraph2 = this.constants();
      const ctx = this.ctx;
      if (!ctx || !this.canvas) {
        return false;
      }
      bgcolor = bgcolor || LiteGraph2.NODE_DEFAULT_COLOR;
      hovercolor = hovercolor || "#555";
      textcolor = textcolor || LiteGraph2.NODE_TEXT_COLOR;
      let pos2 = this.ds.convertOffsetToCanvas(this.graph_mouse);
      const hover = LiteGraph2.isInsideRectangle(pos2[0], pos2[1], x2, y2, w2, h);
      pos2 = this.last_click_position ? [this.last_click_position[0], this.last_click_position[1]] : null;
      if (pos2) {
        const rect = this.canvas.getBoundingClientRect();
        pos2[0] -= rect.left;
        pos2[1] -= rect.top;
      }
      const clicked = pos2 && LiteGraph2.isInsideRectangle(pos2[0], pos2[1], x2, y2, w2, h);
      ctx.fillStyle = hover ? hovercolor : bgcolor;
      if (clicked) {
        ctx.fillStyle = "#AAA";
      }
      ctx.beginPath();
      ctx.roundRect(x2, y2, w2, h, [4]);
      ctx.fill();
      if (text != null) {
        if (text.constructor == String) {
          ctx.fillStyle = textcolor;
          ctx.textAlign = "center";
          ctx.font = (h * 0.65 | 0) + "px Arial";
          ctx.fillText(text, x2 + w2 * 0.5, y2 + h * 0.75);
          ctx.textAlign = "left";
        }
      }
      const was_clicked = clicked && !this.block_click;
      if (clicked) {
        this.blockClick();
      }
      return was_clicked;
    }
  }
  class LGraphCanvasMenuPanel extends LGraphCanvasRender {
    menuClass() {
      return LGraphCanvas$1;
    }
    menuHost() {
      var _a2, _b2, _c2, _d2;
      const litegraph = this.getLiteGraphHost();
      return {
        ...litegraph,
        ContextMenu: litegraph.ContextMenu || this.menuClass().ContextMenu || class {
          constructor(_v, _o, _w) {
          }
        },
        ACTION: (_a2 = litegraph.ACTION) != null ? _a2 : -1,
        EVENT: (_b2 = litegraph.EVENT) != null ? _b2 : -1,
        NODE_MODES: litegraph.NODE_MODES || ["Always", "On Event", "Never", "On Trigger"],
        LINK_RENDER_MODES: litegraph.LINK_RENDER_MODES || ["Straight", "Linear", "Spline"],
        availableCanvasOptions: litegraph.availableCanvasOptions || [],
        slot_types_default_in: litegraph.slot_types_default_in || {},
        slot_types_default_out: litegraph.slot_types_default_out || {},
        slot_types_in: litegraph.slot_types_in || [],
        slot_types_out: litegraph.slot_types_out || [],
        registered_node_types: litegraph.registered_node_types || {},
        registered_slot_in_types: litegraph.registered_slot_in_types || {},
        registered_slot_out_types: litegraph.registered_slot_out_types || {},
        searchbox_extras: litegraph.searchbox_extras || {},
        search_filter_enabled: !!litegraph.search_filter_enabled,
        search_hide_on_mouse_leave: !!litegraph.search_hide_on_mouse_leave,
        search_show_all_on_open: !!litegraph.search_show_all_on_open,
        dialog_close_on_mouse_leave: (_c2 = litegraph.dialog_close_on_mouse_leave) != null ? _c2 : true,
        dialog_close_on_mouse_leave_delay: (_d2 = litegraph.dialog_close_on_mouse_leave_delay) != null ? _d2 : 500,
        getTime: litegraph.getTime || (() => Date.now()),
        createNode: litegraph.createNode || ((_) => null),
        pointerListenerAdd: litegraph.pointerListenerAdd || ((dom, ev, cb, capture) => {
          if ("addEventListener" in dom) {
            dom.addEventListener(ev, cb, !!capture);
          }
        }),
        pointerListenerRemove: litegraph.pointerListenerRemove || ((dom, ev, cb, capture) => {
          if ("removeEventListener" in dom) {
            dom.removeEventListener(ev, cb, !!capture);
          }
        })
      };
    }
    setActiveCanvas() {
      this.menuClass().active_canvas = this;
    }
    showLinkMenu(link, e) {
      var _a2;
      this.setActiveCanvas();
      const host = this.menuHost();
      const node_left = this.graph.getNodeById(link.origin_id);
      const node_right = this.graph.getNodeById(link.target_id);
      let fromType = false;
      if (node_left && node_left.outputs && node_left.outputs[link.origin_slot]) {
        fromType = node_left.outputs[link.origin_slot].type;
      }
      let destType = false;
      if (node_right && node_right.outputs && node_right.outputs[link.target_slot]) {
        destType = node_right.inputs[link.target_slot].type;
      }
      const menu = new host.ContextMenu(
        ["Add Node", null, "Delete", null],
        {
          event: e,
          title: link.data != null ? ((_a2 = link.data.constructor) == null ? void 0 : _a2.name) || null : null,
          callback: (v2, _opts, menuEvent) => {
            if (v2 === "Add Node") {
              this.menuClass().onMenuAdd(null, null, menuEvent, menu, (node2) => {
                if (!node2.inputs || !node2.inputs.length || !node2.outputs || !node2.outputs.length) {
                  return;
                }
                if (node_left.connectByType(link.origin_slot, node2, fromType)) {
                  node2.connectByType(link.target_slot, node_right, destType);
                  node2.pos[0] -= node2.size[0] * 0.5;
                }
              });
            } else if (v2 === "Delete") {
              this.graph.removeLink(link.id);
            }
          }
        },
        this.getCanvasWindow()
      );
      return false;
    }
    createDefaultNodeForSlot(optPass) {
      const host = this.menuHost();
      const opts = Object.assign(
        {
          nodeFrom: null,
          slotFrom: null,
          nodeTo: null,
          slotTo: null,
          position: [0, 0],
          nodeType: null,
          posAdd: [0, 0],
          posSizeFix: [0, 0]
        },
        optPass || {}
      );
      const isFrom = !!(opts.nodeFrom && opts.slotFrom !== null);
      const isTo = !isFrom && !!(opts.nodeTo && opts.slotTo !== null);
      if (!isFrom && !isTo) {
        console.warn("No data passed to createDefaultNodeForSlot " + opts.nodeFrom + " " + opts.slotFrom + " " + opts.nodeTo + " " + opts.slotTo);
        return false;
      }
      if (!opts.nodeType) {
        console.warn("No type to createDefaultNodeForSlot");
        return false;
      }
      const nodeX = isFrom ? opts.nodeFrom : opts.nodeTo;
      let slotX = isFrom ? opts.slotFrom : opts.slotTo;
      let iSlotConn = false;
      if (typeof slotX === "string") {
        iSlotConn = isFrom ? nodeX.findOutputSlot(slotX, false) : nodeX.findInputSlot(slotX, false);
        slotX = isFrom ? nodeX.outputs[slotX] : nodeX.inputs[slotX];
      } else if (typeof slotX === "object") {
        iSlotConn = isFrom ? nodeX.findOutputSlot(slotX.name) : nodeX.findInputSlot(slotX.name);
      } else if (typeof slotX === "number") {
        iSlotConn = slotX;
        slotX = isFrom ? nodeX.outputs[slotX] : nodeX.inputs[slotX];
      } else {
        console.warn("Cant get slot information " + slotX);
        return false;
      }
      if (slotX === false || iSlotConn === false) {
        console.warn("createDefaultNodeForSlot bad slotX " + slotX + " " + iSlotConn);
      }
      const fromSlotType = slotX.type == host.EVENT ? "_event_" : slotX.type;
      const slotTypesDefault = isFrom ? host.slot_types_default_out : host.slot_types_default_in;
      const slotDefault = slotTypesDefault == null ? void 0 : slotTypesDefault[fromSlotType];
      if (!slotDefault) {
        return false;
      }
      let nodeNewType = false;
      if (typeof slotDefault === "object") {
        for (const i2 in slotDefault) {
          if (opts.nodeType == slotDefault[i2] || opts.nodeType == "AUTO") {
            nodeNewType = slotDefault[i2];
            break;
          }
        }
      } else if (opts.nodeType == slotDefault || opts.nodeType == "AUTO") {
        nodeNewType = slotDefault;
      }
      if (!nodeNewType) {
        return false;
      }
      let nodeNewOpts = null;
      if (typeof nodeNewType === "object" && nodeNewType.node) {
        nodeNewOpts = nodeNewType;
        nodeNewType = nodeNewType.node;
      }
      const newNode = host.createNode(nodeNewType);
      if (!newNode) {
        console.log("failed creating " + nodeNewType);
        return false;
      }
      if (nodeNewOpts) {
        if (nodeNewOpts.properties) {
          for (const i2 in nodeNewOpts.properties) {
            newNode.addProperty(i2, nodeNewOpts.properties[i2]);
          }
        }
        if (nodeNewOpts.inputs) {
          newNode.inputs = [];
          for (const i2 in nodeNewOpts.inputs) {
            newNode.addOutput(
              nodeNewOpts.inputs[i2][0],
              nodeNewOpts.inputs[i2][1]
            );
          }
        }
        if (nodeNewOpts.outputs) {
          newNode.outputs = [];
          for (const i2 in nodeNewOpts.outputs) {
            newNode.addOutput(
              nodeNewOpts.outputs[i2][0],
              nodeNewOpts.outputs[i2][1]
            );
          }
        }
        if (nodeNewOpts.title) {
          newNode.title = nodeNewOpts.title;
        }
        if (nodeNewOpts.json) {
          newNode.configure(nodeNewOpts.json);
        }
      }
      this.graph.add(newNode);
      newNode.pos = [
        opts.position[0] + opts.posAdd[0] + (opts.posSizeFix[0] ? opts.posSizeFix[0] * newNode.size[0] : 0),
        opts.position[1] + opts.posAdd[1] + (opts.posSizeFix[1] ? opts.posSizeFix[1] * newNode.size[1] : 0)
      ];
      if (isFrom) {
        opts.nodeFrom.connectByType(iSlotConn, newNode, fromSlotType);
      } else {
        opts.nodeTo.connectByTypeOutput(iSlotConn, newNode, fromSlotType);
      }
      return true;
    }
    showConnectionMenu(optPass) {
      var _a2, _b2, _c2, _d2, _e, _f, _g, _h;
      this.setActiveCanvas();
      const host = this.menuHost();
      const opts = Object.assign(
        {
          nodeFrom: null,
          slotFrom: null,
          nodeTo: null,
          slotTo: null,
          e: null
        },
        optPass || {}
      );
      const isFrom = !!(opts.nodeFrom && opts.slotFrom != null);
      const isTo = !isFrom && !!(opts.nodeTo && opts.slotTo != null);
      if (!isFrom && !isTo) {
        return false;
      }
      const nodeX = isFrom ? opts.nodeFrom : opts.nodeTo;
      let slotX = isFrom ? opts.slotFrom : opts.slotTo;
      let iSlotConn = false;
      if (typeof slotX === "string") {
        iSlotConn = isFrom ? (_a2 = nodeX.findOutputSlot) == null ? void 0 : _a2.call(nodeX, slotX, false) : (_b2 = nodeX.findInputSlot) == null ? void 0 : _b2.call(nodeX, slotX, false);
        slotX = isFrom ? (_c2 = nodeX.outputs) == null ? void 0 : _c2[iSlotConn] : (_d2 = nodeX.inputs) == null ? void 0 : _d2[iSlotConn];
      } else if (typeof slotX === "object") {
        iSlotConn = isFrom ? (_e = nodeX.findOutputSlot) == null ? void 0 : _e.call(nodeX, slotX.name) : (_f = nodeX.findInputSlot) == null ? void 0 : _f.call(nodeX, slotX.name);
      } else if (typeof slotX === "number") {
        iSlotConn = slotX;
        slotX = isFrom ? (_g = nodeX.outputs) == null ? void 0 : _g[slotX] : (_h = nodeX.inputs) == null ? void 0 : _h[slotX];
      } else {
        return false;
      }
      const fromSlotType = slotX.type == host.EVENT ? "_event_" : slotX.type;
      const options = ["Add Node", null];
      if (this.allow_searchbox) {
        options.push("Search", null);
      }
      const slotTypesDefault = isFrom ? host.slot_types_default_out : host.slot_types_default_in;
      if (slotTypesDefault == null ? void 0 : slotTypesDefault[fromSlotType]) {
        if (typeof slotTypesDefault[fromSlotType] === "object") {
          for (const i2 in slotTypesDefault[fromSlotType]) {
            options.push(slotTypesDefault[fromSlotType][i2]);
          }
        } else {
          options.push(slotTypesDefault[fromSlotType]);
        }
      }
      const menu = new host.ContextMenu(options, {
        event: opts.e,
        title: ((slotX == null ? void 0 : slotX.name) ? slotX.name + (fromSlotType ? " | " : "") : "") + (fromSlotType || ""),
        callback: (v2, _menuOpt, e) => {
          if (v2 === "Add Node") {
            this.menuClass().onMenuAdd(null, null, e, menu, (node2) => {
              if (isFrom) {
                opts.nodeFrom.connectByType(iSlotConn, node2, fromSlotType);
              } else {
                opts.nodeTo.connectByTypeOutput(iSlotConn, node2, fromSlotType);
              }
            });
          } else if (v2 === "Search") {
            if (isFrom) {
              this.showSearchBox(e, {
                node_from: opts.nodeFrom,
                slot_from: slotX,
                type_filter_in: fromSlotType
              });
            } else {
              this.showSearchBox(e, {
                node_to: opts.nodeTo,
                slot_from: slotX,
                type_filter_out: fromSlotType
              });
            }
          } else {
            this.createDefaultNodeForSlot(
              Object.assign(opts, {
                position: [opts.e.canvasX, opts.e.canvasY],
                nodeType: v2
              })
            );
          }
        }
      });
      return false;
    }
    prompt(title, value, callback, event2, multiline) {
      var _a2, _b2, _c2;
      this.setActiveCanvas();
      const host = this.menuHost();
      title = title || "";
      const dialog = document.createElement("div");
      dialog.is_modified = false;
      dialog.className = "graphdialog rounded";
      dialog.innerHTML = multiline ? "<span class='name'></span> <textarea autofocus class='value'></textarea><button class='rounded'>OK</button>" : "<span class='name'></span> <input autofocus type='text' class='value'/><button class='rounded'>OK</button>";
      dialog.modified = () => {
        dialog.is_modified = true;
      };
      dialog.close = () => {
        var _a3;
        this.prompt_box = null;
        (_a3 = dialog.parentNode) == null ? void 0 : _a3.removeChild(dialog);
      };
      const canvas = ((_a2 = this.menuClass().active_canvas) == null ? void 0 : _a2.canvas) || this.canvas;
      (_b2 = canvas.parentNode) == null ? void 0 : _b2.appendChild(dialog);
      if (this.ds.scale > 1) {
        dialog.style.transform = "scale(" + this.ds.scale + ")";
      }
      let closeTimer = null;
      let prevent_timeout = false;
      host.pointerListenerAdd(dialog, "leave", () => {
        if (prevent_timeout) {
          return;
        }
        if (host.dialog_close_on_mouse_leave && !dialog.is_modified) {
          closeTimer = setTimeout(dialog.close, host.dialog_close_on_mouse_leave_delay);
        }
      });
      host.pointerListenerAdd(dialog, "enter", () => {
        if (closeTimer) {
          clearTimeout(closeTimer);
        }
      });
      const selInDia = dialog.querySelectorAll("select");
      if (selInDia) {
        selInDia.forEach((selIn) => {
          selIn.addEventListener("click", () => {
            prevent_timeout++;
          });
          selIn.addEventListener("blur", () => {
            prevent_timeout = 0;
          });
          selIn.addEventListener("change", () => {
            prevent_timeout = -1;
          });
        });
      }
      if (this.prompt_box) {
        this.prompt_box.close();
      }
      this.prompt_box = dialog;
      const nameEl = dialog.querySelector(".name");
      const inputEl = dialog.querySelector(".value");
      if (nameEl) {
        nameEl.innerText = title || "";
      }
      if (inputEl) {
        inputEl.value = value;
        inputEl.addEventListener("keydown", (e) => {
          dialog.is_modified = true;
          if (e.key === "Escape") {
            dialog.close();
          } else if (e.key === "Enter" && e.target.localName != "textarea") {
            callback == null ? void 0 : callback(inputEl.value);
            dialog.close();
          } else {
            return;
          }
          e.preventDefault();
          e.stopPropagation();
        });
      }
      (_c2 = dialog.querySelector("button")) == null ? void 0 : _c2.addEventListener("click", () => {
        callback == null ? void 0 : callback(inputEl == null ? void 0 : inputEl.value);
        this.setDirty(true, false);
        dialog.close();
      });
      const rect = canvas.getBoundingClientRect();
      let x2 = -20;
      let y2 = -20;
      if (rect) {
        x2 -= rect.left;
        y2 -= rect.top;
      }
      if (event2) {
        x2 += event2.clientX;
        y2 += event2.clientY;
      } else {
        x2 += canvas.width * 0.5;
        y2 += canvas.height * 0.5;
      }
      dialog.style.left = x2 + "px";
      dialog.style.top = y2 + "px";
      setTimeout(() => inputEl == null ? void 0 : inputEl.focus(), 10);
      return dialog;
    }
    showSearchBox(event2, options) {
      this.setActiveCanvas();
      const host = this.menuHost();
      const has_slot_types = !!(host.slot_types_in && host.slot_types_in.length || host.slot_types_out && host.slot_types_out.length);
      const def_options = {
        slot_from: null,
        node_from: null,
        node_to: null,
        do_type_filter: host.search_filter_enabled && has_slot_types,
        type_filter_in: false,
        type_filter_out: false,
        show_general_if_none_on_typefilter: true,
        show_general_after_typefiltered: true,
        hide_on_mouse_leave: host.search_hide_on_mouse_leave,
        show_all_if_empty: true,
        show_all_on_open: host.search_show_all_on_open
      };
      const opts = Object.assign(def_options, options || {});
      if (opts.do_type_filter && !has_slot_types) {
        opts.do_type_filter = false;
      }
      const that2 = this;
      const graphcanvas = this.menuClass().active_canvas;
      const canvas = graphcanvas.canvas;
      const root_document = canvas.ownerDocument || document;
      const dialog = document.createElement("div");
      dialog.className = "litegraph litesearchbox graphdialog rounded";
      dialog.innerHTML = "<span class='name'>Search</span> <input autofocus type='text' class='value rounded'/>";
      if (opts.do_type_filter) {
        dialog.innerHTML += "<select class='slot_in_type_filter'><option value=''></option></select>";
        dialog.innerHTML += "<select class='slot_out_type_filter'><option value=''></option></select>";
      }
      dialog.innerHTML += "<div class='helper'></div>";
      if (root_document.fullscreenElement) {
        root_document.fullscreenElement.appendChild(dialog);
      } else {
        root_document.body.appendChild(dialog);
        root_document.body.style.overflow = "hidden";
      }
      const selIn = opts.do_type_filter ? dialog.querySelector(".slot_in_type_filter") : null;
      const selOut = opts.do_type_filter ? dialog.querySelector(".slot_out_type_filter") : null;
      dialog.close = () => {
        that2.search_box = null;
        dialog.blur();
        canvas.focus();
        root_document.body.style.overflow = "";
        if (dialog._remove_outside_close) {
          dialog._remove_outside_close();
          dialog._remove_outside_close = null;
        }
        setTimeout(() => {
          that2.canvas.focus();
        }, 20);
        if (dialog.parentNode) {
          dialog.parentNode.removeChild(dialog);
        }
      };
      if (this.ds.scale > 1) {
        dialog.style.transform = "scale(" + this.ds.scale + ")";
      }
      const open_time = host.getTime ? host.getTime() : Date.now();
      const bindOutsideClose = () => {
        const onOutsideDown = (e) => {
          if (!dialog || !that2.search_box) {
            return;
          }
          const now = host.getTime ? host.getTime() : Date.now();
          if (now - open_time < 60) {
            return;
          }
          if (dialog.contains(e.target)) {
            return;
          }
          dialog.close();
        };
        root_document.addEventListener("mousedown", onOutsideDown, true);
        root_document.addEventListener("touchstart", onOutsideDown, { capture: true, passive: true });
        dialog._remove_outside_close = () => {
          root_document.removeEventListener("mousedown", onOutsideDown, true);
          root_document.removeEventListener("touchstart", onOutsideDown, true);
        };
      };
      bindOutsideClose();
      if (opts.hide_on_mouse_leave) {
        let prevent_timeout = false;
        let timeout_close = null;
        host.pointerListenerAdd(dialog, "enter", () => {
          if (timeout_close) {
            clearTimeout(timeout_close);
            timeout_close = null;
          }
        });
        host.pointerListenerAdd(dialog, "leave", () => {
          if (prevent_timeout) {
            return;
          }
          timeout_close = setTimeout(() => {
            dialog.close();
          }, 500);
        });
        if (opts.do_type_filter && selIn && selOut) {
          selIn.addEventListener("click", () => {
            prevent_timeout++;
          });
          selIn.addEventListener("blur", () => {
            prevent_timeout = 0;
          });
          selIn.addEventListener("change", () => {
            prevent_timeout = -1;
          });
          selOut.addEventListener("click", () => {
            prevent_timeout++;
          });
          selOut.addEventListener("blur", () => {
            prevent_timeout = 0;
          });
          selOut.addEventListener("change", () => {
            prevent_timeout = -1;
          });
        }
      }
      if (that2.search_box) {
        that2.search_box.close();
      }
      that2.search_box = dialog;
      const helper = dialog.querySelector(".helper");
      let first = null;
      let timeout = null;
      let selected = null;
      const input = dialog.querySelector("input");
      if (input) {
        input.addEventListener("blur", function() {
          if (that2.search_box && !opts.hide_on_mouse_leave) {
            setTimeout(function() {
              if (!that2.search_box) {
                return;
              }
              const active_element = root_document.activeElement;
              if (!active_element || !dialog.contains(active_element)) {
                dialog.close();
              }
            }, 0);
            return;
          }
          if (that2.search_box && opts.hide_on_mouse_leave) {
            this.focus();
          }
        });
        input.addEventListener("keydown", (e) => {
          if (e.keyCode == 38) {
            changeSelection(false);
          } else if (e.keyCode == 40) {
            changeSelection(true);
          } else if (e.keyCode == 27) {
            dialog.close();
          } else if (e.keyCode == 13) {
            refreshHelper();
            if (selected) {
              select(selected.innerHTML);
            } else if (first) {
              select(first);
            } else {
              dialog.close();
            }
          } else {
            if (timeout) {
              clearInterval(timeout);
            }
            timeout = setTimeout(refreshHelper, 250);
            return;
          }
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
        });
      }
      if (opts.do_type_filter && selIn && selOut) {
        const aSlotsIn = host.slot_types_in || [];
        let inType = opts.type_filter_in;
        if (inType == host.EVENT || inType == host.ACTION) {
          inType = "_event_";
        }
        for (let i2 = 0; i2 < aSlotsIn.length; i2++) {
          const opt = document.createElement("option");
          opt.value = aSlotsIn[i2];
          opt.innerHTML = aSlotsIn[i2];
          selIn.appendChild(opt);
          if (inType !== false && (inType + "").toLowerCase() == (aSlotsIn[i2] + "").toLowerCase()) {
            opt.selected = true;
          }
        }
        selIn.addEventListener("change", refreshHelper);
        const aSlotsOut = host.slot_types_out || [];
        let outType = opts.type_filter_out;
        if (outType == host.EVENT || outType == host.ACTION) {
          outType = "_event_";
        }
        for (let i2 = 0; i2 < aSlotsOut.length; i2++) {
          const opt = document.createElement("option");
          opt.value = aSlotsOut[i2];
          opt.innerHTML = aSlotsOut[i2];
          selOut.appendChild(opt);
          if (outType !== false && (outType + "").toLowerCase() == (aSlotsOut[i2] + "").toLowerCase()) {
            opt.selected = true;
          }
        }
        selOut.addEventListener("change", refreshHelper);
      }
      const rect = canvas.getBoundingClientRect();
      const left = (event2 ? event2.clientX : rect.left + rect.width * 0.5) - 80;
      const top = (event2 ? event2.clientY : rect.top + rect.height * 0.5) - 20;
      dialog.style.left = left + "px";
      dialog.style.top = top + "px";
      if (event2 && event2.layerY > rect.height - 200) {
        helper.style.maxHeight = rect.height - event2.layerY - 20 + "px";
      }
      input.focus();
      if (opts.show_all_on_open) {
        refreshHelper();
      }
      function select(name) {
        if (name) {
          if (that2.onSearchBoxSelection) {
            that2.onSearchBoxSelection(name, event2, graphcanvas);
          } else {
            const extra = host.searchbox_extras[name.toLowerCase()];
            if (extra) {
              name = extra.type;
            }
            graphcanvas.graph.beforeChange();
            const node2 = host.createNode(name);
            if (node2) {
              node2.pos = graphcanvas.convertEventToCanvasOffset(event2);
              graphcanvas.graph.add(node2, false);
            }
            if (extra && extra.data && node2) {
              if (extra.data.properties) {
                for (const i2 in extra.data.properties) {
                  node2.addProperty(i2, extra.data.properties[i2]);
                }
              }
              if (extra.data.inputs) {
                node2.inputs = [];
                for (const i2 in extra.data.inputs) {
                  node2.addOutput(extra.data.inputs[i2][0], extra.data.inputs[i2][1]);
                }
              }
              if (extra.data.outputs) {
                node2.outputs = [];
                for (const i2 in extra.data.outputs) {
                  node2.addOutput(extra.data.outputs[i2][0], extra.data.outputs[i2][1]);
                }
              }
              if (extra.data.title) {
                node2.title = extra.data.title;
              }
              if (extra.data.json) {
                node2.configure(extra.data.json);
              }
            }
            if (opts.node_from && node2) {
              let iS = false;
              switch (typeof opts.slot_from) {
                case "string":
                  iS = opts.node_from.findOutputSlot(opts.slot_from);
                  break;
                case "object":
                  if (opts.slot_from.name) {
                    iS = opts.node_from.findOutputSlot(opts.slot_from.name);
                  } else {
                    iS = -1;
                  }
                  if (iS == -1 && typeof opts.slot_from.slot_index !== "undefined") iS = opts.slot_from.slot_index;
                  break;
                case "number":
                  iS = opts.slot_from;
                  break;
                default:
                  iS = 0;
              }
              if (typeof opts.node_from.outputs[iS] !== "undefined") {
                if (iS !== false && iS > -1) {
                  opts.node_from.connectByType(iS, node2, opts.node_from.outputs[iS].type);
                }
              }
            }
            if (opts.node_to && node2) {
              let iS = false;
              switch (typeof opts.slot_from) {
                case "string":
                  iS = opts.node_to.findInputSlot(opts.slot_from);
                  break;
                case "object":
                  if (opts.slot_from.name) {
                    iS = opts.node_to.findInputSlot(opts.slot_from.name);
                  } else {
                    iS = -1;
                  }
                  if (iS == -1 && typeof opts.slot_from.slot_index !== "undefined") iS = opts.slot_from.slot_index;
                  break;
                case "number":
                  iS = opts.slot_from;
                  break;
                default:
                  iS = 0;
              }
              if (typeof opts.node_to.inputs[iS] !== "undefined") {
                if (iS !== false && iS > -1) {
                  opts.node_to.connectByTypeOutput(iS, node2, opts.node_to.inputs[iS].type);
                }
              }
            }
            graphcanvas.graph.afterChange();
          }
        }
        dialog.close();
      }
      function changeSelection(forward) {
        const prev = selected;
        if (selected) {
          selected.classList.remove("selected");
        }
        if (!selected) {
          selected = forward ? helper.childNodes[0] : helper.childNodes[helper.childNodes.length];
        } else {
          selected = forward ? selected.nextSibling : selected.previousSibling;
          if (!selected) {
            selected = prev;
          }
        }
        if (!selected) {
          return;
        }
        selected.classList.add("selected");
        selected.scrollIntoView({ block: "end", behavior: "smooth" });
      }
      function refreshHelper() {
        timeout = null;
        let str = input.value;
        first = null;
        helper.innerHTML = "";
        if (!str && !opts.show_all_if_empty) {
          return;
        }
        if (that2.onSearchBox) {
          const list = that2.onSearchBox(helper, str, graphcanvas);
          if (list) {
            for (let i2 = 0; i2 < list.length; ++i2) {
              addResult(list[i2]);
            }
          }
        } else {
          let c = 0;
          str = str.toLowerCase();
          const filter = graphcanvas.filter || graphcanvas.graph.filter;
          const sIn = opts.do_type_filter && that2.search_box ? that2.search_box.querySelector(".slot_in_type_filter") : null;
          const sOut = opts.do_type_filter && that2.search_box ? that2.search_box.querySelector(".slot_out_type_filter") : null;
          const search_limit = that2.menuClass().search_limit !== void 0 ? that2.menuClass().search_limit : -1;
          const inner_test_filter = (type, optsIn) => {
            const optsDef = {
              skipFilter: false,
              inTypeOverride: false,
              outTypeOverride: false
            };
            const local = Object.assign(optsDef, {});
            const ctor = host.registered_node_types[type];
            if (filter && ctor.filter != filter) {
              return false;
            }
            if ((!opts.show_all_if_empty || str) && type.toLowerCase().indexOf(str) === -1) {
              return false;
            }
            if (opts.do_type_filter && !local.skipFilter) {
              let sV = sIn == null ? void 0 : sIn.value;
              if (local.inTypeOverride !== false) sV = local.inTypeOverride;
              if (sIn && sV) {
                if (host.registered_slot_in_types[sV] && host.registered_slot_in_types[sV].nodes) {
                  const doesInc = host.registered_slot_in_types[sV].nodes.includes(type);
                  if (doesInc === false) {
                    return false;
                  }
                }
              }
              sV = sOut == null ? void 0 : sOut.value;
              if (local.outTypeOverride !== false) sV = local.outTypeOverride;
              if (sOut && sV) {
                if (host.registered_slot_out_types[sV] && host.registered_slot_out_types[sV].nodes) {
                  const doesInc = host.registered_slot_out_types[sV].nodes.includes(type);
                  if (doesInc === false) {
                    return false;
                  }
                }
              }
            }
            return true;
          };
          for (const i2 in host.searchbox_extras) {
            const extra = host.searchbox_extras[i2];
            if ((!opts.show_all_if_empty || str) && extra.desc.toLowerCase().indexOf(str) === -1) {
              continue;
            }
            const ctor = host.registered_node_types[extra.type];
            if (ctor && ctor.filter != filter) {
              continue;
            }
            if (!inner_test_filter(extra.type)) {
              continue;
            }
            addResult(extra.desc, "searchbox_extra");
            if (search_limit !== -1 && c++ > search_limit) {
              break;
            }
          }
          const keys = Object.keys(host.registered_node_types);
          const filtered = keys.filter((t) => inner_test_filter(t));
          for (let i2 = 0; i2 < filtered.length; i2++) {
            addResult(filtered[i2]);
            if (search_limit !== -1 && c++ > search_limit) {
              break;
            }
          }
        }
        function addResult(type, className) {
          const help = document.createElement("div");
          if (!first) {
            first = type;
          }
          help.innerText = type;
          help.dataset["type"] = escape(type);
          help.className = "litegraph lite-search-item";
          if (className) {
            help.className += " " + className;
          }
          help.addEventListener("click", function() {
            select(unescape(this.dataset["type"]));
          });
          helper.appendChild(help);
        }
      }
      return dialog;
    }
    showEditPropertyValue(node2, property, options) {
      if (!node2 || node2.properties[property] === void 0) {
        return;
      }
      options = options || {};
      const info = node2.getPropertyInfo(property);
      const type = info.type;
      let input_html = "";
      if (type == "string" || type == "number" || type == "array" || type == "object") {
        input_html = "<input autofocus type='text' class='value'/>";
      } else if ((type == "enum" || type == "combo") && info.values) {
        input_html = "<select autofocus type='text' class='value'>";
        for (const i2 in info.values) {
          let v2 = i2;
          if (info.values.constructor === Array) {
            v2 = info.values[i2];
          }
          input_html += "<option value='" + v2 + "' " + (v2 == node2.properties[property] ? "selected" : "") + ">" + info.values[i2] + "</option>";
        }
        input_html += "</select>";
      } else if (type == "boolean" || type == "toggle") {
        input_html = "<input autofocus type='checkbox' class='value' " + (node2.properties[property] ? "checked" : "") + "/>";
      } else {
        console.warn("unknown type: " + type);
        return;
      }
      const dialog = this.createDialog(
        "<span class='name'>" + (info.label ? info.label : property) + "</span>" + input_html + "<button>OK</button>",
        options
      );
      let input = false;
      if ((type == "enum" || type == "combo") && info.values) {
        input = dialog.querySelector("select");
        input.addEventListener("change", function(e) {
          dialog.modified();
          setValue(e.target.value);
        });
      } else if (type == "boolean" || type == "toggle") {
        input = dialog.querySelector("input");
        if (input) {
          input.addEventListener("click", function() {
            dialog.modified();
            setValue(!!input.checked);
          });
        }
      } else {
        input = dialog.querySelector("input");
        if (input) {
          input.addEventListener("blur", function() {
            this.focus();
          });
          let v2 = node2.properties[property] !== void 0 ? node2.properties[property] : "";
          if (type !== "string") {
            v2 = JSON.stringify(v2);
          }
          input.value = v2;
          input.addEventListener("keydown", function(e) {
            if (e.keyCode == 27) {
              dialog.close();
            } else if (e.keyCode == 13) {
              inner();
            } else if (e.keyCode != 13) {
              dialog.modified();
              return;
            }
            e.preventDefault();
            e.stopPropagation();
          });
        }
      }
      if (input) input.focus();
      const button = dialog.querySelector("button");
      button == null ? void 0 : button.addEventListener("click", inner);
      function inner() {
        setValue(input.value);
      }
      function setValue(value) {
        if (info && info.values && info.values.constructor === Object && info.values[value] != void 0) {
          value = info.values[value];
        }
        if (typeof node2.properties[property] == "number") {
          value = Number(value);
        }
        if (type == "array" || type == "object") {
          value = JSON.parse(value);
        }
        node2.properties[property] = value;
        if (node2.graph) {
          node2.graph._version++;
        }
        if (node2.onPropertyChanged) {
          node2.onPropertyChanged(property, value);
        }
        if (options.onclose) {
          options.onclose();
        }
        dialog.close();
        node2.setDirtyCanvas(true, true);
      }
      return dialog;
    }
    createDialog(html, options) {
      var _a2;
      const host = this.menuHost();
      const opts = Object.assign(
        {
          checkForInput: false,
          closeOnLeave: true,
          closeOnLeave_checkModified: true,
          closeOnClickOutside: true
        },
        options || {}
      );
      const close_on_leave = !!(opts.closeOnLeave && host.dialog_close_on_mouse_leave);
      const dialog = document.createElement("div");
      dialog.className = "graphdialog";
      dialog.innerHTML = html;
      dialog.is_modified = false;
      dialog.modified = () => {
        dialog.is_modified = true;
      };
      dialog.close = () => {
        var _a3;
        if (dialog._remove_outside_close) {
          dialog._remove_outside_close();
          dialog._remove_outside_close = null;
        }
        (_a3 = dialog.parentNode) == null ? void 0 : _a3.removeChild(dialog);
      };
      const rect = this.canvas.getBoundingClientRect();
      let x2 = -20;
      let y2 = -20;
      if (rect) {
        x2 -= rect.left;
        y2 -= rect.top;
      }
      if (opts.position) {
        x2 += opts.position[0];
        y2 += opts.position[1];
      } else if (opts.event) {
        x2 += opts.event.clientX;
        y2 += opts.event.clientY;
      } else {
        x2 += this.canvas.width * 0.5;
        y2 += this.canvas.height * 0.5;
      }
      dialog.style.left = x2 + "px";
      dialog.style.top = y2 + "px";
      (_a2 = this.canvas.parentNode) == null ? void 0 : _a2.appendChild(dialog);
      if (opts.checkForInput) {
        const aI = dialog.querySelectorAll("input");
        let focused = false;
        if (aI) {
          aI.forEach((iX) => {
            iX.addEventListener("keydown", function(e) {
              dialog.modified();
              if (e.keyCode == 27) {
                dialog.close();
              } else if (e.keyCode != 13) {
                return;
              }
              e.preventDefault();
              e.stopPropagation();
            });
            if (!focused) {
              iX.focus();
              focused = true;
            }
          });
        }
      }
      let dialogCloseTimer = null;
      let prevent_timeout = false;
      host.pointerListenerAdd(dialog, "leave", () => {
        if (prevent_timeout) {
          return;
        }
        if (!close_on_leave) {
          return;
        }
        if (opts.closeOnLeave_checkModified && dialog.is_modified) {
          return;
        }
        dialogCloseTimer = setTimeout(dialog.close, host.dialog_close_on_mouse_leave_delay);
      });
      host.pointerListenerAdd(dialog, "enter", () => {
        if (dialogCloseTimer) {
          clearTimeout(dialogCloseTimer);
        }
      });
      const selInDia = dialog.querySelectorAll("select");
      if (selInDia) {
        selInDia.forEach((selIn) => {
          selIn.addEventListener("click", () => {
            prevent_timeout++;
          });
          selIn.addEventListener("blur", () => {
            prevent_timeout = 0;
          });
          selIn.addEventListener("change", () => {
            prevent_timeout = -1;
          });
        });
      }
      if (opts.closeOnClickOutside) {
        const root = this.canvas.ownerDocument || document;
        const onOutsideDown = (e) => {
          if (!dialog.parentNode) {
            return;
          }
          if (dialog.contains(e.target)) {
            return;
          }
          dialog.close();
        };
        root.addEventListener("mousedown", onOutsideDown, true);
        root.addEventListener("touchstart", onOutsideDown, { capture: true, passive: true });
        dialog._remove_outside_close = () => {
          root.removeEventListener("mousedown", onOutsideDown, true);
          root.removeEventListener("touchstart", onOutsideDown, true);
        };
      }
      dialog.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          dialog.close();
          e.preventDefault();
          e.stopPropagation();
        }
      });
      return dialog;
    }
    createPanel(title, options) {
      var _a2;
      options = options || {};
      const host = this.menuHost();
      const ref_window2 = options.window || window;
      const root = document.createElement("div");
      root.className = "litegraph dialog";
      root.innerHTML = "<div class='dialog-header'><span class='dialog-title'></span></div><div class='dialog-content'></div><div style='display:none;' class='dialog-alt-content'></div><div class='dialog-footer'></div>";
      root.header = root.querySelector(".dialog-header");
      if (options.width) {
        root.style.width = options.width + (options.width.constructor === Number ? "px" : "");
      }
      if (options.height) {
        root.style.height = options.height + (options.height.constructor === Number ? "px" : "");
      }
      if (options.closable) {
        const close = document.createElement("span");
        close.innerHTML = "&#10005;";
        close.classList.add("close");
        close.addEventListener("click", () => root.close());
        root.header.appendChild(close);
      }
      root.title_element = root.querySelector(".dialog-title");
      root.title_element.innerText = title;
      root.content = root.querySelector(".dialog-content");
      root.alt_content = root.querySelector(".dialog-alt-content");
      root.footer = root.querySelector(".dialog-footer");
      root.close = () => {
        var _a3, _b2;
        (_a3 = root.onClose) == null ? void 0 : _a3.call(root);
        (_b2 = root.parentNode) == null ? void 0 : _b2.removeChild(root);
      };
      root.toggleAltContent = (force) => {
        const showAlt = typeof force !== "undefined" ? !!force : root.alt_content.style.display !== "block";
        root.alt_content.style.display = showAlt ? "block" : "none";
        root.content.style.display = showAlt ? "none" : "block";
      };
      root.toggleFooterVisibility = (force) => {
        const show = typeof force !== "undefined" ? !!force : root.footer.style.display !== "block";
        root.footer.style.display = show ? "block" : "none";
      };
      root.clear = () => {
        root.content.innerHTML = "";
      };
      root.addHTML = (code, className, on_footer) => {
        const elem = document.createElement("div");
        if (className) {
          elem.className = className;
        }
        elem.innerHTML = code;
        if (on_footer) {
          root.footer.appendChild(elem);
        } else {
          root.content.appendChild(elem);
        }
        return elem;
      };
      root.addButton = (name, callback, buttonOptions) => {
        const elem = document.createElement("button");
        elem.innerText = name;
        elem.options = buttonOptions;
        elem.classList.add("btn");
        elem.addEventListener("click", callback);
        root.footer.appendChild(elem);
        return elem;
      };
      root.addSeparator = () => {
        const elem = document.createElement("div");
        elem.className = "separator";
        root.content.appendChild(elem);
      };
      root.addWidget = (type, name, value, widgetOptions, callback) => {
        const CanvasClass = this.menuClass();
        const localOpts = widgetOptions || {};
        type = String(type || "string").toLowerCase();
        let strValue = String(value);
        if (type === "number" && typeof value === "number") {
          strValue = value.toFixed(3);
        }
        const elem = document.createElement("div");
        elem.className = "property";
        elem.innerHTML = "<span class='property_name'></span><span class='property_value'></span>";
        elem.querySelector(".property_name").innerText = localOpts.label || name;
        const valueElement = elem.querySelector(".property_value");
        valueElement.innerText = strValue;
        elem.dataset.property = name;
        elem.dataset.type = localOpts.type || type;
        elem.options = localOpts;
        elem.value = value;
        const change = (key, v2) => {
          var _a3;
          (_a3 = localOpts.callback) == null ? void 0 : _a3.call(localOpts, key, v2, localOpts);
          callback == null ? void 0 : callback(key, v2, localOpts);
        };
        if (type === "code") {
          elem.addEventListener("click", function() {
            var _a3;
            (_a3 = root.inner_showCodePad) == null ? void 0 : _a3.call(root, this.dataset.property);
          });
        } else if (type === "boolean") {
          elem.classList.add("boolean");
          if (value) {
            elem.classList.add("bool-on");
          }
          elem.addEventListener("click", function() {
            const propname = this.dataset.property;
            this.value = !this.value;
            this.classList.toggle("bool-on");
            this.querySelector(".property_value").innerText = this.value ? "true" : "false";
            change(propname, this.value);
          });
        } else if (type === "string" || type === "number") {
          valueElement.setAttribute("contenteditable", "true");
          valueElement.addEventListener("keydown", (e) => {
            if (e.code === "Enter" && (type !== "string" || !e.shiftKey)) {
              e.preventDefault();
              valueElement.blur();
            }
          });
          valueElement.addEventListener("blur", function() {
            let v2 = this.innerText;
            const prop = this.parentNode.dataset.property;
            if (this.parentNode.dataset.type === "number") {
              v2 = Number(v2);
            }
            change(prop, v2);
          });
        } else if (type === "enum" || type === "combo") {
          valueElement.innerText = CanvasClass.getPropertyPrintableValue(
            value,
            localOpts.values
          );
          valueElement.addEventListener("click", (event2) => {
            const values = localOpts.values || [];
            const propname = valueElement.parentNode.dataset.property;
            new host.ContextMenu(
              values,
              {
                event: event2,
                className: "dark",
                callback: (v2) => {
                  valueElement.innerText = String(v2);
                  change(propname, v2);
                  return false;
                }
              },
              ref_window2
            );
          });
        }
        root.content.appendChild(elem);
        return elem;
      };
      (_a2 = root.onOpen) == null ? void 0 : _a2.call(root);
      return root;
    }
    closePanels() {
      var _a2, _b2;
      const nodePanel = document.querySelector("#node-panel");
      (_a2 = nodePanel == null ? void 0 : nodePanel.close) == null ? void 0 : _a2.call(nodePanel);
      const optionPanel = document.querySelector("#option-panel");
      (_b2 = optionPanel == null ? void 0 : optionPanel.close) == null ? void 0 : _b2.call(optionPanel);
    }
    showShowGraphOptionsPanel(_refOpts, obEv) {
      var _a2, _b2, _c2, _d2;
      let graphcanvas;
      if (((_a2 = this.constructor) == null ? void 0 : _a2.name) === "HTMLDivElement") {
        if (!((_c2 = (_b2 = obEv == null ? void 0 : obEv.event) == null ? void 0 : _b2.target) == null ? void 0 : _c2.lgraphcanvas)) {
          return;
        }
        graphcanvas = obEv.event.target.lgraphcanvas;
      } else {
        graphcanvas = this;
      }
      const host = this.menuHost();
      graphcanvas.closePanels();
      const ref_window2 = graphcanvas.getCanvasWindow();
      const panel = graphcanvas.createPanel("Options", {
        closable: true,
        window: ref_window2,
        onOpen: () => {
          graphcanvas.OPTIONPANEL_IS_OPEN = true;
        },
        onClose: () => {
          graphcanvas.OPTIONPANEL_IS_OPEN = false;
          graphcanvas.options_panel = null;
        }
      });
      graphcanvas.options_panel = panel;
      panel.id = "option-panel";
      panel.classList.add("settings");
      const refresh = () => {
        panel.content.innerHTML = "";
        const update = (name, value, options) => {
          if (options == null ? void 0 : options.key) {
            name = options.key;
          }
          if (options == null ? void 0 : options.values) {
            value = Object.values(options.values).indexOf(value);
          }
          graphcanvas[name] = value;
        };
        const props = [...host.availableCanvasOptions];
        props.sort();
        for (const p of props) {
          panel.addWidget(
            "boolean",
            p,
            graphcanvas[p],
            { key: p, on: "True", off: "False" },
            update
          );
        }
        panel.addWidget(
          "combo",
          "Render mode",
          host.LINK_RENDER_MODES[graphcanvas.links_render_mode],
          { key: "links_render_mode", values: host.LINK_RENDER_MODES },
          update
        );
        panel.addSeparator();
        panel.footer.innerHTML = "";
      };
      refresh();
      (_d2 = graphcanvas.canvas.parentNode) == null ? void 0 : _d2.appendChild(panel);
    }
    showShowNodePanel(node2) {
      var _a2;
      this.SELECTED_NODE = node2;
      this.closePanels();
      const host = this.menuHost();
      const panel = this.createPanel(node2.title || "", {
        closable: true,
        window: this.getCanvasWindow(),
        onOpen: () => {
          this.NODEPANEL_IS_OPEN = true;
        },
        onClose: () => {
          this.NODEPANEL_IS_OPEN = false;
          this.node_panel = null;
        }
      });
      this.node_panel = panel;
      panel.id = "node-panel";
      panel.node = node2;
      panel.classList.add("settings");
      const refresh = () => {
        var _a3, _b2, _c2;
        panel.content.innerHTML = "";
        panel.addHTML(
          "<span class='node_type'>" + node2.type + "</span><span class='node_desc'>" + (node2.constructor.desc || "") + "</span><span class='separator'></span>"
        );
        panel.addHTML("<h3>Properties</h3>");
        const update = (name, value) => {
          var _a4, _b3, _c3, _d2, _e, _f, _g;
          (_b3 = (_a4 = this.graph).beforeChange) == null ? void 0 : _b3.call(_a4, node2);
          if (name === "Title") {
            node2.title = value;
          } else if (name === "Mode") {
            const idx = Object.values(host.NODE_MODES).indexOf(value);
            if (idx >= 0) {
              (_c3 = node2.changeMode) == null ? void 0 : _c3.call(node2, idx);
            }
          } else if (name === "Color") {
            const color = (_d2 = this.menuClass().node_colors) == null ? void 0 : _d2[value];
            if (color) {
              node2.color = color.color;
              node2.bgcolor = color.bgcolor;
            }
          } else {
            (_e = node2.setProperty) == null ? void 0 : _e.call(node2, name, value);
          }
          (_g = (_f = this.graph).afterChange) == null ? void 0 : _g.call(_f);
          this.dirty_canvas = true;
        };
        panel.addWidget("string", "Title", node2.title, {}, update);
        panel.addWidget(
          "combo",
          "Mode",
          host.NODE_MODES[node2.mode],
          { values: host.NODE_MODES },
          update
        );
        const nodeCol = node2.color !== void 0 ? Object.keys(this.menuClass().node_colors || {}).filter(
          (k) => this.menuClass().node_colors[k].color == node2.color
        ) : "";
        panel.addWidget(
          "combo",
          "Color",
          nodeCol,
          { values: Object.keys(this.menuClass().node_colors || {}) },
          update
        );
        for (const pName in node2.properties) {
          const value = node2.properties[pName];
          const info = ((_a3 = node2.getPropertyInfo) == null ? void 0 : _a3.call(node2, pName)) || {};
          if ((_b2 = node2.onAddPropertyToPanel) == null ? void 0 : _b2.call(node2, pName, panel)) {
            continue;
          }
          panel.addWidget(info.widget || info.type || "string", pName, value, info, update);
        }
        panel.addSeparator();
        (_c2 = node2.onShowCustomPanelInfo) == null ? void 0 : _c2.call(node2, panel);
        panel.footer.innerHTML = "";
        panel.addButton("Delete", () => {
          var _a4, _b3;
          if (node2.block_delete) {
            return;
          }
          (_b3 = (_a4 = node2.graph).remove) == null ? void 0 : _b3.call(_a4, node2);
          panel.close();
        }).classList.add("delete");
      };
      panel.inner_showCodePad = (propname) => {
        panel.classList.remove("settings");
        panel.classList.add("centered");
        panel.alt_content.innerHTML = "<textarea class='code'></textarea>";
        const textarea = panel.alt_content.querySelector("textarea");
        const done = () => {
          var _a3;
          panel.toggleAltContent(false);
          panel.toggleFooterVisibility(true);
          (_a3 = textarea.parentNode) == null ? void 0 : _a3.removeChild(textarea);
          panel.classList.add("settings");
          panel.classList.remove("centered");
          refresh();
        };
        textarea.value = node2.properties[propname];
        textarea.addEventListener("keydown", (e) => {
          var _a3;
          if (e.code === "Enter" && e.ctrlKey) {
            (_a3 = node2.setProperty) == null ? void 0 : _a3.call(node2, propname, textarea.value);
            done();
          }
        });
        panel.toggleAltContent(true);
        panel.toggleFooterVisibility(false);
        textarea.style.height = "calc(100% - 40px)";
        const assign = panel.addButton("Assign", () => {
          var _a3;
          (_a3 = node2.setProperty) == null ? void 0 : _a3.call(node2, propname, textarea.value);
          done();
        });
        panel.alt_content.appendChild(assign);
        const close = panel.addButton("Close", done);
        close.style.float = "right";
        panel.alt_content.appendChild(close);
      };
      refresh();
      (_a2 = this.canvas.parentNode) == null ? void 0 : _a2.appendChild(panel);
    }
    showSubgraphPropertiesDialog(node2) {
      var _a2, _b2, _c2, _d2;
      const old_panel = (_a2 = this.canvas.parentNode) == null ? void 0 : _a2.querySelector(".subgraph_dialog");
      (_b2 = old_panel == null ? void 0 : old_panel.close) == null ? void 0 : _b2.call(old_panel);
      const panel = this.createPanel("Subgraph Inputs", { closable: true, width: 500 });
      panel.node = node2;
      panel.classList.add("subgraph_dialog");
      const refresh = () => {
        var _a3;
        panel.clear();
        if (!node2.inputs) {
          return;
        }
        for (let i2 = 0; i2 < node2.inputs.length; ++i2) {
          const input = node2.inputs[i2];
          if (input.not_subgraph_input) {
            continue;
          }
          const html2 = "<button>&#10005;</button> <span class='bullet_icon'></span><span class='name'></span><span class='type'></span>";
          const elem = panel.addHTML(html2, "subgraph_property");
          elem.dataset.name = input.name;
          elem.dataset.slot = String(i2);
          elem.querySelector(".name").innerText = input.name;
          elem.querySelector(".type").innerText = input.type;
          (_a3 = elem.querySelector("button")) == null ? void 0 : _a3.addEventListener("click", function() {
            var _a4;
            (_a4 = node2.removeInput) == null ? void 0 : _a4.call(node2, Number(this.parentNode.dataset.slot));
            refresh();
          });
        }
      };
      const html = " + <span class='label'>Name</span><input class='name'/><span class='label'>Type</span><input class='type'></input><button>+</button>";
      const addRow = panel.addHTML(html, "subgraph_property extra", true);
      (_c2 = addRow.querySelector("button")) == null ? void 0 : _c2.addEventListener("click", function() {
        var _a3, _b3;
        const p = this.parentNode;
        const name = p.querySelector(".name").value;
        const type = p.querySelector(".type").value;
        if (!name || ((_a3 = node2.findInputSlot) == null ? void 0 : _a3.call(node2, name)) != -1) {
          return;
        }
        (_b3 = node2.addInput) == null ? void 0 : _b3.call(node2, name, type);
        p.querySelector(".name").value = "";
        p.querySelector(".type").value = "";
        refresh();
      });
      refresh();
      (_d2 = this.canvas.parentNode) == null ? void 0 : _d2.appendChild(panel);
      return panel;
    }
    showSubgraphPropertiesDialogRight(node2) {
      var _a2, _b2, _c2, _d2, _e;
      const old_panel = (_a2 = this.canvas.parentNode) == null ? void 0 : _a2.querySelector(".subgraph_dialog");
      (_b2 = old_panel == null ? void 0 : old_panel.close) == null ? void 0 : _b2.call(old_panel);
      const panel = this.createPanel("Subgraph Outputs", { closable: true, width: 500 });
      panel.node = node2;
      panel.classList.add("subgraph_dialog");
      const refresh = () => {
        var _a3;
        panel.clear();
        if (!node2.outputs) {
          return;
        }
        for (let i2 = 0; i2 < node2.outputs.length; ++i2) {
          const output = node2.outputs[i2];
          if (output.not_subgraph_output) {
            continue;
          }
          const html2 = "<button>&#10005;</button> <span class='bullet_icon'></span><span class='name'></span><span class='type'></span>";
          const elem = panel.addHTML(html2, "subgraph_property");
          elem.dataset.name = output.name;
          elem.dataset.slot = String(i2);
          elem.querySelector(".name").innerText = output.name;
          elem.querySelector(".type").innerText = output.type;
          (_a3 = elem.querySelector("button")) == null ? void 0 : _a3.addEventListener("click", function() {
            var _a4;
            (_a4 = node2.removeOutput) == null ? void 0 : _a4.call(node2, Number(this.parentNode.dataset.slot));
            refresh();
          });
        }
      };
      const html = " + <span class='label'>Name</span><input class='name'/><span class='label'>Type</span><input class='type'></input><button>+</button>";
      const addRow = panel.addHTML(html, "subgraph_property extra", true);
      const addOutput = function() {
        var _a3, _b3;
        const p = this.parentNode;
        const name = p.querySelector(".name").value;
        const type = p.querySelector(".type").value;
        if (!name || ((_a3 = node2.findOutputSlot) == null ? void 0 : _a3.call(node2, name)) != -1) {
          return;
        }
        (_b3 = node2.addOutput) == null ? void 0 : _b3.call(node2, name, type);
        p.querySelector(".name").value = "";
        p.querySelector(".type").value = "";
        refresh();
      };
      (_c2 = addRow.querySelector(".name")) == null ? void 0 : _c2.addEventListener("keydown", function(e) {
        if (e.key === "Enter") {
          addOutput.apply(this);
        }
      });
      (_d2 = addRow.querySelector("button")) == null ? void 0 : _d2.addEventListener("click", function() {
        addOutput.apply(this);
      });
      refresh();
      (_e = this.canvas.parentNode) == null ? void 0 : _e.appendChild(panel);
      return panel;
    }
    checkPanels() {
      const panels = this.canvas.parentNode.querySelectorAll(".litegraph.dialog");
      panels.forEach((panel) => {
        if (!panel.node) {
          return;
        }
        if (!panel.node.graph || panel.graph != this.graph) {
          panel.close();
        }
      });
    }
    getCanvasMenuOptions() {
      const CanvasClass = this.menuClass();
      let options = [];
      if (this.getMenuOptions) {
        options = this.getMenuOptions();
      } else {
        options = [
          { content: "Add Node", has_submenu: true, callback: CanvasClass.onMenuAdd },
          { content: "Add Group", callback: CanvasClass.onGroupAdd }
        ];
        if (Object.keys(this.selected_nodes || {}).length > 1) {
          options.push({
            content: "Align",
            has_submenu: true,
            callback: CanvasClass.onGroupAlign
          });
        }
        if (this._graph_stack && this._graph_stack.length > 0) {
          options.push(
            null,
            { content: "Close subgraph", callback: this.closeSubgraph.bind(this) }
          );
        }
      }
      if (this.getExtraMenuOptions) {
        const extra = this.getExtraMenuOptions(this, options);
        if (extra) {
          options = options.concat(extra);
        }
      }
      return options;
    }
    getNodeMenuOptions(node2) {
      var _a2, _b2, _c2, _d2, _e, _f;
      const CanvasClass = this.menuClass();
      let options = [];
      if (node2.getMenuOptions) {
        options = node2.getMenuOptions(this);
      } else {
        options = [
          {
            content: "Inputs",
            has_submenu: true,
            disabled: true,
            callback: CanvasClass.showMenuNodeOptionalInputs
          },
          {
            content: "Outputs",
            has_submenu: true,
            disabled: true,
            callback: CanvasClass.showMenuNodeOptionalOutputs
          },
          null,
          {
            content: "Properties",
            has_submenu: true,
            callback: CanvasClass.onShowMenuNodeProperties
          },
          null,
          { content: "Title", callback: CanvasClass.onShowPropertyEditor },
          { content: "Mode", has_submenu: true, callback: CanvasClass.onMenuNodeMode }
        ];
        if (node2.resizable !== false) {
          options.push({ content: "Resize", callback: CanvasClass.onMenuResizeNode });
        }
        options.push(
          { content: "Collapse", callback: CanvasClass.onMenuNodeCollapse },
          { content: "Pin", callback: CanvasClass.onMenuNodePin },
          { content: "Colors", has_submenu: true, callback: CanvasClass.onMenuNodeColors },
          { content: "Shapes", has_submenu: true, callback: CanvasClass.onMenuNodeShapes },
          null
        );
      }
      if ((_b2 = (_a2 = node2.onGetInputs) == null ? void 0 : _a2.call(node2)) == null ? void 0 : _b2.length) {
        options[0].disabled = false;
      }
      if ((_d2 = (_c2 = node2.onGetOutputs) == null ? void 0 : _c2.call(node2)) == null ? void 0 : _d2.length) {
        options[1].disabled = false;
      }
      if (node2.getExtraMenuOptions) {
        const extra = node2.getExtraMenuOptions(this, options);
        if (extra) {
          extra.push(null);
          options = extra.concat(options);
        }
      }
      if (node2.clonable !== false) {
        options.push({ content: "Clone", callback: CanvasClass.onMenuNodeClone });
      }
      options.push({
        content: "To Subgraph",
        disabled: node2.type == "graph/subgraph",
        callback: CanvasClass.onMenuNodeToSubgraph
      });
      if (Object.keys(this.selected_nodes || {}).length > 1) {
        options.push({
          content: "Align Selected To",
          has_submenu: true,
          callback: CanvasClass.onNodeAlign
        });
      }
      options.push(
        null,
        {
          content: "Remove",
          disabled: !(node2.removable !== false && !node2.block_delete),
          callback: CanvasClass.onMenuNodeRemove
        }
      );
      (_f = (_e = node2.graph) == null ? void 0 : _e.onGetNodeMenuOptions) == null ? void 0 : _f.call(_e, options, node2);
      return options;
    }
    getGroupMenuOptions(_node) {
      const CanvasClass = this.menuClass();
      return [
        { content: "Title", callback: CanvasClass.onShowPropertyEditor },
        { content: "Color", has_submenu: true, callback: CanvasClass.onMenuNodeColors },
        {
          content: "Font size",
          property: "font_size",
          type: "Number",
          callback: CanvasClass.onShowPropertyEditor
        },
        null,
        { content: "Remove", callback: CanvasClass.onMenuNodeRemove }
      ];
    }
    processContextMenu(node2, event2) {
      var _a2, _b2, _c2, _d2, _e, _f, _g;
      this.setActiveCanvas();
      const host = this.menuHost();
      const CanvasClass = this.menuClass();
      const ref_window2 = this.getCanvasWindow();
      let menu_info = null;
      const options = {
        event: event2,
        callback: inner_option_clicked,
        extra: node2
      };
      if (node2) {
        options.title = node2.type;
      }
      let slot = null;
      if (node2) {
        slot = (_a2 = node2.getSlotInPosition) == null ? void 0 : _a2.call(node2, event2.canvasX, event2.canvasY);
        CanvasClass.active_node = node2;
      }
      if (slot) {
        menu_info = [];
        if (node2.getSlotMenuOptions) {
          menu_info = node2.getSlotMenuOptions(slot);
        } else {
          if ((_c2 = (_b2 = slot == null ? void 0 : slot.output) == null ? void 0 : _b2.links) == null ? void 0 : _c2.length) {
            menu_info.push({ content: "Disconnect Links", slot });
          }
          const s = slot.input || slot.output;
          if (s == null ? void 0 : s.removable) {
            menu_info.push(s.locked ? "Cannot remove" : { content: "Remove Slot", slot });
          }
          if (!(s == null ? void 0 : s.nameLocked)) {
            menu_info.push({ content: "Rename Slot", slot });
          }
        }
        options.title = (slot.input ? slot.input.type : slot.output.type) || "*";
        if (((_d2 = slot.input) == null ? void 0 : _d2.type) == host.ACTION) {
          options.title = "Action";
        }
        if (((_e = slot.output) == null ? void 0 : _e.type) == host.EVENT) {
          options.title = "Event";
        }
      } else if (node2) {
        menu_info = this.getNodeMenuOptions(node2);
      } else {
        menu_info = this.getCanvasMenuOptions();
        const group = (_g = (_f = this.graph).getGroupOnPos) == null ? void 0 : _g.call(_f, event2.canvasX, event2.canvasY);
        if (group) {
          menu_info.push(
            null,
            {
              content: "Edit Group",
              has_submenu: true,
              submenu: {
                title: "Group",
                extra: group,
                options: this.getGroupMenuOptions(group)
              }
            }
          );
        }
      }
      if (!menu_info) {
        return;
      }
      new host.ContextMenu(menu_info, options, ref_window2);
      const that2 = this;
      function inner_option_clicked(v2, opts) {
        var _a3, _b3, _c3;
        if (!v2) {
          return;
        }
        if (v2.content == "Remove Slot") {
          const info = v2.slot;
          node2.graph.beforeChange();
          if (info.input) {
            node2.removeInput(info.slot);
          } else if (info.output) {
            node2.removeOutput(info.slot);
          }
          node2.graph.afterChange();
          return;
        }
        if (v2.content == "Disconnect Links") {
          const info = v2.slot;
          node2.graph.beforeChange();
          if (info.output) {
            node2.disconnectOutput(info.slot);
          } else if (info.input) {
            node2.disconnectInput(info.slot);
          }
          node2.graph.afterChange();
          return;
        }
        if (v2.content == "Rename Slot") {
          const info = v2.slot;
          const slot_info = info.input ? (_a3 = node2.getInputInfo) == null ? void 0 : _a3.call(node2, info.slot) : (_b3 = node2.getOutputInfo) == null ? void 0 : _b3.call(node2, info.slot);
          const dialog = that2.createDialog(
            "<span class='name'>Name</span><input autofocus type='text'/><button>OK</button>",
            opts
          );
          const input = dialog.querySelector("input");
          if (input && slot_info) {
            input.value = slot_info.label || "";
          }
          const inner = () => {
            node2.graph.beforeChange();
            if (input == null ? void 0 : input.value) {
              if (slot_info) {
                slot_info.label = input.value;
              }
              that2.setDirty(true, false);
            }
            dialog.close();
            node2.graph.afterChange();
          };
          (_c3 = dialog.querySelector("button")) == null ? void 0 : _c3.addEventListener("click", inner);
          input == null ? void 0 : input.addEventListener("keydown", (e) => {
            dialog.is_modified = true;
            if (e.key === "Escape") {
              dialog.close();
            } else if (e.key === "Enter") {
              inner();
            } else {
              return;
            }
            e.preventDefault();
            e.stopPropagation();
          });
          input == null ? void 0 : input.focus();
        }
      }
    }
  }
  const LGRAPHCANVAS_STATIC_RESIZE_DIFF_ID = "canvas-static.resize";
  const LGRAPHCANVAS_STATIC_SUBGRAPH_MENU_DIFF_ID = "canvas-static.subgraph-menu";
  const LGRAPHCANVAS_STATIC_MISSING_APIS_DIFF_ID = "canvas-static.missing-apis";
  function applyLGraphCanvasStaticCompatAliases(host) {
    if (!host.onResizeNode && host.onMenuResizeNode) {
      host.onResizeNode = host.onMenuResizeNode;
    }
    if (!host.onMenuResizeNode && host.onResizeNode) {
      host.onMenuResizeNode = host.onResizeNode;
    }
    if (!host.onNodeToSubgraph && host.onMenuNodeToSubgraph) {
      host.onNodeToSubgraph = host.onMenuNodeToSubgraph;
    }
    if (!host.onMenuNodeToSubgraph && host.onNodeToSubgraph) {
      host.onMenuNodeToSubgraph = host.onNodeToSubgraph;
    }
  }
  function applyLGraphCanvasStaticMissingApiGuards(host) {
    const filled = [];
    if (!host.getBoundaryNodes) {
      host.getBoundaryNodes = () => ({
        top: null,
        right: null,
        bottom: null,
        left: null
      });
      filled.push("getBoundaryNodes");
    }
    if (!host.alignNodes) {
      host.alignNodes = () => {
      };
      filled.push("alignNodes");
    }
    if (!host.onNodeAlign) {
      host.onNodeAlign = () => {
      };
      filled.push("onNodeAlign");
    }
    if (!host.onGroupAlign) {
      host.onGroupAlign = () => {
      };
      filled.push("onGroupAlign");
    }
    if (!host.getPropertyPrintableValue) {
      host.getPropertyPrintableValue = (value) => String(value);
      filled.push("getPropertyPrintableValue");
    }
    return {
      diffId: LGRAPHCANVAS_STATIC_MISSING_APIS_DIFF_ID,
      filled
    };
  }
  function applyLGraphCanvasStaticCompat$1(host) {
    applyLGraphCanvasStaticCompatAliases(host);
    return applyLGraphCanvasStaticMissingApiGuards(host);
  }
  function hasRequiredLGraphCanvasStaticApis(host) {
    return typeof host.onResizeNode === "function" && typeof host.onMenuResizeNode === "function" && typeof host.onNodeToSubgraph === "function" && typeof host.onMenuNodeToSubgraph === "function" && typeof host.getBoundaryNodes === "function" && typeof host.alignNodes === "function" && typeof host.onNodeAlign === "function" && typeof host.onGroupAlign === "function" && typeof host.getPropertyPrintableValue === "function";
  }
  function attachLiteGraphCommonJsExports(exportsTarget, globalScope) {
    const liteGraph = globalScope.LiteGraph;
    exportsTarget.LiteGraph = globalScope.LiteGraph;
    exportsTarget.LGraph = globalScope.LGraph || (liteGraph == null ? void 0 : liteGraph.LGraph);
    exportsTarget.LLink = globalScope.LLink || (liteGraph == null ? void 0 : liteGraph.LLink);
    exportsTarget.LGraphNode = globalScope.LGraphNode || (liteGraph == null ? void 0 : liteGraph.LGraphNode);
    exportsTarget.LGraphGroup = globalScope.LGraphGroup || (liteGraph == null ? void 0 : liteGraph.LGraphGroup);
    exportsTarget.DragAndScale = globalScope.DragAndScale || (liteGraph == null ? void 0 : liteGraph.DragAndScale);
    exportsTarget.LGraphCanvas = globalScope.LGraphCanvas || (liteGraph == null ? void 0 : liteGraph.LGraphCanvas);
    exportsTarget.ContextMenu = globalScope.ContextMenu || (liteGraph == null ? void 0 : liteGraph.ContextMenu);
    return exportsTarget;
  }
  const defaultBridgeOptions = {
    exposeClamp: true,
    installRequestAnimationFrameShim: true
  };
  function attachLiteGraphGlobalBridge(globalScope, runtime2, options) {
    const resolved = { ...defaultBridgeOptions, ...options || {} };
    const liteGraph = runtime2.LiteGraph;
    globalScope.LiteGraph = liteGraph;
    if (runtime2.LGraph) {
      globalScope.LGraph = runtime2.LGraph;
      liteGraph.LGraph = runtime2.LGraph;
    }
    if (runtime2.LLink) {
      liteGraph.LLink = runtime2.LLink;
    }
    if (runtime2.LGraphNode) {
      globalScope.LGraphNode = runtime2.LGraphNode;
      liteGraph.LGraphNode = runtime2.LGraphNode;
    }
    if (runtime2.LGraphGroup) {
      globalScope.LGraphGroup = runtime2.LGraphGroup;
      liteGraph.LGraphGroup = runtime2.LGraphGroup;
    }
    if (runtime2.DragAndScale) {
      liteGraph.DragAndScale = runtime2.DragAndScale;
    }
    if (runtime2.LGraphCanvas) {
      globalScope.LGraphCanvas = runtime2.LGraphCanvas;
      liteGraph.LGraphCanvas = runtime2.LGraphCanvas;
    }
    if (runtime2.ContextMenu) {
      liteGraph.ContextMenu = runtime2.ContextMenu;
    }
    if (runtime2.CurveEditor) {
      liteGraph.CurveEditor = runtime2.CurveEditor;
    }
    if (resolved.exposeClamp) {
      globalScope.clamp = clamp;
    }
    if (resolved.installRequestAnimationFrameShim) {
      installRequestAnimationFrameShim(globalScope);
    }
    return globalScope;
  }
  function installRequestAnimationFrameShim(globalScope) {
    if (typeof window == "undefined") {
      return;
    }
    if (globalScope.requestAnimationFrame) {
      return;
    }
    globalScope.requestAnimationFrame = globalScope.webkitRequestAnimationFrame || globalScope.mozRequestAnimationFrame || function(callback) {
      if (!globalScope.setTimeout) {
        return 0;
      }
      return globalScope.setTimeout(callback, 1e3 / 60);
    };
  }
  function createTimeSource() {
    if (typeof performance != "undefined") {
      return performance.now.bind(performance);
    }
    if (typeof Date != "undefined" && Date.now) {
      return Date.now.bind(Date);
    }
    const processLike = globalThis.process;
    if (typeof processLike != "undefined") {
      return function() {
        const t = processLike.hrtime();
        return t[0] * 1e-3 + t[1] * 1e-6;
      };
    }
    return function getTime() {
      return (/* @__PURE__ */ new Date()).getTime();
    };
  }
  const GRID_SQUARE_SHAPE_DIFF_ID = "constants.grid-square-alias";
  const GRID_SQUARE_SHAPE_DEFAULT = 6;
  function resolveGridSquareShapeValue(host, fallbackValue = GRID_SQUARE_SHAPE_DEFAULT) {
    if (typeof host.GRID_SHAPE === "number") {
      return { value: host.GRID_SHAPE, source: "GRID_SHAPE" };
    }
    if (typeof host.SQUARE_SHAPE === "number") {
      return { value: host.SQUARE_SHAPE, source: "SQUARE_SHAPE" };
    }
    return { value: fallbackValue, source: "fallback" };
  }
  function applyGridSquareShapeAlias(host, fallbackValue = GRID_SQUARE_SHAPE_DEFAULT) {
    const beforeGrid = host.GRID_SHAPE;
    const beforeSquare = host.SQUARE_SHAPE;
    const resolved = resolveGridSquareShapeValue(host, fallbackValue);
    host.GRID_SHAPE = resolved.value;
    host.SQUARE_SHAPE = resolved.value;
    return {
      diffId: GRID_SQUARE_SHAPE_DIFF_ID,
      value: resolved.value,
      source: resolved.source,
      changed: beforeGrid !== host.GRID_SHAPE || beforeSquare !== host.SQUARE_SHAPE
    };
  }
  function isGridSquareShapeAliasSynced(host) {
    return typeof host.GRID_SHAPE === "number" && typeof host.SQUARE_SHAPE === "number" && host.GRID_SHAPE === host.SQUARE_SHAPE;
  }
  const LiteGraphConstants = {
    VERSION: 0.4,
    CANVAS_GRID_SIZE: 10,
    NODE_TITLE_HEIGHT: 30,
    NODE_TITLE_TEXT_Y: 20,
    NODE_SLOT_HEIGHT: 20,
    NODE_WIDGET_HEIGHT: 20,
    NODE_WIDTH: 140,
    NODE_MIN_WIDTH: 50,
    NODE_COLLAPSED_RADIUS: 10,
    NODE_COLLAPSED_WIDTH: 80,
    NODE_TITLE_COLOR: "#999",
    NODE_SELECTED_TITLE_COLOR: "#FFF",
    NODE_TEXT_SIZE: 14,
    NODE_TEXT_COLOR: "#AAA",
    NODE_SUBTEXT_SIZE: 12,
    NODE_DEFAULT_COLOR: "#333",
    NODE_DEFAULT_BGCOLOR: "#353535",
    NODE_DEFAULT_BOXCOLOR: "#666",
    NODE_DEFAULT_SHAPE: "box",
    NODE_BOX_OUTLINE_COLOR: "#FFF",
    DEFAULT_SHADOW_COLOR: "rgba(0,0,0,0.5)",
    DEFAULT_GROUP_FONT: 24,
    WIDGET_BGCOLOR: "#222",
    WIDGET_OUTLINE_COLOR: "#666",
    WIDGET_TEXT_COLOR: "#DDD",
    WIDGET_SECONDARY_TEXT_COLOR: "#999",
    LINK_COLOR: "#9A9",
    EVENT_LINK_COLOR: "#A86",
    CONNECTING_LINK_COLOR: "#AFA",
    MAX_NUMBER_OF_NODES: 1e3,
    // avoid infinite loops
    DEFAULT_POSITION: [100, 100],
    // default node position
    VALID_SHAPES: ["default", "box", "round", "card"],
    // , "circle"
    // shapes are used for nodes but also for slots
    BOX_SHAPE: 1,
    ROUND_SHAPE: 2,
    CIRCLE_SHAPE: 3,
    CARD_SHAPE: 4,
    ARROW_SHAPE: 5,
    GRID_SHAPE: 6,
    // intended for slot arrays
    // enums
    INPUT: 1,
    OUTPUT: 2,
    EVENT: -1,
    // for outputs
    ACTION: -1,
    // for inputs
    NODE_MODES: ["Always", "On Event", "Never", "On Trigger"],
    // helper, will add "On Request" and more in the future
    NODE_MODES_COLORS: ["#666", "#422", "#333", "#224", "#626"],
    // use with node_box_coloured_by_mode
    ALWAYS: 0,
    ON_EVENT: 1,
    NEVER: 2,
    ON_TRIGGER: 3,
    UP: 1,
    DOWN: 2,
    LEFT: 3,
    RIGHT: 4,
    CENTER: 5,
    LINK_RENDER_MODES: ["Straight", "Linear", "Spline"],
    // helper
    STRAIGHT_LINK: 0,
    LINEAR_LINK: 1,
    SPLINE_LINK: 2,
    NORMAL_TITLE: 0,
    NO_TITLE: 1,
    TRANSPARENT_TITLE: 2,
    AUTOHIDE_TITLE: 3,
    VERTICAL_LAYOUT: "vertical",
    // arrange nodes vertically
    proxy: null,
    // used to redirect calls
    node_images_path: "",
    debug: false,
    catch_exceptions: true,
    throw_errors: true,
    allow_scripts: false,
    // if set to true some nodes like Formula would be allowed to evaluate code that comes from unsafe sources (like node configuration), which could lead to exploits
    use_deferred_actions: true,
    // executes actions during the graph execution flow
    registered_node_types: {},
    // nodetypes by string
    node_types_by_file_extension: {},
    // used for dropping files in the canvas
    Nodes: {},
    // node types by classname
    Globals: {},
    // used to store vars between graphs
    searchbox_extras: {},
    // used to add extra features to the search box
    auto_sort_node_types: false,
    // [true!] If set to true, will automatically sort node types / categories in the context menus
    node_box_coloured_when_on: false,
    // [true!] this make the nodes box (top left circle) coloured when triggered (execute/action), visual feedback
    node_box_coloured_by_mode: false,
    // [true!] nodebox based on node mode, visual feedback
    dialog_close_on_mouse_leave: true,
    // [false on mobile] better true if not touch device
    dialog_close_on_mouse_leave_delay: 500,
    shift_click_do_break_link_from: true,
    // [false!] set true to enable disconnect shortcut from output slots
    click_do_break_link_from_key: "shift",
    // "shift"|"alt"|"ctrl"|"meta"|Array<string>
    isBreakLinkModifierPressed: function(e) {
      const shortcutSetting = LiteGraphConstants.shift_click_do_break_link_from;
      if (!e || !shortcutSetting) {
        return false;
      }
      let breakMod = LiteGraphConstants.click_do_break_link_from_key;
      if (typeof shortcutSetting !== "boolean") {
        breakMod = shortcutSetting;
      }
      const hasModifier = (modifier) => {
        const mod = String(modifier || "").toLowerCase();
        return mod === "shift" && !!e.shiftKey || mod === "alt" && !!e.altKey || mod === "ctrl" && !!e.ctrlKey || mod === "meta" && !!e.metaKey;
      };
      if (Array.isArray(breakMod)) {
        return breakMod.some(hasModifier);
      }
      return hasModifier(breakMod || "shift");
    },
    click_do_break_link_to: false,
    // [false!] prefer false, way too easy to break links
    search_hide_on_mouse_leave: true,
    // [false on mobile] better true if not touch device
    search_filter_enabled: false,
    // [true!] enable filtering slots type in the search widget, !requires auto_load_slot_types or manual set registered_slot_[in/out]_types and slot_types_[in/out]
    search_show_all_on_open: true,
    // [true!] opens the results list when opening the search widget
    auto_load_slot_types: false,
    // [if want false, use true, run, get vars values to be statically set, than disable] nodes types and nodeclass association with node types need to be calculated, if dont want this, calculate once and set registered_slot_[in/out]_types and slot_types_[in/out]
    // set these values if not using auto_load_slot_types
    registered_slot_in_types: {},
    // slot types for nodeclass
    registered_slot_out_types: {},
    // slot types for nodeclass
    slot_types_in: [],
    // slot types IN
    slot_types_out: [],
    // slot types OUT
    slot_types_default_in: [],
    // specify for each IN slot type a(/many) default node(s), use single string, array, or object (with node, title, parameters, ..) like for search
    slot_types_default_out: [],
    // specify for each OUT slot type a(/many) default node(s), use single string, array, or object (with node, title, parameters, ..) like for search
    alt_drag_do_clone_nodes: false,
    // [true!] very handy, ALT click to clone and drag the new node
    do_add_triggers_slots: false,
    // [true!] will create and connect event slots when using action/events connections, !WILL CHANGE node mode when using onTrigger (enable mode colors), onExecuted does not need this
    allow_multi_output_for_events: true,
    // [false!] being events, it is strongly reccomended to use them sequentially, one by one
    middle_click_slot_add_default_node: false,
    // [true!] allows to create and connect a ndoe clicking with the third button (wheel)
    release_link_on_empty_shows_menu: false,
    // [true!] dragging a link to empty space will open a menu, add from list, search or defaults
    pointerevents_method: "mouse",
    // "mouse"|"pointer"|"touch"
    isTouchDevice: function() {
      if (typeof navigator === "undefined" || typeof window === "undefined") {
        return false;
      }
      if (navigator.maxTouchPoints && navigator.maxTouchPoints > 0) {
        return true;
      }
      if (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) {
        return true;
      }
      return "ontouchstart" in window;
    },
    ctrl_shift_v_paste_connect_unselected_outputs: false,
    // [true!] allows ctrl + shift + v to paste nodes with the outputs of the unselected nodes connected with the inputs of the newly pasted nodes
    // if true, all newly created nodes/links will use string UUIDs for their id fields instead of integers.
    // use this if you must have node IDs that are unique across all graphs and subgraphs.
    use_uuids: false
  };
  class LiteGraphRegistry {
    constructor(host, lGraphNodePrototype) {
      this.host = host;
      this.lGraphNodePrototype = lGraphNodePrototype;
    }
    /**
     * Register a node class so it can be listed when the user wants to create a new one
     * @method registerNodeType
     * @param {String} type name of the node and path
     * @param {Class} base_class class containing the structure of a node
     */
    registerNodeType(type, baseClass) {
      var _a2;
      if (!baseClass.prototype) {
        throw "Cannot register a simple object, it must be a class with a prototype";
      }
      baseClass.type = type;
      if (this.host.debug) {
        console.log("Node registered: " + type);
      }
      const className = baseClass.name;
      const pos2 = type.lastIndexOf("/");
      baseClass.category = type.substring(0, pos2);
      if (!baseClass.title) {
        baseClass.title = className;
      }
      const basePrototype = baseClass.prototype;
      const visited = /* @__PURE__ */ new Set();
      let cursor = this.lGraphNodePrototype;
      while (cursor && cursor !== Object.prototype) {
        const names = Object.getOwnPropertyNames(cursor);
        for (const name of names) {
          if (name === "constructor" || name === "__proto__" || visited.has(name)) {
            continue;
          }
          visited.add(name);
          if (basePrototype[name] !== void 0) {
            continue;
          }
          const descriptor = Object.getOwnPropertyDescriptor(cursor, name);
          if (!descriptor) {
            continue;
          }
          Object.defineProperty(basePrototype, name, descriptor);
        }
        cursor = Object.getPrototypeOf(cursor);
      }
      const prev = this.host.registered_node_types[type];
      if (prev) {
        console.log("replacing node type: " + type);
      }
      const host = this.host;
      if (!Object.prototype.hasOwnProperty.call(basePrototype, "shape")) {
        Object.defineProperty(basePrototype, "shape", {
          set: function(v2) {
            switch (v2) {
              case "default":
                delete this._shape;
                break;
              case "box":
                this._shape = host.BOX_SHAPE;
                break;
              case "round":
                this._shape = host.ROUND_SHAPE;
                break;
              case "circle":
                this._shape = host.CIRCLE_SHAPE;
                break;
              case "card":
                this._shape = host.CARD_SHAPE;
                break;
              default:
                this._shape = v2;
            }
          },
          get: function() {
            return this._shape;
          },
          enumerable: true,
          configurable: true
        });
        if (baseClass.supported_extensions) {
          for (const ext of baseClass.supported_extensions) {
            if (ext && typeof ext === "string") {
              this.host.node_types_by_file_extension[ext.toLowerCase()] = baseClass;
            }
          }
        }
      }
      this.host.registered_node_types[type] = baseClass;
      if ((_a2 = baseClass.constructor) == null ? void 0 : _a2.name) {
        this.host.Nodes[className] = baseClass;
      }
      if (this.host.onNodeTypeRegistered) {
        this.host.onNodeTypeRegistered(type, baseClass);
      }
      if (prev && this.host.onNodeTypeReplaced) {
        this.host.onNodeTypeReplaced(type, baseClass, prev);
      }
      if (baseClass.prototype.onPropertyChange) {
        console.warn(
          "LiteGraph node class " + type + " has onPropertyChange method, it must be called onPropertyChanged with d at the end"
        );
      }
      if (this.host.auto_load_slot_types) {
        try {
          const tempNode = new baseClass(baseClass.title || "tmpnode");
          if (tempNode && tempNode.inputs && this.host.registerNodeAndSlotType) {
            for (let i2 = 0; i2 < tempNode.inputs.length; ++i2) {
              this.host.registerNodeAndSlotType(
                tempNode,
                tempNode.inputs[i2] ? tempNode.inputs[i2].type : 0
              );
            }
          }
          if (tempNode && tempNode.outputs && this.host.registerNodeAndSlotType) {
            for (let i2 = 0; i2 < tempNode.outputs.length; ++i2) {
              this.host.registerNodeAndSlotType(
                tempNode,
                tempNode.outputs[i2] ? tempNode.outputs[i2].type : 0,
                true
              );
            }
          }
        } catch (err) {
          if (this.host.debug) {
            console.warn(
              "Error while probing slots for node type: " + type,
              err
            );
          }
        }
      }
    }
    /**
     * removes a node type from the system
     * @method unregisterNodeType
     * @param {String|Object} type name of the node or the node constructor itself
     */
    unregisterNodeType(type) {
      var _a2;
      const baseClass = typeof type === "string" ? this.host.registered_node_types[type] : type;
      if (!baseClass) {
        throw "node type not found: " + type;
      }
      if (baseClass.type) {
        delete this.host.registered_node_types[baseClass.type];
      }
      const constructorName = (_a2 = baseClass.constructor) == null ? void 0 : _a2.name;
      if (constructorName) {
        delete this.host.Nodes[constructorName];
      }
    }
    /**
     * Removes all previously registered node's types
     */
    clearRegisteredTypes() {
      this.host.registered_node_types = {};
      this.host.node_types_by_file_extension = {};
      this.host.Nodes = {};
      this.host.searchbox_extras = {};
    }
    /**
     * Adds this method to all nodetypes, existing and to be created
     * (You can add it to LGraphNode.prototype but then existing node types wont have it)
     * @method addNodeMethod
     * @param {Function} func
     */
    addNodeMethod(name, func) {
      this.lGraphNodePrototype[name] = func;
      for (const i2 in this.host.registered_node_types) {
        const type = this.host.registered_node_types[i2];
        const prototype = type.prototype;
        if (prototype[name]) {
          prototype["_" + name] = prototype[name];
        }
        prototype[name] = func;
      }
    }
    /**
     * Create a node of a given type with a name. The node is not attached to any graph yet.
     * @method createNode
     * @param {String} type full name of the node class. p.e. "math/sin"
     * @param {String} name a name to distinguish from other nodes
     * @param {Object} options to set options
     */
    createNode(type, title, options) {
      const baseClass = this.host.registered_node_types[type];
      if (!baseClass) {
        if (this.host.debug) {
          console.log('GraphNode type "' + type + '" not registered.');
        }
        return null;
      }
      title = title || baseClass.title || type;
      let node2;
      if (this.host.catch_exceptions) {
        try {
          node2 = new baseClass(title);
        } catch (err) {
          console.error(err);
          return null;
        }
      } else {
        node2 = new baseClass(title);
      }
      node2.type = type;
      if (!node2.title && title) {
        node2.title = title;
      }
      if (!node2.properties) {
        node2.properties = {};
      }
      if (!node2.properties_info) {
        node2.properties_info = [];
      }
      if (!node2.flags) {
        node2.flags = {};
      }
      if (!node2.size) {
        node2.size = node2.computeSize();
      }
      if (!node2.pos) {
        node2.pos = this.host.DEFAULT_POSITION.concat();
      }
      if (!node2.mode) {
        node2.mode = this.host.ALWAYS;
      }
      if (options) {
        const mutableNode = node2;
        for (const i2 in options) {
          mutableNode[i2] = options[i2];
        }
      }
      if (node2.onNodeCreated) {
        node2.onNodeCreated();
      }
      return node2;
    }
    /**
     * Returns a registered node type with a given name
     * @method getNodeType
     * @param {String} type full name of the node class. p.e. "math/sin"
     * @return {Class} the node class
     */
    getNodeType(type) {
      return this.host.registered_node_types[type];
    }
    /**
     * Returns a list of node types matching one category
     * @method getNodeType
     * @param {String} category category name
     * @return {Array} array with all the node classes
     */
    getNodeTypesInCategory(category, filter) {
      const result = [];
      for (const i2 in this.host.registered_node_types) {
        const type = this.host.registered_node_types[i2];
        if (type.filter != filter) {
          continue;
        }
        if (category === "") {
          if (type.category == null) {
            result.push(type);
          }
        } else if (type.category === category) {
          result.push(type);
        }
      }
      if (this.host.auto_sort_node_types) {
        result.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
      }
      return result;
    }
    /**
     * Returns a list with all the node type categories
     * @method getNodeTypesCategories
     * @param {String} filter only nodes with ctor.filter equal can be shown
     * @return {Array} array with all the names of the categories
     */
    getNodeTypesCategories(filter) {
      const categories = { "": 1 };
      for (const i2 in this.host.registered_node_types) {
        const type = this.host.registered_node_types[i2];
        if (type.category && !type.skip_list) {
          if (type.filter != filter) {
            continue;
          }
          categories[type.category] = 1;
        }
      }
      const result = [];
      for (const i2 in categories) {
        result.push(i2);
      }
      return this.host.auto_sort_node_types ? result.sort() : result;
    }
  }
  class LiteGraphRuntime {
    constructor(host) {
      this.host = host;
    }
    /**
    * Save a slot type and his node
    * @method registerSlotType
    * @param {String|Object} type name of the node or the node constructor itself
    * @param {String} slot_type name of the slot type (variable type), eg. string, number, array, boolean, ..
    */
    registerNodeAndSlotType(type, slotType, out) {
      out = out || false;
      const registeredType = this.host.registered_node_types[String(type)];
      const baseClass = typeof type === "string" && registeredType != "anonymous" ? registeredType : type;
      const classType = baseClass.constructor.type;
      let allTypes = [];
      if (typeof slotType === "string") {
        allTypes = slotType.split(",");
      } else if (slotType == this.host.EVENT || slotType == this.host.ACTION) {
        allTypes = ["_event_"];
      } else {
        allTypes = ["*"];
      }
      for (let i2 = 0; i2 < allTypes.length; ++i2) {
        let normalizedSlotType = allTypes[i2];
        if (normalizedSlotType === "") {
          normalizedSlotType = "*";
        }
        const registerTo = out ? this.host.registered_slot_out_types : this.host.registered_slot_in_types;
        if (registerTo[normalizedSlotType] === void 0) {
          registerTo[normalizedSlotType] = { nodes: [] };
        }
        if (!registerTo[normalizedSlotType].nodes.includes(classType)) {
          registerTo[normalizedSlotType].nodes.push(classType);
        }
        if (!out) {
          if (!this.host.slot_types_in.includes(
            normalizedSlotType.toLowerCase()
          )) {
            this.host.slot_types_in.push(normalizedSlotType.toLowerCase());
            this.host.slot_types_in.sort();
          }
        } else if (!this.host.slot_types_out.includes(normalizedSlotType.toLowerCase())) {
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
    buildNodeClassFromObject(name, object) {
      let ctorCode = "";
      if (object.inputs) {
        for (let i2 = 0; i2 < object.inputs.length; ++i2) {
          const inputName = object.inputs[i2][0];
          let inputType = object.inputs[i2][1];
          if (inputType && inputType.constructor === String) {
            inputType = '"' + inputType + '"';
          }
          ctorCode += "this.addInput('" + inputName + "'," + inputType + ");\n";
        }
      }
      if (object.outputs) {
        for (let i2 = 0; i2 < object.outputs.length; ++i2) {
          const outputName = object.outputs[i2][0];
          let outputType = object.outputs[i2][1];
          if (outputType && outputType.constructor === String) {
            outputType = '"' + outputType + '"';
          }
          ctorCode += "this.addOutput('" + outputName + "'," + outputType + ");\n";
        }
      }
      if (object.properties) {
        for (const key in object.properties) {
          let prop = object.properties[key];
          if (prop && prop.constructor === String) {
            prop = '"' + prop + '"';
          }
          ctorCode += "this.addProperty('" + key + "'," + prop + ");\n";
        }
      }
      ctorCode += "if(this.onCreate)this.onCreate()";
      const classObject = Function(ctorCode);
      for (const key in object) {
        if (key !== "inputs" && key !== "outputs" && key !== "properties") {
          classObject.prototype[key] = object[key];
        }
      }
      classObject.title = object.title || name.split("/").pop();
      classObject.desc = object.desc || "Generated from object";
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
    wrapFunctionAsNode(name, func, paramTypes, returnType, properties) {
      var _a2;
      const params = Array(func.length);
      let code = "";
      if (paramTypes !== null) {
        const names = this.host.getParameterNames(func);
        for (let i2 = 0; i2 < names.length; ++i2) {
          let type = 0;
          if (paramTypes) {
            if (paramTypes[i2] != null && ((_a2 = paramTypes[i2]) == null ? void 0 : _a2.constructor) === String) {
              type = "'" + paramTypes[i2] + "'";
            } else if (paramTypes[i2] != null) {
              type = paramTypes[i2];
            }
          }
          code += "this.addInput('" + names[i2] + "'," + type + ");\n";
        }
      }
      if (returnType !== null) {
        code += "this.addOutput('out'," + (returnType != null ? returnType.constructor === String ? "'" + returnType + "'" : returnType : 0) + ");\n";
      }
      if (properties) {
        code += "this.properties = " + JSON.stringify(properties) + ";\n";
      }
      const classObject = Function(code);
      classObject.title = name.split("/").pop();
      classObject.desc = "Generated from " + func.name;
      classObject.prototype.onExecute = function onExecute() {
        for (let i2 = 0; i2 < params.length; ++i2) {
          params[i2] = this.getInputData(i2);
        }
        const result = func.apply(this, params);
        this.setOutputData(0, result);
      };
      this.host.registerNodeType(name, classObject);
      return classObject;
    }
    // debug purposes: reloads all the js scripts that matches a wildcard
    reloadNodes(folderWildcard) {
      const scripts = document.getElementsByTagName("script");
      const scriptFiles = [];
      for (let i2 = 0; i2 < scripts.length; i2++) {
        scriptFiles.push(scripts[i2]);
      }
      const docHeadObj = document.getElementsByTagName("head")[0];
      folderWildcard = document.location.href + folderWildcard;
      for (let i2 = 0; i2 < scriptFiles.length; i2++) {
        const src = scriptFiles[i2].src;
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
          docHeadObj.removeChild(scriptFiles[i2]);
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
    cloneObject(obj, target) {
      if (obj == null) {
        return null;
      }
      const cloned = JSON.parse(JSON.stringify(obj));
      if (!target) {
        return cloned;
      }
      for (const key in cloned) {
        target[key] = cloned[key];
      }
      return target;
    }
    /*
     * https://gist.github.com/jed/982883?permalink_comment_id=852670#gistcomment-852670
     */
    uuidv4() {
      const pattern = "10000000-1000-4000-8000-100000000000";
      return pattern.replace(
        /[018]/g,
        (a) => (Number(a) ^ Math.random() * 16 >> Number(a) / 4).toString(16)
      );
    }
    /**
     * Returns if the types of two slots are compatible (taking into account wildcards, etc)
     * @method isValidConnection
     * @param {String} type_a
     * @param {String} type_b
     * @return {Boolean} true if they can be connected
     */
    isValidConnection(typeA, typeB) {
      if (typeA == "" || typeA === "*") {
        typeA = 0;
      }
      if (typeB == "" || typeB === "*") {
        typeB = 0;
      }
      if (!typeA || // generic output
      !typeB || // generic input
      typeA == typeB || // same type (is valid for triggers)
      typeA == this.host.EVENT && typeB == this.host.ACTION) {
        return true;
      }
      let normalizedA = String(typeA).toLowerCase();
      let normalizedB = String(typeB).toLowerCase();
      if (normalizedA.indexOf(",") === -1 && normalizedB.indexOf(",") === -1) {
        return normalizedA === normalizedB;
      }
      const supportedTypesA = normalizedA.split(",");
      const supportedTypesB = normalizedB.split(",");
      for (let i2 = 0; i2 < supportedTypesA.length; ++i2) {
        for (let j = 0; j < supportedTypesB.length; ++j) {
          if (this.isValidConnection(
            supportedTypesA[i2],
            supportedTypesB[j]
          )) {
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
    registerSearchboxExtra(nodeType, description, data) {
      this.host.searchbox_extras[description.toLowerCase()] = {
        type: nodeType,
        desc: description,
        data
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
    fetchFile(url, type = "text", onComplete, onError) {
      if (!url) {
        return null;
      }
      if (url.constructor === String) {
        let normalizedUrl = url;
        if (normalizedUrl.substr(0, 4) === "http" && this.host.proxy) {
          normalizedUrl = this.host.proxy + normalizedUrl.substr(normalizedUrl.indexOf(":") + 3);
        }
        return fetch(normalizedUrl).then((response) => {
          if (!response.ok) {
            throw new Error("File not found");
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
        }).then((data) => {
          if (onComplete) {
            onComplete(data);
          }
        }).catch((error) => {
          console.error("error fetching file:", normalizedUrl);
          if (onError) {
            onError(error);
          }
        });
      }
      if (url.constructor === File || url.constructor === Blob) {
        const reader = new FileReader();
        reader.onload = (event2) => {
          var _a2;
          let value = (_a2 = event2.target) == null ? void 0 : _a2.result;
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
  class LLink {
    constructor(id, type, origin_id, origin_slot, target_id, target_slot) {
      this.id = id;
      this.type = type;
      this.origin_id = origin_id;
      this.origin_slot = origin_slot;
      this.target_id = target_id;
      this.target_slot = target_slot;
      this._data = null;
      this._pos = new Float32Array(2);
    }
    configure(o) {
      const source = o;
      if (Array.isArray(source)) {
        if (typeof source[1] === "string") {
          this.id = source[0];
          this.type = source[1];
          this.origin_id = source[2];
          this.origin_slot = source[3];
          this.target_id = source[4];
          this.target_slot = source[5];
          return;
        }
        this.id = source[0];
        this.origin_id = source[1];
        this.origin_slot = source[2];
        this.target_id = source[3];
        this.target_slot = source[4];
        this.type = source[5];
        return;
      }
      this.id = source.id;
      this.type = source.type;
      this.origin_id = source.origin_id;
      this.origin_slot = source.origin_slot;
      this.target_id = source.target_id;
      this.target_slot = source.target_slot;
    }
    serialize() {
      return [
        this.id,
        this.origin_id,
        this.origin_slot,
        this.target_id,
        this.target_slot,
        this.type
      ];
    }
  }
  const defaultLiteGraphLifecycleHost = {
    debug: false,
    getTime: () => Date.now()
  };
  let LGraph$1 = (_b = class {
    constructor(o) {
      this.list_of_graphcanvas = null;
      this.status = _b.STATUS_STOPPED;
      this.last_node_id = 0;
      this.last_link_id = 0;
      this._version = -1;
      this._nodes = [];
      this._nodes_by_id = {};
      this._nodes_in_order = [];
      this._nodes_executable = null;
      this._groups = [];
      this.links = {};
      this.iteration = 0;
      this.config = {};
      this.vars = {};
      this.extra = {};
      this.globaltime = 0;
      this.runningtime = 0;
      this.fixedtime = 0;
      this.fixedtime_lapse = 0.01;
      this.elapsed_time = 0.01;
      this.last_update_time = 0;
      this.starttime = 0;
      this.catch_errors = true;
      this.nodes_executing = [];
      this.nodes_actioning = [];
      this.nodes_executedAction = [];
      this.inputs = {};
      this.outputs = {};
      this.execution_timer_id = null;
      if (this.getLifecycleHost().debug) {
        console.log("Graph created");
      }
      this.list_of_graphcanvas = null;
      this.clear();
      if (o) {
        this.configure(o);
      }
    }
    getLifecycleHost() {
      const ctor = this.constructor;
      const host = ctor.liteGraph || _b.liteGraph || {};
      return { ...defaultLiteGraphLifecycleHost, ...host };
    }
    getSupportedTypes() {
      return this.supported_types || _b.supported_types;
    }
    /**
     * Removes all nodes from this graph
     * @method clear
     */
    clear() {
      this.stop();
      this.status = _b.STATUS_STOPPED;
      this.last_node_id = 0;
      this.last_link_id = 0;
      this._version = -1;
      if (this._nodes) {
        for (let i2 = 0; i2 < this._nodes.length; ++i2) {
          const node2 = this._nodes[i2];
          if (node2.onRemoved) {
            node2.onRemoved();
          }
        }
      }
      this._nodes = [];
      this._nodes_by_id = {};
      this._nodes_in_order = [];
      this._nodes_executable = null;
      this._groups = [];
      this.links = {};
      this.iteration = 0;
      this.config = {};
      this.vars = {};
      this.extra = {};
      this.globaltime = 0;
      this.runningtime = 0;
      this.fixedtime = 0;
      this.fixedtime_lapse = 0.01;
      this.elapsed_time = 0.01;
      this.last_update_time = 0;
      this.starttime = 0;
      this.catch_errors = true;
      this.nodes_executing = [];
      this.nodes_actioning = [];
      this.nodes_executedAction = [];
      this.inputs = {};
      this.outputs = {};
      this.change();
      this.sendActionToCanvas("clear");
    }
    /**
     * Attach Canvas to this graph
     * @method attachCanvas
     */
    attachCanvas(graphcanvas) {
      const host = this.getLifecycleHost();
      if (!graphcanvas || typeof graphcanvas !== "object" || host.LGraphCanvas && graphcanvas.constructor != host.LGraphCanvas) {
        throw "attachCanvas expects a LGraphCanvas instance";
      }
      const currentGraph = graphcanvas.graph;
      if (currentGraph && currentGraph !== this) {
        currentGraph.detachCanvas(graphcanvas);
      }
      graphcanvas.graph = this;
      if (!this.list_of_graphcanvas) {
        this.list_of_graphcanvas = [];
      }
      this.list_of_graphcanvas.push(graphcanvas);
    }
    /**
     * Detach Canvas from this graph
     * @method detachCanvas
     */
    detachCanvas(graphcanvas) {
      if (!this.list_of_graphcanvas) {
        return;
      }
      const pos2 = this.list_of_graphcanvas.indexOf(graphcanvas);
      if (pos2 === -1) {
        return;
      }
      graphcanvas.graph = null;
      this.list_of_graphcanvas.splice(pos2, 1);
    }
    /**
     * Starts running this graph every interval milliseconds.
     * @method start
     * @param {number} interval amount of milliseconds between executions, if 0 then it renders to the monitor refresh rate
     */
    start(interval) {
      if (this.status == _b.STATUS_RUNNING) {
        return;
      }
      this.status = _b.STATUS_RUNNING;
      if (this.onPlayEvent) {
        this.onPlayEvent();
      }
      this.sendEventToAllNodes("onStart");
      this.starttime = this.getLifecycleHost().getTime();
      this.last_update_time = this.starttime;
      interval = interval || 0;
      const that2 = this;
      if (interval == 0 && typeof window != "undefined" && window.requestAnimationFrame) {
        const on_frame = () => {
          if (that2.execution_timer_id != -1) {
            return;
          }
          window.requestAnimationFrame(on_frame);
          if (that2.onBeforeStep) {
            that2.onBeforeStep();
          }
          that2.runStep(1, !that2.catch_errors);
          if (that2.onAfterStep) {
            that2.onAfterStep();
          }
        };
        this.execution_timer_id = -1;
        on_frame();
      } else {
        this.execution_timer_id = setInterval(function() {
          if (that2.onBeforeStep) {
            that2.onBeforeStep();
          }
          that2.runStep(1, !that2.catch_errors);
          if (that2.onAfterStep) {
            that2.onAfterStep();
          }
        }, interval);
      }
    }
    /**
     * Stops the execution loop of the graph
     * @method stop execution
     */
    stop() {
      if (this.status == _b.STATUS_STOPPED) {
        return;
      }
      this.status = _b.STATUS_STOPPED;
      if (this.onStopEvent) {
        this.onStopEvent();
      }
      if (this.execution_timer_id != null) {
        if (this.execution_timer_id != -1) {
          clearInterval(this.execution_timer_id);
        }
        this.execution_timer_id = null;
      }
      this.sendEventToAllNodes("onStop");
    }
    /**
     * Returns the amount of time the graph has been running in milliseconds
     * @method getTime
     * @return {number} number of milliseconds the graph has been running
     */
    getTime() {
      return this.globaltime;
    }
    /**
     * Returns the amount of time accumulated using the fixedtime_lapse var. This is used in context where the time increments should be constant
     * @method getFixedTime
     * @return {number} number of milliseconds the graph has been running
     */
    getFixedTime() {
      return this.fixedtime;
    }
    /**
     * Returns the amount of time it took to compute the latest iteration. Take into account that this number could be not correct
     * if the nodes are using graphical actions
     * @method getElapsedTime
     * @return {number} number of milliseconds it took the last cycle
     */
    getElapsedTime() {
      return this.elapsed_time;
    }
    // placeholders to keep lifecycle module self-contained during incremental migration.
    configure(_data, _keep_old) {
      return void 0;
    }
    runStep(_num, _do_not_catch_errors) {
    }
    change() {
    }
    sendActionToCanvas(_action, ..._params) {
    }
    sendEventToAllNodes(_eventname, _params, _mode) {
    }
  }, _b.supported_types = ["number", "string", "boolean"], _b.STATUS_STOPPED = 1, _b.STATUS_RUNNING = 2, _b.liteGraph = defaultLiteGraphLifecycleHost, _b);
  const defaultExecutionHost$1 = {
    debug: false,
    getTime: () => Date.now(),
    use_deferred_actions: true,
    ALWAYS: 0,
    throw_errors: true,
    NODE_TITLE_HEIGHT: 30,
    VERTICAL_LAYOUT: "vertical"
  };
  class LGraphExecution extends LGraph$1 {
    constructor() {
      super(...arguments);
      this.errors_in_execution = false;
      this.execution_time = 0;
    }
    getExecutionHost() {
      const ctor = this.constructor;
      const host = ctor.liteGraph || LGraphExecution.liteGraph || LGraph$1.liteGraph || {};
      return { ...defaultExecutionHost$1, ...host };
    }
    getNodeByIdExecution(id) {
      const nodesById = this._nodes_by_id;
      return nodesById[String(id)] || null;
    }
    /**
     * Run N steps (cycles) of the graph
     * @method runStep
     * @param {number} num number of steps to run, default is 1
     * @param {Boolean} do_not_catch_errors [optional] if you want to try/catch errors
     * @param {number} limit max number of nodes to execute (used to execute from start to a node)
     */
    runStep(num, do_not_catch_errors, limit) {
      const liteGraph = this.getExecutionHost();
      num = num || 1;
      const start = liteGraph.getTime();
      this.globaltime = 1e-3 * (start - this.starttime);
      const nodes = this._nodes_executable ? this._nodes_executable : this._nodes;
      if (!nodes) {
        return;
      }
      limit = limit || nodes.length;
      if (do_not_catch_errors) {
        for (let i2 = 0; i2 < num; i2++) {
          for (let j = 0; j < limit; ++j) {
            const node2 = nodes[j];
            if (liteGraph.use_deferred_actions && node2._waiting_actions && node2._waiting_actions.length) {
              node2.executePendingActions();
            }
            if (node2.mode == liteGraph.ALWAYS && node2.onExecute) {
              node2.doExecute();
            }
          }
          this.fixedtime += this.fixedtime_lapse;
          if (this.onExecuteStep) {
            this.onExecuteStep();
          }
        }
        if (this.onAfterExecute) {
          this.onAfterExecute();
        }
      } else {
        try {
          for (let i2 = 0; i2 < num; i2++) {
            for (let j = 0; j < limit; ++j) {
              const node2 = nodes[j];
              if (liteGraph.use_deferred_actions && node2._waiting_actions && node2._waiting_actions.length) {
                node2.executePendingActions();
              }
              if (node2.mode == liteGraph.ALWAYS && node2.onExecute) {
                node2.onExecute();
              }
            }
            this.fixedtime += this.fixedtime_lapse;
            if (this.onExecuteStep) {
              this.onExecuteStep();
            }
          }
          if (this.onAfterExecute) {
            this.onAfterExecute();
          }
          this.errors_in_execution = false;
        } catch (err) {
          this.errors_in_execution = true;
          if (liteGraph.throw_errors) {
            throw err;
          }
          if (liteGraph.debug) {
            console.log("Error during execution: " + err);
          }
          this.stop();
        }
      }
      const now = liteGraph.getTime();
      let elapsed = now - start;
      if (elapsed == 0) {
        elapsed = 1;
      }
      this.execution_time = 1e-3 * elapsed;
      this.globaltime += 1e-3 * elapsed;
      this.iteration += 1;
      this.elapsed_time = (now - this.last_update_time) * 1e-3;
      this.last_update_time = now;
      this.nodes_executing = [];
      this.nodes_actioning = [];
      this.nodes_executedAction = [];
    }
    /**
     * Updates the graph execution order according to relevance of the nodes (nodes with only outputs have more relevance than
     * nodes with only inputs.
     * @method updateExecutionOrder
     */
    updateExecutionOrder() {
      this._nodes_in_order = this.computeExecutionOrder(false);
      this._nodes_executable = [];
      for (let i2 = 0; i2 < this._nodes_in_order.length; ++i2) {
        const node2 = this._nodes_in_order[i2];
        if (node2.onExecute) {
          this._nodes_executable.push(node2);
        }
      }
    }
    // This is more internal, it computes the executable nodes in order and returns it
    computeExecutionOrder(only_onExecute, set_level) {
      let L = [];
      const S = [];
      const M = {};
      const visited_links = {};
      const remaining_links = {};
      for (let i2 = 0, l2 = this._nodes.length; i2 < l2; ++i2) {
        const node2 = this._nodes[i2];
        if (only_onExecute && !node2.onExecute) {
          continue;
        }
        M[String(node2.id)] = node2;
        let num = 0;
        if (node2.inputs) {
          for (let j = 0, l22 = node2.inputs.length; j < l22; j++) {
            if (node2.inputs[j] && node2.inputs[j].link != null) {
              num += 1;
            }
          }
        }
        if (num == 0) {
          S.push(node2);
          if (set_level) {
            node2._level = 1;
          }
        } else {
          if (set_level) {
            node2._level = 0;
          }
          remaining_links[String(node2.id)] = num;
        }
      }
      while (true) {
        if (S.length == 0) {
          break;
        }
        const node2 = S.shift();
        L.push(node2);
        delete M[String(node2.id)];
        if (!node2.outputs) {
          continue;
        }
        for (let i2 = 0; i2 < node2.outputs.length; i2++) {
          const output = node2.outputs[i2];
          if (output == null || output.links == null || output.links.length == 0) {
            continue;
          }
          for (let j = 0; j < output.links.length; j++) {
            const link_id = output.links[j];
            const link = this.links[link_id];
            if (!link) {
              continue;
            }
            if (visited_links[link.id]) {
              continue;
            }
            const target_node = this.getNodeByIdExecution(link.target_id);
            if (target_node == null) {
              visited_links[link.id] = true;
              continue;
            }
            if (set_level && (!target_node._level || target_node._level <= node2._level)) {
              target_node._level = node2._level + 1;
            }
            visited_links[link.id] = true;
            const targetNodeId = String(target_node.id);
            remaining_links[targetNodeId] -= 1;
            if (remaining_links[targetNodeId] == 0) {
              S.push(target_node);
            }
          }
        }
      }
      for (const i2 in M) {
        L.push(M[i2]);
      }
      if (L.length != this._nodes.length && this.getExecutionHost().debug) {
        console.warn("something went wrong, nodes missing");
      }
      const l = L.length;
      for (let i2 = 0; i2 < l; ++i2) {
        L[i2].order = i2;
      }
      L = L.sort(function(A, B) {
        const Ap = A.constructor.priority || A.priority || 0;
        const Bp = B.constructor.priority || B.priority || 0;
        if (Ap == Bp) {
          return A.order - B.order;
        }
        return Ap - Bp;
      });
      for (let i2 = 0; i2 < l; ++i2) {
        L[i2].order = i2;
      }
      return L;
    }
    /**
     * Returns all the nodes that could affect this one (ancestors) by crawling all the inputs recursively.
     * It doesn't include the node itself
     * @method getAncestors
     * @return {Array} an array with all the LGraphNodes that affect this node, in order of execution
     */
    getAncestors(node2) {
      const ancestors = [];
      const pending = [node2];
      const visited = {};
      while (pending.length) {
        const current = pending.shift();
        if (!current.inputs) {
          continue;
        }
        if (!visited[current.id] && current != node2) {
          visited[current.id] = true;
          ancestors.push(current);
        }
        for (let i2 = 0; i2 < current.inputs.length; ++i2) {
          const input = current.getInputNode(i2);
          if (input && ancestors.indexOf(input) == -1) {
            pending.push(input);
          }
        }
      }
      ancestors.sort(function(a, b) {
        return a.order - b.order;
      });
      return ancestors;
    }
    /**
     * Positions every node in a more readable manner
     * @method arrange
     */
    arrange(margin, layout) {
      const liteGraph = this.getExecutionHost();
      margin = margin || 100;
      const nodes = this.computeExecutionOrder(false, true);
      const columns = [];
      for (let i2 = 0; i2 < nodes.length; ++i2) {
        const node2 = nodes[i2];
        const col = node2._level || 1;
        if (!columns[col]) {
          columns[col] = [];
        }
        columns[col].push(node2);
      }
      let x2 = margin;
      for (let i2 = 0; i2 < columns.length; ++i2) {
        const column = columns[i2];
        if (!column) {
          continue;
        }
        let max_size = 100;
        let y2 = margin + liteGraph.NODE_TITLE_HEIGHT;
        for (let j = 0; j < column.length; ++j) {
          const node2 = column[j];
          node2.pos[0] = layout == liteGraph.VERTICAL_LAYOUT ? y2 : x2;
          node2.pos[1] = layout == liteGraph.VERTICAL_LAYOUT ? x2 : y2;
          const max_size_index = layout == liteGraph.VERTICAL_LAYOUT ? 1 : 0;
          if (node2.size[max_size_index] > max_size) {
            max_size = node2.size[max_size_index];
          }
          const node_size_index = layout == liteGraph.VERTICAL_LAYOUT ? 0 : 1;
          y2 += node2.size[node_size_index] + margin + liteGraph.NODE_TITLE_HEIGHT;
        }
        x2 += max_size + margin;
      }
      this.setDirtyCanvas(
        true,
        true
      );
    }
  }
  const LGRAPH_ON_NODE_ADDED_DIFF_ID = "graph-hooks.on-node-added";
  function hasGraphOnNodeAddedCompatHook(graph) {
    return typeof graph.onNodeAdded === "function";
  }
  function invokeGraphOnNodeAddedCompatHook(graph, node2) {
    const rawHook = graph.onNodeAdded;
    if (!rawHook) {
      return false;
    }
    rawHook(node2);
    return true;
  }
  const defaultStructureHost = {
    debug: false,
    getTime: () => Date.now(),
    use_uuids: false,
    uuidv4: () => "",
    MAX_NUMBER_OF_NODES: 1e3
  };
  class LGraphStructure extends LGraphExecution {
    getStructureHost() {
      const ctor = this.constructor;
      const host = ctor.liteGraph || LGraphStructure.liteGraph || LGraphExecution.liteGraph || {};
      return { ...defaultStructureHost, ...host };
    }
    getNodesByIdMap() {
      return this._nodes_by_id;
    }
    getNodeArray() {
      return this._nodes;
    }
    getGroupArray() {
      return this._groups;
    }
    isGroupNode(node2, host) {
      if (!node2 || typeof node2 !== "object") {
        return false;
      }
      const groupNode = node2;
      if (host.LGraphGroup && groupNode.constructor === host.LGraphGroup) {
        return true;
      }
      return typeof groupNode.constructor === "function" && groupNode.constructor.name === "LGraphGroup";
    }
    /**
     * Adds a new node instance to this graph
     * @method add
     * @param {LGraphNode} node the instance of the node
     */
    add(node2, skip_compute_order) {
      if (!node2) {
        return void 0;
      }
      const host = this.getStructureHost();
      if (this.isGroupNode(node2, host)) {
        this.getGroupArray().push(node2);
        this.setDirtyCanvas(true);
        this.change();
        node2.graph = this;
        this._version++;
        return node2;
      }
      const graphNode = node2;
      const nodesById = this.getNodesByIdMap();
      if (graphNode.id != -1 && nodesById[String(graphNode.id)] != null) {
        console.warn(
          "LiteGraph: there is already a node with this ID, changing it"
        );
        if (host.use_uuids) {
          graphNode.id = host.uuidv4();
        } else {
          graphNode.id = ++this.last_node_id;
        }
      }
      if (this.getNodeArray().length >= host.MAX_NUMBER_OF_NODES) {
        throw "LiteGraph: max number of nodes in a graph reached";
      }
      if (host.use_uuids) {
        if (graphNode.id == null || graphNode.id == -1) {
          graphNode.id = host.uuidv4();
        }
      } else {
        if (graphNode.id == null || graphNode.id == -1) {
          graphNode.id = ++this.last_node_id;
        } else if (this.last_node_id < graphNode.id) {
          this.last_node_id = graphNode.id;
        }
      }
      graphNode.graph = this;
      this._version++;
      this.getNodeArray().push(graphNode);
      nodesById[String(graphNode.id)] = graphNode;
      if (graphNode.onAdded) {
        graphNode.onAdded(this);
      }
      if (this.config.align_to_grid) {
        graphNode.alignToGrid();
      }
      if (!skip_compute_order) {
        this.updateExecutionOrder();
      }
      invokeGraphOnNodeAddedCompatHook(
        this,
        graphNode
      );
      this.setDirtyCanvas(true);
      this.change();
      return graphNode;
    }
    /**
     * Removes a node from the graph
     * @method remove
     * @param {LGraphNode} node the instance of the node
     */
    remove(node2) {
      const host = this.getStructureHost();
      if (this.isGroupNode(node2, host)) {
        const groups = this.getGroupArray();
        const index = groups.indexOf(node2);
        if (index != -1) {
          groups.splice(index, 1);
        }
        node2.graph = null;
        this._version++;
        this.setDirtyCanvas(true, true);
        this.change();
        return;
      }
      const graphNode = node2;
      const nodesById = this.getNodesByIdMap();
      if (nodesById[String(graphNode.id)] == null) {
        return;
      }
      if (graphNode.ignore_remove) {
        return;
      }
      this.beforeChange();
      if (graphNode.inputs) {
        for (let i2 = 0; i2 < graphNode.inputs.length; i2++) {
          const slot = graphNode.inputs[i2];
          if (slot && slot.link != null) {
            graphNode.disconnectInput(i2);
          }
        }
      }
      if (graphNode.outputs) {
        for (let i2 = 0; i2 < graphNode.outputs.length; i2++) {
          const slot = graphNode.outputs[i2];
          if (slot && slot.links != null && slot.links.length) {
            graphNode.disconnectOutput(i2);
          }
        }
      }
      if (graphNode.onRemoved) {
        graphNode.onRemoved();
      }
      graphNode.graph = null;
      this._version++;
      const canvasList = this.list_of_graphcanvas;
      if (canvasList) {
        for (let i2 = 0; i2 < canvasList.length; ++i2) {
          const canvas = canvasList[i2];
          const selectedNodes = canvas.selected_nodes;
          if (selectedNodes && selectedNodes[String(graphNode.id)]) {
            delete selectedNodes[String(graphNode.id)];
          }
          if (canvas.node_dragged == graphNode) {
            canvas.node_dragged = null;
          }
        }
      }
      const nodes = this.getNodeArray();
      const pos2 = nodes.indexOf(graphNode);
      if (pos2 != -1) {
        nodes.splice(pos2, 1);
      }
      delete nodesById[String(graphNode.id)];
      if (this.onNodeRemoved) {
        this.onNodeRemoved(graphNode);
      }
      this.sendActionToCanvas("checkPanels");
      this.setDirtyCanvas(true, true);
      this.afterChange();
      this.change();
      this.updateExecutionOrder();
    }
    /**
     * Returns a node by its id.
     * @method getNodeById
     * @param {Number} id
     */
    getNodeById(id) {
      if (id == null) {
        return null;
      }
      return this.getNodesByIdMap()[String(id)];
    }
    /**
     * Returns a list of nodes that matches a class
     * @method findNodesByClass
     * @param {Class} classObject the class itself (not an string)
     * @return {Array} a list with all the nodes of this type
     */
    findNodesByClass(classObject, result) {
      const output = result || [];
      output.length = 0;
      const nodes = this.getNodeArray();
      for (let i2 = 0, l = nodes.length; i2 < l; ++i2) {
        if (nodes[i2].constructor === classObject) {
          output.push(nodes[i2]);
        }
      }
      return output;
    }
    /**
     * Returns a list of nodes that matches a type
     * @method findNodesByType
     * @param {String} type the name of the node type
     * @return {Array} a list with all the nodes of this type
     */
    findNodesByType(type, result) {
      const loweredType = type.toLowerCase();
      const output = result || [];
      output.length = 0;
      const nodes = this.getNodeArray();
      for (let i2 = 0, l = nodes.length; i2 < l; ++i2) {
        if (nodes[i2].type.toLowerCase() == loweredType) {
          output.push(nodes[i2]);
        }
      }
      return output;
    }
    /**
     * Returns the first node that matches a name in its title
     * @method findNodeByTitle
     * @param {String} name the name of the node to search
     * @return {Node} the node or null
     */
    findNodeByTitle(title) {
      const nodes = this.getNodeArray();
      for (let i2 = 0, l = nodes.length; i2 < l; ++i2) {
        if (nodes[i2].title == title) {
          return nodes[i2];
        }
      }
      return null;
    }
    /**
     * Returns a list of nodes that matches a name
     * @method findNodesByTitle
     * @param {String} name the name of the node to search
     * @return {Array} a list with all the nodes with this name
     */
    findNodesByTitle(title) {
      const result = [];
      const nodes = this.getNodeArray();
      for (let i2 = 0, l = nodes.length; i2 < l; ++i2) {
        if (nodes[i2].title == title) {
          result.push(nodes[i2]);
        }
      }
      return result;
    }
    /**
     * Returns the top-most node in this position of the canvas
     * @method getNodeOnPos
     * @param {number} x the x coordinate in canvas space
     * @param {number} y the y coordinate in canvas space
     * @param {Array} nodes_list a list with all the nodes to search from, by default is all the nodes in the graph
     * @return {LGraphNode} the node at this position or null
     */
    getNodeOnPos(x2, y2, nodes_list, margin) {
      const host = this.getStructureHost();
      const list = nodes_list || this._nodes;
      let nRet = null;
      for (let i2 = list.length - 1; i2 >= 0; i2--) {
        const n = list[i2];
        if (n.isPointInside(x2, y2, margin)) {
          if (this.isGroupNode(n, host)) {
            if (!nRet) {
              nRet = n;
            }
            continue;
          }
          return n;
        }
      }
      return nRet;
    }
    /**
     * Returns the top-most group in that position
     * @method getGroupOnPos
     * @param {number} x the x coordinate in canvas space
     * @param {number} y the y coordinate in canvas space
     * @return {LGraphGroup} the group or null
     */
    getGroupOnPos(x2, y2) {
      const groups = this.getGroupArray();
      for (let i2 = groups.length - 1; i2 >= 0; i2--) {
        const g = groups[i2];
        if (g.isPointInside(x2, y2, 2, true)) {
          return g;
        }
      }
      return null;
    }
    /**
     * Checks that the node type matches the node type registered, used when replacing a nodetype by a newer version during execution
     * this replaces the ones using the old version with the new version
     * @method checkNodeTypes
     */
    checkNodeTypes() {
      const host = this.getStructureHost();
      const nodes = this.getNodeArray();
      const nodesById = this.getNodesByIdMap();
      for (let i2 = 0; i2 < nodes.length; i2++) {
        const node2 = nodes[i2];
        const ctor = host.registered_node_types ? host.registered_node_types[node2.type] : void 0;
        if (node2.constructor == ctor) {
          continue;
        }
        console.log("node being replaced by newer version: " + node2.type);
        const newnode = host.createNode(node2.type);
        nodes[i2] = newnode;
        newnode.configure(node2.serialize());
        newnode.graph = this;
        nodesById[String(newnode.id)] = newnode;
        if (node2.inputs) {
          newnode.inputs = node2.inputs.concat();
        }
        if (node2.outputs) {
          newnode.outputs = node2.outputs.concat();
        }
      }
      this.updateExecutionOrder();
    }
    // placeholders to keep this module self-contained during incremental migration.
    beforeChange(_info) {
    }
    afterChange(_info) {
    }
    setDirtyCanvas(_fg, _bg) {
    }
  }
  const defaultIOEventsHost = {
    debug: false,
    getTime: () => Date.now(),
    ALWAYS: 0
  };
  class LGraphIOEvents extends LGraphStructure {
    constructor() {
      super(...arguments);
      this._input_nodes = [];
    }
    getIOEventsHost() {
      const ctor = this.constructor;
      const host = ctor.liteGraph || LGraphIOEvents.liteGraph || LGraphStructure.liteGraph || {};
      return { ...defaultIOEventsHost, ...host };
    }
    getNodesInEventOrder() {
      const ordered = this._nodes_in_order;
      const fallback = this._nodes;
      return ordered || fallback;
    }
    getInputSlots() {
      return this.inputs;
    }
    getOutputSlots() {
      return this.outputs;
    }
    getCanvasList() {
      return this.list_of_graphcanvas;
    }
    /**
     * Sends an event to all the nodes, useful to trigger stuff
     * @method sendEventToAllNodes
     * @param {String} eventname the name of the event (function to be called)
     * @param {Array} params parameters in array format
     */
    sendEventToAllNodes(eventname, params, mode) {
      const host = this.getIOEventsHost();
      const targetMode = mode || host.ALWAYS;
      const nodes = this.getNodesInEventOrder();
      if (!nodes) {
        return;
      }
      for (let j = 0, l = nodes.length; j < l; ++j) {
        const node2 = nodes[j];
        if (node2.constructor === host.Subgraph && eventname != "onExecute") {
          if (node2.mode == targetMode) {
            node2.sendEventToAllNodes(eventname, params, targetMode);
          }
          continue;
        }
        if (!node2[eventname] || node2.mode != targetMode) {
          continue;
        }
        if (params === void 0) {
          node2[eventname].call(node2);
        } else if (params.constructor === Array) {
          node2[eventname].apply(
            node2,
            params
          );
        } else {
          node2[eventname].call(node2, params);
        }
      }
    }
    sendActionToCanvas(action, params) {
      const canvasList = this.getCanvasList();
      if (!canvasList) {
        return;
      }
      for (let i2 = 0; i2 < canvasList.length; ++i2) {
        const canvas = canvasList[i2];
        if (canvas[action]) {
          canvas[action].apply(
            canvas,
            params
          );
        }
      }
    }
    onAction(action, param, options) {
      const host = this.getIOEventsHost();
      this._input_nodes = this.findNodesByClass(
        host.GraphInput,
        this._input_nodes
      );
      for (let i2 = 0; i2 < this._input_nodes.length; ++i2) {
        const node2 = this._input_nodes[i2];
        if (node2.properties.name != action) {
          continue;
        }
        node2.actionDo(action, param, options);
        break;
      }
    }
    trigger(action, param) {
      if (this.onTrigger) {
        this.onTrigger(action, param);
      }
    }
    /**
     * Tell this graph it has a global graph input of this type
     * @method addGlobalInput
     * @param {String} name
     * @param {String} type
     * @param {*} value [optional]
     */
    addInput(name, type, value) {
      const input = this.getInputSlots()[name];
      if (input) {
        return;
      }
      this.beforeChange();
      this.getInputSlots()[name] = { name, type, value };
      this._version++;
      this.afterChange();
      if (this.onInputAdded) {
        this.onInputAdded(name, type);
      }
      if (this.onInputsOutputsChange) {
        this.onInputsOutputsChange();
      }
    }
    /**
     * Assign a data to the global graph input
     * @method setGlobalInputData
     * @param {String} name
     * @param {*} data
     */
    setInputData(name, data) {
      const input = this.getInputSlots()[name];
      if (!input) {
        return;
      }
      input.value = data;
    }
    /**
     * Returns the current value of a global graph input
     * @method getInputData
     * @param {String} name
     * @return {*} the data
     */
    getInputData(name) {
      const input = this.getInputSlots()[name];
      if (!input) {
        return null;
      }
      return input.value;
    }
    /**
     * Changes the name of a global graph input
     * @method renameInput
     * @param {String} old_name
     * @param {String} new_name
     */
    renameInput(old_name, name) {
      if (name == old_name) {
        return;
      }
      const inputs = this.getInputSlots();
      if (!inputs[old_name]) {
        return false;
      }
      if (inputs[name]) {
        console.error("there is already one input with that name");
        return false;
      }
      inputs[name] = inputs[old_name];
      delete inputs[old_name];
      this._version++;
      if (this.onInputRenamed) {
        this.onInputRenamed(old_name, name);
      }
      if (this.onInputsOutputsChange) {
        this.onInputsOutputsChange();
      }
      return;
    }
    /**
     * Changes the type of a global graph input
     * @method changeInputType
     * @param {String} name
     * @param {String} type
     */
    changeInputType(name, type) {
      const inputs = this.getInputSlots();
      if (!inputs[name]) {
        return false;
      }
      if (inputs[name].type && String(inputs[name].type).toLowerCase() == String(type).toLowerCase()) {
        return;
      }
      inputs[name].type = type;
      this._version++;
      if (this.onInputTypeChanged) {
        this.onInputTypeChanged(name, type);
      }
      return;
    }
    /**
     * Removes a global graph input
     * @method removeInput
     * @param {String} name
     * @param {String} type
     */
    removeInput(name) {
      const inputs = this.getInputSlots();
      if (!inputs[name]) {
        return false;
      }
      delete inputs[name];
      this._version++;
      if (this.onInputRemoved) {
        this.onInputRemoved(name);
      }
      if (this.onInputsOutputsChange) {
        this.onInputsOutputsChange();
      }
      return true;
    }
    /**
     * Creates a global graph output
     * @method addOutput
     * @param {String} name
     * @param {String} type
     * @param {*} value
     */
    addOutput(name, type, value) {
      this.getOutputSlots()[name] = { name, type, value };
      this._version++;
      if (this.onOutputAdded) {
        this.onOutputAdded(name, type);
      }
      if (this.onInputsOutputsChange) {
        this.onInputsOutputsChange();
      }
    }
    /**
     * Assign a data to the global output
     * @method setOutputData
     * @param {String} name
     * @param {String} value
     */
    setOutputData(name, value) {
      const output = this.getOutputSlots()[name];
      if (!output) {
        return;
      }
      output.value = value;
    }
    /**
     * Returns the current value of a global graph output
     * @method getOutputData
     * @param {String} name
     * @return {*} the data
     */
    getOutputData(name) {
      const output = this.getOutputSlots()[name];
      if (!output) {
        return null;
      }
      return output.value;
    }
    /**
     * Renames a global graph output
     * @method renameOutput
     * @param {String} old_name
     * @param {String} new_name
     */
    renameOutput(old_name, name) {
      const outputs = this.getOutputSlots();
      if (!outputs[old_name]) {
        return false;
      }
      if (outputs[name]) {
        console.error("there is already one output with that name");
        return false;
      }
      outputs[name] = outputs[old_name];
      delete outputs[old_name];
      this._version++;
      if (this.onOutputRenamed) {
        this.onOutputRenamed(old_name, name);
      }
      if (this.onInputsOutputsChange) {
        this.onInputsOutputsChange();
      }
      return;
    }
    /**
     * Changes the type of a global graph output
     * @method changeOutputType
     * @param {String} name
     * @param {String} type
     */
    changeOutputType(name, type) {
      const outputs = this.getOutputSlots();
      if (!outputs[name]) {
        return false;
      }
      if (outputs[name].type && String(outputs[name].type).toLowerCase() == String(type).toLowerCase()) {
        return;
      }
      outputs[name].type = type;
      this._version++;
      if (this.onOutputTypeChanged) {
        this.onOutputTypeChanged(name, type);
      }
      return;
    }
    /**
     * Removes a global graph output
     * @method removeOutput
     * @param {String} name
     */
    removeOutput(name) {
      const outputs = this.getOutputSlots();
      if (!outputs[name]) {
        return false;
      }
      delete outputs[name];
      this._version++;
      if (this.onOutputRemoved) {
        this.onOutputRemoved(name);
      }
      if (this.onInputsOutputsChange) {
        this.onInputsOutputsChange();
      }
      return true;
    }
    triggerInput(name, value) {
      const nodes = this.findNodesByTitle(name);
      for (let i2 = 0; i2 < nodes.length; ++i2) {
        nodes[i2].onTrigger(value);
      }
    }
    setCallback(name, func) {
      const nodes = this.findNodesByTitle(name);
      for (let i2 = 0; i2 < nodes.length; ++i2) {
        nodes[i2].setTrigger(func);
      }
    }
    // used for undo, called before any change is made to the graph
    beforeChange(info) {
      if (this.onBeforeChange) {
        this.onBeforeChange(this, info);
      }
      this.sendActionToCanvas("onBeforeChange", this);
    }
    // used to resend actions, called after any change is made to the graph
    afterChange(info) {
      if (this.onAfterChange) {
        this.onAfterChange(this, info);
      }
      this.sendActionToCanvas("onAfterChange", this);
    }
    connectionChange(node2, _link_info) {
      this.updateExecutionOrder();
      if (this.onConnectionChange) {
        this.onConnectionChange(node2);
      }
      this._version++;
      this.sendActionToCanvas("onConnectionChange");
    }
    /**
     * returns if the graph is in live mode
     * @method isLive
     */
    isLive() {
      const canvasList = this.getCanvasList();
      if (!canvasList) {
        return false;
      }
      for (let i2 = 0; i2 < canvasList.length; ++i2) {
        const canvas = canvasList[i2];
        if (canvas.live_mode) {
          return true;
        }
      }
      return false;
    }
    /**
     * clears the triggered slot animation in all links (stop visual animation)
     * @method clearTriggeredSlots
     */
    clearTriggeredSlots() {
      for (const i2 in this.links) {
        const linkInfo = this.links[i2];
        if (!linkInfo) {
          continue;
        }
        if (linkInfo._last_time) {
          linkInfo._last_time = 0;
        }
      }
    }
    /* Called when something visually changed (not the graph!) */
    change() {
      if (this.getIOEventsHost().debug) {
        console.log("Graph changed");
      }
      this.sendActionToCanvas("setDirty", [true, true]);
      if (this.on_change) {
        this.on_change(this);
      }
    }
    setDirtyCanvas(fg, bg) {
      this.sendActionToCanvas("setDirty", [fg, bg]);
    }
  }
  const defaultPersistenceHost = {
    debug: false,
    getTime: () => Date.now(),
    VERSION: 0
  };
  class LGraphPersistence extends LGraphIOEvents {
    getPersistenceHost() {
      const ctor = this.constructor;
      const host = ctor.liteGraph || LGraphPersistence.liteGraph || LGraphIOEvents.liteGraph || {};
      return { ...defaultPersistenceHost, ...host };
    }
    createFallbackNode(nInfo) {
      const host = this.getPersistenceHost();
      const LGraphNodeCtor = host.LGraphNode;
      const node2 = new LGraphNodeCtor();
      node2.last_serialization = nInfo;
      node2.has_errors = true;
      return node2;
    }
    /**
     * Destroys a link
     * @method removeLink
     * @param {Number} link_id
     */
    removeLink(link_id) {
      const link = this.links[link_id];
      if (!link) {
        return;
      }
      const node2 = this.getNodeById(
        link.target_id
      );
      if (node2) {
        node2.disconnectInput(link.target_slot);
      }
    }
    // save and recover app state ***************************************
    /**
     * Creates a Object containing all the info about this graph, it can be serialized
     * @method serialize
     * @return {Object} value of the node
     */
    serialize() {
      const nodesInfo = [];
      const nodes = this._nodes;
      for (let i2 = 0, l = nodes.length; i2 < l; ++i2) {
        nodesInfo.push(nodes[i2].serialize());
      }
      const links = [];
      const graphLinks = this.links;
      for (const i2 in graphLinks) {
        let link = graphLinks[i2];
        if (!link.serialize) {
          console.warn(
            "weird LLink bug, link info is not a LLink but a regular object"
          );
          const link2 = new LLink();
          for (const j in link) {
            link2[j] = link[j];
          }
          graphLinks[i2] = link2;
          link = graphLinks[i2];
        }
        links.push(link.serialize());
      }
      const groupsInfo = [];
      const groups = this._groups;
      for (let i2 = 0; i2 < groups.length; ++i2) {
        groupsInfo.push(groups[i2].serialize());
      }
      const data = {
        last_node_id: this.last_node_id,
        last_link_id: this.last_link_id,
        nodes: nodesInfo,
        links,
        groups: groupsInfo,
        config: this.config,
        extra: this.extra,
        version: this.getPersistenceHost().VERSION
      };
      if (this.onSerialize) {
        this.onSerialize(data);
      }
      return data;
    }
    /**
     * Configure a graph from a JSON string
     * @method configure
     * @param {String} str configure a graph from a JSON string
     * @param {Boolean} returns if there was any error parsing
     */
    configure(data, keep_old) {
      if (!data) {
        return void 0;
      }
      if (!keep_old) {
        this.clear();
      }
      const nodes = data.nodes;
      if (data.links && data.links.constructor === Array) {
        const links = [];
        for (let i2 = 0; i2 < data.links.length; ++i2) {
          const linkData = data.links[i2];
          if (!linkData) {
            console.warn("serialized graph link data contains errors, skipping.");
            continue;
          }
          const link = new LLink();
          link.configure(linkData);
          links[link.id] = link;
        }
        data.links = links;
      }
      for (const i2 in data) {
        if (i2 == "nodes" || i2 == "groups") {
          continue;
        }
        this[i2] = data[i2];
      }
      let error = false;
      this._nodes = [];
      if (nodes) {
        const host = this.getPersistenceHost();
        for (let i2 = 0, l = nodes.length; i2 < l; ++i2) {
          const nInfo = nodes[i2];
          const createNode = host.createNode;
          let node2 = createNode(nInfo.type, nInfo.title);
          if (!node2) {
            if (host.debug) {
              console.log(
                "Node not found or has errors: " + nInfo.type
              );
            }
            node2 = this.createFallbackNode(nInfo);
            error = true;
          }
          node2.id = nInfo.id;
          this.add(
            node2,
            true
          );
        }
        for (let i2 = 0, l = nodes.length; i2 < l; ++i2) {
          const nInfo = nodes[i2];
          const node2 = this.getNodeById(
            nInfo.id
          );
          if (node2) {
            node2.configure(nInfo);
          }
        }
      }
      this._groups.length = 0;
      if (data.groups) {
        const host = this.getPersistenceHost();
        const LGraphGroupCtor = host.LGraphGroup;
        for (let i2 = 0; i2 < data.groups.length; ++i2) {
          const group = new LGraphGroupCtor();
          group.configure(data.groups[i2]);
          this.add(group);
        }
      }
      this.updateExecutionOrder();
      this.extra = data.extra || {};
      if (this.onConfigure) {
        this.onConfigure(data);
      }
      this._version++;
      this.setDirtyCanvas(true, true);
      return error;
    }
    load(url, callback) {
      const that2 = this;
      const isFileLike = url.constructor === File || url.constructor === Blob;
      if (isFileLike) {
        const reader = new FileReader();
        reader.addEventListener("load", function(event2) {
          const target = event2.target;
          const data = JSON.parse(String(target.result));
          that2.configure(data);
          if (callback) {
            callback();
          }
        });
        reader.readAsText(url);
        return;
      }
      const req = new XMLHttpRequest();
      req.open("GET", url, true);
      req.send(null);
      req.onload = function() {
        if (req.status !== 200) {
          console.error("Error loading graph:", req.status, req.response);
          return;
        }
        const data = JSON.parse(req.response);
        that2.configure(data);
        if (callback) {
          callback();
        }
      };
      req.onerror = function(err) {
        console.error("Error loading graph:", err);
      };
    }
    onNodeTrace(_node, _msg, _color) {
    }
  }
  const defaultLiteGraphNodeHost = {
    use_uuids: false,
    uuidv4: () => "",
    NODE_WIDTH: 140,
    INPUT: 1,
    OUTPUT: 2,
    cloneObject: (obj, target) => {
      if (obj == null) {
        return null;
      }
      const cloned = JSON.parse(JSON.stringify(obj));
      if (!target) {
        return cloned;
      }
      for (const key in cloned) {
        target[key] = cloned[key];
      }
      return target;
    }
  };
  let LGraphNode$1 = (_c = class {
    constructor(title) {
      this.graph_version = 0;
      this.is_selected = false;
      this.mouseOver = false;
      this._pos = new Float32Array(10);
      this.title = "Unnamed";
      this.type = null;
      this.size = [140, 60];
      this.graph = null;
      this.id = -1;
      this.inputs = [];
      this.outputs = [];
      this.connections = [];
      this.properties = {};
      this.properties_info = [];
      this.flags = {};
      this._ctor(title);
    }
    get pos() {
      if (!this._pos) {
        this._pos = new Float32Array(10);
      }
      return this._pos;
    }
    set pos(v2) {
      if (!v2 || v2.length < 2) {
        return;
      }
      if (!this._pos) {
        this._pos = new Float32Array(10);
      }
      this._pos[0] = v2[0];
      this._pos[1] = v2[1];
    }
    getHost() {
      const host = _c.liteGraph || {};
      return { ...defaultLiteGraphNodeHost, ...host };
    }
    getClassMeta() {
      return this.constructor;
    }
    _ctor(title) {
      this.title = title || "Unnamed";
      this.size = [this.getHost().NODE_WIDTH, 60];
      this.graph = null;
      this._pos = new Float32Array(10);
      Object.defineProperty(this, "pos", {
        set: (v2) => {
          if (!v2 || v2.length < 2) {
            return;
          }
          this._pos[0] = v2[0];
          this._pos[1] = v2[1];
        },
        get: () => this._pos,
        enumerable: true
      });
      if (this.getHost().use_uuids) {
        this.id = this.getHost().uuidv4();
      } else {
        this.id = -1;
      }
      this.type = null;
      this.inputs = [];
      this.outputs = [];
      this.connections = [];
      this.properties = {};
      this.properties_info = [];
      this.flags = {};
    }
    /**
     * configure a node from an object containing the serialized info
     * @method configure
     */
    configure(info) {
      var _a2;
      if (this.graph) {
        this.graph._version++;
      }
      const self = this;
      const infoRecord = info;
      for (const j in infoRecord) {
        if (j == "properties") {
          const properties = info.properties;
          for (const k in properties) {
            this.properties[k] = properties[k];
            if (this.onPropertyChanged) {
              this.onPropertyChanged(k, properties[k]);
            }
          }
          continue;
        }
        const fieldValue = infoRecord[j];
        if (fieldValue == null) {
          continue;
        } else if (typeof fieldValue == "object") {
          const selfField = self[j];
          const configuredField = selfField;
          if (configuredField && configuredField.configure) {
            configuredField.configure(fieldValue);
          } else {
            self[j] = this.getHost().cloneObject(
              fieldValue,
              selfField
            );
          }
        } else {
          self[j] = fieldValue;
        }
      }
      if (!info.title) {
        this.title = this.getClassMeta().title;
      }
      if (this.inputs) {
        for (let i2 = 0; i2 < this.inputs.length; ++i2) {
          const input = this.inputs[i2];
          const link_info = this.graph && input ? this.graph.links[input.link] : null;
          if (this.onConnectionsChange) {
            this.onConnectionsChange(
              this.getHost().INPUT,
              i2,
              true,
              link_info,
              input
            );
          }
          if (this.onInputAdded) {
            this.onInputAdded(input);
          }
        }
      }
      if (this.outputs) {
        for (let i2 = 0; i2 < this.outputs.length; ++i2) {
          const output = this.outputs[i2];
          if (!output.links) {
            continue;
          }
          for (let j = 0; j < output.links.length; ++j) {
            const link_info = this.graph ? this.graph.links[output.links[j]] : null;
            if (this.onConnectionsChange) {
              this.onConnectionsChange(
                this.getHost().OUTPUT,
                i2,
                true,
                link_info,
                output
              );
            }
          }
          if (this.onOutputAdded) {
            this.onOutputAdded(output);
          }
        }
      }
      if (this.widgets) {
        for (let i2 = 0; i2 < this.widgets.length; ++i2) {
          const widget = this.widgets[i2];
          if (!widget) {
            continue;
          }
          const propertyName = (_a2 = widget.options) == null ? void 0 : _a2.property;
          if (propertyName && this.properties[propertyName] != void 0) {
            widget.value = JSON.parse(
              JSON.stringify(this.properties[propertyName])
            );
          }
        }
        if (info.widgets_values) {
          for (let i2 = 0; i2 < info.widgets_values.length; ++i2) {
            if (this.widgets[i2]) {
              this.widgets[i2].value = info.widgets_values[i2];
            }
          }
        }
      }
      if (this.onConfigure) {
        this.onConfigure(info);
      }
    }
    /**
     * serialize the content
     * @method serialize
     */
    serialize() {
      const host = this.getHost();
      const o = {
        id: this.id,
        type: this.type,
        pos: this.pos,
        size: this.size,
        flags: host.cloneObject(this.flags),
        order: this.order,
        mode: this.mode
      };
      if (this.constructor === _c && this.last_serialization) {
        return this.last_serialization;
      }
      if (this.inputs) {
        o.inputs = this.inputs;
      }
      if (this.outputs) {
        for (let i2 = 0; i2 < this.outputs.length; i2++) {
          delete this.outputs[i2]._data;
        }
        o.outputs = this.outputs;
      }
      if (this.title && this.title != this.getClassMeta().title) {
        o.title = this.title;
      }
      if (this.properties) {
        o.properties = host.cloneObject(this.properties);
      }
      if (this.widgets && this.serialize_widgets) {
        o.widgets_values = [];
        for (let i2 = 0; i2 < this.widgets.length; ++i2) {
          if (this.widgets[i2]) {
            o.widgets_values[i2] = this.widgets[i2].value;
          } else {
            o.widgets_values[i2] = null;
          }
        }
      }
      if (!o.type) {
        o.type = this.getClassMeta().type;
      }
      if (this.color) {
        o.color = this.color;
      }
      if (this.bgcolor) {
        o.bgcolor = this.bgcolor;
      }
      if (this.boxcolor) {
        o.boxcolor = this.boxcolor;
      }
      if (this.shape) {
        o.shape = this.shape;
      }
      if (this.onSerialize) {
        if (this.onSerialize(o)) {
          console.warn(
            "node onSerialize shouldnt return anything, data should be stored in the object pass in the first parameter"
          );
        }
      }
      return o;
    }
    /* Creates a clone of this node */
    clone() {
      const createNode = this.getHost().createNode;
      const node2 = createNode(this.type);
      if (!node2) {
        return null;
      }
      const data = this.getHost().cloneObject(
        this.serialize()
      );
      if (data.inputs) {
        for (let i2 = 0; i2 < data.inputs.length; ++i2) {
          data.inputs[i2].link = null;
        }
      }
      if (data.outputs) {
        for (let i2 = 0; i2 < data.outputs.length; ++i2) {
          if (data.outputs[i2].links) {
            data.outputs[i2].links.length = 0;
          }
        }
      }
      delete data.id;
      if (this.getHost().use_uuids) {
        data.id = this.getHost().uuidv4();
      }
      node2.configure(data);
      return node2;
    }
    /**
     * serialize and stringify
     * @method toString
     */
    toString() {
      return JSON.stringify(this.serialize());
    }
    /**
     * get the title string
     * @method getTitle
     */
    getTitle() {
      return this.title || this.getClassMeta().title;
    }
    /**
     * sets the value of a property
     * @method setProperty
     * @param {String} name
     * @param {*} value
     */
    setProperty(name, value) {
      var _a2;
      if (!this.properties) {
        this.properties = {};
      }
      if (value === this.properties[name]) {
        return;
      }
      const prev_value = this.properties[name];
      this.properties[name] = value;
      if (this.onPropertyChanged) {
        if (this.onPropertyChanged(name, value, prev_value) === false) {
          this.properties[name] = prev_value;
        }
      }
      if (this.widgets) {
        for (let i2 = 0; i2 < this.widgets.length; ++i2) {
          const widget = this.widgets[i2];
          if (!widget) {
            continue;
          }
          const propertyName = (_a2 = widget.options) == null ? void 0 : _a2.property;
          if (propertyName == name) {
            widget.value = value;
            break;
          }
        }
      }
    }
  }, _c.liteGraph = defaultLiteGraphNodeHost, _c);
  const defaultExecutionHost = {
    EVENT: -1,
    ACTION: -1,
    ON_TRIGGER: 3,
    use_deferred_actions: true,
    getTime: () => Date.now()
  };
  class LGraphNodeExecution extends LGraphNode$1 {
    getExecutionHost() {
      const host = LGraphNode$1.liteGraph || {};
      return { ...defaultExecutionHost, ...host };
    }
    getExecutionGraph() {
      return this.graph || null;
    }
    /**
     * sets the output data
     * @method setOutputData
     * @param {number} slot
     * @param {*} data
     */
    setOutputData(slot, data) {
      if (!this.outputs) {
        return;
      }
      if (slot == -1 || slot >= this.outputs.length) {
        return;
      }
      const output_info = this.outputs[slot];
      if (!output_info) {
        return;
      }
      output_info._data = data;
      const graph = this.getExecutionGraph();
      if (output_info.links) {
        for (let i2 = 0; i2 < output_info.links.length; i2++) {
          const link_id = output_info.links[i2];
          const link = graph.links[String(link_id)];
          if (link) {
            link.data = data;
          }
        }
      }
    }
    /**
     * sets the output data type, useful when you want to be able to overwrite the data type
     * @method setOutputDataType
     * @param {number} slot
     * @param {String} datatype
     */
    setOutputDataType(slot, type) {
      if (!this.outputs) {
        return;
      }
      if (slot == -1 || slot >= this.outputs.length) {
        return;
      }
      const output_info = this.outputs[slot];
      if (!output_info) {
        return;
      }
      output_info.type = type;
      const graph = this.getExecutionGraph();
      if (output_info.links) {
        for (let i2 = 0; i2 < output_info.links.length; i2++) {
          const link_id = output_info.links[i2];
          graph.links[String(link_id)].type = type;
        }
      }
    }
    /**
     * Retrieves the input data (data traveling through the connection) from one slot
     * @method getInputData
     * @param {number} slot
     * @param {boolean} force_update if set to true it will force the connected node of this slot to output data into this link
     * @return {*} data or if it is not connected returns undefined
     */
    getInputData(slot, force_update) {
      if (!this.inputs) {
        return void 0;
      }
      const input = this.inputs[slot];
      if (!input || slot >= this.inputs.length || input.link == null) {
        return void 0;
      }
      const graph = this.getExecutionGraph();
      const link_id = input.link;
      const link = graph.links[String(link_id)];
      if (!link) {
        return null;
      }
      if (!force_update) {
        return link.data;
      }
      const node2 = graph.getNodeById(link.origin_id);
      if (!node2) {
        return link.data;
      }
      if (node2.updateOutputData) {
        node2.updateOutputData(link.origin_slot);
      } else if (node2.onExecute) {
        node2.onExecute();
      }
      return link.data;
    }
    /**
     * Retrieves the input data type (in case this supports multiple input types)
     * @method getInputDataType
     * @param {number} slot
     * @return {String} datatype in string format
     */
    getInputDataType(slot) {
      if (!this.inputs) {
        return null;
      }
      const input = this.inputs[slot];
      if (!input || slot >= this.inputs.length || input.link == null) {
        return null;
      }
      const graph = this.getExecutionGraph();
      const link_id = input.link;
      const link = graph.links[String(link_id)];
      if (!link) {
        return null;
      }
      const node2 = graph.getNodeById(link.origin_id);
      if (!node2) {
        return link.type || null;
      }
      const outputs = node2.outputs;
      const output_info = outputs ? outputs[link.origin_slot] : null;
      if (output_info) {
        return output_info.type || null;
      }
      return null;
    }
    /**
     * Retrieves the input data from one slot using its name instead of slot number
     * @method getInputDataByName
     * @param {String} slot_name
     * @param {boolean} force_update if set to true it will force the connected node of this slot to output data into this link
     * @return {*} data or if it is not connected returns null
     */
    getInputDataByName(slot_name, force_update) {
      const withFindInputSlot = this;
      const slot = withFindInputSlot.findInputSlot(slot_name);
      if (slot == -1) {
        return null;
      }
      return this.getInputData(slot, force_update);
    }
    /**
     * tells you if there is a connection in one input slot
     * @method isInputConnected
     * @param {number} slot
     * @return {boolean}
     */
    isInputConnected(slot) {
      if (!this.inputs) {
        return false;
      }
      return slot < this.inputs.length && this.inputs[slot].link != null;
    }
    /**
     * tells you info about an input connection (which node, type, etc)
     * @method getInputInfo
     * @param {number} slot
     * @return {Object} object or null { link: id, name: string, type: string or 0 }
     */
    getInputInfo(slot) {
      if (!this.inputs) {
        return null;
      }
      if (slot < this.inputs.length) {
        return this.inputs[slot];
      }
      return null;
    }
    /**
     * Returns the link info in the connection of an input slot
     * @method getInputLink
     * @param {number} slot
     * @return {LLink} object or null
     */
    getInputLink(slot) {
      if (!this.inputs) {
        return null;
      }
      if (slot < this.inputs.length) {
        const slot_info = this.inputs[slot];
        const graph = this.getExecutionGraph();
        return graph.links[String(slot_info.link)] || null;
      }
      return null;
    }
    /**
     * returns the node connected in the input slot
     * @method getInputNode
     * @param {number} slot
     * @return {LGraphNode} node or null
     */
    getInputNode(slot) {
      if (!this.inputs) {
        return null;
      }
      if (slot >= this.inputs.length) {
        return null;
      }
      const input = this.inputs[slot];
      if (!input || input.link === null) {
        return null;
      }
      const graph = this.getExecutionGraph();
      const link_info = graph.links[String(input.link)];
      if (!link_info) {
        return null;
      }
      return graph.getNodeById(link_info.origin_id);
    }
    /**
     * returns the value of an input with this name, otherwise checks if there is a property with that name
     * @method getInputOrProperty
     * @param {string} name
     * @return {*} value
     */
    getInputOrProperty(name) {
      const properties = this.properties;
      if (!this.inputs || !this.inputs.length) {
        return properties ? properties[name] : null;
      }
      const graph = this.getExecutionGraph();
      for (let i2 = 0, l = this.inputs.length; i2 < l; ++i2) {
        const input_info = this.inputs[i2];
        if (name == input_info.name && input_info.link != null) {
          const link = graph.links[String(input_info.link)];
          if (link) {
            return link.data;
          }
        }
      }
      return properties ? properties[name] : void 0;
    }
    /**
     * tells you the last output data that went in that slot
     * @method getOutputData
     * @param {number} slot
     * @return {Object}  object or null
     */
    getOutputData(slot) {
      var _a2;
      if (!this.outputs) {
        return null;
      }
      if (slot >= this.outputs.length) {
        return null;
      }
      const info = this.outputs[slot];
      return (_a2 = info._data) != null ? _a2 : null;
    }
    /**
     * tells you info about an output connection (which node, type, etc)
     * @method getOutputInfo
     * @param {number} slot
     * @return {Object}  object or null { name: string, type: string, links: [ ids of links in number ] }
     */
    getOutputInfo(slot) {
      if (!this.outputs) {
        return null;
      }
      if (slot < this.outputs.length) {
        return this.outputs[slot];
      }
      return null;
    }
    /**
     * tells you if there is a connection in one output slot
     * @method isOutputConnected
     * @param {number} slot
     * @return {boolean}
     */
    isOutputConnected(slot) {
      if (!this.outputs) {
        return false;
      }
      return Boolean(
        slot < this.outputs.length && this.outputs[slot].links && this.outputs[slot].links.length
      );
    }
    /**
     * tells you if there is any connection in the output slots
     * @method isAnyOutputConnected
     * @return {boolean}
     */
    isAnyOutputConnected() {
      if (!this.outputs) {
        return false;
      }
      for (let i2 = 0; i2 < this.outputs.length; ++i2) {
        if (this.outputs[i2].links && this.outputs[i2].links.length) {
          return true;
        }
      }
      return false;
    }
    /**
     * retrieves all the nodes connected to this output slot
     * @method getOutputNodes
     * @param {number} slot
     * @return {array}
     */
    getOutputNodes(slot) {
      if (!this.outputs || this.outputs.length == 0) {
        return null;
      }
      if (slot >= this.outputs.length) {
        return null;
      }
      const output = this.outputs[slot];
      if (!output.links || output.links.length == 0) {
        return null;
      }
      const graph = this.getExecutionGraph();
      const result = [];
      for (let i2 = 0; i2 < output.links.length; i2++) {
        const link_id = output.links[i2];
        const link = graph.links[String(link_id)];
        if (link) {
          const target_node = graph.getNodeById(link.target_id);
          if (target_node) {
            result.push(target_node);
          }
        }
      }
      return result;
    }
    /**
     * Triggers the execution of actions that were deferred when the action was triggered
     * @method executePendingActions
     */
    executePendingActions() {
      if (!this._waiting_actions || !this._waiting_actions.length) {
        return;
      }
      for (let i2 = 0; i2 < this._waiting_actions.length; ++i2) {
        const p = this._waiting_actions[i2];
        this.onAction(
          p[0],
          p[1],
          p[2],
          p[3],
          p[4]
        );
      }
      this._waiting_actions.length = 0;
    }
    /**
     * Triggers the node code execution, place a boolean/counter to mark the node as being executed
     * @method doExecute
     * @param {*} param
     * @param {*} options
     */
    doExecute(param, options) {
      const runtimeOptions = options || {};
      const graph = this.getExecutionGraph();
      if (this.onExecute) {
        if (!runtimeOptions.action_call) {
          runtimeOptions.action_call = this.id + "_exec_" + Math.floor(Math.random() * 9999);
        }
        graph.nodes_executing[String(this.id)] = true;
        this.onExecute(param, runtimeOptions);
        graph.nodes_executing[String(this.id)] = false;
        this.exec_version = graph.iteration;
        if (runtimeOptions.action_call) {
          this.action_call = runtimeOptions.action_call;
          graph.nodes_executedAction[String(this.id)] = runtimeOptions.action_call;
        }
      }
      this.execute_triggered = 2;
      if (this.onAfterExecuteNode) {
        this.onAfterExecuteNode(param, runtimeOptions);
      }
    }
    /**
     * Triggers an action, wrapped by logics to control execution flow
     * @method actionDo
     * @param {String} action name
     * @param {*} param
     */
    actionDo(action, param, options, action_slot) {
      const runtimeOptions = options || {};
      const graph = this.getExecutionGraph();
      if (this.onAction) {
        if (!runtimeOptions.action_call) {
          runtimeOptions.action_call = this.id + "_" + (action ? action : "action") + "_" + Math.floor(Math.random() * 9999);
        }
        graph.nodes_actioning[String(this.id)] = action ? action : "actioning";
        this.onAction(action, param, runtimeOptions, action_slot);
        graph.nodes_actioning[String(this.id)] = false;
        if (runtimeOptions.action_call) {
          this.action_call = runtimeOptions.action_call;
          graph.nodes_executedAction[String(this.id)] = runtimeOptions.action_call;
        }
      }
      this.action_triggered = 2;
      if (this.onAfterExecuteNode) {
        this.onAfterExecuteNode(param, runtimeOptions);
      }
    }
    /**
     * Triggers an event in this node, this will trigger any output with the same name
     * @method trigger
     * @param {String} event name ( "on_play", ... ) if action is equivalent to false then the event is send to all
     * @param {*} param
     */
    trigger(action, param, options) {
      if (!this.outputs || !this.outputs.length) {
        return;
      }
      const host = this.getExecutionHost();
      const graph = this.getExecutionGraph();
      if (graph) {
        graph._last_trigger_time = host.getTime();
      }
      for (let i2 = 0; i2 < this.outputs.length; ++i2) {
        const output = this.outputs[i2];
        if (!output || output.type !== host.EVENT || action && output.name != action) {
          continue;
        }
        this.triggerSlot(i2, param, null, options);
      }
    }
    /**
     * Triggers a slot event in this node: cycle output slots and launch execute/action on connected nodes
     * @method triggerSlot
     * @param {Number} slot the index of the output slot
     * @param {*} param
     * @param {Number} link_id [optional] in case you want to trigger and specific output link in a slot
     */
    triggerSlot(slot, param, link_id, options) {
      const runtimeOptions = options || {};
      if (!this.outputs) {
        return;
      }
      if (slot == null) {
        console.error("slot must be a number");
        return;
      }
      if (slot.constructor !== Number) {
        console.warn(
          "slot must be a number, use node.trigger('name') if you want to use a string"
        );
      }
      const output = this.outputs[slot];
      if (!output) {
        return;
      }
      const links = output.links;
      if (!links || !links.length) {
        return;
      }
      const host = this.getExecutionHost();
      const graph = this.getExecutionGraph();
      if (graph) {
        graph._last_trigger_time = host.getTime();
      }
      for (let k = 0; k < links.length; ++k) {
        const id = links[k];
        if (link_id != null && link_id != id) {
          continue;
        }
        const link_info = graph.links[String(links[k])];
        if (!link_info) {
          continue;
        }
        link_info._last_time = host.getTime();
        const node2 = graph.getNodeById(link_info.target_id);
        if (!node2) {
          continue;
        }
        if (node2.mode === host.ON_TRIGGER) {
          if (!runtimeOptions.action_call) {
            runtimeOptions.action_call = this.id + "_trigg_" + Math.floor(Math.random() * 9999);
          }
          if (node2.onExecute) {
            node2.doExecute(
              param,
              runtimeOptions
            );
          }
        } else if (node2.onAction) {
          if (!runtimeOptions.action_call) {
            runtimeOptions.action_call = this.id + "_act_" + Math.floor(Math.random() * 9999);
          }
          const target_connection = node2.inputs[link_info.target_slot];
          if (host.use_deferred_actions && node2.onExecute) {
            if (!node2._waiting_actions) {
              node2._waiting_actions = [];
            }
            node2._waiting_actions.push([
              target_connection.name,
              param,
              runtimeOptions,
              link_info.target_slot
            ]);
          } else {
            node2.actionDo(
              target_connection.name,
              param,
              runtimeOptions,
              link_info.target_slot
            );
          }
        }
      }
    }
    /**
     * clears the trigger slot animation
     * @method clearTriggeredSlot
     * @param {Number} slot the index of the output slot
     * @param {Number} link_id [optional] in case you want to trigger and specific output link in a slot
     */
    clearTriggeredSlot(slot, link_id) {
      if (!this.outputs) {
        return;
      }
      const output = this.outputs[slot];
      if (!output) {
        return;
      }
      const links = output.links;
      if (!links || !links.length) {
        return;
      }
      const graph = this.getExecutionGraph();
      for (let k = 0; k < links.length; ++k) {
        const id = links[k];
        if (link_id != null && link_id != id) {
          continue;
        }
        const link_info = graph.links[String(links[k])];
        if (!link_info) {
          continue;
        }
        link_info._last_time = 0;
      }
    }
  }
  const defaultPortsWidgetsHost = {
    NODE_TEXT_SIZE: 14,
    NODE_WIDTH: 140,
    NODE_SLOT_HEIGHT: 20,
    NODE_WIDGET_HEIGHT: 20,
    auto_load_slot_types: false
  };
  class LGraphNodePortsWidgets extends LGraphNodeExecution {
    getPortsWidgetsHost() {
      const classHost = LGraphNodePortsWidgets.liteGraph;
      const ctorHost = this.constructor.liteGraph;
      return { ...defaultPortsWidgetsHost, ...classHost || {}, ...ctorHost || {} };
    }
    getPortsWidgetsClassMeta() {
      return this.constructor;
    }
    getGraphLinksMap() {
      const graphLike = this.graph;
      return graphLike.links || {};
    }
    /**
     * changes node size and triggers callback
     * @method setSize
     * @param {vec2} size
     */
    setSize(size) {
      this.size = size;
      if (this.onResize) {
        this.onResize(this.size);
      }
    }
    /**
     * add a new property to this node
     * @method addProperty
     * @param {string} name
     * @param {*} default_value
     * @param {string} type string defining the output type ("vec3","number",...)
     * @param {Object} extra_info this can be used to have special properties of the property (like values, etc)
     */
    addProperty(name, default_value, type, extra_info) {
      const o = { name, type, default_value };
      if (extra_info) {
        for (const i2 in extra_info) {
          o[i2] = extra_info[i2];
        }
      }
      if (!this.properties_info) {
        this.properties_info = [];
      }
      this.properties_info.push(o);
      if (!this.properties) {
        this.properties = {};
      }
      this.properties[name] = default_value;
      return o;
    }
    /**
     * add a new output slot to use in this node
     * @method addOutput
     * @param {string} name
     * @param {string} type string defining the output type ("vec3","number",...)
     * @param {Object} extra_info this can be used to have special properties of an output (label, special color, position, etc)
     */
    addOutput(name, type, extra_info) {
      const output = {
        name,
        type,
        links: null
      };
      if (extra_info) {
        for (const i2 in extra_info) {
          output[i2] = extra_info[i2];
        }
      }
      if (!this.outputs) {
        this.outputs = [];
      }
      this.outputs.push(output);
      if (this.onOutputAdded) {
        this.onOutputAdded(output);
      }
      const host = this.getPortsWidgetsHost();
      if (host.auto_load_slot_types) {
        host.registerNodeAndSlotType(this, type, true);
      }
      this.setSize(this.computeSize());
      this.setDirtyCanvas(true, true);
      return output;
    }
    /**
     * add a new output slot to use in this node
     * @method addOutputs
     * @param {Array} array of triplets like [[name,type,extra_info],[...]]
     */
    addOutputs(array) {
      const host = this.getPortsWidgetsHost();
      for (let i2 = 0; i2 < array.length; ++i2) {
        const info = array[i2];
        const o = {
          name: info[0],
          type: info[1],
          link: null
        };
        if (array[2]) {
          for (const j in info[2]) {
            o[j] = info[2][j];
          }
        }
        if (!this.outputs) {
          this.outputs = [];
        }
        this.outputs.push(o);
        if (this.onOutputAdded) {
          this.onOutputAdded(o);
        }
        if (host.auto_load_slot_types) {
          host.registerNodeAndSlotType(this, info[1], true);
        }
      }
      this.setSize(this.computeSize());
      this.setDirtyCanvas(true, true);
    }
    /**
     * remove an existing output slot
     * @method removeOutput
     * @param {number} slot
     */
    removeOutput(slot) {
      this.disconnectOutput(
        slot
      );
      this.outputs.splice(slot, 1);
      for (let i2 = slot; i2 < this.outputs.length; ++i2) {
        if (!this.outputs[i2] || !this.outputs[i2].links) {
          continue;
        }
        const links = this.outputs[i2].links;
        for (let j = 0; j < links.length; ++j) {
          const link = this.getGraphLinksMap()[String(links[j])];
          if (!link) {
            continue;
          }
          link.origin_slot = link.origin_slot - 1;
        }
      }
      this.setSize(this.computeSize());
      if (this.onOutputRemoved) {
        this.onOutputRemoved(slot);
      }
      this.setDirtyCanvas(true, true);
    }
    /**
     * add a new input slot to use in this node
     * @method addInput
     * @param {string} name
     * @param {string} type string defining the input type ("vec3","number",...), it its a generic one use 0
     * @param {Object} extra_info this can be used to have special properties of an input (label, color, position, etc)
     */
    addInput(name, type, extra_info) {
      const normalizedType = type || 0;
      const input = {
        name,
        type: normalizedType,
        link: null
      };
      if (extra_info) {
        for (const i2 in extra_info) {
          input[i2] = extra_info[i2];
        }
      }
      if (!this.inputs) {
        this.inputs = [];
      }
      this.inputs.push(input);
      this.setSize(this.computeSize());
      if (this.onInputAdded) {
        this.onInputAdded(input);
      }
      const host = this.getPortsWidgetsHost();
      host.registerNodeAndSlotType(this, normalizedType);
      this.setDirtyCanvas(true, true);
      return input;
    }
    /**
     * add several new input slots in this node
     * @method addInputs
     * @param {Array} array of triplets like [[name,type,extra_info],[...]]
     */
    addInputs(array) {
      const host = this.getPortsWidgetsHost();
      for (let i2 = 0; i2 < array.length; ++i2) {
        const info = array[i2];
        const o = { name: info[0], type: info[1], link: null };
        if (array[2]) {
          for (const j in info[2]) {
            o[j] = info[2][j];
          }
        }
        if (!this.inputs) {
          this.inputs = [];
        }
        this.inputs.push(o);
        if (this.onInputAdded) {
          this.onInputAdded(o);
        }
        host.registerNodeAndSlotType(this, info[1]);
      }
      this.setSize(this.computeSize());
      this.setDirtyCanvas(true, true);
    }
    /**
     * remove an existing input slot
     * @method removeInput
     * @param {number} slot
     */
    removeInput(slot) {
      this.disconnectInput(
        slot
      );
      const slot_info = this.inputs.splice(slot, 1);
      for (let i2 = slot; i2 < this.inputs.length; ++i2) {
        if (!this.inputs[i2]) {
          continue;
        }
        const link = this.getGraphLinksMap()[String(this.inputs[i2].link)];
        if (!link) {
          continue;
        }
        link.target_slot = link.target_slot - 1;
      }
      this.setSize(this.computeSize());
      if (this.onInputRemoved) {
        this.onInputRemoved(slot, slot_info[0]);
      }
      this.setDirtyCanvas(true, true);
    }
    /**
     * add an special connection to this node (used for special kinds of graphs)
     * @method addConnection
     * @param {string} name
     * @param {string} type string defining the input type ("vec3","number",...)
     * @param {[x,y]} pos position of the connection inside the node
     * @param {string} direction if is input or output
     */
    addConnection(name, type, pos2, direction) {
      const o = {
        name,
        type,
        pos: pos2,
        direction,
        links: null
      };
      this.connections.push(o);
      return o;
    }
    /**
     * computes the minimum size of a node according to its inputs and output slots
     * @method computeSize
     * @param {vec2} minHeight
     * @return {vec2} the total size
     */
    computeSize(out) {
      const classMeta = this.getPortsWidgetsClassMeta();
      const host = this.getPortsWidgetsHost();
      if (classMeta.size) {
        return classMeta.size.concat();
      }
      let rows = Math.max(
        this.inputs ? this.inputs.length : 1,
        this.outputs ? this.outputs.length : 1
      );
      const size = out || new Float32Array([0, 0]);
      rows = Math.max(rows, 1);
      const font_size = host.NODE_TEXT_SIZE;
      const compute_text_size = (text) => {
        if (!text) {
          return 0;
        }
        return font_size * text.length * 0.6;
      };
      const title_width = compute_text_size(this.title);
      let input_width = 0;
      let output_width = 0;
      if (this.inputs) {
        for (let i2 = 0, l = this.inputs.length; i2 < l; ++i2) {
          const input = this.inputs[i2];
          const text = input.label || input.name || "";
          const text_width = compute_text_size(text);
          if (input_width < text_width) {
            input_width = text_width;
          }
        }
      }
      if (this.outputs) {
        for (let i2 = 0, l = this.outputs.length; i2 < l; ++i2) {
          const output = this.outputs[i2];
          const text = output.label || output.name || "";
          const text_width = compute_text_size(text);
          if (output_width < text_width) {
            output_width = text_width;
          }
        }
      }
      size[0] = Math.max(input_width + output_width + 10, title_width);
      size[0] = Math.max(size[0], host.NODE_WIDTH);
      if (this.widgets && this.widgets.length) {
        size[0] = Math.max(size[0], host.NODE_WIDTH * 1.5);
      }
      size[1] = (classMeta.slot_start_y || 0) + rows * host.NODE_SLOT_HEIGHT;
      let widgets_height = 0;
      if (this.widgets && this.widgets.length) {
        for (let i2 = 0, l = this.widgets.length; i2 < l; ++i2) {
          const widget = this.widgets[i2];
          if (!widget) {
            continue;
          }
          if (widget.computeSize) {
            widgets_height += widget.computeSize(size[0])[1] + 4;
          } else {
            widgets_height += host.NODE_WIDGET_HEIGHT + 4;
          }
        }
        widgets_height += 8;
      }
      if (this.widgets_up) {
        size[1] = Math.max(size[1], widgets_height);
      } else if (this.widgets_start_y != null) {
        size[1] = Math.max(size[1], widgets_height + this.widgets_start_y);
      } else {
        size[1] += widgets_height;
      }
      if (classMeta.min_height && size[1] < classMeta.min_height) {
        size[1] = classMeta.min_height;
      }
      size[1] += 6;
      return size;
    }
    /**
     * returns all the info available about a property of this node.
     *
     * @method getPropertyInfo
     * @param {String} property name of the property
     * @return {Object} the object with all the available info
    */
    getPropertyInfo(property) {
      let info = null;
      if (this.properties_info) {
        for (let i2 = 0; i2 < this.properties_info.length; ++i2) {
          const item = this.properties_info[i2];
          if (item && item.name == property) {
            info = item;
            break;
          }
        }
      }
      const classMeta = this.getPortsWidgetsClassMeta();
      if (classMeta["@" + property]) {
        info = classMeta["@" + property];
      }
      if (classMeta.widgets_info && classMeta.widgets_info[property]) {
        info = classMeta.widgets_info[property];
      }
      if (!info && this.onGetPropertyInfo) {
        info = this.onGetPropertyInfo(property);
      }
      if (!info) {
        info = {};
      }
      if (!info.type) {
        info.type = typeof this.properties[property];
      }
      if (info.widget == "combo") {
        info.type = "enum";
      }
      return info;
    }
    /**
     * Defines a widget inside the node, it will be rendered on top of the node, you can control lots of properties
     *
     * @method addWidget
     * @param {String} type the widget type (could be "number","string","combo"
     * @param {String} name the text to show on the widget
     * @param {String} value the default value
     * @param {Function|String} callback function to call when it changes (optionally, it can be the name of the property to modify)
     * @param {Object} options the object that contains special properties of this widget
     * @return {Object} the created widget object
     */
    addWidget(type, name, value, callback, options) {
      if (!this.widgets) {
        this.widgets = [];
      }
      let widgetCallback = callback;
      let widgetOptions = options;
      if (!widgetOptions && widgetCallback && widgetCallback.constructor === Object) {
        widgetOptions = widgetCallback;
        widgetCallback = null;
      }
      if (widgetOptions && widgetOptions.constructor === String) {
        widgetOptions = {
          property: widgetOptions
        };
      }
      if (widgetCallback && widgetCallback.constructor === String) {
        if (!widgetOptions) {
          widgetOptions = {};
        }
        widgetOptions.property = widgetCallback;
        widgetCallback = null;
      }
      if (widgetCallback && widgetCallback.constructor !== Function) {
        console.warn("addWidget: callback must be a function");
        widgetCallback = null;
      }
      const w2 = {
        type: type.toLowerCase(),
        name,
        value,
        callback: widgetCallback,
        options: widgetOptions || {}
      };
      if (w2.options.y !== void 0) {
        w2.y = w2.options.y;
      }
      if (!widgetCallback && !w2.options.callback && !w2.options.property) {
        console.warn(
          "LiteGraph addWidget(...) without a callback or property assigned"
        );
      }
      if (type == "combo" && !w2.options.values) {
        throw "LiteGraph addWidget('combo',...) requires to pass values in options: { values:['red','blue'] }";
      }
      this.widgets.push(w2);
      this.setSize(this.computeSize());
      return w2;
    }
    addCustomWidget(custom_widget) {
      if (!this.widgets) {
        this.widgets = [];
      }
      this.widgets.push(custom_widget);
      return custom_widget;
    }
    // placeholder to keep this module self-contained during incremental migration.
    setDirtyCanvas(_fg, _bg) {
    }
  }
  function isInsideRectangle(x2, y2, left, top, width2, height) {
    return left < x2 && left + width2 > x2 && top < y2 && top + height > y2;
  }
  const hostDefaults = {
    NODE_TITLE_HEIGHT: 30,
    NODE_COLLAPSED_WIDTH: 80,
    NODE_SLOT_HEIGHT: 20,
    INPUT: 1,
    OUTPUT: 2,
    EVENT: -1,
    ON_TRIGGER: 3,
    do_add_triggers_slots: false,
    allow_multi_output_for_events: true,
    use_uuids: false,
    uuidv4: () => "",
    debug: false,
    isValidConnection: () => true,
    getTime: () => Date.now()
  };
  class LGraphNodeConnectGeometry extends LGraphNodePortsWidgets {
    host() {
      const classHost = LGraphNodeConnectGeometry.liteGraph;
      const ctorHost = this.constructor.liteGraph;
      return { ...hostDefaults, ...classHost || {}, ...ctorHost || {} };
    }
    graphRef() {
      return this.graph || null;
    }
    toNode(node2) {
      var _a2;
      if (node2 == null || node2 === false) {
        return null;
      }
      return typeof node2 === "number" ? ((_a2 = this.graphRef()) == null ? void 0 : _a2.getNodeById(node2)) || null : node2;
    }
    /** returns the bounding of the object, used for rendering purposes */
    getBounding(out, compute_outer) {
      var _a2;
      const h = this.host();
      const o = out || new Float32Array(4);
      const isCollapsed = !!this.flags.collapsed;
      const p = this.pos;
      const s = this.size;
      let left = 0;
      let right = 1;
      let top = 0;
      let bottom = 0;
      if (compute_outer) {
        left = 4;
        right = 6 + left;
        top = 4;
        bottom = 5 + top;
      }
      o[0] = p[0] - left;
      o[1] = p[1] - h.NODE_TITLE_HEIGHT - top;
      o[2] = isCollapsed ? (this._collapsed_width || h.NODE_COLLAPSED_WIDTH) + right : s[0] + right;
      o[3] = isCollapsed ? h.NODE_TITLE_HEIGHT + bottom : s[1] + h.NODE_TITLE_HEIGHT + bottom;
      (_a2 = this.onBounding) == null ? void 0 : _a2.call(this, o);
      return o;
    }
    /** checks if a point is inside the shape of a node */
    isPointInside(x2, y2, margin, skip_title) {
      var _a2, _b2, _c2;
      const h = this.host();
      const m = margin || 0;
      let margin_top = ((_b2 = (_a2 = this.graphRef()) == null ? void 0 : _a2.isLive) == null ? void 0 : _b2.call(_a2)) ? 0 : h.NODE_TITLE_HEIGHT;
      if (skip_title) {
        margin_top = 0;
      }
      if ((_c2 = this.flags) == null ? void 0 : _c2.collapsed) {
        return isInsideRectangle(
          x2,
          y2,
          this.pos[0] - m,
          this.pos[1] - h.NODE_TITLE_HEIGHT - m,
          (this._collapsed_width || h.NODE_COLLAPSED_WIDTH) + 2 * m,
          h.NODE_TITLE_HEIGHT + 2 * m
        );
      }
      return this.pos[0] - 4 - m < x2 && this.pos[0] + this.size[0] + 4 + m > x2 && this.pos[1] - margin_top - m < y2 && this.pos[1] + this.size[1] + m > y2;
    }
    /** checks if a point is inside a node slot, and returns info about which slot */
    getSlotInPosition(x2, y2) {
      const link_pos = new Float32Array(2);
      if (this.inputs) {
        for (let i2 = 0; i2 < this.inputs.length; ++i2) {
          const input = this.inputs[i2];
          this.getConnectionPos(true, i2, link_pos);
          if (isInsideRectangle(x2, y2, link_pos[0] - 10, link_pos[1] - 5, 20, 10)) {
            return { input, slot: i2, link_pos };
          }
        }
      }
      if (this.outputs) {
        for (let i2 = 0; i2 < this.outputs.length; ++i2) {
          const output = this.outputs[i2];
          this.getConnectionPos(false, i2, link_pos);
          if (isInsideRectangle(x2, y2, link_pos[0] - 10, link_pos[1] - 5, 20, 10)) {
            return { output, slot: i2, link_pos };
          }
        }
      }
      return null;
    }
    /** returns the input slot with a given name (used for dynamic slots), -1 if not found */
    findInputSlot(name, returnObj) {
      if (!this.inputs) {
        return -1;
      }
      for (let i2 = 0; i2 < this.inputs.length; ++i2) {
        if (name == this.inputs[i2].name) {
          return !returnObj ? i2 : this.inputs[i2];
        }
      }
      return -1;
    }
    /** returns the output slot with a given name (used for dynamic slots), -1 if not found */
    findOutputSlot(name, returnObj) {
      if (!this.outputs) {
        return -1;
      }
      for (let i2 = 0; i2 < this.outputs.length; ++i2) {
        if (name == this.outputs[i2].name) {
          return !returnObj ? i2 : this.outputs[i2];
        }
      }
      return -1;
    }
    findInputSlotFree(optsIn) {
      const opts = Object.assign({ returnObj: false, typesNotAccepted: [] }, optsIn || {});
      if (!this.inputs) {
        return -1;
      }
      for (let i2 = 0; i2 < this.inputs.length; ++i2) {
        const it = this.inputs[i2];
        if (it.link && it.link != null) {
          continue;
        }
        if (opts.typesNotAccepted.includes(it.type)) {
          continue;
        }
        return !opts.returnObj ? i2 : it;
      }
      return -1;
    }
    findOutputSlotFree(optsIn) {
      const opts = Object.assign({ returnObj: false, typesNotAccepted: [] }, optsIn || {});
      if (!this.outputs) {
        return -1;
      }
      for (let i2 = 0; i2 < this.outputs.length; ++i2) {
        const it = this.outputs[i2];
        if (it.links && it.links != null) {
          continue;
        }
        if (opts.typesNotAccepted.includes(it.type)) {
          continue;
        }
        return !opts.returnObj ? i2 : it;
      }
      return -1;
    }
    findInputSlotByType(type, returnObj, preferFreeSlot, doNotUseOccupied) {
      return this.findSlotByType(true, type, returnObj, preferFreeSlot, doNotUseOccupied);
    }
    findOutputSlotByType(type, returnObj, preferFreeSlot, doNotUseOccupied) {
      return this.findSlotByType(false, type, returnObj, preferFreeSlot, doNotUseOccupied);
    }
    /** returns the output (or input) slot with a given type, -1 if not found */
    findSlotByType(input, type, returnObj, preferFreeSlot, doNotUseOccupied) {
      const h = this.host();
      const slots = input ? this.inputs : this.outputs;
      if (!slots) {
        return -1;
      }
      let src = type;
      if (src == "" || src == "*") {
        src = 0;
      }
      for (let i2 = 0; i2 < slots.length; ++i2) {
        const aSource = (src + "").toLowerCase().split(",");
        let aDest = slots[i2].type || 0;
        aDest = aDest == "0" || aDest == "*" ? "0" : aDest;
        const aDestArr = (aDest + "").toLowerCase().split(",");
        for (let sI = 0; sI < aSource.length; sI++) {
          for (let dI = 0; dI < aDestArr.length; dI++) {
            if (aSource[sI] == "_event_") {
              aSource[sI] = String(h.EVENT);
            }
            if (aDestArr[sI] == "_event_") {
              aDestArr[sI] = String(h.EVENT);
            }
            if (aSource[sI] == "*") {
              aSource[sI] = "0";
            }
            if (aDestArr[sI] == "*") {
              aDestArr[sI] = "0";
            }
            if (aSource[sI] == aDestArr[dI]) {
              if (preferFreeSlot && slots[i2].links && slots[i2].links !== null) {
                continue;
              }
              return !returnObj ? i2 : slots[i2];
            }
          }
        }
      }
      if (preferFreeSlot && !doNotUseOccupied) {
        for (let i2 = 0; i2 < slots.length; ++i2) {
          const aSource = (src + "").toLowerCase().split(",");
          let aDest = slots[i2].type || 0;
          aDest = aDest == "0" || aDest == "*" ? "0" : aDest;
          const aDestArr = (aDest + "").toLowerCase().split(",");
          for (let sI = 0; sI < aSource.length; sI++) {
            for (let dI = 0; dI < aDestArr.length; dI++) {
              if (aSource[sI] == "*") {
                aSource[sI] = "0";
              }
              if (aDestArr[sI] == "*") {
                aDestArr[sI] = "0";
              }
              if (aSource[sI] == aDestArr[dI]) {
                return !returnObj ? i2 : slots[i2];
              }
            }
          }
        }
      }
      return -1;
    }
    connectByType(slot, target_node, target_slotType, optsIn) {
      const h = this.host();
      const opts = Object.assign(
        { createEventInCase: true, firstFreeIfOutputGeneralInCase: true, generalTypeInCase: true },
        optsIn || {}
      );
      const target = this.toNode(target_node);
      const typed = target.findInputSlotByType(target_slotType, false, true);
      if (typeof typed === "number" && typed >= 0) {
        return this.connect(slot, target, typed);
      }
      if (opts.createEventInCase && target_slotType == h.EVENT) {
        return this.connect(slot, target, -1);
      }
      if (opts.generalTypeInCase) {
        const generic = target.findInputSlotByType(0, false, true, true);
        if (typeof generic === "number" && generic >= 0) {
          return this.connect(slot, target, generic);
        }
      }
      if (opts.firstFreeIfOutputGeneralInCase && (target_slotType == 0 || target_slotType == "*" || target_slotType == "")) {
        const free = target.findInputSlotFree({ typesNotAccepted: [h.EVENT] });
        if (typeof free === "number" && free >= 0) {
          return this.connect(slot, target, free);
        }
      }
      console.debug("no way to connect type: ", target_slotType, " to targetNODE ", target);
      return null;
    }
    connectByTypeOutput(slot, source_node, source_slotType, optsIn) {
      const h = this.host();
      const opts = Object.assign(
        { createEventInCase: true, firstFreeIfInputGeneralInCase: true, generalTypeInCase: true },
        optsIn || {}
      );
      const source = this.toNode(source_node);
      const typed = source.findOutputSlotByType(source_slotType, false, true);
      if (typeof typed === "number" && typed >= 0) {
        return source.connect(typed, this, slot);
      }
      if (opts.generalTypeInCase) {
        const generic = source.findOutputSlotByType(0, false, true, true);
        if (typeof generic === "number" && generic >= 0) {
          return source.connect(generic, this, slot);
        }
      }
      if (opts.createEventInCase && source_slotType == h.EVENT && h.do_add_triggers_slots && source.addOnExecutedOutput) {
        return source.connect(source.addOnExecutedOutput(), this, slot);
      }
      if (opts.firstFreeIfInputGeneralInCase && (source_slotType == 0 || source_slotType == "*" || source_slotType == "")) {
        const free = source.findOutputSlotFree({ typesNotAccepted: [h.EVENT] });
        if (typeof free === "number" && free >= 0) {
          return source.connect(free, this, slot);
        }
      }
      console.debug("no way to connect byOUT type: ", source_slotType, " to sourceNODE ", source);
      return null;
    }
    /** connect this node output to the input of another node */
    connect(slot, target_node, target_slot) {
      var _a2, _b2, _c2, _d2, _e, _f, _g, _h, _i;
      const h = this.host();
      const graph = this.graphRef();
      if (!graph) {
        console.log("Connect: Error, node doesn't belong to any graph. Nodes must be added first to a graph before connecting them.");
        return null;
      }
      let outSlot = typeof slot === "string" ? this.findOutputSlot(slot) : slot;
      if (outSlot === -1 || !this.outputs || outSlot >= this.outputs.length) {
        if (h.debug) {
          console.log(typeof slot === "string" ? "Connect: Error, no slot of name " + slot : "Connect: Error, slot number not found");
        }
        return null;
      }
      const target = this.toNode(target_node);
      if (!target) {
        throw "target node is null";
      }
      if (target == this) {
        return null;
      }
      let targetSlot = target_slot || 0;
      if (typeof targetSlot === "string") {
        targetSlot = target.findInputSlot(targetSlot);
        if (targetSlot === -1) {
          if (h.debug) {
            console.log("Connect: Error, no slot of name " + target_slot);
          }
          return null;
        }
      } else if (targetSlot === h.EVENT) {
        if (!h.do_add_triggers_slots) {
          return null;
        }
        target.changeMode(h.ON_TRIGGER);
        targetSlot = target.findInputSlot("onTrigger");
      } else if (!target.inputs || targetSlot >= target.inputs.length) {
        if (h.debug) {
          console.log("Connect: Error, slot number not found");
        }
        return null;
      }
      let changed = false;
      const output = this.outputs[outSlot];
      if (!this.outputs[outSlot]) {
        return null;
      }
      const input = target.inputs[targetSlot];
      let link_info = null;
      if (target.onBeforeConnectInput) {
        targetSlot = target.onBeforeConnectInput(targetSlot);
      }
      if (targetSlot === false || targetSlot === null || !h.isValidConnection(output.type, input.type)) {
        this.setDirtyCanvas(false, true);
        if (changed) {
          (_a2 = graph.connectionChange) == null ? void 0 : _a2.call(graph, this, link_info || void 0);
        }
        return null;
      }
      if (target.onConnectInput && target.onConnectInput(targetSlot, output.type, output, this, outSlot) === false) {
        return null;
      }
      if (this.onConnectOutput && this.onConnectOutput(outSlot, input.type, input, target, targetSlot) === false) {
        return null;
      }
      if (target.inputs && target.inputs[targetSlot] && target.inputs[targetSlot].link != null) {
        (_b2 = graph.beforeChange) == null ? void 0 : _b2.call(graph);
        target.disconnectInput(targetSlot, { doProcessChange: false });
        changed = true;
      }
      if (output.links && output.links.length && output.type === h.EVENT && !h.allow_multi_output_for_events) {
        (_c2 = graph.beforeChange) == null ? void 0 : _c2.call(graph);
        this.disconnectOutput(outSlot, false, { doProcessChange: false });
        changed = true;
      }
      const nextId = h.use_uuids ? h.uuidv4() : ++graph.last_link_id;
      link_info = new LLink(
        nextId,
        input.type || output.type,
        this.id,
        outSlot,
        target.id,
        targetSlot
      );
      graph.links[link_info.id] = link_info;
      if (!output.links) {
        output.links = [];
      }
      output.links.push(link_info.id);
      if (target.inputs) {
        target.inputs[targetSlot].link = link_info.id;
      }
      graph._version++;
      (_d2 = this.onConnectionsChange) == null ? void 0 : _d2.call(this, h.OUTPUT, outSlot, true, link_info, output);
      (_e = target.onConnectionsChange) == null ? void 0 : _e.call(target, h.INPUT, targetSlot, true, link_info, input);
      (_f = graph.onNodeConnectionChange) == null ? void 0 : _f.call(graph, h.INPUT, target, targetSlot, this, outSlot);
      (_g = graph.onNodeConnectionChange) == null ? void 0 : _g.call(graph, h.OUTPUT, this, outSlot, target, targetSlot);
      this.setDirtyCanvas(false, true);
      (_h = graph.afterChange) == null ? void 0 : _h.call(graph);
      (_i = graph.connectionChange) == null ? void 0 : _i.call(graph, this, link_info);
      return link_info;
    }
    /** disconnect one output to an specific node */
    disconnectOutput(slot, target_node, _opts) {
      var _a2, _b2, _c2, _d2, _e, _f, _g, _h, _i, _j, _k;
      const h = this.host();
      const graph = this.graphRef();
      if (!graph) {
        return false;
      }
      const outSlot = typeof slot === "string" ? this.findOutputSlot(slot) : slot;
      if (!this.outputs || outSlot === -1 || outSlot >= this.outputs.length) {
        if (h.debug) {
          console.log(typeof slot === "string" ? "Connect: Error, no slot of name " + slot : "Connect: Error, slot number not found");
        }
        return false;
      }
      const output = this.outputs[outSlot];
      if (!output || !output.links || output.links.length == 0) {
        return false;
      }
      if (target_node) {
        const target = this.toNode(target_node);
        if (!target) {
          throw "Target Node not found";
        }
        for (let i2 = 0; i2 < output.links.length; i2++) {
          const link_id = output.links[i2];
          const link = graph.links[link_id];
          if (link.target_id == target.id) {
            output.links.splice(i2, 1);
            const input = target.inputs[link.target_slot];
            input.link = null;
            delete graph.links[link_id];
            graph._version++;
            (_a2 = target.onConnectionsChange) == null ? void 0 : _a2.call(target, h.INPUT, link.target_slot, false, link, input);
            (_b2 = this.onConnectionsChange) == null ? void 0 : _b2.call(this, h.OUTPUT, outSlot, false, link, output);
            (_c2 = graph.onNodeConnectionChange) == null ? void 0 : _c2.call(graph, h.OUTPUT, this, outSlot);
            (_d2 = graph.onNodeConnectionChange) == null ? void 0 : _d2.call(graph, h.OUTPUT, this, outSlot);
            (_e = graph.onNodeConnectionChange) == null ? void 0 : _e.call(graph, h.INPUT, target, link.target_slot);
            break;
          }
        }
      } else {
        for (let i2 = 0; i2 < output.links.length; i2++) {
          const link_id = output.links[i2];
          const link = graph.links[link_id];
          if (!link) {
            continue;
          }
          const target = graph.getNodeById(link.target_id);
          let input = null;
          graph._version++;
          if (target) {
            input = target.inputs[link.target_slot];
            input.link = null;
            (_f = target.onConnectionsChange) == null ? void 0 : _f.call(target, h.INPUT, link.target_slot, false, link, input);
            (_g = graph.onNodeConnectionChange) == null ? void 0 : _g.call(graph, h.INPUT, target, link.target_slot);
          }
          delete graph.links[link_id];
          (_h = this.onConnectionsChange) == null ? void 0 : _h.call(this, h.OUTPUT, outSlot, false, link, output);
          (_i = graph.onNodeConnectionChange) == null ? void 0 : _i.call(graph, h.OUTPUT, this, outSlot);
          (_j = graph.onNodeConnectionChange) == null ? void 0 : _j.call(graph, h.INPUT, target, link.target_slot);
        }
        output.links = null;
      }
      this.setDirtyCanvas(false, true);
      (_k = graph.connectionChange) == null ? void 0 : _k.call(graph, this);
      return true;
    }
    /** disconnect one input */
    disconnectInput(slot, _opts) {
      var _a2, _b2, _c2, _d2, _e;
      const h = this.host();
      const graph = this.graphRef();
      if (!graph) {
        return false;
      }
      const inSlot = typeof slot === "string" ? this.findInputSlot(slot) : slot;
      if (!this.inputs || inSlot === -1 || inSlot >= this.inputs.length) {
        if (h.debug) {
          console.log(typeof slot === "string" ? "Connect: Error, no slot of name " + slot : "Connect: Error, slot number not found");
        }
        return false;
      }
      const input = this.inputs[inSlot];
      if (!input) {
        return false;
      }
      const link_id = input.link;
      if (link_id != null) {
        input.link = null;
        const link = graph.links[link_id];
        if (link) {
          const originNode = graph.getNodeById(link.origin_id);
          if (!originNode) {
            return false;
          }
          const output = originNode.outputs[link.origin_slot];
          if (!output || !output.links || output.links.length === 0) {
            return false;
          }
          let i2 = 0;
          for (i2 = 0; i2 < output.links.length; i2++) {
            if (output.links[i2] == link_id) {
              output.links.splice(i2, 1);
              break;
            }
          }
          delete graph.links[link_id];
          graph._version++;
          (_a2 = this.onConnectionsChange) == null ? void 0 : _a2.call(this, h.INPUT, inSlot, false, link, input);
          (_b2 = originNode.onConnectionsChange) == null ? void 0 : _b2.call(originNode, h.OUTPUT, i2, false, link, output);
          (_c2 = graph.onNodeConnectionChange) == null ? void 0 : _c2.call(graph, h.OUTPUT, originNode, i2);
          (_d2 = graph.onNodeConnectionChange) == null ? void 0 : _d2.call(graph, h.INPUT, this, inSlot);
        }
      }
      this.setDirtyCanvas(false, true);
      (_e = graph.connectionChange) == null ? void 0 : _e.call(graph, this);
      return true;
    }
    /** returns the center of a connection point in canvas coords */
    getConnectionPos(is_input, slot_number, out) {
      const h = this.host();
      const o = out || new Float32Array(2);
      let num_slots = 0;
      if (is_input && this.inputs) {
        num_slots = this.inputs.length;
      }
      if (!is_input && this.outputs) {
        num_slots = this.outputs.length;
      }
      const offset = h.NODE_SLOT_HEIGHT * 0.5;
      if (this.flags.collapsed) {
        const w2 = this._collapsed_width || h.NODE_COLLAPSED_WIDTH;
        if (this.horizontal) {
          o[0] = this.pos[0] + w2 * 0.5;
          o[1] = is_input ? this.pos[1] - h.NODE_TITLE_HEIGHT : this.pos[1];
        } else {
          o[0] = is_input ? this.pos[0] : this.pos[0] + w2;
          o[1] = this.pos[1] - h.NODE_TITLE_HEIGHT * 0.5;
        }
        return o;
      }
      if (is_input && slot_number == -1) {
        o[0] = this.pos[0] + h.NODE_TITLE_HEIGHT * 0.5;
        o[1] = this.pos[1] + h.NODE_TITLE_HEIGHT * 0.5;
        return o;
      }
      if (is_input && this.inputs && num_slots > slot_number && this.inputs[slot_number].pos) {
        const p = this.inputs[slot_number].pos;
        o[0] = this.pos[0] + p[0];
        o[1] = this.pos[1] + p[1];
        return o;
      } else if (!is_input && this.outputs && num_slots > slot_number && this.outputs[slot_number].pos) {
        const p = this.outputs[slot_number].pos;
        o[0] = this.pos[0] + p[0];
        o[1] = this.pos[1] + p[1];
        return o;
      }
      if (this.horizontal) {
        o[0] = this.pos[0] + (slot_number + 0.5) * (this.size[0] / num_slots);
        o[1] = is_input ? this.pos[1] - h.NODE_TITLE_HEIGHT : this.pos[1] + this.size[1];
        return o;
      }
      o[0] = is_input ? this.pos[0] + offset : this.pos[0] + this.size[0] + 1 - offset;
      const cls = this.constructor;
      o[1] = this.pos[1] + (slot_number + 0.7) * h.NODE_SLOT_HEIGHT + (cls.slot_start_y || 0);
      return o;
    }
    // placeholder to keep this module self-contained during incremental migration.
    setDirtyCanvas(_fg, _bg) {
    }
  }
  const defaultCanvasCollabHost = {
    CANVAS_GRID_SIZE: 10,
    node_images_path: ""
  };
  class LGraphNodeCanvasCollab extends LGraphNodeConnectGeometry {
    getCanvasCollabHost() {
      const host = this.constructor.liteGraph;
      return { ...defaultCanvasCollabHost, ...host || {} };
    }
    canvasGraphRef() {
      return this.graph || null;
    }
    /* Force align to grid */
    alignToGrid() {
      const host = this.getCanvasCollabHost();
      this.pos[0] = host.CANVAS_GRID_SIZE * Math.round(this.pos[0] / host.CANVAS_GRID_SIZE);
      this.pos[1] = host.CANVAS_GRID_SIZE * Math.round(this.pos[1] / host.CANVAS_GRID_SIZE);
    }
    /* Console output */
    trace(msg) {
      if (!this.console) {
        this.console = [];
      }
      this.console.push(msg);
      if (this.console.length > this.constructor.MAX_CONSOLE) {
        this.console.shift();
      }
      const graph = this.graph;
      if (graph.onNodeTrace) {
        graph.onNodeTrace(this, msg);
      }
    }
    /* Forces to redraw or the main canvas (LGraphNode) or the bg canvas (links) */
    setDirtyCanvas(dirty_foreground, dirty_background) {
      const anyThis = this;
      const graph = typeof anyThis.canvasGraphRef === "function" && anyThis.canvasGraphRef() || typeof anyThis.graphRef === "function" && anyThis.graphRef() || anyThis.graph || null;
      if (!graph) {
        return;
      }
      graph.sendActionToCanvas("setDirty", [
        dirty_foreground,
        dirty_background
      ]);
    }
    loadImage(url) {
      const host = this.getCanvasCollabHost();
      const img = new Image();
      img.src = host.node_images_path + url;
      img.ready = false;
      img.onload = () => {
        img.ready = true;
        this.setDirtyCanvas(true);
      };
      return img;
    }
    // safe LGraphNode action execution (not sure if safe)
    // Intentionally kept disabled to mirror source behavior, where this block is commented out.
    /*
    executeAction(action: string): boolean {
        return false;
    }
    */
    /* Allows to get onMouseMove and onMouseUp events even if the mouse is out of focus */
    captureInput(v2) {
      const graph = this.canvasGraphRef();
      if (!graph || !graph.list_of_graphcanvas) {
        return;
      }
      const list = graph.list_of_graphcanvas;
      for (let i2 = 0; i2 < list.length; ++i2) {
        const c = list[i2];
        if (!v2 && c.node_capturing_input != this) {
          continue;
        }
        c.node_capturing_input = v2 ? this : null;
      }
    }
    /**
     * Collapse the node to make it smaller on the canvas
     * @method collapse
     **/
    collapse(force) {
      const graph = this.graph;
      graph._version++;
      if (this.constructor.collapsable === false && !force) {
        return;
      }
      this.flags.collapsed = !this.flags.collapsed;
      this.setDirtyCanvas(true, true);
    }
    /**
     * Forces the node to do not move or realign on Z
     * @method pin
     **/
    pin(v2) {
      const graph = this.graph;
      graph._version++;
      if (v2 === void 0) {
        this.flags.pinned = !this.flags.pinned;
      } else {
        this.flags.pinned = v2;
      }
    }
    localToScreen(x2, y2, graphCanvas) {
      return [
        (x2 + this.pos[0]) * graphCanvas.scale + graphCanvas.offset[0],
        (y2 + this.pos[1]) * graphCanvas.scale + graphCanvas.offset[1]
      ];
    }
  }
  const defaultCanvasColors = {
    node_colors: {
      pale_blue: {
        groupcolor: "#AAA"
      }
    }
  };
  let LGraphGroup$1 = (_d = class {
    constructor(title) {
      this.isPointInside = LGraphNodeCanvasCollab.prototype.isPointInside;
      this.setDirtyCanvas = LGraphNodeCanvasCollab.prototype.setDirtyCanvas;
      this.title = "Group";
      this.font_size = 24;
      this.color = "#AAA";
      this.graph = null;
      this._bounding = new Float32Array([10, 10, 140, 80]);
      this._pos = this._bounding.subarray(0, 2);
      this._size = this._bounding.subarray(2, 4);
      this._nodes = [];
      this.flags = {};
      this._ctor(title);
    }
    _ctor(title) {
      var _a2, _b2;
      this.title = title || "Group";
      this.font_size = 24;
      const colors = this.constructor.liteGraphCanvas || defaultCanvasColors;
      this.color = ((_b2 = (_a2 = colors.node_colors) == null ? void 0 : _a2.pale_blue) == null ? void 0 : _b2.groupcolor) || "#AAA";
      this._bounding = new Float32Array([10, 10, 140, 80]);
      this._pos = this._bounding.subarray(0, 2);
      this._size = this._bounding.subarray(2, 4);
      this._nodes = [];
      this.graph = null;
      Object.defineProperty(this, "pos", {
        set(v2) {
          if (!v2 || v2.length < 2) {
            return;
          }
          this._pos[0] = v2[0];
          this._pos[1] = v2[1];
        },
        get() {
          return this._pos;
        },
        enumerable: true
      });
      Object.defineProperty(this, "size", {
        set(v2) {
          if (!v2 || v2.length < 2) {
            return;
          }
          this._size[0] = Math.max(140, v2[0]);
          this._size[1] = Math.max(80, v2[1]);
        },
        get() {
          return this._size;
        },
        enumerable: true
      });
    }
    configure(o) {
      this.title = o.title;
      this._bounding.set(o.bounding);
      this.color = o.color;
      this.font_size = o.font_size;
    }
    serialize() {
      const b = this._bounding;
      return {
        title: this.title,
        bounding: [
          Math.round(b[0]),
          Math.round(b[1]),
          Math.round(b[2]),
          Math.round(b[3])
        ],
        color: this.color,
        font_size: this.font_size
      };
    }
    move(deltaX2, deltaY, ignoreNodes) {
      this._pos[0] += deltaX2;
      this._pos[1] += deltaY;
      if (ignoreNodes) {
        return;
      }
      for (let i2 = 0; i2 < this._nodes.length; ++i2) {
        const node2 = this._nodes[i2];
        node2.pos[0] += deltaX2;
        node2.pos[1] += deltaY;
      }
    }
    recomputeInsideNodes() {
      this._nodes.length = 0;
      const nodes = this.graph._nodes;
      const node_bounding = new Float32Array(4);
      for (let i2 = 0; i2 < nodes.length; ++i2) {
        const node2 = nodes[i2];
        node2.getBounding(node_bounding);
        if (!overlapBounding(this._bounding, node_bounding)) {
          continue;
        }
        this._nodes.push(node2);
      }
    }
    // Internal compatibility hooks consumed by delegated methods above.
    host() {
      return {
        NODE_TITLE_HEIGHT: 30,
        NODE_COLLAPSED_WIDTH: 80
      };
    }
    graphRef() {
      return this.graph;
    }
  }, _d.liteGraphCanvas = defaultCanvasColors, _d);
  const LGRAPHGROUP_SERIALIZATION_DIFF_ID = "serialization.group-font-field";
  function normalizeSerializedLGraphGroup(group, defaultFontSize = 24) {
    const anyGroup = group;
    let fontSize = parseNumber(anyGroup.font_size);
    if (fontSize == null) {
      fontSize = parseNumber(anyGroup.font);
    }
    if (fontSize == null) {
      fontSize = defaultFontSize;
    }
    return {
      title: anyGroup.title,
      bounding: anyGroup.bounding,
      color: anyGroup.color,
      font_size: fontSize
    };
  }
  function denormalizeSerializedLGraphGroup(group) {
    return {
      title: group.title,
      bounding: group.bounding,
      color: group.color,
      font: String(group.font_size)
    };
  }
  function parseSerializedLGraphGroupInput(input, defaultFontSize = 24) {
    return normalizeSerializedLGraphGroup(input, defaultFontSize);
  }
  function serializeLGraphGroupShape(shape, order = "runtime") {
    const runtimeShape = {
      title: shape.title,
      bounding: shape.bounding,
      color: shape.color,
      font_size: shape.font_size
    };
    if (order === "runtime") {
      return runtimeShape;
    }
    return denormalizeSerializedLGraphGroup(runtimeShape);
  }
  function parseNumber(v2) {
    if (typeof v2 === "number" && Number.isFinite(v2)) {
      return v2;
    }
    if (typeof v2 === "string" && v2.trim() !== "") {
      const parsed = Number(v2);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    return null;
  }
  const LLINK_SERIALIZATION_DIFF_ID = "serialization.link-tuple-order";
  function isSerializedLLinkDtsOrder(tuple) {
    return typeof tuple[1] === "string";
  }
  function normalizeSerializedLLinkTuple(tuple) {
    var _a2, _b2, _c2, _d2, _e, _f, _g, _h, _i, _j, _k, _l;
    const source = tuple;
    if (isSerializedLLinkDtsOrder(source)) {
      return [
        Number((_a2 = source[0]) != null ? _a2 : 0),
        Number((_b2 = source[2]) != null ? _b2 : 0),
        Number((_c2 = source[3]) != null ? _c2 : 0),
        Number((_d2 = source[4]) != null ? _d2 : 0),
        Number((_e = source[5]) != null ? _e : 0),
        String((_f = source[1]) != null ? _f : "")
      ];
    }
    return [
      Number((_g = source[0]) != null ? _g : 0),
      Number((_h = source[1]) != null ? _h : 0),
      Number((_i = source[2]) != null ? _i : 0),
      Number((_j = source[3]) != null ? _j : 0),
      Number((_k = source[4]) != null ? _k : 0),
      String((_l = source[5]) != null ? _l : "")
    ];
  }
  function denormalizeSerializedLLinkTuple(tuple, order = "runtime") {
    if (order === "runtime") {
      return tuple;
    }
    return [
      tuple[0],
      tuple[5],
      tuple[1],
      tuple[2],
      tuple[3],
      tuple[4]
    ];
  }
  function parseSerializedLLinkInput(input) {
    var _a2, _b2, _c2, _d2, _e, _f;
    if (Array.isArray(input)) {
      const normalized = normalizeSerializedLLinkTuple(input);
      return {
        id: normalized[0],
        origin_id: normalized[1],
        origin_slot: normalized[2],
        target_id: normalized[3],
        target_slot: normalized[4],
        type: normalized[5]
      };
    }
    return {
      id: Number((_a2 = input.id) != null ? _a2 : 0),
      type: String((_b2 = input.type) != null ? _b2 : ""),
      origin_id: Number((_c2 = input.origin_id) != null ? _c2 : 0),
      origin_slot: Number((_d2 = input.origin_slot) != null ? _d2 : 0),
      target_id: Number((_e = input.target_id) != null ? _e : 0),
      target_slot: Number((_f = input.target_slot) != null ? _f : 0)
    };
  }
  function serializeLLinkShape(shape, order = "runtime") {
    var _a2, _b2, _c2, _d2, _e, _f;
    const runtimeTuple = [
      Number((_a2 = shape.id) != null ? _a2 : 0),
      Number((_b2 = shape.origin_id) != null ? _b2 : 0),
      Number((_c2 = shape.origin_slot) != null ? _c2 : 0),
      Number((_d2 = shape.target_id) != null ? _d2 : 0),
      Number((_e = shape.target_slot) != null ? _e : 0),
      String((_f = shape.type) != null ? _f : "")
    ];
    return denormalizeSerializedLLinkTuple(runtimeTuple, order);
  }
  const CONTEXT_MENU_CLOSE_ALL_DIFF_ID = "ui.close-all-context-menus";
  function applyContextMenuCloseAllCompat$1(liteGraph, fallback) {
    var _a2;
    const beforeLiteGraph = liteGraph.closeAllContextMenus;
    const beforeContextMenu = (_a2 = liteGraph.ContextMenu) == null ? void 0 : _a2.closeAllContextMenus;
    const resolved = resolveContextMenuCloseAll(liteGraph, fallback);
    if (!resolved.fn) {
      return {
        diffId: CONTEXT_MENU_CLOSE_ALL_DIFF_ID,
        source: "none",
        changed: false,
        synced: false
      };
    }
    liteGraph.closeAllContextMenus = resolved.fn;
    if (!liteGraph.ContextMenu) {
      liteGraph.ContextMenu = {};
    }
    liteGraph.ContextMenu.closeAllContextMenus = resolved.fn;
    const synced = isContextMenuCloseAllCompatSynced(liteGraph);
    return {
      diffId: CONTEXT_MENU_CLOSE_ALL_DIFF_ID,
      source: resolved.source,
      resolved: resolved.fn,
      changed: beforeLiteGraph !== liteGraph.closeAllContextMenus || beforeContextMenu !== liteGraph.ContextMenu.closeAllContextMenus,
      synced
    };
  }
  function isContextMenuCloseAllCompatSynced(liteGraph) {
    var _a2;
    return !!(liteGraph.closeAllContextMenus && ((_a2 = liteGraph.ContextMenu) == null ? void 0 : _a2.closeAllContextMenus) && liteGraph.closeAllContextMenus === liteGraph.ContextMenu.closeAllContextMenus);
  }
  function resolveContextMenuCloseAll(liteGraph, fallback) {
    var _a2;
    if (liteGraph.closeAllContextMenus) {
      return { source: "LiteGraph", fn: liteGraph.closeAllContextMenus };
    }
    if ((_a2 = liteGraph.ContextMenu) == null ? void 0 : _a2.closeAllContextMenus) {
      return { source: "ContextMenu", fn: liteGraph.ContextMenu.closeAllContextMenus };
    }
    if (fallback) {
      return { source: "fallback", fn: fallback };
    }
    return { source: "none" };
  }
  function applyLiteGraphConstantAliases(host, fallbackValue = 6) {
    const resolved = typeof host.GRID_SHAPE === "number" ? host.GRID_SHAPE : typeof host.SQUARE_SHAPE === "number" ? host.SQUARE_SHAPE : fallbackValue;
    host.GRID_SHAPE = resolved;
    host.SQUARE_SHAPE = resolved;
    return resolved;
  }
  function applyLGraphCanvasStaticCompat(host) {
    applyLGraphCanvasStaticCompat$1(host);
  }
  function applyLGraphCanvasPrototypeCompatShims(host) {
    if (!host.processNodeDeselected && host.deselectNode) {
      host.processNodeDeselected = (node2) => {
        var _a2;
        (_a2 = host.deselectNode) == null ? void 0 : _a2.call(host, node2);
      };
    }
    if (!host.drawSlotGraphic) {
      host.drawSlotGraphic = () => {
      };
    }
    if (!host.touchHandler) {
      host.touchHandler = () => {
      };
    }
  }
  function applyContextMenuCloseAllCompat(liteGraph) {
    applyContextMenuCloseAllCompat$1(liteGraph);
  }
  function applyLiteGraphApiCompatAliases(targets) {
    if (targets.liteGraph) {
      applyLiteGraphConstantAliases(targets.liteGraph);
      applyContextMenuCloseAllCompat(targets.liteGraph);
    }
    if (targets.canvasStatic) {
      applyLGraphCanvasStaticCompat(targets.canvasStatic);
    }
    if (targets.canvasPrototype) {
      applyLGraphCanvasPrototypeCompatShims(targets.canvasPrototype);
    }
  }
  const defaultHost = {
    pointerevents_method: "mouse",
    isTouchDevice: () => typeof window !== "undefined" && ("ontouchstart" in window || typeof navigator !== "undefined" && navigator.maxTouchPoints > 0),
    pointerListenerAdd: (dom, eventName, callback, capture) => {
      if ("addEventListener" in dom) {
        dom.addEventListener(eventName, callback, !!capture);
      }
    },
    pointerListenerRemove: (dom, eventName, callback, capture) => {
      if ("removeEventListener" in dom) {
        dom.removeEventListener(eventName, callback, !!capture);
      }
    }
  };
  let ContextMenu$1 = class ContextMenu2 {
    /**
     * @constructor
     * @param values allows object `{ title: "Nice text", callback: function ... }`
     * @param options some options: `title/callback/ignore_item_callbacks/event`
     */
    constructor(values, options, ref_window2) {
      var _a2;
      this.lock = false;
      this.options = options || {};
      const host = ContextMenu2.host();
      if (this.options.parentMenu) {
        if (this.options.parentMenu.constructor !== this.constructor) {
          console.error("parentMenu must be of class ContextMenu, ignoring it");
          this.options.parentMenu = null;
        } else {
          this.parentMenu = this.options.parentMenu;
          this.parentMenu.lock = true;
          this.parentMenu.current_submenu = this;
        }
      }
      let eventClass = null;
      if (this.options.event) {
        eventClass = ((_a2 = this.options.event.constructor) == null ? void 0 : _a2.name) || null;
      }
      if (eventClass !== "MouseEvent" && eventClass !== "CustomEvent" && eventClass !== "PointerEvent") {
        console.error(
          "Event passed to ContextMenu is not of type MouseEvent or CustomEvent. Ignoring it. (" + eventClass + ")"
        );
        this.options.event = null;
      }
      const root = document.createElement("div");
      root.className = "litegraph litecontextmenu litemenubar-panel";
      if (this.options.className) {
        root.className += " " + this.options.className;
      }
      root.style.minWidth = 100;
      root.style.minHeight = 100;
      root.style.pointerEvents = "none";
      setTimeout(() => {
        root.style.pointerEvents = "auto";
      }, 100);
      ContextMenu2.host().pointerListenerAdd(
        root,
        "up",
        (e) => {
          e.preventDefault();
          return true;
        },
        true
      );
      root.addEventListener(
        "contextmenu",
        (e) => {
          if (e.button != 2) {
            return false;
          }
          e.preventDefault();
          return false;
        },
        true
      );
      ContextMenu2.host().pointerListenerAdd(
        root,
        "down",
        (e) => {
          if (e.button == 2) {
            this.close();
            e.preventDefault();
            return true;
          }
        },
        true
      );
      const wheelHandler = (e) => {
        const currentTop = parseInt(root.style.top, 10);
        const speed = this.options.scroll_speed || 0.1;
        root.style.top = (currentTop + e.deltaY * speed).toFixed() + "px";
        e.preventDefault();
        return true;
      };
      if (!this.options.scroll_speed) {
        this.options.scroll_speed = 0.1;
      }
      const wheelEventOptions = {
        capture: true,
        passive: false
      };
      root.addEventListener(
        "wheel",
        wheelHandler,
        wheelEventOptions
      );
      if (!("onwheel" in root)) {
        root.addEventListener(
          "mousewheel",
          wheelHandler,
          wheelEventOptions
        );
      }
      this.root = root;
      if (this.options.title) {
        const title = document.createElement("div");
        title.className = "litemenu-title";
        title.innerHTML = this.options.title;
        root.appendChild(title);
      }
      for (let i2 = 0; i2 < values.length; i2++) {
        let name = values.constructor == Array ? values[i2] : i2;
        if (name != null && name.constructor !== String) {
          name = name.content === void 0 ? String(name) : name.content;
        }
        const value = values[i2];
        this.addItem(name, value, this.options);
      }
      let close_on_leave = this.options.close_on_leave;
      if (close_on_leave === void 0) {
        close_on_leave = !host.isTouchDevice();
      }
      if (close_on_leave) {
        host.pointerListenerAdd(root, "leave", (e) => {
          if (this.lock) {
            return;
          }
          if (root.closing_timer) {
            clearTimeout(root.closing_timer);
          }
          root.closing_timer = setTimeout(
            this.close.bind(this, e),
            this.options.close_on_leave_delay || 500
          );
        });
      }
      host.pointerListenerAdd(root, "enter", () => {
        if (root.closing_timer) {
          clearTimeout(root.closing_timer);
        }
      });
      let root_document = document;
      if (this.options.event) {
        root_document = this.options.event.target.ownerDocument;
      }
      if (!root_document) {
        root_document = ref_window2 && ref_window2.document || document;
      }
      if (root_document.fullscreenElement) {
        root_document.fullscreenElement.appendChild(root);
      } else {
        root_document.body.appendChild(root);
      }
      let left = this.options.left || 0;
      let top = this.options.top || 0;
      if (this.options.event) {
        const event2 = this.options.event;
        left = event2.clientX - 10;
        top = event2.clientY - 10;
        if (this.options.title) {
          top -= 20;
        }
        if (this.options.parentMenu) {
          const rect = this.options.parentMenu.root.getBoundingClientRect();
          left = rect.left + rect.width;
        }
        const body_rect = document.body.getBoundingClientRect();
        const root_rect = root.getBoundingClientRect();
        if (body_rect.height == 0) {
          console.error(
            "document.body height is 0. That is dangerous, set html,body { height: 100%; }"
          );
        }
        if (body_rect.width && left > body_rect.width - root_rect.width - 10) {
          left = body_rect.width - root_rect.width - 10;
        }
        if (body_rect.height && top > body_rect.height - root_rect.height - 10) {
          top = body_rect.height - root_rect.height - 10;
        }
      }
      root.style.left = left + "px";
      root.style.top = top + "px";
      if (this.options.scale) {
        root.style.transform = "scale(" + this.options.scale + ")";
      }
    }
    static host() {
      return { ...defaultHost, ...this.liteGraph || {} };
    }
    addItem(name, value, options) {
      options = options || {};
      const element = document.createElement("div");
      element.className = "litemenu-entry submenu";
      let disabled = false;
      if (value === null) {
        element.classList.add("separator");
      } else {
        element.innerHTML = value && value.title ? value.title : name;
        element.value = value;
        if (value) {
          if (value.disabled) {
            disabled = true;
            element.classList.add("disabled");
          }
          if (value.submenu || value.has_submenu) {
            element.classList.add("has_submenu");
          }
        }
        if (typeof value == "function") {
          element.dataset.value = name;
          element.onclick_callback = value;
        } else {
          element.dataset.value = value;
        }
        if (value && value.className) {
          element.className += " " + value.className;
        }
      }
      this.root.appendChild(element);
      if (!disabled) {
        element.addEventListener("click", inner_onclick);
      }
      if (!disabled && options.autoopen) {
        ContextMenu2.host().pointerListenerAdd(element, "enter", inner_over);
      }
      const that2 = this;
      function inner_over(e) {
        const entryValue = this.value;
        if (!entryValue || !entryValue.has_submenu) {
          return;
        }
        inner_onclick.call(this, e);
      }
      function inner_onclick(e) {
        const entryValue = this.value;
        let close_parent = true;
        if (that2.current_submenu) {
          that2.current_submenu.close(e);
        }
        if (options.callback) {
          const result = options.callback.call(
            this,
            entryValue,
            options,
            e,
            that2,
            options.node
          );
          if (result === true) {
            close_parent = false;
          }
        }
        if (entryValue) {
          if (entryValue.callback && !options.ignore_item_callbacks && entryValue.disabled !== true) {
            const result = entryValue.callback.call(
              this,
              entryValue,
              options,
              e,
              that2,
              options.extra
            );
            if (result === true) {
              close_parent = false;
            }
          }
          if (entryValue.submenu) {
            if (!entryValue.submenu.options) {
              throw "ContextMenu submenu needs options";
            }
            new that2.constructor(
              entryValue.submenu.options,
              {
                callback: entryValue.submenu.callback,
                event: e,
                parentMenu: that2,
                ignore_item_callbacks: entryValue.submenu.ignore_item_callbacks,
                title: entryValue.submenu.title,
                extra: entryValue.submenu.extra,
                autoopen: options.autoopen
              }
            );
            close_parent = false;
          }
        }
        if (close_parent && !that2.lock) {
          that2.close();
        }
      }
      return element;
    }
    close(e, ignore_parent_menu) {
      if (this.root.parentNode) {
        this.root.parentNode.removeChild(this.root);
      }
      if (this.parentMenu && !ignore_parent_menu) {
        this.parentMenu.lock = false;
        this.parentMenu.current_submenu = null;
        if (e === void 0) {
          this.parentMenu.close();
        } else if (e && !ContextMenu2.isCursorOverElement(e, this.parentMenu.root)) {
          ContextMenu2.trigger(
            this.parentMenu.root,
            ContextMenu2.host().pointerevents_method + "leave",
            e
          );
        }
      }
      if (this.current_submenu) {
        this.current_submenu.close(e, true);
      }
      if (this.root.closing_timer) {
        clearTimeout(this.root.closing_timer);
      }
    }
    static trigger(element, event_name, params, origin) {
      const detail = origin === void 0 ? params : {
        params,
        origin
      };
      const evt = new CustomEvent(event_name, {
        bubbles: true,
        cancelable: true,
        detail
      });
      if (element.dispatchEvent) {
        element.dispatchEvent(evt);
      } else if (element.__events) {
        element.__events.dispatchEvent(evt);
      }
      return evt;
    }
    getTopMenu() {
      if (this.options.parentMenu) {
        return this.options.parentMenu.getTopMenu();
      }
      return this;
    }
    getFirstEvent() {
      if (this.options.parentMenu) {
        return this.options.parentMenu.getFirstEvent();
      }
      return this.options.event;
    }
    static isCursorOverElement(event2, element) {
      const left = event2.clientX;
      const top = event2.clientY;
      const rect = element.getBoundingClientRect();
      if (!rect) {
        return false;
      }
      return top > rect.top && top < rect.top + rect.height && left > rect.left && left < rect.left + rect.width;
    }
    static closeAllContextMenus(ref_window2) {
      const targetWindow = ref_window2 || window;
      const elements = targetWindow.document.querySelectorAll(".litecontextmenu");
      if (!elements.length) {
        return;
      }
      const list = [];
      for (let i2 = 0; i2 < elements.length; i2++) {
        list.push(elements[i2]);
      }
      for (let i2 = 0; i2 < list.length; i2++) {
        const element = list[i2];
        if (element.close) {
          element.close();
        } else if (element.parentNode) {
          element.parentNode.removeChild(element);
        }
      }
    }
  };
  class CurveEditor {
    constructor(points) {
      this.points = points;
      this.selected = -1;
      this.nearest = -1;
      this.size = null;
      this.must_update = true;
      this.margin = 5;
    }
    static sampleCurve(f, points) {
      if (!points) {
        return;
      }
      for (let i2 = 0; i2 < points.length - 1; ++i2) {
        const p = points[i2];
        const pn = points[i2 + 1];
        if (pn[0] < f) {
          continue;
        }
        const r = pn[0] - p[0];
        if (Math.abs(r) < 1e-5) {
          return p[1];
        }
        const local_f = (f - p[0]) / r;
        return p[1] * (1 - local_f) + pn[1] * local_f;
      }
      return 0;
    }
    draw(ctx, size, graphcanvas, background_color, line_color, inactive) {
      const points = this.points;
      if (!points) {
        return;
      }
      this.size = size;
      const w2 = size[0] - this.margin * 2;
      const h = size[1] - this.margin * 2;
      const resolvedLineColor = line_color || "#666";
      ctx.save();
      ctx.translate(this.margin, this.margin);
      if (background_color) {
        ctx.fillStyle = "#111";
        ctx.fillRect(0, 0, w2, h);
        ctx.fillStyle = "#222";
        ctx.fillRect(w2 * 0.5, 0, 1, h);
        ctx.strokeStyle = "#333";
        ctx.strokeRect(0, 0, w2, h);
      }
      ctx.strokeStyle = resolvedLineColor;
      if (inactive) {
        ctx.globalAlpha = 0.5;
      }
      ctx.beginPath();
      for (let i2 = 0; i2 < points.length; ++i2) {
        const p = points[i2];
        ctx.lineTo(p[0] * w2, (1 - p[1]) * h);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
      if (!inactive) {
        for (let i2 = 0; i2 < points.length; ++i2) {
          const p = points[i2];
          ctx.fillStyle = this.selected == i2 ? "#FFF" : this.nearest == i2 ? "#DDD" : "#AAA";
          ctx.beginPath();
          ctx.arc(p[0] * w2, (1 - p[1]) * h, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }
    // localpos is mouse in curve editor space
    onMouseDown(localpos, graphcanvas) {
      const points = this.points;
      if (!points) {
        return;
      }
      if (localpos[1] < 0) {
        return;
      }
      const w2 = this.size[0] - this.margin * 2;
      const h = this.size[1] - this.margin * 2;
      const x2 = localpos[0] - this.margin;
      const y2 = localpos[1] - this.margin;
      const pos2 = [x2, y2];
      const max_dist = 30 / graphcanvas.ds.scale;
      this.selected = this.getCloserPoint(pos2, max_dist);
      if (this.selected == -1) {
        const point = [x2 / w2, 1 - y2 / h];
        points.push(point);
        points.sort((a, b) => a[0] - b[0]);
        this.selected = points.indexOf(point);
        this.must_update = true;
      }
      if (this.selected != -1) {
        return true;
      }
    }
    onMouseMove(localpos, graphcanvas) {
      const points = this.points;
      if (!points) {
        return;
      }
      const s = this.selected;
      if (s < 0) {
        return;
      }
      const x2 = (localpos[0] - this.margin) / (this.size[0] - this.margin * 2);
      const y2 = (localpos[1] - this.margin) / (this.size[1] - this.margin * 2);
      const curvepos = [
        localpos[0] - this.margin,
        localpos[1] - this.margin
      ];
      const max_dist = 30 / graphcanvas.ds.scale;
      this._nearest = this.getCloserPoint(curvepos, max_dist);
      const point = points[s];
      if (point) {
        const is_edge_point = s == 0 || s == points.length - 1;
        if (!is_edge_point && (localpos[0] < -10 || localpos[0] > this.size[0] + 10 || localpos[1] < -10 || localpos[1] > this.size[1] + 10)) {
          points.splice(s, 1);
          this.selected = -1;
          return;
        }
        if (!is_edge_point) {
          point[0] = clamp(x2, 0, 1);
        } else {
          point[0] = s == 0 ? 0 : 1;
        }
        point[1] = 1 - clamp(y2, 0, 1);
        points.sort((a, b) => a[0] - b[0]);
        this.selected = points.indexOf(point);
        this.must_update = true;
      }
    }
    onMouseUp(localpos, graphcanvas) {
      this.selected = -1;
      return false;
    }
    getCloserPoint(pos2, max_dist) {
      const points = this.points;
      if (!points) {
        return -1;
      }
      max_dist = max_dist || 30;
      const w2 = this.size[0] - this.margin * 2;
      const h = this.size[1] - this.margin * 2;
      const num = points.length;
      const p2 = [0, 0];
      let min_dist = 1e6;
      let closest = -1;
      for (let i2 = 0; i2 < num; ++i2) {
        const p = points[i2];
        p2[0] = p[0] * w2;
        p2[1] = (1 - p[1]) * h;
        if (p2[0] < pos2[0]) ;
        const dist = distance(pos2, p2);
        if (dist > min_dist || dist > max_dist) {
          continue;
        }
        closest = i2;
        min_dist = dist;
      }
      return closest;
    }
  }
  function colorToString(c) {
    const source = c;
    return "rgba(" + Math.round(source[0] * 255).toFixed() + "," + Math.round(source[1] * 255).toFixed() + "," + Math.round(source[2] * 255).toFixed() + "," + (source.length == 4 ? source[3].toFixed(2) : "1.0") + ")";
  }
  function hex2num(hex) {
    if (hex.charAt(0) == "#") {
      hex = hex.slice(1);
    }
    hex = hex.toUpperCase();
    const hexAlphabets = "0123456789ABCDEF";
    const value = [0, 0, 0];
    let k = 0;
    let int1;
    let int2;
    for (let i2 = 0; i2 < 6; i2 += 2) {
      int1 = hexAlphabets.indexOf(hex.charAt(i2));
      int2 = hexAlphabets.indexOf(hex.charAt(i2 + 1));
      value[k] = int1 * 16 + int2;
      k++;
    }
    return value;
  }
  function num2hex(triplet) {
    const hexAlphabets = "0123456789ABCDEF";
    let hex = "#";
    let int1;
    let int2;
    for (let i2 = 0; i2 < 3; i2++) {
      int1 = triplet[i2] / 16;
      int2 = triplet[i2] % 16;
      hex += hexAlphabets.charAt(int1) + hexAlphabets.charAt(int2);
    }
    return hex;
  }
  function getParameterNames(func) {
    return (func + "").replace(/[/][/].*$/gm, "").replace(/\s+/g, "").replace(/[/][*][^/*]*[*][/]/g, "").split("){", 1)[0].replace(/^[^(]*[(]/, "").replace(/=[^,]+/g, "").split(",").filter(Boolean);
  }
  const LGraph = LGraphPersistence;
  const LGraphNode = LGraphNodeCanvasCollab;
  const LGraphGroup = LGraphGroup$1;
  const DragAndScale = DragAndScale$1;
  const LGraphCanvas = LGraphCanvasMenuPanel;
  const ContextMenu = ContextMenu$1;
  function createPointerListenerCompat(methodRef) {
    const registry2 = /* @__PURE__ */ new WeakMap();
    function resolveEvent(eventName, methodIn) {
      const requested = String(eventName || "").toLowerCase();
      let method = methodIn || "mouse";
      if (method === "pointer" && (typeof window === "undefined" || !window.PointerEvent)) {
        method = "touch";
      }
      if (requested.indexOf("mouse") === 0 || requested.indexOf("pointer") === 0 || requested.indexOf("touch") === 0) {
        return {
          domEvent: requested,
          useTouchWrapper: requested.indexOf("touch") === 0
        };
      }
      const mapMouse = {
        down: "mousedown",
        move: "mousemove",
        up: "mouseup",
        over: "mouseover",
        out: "mouseout",
        enter: "mouseenter",
        leave: "mouseleave",
        cancel: "mouseup"
      };
      const mapPointer = {
        down: "pointerdown",
        move: "pointermove",
        up: "pointerup",
        over: "pointerover",
        out: "pointerout",
        enter: "pointerenter",
        leave: "pointerleave",
        cancel: "pointercancel",
        gotpointercapture: "gotpointercapture",
        lostpointercapture: "lostpointercapture"
      };
      const mapTouch = {
        down: "touchstart",
        move: "touchmove",
        up: "touchend",
        cancel: "touchcancel",
        over: null,
        out: null,
        enter: null,
        leave: null,
        gotpointercapture: null,
        lostpointercapture: null
      };
      const map = method === "pointer" ? mapPointer : method === "touch" ? mapTouch : mapMouse;
      let domEvent = map[requested];
      if (!domEvent) {
        if (method === "touch" && (requested === "enter" || requested === "leave" || requested === "over" || requested === "out")) {
          return null;
        }
        domEvent = requested;
      }
      return {
        domEvent,
        useTouchWrapper: domEvent.indexOf("touch") === 0
      };
    }
    function resolveEventOptions(domEvent, capture) {
      if (domEvent && domEvent.indexOf("touch") === 0) {
        return { capture: !!capture, passive: false };
      }
      return !!capture;
    }
    function invokeCallback(callback, context, event2) {
      if (typeof callback === "function") {
        return callback.call(context, event2);
      }
      return callback.handleEvent(event2);
    }
    function normalizeTouchEvent(e, semanticName, method) {
      const touch = e.changedTouches && e.changedTouches.length && e.changedTouches[0] || e.touches && e.touches.length && e.touches[0];
      if (!touch) {
        return null;
      }
      const normalized = {
        type: method + semanticName,
        clientX: touch.clientX,
        clientY: touch.clientY,
        pageX: touch.pageX,
        pageY: touch.pageY,
        screenX: touch.screenX,
        screenY: touch.screenY,
        which: 1,
        button: 0,
        buttons: e.type === "touchend" || e.type === "touchcancel" ? 0 : 1,
        isPrimary: true,
        pointerId: touch.identifier || 1,
        shiftKey: !!e.shiftKey,
        ctrlKey: !!e.ctrlKey,
        altKey: !!e.altKey,
        metaKey: !!e.metaKey,
        target: e.target,
        originalEvent: e,
        preventDefault: () => {
          if (e.cancelable && e.preventDefault) {
            e.preventDefault();
          }
        },
        stopPropagation: () => {
          if (e.stopPropagation) {
            e.stopPropagation();
          }
        },
        stopImmediatePropagation: () => {
          if (e.stopImmediatePropagation) {
            e.stopImmediatePropagation();
          }
        }
      };
      return normalized;
    }
    function add(dom, eventName, callback, capture = false) {
      if (!dom || !("addEventListener" in dom)) {
        return;
      }
      const method = methodRef();
      const semanticName = String(eventName || "").toLowerCase();
      const resolved = resolveEvent(semanticName, method);
      if (!resolved || !resolved.domEvent) {
        return;
      }
      const domEvent = resolved.domEvent;
      let wrapped = callback;
      if (resolved.useTouchWrapper) {
        wrapped = function(ev) {
          const normalized = normalizeTouchEvent(
            ev,
            semanticName,
            method
          );
          if (!normalized) {
            return;
          }
          if (semanticName === "down" || semanticName === "move" || semanticName === "up" || semanticName === "cancel" || semanticName === "enter" || semanticName === "leave" || semanticName === "over" || semanticName === "out" || semanticName === "gotpointercapture" || semanticName === "lostpointercapture") {
            normalized.type = (methodRef() || "mouse") + semanticName;
          }
          invokeCallback(callback, this, normalized);
        };
      }
      let bucket = registry2.get(dom);
      if (!bucket) {
        bucket = {};
        registry2.set(dom, bucket);
      }
      const key = domEvent + "|" + (capture ? "1" : "0");
      if (!bucket[key]) {
        bucket[key] = [];
      }
      const existing = bucket[key].find((entry) => entry.original === callback);
      if (existing) {
        return;
      }
      bucket[key].push({ original: callback, wrapped });
      dom.addEventListener(
        domEvent,
        wrapped,
        resolveEventOptions(domEvent, !!capture)
      );
    }
    function remove(dom, eventName, callback, capture = false) {
      if (!dom || !("removeEventListener" in dom)) {
        return;
      }
      const method = methodRef();
      const semanticName = String(eventName || "").toLowerCase();
      const resolved = resolveEvent(semanticName, method);
      if (!resolved || !resolved.domEvent) {
        return;
      }
      const domEvent = resolved.domEvent;
      let wrapped = callback;
      const bucket = registry2.get(dom);
      const key = domEvent + "|" + (capture ? "1" : "0");
      if (bucket && bucket[key]) {
        const idx = bucket[key].findIndex(
          (entry) => entry.original === callback
        );
        if (idx >= 0) {
          wrapped = bucket[key][idx].wrapped;
          bucket[key].splice(idx, 1);
        }
      }
      dom.removeEventListener(
        domEvent,
        wrapped,
        resolveEventOptions(domEvent, !!capture)
      );
    }
    return { add, remove };
  }
  function extendClass(target, origin) {
    var _a2, _b2;
    for (const i2 in origin) {
      if (Object.prototype.hasOwnProperty.call(target, i2)) {
        continue;
      }
      target[i2] = origin[i2];
    }
    if (!("prototype" in target) || !("prototype" in origin)) {
      return target;
    }
    const targetPrototype = target.prototype;
    const originPrototype = origin.prototype;
    for (const i2 in originPrototype) {
      if (!Object.prototype.hasOwnProperty.call(originPrototype, i2)) {
        continue;
      }
      if (Object.prototype.hasOwnProperty.call(targetPrototype, i2)) {
        continue;
      }
      const getter = (_a2 = originPrototype.__lookupGetter__) == null ? void 0 : _a2.call(originPrototype, i2);
      if (getter) {
        targetPrototype.__defineGetter__(i2, getter);
      } else {
        targetPrototype[i2] = originPrototype[i2];
      }
      const setter = (_b2 = originPrototype.__lookupSetter__) == null ? void 0 : _b2.call(originPrototype, i2);
      if (setter) {
        targetPrototype.__defineSetter__(i2, setter);
      }
    }
    return target;
  }
  function createLiteGraphNamespace() {
    const liteGraph = { ...LiteGraphConstants };
    applyGridSquareShapeAlias(liteGraph);
    const pointerCompat = createPointerListenerCompat(
      () => String(liteGraph.pointerevents_method || "mouse")
    );
    liteGraph.getTime = createTimeSource();
    liteGraph.getParameterNames = getParameterNames;
    liteGraph.compareObjects = compareObjects;
    liteGraph.distance = distance;
    liteGraph.colorToString = colorToString;
    liteGraph.isInsideRectangle = isInsideRectangle$1;
    liteGraph.growBounding = growBounding;
    liteGraph.isInsideBounding = isInsideBounding;
    liteGraph.hex2num = hex2num;
    liteGraph.num2hex = num2hex;
    liteGraph.extendClass = extendClass;
    liteGraph.pointerListenerAdd = pointerCompat.add;
    liteGraph.pointerListenerRemove = pointerCompat.remove;
    liteGraph.closeAllContextMenus = ContextMenu.closeAllContextMenus.bind(ContextMenu);
    liteGraph.LGraph = LGraph;
    liteGraph.LLink = LLink;
    liteGraph.LGraphNode = LGraphNode;
    liteGraph.LGraphGroup = LGraphGroup;
    liteGraph.DragAndScale = DragAndScale;
    liteGraph.LGraphCanvas = LGraphCanvas;
    liteGraph.ContextMenu = ContextMenu;
    liteGraph.CurveEditor = CurveEditor;
    const registry2 = new LiteGraphRegistry(
      liteGraph,
      LGraphNode.prototype
    );
    liteGraph.registerNodeType = registry2.registerNodeType.bind(registry2);
    liteGraph.unregisterNodeType = registry2.unregisterNodeType.bind(registry2);
    liteGraph.clearRegisteredTypes = registry2.clearRegisteredTypes.bind(registry2);
    liteGraph.addNodeMethod = registry2.addNodeMethod.bind(registry2);
    liteGraph.createNode = registry2.createNode.bind(registry2);
    liteGraph.getNodeType = registry2.getNodeType.bind(registry2);
    liteGraph.getNodeTypesInCategory = registry2.getNodeTypesInCategory.bind(registry2);
    liteGraph.getNodeTypesCategories = registry2.getNodeTypesCategories.bind(registry2);
    const runtime2 = new LiteGraphRuntime({
      ...liteGraph,
      registerNodeType: liteGraph.registerNodeType.bind(liteGraph),
      getParameterNames
    });
    liteGraph.registerNodeAndSlotType = runtime2.registerNodeAndSlotType.bind(runtime2);
    liteGraph.buildNodeClassFromObject = runtime2.buildNodeClassFromObject.bind(runtime2);
    liteGraph.wrapFunctionAsNode = runtime2.wrapFunctionAsNode.bind(runtime2);
    liteGraph.reloadNodes = runtime2.reloadNodes.bind(runtime2);
    liteGraph.cloneObject = runtime2.cloneObject.bind(runtime2);
    liteGraph.uuidv4 = runtime2.uuidv4.bind(runtime2);
    liteGraph.isValidConnection = runtime2.isValidConnection.bind(runtime2);
    liteGraph.registerSearchboxExtra = runtime2.registerSearchboxExtra.bind(runtime2);
    liteGraph.fetchFile = runtime2.fetchFile.bind(runtime2);
    LGraph.liteGraph = liteGraph;
    LGraphNode$1.liteGraph = liteGraph;
    LGraphNodeExecution.liteGraph = liteGraph;
    LGraphNodePortsWidgets.liteGraph = liteGraph;
    LGraphNodeConnectGeometry.liteGraph = liteGraph;
    LGraphNode.liteGraph = liteGraph;
    LGraphCanvas$1.liteGraph = liteGraph;
    LGraphCanvasLifecycle.liteGraph = liteGraph;
    LGraphCanvasInput.liteGraph = liteGraph;
    LGraphCanvasRender.liteGraph = liteGraph;
    LGraphCanvas.liteGraph = liteGraph;
    DragAndScale.liteGraph = liteGraph;
    ContextMenu.liteGraph = liteGraph;
    LGraphGroup.liteGraphCanvas = {
      node_colors: LGraphCanvas.node_colors
    };
    applyLiteGraphApiCompatAliases({
      liteGraph,
      canvasStatic: LGraphCanvas,
      canvasPrototype: LGraphCanvas.prototype
    });
    return { liteGraph, registry: registry2, runtime: runtime2 };
  }
  function toGlobalScope(input) {
    if (input) {
      return input;
    }
    return globalThis;
  }
  function assembleLiteGraph(options = {}) {
    const { liteGraph, registry: registry2, runtime: runtime2 } = createLiteGraphNamespace();
    const globalScope = toGlobalScope(options.globalScope);
    const bundle = {
      LiteGraph: liteGraph,
      LGraph,
      LLink,
      LGraphNode,
      LGraphGroup,
      DragAndScale,
      LGraphCanvas,
      ContextMenu,
      CurveEditor,
      registry: registry2,
      runtime: runtime2
    };
    if (options.attachToGlobal) {
      const runtimeConstructors = {
        LiteGraph: liteGraph,
        LGraph,
        LLink,
        LGraphNode,
        LGraphGroup,
        DragAndScale,
        LGraphCanvas,
        ContextMenu,
        CurveEditor
      };
      attachLiteGraphGlobalBridge(
        globalScope,
        runtimeConstructors,
        options.bridgeOptions
      );
    }
    if (options.attachCommonJsExports) {
      const exportsTarget = options.exportsTarget || globalScope.exports || {};
      attachLiteGraphCommonJsExports(
        exportsTarget,
        globalScope
      );
    }
    return bundle;
  }
  const defaultAssembly = assembleLiteGraph();
  const LiteGraph = defaultAssembly.LiteGraph;
  const registry = defaultAssembly.registry;
  const runtime = defaultAssembly.runtime;
  const liteGraphMigrationBundle = defaultAssembly;
  exports.CONTEXT_MENU_CLOSE_ALL_DIFF_ID = CONTEXT_MENU_CLOSE_ALL_DIFF_ID;
  exports.ContextMenu = ContextMenu;
  exports.CurveEditor = CurveEditor;
  exports.DragAndScale = DragAndScale;
  exports.GRID_SQUARE_SHAPE_DEFAULT = GRID_SQUARE_SHAPE_DEFAULT;
  exports.GRID_SQUARE_SHAPE_DIFF_ID = GRID_SQUARE_SHAPE_DIFF_ID;
  exports.LGRAPHCANVAS_STATIC_MISSING_APIS_DIFF_ID = LGRAPHCANVAS_STATIC_MISSING_APIS_DIFF_ID;
  exports.LGRAPHCANVAS_STATIC_RESIZE_DIFF_ID = LGRAPHCANVAS_STATIC_RESIZE_DIFF_ID;
  exports.LGRAPHCANVAS_STATIC_SUBGRAPH_MENU_DIFF_ID = LGRAPHCANVAS_STATIC_SUBGRAPH_MENU_DIFF_ID;
  exports.LGRAPHGROUP_SERIALIZATION_DIFF_ID = LGRAPHGROUP_SERIALIZATION_DIFF_ID;
  exports.LGRAPH_ON_NODE_ADDED_DIFF_ID = LGRAPH_ON_NODE_ADDED_DIFF_ID;
  exports.LGraph = LGraph;
  exports.LGraphCanvas = LGraphCanvas;
  exports.LGraphGroup = LGraphGroup;
  exports.LGraphNode = LGraphNode;
  exports.LLINK_SERIALIZATION_DIFF_ID = LLINK_SERIALIZATION_DIFF_ID;
  exports.LLink = LLink;
  exports.LiteGraph = LiteGraph;
  exports.LiteGraphConstants = LiteGraphConstants;
  exports.LiteGraphRegistry = LiteGraphRegistry;
  exports.LiteGraphRuntime = LiteGraphRuntime;
  exports.applyContextMenuCloseAllCompatUi = applyContextMenuCloseAllCompat$1;
  exports.applyGridSquareShapeAlias = applyGridSquareShapeAlias;
  exports.applyLGraphCanvasStaticCompatAliasesLayer = applyLGraphCanvasStaticCompatAliases;
  exports.applyLGraphCanvasStaticCompatLayer = applyLGraphCanvasStaticCompat$1;
  exports.applyLGraphCanvasStaticMissingApiGuards = applyLGraphCanvasStaticMissingApiGuards;
  exports.assembleLiteGraph = assembleLiteGraph;
  exports.attachLiteGraphCommonJsExports = attachLiteGraphCommonJsExports;
  exports.attachLiteGraphGlobalBridge = attachLiteGraphGlobalBridge;
  exports.colorToString = colorToString;
  exports.compareObjects = compareObjects;
  exports.denormalizeSerializedLGraphGroupCompatShape = denormalizeSerializedLGraphGroup;
  exports.denormalizeSerializedLLinkCompatTuple = denormalizeSerializedLLinkTuple;
  exports.distance = distance;
  exports.getParameterNames = getParameterNames;
  exports.growBounding = growBounding;
  exports.hasGraphOnNodeAddedCompatHook = hasGraphOnNodeAddedCompatHook;
  exports.hasRequiredLGraphCanvasStaticApis = hasRequiredLGraphCanvasStaticApis;
  exports.hex2num = hex2num;
  exports.invokeGraphOnNodeAddedCompatHookModel = invokeGraphOnNodeAddedCompatHook;
  exports.isContextMenuCloseAllCompatSynced = isContextMenuCloseAllCompatSynced;
  exports.isGridSquareShapeAliasSynced = isGridSquareShapeAliasSynced;
  exports.isInsideBounding = isInsideBounding;
  exports.isInsideRectangle = isInsideRectangle$1;
  exports.isSerializedLLinkDtsOrderCompat = isSerializedLLinkDtsOrder;
  exports.liteGraphMigrationBundle = liteGraphMigrationBundle;
  exports.normalizeSerializedLGraphGroupCompatShape = normalizeSerializedLGraphGroup;
  exports.normalizeSerializedLLinkCompatTuple = normalizeSerializedLLinkTuple;
  exports.num2hex = num2hex;
  exports.parseSerializedLGraphGroupInput = parseSerializedLGraphGroupInput;
  exports.parseSerializedLLinkInput = parseSerializedLLinkInput;
  exports.registry = registry;
  exports.resolveGridSquareShapeValue = resolveGridSquareShapeValue;
  exports.runtime = runtime;
  exports.serializeLGraphGroupShape = serializeLGraphGroupShape;
  exports.serializeLLinkShape = serializeLLinkShape;
  Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
  return exports;
})({});
