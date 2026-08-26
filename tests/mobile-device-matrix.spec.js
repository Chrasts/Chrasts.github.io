const { test, expect } = require('@playwright/test');

const devices = [
  { name: 'small-phone', width: 375, height: 667 },
  { name: 'baseline-phone', width: 390, height: 844 },
  { name: 'wide-android', width: 412, height: 915 },
  { name: 'large-phone', width: 430, height: 932 },
  { name: 'phone-landscape', width: 844, height: 390 }
];

const bypassIntro = async page => {
  await page.addInitScript(() => sessionStorage.setItem('profileIntroSeen', 'true'));
  await page.route('https://cloud.umami.is/**', route => route.abort()).catch(() => {});
};

const waitMobile = async page => {
  await page.waitForFunction(() => Boolean(window.ProfileScene && window.MobileProfileScene));
  await page.waitForFunction(() => !document.body.classList.contains('is-v9-transitioning'));
  await page.waitForTimeout(180);
};

const viewportHealth = () => ({
  scrollWidth: document.scrollingElement.scrollWidth,
  innerWidth,
  scrollX,
  runtime: Boolean(window.MobileProfileScene),
  variant: window.ProfileScene?.manager?.variant,
  duplicateNodeIds: window.ProfilePhase0?.checkGraphInvariants?.().duplicateNodeIds || [],
  orphanEdgeCount: window.ProfilePhase0?.checkGraphInvariants?.().orphanEdgeCount || 0
});

const expectHealthy = async page => {
  const state = await page.evaluate(viewportHealth);
  expect(state.runtime).toBe(true);
  expect(state.variant).toBe('mobile');
  expect(state.scrollWidth).toBeLessThanOrEqual(state.innerWidth + 2);
  expect(Math.abs(state.scrollX)).toBeLessThanOrEqual(1);
  expect(state.duplicateNodeIds).toEqual([]);
  expect(state.orphanEdgeCount).toBe(0);
};

for (const device of devices) {
  test.describe(`mobile viewport: ${device.name}`, () => {
    test.use({ viewport: { width: device.width, height: device.height }, hasTouch: true });

    test('keeps Overview, Work, Focus and Atlas structurally healthy', async ({ page }) => {
      await bypassIntro(page);
      for (const route of ['overview', 'work', 'knowledge', 'atlas']) {
        await page.goto(`/#${route}`);
        await waitMobile(page);
        await expectHealthy(page);
      }
    });
  });
}

test.describe('mobile ergonomics contract', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('primary mobile HTML controls expose practical touch targets', async ({ page }) => {
    await bypassIntro(page);
    await page.goto('/#work');
    await waitMobile(page);

    await page.locator('.mobile-mode-button').click();
    await expect(page.locator('.mobile-control-sheet')).toHaveClass(/is-open/);

    const undersized = await page.evaluate(() => {
      const selectors = [
        '.mobile-graph-dock button',
        '.mobile-sheet-close',
        '.mobile-control-sheet button',
        '.mobile-control-sheet label'
      ];
      return [...document.querySelectorAll(selectors.join(','))]
        .filter(element => {
          const style = getComputedStyle(element);
          if (style.display === 'none' || style.visibility === 'hidden') return false;
          const rect = element.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 && (rect.width < 42 || rect.height < 42);
        })
        .map(element => ({
          tag: element.tagName,
          className: element.className,
          text: element.textContent.trim().slice(0, 40),
          rect: element.getBoundingClientRect().toJSON()
        }));
    });
    expect(undersized).toEqual([]);
  });

  test('Atlas inspector remains usable without horizontal document overflow', async ({ page }) => {
    await bypassIntro(page);
    await page.goto('/#atlas');
    await waitMobile(page);
    const node = page.locator('#site-graph .site-graph-node[data-node-id="knowledge"]');
    await node.tap();
    await expect(page.locator('#site-detail-panel')).toBeVisible();
    await expect(page.locator('#site-detail-panel .atlas-open-local')).toBeVisible();
    await expectHealthy(page);
  });
});

test.describe('desktop isolation guard', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('mobile runtime and mobile stylesheet do not activate on desktop', async ({ page }) => {
    await bypassIntro(page);
    await page.goto('/#overview');
    await page.waitForFunction(() => Boolean(window.ProfileScene));
    await page.waitForTimeout(250);
    const state = await page.evaluate(() => ({
      runtime: Boolean(window.MobileProfileScene),
      mobileClass: document.documentElement.classList.contains('mobile-profile-app'),
      mobileStylesheet: Boolean(document.querySelector('link[data-profile-mobile]')),
      variant: window.ProfileScene.manager.variant,
      camera: window.ProfileScene.camera.read().adapter
    }));
    expect(state.runtime).toBe(false);
    expect(state.mobileClass).toBe(false);
    expect(state.mobileStylesheet).toBe(false);
    expect(state.variant).toBe('desktop');
    expect(state.camera).toBe('desktop-local');
  });
});
