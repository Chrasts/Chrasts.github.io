const { test, expect } = require('@playwright/test');

const bypassIntro = async page => {
  await page.addInitScript(() => sessionStorage.setItem('profileIntroSeen', 'true'));
  await page.route('https://cloud.umami.is/**', route => route.abort()).catch(() => {});
};

test.describe('semantic graph restructuring', () => {
  test('uses the canonical knowledge hierarchy and keeps tools out of the graph', async ({ page }) => {
    await bypassIntro(page);
    await page.goto('/#atlas');
    await page.waitForFunction(() => Boolean(window.SITE_DATA && window.ProfileAtlasLOD));

    const model = await page.evaluate(() => {
      const nodes = new Map(window.SITE_DATA.graph.nodes.map(node => [node.id, node]));
      const parentOf = id => nodes.get(id)?.parentIds || [];
      return {
        labels: Object.fromEntries([
          'proof-theory', 'sat-smt', 'automated-reasoning', 'logic-for-ai',
          'quantum-logic-arol', 'residuated-ortholattices-arol', 'qualitative-coding'
        ].map(id => [id, nodes.get(id)?.label])),
        parents: Object.fromEntries([
          'set-theory', 'number-theory', 'residuated-ortholattices-arol',
          'qualitative-coding', 'ai-research-workflows'
        ].map(id => [id, parentOf(id)])),
        absent: ['python', 'git', 'sql', 'science-evidence', 'congruence-lattice-problem'].filter(id => nodes.has(id)),
        knowledgeMissingSummary: [...nodes.values()].filter(node => node.type === 'knowledge' && !String(node.summary || '').trim()).map(node => node.id),
        modelTheorySummary: nodes.get('model-theory')?.summary || '',
        latticeTheorySummary: nodes.get('lattice-theory')?.summary || '',
        workThemeNodes: [...nodes.values()].filter(node => node.type === 'work-theme' || node.id.startsWith('work-theme-')).map(node => node.id)
      };
    });

    expect(model.labels).toEqual({
      'proof-theory': 'Proof Theory',
      'sat-smt': 'SAT / SMT',
      'automated-reasoning': 'Automated Reasoning & Model Finding',
      'logic-for-ai': 'Logic for AI',
      'quantum-logic-arol': 'Quantum Logic',
      'residuated-ortholattices-arol': 'Residuated Ortholattices & A-ROL',
      'qualitative-coding': 'Open-text / Qualitative Coding'
    });
    expect(model.parents).toEqual({
      'set-theory': ['mathematical-logic'],
      'number-theory': ['mathematical-logic'],
      'residuated-ortholattices-arol': ['quantum-logic-arol'],
      'qualitative-coding': ['data-analysis'],
      'ai-research-workflows': ['research-practice']
    });
    expect(model.absent).toEqual([]);
    expect(model.knowledgeMissingSummary).toEqual([]);
    expect(model.modelTheorySummary).toMatch(/Löwenheim-Skolem/);
    expect(model.modelTheorySummary).toMatch(/ultraproduct/i);
    expect(model.latticeTheorySummary).toMatch(/Boolean algebras/);
    expect(model.latticeTheorySummary).toMatch(/duality/i);
    expect(model.workThemeNodes).toEqual([]);
  });

  test('consolidates academic duplicates and resolves their legacy routes', async ({ page }) => {
    await bypassIntro(page);
    await page.goto('/#education/charles-university/thesis');
    await page.waitForFunction(() => document.body.dataset.graphRoute === 'work/project/bachelor-thesis');
    await expect(page.locator('#site-detail-panel h2')).toContainText('Bachelor Thesis');

    await page.goto('/#education/charles-university/coursework/clp-historical-survey');
    await page.waitForFunction(() => document.body.dataset.graphRoute === 'work/project/clp-survey');
    await expect(page.locator('#site-detail-panel h2')).toContainText('Congruence Lattice Problem');

    await page.goto('/#knowledge/logic-math/mathematical-logic/modal-logic/dynamic-logic');
    await page.waitForFunction(() => document.body.dataset.graphRoute.endsWith('/dynamic-logic'));
    await expect(page.locator('#site-detail-panel')).toContainText('Completed coursework evidence');
    await expect(page.locator('#site-detail-panel')).toContainText('Dynamic Logic');
  });
});
