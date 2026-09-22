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

  test('Profile brief leads the row and professional links stay high-contrast in both themes', async ({ page }) => {
    await prepare(page);
    await page.goto('/#overview', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.body.dataset.graphMode === 'overview');
    await page.waitForFunction(() => {
      const quick = document.querySelector('.header-quick-overview');
      return quick && !quick.hidden;
    });
    await waitHeader(page);

    const geometry = await page.evaluate(() => {
      const quick = document.querySelector('.header-quick-overview');
      const overview = document.querySelector('#main-nav > a[data-route="overview"]');
      const firstNode = document.querySelector('.header-linear-graph-nodes circle[data-header-graph-key="profile-brief"]');
      return {
        quick: quick.getBoundingClientRect().toJSON(),
        overview: overview.getBoundingClientRect().toJSON(),
        firstNodeFill: getComputedStyle(firstNode).fill,
        routebarQuickCount: document.querySelectorAll('.quick-overview-global-trigger').length
      };
    });
    expect(geometry.quick.right).toBeLessThan(geometry.overview.left);
    expect(geometry.overview.left - geometry.quick.right).toBeGreaterThanOrEqual(10);
    expect(geometry.routebarQuickCount).toBe(0);
    expect(geometry.firstNodeFill).not.toBe('none');

    const assertProfessionalLinksUseInk = async () => {
      const colors = await page.evaluate(() => {
        const probe = document.createElement('span');
        probe.style.color = 'var(--ink)';
        document.body.appendChild(probe);
        const ink = getComputedStyle(probe).color;
        probe.remove();
        return {
          ink,
          links: [...document.querySelectorAll('.header-practical-actions .header-utility')]
            .map(link => getComputedStyle(link).color)
        };
      });
      expect(colors.links.length).toBe(4);
      colors.links.forEach(color => expect(color).toBe(colors.ink));
    };

    await assertProfessionalLinksUseInk();
    await page.locator('.theme-toggle').click();
    await page.waitForTimeout(360);
    await assertProfessionalLinksUseInk();
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

  test('Atlas sits at the far right, labels below the glyph, and the header line lands on its brown centre node', async ({ page }) => {
    await prepare(page);
    await page.goto('/#atlas', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.body.dataset.graphMode === 'atlas');
    await page.waitForFunction(() => document.querySelector('.atlas-button.atlas-entry-v7')?.getClientRects().length);
    await page.waitForFunction(() => document.querySelector('.atlas-entry-glyph-nodes circle:first-child'));
    await page.waitForTimeout(80);
    await waitHeader(page);

    const atlas = page.locator('.graph-routebar .atlas-button.atlas-entry-v7');
    await expect(atlas).toBeVisible();
    await expect(atlas).toHaveAttribute('aria-current', 'page');
    await expect(atlas).toHaveClass(/is-current/);
    await expect(page.locator('#main-nav > a[data-route="atlas"]')).toHaveCount(0);

    const state = await page.evaluate(() => {
      const header = document.querySelector('.app-header').getBoundingClientRect();
      const button = document.querySelector('.graph-routebar .atlas-button.atlas-entry-v7').getBoundingClientRect();
      const glyph = document.querySelector('.graph-routebar .atlas-entry-glyph').getBoundingClientRect();
      const copy = document.querySelector('.graph-routebar .atlas-entry-copy').getBoundingClientRect();
      const centre = document.querySelector('.graph-routebar .atlas-entry-glyph-nodes circle:first-child').getBoundingClientRect();
      const d = document.querySelector('.header-linear-graph-atlas-link').getAttribute('d') || '';
      const nums = (d.match(/-?\\d+(?:\\.\\d+)?/g) || []).map(Number);
      return {
        buttonRightGap: innerWidth - button.right,
        labelBelowGlyph: copy.top >= glyph.bottom - 1,
        centralFill: getComputedStyle(document.querySelector('.graph-routebar .atlas-entry-glyph-nodes circle:first-child')).fill,
        brown: (() => {
          const probe = document.createElement('span');
          probe.style.color = 'var(--brown)';
          document.body.appendChild(probe);
          const value = getComputedStyle(probe).color;
          probe.remove();
          return value;
        })(),
        endpoint: nums.length >= 2 ? { x: nums.at(-2), y: nums.at(-1) } : null,
        target: {
          x: centre.left - header.left + centre.width / 2,
          y: centre.top - header.top + centre.height / 2
        },
        connectorLength: d.length
      };
    });

    expect(state.buttonRightGap).toBeGreaterThanOrEqual(10);
    expect(state.buttonRightGap).toBeLessThanOrEqual(36);
    expect(state.labelBelowGlyph).toBe(true);
    expect(state.centralFill).toBe(state.brown);
    expect(state.connectorLength).toBeGreaterThan(20);
    expect(state.endpoint).not.toBeNull();
    expect(state.endpoint.x).toBeCloseTo(state.target.x, 0);
    expect(state.endpoint.y).toBeCloseTo(state.target.y, 0);
  });

  test('Atlas topology mixes branch accent with a permanently brown main node', async ({ page }) => {
    await prepare(page);
    await page.goto('/#work', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() =>
      document.body.dataset.graphMode === 'work' &&
      document.body.dataset.profileBranch === 'work'
    );
    await page.waitForFunction(() => document.querySelector('.atlas-button.atlas-entry-v7 .atlas-entry-glyph'));
    await page.waitForTimeout(80);

    const colors = await page.evaluate(() => {
      const probe = value => {
        const el = document.createElement('span');
        el.style.color = value;
        document.body.appendChild(el);
        const color = getComputedStyle(el).color;
        el.remove();
        return color;
      };
      const main = document.querySelector('.atlas-entry-glyph-nodes circle:first-child');
      const accentEdge = document.querySelector('.atlas-entry-glyph-edges line:nth-child(1)');
      return {
        brown: probe('var(--brown)'),
        accent: probe('var(--profile-accent)'),
        mainFill: getComputedStyle(main).fill,
        mainStroke: getComputedStyle(main).stroke,
        accentEdge: getComputedStyle(accentEdge).stroke
      };
    });

    expect(colors.accent).not.toBe(colors.brown);
    expect(colors.mainFill).toBe(colors.brown);
    expect(colors.mainStroke).toBe(colors.brown);
    expect(colors.accentEdge).toBe(colors.accent);
  });
});
