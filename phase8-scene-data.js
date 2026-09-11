(() => {
  const freeze = value => {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.values(value).forEach(freeze);
    return Object.freeze(value);
  };

  const data = {
    experience: {
      nodeIds: ['escape-room', 'student-ball', 'ceske-priority']
    },
    certifications: {
      nodeId: 'credentials',
      items: [
        { nodeId: 'cert-cambridge-b2', artifactId: 'cambridge-b2-certificate' },
        { nodeId: 'cert-ethics-ai', artifactId: 'ethics-ai-certificate' },
        { nodeId: 'cert-intro-ai', artifactId: 'introduction-ai-certificate' }
      ]
    },
    esslli: {
      nodeId: 'esslli',
      label: 'Selected ESSLLI 2026 programme',
      note: 'Compact record of the selected programme. Sessions are education context, not automatic claims of standalone expertise. Links point only to broader knowledge areas retained in the portfolio.',
      weeks: [
        {
          label: 'Week 1',
          sessions: [
            {
              title: 'Stone Duality: Connecting Algebra and Topology via Logic',
              links: ['algebraic-logic', 'lattice-theory']
            },
            {
              title: 'The Logic Underlying Language Models',
              links: ['language-models', 'ai-methods']
            }
          ]
        },
        {
          label: 'Week 2',
          sessions: [
            {
              title: 'Logic and Argumentation for New Generation AI',
              links: ['computational-logic', 'ai-methods']
            },
            {
              title: 'Introduction to SAT and SMT Solving',
              links: ['computational-logic']
            },
            {
              title: 'Experimenting with the LogiKEy Framework & Methodology',
              links: ['automated-reasoning', 'computational-logic']
            }
          ]
        }
      ]
    },
    prgAi: {
      nodeId: 'prg-ai',
      status: '2026/27',
      title: 'prg.ai Minor',
      subtitle: 'Inter-university AI minor',
      note: 'Shown as upcoming study context. Planned coursework is not treated as already mastered.',
      links: ['ai-methods', 'programming-automation', 'data-analysis']
    }
  };

  window.PHASE8_SCENE_DATA = freeze(data);
})();
