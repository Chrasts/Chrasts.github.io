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
    coursework: {
      anchorNodeIds: ['charles-university', 'selected-coursework', 'simulation-credence'],
      artifactIds: ['simulation-credence-coursework']
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
      label: 'Selected course plan',
      note: 'A compact portfolio view of the selected timetable; it represents the course plan rather than a claim that every optional slot was attended.',
      weeks: [
        {
          label: 'Week 1',
          sessions: [
            {
              time: '09:00',
              title: 'Stone Duality: Connecting Algebra and Topology via Logic',
              links: ['algebraic-logic', 'lattice-theory']
            },
            {
              time: '11:00',
              title: 'The Logic Underlying Language Models',
              links: ['language-models', 'logic-for-ai']
            },
            {
              time: '17:00',
              title: 'Elective slot',
              note: 'Final optional-course choice is not encoded in the portfolio data.',
              links: []
            }
          ]
        },
        {
          label: 'Week 2',
          sessions: [
            {
              time: '09:00',
              title: 'Logic and Argumentation for New Generation AI',
              links: ['logic-for-ai']
            },
            {
              time: '11:00',
              title: 'Introduction to SAT and SMT Solving',
              links: ['sat-smt', 'computational-logic']
            },
            {
              time: '17:00',
              title: 'Experimenting with the LogiKEy Framework & Methodology',
              links: ['logic-for-ai', 'automated-reasoning']
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
      note: 'Shown as current / upcoming study context. The scene does not treat planned coursework as already mastered.',
      links: ['ai-methods', 'programming-automation', 'data-analysis']
    }
  };

  window.PHASE8_SCENE_DATA = freeze(data);
})();
