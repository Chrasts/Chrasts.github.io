(() => {
  if (!document.querySelector('style[data-phase-h-pointer-guard]')) {
    const style = document.createElement('style');
    style.dataset.phaseHPointerGuard = 'true';
    style.textContent = [
      'body.is-profile-intro-v2[data-phase-h-intro-stage="condensing"] #site-graph .site-graph-node[data-phase-h-tier="cluster"],',
      'body.is-profile-intro-v2[data-phase-h-intro-stage="condensing"] #site-graph .site-graph-node[data-phase-h-tier="cluster"] *,',
      'body.is-profile-intro-v2[data-phase-h-intro-stage="condensing"] #site-graph .site-graph-node[data-phase-h-tier="deep"],',
      'body.is-profile-intro-v2[data-phase-h-intro-stage="condensing"] #site-graph .site-graph-node[data-phase-h-tier="deep"] *,',
      'body.is-profile-intro-v2[data-phase-h-intro-stage="five-branches"] #site-graph .site-graph-node:not([data-phase-h-tier="root"]):not([data-phase-h-tier="section"]),',
      'body.is-profile-intro-v2[data-phase-h-intro-stage="five-branches"] #site-graph .site-graph-node:not([data-phase-h-tier="root"]):not([data-phase-h-tier="section"]) *{pointer-events:none!important}'
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
