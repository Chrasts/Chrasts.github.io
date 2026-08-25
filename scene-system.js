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
      this.participants = new Map();
      this.lastInterruption = null;
      this.hooks = new Map([
        ['begin', new Set()],
        ['prepare', new Set()],
        ['commit', new Set()],
        ['retarget', new Set()],
        ['interrupt', new Set()],
        ['finish', new Set()],
        ['cancel', new Set()]
      ]);
    }

    get isLocked() {
      return Boolean(this.current);
    }

    registerParticipant(name, participant = {}) {
      if (!name || typeof name !== 'string') throw new TypeError('Transition participant requires a name.');
      if (!participant || typeof participant !== 'object') throw new TypeError('Transition participant must be an object.');
      this.participants.set(name, participant);
      return () => {
        if (this.participants.get(name) === participant) this.participants.delete(name);
      };
    }

    capture(reason = 'capture') {
      const captured = {};
      this.participants.forEach((participant, name) => {
        if (typeof participant.capture !== 'function') return;
        try {
          const value = participant.capture({ reason, transition: this.snapshot() });
          if (value !== undefined) captured[name] = value;
        } catch (_) {}
      });
      return captured;
    }

    interrupt(payload = {}) {
      const active = this.current ? { ...this.current } : null;
      const captured = this.capture(payload.reason || 'interrupted');
      const interruption = {
        ...(active || {}),
        ...payload,
        phase: 'interrupt',
        interruptedAt: performance.now(),
        captured
      };

      this.participants.forEach((participant, name) => {
        if (typeof participant.cancel !== 'function') return;
        try {
          participant.cancel({
            ...interruption,
            participant: name
          });
        } catch (_) {}
      });

      this.lastInterruption = interruption;
      this.emit('interrupt', interruption);
      if (active && this.current?.token === active.token) {
        const cancelled = {
          ...active,
          ...payload,
          phase: 'cancel',
          interrupted: true,
          captured,
          finishedAt: performance.now()
        };
        this.emit('cancel', cancelled);
        this.current = null;
      }
      return interruption;
    }

    begin(payload = {}, options = {}) {
      const token = `scene-transition-${++this.sequence}`;
      if (this.current) {
        if (options.supersede === false) return null;
        this.interrupt({
          reason: options.reason || 'superseded',
          supersededBy: token,
          next: payload
        });
      }
      this.current = {
        token,
        generation: this.sequence,
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

    retarget(token, payload = {}) {
      return this.advance('retarget', token, payload);
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
      const active = { ...this.current };
      const captured = this.capture(payload.reason || 'cancelled');
      this.participants.forEach((participant, name) => {
        if (typeof participant.cancel !== 'function') return;
        try {
          participant.cancel({ ...active, ...payload, participant: name, captured });
        } catch (_) {}
      });
      const cancelled = {
        ...active,
        ...payload,
        phase: 'cancel',
        captured,
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

    diagnostics() {
      return {
        current: this.snapshot(),
        sequence: this.sequence,
        participants: [...this.participants.keys()],
        lastInterruption: this.lastInterruption ? { ...this.lastInterruption } : null
      };
    }
  }

  const SCENE_OBJECT_CLASSES = Object.freeze({
    image: Object.freeze({ media: true, focus: true, defaultLayout: 'scatter', depthChannel: 'content' }),
    document: Object.freeze({ media: true, focus: true, defaultLayout: 'stack', depthChannel: 'document' }),
    video: Object.freeze({ media: true, focus: true, defaultLayout: 'strip', depthChannel: 'media' }),
    diagram: Object.freeze({ media: true, focus: true, defaultLayout: 'scatter', depthChannel: 'diagram' }),
    'data-visualisation': Object.freeze({ media: false, focus: true, defaultLayout: 'strip', depthChannel: 'interactive' })
  });

  const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const stableHash = value => {
    let hash = 2166136261;
    String(value || '').split('').forEach(character => {
      hash ^= character.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    });
    return hash >>> 0;
  };
  const seededUnit = (seed, salt) => {
    let value = stableHash(`${seed}:${salt}`) || 1;
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    return (value >>> 0) / 4294967295;
  };
  const rectValue = rect => rect ? {
    x: finite(rect.x ?? rect.left),
    y: finite(rect.y ?? rect.top),
    width: Math.max(0, finite(rect.width)),
    height: Math.max(0, finite(rect.height))
  } : null;

  class SceneObjectRuntime {
    constructor({ transitions }) {
      this.transitions = transitions;
      this.definitions = new Map();
      this.records = new Map();
      this.pendingRestore = new Map();
      this.sceneLifecycle = new Map();
      this.sequence = 0;
      this.lastInterruption = null;
      this.listeners = new Set();

      transitions.registerParticipant('scene-objects', {
        capture: ({ reason }) => ({ reason, runtime: this.serialize() }),
        cancel: payload => this.interruptAll(payload.reason || 'scene-transition-interrupt')
      });
      window.addEventListener('profile:scene-composition', event => this.captureComposition(event.detail));
    }

    objectClass(kind) {
      return SCENE_OBJECT_CLASSES[kind] || null;
    }

    register(definition) {
      if (!definition || typeof definition !== 'object') throw new TypeError('Runtime object definition must be an object.');
      if (!definition.id || typeof definition.id !== 'string') throw new TypeError('Runtime object definition requires a string id.');
      if (!definition.sceneId || typeof definition.sceneId !== 'string') throw new TypeError(`Runtime object ${definition.id} requires a sceneId.`);
      if (!this.objectClass(definition.kind)) throw new Error(`Unknown runtime object class: ${definition.kind}`);
      if (this.definitions.has(definition.id)) throw new Error(`Runtime object id is already registered: ${definition.id}`);

      const objectClass = this.objectClass(definition.kind);
      const normalized = Object.freeze({
        layout: { strategy: objectClass.defaultLayout },
        depth: { channel: objectClass.depthChannel, level: 0 },
        media: { status: 'idle', currentTime: 0, duration: null, muted: true, volume: 1 },
        ...definition,
        layout: { strategy: objectClass.defaultLayout, ...(definition.layout || {}) },
        depth: { channel: objectClass.depthChannel, level: 0, ...(definition.depth || {}) },
        media: { status: 'idle', currentTime: 0, duration: null, muted: true, volume: 1, ...(definition.media || {}) }
      });
      const restored = this.pendingRestore.get(normalized.id);
      const record = {
        id: normalized.id,
        sceneId: normalized.sceneId,
        kind: normalized.kind,
        phase: 'ambient',
        selected: false,
        media: { ...normalized.media },
        depth: { ...normalized.depth },
        layout: null,
        returnGeometry: null,
        composition: null,
        interruption: null
      };
      this.definitions.set(normalized.id, normalized);
      this.records.set(normalized.id, restored ? this.mergeRestored(record, restored) : record);
      this.pendingRestore.delete(normalized.id);
      this.layoutScene(normalized.sceneId);
      this.apply(normalized.id);
      this.emit('register', normalized.id);
      return normalized;
    }

    unregister(id) {
      const definition = this.definitions.get(id);
      if (!definition) return false;
      const element = this.elementFor(definition);
      if (element) {
        delete element.dataset.sceneRuntimeObject;
        delete element.dataset.sceneRuntimeKind;
        delete element.dataset.sceneRuntimePhase;
        delete element.dataset.sceneRuntimeLayout;
        delete element.dataset.sceneRuntimeDepth;
        ['--scene-object-x', '--scene-object-y', '--scene-object-rotation', '--scene-object-scale', '--scene-object-depth'].forEach(name => element.style.removeProperty(name));
      }
      this.definitions.delete(id);
      this.records.delete(id);
      this.emit('unregister', id);
      return true;
    }

    unregisterScene(sceneId) {
      [...this.definitions.values()].filter(definition => definition.sceneId === sceneId).forEach(definition => this.unregister(definition.id));
      this.sceneLifecycle.delete(sceneId);
    }

    elementFor(definition) {
      if (definition.element instanceof Element) return definition.element;
      if (typeof definition.resolve === 'function') return definition.resolve() || null;
      if (definition.selector) return document.querySelector(definition.selector);
      return null;
    }

    objectsInScene(sceneId) {
      return [...this.definitions.values()].filter(definition => definition.sceneId === sceneId);
    }

    deterministicLayout({ strategy = 'scatter', seed = 'scene', index = 0, count = 1 } = {}) {
      const middle = (Math.max(1, count) - 1) / 2;
      const relative = count > 1 ? (index - middle) / Math.max(1, middle) : 0;
      if (strategy === 'stack') return { x: index * 0.018, y: index * 0.022, rotation: index % 2 ? 2.4 : -2.1, scale: 1, z: count - index };
      if (strategy === 'fan') return { x: relative * .28, y: Math.abs(relative) * .1, rotation: relative * 8, scale: 1, z: count - Math.abs(index - middle) };
      if (strategy === 'strip') return { x: relative * .38, y: index % 2 ? .055 : -.025, rotation: relative * 2.5, scale: 1, z: count - index };
      if (strategy === 'orbit') {
        const angle = (Math.PI * 2 * index / Math.max(1, count)) - Math.PI / 2;
        return { x: Math.cos(angle) * .32, y: Math.sin(angle) * .24, rotation: angle * 180 / Math.PI + 90, scale: 1, z: index + 1 };
      }
      const x = (seededUnit(seed, `${index}:x`) - .5) * .52;
      const y = (seededUnit(seed, `${index}:y`) - .5) * .28;
      const rotation = (seededUnit(seed, `${index}:r`) - .5) * 12;
      return { x, y, rotation, scale: .98 + seededUnit(seed, `${index}:s`) * .04, z: index + 1 };
    }

    layoutScene(sceneId) {
      const definitions = this.objectsInScene(sceneId).sort((a, b) => {
        const ai = finite(a.layout?.index, Number.MAX_SAFE_INTEGER);
        const bi = finite(b.layout?.index, Number.MAX_SAFE_INTEGER);
        return ai - bi || a.id.localeCompare(b.id);
      });
      definitions.forEach((definition, index) => {
        const strategy = definition.layout.strategy || this.objectClass(definition.kind).defaultLayout;
        const layout = this.deterministicLayout({
          strategy,
          seed: definition.layout.seed || sceneId,
          index: Number.isFinite(definition.layout.index) ? definition.layout.index : index,
          count: Math.max(definitions.length, finite(definition.layout.count, definitions.length))
        });
        const record = this.records.get(definition.id);
        if (record) record.layout = { strategy, ...layout };
        this.apply(definition.id);
      });
      return definitions.map(definition => this.records.get(definition.id)?.layout);
    }

    setState(id, patch = {}, type = 'state') {
      const record = this.records.get(id);
      if (!record) return false;
      if (patch.media) record.media = { ...record.media, ...patch.media };
      if (patch.depth) record.depth = { ...record.depth, ...patch.depth };
      Object.entries(patch).forEach(([key, value]) => {
        if (key !== 'media' && key !== 'depth') record[key] = value;
      });
      this.apply(id);
      this.emit(type, id);
      return true;
    }

    getState(id) {
      const record = this.records.get(id);
      return record ? {
        ...record,
        media: { ...record.media },
        depth: { ...record.depth },
        layout: record.layout ? { ...record.layout } : null,
        returnGeometry: record.returnGeometry ? { ...record.returnGeometry } : null,
        composition: record.composition ? { ...record.composition } : null
      } : null;
    }

    activate(id) {
      const record = this.records.get(id);
      if (!record) return false;
      this.objectsInScene(record.sceneId).forEach(definition => {
        const item = this.records.get(definition.id);
        if (!item || item.phase === 'inspect' || item.phase === 'focusing' || item.phase === 'returning') return;
        item.selected = definition.id === id;
        item.phase = item.selected ? 'active' : 'ambient';
        this.apply(definition.id);
      });
      this.emit('activate', id);
      return true;
    }

    beginFocus(id, geometry = null) {
      const definition = this.definitions.get(id);
      const element = definition ? this.elementFor(definition) : null;
      const captured = rectValue(geometry || element?.getBoundingClientRect?.());
      this.activate(id);
      return this.setState(id, { phase: 'focusing', selected: true, returnGeometry: captured }, 'focus-begin');
    }

    settleFocus(id) {
      return this.setState(id, { phase: 'inspect' }, 'focus-settle');
    }

    beginReturn(id) {
      return this.setState(id, { phase: 'returning' }, 'return-begin');
    }

    completeReturn(id) {
      return this.setState(id, { phase: 'active', selected: true }, 'return-complete');
    }

    setMediaState(id, patch = {}) {
      const normalized = { ...patch };
      if (normalized.currentTime != null) normalized.currentTime = Math.max(0, finite(normalized.currentTime));
      if (normalized.duration != null) normalized.duration = Math.max(0, finite(normalized.duration));
      if (normalized.volume != null) normalized.volume = clamp(finite(normalized.volume, 1), 0, 1);
      return this.setState(id, { media: normalized }, 'media');
    }

    interrupt(id, reason = 'interrupted') {
      const record = this.records.get(id);
      if (!record) return false;
      const transient = ['focusing', 'inspect', 'returning', 'entering', 'exiting'].includes(record.phase);
      if (transient) record.phase = record.selected ? 'active' : 'ambient';
      if (record.media.status === 'playing') record.media.status = 'paused';
      record.interruption = { reason, sequence: ++this.sequence };
      const definition = this.definitions.get(id);
      this.elementFor(definition)?.querySelectorAll?.('video,audio').forEach(media => media.pause());
      this.apply(id);
      this.emit('interrupt', id);
      return true;
    }

    interruptAll(reason = 'interrupted') {
      const affected = [...this.records.values()].filter(record => ['focusing', 'inspect', 'returning', 'entering', 'exiting'].includes(record.phase) || record.media.status === 'playing');
      affected.forEach(record => this.interrupt(record.id, reason));
      this.lastInterruption = { reason, affected: affected.map(record => record.id), sequence: this.sequence };
      return this.lastInterruption;
    }

    syncScene(sceneId, phase, context = {}) {
      const definitions = this.objectsInScene(sceneId);
      if (!definitions.length) return false;
      this.sceneLifecycle.set(sceneId, { phase, reason: context.reason || null });
      definitions.forEach(definition => {
        const record = this.records.get(definition.id);
        if (!record || ['focusing', 'inspect', 'returning'].includes(record.phase)) return;
        if (phase === 'entering') record.phase = 'entering';
        else if (phase === 'active') record.phase = record.selected ? 'active' : 'ambient';
        else if (phase === 'exiting') record.phase = 'exiting';
        else if (phase === 'unmounted') record.phase = 'unmounted';
        this.apply(definition.id);
      });
      this.emit(`scene-${phase}`, sceneId);
      return true;
    }

    mountScene(sceneId, context) { this.syncScene(sceneId, 'mounted', context); }
    enterScene(sceneId, context) {
      if (!this.syncScene(sceneId, 'entering', context)) return;
      const lifecycle = this.sceneLifecycle.get(sceneId);
      requestAnimationFrame(() => {
        if (this.sceneLifecycle.get(sceneId) === lifecycle && lifecycle?.phase === 'entering') {
          this.syncScene(sceneId, 'active', context);
        }
      });
    }
    updateScene(sceneId, context) {
      const phase = context?.element?.hidden ? 'hidden' : 'active';
      if (phase === 'active') this.syncScene(sceneId, phase, context);
    }
    exitScene(sceneId, context) { this.syncScene(sceneId, 'exiting', context); }
    unmountScene(sceneId, context) { this.syncScene(sceneId, 'unmounted', context); }

    captureComposition(snapshot = {}) {
      (snapshot.assignments || []).forEach(assignment => {
        this.objectsInScene(assignment.id).forEach(definition => {
          const record = this.records.get(definition.id);
          if (record) record.composition = {
            zone: assignment.zone || null,
            side: assignment.side || null,
            slot: assignment.slot ?? null,
            route: snapshot.route || null,
            sequence: snapshot.sequence || 0
          };
        });
      });
      this.emit('composition', null);
    }

    apply(id) {
      const definition = this.definitions.get(id);
      const record = this.records.get(id);
      const element = definition && this.elementFor(definition);
      if (!record || !element) return;
      element.dataset.sceneRuntimeObject = id;
      element.dataset.sceneRuntimeKind = record.kind;
      element.dataset.sceneRuntimePhase = record.phase;
      element.dataset.sceneRuntimeDepth = `${record.depth.channel}:${finite(record.depth.level)}`;
      const focused = ['focusing', 'inspect', 'returning'].includes(record.phase);
      const active = record.selected || focused;
      if (element.matches('button,[role="button"],[data-artifact-focus]')) {
        element.classList.toggle('is-active', active);
        element.setAttribute('aria-current', active ? 'true' : 'false');
        element.dataset.objectFocusState = focused ? 'inspect' : active ? 'active' : 'ambient';
      }
      if (record.layout) {
        element.dataset.sceneRuntimeLayout = record.layout.strategy;
        element.style.setProperty('--scene-object-x', record.layout.x.toFixed(4));
        element.style.setProperty('--scene-object-y', record.layout.y.toFixed(4));
        element.style.setProperty('--scene-object-rotation', `${record.layout.rotation.toFixed(3)}deg`);
        element.style.setProperty('--scene-object-scale', record.layout.scale.toFixed(4));
        element.style.setProperty('--scene-object-depth', String(record.layout.z));
      }
    }

    mergeRestored(record, restored) {
      const transient = ['focusing', 'inspect', 'returning', 'entering', 'exiting', 'unmounted'].includes(restored.phase);
      return {
        ...record,
        selected: Boolean(restored.selected),
        phase: transient ? (restored.selected ? 'active' : 'ambient') : (restored.phase || record.phase),
        media: { ...record.media, ...(restored.media || {}), status: restored.media?.status === 'playing' ? 'paused' : (restored.media?.status || record.media.status) },
        depth: { ...record.depth, ...(restored.depth || {}) },
        returnGeometry: rectValue(restored.returnGeometry),
        composition: restored.composition ? { ...restored.composition } : null
      };
    }

    serialize() {
      return {
        version: 2,
        objects: [...this.records.values()].map(record => ({
          id: record.id,
          sceneId: record.sceneId,
          kind: record.kind,
          phase: record.phase,
          selected: record.selected,
          media: { ...record.media },
          depth: { ...record.depth },
          layout: record.layout ? { ...record.layout } : null,
          returnGeometry: record.returnGeometry ? { ...record.returnGeometry } : null,
          composition: record.composition ? { ...record.composition } : null
        }))
      };
    }

    restore(payload) {
      if (!payload || payload.version !== 2 || !Array.isArray(payload.objects)) return false;
      payload.objects.forEach(restored => {
        if (!restored?.id) return;
        const current = this.records.get(restored.id);
        if (current) this.records.set(restored.id, this.mergeRestored(current, restored));
        else this.pendingRestore.set(restored.id, restored);
        this.apply(restored.id);
      });
      this.emit('restore', null);
      return true;
    }

    snapshot() {
      return {
        ...this.serialize(),
        classes: Object.keys(SCENE_OBJECT_CLASSES),
        scenes: [...this.sceneLifecycle.entries()].map(([id, value]) => ({ id, ...value })),
        lastInterruption: this.lastInterruption ? { ...this.lastInterruption } : null
      };
    }

    onChange(listener) {
      this.listeners.add(listener);
      return () => this.listeners.delete(listener);
    }

    emit(type, id) {
      const detail = { type, id, sequence: ++this.sequence, snapshot: this.snapshot() };
      this.listeners.forEach(listener => listener(detail));
      dispatch('profile:scene-object-runtime', detail);
    }
  }

  class SceneManager {
    constructor({ registry, camera, transitions, objects }) {
      this.registry = registry;
      this.camera = camera;
      this.transitions = transitions;
      this.objects = objects;
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
          this.objects.unregisterScene(change.definition.id);
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
      this.transitions.hook('retarget', payload => this.onTransition('retarget', payload));
      this.transitions.hook('interrupt', payload => this.onTransition('interrupt', payload));
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
      this.objects.unmountScene(id, this.objectContext(definition, instance.element, meta));
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
        this.objects.mountScene(definition.id, context);
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
        if (visible) this.objects.enterScene(definition.id, context);
        else this.objects.exitScene(definition.id, context);
      } else if (typeof resolved.update === 'function') {
        resolved.update(context);
        this.objects.updateScene(definition.id, context);
      } else {
        this.objects.updateScene(definition.id, context);
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
        sceneObjects: this.objects.serialize(),
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
  const objects = new SceneObjectRuntime({ transitions });
  const manager = new SceneManager({ registry, camera, transitions, objects });

  window.ProfileScene = Object.freeze({
    registry,
    camera,
    transitions,
    objects,
    manager,
    SceneObjectRegistry,
    CameraController,
    TransitionCoordinator,
    SceneObjectRuntime,
    SceneManager,
    SCENE_OBJECT_CLASSES,
    MOBILE_QUERY,
    normaliseRoute
  });

  dispatch('profile:scene-system-ready', { registry, camera, transitions, manager });
})();
