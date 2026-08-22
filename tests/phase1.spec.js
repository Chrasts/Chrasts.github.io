const { test, expect } = require('@playwright/test');

const settle = async page => {
  await page.waitForFunction(() => !document.body.classList.contains('is-v9-transitioning'));
  await page.waitForTimeout(180);
};

const ready = async (page, path = '/') => {
  await page.route('https://cloud.umami.is/**', route => route.abort()).catch(() => {});
  await page.goto(path);
  await page.waitForFunction(() => Boolean(window.ProfileScene?.manager));
  await page.waitForFunction(() => Boolean(document.body.dataset.graphMode));
  await page.waitForFunction(() => Boolean(document.querySelector('.integrated-work-controls')));
  await settle(page);
};

const route = async (page, name) => {
  const target = page.locator(`[data-route="${name}"]:visible`).first();
  await target.click({ force: true });
  await page.waitForFunction(expected => document.body.dataset.graphRoute === expected, name);
  await settle(page);
};

test.describe('Phase 1 scene architecture', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('publishes the architecture and migrates the five initial scene objects', async ({ page }) => {
    await ready(page);

    const state = await page.evaluate(() => {
      const scene = window.ProfileScene;
      return {
        constructors: [
          scene.SceneManager,
          scene.SceneObjectRegistry,
          scene.Camera,
          scene.TransitionCoordinator
        ].map(value => typeof value),
        ids: scene.registry.all().map(object => object.id).sort(),
        inspect: scene.inspect()
      };
    });

    expect(state.constructors).toEqual(['function', 'function', 'function', 'function']);
    expect(state.ids).toEqual([
      'atlas-controls',
      'detail-panel',
      'root-portrait',
      'root-profile-copy',
      'work-controls'
    ]);
    expect(state.inspect.context.variant).toBe('desktop');
    expect(state.inspect.context.mode).toBe('overview');
    expect(state.inspect.objects.every(object => object.mounted)).toBe(true);
  });

  test('existing objects expose declarative visibility, placement and enter/exit behaviour', async ({ page }) => {
    await ready(page);

    const overview = await page.evaluate(() => window.ProfileScene.inspect());
    const byId = Object.fromEntries(overview.objects.map(object => [object.id, object]));
    expect(byId['root-profile-copy']).toMatchObject({
      visible: true,
      placement: 'hero-copy',
      enter: 'from-left',
      exit: 'to-left',
      variant: 'desktop',
      managesVisibility: false
    });
    expect(byId['root-portrait']).toMatchObject({
      visible: true,
      placement: 'hero-identity',
      managesVisibility: false
    });
    expect(byId['work-controls'].visible).toBe(false);
    expect(byId['atlas-controls'].visible).toBe(false);

    await route(page, 'work');
    const work = await page.evaluate(() => window.ProfileScene.inspect());
    const workById = Object.fromEntries(work.objects.map(object => [object.id, object]));
    expect(workById['work-controls']).toMatchObject({
      visible: true,
      placement: 'scene-rails',
      enter: 'rails-in',
      exit: 'rails-out',
      managesVisibility: true
    });

    await route(page, 'atlas');
    const atlas = await page.evaluate(() => window.ProfileScene.inspect());
    const atlasById = Object.fromEntries(atlas.objects.map(object => [object.id, object]));
    expect(atlasById['atlas-controls']).toMatchObject({
      visible: true,
      placement: 'atlas-toolbar',
      enter: 'toolbar-in',
      exit: 'toolbar-out',
      managesVisibility: true
    });
  });

  test('registry accepts a new object with scene-dependent declarations without renderer changes', async ({ page }) => {
    await ready(page);

    const result = await page.evaluate(() => {
      const probe = document.createElement('div');
      probe.id = 'scene-phase1-probe';
      document.body.appendChild(probe);

      window.ProfileScene.registry.register({
        id: 'phase1-probe',
        element: probe,
        visibility: context => context.route === 'overview',
        placement: 'probe-default',
        enter: 'probe-enter',
        exit: 'probe-exit',
        variants: {
          desktop: { placement: 'probe-desktop' },
          mobile: { placement: 'probe-mobile' }
        }
      });

      window.ProfileScene.manager.sync();
      const snapshot = {
        hidden: probe.hidden,
        object: probe.dataset.sceneObject,
        variant: probe.dataset.sceneVariant,
        placement: probe.dataset.scenePlacement,
        enter: probe.dataset.sceneEnter,
        exit: probe.dataset.sceneExit
      };

      window.ProfileScene.registry.unregister('phase1-probe');
      probe.remove();
      return snapshot;
    });

    expect(result).toEqual({
      hidden: false,
      object: 'phase1-probe',
      variant: 'desktop',
      placement: 'probe-desktop',
      enter: 'probe-enter',
      exit: 'probe-exit'
    });
  });

  test('structural transitions publish before/after coordinator hooks', async ({ page }) => {
    await ready(page);

    await page.evaluate(() => {
      window.__phase1Hooks = [];
      window.ProfileScene.transitions.on('before', detail => window.__phase1Hooks.push({ type: 'before', ...detail }));
      window.ProfileScene.transitions.on('after', detail => window.__phase1Hooks.push({ type: 'after', ...detail }));
    });

    await page.locator('#main-nav [data-route="knowledge"]').first().click({ force: true });
    await page.waitForFunction(() => document.body.classList.contains('is-v9-transitioning'));
    await settle(page);

    const hooks = await page.evaluate(() => window.__phase1Hooks);
    expect(hooks.map(hook => hook.type)).toEqual(['before', 'after']);
    expect(hooks[0].from).toBe('overview');
    expect(hooks[0].to).toBe('knowledge');
    expect(hooks[0].trigger).toBe('click');
    expect(hooks[1].to).toBe('knowledge');
    expect(await page.evaluate(() => window.ProfileScene.transitions.active)).toBe(false);
  });

  test('camera abstraction selects the current renderer adapter', async ({ page }) => {
    await ready(page);

    let camera = await page.evaluate(() => window.ProfileScene.camera.snapshot());
    expect(camera.adapter).toBe('desktop-local');
    expect(camera.kind).toBe('fixed');
    expect(camera.writable).toBe(false);

    await route(page, 'atlas');
    camera = await page.evaluate(() => window.ProfileScene.camera.snapshot());
    expect(camera.adapter).toBe('atlas');
    expect(camera.kind).toBe('transform');
    expect(camera.scale).toBeGreaterThan(0);
    expect(camera.writable).toBe(true);
    expect(await page.evaluate(() => window.ProfileScene.camera.fit())).toBe(true);
  });
});

