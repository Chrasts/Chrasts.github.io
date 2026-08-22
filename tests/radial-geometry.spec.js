const { test, expect } = require('@playwright/test');

const prepare = async page => {
  await page.addInitScript(() => sessionStorage.setItem('profileIntroSeen', 'true'));
  await page.route('https://cloud.umami.is/**', route => route.abort()).catch(() => {});
};

const point = async (page, id) => page.locator(`#site-graph .site-graph-node[data-node-id="${id}"]`).evaluate(element => ({
  x: Number(element.dataset.x),
  y: Number(element.dataset.y)
}));

const dotFrom = (root, target, vector) =>
  (target.x - root.x) * vector.x + (target.y - root.y) * vector.y;

test.describe('Global radial geometry', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('Overview keeps Štěpán central and Work exactly below the root', async ({ page }) => {
    await prepare(page);
    await page.goto('/#overview');
    await page.waitForFunction(() => Boolean(window.ProfileGeometry && window.ProfileRootLanding));
    await page.evaluate(() => window.ProfileRootLanding.activate({ focusGraph: false }));
    await page.waitForFunction(() => document.body.dataset.globalGeometry === 'radial-overview');

    const root = await point(page, 'stepan-chrast');
    const work = await point(page, 'work');
    const knowledge = await point(page, 'knowledge');
    const experience = await point(page, 'experience');
    const education = await point(page, 'education');
    const about = await point(page, 'about');

    expect(Math.abs(work.x - root.x)).toBeLessThan(5);
    expect(work.y).toBeGreaterThan(root.y + 170);
    expect(knowledge.x).toBeLessThan(root.x);
    expect(knowledge.y).toBeLessThan(root.y - 170);
    expect(experience.x).toBeGreaterThan(root.x + 170);
    expect(experience.y).toBeLessThan(root.y);
    expect(education.x).toBeGreaterThan(root.x + 100);
    expect(education.y).toBeGreaterThan(root.y + 100);
    expect(about.x).toBeLessThan(root.x - 170);
    expect(about.y).toBeGreaterThan(root.y);

    const vectors = await page.evaluate(() => window.ProfileGeometry.snapshot().sections);
    expect(Math.abs(vectors.work.vector.x)).toBeLessThan(0.01);
    expect(vectors.work.vector.y).toBeGreaterThan(0.99);
  });

  test('Atlas is five outward-oriented trees with Work continuing downward', async ({ page }) => {
    await prepare(page);
    await page.goto('/#atlas');
    await page.waitForFunction(() => document.body.dataset.globalGeometry === 'radial-atlas');
    await page.waitForFunction(() => document.querySelectorAll('#site-graph .site-graph-node[data-node-id]').length === window.SITE_DATA.graph.nodes.length);

    const snapshot = await page.evaluate(() => window.ProfileGeometry.snapshot());
    const root = await point(page, 'stepan-chrast');
    const samples = [
      ['work', 'project-sql-schema'],
      ['knowledge', 'logic-math'],
      ['experience', 'ceske-priority'],
      ['education', 'charles-university'],
      ['about', 'research-interests']
    ];

    for (const [sectionId, childId] of samples) {
      const section = await point(page, sectionId);
      const child = await point(page, childId);
      const vector = snapshot.sections[sectionId].vector;
      expect(dotFrom(root, child, vector)).toBeGreaterThan(dotFrom(root, section, vector) + 55);
    }

    const atlasWork = await point(page, 'work');
    expect(Math.abs(atlasWork.x - root.x)).toBeLessThan(6);
    expect(atlasWork.y).toBeGreaterThan(root.y + 220);
    expect(await page.locator('#site-graph .site-graph-node[data-node-id="work"]').getAttribute('data-global-sector')).toBe('work');
  });

  test('entering Knowledge normalises its local graph back to top-to-bottom navigation', async ({ page }) => {
    await prepare(page);
    await page.goto('/#overview');
    await page.waitForFunction(() => Boolean(window.ProfileGeometry && window.ProfileRootLanding));
    await page.evaluate(() => window.ProfileRootLanding.activate({ focusGraph: false }));
    await page.waitForFunction(() => document.body.dataset.globalGeometry === 'radial-overview');

    await page.locator('#site-graph .site-graph-node[data-node-id="knowledge"]').click();
    await page.waitForFunction(() => document.body.dataset.graphRoute === 'knowledge');
    await page.waitForFunction(() => document.body.dataset.globalGeometry === 'local');
    await page.waitForTimeout(950);

    const knowledge = await point(page, 'knowledge');
    const child = await point(page, 'logic-math');
    const root = await point(page, 'stepan-chrast');
    expect(root.y).toBeLessThan(knowledge.y);
    expect(child.y).toBeGreaterThan(knowledge.y + 90);
  });

  test('Work keeps the same downward order when it opens into the FCA lattice', async ({ page }) => {
    await prepare(page);
    await page.goto('/#overview');
    await page.waitForFunction(() => Boolean(window.ProfileGeometry && window.ProfileRootLanding));
    await page.evaluate(() => window.ProfileRootLanding.activate({ focusGraph: false }));
    await page.waitForFunction(() => document.body.dataset.globalGeometry === 'radial-overview');

    const beforeRoot = await point(page, 'stepan-chrast');
    const beforeWork = await point(page, 'work');
    expect(beforeWork.y).toBeGreaterThan(beforeRoot.y);

    await page.locator('#site-graph .site-graph-node[data-node-id="work"]').click();
    await page.waitForFunction(() => document.body.dataset.graphMode === 'work');
    await page.waitForFunction(() => document.body.dataset.globalGeometry === 'local');
    await page.waitForTimeout(950);

    const root = await point(page, 'stepan-chrast');
    const work = await point(page, 'work');
    const firstConcept = await point(page, 'work-concept:logic');
    expect(work.y).toBeGreaterThan(root.y);
    expect(firstConcept.y).toBeGreaterThan(work.y + 80);
  });
});

test.describe('Radial intro source', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('the first-session intro captures the same centred radial Atlas with Work below root', async ({ page }) => {
    await page.route('https://cloud.umami.is/**', route => route.abort()).catch(() => {});
    await page.goto('/');
    await page.waitForFunction(() => window.ProfileIntro?.snapshot().stage === 'atlas' && window.ProfileIntro.snapshot().waiting, null, { timeout: 8_000 });

    const points = await page.evaluate(() => {
      const node = id => {
        const element = document.querySelector(`.profile-intro-graph .site-graph-node[data-node-id="${id}"]`);
        return { x: Number(element.dataset.introOriginX), y: Number(element.dataset.introOriginY) };
      };
      return {
        root: node('stepan-chrast'),
        work: node('work'),
        knowledge: node('knowledge'),
        experience: node('experience'),
        education: node('education'),
        about: node('about')
      };
    });

    expect(Math.abs(points.work.x - points.root.x)).toBeLessThan(8);
    expect(points.work.y).toBeGreaterThan(points.root.y);
    expect(points.knowledge.y).toBeLessThan(points.root.y);
    expect(points.experience.x).toBeGreaterThan(points.root.x);
    expect(points.education.y).toBeGreaterThan(points.root.y);
    expect(points.about.x).toBeLessThan(points.root.x);
  });
});
