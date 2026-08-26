const { test, expect } = require('@playwright/test');

const bypassIntro = async page => {
  await page.addInitScript(() => {
    sessionStorage.setItem('profileIntroSeen', 'true');
    window.__profileNativeDomMethods = {
      elementSetAttribute: Element.prototype.setAttribute,
      documentQuerySelectorAll: Document.prototype.querySelectorAll
    };
    window.__profileMutationObserverCreations = 0;
    const NativeMutationObserver = window.MutationObserver;
    window.MutationObserver = class ProfileMeasuredMutationObserver extends NativeMutationObserver {
      constructor(callback) {
        window.__profileMutationObserverCreations += 1;
        super(callback);
      }
    };
    window.__profileLongTasks = [];
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver(list => {
          list.getEntries().forEach(entry => window.__profileLongTasks.push(entry.duration));
        });
        observer.observe({ type: 'longtask', buffered: true });
      } catch (_) {}
    }
  });
  await page.route('https://cloud.umami.is/**', route => route.abort()).catch(() => {});
};

test('settled overview stays inside the improved bootstrap and media budgets', async ({ page }) => {
  await bypassIntro(page);
  await page.goto('/#overview');
  await page.waitForFunction(() => Boolean(
    window.ProfileAccessibility &&
    window.ProfileFeatureBootstrap?.snapshot().states.bindings === 'ready' &&
    !document.body.classList.contains('is-v9-transitioning')
  ));
  await page.waitForTimeout(350);

  const metrics = await page.evaluate(() => {
    const origin = location.origin;
    const resources = performance.getEntriesByType('resource')
      .filter(entry => new URL(entry.name).origin === origin);
    const scripts = resources.filter(entry => /\.js(?:$|\?)/i.test(entry.name));
    const styles = resources.filter(entry => /\.css(?:$|\?)/i.test(entry.name));
    const unrelatedArtifactMedia = resources.filter(entry =>
      /\.(?:pdf|mp4)(?:$|\?)/i.test(entry.name) ||
      /hedgehog-house\/(?:outside|inside|hedgehog)\./i.test(entry.name) ||
      /modal-logic-lab\/(?:lab|learn)\./i.test(entry.name)
    );
    return {
      scriptRequests: scripts.length,
      scriptBytes: scripts.reduce((sum, entry) => sum + (entry.encodedBodySize || entry.decodedBodySize || 0), 0),
      styleRequests: styles.length,
      unrelatedArtifactMedia: unrelatedArtifactMedia.map(entry => entry.name),
      domNodes: document.getElementsByTagName('*').length,
      artifactRoots: document.querySelectorAll('[data-artifact-scene]').length,
      artifactMedia: document.querySelectorAll('.artifact-scene-layer img, .artifact-scene-layer iframe, .artifact-scene-layer video').length,
      introRuntime: Boolean(window.ProfileIntro),
      introResources: resources.filter(entry => /intro-atlas-reveal\.(?:js|css)(?:$|\?)/i.test(entry.name)).map(entry => entry.name),
      atlasInteractionRuntimes: {
        lod: Boolean(window.ProfileAtlasLOD),
        focus: Boolean(window.ProfileAtlasFocus),
        portal: Boolean(window.ProfileRootEntryPortal),
        condensation: Boolean(window.ProfileAtlasCondensation),
        dragGuard: Boolean(window.ProfileAtlasDragActivationGuard)
      },
      atlasInteractionResources: resources.filter(entry =>
        /(?:phase7-atlas|atlas-drag-activation-guard|atlas-focus-unification|atlas-condensation|root-entry-portal)\.(?:js|css)(?:$|\?)/i.test(entry.name)
      ).map(entry => entry.name),
      longTasks: window.__profileLongTasks || [],
      mutationObserverCreations: window.__profileMutationObserverCreations,
      nativeDomMethodsIntact:
        Element.prototype.setAttribute === window.__profileNativeDomMethods.elementSetAttribute &&
        Document.prototype.querySelectorAll === window.__profileNativeDomMethods.documentQuerySelectorAll
    };
  });

  // Baseline was 48 eager first-party scripts / 818,271 source bytes and 28
  // styles; the current structural target is 32 scripts / ~563 kB / 15 styles.
  // These ceilings leave CI variance while rejecting either lazy-chain relapse.
  expect(metrics.scriptRequests).toBeLessThanOrEqual(34);
  expect(metrics.scriptBytes).toBeLessThanOrEqual(600_000);
  expect(metrics.styleRequests).toBeLessThanOrEqual(16);
  expect(metrics.unrelatedArtifactMedia).toEqual([]);
  expect(metrics.artifactRoots).toBe(0);
  expect(metrics.artifactMedia).toBe(0);
  expect(metrics.introRuntime).toBe(false);
  expect(metrics.introResources).toEqual([]);
  expect(metrics.atlasInteractionRuntimes).toEqual({
    lod: false,
    focus: false,
    portal: false,
    condensation: false,
    dragGuard: false
  });
  expect(metrics.atlasInteractionResources).toEqual([]);
  expect(metrics.domNodes).toBeLessThanOrEqual(1800);
  expect(Math.max(0, ...metrics.longTasks)).toBeLessThan(300);
  expect(metrics.longTasks.reduce((sum, value) => sum + value, 0)).toBeLessThan(1000);
  expect(metrics.mutationObserverCreations).toBe(0);
  expect(metrics.nativeDomMethodsIntact).toBe(true);

  const before = await page.evaluate(() => ({
    geometry: window.ProfileGeometry.snapshot().reconciliation,
    labels: window.ProfileLocalLabelPolicy.snapshot()
  }));
  await page.waitForTimeout(240);
  const after = await page.evaluate(() => ({
    geometry: window.ProfileGeometry.snapshot().reconciliation,
    labels: window.ProfileLocalLabelPolicy.snapshot()
  }));
  expect(after.geometry.pending).toBe(false);
  expect(after.labels.pending).toBe(false);
  expect(after.geometry.applyCount - before.geometry.applyCount).toBe(0);
  expect(after.labels.applyCount - before.labels.applyCount).toBe(0);
});
