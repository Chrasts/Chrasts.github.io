(() => {
  const MOBILE_QUERY = '(max-width: 900px)';
  const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const normaliseRoute = value =>
    (value || 'overview').replace(/^#/, '').replace(/^\/+|\/+$/g, '') || 'overview';

  class SceneObjectRegistry {
    constructor() {
      this.objects = new Map();
    }

    register(definition) {
      if (!definition?.id) throw new Error('SceneObject requires an id.');
      const object = {
        manageVisibility: true,
        visibility: true,
        placement: 'scene',
        enter: 'none',
        exit: 'none',
        variants: {},
        ...definition
      };
      this.objects.set(object.id, object);
      return object;
    }

    unregister(id) {
      return this.objects.delete(id);
    }

    get(id) {
      return this.objects.get(id) || null;
    }

    all() {
      return [...this.objects.values()];
    }
  }

  class Camera {
    constructor() {
      this.adapters = new Map();
      this.activeId = null;
      this.listeners = new Set();
    }

    registerAdapter(id, adapter) {
      if (!id || !adapter) throw new Error('Camera adapter requires an id and adapter.');
      this.adapters.set(id, adapter);
      return this;
    }

    use(id) {
      if (id === this.activeId) return this;
      this.activeId = this.adapters.has(id) ? id : null;
      this.emit();
      return this;
    }

    get active() {
      return this.activeId ? this.adapters.get(this.activeId) || null : null;
    }

    snapshot() {
      const value = this.active?.read?.();
      return Object.freeze({
        adapter: this.activeId,
        writable: Boolean(this.active),
        ...(value || { x: 0, y: 0, scale: 1 })
      });
    }

    command(name, payload) {
      const fn = this.active?.[name];
      if (typeof fn !== 'function') return false;
      fn(payload);
      this.emit();
      return true;
    }

    zoom(factor = 1) {
      return this.command('zoom', factor);
    }

    pan(delta = { x: 0, y: 0 }) {
      return this.command('pan', delta);
    }

    fit() {
      return this.command('fit');
    }

    reset() {
      return this.command('reset');
    }

    onChange(listener) {
      this.listeners.add(listener);
      return () => this.listeners.delete(listener);
    }

    emit() {
      const snapshot = this.snapshot();
      this.listeners.forEach(listener => listener(snapshot));
      document.dispatchEvent(new CustomEvent('profile:camera-change', { detail: snapshot }));
    }
  }

  class TransitionCoordinator {
    constructor() {
      this.current = null;
      this.listeners = new Map([
        ['before', new Set()],
        ['after', new Set()],
        ['cancel', new Set()]
      ]);
    }

    get active() {
      return Boolean(this.current);
    }

    begin(meta = {}) {
      if (this.current) return false;
      this.current = Object.freeze({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        startedAt: performance.now(),
        ...meta
      });
      this.emit('before', this.current);
      return true;
    }

    end(meta = {}) {
      if (!this.current) return false;
      const completed = Object.freeze({
        ...this.current,
        ...meta,
        endedAt: performance.now()
      });
      this.current = null;
      this.emit('after', completed);
      return true;
    }

    cancel(reason = 'cancelled') {
      if (!this.current) return false;
      const cancelled = Object.freeze({ ...this.current, reason, endedAt: performance.now() });
      this.current = null;
      this.emit('cancel', cancelled);
      return true;
    }

    on(type, listener) {
      const set = this.listeners.get(type);
      if (!set) throw new Error(`Unknown transition hook: ${type}`);
      set.add(listener);
      return () => set.delete(listener);
    }

    emit(type, detail) {
      this.listeners.get(type)?.forEach(listener => listener(detail));
      document.dispatchEvent(new CustomEvent(`profile:transition-${type}`, { detail }));
    }
  }

  class SceneManager {
    constructor({ registry, camera, transitions }) {
      this.registry = registry;
      this.camera = camera;
      this.transitions = transitions;
      this.mobile = matchMedia(MOBILE_QUERY);
      this.reduced = matchMedia(REDUCED_QUERY);
      this.lastContext = null;
      this.lastPresence = new Map();
      this.frame = 0;
      this.started = false;
      this.observer = null;
    }

    context(patch = {}) {
      const mode = patch.mode || document.body?.dataset.graphMode || 'overview';
      const route = normaliseRoute(
        patch.route || document.body?.dataset.graphRoute || location.hash || 'overview'
      );
      return Object.freeze({
        mode,
        route,
        variant: this.mobile.matches ? 'mobile' : 'desktop',
        reducedMotion: this.reduced.matches,
        transitioning: this.transitions.active || document.body?.classList.contains('is-v9-transitioning') || false,
        ...patch
      });
    }

    resolveElement(object) {
      if (typeof object.element === 'function') return object.element();
      if (typeof object.element === 'string') return document.querySelector(object.element);
      return object.element || null;
    }

    resolveVisibility(object, context, element) {
      if (object.visibility === 'manual') return element ? !element.hidden : false;
      if (typeof object.visibility === 'function') return Boolean(object.visibility(context, element));
      return Boolean(object.visibility);
    }

    resolveVariant(object, context) {
      return {
        placement: object.placement,
        enter: object.enter,
        exit: object.exit,
        ...(object.variants?.[context.variant] || {})
      };
    }

    applyObject(object, context) {
      const element = this.resolveElement(object);
      if (!element) return null;

      const variant = this.resolveVariant(object, context);
      const visible = this.resolveVisibility(object, context, element);
      const previous = this.lastPresence.get(object.id);

      element.dataset.sceneObject = object.id;
      element.dataset.sceneVariant = context.variant;
      element.dataset.scenePlacement = variant.placement || 'scene';
      element.dataset.sceneEnter = variant.enter || 'none';
      element.dataset.sceneExit = variant.exit || 'none';
      element.dataset.scenePresence = visible ? 'visible' : 'hidden';

      if (previous !== undefined && previous !== visible) {
        element.dataset.scenePhase = visible ? 'entering' : 'exiting';
        document.dispatchEvent(new CustomEvent('profile:scene-object-presence', {
          detail: {
            id: object.id,
            visible,
            previous,
            variant: context.variant,
            enter: variant.enter || 'none',
            exit: variant.exit || 'none'
          }
        }));
        requestAnimationFrame(() => {
          if (element.dataset.scenePhase === (visible ? 'entering' : 'exiting')) {
            element.dataset.scenePhase = 'stable';
          }
        });
      } else if (!element.dataset.scenePhase) {
        element.dataset.scenePhase = 'stable';
      }

      if (object.manageVisibility && object.visibility !== 'manual') {
        element.hidden = !visible;
      }

      this.lastPresence.set(object.id, visible);
      return { id: object.id, visible, element, variant };
    }

    chooseCamera(context) {
      if (context.mode === 'atlas') return 'atlas';
      if (context.variant === 'mobile') return 'mobile-local';
      return 'desktop-local';
    }

    sync(patch = {}) {
      const context = this.context(patch);
      this.lastContext = context;
      this.camera.use(this.chooseCamera(context));
      const objects = this.registry.all().map(object => this.applyObject(object, context)).filter(Boolean);
      document.body?.setAttribute('data-scene-variant', context.variant);
      document.body?.setAttribute('data-scene-mode', context.mode);
      return Object.freeze({ context, objects, camera: this.camera.snapshot() });
    }

    scheduleSync() {
      if (this.frame) return;
      this.frame = requestAnimationFrame(() => {
        this.frame = 0;
        this.sync();
      });
    }

    start() {
      if (this.started || !document.body) return;
      this.started = true;

      this.mobile.addEventListener?.('change', () => this.sync());
      this.reduced.addEventListener?.('change', () => this.sync());
      this.transitions.on('before', () => this.sync());
      this.transitions.on('after', () => this.sync());
      this.transitions.on('cancel', () => this.sync());

      this.observer = new MutationObserver(mutations => {
        const relevant = mutations.some(mutation =>
          mutation.type === 'childList' ||
          (mutation.type === 'attributes' && mutation.target === document.body)
        );
        if (relevant) this.scheduleSync();
      });
      this.observer.observe(document.body, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ['data-graph-mode', 'data-graph-route', 'class']
      });

      this.sync();
    }

    inspect() {
      const context = this.context();
      return Object.freeze({
        context,
        transition: this.transitions.current,
        camera: this.camera.snapshot(),
        objects: this.registry.all().map(object => {
          const element = this.resolveElement(object);
          const variant = this.resolveVariant(object, context);
          return {
            id: object.id,
            mounted: Boolean(element),
            visible: element ? this.resolveVisibility(object, context, element) : false,
            placement: variant.placement || 'scene',
            enter: variant.enter || 'none',
            exit: variant.exit || 'none',
            variant: context.variant
          };
        })
      });
    }
  }

  const readAtlasCamera = () => {
    const camera = document.querySelector('#site-graph .site-graph-svg > g');
    const transform = camera?.getAttribute('transform') || '';
    const match = transform.match(/translate\(\s*(-?[\d.]+)[,\s]+(-?[\d.]+)\s*\)\s*scale\(\s*([\d.]+)\s*\)/i);
    return match
      ? { x: Number(match[1]), y: Number(match[2]), scale: Number(match[3]), kind: 'transform' }
      : { x: 0, y: 0, scale: 1, kind: 'transform' };
  };

  const readMobileLocalCamera = () => {
    const svg = document.querySelector('#site-graph .site-graph-svg');
    const values = (svg?.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
    if (values.length !== 4 || values.some(value => !Number.isFinite(value))) {
      return { x: 600, y: 510, scale: 1, kind: 'viewBox' };
    }
    const [x, y, width, height] = values;
    return {
      x: x + width / 2,
      y: y + height / 2,
      scale: height > 0 ? 1020 / height : 1,
      width,
      height,
      kind: 'viewBox'
    };
  };

  const camera = new Camera()
    .registerAdapter('desktop-local', {
      read: () => ({ x: 0, y: 0, scale: 1, kind: 'fixed' })
    })
    .registerAdapter('mobile-local', {
      read: readMobileLocalCamera,
      zoom: factor => {
        if (factor >= 1) window.MobileProfileScene?.zoomIn?.();
        else window.MobileProfileScene?.zoomOut?.();
      },
      fit: () => window.MobileProfileScene?.fitGraph?.(),
      reset: () => window.MobileProfileScene?.resetCamera?.()
    })
    .registerAdapter('atlas', {
      read: readAtlasCamera,
      zoom: factor => document.querySelector(factor >= 1 ? '#atlas-zoom-in' : '#atlas-zoom-out')?.click(),
      fit: () => document.querySelector('#atlas-fit')?.click(),
      reset: () => document.querySelector('#atlas-reset')?.click()
    });

  const registry = new SceneObjectRegistry();
  const transitions = new TransitionCoordinator();
  const manager = new SceneManager({ registry, camera, transitions });

  registry.register({
    id: 'root-profile-copy',
    element: '.hero-copy',
    visibility: context => context.mode === 'overview',
    placement: 'hero-copy',
    enter: 'from-left',
    exit: 'to-left',
    variants: {
      desktop: { placement: 'hero-copy' },
      mobile: { placement: 'hero-copy-compact' }
    }
  });

  registry.register({
    id: 'root-portrait',
    element: '.hero-visual.profile-identity',
    visibility: context => context.mode === 'overview',
    placement: 'hero-identity',
    enter: 'from-right',
    exit: 'to-right',
    variants: {
      desktop: { placement: 'hero-identity' },
      mobile: { placement: 'hero-identity-compact' }
    }
  });

  registry.register({
    id: 'work-controls',
    element: '.integrated-work-controls',
    visibility: context => context.mode === 'work',
    placement: 'scene-rails',
    enter: 'rails-in',
    exit: 'rails-out',
    variants: {
      desktop: { placement: 'scene-rails' },
      mobile: { placement: 'control-sheet' }
    }
  });

  registry.register({
    id: 'atlas-controls',
    element: '#atlas-controls',
    visibility: context => context.mode === 'atlas',
    placement: 'atlas-toolbar',
    enter: 'toolbar-in',
    exit: 'toolbar-out',
    variants: {
      desktop: { placement: 'atlas-toolbar' },
      mobile: { placement: 'control-sheet' }
    }
  });

  registry.register({
    id: 'detail-panel',
    element: '#site-detail-panel',
    visibility: 'manual',
    manageVisibility: false,
    placement: 'scene-detail',
    enter: 'detail-in',
    exit: 'detail-out',
    variants: {
      desktop: { placement: 'scene-detail-right' },
      mobile: { placement: 'scene-detail-sheet' }
    }
  });

  const profileScene = Object.freeze({
    SceneManager,
    SceneObjectRegistry,
    Camera,
    TransitionCoordinator,
    manager,
    registry,
    camera,
    transitions,
    inspect: () => manager.inspect()
  });
  window.ProfileScene = profileScene;

  let previousStableRoute = normaliseRoute(document.body?.dataset.graphRoute || location.hash);
  const transitionObserver = new MutationObserver(mutations => {
    const classChanged = mutations.some(mutation =>
      mutation.type === 'attributes' && mutation.target === document.body && mutation.attributeName === 'class'
    );
    if (!classChanged) return;

    const active = document.body.classList.contains('is-v9-transitioning');
    if (active && !transitions.active) {
      transitions.begin({
        from: previousStableRoute,
        to: normaliseRoute(location.hash || document.body.dataset.graphRoute),
        source: 'graph-transition'
      });
    } else if (!active && transitions.active) {
      const route = normaliseRoute(document.body.dataset.graphRoute || location.hash);
      transitions.end({ to: route });
      previousStableRoute = route;
    }
  });

  if (document.body) {
    transitionObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    manager.start();
  }

  window.addEventListener('hashchange', () => {
    if (!document.body.classList.contains('is-v9-transitioning')) {
      previousStableRoute = normaliseRoute(document.body.dataset.graphRoute || location.hash);
    }
    manager.scheduleSync();
  });
})();
