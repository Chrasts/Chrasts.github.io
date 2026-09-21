const { test, expect } = require('@playwright/test');

test('CV entry offers academic and data-analysis variants before rendering a résumé', async ({ page }) => {
  await page.goto('/cv/');

  await expect(page.getByRole('heading', { level: 1, name: 'Choose CV' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Academic CV/ })).toHaveAttribute('href', '?view=academic');
  await expect(page.getByRole('link', { name: /Data Analysis CV/ })).toHaveAttribute('href', '?view=data-analysis');
  await expect(page.getByRole('button', { name: 'Print / Save PDF' })).toBeHidden();
  await expect(page.locator('.cv-section-projects')).toHaveCount(0);
});

test('data-analysis CV is compact and contains only data-relevant selected projects', async ({ page }) => {
  await page.goto('/cv/?view=data-analysis');

  await expect(page.getByRole('heading', { level: 1, name: 'Štěpán Chrast' })).toBeVisible();
  await expect(page.getByText('Data analysis · Applied research · Reproducible workflows')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Selected Projects' })).toBeVisible();

  await expect(page.getByRole('heading', { name: 'Survey Analysis and Open-Text Coding' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Insolvency Analysis' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Film Scene Character Splitter' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Algebraic Logic SQL Schema' })).toBeVisible();

  await expect(page.getByRole('heading', { name: 'Bachelor Thesis - Quantum Logic & A-ROL' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: /A-ROL Lab/ })).toHaveCount(0);
  await expect(page.locator('.cv-section-projects > .cv-item')).toHaveCount(4);
  await expect(page.locator('.cv-section-experience > .cv-item')).toHaveCount(1);

  const cvText = await page.locator('#cv-content').innerText();
  expect(cvText).not.toContain('Event coordination and logistics');
  expect(cvText).not.toContain('Research Practice');
  expect(cvText).not.toContain(';');
  expect(cvText).not.toContain('—');
  expect(cvText).toContain('analysis of vignette responses');
  expect(cvText).toContain('visualisation');

  await expect(page.locator('.cv-section-areas')).toContainText('Data Analysis');
  await expect(page.locator('.cv-section-areas')).toContainText('Data Validation & QA');
  await expect(page.locator('.cv-section-areas')).not.toContainText('Universal Algebra');

  await expect(page.getByRole('button', { name: 'Print / Save PDF' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'CV versions' })).toBeVisible();
});

test('academic CV foregrounds logic and research projects while keeping shared education and credentials', async ({ page }) => {
  await page.goto('/cv/?view=academic');

  await expect(page.getByText('Mathematical logic · Algebraic logic · Research')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Bachelor Thesis - Quantum Logic & A-ROL' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /A-ROL Lab/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'The Congruence Lattice Problem - Historical Survey' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Modal Logic Lab' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Play' })).toHaveAttribute('href', 'https://chrasts.github.io/Modal_Logic_Lab/');

  await expect(page.getByRole('heading', { name: 'Survey Analysis and Open-Text Coding' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Insolvency Analysis' })).toHaveCount(0);
  await expect(page.locator('.cv-section-projects > .cv-item')).toHaveCount(4);
  await expect(page.locator('.cv-section-experience > .cv-item')).toHaveCount(1);

  await expect(page.locator('.cv-section-areas')).toContainText('Mathematical Logic');
  await expect(page.locator('.cv-section-areas')).toContainText('Universal Algebra');
  await expect(page.locator('.cv-section-areas')).not.toContainText('Survey Analysis');

  await expect(page.getByRole('heading', { name: 'Certifications' })).toBeVisible();
  await expect(page.locator('.cv-section-certifications')).toContainText('Ethics of AI');
  await expect(page.locator('.cv-section-certifications')).toContainText('Introduction to Artificial Intelligence');
  await expect(page.locator('.cv-section-certifications')).toContainText('B2 First');

  const education = await page.locator('.cv-section-education > .cv-item h3').allTextContents();
  expect(education.at(-1)).toContain('ESSLLI 2026');
});

test('focused CV keeps the established compact graph-native visual language', async ({ page }) => {
  await page.goto('/cv/?view=data-analysis');

  const nameSize = await page.getByRole('heading', { level: 1, name: 'Štěpán Chrast' })
    .evaluate(element => parseFloat(getComputedStyle(element).fontSize));
  expect(nameSize).toBeLessThanOrEqual(21);

  const cvFont = await page.locator('body').evaluate(element => getComputedStyle(element).fontFamily);
  expect(cvFont).toContain('Recursive');
  const cvBackground = await page.locator('body').evaluate(element => getComputedStyle(element).backgroundColor);
  expect(cvBackground).not.toBe('rgb(255, 255, 255)');

  const sectionHeading = await page.locator('.cv-section > h2').first().evaluate(element => ({
    beforeContent: getComputedStyle(element, '::before').content,
    afterContent: getComputedStyle(element, '::after').content,
    paddingLeft: parseFloat(getComputedStyle(element).paddingLeft)
  }));
  expect(['none', 'normal', '""']).toContain(sectionHeading.beforeContent);
  expect(['none', 'normal', '""']).toContain(sectionHeading.afterContent);
  expect(sectionHeading.paddingLeft).toBe(0);

  const areas = await page.locator('.cv-area-list-compact').innerText();
  expect(areas).toContain(',');

  const positioningColor = await page.locator('.cv-positioning').evaluate(element => getComputedStyle(element).color);
  const linkColor = await page.locator('.cv-contact a').first().evaluate(element => getComputedStyle(element).color);
  expect(positioningColor).not.toBe(linkColor);
});

test('focused CV separates sections and entries with restrained structural rules', async ({ page }) => {
  await page.goto('/cv/?view=data-analysis');

  const sectionStyle = await page.locator('.cv-section-projects').evaluate(element => ({
    borderTopWidth: parseFloat(getComputedStyle(element).borderTopWidth),
    borderTopColor: getComputedStyle(element).borderTopColor
  }));
  expect(sectionStyle.borderTopWidth).toBeGreaterThan(0);
  expect(sectionStyle.borderTopColor).not.toBe('rgba(0, 0, 0, 0)');

  const itemStyle = await page.locator('.cv-section-projects > .cv-item').first().evaluate(element => ({
    borderLeftWidth: parseFloat(getComputedStyle(element).borderLeftWidth),
    backgroundColor: getComputedStyle(element).backgroundColor,
    paddingLeft: parseFloat(getComputedStyle(element).paddingLeft)
  }));
  expect(itemStyle.borderLeftWidth).toBeGreaterThan(0);
  expect(itemStyle.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
  expect(itemStyle.paddingLeft).toBeGreaterThanOrEqual(13);
});

test('only top CV utilities retain the node-link hover motif', async ({ page }) => {
  await page.goto('/cv/?view=academic');

  const staticSurfaces = await page.evaluate(() => {
    const header = document.querySelector('.cv-header');
    const sectionHeading = document.querySelector('.cv-section > h2');
    const areaItem = document.querySelector('.cv-area-list-compact li');
    const read = element => ({
      before: getComputedStyle(element, '::before').content,
      after: getComputedStyle(element, '::after').content
    });
    return {
      header: read(header),
      sectionHeading: read(sectionHeading),
      areaItem: read(areaItem)
    };
  });

  for (const surface of Object.values(staticSurfaces)) {
    expect(['none', 'normal', '""']).toContain(surface.before);
  }
  expect(staticSurfaces.areaItem.after).not.toBe('none');

  const toolbar = page.getByRole('link', { name: 'Interactive portfolio' });
  const toolbarPseudo = await toolbar.evaluate(element => ({
    before: getComputedStyle(element, '::before').content,
    after: getComputedStyle(element, '::after').content
  }));
  expect(toolbarPseudo.before).not.toBe('none');
  expect(toolbarPseudo.after).not.toBe('none');
});

test('CV top utilities expose visible graph-native hover feedback', async ({ page }) => {
  await page.goto('/cv/?view=data-analysis');
  const portfolio = page.getByRole('link', { name: 'Interactive portfolio' });
  const print = page.getByRole('button', { name: 'Print / Save PDF' });

  const before = await portfolio.evaluate(element => ({
    transform: getComputedStyle(element).transform,
    nodeBackground: getComputedStyle(element, '::before').backgroundColor
  }));
  await portfolio.hover();
  const after = await portfolio.evaluate(element => ({
    transform: getComputedStyle(element).transform,
    nodeBackground: getComputedStyle(element, '::before').backgroundColor
  }));
  expect(after.transform).not.toBe(before.transform);
  expect(after.nodeBackground).not.toBe(before.nodeBackground);

  await print.hover();
  expect(await print.evaluate(element => getComputedStyle(element).transform)).not.toBe('none');
});

test('CV section headings sit above a wide multi-column body', async ({ page }) => {
  await page.goto('/cv/?view=data-analysis');
  const section = page.locator('.cv-section-projects');
  const heading = section.locator(':scope > h2');
  const first = section.locator(':scope > .cv-item').first();
  const second = section.locator(':scope > .cv-item').nth(1);
  const h = await heading.boundingBox();
  const a = await first.boundingBox();
  const b = await second.boundingBox();
  expect(a.y).toBeGreaterThan(h.y + h.height - 1);
  expect(Math.abs(a.y - b.y)).toBeLessThan(8);
});
