const { test, expect } = require('@playwright/test');

const bootAtlas = async page => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => sessionStorage.setItem('profileIntroSeen', 'true'));
  await page.route('https://cloud.umami.is/**', route => route.abort()).catch(() => {});
  await page.goto('/#atlas');
  await page.waitForFunction(() => Boolean(
    window.ProfileAtlasCondensation &&
    window.ProfileRootEntryPortal &&
    window.ProfileGeometry
  ));
  await page.waitForFunction(() => window.ProfileRootEntryPortal.snapshot().available === true);
};

const enter = async page => {
  await page.locator('#site-graph .site-graph-node[data-node-id="stepan-chrast"] > .site-graph-hit').click();
  await page.waitForFunction(() => window.ProfileAtlasCondensation.snapshot().state === 'CONDENSING');
};

test.describe('hierarchical Atlas folding', () => {
  test('deepest nodes are absorbed before their parents begin meaningful travel', async ({ page }) => {
    await bootAtlas(page);

    const pair = await page.evaluate(() => {
      const nodes = window.SITE_DATA.graph.nodes;
      const root = window.SITE_DATA.graph.rootId;
      const depth = new Map([[root, 0]]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const node of nodes) {
          if (node.id === root) continue;
          const values = (node.parentIds || []).map(id => depth.get(id)).filter(Number.isFinite);
          if (!values.length) continue;
          const next = Math.min(...values) + 1;
          if (!depth.has(node.id) || next < depth.get(node.id)) {
            depth.set(node.id, next);
            changed = true;
          }
        }
      }
      const max = Math.max(...depth.values());
      const child = nodes.find(node => depth.get(node.id) === max && node.parentIds?.[0]);
      return { child: child.id, parent: child.parentIds[0], max };
    });

    await enter(page);
    await page.waitForFunction(id => Number(
      document.querySelector(`#site-graph .site-graph-node[data-node-id="${CSS.escape(id)}"]`)?.dataset.condenseProgress || 0
    ) > .96, pair.child);

    const progress = await page.evaluate(({ child, parent }) => ({
      child: Number(document.querySelector(`#site-graph .site-graph-node[data-node-id="${CSS.escape(child)}"]`)?.dataset.condenseProgress || 0),
      parent: Number(document.querySelector(`#site-graph .site-graph-node[data-node-id="${CSS.escape(parent)}"]`)?.dataset.condenseProgress || 0),
      depthWaves: window.ProfileAtlasCondensation.snapshot().depthWaves
    }), pair);

    expect(progress.child).toBeGreaterThan(.96);
    expect(progress.parent).toBeLessThan(.30);
    expect(progress.depthWaves[0]).toBe(pair.max);
  });

  test('handoff has a strict root-only plateau before five branches roll out from the root', async ({ page }) => {
    await bootAtlas(page);
    await enter(page);

    await page.waitForFunction(() => document.body.classList.contains('is-atlas-condensation-root-only'));
    const plateau = await page.evaluate(() => {
      const visibleNodes = [...document.querySelectorAll('#site-graph .site-graph-node[data-node-id]')]
        .filter(node => {
          const style = getComputedStyle(node);
          return style.visibility !== 'hidden' && Number(style.opacity) > .01;
        })
        .map(node => node.dataset.nodeId);
      const visibleEdges = [...document.querySelectorAll('#site-graph .site-graph-edges path')]
        .filter(edge => {
          const style = getComputedStyle(edge);
          return style.visibility !== 'hidden' && Number(style.opacity) > .01;
        }).length;
      return {
        visibleNodes,
        visibleEdges,
        pending: document.body.classList.contains('is-profile-root-pending-emergence')
      };
    });

    expect(plateau.visibleNodes).toEqual(['stepan-chrast']);
    expect(plateau.visibleEdges).toBe(0);
    expect(plateau.pending).toBe(true);

    await page.waitForFunction(() => document.body.classList.contains('is-profile-root-emerging'));
    const emergence = await page.evaluate(() => {
      const ids = ['work', 'knowledge', 'experience', 'education', 'about'];
      return ids.map(id => {
        const node = document.querySelector(`#site-graph .site-graph-node[data-node-id="${id}"]`);
        const group = node?.querySelector(':scope > .profile-root-emergence-motion');
        const matrix = group?.transform?.baseVal?.consolidate?.()?.matrix;
        const edge = [...document.querySelectorAll('#site-graph .site-graph-edges path[data-source][data-target]')]
          .find(path => path.dataset.source === 'stepan-chrast' && path.dataset.target === id);
        return {
          id,
          travel: Math.hypot(matrix?.e || 0, matrix?.f || 0),
          edgeDash: parseFloat(edge?.style.strokeDasharray || '1')
        };
      });
    });

    expect(emergence.every(item => item.travel > 40)).toBe(true);
    expect(emergence.some(item => item.edgeDash < .35)).toBe(true);

    await page.waitForFunction(() => window.ProfileAtlasCondensation.snapshot().state === 'COMPLETE', null, { timeout: 8_000 });
    expect(await page.evaluate(() => document.body.dataset.graphMode)).toBe('overview');
  });
});
