const { test, expect } = require('@playwright/test');

const boot = async (page, route = 'overview') => {
  await page.addInitScript(() => {
    sessionStorage.setItem('profileIntroSeen', 'true');
    sessionStorage.setItem('profileRootReached', 'true');
  });
  await page.route('https://cloud.umami.is/**', request => request.abort()).catch(() => {});
  await page.goto(`/#${route}`);
  await page.waitForFunction(() => Boolean(window.ProfileMotionRefinements));
  await page.waitForFunction(() => !document.body.classList.contains('is-v9-transitioning'));
};

test.describe('Profile motion refinements', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('Profile Root keeps the compact left column, removes redundant guidance and drops Junior from the visible summary', async ({ page }) => {
    await boot(page, 'overview');
    await page.waitForFunction(() =>
      document.body.dataset.graphMode === 'overview' &&
      document.body.dataset.rootLanding === 'false' &&
      document.body.classList.contains('is-profile-root-ready'));

    const result = await page.evaluate(() => {
      const brief = document.querySelector('.profile-root-brief');
      const rect = brief?.getBoundingClientRect();
      const summary = document.querySelector('.profile-root-summary')?.textContent?.trim() || '';
      const help = document.querySelector('#site-graph-help');
      return {
        summary,
        guides: document.querySelectorAll('.profile-root-guide').length,
        helpDisplay: help ? getComputedStyle(help).display : null,
        width: rect?.width || 0,
        height: rect?.height || 0,
        columns: brief ? getComputedStyle(brief).gridTemplateColumns : ''
      };
    });

    expect(result.summary).not.toMatch(/^Junior\b/i);
    expect(result.guides).toBe(0);
    expect(result.helpDisplay).toBe('none');
    expect(result.width).toBeLessThanOrEqual(340);
    expect(result.height).toBeLessThan(210);
    expect(result.columns.split(' ').length).toBe(1);
  });

  test('five Profile Root nodes settle before their root relations are drawn', async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('profileIntroSeen', 'true');
      sessionStorage.removeItem('profileRootReached');
    });
    await page.route('https://cloud.umami.is/**', request => request.abort()).catch(() => {});
    await page.goto('/#atlas');
    await page.waitForFunction(() => Boolean(
      window.ProfileMotionRefinements &&
      window.ProfileRootEntryPortal &&
      window.ProfileAtlasCondensation));

    await page.evaluate(() => window.ProfileRootEntryPortal.enterProfile('profile-motion-test'));
    await page.waitForFunction(() => document.body.dataset.profileBranchEdgePhase === 'nodes', null, { timeout: 7_000 });

    const nodePhase = await page.evaluate(() => ({
      emerging: document.body.classList.contains('is-profile-root-emerging'),
      visibleEdges: [...document.querySelectorAll('#site-graph .site-graph-edges path[data-profile-main-edge="true"]')]
        .filter(path => Number(getComputedStyle(path).opacity) > .03).length
    }));
    expect(nodePhase.emerging).toBe(true);
    expect(nodePhase.visibleEdges).toBe(0);

    await page.waitForFunction(() => document.body.dataset.profileBranchEdgePhase === 'drawing', null, { timeout: 7_000 });
    const relationPhase = await page.evaluate(() => {
      const sections = ['work', 'knowledge', 'experience', 'education', 'about'];
      return {
        emerging: document.body.classList.contains('is-profile-root-emerging'),
        sectionsPresent: sections.filter(id => document.querySelector(`#site-graph .site-graph-node[data-node-id="${id}"]`)).length,
        movingWrappers: document.querySelectorAll('.profile-root-emergence-motion').length,
        drawingEdges: document.querySelectorAll('#site-graph .site-graph-edges path[data-profile-main-edge="true"]').length
      };
    });
    expect(relationPhase.emerging).toBe(false);
    expect(relationPhase.sectionsPresent).toBe(5);
    expect(relationPhase.movingWrappers).toBe(0);
    expect(relationPhase.drawingEdges).toBe(5);

    await page.waitForFunction(() => document.body.dataset.profileBranchEdgePhase === 'settled');
  });

  test('Profile to Atlas delegates to the shared root-collapse/full-unfold owner', async ({ page }) => {
    await boot(page, 'overview');
    await page.waitForFunction(() => document.body.classList.contains('is-profile-root-ready'));
    await page.locator('[data-route="atlas"]').first().click();
    await page.waitForFunction(() => document.body.dataset.profileAtlasPhase === 'collapse');
    await expect(page.locator('.profile-atlas-unfold-bridge')).toHaveCount(1);
    await expect(page.locator('.profile-hierarchy-atlas-bridge')).toHaveCount(0);
    await page.waitForFunction(() => document.body.dataset.profileAtlasPhase === 'unfold', null, { timeout: 5_000 });
    await page.waitForFunction(() => document.body.dataset.graphMode === 'atlas' && !window.ProfileAtlasFocus?.snapshot?.().active, null, { timeout: 12_000 });

    const result = await page.evaluate(() => ({
      focus: window.ProfileAtlasFocus.snapshot(),
      motion: window.ProfileMotionRefinements.snapshot(),
      topology: window.ProfileAtlasLOD?.snapshot?.().topologyMode || document.body.dataset.atlasTopology || null,
      hidden: document.querySelectorAll('#site-graph .site-graph-node.is-atlas-lod-hidden').length,
      mode: document.body.dataset.graphMode
    }));

    expect(result.mode).toBe('atlas');
    expect(result.topology).toBe('entry-full');
    expect(result.hidden).toBe(0);
    expect(result.focus.lastResult.targetRoute).toBe('atlas');
    expect(result.motion.active).toBe(false);
  });
});
