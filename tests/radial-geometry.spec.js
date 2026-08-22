const { test, expect } = require('@playwright/test');

const prepare = async page => {
  await page.addInitScript(() => sessionStorage.setItem('profileIntroSeen', 'true'));
  await page.route('https://cloud.umami.is/**', route => route.abort()).catch(() => {});
};
const waitFan = page => page.waitForFunction(() => window.ProfileGeometry?.snapshot?.().compassVersion === 'fan-v3');
const liveNode = (page, id) => page.locator(`#site-graph .site-graph-svg > g:not(.v9-transition-overlay) .site-graph-node[data-node-id="${id}"]`);
const point = (page, id) => liveNode(page, id).evaluate(el => ({x:Number(el.dataset.x),y:Number(el.dataset.y)}));
const project = (root,target,vector) => (target.x-root.x)*vector.x + (target.y-root.y)*vector.y;

test.describe('Global fan v3 geometry', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('Overview keeps Knowledge right, Education/About up and Work down', async ({ page }) => {
    await prepare(page); await page.goto('/#overview');
    await page.waitForFunction(() => Boolean(window.ProfileRootLanding)); await waitFan(page);
    await page.evaluate(() => window.ProfileRootLanding.activate({ focusGraph:false }));
    await page.waitForFunction(() => document.body.dataset.globalCompass === 'fan-v3');
    const root=await point(page,'stepan-chrast'), work=await point(page,'work'), knowledge=await point(page,'knowledge'), education=await point(page,'education'), about=await point(page,'about'), experience=await point(page,'experience');
    expect(Math.abs(work.x-root.x)).toBeLessThan(8); expect(work.y).toBeGreaterThan(root.y+270);
    expect(knowledge.x).toBeGreaterThan(root.x+330); expect(Math.abs(knowledge.y-root.y)).toBeLessThan(55);
    expect(education.x).toBeGreaterThan(root.x+100); expect(education.x).toBeLessThan(knowledge.x-180); expect(education.y).toBeLessThan(root.y-250);
    expect(about.x).toBeLessThan(root.x-210); expect(about.y).toBeLessThan(root.y-205);
    expect(experience.x).toBeLessThan(root.x-260); expect(experience.y).toBeGreaterThan(root.y);
  });

  test('Atlas subtrees grow outward along the same final compass', async ({ page }) => {
    await prepare(page); await page.goto('/#atlas'); await waitFan(page);
    await page.waitForFunction(() => document.body.dataset.globalCompass === 'fan-v3');
    const snap=await page.evaluate(() => window.ProfileGeometry.snapshot()); const root=await point(page,'stepan-chrast');
    const samples=[['work','project-sql-schema'],['knowledge','logic-math'],['education','charles-university'],['about','research-interests'],['experience','ceske-priority']];
    for (const [section,child] of samples) {
      const s=await point(page,section), c=await point(page,child), v=snap.sections[section].vector;
      expect(project(root,c,v)).toBeGreaterThan(project(root,s,v)+55);
    }
  });

  test('local Knowledge still normalises top-to-bottom and Work keeps lattice order', async ({ page }) => {
    await prepare(page); await page.goto('/#overview'); await page.waitForFunction(() => Boolean(window.ProfileRootLanding)); await waitFan(page);
    await page.evaluate(() => window.ProfileRootLanding.activate({focusGraph:false}));
    await liveNode(page,'knowledge').click();
    await page.waitForFunction(() => document.body.dataset.graphRoute === 'knowledge' && document.body.dataset.globalGeometry === 'local');
    await page.waitForTimeout(950);
    const knowledge=await point(page,'knowledge'), child=await point(page,'logic-math'), root=await point(page,'stepan-chrast');
    expect(root.y).toBeLessThan(knowledge.y); expect(child.y).toBeGreaterThan(knowledge.y+90);

    await page.goto('/#overview');
    await page.waitForFunction(() => Boolean(window.ProfileRootLanding));
    await page.waitForFunction(() =>
      !document.body.classList.contains('is-v9-transitioning') &&
      !document.body.classList.contains('is-atlas-handoff')
    );
    await page.evaluate(() => { window.ProfileRootLanding.reset(); window.ProfileRootLanding.activate({focusGraph:false}); });
    await waitFan(page);
    await page.waitForFunction(() => document.body.dataset.globalGeometry === 'radial-overview');
    await liveNode(page,'work').click();
    await page.waitForFunction(() => document.body.dataset.graphMode === 'work'); await page.waitForTimeout(950);
    const wr=await point(page,'stepan-chrast'), work=await point(page,'work'), concept=await point(page,'work-concept:logic');
    expect(work.y).toBeGreaterThan(wr.y); expect(concept.y).toBeGreaterThan(work.y+80);
  });
});

test.describe('Intro source geometry', () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test('first-session clone is captured from fan v3', async ({ page }) => {
    await page.addInitScript(() => { sessionStorage.removeItem('profileIntroSeen'); sessionStorage.removeItem('__phase3FreshPrepared'); });
    await page.route('https://cloud.umami.is/**', route => route.abort()).catch(() => {}); await page.goto('/');
    await page.waitForFunction(() => window.ProfileIntroUnfold?.snapshot().completed === true, null, {timeout:8000}); await waitFan(page);
    const p=await page.evaluate(() => { const n=id=>{const e=document.querySelector(`.profile-intro-graph .site-graph-node[data-node-id="${id}"]`);return{x:Number(e.dataset.introOriginX),y:Number(e.dataset.introOriginY)}};return{r:n('stepan-chrast'),k:n('knowledge'),e:n('education'),a:n('about'),x:n('experience'),w:n('work')}; });
    expect(p.k.x).toBeGreaterThan(p.r.x); expect(p.e.y).toBeLessThan(p.r.y); expect(p.a.y).toBeLessThan(p.r.y); expect(p.x.x).toBeLessThan(p.r.x); expect(p.w.y).toBeGreaterThan(p.r.y);
  });
});
