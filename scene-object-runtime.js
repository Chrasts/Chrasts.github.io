(() => {
  if (window.ProfileSceneObjects) return;

  const scene = window.ProfileScene;
  if (!scene?.manager || !scene?.registry || !scene?.transitions) return;

  const VERSION = 2;
  const PHASES = Object.freeze([
    'create', 'mount', 'enter', 'idle', 'activate', 'inspect', 'return', 'exit', 'destroy'
  ]);
  const ACTIVE_PHASES = new Set(['activate', 'inspect', 'return']);
  const mediaSelector = 'audio,video';
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

  const clone = value => {
    if (value == null) return value;
    try {
      return typeof structuredClone === 'function'
        ? structuredClone(value)
        : JSON.parse(JSON.stringify(value));
    } catch (_) {
      return null;
    }
  };

  const rectSnapshot = element => {
    if (!element?.isConnected) return null;
    const rect = element.getBoundingClientRect();
    return {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom
    };
  };

  class SceneObjectRuntime {
    constructor() {
      this.records = new Map();
      this.history = [];
      this.sequence = 0;
      this.frame = 0;
      this.lastReason = 'boot';
      this.restoring = false;
      this.focusRecordId = null;
      this.focusArtifactId = null;
      this.observer = null;
      this.unregisterTransitionParticipant = null;

      this.onPlay = this.onPlay.bind(this);
      this.onVisibilityChange = this.onVisibilityChange.bind(this);
      this.onMutation = this.onMutation.bind(this);

      document.addEventListener('play', this.onPlay, true);
      document.addEventListener('visibilitychange', this.onVisibilityChange);
      window.addEventListener('profile:scene-state', () => this.schedule('scene-state'));
      window.addEventListener('profile:scene-composition', () => this.schedule('composition'));
      window.addEventListener('profile:scene-composer-ready', () => this.schedule('composer-ready'));
      window.addEventListener('profile:artifact-scenes-ready', () => this.schedule('artifact-scenes-ready'));
      window.addEventListener('profile:object-focus-ready', () => this.schedule('object-focus-ready'));
      window.addEventListener('resize', () => this.schedule('resize'));

      scene.registry.onChange(change => {
        if (change.type === 'unregister') this.destroyRecord(change.definition?.id, 'registry-unregister');
        this.schedule(`registry-${change.type}`);
      });

      this.unregisterTransitionParticipant = scene.transitions.registerParticipant('scene-object-runtime', {
        capture: ({ reason }) => this.serialize({ reason }),
        cancel: ({ reason }) => this.interrupt(reason || 'transition-cancel')
      });

      const observe = () => {
        const canvas = document.querySelector('.scene-canvas');
        if (!canvas || this.observer) return;
        this.observer = new MutationObserver(this.onMutation);
        this.observer.observe(canvas, {
          subtree: true,
          childList: true,
          attributes: true,
          attributeFilter: [
            'hidden', 'class', 'data-scene-visible', 'data-scene-composed',
            'data-shared-focus-phase', 'data-shared-focus-artifact', 'data-object-focus-state'
          ]
        });
      };
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', observe, { once: true });
      else observe();

      this.schedule('boot');
    }

    onMutation(mutations) {
      if (mutations.some(mutation => mutation.type === 'childList' || mutation.type === 'attributes')) {
        this.schedule('scene-dom');
      }
    }

    composerSnapshot() {
      return window.ProfileSceneComposer?.snapshot?.() || null;
    }

    assignmentFor(id, composer = this.composerSnapshot()) {
      return composer?.assignments?.find?.(assignment => assignment.id === id) || null;
    }

    focusSnapshot() {
      return window.ProfileObjectFocus?.snapshot?.() || null;
    }

    focusViewer() {
      return window.ProfileArtifactScenes?.viewer || document.querySelector('.artifact-focus-viewer');
    }

    focusSourceFor(artifactId = null) {
      const direct = document.querySelector('.is-object-focus-origin[data-artifact-focus], .is-object-focus-origin[data-artifact-id]');
      if (direct) return direct;
      if (!artifactId) return null;
      const escaped = CSS.escape(artifactId);
      return document.querySelector(`[data-scene-object] [data-artifact-focus="${escaped}"], [data-scene-object] [data-artifact-id="${escaped}"]`);
    }

    sceneIdForSource(source) {
      return source?.closest?.('[data-scene-object]')?.dataset.sceneObject || null;
    }

    captureReturnGeometry(record, source = null) {
      if (!record) return null;
      const composer = this.composerSnapshot();
      return {
        object: rectSnapshot(record.element),
        source: rectSnapshot(source),
        assignment: clone(this.assignmentFor(record.id, composer)),
        camera: clone(scene.camera?.serialize?.() || scene.manager.snapshot?.().camera || null),
        composerSequence: composer?.sequence ?? null,
        capturedAt: performance.now()
      };
    }

    pushHistory(record, phase, reason) {
      const entry = {
        sequence: ++this.sequence,
        id: record.id,
        phase,
        reason,
        at: performance.now()
      };
      record.history.push(entry);
      if (record.history.length > 18) record.history.splice(0, record.history.length - 18);
      this.history.push(entry);
      if (this.history.length > 100) this.history.splice(0, this.history.length - 100);
      window.dispatchEvent(new CustomEvent('profile:scene-object-lifecycle', { detail: { ...entry } }));
    }

    setPhase(record, phase, reason = 'runtime') {
      if (!record || !PHASES.includes(phase)) return false;
      if (record.phase === phase) return false;
      record.phase = phase;
      record.updatedAt = performance.now();
      if (record.element?.isConnected) {
        record.element.dataset.sceneRuntimePhase = phase;
        if (ACTIVE_PHASES.has(phase)) record.element.dataset.objectFocusState = 'active';
        else if (record.element.dataset.objectFocusState === 'active' && !record.element.querySelector('.is-object-focus-origin')) {
          delete record.element.dataset.objectFocusState;
        }
      }
      this.pushHistory(record, phase, reason);
      return true;
    }

    createRecord(id, instance) {
      const record = {
        id,
        element: instance.element,
        definition: instance.definition,
        visible: false,
        phase: null,
        createdAt: performance.now(),
        updatedAt: performance.now(),
        history: [],
        assignment: null,
        returnGeometry: null,
        media: []
      };
      this.records.set(id, record);
      this.setPhase(record, 'create', 'instance-observed');
      this.setPhase(record, 'mount', 'instance-mounted');
      return record;
    }

    destroyRecord(id, reason = 'destroy') {
      const record = this.records.get(id);
      if (!record) return false;
      this.pauseMedia(record.element, reason);
      this.setPhase(record, 'destroy', reason);
      if (record.element?.isConnected) {
        delete record.element.dataset.sceneRuntimePhase;
        if (record.element.dataset.objectFocusState === 'active') delete record.element.dataset.objectFocusState;
      }
      this.records.delete(id);
      if (this.focusRecordId === id) {
        this.focusRecordId = null;
        this.focusArtifactId = null;
      }
      return true;
    }

    schedule(reason = 'scheduled') {
      this.lastReason = reason;
      cancelAnimationFrame(this.frame);
      this.frame = requestAnimationFrame(() => {
        this.frame = 0;
        this.sync(reason);
      });
    }

    syncFocus(reason = 'focus-sync') {
      const focus = this.focusSnapshot();
      const viewer = this.focusViewer();
      const viewerPhase = viewer?.dataset.sharedFocusPhase || focus?.phase || 'idle';
      const artifactId = viewer?.dataset.sharedFocusArtifact || focus?.activeArtifactId || focus?.pendingArtifactId || null;
      const source = this.focusSourceFor(artifactId);
      let id = this.sceneIdForSource(source) || this.focusRecordId;

      if (id && this.records.has(id) && ['preparing', 'moving-in', 'settled'].includes(viewerPhase)) {
        const record = this.records.get(id);
        if (!record.returnGeometry) record.returnGeometry = this.captureReturnGeometry(record, source);
        this.focusRecordId = id;
        this.focusArtifactId = artifactId;
        this.setPhase(record, 'inspect', `${reason}:${viewerPhase}`);
        return;
      }

      if (id && this.records.has(id) && viewerPhase === 'returning') {
        const record = this.records.get(id);
        this.setPhase(record, 'return', `${reason}:returning`);
        return;
      }

      if (this.focusRecordId && (!viewer || viewer.hidden || viewerPhase === 'idle')) {
        const record = this.records.get(this.focusRecordId);
        if (record) {
          this.setPhase(record, 'return', `${reason}:focus-closed`);
          if (record.visible) this.setPhase(record, 'idle', `${reason}:returned`);
          else this.setPhase(record, 'exit', `${reason}:returned-hidden`);
        }
        this.focusRecordId = null;
        this.focusArtifactId = null;
      }
    }

    sync(reason = 'sync') {
      this.lastReason = reason;
      const composer = this.composerSnapshot();
      const liveIds = new Set();

      scene.manager.instances.forEach((instance, id) => {
        if (!instance?.element) return;
        liveIds.add(id);
        let record = this.records.get(id);
        if (!record || record.element !== instance.element) {
          if (record) this.destroyRecord(id, 'element-replaced');
          record = this.createRecord(id, instance);
        }

        record.definition = instance.definition;
        record.assignment = clone(this.assignmentFor(id, composer));
        record.visible = Boolean(instance.visible && !instance.element.hidden);
        record.media = this.mediaSnapshot(instance.element);

        if (record.visible) {
          if (record.phase === 'mount' || record.phase === 'exit' || record.phase === 'destroy') {
            this.setPhase(record, 'enter', reason);
            this.setPhase(record, 'idle', `${reason}:entered`);
          } else if (record.phase === 'enter') {
            this.setPhase(record, 'idle', `${reason}:settled`);
          }
        } else if (!['exit', 'destroy'].includes(record.phase)) {
          this.pauseMedia(record.element, 'scene-hidden');
          this.setPhase(record, 'exit', reason);
        }
      });

      [...this.records.keys()].forEach(id => {
        if (!liveIds.has(id)) this.destroyRecord(id, 'instance-removed');
      });

      this.syncFocus(reason);
    }

    activate(id, { source = 'api', makeRoom = false } = {}) {
      this.sync('activate-sync');
      const record = this.records.get(id);
      if (!record || !record.visible) return false;
      this.setPhase(record, 'activate', source);
      window.ProfileSceneComposer?.schedule?.('scene-object-activate');
      if (makeRoom) window.ProfileCameraComposition?.makeRoom?.(id, { source: 'scene-object-runtime' });
      return true;
    }

    deactivate(id, { source = 'api' } = {}) {
      const record = this.records.get(id);
      if (!record) return false;
      if (this.focusRecordId === id) return this.returnFromInspect({ restoreFocus: true, source });
      this.setPhase(record, record.visible ? 'idle' : 'exit', source);
      return true;
    }

    inspect(id, { source, artifact = null, artifactId = null, ownerValid = null, camera = false } = {}) {
      this.sync('inspect-sync');
      const record = this.records.get(id);
      const focus = window.ProfileObjectFocus;
      if (!record || !record.visible || !source || !focus?.open) return false;
      const resolvedArtifactId = artifactId || artifact?.id || source.dataset?.artifactId || null;
      record.returnGeometry = this.captureReturnGeometry(record, source);
      this.focusRecordId = id;
      this.focusArtifactId = resolvedArtifactId;
      this.setPhase(record, 'inspect', 'api');
      if (camera) window.ProfileCameraComposition?.inspect?.(id, { source: 'scene-object-runtime' });
      focus.open({
        source,
        artifact,
        artifactId: resolvedArtifactId,
        owner: `scene-object:${id}`,
        ownerValid: ownerValid || (() => record.element?.isConnected && record.visible)
      });
      this.schedule('inspect-open');
      return true;
    }

    returnFromInspect({ restoreFocus = true, source = 'api' } = {}) {
      const id = this.focusRecordId;
      const record = id ? this.records.get(id) : null;
      if (record) this.setPhase(record, 'return', source);
      const focus = window.ProfileObjectFocus;
      if (focus?.close) focus.close({ restoreFocus });
      if (record) {
        window.ProfileCameraComposition?.return?.({ source: 'scene-object-runtime' });
        this.schedule('inspect-return');
      }
      return Boolean(record || focus);
    }

    interrupt(reason = 'interrupted') {
      const id = this.focusRecordId;
      const record = id ? this.records.get(id) : null;
      if (record) this.setPhase(record, 'return', reason);
      try { window.ProfileObjectFocus?.interrupt?.(); } catch (_) {}
      this.pauseAllMedia(reason);
      if (record) this.setPhase(record, record.visible ? 'idle' : 'exit', `${reason}:settled`);
      this.focusRecordId = null;
      this.focusArtifactId = null;
      this.schedule('interrupt');
      return true;
    }

    mediaSnapshot(root) {
      if (!root?.querySelectorAll) return [];
      return [...root.querySelectorAll(mediaSelector)].map((media, index) => ({
        index,
        tag: media.tagName.toLowerCase(),
        currentTime: Number.isFinite(media.currentTime) ? media.currentTime : 0,
        paused: Boolean(media.paused),
        muted: Boolean(media.muted),
        volume: Number.isFinite(media.volume) ? media.volume : 1,
        playbackRate: Number.isFinite(media.playbackRate) ? media.playbackRate : 1
      }));
    }

    pauseMedia(root, reason = 'pause') {
      if (!root?.querySelectorAll) return 0;
      let count = 0;
      root.querySelectorAll(mediaSelector).forEach(media => {
        try {
          if (!media.paused) {
            media.pause();
            count += 1;
          }
        } catch (_) {}
      });
      if (count) window.dispatchEvent(new CustomEvent('profile:scene-media-paused', { detail: { reason, count } }));
      return count;
    }

    pauseAllMedia(reason = 'pause-all') {
      let count = 0;
      document.querySelectorAll(mediaSelector).forEach(media => {
        try {
          if (!media.paused) {
            media.pause();
            count += 1;
          }
        } catch (_) {}
      });
      if (count) window.dispatchEvent(new CustomEvent('profile:scene-media-paused', { detail: { reason, count } }));
      return count;
    }

    onPlay(event) {
      const media = event.target;
      if (!(media instanceof HTMLMediaElement)) return;
      if (media.muted || media.volume <= 0) return;
      document.querySelectorAll(mediaSelector).forEach(other => {
        if (other === media || other.muted || other.volume <= 0 || other.paused) return;
        try { other.pause(); } catch (_) {}
      });
      this.schedule('media-play');
    }

    onVisibilityChange() {
      if (document.hidden) this.pauseAllMedia('document-hidden');
      this.schedule('visibility-change');
    }

    serialize({ reason = 'serialize' } = {}) {
      this.syncFocus(reason);
      const composer = this.composerSnapshot();
      return {
        version: VERSION,
        reason,
        route: scene.manager.graphState?.route || null,
        mode: scene.manager.graphState?.mode || null,
        variant: scene.manager.variant || null,
        camera: clone(scene.camera?.serialize?.() || null),
        composer: clone(composer),
        focus: clone(this.focusSnapshot()),
        objects: [...this.records.values()].map(record => ({
          id: record.id,
          phase: record.phase,
          visible: record.visible,
          objectState: clone(scene.manager.getObjectState(record.id)),
          assignment: clone(record.assignment),
          returnGeometry: clone(record.returnGeometry),
          media: this.mediaSnapshot(record.element)
        }))
      };
    }

    restore(snapshot, { reason = 'restore' } = {}) {
      if (!snapshot || snapshot.version !== VERSION || !Array.isArray(snapshot.objects)) return false;
      this.restoring = true;
      try {
        snapshot.objects.forEach(saved => {
          if (!saved?.id) return;
          if (saved.objectState && typeof saved.objectState === 'object') {
            scene.manager.setObjectState(saved.id, clone(saved.objectState) || {});
          }
          const record = this.records.get(saved.id);
          if (!record?.element) return;
          const media = [...record.element.querySelectorAll(mediaSelector)];
          (saved.media || []).forEach(savedMedia => {
            const target = media[savedMedia.index];
            if (!target) return;
            try {
              if (Number.isFinite(savedMedia.currentTime)) target.currentTime = Math.max(0, savedMedia.currentTime);
              target.muted = Boolean(savedMedia.muted);
              if (Number.isFinite(savedMedia.volume)) target.volume = Math.max(0, Math.min(1, savedMedia.volume));
              if (Number.isFinite(savedMedia.playbackRate) && savedMedia.playbackRate > 0) target.playbackRate = savedMedia.playbackRate;
              target.pause();
            } catch (_) {}
          });
          record.returnGeometry = clone(saved.returnGeometry);
          this.setPhase(record, record.visible ? 'idle' : 'exit', reason);
        });
      } finally {
        this.restoring = false;
      }
      window.ProfileSceneComposer?.schedule?.('scene-object-restore');
      this.schedule('restore-complete');
      return true;
    }

    snapshot() {
      return {
        version: VERSION,
        phases: PHASES,
        reason: this.lastReason,
        sequence: this.sequence,
        reducedMotion: reducedMotion.matches,
        focusRecordId: this.focusRecordId,
        focusArtifactId: this.focusArtifactId,
        records: [...this.records.values()].map(record => ({
          id: record.id,
          phase: record.phase,
          visible: record.visible,
          assignment: clone(record.assignment),
          returnGeometry: clone(record.returnGeometry),
          media: this.mediaSnapshot(record.element),
          history: record.history.map(entry => ({ ...entry }))
        })),
        history: this.history.map(entry => ({ ...entry }))
      };
    }
  }

  const runtime = new SceneObjectRuntime();
  window.SceneObjectRuntime = SceneObjectRuntime;
  window.ProfileSceneObjects = Object.freeze({
    version: VERSION,
    phases: PHASES,
    activate: (id, options) => runtime.activate(id, options),
    deactivate: (id, options) => runtime.deactivate(id, options),
    inspect: (id, options) => runtime.inspect(id, options),
    return: options => runtime.returnFromInspect(options),
    interrupt: reason => runtime.interrupt(reason),
    pauseAllMedia: reason => runtime.pauseAllMedia(reason),
    serialize: options => runtime.serialize(options),
    restore: (snapshot, options) => runtime.restore(snapshot, options),
    schedule: reason => runtime.schedule(reason),
    snapshot: () => runtime.snapshot()
  });

  window.dispatchEvent(new CustomEvent('profile:scene-object-runtime-ready', { detail: window.ProfileSceneObjects.snapshot() }));
})();