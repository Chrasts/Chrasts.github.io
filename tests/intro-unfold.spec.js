const { test, expect } = require('@playwright/test');

const freshIntro = async page => {
  await page.addInitScript(() => {
    sessionStorage.removeItem('profileIntroSeen');
    sessionStorage.removeItem('__phase3FreshPrepared');
  });
  await page.route('https://cloud.umami.is/**', route => route.abort()).catch(() => {});
};

const bypassIntro = async page => {
  await page.addInitScript(() => sessionStorage.setItem('profileIntroSeen', 'true'));
  await page.route('https://cloud.umami.is/**', route => route.abort()).catch(() => {});
};

test.describe('Automatic first-session Atlas unfold', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('starts from the living Štěpán root, grows the real Atlas, then reveals Enter profile', async ({ page }) => {
    await freshIntro(page);
    await page.goto('/');
    await page.waitForFunction(() => window.ProfileIntroUnfold?.snapshot().stage === 'root', null, { timeout: 8_000 });

    const shell = page.locator('.profile-intro-overlay');
    const root = shell.locator('.site-graph-node[data-node-id="stepan-chrast"]');
    const enter = shell.locator('.profile-intro-enter');

    await expect(shell).toHaveAttribute('data-auto-unfold-stage', 'root');
    await expect(root.locator('.profile-intro-root-orbit circle')).toHaveCount(3);
    expect(await root.locator('.site-graph-label').evaluate(label => parseFloat(getComputedStyle(label).fontSize))).toBeGreaterThanOrEqual(20);
    expect(await enter.evaluate(element => Number(getComputedStyle(element).opacity))).toBeLessThan(0.05);
    await expect(enter).toHaveAttribute('tabindex', '-1');

    const visibleAtRoot = await page.evaluate(() => [...document.querySelectorAll(
      '.profile-intro-graph .site-graph-node:not([data-node-id="stepan-chrast"])'
    )].filter(node => Number(getComputedStyle(node).opacity) > 0.05).length);
    expect(visibleAtRoot).toBe(0);

    await page.waitForFunction(() => window.ProfileIntroUnfold?.snapshot().stage === 'unfolding', null, { timeout: 4_000 });
    await page.waitForTimeout(520);
    const during = await page.evaluate(() => {
      const nodes = [...document.querySelectorAll('.profile-intro-graph .site-graph-node:not([data-node-id="stepan-chrast"])')];
      const visible = nodes.filter(node => Number(getComputedStyle(node).opacity) > 0.08).length;
      return { visible, total: nodes.length };
    });
    expect(during.visible).toBeGreaterThan(0);
    expect(during.visible).toBeLessThan(during.total);

    await page.waitForFunction(() => window.ProfileIntroUnfold?.snapshot().completed === true, null, { timeout: 5_000 });
    await expect(shell).toHaveClass(/is-auto-unfold-complete/);
    await expect(enter).toHaveAttribute('tabindex', '0');
    await expect(enter).toBeEnabled();
    expect(await enter.evaluate(element => Number(getComputedStyle(element).opacity))).toBeGreaterThan(0.9);
    expect(await enter.evaluate(element => getComputedStyle(element, '::after').animationName)).toContain('intro-gateway-orbit');
    expect(await root.locator('.site-graph-label').evaluate(label => parseFloat(getComputedStyle(label).fontSize))).toBeGreaterThanOrEqual(18);

    await enter.click();
    await page.waitForFunction(() => window.ProfileIntro?.snapshot().stage === 'territories', null, { timeout: 2_500 });
  });
});

test.describe('Atlas terminal spacing', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('gives Knowledge terminal nodes meaningful radial variance while Work stays rank-like', async ({ page }) => {
    await bypassIntro(page);
    await page.goto('/#atlas');
    await page.waitForFunction(() => window.ProfileGeometry?.snapshot().compassVersion === 'fan-v2', null, { timeout: 5_000 });

    const spread = await page.evaluate(() => {
      const graph = window.SITE_DATA.graph;
      const geometry = window.ProfileGeometry;
      const root = geometry.atlasPoint(graph.rootId);
      const project = (point, vector) => (point.x - root.x) * vector.x + (point.y - root.y) * vector.y;
      const terminalIds = section => graph.nodes
        .filter(node => geometry.sectionFor(node.id) === section && node.id !== section)
        .filter(node => !graph.nodes.some(child => child.parentIds?.includes(node.id) && geometry.sectionFor(child.id) === section))
        .map(node => node.id);
      const distances = (ids, section) => ids.map(id => project(geometry.atlasPoint(id), geometry.compass[section]));
      const knowledge = distances(terminalIds('knowledge'), 'knowledge');
      const work = distances(
        graph.nodes.filter(node => node.type === 'project' && geometry.sectionFor(node.id) === 'work').map(node => node.id),
        'work'
      );
      const range = values => Math.max(...values) - Math.min(...values);
      return { knowledgeCount: knowledge.length, knowledgeRange: range(knowledge), workRange: range(work) };
    });

    expect(spread.knowledgeCount).toBeGreaterThan(3);
    expect(spread.knowledgeRange).toBeGreaterThan(110);
    expect(spread.workRange).toBeLessThan(90);
  });
});