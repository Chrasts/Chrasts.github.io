const { test, expect } = require('@playwright/test');

const bootAtlas = async (page, { reducedMotion = false, viewport = { width: 1440, height: 900 } } = {}) => {
  if (reducedMotion) await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize(viewport);
  await page.addInitScript(() => sessionStorage.setItem('profileIntroSeen', 'true'));
  await page.route('https://cloud.umami.is/**', route => route.abort()).catch(() => {});
  await page.goto('/#atlas');
  await page.waitForFunction(() => Boolean(
    window.ProfileAtlasCondensation &&
    window.ProfileRootEntryPortal &&
    window.ProfileAtlasLOD &&
    window.ProfileGeometry
  ));
  await page.waitForFunction(() => {
    const portal = window.ProfileRootEntryPortal.snapshot();
    return portal.available && portal.mode === 'atlas' && !document.body.classList.contains('is-atlas-handoff');
  });
};

const openAndEnter = async page => {
  await page.evaluate(() => window.ProfileRootEntryPortal.open('phase-g-test'));
  await expect.poll(() => page.evaluate(() => window.ProfileRootEntryPortal.snapshot().open)).toBe(true);
  const action = page.locator('#site-graph .site-graph-node[data-node-id="stepan-chrast"] > [data-root-entry-action]');
  await action.click();
  // Reduced-motion condensation is intentionally very short, so the browser
  // may advance from CONDENSING to COMMITTING/COMPLETE between polling frames.
  await page.waitForFunction(() => ['CONDENSING', 'COMMITTING', 'COMPLETE'].includes(
    window.ProfileAtlasCondensation.snapshot().state
  ));
};

const nodePoint = (page, id) => page.evaluate(nodeId => {
  const node = [...document.querySelectorAll(`#site-graph .site-graph-node[data-node-id="${CSS.escape(nodeId)}"]`)]
    .find(element => !element.closest('.v9-transition-overlay'));
  return node ? { x: Number(node.dataset.x), y: Number(node.dataset.y) } : null;
}, id);

