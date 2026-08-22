const { test, expect } = require('@playwright/test');

const bypassIntro = async page => {
  await page.addInitScript(() => sessionStorage.setItem('profileIntroSeen', 'true'));
  await page.route('https://cloud.umami.is/**', route => route.abort()).catch(() => {});
};

const waitSettled = async page => {
  await page.waitForFunction(() => Boolean(window.ProfileScene && window.ProfileGeometry && window.MobileProfileScene));
  await page.waitForFunction(() => !document.body.classList.contains('is-v9-transitioning'));
  await page.waitForTimeout(180);
};

test.describe('Pre-Phase 8 mobile parity', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('boots the mobile runtime without changing graph invariants', async ({ page }) => {
    await bypassIntro(page);
    await page.goto('/#overview');
    await waitSettled(page);

    const state = await page.evaluate(() => ({
      mobileClass: document.documentElement.classList.contains('mobile-profile-app'),
      runtime: Boolean(window.MobileProfileScene),
      mode: document.body.dataset.graphMode,
      variant: window.ProfileScene.manager.variant,
      camera: window.ProfileScene.camera.read().adapter,
      invariants: window.ProfilePhase0.checkGraphInvariants()
    }));

    expect(state.mobileClass).toBe(true);
    expect(state.runtime).toBe(true);
    expect(state.mode).toBe('overview');
    expect(state.variant).toBe('mobile');
    expect(state.camera).toBe('mobile-local');
    expect(state.invariants.duplicateNodeIds).toEqual([]);
    expect(state.invariants.orphanEdgeCount).toBe(0);
  });

  test('deep local routes keep the removed cross-link rail hidden and return cleanly to Overview', async ({ page }) => {
    await bypassIntro(page);
    await page.goto('/#knowledge/logic-math/mathematical-logic/computational-logic/logic-for-ai');
    await waitSettled(page);

    await expect(page.locator('.profile-crosslinks')).toBeHidden();
    await page.locator('.brand').click();
    await page.waitForFunction(() => document.body.dataset.graphMode === 'overview');
    await page.waitForFunction(() => !document.body.classList.contains('is-v9-transitioning'));

    const rootPose = await page.evaluate(() => {
      const node = [...document.querySelectorAll('#site-graph .site-graph-node[data-node-id="stepan-chrast"]')]
        .find(element => !element.closest('.v9-transition-overlay'));
      const label = node?.querySelector('.site-graph-label');
      return label ? [label.getAttribute('text-anchor'), label.getAttribute('x'), label.getAttribute('y')] : null;
    });
    expect(rootPose).toEqual(['middle', '0', '-27']);
  });

  test('Work exposes mobile filters and remains structurally healthy', async ({ page }) => {
    await bypassIntro(page);
    await page.goto('/#work');
    await waitSettled(page);

    await expect(page.locator('.mobile-mode-button')).toHaveText('Filters');
    await page.locator('.mobile-mode-button').click();
    await expect(page.locator('.mobile-control-sheet')).toHaveClass(/is-open/);
    await expect(page.locator('.mobile-control-sheet .integrated-work-controls')).toBeVisible();

    const invariants = await page.evaluate(() => window.ProfilePhase0.checkGraphInvariants());
    expect(invariants.duplicateNodeIds).toEqual([]);
    expect(invariants.orphanEdgeCount).toBe(0);
  });

  test('Atlas has mobile layers, compact Profile return control and lattice-shaped Work territory', async ({ page }) => {
    await bypassIntro(page);
    await page.goto('/#atlas');
    await waitSettled(page);
    await page.waitForTimeout(1500);

    await expect(page.locator('.mobile-mode-button')).toHaveText('Layers');
    const atlasButton = page.locator('.graph-routebar .atlas-button');
    await expect(atlasButton).toContainText('Profile');
    await expect(atlasButton).toHaveAttribute('data-route', 'overview');
    await expect(page.locator('#site-graph-help')).toBeHidden();

    const workShape = await page.evaluate(() => {
      const nodes = [...document.querySelectorAll('#site-graph .site-graph-node[data-node-id]')]
        .filter(element => !element.closest('.v9-transition-overlay'));
      const projects = nodes.filter(element => element.dataset.nodeId.startsWith('project-'));
      const themes = nodes.filter(element => element.dataset.nodeId.startsWith('work-theme-'));
      const projectYs = [...new Set(projects.map(element => Math.round(Number(element.dataset.y) / 20) * 20))];
      const visibleProjectMeta = projects.filter(element => {
        const meta = element.querySelector('.site-graph-meta');
        return meta && getComputedStyle(meta).display !== 'none' && getComputedStyle(meta).visibility !== 'hidden';
      }).length;
      return { projectRanks: projectYs.length, themeCount: themes.length, visibleProjectMeta };
    });

    expect(workShape.themeCount).toBeGreaterThanOrEqual(3);
    expect(workShape.projectRanks).toBeGreaterThanOrEqual(2);
    expect(workShape.visibleProjectMeta).toBe(0);

    await atlasButton.click();
    await page.waitForFunction(() => document.body.dataset.graphMode === 'overview');
  });
});

test.describe('Pre-Phase 8 desktop regression guard', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('does not boot mobile runtime on desktop', async ({ page }) => {
    await bypassIntro(page);
    await page.goto('/#overview');
    await page.waitForFunction(() => Boolean(window.ProfileScene && window.ProfileGeometry));
    await page.waitForTimeout(250);
    const state = await page.evaluate(() => ({
      mobile: Boolean(window.MobileProfileScene),
      mobileClass: document.documentElement.classList.contains('mobile-profile-app'),
      variant: window.ProfileScene.manager.variant,
      camera: window.ProfileScene.camera.read().adapter
    }));
    expect(state.mobile).toBe(false);
    expect(state.mobileClass).toBe(false);
    expect(state.variant).toBe('desktop');
    expect(state.camera).toBe('desktop-local');
  });
});
