const { test, expect } = require('@playwright/test');

const bypassIntro = async page => {
  await page.addInitScript(() => sessionStorage.setItem('profileIntroSeen', 'true'));
  await page.route('https://cloud.umami.is/**', route => route.abort()).catch(() => {});
};

const freshIntro = async page => {
  await page.addInitScript(() => sessionStorage.removeItem('profileIntroSeen'));
  await page.route('https://cloud.umami.is/**', route => route.abort()).catch(() => {});
};

const activateOverview = async page => {
  await page.goto('/#overview');
  await page.waitForFunction(() => Boolean(window.ProfileRootLanding && window.ProfileGeometry?.snapshot?.().compassVersion === 'fan-v3'));
  if (await page.evaluate(() => window.ProfileRootLanding.isActive())) {
    await page.evaluate(() => window.ProfileRootLanding.activate({ focusGraph: false }));
  }
  await page.waitForFunction(() => document.body.dataset.graphMode === 'overview' && document.body.dataset.rootLanding === 'false');
};

const liveLabelPose = (page, id) => page.evaluate(id => {
  const node = [...document.querySelectorAll(`#site-graph .site-graph-node[data-node-id="${id}"]`)]
    .find(element => !element.closest('.v9-transition-overlay'));
  const label = node?.querySelector('.site-graph-label');
  return label ? [label.getAttribute('text-anchor'), label.getAttribute('x'), label.getAttribute('y')] : null;
}, id);

