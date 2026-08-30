const { test, expect } = require('@playwright/test');

const prepare = async page => {
  await page.addInitScript(() => sessionStorage.setItem('profileIntroSeen', 'true'));
  await page.route('https://cloud.umami.is/**', route => route.abort()).catch(() => {});
};
const waitFan = page => page.waitForFunction(() => window.ProfileGeometry?.snapshot?.().compassVersion === 'fan-v3');
const liveNode = (page, id) => page.locator(`#site-graph .site-graph-svg > g:not(.v9-transition-overlay) .site-graph-node[data-node-id="${id}"]`);
const point = (page, id) => liveNode(page, id).evaluate(el => ({x:Number(el.dataset.x),y:Number(el.dataset.y)}));
const project = (root,target,vector) => (target.x-root.x)*vector.x + (target.y-root.y)*vector.y;
const distance = (left, right) => Math.hypot(left.x-right.x, left.y-right.y);

test.describe('Global fan v3 geometry', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('practical Overview keeps five immediate branches distinct and well separated', async ({ page }) => {
    await prepare(page); await page.goto('/#overview');
    await page.waitForFunction(() => Boolean(window.ProfileRootLanding && window.ProfileRootOverview));
    await waitFan(page);
    /* Phase H deliberately re-composes the practical Profile Root after the
       canonical fan has supplied its semantic directions. Do not freeze the
       old pre-Phase-H compass coordinates here; the contract is that the five
       primary destinations remain immediate, distinct and comfortably apart. */
    await page.waitForFunction(() =>
      document.body.dataset.globalCompass === 'fan-v3' &&
      document.body.dataset.rootLanding === 'false' &&
      document.body.classList.contains('is-profile-root-ready') &&
      !document.body.classList.contains('is-profile-root-emerging') &&
      !document.body.classList.contains('is-v9-transitioning') &&
      !window.ProfileScene?.transitions?.isLocked &&
      window.ProfileGeometry?.snapshot?.().reconciliation?.pending === false
    );

    const ids = ['work','knowledge','education','about','experience'];
    const root = await point(page,'stepan-chrast');
    const branches = Object.fromEntries(await Promise.all(ids.map(async id => [id, await point(page,id)])));
    ids.forEach(id => expect(distance(root, branches[id])).toBeGreaterThan(170));
    for (let left = 0; left < ids.length; left += 1) {
      for (let right = left + 1; right < ids.length; right += 1) {
        expect(distance(branches[ids[left]], branches[ids[right]])).toBeGreaterThan(105);
      }
    }
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
  test('first-session V3.1 reveal originates from the canonical fan-v3 Atlas', async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.removeItem('profileIntroSeen');
      sessionStorage.removeItem('__v31IntroFreshPrepared');
    });
    await page.route('https://cloud.umami.is/**', route => route.abort()).catch(() => {});
    await page.goto('/');
    await page.waitForFunction(() => Boolean(
      window.ProfileIntro?.__v31 &&
      window.ProfileIntro.snapshot().state === 'ATLAS_REVEAL' &&
      window.ProfileIntro.snapshot().running
    ), null, {timeout:8000});
    await waitFan(page);
    await expect(page.locator('#site-graph .phase-h-node-motion')).toHaveCount(0);

    const positions = await page.evaluate(() => {
      const geometry = window.ProfileGeometry;
      const read = id => {
        const element = document.querySelector(`#site-graph .site-graph-node[data-node-id="${id}"]`);
        const canonical = geometry.atlasPoint(id);
        return {
          x: Number(element.dataset.x), y: Number(element.dataset.y),
          expectedX: canonical.x, expectedY: canonical.y
        };
      };
      return Object.fromEntries(['stepan-chrast','knowledge','education','about','experience','work'].map(id => [id, read(id)]));
    });

    Object.values(positions).forEach(value => {
      expect(Math.hypot(value.x - value.expectedX, value.y - value.expectedY)).toBeLessThan(2);
    });
    const r=positions['stepan-chrast'], k=positions.knowledge, e=positions.education, a=positions.about, x=positions.experience, w=positions.work;
    expect(k.x).toBeGreaterThan(r.x); expect(e.y).toBeLessThan(r.y); expect(a.y).toBeLessThan(r.y); expect(x.x).toBeLessThan(r.x); expect(w.y).toBeGreaterThan(r.y);
  });
});
