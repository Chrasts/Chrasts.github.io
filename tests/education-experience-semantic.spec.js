const { test, expect } = require('@playwright/test');

const bypassIntro = async page => {
  await page.addInitScript(() => sessionStorage.setItem('profileIntroSeen', 'true'));
  await page.route('https://cloud.umami.is/**', route => route.abort()).catch(() => {});
};

const point = (page, id) => page.locator(`#site-graph .site-graph-node[data-node-id="${id}"]`).evaluate(node => ({
  x: Number(node.dataset.x), y: Number(node.dataset.y)
}));

test.describe('Education and Experience semantic geometry', () => {
  test('Experience has deterministic chronological geometry and reveals only canonical related Work on role focus', async ({ page }) => {
    await bypassIntro(page);
    await page.goto('/#experience');
    await page.waitForFunction(() => document.body.dataset.graphRoute === 'experience');
    await page.waitForFunction(() => document.querySelectorAll('#site-graph [data-semantic-guide="experience-axis"]').length === 1);

    const positions = await Promise.all(['escape-room', 'student-ball', 'ceske-priority'].map(id => point(page, id)));
    expect(positions[0].x).toBeLessThan(positions[1].x);
    expect(positions[1].x).toBeLessThan(positions[2].x);
    await expect(page.locator('#site-graph [data-semantic-guide="experience-present"]')).toHaveCount(1);
    await expect(page.locator('#site-graph [data-semantic-guide="experience-duration-ceske-priority"] .is-current')).toHaveCount(1);

    await page.goto('/#experience/ceske-priority');
    await page.waitForFunction(() => document.body.dataset.graphRoute === 'experience/ceske-priority');
    const live = '#site-graph .site-graph-svg > g:not(.v9-transition-overlay)';
    await expect(page.locator(`${live} .site-graph-node[data-node-id="project-social-workers-survey"]`)).toBeVisible();
    await expect(page.locator(`${live} .site-graph-node[data-node-id="project-tachov-workshop"]`)).toBeVisible();
    await expect(page.locator(`${live} .site-graph-edges path.is-role-project`)).toHaveCount(2);
    await page.waitForFunction(() => Boolean(window.ProfilePhase8));
    const inspector = page.locator('[data-phase8-object="experience-current-role"]');
    await expect(inspector).toBeVisible();
    await expect(inspector).toContainText('Organisation');
    await expect(inspector).toContainText('Related Work');

    // The semantic inspector is built after the initial page boot. Its
    // controls must still be live native route controls, and related Work
    // should use the same semantic travel/history as the graph relation.
    const relatedWork = inspector.getByRole('button', { name: /Social Workers Survey Analysis/i });
    await expect(relatedWork).toHaveAttribute('data-crosslink-target', 'project-social-workers-survey');
    await relatedWork.click();
    await page.waitForFunction(() => document.body.dataset.graphRoute === 'work/project/social-workers-survey');
    await page.waitForFunction(() => window.ProfileCrossLinkTravel.snapshot().result === 'completed');
    expect(await page.evaluate(() => window.ProfileCrossLinkTravel.snapshot().canReturn)).toBe(true);
  });

  test('Education keeps degree trajectory separate from parallel programmes and lazy course evidence is safe', async ({ page }) => {
    await bypassIntro(page);
    await page.goto('/#education');
    await page.waitForFunction(() => document.body.dataset.graphRoute === 'education');
    await page.waitForFunction(() => document.querySelectorAll('#site-graph [data-semantic-guide="education-trajectory"]').length === 1);

    const [bsc, msc, esslli, prg] = await Promise.all([
      point(page, 'charles-university'), point(page, 'charles-university-masters-logic'), point(page, 'esslli'), point(page, 'prg-ai')
    ]);
    expect(bsc.x).toBeLessThan(msc.x);
    expect(esslli.y).toBeLessThan(bsc.y);
    expect(prg.y).toBeGreaterThan(msc.y);
    await expect(page.locator('[data-phase8-object="bsc-course-constellation"]')).toBeHidden();

    await page.goto('/#education/charles-university');
    await page.waitForFunction(() => Boolean(window.ProfilePhase8));
    const constellation = page.locator('[data-phase8-object="bsc-course-constellation"]');
    await expect(constellation).toBeVisible();
    await expect(constellation.locator('.phase8-bsc-cluster')).toHaveCount(4);
    const graphEvidence = page.locator('#site-graph .site-graph-evidence-object');
    await expect(graphEvidence).toHaveCount(4);
    await expect(graphEvidence.first()).toHaveAttribute('aria-label', /completed course evidence/);
    const safety = await page.evaluate(() => window.SITE_DATA.semantics.education.courseEvidence
      .every(course => ['completed', 'recognized'].includes(course.status)));
    expect(safety).toBe(true);
    await expect(constellation.getByRole('button', { name: 'Open BSc thesis' })).toBeVisible();

    // SVG evidence is a real keyboard control and returns focus to a live
    // graph node after it replaces the BSc route.
    await graphEvidence.first().focus();
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.body.dataset.graphRoute.startsWith('knowledge/'));
    await page.waitForFunction(() => document.activeElement?.matches('#site-graph .site-graph-node[data-node-id]'));
  });

  test('mobile replaces both semantic backbones with vertical alternatives', async ({ page }) => {
    await bypassIntro(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/#education');
    await page.waitForFunction(() => document.body.dataset.graphRoute === 'education');
    await page.waitForFunction(() => document.querySelectorAll('#site-graph [data-semantic-guide="education-trajectory"]').length === 1);
    const [bsc, msc] = await Promise.all([point(page, 'charles-university'), point(page, 'charles-university-masters-logic')]);
    expect(Math.abs(bsc.x - msc.x)).toBeLessThan(2);
    expect(bsc.y).toBeLessThan(msc.y);

    await page.goto('/#education/charles-university');
    await page.waitForFunction(() => document.body.dataset.graphRoute === 'education/charles-university');
    await page.waitForFunction(() => document.querySelector('[data-phase8-object="bsc-course-constellation"]')?.dataset.sceneVisible === 'true');
    const viewport = await page.evaluate(() => ({ scrollWidth: document.scrollingElement.scrollWidth, innerWidth }));
    expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.innerWidth + 2);
  });

  test('MSc remains an explicit ongoing programme until completed evidence exists', async ({ page }) => {
    await bypassIntro(page);
    await page.goto('/#education/msc-logic');
    await page.waitForFunction(() => document.body.dataset.graphRoute === 'education/charles-university-masters-logic');
    await page.waitForFunction(() => Boolean(window.ProfilePhase8));
    const context = page.locator('[data-phase8-object="msc-programme-context"]');
    await expect(context).toBeVisible();
    await expect(context).toContainText('ongoing');
    await expect(context).toContainText('completed or recognized');
    await expect(context.locator('.phase8-bsc-cluster')).toHaveCount(0);
  });
});
