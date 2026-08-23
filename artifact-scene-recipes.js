(() => {
  if (window.ProfileArtifactSceneRecipes) return;

  const registry = new Map();
  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  };

  const sceneRoot = binding => {
    const root = element('section', `artifact-object artifact-recipe-${binding.recipe}`);
    root.dataset.artifactScene = binding.id;
    root.dataset.artifactRecipe = binding.recipe;
    if (binding.variant) root.dataset.artifactVariant = binding.variant;
    root.setAttribute('aria-label', binding.title || 'Artifact objects');
    return root;
  };

  const mediaPreview = (artifact, href, { className = '', eager = false } = {}) => {
    const frame = element('div', `artifact-media-preview ${className}`.trim());
    frame.dataset.artifactId = artifact.id;

    if (/^image\//.test(artifact.mediaType || '')) {
      const image = document.createElement('img');
      image.src = href;
      image.alt = artifact.title || '';
      image.loading = eager ? 'eager' : 'lazy';
      image.decoding = 'async';
      frame.appendChild(image);
      return frame;
    }

    if (artifact.mediaType === 'application/pdf') {
      frame.classList.add('is-pdf');
      const label = element('div', 'artifact-pdf-fallback');
      label.append(
        element('span', 'artifact-pdf-mark', 'PDF'),
        element('strong', 'artifact-pdf-title', artifact.title)
      );
      const iframe = document.createElement('iframe');
      iframe.src = `${href}#page=1&toolbar=0&navpanes=0&scrollbar=0&view=FitH`;
      iframe.title = `${artifact.title} preview`;
      iframe.tabIndex = -1;
      iframe.loading = 'lazy';
      iframe.setAttribute('aria-hidden', 'true');
      frame.append(label, iframe);
      return frame;
    }

    frame.appendChild(element('strong', 'artifact-generic-preview', artifact.title));
    return frame;
  };

  const objectTag = artifact => {
    const tag = element('span', 'artifact-object-tag', artifact.title || 'Artifact');
    tag.setAttribute('aria-hidden', 'true');
    return tag;
  };

  const appendOrbitActions = (root, binding, env, { includePrimarySource = null } = {}) => {
    const actions = element('div', 'artifact-orbit-actions');

    if (includePrimarySource) {
      const href = env.hrefFor(includePrimarySource.id);
      if (href) {
        const source = element('a', 'artifact-orbit-action', 'Source ↗');
        source.href = href;
        source.target = '_blank';
        source.rel = 'noreferrer';
        source.dataset.sourceArtifactId = includePrimarySource.id;
        actions.appendChild(source);
      }
    }

    (binding.actionArtifactIds || []).forEach(id => {
      const support = env.artifactFor(id);
      const supportHref = env.hrefFor(id);
      if (!support || !supportHref) return;
      const link = element('a', 'artifact-orbit-action artifact-live-action', 'Open live ↗');
      link.href = supportHref;
      link.target = '_blank';
      link.rel = 'noreferrer';
      link.dataset.supportArtifactId = id;
      link.setAttribute('aria-label', `Open ${support.title}`);
      actions.appendChild(link);
    });

    if (actions.childElementCount) root.appendChild(actions);
  };

  const documentFolio = (binding, env) => {
    const root = sceneRoot(binding);
    root.classList.add('artifact-document-object');
    const artifact = env.artifactFor(binding.artifactIds[0]);
    if (!artifact) return root;
    const href = env.hrefFor(artifact.id);

    const stage = element('div', 'artifact-folio-stage');
    const shadowPage = element('div', 'artifact-folio-shadow-page');
    shadowPage.setAttribute('aria-hidden', 'true');

    const page = element('button', 'artifact-folio-page artifact-emergent-object');
    page.type = 'button';
    page.dataset.artifactId = artifact.id;
    page.dataset.artifactFocus = artifact.id;
    page.setAttribute('aria-label', `Inspect ${artifact.title}`);
    page.appendChild(mediaPreview(artifact, href, { className: 'artifact-folio-preview', eager: true }));

    const caption = element('span', 'artifact-folio-caption');
    caption.appendChild(element('strong', 'artifact-folio-title', artifact.title));
    if (artifact.description) caption.appendChild(element('span', 'artifact-folio-summary', artifact.description));
    page.appendChild(caption);

    page.addEventListener('click', () => env.openFocus(binding, artifact.id));
    stage.append(shadowPage, page);
    root.appendChild(stage);
    appendOrbitActions(root, binding, env, { includePrimarySource: artifact });
    return root;
  };

  const mediaDeck = (binding, env) => {
    const root = sceneRoot(binding);
    root.classList.add('artifact-emergence-root');
    const artifacts = binding.artifactIds.map(env.artifactFor).filter(Boolean);
    const deck = element('div', 'artifact-media-deck artifact-emergence-field');
    deck.setAttribute('role', 'group');
    deck.setAttribute('aria-label', binding.title || 'Related media');
    const cards = new Map();
    let activeId = artifacts[0]?.id || null;

    const activate = id => {
      if (!cards.has(id)) return;
      activeId = id;
      root.dataset.activeArtifactId = id;
      cards.forEach((card, cardId) => {
        const active = cardId === id;
        card.classList.toggle('is-active', active);
        card.setAttribute('aria-current', active ? 'true' : 'false');
      });
    };

    artifacts.forEach((artifact, index) => {
      const href = env.hrefFor(artifact.id);
      const card = element('button', 'artifact-deck-card artifact-emergent-object');
      card.type = 'button';
      card.dataset.artifactId = artifact.id;
      card.dataset.artifactFocus = artifact.id;
      card.style.setProperty('--artifact-card-index', String(index));
      card.style.setProperty('--artifact-emerge-delay', `${70 + index * 85}ms`);
      card.setAttribute('aria-label', `Inspect ${artifact.title}`);
      card.setAttribute('aria-current', index === 0 ? 'true' : 'false');
      card.append(
        mediaPreview(artifact, href, { className: 'artifact-deck-preview', eager: index === 0 }),
        objectTag(artifact)
      );

      card.addEventListener('pointerenter', () => activate(artifact.id));
      card.addEventListener('focus', () => activate(artifact.id));
      card.addEventListener('click', event => {
        event.stopPropagation();
        activate(artifact.id);
        env.openFocus(binding, artifact.id);
      });

      deck.appendChild(card);
      cards.set(artifact.id, card);
    });

    root.appendChild(deck);
    appendOrbitActions(root, binding, env);
    if (activeId) activate(activeId);
    return root;
  };

  registry.set('document-folio', documentFolio);
  registry.set('media-deck', mediaDeck);

  window.ProfileArtifactSceneRecipes = Object.freeze({
    has: name => registry.has(name),
    get: name => registry.get(name) || null,
    names: () => [...registry.keys()],
    render(binding, env) {
      const renderer = registry.get(binding.recipe);
      if (!renderer) throw new Error(`Unknown artifact scene recipe: ${binding.recipe}`);
      return renderer(binding, env);
    }
  });
})();