test.describe('Final graph interaction consolidation', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('uses one final compass and keeps all Atlas nodes inside the viewBox', async ({ page }) => {
    await bypassIntro(page);
    await page.goto('/#atlas');
    await page.waitForFunction(() => window.ProfileGeometry?.snapshot?.().compassVersion === 'fan-v3' && document.body.dataset.globalCompass === 'fan-v3');
    await page.waitForFunction(() => document.querySelectorAll('#site-graph .site-graph-node[data-node-id]').length === window.SITE_DATA.graph.nodes.length);

    const result = await page.evaluate(() => {
      const geometry = window.ProfileGeometry;
      const root = geometry.atlasPoint('stepan-chrast');
      const points = window.SITE_DATA.graph.nodes.map(node => geometry.atlasPoint(node.id)).filter(Boolean);
      const section = id => geometry.atlasPoint(id);
      return {
        minX: Math.min(...points.map(point => point.x)),
        maxX: Math.max(...points.map(point => point.x)),
        minY: Math.min(...points.map(point => point.y)),
        maxY: Math.max(...points.map(point => point.y)),
        root,
        knowledge: section('knowledge'),
        education: section('education'),
        about: section('about')
      };
    });

    expect(result.minX).toBeGreaterThanOrEqual(140);
    expect(result.maxX).toBeLessThanOrEqual(2380);
    expect(result.minY).toBeGreaterThanOrEqual(130);
    expect(result.maxY).toBeLessThanOrEqual(1450);
    expect(result.knowledge.x).toBeGreaterThan(result.root.x + 250);
    expect(result.education.y).toBeLessThan(result.root.y - 150);
    expect(result.about.y).toBeLessThan(result.root.y - 150);
  });

  test('keeps deep primary-path labels to the right and stable after transitions', async ({ page }) => {
    await bypassIntro(page);
    await page.goto('/#knowledge/logic-math/mathematical-logic/computational-logic/logic-for-ai');
    await page.waitForFunction(() => document.body.dataset.graphRoute?.endsWith('/logic-for-ai') && document.body.dataset.graphMode === 'focus');
    await page.waitForFunction(() => window.ProfileIntroFixesV3?.snapshot?.().localAncestorLabels >= 4);

    const ids = ['stepan-chrast', 'knowledge', 'logic-math', 'mathematical-logic', 'computational-logic'];
    const poses = await page.evaluate(ids => Object.fromEntries(ids.map(id => {
      const node = [...document.querySelectorAll(`#site-graph .site-graph-node[data-node-id="${id}"]`)]
        .find(element => !element.closest('.v9-transition-overlay'));
      const label = node?.querySelector('.site-graph-label');
      return [id, label ? {
        anchor: label.getAttribute('text-anchor'),
        x: Number(label.getAttribute('x')),
        y: Number(label.getAttribute('y'))
      } : null];
    })), ids);

    ids.forEach(id => {
      expect(poses[id]).not.toBeNull();
      expect(poses[id].anchor).toBe('start');
      expect(poses[id].x).toBeGreaterThanOrEqual(16);
      expect(Math.abs(poses[id].y)).toBeLessThan(8);
    });

    const before = await liveLabelPose(page, 'stepan-chrast');
    await page.waitForTimeout(420);
    const after = await liveLabelPose(page, 'stepan-chrast');
    expect(after).toEqual(before);
  });

  test('does not snap the root label after Overview to Knowledge transition ends', async ({ page }) => {
    await bypassIntro(page);
    await activateOverview(page);
    await page.locator('#site-graph .site-graph-node[data-node-id="knowledge"]').click();
    await page.waitForFunction(() => document.body.dataset.graphRoute === 'knowledge');
    await page.waitForFunction(() => !document.body.classList.contains('is-v9-transitioning'), null, { timeout: 5_000 });

    const poses = [];
    poses.push(await liveLabelPose(page, 'stepan-chrast'));
    await page.waitForTimeout(60);
    poses.push(await liveLabelPose(page, 'stepan-chrast'));
    await page.waitForTimeout(120);
    poses.push(await liveLabelPose(page, 'stepan-chrast'));
    await page.waitForTimeout(260);
    poses.push(await liveLabelPose(page, 'stepan-chrast'));

    expect(poses.every(pose => JSON.stringify(pose) === JSON.stringify(poses[0]))).toBe(true);
    expect(poses[0]).toEqual(['start', '17', '4']);
  });

  test('shows a rotating root orbit only in expanded Overview', async ({ page }) => {
    await bypassIntro(page);
    await activateOverview(page);

    const orbit = page.locator('#site-graph .site-graph-node[data-node-id="stepan-chrast"] > .profile-root-overview-orbit');
    await expect(orbit).toHaveCount(1);
    expect(await orbit.locator('.is-a').evaluate(circle => getComputedStyle(circle).animationName)).toContain('profile-root-dash-a');

    await page.locator('#site-graph .site-graph-node[data-node-id="knowledge"]').click();
    await page.waitForFunction(() => document.body.dataset.graphMode === 'focus');
    await page.waitForFunction(() => !document.body.classList.contains('is-v9-transitioning'), null, { timeout: 5_000 });
    await page.waitForTimeout(380);
    const liveOrbits = await page.evaluate(() => [...document.querySelectorAll('#site-graph .site-graph-node[data-node-id="stepan-chrast"] > .profile-root-overview-orbit')]
      .filter(element => !element.closest('.v9-transition-overlay')).length);
    expect(liveOrbits).toBe(0);
  });

  test('root inspector omits the old Profile root eyebrow', async ({ page }) => {
    await bypassIntro(page);
    await activateOverview(page);
    await page.locator('#site-graph .site-graph-node[data-node-id="stepan-chrast"]').click();
    await expect(page.locator('.profile-root-inspector')).toHaveClass(/is-open/);
    await expect(page.locator('.profile-root-inspector')).not.toContainText('Profile root');
    await expect(page.locator('.profile-root-inspector h2')).toHaveText('Štěpán Chrast');
  });

  test('Atlas boundary navigation uses its dedicated handoff rather than V9', async ({ page }) => {
    await bypassIntro(page);
    await activateOverview(page);
    await page.locator('[data-route="atlas"]').first().click();
    await page.waitForFunction(() => document.body.classList.contains('is-atlas-handoff'));
    await expect(page.locator('.profile-atlas-handoff')).toHaveCount(1);
    expect(await page.evaluate(() => document.body.classList.contains('is-v9-transitioning'))).toBe(false);
    await page.waitForFunction(() => document.body.dataset.graphMode === 'atlas' && document.body.dataset.globalCompass === 'fan-v3');
    await page.waitForFunction(() => !document.body.classList.contains('is-atlas-handoff'), null, { timeout: 4_000 });

    await page.evaluate(() => {
      window.__compassHistory = [document.body.dataset.globalCompass];
      window.__compassObserver = new MutationObserver(() => window.__compassHistory.push(document.body.dataset.globalCompass));
      window.__compassObserver.observe(document.body, { attributes: true, attributeFilter: ['data-global-compass'] });
    });
    await page.locator('#atlas-controls [data-route="overview"]').click();
    await page.waitForFunction(() => document.body.classList.contains('is-atlas-handoff'));
    expect(await page.evaluate(() => document.body.classList.contains('is-v9-transitioning'))).toBe(false);
    await page.waitForFunction(() => document.body.dataset.graphMode === 'overview');
    await page.waitForFunction(() => !document.body.classList.contains('is-atlas-handoff'), null, { timeout: 4_000 });
    const history = await page.evaluate(() => {
      window.__compassObserver?.disconnect();
      return window.__compassHistory;
    });
    expect(history.every(value => value === 'fan-v3')).toBe(true);
  });
});

test.describe('V3.1 entry retirement', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('never restores the old Enter gateway and stays in ATLAS_READY after reveal', async ({ page }) => {
    await freshIntro(page);
    await page.goto('/');
    await page.waitForFunction(() => Boolean(window.ProfileIntro?.__v31));
    await expect(page.locator('.profile-intro-enter')).toHaveCount(0);
    await expect(page.locator('.profile-intro-gateway-orbit')).toHaveCount(0);
    await page.waitForFunction(() => window.ProfileIntro.snapshot().state === 'ATLAS_READY', null, { timeout: 8_000 });
    expect(await page.evaluate(() => window.ProfileRootLanding?.isActive?.())).toBe(false);
    expect(await page.evaluate(() => document.body.dataset.graphMode)).toBe('atlas');
  });
});
