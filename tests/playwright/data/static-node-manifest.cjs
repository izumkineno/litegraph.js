const { collectStaticNodeInventory } = require("../utils/node-inventory.cjs");

const manifest = collectStaticNodeInventory();

module.exports = {
  ...manifest,
  expectedCount: 207,
};
