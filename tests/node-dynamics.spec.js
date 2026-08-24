const { test, expect } = require('@playwright/test');

const boot = async (page, route = 'knowledge', { reducedMotion = false, viewport = { width: 1280, height: 800 } } = {}) => {
  if (reducedMotion) await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => sessionStorage.setItem('profileIntroSeen', 'true'));
  await page.route('https://cloud.umami.is/**', route => route.abort()).catch(() => {});
  await page.setViewportSize(viewport);
  await page.goto(`/#${route}`);
  await page.waitForFunction(() => Boolean(window.ProfileNodeDynamics && window.ProfileNodeInteraction && window.ProfileGraphFeel));
  await page.waitForFunction(() => !document.body.classList.contains('is-v9-transitioning'));
  await page.waitForFunction(() => window.ProfileNodeDynamics.snapshot().nodeCount > 1);
  await page.waitForTimeout(120);
};

const canonicalNodes = page => page.evaluate(() => Object.fromEntries(
  [...document.querySelectorAll('#site-graph .site-graph-node[data-node-id]')]
    .filter(node => !node.closest('.v9-transition-overlay'))
    .map(node => [node.dataset.nodeId, {
      x: Number(node.dataset.x),
      y: Number(node.dataset.y),
      transform: node.getAttribute('transform')
    }])
));

const retargetPointer = (page, id) => page.evaluate(nextId => {
  const selector = '#site-graph .site-graph-node[data-node-id]';
  const currentId = window.ProfileNodeInteraction?.snapshot?.().hoveredNodeId;
  const current = currentId
    ? document.querySelector(`${selector}[data-node-id="${CSS.escape(currentId)}"]`)
    : null;
  const next = document.querySelector(`${selector}[data-node-id="${CSS.escape(nextId)}"]`);
  if (!next) throw new Error(`Missing graph node ${nextId}`);
  if (current && current !== next) {
    current.dispatchEvent(new PointerEvent('pointerout', {
      bubbles: true,
      pointerType: 'mouse',
      relatedTarget: next
    }));
  }
  next.dispatchEvent(new PointerEvent('pointerover', {
    bubbles: true,
    pointerType: 'mouse',
    relatedTarget: current
  }));
}, id);

const displacement = state => Math.hypot(state.offsetX, state.offsetY);

