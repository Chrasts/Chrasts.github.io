(() => {
  const root = typeof window !== 'undefined' ? window : globalThis;
  const TYPES = Object.freeze([
    'document',
    'certificate',
    'image',
    'diagram',
    'audio',
    'video',
    'data',
    'interactive',
    'external'
  ]);
  const SOURCE_KINDS = Object.freeze(['local', 'external']);
  const AVAILABILITY = Object.freeze(['public', 'unlisted', 'planned']);

  const records = [
    {
      id: 'profile-portrait',
      type: 'image',
      title: 'Profile portrait',
      description: 'Primary portrait used by the profile identity scene.',
      anchorNodeIds: ['stepan-chrast'],
      source: { kind: 'local', path: 'assets/stepan-chrast.jpg' },
      mediaType: 'image/jpeg',
      availability: 'public',
      presentation: { preferredObject: 'image', role: 'identity' }
    },
    {
      id: 'insolvency-analysis-report',
      type: 'document',
      title: 'Insolvency Analysis Report',
      description: 'Public report for the insolvency event-log analysis project.',
      anchorNodeIds: ['project-insolvency'],
      source: {
        kind: 'external',
        url: 'https://github.com/Chrasts/insolvency-success-analysis/blob/main/report/report.pdf'
      },
      mediaType: 'application/pdf',
      availability: 'public',
      presentation: { preferredObject: 'document', openMode: 'new-tab' }
    },
    {
      id: 'modal-logic-lab-live',
      type: 'interactive',
      title: 'Modal Logic Lab',
      description: 'Live interactive modal-logic application.',
      anchorNodeIds: ['project-modal-logic-lab', 'modal-logic'],
      source: {
        kind: 'external',
        url: 'https://chrasts.github.io/Modal_Logic_Educational_Game/'
      },
      availability: 'public',
      presentation: { preferredObject: 'interactive', openMode: 'new-tab' }
    },
    {
      id: 'modal-logic-lab-screenshot-lab',
      type: 'image',
      title: 'Modal Logic Lab — model laboratory',
      description: 'Screenshot of the model-building laboratory interface.',
      anchorNodeIds: ['project-modal-logic-lab', 'modal-logic'],
      source: { kind: 'local', path: 'assets/images/work/modal-logic-lab/lab.png' },
      mediaType: 'image/png',
      availability: 'public',
      presentation: { preferredObject: 'image', role: 'project-preview' }
    },
    {
      id: 'modal-logic-lab-screenshot-learn',
      type: 'image',
      title: 'Modal Logic Lab — learning interface',
      description: 'Screenshot of the guided learning interface.',
      anchorNodeIds: ['project-modal-logic-lab', 'modal-logic'],
      source: { kind: 'local', path: 'assets/images/work/modal-logic-lab/learn.png' },
      mediaType: 'image/png',
      availability: 'public',
      presentation: { preferredObject: 'image', role: 'project-preview' }
    },
    {
      id: 'clp-survey-pdf',
      type: 'document',
      title: 'The Congruence Lattice Problem — Historical Survey',
      description: 'Local portfolio copy of the historical survey PDF.',
      anchorNodeIds: ['project-clp-survey', 'congruence-lattice-problem'],
      source: { kind: 'local', path: 'assets/documents/work/clp-survey/congruence-lattice-problem.pdf' },
      mediaType: 'application/pdf',
      availability: 'public',
      presentation: { preferredObject: 'document', openMode: 'new-tab' }
    },
    {
      id: 'bachelor-thesis-lattice-of-bands',
      type: 'diagram',
      title: 'Lower fragment of the lattice of varieties of bands',
      description: 'Diagram used in the bachelor-thesis material on associative residuated ortholattices.',
      anchorNodeIds: ['project-bachelor-thesis', 'quantum-logic-arol'],
      source: { kind: 'local', path: 'assets/diagrams/work/bachelor-thesis/lattice-of-bands.pdf' },
      mediaType: 'application/pdf',
      availability: 'public',
      presentation: { preferredObject: 'diagram' }
    },
    {
      id: 'bachelor-thesis-rol-non-a',
      type: 'diagram',
      title: 'ROL non-A diagram',
      description: 'Diagram from the bachelor-thesis material; retained under its source naming until a final public caption is assigned.',
      anchorNodeIds: ['project-bachelor-thesis', 'quantum-logic-arol'],
      source: { kind: 'local', path: 'assets/diagrams/work/bachelor-thesis/rol-non-a.pdf' },
      mediaType: 'application/pdf',
      availability: 'public',
      presentation: { preferredObject: 'diagram' }
    },
    {
      id: 'simulation-credence-coursework',
      type: 'document',
      title: 'Simulation Credence and Its Consequences',
      description: 'Coursework document on the simulation hypothesis; currently attached broadly to Charles University until a dedicated coursework node is introduced.',
      anchorNodeIds: ['charles-university'],
      source: { kind: 'local', path: 'assets/documents/education/coursework/simulation-credence-and-its-consequences.pdf' },
      mediaType: 'application/pdf',
      availability: 'public',
      presentation: { preferredObject: 'document', openMode: 'new-tab' }
    },
    {
      id: 'cambridge-b2-certificate',
      type: 'certificate',
      title: 'Cambridge English B2 First — Score 170',
      anchorNodeIds: ['cert-cambridge-b2'],
      source: { kind: 'local', path: 'assets/documents/certificates/cambridge-b2-first.pdf' },
      mediaType: 'application/pdf',
      availability: 'public',
      presentation: { preferredObject: 'document' }
    },
    {
      id: 'ethics-ai-certificate',
      type: 'certificate',
      title: 'Ethics of AI — University of Helsinki',
      anchorNodeIds: ['cert-ethics-ai'],
      source: { kind: 'local', path: 'assets/images/certificates/ethics-of-ai.png' },
      mediaType: 'image/png',
      availability: 'public',
      presentation: { preferredObject: 'image' }
    },
    {
      id: 'introduction-ai-certificate',
      type: 'certificate',
      title: 'Introduction to Artificial Intelligence — University of Helsinki',
      anchorNodeIds: ['cert-intro-ai'],
      source: { kind: 'local', path: 'assets/images/certificates/elements-of-ai-introduction-to-ai.png' },
      mediaType: 'image/png',
      availability: 'public',
      presentation: { preferredObject: 'image' }
    },
    {
      id: 'esslli-2026-course-timetable',
      type: 'document',
      title: 'ESSLLI 2026 Course Timetable',
      anchorNodeIds: ['esslli'],
      availability: 'planned',
      presentation: { preferredObject: 'document' }
    }
  ];

  const graphNodeIds = new Set(root.SITE_DATA?.graph?.nodes?.map(node => node.id) || []);
  const deepFreeze = value => {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.values(value).forEach(deepFreeze);
    return Object.freeze(value);
  };
  records.forEach(deepFreeze);
  Object.freeze(records);

  const issues = [];
  const seenIds = new Set();
  records.forEach(record => {
    if (!record?.id || seenIds.has(record.id)) issues.push(`Artifact id must be unique: ${record?.id || '(missing)'}`);
    seenIds.add(record.id);
    if (!TYPES.includes(record.type)) issues.push(`Unknown artifact type for ${record.id}: ${record.type}`);
    if (!AVAILABILITY.includes(record.availability)) issues.push(`Unknown availability for ${record.id}: ${record.availability}`);
    if (!Array.isArray(record.anchorNodeIds)) issues.push(`anchorNodeIds must be an array for ${record.id}`);
    (record.anchorNodeIds || []).forEach(nodeId => {
      if (graphNodeIds.size && !graphNodeIds.has(nodeId)) issues.push(`Unknown graph anchor for ${record.id}: ${nodeId}`);
    });

    if (record.availability === 'planned') return;
    if (!record.source || !SOURCE_KINDS.includes(record.source.kind)) {
      issues.push(`Public/unlisted artifact ${record.id} needs a valid source`);
      return;
    }
    if (record.source.kind === 'local') {
      const path = record.source.path || '';
      if (!path.startsWith('assets/') || path.includes('..') || /^https?:/i.test(path)) {
        issues.push(`Invalid local asset path for ${record.id}: ${path}`);
      }
    }
    if (record.source.kind === 'external') {
      const url = record.source.url || '';
      if (!/^https:\/\//i.test(url)) issues.push(`External artifact ${record.id} must use https`);
    }
  });

  const byId = new Map(records.map(record => [record.id, record]));
  const forNode = nodeId => records.filter(record => record.anchorNodeIds.includes(nodeId));
  const hrefFor = recordOrId => {
    const record = typeof recordOrId === 'string' ? byId.get(recordOrId) : recordOrId;
    if (!record?.source) return null;
    return record.source.kind === 'local' ? record.source.path : record.source.url;
  };

  root.PROFILE_ARTIFACTS = records;
  root.ProfileArtifacts = Object.freeze({
    types: TYPES,
    sourceKinds: SOURCE_KINDS,
    availability: AVAILABILITY,
    all: () => records.slice(),
    get: id => byId.get(id) || null,
    forNode,
    hrefFor,
    issues: () => issues.slice(),
    snapshot: () => ({
      count: records.length,
      localCount: records.filter(record => record.source?.kind === 'local').length,
      externalCount: records.filter(record => record.source?.kind === 'external').length,
      plannedCount: records.filter(record => record.availability === 'planned').length,
      issueCount: issues.length
    })
  });

  if (issues.length && root.console?.warn) root.console.warn('[ProfileArtifacts] manifest issues:', issues);
})();
