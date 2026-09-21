const { test, expect } = require('@playwright/test');

const firstLevel = ['work', 'knowledge', 'experience', 'education', 'about'];

const bootOverview = async (page, { reducedMotion = false, viewport = { width: 1440, height: 900 } } = {}) => {
  if (reducedMotion) await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize(viewport);
  await page.addInitScript(() => sessionStorage.setItem('profileIntroSeen', 'true'));
  await page.route('https://cloud.umami.is/**', route => route.abort()).catch(() => {});
  await page.goto('/#overview');
  await page.waitForFunction(() => Boolean(window.ProfileRootOverview && window.ProfileRootLanding));
  await page.waitForFunction(() => {
    const state = window.ProfileRootOverview.snapshot();
    return state.ready && state.visible && state.mode === 'overview' && state.rootLanding === 'false';
  });
  await page.waitForFunction(() => !document.body.classList.contains('is-v9-transitioning'));
};

const cameraState = page => page.evaluate(() => window.ProfileCameraComposition?.snapshot?.() || null);

test.describe('V3.1 Phase H practical Profile Root', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('same-session Overview is a practical graph-native homepage with five immediate branches', async ({ page }) => {
    await bootOverview(page);
    const state = await page.evaluate(() => window.ProfileRootOverview.snapshot());
    expect(state.branchCount).toBe(5);
    expect(state.rootPresent).toBe(true);
    expect(state.cvState).toBe('html');
    expect(state.profileActionCount).toBe(3);

    await expect(page.locator('.profile-app > .hero')).toBeHidden();
    await expect(page.locator('#site-explorer')).toBeVisible();
    await expect(page.locator('.profile-root-brief')).toBeVisible();
    await expect(page.locator('.profile-root-name')).toContainText('Štěpán Chrast');
    await expect(page.locator('.profile-root-kicker')).toHaveCount(0);
    await expect(page.locator('#site-graph .site-graph-node[data-node-id="stepan-chrast"] > .site-graph-label')).toBeHidden();
    await expect(page.locator('.profile-root-brief')).toContainText('Data analysis');
    await expect(page.locator('.profile-root-quick-trigger')).toContainText('Profile brief');
    await expect(page.locator('.profile-root-cv')).toHaveCount(0);
    await expect(page.locator('.profile-root-actions a')).toHaveCount(0);

    for (const id of firstLevel) {
      await expect(page.locator(`#site-graph .site-graph-node[data-node-id="${id}"][data-profile-root-branch="true"]`)).toBeVisible();
    }

    await expect(page.locator('#site-graph .site-graph-node[data-node-id="stepan-chrast"] > .root-entry-portrait')).toHaveCount(0);
  });

  test('Quick overview preserves route and camera and restores focus after Escape', async ({ page }) => {
    await bootOverview(page);
    const before = {
      route: await page.evaluate(() => document.body.dataset.graphRoute),
      mode: await page.evaluate(() => document.body.dataset.graphMode),
      camera: await cameraState(page)
    };

    const trigger = page.locator('.profile-root-quick-trigger');
    await trigger.focus();
    await trigger.click();
    await expect(page.locator('.quick-overview-dialog')).toBeVisible();
    expect(await page.evaluate(() => window.ProfileRootOverview.snapshot().quickOpen)).toBe(true);

    await expect(page.locator('.quick-overview-dialog')).toContainText('Selected work');
    await expect(page.locator('.quick-overview-dialog')).toContainText('Core areas');
    await expect(page.locator('.quick-overview-dialog')).toContainText('Education');
    await expect(page.locator('.quick-overview-dialog')).toContainText('Certifications');
    await expect(page.locator('.quick-overview-dialog')).toContainText('Ethics of AI');
    await expect(page.locator('.quick-overview-dialog')).toContainText('B2 First');
    await expect(page.locator('.quick-overview-dialog')).toContainText('České priority');
    await expect(page.locator('.quick-overview-dialog')).toContainText('Survey Analysis');
    await expect(page.locator('.quick-overview-dialog')).toContainText('CV');
    await expect(page.locator('.quick-overview-kicker')).toHaveText('Profile brief');

    const briefNameSize = await page.locator('.quick-overview-header h2').evaluate(element => parseFloat(getComputedStyle(element).fontSize));
    expect(briefNameSize).toBeLessThanOrEqual(27);

    const openWorkGeometry = await page.locator('.quick-overview-section').filter({ hasText: 'Selected work' })
      .getByRole('button', { name: 'Open Work' }).evaluate(element => {
        const rect = element.getBoundingClientRect();
        const before = getComputedStyle(element, '::before');
        return {
          paddingLeft: parseFloat(getComputedStyle(element).paddingLeft),
          nodeLeft: parseFloat(before.left),
          nodeWidth: parseFloat(before.width),
          textLeft: rect.left + parseFloat(getComputedStyle(element).paddingLeft)
        };
      });
    expect(openWorkGeometry.paddingLeft).toBeGreaterThanOrEqual(24);
    expect(openWorkGeometry.nodeLeft + openWorkGeometry.nodeWidth).toBeLessThan(openWorkGeometry.paddingLeft);

    const dossierStyle = await page.locator('.quick-overview-dialog').evaluate(element => ({
      shadow: getComputedStyle(element).boxShadow,
      blur: getComputedStyle(element).backdropFilter,
      radius: parseFloat(getComputedStyle(element).borderRadius)
    }));
    expect(dossierStyle.shadow).toBe('none');
    expect(dossierStyle.blur === 'none' || dossierStyle.blur === '').toBe(true);
    expect(dossierStyle.radius).toBeLessThanOrEqual(7);
    const sectionStyle = await page.locator('.quick-overview-section').first().evaluate(element => ({
      background: getComputedStyle(element).backgroundColor,
      radius: parseFloat(getComputedStyle(element).borderRadius)
    }));
    expect(sectionStyle.background === 'rgba(0, 0, 0, 0)' || sectionStyle.background === 'transparent').toBe(true);
    expect(sectionStyle.radius).toBe(0);

    const during = {
      route: await page.evaluate(() => document.body.dataset.graphRoute),
      mode: await page.evaluate(() => document.body.dataset.graphMode),
      camera: await cameraState(page)
    };
    expect(during.route).toBe(before.route);
    expect(during.mode).toBe(before.mode);
    if (before.camera?.camera && during.camera?.camera) {
      expect(during.camera.camera.x).toBeCloseTo(before.camera.camera.x, 4);
      expect(during.camera.camera.y).toBeCloseTo(before.camera.camera.y, 4);
      expect(during.camera.camera.scale).toBeCloseTo(before.camera.camera.scale, 4);
    }

    await page.keyboard.press('Escape');
    await expect(page.locator('.quick-overview-dialog')).toBeHidden();
    await expect(trigger).toBeFocused();
    expect(await page.evaluate(() => document.body.dataset.graphRoute)).toBe('overview');
  });

  test('Quick overview branch actions reuse the existing graph router', async ({ page }) => {
    await bootOverview(page);
    await page.locator('.profile-root-quick-trigger').click();
    await page.locator('.quick-overview-section').filter({ hasText: 'Selected work' }).getByRole('button', { name: 'Open Work' }).click();
    await page.waitForFunction(() => document.body.dataset.graphMode === 'work' && document.body.dataset.graphRoute === 'work');
    await expect(page.locator('.quick-overview-dialog')).toBeHidden();
    expect(await page.evaluate(() => window.ProfileRootOverview.snapshot().visible)).toBe(false);
  });

  test('ATLAS_READY keeps professional shortcuts in the persistent header only', async ({ page }) => {
    await page.addInitScript(() => sessionStorage.removeItem('profileIntroSeen'));
    await page.route('https://cloud.umami.is/**', route => route.abort()).catch(() => {});
    await page.goto('/');
    await page.waitForFunction(() => window.ProfileIntro?.snapshot?.().state === 'ATLAS_READY', null, { timeout: 8_000 });

    expect(await page.evaluate(() => document.body.dataset.graphMode)).toBe('atlas');
    await expect(page.locator('.entry-fast-path')).toHaveCount(0);
    await expect(page.locator('.quick-overview-global-trigger')).toBeHidden();

    const header = page.locator('body > .site-header.app-header');
    await expect(header).toBeVisible();
    await expect(header.locator('.brand')).toHaveCount(0);
    const quick = header.getByRole('button', { name: 'Profile brief' });
    await expect(quick).toBeVisible();
    await expect(header.getByRole('link', { name: 'CV' })).toHaveAttribute('href', '/cv/');
    await expect(header.getByRole('link', { name: 'GitHub ↗' })).toHaveAttribute('href', 'https://github.com/Chrasts');
    await expect(header.getByRole('link', { name: 'LinkedIn ↗' })).toHaveAttribute('href', 'https://www.linkedin.com/in/stepan-chrast');
    await expect(header.getByRole('link', { name: 'Email' })).toHaveAttribute('href', /^mailto:/);

    const headerStyle = await header.evaluate(element => ({
      background: getComputedStyle(element).backgroundColor,
      shadow: getComputedStyle(element).boxShadow,
      blur: getComputedStyle(element).backdropFilter,
      height: parseFloat(getComputedStyle(element).height)
    }));
    expect(headerStyle.background).not.toBe('rgba(0, 0, 0, 0)');
    expect(headerStyle.shadow).toBe('none');
    expect(headerStyle.blur === 'none' || headerStyle.blur === '').toBe(true);
    expect(headerStyle.height).toBeGreaterThanOrEqual(76);

    const quickStyle = await quick.evaluate(element => ({
      radius: parseFloat(getComputedStyle(element).borderRadius),
      background: getComputedStyle(element).backgroundColor,
      color: getComputedStyle(element).color,
      ink: getComputedStyle(document.documentElement).getPropertyValue('--ink').trim(),
      beforeRadius: getComputedStyle(element, '::before').borderRadius
    }));
    expect(quickStyle.radius).toBeLessThanOrEqual(3);
    expect(quickStyle.beforeRadius).not.toBe('0px');
    expect(quickStyle.color).toBe(await page.evaluate(() => {
      const probe = document.createElement('span');
      probe.style.color = 'var(--ink)';
      document.body.appendChild(probe);
      const value = getComputedStyle(probe).color;
      probe.remove();
      return value;
    }));

    const brownNav = header.locator('#main-nav > a[data-route="work"], #main-nav > a[data-route="knowledge"], #main-nav > a[data-route="experience"], #main-nav > a[data-route="education"], #main-nav > a[data-route="about"]');
    await expect(brownNav).toHaveCount(5);
    const brown = await page.evaluate(() => {
      const probe = document.createElement('span');
      probe.style.color = 'var(--brown)';
      document.body.appendChild(probe);
      const value = getComputedStyle(probe).color;
      probe.remove();
      return value;
    });
    for (const link of await brownNav.all()) expect(await link.evaluate(element => getComputedStyle(element).color)).toBe(brown);

    const utility = header.getByRole('link', { name: 'CV' });
    const utilityBefore = await utility.evaluate(element => ({
      fill: getComputedStyle(element, '::before').backgroundColor,
      width: parseFloat(getComputedStyle(element, '::after').width)
    }));
    await utility.hover();
    const utilityAfter = await utility.evaluate(element => ({
      fill: getComputedStyle(element, '::before').backgroundColor,
      width: parseFloat(getComputedStyle(element, '::after').width)
    }));
    expect(utilityAfter.fill).not.toBe(utilityBefore.fill);
    expect(utilityAfter.width).toBeGreaterThan(utilityBefore.width);

    await quick.click();
    await expect(page.locator('.quick-overview-dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.quick-overview-dialog')).toBeHidden();
    await expect(quick).toBeFocused();

    await expect(page.locator('#site-graph-title')).toHaveText('Atlas');
    await expect(page.locator('.atlas-button')).toHaveText('Atlas');
    await expect(page.locator('.atlas-button')).toHaveAttribute('aria-label', 'Open Atlas');

    const routebarStyle = await page.locator('.graph-breadcrumb').evaluate(element => ({
      borderBottom: getComputedStyle(element).borderBottomWidth,
      background: getComputedStyle(element).backgroundColor
    }));
    expect(routebarStyle.borderBottom).toBe('0px');

    const atlasControlStyle = await page.locator('.atlas-button').evaluate(element => ({
      radius: parseFloat(getComputedStyle(element).borderRadius),
      shadow: getComputedStyle(element).boxShadow
    }));
    expect(atlasControlStyle.radius).toBeLessThanOrEqual(3);
    expect(atlasControlStyle.shadow).toBe('none');
  });
});

