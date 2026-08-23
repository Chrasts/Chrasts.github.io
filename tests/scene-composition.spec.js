const { test, expect } = require('@playwright/test');

const boot = async (page, route) => {
  await page.addInitScript(() => sessionStorage.setItem('profileIntroSeen', 'true'));
  await page.route('https://cloud.umami.is/**', route => route.abort()).catch(() => {});
  await page.goto(`/#${route}`);
  await page.waitForFunction(() => Boolean(
    window.ProfileSceneComposer &&
    window.ProfileArtifactScenes &&
    window.ProfileScene?.manager
  ));
  await page.waitForFunction(() => !document.body.classList.contains('is-v9-transitioning'));
  await page.waitForTimeout(260);
};

test.describe('Phase D scene composition', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('Hedgehog gallery resolves around the inspector and remains visually contained', async ({ page }) => {
    await boot(page, 'about/woodworking/hedgehog-house');

    const gallery = page.locator('[data-artifact-scene="hedgehog-house-gallery"]');
    await expect(gallery).toBeVisible();
    await expect(gallery).toHaveAttribute('data-scene-zone', 'side-stage');
    await expect(gallery).toHaveAttribute('data-scene-side', 'left');
    await expect(gallery).toHaveAttribute('data-artifact-side', 'left');
    await expect(gallery).toHaveAttribute('data-scene-collision-adjusted', /blocked-right|stacked-left/);

    const boxes = await gallery.locator('.artifact-deck-card').evaluateAll(elements => elements.map(element => {
      const box = element.getBoundingClientRect();
      return { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
    }));
    boxes.forEach(box => {
      expect(box.left).toBeGreaterThanOrEqual(20);
      expect(box.right).toBeLessThanOrEqual(1260);
      expect(box.top).toBeGreaterThanOrEqual(54);
      expect(box.bottom).toBeLessThanOrEqual(800);
    });

    const snapshot = await page.evaluate(() => window.ProfileSceneComposer.snapshot());
    const inspector = snapshot.assignments.find(item => item.id === 'detail-panel');
    const artifact = snapshot.assignments.find(item => item.id === 'artifact-scene:hedgehog-house-gallery');
    expect(inspector).toMatchObject({ zone: 'inspector', side: 'right' });
    expect(artifact).toMatchObject({ zone: 'side-stage', side: 'left', preferredSide: 'right', role: 'artifact' });
  });

  test('coexisting semantic and artifact objects share a lane as measured vertical slots', async ({ page }) => {
    await boot(page, 'education/charles-university/coursework/simulation-credence');
    await page.waitForFunction(() => Boolean(window.ProfilePhase8));
    await page.evaluate(() => window.ProfileSceneComposer.compose('test-semantic-artifact-stack'));

    const semantic = page.locator('[data-phase8-object="coursework-documents"]');
    const artifact = page.locator('[data-artifact-scene="simulation-credence-paper"]');
    await expect(semantic).toBeVisible();
    await expect(artifact).toBeVisible();
    await expect(semantic).toHaveAttribute('data-scene-zone', 'side-stage');
    await expect(artifact).toHaveAttribute('data-scene-zone', 'side-stage');

    const geometry = await page.evaluate(() => {
      const semantic = document.querySelector('[data-phase8-object="coursework-documents"]');
      const artifact = document.querySelector('[data-artifact-scene="simulation-credence-paper"]');
      const a = semantic.getBoundingClientRect();
      const b = artifact.getBoundingClientRect();
      return {
        semantic: { side: semantic.dataset.sceneSide, slot: Number(semantic.dataset.sceneSlot), top: a.top, bottom: a.bottom },
        artifact: { side: artifact.dataset.sceneSide, slot: Number(artifact.dataset.sceneSlot), top: b.top, bottom: b.bottom }
      };
    });
    expect(geometry.semantic.side).toBe(geometry.artifact.side);
    expect(geometry.semantic.slot).not.toBe(geometry.artifact.slot);
    expect(Math.max(geometry.semantic.top, geometry.artifact.top)).toBeGreaterThanOrEqual(
      Math.min(geometry.semantic.bottom, geometry.artifact.bottom) - 2
    );
  });

  test('declarative composition requests can reserve and flip a generic side-stage object', async ({ page }) => {
    await boot(page, 'education');

    await page.evaluate(() => {
      const canvas = document.querySelector('.scene-canvas');
      const blocker = document.createElement('section');
      blocker.className = 'phase-d-contract-blocker';
      blocker.style.cssText = 'position:absolute;width:180px;height:220px';
      const floating = document.createElement('section');
      floating.className = 'phase-d-contract-floating';
      floating.style.cssText = 'position:absolute;width:220px;height:160px';
      canvas.append(blocker, floating);

      window.ProfileScene.registry.register({
        id: 'phase-d-contract-blocker',
        selector: '.phase-d-contract-blocker',
        visible: true,
        composition: {
          zone: 'inspector',
          side: 'right',
          preferredSide: 'right',
          allowFlip: false,
          blocksSideStage: true,
          priority: 1000,
          role: 'test-blocker'
        }
      });
      window.ProfileScene.registry.register({
        id: 'phase-d-contract-floating',
        selector: '.phase-d-contract-floating',
        visible: true,
        composition: {
          zone: 'side-stage',
          preferredSide: 'right',
          allowFlip: true,
          priority: 20,
          role: 'semantic'
        }
      });
    });

    const floating = page.locator('.phase-d-contract-floating');
    await expect(floating).toHaveAttribute('data-scene-composed', 'true');
    await expect(floating).toHaveAttribute('data-scene-side', 'left');
    await expect(floating).toHaveAttribute('data-scene-collision-adjusted', 'blocked-right');

    await page.evaluate(() => {
      window.ProfileScene.registry.unregister('phase-d-contract-floating');
      window.ProfileScene.registry.unregister('phase-d-contract-blocker');
      document.querySelector('.phase-d-contract-floating')?.remove();
      document.querySelector('.phase-d-contract-blocker')?.remove();
    });
  });
});
