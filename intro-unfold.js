(() => {
  const ensurePhaseI = () => {
    if (!document.querySelector('link[data-profile-phase-i-atlas]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'phase-i-atlas-polish.css';
      link.dataset.profilePhaseIAtlas = 'true';
      document.head.appendChild(link);
    }
    if (!document.querySelector('script[data-profile-phase-i-atlas]')) {
      const script = document.createElement('script');
      script.src = 'phase-i-atlas-polish.js';
      script.async = false;
      script.dataset.profilePhaseIAtlas = 'true';
      document.head.appendChild(script);
    }
  };
  ensurePhaseI();

  if (!document.querySelector('style[data-phase-h-pointer-guard]')) {
    const style = document.createElement('style');
    style.dataset.phaseHPointerGuard = 'true';
    style.textContent = [
      'body.is-profile-intro-v2 #site-graph .site-graph-node:not([data-node-id="stepan-chrast"]):not([data-node-id="work"]):not([data-node-id="knowledge"]):not([data-node-id="experience"]):not([data-node-id="education"]):not([data-node-id="about"]),',
      'body.is-profile-intro-v2 #site-graph .site-graph-node:not([data-node-id="stepan-chrast"]):not([data-node-id="work"]):not([data-node-id="knowledge"]):not([data-node-id="experience"]):not([data-node-id="education"]):not([data-node-id="about"]) *{pointer-events:none!important}'
    ].join('');
    document.head.appendChild(style);
  }

  if (window.ProfileIntro?.__phaseH) {
    window.ProfileIntroUnfold = Object.freeze({
      retired: true,
      snapshot: () => ({
        stage: 'retired',
        running: false,
        completed: true,
        nodeCount: 0,
        overlayPresent: false,
        phaseH: true
      })
    });
    return;
  }
})();