test.describe('V3.1 Phase H mobile and reduced motion', () => {
  test('mobile practical root and Quick overview stay inside the application viewport', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    await bootOverview(page, { viewport: { width: 390, height: 844 } });
    await page.locator('.profile-root-quick-trigger').click();
    const bounds = await page.locator('.quick-overview-dialog').boundingBox();
    expect(bounds).toBeTruthy();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(390.5);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(844.5);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await context.close();
  });

  test('reduced motion preserves the same recruiter fast-path semantics', async ({ page }) => {
    await bootOverview(page, { reducedMotion: true });
    await page.locator('.profile-root-quick-trigger').click();
    const state = await page.evaluate(() => ({
      root: window.ProfileRootOverview.snapshot(),
      animation: getComputedStyle(document.querySelector('.quick-overview-dialog')).animationDuration,
      transition: getComputedStyle(document.querySelector('.quick-overview-dialog')).transitionDuration
    }));
    expect(state.root.reducedMotion).toBe(true);
    expect(state.root.quickOpen).toBe(true);
    expect(state.animation === '0s' || state.animation === '0.001ms').toBe(true);
    expect(state.transition === '0s' || state.transition === '0.001ms').toBe(true);
  });
});


test('desktop header owns stable Profile context and same-route Overview is a no-op', async ({ page }) => {
  await bootOverview(page);
  await expect(page.locator('.header-location-label')).toHaveText('Profile');

  const before = await page.evaluate(() => ({
    viewBox: document.querySelector('#site-graph .site-graph-svg')?.getAttribute('viewBox'),
    root: document.querySelector('#site-graph .site-graph-node[data-node-id="stepan-chrast"]')?.getAttribute('transform')
  }));
  await page.locator('#main-nav [data-route="overview"]').click();
  await page.waitForTimeout(260);
  const after = await page.evaluate(() => ({
    route: document.body.dataset.graphRoute,
    transitioning: document.body.classList.contains('is-v9-transitioning'),
    viewBox: document.querySelector('#site-graph .site-graph-svg')?.getAttribute('viewBox'),
    root: document.querySelector('#site-graph .site-graph-node[data-node-id="stepan-chrast"]')?.getAttribute('transform')
  }));
  expect(after.route).toBe('overview');
  expect(after.transitioning).toBe(false);
  expect(after.viewBox).toBe(before.viewBox);
  expect(after.root).toBe(before.root);
});


