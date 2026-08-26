(() => {
  const deepFreeze = value => {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.values(value).forEach(deepFreeze);
    return Object.freeze(value);
  };

  const bindings = [
    {
      id: 'simulation-credence-paper',
      recipe: 'document-folio',
      eyebrow: 'Selected coursework',
      title: 'Simulation Credence',
      description: 'The paper is treated as a scene object: inspect the real PDF, then return to the graph without leaving the route.',
      artifactIds: ['simulation-credence-coursework'],
      targets: [{ route: 'education/charles-university/coursework/simulation-credence', anchorNodeId: 'simulation-credence', side: 'left' }]
    },
    {
      id: 'clp-survey-paper',
      recipe: 'document-folio',
      eyebrow: 'Mathematical writing',
      title: 'CLP historical survey',
      description: 'A live folio preview connects the finished survey to both the project and its mathematical topic.',
      artifactIds: ['clp-survey-pdf'],
      targets: [
        { route: 'work/project/clp-survey', anchorNodeId: 'project-clp-survey', side: 'left' },
        { route: 'knowledge/logic-math/lattice-theory/congruence-lattice-problem', anchorNodeId: 'congruence-lattice-problem', side: 'right' }
      ]
    },
    {
      id: 'bachelor-thesis-diagrams',
      recipe: 'media-deck',
      variant: 'diagram',
      title: 'Structural diagrams',
      artifactIds: ['bachelor-thesis-lattice-of-bands', 'bachelor-thesis-rol-non-a'],
      targets: [
        { route: 'work/project/bachelor-thesis', anchorNodeId: 'project-bachelor-thesis', side: 'left' },
        { route: 'knowledge/logic-math/mathematical-logic/algebraic-logic/quantum-logic-arol', anchorNodeId: 'quantum-logic-arol', side: 'right' }
      ]
    },
    {
      id: 'modal-logic-lab-screens',
      recipe: 'media-deck',
      variant: 'screens',
      title: 'Modal Logic Lab interfaces',
      artifactIds: ['modal-logic-lab-screenshot-lab', 'modal-logic-lab-screenshot-learn'],
      actionArtifactIds: ['modal-logic-lab-live'],
      targets: [
        { route: 'work/project/modal-logic-lab', anchorNodeId: 'project-modal-logic-lab', side: 'left' },
        { route: 'knowledge/logic-math/mathematical-logic/modal-logic', anchorNodeId: 'modal-logic', side: 'right' }
      ]
    },
    {
      id: 'axiom-wilds-gameplay',
      recipe: 'media-deck',
      variant: 'video',
      eyebrow: 'Game development',
      title: 'Axiom Wilds gameplay',
      description: 'An in-development gameplay capture anchored directly to the Axiom Wilds project scene.',
      artifactIds: ['axiom-wilds-gameplay'],
      targets: [{ route: 'work/project/axiom-wilds', anchorNodeId: 'project-axiom-wilds', side: 'left' }]
    },
    {
      id: 'hedgehog-house-gallery',
      recipe: 'media-deck',
      variant: 'fan',
      title: 'Hedgehog house photographs',
      artifactIds: ['hedgehog-house-outside', 'hedgehog-house-inside', 'hedgehog-house-visitor'],
      targets: [{ route: 'about/woodworking/hedgehog-house', anchorNodeId: 'hedgehog-house', side: 'right' }]
    }
  ];

  deepFreeze(bindings);
  window.ARTIFACT_SCENE_BINDINGS = bindings;
})();
