(() => {
  const scene = window.ProfileScene;
  const artifacts = window.ProfileArtifacts;
  const bindings = window.ARTIFACT_SCENE_BINDINGS;
  const recipes = window.ProfileArtifactSceneRecipes;
  const site = window.SITE_DATA;
  if (!scene?.registry || !scene?.manager || !artifacts || !Array.isArray(bindings) || !recipes || !site?.graph?.nodes) return;
  if (window.ProfileArtifactScenes) return;

  const nodeMap = new Map(site.graph.nodes.map(node => [node.id, node]));
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const normaliseRoute = value =>
    (value || 'overview').replace(/^#/, '').replace(/^\/+|\/+$/g, '') || 'overview';
  const routeForNode = id => nodeMap.get(id)?.route || null;
  const artifactFor = id => artifacts.get(id);
  const hrefFor = id => artifacts.hrefFor(id);

  const canvas = document.querySelector('.scene-canvas');
  if (!canvas) return;

  const layer = document.createElement('div');
  layer.className = 'artifact-scene-layer';
  layer.dataset.artifactSceneLayer = 'true';
  canvas.appendChild(layer);

  const tetherSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  tetherSvg.classList.add('artifact-tether-layer');
  tetherSvg.setAttribute('aria-hidden', 'true');
  const tetherPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  tetherPath.classList.add('artifact-tether-path');
  tetherSvg.appendChild(tetherPath);
  layer.appendChild(tetherSvg);

  const viewer = document.createElement('div');
  viewer.className = 'artifact-focus-viewer';
  viewer.hidden = true;
  viewer.setAttribute('role', 'dialog');
  viewer.setAttribute('aria-modal', 'true');
  viewer.setAttribute('aria-label', 'Artifact viewer');
  viewer.innerHTML = `
    <div class="artifact-focus-backdrop" data-artifact-viewer-close="true"></div>
    <section class="artifact-focus-shell">
      <header class="artifact-focus-header">
        <div>
          <p class="artifact-eyebrow">Artifact focus</p>
          <h3 class="artifact-focus-title"></h3>
        </div>
        <button type="button" class="artifact-focus-close" data-artifact-viewer-close="true" aria-label="Close artifact viewer">×</button>
      </header>
      <div class="artifact-focus-media"></div>
      <footer class="artifact-focus-footer"></footer>
    </section>`;
  layer.appendChild(viewer);

  let viewerBindingId = null;
  let viewerArtifactId = null;
  let highlightedBindingId = null;
  const roots = new Map();
  const definitions = [];
  const issues = [];

  const targetForRoute = (binding, routeValue) => {
    const route = normaliseRoute(routeValue);
    return (binding.targets || []).find(target => {
      const value = normaliseRoute(target.route);
      return target.match === 'prefix' ? route === value || route.startsWith(`${value}/`) : route === value;
    }) || null;
  };

  const currentTarget = binding => targetForRoute(binding, document.body.dataset.graphRoute || location.hash);

  const bindingNodeIds = binding => {
    const ids = new Set((binding.targets || []).map(target => target.anchorNodeId).filter(Boolean));
    (binding.artifactIds || []).forEach(id => {
      const artifact = artifactFor(id);
      (artifact?.anchorNodeIds || []).forEach(nodeId => ids.add(nodeId));
    });
    return ids;
  };

  const clearNodeHighlight = () => {
    document.querySelectorAll('#site-graph .site-graph-node.is-artifact-linked').forEach(node => {
      node.classList.remove('is-artifact-linked');
      delete node.dataset.artifactLink;
    });
    tetherPath.removeAttribute('d');
    tetherSvg.classList.remove('is-visible');
    highlightedBindingId = null;
  };

  const drawTether = (binding, root) => {
    const target = currentTarget(binding);
    if (!target || !root || root.hidden) return false;
    const graphNode = document.querySelector(`#site-graph .site-graph-node[data-node-id="${CSS.escape(target.anchorNodeId)}"]`);
    if (!graphNode || graphNode.closest('.v9-transition-overlay')) return false;

    clearNodeHighlight();
    highlightedBindingId = binding.id;
    graphNode.classList.add('is-artifact-linked');
    graphNode.dataset.artifactLink = binding.id;

    const canvasRect = canvas.getBoundingClientRect();
    const rootRect = root.getBoundingClientRect();
    const nodeRect = graphNode.getBoundingClientRect();
    const node = {
      x: nodeRect.left + nodeRect.width / 2 - canvasRect.left,
      y: nodeRect.top + nodeRect.height / 2 - canvasRect.top
    };
    const panel = {
      x: rootRect.left + rootRect.width / 2 - canvasRect.left,
      y: rootRect.top + rootRect.height / 2 - canvasRect.top
    };
    const fromRight = panel.x < node.x;
    const start = {
      x: fromRight ? rootRect.right - canvasRect.left : rootRect.left - canvasRect.left,
      y: panel.y
    };
    const dx = node.x - start.x;
    const bend = Math.max(58, Math.min(170, Math.abs(dx) * .42));
    const c1x = start.x + (fromRight ? bend : -bend);
    const c2x = node.x + (fromRight ? -bend * .62 : bend * .62);
    tetherPath.setAttribute('d', `M ${start.x.toFixed(1)} ${start.y.toFixed(1)} C ${c1x.toFixed(1)} ${start.y.toFixed(1)}, ${c2x.toFixed(1)} ${node.y.toFixed(1)}, ${node.x.toFixed(1)} ${node.y.toFixed(1)}`);
    tetherSvg.classList.add('is-visible');
    return true;
  };

  const syncPlacement = (binding, root, context) => {
    const target = targetForRoute(binding, context?.route || location.hash);
    if (!target) return;
    root.dataset.artifactTargetRoute = normaliseRoute(target.route);
    root.dataset.artifactAnchorNode = target.anchorNodeId;
    root.dataset.artifactSide = target.side || 'right';
    root.setAttribute('aria-label', `${binding.title || 'Artifact'} scene`);
    if (highlightedBindingId === binding.id) requestAnimationFrame(() => drawTether(binding, root));
  };

  const focusableMedia = (artifact, href) => {
    if (/^image\//.test(artifact.mediaType || '')) {
      const image = document.createElement('img');
      image.src = href;
      image.alt = artifact.title || '';
      image.decoding = 'async';
      return image;
    }
    if (artifact.mediaType === 'application/pdf') {
      const iframe = document.createElement('iframe');
      iframe.src = `${href}#toolbar=1&navpanes=0&view=FitH`;
      iframe.title = artifact.title || 'PDF artifact';
      return iframe;
    }
    const fallback = document.createElement('div');
    fallback.className = 'artifact-focus-generic';
    fallback.textContent = artifact.title || 'Artifact';
    return fallback;
  };

  const closeFocus = ({ restoreFocus = true } = {}) => {
    if (viewer.hidden) return;
    const trigger = viewerArtifactId
      ? document.querySelector(`[data-artifact-scene="${CSS.escape(viewerBindingId || '')}"] [data-artifact-focus="${CSS.escape(viewerArtifactId)}"], [data-artifact-scene="${CSS.escape(viewerBindingId || '')}"] .artifact-deck-card[data-artifact-id="${CSS.escape(viewerArtifactId)}"]`)
      : null;
    viewer.classList.remove('is-open');
    setTimeout(() => {
      if (viewer.classList.contains('is-open')) return;
      viewer.hidden = true;
      viewer.querySelector('.artifact-focus-media').replaceChildren();
      viewer.querySelector('.artifact-focus-footer').replaceChildren();
      viewerBindingId = null;
      viewerArtifactId = null;
      document.body.classList.remove('has-artifact-focus');
      if (restoreFocus) trigger?.focus?.({ preventScroll: true });
    }, reducedMotion.matches ? 0 : 180);
  };

  const openFocus = (binding, artifactId) => {
    const artifact = artifactFor(artifactId);
    const href = hrefFor(artifactId);
    if (!artifact || !href) return false;
    viewerBindingId = binding.id;
    viewerArtifactId = artifactId;
    viewer.querySelector('.artifact-focus-title').textContent = artifact.title;
    const media = viewer.querySelector('.artifact-focus-media');
    media.replaceChildren(focusableMedia(artifact, href));
    const footer = viewer.querySelector('.artifact-focus-footer');
    footer.replaceChildren();

    if (artifact.description) {
      const description = document.createElement('p');
      description.className = 'artifact-focus-description';
      description.textContent = artifact.description;
      footer.appendChild(description);
    }
    const open = document.createElement('a');
    open.className = 'artifact-action';
    open.href = href;
    open.target = '_blank';
    open.rel = 'noreferrer';
    open.textContent = 'Open original ↗';
    footer.appendChild(open);

    viewer.hidden = false;
    document.body.classList.add('has-artifact-focus');
    requestAnimationFrame(() => {
      viewer.classList.add('is-open');
      viewer.querySelector('.artifact-focus-close')?.focus({ preventScroll: true });
    });
    return true;
  };

  viewer.addEventListener('click', event => {
    if (event.target.closest('[data-artifact-viewer-close="true"]')) closeFocus();
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !viewer.hidden) {
      event.preventDefault();
      event.stopImmediatePropagation();
      closeFocus();
    }
  }, true);

  const recipeEnv = { artifactFor, hrefFor, openFocus, routeForNode };

  bindings.forEach(binding => {
    if (!binding?.id || roots.has(binding.id)) {
      issues.push(`Artifact scene binding id must be unique: ${binding?.id || '(missing)'}`);
      return;
    }
    if (!recipes.has(binding.recipe)) {
      issues.push(`Unknown artifact scene recipe for ${binding.id}: ${binding.recipe}`);
      return;
    }
    if (!Array.isArray(binding.artifactIds) || !binding.artifactIds.length) {
      issues.push(`Artifact scene ${binding.id} needs artifactIds.`);
      return;
    }
    const missingArtifacts = binding.artifactIds.filter(id => !artifactFor(id));
    if (missingArtifacts.length) {
      issues.push(`Artifact scene ${binding.id} references missing artifacts: ${missingArtifacts.join(', ')}`);
      return;
    }

    const root = recipes.render(binding, recipeEnv);
    root.hidden = true;
    layer.appendChild(root);
    roots.set(binding.id, root);

    const definition = {
      id: `artifact-scene:${binding.id}`,
      selector: `[data-artifact-scene="${binding.id}"]`,
      anchorNodeId: binding.targets?.[0]?.anchorNodeId || null,
      placement: 'artifact-contextual',
      enter: 'artifact-rise',
      exit: 'artifact-fade',
      visible: context => Boolean(targetForRoute(binding, context.route)),
      mount: context => syncPlacement(binding, root, context),
      update: context => syncPlacement(binding, root, context),
      variants: {
        mobile: {
          placement: 'artifact-mobile-tray'
        }
      }
    };
    scene.registry.register(definition);
    definitions.push(definition);

    root.addEventListener('pointerenter', () => drawTether(binding, root));
    root.addEventListener('pointerleave', event => {
      if (!root.contains(event.relatedTarget)) clearNodeHighlight();
    });
    root.addEventListener('focusin', () => drawTether(binding, root));
    root.addEventListener('focusout', event => {
      if (!root.contains(event.relatedTarget)) clearNodeHighlight();
    });
  });

  layer.addEventListener('pointermove', event => {
    if (reducedMotion.matches) return;
    const tilt = event.target.closest('.artifact-tilt');
    if (!tilt || tilt.closest('.artifact-focus-viewer')) return;
    const rect = tilt.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / Math.max(1, rect.width)));
    const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / Math.max(1, rect.height)));
    tilt.style.setProperty('--artifact-tilt-x', `${((.5 - y) * 5).toFixed(2)}deg`);
    tilt.style.setProperty('--artifact-tilt-y', `${((x - .5) * 6).toFixed(2)}deg`);
  });

  layer.addEventListener('pointerout', event => {
    const tilt = event.target.closest('.artifact-tilt');
    if (!tilt || tilt.contains(event.relatedTarget)) return;
    tilt.style.removeProperty('--artifact-tilt-x');
    tilt.style.removeProperty('--artifact-tilt-y');
  });

  canvas.addEventListener('pointerover', event => {
    const graphNode = event.target.closest?.('#site-graph .site-graph-node[data-node-id]');
    if (!graphNode || graphNode.closest('.v9-transition-overlay')) return;
    const nodeId = graphNode.dataset.nodeId;
    const match = bindings.find(binding => {
      const root = roots.get(binding.id);
      return root && !root.hidden && bindingNodeIds(binding).has(nodeId);
    });
    if (match) {
      const root = roots.get(match.id);
      root?.classList.add('is-node-linked');
      drawTether(match, root);
    }
  });

  canvas.addEventListener('pointerout', event => {
    const graphNode = event.target.closest?.('#site-graph .site-graph-node[data-node-id]');
    if (!graphNode || graphNode.contains(event.relatedTarget)) return;
    roots.forEach(root => root.classList.remove('is-node-linked'));
    clearNodeHighlight();
  });

  window.addEventListener('profile:scene-state', event => {
    const route = normaliseRoute(event.detail?.current?.route || location.hash);
    if (viewerBindingId) {
      const binding = bindings.find(item => item.id === viewerBindingId);
      if (!binding || !targetForRoute(binding, route)) closeFocus({ restoreFocus: false });
    }
    requestAnimationFrame(() => {
      if (highlightedBindingId) {
        const binding = bindings.find(item => item.id === highlightedBindingId);
        const root = binding ? roots.get(binding.id) : null;
        if (!binding || !root || root.hidden) clearNodeHighlight();
        else drawTether(binding, root);
      }
    });
  });

  window.addEventListener('resize', () => {
    if (!highlightedBindingId) return;
    const binding = bindings.find(item => item.id === highlightedBindingId);
    const root = binding ? roots.get(binding.id) : null;
    requestAnimationFrame(() => binding && root && drawTether(binding, root));
  });

  scene.manager.scheduleRefresh('artifact-scenes-ready');

  const snapshot = () => ({
    route: normaliseRoute(document.body.dataset.graphRoute || location.hash),
    recipeNames: recipes.names(),
    issues: issues.slice(),
    visibleBindings: bindings.filter(binding => !roots.get(binding.id)?.hidden).map(binding => binding.id),
    viewer: viewer.hidden ? null : { bindingId: viewerBindingId, artifactId: viewerArtifactId }
  });

  window.ProfileArtifactScenes = Object.freeze({
    bindings,
    layer,
    viewer,
    issues: () => issues.slice(),
    snapshot,
    openFocus: (bindingId, artifactId) => {
      const binding = bindings.find(item => item.id === bindingId);
      return binding ? openFocus(binding, artifactId) : false;
    },
    closeFocus
  });
  window.dispatchEvent(new CustomEvent('profile:artifact-scenes-ready', { detail: snapshot() }));
})();