test('Profile overview keeps one identity name and separates prominent Profile brief from secondary routes', async ({ page }) => {
  await bootOverview(page);
  await expect(page.locator('.profile-root-name')).toHaveCount(1);
  await expect(page.locator('.graph-breadcrumb')).toBeHidden();
  const size = await page.locator('.profile-root-name').evaluate(element => parseFloat(getComputedStyle(element).fontSize));
  expect(size).toBeLessThanOrEqual(24);

  const quick = page.locator('.profile-root-quick-row .profile-root-quick-trigger');
  await expect(quick).toBeVisible();
  const quickBox = await quick.boundingBox();
  const actionsBox = await page.locator('.profile-root-actions').boundingBox();
  expect(quickBox.height).toBeGreaterThanOrEqual(54);
  expect(quickBox.y + quickBox.height).toBeLessThanOrEqual(actionsBox.y + 2);
});


test('top navigation active marker never shifts the route labels', async ({ page }) => {
  await bootOverview(page);
  const positions = async () => page.locator('#main-nav > a[data-route]').evaluateAll(items =>
    Object.fromEntries(items.map(item => [item.dataset.route, {
      x: item.getBoundingClientRect().x,
      width: item.getBoundingClientRect().width
    }]))
  );

  const before = await positions();
  await page.locator('#main-nav > a[data-route="work"]').click();
  await page.waitForFunction(() => document.body.dataset.graphRoute === 'work');
  await page.waitForFunction(() => !document.body.classList.contains('is-v9-transitioning'));
  const after = await positions();

  for (const route of Object.keys(before)) {
    expect(Math.abs(after[route].x - before[route].x)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(after[route].width - before[route].width)).toBeLessThanOrEqual(0.5);
  }
});


