const { test, expect } = require('@playwright/test');

const bootAtlas = async (page, { reducedMotion = false } = {}) => {
  if (reducedMotion) await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => sessionStorage.setItem('profileIntroSeen', 'true'));
  await page.route('https://cloud.umami.is/**', route => route.abort()).catch(() => {});
  await page.goto('/#atlas');
  await page.waitForFunction(() => Boolean(window.ProfileRootEntryPortal && window.ProfileRootLanding));
  await page.waitForFunction(() => {
    const state = window.ProfileRootEntryPortal.snapshot();
    return state.mode === 'atlas' && state.available && state.rootPresent && state.portraitInsideRoot && state.actionInsideRoot;
  });
  await page.waitForFunction(() => !document.body.classList.contains('is-atlas-handoff'));
};

const root = page => page.locator('#site-graph .site-graph-node[data-node-id="stepan-chrast"]').first();
const rootHit = page => root(page).locator(':scope > .site-graph-hit');
const action = page => root(page).locator(':scope > [data-root-entry-action]');

const canonicalRoot = page => root(page).evaluate(node => {
  const matrix = node.transform?.baseVal?.consolidate?.()?.matrix;
  return {
    x: Number(node.dataset.x),
    y: Number(node.dataset.y),
    tx: matrix?.e ?? Number.NaN,
    ty: matrix?.f ?? Number.NaN
  };
});

const expectSameCanonicalRoot = (actual, expected) => {
  expect(actual.x).toBeCloseTo(expected.x, 6);
  expect(actual.y).toBeCloseTo(expected.y, 6);
  expect(actual.tx).toBeCloseTo(expected.tx, 4);
  expect(actual.ty).toBeCloseTo(expected.ty, 4);
};

