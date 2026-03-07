import { Path } from "leafer-ui";

export interface LinkViewPresentation {
    path: string;
    stroke?: string;
    visible?: boolean;
}

export class LinkViewHost {
    readonly view: Path;

    constructor(name: string) {
        this.view = new Path({
            name,
            hittable: false,
            visible: true,
            stroke: "#9A9",
            strokeWidth: 3,
            fill: "none",
            data: {
                litegraphPlaceholderKind: "link-view",
            },
        });
    }

    update(presentation: LinkViewPresentation): void {
        this.view.path = presentation.path;
        if (presentation.stroke != null) {
            this.view.stroke = presentation.stroke;
        }
        if (presentation.visible != null) {
            this.view.visible = presentation.visible;
        }
    }

    destroy(): void {
        this.view.destroy();
    }
}
