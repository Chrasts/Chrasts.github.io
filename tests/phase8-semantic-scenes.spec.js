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

test('Phase 8 turns Experience into a stable chronological timeline object', async ({ page }) => {
  await bypassIntro(page);
  await page.goto('/#experience');
  await waitPhase8(page);

  const timeline = page.locator('[data-phase8-object="experience-timeline"]');
  await expect(timeline).toBeVisible();
  await expect(timeline.locator('.phase8-experience-item')).toHaveCount(3);

  const labels = await timeline.locator('.phase8-experience-item').evaluateAll(items =>
    items.map(item => [
      item.dataset.nodeId,
      item.querySelector('.phase8-experience-meta')?.textContent,
      item.querySelector('.phase8-experience-role')?.textContent
    ])
  );
  expect(labels.map(item => item[0])).toEqual(['escape-room', 'student-ball', 'ceske-priority']);
  expect(labels[0][1]).toContain('2019');
  expect(labels[2][1]).toContain('present');
});

test('Phase 8 exposes coursework as a real document object backed by the artifact registry', async ({ page }) => {
  await bypassIntro(page);
  await page.goto('/#education/charles-university/coursework/simulation-credence');
  await waitPhase8(page);

  const shelf = page.locator('[data-phase8-object="coursework-documents"]');
  await expect(shelf).toBeVisible();
  await expect(shelf).toHaveClass(/is-document-focus/);
  await expect(shelf.locator('.phase8-document-title')).toContainText('Simulation Credence and Its Consequences');
  await expect(shelf.locator('a[href="assets/documents/education/coursework/simulation-credence-and-its-consequences.pdf"]')).toBeVisible();
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
  await expect(timetable.locator('.phase8-course-cell')).toHaveCount(6);
  await expect(timetable).toContainText('Introduction to SAT and SMT Solving');
  const computationalLinks = timetable.locator('[data-route="knowledge/logic-math/mathematical-logic/computational-logic"]');
  expect(await computationalLinks.count()).toBeGreaterThan(0);
  await expect(computationalLinks.first()).toBeVisible();
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