(() => {
  const graph = window.SITE_DATA?.graph;
  const profile = window.SITE_DATA?.profile || {};
  if (!graph?.nodes?.length) return;

  const rootId = graph.rootId || 'stepan-chrast';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');

  // Synchronous first-paint guard. This script executes before intro-animation.js,
  // so the completed Atlas clone can never paint before autoplay takes ownership.
  if (!document.querySelector('style[data-profile-intro-flash-guard]')) {
    const guard = document.createElement('style');
    guard.dataset.profileIntroFlashGuard = 'true';
    guard.textContent = '.profile-intro-overlay[data-source="real-atlas"]:not(.is-auto-unfold-complete) .site-graph-node:not([data-intro-tier="root"]),.profile-intro-overlay[data-source="real-atlas"]:not(.is-auto-unfold-complete) .site-graph-edges path{opacity:0!important}.profile-intro-overlay[data-source="real-atlas"]:not(.is-auto-unfold-complete) .profile-intro-enter{opacity:0!important;pointer-events:none!important}';
    document.head.appendChild(guard);
  }
  const norm = v => { const l = Math.max(1e-6, Math.hypot(v.x, v.y)); return { x:v.x/l, y:v.y/l }; };
  const dot = (a,b) => a.x*b.x + a.y*b.y;
  const tangent = v => ({ x:-v.y, y:v.x });
  const compass = Object.freeze({
    work: norm({x:0,y:1}),
    knowledge: norm({x:1,y:-.035}),
    education: norm({x:.56,y:-.83}),
    about: norm({x:-.62,y:-.78}),
    experience: norm({x:-.99,y:.10})
  });
  const sections = Object.keys(compass);
  const radius = id => {
    const mobile = matchMedia('(max-width: 900px)').matches;
    const map = mobile
      ? {work:225,knowledge:250,education:222,about:220,experience:218}
      : {work:302,knowledge:365,education:325,about:316,experience:292};
    return map[id] || 230;
  };
  const baseNodes = () => [...document.querySelectorAll('#site-graph .site-graph-node[data-node-id]')]
    .filter(el => !el.closest('.v9-transition-overlay'));
  const baseEdges = () => [...document.querySelectorAll('#site-graph .site-graph-edges path[data-source][data-target]')]
    .filter(el => !el.closest('.v9-transition-overlay'));
  const setPoint = (el,p) => {
    if (!el || !p) return;
    el.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`);
    el.dataset.x = String(p.x); el.dataset.y = String(p.y);
  };
  const direction = v => {
    const a = Math.atan2(v.y,v.x)*180/Math.PI;
    if (a>=-22.5&&a<22.5) return 'right';
    if (a>=22.5&&a<67.5) return 'down-right';
    if (a>=67.5&&a<112.5) return 'down';
    if (a>=112.5&&a<157.5) return 'down-left';
    if (a>=157.5||a<-157.5) return 'left';
    if (a>=-157.5&&a<-112.5) return 'up-left';
    if (a>=-112.5&&a<-67.5) return 'up';
    return 'up-right';
  };

  let pinFrame = 0, pinUntil = 0;
  const install = () => {
    const base = window.ProfileGeometry;
    if (!base || base.__profileCompassV3) return Boolean(base?.__profileCompassV3);
    if (base.snapshot?.().compassVersion !== 'fan-v2') return false;

    const sectionFor = id => base.sectionFor?.(id) || (sections.includes(id) ? id : null);
    const atlasCenter = base.atlasPoint(rootId) || base.snapshot?.().center || {x:1260,y:790};
    const overviewCenter = base.overviewPoint(rootId) || {x:600,y:350};
    const atlasCache = new Map();
    graph.nodes.forEach(node => {
      if (node.id === rootId) { atlasCache.set(node.id,{...atlasCenter}); return; }
      const s = sectionFor(node.id), old = base.atlasPoint(node.id), ov = base.compass?.[s], nv = compass[s];
      if (!s || !old || !ov || !nv) { if (old) atlasCache.set(node.id,old); return; }
      const delta = {x:old.x-atlasCenter.x,y:old.y-atlasCenter.y};
      const r = dot(delta,ov), t = dot(delta,tangent(ov)), nt = tangent(nv);
      atlasCache.set(node.id,{x:atlasCenter.x+nv.x*r+nt.x*t,y:atlasCenter.y+nv.y*r+nt.y*t});
    });
    const overviewPoint = id => {
      if (id===rootId) return {...overviewCenter};
      const s=sectionFor(id); if (!s || id!==s) return base.overviewPoint(id);
      const v=compass[s], r=radius(s); return {x:overviewCenter.x+v.x*r,y:overviewCenter.y+v.y*r};
    };
    const atlasPoint = id => atlasCache.get(id) || base.atlasPoint(id) || null;
    const vectorBetween = (a,b) => {
      const p=atlasPoint(a), q=atlasPoint(b);
      if (p&&q&&Math.hypot(q.x-p.x,q.y-p.y)>2) return norm({x:q.x-p.x,y:q.y-p.y});
      const av=compass[sectionFor(a)]||{x:0,y:0}, bv=compass[sectionFor(b)]||{x:1,y:0};
      return norm({x:bv.x-av.x||1,y:bv.y-av.y});
    };
    const placeLabel = (el,id) => {
      const label=el?.querySelector('.site-graph-label'), meta=el?.querySelector('.site-graph-meta');
      if (!label) return;
      if (id===rootId) { label.setAttribute('text-anchor','middle'); label.setAttribute('x','0'); label.setAttribute('y','-27'); return; }
      const v=compass[sectionFor(id)]; if (!v) return;
      if (Math.abs(v.x)>.58) {
        const s=Math.sign(v.x); label.setAttribute('text-anchor',s>0?'start':'end'); label.setAttribute('x',String(s*18)); label.setAttribute('y',v.y<-.42?'-8':v.y>.42?'14':'4');
        if(meta){meta.setAttribute('text-anchor',s>0?'start':'end');meta.setAttribute('x',String(s*18));meta.setAttribute('y',v.y<-.42?'-24':v.y>.42?'31':'20');}
      } else {
        label.setAttribute('text-anchor','middle');label.setAttribute('x',String(v.x*9));label.setAttribute('y',v.y<0?'-21':'29');
        if(meta){meta.setAttribute('text-anchor','middle');meta.setAttribute('x',String(v.x*10));meta.setAttribute('y',v.y<0?'-37':'45');}
      }
    };
    const path = (from,to,edge,center) => {
      const type=edge.dataset.type||'', hierarchy=['hierarchy','hierarchy-alt','work-lattice'].includes(type);
      if (hierarchy) {
        const v=compass[sectionFor(edge.dataset.target)]||compass[sectionFor(edge.dataset.source)];
        if (!v || edge.dataset.source===rootId || edge.dataset.target===rootId) return `M ${from.x.toFixed(1)} ${from.y.toFixed(1)} L ${to.x.toFixed(1)} ${to.y.toFixed(1)}`;
        const d=Math.max(1,Math.hypot(to.x-from.x,to.y-from.y));
        return `M ${from.x.toFixed(1)} ${from.y.toFixed(1)} C ${(from.x+v.x*d*.38).toFixed(1)} ${(from.y+v.y*d*.38).toFixed(1)} ${(to.x-v.x*d*.28).toFixed(1)} ${(to.y-v.y*d*.28).toFixed(1)} ${to.x.toFixed(1)} ${to.y.toFixed(1)}`;
      }
      const mid={x:(from.x+to.x)/2,y:(from.y+to.y)/2}; let out={x:mid.x-center.x,y:mid.y-center.y};
      if(Math.hypot(out.x,out.y)<80) out={x:-(to.y-from.y),y:to.x-from.x}; out=norm(out);
      const push=Math.min(260,Math.max(76,Math.hypot(to.x-from.x,to.y-from.y)*.19));
      return `M ${from.x.toFixed(1)} ${from.y.toFixed(1)} Q ${(mid.x+out.x*push).toFixed(1)} ${(mid.y+out.y*push).toFixed(1)} ${to.x.toFixed(1)} ${to.y.toFixed(1)}`;
    };
    const apply = () => {
      base.apply?.();
      const mode=document.body?.dataset.graphMode; if(mode!=='overview'&&mode!=='atlas') return true;
      const positions=new Map();
      if(mode==='overview'){positions.set(rootId,overviewPoint(rootId));sections.forEach(id=>positions.set(id,overviewPoint(id)));}
      else graph.nodes.forEach(n=>{const p=atlasPoint(n.id);if(p)positions.set(n.id,p);});
      const nodes=new Map(baseNodes().map(el=>[el.dataset.nodeId,el])); positions.forEach((p,id)=>setPoint(nodes.get(id),p)); nodes.forEach((el,id)=>placeLabel(el,id));
      const center=positions.get(rootId)||atlasCenter;
      baseEdges().forEach(edge=>{const a=positions.get(edge.dataset.source),b=positions.get(edge.dataset.target);if(a&&b)edge.setAttribute('d',path(a,b,edge,center));});
      document.body.dataset.globalCompass='fan-v3'; return true;
    };
    const stabilize = (ms=1000) => {
      base.stabilize?.(ms); pinUntil=Math.max(pinUntil,performance.now()+ms);
      if(pinFrame) return;
      const tick=now=>{apply(); if(now<pinUntil) pinFrame=requestAnimationFrame(tick); else {pinFrame=0; requestAnimationFrame(()=>requestAnimationFrame(apply));}};
      pinFrame=requestAnimationFrame(tick);
    };
    const api=Object.freeze({
      __profileCompassV3:true, compass, sectionFor, atlasPoint, overviewPoint, vectorBetween,
      directionBetween:(a,b)=>direction(vectorBetween(a,b)), apply, stabilize,
      snapshot:()=>({...base.snapshot?.(),compassVersion:'fan-v3',geometry:document.body?.dataset.globalGeometry||null,sections:Object.fromEntries(sections.map(id=>[id,{vector:{...compass[id]},atlas:atlasPoint(id),overview:overviewPoint(id)}]))})
    });
    window.ProfileGeometry=api;
    new MutationObserver(()=>stabilize(1100)).observe(document.body,{attributes:true,attributeFilter:['data-graph-mode','data-graph-route','class']});
    const root=document.querySelector('#site-graph'); if(root)new MutationObserver(()=>stabilize(900)).observe(root,{childList:true,subtree:true});
    addEventListener('hashchange',()=>stabilize(1250)); addEventListener('resize',()=>stabilize(900)); addEventListener('profile:root-activated',()=>stabilize(1900)); addEventListener('profile:intro-completed',()=>stabilize(1800));
    stabilize(1300); return true;
  };
  const waitInstall = () => install() || requestAnimationFrame(waitInstall);
  waitInstall();

  addEventListener('click', event => {
    const enter=event.target.closest?.('.profile-intro-enter'); if(!enter) return;
    const shell=enter.closest('.profile-intro-overlay'); shell?.classList.add('is-enter-committed'); shell?.classList.remove('is-enter-active');
  }, true);

  let inspector=null, returnFocus=null;
  const closeInspector=()=>{
    if(!inspector)return; const old=inspector; inspector=null; old.classList.remove('is-open'); document.body.classList.remove('has-root-inspector');
    setTimeout(()=>old.remove(),reduced.matches?0:240); returnFocus?.focus?.({preventScroll:true}); returnFocus=null;
  };
  const openInspector=rootEl=>{
    if(inspector){closeInspector();return;}
    const shell=document.createElement('div');shell.className='profile-root-inspector';shell.setAttribute('role','dialog');shell.setAttribute('aria-modal','true');shell.setAttribute('aria-label',`${profile.name||'Štěpán Chrast'} profile summary`);
    const backdrop=document.createElement('button');backdrop.type='button';backdrop.className='profile-root-inspector-backdrop';backdrop.setAttribute('aria-label','Close profile summary');
    const panel=document.createElement('section');panel.className='profile-root-inspector-panel';
    const close=document.createElement('button');close.type='button';close.className='profile-root-inspector-close';close.setAttribute('aria-label','Close profile summary');close.textContent='×';
    const portrait=document.createElement('div');portrait.className='profile-root-inspector-portrait';const img=document.createElement('img');img.src='assets/stepan-chrast.jpg';img.alt='';portrait.appendChild(img);
    const copy=document.createElement('div');copy.className='profile-root-inspector-copy';
    const eyebrow=document.createElement('p');eyebrow.className='profile-root-inspector-eyebrow';eyebrow.textContent='Profile root';
    const name=document.createElement('h2');name.textContent=profile.name||'Štěpán Chrast';
    const label=document.createElement('p');label.className='profile-root-inspector-label';label.textContent=profile.label||'';
    const intro=document.createElement('p');intro.className='profile-root-inspector-intro';intro.textContent=profile.intro||'';
    const links=document.createElement('nav');links.className='profile-root-inspector-links';links.setAttribute('aria-label','Profile links');
    if(profile.email){const a=document.createElement('a');a.href=`mailto:${profile.email}`;a.textContent='Email';links.appendChild(a);}
    (profile.links||[]).forEach(item=>{const a=document.createElement('a');a.href=item.href;a.textContent=`${item.label} ↗`;a.target='_blank';a.rel='noreferrer';links.appendChild(a);});
    copy.append(eyebrow,name,label,intro,links);panel.append(close,portrait,copy);shell.append(backdrop,panel);document.body.appendChild(shell);
    inspector=shell;returnFocus=rootEl;document.body.classList.add('has-root-inspector');const r=rootEl.getBoundingClientRect();shell.style.setProperty('--root-screen-x',`${r.left+r.width/2}px`);shell.style.setProperty('--root-screen-y',`${r.top+r.height/2}px`);
    backdrop.addEventListener('click',closeInspector);close.addEventListener('click',closeInspector);requestAnimationFrame(()=>{shell.classList.add('is-open');close.focus({preventScroll:true});});
  };
  const overviewRoot = target => {
    if(document.querySelector('.profile-intro-overlay')||document.body?.dataset.graphMode!=='overview'||document.body?.dataset.rootLanding==='true') return null;
    return target.closest?.(`#site-graph .site-graph-node[data-node-id="${rootId}"]`)||null;
  };
  addEventListener('click',event=>{if(event.button!==0)return;const root=overviewRoot(event.target);if(!root)return;event.preventDefault();event.stopImmediatePropagation();openInspector(root);},true);
  addEventListener('keydown',event=>{
    if(event.key==='Escape'&&inspector){event.preventDefault();event.stopImmediatePropagation();closeInspector();return;}
    if(event.key!=='Enter'&&event.key!==' ')return;const root=overviewRoot(event.target);if(!root)return;event.preventDefault();event.stopImmediatePropagation();openInspector(root);
  },true);

  window.ProfileIntroFixesV3=Object.freeze({
    snapshot:()=>({compassVersion:window.ProfileGeometry?.snapshot?.().compassVersion||null,inspectorOpen:Boolean(inspector)}),
    openProfileSummary:()=>{const root=baseNodes().find(el=>el.dataset.nodeId===rootId);if(root)openInspector(root);},
    closeProfileSummary:closeInspector
  });
})();
