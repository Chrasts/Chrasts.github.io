(() => {
  if (window.ProfileIntroStageConsistency?.active) return;

  const EPSILON = 0.9;
  let installed = false;
  let reportedStage = null;

  const deepNodes = () => [...document.querySelectorAll(
    '.profile-intro-overlay .profile-intro-graph .site-graph-node[data-intro-depth]'
  )].filter(node => Number(node.dataset.introDepth) >= 2);

  const branchesSettled = () => {
    const nodes = deepNodes();
    if (!nodes.length) return false;
    return nodes.every(node => {
      const x = Number(node.dataset.x);
      const y = Number(node.dataset.y);
      const sectionX = Number(node.dataset.introSectionX);
      const sectionY = Number(node.dataset.introSectionY);
      return [x, y, sectionX, sectionY].every(Number.isFinite) &&
        Math.abs(x - sectionX) <= EPSILON &&
        Math.abs(y - sectionY) <= EPSILON;
    });
  };

  const install = () => {
    const base = window.ProfileIntro;
    if (!base?.snapshot || base.__stableStageContract) return Boolean(base?.__stableStageContract);

    window.ProfileIntro = Object.freeze({
      ...base,
      __stableStageContract: true,
      snapshot: () => {
        const snapshot = base.snapshot();
        const unfold = window.ProfileIntroUnfold?.snapshot?.();

        // `atlas` means the cinematic Atlas is actually ready for interaction.
        // Never expose it during the small gap before auto-unfold starts.
        if (
          snapshot.stage === 'atlas' &&
          document.querySelector('.profile-intro-overlay') &&
          (!unfold || !unfold.completed)
        ) {
          reportedStage = 'unfolding';
          return { ...snapshot, stage: 'unfolding', waiting: false };
        }

        // intro-animation publishes `branches` when the branch-collapse motion
        // starts. External consumers, however, use the stage as a settled-state
        // contract. Keep reporting territories until deep nodes have reached
        // their exact section coordinates.
        if (snapshot.stage === 'branches' && !branchesSettled()) {
          reportedStage = 'territories';
          return { ...snapshot, stage: 'territories' };
        }

        reportedStage = snapshot.stage;
        return snapshot;
      }
    });
    installed = true;
    return true;
  };

  const boot = () => {
    if (window.ProfileIntro?.__stableStageContract) {
      installed = true;
      return;
    }
    if (window.ProfileIntro?.snapshot && window.ProfileIntroUnfold?.snapshot && install()) return;
    requestAnimationFrame(boot);
  };

  window.ProfileIntroStageConsistency = Object.freeze({
    active: true,
    snapshot: () => ({ installed, reportedStage, branchesSettled: branchesSettled() })
  });

  boot();
})();
