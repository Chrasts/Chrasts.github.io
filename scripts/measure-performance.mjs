import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

const baseURL = process.env.PORTFOLIO_BASE_URL || 'http://127.0.0.1:4173';
const runsArgument = process.argv.find(value => value.startsWith('--runs='));
const outputArgument = process.argv.find(value => value.startsWith('--output='));
const runs = Math.max(1, Number(runsArgument?.split('=')[1]) || 3);
const output = outputArgument?.slice('--output='.length) || null;

const scenarios = [
  {
    id: 'overview',
    path: '/#overview',
    bypassIntro: true,
    ready: () => Boolean(
      window.ProfileAccessibility &&
      window.ProfileFeatureBootstrap?.snapshot?.().states.bindings === 'ready' &&
      document.body.dataset.graphMode === 'overview' &&
      !document.body.classList.contains('is-v9-transitioning') &&
      !window.ProfileScene?.transitions?.isLocked
    ),
    interact: async page => {
      await page.locator('#site-graph .site-graph-node[data-node-id="knowledge"]').hover();
    }
  },
  {
    id: 'atlas',
    path: '/#atlas',
    bypassIntro: true,
    ready: () => Boolean(
      window.ProfileAtlasLOD &&
      window.ProfileAtlasFocus?.snapshot?.().ready &&
      document.body.dataset.graphMode === 'atlas' &&
      !document.body.classList.contains('is-v9-transitioning') &&
      !window.ProfileScene?.transitions?.isLocked
    ),
    interact: async page => {
      const viewport = page.locator('.site-graph-viewport');
      const box = await viewport.boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width * .52, box.y + box.height * .48);
        await page.mouse.wheel(0, -180);
      }
      await page.locator('#site-graph .site-graph-node[data-node-id="knowledge"]').hover();
    }
  },
  {
    id: 'local-focus',
    path: '/#knowledge/logic-math',
    bypassIntro: true,
    ready: () => Boolean(
      window.ProfileCameraComposition?.snapshot?.().booted &&
      document.body.dataset.graphMode === 'focus' &&
      document.body.dataset.graphRoute === 'knowledge/logic-math' &&
      !document.body.classList.contains('is-v9-transitioning') &&
      !window.ProfileScene?.transitions?.isLocked
    ),
    interact: async page => {
      await page.locator('#site-graph .site-graph-node[data-node-id="mathematical-logic"]').hover();
    }
  },
  {
    id: 'artifact-route',
    path: '/#work/project/bachelor-thesis',
    bypassIntro: true,
    ready: () => Boolean(
      window.ProfileArtifactScenes &&
      window.ProfileObjectFocus &&
      document.querySelector('[data-artifact-scene="bachelor-thesis-diagrams"]') &&
      !document.body.classList.contains('is-v9-transitioning')
    ),
    interact: async page => {
      await page.locator('[data-artifact-id="bachelor-thesis-rol-non-a"] .artifact-inline-expand').hover();
    }
  },
  {
    id: 'fresh-intro',
    path: '/',
    bypassIntro: false,
    ready: () => window.ProfileIntro?.snapshot?.().state === 'ATLAS_READY',
    interact: async page => {
      await page.locator('#site-graph .site-graph-node[data-node-id="stepan-chrast"]').hover();
    }
  }
];

const percentile = (values, p) => {
  if (!values.length) return 0;
  const ordered = [...values].sort((a, b) => a - b);
  return ordered[Math.min(ordered.length - 1, Math.ceil(ordered.length * p) - 1)];
};

const rounded = value => Math.round(value * 100) / 100;
const metricMap = metrics => Object.fromEntries(metrics.map(item => [item.name, item.value]));

