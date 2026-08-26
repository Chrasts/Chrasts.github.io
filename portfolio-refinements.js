(() => {
  if (window.ProfileRefinements) return;

  const svgNS = 'http://www.w3.org/2000/svg';
  const projectMap = new Map((window.SITE_DATA?.work?.projects || []).map(project => [project.id, project]));

  const decorateAtlasButton = button => {
    if (!button || button.dataset.phase7V2Decorated === 'true') return false;
    button.dataset.phase7V2Decorated = 'true';
    button.classList.add('atlas-entry-v7');
    button.setAttribute('aria-label', 'Open Atlas, the full profile map');
    button.replaceChildren();
    const glyph = document.createElementNS(svgNS, 'svg');
    glyph.classList.add('atlas-entry-glyph');
    glyph.setAttribute('viewBox', '0 0 88 52');
    glyph.setAttribute('aria-hidden', 'true');
    const edges = document.createElementNS(svgNS, 'g');
    edges.classList.add('atlas-entry-glyph-edges');
    [
      [44,26,13,10],[44,26,75,11],[44,26,14,40],[44,26,74,41],
      [44,26,61,25],[13,10,30,17],[75,11,61,25],[14,40,32,34],[74,41,61,25],[30,17,32,34]
    ].forEach(([x1,y1,x2,y2]) => {
      const line = document.createElementNS(svgNS, 'line');
      line.setAttribute('x1', x1); line.setAttribute('y1', y1);
      line.setAttribute('x2', x2); line.setAttribute('y2', y2);
      edges.appendChild(line);
    });
    const nodes = document.createElementNS(svgNS, 'g');
    nodes.classList.add('atlas-entry-glyph-nodes');
    [[44,26,4.2],[13,10,2.5],[75,11,2.3],[14,40,2.4],[74,41,2.7],[61,25,2.2],[30,17,1.8],[32,34,1.9]].forEach(([cx,cy,r]) => {
      const circle = document.createElementNS(svgNS, 'circle');
      circle.setAttribute('cx', cx); circle.setAttribute('cy', cy); circle.setAttribute('r', r);
      nodes.appendChild(circle);
    });
    glyph.append(edges, nodes);
    const copy = document.createElement('span');
    copy.className = 'atlas-entry-copy';
    const title = document.createElement('strong');
    title.textContent = 'Atlas';
    copy.appendChild(title);
    button.append(glyph, copy);
    return true;
  };
  const decorateAtlasButtons = () => {
    let changed = false;
    document.querySelectorAll('.atlas-button').forEach(button => {
      changed = decorateAtlasButton(button) || changed;
    });
    return changed;
  };

  const enhanceProjectAnchor = anchor => {
    if (!anchor || anchor.dataset.hitboxEnhanced === 'true') return false;
    const text = anchor.querySelector('text');
    if (!text) return false;

    let width = Math.max(104, 28 + (text.textContent || '').length * 6.4);
    try {
      const box = text.getBBox();
      if (Number.isFinite(box.width) && box.width > 0) width = Math.max(width, box.width + 30);
    } catch (_) {}

    const hitbox = document.createElementNS(svgNS, 'rect');
    hitbox.classList.add('work-project-hitbox-v5');
    hitbox.setAttribute('x', String(-width / 2));
    hitbox.setAttribute('y', '-14');
    hitbox.setAttribute('width', String(width));
    hitbox.setAttribute('height', '24');
    hitbox.setAttribute('rx', '6');
    hitbox.setAttribute('aria-hidden', 'true');
    anchor.insertBefore(hitbox, text);

    const project = projectMap.get(anchor.dataset.projectId);
    if (project) anchor.setAttribute('aria-label', `Open project: ${project.title}`);
    anchor.dataset.hitboxEnhanced = 'true';
    return true;
  };

  const enhanceProjectAnchors = () => {
    let changed = false;
    document.querySelectorAll('.work-project-anchor-v5[data-project-id]').forEach(anchor => {
      changed = enhanceProjectAnchor(anchor) || changed;
    });
    return changed;
  };

  const enhanceConceptPanel = () => {
    const panel = document.querySelector('#site-detail-panel.is-work-concept-detail');
    if (!panel || panel.dataset.projectChoicesEnhanced === 'true') return false;
    const list = panel.querySelector('.work-concept-projects');
    if (!list) return false;

    panel.dataset.projectChoicesEnhanced = 'true';
    panel.classList.add('has-primary-project-choices');
    list.classList.add('is-primary-project-choice');

    const title = panel.querySelector('.detail-list-title');
    if (title) title.textContent = 'Open a project';

    const helper = document.createElement('p');
    helper.className = 'work-concept-project-helper';
    helper.textContent = 'Projects are the primary actions here; the lattice node remains the shared thematic intersection.';
    title?.insertAdjacentElement('afterend', helper);

    list.querySelectorAll('.work-concept-project[data-project-id]').forEach(button => {
      if (button.dataset.choiceEnhanced === 'true') return;
      const project = projectMap.get(button.dataset.projectId);
      const label = project?.title || button.textContent || 'Project';
      button.replaceChildren();
      const copy = document.createElement('span');
      copy.className = 'work-concept-project-copy';
      const heading = document.createElement('strong');
      heading.className = 'work-concept-project-title';
      heading.textContent = label;
      const meta = document.createElement('span');
      meta.className = 'work-concept-project-meta';
      meta.textContent = project?.type || 'Project';
      copy.append(heading, meta);
      const arrow = document.createElement('span');
      arrow.className = 'work-concept-project-arrow';
      arrow.setAttribute('aria-hidden', 'true');
      arrow.textContent = '→';
      button.append(copy, arrow);
      button.dataset.choiceEnhanced = 'true';
    });
    return true;
  };

  const graph = document.querySelector('#site-graph');
  const detail = document.querySelector('#site-detail-panel');
  let frame = 0;
  const schedule = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      frame = 0;
      enhanceProjectAnchors();
      enhanceConceptPanel();
      decorateAtlasButtons();
    });
  };

  if (graph) {
    new MutationObserver(schedule).observe(graph, { childList: true, subtree: true });
  }
  if (detail) {
    new MutationObserver(schedule).observe(detail, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'hidden']
    });
  }
  window.addEventListener('profile:scene-state', schedule);
  window.addEventListener('hashchange', schedule);

  schedule();

  window.ProfileRefinements = Object.freeze({
    enhanceProjectAnchors,
    enhanceConceptPanel,
    decorateAtlasButtons,
    snapshot: () => ({
      projectTargets: document.querySelectorAll('.work-project-anchor-v5[data-hitbox-enhanced="true"]').length,
      conceptPanelEnhanced: Boolean(document.querySelector('#site-detail-panel[data-project-choices-enhanced="true"]')),
      atlasButtons: document.querySelectorAll('.atlas-button.atlas-entry-v7').length
    })
  });
})();
