(() => {
  if (window.ProfileRefinements) return;

  const svgNS = 'http://www.w3.org/2000/svg';
  const projectMap = new Map((window.SITE_DATA?.work?.projects || []).map(project => [project.id, project]));

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
    snapshot: () => ({
      projectTargets: document.querySelectorAll('.work-project-anchor-v5[data-hitbox-enhanced="true"]').length,
      conceptPanelEnhanced: Boolean(document.querySelector('#site-detail-panel[data-project-choices-enhanced="true"]'))
    })
  });
})();
