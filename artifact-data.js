(() => {
  const root = typeof window !== 'undefined' ? window : globalThis;
  const TYPES = Object.freeze([
    'document',
    'certificate',
    'image',
    'diagram',
    'audio',
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
      id: 'cambridge-b2-certificate',
      type: 'certificate',
      title: 'Cambridge English B2 First — Score 170',
      anchorNodeIds: ['cert-cambridge-b2'],
      availability: 'planned',
      presentation: { preferredObject: 'document' }
    },
    {
      id: 'ethics-ai-certificate',
      type: 'certificate',
      title: 'Ethics of AI — University of Helsinki',
      anchorNodeIds: ['cert-ethics-ai'],
      availability: 'planned',
      presentation: { preferredObject: 'document' }
    },
    {
      id: 'introduction-ai-certificate',
      type: 'certificate',
      title: 'Introduction to Artificial Intelligence — University of Helsinki',
      anchorNodeIds: ['cert-intro-ai'],
      availability: 'planned',
      presentation: { preferredObject: 'document' }
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
