const { test, expect } = require('@playwright/test');

const blockAnalytics = page =>
  page.route('https://cloud.umami.is/**', route => route.abort()).catch(() => {});

const freshHome = async page => {
  await page.addInitScript(() => {
    sessionStorage.removeItem('profileIntroSeen');
    sessionStorage.removeItem('profileRootReached');
  });
  await blockAnalytics(page);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() =>
    window.ProfileIntro?.snapshot?.().state === 'ATLAS_READY' &&
    document.body.dataset.graphMode === 'overview' &&
    document.body.classList.contains('is-profile-root-ready') &&
    document.body.classList.contains('is-entry-loader-complete'),
  null, { timeout: 12_000 });
};

const bootAtlas = async page => {
  await page.addInitScript(() => {
    sessionStorage.setItem('profileIntroSeen', 'true');
    sessionStorage.removeItem('profileRootReached');
  });
  await blockAnalytics(page);
  await page.goto('/#atlas', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() =>
    document.body.dataset.graphMode === 'atlas' &&
    window.ProfileRootEntryPortal?.snapshot?.().available === true,
  null, { timeout: 12_000 });
};

test.describe('V4 entry and root identity behavior', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('the loading surface is static and the live Atlas stays lazy until explicitly requested', async ({ page }) => {
    await page.addInitScript(() => sessionStorage.removeItem('profileIntroSeen'));
    await blockAnalytics(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const first = await page.evaluate(() => {
      const shell = document.querySelector('.entry-loading-shell');
      const atlas = document.querySelector('.entry-opening-atlas');
      return {
        shellVisible: Boolean(shell) && getComputedStyle(shell).display !== 'none',
        staticAtlas: Boolean(atlas),
        staticAtlasPointerEvents: atlas ? getComputedStyle(atlas).pointerEvents : null,
        visibilityMask: document.querySelectorAll('.entry-visibility-mask').length
      };
    });

    expect(first.shellVisible).toBe(true);
    expect(first.staticAtlas).toBe(true);
    expect(first.staticAtlasPointerEvents).toBe('none');
    expect(first.visibilityMask).toBe(0);

    await page.waitForFunction(() =>
      window.ProfileIntro?.snapshot?.().state === 'ATLAS_READY' &&
      document.body.dataset.graphMode === 'overview' &&
      document.body.classList.contains('is-entry-loader-complete'),
    null, { timeout: 12_000 });

    expect(await page.evaluate(() => Boolean(window.ProfileAtlasLOD))).toBe(false);

    await page.locator('.profile-root-action', { hasText: 'Explore Atlas' }).click();
    await page.waitForFunction(() => document.body.dataset.graphMode === 'atlas' && Boolean(window.ProfileAtlasLOD), null, { timeout: 12_000 });
    expect(await page.evaluate(() => Boolean(window.ProfileAtlasLOD))).toBe(true);
  });

  test('Profile main node reveals the portrait on hover and keeps its existing inspector click action', async ({ page }) => {
    await freshHome(page);

    const root = page.locator('#site-graph .site-graph-node[data-node-id="stepan-chrast"]').first();
    const portrait = root.locator(':scope > .profile-node-portrait');
    await expect(portrait).toHaveCount(1);

    const before = await portrait.evaluate(node => Number(getComputedStyle(node).opacity));
    expect(before).toBeLessThan(.1);

    await root.hover();
    await expect.poll(() => portrait.evaluate(node => Number(getComputedStyle(node).opacity))).toBeGreaterThan(.8);

    await root.locator(':scope > .site-graph-hit').click();
    await expect(page.locator('.profile-root-inspector')).toHaveClass(/is-open/);
    expect(await page.evaluate(() => document.body.dataset.graphRoute)).toBe('overview');
  });

  test('Atlas main node reveals the portrait on hover and keeps its existing click-to-profile action', async ({ page }) => {
    await bootAtlas(page);

    const root = page.locator('#site-graph .site-graph-node[data-node-id="stepan-chrast"]').first();
    const portrait = root.locator(':scope > .root-entry-portrait');
    await expect(portrait).toHaveCount(1);

    await root.hover();
    await expect.poll(() => page.evaluate(() => window.ProfileRootEntryPortal?.snapshot?.().open)).toBe(true);
    await expect.poll(() => portrait.evaluate(node => Number(getComputedStyle(node).opacity))).toBeGreaterThan(.8);

    await root.locator(':scope > .site-graph-hit').click();
    await page.waitForFunction(() => {
      const state = window.ProfileAtlasCondensation?.snapshot?.().state;
      return ['PREPARING', 'CONDENSING', 'COMMITTING', 'COMPLETE'].includes(state) ||
        document.body.dataset.graphMode === 'overview';
    }, null, { timeout: 10_000 });
  });

  test('Atlas hover still distinguishes parent and child relation colors', async ({ page }) => {
    await bootAtlas(page);
    await page.waitForFunction(() => window.ProfileAtlasLOD && window.ProfileNodeInteraction);

    await page.evaluate(() => {
      window.ProfileAtlasLOD.setTopologyMode('entry-full', { reason: 'relation-color-regression' });
      const scale = window.ProfileAtlasLOD.snapshot().camera?.scale;
      if (Number.isFinite(scale)) window.ProfileAtlasLOD.applyLOD(scale);
    });

    await page.locator('#site-graph .site-graph-node[data-node-id="knowledge"] > .site-graph-hit').hover();
    await page.waitForFunction(() =>
      document.querySelector('#site-graph .site-graph-edges path.is-upstream') &&
      document.querySelector('#site-graph .site-graph-edges path.is-downstream')
    );

    const colors = await page.evaluate(() => {
      const normaliseCssColor = value => {
        const probe = document.createElement('span');
        probe.style.color = value;
        document.body.appendChild(probe);
        const color = getComputedStyle(probe).color;
        probe.remove();
        return color;
      };
      const rootStyle = getComputedStyle(document.documentElement);
      const upstream = document.querySelector('#site-graph .site-graph-edges path.is-upstream');
      const downstream = document.querySelector('#site-graph .site-graph-edges path.is-downstream');
      return {
        upstream: getComputedStyle(upstream).stroke,
        downstream: getComputedStyle(downstream).stroke,
        brown: normaliseCssColor(rootStyle.getPropertyValue('--brown').trim()),
        teal: normaliseCssColor(rootStyle.getPropertyValue('--teal').trim())
      };
    });

    expect(colors.upstream).toBe(colors.brown);
    expect(colors.downstream).toBe(colors.teal);
    expect(colors.upstream).not.toBe(colors.downstream);
  });
});
