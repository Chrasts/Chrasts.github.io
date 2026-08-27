const { test, expect } = require('@playwright/test');

const bypassIntro = async page => {
  await page.addInitScript(() => sessionStorage.setItem('profileIntroSeen', 'true'));
  await page.route('https://cloud.umami.is/**', route => route.abort()).catch(() => {});
};

const waitForWork = async page => {
  await page.waitForFunction(() => Boolean(
    window.ProfileWorkController &&
    window.ProfileScene?.manager &&
    document.body.dataset.graphMode === 'work' &&
    document.body.dataset.graphRoute === 'work' &&
    !document.body.classList.contains('is-v9-transitioning') &&
    document.querySelectorAll('.work-project-anchor-v5[data-project-id]').length
  ));
};

const enterProject = async (page, projectId, bindingId) => {
  if (await page.evaluate(() => document.body.dataset.graphRoute !== 'work')) {
    await page.evaluate(() => { location.hash = '#work'; });
    await waitForWork(page);
  }

  const anchor = page.locator(`.work-project-anchor-v5[data-project-id="${projectId}"]`).first();
  await expect(anchor).toBeVisible();
  await anchor.click();

  const route = `work/project/${projectId}`;
  await page.waitForFunction(expected => document.body.dataset.graphRoute === expected, route);
  await page.waitForFunction(expected => window.ProfileScene?.manager?.context?.().route === expected, route);
  await page.waitForFunction(() => !document.body.classList.contains('is-v9-transitioning'));
  await page.waitForFunction(() => Boolean(window.ProfileArtifactScenes && window.ProfileSceneComposer));
  await page.waitForFunction(id => {
    const root = document.querySelector(`[data-artifact-scene="${CSS.escape(id)}"]`);
    if (!root || root.hidden || root.dataset.sceneVisible !== 'true') return false;
    const style = getComputedStyle(root);
    const rect = root.getBoundingClientRect();
    return style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      Number(style.opacity || 1) > .5 &&
      rect.width > 1 && rect.height > 1;
  }, bindingId);
};

const renderedArtifactState = async (page, bindingId) => page.evaluate(id => {
  const root = document.querySelector(`[data-artifact-scene="${CSS.escape(id)}"]`);
  const canvas = document.querySelector('.scene-canvas') ||
    document.querySelector('.site-shell') ||
    document.documentElement;
  if (!root || !canvas) return null;

  const visible = element => {
    if (!element?.getClientRects().length) return false;
    const style = getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > .03;
  };
  const union = rects => rects.reduce((result, rect) => ({
    left: Math.min(result.left, rect.left),
    top: Math.min(result.top, rect.top),
    right: Math.max(result.right, rect.right),
    bottom: Math.max(result.bottom, rect.bottom)
  }), { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity });

  const media = [...root.querySelectorAll('.artifact-deck-card,.artifact-folio-page')].filter(visible);
  const visual = [root, ...media, ...root.querySelectorAll('.artifact-orbit-actions')]
    .filter(visible)
    .map(element => element.getBoundingClientRect())
    .filter(rect => rect.width > .5 && rect.height > .5);
  const footprint = union(visual);
  const canvasRect = canvas.getBoundingClientRect();

  const interactive = media[0] || root.querySelector('a,button,[data-artifact-focus]');
  let artifactOwnsHitPlane = false;
  if (interactive) {
    const rect = interactive.getBoundingClientRect();
    const x = Math.max(0, Math.min(innerWidth - 1, rect.left + rect.width / 2));
    const y = Math.max(0, Math.min(innerHeight - 1, rect.top + rect.height / 2));
    const stack = document.elementsFromPoint(x, y);
    const artifactIndex = stack.findIndex(element => root.contains(element) || element === root);
    const graphIndex = stack.findIndex(element => element.closest?.('#site-graph'));
    artifactOwnsHitPlane = artifactIndex >= 0 && (graphIndex < 0 || artifactIndex < graphIndex);
  }

  return {
    hidden: root.hidden,
    sceneVisible: root.dataset.sceneVisible,
    sceneComposed: root.dataset.sceneComposed,
    mediaCount: media.length,
    footprint,
    canvas: {
      left: canvasRect.left,
      top: canvasRect.top,
      right: canvasRect.right,
      bottom: canvasRect.bottom
    },
    artifactOwnsHitPlane
  };
}, bindingId);

test('Work project clicks reveal Thesis, Modal Logic Lab and Axiom Wilds artifacts', async ({ page }) => {
  await bypassIntro(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#work');
  await waitForWork(page);

  const cases = [
    ['bachelor-thesis', 'bachelor-thesis-diagrams'],
    ['modal-logic-lab', 'modal-logic-lab-screens'],
    ['axiom-wilds', 'axiom-wilds-gameplay']
  ];

  for (const [projectId, bindingId] of cases) {
    await enterProject(page, projectId, bindingId);
    const root = page.locator(`[data-artifact-scene="${bindingId}"]`);
    await expect(root).toBeVisible();

    const state = await renderedArtifactState(page, bindingId);
    expect(state, `${bindingId} should exist`).not.toBeNull();
    expect(state.hidden).toBe(false);
    expect(state.sceneVisible).toBe('true');
    expect(state.sceneComposed).toBe('true');
    expect(state.mediaCount).toBeGreaterThan(0);
    expect(state.footprint.left).toBeGreaterThanOrEqual(state.canvas.left + 18);
    expect(state.footprint.right).toBeLessThanOrEqual(state.canvas.right - 18);
    expect(state.footprint.top).toBeGreaterThanOrEqual(state.canvas.top + 18);
    expect(state.footprint.bottom).toBeLessThanOrEqual(state.canvas.bottom - 18);
    expect(state.artifactOwnsHitPlane).toBe(true);
  }
});
