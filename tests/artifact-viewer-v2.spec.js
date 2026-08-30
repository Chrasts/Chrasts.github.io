const { test, expect } = require('@playwright/test');

const boot = async (page, route) => {
  await page.addInitScript(() => sessionStorage.setItem('profileIntroSeen', 'true'));
  await page.route('https://cloud.umami.is/**', routeRequest => routeRequest.abort()).catch(() => {});
  await page.goto(`/#${route}`);
  await page.waitForFunction(() => Boolean(
    window.ProfileArtifactScenes &&
    window.ProfileObjectFocus &&
    window.ProfileObjectFocusFit
  ));
  await page.waitForFunction(() => !document.body.classList.contains('is-v9-transitioning'));
  await page.waitForTimeout(180);
};

const waitSettled = page => page.waitForFunction(() => window.ProfileObjectFocus?.snapshot().phase === 'settled');

test.describe('Integrated artifact viewer media contract', () => {
  test('focused image keeps the page visually unchanged and shows caption + source bubbles', async ({ page }) => {
    await boot(page, 'about/woodworking/hedgehog-house');
    const card = page.locator('[data-artifact-scene="hedgehog-house-gallery"] .artifact-deck-card.is-active');
    await card.click();
    await waitSettled(page);

    const viewer = page.locator('.artifact-focus-viewer');
    const presentation = await viewer.evaluate(element => {
      const backdrop = element.querySelector('.artifact-focus-backdrop');
      const headerCopy = element.querySelector('.artifact-focus-header>div');
      const caption = element.querySelector('.artifact-focus-description');
      const source = element.querySelector('.artifact-focus-footer a.artifact-action');
      return {
        backdropBackground: getComputedStyle(backdrop).backgroundColor,
        backdropImage: getComputedStyle(backdrop).backgroundImage,
        backdropFilter: getComputedStyle(backdrop).backdropFilter,
        headerCopyDisplay: getComputedStyle(headerCopy).display,
        caption: caption?.textContent || '',
        source: source?.textContent || '',
        hintDisplay: getComputedStyle(element.querySelector('.object-focus-media-hint')).display
      };
    });

    expect(presentation.backdropBackground).toBe('rgba(0, 0, 0, 0)');
    expect(presentation.backdropImage).toBe('none');
    expect(presentation.backdropFilter).toBe('none');
    expect(presentation.headerCopyDisplay).toBe('none');
    expect(presentation.caption.length).toBeGreaterThan(3);
    expect(presentation.source).toContain('Open original');
    expect(presentation.hintDisplay).toBe('none');
  });

  test('PDF focus is pre-fitted before flight and does not resize after settling', async ({ page }) => {
    await boot(page, 'work/project/bachelor-thesis');
    const card = page.locator('[data-artifact-scene="bachelor-thesis-diagrams"] .artifact-deck-card[data-artifact-id="bachelor-thesis-lattice-of-bands"]');
    await card.locator('.artifact-inline-expand').click();
    const viewer = page.locator('.artifact-focus-viewer');
    await expect(viewer).toBeVisible();

    const early = await viewer.locator('.artifact-focus-media iframe').evaluate(frame => {
      const rect = frame.getBoundingClientRect();
      return { width: rect.width, height: rect.height, fit: frame.dataset.objectFocusFit, src: frame.getAttribute('src') };
    });
    await waitSettled(page);
    const settled = await viewer.locator('.artifact-focus-media iframe').evaluate(frame => {
      const rect = frame.getBoundingClientRect();
      return { width: rect.width, height: rect.height, fit: frame.dataset.objectFocusFit, src: frame.getAttribute('src') };
    });

    expect(early.fit).toBe('contain');
    expect(settled.fit).toBe('contain');
    expect(Math.abs(early.width - settled.width)).toBeLessThan(2);
    expect(Math.abs(early.height - settled.height)).toBeLessThan(2);
    expect(settled.src).toBe(early.src);
  });

  test('Congruence Lattice PDF stays inert in the ambient card and becomes a live focused reader', async ({ page, request }) => {
    const response = await request.get('/assets/documents/work/clp-survey/congruence-lattice-problem.pdf');
    expect(response.ok()).toBe(true);
    expect((await response.body()).subarray(0, 4).toString()).toBe('%PDF');

    await boot(page, 'work/project/clp-survey');
    const scene = page.locator('[data-artifact-scene="clp-survey-paper"]');
    const preview = scene.locator('.artifact-media-preview.is-pdf');
    await expect(preview).toBeVisible();
    await expect(preview.locator('iframe')).toHaveCount(0);
    await expect(preview.locator('.artifact-pdf-mark')).toHaveText('PDF');
    await expect(scene.locator('.artifact-inline-expand')).toContainText('Inspect');

    await scene.locator('.artifact-inline-expand').click();
    await waitSettled(page);
    const focused = page.locator('.artifact-focus-viewer .artifact-focus-media iframe');
    await expect(focused).toBeVisible();
    await expect(focused).toHaveAttribute('src', /congruence-lattice-problem\.pdf#/);
    await expect(focused).toHaveAttribute('data-object-focus-fit', 'contain');
    expect(await focused.evaluate(frame => getComputedStyle(frame).pointerEvents)).not.toBe('none');
    const bounds = await focused.boundingBox();
    expect(bounds.width).toBeGreaterThan(250);
    expect(bounds.height).toBeGreaterThan(300);
  });

  test('Axiom Wilds uses the generic video type as a live floating player', async ({ page }) => {
    await boot(page, 'work/project/axiom-wilds');
    const video = page.locator('[data-artifact-scene="axiom-wilds-gameplay"] video[data-artifact-inline-video]');
    await expect(video).toBeVisible();
    const state = await video.evaluate(media => ({
      autoplay: media.autoplay,
      muted: media.muted,
      loop: media.loop,
      controls: media.controls,
      playsInline: media.playsInline,
      paused: media.paused,
      src: media.getAttribute('src')
    }));
    expect(state.autoplay).toBe(true);
    expect(state.muted).toBe(true);
    expect(state.loop).toBe(true);
    expect(state.controls).toBe(true);
    expect(state.playsInline).toBe(true);
    expect(state.src).toMatch(/assets\/video\/work\/axiom-wilds\/demo-gameplay\.mp4$/);
    await page.waitForFunction(async () => {
      const media = document.querySelector('[data-artifact-scene="axiom-wilds-gameplay"] video[data-artifact-inline-video]');
      if (!media) return false;
      try { await media.play(); } catch (_) {}
      return !media.paused;
    }, null, { timeout: 5000 });
  });
});
