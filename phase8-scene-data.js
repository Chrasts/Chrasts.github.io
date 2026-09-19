(() => {
  const freeze = value => {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.values(value).forEach(freeze);
    return Object.freeze(value);
  };
  const site = window.SITE_DATA || {};

  const data = {
    experience: {
      nodeIds: ['escape-room', 'student-ball', 'ceske-priority']
    },
    education: {
      bsc: {
        nodeId: 'charles-university',
        thesisNodeId: 'project-bachelor-thesis',
        courseEvidence: site.semantics?.education?.courseEvidence || []
      },
      msc: {
        nodeId: 'charles-university-masters-logic',
        evidencePolicy: 'Course evidence appears here only after it is completed or recognized in canonical study data.'
      }
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
      note: 'Compact record of the selected programme.',
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
      status: '2026 - present',
      title: 'prg.ai Minor',
      subtitle: 'Inter-university AI programme',
      note: 'Cross-faculty AI coursework with industry talks. My focus includes mathematical logic in AI, AI-assisted scientific workflows, and AI in scientific inquiry.',
      links: ['logic-for-ai', 'ai-research-workflows', 'ai-science-workflows-interest'],
      blocks: site.semantics?.education?.prgAiBlocks || []
    }
  };

  window.PHASE8_SCENE_DATA = freeze(data);
})();
