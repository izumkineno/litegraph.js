
/**
 * Class representing a link object that stores link information between two nodes.
 *
 * 表示一个链接对象，用于存储两个节点之间的链接信息。
 */
export class LLink {

    /**
     * 创建一个链接对象。
     * @param {string} id - 链接的唯一标识符。
     * @param {string} type - 链接的类型。
     * @param {string} origin_id - 源节点的标识符。
     * @param {string} origin_slot - 链接连接到的源节点的插槽。
     * @param {string} target_id - 目标节点的标识符。
     * @param {string} target_slot - 链接连接到的目标节点的插槽。
     */
    constructor(id, type, origin_id, origin_slot, target_id, target_slot) {
        this.id = id;
        this.type = type;
        this.origin_id = origin_id;
        this.origin_slot = origin_slot;
        this.target_id = target_id;
        this.target_slot = target_slot;

        this._data = null; // 用于存储链接的额外数据
        this._pos = new Float32Array(2); // 链接的中心位置
    }

    /**
     * 使用新数据配置链接对象。
     * @param {Array|Object} o - 包含链接数据的数组或对象，用于配置。
     */
    configure(o) {
        if (o.constructor === Array) {
            // 如果输入是数组，按顺序解析各个属性
            this.id = o[0];
            this.origin_id = o[1];
            this.origin_slot = o[2];
            this.target_id = o[3];
            this.target_slot = o[4];
            this.type = o[5];
        } else {
            // 如果输入是对象，直接赋值各个属性
            this.id = o.id;
            this.type = o.type;
            this.origin_id = o.origin_id;
            this.origin_slot = o.origin_slot;
            this.target_id = o.target_id;
            this.target_slot = o.target_slot;
        }
    }

    /**
     * 将链接对象序列化为数组。
     * @returns {Array} 包含序列化链接数据的数组。
     */
    serialize() {
        return [
            this.id,
            this.origin_id,
            this.origin_slot,
            this.target_id,
            this.target_slot,
            this.type,
        ];
    }
}
