(() => {
  if (window.ProfileArtifactSceneRecipes) return;

  const registry = new Map();
  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  };

  const titleShell = binding => {
    const root = element('section', `artifact-object artifact-recipe-${binding.recipe}`);
    root.dataset.artifactScene = binding.id;
    root.dataset.artifactRecipe = binding.recipe;
    if (binding.variant) root.dataset.artifactVariant = binding.variant;

    const header = element('header', 'artifact-object-header');
    const heading = element('div', 'artifact-heading-copy');
    heading.append(
      element('p', 'artifact-eyebrow', binding.eyebrow || 'Artifact'),
      element('h3', 'artifact-object-title', binding.title || 'Artifact')
    );
    header.appendChild(heading);
    root.appendChild(header);
    if (binding.description) root.appendChild(element('p', 'artifact-object-description', binding.description));
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

  const actionsFor = (binding, env, artifact) => {
    const actions = element('div', 'artifact-actions');
    const inspect = element('button', 'artifact-action artifact-focus-action', 'Inspect');
    inspect.type = 'button';
    inspect.dataset.artifactFocus = artifact.id;
    inspect.addEventListener('click', event => {
      event.stopPropagation();
      env.openFocus(binding, artifact.id);
    });
    actions.appendChild(inspect);

    const href = env.hrefFor(artifact.id);
    if (href) {
      const source = element('a', 'artifact-action', 'Open source ↗');
      source.href = href;
      source.target = '_blank';
      source.rel = 'noreferrer';
      actions.appendChild(source);
    }

    (binding.actionArtifactIds || []).forEach(id => {
      const support = env.artifactFor(id);
      const supportHref = env.hrefFor(id);
      if (!support || !supportHref) return;
      const link = element('a', 'artifact-action artifact-live-action', `${support.title} ↗`);
      link.href = supportHref;
      link.target = '_blank';
      link.rel = 'noreferrer';
      link.dataset.supportArtifactId = id;
      actions.appendChild(link);
    });
    return actions;
  };

  const documentFolio = (binding, env) => {
    const root = titleShell(binding);
    root.classList.add('artifact-tilt-host');
    const artifact = env.artifactFor(binding.artifactIds[0]);
    if (!artifact) return root;
    const href = env.hrefFor(artifact.id);

    const stage = element('div', 'artifact-folio-stage artifact-tilt');
    const shadowPage = element('div', 'artifact-folio-shadow-page');
    const page = element('article', 'artifact-folio-page');
    page.dataset.artifactId = artifact.id;
    page.appendChild(mediaPreview(artifact, href, { className: 'artifact-folio-preview', eager: true }));

    const caption = element('div', 'artifact-folio-caption');
    caption.append(
      element('span', 'artifact-index-label', '01 · document'),
      element('strong', 'artifact-folio-title', artifact.title)
    );
    if (artifact.description) caption.appendChild(element('span', 'artifact-folio-summary', artifact.description));
    page.appendChild(caption);
    stage.append(shadowPage, page);
    root.append(stage, actionsFor(binding, env, artifact));

    page.addEventListener('dblclick', () => env.openFocus(binding, artifact.id));
    return root;
  };

  const mediaDeck = (binding, env) => {
    const root = titleShell(binding);
    const artifacts = binding.artifactIds.map(env.artifactFor).filter(Boolean);
    const deck = element('div', 'artifact-media-deck');
    const cards = new Map();
    let activeId = artifacts[0]?.id || null;

    const activate = id => {
      if (!cards.has(id)) return;
      activeId = id;
      root.dataset.activeArtifactId = id;
      cards.forEach((card, cardId) => {
        const active = cardId === id;
        card.classList.toggle('is-active', active);
        card.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
      const active = env.artifactFor(id);
      const counter = root.querySelector('.artifact-deck-status');
      if (counter && active) {
        const index = artifacts.findIndex(item => item.id === id) + 1;
        counter.textContent = `${String(index).padStart(2, '0')} / ${String(artifacts.length).padStart(2, '0')} · ${active.title}`;
      }
    };

    artifacts.forEach((artifact, index) => {
      const href = env.hrefFor(artifact.id);
      const card = element('button', 'artifact-deck-card artifact-tilt');
      card.type = 'button';
      card.dataset.artifactId = artifact.id;
      card.style.setProperty('--artifact-card-index', String(index));
      card.setAttribute('aria-pressed', index === 0 ? 'true' : 'false');
      card.appendChild(mediaPreview(artifact, href, { className: 'artifact-deck-preview', eager: index === 0 }));
      const label = element('span', 'artifact-deck-label', artifact.title);
      card.appendChild(label);
      card.addEventListener('click', event => {
        event.stopPropagation();
        if (activeId === artifact.id && event.detail > 1) env.openFocus(binding, artifact.id);
        else activate(artifact.id);
      });
      card.addEventListener('dblclick', event => {
        event.preventDefault();
        env.openFocus(binding, artifact.id);
      });
      deck.appendChild(card);
      cards.set(artifact.id, card);
    });

    const footer = element('footer', 'artifact-deck-footer');
    const status = element('span', 'artifact-deck-status');
    const inspect = element('button', 'artifact-action artifact-deck-inspect', 'Inspect active');
    inspect.type = 'button';
    inspect.addEventListener('click', () => {
      if (activeId) env.openFocus(binding, activeId);
    });
    footer.append(status, inspect);

    (binding.actionArtifactIds || []).forEach(id => {
      const artifact = env.artifactFor(id);
      const href = env.hrefFor(id);
      if (!artifact || !href) return;
      const link = element('a', 'artifact-action artifact-live-action', 'Open live app ↗');
      link.href = href;
      link.target = '_blank';
      link.rel = 'noreferrer';
      link.dataset.supportArtifactId = id;
      footer.appendChild(link);
    });

    root.append(deck, footer);
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
