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

test.describe('Intro motion polish', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('Enter profile is a single stronger gateway with a clear hover response', async ({ page }) => {
    await freshIntro(page);
    await page.goto('/#overview');
    await page.waitForFunction(() => window.ProfileIntro?.snapshot().stage === 'atlas' && window.ProfileIntro.snapshot().waiting);
    await page.waitForFunction(() => Boolean(window.ProfileMotionPolish));

    const enter = page.locator('.profile-intro-enter');
    await expect(enter).toBeVisible();
    await expect(enter.locator('small')).toHaveCount(0);
    await expect(enter).toHaveText(/Enter profile/i);
    await expect(enter).not.toContainText(/Condense the Atlas/i);
    await expect(enter).toHaveAttribute('aria-label', 'Enter profile');

    const before = await enter.evaluate(element => ({
      color: getComputedStyle(element).color,
      transform: getComputedStyle(element).transform,
      outerColor: getComputedStyle(element, '::after').borderTopColor,
      outerWidth: parseFloat(getComputedStyle(element, '::after').borderTopWidth)
    }));
    expect(before.outerWidth).toBeGreaterThanOrEqual(1.5);

    await enter.hover();
    await page.waitForTimeout(160);
    const after = await enter.evaluate(element => ({
      color: getComputedStyle(element).color,
      transform: getComputedStyle(element).transform,
      outerColor: getComputedStyle(element, '::after').borderTopColor
    }));
    expect(after.color).not.toBe(before.color);
    expect(after.transform).not.toBe(before.transform);
    expect(after.outerColor).not.toBe(before.outerColor);
  });

  test('final condensation removes converging labels and morphs the root into the portrait', async ({ page }) => {
    await freshIntro(page);
    await page.goto('/#overview');
    await page.waitForFunction(() => window.ProfileIntro?.snapshot().stage === 'atlas' && window.ProfileIntro.snapshot().waiting);
    await page.locator('.profile-intro-enter').click();

    await page.waitForSelector('.profile-intro-overlay.is-root-merge[data-stage="root"]', { timeout: 8_000 });
    await page.waitForTimeout(190);
    const rootMerge = await page.evaluate(() => {
      const labels = [...document.querySelectorAll(
        '.profile-intro-overlay .site-graph-node:not([data-intro-tier="root"]) .site-graph-label, ' +
        '.profile-intro-overlay .site-graph-node:not([data-intro-tier="root"]) .site-graph-meta'
      )];
      return labels.filter(label => {
        const style = getComputedStyle(label);
        return style.visibility !== 'hidden' && Number(style.opacity) > 0.02;
      }).length;
    });
    expect(rootMerge).toBe(0);

    await page.waitForFunction(() => window.ProfileIntro?.snapshot().stage === 'identity', null, { timeout: 8_000 });
    await expect(page.locator('.profile-intro-overlay')).toHaveClass(/is-root-morphing/);
    await expect(page.locator('.profile-intro-identity')).toBeVisible();
    await page.waitForFunction(() => window.ProfileMotionPolish?.snapshot().introMorphComplete === true, null, { timeout: 2_000 });

    const stackedAtIdentity = await page.evaluate(() => [...document.querySelectorAll(
      '.profile-intro-overlay .site-graph-node:not([data-intro-tier="root"]) .site-graph-label'
    )].filter(label => {
      const style = getComputedStyle(label);
      return style.visibility !== 'hidden' && Number(style.opacity) > 0.02;
    }).length);
    expect(stackedAtIdentity).toBe(0);
  });
});

test.describe('Structural transition motion polish', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('clicked Work remains selected for the whole Overview -> Work transition', async ({ page }) => {
    await bypassIntro(page);
    await page.goto('/#overview');
    await page.waitForFunction(() => Boolean(window.ProfileRootLanding && window.ProfileMotionPolish));
    await page.evaluate(() => window.ProfileRootLanding.activate({ focusGraph: false }));
    await page.waitForFunction(() => document.body.dataset.globalGeometry === 'radial-overview');

    await page.locator('#site-graph .site-graph-node[data-node-id="work"]').click();
    await page.waitForFunction(() => document.body.classList.contains('is-v9-transitioning'));

    const overlayWork = page.locator('#site-graph .v9-transition-overlay .site-graph-node[data-node-id="work"]');
    await expect(overlayWork).toHaveClass(/is-selected/);
    await expect(overlayWork).toHaveAttribute('data-transition-focus', 'true');
    const midStroke = await overlayWork.locator('.site-graph-dot').evaluate(dot => getComputedStyle(dot).stroke);
    await page.waitForTimeout(360);
    await expect(overlayWork).toHaveClass(/is-selected/);
    expect(await overlayWork.locator('.site-graph-dot').evaluate(dot => getComputedStyle(dot).stroke)).toBe(midStroke);

    await page.waitForFunction(() => !document.body.classList.contains('is-v9-transitioning'), null, { timeout: 5_000 });
    const liveWork = page.locator('#site-graph .site-graph-node[data-node-id="work"]');
    await expect(liveWork).toHaveClass(/is-selected/);
    expect(await liveWork.locator('.site-graph-dot').evaluate(dot => getComputedStyle(dot).stroke)).toBe(midStroke);
  });

  test('persistent labels interpolate their local placement during fragment travel', async ({ page }) => {
    await bypassIntro(page);
    await page.goto('/#knowledge');
    await page.waitForFunction(() => document.body.dataset.graphRoute === 'knowledge' && Boolean(window.ProfileMotionPolish));

    await page.locator('#site-graph .site-graph-node[data-node-id="logic-math"]').click();
    await page.waitForFunction(() => document.body.classList.contains('is-v9-transitioning'));
    await page.waitForSelector('#site-graph .v9-transition-overlay .site-graph-node[data-node-id="knowledge"] .site-graph-label[data-motion-label="true"]', { timeout: 2_500 });

    const label = page.locator('#site-graph .v9-transition-overlay .site-graph-node[data-node-id="knowledge"] .site-graph-label');
    const delta = await label.evaluate(element => ({
      dx: Number(element.dataset.motionTargetDx),
      dy: Number(element.dataset.motionTargetDy),
      transform: element.getAttribute('transform') || ''
    }));
    expect(Math.abs(delta.dx) + Math.abs(delta.dy)).toBeGreaterThan(1);

    await page.waitForTimeout(220);
    const moved = await label.getAttribute('transform');
    expect(moved).not.toBe(delta.transform);

    await page.waitForFunction(() => !document.body.classList.contains('is-v9-transitioning'), null, { timeout: 5_000 });
    await expect(page.locator('#site-graph .site-graph-node[data-node-id="logic-math"]')).toHaveClass(/is-selected/);
  });
});
