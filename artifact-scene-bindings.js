(() => {
  const deepFreeze = value => {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.values(value).forEach(deepFreeze);
    return Object.freeze(value);
  };

  const bindings = [
    {
      id: 'clp-survey-paper',
      recipe: 'document-folio',
      variant: 'pdf-only',
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
      id: 'bachelor-thesis-paper',
      recipe: 'document-folio',
      variant: 'pdf-only',
      eyebrow: 'Bachelor thesis',
      title: 'BSc thesis',
      description: 'The defended bachelor thesis is the primary document object for the research scene.',
      artifactIds: ['bachelor-thesis-pdf'],
      supportArtifactIds: ['bachelor-thesis-lattice-of-bands', 'bachelor-thesis-rol-non-a'],
      targets: [
        { route: 'work/project/bachelor-thesis', anchorNodeId: 'project-bachelor-thesis', side: 'left' },
        { route: 'knowledge/logic-math/mathematical-logic/algebraic-logic/quantum-logic-arol', anchorNodeId: 'quantum-logic-arol', side: 'right' }
      ]
    },
    {
      id: 'metalogic-amalgamation-interpolation-note',
      recipe: 'document-folio',
      variant: 'pdf-only',
      eyebrow: 'Selected coursework',
      title: 'Amalgamation & Interpolation',
      artifactIds: ['metalogic-amalgamation-interpolation-note'],
      targets: [
        { route: 'education/charles-university/coursework/amalgamation-interpolation', anchorNodeId: 'metalogic-amalgamation-interpolation', side: 'right' }
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
      id: 'sql-schema-er-diagrams',
      recipe: 'media-deck',
      variant: 'fan',
      eyebrow: 'Data modelling · algebraic logic',
      title: 'Algebraic Logic SQL Schema',
      description: 'The entity-relationship diagram and subclass map are available as floating project artefacts wherever the schema connects to its SQL and algebraic-logic context.',
      artifactIds: ['sql-schema-er-diagram', 'sql-schema-subclass-hierarchy'],
      targets: [
        { route: 'work/project/sql-schema', anchorNodeId: 'project-sql-schema', side: 'left' },
        { route: 'knowledge/data-computing/data-management/sql', anchorNodeId: 'sql', side: 'right' },
        { route: 'knowledge/data-computing/data-management/data-modelling', anchorNodeId: 'data-modelling', side: 'right' },
        { route: 'knowledge/logic-math/mathematical-logic/algebraic-logic', anchorNodeId: 'algebraic-logic', side: 'right' }
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
    },
    {
      id: 'entrance-terrace-photo',
      recipe: 'media-deck',
      title: 'Entrance terrace',
      artifactIds: ['entrance-terrace-photo'],
      targets: [{ route: 'about/woodworking/entrance-terrace', anchorNodeId: 'entrance-terrace', side: 'right' }]
    }
  ];

  deepFreeze(bindings);
  window.ARTIFACT_SCENE_BINDINGS = bindings;
})();