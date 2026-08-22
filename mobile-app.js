(() => {
  const mq = window.matchMedia('(max-width: 900px)');
  if (!mq.matches) return;

  const projection = { centreX: 600, originY: 50, scaleX: .53, scaleY: 1.28, fullHeight: 980 };
  const mapPoint = ({ x, y }) => ({
    x: projection.centreX + (x - projection.centreX) * projection.scaleX,
    y: projection.originY + (y - projection.originY) * projection.scaleY
  });
  const modeNow = () => document.body.dataset.graphMode || 'overview';
  const localMode = () => modeNow() !== 'atlas';
  const $ = selector => document.querySelector(selector);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* Mobile projection is visual only: desktop/data coordinates remain intact. */
  const nativeSvgSetAttribute = SVGElement.prototype.setAttribute;
  const numberPattern = /-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi;
  const projectTranslate = value => {
    const m = String(value).match(/^translate\(\s*(-?(?:\d+\.?\d*|\.\d+))[,\s]+(-?(?:\d+\.?\d*|\.\d+))\s*\)$/i);
    if (!m) return value;
    const p = mapPoint({ x: Number(m[1]), y: Number(m[2]) });
    return `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`;
  };
  const projectPath = value => {
    let i = 0;
    return String(value).replace(numberPattern, token => {
      const n = Number(token);
      const v = i % 2 === 0
        ? projection.centreX + (n - projection.centreX) * projection.scaleX
        : projection.originY + (n - projection.originY) * projection.scaleY;
      i += 1;
      return v.toFixed(1);
    });
  };
  const projectedTransformElement = el =>
    el?.classList?.contains('site-graph-node') ||
    el?.classList?.contains('work-project-anchor-v5') ||
    el?.classList?.contains('work-theme-label-v5');

  SVGElement.prototype.setAttribute = function(name, value) {
    if (mq.matches && localMode()) {
      if (name === 'transform' && projectedTransformElement(this)) {
        value = projectTranslate(value);
      } else if (name === 'd' && this.tagName?.toLowerCase() === 'path' && this.parentElement?.classList?.contains('site-graph-edges')) {
        value = projectPath(value);
      } else if (this.classList?.contains('site-graph-timeline')) {
        const n = Number(value);
        if (Number.isFinite(n)) {
          if (name === 'x1' || name === 'x2') value = projection.centreX + (n - projection.centreX) * projection.scaleX;
          if (name === 'y1' || name === 'y2') value = projection.originY + (n - projection.originY) * projection.scaleY;
        }
      }
    }
    return nativeSvgSetAttribute.call(this, name, value);
  };

  /* The first graph was rendered before this mobile controller loaded. Project
     it once. Every later renderer/transition write goes through the wrapper. */
  const projectInitialGraph = () => {
    if (!localMode()) return;
    document.querySelectorAll('#site-graph .site-graph-node[data-node-id]').forEach(el => {
      if (el.closest('.v9-transition-overlay')) return;
      const x = Number(el.dataset.x), y = Number(el.dataset.y);
      if (Number.isFinite(x) && Number.isFinite(y)) el.setAttribute('transform', `translate(${x} ${y})`);
    });
    document.querySelectorAll('#site-graph .work-project-anchor-v5,#site-graph .work-theme-label-v5').forEach(el => {
      const t = el.getAttribute('transform');
      if (t) el.setAttribute('transform', t);
    });
    document.querySelectorAll('#site-graph .site-graph-edges path[d]').forEach(path => {
      if (path.closest('.v9-transition-overlay')) return;
      const d = path.getAttribute('d');
      if (d) path.setAttribute('d', d);
    });
    const line = $('#site-graph .site-graph-timeline');
    if (line) ['x1', 'x2', 'y1', 'y2'].forEach(a => {
      const v = line.getAttribute(a);
      if (v != null) line.setAttribute(a, v);
    });
  };
  window.__MOBILE_GRAPH_PROJECTION__ = { ...projection, mapPoint };

  const state = {
    ready: false,
    camera: { cx: 600, cy: 470, zoom: .88 },
    pointers: new Map(), gesture: null, dragged: false, suppressClickUntil: 0,
    atlasPointers: new Map(), atlasPinching: false, atlasPinchDistance: 0,
    cameraFrame: 0, resetTimer: 0,
    dock: null, modeButton: null, sheet: null, sheetBody: null, sheetTitle: null, sheetBackdrop: null,
    registeredObjects: new Map()
  };

  const svg = () => $('#site-graph .site-graph-svg');
  const viewport = () => $('.site-graph-viewport');
  const ensureStyle = href => {
    if (document.querySelector(`link[href="${href}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = href; link.dataset.profileMobileV2 = 'true';
    document.head.appendChild(link);
  };
  ensureStyle('mobile-v2.css');

  const readNodePoint = el => {
    if (!el) return null;
    const x = Number(el.dataset.x), y = Number(el.dataset.y);
    return Number.isFinite(x) && Number.isFinite(y) ? mapPoint({ x, y }) : null;
  };
  const visiblePoints = () => [...document.querySelectorAll('#site-graph .site-graph-node[data-node-id]')]
    .filter(el => !el.closest('.v9-transition-overlay'))
    .map(readNodePoint).filter(Boolean);
  const cameraAspect = () => {
    const vp = viewport();
    return clamp((vp?.clientWidth || innerWidth) / Math.max(1, vp?.clientHeight || innerHeight), .42, 1.35);
  };
  const cameraBox = () => {
    const height = projection.fullHeight / state.camera.zoom;
    const width = height * cameraAspect();
    return { width, height, x: state.camera.cx - width / 2, y: state.camera.cy - height / 2 };
  };
  const constrainCamera = () => {
    const box = cameraBox();
    const marginX = box.width * .28, marginY = box.height * .22;
    state.camera.cx = clamp(state.camera.cx, 205 - marginX + box.width / 2, 995 + marginX - box.width / 2);
    state.camera.cy = clamp(state.camera.cy, -80 - marginY + box.height / 2, 1030 + marginY - box.height / 2);
  };
  const applyCamera = () => {
    if (!localMode()) return;
    const target = svg(); if (!target) return;
    constrainCamera();
    const b = cameraBox();
    target.setAttribute('viewBox', `${b.x.toFixed(2)} ${b.y.toFixed(2)} ${b.width.toFixed(2)} ${b.height.toFixed(2)}`);
    target.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  };
  const animateCamera = (target, duration = 380) => {
    cancelAnimationFrame(state.cameraFrame);
    const start = { ...state.camera };
    if (reduced.matches || !duration) { Object.assign(state.camera, target); applyCamera(); return; }
    const begin = performance.now();
    const ease = t => 1 - Math.pow(1 - t, 3);
    const frame = now => {
      const raw = Math.min(1, (now - begin) / duration), t = ease(raw);
      state.camera.cx = start.cx + (target.cx - start.cx) * t;
      state.camera.cy = start.cy + (target.cy - start.cy) * t;
      state.camera.zoom = start.zoom + (target.zoom - start.zoom) * t;
      applyCamera();
      if (raw < 1) state.cameraFrame = requestAnimationFrame(frame);
    };
    state.cameraFrame = requestAnimationFrame(frame);
  };
  const fitTarget = () => {
    const pts = visiblePoints();
    if (!pts.length) return { cx: 600, cy: 450, zoom: .76 };
    let minX = Math.min(...pts.map(p => p.x)), maxX = Math.max(...pts.map(p => p.x));
    let minY = Math.min(...pts.map(p => p.y)), maxY = Math.max(...pts.map(p => p.y));
    const px = modeNow() === 'work' ? 58 : 66, py = modeNow() === 'overview' ? 54 : 72;
    minX -= px; maxX += px; minY -= py; maxY += py;
    const width = Math.max(300, maxX - minX), height = Math.max(390, maxY - minY);
    const requiredHeight = Math.max(height, width / cameraAspect());
    let zoom = projection.fullHeight / requiredHeight * .86;
    zoom = clamp(zoom, .54, modeNow() === 'work' ? .94 : .91);
    return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, zoom };
  };
  const resetCamera = ({ instant = false } = {}) => {
    if (!localMode()) return;
    if (document.body.classList.contains('is-v9-transitioning')) return scheduleStableReset({ instant });
    animateCamera(fitTarget(), instant ? 0 : 400);
  };
  const scheduleStableReset = ({ instant = false, attempt = 0 } = {}) => {
    clearTimeout(state.resetTimer);
    state.resetTimer = setTimeout(() => {
      if (document.body.classList.contains('is-v9-transitioning') && attempt < 26) {
        scheduleStableReset({ instant, attempt: attempt + 1 });
        return;
      }
      requestAnimationFrame(() => resetCamera({ instant }));
    }, attempt ? 65 : 45);
  };
  const zoomAt = (factor, screenX = null, screenY = null) => {
    if (!localMode()) return;
    const vp = viewport(); if (!vp) return;
    const rect = vp.getBoundingClientRect(), before = cameraBox();
    const px = screenX == null ? rect.width / 2 : screenX - rect.left;
    const py = screenY == null ? rect.height / 2 : screenY - rect.top;
    const wx = before.x + px / Math.max(1, rect.width) * before.width;
    const wy = before.y + py / Math.max(1, rect.height) * before.height;
    state.camera.zoom = clamp(state.camera.zoom * factor, .46, 2.45);
    const after = cameraBox();
    state.camera.cx = wx - px / Math.max(1, rect.width) * after.width + after.width / 2;
    state.camera.cy = wy - py / Math.max(1, rect.height) * after.height + after.height / 2;
    applyCamera();
  };
  const panBy = (dx, dy) => {
    if (!localMode()) return;
    const vp = viewport(); if (!vp) return;
    const b = cameraBox();
    state.camera.cx -= dx * b.width / Math.max(1, vp.clientWidth);
    state.camera.cy -= dy * b.height / Math.max(1, vp.clientHeight);
    applyCamera();
  };

  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const pointerDown = e => {
    if (!localMode() || e.button > 0) return;
    const vp = viewport(); if (!vp?.contains(e.target)) return;
    state.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); state.dragged = false;
    vp.setPointerCapture?.(e.pointerId);
    if (state.pointers.size === 1) state.gesture = { type: 'pan', last: { x: e.clientX, y: e.clientY } };
    if (state.pointers.size === 2) { const [a,b] = [...state.pointers.values()]; state.gesture = { type:'pinch', distance:dist(a,b), midpoint:mid(a,b) }; }
  };
  const pointerMove = e => {
    if (!localMode() || !state.pointers.has(e.pointerId)) return;
    const prev = state.pointers.get(e.pointerId); state.pointers.set(e.pointerId, { x:e.clientX, y:e.clientY });
    if (Math.hypot(e.clientX-prev.x,e.clientY-prev.y)>2) state.dragged=true;
    if (state.pointers.size===1 && state.gesture?.type==='pan') {
      const cur={x:e.clientX,y:e.clientY}; panBy(cur.x-state.gesture.last.x,cur.y-state.gesture.last.y); state.gesture.last=cur; e.preventDefault(); return;
    }
    if (state.pointers.size===2) {
      const [a,b]=[...state.pointers.values()], nd=Math.max(1,dist(a,b)), nm=mid(a,b);
      if(state.gesture?.type!=='pinch'){state.gesture={type:'pinch',distance:nd,midpoint:nm};return;}
      zoomAt(nd/Math.max(1,state.gesture.distance),nm.x,nm.y); panBy(nm.x-state.gesture.midpoint.x,nm.y-state.gesture.midpoint.y);
      state.gesture.distance=nd;state.gesture.midpoint=nm;state.dragged=true;e.preventDefault();
    }
  };
  const pointerEnd = e => {
    const vp=viewport(); if(state.pointers.has(e.pointerId)){state.pointers.delete(e.pointerId);vp?.releasePointerCapture?.(e.pointerId);}
    if(state.dragged)state.suppressClickUntil=performance.now()+120;
    if(state.pointers.size===1){const p=[...state.pointers.values()][0];state.gesture={type:'pan',last:p};}else if(!state.pointers.size)state.gesture=null;
  };
  const suppressDraggedClick=e=>{if(performance.now()<state.suppressClickUntil&&e.target.closest?.('.site-graph-node,.work-theme-label-v5,.work-project-anchor-v5')){e.preventDefault();e.stopImmediatePropagation();}};

  /* Atlas: preserve its existing one-finger pan; add two-finger pinch by
     dispatching the wheel zoom event the Atlas renderer already understands. */
  const atlasDown=e=>{
    if(modeNow()!=='atlas'||e.pointerType==='mouse')return;
    state.atlasPointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(state.atlasPointers.size===2){const[a,b]=[...state.atlasPointers.values()];state.atlasPinching=true;state.atlasPinchDistance=Math.max(1,dist(a,b));e.preventDefault();e.stopPropagation();}
  };
  const atlasMove=e=>{
    if(modeNow()!=='atlas'||!state.atlasPointers.has(e.pointerId))return;
    state.atlasPointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(!state.atlasPinching||state.atlasPointers.size<2){if(state.atlasPinching){e.preventDefault();e.stopPropagation();}return;}
    const[a,b]=[...state.atlasPointers.values()],nd=Math.max(1,dist(a,b)),c=mid(a,b),ratio=nd/Math.max(1,state.atlasPinchDistance);
    if(Math.abs(ratio-1)>.004){svg()?.dispatchEvent(new WheelEvent('wheel',{bubbles:true,cancelable:true,clientX:c.x,clientY:c.y,deltaY:-Math.log(ratio)*520,deltaMode:0}));state.atlasPinchDistance=nd;}
    e.preventDefault();e.stopPropagation();
  };
  const atlasEnd=e=>{if(!state.atlasPointers.has(e.pointerId))return;state.atlasPointers.delete(e.pointerId);if(!state.atlasPointers.size){state.atlasPinching=false;state.atlasPinchDistance=0;}};

  const createButton=(label,className,action,aria=label)=>{const b=document.createElement('button');b.type='button';b.className=className;b.textContent=label;b.setAttribute('aria-label',aria);b.addEventListener('click',action);return b;};
  const closeSheet=()=>{if(!state.sheet)return;state.sheet.classList.remove('is-open');state.sheetBackdrop?.classList.remove('is-open');state.modeButton?.setAttribute('aria-expanded','false');};
  const openSheet=title=>{if(!state.sheet)return;state.sheetTitle.textContent=title;state.sheet.classList.add('is-open');state.sheetBackdrop?.classList.add('is-open');state.modeButton?.setAttribute('aria-expanded','true');};
  const toggleModeSheet=()=>{if(!state.sheet||!state.modeButton)return;if(state.sheet.classList.contains('is-open'))return closeSheet();if(modeNow()==='work')openSheet('Work filters');else if(modeNow()==='atlas')openSheet('Atlas layers');};
  const atlasClick=id=>document.querySelector(id)?.click();

  const buildChrome=()=>{
    const scene=$('.scene-canvas');if(!scene||state.dock)return;
    const dock=document.createElement('div');dock.className='mobile-graph-dock';dock.setAttribute('aria-label','Graph controls');
    dock.append(
      createButton('−','mobile-camera-button',()=>localMode()?zoomAt(.82):atlasClick('#atlas-zoom-out'),'Zoom out'),
      createButton('+','mobile-camera-button',()=>localMode()?zoomAt(1.22):atlasClick('#atlas-zoom-in'),'Zoom in'),
      createButton('Center','mobile-camera-fit',()=>localMode()?resetCamera():atlasClick('#atlas-fit'),'Center graph')
    );
    const modeButton=createButton('Filters','mobile-mode-button',toggleModeSheet,'Open segment controls');modeButton.setAttribute('aria-expanded','false');dock.append(modeButton);
    const backdrop=document.createElement('button');backdrop.type='button';backdrop.className='mobile-sheet-backdrop';backdrop.setAttribute('aria-label','Close controls');backdrop.addEventListener('click',closeSheet);
    const sheet=document.createElement('section');sheet.className='mobile-control-sheet';sheet.setAttribute('aria-label','Segment controls');
    const head=document.createElement('div');head.className='mobile-control-sheet-head';const title=document.createElement('strong');const close=createButton('×','mobile-sheet-close',closeSheet,'Close controls');head.append(title,close);
    const body=document.createElement('div');body.className='mobile-control-sheet-body';sheet.append(head,body);scene.append(backdrop,sheet,dock);
    Object.assign(state,{dock,modeButton,sheet,sheetBody:body,sheetTitle:title,sheetBackdrop:backdrop});
  };
  const adoptModeControls=()=>{
    if(!state.sheetBody)return;
    const work=$('.integrated-work-controls'),atlas=$('#atlas-controls');
    if(work&&work.parentElement!==state.sheetBody){work.classList.add('mobile-adopted-controls');state.sheetBody.appendChild(work);}
    if(atlas&&atlas.parentElement!==state.sheetBody){atlas.classList.add('mobile-adopted-controls');state.sheetBody.appendChild(atlas);}
  };
  const registerSceneObject=(mode,element,options={})=>{const el=typeof element==='string'?$(element):element;if(!el)return null;const key=options.key||`${mode}:${state.registeredObjects.size}`;el.classList.add('mobile-scene-object');el.dataset.mobileScene=mode;if(options.slot)el.dataset.mobileSlot=options.slot;state.registeredObjects.set(key,{mode,element:el,...options});return key;};
  const registerExistingObjects=()=>{
    registerSceneObject('overview','.hero-copy',{key:'overview-copy',slot:'north-west'});registerSceneObject('overview','.hero-visual.profile-identity',{key:'overview-portrait',slot:'north-east'});
    const w=$('.integrated-work-controls');if(w)registerSceneObject('work',w,{key:'work-controls',slot:'sheet'});const a=$('#atlas-controls');if(a)registerSceneObject('atlas',a,{key:'atlas-controls',slot:'sheet'});
  };
  const syncMode=({reset=true}={})=>{
    document.body.classList.add('mobile-app-mode');document.body.dataset.mobileSceneMode=modeNow();adoptModeControls();registerExistingObjects();closeSheet();
    if(state.modeButton){const has=modeNow()==='work'||modeNow()==='atlas';state.modeButton.hidden=!has;state.modeButton.textContent=modeNow()==='atlas'?'Layers':'Filters';}
    state.dock?.classList.toggle('is-atlas',modeNow()==='atlas');
    if(reset&&localMode())scheduleStableReset();
  };
  const bindViewport=()=>{
    const vp=viewport();if(!vp||vp.dataset.mobileGestures==='true')return;vp.dataset.mobileGestures='true';
    vp.addEventListener('pointerdown',atlasDown,{capture:true,passive:false});vp.addEventListener('pointermove',atlasMove,{capture:true,passive:false});vp.addEventListener('pointerup',atlasEnd,{capture:true,passive:true});vp.addEventListener('pointercancel',atlasEnd,{capture:true,passive:true});
    vp.addEventListener('pointerdown',pointerDown,{passive:true});vp.addEventListener('pointermove',pointerMove,{passive:false});vp.addEventListener('pointerup',pointerEnd,{passive:true});vp.addEventListener('pointercancel',pointerEnd,{passive:true});vp.addEventListener('click',suppressDraggedClick,true);
  };

  const boot=()=>{
    if(!mq.matches||state.ready)return;if(!$('.scene-canvas')||!viewport()||!svg()){setTimeout(boot,60);return;}
    state.ready=true;document.documentElement.classList.add('mobile-profile-app');projectInitialGraph();buildChrome();bindViewport();adoptModeControls();registerExistingObjects();syncMode({reset:true});
    const observer=new MutationObserver(mutations=>{
      const modeChanged=mutations.some(m=>m.type==='attributes'&&m.target===document.body&&m.attributeName==='data-graph-mode');
      const transitionEnded=mutations.some(m=>m.type==='attributes'&&m.target===document.body&&m.attributeName==='class'&&!document.body.classList.contains('is-v9-transitioning'));
      if(modeChanged)syncMode({reset:true});if(transitionEnded&&localMode())scheduleStableReset();adoptModeControls();bindViewport();
    });
    observer.observe(document.body,{attributes:true,attributeFilter:['data-graph-mode','class'],childList:true,subtree:true});
    window.addEventListener('hashchange',()=>localMode()&&scheduleStableReset());
    window.addEventListener('orientationchange',()=>setTimeout(()=>localMode()&&scheduleStableReset({instant:true}),150));
    window.addEventListener('resize',()=>mq.matches&&localMode()&&scheduleStableReset({instant:true}));
    window.MobileProfileScene={registerSceneObject,resetCamera,fitGraph:resetCamera,zoomIn:()=>localMode()?zoomAt(1.2):atlasClick('#atlas-zoom-in'),zoomOut:()=>localMode()?zoomAt(.84):atlasClick('#atlas-zoom-out'),closeSheet,projection};
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,0),{once:true});else setTimeout(boot,0);
})();