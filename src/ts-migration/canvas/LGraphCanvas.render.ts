// TODO: Import LGraph from its future module
// TODO: Import LGraphNode from its future module
// TODO: Import LGraphGroup from its future module
// TODO: Import ContextMenu from its future module
// TODO: Import full LiteGraph runtime host from its future module

import type { Vector2, Vector4 } from "../types/core-types";
import { clamp } from "../utils/clamp";
import { distance, isInsideRectangle, overlapBounding } from "../utils/math-geometry";
import { LGraphCanvasInput } from "./LGraphCanvas.input";

const temp_vec2 = new Float32Array(2) as unknown as Vector2;
const tmp_area = new Float32Array(4) as unknown as Vector4;
const margin_area = new Float32Array(4) as unknown as Vector4;
const link_bounding = new Float32Array(4) as unknown as Vector4;
const tempA = new Float32Array(2) as unknown as Vector2;
const tempB = new Float32Array(2) as unknown as Vector2;
const temp_point = new Float32Array(2) as unknown as Vector2;

/**
 * LGraphCanvas render pipeline layer.
 * Source: `draw/drawFrontCanvas/drawBackCanvas/drawNode/drawConnections/renderLink/drawNodeWidgets/processNodeWidgets`.
 */
export class LGraphCanvasRender extends LGraphCanvasInput {
    [key: string]: any;

    private constants(): any {
        const host = this.getLiteGraphHost();
        return {
            ...host,
            RIGHT: host.RIGHT ?? 2,
            LEFT: host.LEFT ?? 4,
            UP: host.UP ?? 1,
            DOWN: host.DOWN ?? 3,
            CENTER: host.CENTER ?? 5,
            BOX_SHAPE: host.BOX_SHAPE ?? 1,
            ROUND_SHAPE: host.ROUND_SHAPE ?? 2,
            CARD_SHAPE: host.CARD_SHAPE ?? 4,
            CIRCLE_SHAPE: host.CIRCLE_SHAPE ?? 3,
            ARROW_SHAPE: host.ARROW_SHAPE ?? 5,
            GRID_SHAPE: host.GRID_SHAPE ?? 6,
            NO_TITLE: host.NO_TITLE ?? 0,
            TRANSPARENT_TITLE: host.TRANSPARENT_TITLE ?? 1,
            AUTOHIDE_TITLE: host.AUTOHIDE_TITLE ?? 2,
            NODE_TEXT_COLOR: host.NODE_TEXT_COLOR ?? "#AAA",
            NODE_TITLE_HEIGHT: host.NODE_TITLE_HEIGHT ?? 30,
            NODE_TITLE_TEXT_Y: host.NODE_TITLE_TEXT_Y ?? 20,
            NODE_DEFAULT_COLOR: host.NODE_DEFAULT_COLOR ?? "#333",
            NODE_DEFAULT_BGCOLOR: host.NODE_DEFAULT_BGCOLOR ?? "#353535",
            NODE_DEFAULT_BOXCOLOR: host.NODE_DEFAULT_BOXCOLOR ?? "#666",
            NODE_SELECTED_TITLE_COLOR: host.NODE_SELECTED_TITLE_COLOR ?? "#FFF",
            NODE_BOX_OUTLINE_COLOR: host.NODE_BOX_OUTLINE_COLOR ?? "#FFF",
            EVENT_LINK_COLOR: host.EVENT_LINK_COLOR ?? "#A86",
            CONNECTING_LINK_COLOR: host.CONNECTING_LINK_COLOR ?? "#AFA",
            DEFAULT_SHADOW_COLOR: host.DEFAULT_SHADOW_COLOR ?? "rgba(0,0,0,0.4)",
            NODE_SLOT_HEIGHT: host.NODE_SLOT_HEIGHT ?? 20,
            NODE_WIDGET_HEIGHT: host.NODE_WIDGET_HEIGHT ?? 20,
            DEFAULT_GROUP_FONT_SIZE: host.DEFAULT_GROUP_FONT_SIZE ?? 24,
            WIDGET_OUTLINE_COLOR: host.WIDGET_OUTLINE_COLOR ?? "#666",
            WIDGET_BGCOLOR: host.WIDGET_BGCOLOR ?? "#222",
            WIDGET_TEXT_COLOR: host.WIDGET_TEXT_COLOR ?? "#DDD",
            WIDGET_SECONDARY_TEXT_COLOR: host.WIDGET_SECONDARY_TEXT_COLOR ?? "#999",
            pointerevents_method: host.pointerevents_method ?? "mouse",
            SPLINE_LINK: host.SPLINE_LINK ?? 2,
            LINEAR_LINK: host.LINEAR_LINK ?? 1,
            STRAIGHT_LINK: host.STRAIGHT_LINK ?? 0,
            node_box_coloured_by_mode: !!host.node_box_coloured_by_mode,
            node_box_coloured_when_on: !!host.node_box_coloured_when_on,
            NODE_MODES_COLORS: host.NODE_MODES_COLORS || {},
            isInsideRectangle:
                host.isInsideRectangle ||
                ((x: number, y: number, left: number, top: number, width: number, height: number) =>
                    isInsideRectangle(x, y, left, top, width, height)),
            getTime: host.getTime || (() => Date.now()),
        };
    }

