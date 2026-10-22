const { test, expect } = require('@playwright/test');

const firstLevelIds = ['work', 'knowledge', 'experience', 'education', 'about'];

const blockAnalytics = async page => {
  await page.route('https://cloud.umami.is/**', route => route.abort()).catch(() => {});
};

const bootDesktopHome = async (page, { introSeen = true } = {}) => {
  if (introSeen) {
    await page.addInitScript(() => {
      sessionStorage.setItem('profileIntroSeen', 'true');
      sessionStorage.setItem('mobileConstructionPreview', 'true');
    });
  }
  await blockAnalytics(page);
  await page.goto('/#overview');
  await page.waitForFunction(() => Boolean(window.ProfileHomeOverviewV4));
  await page.waitForFunction(() => document.body.dataset.graphMode === 'overview');
  await page.waitForFunction(() => document.body.dataset.rootLanding === 'false');
  await page.waitForFunction(() => !document.body.classList.contains('is-v9-transitioning'));
  await expect(page.locator('.home-v4-shell')).toBeVisible();
};

const waitRoute = async (page, route) => {
  await page.waitForFunction(expected => document.body.dataset.graphRoute === expected, route);
  await page.waitForFunction(() => !document.body.classList.contains('is-v9-transitioning'));
};

test.describe('V4 professional portfolio smoke', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('Home exposes identity, current context, one profile root and selected work in one viewport', async ({ page }) => {
    await bootDesktopHome(page);

    await expect(page.locator('.home-v4-name')).toContainText('Štěpán Chrast');
    await expect(page.locator('.home-v4-role')).toContainText('Data Analysis');
    await expect(page.locator('.home-v4-current-item')).toHaveCount(2);
    const workStatus = page.locator('.home-v4-current-item--work');
    const studyStatus = page.locator('.home-v4-current-item--education');
    await expect(workStatus.locator('.home-v4-current-kind')).toHaveText('Working at');
    await expect(workStatus.locator('strong')).toHaveText('České priority');
    await expect(workStatus.locator('span').last()).toContainText('Junior Researcher and Data Analyst');
    await expect(studyStatus.locator('.home-v4-current-kind')).toHaveText('Studying at');
    await expect(studyStatus.locator('strong')).toHaveText('Charles University');
    await expect(studyStatus.locator('span').last()).toContainText('MSc in Logic');
    const statusDecoration = await workStatus.evaluate(item => ({
      leftBorder: getComputedStyle(item).borderLeftWidth,
      dotWidth: getComputedStyle(item.querySelector('.home-v4-current-kind'), '::before').width
    }));
    expect(statusDecoration).toEqual({ leftBorder: '0px', dotWidth: '7px' });
    await expect(page.locator('.home-v4-project-choice')).toHaveCount(4);
    await expect(page.locator('.home-v4-project-preview')).toBeVisible();
    const workDecor = await page.locator('.home-v4-work').evaluate(work => ({
      headerBorder: getComputedStyle(work.querySelector('.home-v4-work-head')).borderBottomWidth,
      listBorder: getComputedStyle(work.querySelector('.home-v4-project-list')).borderBottomWidth,
      listConnector: getComputedStyle(work.querySelector('.home-v4-project-list'), '::before').content,
      nodeGap: getComputedStyle(work.querySelector('.home-v4-project-choice')).columnGap
    }));
    expect(workDecor).toEqual({
      headerBorder: '0px',
      listBorder: '0px',
      listConnector: 'none',
      nodeGap: '31px'
    });
    await expect(page.locator('.home-v4-static-portrait img')).toBeVisible();
    await expect(page.locator('.home-v4-static-portrait img')).toHaveAttribute('src', 'assets/stepan-chrast.jpg');
    await expect(page.locator('.profile-root-brief')).toBeHidden();
    await expect(page.locator('.hero')).toBeHidden();
    await expect(page.locator('#site-graph .site-graph-node[data-node-id="stepan-chrast"]')).toBeVisible();
    await expect(page.locator('.header-context-slot')).toBeHidden();
    for (const route of ['overview', 'work', 'experience', 'education', 'knowledge', 'about']) {
      await expect(page.locator(`#main-nav > a[data-route="${route}"]`)).toBeHidden();
    }
    await expect(page.locator('.header-practical-actions a[href="/cv/"]')).toBeVisible();
    await expect(page.locator('.header-practical-actions a[href^="mailto:"]')).toBeVisible();
    await expect(page.locator('.header-practical-actions a[href*="github.com"]')).toBeVisible();
    await expect(page.locator('.header-practical-actions a[href*="linkedin.com"]')).toBeVisible();
    await expect(page.locator('.header-practical-actions [data-route="atlas"]')).toBeHidden();
    await expect(page.locator('.home-v4-actions')).toHaveCount(0);
    await expect(page.locator('.home-v4-secondary-links')).toHaveCount(0);
    await expect(page.locator('.home-v4-work-head .home-v4-eyebrow')).toHaveCount(0);

    for (const id of firstLevelIds) {
      await expect(page.locator(`#site-graph .site-graph-node[data-node-id="${id}"]`)).toBeHidden();
    }

    const state = await page.evaluate(() => window.ProfileHomeOverviewV4.snapshot());
    expect(state.interactiveIntent).toBe(false);
    expect(state.interactivePhase).toBe('home');
    expect(state.rootActionPresent).toBe(true);
    expect(state.portraitEdgeReady).toBe(true);

    const viewportFit = await page.evaluate(() => ({
      scrollHeight: document.documentElement.scrollHeight,
      innerHeight: window.innerHeight
    }));
    expect(viewportFit.scrollHeight).toBeLessThanOrEqual(viewportFit.innerHeight + 2);
  });

  test('profile root opt-in reveals the existing interactive Overview and reverses back to Home', async ({ page }) => {
    await bootDesktopHome(page);

    const root = page.locator('#site-graph .site-graph-node[data-node-id="stepan-chrast"]').first();
    const spectrum = root.locator(':scope > .home-v4-root-spectrum');
    await expect(spectrum).toBeVisible();
    await expect(spectrum.locator('circle')).toHaveCount(5);
    const spectrumColors = await spectrum.locator('circle').evaluateAll(arcs =>
      arcs.map(arc => getComputedStyle(arc).stroke)
    );
    expect(new Set(spectrumColors).size).toBe(5);
    const orbitStyles = await spectrum.locator('circle').evaluateAll(circles =>
      circles.map(circle => ({
        animation: getComputedStyle(circle).animationName,
        radius: Number(circle.getAttribute('r')),
        segment: circle.getAttribute('stroke-dasharray')
      }))
    );
    expect(new Set(orbitStyles.map(arc => arc.radius)).size).toBe(5);
    expect(orbitStyles.every(arc => arc.animation === 'home-v4-semi-halo-rotate' && arc.segment)).toBe(true);
    // A declared animation is not enough: unitless custom properties in
    // calc() previously made Chromium hold a static stroke-dashoffset.
    const readOffsets = () => spectrum.locator('circle').evaluateAll(arcs =>
      arcs.map(arc => parseFloat(getComputedStyle(arc).strokeDashoffset))
    );
    const beforeRotation = await readOffsets();
    await page.waitForTimeout(550);
    const afterRotation = await readOffsets();
    expect(beforeRotation.every(Number.isFinite)).toBe(true);
    expect(afterRotation.every(Number.isFinite)).toBe(true);
    expect(afterRotation.every((offset, i) => Math.abs(offset - beforeRotation[i]) > 8)).toBe(true);
    const rootDot = root.locator(':scope > .site-graph-dot');
    const idleSize = await rootDot.evaluate(dot => getComputedStyle(dot).transform);
    await root.hover();
    await page.waitForTimeout(500);
    const hoverSize = await rootDot.evaluate(dot => getComputedStyle(dot).transform);
    const scaleX = transform => Number(transform.startsWith('matrix(')
      ? transform.slice(7).split(',')[0]
      : '0');
    expect(scaleX(hoverSize)).toBeGreaterThan(scaleX(idleSize));
    await expect(spectrum).toBeVisible();
    await expect(root.locator(':scope > .home-v4-root-entry-action')).toBeVisible();
    await expect(root.locator(':scope > .home-v4-root-entry-action .home-v4-root-entry-label')).toContainText('Enter interactive graph');
    await expect(root.locator(':scope > .profile-node-portrait')).toBeHidden();

    await root.click();
    await page.waitForTimeout(340);
    const entryIsAtomic = await page.evaluate(() =>
      document.body.classList.contains('is-home-branches-staged') ||
      document.body.classList.contains('is-profile-root-emerging')
    );
    expect(entryIsAtomic).toBe(true);
    await expect(page.locator('body')).toHaveClass(/is-home-header-growing/);
    await expect(page.locator('.header-linear-graph-line')).toHaveAttribute('pathLength', '1');

    await page.waitForFunction(() => window.ProfileHomeOverviewV4?.snapshot().interactivePhase === 'interactive', null, { timeout: 5_000 });

    await expect(page.locator('.home-v4-profile')).toBeHidden();
    await expect(page.locator('.home-v4-work')).toBeHidden();
    await expect(spectrum).toBeHidden();
    await expect(page.locator('.header-linear-graph')).toBeVisible();
    const homeGraphBack = page.locator('.header-back-slot .crosslink-return-control');
    await expect(homeGraphBack).toBeVisible();
    await expect(page.locator('.home-v4-interactive-back')).toHaveCount(0);
    await expect(page.locator('.header-location-label')).toHaveText('Overview');
    const homeHeaderState = await page.evaluate(() => {
      const back = document.querySelector('.header-back-slot .crosslink-return-control:not([hidden])');
      const location = document.querySelector('.header-context-slot .header-location-label');
      const backRect = back.getBoundingClientRect();
      const locationRect = location.getBoundingClientRect();
      return {
        backText: back.textContent.trim(),
        backBorder: getComputedStyle(back).borderTopStyle,
        backBackground: getComputedStyle(back).backgroundColor,
        backRadius: parseFloat(getComputedStyle(back).borderTopLeftRadius),
        gap: locationRect.left - backRect.right,
        locationTextTransform: getComputedStyle(location).textTransform,
        locationVisible: getComputedStyle(location).visibility
      };
    });
    // The shared Back control also owns a visually hidden destination span.
    expect(homeHeaderState.backText).toBe('BackHome');
    expect(homeHeaderState.backBorder).toBe('solid');
    expect(homeHeaderState.backBackground).not.toBe('rgba(0, 0, 0, 0)');
    expect(homeHeaderState.backRadius).toBeLessThanOrEqual(5);
    expect(homeHeaderState.gap).toBeGreaterThanOrEqual(18);
    expect(homeHeaderState.locationTextTransform).toBe('uppercase');
    expect(homeHeaderState.locationVisible).toBe('visible');
    await expect(page.locator('.header-back-slot .crosslink-return-control')).toHaveCount(1);
    await expect(page.locator('#main-nav > a[data-route="knowledge"]')).toBeVisible();
    await expect(page.locator('.header-practical-actions [data-route="atlas"]')).toBeVisible();
    await expect(page.locator('.graph-routebar .atlas-button.atlas-entry-v7')).toBeVisible();
    for (const id of firstLevelIds) {
      await expect(page.locator(`#site-graph .site-graph-node[data-node-id="${id}"]`)).toBeVisible();
    }

    // The same canonical root is the return portal; no separate Home control is required.
    await root.click();
    await page.waitForFunction(() => window.ProfileHomeOverviewV4?.snapshot().interactivePhase === 'home', null, { timeout: 5_000 });
    await expect(page.locator('.home-v4-profile')).toBeVisible();
    await expect(page.locator('.home-v4-work')).toBeVisible();
    for (const id of firstLevelIds) {
      await expect(page.locator(`#site-graph .site-graph-node[data-node-id="${id}"]`)).toBeHidden();
    }
  });


  test('interactive Overview Back returns to Home without opening a fragment', async ({ page }) => {
    await bootDesktopHome(page);
    const root = page.locator('#site-graph .site-graph-node[data-node-id="stepan-chrast"]').first();
    await root.click();
    await page.waitForFunction(() => window.ProfileHomeOverviewV4?.snapshot().interactivePhase === 'interactive');

    await page.locator('.header-back-slot .crosslink-return-control').click();
    await page.waitForFunction(() => window.ProfileHomeOverviewV4?.snapshot().interactivePhase === 'home');
    await expect(page.locator('.home-v4-profile')).toBeVisible();
    await expect(page.locator('.header-context-slot')).toBeHidden();
  });

  test('Overview and Work share the same Back control and omit Profile brief', async ({ page }) => {
    await bootDesktopHome(page);
    const root = page.locator('#site-graph .site-graph-node[data-node-id="stepan-chrast"]').first();
    await root.click();
    await page.waitForFunction(() => window.ProfileHomeOverviewV4?.snapshot().interactivePhase === 'interactive');
    const back = page.locator('.header-back-slot .crosslink-return-control');
    await expect(back).toBeVisible();
    await expect(back).toHaveAttribute('aria-label', /Return to Home/);
    await expect(page.locator('.header-location-label')).toHaveText('Overview');
    await expect(page.locator('.header-quick-overview')).toBeHidden();
    const initial = await back.evaluate(el => {
      el.dataset.sharedHeaderProof = 'same-element';
      return {
        border: getComputedStyle(el).borderTopStyle,
        radius: getComputedStyle(el).borderTopLeftRadius
      };
    });

    await page.locator('#site-graph .site-graph-node[data-node-id="work"]').click();
    await waitRoute(page, 'work');
    await expect(back).toBeVisible();
    expect(await back.evaluate(el => el.dataset.sharedHeaderProof)).toBe('same-element');
    const workStyle = await back.evaluate(el => ({
      border: getComputedStyle(el).borderTopStyle,
      radius: getComputedStyle(el).borderTopLeftRadius
    }));
    expect(workStyle).toEqual(initial);
    await expect(page.locator('.header-quick-overview')).toBeHidden();

    await root.click();
    await waitRoute(page, 'overview');
    await page.waitForFunction(() => window.ProfileHomeOverviewV4?.snapshot().interactivePhase === 'interactive');
    await expect(back).toHaveAttribute('aria-label', /Return to Home/);
    await back.click();
    await page.waitForFunction(() => window.ProfileHomeOverviewV4?.snapshot().interactivePhase === 'home');
    await expect(back).toBeHidden();
    await expect(page.locator('.home-v4-profile')).toBeVisible();
  });

  test('focus root returns to five-branch Overview before Home, by mouse or keyboard', async ({ page }) => {
    await bootDesktopHome(page);
    const root = page.locator('#site-graph .site-graph-node[data-node-id="stepan-chrast"]').first();

    // Enter the interactive five-branch overview through the canonical Home root.
    await root.click();
    await page.waitForFunction(() => window.ProfileHomeOverviewV4?.snapshot().interactivePhase === 'interactive');

    // The Work focus route has its own root, which must return one level only.
    await page.locator('#site-graph .site-graph-node[data-node-id="work"]').click();
    await waitRoute(page, 'work');
    await expect(page.locator('.home-v4-shell')).toBeHidden();
    await root.click();
    await waitRoute(page, 'overview');
    await page.waitForFunction(() => window.ProfileHomeOverviewV4?.snapshot().interactivePhase === 'interactive');
    await expect(page.locator('.home-v4-profile')).toBeHidden();
    for (const id of firstLevelIds) {
      await expect(page.locator(`#site-graph .site-graph-node[data-node-id="${id}"]`)).toBeVisible();
    }
    // The second root click, from the five-node fragment, returns to Home.
    await root.click();
    await page.waitForFunction(() => window.ProfileHomeOverviewV4?.snapshot().interactivePhase === 'home');
    await expect(page.locator('.home-v4-profile')).toBeVisible();

    // A direct deep link has the same behaviour, even without the Home entry flow.
    await page.goto('/#education');
    await waitRoute(page, 'education');
    await root.focus();
    await page.keyboard.press('Enter');
    await waitRoute(page, 'overview');
    await page.waitForFunction(() => window.ProfileHomeOverviewV4?.snapshot().interactivePhase === 'interactive');
    for (const id of firstLevelIds) {
      await expect(page.locator(`#site-graph .site-graph-node[data-node-id="${id}"]`)).toBeVisible();
    }
    await root.focus();
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.ProfileHomeOverviewV4?.snapshot().interactivePhase === 'home');
    await expect(page.locator('.home-v4-profile')).toBeVisible();
  });

  test('root node visibly responds to hover in focused sections and Work', async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('profileIntroSeen', 'true');
      sessionStorage.setItem('mobileConstructionPreview', 'true');
    });
    await blockAnalytics(page);

    for (const route of ['knowledge', 'about', 'education', 'experience', 'work']) {
      await page.goto('/#' + route);
      await waitRoute(page, route);
      const root = page.locator('#site-graph .site-graph-node[data-node-id="stepan-chrast"]').first();
      await expect(root).toBeVisible();

      // Move into the actual root dot: the text label is not the hover target.
      await page.mouse.move(1, 1);
      // Let the previous route's animated root return to its resting scale
      // before recording the new route's baseline.
      await page.waitForTimeout(500);
      const dot = root.locator(':scope > .site-graph-dot');
      const box = await dot.boundingBox();
      expect(box).not.toBeNull();
      const before = await dot.evaluate(el => getComputedStyle(el).transform);
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(550);
      const result = await root.evaluate(el => ({
        hover: el.matches(':hover'),
        dot: getComputedStyle(el.querySelector(':scope > .site-graph-dot')).transform,
        haloOpacity: Number(getComputedStyle(el.querySelector(':scope > .site-graph-halo--primary')).opacity)
      }));
      const scale = transform => Number(transform.startsWith('matrix(') ? transform.slice(7).split(',')[0] : '0');
      expect(result.hover, route).toBe(true);
      expect(scale(result.dot), route).toBeGreaterThan(scale(before) + .12);
      expect(result.haloOpacity, route).toBeGreaterThan(.6);
    }
  });

  test('Selected Work switches evidence without expanding the Home layout', async ({ page }) => {
    await bootDesktopHome(page);

    const shell = page.locator('.home-v4-shell');
    const beforeBox = await shell.boundingBox();
    const beforeTitle = (await page.locator('.home-v4-project-title').textContent())?.trim();

    const choices = page.locator('.home-v4-project-choice');
    const workBox = await page.locator('.home-v4-work').boundingBox();
    const firstNodeBox = await choices.first().locator('.home-v4-project-node').boundingBox();
    expect(workBox).not.toBeNull();
    expect(firstNodeBox).not.toBeNull();
    const firstLabelBox = await choices.first().locator('.home-v4-project-choice-label').boundingBox();
    expect(firstLabelBox).not.toBeNull();
    expect(firstLabelBox.x - (firstNodeBox.x + firstNodeBox.width)).toBeGreaterThan(20);

    await choices.nth(1).click();
    await expect(choices.nth(1)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.home-v4-project-title')).not.toHaveText(beforeTitle || '');

    // Exactly one edge extends out of its selected node, without moving labels.
    await expect(choices.locator('.home-v4-project-node')).toHaveCount(4);
    await page.waitForTimeout(600);
    const edgeState = await choices.evaluateAll(buttons => buttons.map(button => {
      const node = button.querySelector('.home-v4-project-node');
      const edge = getComputedStyle(node, '::after');
      return {
        active: button.classList.contains('is-active'),
        extended: edge.transform.includes('matrix(1,') || edge.transform.includes('scaleX(1)'),
        hidden: edge.opacity === '0'
      };
    }));
    expect(edgeState.map(entry => entry.active)).toEqual([false, true, false, false]);
    expect(edgeState.map(entry => entry.extended)).toEqual([false, true, false, false]);
    expect(edgeState.map(entry => entry.hidden)).toEqual([true, false, true, true]);

    const afterBox = await shell.boundingBox();
    expect(beforeBox).not.toBeNull();
    expect(afterBox).not.toBeNull();
    expect(Math.abs(afterBox.height - beforeBox.height)).toBeLessThan(3);
  });

  test('all interactive window surfaces share asymmetrically chamfered corners', async ({ page }) => {
    await bootDesktopHome(page);
    await page.locator('.header-practical-actions a[href^="mailto:"]').click();

    const result = await page.evaluate(() => {
      const selectors = [
        '.home-v4-contact-dialog',
        '.scene-detail',
        '#work .work-detail-panel',
        '.quick-overview-dialog',
        '.profile-root-inspector-panel',
        '.mobile-control-sheet',
        '.artifact-focus-description'
      ];
      const supported = CSS.supports('corner-shape', 'bevel');
      const computed = selectors.map(selector => {
        const element = document.querySelector(selector);
        if (!element) return { selector, present: false };
        const style = getComputedStyle(element);
        return {
          selector,
          present: true,
          radius: style.borderRadius,
          cornerShape: style.cornerShape,
          clipPath: style.clipPath
        };
      });
      return { supported, computed };
    });
    const contact = result.computed.find(x => x.selector === '.home-v4-contact-dialog');
    expect(contact.present).toBe(true);
    const scene = result.computed.find(x => x.selector === '.scene-detail');
    expect(scene.present).toBe(true);
    for (const shape of result.computed.filter(x => x.present)) {
      if (result.supported) {
        expect(shape.cornerShape, shape.selector).toContain('bevel');
        expect(shape.radius, shape.selector).toMatch(/14px.*20px/);
      } else {
        expect(shape.clipPath, shape.selector).toContain('polygon(');
      }
    }

    // The change must not touch the circular main node or change modal input.
    const node = page.locator('#site-graph .site-graph-node[data-node-id="stepan-chrast"] > .site-graph-dot').first();
    await expect(node).toBeVisible();
    await expect(page.locator('.home-v4-contact-dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.home-v4-contact-dialog')).toBeHidden();
  });

  test('Contact is an explicit panel with visible email and deliberate mailto action', async ({ page }) => {
    await bootDesktopHome(page);

    await page.locator('.header-practical-actions a[href^="mailto:"]').click();
    const dialog = page.locator('.home-v4-contact-dialog');
    await expect(dialog).toBeVisible();
    await expect(page.locator('.home-v4-contact-email')).toContainText('@');
    await expect(page.locator('.home-v4-contact-action', { hasText: 'Copy' })).toBeVisible();
    await expect(page.locator('[data-contact-send]')).toHaveAttribute('href', /^mailto:/);
  });

  test('conventional navigation can leave Home and return without resurrecting legacy overview UI', async ({ page }) => {
    await bootDesktopHome(page);

    // Home deliberately hides the detailed section navigation.
    // Verify a conventional route transition without depending on a hidden link.
    await page.evaluate(() => { location.hash = '#work'; });
    await waitRoute(page, 'work');
    await expect(page.locator('.home-v4-shell')).toBeHidden();

    await page.locator('#main-nav [data-route="overview"]').click();
    await waitRoute(page, 'overview');
    await expect(page.locator('.home-v4-shell')).toBeVisible();
    await expect(page.locator('.profile-root-brief')).toBeHidden();
    await expect(page.locator('.hero')).toBeHidden();
  });

  test('Atlas remains optional and opens a healthy graph context', async ({ page }) => {
    await bootDesktopHome(page);

    await page.evaluate(() => { location.hash = '#atlas'; });
    await waitRoute(page, 'atlas');
    await page.waitForFunction(() => document.body.dataset.graphMode === 'atlas');
    await expect(page.locator('#atlas-controls')).toBeVisible();

    const graph = await page.evaluate(() => window.ProfilePhase0?.checkGraphInvariants?.() || null);
    expect(graph).not.toBeNull();
    expect(graph.nodeCount).toBeGreaterThan(20);
    expect(graph.orphanEdgeCount).toBe(0);
  });

  test('deep links bypass Home presentation and land in the requested profile context', async ({ page }) => {
    await page.addInitScript(() => sessionStorage.setItem('profileIntroSeen', 'true'));
    await blockAnalytics(page);
    await page.goto('/#knowledge');
    await page.waitForFunction(() => document.body.dataset.graphRoute === 'knowledge');
    await page.waitForFunction(() => !document.body.classList.contains('is-v9-transitioning'));

    await expect(page.locator('.home-v4-shell')).toBeHidden();
    expect(await page.evaluate(() => document.body.dataset.graphMode)).toBe('focus');
    await expect(page.locator('#site-explorer')).toBeVisible();
  });

  test('fresh-session intro reveals the whole Home at the loader handoff, without a root-only interstitial', async ({ page }) => {
    await page.addInitScript(() => {
      window.__homeEntryHandoffSamples = [];
      window.addEventListener('profile:intro-stage', event => {
        if (event.detail?.stage !== 'home') return;
        const measure = selector => {
          const el = document.querySelector(selector);
          if (!el) return { connected: false, visibility: 'missing', opacity: 0 };
          const style = getComputedStyle(el);
          return { connected: el.isConnected, visibility: style.visibility, opacity: Number(style.opacity) };
        };
        window.__homeEntryHandoffSamples.push({
          loaderFading: document.body.classList.contains('is-entry-loader-handoff'),
          hasHiddenBranches: [...document.querySelectorAll('#site-graph .site-graph-node[data-profile-root-branch="true"]')]
            .every(node => getComputedStyle(node).visibility === 'hidden'),
          shell: measure('.home-v4-shell'),
          profile: measure('.home-v4-profile'),
          work: measure('.home-v4-work'),
          header: measure('.site-header')
        });
      });
    });
    await blockAnalytics(page);
    await page.goto('/#overview');

    await page.waitForFunction(() => Boolean(window.ProfileHomeOverviewV4), null, { timeout: 10_000 });
    await page.waitForFunction(() => document.body.dataset.graphMode === 'overview', null, { timeout: 10_000 });
    await page.waitForFunction(() => document.body.classList.contains('is-entry-loader-complete'), null, { timeout: 10_000 });
    await expect(page.locator('.home-v4-shell')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.home-v4-profile')).toBeVisible();
    await expect(page.locator('.home-v4-work')).toBeVisible();
    const samples = await page.evaluate(() => window.__homeEntryHandoffSamples);
    expect(samples).toHaveLength(1);
    expect(samples[0].loaderFading).toBe(true);
    expect(samples[0].hasHiddenBranches).toBe(true);
    for (const part of ['shell', 'profile', 'work', 'header']) {
      expect(samples[0][part].connected, part).toBe(true);
      expect(samples[0][part].visibility, part).toBe('visible');
      expect(samples[0][part].opacity, part).toBe(1);
    }
    await expect(page.locator('[data-root-activate]')).toBeHidden();
    for (const id of firstLevelIds) {
      await expect(page.locator(`#site-graph .site-graph-node[data-node-id="${id}"]`)).toBeHidden();
    }
  });
});

test.describe('V4 mobile public surface', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('mobile defaults to the focused CV gate instead of booting the desktop graph product', async ({ page }) => {
    await blockAnalytics(page);
    await page.goto('/');

    const gate = page.locator('#mobile-construction-gate');
    await expect(gate).toBeVisible();
    await expect(page.locator('.mobile-cv-choice')).toHaveCount(2);
    await expect(page.locator('.mobile-cv-choice').first()).toHaveAttribute('href', /\/cv\//);
    await expect(page.locator('#main-content')).toHaveAttribute('inert', '');
  });
});
