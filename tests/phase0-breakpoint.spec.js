const { test, expect } = require('@playwright/test');

test.describe('Phase 0 deferred mobile boot', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('rapid breakpoint crossing cannot strand an inert mobile script', async ({ page }) => {
    await page.addInitScript(() => sessionStorage.setItem('profileIntroSeen', 'true'));
    await page.route('https://cloud.umami.is/**', route => route.abort()).catch(() => {});
    await page.goto('/');
    await page.waitForFunction(() => Boolean(window.ProfilePhase0?.checkGraphInvariants));

    await page.setViewportSize({ width: 899, height: 800 });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForFunction(() => matchMedia('(max-width: 900px)').matches === false);
    await page.waitForTimeout(120);

    const desktopState = await page.evaluate(() => window.ProfilePhase0.checkGraphInvariants());
    expect(desktopState.mobileBreakpoint).toBe(false);
    expect(desktopState.mobileRuntimeLoaded).toBe(false);
    expect(desktopState.mobileRuntimeBooted).toBe(false);

    await page.setViewportSize({ width: 899, height: 800 });
    await page.waitForFunction(() => Boolean(window.MobileProfileScene), null, { timeout: 8_000 });

    const mobileState = await page.evaluate(() => window.ProfilePhase0.checkGraphInvariants());
    expect(mobileState.mobileBreakpoint).toBe(true);
    expect(mobileState.mobileRuntimeLoaded).toBe(true);
    expect(mobileState.mobileRuntimeBooted).toBe(true);
  });
});