    /**
     * renders the whole canvas content, by rendering in two separated canvas, one containing the background grid and the connections, and one containing the nodes)
     * @method draw
     **/
    draw(force_canvas?: boolean, force_bgcanvas?: boolean): void {
        if (!this.canvas || this.canvas.width == 0 || this.canvas.height == 0) {
            return;
        }

        const LiteGraph = this.constants();
        const now = LiteGraph.getTime();
        this.render_time = (now - this.last_draw_time) * 0.001;
        this.last_draw_time = now;

        if (this.graph) {
            this.ds.computeVisibleArea(this.viewport);
        }

        if (
            this.dirty_bgcanvas ||
            force_bgcanvas ||
            this.always_render_background ||
            (this.graph && this.graph._last_trigger_time && now - this.graph._last_trigger_time < 1000)
        ) {
            this.drawBackCanvas();
        }

        if (this.dirty_canvas || force_canvas) {
            this.drawFrontCanvas();
        }

        this.fps = this.render_time ? 1.0 / this.render_time : 0;
        this.frame += 1;
    }

    /**
     * draws the front canvas (the one containing all the nodes)
     * @method drawFrontCanvas
     **/
    drawFrontCanvas(): void {
        this.dirty_canvas = false;

        if (!this.ctx && this.bgcanvas) {
            this.ctx = this.bgcanvas.getContext("2d");
        }
        const ctx = this.ctx as (CanvasRenderingContext2D & Record<string, any>) | null;
        if (!ctx) {
            return;
        }

        const LiteGraph = this.constants();
        const canvas = this.canvas as HTMLCanvasElement;
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

        this.onRender?.(canvas, ctx);
        if (this.show_info) {
            this.renderInfo(ctx, area ? area[0] : 0, area ? area[1] : 0);
        }

        if (this.graph) {
            ctx.save();
            this.ds.toCanvasContext(ctx);

            const visible_nodes = this.computeVisibleNodes(null as never, this.visible_nodes);
            for (let i = 0; i < visible_nodes.length; ++i) {
                const node = visible_nodes[i];
                ctx.save();
                ctx.translate(node.pos[0], node.pos[1]);
                this.drawNode(node, ctx);
                ctx.restore();
            }

            if (this.render_execution_order) {
                this.drawExecutionOrder(ctx);
            }

            if (this.graph.config?.links_ontop && !this.live_mode) {
                this.drawConnections(ctx);
            }

            if (this.connecting_pos != null) {
                ctx.lineWidth = this.connections_width;
                let link_color = null;
                const connInOrOut = this.connecting_output || this.connecting_input;
                const connType = connInOrOut.type;
                let connDir = connInOrOut.dir;
                if (connDir == null) {
                    connDir = this.connecting_output
                        ? this.connecting_node.horizontal
                            ? LiteGraph.DOWN
                            : LiteGraph.RIGHT
                        : this.connecting_node.horizontal
                          ? LiteGraph.UP
                          : LiteGraph.LEFT;
                }
                const connShape = connInOrOut.shape;
                link_color =
                    connType === LiteGraph.EVENT
                        ? LiteGraph.EVENT_LINK_COLOR
                        : LiteGraph.CONNECTING_LINK_COLOR;

                this.renderLink(
                    ctx,
                    this.connecting_pos,
                    [this.graph_mouse[0], this.graph_mouse[1]],
                    null,
                    false,
                    null,
                    link_color,
                    connDir,
                    LiteGraph.CENTER
                );

                ctx.beginPath();
                if (connType === LiteGraph.EVENT || connShape === LiteGraph.BOX_SHAPE) {
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

        this.onDrawOverlay?.(ctx);
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
    renderInfo(ctx: CanvasRenderingContext2D, x?: number, y?: number): void {
        x = x || 10;
        y = y || (this.canvas ? this.canvas.height - 80 : 0);
        ctx.save();
        ctx.translate(x, y);
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
    drawBackCanvas(): void {
        const LiteGraph = this.constants();
        const canvas = this.bgcanvas as HTMLCanvasElement;
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
        const ctx = this.bgctx as (CanvasRenderingContext2D & Record<string, any>) | null;
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
            for (let i = 1; i < this._graph_stack.length; ++i) {
                title += (this._graph_stack[i] as any)._subgraph_node.getTitle() + " >> ";
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
                    ctx.globalAlpha = (1.0 - 0.5 / this.ds.scale) * this.editor_alpha;
                } else {
                    ctx.globalAlpha = this.editor_alpha;
                }
                ctx.imageSmoothingEnabled = false;

                if (!this._bg_img || this._bg_img.name != this.background_image) {
                    this._bg_img = new Image();
                    this._bg_img.name = this.background_image;
                    this._bg_img.src = this.background_image;
                    this._bg_img.onload = (): void => {
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
                ctx.globalAlpha = 1.0;
                ctx.imageSmoothingEnabled = true;
            }

            if (this.graph._groups?.length && !this.live_mode) {
                this.drawGroups(canvas, ctx);
            }

            this.onDrawBackground?.(ctx, this.visible_area);

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
    drawNode(node: any, ctx: CanvasRenderingContext2D): void {
        const LiteGraph = this.constants();
        this.current_node = node;

        const color = node.color || node.constructor.color || LiteGraph.NODE_DEFAULT_COLOR;
        let bgcolor = node.bgcolor || node.constructor.bgcolor || LiteGraph.NODE_DEFAULT_BGCOLOR;
        const low_quality = this.ds.scale < 0.6;

        if (this.live_mode) {
            if (!node.flags.collapsed) {
                ctx.shadowColor = "transparent";
                node.onDrawForeground?.(ctx, this, this.canvas);
            }
            return;
        }

        const editor_alpha = this.editor_alpha;
        ctx.globalAlpha = editor_alpha;

        if (this.render_shadows && !low_quality) {
            ctx.shadowColor = LiteGraph.DEFAULT_SHADOW_COLOR;
            ctx.shadowOffsetX = 2 * this.ds.scale;
            ctx.shadowOffsetY = 2 * this.ds.scale;
            ctx.shadowBlur = 3 * this.ds.scale;
        } else {
            ctx.shadowColor = "transparent";
        }

        if (node.flags.collapsed && node.onDrawCollapsed && node.onDrawCollapsed(ctx, this) == true) {
            return;
        }

        const shape = node._shape || LiteGraph.BOX_SHAPE;
        const size = temp_vec2;
        size[0] = node.size[0];
        size[1] = node.size[1];
        const horizontal = node.horizontal;

        if (node.flags.collapsed) {
            ctx.font = this.inner_text_font;
            const title = node.getTitle ? node.getTitle() : node.title;
            if (title != null) {
                node._collapsed_width = Math.min(
                    node.size[0],
                    ctx.measureText(title).width + LiteGraph.NODE_TITLE_HEIGHT * 2
                );
                size[0] = node._collapsed_width;
                size[1] = 0;
            }
        }

        if (node.clip_area) {
            ctx.save();
            ctx.beginPath();
            if (shape == LiteGraph.BOX_SHAPE) {
                ctx.rect(0, 0, size[0], size[1]);
            } else if (shape == LiteGraph.ROUND_SHAPE) {
                (ctx as any).roundRect(0, 0, size[0], size[1], [10]);
            } else if (shape == LiteGraph.CIRCLE_SHAPE) {
                ctx.arc(size[0] * 0.5, size[1] * 0.5, size[0] * 0.5, 0, Math.PI * 2);
            }
            ctx.clip();
        }

        if (node.has_errors) {
            bgcolor = "red";
        }
        this.drawNodeShape(
            node,
            ctx,
            size as unknown as [number, number],
            color,
            bgcolor,
            node.is_selected,
            node.mouseOver
        );
        ctx.shadowColor = "transparent";
        node.onDrawForeground?.(ctx, this, this.canvas);

        // 迁移阶段保留核心节点绘制，插槽/控件完整处理交由 drawNodeWidgets/processNodeWidgets。
        ctx.textAlign = horizontal ? "center" : "left";
        ctx.font = this.inner_text_font;

        if (node.widgets && !node.flags.collapsed) {
            let widgets_y = 2;
            if (node.widgets_start_y != null) {
                widgets_y = node.widgets_start_y;
            }
            this.drawNodeWidgets(
                node,
                widgets_y,
                ctx,
                this.node_widget && this.node_widget[0] == node ? this.node_widget[1] : null
            );
        }

        if (node.clip_area) {
            ctx.restore();
        }
        ctx.globalAlpha = 1.0;
    }

    // used by this.over_link_center
    drawLinkTooltip(ctx: CanvasRenderingContext2D, link: any): void {
        const pos = link._pos;
        ctx.fillStyle = "black";
        ctx.beginPath();
        ctx.arc(pos[0], pos[1], 3, 0, Math.PI * 2);
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
        const w = info.width + 20;
        const h = 24;
        ctx.shadowColor = "black";
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
        ctx.shadowBlur = 3;
        ctx.fillStyle = "#454";
        ctx.beginPath();
        (ctx as any).roundRect(pos[0] - w * 0.5, pos[1] - 15 - h, w, h, [3]);
        ctx.moveTo(pos[0] - 10, pos[1] - 15);
        ctx.lineTo(pos[0] + 10, pos[1] - 15);
        ctx.lineTo(pos[0], pos[1] - 5);
        ctx.fill();
        ctx.shadowColor = "transparent";
        ctx.textAlign = "center";
        ctx.fillStyle = "#CEC";
        ctx.fillText(text, pos[0], pos[1] - 15 - h * 0.3);
    }

    drawSlotGraphic(
        ctx: CanvasRenderingContext2D,
        pos: number[],
        shape: number,
        _horizontal: boolean
    ): void {
        const LiteGraph = this.constants();
        if (shape === LiteGraph.GRID_SHAPE) {
            ctx.rect(pos[0] - 4, pos[1] - 4, 2, 2);
            ctx.rect(pos[0] - 1, pos[1] - 4, 2, 2);
            ctx.rect(pos[0] + 2, pos[1] - 4, 2, 2);
            ctx.rect(pos[0] - 4, pos[1] - 1, 2, 2);
            ctx.rect(pos[0] - 1, pos[1] - 1, 2, 2);
            ctx.rect(pos[0] + 2, pos[1] - 1, 2, 2);
            ctx.rect(pos[0] - 4, pos[1] + 2, 2, 2);
            ctx.rect(pos[0] - 1, pos[1] + 2, 2, 2);
            ctx.rect(pos[0] + 2, pos[1] + 2, 2, 2);
            return;
        }
        ctx.arc(pos[0], pos[1], 4, 0, Math.PI * 2);
    }

    /**
     * draws the shape of the given node in the canvas
     * @method drawNodeShape
     **/
    drawNodeShape(
        node: any,
        ctx: CanvasRenderingContext2D,
        size: [number, number],
        fgcolor: string,
        bgcolor: string,
        selected: boolean,
        mouse_over: boolean
    ): void {
        const LiteGraph = this.constants();
        ctx.strokeStyle = fgcolor;
        ctx.fillStyle = bgcolor;

        const title_height = LiteGraph.NODE_TITLE_HEIGHT;
        const low_quality = this.ds.scale < 0.5;
        const shape = node._shape || node.constructor.shape || LiteGraph.ROUND_SHAPE;
        const title_mode = node.constructor.title_mode;

        let render_title = true;
        if (title_mode == LiteGraph.TRANSPARENT_TITLE || title_mode == LiteGraph.NO_TITLE) {
            render_title = false;
        } else if (title_mode == LiteGraph.AUTOHIDE_TITLE && mouse_over) {
            render_title = true;
        }

        const area = tmp_area;
        area[0] = 0;
        area[1] = render_title ? -title_height : 0;
        area[2] = size[0] + 1;
        area[3] = render_title ? size[1] + title_height : size[1];
        const old_alpha = ctx.globalAlpha;

        ctx.beginPath();
        if (shape == LiteGraph.BOX_SHAPE || low_quality) {
            ctx.fillRect(area[0], area[1], area[2], area[3]);
        } else if (shape == LiteGraph.ROUND_SHAPE || shape == LiteGraph.CARD_SHAPE) {
            (ctx as any).roundRect(
                area[0],
                area[1],
                area[2],
                area[3],
                shape == LiteGraph.CARD_SHAPE ? [this.round_radius, this.round_radius, 0, 0] : [this.round_radius]
            );
            ctx.fill();
        } else if (shape == LiteGraph.CIRCLE_SHAPE) {
            ctx.arc(size[0] * 0.5, size[1] * 0.5, size[0] * 0.5, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.fill();
        }

        if (!node.flags.collapsed && render_title) {
            ctx.shadowColor = "transparent";
            ctx.fillStyle = "rgba(0,0,0,0.2)";
            ctx.fillRect(0, -1, area[2], 2);
        }

        if (node.onDrawBackground) {
            node.onDrawBackground(ctx, this, this.canvas, this.graph_mouse);
        }

        if (render_title || title_mode == LiteGraph.TRANSPARENT_TITLE) {
            if (node.onDrawTitleBar) {
                node.onDrawTitleBar(ctx, title_height, size, this.ds.scale, fgcolor);
            } else {
                const title_color = node.constructor.title_color || fgcolor;
                ctx.fillStyle = title_color;
                ctx.beginPath();
                if (shape == LiteGraph.BOX_SHAPE || low_quality) {
                    ctx.rect(0, -title_height, size[0] + 1, title_height);
                } else {
                    (ctx as any).roundRect(
                        0,
                        -title_height,
                        size[0] + 1,
                        title_height,
                        node.flags.collapsed ? [this.round_radius] : [this.round_radius, this.round_radius, 0, 0]
                    );
                }
                ctx.fill();
            }

            const box_size = 10;
            ctx.fillStyle = node.boxcolor || LiteGraph.NODE_DEFAULT_BOXCOLOR;
            if (low_quality) {
                ctx.fillRect(
                    title_height * 0.5 - box_size * 0.5,
                    title_height * -0.5 - box_size * 0.5,
                    box_size,
                    box_size
                );
            } else {
                ctx.beginPath();
                ctx.arc(title_height * 0.5, title_height * -0.5, box_size * 0.5, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.globalAlpha = old_alpha;
            if (!low_quality) {
                ctx.font = this.title_text_font;
                const title = String(node.getTitle?.() || node.title || "");
                if (title) {
                    ctx.fillStyle = selected
                        ? LiteGraph.NODE_SELECTED_TITLE_COLOR
                        : node.constructor.title_text_color || this.node_title_color;
                    ctx.textAlign = "left";
                    ctx.fillText(
                        node.flags.collapsed ? title.substr(0, 20) : title,
                        title_height,
                        LiteGraph.NODE_TITLE_TEXT_Y - title_height
                    );
                }
            }
        }

        if (selected) {
            node.onBounding?.(area);
            ctx.lineWidth = 1;
            ctx.globalAlpha = 0.8;
            ctx.beginPath();
            (ctx as any).roundRect(
                -6 + area[0],
                -6 + area[1],
                12 + area[2],
                12 + area[3],
                [this.round_radius * 2]
            );
            ctx.strokeStyle = LiteGraph.NODE_BOX_OUTLINE_COLOR;
            ctx.stroke();
            ctx.strokeStyle = fgcolor;
            ctx.globalAlpha = 1;
        }

        if (node.execute_triggered > 0) {
            node.execute_triggered--;
        }
        if (node.action_triggered > 0) {
            node.action_triggered--;
        }
    }

    /**
     * draws every connection visible in the canvas
     * @method drawConnections
     **/
    drawConnections(ctx: CanvasRenderingContext2D): void {
        const LiteGraph = this.constants();
        const now = LiteGraph.getTime();
        const visible_area = this.visible_area as unknown as Vector4;
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
            const node = nodes[n];
            if (!node.inputs || !node.inputs.length) {
                continue;
            }

            for (let i = 0; i < node.inputs.length; ++i) {
                const input = node.inputs[i];
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
                const start_node_slotpos =
                    start_node_slot == -1
                        ? ([start_node.pos[0] + 10, start_node.pos[1] + 10] as Vector2)
                        : start_node.getConnectionPos(false, start_node_slot, tempA);
                const end_node_slotpos = node.getConnectionPos(true, i, tempB);

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
                const end_slot = node.inputs[i];
                if (!start_slot || !end_slot) {
                    continue;
                }
                const start_dir = start_slot.dir || (start_node.horizontal ? LiteGraph.DOWN : LiteGraph.RIGHT);
                const end_dir = end_slot.dir || (node.horizontal ? LiteGraph.UP : LiteGraph.LEFT);

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

                if (link._last_time && now - link._last_time < 1000) {
                    const f = 2.0 - (now - link._last_time) * 0.002;
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
    renderLink(
        ctx: CanvasRenderingContext2D,
        a: Vector2,
        b: Vector2,
        link: any,
        skip_border?: boolean,
        flow?: boolean | number | null,
        color?: string | null,
        start_dir?: number,
        end_dir?: number,
        num_sublines?: number
    ): void {
        const LiteGraph = this.constants();
        if (link) {
            this.visible_links.push(link);
        }

        if (!color && link) {
            color = link.color || (this.constructor as any).link_type_colors?.[link.type];
        }
        if (!color) {
            color = this.default_link_color;
        }
        if (link != null && this.highlighted_links[link.id]) {
            color = "#FFF";
        }

        start_dir = start_dir || LiteGraph.RIGHT;
        end_dir = end_dir || LiteGraph.LEFT;
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
        for (let i = 0; i < num_sublines; i += 1) {
            const offsety = (i - (num_sublines - 1) * 0.5) * 5;
            ctx.moveTo(a[0], a[1] + offsety);
            const start_offset_x = start_dir == LiteGraph.LEFT ? dist * -0.25 : start_dir == LiteGraph.RIGHT ? dist * 0.25 : 0;
            const start_offset_y = start_dir == LiteGraph.UP ? dist * -0.25 : start_dir == LiteGraph.DOWN ? dist * 0.25 : 0;
            const end_offset_x = end_dir == LiteGraph.LEFT ? dist * -0.25 : end_dir == LiteGraph.RIGHT ? dist * 0.25 : 0;
            const end_offset_y = end_dir == LiteGraph.UP ? dist * -0.25 : end_dir == LiteGraph.DOWN ? dist * 0.25 : 0;

            if (this.links_render_mode == LiteGraph.LINEAR_LINK) {
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
        ctx.fillStyle = ctx.strokeStyle = color as string;
        ctx.stroke();

        const pos = this.computeConnectionPoint(a, b, 0.5, start_dir, end_dir);
        if (link && link._pos) {
            link._pos[0] = pos[0];
            link._pos[1] = pos[1];
        }

        if (flow) {
            ctx.fillStyle = color as string;
            for (let i = 0; i < 5; ++i) {
                const f = (LiteGraph.getTime() * 0.001 + i * 0.2) % 1;
                const p = this.computeConnectionPoint(a, b, f, start_dir, end_dir);
                ctx.beginPath();
                ctx.arc(p[0], p[1], 5, 0, 2 * Math.PI);
                ctx.fill();
            }
        }
    }

    computeConnectionPoint(
        a: Vector2,
        b: Vector2,
        t: number,
        start_dir?: number,
        end_dir?: number
    ): Vector2 {
        const LiteGraph = this.constants();
        start_dir = start_dir || LiteGraph.RIGHT;
        end_dir = end_dir || LiteGraph.LEFT;

        const dist = distance(a, b);
        const p0 = a;
        const p1: Vector2 = [a[0], a[1]];
        const p2: Vector2 = [b[0], b[1]];
        const p3 = b;

        if (start_dir == LiteGraph.LEFT) p1[0] += dist * -0.25;
        if (start_dir == LiteGraph.RIGHT) p1[0] += dist * 0.25;
        if (start_dir == LiteGraph.UP) p1[1] += dist * -0.25;
        if (start_dir == LiteGraph.DOWN) p1[1] += dist * 0.25;
        if (end_dir == LiteGraph.LEFT) p2[0] += dist * -0.25;
        if (end_dir == LiteGraph.RIGHT) p2[0] += dist * 0.25;
        if (end_dir == LiteGraph.UP) p2[1] += dist * -0.25;
        if (end_dir == LiteGraph.DOWN) p2[1] += dist * 0.25;

        const c1 = (1 - t) * (1 - t) * (1 - t);
        const c2 = 3 * ((1 - t) * (1 - t)) * t;
        const c3 = 3 * (1 - t) * (t * t);
        const c4 = t * t * t;
        temp_point[0] = c1 * p0[0] + c2 * p1[0] + c3 * p2[0] + c4 * p3[0];
        temp_point[1] = c1 * p0[1] + c2 * p1[1] + c3 * p2[1] + c4 * p3[1];
        return temp_point;
    }

    drawExecutionOrder(ctx: CanvasRenderingContext2D): void {
        const LiteGraph = this.constants();
        ctx.shadowColor = "transparent";
        ctx.globalAlpha = 0.25;
        ctx.textAlign = "center";
        ctx.strokeStyle = "white";
        ctx.globalAlpha = 0.75;

        const visible_nodes = this.visible_nodes || [];
        for (let i = 0; i < visible_nodes.length; ++i) {
            const node = visible_nodes[i];
            ctx.fillStyle = "black";
            ctx.fillRect(
                node.pos[0] - LiteGraph.NODE_TITLE_HEIGHT,
                node.pos[1] - LiteGraph.NODE_TITLE_HEIGHT,
                LiteGraph.NODE_TITLE_HEIGHT,
                LiteGraph.NODE_TITLE_HEIGHT
            );
            if (node.order == 0) {
                ctx.strokeRect(
                    node.pos[0] - LiteGraph.NODE_TITLE_HEIGHT + 0.5,
                    node.pos[1] - LiteGraph.NODE_TITLE_HEIGHT + 0.5,
                    LiteGraph.NODE_TITLE_HEIGHT,
                    LiteGraph.NODE_TITLE_HEIGHT
                );
            }
            ctx.fillStyle = "#FFF";
            ctx.fillText(node.order, node.pos[0] + LiteGraph.NODE_TITLE_HEIGHT * -0.5, node.pos[1] - 6);
        }
        ctx.globalAlpha = 1;
    }

    drawNodeWidgets(node: any, posY: number, ctx: CanvasRenderingContext2D, active_widget: any): void {
        const LiteGraph = this.constants();
        if (!node.widgets || !node.widgets.length) {
            return;
        }
        const width = node.size[0];
        const H = LiteGraph.NODE_WIDGET_HEIGHT;
        const show_text = this.ds.scale > 0.5;
        posY += 2;
        ctx.save();
        ctx.globalAlpha = this.editor_alpha;
        const margin = 15;
        for (let i = 0; i < node.widgets.length; ++i) {
            const w = node.widgets[i];
            const y = w.y || posY;
            w.last_y = y;
            const widget_width = w.width || width;
            if (w.type == "slider") {
                const range = w.options.max - w.options.min;
                let nvalue = (w.value - w.options.min) / range;
                nvalue = clamp(nvalue, 0, 1);
                ctx.fillStyle = LiteGraph.WIDGET_BGCOLOR;
                ctx.fillRect(margin, y, widget_width - margin * 2, H);
                ctx.fillStyle = active_widget == w ? "#89A" : "#678";
                ctx.fillRect(margin, y, nvalue * (widget_width - margin * 2), H);
            } else {
                ctx.fillStyle = LiteGraph.WIDGET_BGCOLOR;
                ctx.fillRect(margin, y, widget_width - margin * 2, H);
            }
            if (show_text) {
                ctx.fillStyle = LiteGraph.WIDGET_TEXT_COLOR;
                ctx.textAlign = "left";
                ctx.fillText(String(w.label || w.name || ""), margin * 2, y + H * 0.7);
            }
            posY += (w.computeSize ? w.computeSize(widget_width)[1] : H) + 4;
        }
        ctx.restore();
        ctx.textAlign = "left";
    }

    processNodeWidgets(node: any, pos: Vector2, event: any, active_widget?: any): any {
        const LiteGraph = this.constants();
        if (!node.widgets || !node.widgets.length || (!this.allow_interaction && !node.flags.allow_interaction)) {
            return null;
        }

        const x = pos[0] - node.pos[0];
        const y = pos[1] - node.pos[1];
        const width = node.size[0];
        const pointerDown = LiteGraph.pointerevents_method + "down";
        const pointerMove = LiteGraph.pointerevents_method + "move";
        const that = this;

        for (let i = 0; i < node.widgets.length; ++i) {
            const w = node.widgets[i];
            if (!w || w.disabled) {
                continue;
            }
            const widget_height = w.computeSize ? w.computeSize(width)[1] : LiteGraph.NODE_WIDGET_HEIGHT;
            const widget_width = w.width || width;
            if (
                w != active_widget &&
                (x < 6 || x > widget_width - 12 || y < w.last_y || y > w.last_y + widget_height)
            ) {
                continue;
            }

            const old_value = w.value;
            if ((event.type == pointerDown || event.type == "mousedown") && w.type == "button") {
                w.clicked = true;
                if (w.callback) {
                    setTimeout(() => w.callback(w, that, node, pos, event), 20);
                }
                this.dirty_canvas = true;
            } else if (
                (event.type == pointerMove || event.type == "mousemove" || event.type == pointerDown) &&
                w.type == "slider"
            ) {
                if (!w.options.read_only) {
                    const nvalue = clamp((x - 15) / (widget_width - 30), 0, 1);
                    w.value = w.options.min + (w.options.max - w.options.min) * nvalue;
                    if (old_value != w.value) {
                        node.onWidgetChanged?.(w.name, w.value, old_value, w);
                        node.graph._version++;
                        if (w.callback) {
                            setTimeout(() => w.callback(w.value, that, node, pos, event), 20);
                        }
                    }
                }
                this.dirty_canvas = true;
            }
            return w;
        }
        return null;
    }

    drawGroups(_canvas: any, ctx: CanvasRenderingContext2D): void {
        const LiteGraph = this.constants();
        if (!this.graph) {
            return;
        }
        const groups = this.graph._groups;
        ctx.save();
        ctx.globalAlpha = 0.5 * this.editor_alpha;
        for (let i = 0; i < groups.length; ++i) {
            const group = groups[i];
            if (!overlapBounding(this.visible_area as unknown as Vector4, group._bounding)) {
                continue;
            }
            ctx.fillStyle = group.color || "#335";
            ctx.strokeStyle = group.color || "#335";
            const pos = group._pos;
            const size = group._size;
            ctx.globalAlpha = 0.25 * this.editor_alpha;
            ctx.beginPath();
            ctx.rect(pos[0] + 0.5, pos[1] + 0.5, size[0], size[1]);
            ctx.fill();
            ctx.globalAlpha = this.editor_alpha;
            ctx.stroke();

            const font_size = group.font_size || LiteGraph.DEFAULT_GROUP_FONT_SIZE;
            ctx.font = font_size + "px Arial";
            ctx.textAlign = "left";
            ctx.fillText(group.title, pos[0] + 4, pos[1] + font_size);
        }
        ctx.restore();
    }

    adjustNodesSize(): void {
        if (!this.graph) return;
        const nodes = this.graph._nodes;
        for (let i = 0; i < nodes.length; ++i) {
            nodes[i].size = nodes[i].computeSize();
        }
        this.setDirty(true, true);
    }

    resize(width?: number, height?: number): void {
        if (!this.canvas || !this.bgcanvas) {
            return;
        }
        if (!width && !height) {
            const parent = this.canvas.parentNode as HTMLElement;
            width = parent.offsetWidth;
            height = parent.offsetHeight;
        }
        if (this.canvas.width == width && this.canvas.height == height) {
            return;
        }
        this.canvas.width = width as number;
        this.canvas.height = height as number;
        this.bgcanvas.width = this.canvas.width;
        this.bgcanvas.height = this.canvas.height;
        this.setDirty(true, true);
    }

    switchLiveMode(transition?: boolean): void {
        if (!transition) {
            this.live_mode = !this.live_mode;
            this.dirty_canvas = true;
            this.dirty_bgcanvas = true;
            return;
        }

        const delta = this.live_mode ? 1.1 : 0.9;
        if (this.live_mode) {
            this.live_mode = false;
            this.editor_alpha = 0.1;
        }

        const t = setInterval(() => {
            this.editor_alpha *= delta;
            this.dirty_canvas = true;
            this.dirty_bgcanvas = true;

            if (delta < 1 && this.editor_alpha < 0.01) {
                clearInterval(t);
                if (delta < 1) {
                    this.live_mode = true;
                }
            }
            if (delta > 1 && this.editor_alpha > 0.99) {
                clearInterval(t);
                this.editor_alpha = 1;
            }
        }, 1);
    }

    onNodeSelectionChange(_node?: any): void {
        return;
    }

    touchHandler(_event: TouchEvent): void {
        // source keeps this disabled in production
    }

    drawSubgraphPanel(_ctx: CanvasRenderingContext2D): void {}
    drawSubgraphPanelLeft(_subgraph: any, _subnode: any, _ctx: CanvasRenderingContext2D): void {}
    drawSubgraphPanelRight(_subgraph: any, _subnode: any, _ctx: CanvasRenderingContext2D): void {}

    drawButton(
        x: number,
        y: number,
        w: number,
        h: number,
        text?: string | null,
        bgcolor?: string,
        hovercolor?: string,
        textcolor?: string
    ): boolean {
        const LiteGraph = this.constants();
        const ctx = this.ctx as CanvasRenderingContext2D;
        if (!ctx || !this.canvas) {
            return false;
        }
        bgcolor = bgcolor || LiteGraph.NODE_DEFAULT_COLOR;
        hovercolor = hovercolor || "#555";
        textcolor = textcolor || LiteGraph.NODE_TEXT_COLOR;
        let pos = this.ds.convertOffsetToCanvas(this.graph_mouse);
        const hover = LiteGraph.isInsideRectangle(pos[0], pos[1], x, y, w, h);
        pos = this.last_click_position ? [this.last_click_position[0], this.last_click_position[1]] : null;
        if (pos) {
            const rect = this.canvas.getBoundingClientRect();
            pos[0] -= rect.left;
            pos[1] -= rect.top;
        }
        const clicked = pos && LiteGraph.isInsideRectangle(pos[0], pos[1], x, y, w, h);

        ctx.fillStyle = hover ? hovercolor : bgcolor;
        if (clicked) {
            ctx.fillStyle = "#AAA";
        }
        ctx.fillRect(x, y, w, h);
        if (text != null) {
            ctx.fillStyle = textcolor;
            ctx.textAlign = "center";
            ctx.font = ((h * 0.65) | 0) + "px Arial";
            ctx.fillText(text, x + w * 0.5, y + h * 0.75);
            ctx.textAlign = "left";
        }

        const was_clicked = !!clicked && !this.block_click;
        if (clicked) {
            this.blockClick();
        }
        return was_clicked;
    }
}
