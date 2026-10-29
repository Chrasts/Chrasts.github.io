const { test, expect } = require('@playwright/test');

test.describe('Living Work Constellation', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  const visitWork = async page => {
    await page.goto('/#work');
    await page.waitForFunction(() =>
      document.body.dataset.graphMode === 'work' &&
      window.ProfileWorkController?.snapshot?.().view === 'constellation'
    );
  };

  test('opens a complete editorial constellation without left filters or an artificial root', async ({ page }) => {
    await visitWork(page);
    await expect(page.locator('#site-graph .is-work-constellation-project')).toHaveCount(10);
    await expect(page.locator('#site-graph .site-graph-edges path.is-work-related')).toHaveCount(10);
    await expect(page.locator('#site-graph .site-graph-node[data-node-id="work"]')).toHaveCount(0);
    await expect(page.locator('#site-graph .site-graph-semantic-guide.is-work-column')).toHaveCount(0);
    await expect(page.locator('.integrated-work-rail.is-left')).toBeHidden();
    await expect(page.locator('.work-explore-hud')).toBeVisible();
    await expect(page.locator('.work-hud-explore')).toBeVisible();
    await expect(page.locator('.work-hud-lattice')).toBeVisible();
    await expect(page.locator('#site-graph .work-observatory-orbit')).toHaveCount(0);
  });

  test('node hover shows a short case-study preview and highlighted relations', async ({ page }) => {
    await visitWork(page);
    await page.locator('#site-graph [data-node-id="project-bachelor-thesis"]').hover();
    await expect(page.locator('.work-project-peek')).toBeVisible();
    await expect(page.locator('.work-project-peek strong')).toContainText('Bachelor Thesis');
    await expect(page.locator('#site-graph .site-graph-edges path.is-work-related.is-work-strong')).toHaveCount(2);
    await page.locator('.work-hud-explore').hover();
    await expect(page.locator('.work-project-peek')).toBeHidden();
  });

  test('a thematic lens reflows only matching projects, and All projects restores the full scene', async ({ page }) => {
    await visitWork(page);
    await page.locator('.work-hud-explore').click();
    await expect(page.locator('#work-lens-picker')).toBeVisible();
    await page.locator('.work-lens-option[data-lens="research"]').click();
    await page.waitForFunction(() => location.hash === '#work/lens/research');
    await expect(page.locator('#site-graph .is-work-constellation-project')).toHaveCount(6);
    await expect(page.locator('.work-hud-explore')).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => page.evaluate(() => window.ProfileWorkController.snapshot().lensId)).toBe('research');
    await page.locator('.work-hud-all').click();
    await page.waitForFunction(() => location.hash === '#work');
    await expect(page.locator('#site-graph .is-work-constellation-project')).toHaveCount(10);
    await expect(page.locator('.work-hud-explore')).toHaveAttribute('aria-pressed', 'false');
  });

  test('Focus replaces overview with only genuinely related projects and evidence', async ({ page }) => {
    await visitWork(page);
    await page.locator('#site-graph [data-node-id="project-bachelor-thesis"]').click();
    await page.waitForFunction(() => location.hash === '#work/project/bachelor-thesis');
    await page.waitForFunction(() => document.body.dataset.workFocus === 'bachelor-thesis');
    await expect(page.locator('#site-graph .is-work-constellation-project')).toHaveCount(3);
    await expect(page.locator('#site-graph .is-work-observatory-centre')).toHaveCount(1);
    await expect(page.locator('#site-graph .is-work-observatory-peer')).toHaveCount(2);
    await expect(page.locator('#site-graph .work-observatory-orbit')).toHaveCount(0);
    await expect(page.locator('#site-detail-panel')).toBeVisible();
    await expect(page.locator('#site-detail-panel h2')).toContainText('Bachelor Thesis');
    await expect(page.locator('#site-detail-panel .work-focus-lede')).toBeVisible();
    await expect(page.locator('#site-detail-panel .work-focus-related-link')).toHaveCount(2);
    await expect(page.locator('.work-hud-explore')).toBeHidden();
    await expect.poll(() => page.evaluate(() => window.ProfileWorkController.snapshot().focusPeerIds))
      .toEqual(['arol-lab','clp-survey']);
    await page.waitForFunction(() => {
      const node = document.querySelector('#site-graph [data-node-id="project-bachelor-thesis"]');
      return node && Math.abs(Number(node.dataset.x) - 532) < 0.5 &&
        Math.abs(Number(node.dataset.y) - 360) < 0.5;
    });
  });

  test('a project without curated relations appears alone rather than inventing proximity', async ({ page }) => {
    await page.goto('/#work/project/axiom-wilds');
    await page.waitForFunction(() => document.body.dataset.workFocus === 'axiom-wilds');
    await expect(page.locator('#site-graph .is-work-constellation-project')).toHaveCount(1);
    await expect(page.locator('#site-graph .site-graph-edges path.is-work-related')).toHaveCount(0);
    await expect(page.locator('#site-detail-panel h2')).toContainText('Axiom Wilds');
    expect(await page.evaluate(() => window.ProfileWorkController.snapshot().focusPeerIds)).toEqual([]);
  });

  test('can navigate directly between related projects and return to a previous lens', async ({ page }) => {
    await page.goto('/#work/lens/logic');
    await page.waitForFunction(() => document.body.dataset.workLens === 'logic');
    await page.locator('#site-graph [data-node-id="project-bachelor-thesis"]').click();
    await page.waitForFunction(() => document.body.dataset.workFocus === 'bachelor-thesis');
    await page.locator('#site-detail-panel .work-focus-related-link', { hasText: 'A-ROL Lab' }).click();
    await page.waitForFunction(() => document.body.dataset.workFocus === 'arol-lab');
    await expect(page.locator('#site-graph .is-work-observatory-centre')).toHaveCount(1);
    await page.locator('#site-detail-panel .work-observatory-return').click();
    await page.waitForFunction(() => location.hash === '#work/lens/logic');
    await expect(page.locator('#site-graph .is-work-constellation-project')).toHaveCount(5);
    await expect(page.locator('#site-detail-panel')).toBeHidden();
  });

  test('FCA remains a separate accessible mode, with the Work HUD still available', async ({ page }) => {
    await visitWork(page);
    await page.locator('.work-hud-lattice').click();
    await page.waitForFunction(() => location.hash === '#work/lattice');
    await expect(page.locator('#site-graph .is-work-concept')).toHaveCount(11);
    await expect(page.locator('#site-graph .site-graph-edges path.is-work-lattice')).not.toHaveCount(0);
    await expect(page.locator('.integrated-work-rail.is-left')).toBeHidden();
    await page.locator('.work-hud-all').click();
    await page.waitForFunction(() => location.hash === '#work');
    await expect(page.locator('#site-graph .is-work-constellation-project')).toHaveCount(10);
  });

  test('escape exits Project Focus, including when opened directly', async ({ page }) => {
    await page.goto('/#work/project/modal-logic-lab');
    await page.waitForFunction(() => document.body.dataset.workFocus === 'modal-logic-lab');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => location.hash === '#work');
    await expect(page.locator('#site-graph .is-work-constellation-project')).toHaveCount(10);
    await expect(page.locator('#site-detail-panel')).toBeHidden();
  });

  test('mobile keeps on-canvas Work exploration and a separate optional project list', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => sessionStorage.setItem('profileIntroSeen', 'true'));
    await visitWork(page);
    await page.waitForFunction(() => document.body.classList.contains('mobile-app-mode'));
    await expect(page.locator('.work-explore-hud')).toBeVisible();
    expect(await page.locator('.integrated-work-controls').evaluate(el =>
      el.parentElement?.classList.contains('scene-canvas'))).toBe(true);
    await page.locator('.work-hud-explore').click();
    await expect(page.locator('#work-lens-picker')).toBeVisible();
    await page.locator('.work-lens-option[data-lens="education"]').click();
    await page.waitForFunction(() => document.body.dataset.workLens === 'education');
    await expect(page.locator('#site-graph .is-work-constellation-project')).toHaveCount(3);
    const projectSheet = page.locator('.mobile-mode-button');
    await expect(projectSheet).toBeVisible();
    await projectSheet.click();
    await expect(page.locator('.mobile-control-sheet.is-open')).toBeVisible();
    await expect(page.locator('.mobile-work-project-picker')).toBeVisible();
    await expect(page.locator('.integrated-work-rail.is-left')).toBeHidden();
  });

  test('Work-specific morphology is removed in Atlas; reduced motion disables idle halo drift', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await visitWork(page);
    const halo = page.locator('#site-graph .is-work-constellation-project[data-halo-state="idle"] > .site-graph-halo--primary').first();
    await expect(halo).toHaveCount(1);
    expect(await halo.evaluate(el => getComputedStyle(el).animationName)).toBe('none');
    await page.evaluate(() => { location.hash = '#atlas'; });
    await page.waitForFunction(() => document.body.dataset.graphMode === 'atlas');
    await expect(page.locator('#site-graph .is-work-constellation-project')).toHaveCount(0);
    await expect(page.locator('.work-explore-hud')).toBeHidden();
  });
});
