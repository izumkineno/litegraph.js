function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function pathJoin(base, key, isIndex) {
  if (!base) {
    return isIndex ? `[${key}]` : String(key);
  }
  return isIndex ? `${base}[${key}]` : `${base}.${key}`;
}

function pushPath(target, path) {
  target.push(path || "$root");
}

function diffGraphSnapshots(beforeValue, afterValue) {
  const changedPaths = [];
  const addedPaths = [];
  const removedPaths = [];

  function walk(beforeNode, afterNode, path) {
    if (beforeNode === afterNode) {
      return;
    }

    const beforeIsArray = Array.isArray(beforeNode);
    const afterIsArray = Array.isArray(afterNode);

    if (beforeIsArray || afterIsArray) {
      if (!beforeIsArray || !afterIsArray) {
        pushPath(changedPaths, path);
        return;
      }

      const max = Math.max(beforeNode.length, afterNode.length);
      for (let i = 0; i < max; i += 1) {
        const nextPath = pathJoin(path, i, true);
        const hasBefore = i < beforeNode.length;
        const hasAfter = i < afterNode.length;
        if (!hasBefore && hasAfter) {
          pushPath(addedPaths, nextPath);
          continue;
        }
        if (hasBefore && !hasAfter) {
          pushPath(removedPaths, nextPath);
          continue;
        }
        walk(beforeNode[i], afterNode[i], nextPath);
      }
      return;
    }

    const beforeIsObject = isPlainObject(beforeNode);
    const afterIsObject = isPlainObject(afterNode);

    if (beforeIsObject || afterIsObject) {
      if (!beforeIsObject || !afterIsObject) {
        pushPath(changedPaths, path);
        return;
      }

      const keys = new Set([...Object.keys(beforeNode), ...Object.keys(afterNode)]);
      for (const key of keys) {
        const nextPath = pathJoin(path, key, false);
        const hasBefore = Object.prototype.hasOwnProperty.call(beforeNode, key);
        const hasAfter = Object.prototype.hasOwnProperty.call(afterNode, key);
        if (!hasBefore && hasAfter) {
          pushPath(addedPaths, nextPath);
          continue;
        }
        if (hasBefore && !hasAfter) {
          pushPath(removedPaths, nextPath);
          continue;
        }
        walk(beforeNode[key], afterNode[key], nextPath);
      }
      return;
    }

    if (!Object.is(beforeNode, afterNode)) {
      pushPath(changedPaths, path);
    }
  }

  walk(beforeValue, afterValue, "");

  return {
    changedPaths,
    addedPaths,
    removedPaths,
  };
}

function hasGraphChange(diff) {
  return (
    diff.changedPaths.length > 0 ||
    diff.addedPaths.length > 0 ||
    diff.removedPaths.length > 0
  );
}

module.exports = {
  diffGraphSnapshots,
  hasGraphChange,
};