test.describe('V3.1 Phase F root entry portal — desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('reveals identity inside the one persistent semantic root instead of creating a portrait overlay', async ({ page }) => {
    await bootAtlas(page);
    const before = await canonicalRoot(page);
    await root(page).evaluate(node => { node.dataset.phaseFIdentityProbe = 'persistent-root'; });

    const structure = await page.evaluate(() => {
      const node = document.querySelector('#site-graph .site-graph-node[data-node-id="stepan-chrast"]');
      const portrait = node?.querySelector(':scope > [data-root-entry-portrait]');
      const action = node?.querySelector(':scope > [data-root-entry-action]');
      return {
        roots: document.querySelectorAll('#site-graph .site-graph-node[data-node-id="stepan-chrast"]').length,
        portraits: document.querySelectorAll('#site-graph [data-root-entry-portrait]').length,
        actions: document.querySelectorAll('#site-graph [data-root-entry-action]').length,
        portraitParent: portrait?.parentElement?.dataset.nodeId || null,
        actionParent: action?.parentElement?.dataset.nodeId || null,
        portraitWidth: Number(portrait?.getAttribute('width') || 0),
        rootMaterial: node?.dataset.rootEntryMaterial || null,
        legacyOverlays: document.querySelectorAll('.profile-intro-overlay,.profile-intro-identity,.phase-h-root-handoff').length
      };
    });

    expect(structure.roots).toBe(1);
    expect(structure.portraits).toBe(1);
    expect(structure.actions).toBe(1);
    expect(structure.portraitParent).toBe('stepan-chrast');
    expect(structure.actionParent).toBe('stepan-chrast');
    expect(structure.portraitWidth).toBeGreaterThanOrEqual(68);
    expect(structure.rootMaterial).toBe('shared-root');
    expect(structure.legacyOverlays).toBe(0);

    await rootHit(page).hover();
    await expect.poll(() => page.evaluate(() => window.ProfileRootEntryPortal.snapshot().open)).toBe(true);
    await page.waitForTimeout(460);

    const opened = await page.evaluate(() => {
      const node = document.querySelector('#site-graph .site-graph-node[data-node-id="stepan-chrast"]');
      const portrait = node.querySelector(':scope > [data-root-entry-portrait]');
      const secondary = node.querySelector(':scope > .site-graph-halo--secondary');
      const actionNode = node.querySelector(':scope > [data-root-entry-action]');
      return {
        probe: node.dataset.phaseFIdentityProbe,
        portraitOpacity: Number(getComputedStyle(portrait).opacity),
        secondaryHaloOpacity: Number(getComputedStyle(secondary).opacity),
        actionOpacity: Number(getComputedStyle(actionNode).opacity),
        actionTabIndex: actionNode.getAttribute('tabindex'),
        actionAriaHidden: actionNode.getAttribute('aria-hidden'),
        rootLabel: node.getAttribute('aria-label'),
        haloRadii: [...node.querySelectorAll(':scope > .site-graph-halo')].map(ring => Number(ring.getAttribute('r'))),
        expanded: node.getAttribute('aria-expanded')
      };
    });

    expect(opened.probe).toBe('persistent-root');
    expect(opened.portraitOpacity).toBeGreaterThan(.8);
    expect(opened.secondaryHaloOpacity).toBeGreaterThan(.2);
    expect(opened.actionOpacity).toBeGreaterThan(.8);
    expect(opened.actionTabIndex).toBe('-1');
    expect(opened.actionAriaHidden).toBe('true');
    expect(opened.rootLabel).toBe('Enter profile — Štěpán Chrast');
    expect(opened.haloRadii).toEqual([27, 42]);
    expect(opened.expanded).toBe('true');
    expectSameCanonicalRoot(await canonicalRoot(page), before);
  });

  test('pointer reversal restores the latent root without changing canonical geometry', async ({ page }) => {
    await bootAtlas(page);
    const before = await canonicalRoot(page);
    await rootHit(page).hover();
    await expect.poll(() => page.evaluate(() => window.ProfileRootEntryPortal.snapshot().open)).toBe(true);

    await page.mouse.move(12, 12);
    await expect.poll(() => page.evaluate(() => window.ProfileRootEntryPortal.snapshot().open)).toBe(false);
    await expect.poll(() => root(page).evaluate(node =>
      Number(getComputedStyle(node.querySelector(':scope > [data-root-entry-portrait]')).opacity)
    )).toBeLessThan(.5);

    const state = await root(page).evaluate(node => ({
      portal: node.dataset.rootEntryPortal,
      expanded: node.getAttribute('aria-expanded')
    }));
    expect(state.portal).toBe('idle');
    expect(state.expanded).toBe('false');
    expectSameCanonicalRoot(await canonicalRoot(page), before);
  });

  test('one root activation enters Profile without opening the Atlas inspector', async ({ page }) => {
    await bootAtlas(page);
    await rootHit(page).click();
    await page.waitForFunction(() => document.body.dataset.graphMode === 'overview' && document.body.dataset.rootLanding === 'false');
    expect(await page.locator('#site-detail-panel.is-open').count()).toBe(0);
    expect(await page.evaluate(() => document.body.dataset.graphMode)).toBe('overview');
  });

  test('keyboard focus arms the same root and Escape reverses without a second tab stop', async ({ page }) => {
    await bootAtlas(page);
    await root(page).focus();
    await expect.poll(() => page.evaluate(() => window.ProfileRootEntryPortal.snapshot().open)).toBe(true);
    await expect(action(page)).toHaveAttribute('tabindex', '-1');
    await page.keyboard.press('Escape');
    await expect.poll(() => page.evaluate(() => window.ProfileRootEntryPortal.snapshot().open)).toBe(false);
    await expect(root(page)).toBeFocused();
    expect(await page.evaluate(() => document.body.dataset.graphMode)).toBe('atlas');
  });

  test('Enter profile reaches expanded Overview without resurrecting the standalone hero root', async ({ page }) => {
    await bootAtlas(page);
    await root(page).evaluate(node => { node.dataset.phaseFCommitProbe = 'same-root'; });
    await rootHit(page).click();

    await page.waitForFunction(() =>
      document.body.dataset.graphMode === 'overview' &&
      document.body.dataset.rootLanding === 'false' &&
      !document.body.classList.contains('is-atlas-handoff') &&
      !document.body.classList.contains('is-v9-transitioning'),
    null, { timeout: 6_000 });

    const result = await page.evaluate(() => {
      const node = document.querySelector('#site-graph .site-graph-node[data-node-id="stepan-chrast"]');
      const sections = ['work', 'knowledge', 'experience', 'education', 'about'];
      return {
        activated: window.ProfileRootLanding.hasActivated(),
        rootLanding: document.body.dataset.rootLanding,
        route: document.body.dataset.graphRoute,
        probe: node?.dataset.phaseFCommitProbe || null,
        sections: sections.filter(id => document.querySelector(`#site-graph .site-graph-node[data-node-id="${id}"]`)),
        heroVisible: getComputedStyle(document.querySelector('.profile-app > .hero')).display !== 'none'
      };
    });

    expect(result.activated).toBe(true);
    expect(result.rootLanding).toBe('false');
    expect(result.route).toBe('overview');
    expect(result.probe).toBe('same-root');
    expect(result.sections).toHaveLength(5);
    expect(result.heroVisible).toBe(false);
  });

  test('Phase G claims Enter profile while the shared root material stays continuous through cancellation', async ({ page }) => {
    await bootAtlas(page);
    await page.waitForFunction(() => Boolean(window.ProfileAtlasCondensation));
    await rootHit(page).hover();
    await expect.poll(() => page.evaluate(() => window.ProfileRootEntryPortal.snapshot().open)).toBe(true);

    let state = await page.evaluate(() => {
      const accepted = window.ProfileRootEntryPortal.enterProfile('phase-g-contract-test');
      const captured = {
        accepted,
        route: document.body.dataset.graphRoute,
        mode: document.body.dataset.graphMode,
        portal: window.ProfileRootEntryPortal.snapshot(),
        condensation: window.ProfileAtlasCondensation.snapshot(),
        rootState: document.querySelector('#site-graph .site-graph-node[data-node-id="stepan-chrast"]')?.dataset.rootEntryPortal,
        portraitOpacity: Number(getComputedStyle(document.querySelector('#site-graph .site-graph-node[data-node-id="stepan-chrast"] > .root-entry-portrait')).opacity)
      };
      window.ProfileAtlasCondensation.cancel('phase-f-g-contract-cancel');
      return captured;
    });
    expect(state.accepted).toBe(true);
    expect(state.route).toBe('atlas');
    expect(state.mode).toBe('atlas');
    expect(state.portal.entering).toBe(true);
    expect(state.portal.open).toBe(true);
    expect(state.condensation.running).toBe(true);
    expect(state.rootState).toBe('committing');
    expect(state.portraitOpacity).toBeGreaterThan(.05);

    await page.waitForFunction(() => window.ProfileAtlasCondensation.snapshot().state === 'CANCELLED');
    state = await page.evaluate(() => ({
      portal: window.ProfileRootEntryPortal.snapshot(),
      condensation: window.ProfileAtlasCondensation.snapshot(),
      mode: document.body.dataset.graphMode
    }));
    expect(state.mode).toBe('atlas');
    expect(state.condensation.running).toBe(false);
    expect(state.portal.entering).toBe(false);
    expect(state.portal.open).toBe(true);
  });

  test('fresh-session ATLAS_READY exposes the root portal without restoring retired intro intermediaries', async ({ page }) => {
    await page.addInitScript(() => sessionStorage.removeItem('profileIntroSeen'));
    await page.route('https://cloud.umami.is/**', route => route.abort()).catch(() => {});
    await page.goto('/');
    await page.waitForFunction(() => window.ProfileIntro?.snapshot?.().state === 'ATLAS_READY', null, { timeout: 8_000 });
    await page.waitForFunction(() => window.ProfileRootEntryPortal?.snapshot?.().available === true);

    await rootHit(page).hover();
    await expect.poll(() => page.evaluate(() => window.ProfileRootEntryPortal.snapshot().open)).toBe(true);
    expect(await page.locator('.profile-intro-overlay,.profile-intro-enter,.profile-intro-identity').count()).toBe(0);
  });
});