test.describe('V3.1 Phase G semantic Atlas condensation', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('a deep child physically travels toward its actual parent while canonical coordinates stay fixed', async ({ page }) => {
    await bootAtlas(page);
    const childId = 'incompleteness';
    const parentId = 'first-order-logic';
    const before = await nodePoint(page, childId);
    const parentBefore = await nodePoint(page, parentId);
    await openAndEnter(page);

    await page.waitForFunction(id => {
      const node = document.querySelector(`#site-graph .site-graph-node[data-node-id="${CSS.escape(id)}"]`);
      return Number(node?.dataset.condenseProgress || 0) > .48;
    }, childId);

    const movement = await page.evaluate(({ childId, parentId }) => {
      const child = document.querySelector(`#site-graph .site-graph-node[data-node-id="${CSS.escape(childId)}"]`);
      const parent = document.querySelector(`#site-graph .site-graph-node[data-node-id="${CSS.escape(parentId)}"]`);
      const wrapper = child?.querySelector(':scope > .atlas-condense-motion');
      const matrix = wrapper?.transform?.baseVal?.consolidate?.()?.matrix;
      const edge = [...document.querySelectorAll('#site-graph .site-graph-edges path[data-source][data-target]')]
        .find(candidate => candidate.dataset.source === parentId && candidate.dataset.target === childId);
      return {
        child: { x: Number(child?.dataset.x), y: Number(child?.dataset.y) },
        parent: { x: Number(parent?.dataset.x), y: Number(parent?.dataset.y) },
        tx: matrix?.e || 0,
        ty: matrix?.f || 0,
        progress: Number(child?.dataset.condenseProgress || 0),
        edgeDash: edge?.style.strokeDasharray || '',
        edgePrimary: edge?.dataset.condensePrimary || null,
        parentMass: Number(parent?.style.getPropertyValue('--condense-parent-mass') || 0),
        portal: window.ProfileRootEntryPortal.snapshot(),
        rootPortraitOpacity: Number(getComputedStyle(document.querySelector('#site-graph .site-graph-node[data-node-id="stepan-chrast"] > .root-entry-portrait')).opacity)
      };
    }, { childId, parentId });

    expect(movement.child.x).toBeCloseTo(before.x, 6);
    expect(movement.child.y).toBeCloseTo(before.y, 6);
    expect(movement.parent.x).toBeCloseTo(parentBefore.x, 6);
    expect(movement.parent.y).toBeCloseTo(parentBefore.y, 6);
    expect(Math.hypot(movement.tx, movement.ty)).toBeGreaterThan(18);

    const intended = { x: parentBefore.x - before.x, y: parentBefore.y - before.y };
    const dot = movement.tx * intended.x + movement.ty * intended.y;
    expect(dot).toBeGreaterThan(0);
    expect(movement.edgePrimary).toBe('true');
    // Chromium may serialize SVG dash lengths as `0.42px, 1px`; parseFloat
    // intentionally reads the semantic leading length rather than CSS syntax.
    expect(parseFloat(movement.edgeDash)).toBeLessThan(.9);
    expect(movement.parentMass).toBeGreaterThan(.04);
    expect(movement.portal.entering).toBe(true);
    expect(movement.rootPortraitOpacity).toBeGreaterThan(.8);
  });

  test('semantic waves overlap in the required deep-to-root order and visibly retract primary structure', async ({ page }) => {
    await bootAtlas(page);
    await openAndEnter(page);
    await page.waitForFunction(() => window.ProfileAtlasCondensation.snapshot().waves.includes('branches'));

    const state = await page.evaluate(() => {
      const snapshot = window.ProfileAtlasCondensation.snapshot();
      const primary = [...document.querySelectorAll('#site-graph [data-condense-primary="true"]')]
        .map(edge => parseFloat(edge.style.strokeDasharray || '1'));
      return { snapshot, primary };
    });

    const waves = state.snapshot.waves;
    expect(waves.indexOf('deep')).toBeGreaterThanOrEqual(0);
    expect(waves.indexOf('intermediate')).toBeGreaterThan(waves.indexOf('deep'));
    expect(waves.indexOf('territories')).toBeGreaterThan(waves.indexOf('intermediate'));
    expect(waves.indexOf('branches')).toBeGreaterThan(waves.indexOf('territories'));
    expect(state.snapshot.primaryEdgeCount).toBeGreaterThan(5);
    expect(state.primary.some(value => Number.isFinite(value) && value < .45)).toBe(true);
    expect(state.snapshot.parentMassPeak).toBeGreaterThan(.1);
    expect(state.snapshot.maxTravel).toBeGreaterThan(80);
  });

  test('completion preserves the root semantic object and lands on five immediately visible branches', async ({ page }) => {
    await bootAtlas(page);
    await page.locator('#site-graph .site-graph-node[data-node-id="stepan-chrast"]').evaluate(node => {
      node.dataset.phaseGRootProbe = 'same-semantic-root';
    });
    await openAndEnter(page);

    await page.waitForFunction(() => window.ProfileAtlasCondensation.snapshot().state === 'COMPLETE', null, { timeout: 6_000 });
    const result = await page.evaluate(() => {
      const root = document.querySelector('#site-graph .site-graph-node[data-node-id="stepan-chrast"]');
      const sections = ['work', 'knowledge', 'experience', 'education', 'about'];
      return {
        snapshot: window.ProfileAtlasCondensation.snapshot(),
        rootProbe: root?.dataset.phaseGRootProbe || null,
        rootLanding: document.body.dataset.rootLanding,
        mode: document.body.dataset.graphMode,
        route: document.body.dataset.graphRoute,
        activated: window.ProfileRootLanding.hasActivated(),
        sections: sections.filter(id => document.querySelector(`#site-graph .site-graph-node[data-node-id="${id}"]`)),
        wrappers: document.querySelectorAll('#site-graph .atlas-condense-motion').length,
        condensingClass: document.body.classList.contains('is-atlas-condensing')
      };
    });

    expect(result.rootProbe).toBe('same-semantic-root');
    expect(result.rootLanding).toBe('false');
    expect(result.mode).toBe('overview');
    expect(result.route).toBe('overview');
    expect(result.activated).toBe(true);
    expect(result.sections).toHaveLength(5);
    expect(result.wrappers).toBe(0);
    expect(result.condensingClass).toBe(false);
    expect(result.snapshot.waves).toEqual(expect.arrayContaining(['deep', 'intermediate', 'territories', 'branches', 'root']));
  });

  test('Escape cancels safely back to exact Atlas geometry and keeps the personal root portal available', async ({ page }) => {
    await bootAtlas(page);
    const ids = ['stepan-chrast', 'work', 'knowledge', 'incompleteness'];
    const before = Object.fromEntries(await Promise.all(ids.map(async id => [id, await nodePoint(page, id)])));
    await openAndEnter(page);
    await page.waitForFunction(() => Number(document.querySelector('#site-graph .site-graph-node[data-node-id="incompleteness"]')?.dataset.condenseProgress || 0) > .32);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.ProfileAtlasCondensation.snapshot().state === 'CANCELLED');

    const after = Object.fromEntries(await Promise.all(ids.map(async id => [id, await nodePoint(page, id)])));
    for (const id of ids) {
      expect(after[id].x).toBeCloseTo(before[id].x, 5);
      expect(after[id].y).toBeCloseTo(before[id].y, 5);
    }
    const restored = await page.evaluate(() => ({
      mode: document.body.dataset.graphMode,
      wrappers: document.querySelectorAll('#site-graph .atlas-condense-motion').length,
      primary: document.querySelectorAll('#site-graph [data-condense-primary="true"]').length,
      locked: window.ProfileScene.transitions.isLocked,
      portal: window.ProfileRootEntryPortal.snapshot()
    }));
    expect(restored.mode).toBe('atlas');
    expect(restored.wrappers).toBe(0);
    expect(restored.primary).toBe(0);
    expect(restored.locked).toBe(false);
    expect(restored.portal.entering).toBe(false);
    expect(restored.portal.open).toBe(true);
  });

  test('reduced motion keeps the semantic wave/result but compresses physical travel and duration', async ({ page }) => {
    await bootAtlas(page, { reducedMotion: true });
    await openAndEnter(page);
    await page.waitForFunction(() => window.ProfileAtlasCondensation.snapshot().state === 'COMPLETE', null, { timeout: 4_000 });
    const state = await page.evaluate(() => window.ProfileAtlasCondensation.snapshot());
    expect(state.reducedMotion).toBe(true);
    expect(state.waves).toEqual(expect.arrayContaining(['deep', 'intermediate', 'territories', 'branches', 'root']));
    expect(state.maxTravel).toBeLessThan(100);
    expect(state.elapsed).toBeLessThan(1600);
    expect(state.mode).toBe('overview');
    expect(state.sectionsPresent).toEqual(expect.arrayContaining(['work', 'knowledge', 'experience', 'education', 'about']));
  });
});

test.describe('V3.1 Phase G mobile composition', () => {
  test('coarse/mobile entry reaches the same practical five-branch semantic state', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    await bootAtlas(page, { viewport: { width: 390, height: 844 } });
    await page.evaluate(() => window.ProfileRootEntryPortal.open('phase-g-mobile-test'));
    await page.evaluate(() => window.ProfileRootEntryPortal.enterProfile('phase-g-mobile-test'));
    await page.waitForFunction(() => window.ProfileAtlasCondensation.snapshot().state === 'COMPLETE', null, { timeout: 6_000 });
    const state = await page.evaluate(() => ({
      condensation: window.ProfileAtlasCondensation.snapshot(),
      mode: document.body.dataset.graphMode,
      rootLanding: document.body.dataset.rootLanding
    }));
    expect(state.mode).toBe('overview');
    expect(state.rootLanding).toBe('false');
    expect(state.condensation.sectionsPresent).toEqual(expect.arrayContaining(['work', 'knowledge', 'experience', 'education', 'about']));
    await context.close();
  });
});
