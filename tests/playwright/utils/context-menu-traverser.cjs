async function closeAllContextMenus(page) {
  await page.evaluate(() => {
    if (window.LiteGraph && typeof window.LiteGraph.closeAllContextMenus === "function") {
      window.LiteGraph.closeAllContextMenus(window);
    }
    for (const el of Array.from(document.querySelectorAll(".litecontextmenu"))) {
      if (typeof el.close === "function") {
        el.close();
      } else {
        el.remove();
      }
    }
  });
}

async function waitForMenuInteractive(page, minCount = 1, timeout = 10000) {
  await page.waitForFunction((expected) => {
    const menus = Array.from(document.querySelectorAll(".litecontextmenu"));
    if (menus.length < expected) {
      return false;
    }
    const last = menus[menus.length - 1];
    if (!last) {
      return false;
    }
    const style = window.getComputedStyle(last);
    return style.pointerEvents !== "none";
  }, minCount, { timeout });
  await page.waitForTimeout(120);
}

async function getLastMenuEntries(page) {
  return page.evaluate(() => {
    const menus = Array.from(document.querySelectorAll(".litecontextmenu"));
    const menu = menus[menus.length - 1];
    if (!menu) {
      return [];
    }

    const entries = Array.from(menu.querySelectorAll(".litemenu-entry"));
    const normalized = [];
    for (const entry of entries) {
      if (entry.classList.contains("separator") || entry.classList.contains("disabled")) {
        continue;
      }
      const text = (entry.textContent || "").trim();
      if (!text) {
        continue;
      }
      normalized.push({
        text,
        hasSubmenu: entry.classList.contains("has_submenu"),
      });
    }

    return normalized;
  });
}

async function clickLastMenuEntryByText(page, text) {
  return page.evaluate((targetText) => {
    const menus = Array.from(document.querySelectorAll(".litecontextmenu"));
    const menu = menus[menus.length - 1];
    if (!menu) {
      return { clicked: false, hasSubmenu: false };
    }

    const entries = Array.from(menu.querySelectorAll(".litemenu-entry")).filter((entry) => {
      if (entry.classList.contains("separator") || entry.classList.contains("disabled")) {
        return false;
      }
      return (entry.textContent || "").trim() === targetText;
    });

    if (!entries.length) {
      return { clicked: false, hasSubmenu: false };
    }

    const entry = entries[0];
    const hasSubmenu = entry.classList.contains("has_submenu");
    entry.click();
    return { clicked: true, hasSubmenu };
  }, text);
}

async function traverseContextMenuTree(page, options) {
  const {
    openRootMenu,
    onLeaf,
    shouldSkipPath,
    maxDepth = 8,
    maxLeaves = Number.POSITIVE_INFINITY,
  } = options;

  if (typeof openRootMenu !== "function") {
    throw new Error("openRootMenu is required");
  }

  if (typeof onLeaf !== "function") {
    throw new Error("onLeaf is required");
  }

  const visited = new Set();
  const leafPaths = [];

  async function reopenAndReplay(path) {
    await closeAllContextMenus(page);
    await openRootMenu();
    await waitForMenuInteractive(page, 1);

    let expectedMenus = 1;
    for (const segment of path) {
      const clicked = await clickLastMenuEntryByText(page, segment);
      if (!clicked.clicked) {
        throw new Error(`Failed to replay menu path segment: ${segment}`);
      }
      if (clicked.hasSubmenu) {
        expectedMenus += 1;
        await waitForMenuInteractive(page, expectedMenus);
      } else {
        await page.waitForTimeout(80);
      }
    }
  }

  async function walk(path, depth) {
    if (depth > maxDepth) {
      return;
    }
    if (leafPaths.length >= maxLeaves) {
      return;
    }

    await reopenAndReplay(path);
    const entries = await getLastMenuEntries(page);

    for (const entry of entries) {
      if (leafPaths.length >= maxLeaves) {
        return;
      }
      const nextPath = [...path, entry.text];
      const key = nextPath.join(" > ");

      if (visited.has(key)) {
        continue;
      }
      visited.add(key);

      if (typeof shouldSkipPath === "function" && shouldSkipPath(nextPath, entry)) {
        continue;
      }

      await reopenAndReplay(path);
      const clickResult = await clickLastMenuEntryByText(page, entry.text);
      if (!clickResult.clicked) {
        throw new Error(`Failed to click menu item: ${entry.text}`);
      }

      if (entry.hasSubmenu && depth < maxDepth) {
        await waitForMenuInteractive(page, path.length + 2);
        await walk(nextPath, depth + 1);
      } else {
        leafPaths.push(nextPath);
        await onLeaf({
          path: nextPath,
          leafText: entry.text,
        });
      }
    }
  }

  await walk([], 0);
  await closeAllContextMenus(page);

  return {
    visitedCount: visited.size,
    leafPaths,
  };
}

module.exports = {
  closeAllContextMenus,
  waitForMenuInteractive,
  getLastMenuEntries,
  clickLastMenuEntryByText,
  traverseContextMenuTree,
};