const measureScenario = async (browser, scenario) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  if (scenario.bypassIntro) {
    await page.addInitScript(() => sessionStorage.setItem('profileIntroSeen', 'true'));
  } else {
    await page.addInitScript(() => {
      sessionStorage.removeItem('profileIntroSeen');
      sessionStorage.removeItem('__v31IntroFreshPrepared');
    });
  }
  await page.addInitScript(() => {
    window.__profilePerf = { longTasks: [], cls: 0, lcp: 0 };
    try {
      new PerformanceObserver(list => list.getEntries().forEach(entry => {
        window.__profilePerf.longTasks.push(entry.duration);
      })).observe({ type: 'longtask', buffered: true });
    } catch (_) {}
    try {
      new PerformanceObserver(list => list.getEntries().forEach(entry => {
        if (!entry.hadRecentInput) window.__profilePerf.cls += entry.value;
      })).observe({ type: 'layout-shift', buffered: true });
    } catch (_) {}
    try {
      new PerformanceObserver(list => list.getEntries().forEach(entry => {
        window.__profilePerf.lcp = Math.max(window.__profilePerf.lcp, entry.startTime);
      })).observe({ type: 'largest-contentful-paint', buffered: true });
    } catch (_) {}
  });
  await page.route('https://cloud.umami.is/**', route => route.abort()).catch(() => {});

  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Performance.enable');
  const requests = new Map();
  cdp.on('Network.requestWillBeSent', event => {
    requests.set(event.requestId, {
      url: event.request.url,
      type: event.type,
      bytes: 0,
      failed: false
    });
  });
  cdp.on('Network.loadingFinished', event => {
    const request = requests.get(event.requestId);
    if (request) request.bytes = event.encodedDataLength || 0;
  });
  cdp.on('Network.loadingFailed', event => {
    const request = requests.get(event.requestId);
    if (request) request.failed = true;
  });

  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const startedAt = performance.now();
  await page.goto(`${baseURL}${scenario.path}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(scenario.ready, null, { timeout: 20_000 });
  const readyMs = performance.now() - startedAt;

  const framePromise = page.evaluate(() => new Promise(resolve => {
    const samples = [];
    const started = performance.now();
    let previous = started;
    const sample = now => {
      samples.push(now - previous);
      previous = now;
      if (now - started >= 1_200) resolve(samples.slice(1));
      else requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  }));
  await scenario.interact(page);
  const frameTimes = await framePromise;
  await page.waitForTimeout(100);

  const runtime = await page.evaluate(() => ({
    domNodes: document.getElementsByTagName('*').length,
    perf: window.__profilePerf,
    resources: performance.getEntriesByType('resource').length
  }));
  const performanceMetrics = metricMap((await cdp.send('Performance.getMetrics')).metrics);
  const firstParty = [...requests.values()].filter(request => {
    try { return new URL(request.url).origin === new URL(baseURL).origin; } catch (_) { return false; }
  });
  const result = {
    scenario: scenario.id,
    readyMs: rounded(readyMs),
    requestCount: firstParty.length,
    transferBytes: firstParty.reduce((sum, request) => sum + request.bytes, 0),
    failedRequests: firstParty.filter(request => request.failed).length,
    failedRequestURLs: firstParty.filter(request => request.failed).map(request => request.url),
    domNodes: runtime.domNodes,
    jsHeapBytes: Math.round(performanceMetrics.JSHeapUsedSize || 0),
    longTaskCount: runtime.perf.longTasks.length,
    longTaskTotalMs: rounded(runtime.perf.longTasks.reduce((sum, value) => sum + value, 0)),
    longTaskMaxMs: rounded(Math.max(0, ...runtime.perf.longTasks)),
    lcpMs: rounded(runtime.perf.lcp),
    cls: Math.round(runtime.perf.cls * 10_000) / 10_000,
    frameP95Ms: rounded(percentile(frameTimes, .95)),
    frameMaxMs: rounded(Math.max(0, ...frameTimes)),
    frameOverBudget: frameTimes.filter(value => value > 20).length,
    pageErrors: errors
  };
  await context.close();
  return result;
};

const aggregate = samples => {
  const numericKeys = Object.keys(samples[0]).filter(key => typeof samples[0][key] === 'number');
  return Object.fromEntries(numericKeys.map(key => {
    const values = samples.map(sample => sample[key]);
    return [key, {
      median: rounded(percentile(values, .5)),
      p95: rounded(percentile(values, .95)),
      max: rounded(Math.max(...values))
    }];
  }));
};

const browser = await chromium.launch({ headless: true });
const samples = [];
try {
  for (let run = 1; run <= runs; run += 1) {
    for (const scenario of scenarios) {
      const result = await measureScenario(browser, scenario);
      samples.push({ run, ...result });
      console.log(`${scenario.id} ${run}/${runs}: ${JSON.stringify(result)}`);
    }
  }
} finally {
  await browser.close();
}

const report = {
  generatedAt: new Date().toISOString(),
  baseURL,
  runs,
  samples,
  scenarios: Object.fromEntries(scenarios.map(scenario => {
    const matching = samples.filter(sample => sample.scenario === scenario.id);
    return [scenario.id, aggregate(matching)];
  }))
};

if (output) await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
else console.log(JSON.stringify(report.scenarios, null, 2));
