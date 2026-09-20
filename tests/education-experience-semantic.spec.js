const { test, expect } = require('@playwright/test');

const bypassIntro = async page => {
  await page.addInitScript(() => sessionStorage.setItem('profileIntroSeen', 'true'));
  await page.route('https://cloud.umami.is/**', route => route.abort()).catch(() => {});
};

const point = (page, id) => page.locator(`#site-graph .site-graph-node[data-node-id="${id}"]`).evaluate(node => ({
  x: Number(node.dataset.x), y: Number(node.dataset.y)
}));

test.describe('Education and Experience semantic geometry', () => {
  test('profile root exits a semantic fragment after a normal pointer click', async ({ page }) => {
    await bypassIntro(page);
    await page.goto('/#experience');
    await page.waitForFunction(() => document.body.dataset.graphRoute === 'experience');
    await page.waitForFunction(() => document.querySelector('#site-graph [data-semantic-guide="experience-axis"]'));
    await page.locator('#site-graph .site-graph-node[data-node-id="stepan-chrast"]').click();
    await page.waitForFunction(() => document.body.dataset.graphRoute === 'overview');
  });

  test('section breadcrumbs return from semantic focus directly to the local overview', async ({ page }) => {
    await bypassIntro(page);
    await page.goto('/#experience/ceske-priority');
    await page.waitForFunction(() => document.body.dataset.graphRoute === 'experience/ceske-priority');
    await page.locator('#graph-breadcrumb .graph-crumb').filter({ hasText: 'Experience' }).click();
    await page.waitForFunction(() => document.body.dataset.graphRoute === 'experience');
    await expect(page.locator('#site-graph [data-semantic-guide="experience-axis"]')).toHaveCount(1);

    await page.goto('/#education/charles-university');
    await page.waitForFunction(() => document.body.dataset.graphRoute === 'education/charles-university');
    await page.locator('#graph-breadcrumb .graph-crumb').filter({ hasText: 'Education' }).click();
    await page.waitForFunction(() => document.body.dataset.graphRoute === 'education');
    await expect(page.locator('#site-graph [data-semantic-guide="education-trajectory"]')).toHaveCount(1);
  });

  test('Experience has deterministic chronological geometry and reveals only canonical related Work on role focus', async ({ page }) => {
    await bypassIntro(page);
    await page.goto('/#experience');
    await page.waitForFunction(() => document.body.dataset.graphRoute === 'experience');
    await page.waitForFunction(() => document.querySelectorAll('#site-graph [data-semantic-guide="experience-axis"]').length === 1);
    await page.waitForTimeout(520);

    const positions = await Promise.all(['escape-room', 'student-ball', 'ceske-priority'].map(id => point(page, id)));
    // Range labels sit at interval centres, so overlapping legacy positions
    // need not be ordered by their start date. Both must remain inside the
    // compressed historical region, before the current-career segment.
    expect(positions[0].x).toBeLessThan(positions[2].x);
    expect(positions[1].x).toBeLessThan(positions[2].x);
    // Old overlapping roles receive deterministic rails above the backbone;
    // the current role has its own prominent ongoing range after the break.
    expect(positions[0].y).not.toBe(positions[1].y);
    await expect(page.locator('#site-graph .site-graph-edges path.is-hierarchy')).toHaveCount(0);
    await expect(page.locator('#site-graph .site-graph-node.is-semantic-timeline-role')).toHaveCount(3);
    await expect(page.locator('#site-graph [data-semantic-guide="experience-present"]')).toHaveCount(1);
    await expect(page.locator('#site-graph [data-semantic-guide="experience-duration-ceske-priority"] .is-current')).toHaveCount(1);
    await expect(page.locator('#site-graph [data-semantic-guide^="experience-compressed-break"]')).toHaveCount(0);
    await expect(page.locator('#site-graph [data-semantic-guide="experience-axis"] text')).toHaveCount(0);
    await expect(page.locator('#site-graph')).not.toContainText('compressed');
    await expect(page.locator('#site-graph .site-graph-node[data-node-id="ceske-priority"] .site-graph-meta')).toHaveText('Jul 2026 - present');
    await expect(page.locator('#site-graph .site-graph-node[data-node-id="escape-room"] .site-graph-meta')).toBeHidden();
    await expect(page.locator('#site-graph .site-graph-node.is-legacy-experience')).toHaveCount(2);
    await expect(page.locator('#site-graph .site-graph-node.is-professional-experience')).toHaveCount(1);

    // The profile node is a real back-to-overview control even while the
    // semantic camera is available for drag panning.
    await page.locator('#site-graph .site-graph-node[data-node-id="stepan-chrast"]').click();
    await page.waitForFunction(() => document.body.dataset.graphRoute === 'overview');
    await page.goto('/#experience');
    await page.waitForFunction(() => document.body.dataset.graphRoute === 'experience');

    await page.goto('/#experience/ceske-priority');
    await page.waitForFunction(() => document.body.dataset.graphRoute === 'experience/ceske-priority');
    const live = '#site-graph .site-graph-svg > g:not(.v9-transition-overlay)';
    // Role exploration switches from chronology to a local semantic tree.
    // No rail, range, tick or present marker may survive this mode change.
    await expect(page.locator('#site-graph [data-semantic-guide^="experience-"]')).toHaveCount(0);
    await expect(page.locator(`${live} .site-graph-node[data-node-id="ceske-priority"]`)).toHaveClass(/is-selected/);
    await expect(page.locator(`${live} .site-graph-node[data-node-id="project-social-workers-survey"]`)).toBeVisible();
    await expect(page.locator(`${live} .site-graph-node[data-node-id="project-tachov-workshop"]`)).toBeVisible();
    await expect(page.locator(`${live} .site-graph-edges path.is-role-project`)).toHaveCount(2);
    await page.waitForFunction(() => Boolean(window.ProfilePhase8));
    const inspector = page.locator('[data-phase8-object="experience-current-role"]');
    await expect(inspector).toBeVisible();
    await expect(inspector).toContainText('Organisation');
    await expect(inspector).toContainText('Related Work');
    await expect(page.locator('[data-phase8-object="experience-timeline"]')).toBeHidden();
    await expect(page.locator('.scene-detail')).toBeHidden();
    await expect(page.locator('#graph-breadcrumb .graph-crumb').filter({ hasText: 'Experience' })).toHaveAccessibleName('Return to Experience overview');

    // The semantic inspector is built after the initial page boot. Its
    // controls must still be live native route controls, and related Work
    // should use the same semantic travel/history as the graph relation.
    const relatedWork = inspector.getByRole('button', { name: /Survey Analysis and Open-Text Coding/i });
    await expect(relatedWork).toHaveAttribute('data-crosslink-target', 'project-social-workers-survey');
    await relatedWork.click();
    await page.waitForFunction(() => document.body.dataset.graphRoute === 'work/project/social-workers-survey');
    await page.waitForFunction(() => window.ProfileCrossLinkTravel.snapshot().result === 'completed');
    expect(await page.evaluate(() => window.ProfileCrossLinkTravel.snapshot().canReturn)).toBe(true);
  });

  test('older Experience roles open as local roots without invented children or timeline residue', async ({ page }) => {
    await bypassIntro(page);
    for (const roleId of ['escape-room', 'student-ball']) {
      await page.goto(`/#experience/${roleId}`);
      await page.waitForFunction(expected => document.body.dataset.graphRoute === expected, `experience/${roleId}`);
      await expect(page.locator('#site-graph [data-semantic-guide^="experience-"]')).toHaveCount(0);
      await expect(page.locator(`#site-graph .site-graph-node[data-node-id="${roleId}"]`).last()).toHaveClass(/is-selected/);
      await expect(page.locator('#site-graph .site-graph-edges path.is-role-project')).toHaveCount(0);
    }
  });

  test('Education keeps degree trajectory separate from parallel programmes and lazy course evidence is safe', async ({ page }) => {
    await bypassIntro(page);
    await page.goto('/#education');
    await page.waitForFunction(() => document.body.dataset.graphRoute === 'education');
    await page.waitForFunction(() => document.querySelectorAll('#site-graph [data-semantic-guide="education-trajectory"]').length === 1);
    await page.waitForTimeout(520);

    const [bsc, msc, esslli, prg] = await Promise.all([
      point(page, 'charles-university'), point(page, 'charles-university-masters-logic'), point(page, 'esslli'), point(page, 'prg-ai')
    ]);
    expect(bsc.x).toBeLessThan(msc.x);
    expect(bsc.y).toBeLessThan(msc.y);
    expect(esslli.y).toBeLessThan(msc.y);
    expect(esslli.y).toBeLessThan(prg.y);
    expect(prg.x).toBeGreaterThan(bsc.x);
    await expect(page.locator('#site-graph .site-graph-edges path.is-hierarchy')).toHaveCount(0);
    await expect(page.locator('#site-graph [data-semantic-guide="education-trajectory"] text')).toHaveCount(0);
    await expect(page.locator('#site-graph [data-semantic-guide="education-degree-continuation"] text')).toHaveCount(0);
    await expect(page.locator('#site-graph [data-semantic-guide^="education-credential-stem-"]')).toHaveCount(3);
    await expect(page.locator('#site-graph [data-semantic-guide="education-credential-shared-2024"]')).toHaveCount(1);
    await expect(page.locator('#site-graph .site-graph-node[data-node-id="credentials"]')).toHaveCount(0);
    await expect(page.locator('#site-graph .site-graph-node.is-semantic-degree')).toHaveCount(3);
    await expect(page.locator('#site-graph .site-graph-node.is-semantic-parallel-study')).toHaveCount(1);
    const [ethics, intro] = await Promise.all([point(page, 'cert-ethics-ai'), point(page, 'cert-intro-ai')]);
    expect(Math.abs(ethics.x - intro.x) + Math.abs(ethics.y - intro.y)).toBeGreaterThan(80);
    await expect(page.locator('[data-phase8-object="bsc-course-constellation"]')).toBeHidden();

    await expect(page.locator('#site-graph [data-semantic-guide="education-minor-branch"]')).toHaveCount(1);

    await page.goto('/#education/charles-university');
    await page.waitForFunction(() => Boolean(window.ProfilePhase8));
    const constellation = page.locator('[data-phase8-object="bsc-course-constellation"]');
    await expect(constellation).toBeVisible();
    await expect(constellation.locator('.phase8-bsc-cluster')).toHaveCount(4);
    await expect(constellation.locator('.phase8-bsc-overview-copy')).toContainText('Mathematical logic');
    await expect(constellation.locator('.phase8-bsc-cluster-description')).toHaveCount(4);
    await expect(constellation.locator('.phase8-bsc-cluster.is-active')).toHaveCount(0);
    const graphEvidence = page.locator('#site-graph .site-graph-evidence-object');
    await expect(graphEvidence).toHaveCount(4);
    await expect(graphEvidence).toHaveAttribute('data-thematic-node', 'bsc');
    for (let index = 0; index < 4; index += 1) {
      await expect(graphEvidence.nth(index).locator('.site-graph-evidence-hit')).toHaveAttribute('width', '220');
    }
    await expect(page.locator('#site-graph [data-semantic-guide="education-trajectory"]')).toHaveCount(0);
    await expect(graphEvidence.first()).toHaveAttribute('aria-label', /Verified completed coursework group/);
    const safety = await page.evaluate(() => window.SITE_DATA.semantics.education.courseEvidence
      .every(course => ['completed', 'recognized'].includes(course.status)));
    expect(safety).toBe(true);
    await expect(constellation.getByRole('button', { name: 'Open BSc thesis' })).toBeVisible();
    await expect(page.locator('.scene-detail')).toBeHidden();
    const collisionState = await page.evaluate(() => {
      const rect = selector => document.querySelector(selector)?.getBoundingClientRect()?.toJSON?.() || null;
      const intersects = (a, b) => Boolean(a && b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top);
      const panel = rect('[data-phase8-object="bsc-course-constellation"]');
      const routebar = rect('.graph-routebar');
      const quick = rect('.quick-overview-global-trigger:not([hidden])');
      const atlas = rect('.atlas-button');
      const root = rect('#site-graph .site-graph-node[data-node-id="stepan-chrast"]');
      const breadcrumb = rect('#graph-breadcrumb');
      return {
        panelGap: routebar && panel ? panel.top - routebar.bottom : null,
        panelQuick: intersects(panel, quick),
        panelAtlas: intersects(panel, atlas),
        rootBreadcrumb: intersects(root, breadcrumb),
        panelLayerZ: Number(getComputedStyle(document.querySelector('.phase8-semantic-layer')).zIndex || 0),
        routebarZ: Number(getComputedStyle(document.querySelector('.graph-routebar')).zIndex || 0)
      };
    });
    expect(collisionState.panelGap).not.toBeNull();
    expect(collisionState.panelGap).toBeGreaterThanOrEqual(12);
    expect(collisionState.panelQuick).toBe(false);
    expect(collisionState.panelAtlas).toBe(false);
    expect(collisionState.rootBreadcrumb).toBe(false);
    expect(collisionState.panelLayerZ).toBeGreaterThan(collisionState.routebarZ);
    await expect(page.locator('#graph-breadcrumb .graph-crumb').filter({ hasText: 'Education' })).toHaveAccessibleName('Return to Education overview');

    // All four SVG thematic nodes must respond to an ordinary pointer click,
    // keep the BSc route stable, and reveal their own description/details.
    const thematic = [
      ['Logic & metalogic', /Formal languages, semantics, proof systems/i],
      ['Mathematics & algebra', /Mathematical foundations supporting logic/i],
      ['Computing & data', /Programming, algorithms, relational databases/i],
      ['AI & philosophy', /Conceptual work around AI, cognition/i]
    ];
    for (let index = 0; index < thematic.length; index += 1) {
      await graphEvidence.nth(index).click();
      const active = constellation.locator('.phase8-bsc-cluster.is-active');
      await expect(active).toHaveCount(1);
      await expect(active).toContainText(thematic[index][0]);
      await expect(active.locator('.phase8-bsc-cluster-detail')).toBeVisible();
      await expect(active.locator('.phase8-bsc-cluster-description')).toBeVisible();
      await expect(active.locator('.phase8-bsc-cluster-description')).toContainText(thematic[index][1]);
      await expect(graphEvidence.nth(index)).toHaveClass(/is-evidence-active/);
      await expect(page).toHaveURL(/#education\/charles-university$/);
    }

    // Keyboard activation retains the same contract and restores focus.
    await graphEvidence.first().focus();
    await page.keyboard.press('Enter');
    await expect(constellation.locator('.phase8-bsc-cluster.is-active')).toContainText('Logic & metalogic');
    await expect(page).toHaveURL(/#education\/charles-university$/);
  });

  test('mobile replaces both semantic backbones with vertical alternatives', async ({ page }) => {
    await bypassIntro(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/#education');
    await page.waitForFunction(() => document.body.dataset.graphRoute === 'education');
    await page.waitForFunction(() => document.querySelectorAll('#site-graph [data-semantic-guide="education-trajectory"]').length === 1);
    const [bsc, msc] = await Promise.all([point(page, 'charles-university'), point(page, 'charles-university-masters-logic')]);
    expect(Math.abs(bsc.x - msc.x)).toBeGreaterThan(80);
    expect(bsc.y).toBeLessThan(msc.y);

    await page.goto('/#education/charles-university');
    await page.waitForFunction(() => document.body.dataset.graphRoute === 'education/charles-university');
    await page.waitForFunction(() => document.querySelector('[data-phase8-object="bsc-course-constellation"]')?.dataset.sceneVisible === 'true');
    const viewport = await page.evaluate(() => ({ scrollWidth: document.scrollingElement.scrollWidth, innerWidth }));
    expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.innerWidth + 2);
  });

  test('returning from a BSc knowledge link restores one clean local BSc scene', async ({ page }) => {
    await bypassIntro(page);
    await page.goto('/#education/charles-university');
    await page.waitForFunction(() => document.body.dataset.graphRoute === 'education/charles-university');
    const constellation = page.locator('[data-phase8-object="bsc-course-constellation"]');
    await expect(constellation).toBeVisible();
    await constellation.getByRole('button', { name: 'Dynamic Logic' }).click();
    await page.waitForFunction(() => document.body.dataset.graphRoute.endsWith('/dynamic-logic'));

    await page.locator('button.crosslink-return-control').click();
    await page.waitForFunction(() => document.body.dataset.graphRoute === 'education/charles-university');
    await expect(page.locator('#site-graph [data-semantic-guide="education-trajectory"]')).toHaveCount(0);
    await expect(page.locator('#site-graph .site-graph-evidence-object')).toHaveCount(4);
    await expect(constellation.locator('.phase8-bsc-cluster')).toHaveCount(4);
  });

  test('MSc remains an explicit ongoing programme until completed evidence exists', async ({ page }) => {
    await bypassIntro(page);
    await page.goto('/#education/msc-logic');
    await page.waitForFunction(() => document.body.dataset.graphRoute === 'education/charles-university-masters-logic');
    await page.waitForFunction(() => Boolean(window.ProfilePhase8));
    const context = page.locator('[data-phase8-object="msc-programme-context"]');
    await expect(context).toBeVisible();
    await expect(context).toContainText('ongoing');
    await expect(context.locator('.phase8-bsc-cluster')).toHaveCount(0);
  });

  test('semantic fragments pan as a local camera and keep the Experience rail compact', async ({ page }) => {
    await bypassIntro(page);
    await page.goto('/#education');
    await page.waitForFunction(() => document.body.dataset.graphRoute === 'education');
    const svg = page.locator('#site-graph .site-graph-svg');
    const box = await svg.boundingBox();
    const camera = page.locator('#site-graph .site-graph-svg > g').first();
    await expect(camera).toHaveAttribute('transform', 'translate(0.00 0.00)');
    await page.mouse.move(box.x + box.width * .72, box.y + box.height * .78);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * .78, box.y + box.height * .70, { steps: 3 });
    await page.mouse.up();
    await expect(camera).not.toHaveAttribute('transform', 'translate(0.00 0.00)');

    await page.goto('/#experience');
    await page.waitForFunction(() => Boolean(window.ProfilePhase8));
    const rail = page.locator('[data-phase8-object="experience-timeline"]');
    await expect(rail).toBeHidden();
  });
});
