const { test, expect } = require('@playwright/test');

const waitReady = async page => {
  await page.addInitScript(() => sessionStorage.setItem('profileIntroSeen', 'true'));
  await page.route('https://cloud.umami.is/**', route => route.abort()).catch(() => {});
  await page.goto('/#overview');
  await page.waitForFunction(() => Boolean(window.ProfilePhase0 && window.ProfileContentIntegrity));
};

test.describe('portfolio content integrity', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('collapses low-signal knowledge destinations without orphaning graph edges', async ({ page }) => {
    await waitReady(page);
    const state = await page.evaluate(() => {
      const nodeIds = new Set(window.SITE_DATA.graph.nodes.map(node => node.id));
      return {
        collapsed: window.ProfileContentIntegrity.collapsedNodeIds,
        presentCollapsed: window.ProfileContentIntegrity.collapsedNodeIds.filter(id => nodeIds.has(id)),
        orphanEdges: window.SITE_DATA.graph.edges.filter(edge => !nodeIds.has(edge.source) || !nodeIds.has(edge.target)),
        duplicateEdges: (() => {
          const seen = new Set();
          return window.SITE_DATA.graph.edges.filter(edge => {
            const key = `${edge.source}|${edge.target}|${edge.type || ''}|${Boolean(edge.secondary)}`;
            if (seen.has(key)) return true;
            seen.add(key);
            return false;
          });
        })()
      };
    });

    expect(state.collapsed.sort()).toEqual([
      'algorithms-data-structures',
      'data-cleaning',
      'data-qa',
      'dynamic-logic',
      'git',
      'logic-for-ai',
      'sat-smt',
      'visualisation'
    ]);
    expect(state.presentCollapsed).toEqual([]);
    expect(state.orphanEdges).toEqual([]);
    expect(state.duplicateEdges).toEqual([]);
  });

  test('publishes current thesis status and Modal Logic Lab destinations', async ({ page }) => {
    await waitReady(page);
    const content = await page.evaluate(() => {
      const thesis = window.SITE_DATA.work.projects.find(project => project.id === 'bachelor-thesis');
      const thesisNode = window.SITE_DATA.graph.nodes.find(node => node.id === 'project-bachelor-thesis');
      const lab = window.SITE_DATA.work.projects.find(project => project.id === 'modal-logic-lab');
      return {
        thesisStatus: thesis?.facets?.status,
        thesisNodeStatus: thesisNode?.status,
        thesisNote: thesis?.note,
        labLinks: lab?.links
      };
    });

    expect(content.thesisStatus).toBe('submitted');
    expect(content.thesisNodeStatus).toBe('submitted');
    expect(content.thesisNote).toContain('submitted');
    expect(content.labLinks).toEqual([
      { label: 'Play ↗', href: 'https://chrasts.github.io/Modal_Logic_Lab/' },
      { label: 'GitHub ↗', href: 'https://github.com/Chrasts/Modal_Logic_Lab' }
    ]);
  });
});
