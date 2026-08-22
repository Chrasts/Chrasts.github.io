const { test, expect } = require('@playwright/test');
const fresh = async page => { await page.addInitScript(() => {sessionStorage.removeItem('profileIntroSeen');sessionStorage.removeItem('__phase3FreshPrepared');}); await page.route('https://cloud.umami.is/**', r=>r.abort()).catch(()=>{}); };
const bypass = async page => { await page.addInitScript(() => sessionStorage.setItem('profileIntroSeen','true')); await page.route('https://cloud.umami.is/**', r=>r.abort()).catch(()=>{}); };
const p = (page,id) => page.locator(`#site-graph .site-graph-node[data-node-id="${id}"]`).evaluate(e=>({x:Number(e.dataset.x),y:Number(e.dataset.y)}));

test.describe('Intro v3 regressions', () => {
  test.use({ viewport:{width:1440,height:900} });

  test('never flashes the full Atlas before root-only autoplay', async ({page}) => {
    await fresh(page); await page.goto('/');
    await page.waitForFunction(() => window.ProfileIntroUnfold?.snapshot().stage === 'root', null, {timeout:8000});
    const visible=await page.evaluate(() => [...document.querySelectorAll('.profile-intro-graph .site-graph-node:not([data-node-id="stepan-chrast"])')].filter(e=>Number(getComputedStyle(e).opacity)>.05).length);
    expect(visible).toBe(0);
  });

  test('gateway keeps rotating on hover and disappears immediately on Enter click', async ({page}) => {
    await fresh(page); await page.goto('/');
    await page.waitForFunction(() => window.ProfileIntroUnfold?.snapshot().completed === true, null, {timeout:8000});
    const enter=page.locator('.profile-intro-enter'); await expect(enter).toBeVisible();
    expect(await enter.evaluate(e=>getComputedStyle(e,'::after').animationName)).toContain('intro-gateway-orbit-v3');
    await enter.hover(); await page.waitForTimeout(120);
    expect(await enter.evaluate(e=>getComputedStyle(e,'::after').animationPlayState)).toBe('running');
    await enter.click(); await expect(page.locator('.profile-intro-overlay')).toHaveClass(/is-enter-committed/);
    expect(await enter.evaluate(e=>getComputedStyle(e).visibility)).toBe('hidden');
    await page.waitForFunction(() => ['territories','branches','root','identity'].includes(window.ProfileIntro?.snapshot().stage), null, {timeout:2500});
  });

  test('portrait handoff settles directly into stable fan v3 Overview', async ({page}) => {
    await fresh(page); await page.goto('/'); await page.waitForFunction(() => window.ProfileIntroUnfold?.snapshot().completed === true, null, {timeout:8000});
    await page.locator('.profile-intro-enter').click(); await page.waitForFunction(() => window.ProfileIntro?.snapshot().stage === 'identity', null, {timeout:8000});
    await page.locator('.profile-intro-identity').click(); await page.waitForFunction(() => !document.querySelector('.profile-intro-overlay'), null, {timeout:8000});
    await page.waitForFunction(() => window.ProfileGeometry?.snapshot().compassVersion === 'fan-v3' && document.body.dataset.globalCompass === 'fan-v3');
    const ids=['work','knowledge','education','about','experience']; const before={}; for(const id of ids) before[id]=await p(page,id);
    await page.waitForTimeout(850); const after={}; for(const id of ids) after[id]=await p(page,id);
    for(const id of ids){expect(Math.hypot(after[id].x-before[id].x,after[id].y-before[id].y)).toBeLessThan(3); const target=await page.evaluate(id=>window.ProfileGeometry.overviewPoint(id),id); expect(Math.hypot(after[id].x-target.x,after[id].y-target.y)).toBeLessThan(3);}
  });
});

test.describe('Overview root identity', () => {
  test.use({ viewport:{width:1440,height:900} });
  test('clicking Štěpán opens profile info without reorganising the fragment', async ({page}) => {
    await bypass(page); await page.goto('/#overview'); await page.waitForFunction(() => Boolean(window.ProfileRootLanding && window.ProfileIntroFixesV3));
    await page.evaluate(() => window.ProfileRootLanding.activate({focusGraph:false})); await page.waitForFunction(() => document.body.dataset.globalCompass === 'fan-v3');
    const ids=['work','knowledge','education','about','experience']; const before={}; for(const id of ids) before[id]=await p(page,id);
    await page.locator('#site-graph .site-graph-node[data-node-id="stepan-chrast"]').click();
    await expect(page.locator('.profile-root-inspector')).toHaveClass(/is-open/); await expect(page.locator('.profile-root-inspector-portrait img')).toHaveAttribute('src','assets/stepan-chrast.jpg'); await expect(page.locator('.profile-root-inspector h2')).toContainText('Štěpán Chrast');
    expect(await page.evaluate(() => document.body.dataset.graphRoute)).toBe('overview'); expect(await page.evaluate(() => document.body.dataset.globalCompass)).toBe('fan-v3');
    await page.waitForTimeout(500); for(const id of ids){const after=await p(page,id);expect(Math.hypot(after.x-before[id].x,after.y-before[id].y)).toBeLessThan(3);}
    await page.keyboard.press('Escape'); await page.waitForFunction(() => !window.ProfileIntroFixesV3.snapshot().inspectorOpen);
  });
});
