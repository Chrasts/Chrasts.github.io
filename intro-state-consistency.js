(() => {
  if (window.ProfileIntro?.__phaseH) {
    window.ProfileIntroStageConsistency = Object.freeze({
      active: false,
      retired: true,
      snapshot: () => ({ installed: false, reportedStage: window.ProfileIntro.snapshot().stage, phaseH: true })
    });
  }
})();
