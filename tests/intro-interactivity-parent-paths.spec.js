const { test, expect } = require('@playwright/test');

const blockAnalytics = page => page.route('https://cloud.umami.is/**', route => route.abort()).catch(() => {});

test.describe('Intro interactivity and Atlas relation colors', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('the Atlas stays inert through reveal and unlocks at ATLAS_READY', async ({ page }) => {
    await page.addInitScript(() => sessionStorage.removeItem('profileIntroSeen'));
    await blockAnalytics(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await page.waitForFunction(() =>
      window.ProfileIntro?.snapshot?.().state === 'ATLAS_REVEAL' &&
      document.body.classList.contains('is-atlas-reveal-late'),
    null, { timeout: 20_000 });

    const duringReveal = await page.evaluate(() => ({
      introState: window.ProfileIntro.snapshot().state,
      shellPointerEvents: getComputedStyle(document.querySelector('.entry-loading-shell')).pointerEvents,
      workPointerEvents: getComputedStyle(document.querySelector('#site-graph .site-graph-node[data-node-id="work"]')).pointerEvents,
      rootPointerEvents: getComputedStyle(document.querySelector('#site-graph .site-graph-node[data-node-id="stepan-chrast"]')).pointerEvents,
      rootHitPointerEvents: getComputedStyle(document.querySelector('#site-graph .site-graph-node[data-node-id="stepan-chrast"] > .site-graph-hit')).pointerEvents,
      rootPreviewAvailable: window.ProfileRootEntryPortal?.snapshot?.().previewAvailable
    }));

    expect(duringReveal.introState).toBe('ATLAS_REVEAL');
    expect(duringReveal.shellPointerEvents).toBe('none');
    expect(duringReveal.workPointerEvents).toBe('none');
    expect(duringReveal.rootPointerEvents).toBe('none');
    expect(duringReveal.rootHitPointerEvents).toBe('none');
    expect(duringReveal.rootPreviewAvailable).toBe(false);

    await page.waitForFunction(() => window.ProfileIntro?.snapshot?.().state === 'ATLAS_READY', null, { timeout: 10_000 });

    const afterReady = await page.evaluate(() => ({
      workPointerEvents: getComputedStyle(document.querySelector('#site-graph .site-graph-node[data-node-id="work"]')).pointerEvents,
      rootPointerEvents: getComputedStyle(document.querySelector('#site-graph .site-graph-node[data-node-id="stepan-chrast"]')).pointerEvents
    }));

    expect(afterReady.workPointerEvents).not.toBe('none');
    expect(afterReady.rootPointerEvents).not.toBe('none');

    await page.locator('#site-graph .site-graph-node[data-node-id="work"] > .site-graph-hit').hover();
    await expect.poll(() => page.evaluate(() => window.ProfileNodeInteraction?.snapshot?.().hoveredNodeId)).toBe('work');
  });

  test('hovering or clicking the root during reveal cannot preview or skip into profile Atlas', async ({ page }) => {
    await page.addInitScript(() => sessionStorage.removeItem('profileIntroSeen'));
    await blockAnalytics(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.ProfileIntro?.snapshot?.().state === 'ATLAS_REVEAL', null, { timeout: 20_000 });
    await page.waitForTimeout(700);

    const rootHit = page.locator('#site-graph .site-graph-node[data-node-id="stepan-chrast"] > .site-graph-hit').first();
    const box = await rootHit.boundingBox();
    expect(box).not.toBeNull();

    const before = await page.evaluate(() => ({
      introState: window.ProfileIntro.snapshot().state,
      entryState: document.body.dataset.entryState,
      portraitTransform: getComputedStyle(document.querySelector('#site-graph [data-node-id="stepan-chrast"] > .root-entry-portrait')).transform,
      portal: window.ProfileRootEntryPortal.snapshot(),
      condensationState: window.ProfileAtlasCondensation?.snapshot?.().state || null
    }));

    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.waitForTimeout(120);
    await page.mouse.click(x, y);
    await page.waitForTimeout(180);

    const after = await page.evaluate(() => ({
      introState: window.ProfileIntro.snapshot().state,
      entryState: document.body.dataset.entryState,
      portraitTransform: getComputedStyle(document.querySelector('#site-graph [data-node-id="stepan-chrast"] > .root-entry-portrait')).transform,
      portal: window.ProfileRootEntryPortal.snapshot(),
      condensationState: window.ProfileAtlasCondensation?.snapshot?.().state || null
    }));

    expect(before.introState).toBe('ATLAS_REVEAL');
    expect(after.introState).toBe('ATLAS_REVEAL');
    expect(after.entryState).toBe('reveal');
    expect(after.portal.previewAvailable).toBe(false);
    expect(after.portal.open).toBe(false);
    expect(after.portal.entering).toBe(false);
    expect(after.portraitTransform).toBe(before.portraitTransform);
    expect(after.condensationState).toBe(before.condensationState);
  });

  test('the root previews and enters the profile on the first click once Atlas is ready', async ({ page }) => {
    await page.addInitScript(() => sessionStorage.removeItem('profileIntroSeen'));
    await blockAnalytics(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.ProfileIntro?.snapshot?.().state === 'ATLAS_READY', null, { timeout: 20_000 });

    const root = page.locator('#site-graph .site-graph-node[data-node-id="stepan-chrast"]').first();
    await root.hover();
    await expect.poll(() => page.evaluate(() => window.ProfileRootEntryPortal?.snapshot?.().open)).toBe(true);

    const preview = await page.evaluate(() => window.ProfileRootEntryPortal.snapshot());
    expect(preview.previewAvailable).toBe(true);
    expect(preview.introState).toBe('ATLAS_READY');

    await root.locator(':scope > .site-graph-hit').click();
    await page.waitForFunction(() => {
      const state = window.ProfileAtlasCondensation?.snapshot?.().state;
      return ['PREPARING', 'CONDENSING', 'COMMITTING', 'COMPLETE'].includes(state);
    }, null, { timeout: 8_000 });
    expect(await page.evaluate(() => window.ProfileIntro.snapshot().state)).not.toBe('ATLAS_REVEAL');
  });

  test('Atlas hover uses brown parent paths and teal child paths', async ({ page }) => {
    await page.addInitScript(() => sessionStorage.setItem('profileIntroSeen', 'true'));
    await blockAnalytics(page);
    await page.goto('/#atlas', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.ProfileAtlasLOD && window.ProfileNodeInteraction);

    await page.evaluate(() => {
      window.ProfileAtlasLOD.setTopologyMode('entry-full', { reason: 'relation-color-regression' });
      const scale = window.ProfileAtlasLOD.snapshot().camera?.scale;
      if (Number.isFinite(scale)) window.ProfileAtlasLOD.applyLOD(scale);
    });

    await page.locator('#site-graph .site-graph-node[data-node-id="knowledge"] > .site-graph-hit').hover();
    await page.waitForFunction(() =>
      document.querySelector('#site-graph .site-graph-edges path.is-upstream') &&
      document.querySelector('#site-graph .site-graph-edges path.is-downstream')
    );

    const colors = await page.evaluate(() => {
      const normaliseCssColor = value => {
        const probe = document.createElement('span');
        probe.style.color = value;
        document.body.appendChild(probe);
        const color = getComputedStyle(probe).color;
        probe.remove();
        return color;
      };
      const rootStyle = getComputedStyle(document.documentElement);
      const upstream = document.querySelector('#site-graph .site-graph-edges path.is-upstream');
      const downstream = document.querySelector('#site-graph .site-graph-edges path.is-downstream');
      return {
        upstream: getComputedStyle(upstream).stroke,
        downstream: getComputedStyle(downstream).stroke,
        brown: normaliseCssColor(rootStyle.getPropertyValue('--brown').trim()),
        teal: normaliseCssColor(rootStyle.getPropertyValue('--teal').trim())
      };
    });

    expect(colors.upstream).toBe(colors.brown);
    expect(colors.downstream).toBe(colors.teal);
    expect(colors.upstream).not.toBe(colors.downstream);
  });
});
