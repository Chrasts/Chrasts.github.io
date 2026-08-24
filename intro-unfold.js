(() => {
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