test.describe('V3.1 Phase F mobile / reduced motion', () => {
  test('coarse-pointer activation enters Profile in one tap', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    await bootAtlas(page);

    await rootHit(page).tap({ force: true });
    await page.waitForFunction(() =>
      document.body.dataset.graphMode === 'overview' &&
      document.body.dataset.rootLanding === 'false' &&
      window.ProfileRootEntryPortal.snapshot().entering === false,
    null, { timeout: 10_000 });
    const state = await page.evaluate(() => window.ProfileRootEntryPortal.snapshot());
    expect(state.coarsePointer).toBe(true);
    expect(state.entering).toBe(false);
    await expect(action(page)).toHaveAttribute('tabindex', '-1');
    await context.close();
  });

  test('reduced motion preserves portal semantics without reveal transitions', async ({ page }) => {
    await bootAtlas(page, { reducedMotion: true });
    await rootHit(page).hover();
    await expect.poll(() => page.evaluate(() => window.ProfileRootEntryPortal.snapshot().open)).toBe(true);
    const state = await page.evaluate(() => {
      const node = document.querySelector('#site-graph .site-graph-node[data-node-id="stepan-chrast"]');
      const portrait = node.querySelector(':scope > [data-root-entry-portrait]');
      return {
        reduced: window.ProfileRootEntryPortal.snapshot().reducedMotion,
        duration: getComputedStyle(portrait).transitionDuration,
        opacity: Number(getComputedStyle(portrait).opacity)
      };
    });
    expect(state.reduced).toBe(true);
    expect(state.duration === '0s' || state.duration === '0.001ms').toBe(true);
    expect(state.opacity).toBeGreaterThan(.8);
  });
});
