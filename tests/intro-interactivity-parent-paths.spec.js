const { test, expect } = require('@playwright/test');

const blockAnalytics = page =>
  page.route('https://cloud.umami.is/**', route => route.abort()).catch(() => {});

test.describe('V4 entry interactivity and Atlas relation colors', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('static opening Atlas is inert and resolves automatically to interactive Profile Overview', async ({ page }) => {
    await page.addInitScript(() => sessionStorage.removeItem('profileIntroSeen'));
    await blockAnalytics(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await page.waitForFunction(() => Boolean(window.ProfileIntro?.__v4), null, { timeout: 8_000 });
    const loading = await page.evaluate(() => {
      const shell = document.querySelector('.entry-loading-shell');
      const atlas = document.querySelector('.entry-opening-atlas');
      return {
        atlasPointerEvents: atlas ? getComputedStyle(atlas).pointerEvents : null,
        shellRole: shell?.getAttribute('role') || null,
        realAtlasRuntimeLoaded: Boolean(window.ProfileAtlasLOD)
      };
    });
    expect(loading.atlasPointerEvents).toBe('none');
    expect(loading.shellRole).toBe('status');
    expect(loading.realAtlasRuntimeLoaded).toBe(false);

    await page.waitForFunction(() =>
      window.ProfileIntro?.snapshot?.().state === 'ATLAS_READY' &&
      document.body.dataset.graphMode === 'overview' &&
      document.body.classList.contains('is-entry-loader-complete'),
    null, { timeout: 10_000 });

    const ready = await page.evaluate(() => ({
      graphMode: document.body.dataset.graphMode,
      rootLanding: document.body.dataset.rootLanding,
      profileReady: document.body.classList.contains('is-profile-root-ready'),
      workPointerEvents: getComputedStyle(
        document.querySelector('#site-graph .site-graph-node[data-node-id="work"]')
      ).pointerEvents
    }));
    expect(ready.graphMode).toBe('overview');
    expect(ready.rootLanding).toBe('false');
    expect(ready.profileReady).toBe(true);
    expect(ready.workPointerEvents).not.toBe('none');

    await page.locator('#site-graph .site-graph-node[data-node-id="work"] > .site-graph-hit').hover();
    await expect.poll(() => page.evaluate(() => window.ProfileNodeInteraction?.snapshot?.().hoveredNodeId)).toBe('work');
  });

  test('explicit Atlas keeps semantic parent/child path colors', async ({ page }) => {
    await page.addInitScript(() => sessionStorage.setItem('profileIntroSeen', 'true'));
    await blockAnalytics(page);
    await page.goto('/#atlas', { waitUntil: 'domcontentloaded' });
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
