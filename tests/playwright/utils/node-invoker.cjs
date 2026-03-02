const DEFAULT_BY_TYPE = {
  "": 1,
  "*": 1,
  number: 42,
  float: 0.5,
  int: 7,
  integer: 7,
  bool: true,
  boolean: true,
  string: "lg-test",
  object: { foo: "bar", n: 1 },
  array: [1, 2, 3],
  vec2: [0.1, 0.2],
  vec3: [0.1, 0.2, 0.3],
  vec4: [0.1, 0.2, 0.3, 0.4],
  mat4: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
  event: { event: "tick" },
  action: { action: "tick" },
  texture: { kind: "mock-texture" },
  image: { kind: "mock-image" },
  audio: { kind: "mock-audio" },
};

const TYPE_NORMALIZATION = [
  ["_event_", "event"],
  ["_action_", "action"],
  ["colour", "color"],
  ["vec2f", "vec2"],
  ["vec3f", "vec3"],
  ["vec4f", "vec4"],
  ["quat", "vec4"],
  ["color", "vec4"],
  ["colour", "vec4"],
  ["mesh", "object"],
  ["geometry", "object"],
  ["json", "object"],
  ["table", "array"],
  ["dict", "object"],
  ["any", "*"],
];

function normalizeType(type) {
  let out = String(type == null ? "" : type).trim().toLowerCase();

  for (const [from, to] of TYPE_NORMALIZATION) {
    if (out === from) {
      return to;
    }
  }

  if (out.includes("|")) {
    return normalizeType(out.split("|")[0]);
  }

  if (out.endsWith("[]")) {
    return "array";
  }

  if (out.includes("vec2")) {
    return "vec2";
  }
  if (out.includes("vec3")) {
    return "vec3";
  }
  if (out.includes("vec4")) {
    return "vec4";
  }
  if (out.includes("mat4")) {
    return "mat4";
  }
  if (out.includes("bool")) {
    return "boolean";
  }
  if (out.includes("int")) {
    return "int";
  }
  if (out.includes("float") || out.includes("double")) {
    return "float";
  }
  if (out.includes("num")) {
    return "number";
  }
  if (out.includes("string") || out.includes("text")) {
    return "string";
  }
  if (out.includes("event")) {
    return "event";
  }
  if (out.includes("action")) {
    return "action";
  }
  if (out.includes("texture")) {
    return "texture";
  }
  if (out.includes("audio")) {
    return "audio";
  }
  if (out.includes("object")) {
    return "object";
  }

  return out || "*";
}

function pickDefaultValue(slotType) {
  const normalized = normalizeType(slotType);
  if (Object.prototype.hasOwnProperty.call(DEFAULT_BY_TYPE, normalized)) {
    return DEFAULT_BY_TYPE[normalized];
  }
  return DEFAULT_BY_TYPE["*"];
}

function buildInputPayload(inputs) {
  const payload = {};
  for (let i = 0; i < inputs.length; i += 1) {
    const input = inputs[i] || {};
    const key = input.name || `in_${i}`;
    payload[key] = pickDefaultValue(input.type);
  }
  return payload;
}

function summarizeNodeCoverage(records) {
  const total = records.length;
  const createdCount = records.filter((entry) => entry.created).length;
  const invokedExecuteCount = records.filter((entry) => entry.invokedExecute).length;
  const invokedActionCount = records.filter((entry) => entry.invokedAction).length;
  const errorCount = records.reduce((sum, entry) => sum + (entry.errors ? entry.errors.length : 0), 0);

  return {
    total,
    createdCount,
    invokedExecuteCount,
    invokedActionCount,
    errorCount,
    executeCoverage: total ? invokedExecuteCount / total : 0,
    actionCoverage: total ? invokedActionCount / total : 0,
  };
}

module.exports = {
  DEFAULT_BY_TYPE,
  normalizeType,
  pickDefaultValue,
  buildInputPayload,
  summarizeNodeCoverage,
};
