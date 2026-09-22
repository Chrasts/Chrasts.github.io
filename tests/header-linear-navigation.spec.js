const { test, expect } = require('@playwright/test');

const prepare = async page => {
  await page.addInitScript(() => sessionStorage.setItem('profileIntroSeen', 'true'));
  await page.route('https://cloud.umami.is/**', route => route.abort()).catch(() => {});
};

const waitHeader = async page => {
  await page.waitForFunction(() => {
    const header = document.querySelector('.app-header');
    const path = document.querySelector('.header-linear-graph-line');
    return Boolean(header && path?.getAttribute('d'));
  });
};

test.describe('unified desktop header graph', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('keeps one structural header across Overview, branches and Atlas', async ({ page }) => {
    await prepare(page);
    const snapshots = {};

    for (const route of ['overview', 'work', 'knowledge', 'atlas']) {
      await page.goto(`/#${route}`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(route => {
        const actual = document.body.dataset.graphRoute;
        return actual === route || actual?.startsWith(`${route}/`);
      }, route);
      await waitHeader(page);

      snapshots[route] = await page.evaluate(() => {
        const header = document.querySelector('.app-header');
        const actions = header.querySelector('.header-actions');
        const theme = header.querySelector('.theme-toggle');
        return {
          header: header.getBoundingClientRect().toJSON(),
          actions: actions.getBoundingClientRect().toJSON(),
          routes: [...header.querySelectorAll('#main-nav > a[data-route]')].map(item => item.dataset.route),
          atlasInHeader: header.querySelectorAll('#main-nav > a[data-route="atlas"]').length,
          topologyMarker: header.querySelectorAll('.header-topology-marker').length,
          themeRadius: getComputedStyle(theme).borderRadius,
          line: header.querySelector('.header-linear-graph-line').getAttribute('d')
        };
      });
    }

    for (const snapshot of Object.values(snapshots)) {
      expect(snapshot.routes).toEqual(['overview', 'work', 'knowledge', 'experience', 'education', 'about']);
      expect(snapshot.atlasInHeader).toBe(0);
      expect(snapshot.topologyMarker).toBe(0);
      expect(snapshot.themeRadius).toBe('50%');
      expect(snapshot.line.length).toBeGreaterThan(20);
      expect(snapshot.header.height).toBeCloseTo(62, 0);
    }

    expect(Math.abs(snapshots.overview.header.width - snapshots.work.header.width)).toBeLessThan(1);
    expect(Math.abs(snapshots.overview.header.width - snapshots.knowledge.header.width)).toBeLessThan(1);
    expect(Math.abs(snapshots.overview.header.width - snapshots.atlas.header.width)).toBeLessThan(1);
    expect(Math.abs(snapshots.overview.actions.right - snapshots.atlas.actions.right)).toBeLessThan(2);
  });

  test('branch identity recolours the secondary graph and current word/node together', async ({ page }) => {
    await prepare(page);
    await page.goto('/#overview', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.body.dataset.graphMode === 'overview');
    await waitHeader(page);

    const neutral = await page.evaluate(() => ({
      stroke: getComputedStyle(document.querySelector('.header-linear-graph-line')).stroke
    }));

    await page.locator('#main-nav > a[data-route="work"]').click();
    await page.waitForFunction(() =>
      document.body.dataset.graphMode === 'work' &&
      document.body.dataset.profileBranch === 'work'
    );
    await page.waitForFunction(() => document.querySelector('#main-nav > a[data-route="work"]')?.getAttribute('aria-current') === 'page');
    await waitHeader(page);

    const work = await page.evaluate(() => {
      const link = document.querySelector('#main-nav > a[data-route="work"]');
      const key = link.dataset.headerGraphKey;
      const node = document.querySelector(`.header-linear-graph-nodes circle[data-header-graph-key="${key}"]`);
      return {
        stroke: getComputedStyle(document.querySelector('.header-linear-graph-line')).stroke,
        linkColor: getComputedStyle(link).color,
        nodeFill: getComputedStyle(node).fill,
        accent: getComputedStyle(document.body).getPropertyValue('--profile-accent').trim()
      };
    });

    expect(work.stroke).not.toBe(neutral.stroke);
    expect(work.nodeFill).not.toBe('none');
    expect(work.linkColor.length).toBeGreaterThan(0);
    expect(work.accent.length).toBeGreaterThan(0);
  });

  test('Atlas stays outside the word row and is connected beneath the header even when current', async ({ page }) => {
    await prepare(page);
    await page.goto('/#atlas', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.body.dataset.graphMode === 'atlas');
    await page.waitForFunction(() => document.querySelector('.atlas-button.atlas-entry-v7')?.getClientRects().length);
    await waitHeader(page);

    const atlas = page.locator('.graph-routebar .atlas-button.atlas-entry-v7');
    await expect(atlas).toBeVisible();
    await expect(atlas).toHaveAttribute('aria-current', 'page');
    await expect(atlas).toHaveClass(/is-current/);
    await expect(page.locator('#main-nav > a[data-route="atlas"]')).toHaveCount(0);

    const connector = await page.locator('.header-linear-graph-atlas-link').getAttribute('d');
    expect(connector?.length || 0).toBeGreaterThan(20);
  });
});