test('Profile brief keeps ESSLLI last in Education', async ({ page }) => {
  await bootOverview(page);
  await page.locator('.profile-root-quick-trigger').click();
  const items = await page.locator('.quick-overview-section').filter({ hasText: /^Education/ }).locator('li').allTextContents();
  expect(items.at(-1)).toContain('ESSLLI 2026');
});


test('opening Atlas header keeps persistent terminals without label collisions', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.removeItem('profileIntroSeen'));
  await page.route('https://cloud.umami.is/**', route => route.abort()).catch(() => {});
  await page.goto('/');
  await page.waitForFunction(() => window.ProfileIntro?.snapshot?.().state === 'ATLAS_READY', null, { timeout: 8_000 });

  const routes = page.locator('#main-nav > a[data-route]');
  await expect(routes).toHaveCount(7);

  const geometry = await routes.evaluateAll(items => items.map(item => {
    const rect = item.getBoundingClientRect();
    const before = getComputedStyle(item, '::before');
    const after = getComputedStyle(item, '::after');
    return {
      route: item.dataset.route,
      left: rect.left,
      right: rect.right,
      paddingLeft: parseFloat(getComputedStyle(item).paddingLeft),
      nodeContent: before.content,
      nodeBackground: before.backgroundColor,
      lineWidth: parseFloat(after.width)
    };
  }));

  geometry.forEach(item => {
    expect(item.paddingLeft).toBeLessThanOrEqual(1);
    expect(item.nodeContent).not.toBe('none');
  });
  expect(geometry[0].left).toBeLessThan(70);
  for (let i = 1; i < geometry.length; i += 1) {
    expect(geometry[i].left - geometry[i - 1].right).toBeGreaterThanOrEqual(18);
  }

  const atlas = page.locator('#main-nav > a[data-route="atlas"]');
  const work = page.locator('#main-nav > a[data-route="work"]');
  const atlasFill = await atlas.evaluate(element => getComputedStyle(element, '::before').backgroundColor);
  const workBefore = await work.evaluate(element => ({
    fill: getComputedStyle(element, '::before').backgroundColor,
    line: parseFloat(getComputedStyle(element, '::after').width)
  }));
  expect(atlasFill).not.toBe(workBefore.fill);

  await work.hover();
  const workAfter = await work.evaluate(element => ({
    fill: getComputedStyle(element, '::before').backgroundColor,
    line: parseFloat(getComputedStyle(element, '::after').width)
  }));
  expect(workAfter.fill).not.toBe(workBefore.fill);
  expect(workAfter.line).toBeGreaterThan(workBefore.line);
});