test.describe('V3.1 Phase C soft node dynamics', () => {
  test('hover creates bounded local pressure without changing canonical layout', async ({ page }) => {
    await boot(page, 'knowledge');
    const before = await canonicalNodes(page);
    const active = page.locator('#site-graph .site-graph-node[data-node-id="logic-math"]');
    await active.hover();

    await expect.poll(() => page.evaluate(() => window.ProfileNodeDynamics.snapshot().activeNodeId)).toBe('logic-math');
    await expect.poll(() => page.evaluate(() => window.ProfileNodeDynamics.snapshot().maxDisplacement)).toBeGreaterThan(.75);

    const result = await page.evaluate(() => {
      const snapshot = window.ProfileNodeDynamics.snapshot();
      const states = [...document.querySelectorAll('#site-graph .site-graph-node[data-node-id]')]
        .filter(node => !node.closest('.v9-transition-overlay'))
        .map(node => window.ProfileNodeDynamics.stateFor(node.dataset.nodeId))
        .filter(Boolean);
      return { snapshot, states };
    });

    const activeState = result.states.find(state => state.id === 'logic-math');
    const neighbours = result.states.filter(state => state.id !== 'logic-math').sort((a, b) => displacement(b) - displacement(a));
    expect(activeState.scale).toBeGreaterThan(1.02);
    expect(displacement(activeState)).toBeLessThan(.15);
    expect(displacement(neighbours[0])).toBeGreaterThan(.75);
    expect(result.snapshot.maxDisplacement).toBeLessThanOrEqual(result.snapshot.config.maxDisplacement + .05);
    expect(result.snapshot.adaptedEdgeCount).toBeGreaterThan(0);

    const after = await canonicalNodes(page);
    for (const [id, point] of Object.entries(before)) {
      expect(after[id].x).toBe(point.x);
      expect(after[id].y).toBe(point.y);
    }
  });

  test('Atlas displacement falls off locally and leaves distant topology still', async ({ page }) => {
    await boot(page, 'atlas');
    const active = page.locator('#site-graph .site-graph-node[data-node-id="knowledge"]');
    await active.hover();
    await expect.poll(() => page.evaluate(() => window.ProfileNodeDynamics.snapshot().maxDisplacement)).toBeGreaterThan(.35);

    const field = await page.evaluate(() => {
      const activeState = window.ProfileNodeDynamics.stateFor('knowledge');
      const config = window.ProfileNodeDynamics.snapshot().config;
      const points = [...document.querySelectorAll('#site-graph .site-graph-node[data-node-id]')]
        .filter(node => !node.closest('.v9-transition-overlay'))
        .map(node => {
          const state = window.ProfileNodeDynamics.stateFor(node.dataset.nodeId);
          return {
            id: state.id,
            distance: Math.hypot(state.canonicalX - activeState.canonicalX, state.canonicalY - activeState.canonicalY),
            displacement: Math.hypot(state.offsetX, state.offsetY)
          };
        });
      return { config, points };
    });

    const near = field.points.filter(item => item.id !== 'knowledge' && item.distance < field.config.influenceRadius).sort((a, b) => b.displacement - a.displacement);
    const far = field.points.filter(item => item.distance > field.config.influenceRadius + 20);
    expect(near.length).toBeGreaterThan(0);
    expect(near[0].displacement).toBeGreaterThan(.35);
    expect(far.length).toBeGreaterThan(0);
    expect(Math.max(...far.map(item => item.displacement))).toBeLessThan(.08);
  });

  test('rapid Atlas retargeting at zoom does not accumulate overlapping fields or violate the clamp', async ({ page }) => {
    await boot(page, 'atlas');
    const before = await canonicalNodes(page);
    await page.evaluate(() => window.ProfileAtlasLOD?.setScale?.(1.8, { immediate: true }));

    // Exercise the interaction contract directly: after zoom, some semantic nodes are
    // intentionally outside the physical viewport, but the state/dynamics pipeline must
    // still handle rapid retargeting without retaining overlapping fields.
    await retargetPointer(page, 'knowledge');
    await expect.poll(() => page.evaluate(() => window.ProfileNodeDynamics.snapshot().activeNodeId)).toBe('knowledge');
    await retargetPointer(page, 'experience');
    await retargetPointer(page, 'education');
    await expect.poll(() => page.evaluate(() => window.ProfileNodeDynamics.snapshot().activeNodeId)).toBe('education');
    await page.waitForTimeout(120);

    const snapshot = await page.evaluate(() => window.ProfileNodeDynamics.snapshot());
    expect(snapshot.config.mode).toBe('atlas');
    expect(snapshot.maxDisplacement).toBeLessThanOrEqual(snapshot.config.maxDisplacement + .05);
    expect(snapshot.movingNodeCount).toBeLessThan(snapshot.nodeCount);

    const after = await canonicalNodes(page);
    for (const [id, point] of Object.entries(before)) {
      expect(after[id].x).toBe(point.x);
      expect(after[id].y).toBe(point.y);
    }
  });

  test('mobile composition weakens the field rather than reusing desktop displacement', async ({ page }) => {
    await boot(page, 'atlas', { viewport: { width: 390, height: 844 } });
    const node = page.locator('#site-graph .site-graph-node[data-node-id="knowledge"]');
    await node.hover({ force: true });
    await expect.poll(() => page.evaluate(() => window.ProfileNodeDynamics.snapshot().activeNodeId)).toBe('knowledge');
    await page.waitForTimeout(140);

    const snapshot = await page.evaluate(() => window.ProfileNodeDynamics.snapshot());
    expect(snapshot.config.mode).toBe('atlas');
    expect(snapshot.config.maxDisplacement).toBeLessThan(6);
    expect(snapshot.maxDisplacement).toBeLessThanOrEqual(snapshot.config.maxDisplacement + .05);
  });

  test('leaving a node springs every visual offset and adapted edge exactly back to rest', async ({ page }) => {
    await boot(page, 'knowledge');
    const active = page.locator('#site-graph .site-graph-node[data-node-id="logic-math"]');
    await active.hover();
    await expect.poll(() => page.evaluate(() => window.ProfileNodeDynamics.snapshot().maxDisplacement)).toBeGreaterThan(.75);

    await page.mouse.move(12, 12);
    await expect.poll(() => page.evaluate(() => window.ProfileNodeInteraction.snapshot().primaryNodeId)).toBeNull();
    await expect.poll(() => page.evaluate(() => window.ProfileNodeDynamics.snapshot().movingNodeCount), { timeout: 4000 }).toBe(0);

    const settled = await page.evaluate(() => {
      const snapshot = window.ProfileNodeDynamics.snapshot();
      const nodes = [...document.querySelectorAll('#site-graph .site-graph-node[data-node-id]')]
        .filter(node => !node.closest('.v9-transition-overlay'))
        .map(node => ({
          id: node.dataset.nodeId,
          expected: `translate(${Number(node.dataset.x).toFixed(1)} ${Number(node.dataset.y).toFixed(1)})`,
          actual: node.getAttribute('transform'),
          scale: node.style.getPropertyValue('--node-dynamics-scale')
        }));
      return { snapshot, nodes };
    });

    expect(settled.snapshot.maxDisplacement).toBeLessThan(.08);
    expect(settled.snapshot.adaptedEdgeCount).toBe(0);
    settled.nodes.forEach(node => {
      expect(node.actual).toBe(node.expected);
      expect(node.scale).toBe('');
    });
  });

  test('route transitions preempt ephemeral physics before structural geometry takes ownership', async ({ page }) => {
    await boot(page, 'knowledge');
    await page.locator('#site-graph .site-graph-node[data-node-id="logic-math"]').hover();
    await expect.poll(() => page.evaluate(() => window.ProfileNodeDynamics.snapshot().maxDisplacement)).toBeGreaterThan(.75);

    await page.locator('#site-graph .site-graph-node[data-node-id="stepan-chrast"]').click();
    await page.waitForFunction(() => document.body.classList.contains('is-v9-transitioning'));
    const during = await page.evaluate(() => window.ProfileNodeDynamics.snapshot());
    expect(during.suspended).toBe(true);
    expect(during.maxDisplacement).toBeLessThan(.05);
    expect(during.adaptedEdgeCount).toBe(0);

    await page.waitForFunction(() => !document.body.classList.contains('is-v9-transitioning'));
    await expect.poll(() => page.evaluate(() => window.ProfileNodeDynamics.snapshot().suspended)).toBe(false);
  });

  test('reduced motion preserves interaction semantics with displacement disabled', async ({ page }) => {
    await boot(page, 'knowledge', { reducedMotion: true });
    const node = page.locator('#site-graph .site-graph-node[data-node-id="logic-math"]');
    await node.hover();
    await expect.poll(() => page.evaluate(() => window.ProfileNodeInteraction.snapshot().primaryNodeId)).toBe('logic-math');
    await page.waitForTimeout(180);

    const state = await page.evaluate(() => ({
      dynamics: window.ProfileNodeDynamics.snapshot(),
      interaction: window.ProfileNodeInteraction.stateFor('logic-math')
    }));
    expect(state.dynamics.enabled).toBe(false);
    expect(state.dynamics.maxDisplacement).toBe(0);
    expect(state.dynamics.adaptedEdgeCount).toBe(0);
    expect(state.interaction.state).toBe('hovered');
  });
});
