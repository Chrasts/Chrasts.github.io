const { test, expect } = require('@playwright/test');

const blockAnalytics = page => page.route('https://cloud.umami.is/**', route => route.abort()).catch(() => {});

test.describe('Intro interactivity and Atlas relation colors', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('a revealed Atlas node is interactive before ATLAS_READY', async ({ page }) => {
    await page.addInitScript(() => sessionStorage.removeItem('profileIntroSeen'));
    await blockAnalytics(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await page.waitForFunction(() => {
      const node = document.querySelector('#site-graph .site-graph-node[data-node-id="work"]');
      return window.ProfileIntro?.snapshot?.().state === 'ATLAS_REVEAL' &&
        document.body.classList.contains('is-entry-loader-releasing') &&
        node?.classList.contains('is-intro-revealed');
    }, null, { timeout: 20_000 });

    const beforeHover = await page.evaluate(() => ({
      introState: window.ProfileIntro.snapshot().state,
      shellPointerEvents: getComputedStyle(document.querySelector('.entry-loading-shell')).pointerEvents,
      nodePointerEvents: getComputedStyle(document.querySelector('#site-graph .site-graph-node[data-node-id="work"]')).pointerEvents
    }));

    expect(beforeHover.introState).toBe('ATLAS_REVEAL');
    expect(beforeHover.shellPointerEvents).toBe('none');
    expect(beforeHover.nodePointerEvents).not.toBe('none');

    await page.locator('#site-graph .site-graph-node[data-node-id="work"] > .site-graph-hit').hover();
    await expect.poll(() => page.evaluate(() => window.ProfileNodeInteraction?.snapshot?.().hoveredNodeId)).toBe('work');
    expect(await page.evaluate(() => window.ProfileIntro.snapshot().state)).toBe('ATLAS_REVEAL');
  });

  test('Atlas hover uses brown parent paths and teal child paths', async ({ page }) => {
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
