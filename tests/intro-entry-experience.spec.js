const { test, expect } = require('@playwright/test');

const blockAnalytics = page => page.route('https://cloud.umami.is/**', route => route.abort()).catch(() => {});

const bootFreshReady = async page => {
  await page.addInitScript(() => sessionStorage.removeItem('profileIntroSeen'));
  await blockAnalytics(page);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.ProfileIntro?.snapshot?.().state === 'ATLAS_READY', null, { timeout: 30_000 });
  await page.waitForFunction(() => window.ProfileRootEntryPortal?.snapshot?.().available === true);
  await page.waitForFunction(() => document.body.classList.contains('is-entry-loader-complete'));
};

const bootAtlas = async page => {
  await page.addInitScript(() => sessionStorage.setItem('profileIntroSeen', 'true'));
  await blockAnalytics(page);
  await page.goto('/#atlas');
  await page.waitForFunction(() => window.ProfileRootEntryPortal?.snapshot?.().available === true);
};

test.describe('Intro entry experience master contract', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('the real readiness surface owns the first paint before the Atlas can appear', async ({ page }) => {
    await page.addInitScript(() => sessionStorage.removeItem('profileIntroSeen'));
    await blockAnalytics(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const firstPaint = await page.evaluate(() => {
      const shell = document.querySelector('.entry-loading-shell');
      const graph = document.querySelector('#site-graph');
      return {
        intro: document.documentElement.dataset.profileIntro,
        shellDisplay: getComputedStyle(shell).display,
        shellBackground: getComputedStyle(shell).backgroundColor,
        shellZ: Number(getComputedStyle(shell).zIndex),
        graphVisible: graph ? getComputedStyle(graph).visibility : null,
        hasCore: Boolean(shell?.querySelector('.entry-loading-core')),
        hasLabel: Boolean(shell?.querySelector('.entry-loading-label'))
      };
    });
    expect(['pending', 'preparing', 'running', 'ready']).toContain(firstPaint.intro);
    expect(firstPaint.hasCore).toBe(true);
    expect(firstPaint.hasLabel).toBe(false);
    if (firstPaint.intro !== 'ready') {
      expect(firstPaint.shellDisplay).toBe('grid');
      expect(firstPaint.shellZ).toBeGreaterThan(2_000_000_000);
    }
  });

  test('opening Atlas header keeps its right edge stable when reveal becomes ready', async ({ page }) => {
    await page.addInitScript(() => sessionStorage.removeItem('profileIntroSeen'));
    await blockAnalytics(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.ProfileIntro?.snapshot?.().state === 'ATLAS_REVEAL', null, { timeout: 8_000 });

    const reveal = await page.evaluate(() => {
      const header = document.querySelector('body > .site-header.app-header');
      const actions = header?.querySelector('.header-actions');
      const context = header?.querySelector('.header-context-slot');
      return {
        headerRight: header?.getBoundingClientRect().right,
        actionsRight: actions?.getBoundingClientRect().right,
        justifySelf: actions ? getComputedStyle(actions).justifySelf : null,
        contextDisplay: context ? getComputedStyle(context).display : null
      };
    });

    await page.waitForFunction(() => window.ProfileIntro?.snapshot?.().state === 'ATLAS_READY', null, { timeout: 30_000 });

    const ready = await page.evaluate(() => {
      const header = document.querySelector('body > .site-header.app-header');
      const actions = header?.querySelector('.header-actions');
      const context = header?.querySelector('.header-context-slot');
      return {
        headerRight: header?.getBoundingClientRect().right,
        actionsRight: actions?.getBoundingClientRect().right,
        justifySelf: actions ? getComputedStyle(actions).justifySelf : null,
        contextDisplay: context ? getComputedStyle(context).display : null
      };
    });

    expect(reveal.justifySelf).toBe('end');
    expect(ready.justifySelf).toBe('end');
    expect(reveal.contextDisplay).not.toBe('none');
    expect(ready.contextDisplay).not.toBe('none');
    expect(Math.abs(reveal.headerRight - ready.headerRight)).toBeLessThan(2);
    expect(Math.abs(reveal.actionsRight - ready.actionsRight)).toBeLessThan(2);
  });

  test('opening Atlas uses the same linear graph header as the rest of the site', async ({ page }) => {
    await bootFreshReady(page);
    await page.waitForFunction(() => {
      const graph = document.querySelector('.header-linear-graph-line');
      return Boolean(graph?.getAttribute('d'));
    });

    const state = await page.evaluate(() => {
      const navItems = [...document.querySelectorAll('#main-nav > a[data-route]')];
      const utilities = [...document.querySelectorAll('.header-practical-actions .graph-control')]
        .filter(item => !item.hidden && getComputedStyle(item).display !== 'none');
      const nodes = [...document.querySelectorAll('.header-linear-graph-nodes circle')];
      const atlas = document.querySelector('.graph-routebar .atlas-button');
      const theme = document.querySelector('.theme-toggle');
      return {
        routes: navItems.map(item => item.dataset.route),
        itemCount: navItems.length + utilities.length,
        nodeCount: nodes.length,
        line: document.querySelector('.header-linear-graph-line')?.getAttribute('d') || '',
        atlasLink: document.querySelector('.header-linear-graph-atlas-link')?.getAttribute('d') || '',
        atlasVisible: Boolean(atlas?.getClientRects().length),
        atlasCurrent: atlas?.getAttribute('aria-current'),
        themeRadius: getComputedStyle(theme).borderRadius,
        pseudo: [...navItems, ...utilities].map(item => ({
          before: getComputedStyle(item, '::before').content,
          after: getComputedStyle(item, '::after').content
        }))
      };
    });

    expect(state.routes).toEqual(['overview', 'work', 'knowledge', 'experience', 'education', 'about']);
    expect(state.nodeCount).toBe(state.itemCount);
    expect(state.line.length).toBeGreaterThan(20);
    expect(state.atlasLink.length).toBeGreaterThan(20);
    expect(state.atlasVisible).toBe(true);
    expect(state.atlasCurrent).toBe('page');
    expect(state.themeRadius).toBe('50%');
    state.pseudo.forEach(item => {
      expect(['none', 'normal', '""']).toContain(item.before);
      expect(['none', 'normal', '""']).toContain(item.after);
    });

    const work = page.locator('#main-nav > a[data-route="work"]');
    const key = await work.getAttribute('data-header-graph-key');
    const node = page.locator(`.header-linear-graph-nodes circle[data-header-graph-key="${key}"]`);
    const before = await node.evaluate(element => getComputedStyle(element).fill);
    await work.hover();
    await expect(node).toHaveClass(/is-hot/);
    const after = await node.evaluate(element => getComputedStyle(element).fill);
    expect(after).not.toBe(before);
  });

  test('fresh reveal retains one bounds-driven camera and the full topology through ATLAS_READY', async ({ page }) => {
    await bootFreshReady(page);
    const state = await page.evaluate(() => {
      const intro = window.ProfileIntro.snapshot();
      const atlas = window.ProfileAtlasLOD.snapshot();
      const terminal = document.querySelector('#site-graph .site-graph-node[data-node-id="incompleteness"]');
      const terminalLabel = terminal.querySelector(':scope > .site-graph-label');
      return {
        entryState: document.body.dataset.entryState,
        topology: document.body.dataset.atlasTopology,
        expected: window.SITE_DATA.graph.nodes.length,
        visible: atlas.visibleNodeCount,
        hidden: atlas.hiddenNodeCount,
        camera: atlas.camera,
        entryCamera: intro.entryCamera,
        revealElapsed: intro.elapsed,
        timing: intro.timing,
        readinessTopology: intro.readiness.topology,
        readinessLabels: intro.readiness.labels,
        terminalOpacity: Number(getComputedStyle(terminal).opacity),
        terminalLabelOpacity: Number(getComputedStyle(terminalLabel).opacity),
        terminalLabelText: terminalLabel.textContent.trim(),
        terminalPointerEvents: getComputedStyle(terminal).pointerEvents,
        terminalHidden: terminal.classList.contains('is-atlas-lod-hidden'),
        fitBounds: atlas.topologyBounds,
        cloneCount: document.querySelectorAll('.profile-intro-overlay').length
      };
    });

    expect(state.entryState).toBe('ready');
    expect(state.topology).toBe('entry-full');
    expect(state.visible).toBe(state.expected);
    expect(state.hidden).toBe(0);
    expect(state.camera.x).toBeCloseTo(state.entryCamera.x, 1);
    expect(state.camera.y).toBeCloseTo(state.entryCamera.y, 1);
    expect(state.camera.scale).toBeCloseTo(state.entryCamera.scale, 3);
    expect(state.revealElapsed).toBeGreaterThanOrEqual(state.timing.ready - 100);
    expect(state.revealElapsed).toBeLessThan(state.timing.ready + 600);
    expect(state.readinessTopology).toBe(true);
    expect(state.readinessLabels).toBe(true);
    expect(state.terminalOpacity).toBeGreaterThan(.2);
    expect(state.terminalLabelOpacity).toBeGreaterThan(.2);
    expect(state.terminalLabelText.length).toBeGreaterThan(0);
    expect(state.terminalPointerEvents).not.toBe('none');
    expect(state.terminalHidden).toBe(false);
    expect(state.fitBounds.width).toBeGreaterThan(1000);
    expect(state.cloneCount).toBe(0);

    await page.waitForTimeout(700);
    const delayed = await page.evaluate(() => {
      const atlas = window.ProfileAtlasLOD.snapshot();
      const terminal = document.querySelector('#site-graph .site-graph-node[data-node-id="incompleteness"]');
      const terminalLabel = terminal.querySelector(':scope > .site-graph-label');
      return {
        visible: atlas.visibleNodeCount,
        hidden: atlas.hiddenNodeCount,
        terminalOpacity: Number(getComputedStyle(terminal).opacity),
        terminalLabelOpacity: Number(getComputedStyle(terminalLabel).opacity),
        terminalHidden: terminal.classList.contains('is-atlas-lod-hidden')
      };
    });
    expect(delayed.visible).toBe(state.expected);
    expect(delayed.hidden).toBe(0);
    expect(delayed.terminalOpacity).toBeCloseTo(state.terminalOpacity, 2);
    expect(delayed.terminalLabelOpacity).toBeCloseTo(state.terminalLabelOpacity, 2);
    expect(delayed.terminalHidden).toBe(false);
  });

  test('input unlocks when the graph becomes legible while the residual light field is non-blocking', async ({ page }) => {
    await page.addInitScript(() => sessionStorage.removeItem('profileIntroSeen'));
    await blockAnalytics(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.ProfileIntro?.snapshot?.().state === 'ATLAS_READY', null, { timeout: 30_000 });
    const unlocked = await page.evaluate(() => ({
      intro: document.documentElement.dataset.profileIntro,
      entryState: document.body.dataset.entryState,
      revealClass: document.body.classList.contains('is-atlas-reveal'),
      portalAvailable: window.ProfileRootEntryPortal.snapshot().available,
      shellPointerEvents: getComputedStyle(document.querySelector('.entry-loading-shell')).pointerEvents,
      shellBackground: getComputedStyle(document.querySelector('.entry-loading-shell')).backgroundColor,
      loaderOpacity: Number(getComputedStyle(document.querySelector('.entry-loading-object')).opacity)
    }));
    expect(unlocked.intro).toBe('ready');
    expect(unlocked.entryState).toBe('ready');
    expect(unlocked.revealClass).toBe(false);
    expect(unlocked.portalAvailable).toBe(true);
    expect(unlocked.shellPointerEvents).toBe('none');
    expect(unlocked.shellBackground).toBe('rgba(0, 0, 0, 0)');
    expect(unlocked.loaderOpacity).toBe(0);
  });

  test('entry chrome stays absent through condensation and five-branch emergence', async ({ page }) => {
    await bootFreshReady(page);
    await page.locator('#site-graph .site-graph-node[data-node-id="stepan-chrast"] > .site-graph-hit').click();
    await page.waitForFunction(() => document.body.classList.contains('is-entry-atlas-condensation'));

    const chromeDisplay = () => page.evaluate(() => ({
      routebar: getComputedStyle(document.querySelector('.graph-routebar')).display,
      controls: getComputedStyle(document.querySelector('#atlas-controls')).display,
      brief: getComputedStyle(document.querySelector('.profile-root-brief')).display
    }));
    expect(await chromeDisplay()).toEqual({ routebar: 'flex', controls: 'none', brief: 'none' });

    await page.waitForFunction(() => document.body.classList.contains('is-profile-root-emerging'), null, { timeout: 6_000 });
    expect(await chromeDisplay()).toEqual({ routebar: 'flex', controls: 'none', brief: 'none' });

    await page.waitForFunction(() => window.ProfileAtlasCondensation.snapshot().state === 'COMPLETE', null, { timeout: 7_000 });
    expect(await page.evaluate(() => document.body.classList.contains('is-entry-atlas-condensation'))).toBe(false);
  });

  test('entry Atlas is full-screen, removes ordinary Atlas utilities, and gives the root hero scale', async ({ page }) => {
    await bootFreshReady(page);
    const root = page.locator('#site-graph .site-graph-node[data-node-id="stepan-chrast"]').first();
    const settled = await page.evaluate(() => {
      const graph = document.querySelector('#site-graph');
      const rootNode = graph.querySelector('.site-graph-node[data-node-id="stepan-chrast"]');
      const portrait = rootNode.querySelector(':scope > [data-root-entry-portrait]');
      const hit = rootNode.querySelector(':scope > .site-graph-hit');
      const rootMatrix = rootNode.getScreenCTM();
      const profileButton = document.querySelector('.graph-routebar .atlas-button');
      return {
        viewport: { width: innerWidth, height: innerHeight },
        graph: graph.getBoundingClientRect().toJSON(),
        profileButtonVisible: Boolean(profileButton?.getClientRects().length),
        routebar: getComputedStyle(document.querySelector('.graph-routebar')).display,
        quickOverview: getComputedStyle(document.querySelector('.quick-overview-global-trigger')).display,
        controls: getComputedStyle(document.querySelector('#atlas-controls')).display,
        loader: getComputedStyle(document.querySelector('.entry-loading-shell')).display,
        loaderPointerEvents: getComputedStyle(document.querySelector('.entry-loading-shell')).pointerEvents,
        portraitWidth: Number(portrait.getAttribute('width')),
        hitRadius: Number(hit.getAttribute('r')),
        haloRadii: [...rootNode.querySelectorAll(':scope > .site-graph-halo')].map(ring => Number(ring.getAttribute('r'))),
        rootScreen: { x: rootMatrix.e, y: rootMatrix.f }
      };
    });
    expect(settled.graph.width).toBeGreaterThanOrEqual(settled.viewport.width - 1);
    expect(settled.graph.height).toBeGreaterThanOrEqual(settled.viewport.height - 1);
    expect(settled.profileButtonVisible).toBe(true);
    expect(settled.routebar).toBe('flex');
    expect(settled.quickOverview).toBe('none');
    expect(settled.controls).toBe('none');
    // The slow feathered light field may remain visible after semantic entry
    // readiness, but it is purely visual and can never block the graph.
    expect(['grid', 'none']).toContain(settled.loader);
    expect(settled.loaderPointerEvents).toBe('none');
    expect(settled.portraitWidth).toBe(96);
    expect(settled.hitRadius).toBe(254);
    expect(settled.haloRadii).toEqual([132, 228]);
    expect(settled.rootScreen.x).toBeCloseTo(settled.viewport.width / 2, 0);
    expect(settled.rootScreen.y).toBeCloseTo(settled.viewport.height / 2 + 16, 0);

    const idleMaterial = await root.evaluate(node => ({
      portraitScale: new DOMMatrixReadOnly(getComputedStyle(node.querySelector(':scope > [data-root-entry-portrait]')).transform).a,
      haloScales: [...node.querySelectorAll(':scope > .site-graph-halo')]
        .map(halo => new DOMMatrixReadOnly(getComputedStyle(halo).transform).a)
    }));
    await root.hover();
    await expect.poll(() => page.evaluate(() => window.ProfileRootEntryPortal.snapshot().open)).toBe(true);
    await page.waitForTimeout(460);
    const expanded = await root.evaluate(node => {
      const portrait = node.querySelector(':scope > [data-root-entry-portrait]');
      const matrix = new DOMMatrixReadOnly(getComputedStyle(portrait).transform);
      const halos = [...node.querySelectorAll(':scope > .site-graph-halo')];
      const action = node.querySelector(':scope > [data-root-entry-action]');
      return {
        scale: matrix.a,
        opacity: Number(getComputedStyle(portrait).opacity),
        haloDurations: halos.map(halo => parseFloat(getComputedStyle(halo).animationDuration)),
        haloScales: halos.map(halo => new DOMMatrixReadOnly(getComputedStyle(halo).transform).a),
        primaryStroke: getComputedStyle(halos[0]).stroke,
        secondaryStroke: getComputedStyle(halos[1]).stroke,
        actionScale: new DOMMatrixReadOnly(getComputedStyle(action).transform).a
      };
    });
    expect(expanded.scale).toBeGreaterThan(3.2);
    expect(expanded.opacity).toBeGreaterThan(.95);
    expect(expanded.haloDurations[0]).toBeGreaterThan(0);
    expect(expanded.haloDurations[0]).toBeLessThan(4);
    expect(expanded.haloDurations[1]).toBe(0);
    expect(expanded.haloScales).toHaveLength(2);
    expect(expanded.haloScales[0]).toBeLessThan(idleMaterial.haloScales[0]);
    expect(expanded.haloScales[1]).toBeLessThan(idleMaterial.haloScales[1]);
    expect(expanded.haloScales[0]).toBeLessThan(.95);
    expect(expanded.haloScales[1]).toBeLessThan(.98);
    expect(expanded.secondaryStroke).not.toBe(expanded.primaryStroke);
    expect(expanded.actionScale).toBeGreaterThan(1.5);

    await page.mouse.move(12, 12);
    await expect.poll(() => page.evaluate(() => window.ProfileRootEntryPortal.snapshot().open)).toBe(false);
    await page.waitForTimeout(650);
    const restored = await root.evaluate(node => ({
      portraitScale: new DOMMatrixReadOnly(getComputedStyle(node.querySelector(':scope > [data-root-entry-portrait]')).transform).a,
      haloScales: [...node.querySelectorAll(':scope > .site-graph-halo')]
        .map(halo => new DOMMatrixReadOnly(getComputedStyle(halo).transform).a),
      haloDurations: [...node.querySelectorAll(':scope > .site-graph-halo')]
        .map(halo => parseFloat(getComputedStyle(halo).animationDuration))
    }));
    expect(restored.portraitScale).toBeCloseTo(idleMaterial.portraitScale, 2);
    restored.haloScales.forEach((scale, index) => expect(scale).toBeCloseTo(idleMaterial.haloScales[index], 2));
    expect(restored.haloDurations.every(duration => duration >= 14)).toBe(true);
  });

  test('exploration LOD begins only after a deliberate zoom command', async ({ page }) => {
    await bootFreshReady(page);
    await page.evaluate(() => window.ProfileAtlasLOD.setScale(.55, { immediate: true }));
    const state = await page.evaluate(() => window.ProfileAtlasLOD.snapshot());
    expect(state.topologyMode).toBe('exploration-lod');
    expect(state.lod).toBe('far');
    expect(state.hiddenNodeCount).toBeGreaterThan(0);
  });

  test('the whole persistent root is one button and its CTA is visual-only', async ({ page }) => {
    await bootAtlas(page);
    const root = page.locator('#site-graph .site-graph-node[data-node-id="stepan-chrast"]').first();
    const action = root.locator(':scope > [data-root-entry-action]');
    await expect(root).toHaveAttribute('aria-label', 'Enter profile - Štěpán Chrast');
    await expect(action).toHaveAttribute('tabindex', '-1');
    await expect(action).toHaveAttribute('aria-hidden', 'true');
    await root.locator(':scope > .site-graph-hit').click();
    await page.waitForFunction(() => document.body.dataset.entryState === 'profile' && document.body.dataset.graphMode === 'overview');
    expect(await page.locator('#site-graph .site-graph-node[data-node-id="stepan-chrast"]').count()).toBe(1);
  });

  test('condensation captures every non-root node after the Atlas camera settles at the shared entry composition', async ({ page }) => {
    await bootAtlas(page);
    await page.evaluate(() => {
      window.ProfileAtlasLOD.setTopologyMode('entry-full', { reason: 'contract-test' });
    });
    await page.locator('#site-graph .site-graph-node[data-node-id="stepan-chrast"] > .site-graph-hit').click();
    await page.waitForFunction(() => window.ProfileAtlasCondensation.snapshot().state === 'CONDENSING');
    const state = await page.evaluate(() => ({
      condensation: window.ProfileAtlasCondensation.snapshot(),
      camera: window.ProfileAtlasLOD.snapshot().camera
    }));
    expect(state.condensation.nodeCount).toBe(state.condensation.expectedNodeCount);
    expect(state.condensation.initialTopologyMode).toBe('entry-full');
    expect(state.camera.x).toBeCloseTo(state.condensation.initialCamera.x, 4);
    expect(state.camera.y).toBeCloseTo(state.condensation.initialCamera.y, 4);
    expect(state.camera.scale).toBeCloseTo(state.condensation.initialCamera.scale, 4);
    await page.evaluate(() => window.ProfileAtlasCondensation.cancel('contract-test'));
    await page.waitForFunction(() => window.ProfileAtlasCondensation.snapshot().state === 'CANCELLED');
  });

  test('Profile Root waits for semantic graph settlement, not a fixed 510 ms delay', async ({ page }) => {
    await bootAtlas(page);
    await page.evaluate(() => {
      window.__profileSettledEvents = 0;
      addEventListener('profile:graph-render-settled', event => {
        if (event.detail?.mode === 'overview') window.__profileSettledEvents += 1;
      });
    });
    await page.locator('#site-graph .site-graph-node[data-node-id="stepan-chrast"] > .site-graph-hit').click();
    await page.waitForFunction(() => window.ProfileAtlasCondensation.snapshot().state === 'COMPLETE', null, { timeout: 7_000 });
    expect(await page.evaluate(() => window.__profileSettledEvents)).toBeGreaterThan(0);
    const source = await (await page.request.get('/atlas-condensation.js')).text();
    expect(source).not.toContain('setTimeout(resolve, 510)');
  });
});