test.describe('Phase 1 mobile variants', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('registered objects resolve mobile variants without duplicating scene definitions', async ({ page }) => {
    await ready(page);
    await page.waitForFunction(() => Boolean(window.MobileProfileScene));
    await page.evaluate(() => window.ProfileScene.manager.sync());

    let inspect = await page.evaluate(() => window.ProfileScene.inspect());
    let byId = Object.fromEntries(inspect.objects.map(object => [object.id, object]));
    expect(inspect.context.variant).toBe('mobile');
    expect(byId['root-profile-copy'].placement).toBe('hero-copy-compact');
    expect(byId['root-portrait'].placement).toBe('hero-identity-compact');
    expect((await page.locator('.hero-copy').getAttribute('data-scene-variant'))).toBe('mobile');

    await route(page, 'work');
    inspect = await page.evaluate(() => window.ProfileScene.inspect());
    byId = Object.fromEntries(inspect.objects.map(object => [object.id, object]));
    expect(byId['work-controls'].placement).toBe('control-sheet');
    expect(byId['detail-panel'].placement).toBe('scene-detail-sheet');

    const camera = await page.evaluate(() => window.ProfileScene.camera.snapshot());
    expect(camera.adapter).toBe('mobile-local');
    expect(camera.kind).toBe('viewBox');
  });
});
