(() => {
  const MOBILE_QUERY = '(max-width: 900px)';
  const mobileQuery = window.matchMedia(MOBILE_QUERY);
  const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  const dispatch = (name, detail) => {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  };

  const normaliseRoute = value =>
    (value || 'overview').replace(/^#/, '').replace(/^\/+|\/+$/g, '') || 'overview';

  class SceneObjectRegistry {
    constructor() {
      this.definitions = new Map();
      this.listeners = new Set();
    }

    register(definition) {
      if (!definition || typeof definition !== 'object') {
        throw new TypeError('Scene object definition must be an object.');
      }
      if (!definition.id || typeof definition.id !== 'string') {
        throw new TypeError('Scene object definition requires a string id.');
      }
      if (!definition.selector && typeof definition.resolve !== 'function') {
        throw new TypeError(`Scene object ${definition.id} requires selector or resolve().`);
      }
      if (this.definitions.has(definition.id)) {
        throw new Error(`Scene object id is already registered: ${definition.id}`);
      }

      const normalized = Object.freeze({
        managedVisibility: true,
        visible: () => true,
        placement: null,
        enter: 'none',
        exit: 'none',
        variants: {},
        ...definition
      });
      this.definitions.set(normalized.id, normalized);
      this.listeners.forEach(listener => listener({ type: 'register', definition: normalized }));
      return normalized;
    }

    unregister(id) {
      const definition = this.definitions.get(id);
      if (!definition) return false;
      this.definitions.delete(id);
      this.listeners.forEach(listener => listener({ type: 'unregister', definition }));
      return true;
    }

    has(id) {
      return this.definitions.has(id);
    }

    get(id) {
      return this.definitions.get(id) || null;
    }

    all() {
      return [...this.definitions.values()];
    }

    onChange(listener) {
      this.listeners.add(listener);
      return () => this.listeners.delete(listener);
    }
  }

  class CameraController {
    constructor() {
      this.adapters = new Map();
      this.activeName = 'desktop-local';
      this.listeners = new Set();
    }

    registerAdapter(name, adapter) {
      if (!name || typeof name !== 'string') throw new TypeError('Camera adapter requires a name.');
      if (!adapter || typeof adapter !== 'object') throw new TypeError('Camera adapter must be an object.');
      this.adapters.set(name, adapter);
      this.emit('adapter-registered', { name });
      return () => {
        if (this.adapters.get(name) === adapter) this.adapters.delete(name);
      };
    }

    use(name) {
      if (!name) return this;
      if (this.activeName !== name) {
        this.activeName = name;
        this.emit('adapter-selected', { name });
      }
      return this;
    }

    active() {
      return this.adapters.get(this.activeName) || null;
    }

    read() {
      const adapter = this.active();
      const state = adapter?.read?.() || {};
      return {
        x: Number.isFinite(state.x) ? state.x : 0,
        y: Number.isFinite(state.y) ? state.y : 0,
        scale: Number.isFinite(state.scale) ? state.scale : 1,
        viewportWidth: Number.isFinite(state.viewportWidth) ? state.viewportWidth : window.innerWidth,
        viewportHeight: Number.isFinite(state.viewportHeight) ? state.viewportHeight : window.innerHeight,
        mode: state.mode || this.activeName,
        adapter: this.activeName
      };
    }

    call(method, ...args) {
      const adapter = this.active();
      if (typeof adapter?.[method] !== 'function') return false;
      return adapter[method](...args);
    }

    fit(bounds = null, options = {}) {
      return this.call('fit', bounds, options);
    }

    focus(node, options = {}) {
      return this.call('focus', node, options);
    }

    follow(path, options = {}) {
      return this.call('follow', path, options);
    }

    zoomAt(point, factor, options = {}) {
      return this.call('zoomAt', point, factor, options);
    }

    pan(delta, options = {}) {
      return this.call('pan', delta, options);
    }

    transitionTo(state, options = {}) {
      return this.call('transitionTo', state, options);
    }

    reset(options = {}) {
      return this.call('reset', options);
    }

    serialize() {
      const adapter = this.active();
      return adapter?.serialize?.() || this.read();
    }

    onChange(listener) {
      this.listeners.add(listener);
      return () => this.listeners.delete(listener);
    }

    emit(type, detail = {}) {
      const payload = { type, active: this.activeName, ...detail };
      this.listeners.forEach(listener => listener(payload));
      dispatch('profile:camera', payload);
    }
  }

  class TransitionCoordinator {
    constructor() {
      this.current = null;
      this.sequence = 0;
      this.hooks = new Map([
        ['begin', new Set()],
        ['prepare', new Set()],
        ['commit', new Set()],
        ['finish', new Set()],
        ['cancel', new Set()]
      ]);
    }

    get isLocked() {
      return Boolean(this.current);
    }

    begin(payload = {}) {
      if (this.current) return null;
      const token = `scene-transition-${++this.sequence}`;
      this.current = {
        token,
        phase: 'begin',
        startedAt: performance.now(),
        ...payload
      };
      this.emit('begin', this.current);
      return token;
    }

    prepare(token, payload = {}) {
      return this.advance('prepare', token, payload);
    }

    commit(token, payload = {}) {
      return this.advance('commit', token, payload);
    }

    finish(token, payload = {}) {
      if (!this.matches(token)) return false;
      const completed = {
        ...this.current,
        ...payload,
        phase: 'finish',
        finishedAt: performance.now()
      };
      this.emit('finish', completed);
      this.current = null;
      return true;
    }

    cancel(token, payload = {}) {
      if (!this.matches(token)) return false;
      const cancelled = {
        ...this.current,
        ...payload,
        phase: 'cancel',
        finishedAt: performance.now()
      };
      this.emit('cancel', cancelled);
      this.current = null;
      return true;
    }

    advance(phase, token, payload) {
      if (!this.matches(token)) return false;
      this.current = { ...this.current, ...payload, phase };
      this.emit(phase, this.current);
      return true;
    }

    matches(token) {
      return Boolean(this.current && token && this.current.token === token);
    }

    hook(phase, listener) {
      if (!this.hooks.has(phase)) throw new Error(`Unknown transition phase: ${phase}`);
      this.hooks.get(phase).add(listener);
      return () => this.hooks.get(phase)?.delete(listener);
    }

    emit(phase, payload) {
      this.hooks.get(phase)?.forEach(listener => listener(payload));
      dispatch(`profile:transition-${phase}`, payload);
    }

    snapshot() {
      return this.current ? { ...this.current } : null;
    }
  }

  class SceneManager {
    constructor({ registry, camera, transitions }) {
      this.registry = registry;
      this.camera = camera;
      this.transitions = transitions;
      this.instances = new Map();
      this.objectState = new Map();
      this.graphState = {
        route: normaliseRoute(location.hash),
        mode: document.body?.dataset.graphMode || 'overview',
        activeNodeId: null,
        workProjectId: null
      };
      this.variant = mobileQuery.matches ? 'mobile' : 'desktop';
      this.refreshFrame = 0;

      this.registry.onChange(change => {
        if (change.type === 'unregister') {
          this.detachInstance(change.definition.id, change.definition, { reason: 'registry-unregister' });
          this.objectState.delete(change.definition.id);
          return;
        }
        this.scheduleRefresh('registry');
      });
      mobileQuery.addEventListener?.('change', event => {
        this.variant = event.matches ? 'mobile' : 'desktop';
        this.scheduleRefresh('variant');
      });

      this.transitions.hook('begin', payload => this.onTransition('begin', payload));
      this.transitions.hook('prepare', payload => this.onTransition('prepare', payload));
      this.transitions.hook('commit', payload => this.onTransition('commit', payload));
      this.transitions.hook('finish', payload => this.onTransition('finish', payload));
      this.transitions.hook('cancel', payload => this.onTransition('cancel', payload));

      const observe = () => {
        if (!document.body) return;

        const stateObserver = new MutationObserver(() => this.scheduleRefresh('graph-state-dom'));
        stateObserver.observe(document.body, {
          attributes: true,
          attributeFilter: ['data-graph-mode', 'data-graph-route']
        });

        const canvas = document.querySelector('.scene-canvas');
        if (canvas) {
          const sceneRootObserver = new MutationObserver(mutations => {
            if (mutations.some(mutation => mutation.type === 'childList')) {
              this.scheduleRefresh('scene-root-dom');
            }
          });
          // Scene-object roots are intentionally mounted as direct children of
          // the scene canvas. Avoid observing the whole graph subtree: graph
          // transitions create many short-lived nodes that are irrelevant to
          // scene-object discovery and used to cause refresh feedback loops.
          sceneRootObserver.observe(canvas, { childList: true });
        }
      };
      if (document.body) observe();
      else document.addEventListener('DOMContentLoaded', observe, { once: true });
    }

    context(extra = {}) {
      return {
        ...this.graphState,
        variant: this.variant,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        },
        reducedMotion: reducedMotionQuery.matches,
        camera: this.camera.read(),
        transition: this.transitions.snapshot(),
        ...extra
      };
    }

    setGraphState(next, { reason = 'renderer' } = {}) {
      const previous = { ...this.graphState };
      this.graphState = {
        ...this.graphState,
        ...next,
        route: normaliseRoute(next?.route ?? this.graphState.route)
      };
      document.body.dataset.sceneMode = this.graphState.mode || 'overview';
      document.body.dataset.sceneRoute = this.graphState.route;
      document.body.dataset.sceneVariant = this.variant;
      this.useCameraForCurrentScene();
      this.refresh({ reason, previousGraphState: previous });
      dispatch('profile:scene-state', {
        previous,
        current: { ...this.graphState },
        variant: this.variant,
        reason
      });
    }

    setObjectState(id, patch = {}) {
      const current = this.objectState.get(id) || {};
      this.objectState.set(id, { ...current, ...patch });
      this.refreshObject(id, { reason: 'object-state' });
    }

    getObjectState(id) {
      return { ...(this.objectState.get(id) || {}) };
    }

    useCameraForCurrentScene() {
      const mode = this.graphState.mode || 'overview';
      if (mode === 'atlas') this.camera.use('atlas');
      else if (this.variant === 'mobile') this.camera.use('mobile-local');
      else this.camera.use('desktop-local');
    }

    scheduleRefresh(reason = 'scheduled') {
      cancelAnimationFrame(this.refreshFrame);
      this.refreshFrame = requestAnimationFrame(() => {
        this.refreshFrame = 0;
        this.refresh({ reason });
      });
    }

    refresh(meta = {}) {
      document.body.dataset.sceneVariant = this.variant;
      this.useCameraForCurrentScene();
      this.registry.all().forEach(definition => this.applyDefinition(definition, meta));
    }

    refreshObject(id, meta = {}) {
      const definition = this.registry.get(id);
      if (definition) this.applyDefinition(definition, meta);
    }

    resolveElement(definition) {
      if (typeof definition.resolve === 'function') return definition.resolve(this.context()) || null;
      return document.querySelector(definition.selector);
    }

    variantDefinition(definition) {
      const variant = definition.variants?.[this.variant] || {};
      return { ...definition, ...variant, variants: definition.variants };
    }

    clearDeclaration(element, definition) {
      if (!element) return;
      element.classList.remove('scene-object');
      delete element.dataset.sceneObject;
      delete element.dataset.sceneVariant;
      delete element.dataset.scenePlacement;
      delete element.dataset.sceneAnchor;
      delete element.dataset.sceneEnter;
      delete element.dataset.sceneExit;
      delete element.dataset.sceneVisible;
      delete element.dataset.sceneLifecycle;
      element.style.removeProperty('--scene-z');
      if (definition?.managedVisibility !== false) element.hidden = false;
    }

    detachInstance(id, fallbackDefinition = null, meta = {}) {
      const instance = this.instances.get(id);
      if (!instance) return false;
      const definition = instance.definition || fallbackDefinition;
      if (typeof definition?.unmount === 'function') {
        definition.unmount(this.objectContext(definition, instance.element, meta));
      }
      this.clearDeclaration(instance.element, definition);
      this.instances.delete(id);
      return true;
    }

    applyDefinition(definition, meta = {}) {
      const resolved = this.variantDefinition(definition);
      const element = this.resolveElement(resolved);
      const previousInstance = this.instances.get(definition.id) || null;

      if (!element) {
        this.detachInstance(definition.id, resolved, meta);
        return;
      }

      if (previousInstance?.element && previousInstance.element !== element) {
        this.detachInstance(definition.id, previousInstance.definition || resolved, {
          ...meta,
          reason: meta.reason || 'scene-element-replaced'
        });
      }

      const runtime = this.objectState.get(definition.id) || {};
      const context = this.objectContext(resolved, element, meta, runtime);
      const visible = typeof resolved.visible === 'function'
        ? Boolean(resolved.visible(context))
        : Boolean(resolved.visible);
      const activeInstance = this.instances.get(definition.id) || null;
      const wasVisible = activeInstance?.visible ?? null;

      if (!activeInstance || activeInstance.element !== element) {
        element.dataset.sceneObject = definition.id;
        element.classList.add('scene-object');
        if (typeof resolved.mount === 'function') resolved.mount(context);
      }

      this.applyDeclaration(element, resolved);

      if (resolved.managedVisibility !== false) {
        element.hidden = !visible;
      }
      element.dataset.sceneVisible = visible ? 'true' : 'false';

      if (wasVisible !== visible) {
        element.dataset.sceneLifecycle = visible ? 'entering' : 'exiting';
        if (visible && typeof resolved.enter === 'function') resolved.enter(context);
        if (!visible && typeof resolved.exit === 'function') resolved.exit(context);
      } else if (typeof resolved.update === 'function') {
        resolved.update(context);
      }

      this.instances.set(definition.id, {
        element,
        visible,
        variant: this.variant,
        definition: resolved
      });
    }

    applyDeclaration(element, definition) {
      const placement = typeof definition.placement === 'string'
        ? definition.placement
        : definition.placement?.slot || definition.placement?.name || '';
      element.dataset.sceneVariant = this.variant;
      if (placement) element.dataset.scenePlacement = placement;
      else delete element.dataset.scenePlacement;

      const anchor = definition.anchorNodeId || definition.placement?.anchorNodeId;
      if (anchor) element.dataset.sceneAnchor = anchor;
      else delete element.dataset.sceneAnchor;

      const enter = typeof definition.enter === 'string' ? definition.enter : definition.enterPreset;
      const exit = typeof definition.exit === 'string' ? definition.exit : definition.exitPreset;
      if (enter) element.dataset.sceneEnter = enter;
      else delete element.dataset.sceneEnter;
      if (exit) element.dataset.sceneExit = exit;
      else delete element.dataset.sceneExit;

      const zIndex = definition.zIndex ?? definition.placement?.zIndex;
      if (Number.isFinite(zIndex)) element.style.setProperty('--scene-z', String(zIndex));
      else element.style.removeProperty('--scene-z');
    }

    objectContext(definition, element, meta = {}, objectState = null) {
      return {
        ...this.context(),
        definition,
        element,
        objectState: objectState || this.objectState.get(definition.id) || {},
        manager: this,
        registry: this.registry,
        cameraController: this.camera,
        transitionCoordinator: this.transitions,
        ...meta
      };
    }

    onTransition(phase, payload) {
      document.body.dataset.sceneTransitionPhase = phase;
      if (phase === 'finish' || phase === 'cancel') {
        delete document.body.dataset.sceneTransitionPhase;
        this.instances.forEach(instance => {
          delete instance.element.dataset.sceneLifecycle;
        });
      }
      this.refresh({ reason: `transition-${phase}`, transitionPayload: payload });
    }

    snapshot() {
      return {
        graphState: { ...this.graphState },
        variant: this.variant,
        camera: this.camera.serialize(),
        transition: this.transitions.snapshot(),
        objects: [...this.instances.entries()].map(([id, instance]) => ({
          id,
          visible: instance.visible,
          variant: instance.variant,
          placement: instance.element.dataset.scenePlacement || null,
          enter: instance.element.dataset.sceneEnter || null,
          exit: instance.element.dataset.sceneExit || null
        }))
      };
    }
  }

  const registry = new SceneObjectRegistry();
  const camera = new CameraController();
  const transitions = new TransitionCoordinator();
  const manager = new SceneManager({ registry, camera, transitions });

  window.ProfileScene = Object.freeze({
    registry,
    camera,
    transitions,
    manager,
    SceneObjectRegistry,
    CameraController,
    TransitionCoordinator,
    SceneManager,
    MOBILE_QUERY,
    normaliseRoute
  });

  dispatch('profile:scene-system-ready', { registry, camera, transitions, manager });
})();
