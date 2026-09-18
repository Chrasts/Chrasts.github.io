const { test, expect } = require('@playwright/test');

const bypassIntro = async page => {
  await page.addInitScript(() => sessionStorage.setItem('profileIntroSeen', 'true'));
  await page.route('https://cloud.umami.is/**', route => route.abort()).catch(() => {});
};

const waitPhase8 = async page => {
  await page.waitForFunction(() => Boolean(window.ProfilePhase8 && window.ProfileArtifacts));
  await page.waitForFunction(() => !document.body.classList.contains('is-v9-transitioning'));
  await page.waitForTimeout(120);
};

test('Phase 8 keeps redundant Experience timeline detail out of overview and focus states', async ({ page }) => {
  await bypassIntro(page);
  await page.goto('/#experience');
  await waitPhase8(page);

  const timeline = page.locator('[data-phase8-object="experience-timeline"]');
  await expect(timeline).toBeHidden();
  await page.goto('/#experience/escape-room');
  await waitPhase8(page);
  await expect(timeline).toBeHidden();
});

test('Phase 8 certificate stack keeps every credential directly selectable', async ({ page }) => {
  await bypassIntro(page);
  await page.goto('/#education/credentials');
  await waitPhase8(page);

  const stack = page.locator('[data-phase8-object="certificate-stack"]');
  await expect(stack).toBeVisible();
  await expect(stack.locator('.phase8-certificate-paper')).toHaveCount(3);

  const ethics = stack.locator('.phase8-certificate-paper[data-artifact-id="ethics-ai-certificate"]');
  const intro = stack.locator('.phase8-certificate-paper[data-artifact-id="introduction-ai-certificate"]');
  const cambridge = stack.locator('.phase8-certificate-paper[data-artifact-id="cambridge-b2-certificate"]');

  await ethics.click();
  await expect(ethics).toHaveClass(/is-active/);
  await expect(stack.locator('.phase8-certificate-inspector')).toContainText('Ethics of AI');
  await expect(stack.locator('a[href="https://certificates.mooc.fi/validate/reryypwawai"]')).toBeVisible();

  await intro.click();
  await expect(intro).toHaveClass(/is-active/);
  await expect(stack.locator('.phase8-certificate-inspector')).toContainText('Introduction to Artificial Intelligence');

  await cambridge.click();
  await expect(cambridge).toHaveClass(/is-active/);
  await expect(stack.locator('.phase8-certificate-inspector')).toContainText('B2 First');
});

test('Phase 8 ESSLLI scene renders the selected timetable and semantic topic links', async ({ page }) => {
  await bypassIntro(page);
  await page.goto('/#education/esslli');
  await waitPhase8(page);

  const timetable = page.locator('[data-phase8-object="esslli-timetable"]');
  await expect(timetable).toBeVisible();
  await expect(timetable.locator('.phase8-timetable-week')).toHaveCount(2);
  // Only five attended/selected ESSLLI sessions are currently canonical.
  // Keep this conservative instead of inventing a sixth course for layout.
  await expect(timetable.locator('.phase8-course-cell')).toHaveCount(5);
  await expect(timetable).toContainText('Introduction to SAT and SMT Solving');
  await expect(page.locator('body')).toContainText('Compact record of the selected programme.');
  await expect(page.locator('body')).not.toContainText('Links point only to broader knowledge areas retained in the portfolio.');
  await expect(page.locator('body')).not.toContainText('Sessions are education context, not automatic claims of standalone expertise.');
  const computationalLinks = timetable.locator('[data-route="knowledge/logic-math/mathematical-logic/computational-logic"]');
  expect(await computationalLinks.count()).toBeGreaterThan(0);
  await expect(computationalLinks.first()).toBeVisible();
});

test('BSc thesis uses cross-section return history instead of losing Education context', async ({ page }) => {
  await bypassIntro(page);
  await page.goto('/#education/charles-university');
  await waitPhase8(page);

  await page.getByRole('button', { name: 'Open BSc thesis' }).click();
  await page.waitForFunction(() => document.body.dataset.graphRoute === 'work/project/bachelor-thesis');
  await page.waitForFunction(() => window.ProfileCrossLinkTravel?.snapshot?.().result === 'completed');
  await expect(page.getByRole('button', { name: /Return to Bachelor/i })).toBeVisible();

  await page.keyboard.press('Control+Z');
  await page.waitForFunction(() => document.body.dataset.graphRoute === 'education/charles-university');
  await page.waitForFunction(() => window.ProfileCrossLinkTravel?.snapshot?.().result === 'completed');
  expect((await page.evaluate(() => window.ProfileCrossLinkTravel.snapshot())).history).toHaveLength(0);
});

test('Phase 8 mobile semantic tray stays inside the viewport without document scroll', async ({ page }) => {
  await bypassIntro(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#education/credentials');
  await waitPhase8(page);

  const stack = page.locator('[data-phase8-object="certificate-stack"]');
  await expect(stack).toBeVisible();
  await expect(stack).toHaveAttribute('data-scene-placement', 'semantic-mobile-tray');

  const metrics = await page.evaluate(() => ({
    scrollHeight: document.scrollingElement.scrollHeight,
    viewportHeight: innerHeight,
    scrollY: scrollY
  }));
  expect(metrics.scrollHeight).toBeLessThanOrEqual(metrics.viewportHeight + 2);
  expect(metrics.scrollY).toBe(0);
});
