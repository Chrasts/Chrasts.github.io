const { test, expect } = require('@playwright/test');

const boot = async page => {
  await page.addInitScript(() => sessionStorage.setItem('profileIntroSeen', 'true'));
  await page.route('https://cloud.umami.is/**', route => route.abort()).catch(() => {});
  await page.goto('/#education');
  await page.waitForFunction(() => Boolean(window.ProfileScene?.manager));
  await page.waitForFunction(() => Boolean(document.querySelector('.scene-canvas')));
  await page.waitForFunction(() => !document.body.classList.contains('is-v9-transitioning'));
};

test.describe('Scene-system architecture contracts', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('scene object ids are unique rather than silently overwritten', async ({ page }) => {
    await boot(page);
    const result = await page.evaluate(() => {
      const registry = new window.ProfileScene.SceneObjectRegistry();
      registry.register({ id: 'same-id', selector: 'body' });
      let message = null;
      try { registry.register({ id: 'same-id', selector: 'html' }); }
      catch (error) { message = error.message; }
      return {
        count: registry.all().length,
        selector: registry.get('same-id')?.selector,
        message,
        has: registry.has('same-id')
      };
    });
    expect(result.count).toBe(1);
    expect(result.selector).toBe('body');
    expect(result.has).toBe(true);
    expect(result.message).toContain('already registered');
  });

  test('desktop/mobile variants can own selector resolution', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => {
      const target = document.createElement('div');
      target.className = 'scene-contract-variant-target';
      document.querySelector('.scene-canvas').appendChild(target);
      window.ProfileScene.registry.register({
        id: 'scene-contract-variant-selector',
        selector: '.scene-contract-missing-base',
        placement: 'base-placement',
        visible: true,
        variants: { desktop: { selector: '.scene-contract-variant-target', placement: 'desktop-placement' } }
      });
    });
    const target = page.locator('.scene-contract-variant-target');
    await expect(target).toHaveAttribute('data-scene-object', 'scene-contract-variant-selector');
    await expect(target).toHaveAttribute('data-scene-placement', 'desktop-placement');
    await page.evaluate(() => window.ProfileScene.registry.unregister('scene-contract-variant-selector'));
    await expect(target).not.toHaveAttribute('data-scene-object', 'scene-contract-variant-selector');
    await expect(target).not.toHaveClass(/scene-object/);
  });

  test('an explicit refresh discovers late scene roots and unregisters them cleanly', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => {
      window.ProfileScene.registry.register({
        id: 'scene-contract-late-root',
        selector: '.scene-contract-late-root',
        placement: 'contract-slot',
        visible: true
      });
    });
    await expect(page.locator('.scene-contract-late-root')).toHaveCount(0);
    await page.evaluate(() => {
      const target = document.createElement('section');
      target.className = 'scene-contract-late-root';
      document.querySelector('.scene-canvas').appendChild(target);
      window.ProfileScene.manager.scheduleRefresh('late-root-contract');
    });
    const target = page.locator('.scene-contract-late-root');
    await expect(target).toHaveAttribute('data-scene-object', 'scene-contract-late-root');
    await expect(target).toHaveAttribute('data-scene-placement', 'contract-slot');
    await page.evaluate(() => window.ProfileScene.registry.unregister('scene-contract-late-root'));
    await expect(target).not.toHaveAttribute('data-scene-object', 'scene-contract-late-root');
    await expect(target).not.toHaveClass(/scene-object/);
  });
});
