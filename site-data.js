window.SITE_DATA = {
  profile: {
    name: "Štěpán Chrast",
    shortName: "ŠC",
    label: "Data analysis · Research · Mathematical logic",
    intro:
      "Junior data analyst and researcher in Prague, working with data, reproducible analysis and applied research alongside a background in mathematical logic.",
    email: "chraststepan@gmail.com",
    links: [
      { label: "GitHub", href: "https://github.com/Chrasts" },
      { label: "LinkedIn", href: "https://www.linkedin.com/in/stepan-chrast" }
    ]
  },

  graph: {
    rootId: "stepan-chrast",
    nodes: [
      { id: "stepan-chrast", type: "profile", label: "Štěpán Chrast", route: "overview", summary: "Data analysis, research and mathematical logic." },
      { id: "work", type: "section", label: "Work", parentIds: ["stepan-chrast"], route: "work", summary: "Selected projects, explored through a concept lattice of themes and contexts." },
      { id: "knowledge", type: "section", label: "Knowledge", parentIds: ["stepan-chrast"], route: "knowledge", summary: "Methods, tools and theoretical areas connected to projects and study." },
      { id: "experience", type: "section", label: "Experience", parentIds: ["stepan-chrast"], route: "experience", summary: "Roles and practical contexts behind the work." },
      { id: "education", type: "section", label: "Education", parentIds: ["stepan-chrast"], route: "education", summary: "Programmes, coursework and academic foundations." },
      { id: "about", type: "section", label: "About", parentIds: ["stepan-chrast"], route: "about", summary: "Research interests and the wider context of the profile." },

      { id: "logic-math", type: "knowledge", label: "Mathematics & Logic", parentIds: ["knowledge"], route: "knowledge/logic-math", status: "studied", summary: "Formal methods and the algebraic structures used to study them." },
      { id: "data-computing", type: "knowledge", label: "Data & Computing", parentIds: ["knowledge"], route: "knowledge/data-computing", status: "used in projects", summary: "Data analysis, programming, modelling and reproducible workflows." },
      { id: "research-practice", type: "knowledge", label: "Research Practice", parentIds: ["knowledge"], route: "knowledge/research-practice", status: "used in projects", summary: "Evidence assessment, data quality and reproducible analytical practice." },
      { id: "mathematical-logic", type: "knowledge", label: "Mathematical Logic", parentIds: ["logic-math"], route: "knowledge/logic-math/mathematical-logic", status: "studied", summary: "Logical systems, semantics and their formal properties." },
      { id: "universal-algebra", type: "knowledge", label: "Universal Algebra", parentIds: ["logic-math"], route: "knowledge/logic-math/universal-algebra", status: "studied", summary: "Algebraic structures and varieties, including their logical applications." },
      { id: "lattice-theory", type: "knowledge", label: "Lattice Theory", parentIds: ["logic-math"], route: "knowledge/logic-math/lattice-theory", status: "studied", summary: "Order-theoretic structures used throughout algebraic logic." },
      { id: "python", type: "knowledge", label: "Python", parentIds: ["data-computing"], route: "knowledge/data-computing/python", status: "used in projects", summary: "Used for analysis, automation and reproducible research workflows." },
      { id: "sql", type: "knowledge", label: "SQL & Data Modelling", parentIds: ["data-computing"], route: "knowledge/data-computing/sql", status: "used in projects", summary: "Relational design, querying and logical data models." },
      { id: "data-analysis", type: "knowledge", label: "Data Analysis", parentIds: ["data-computing", "research-practice"], route: "knowledge/data-computing/data-analysis", status: "used in projects", summary: "Cleaning, joins, descriptive analysis and transparent reporting." },
      { id: "reproducible-analysis", type: "knowledge", label: "Reproducible Analysis", parentIds: ["research-practice"], route: "knowledge/research-practice/reproducible-analysis", status: "used in projects", summary: "Auditable pipelines, explicit decisions and reusable outputs." },
      { id: "data-qa", type: "knowledge", label: "Data Validation & QA", parentIds: ["research-practice"], route: "knowledge/research-practice/data-qa", status: "used in projects", summary: "Quality review, nonresponse handling and defensible data preparation." },

      { id: "ceske-priority", type: "experience", label: "České priority", parentIds: ["experience"], route: "experience/ceske-priority", summary: "Data analysis and research support for evidence-informed public-interest projects.", meta: "2026 — present", timelineOrder: 3, role: "Data Analysis & Research Intern", organisation: "Part-time", highlights: ["Questionnaire data processing", "Quality review", "Research support"] },
      { id: "escape-room", type: "experience", label: "EscapeTheRoom.cz", parentIds: ["experience"], route: "experience/escape-room", summary: "Customer-facing operations, incident handling and structured issue logging.", meta: "2019 — 2023", timelineOrder: 1, role: "Game Master", organisation: "EscapeTheRoom.cz - Part-time", highlights: ["Customer-facing operations", "Incident handling", "Structured issue logging"] },
      { id: "student-ball", type: "experience", label: "Student Ball", parentIds: ["experience"], route: "experience/student-ball", summary: "Two-person event project covering budgeting, sponsorship and operations.", meta: "2020 — 2021", timelineOrder: 2, role: "Event Co-lead", organisation: "Self-organised project - Two-person team", highlights: ["Budgeting and cash-flow planning", "Sponsorship", "Transaction reconciliation and event operations"] },

      { id: "charles-university", type: "education", label: "Charles University — Logic", parentIds: ["education"], route: "education/charles-university", summary: "Bachelor’s programme focused on algebraic logic, universal algebra and lattice theory.", meta: "2022 — 2026", programme: "Bachelor's programme in Logic", organisation: "Charles University", highlights: ["Algebraic logic", "Universal algebra and lattice theory", "Thesis on structures related to quantum logic"] },
      { id: "esslli", type: "education", label: "ESSLLI 2026", parentIds: ["education"], route: "education/esslli", summary: "Coursework in logic for AI, SAT/SMT solving, language models and algebraic methods.", meta: "2026", programme: "Participant & volunteer", organisation: "ESSLLI", highlights: ["Logic for AI", "SAT/SMT and higher-order logic", "Language models and algebraic methods"] },
      { id: "prg-ai", type: "education", label: "prg.ai Minor", parentIds: ["education"], route: "education/prg-ai", summary: "Inter-university AI programme across Charles University and Czech Technical University.", meta: "2026/27", programme: "Inter-university AI minor", organisation: "Charles University & Czech Technical University", highlights: ["AI coursework across institutions", "Programming, data analysis and AI methods"] },
      { id: "credentials", type: "credential", label: "Credentials", parentIds: ["education"], route: "education/credentials", summary: "Ethics of AI, Introduction to AI and Cambridge English B2 First.", highlights: ["Ethics of AI", "Introduction to Artificial Intelligence", "Cambridge English B2 First"] },

      { id: "research-interests", type: "interest", label: "Research Interests", parentIds: ["about"], route: "about/research-interests", summary: "Questions connecting logic, AI, science and evidence." },
      { id: "philosophy", type: "interest", label: "Philosophy", parentIds: ["about"], route: "about/philosophy", summary: "Philosophy of AI, mind, science and analytical philosophy." },
      { id: "games-rpg", type: "interest", label: "Games & RPG", parentIds: ["about"], route: "about/games-rpg", summary: "Role-playing, tabletop and digital games." },
      { id: "music", type: "interest", label: "Music", parentIds: ["about"], route: "about/music", summary: "Piano and music creation." },
      { id: "other-interests", type: "interest", label: "Other Interests", parentIds: ["about"], route: "about/other-interests", summary: "A compact view of adjacent interests beyond the professional profile." }
    ],
    edges: [
      { source: "data-analysis", target: "ceske-priority", type: "experience-link" },
      { source: "data-qa", target: "ceske-priority", type: "experience-link" },
      { source: "python", target: "work", type: "used-in" },
      { source: "sql", target: "work", type: "used-in" },
      { source: "lattice-theory", target: "charles-university", type: "education-link" },
      { source: "universal-algebra", target: "charles-university", type: "education-link" },
      { source: "mathematical-logic", target: "esslli", type: "education-link" },
      { source: "reproducible-analysis", target: "work", type: "evidence" }
    ]
  },

  work: {
    attributes: [
      { id: "logic", label: "Logic / Math" },
      { id: "computing-data", label: "Computing & Data" },
      { id: "research", label: "Research / Evidence" },
      { id: "education", label: "Education / Communication" }
    ],

    contextFilters: [
      { id: "all", label: "All" },
      { id: "academic", label: "Academic" },
      { id: "professional", label: "Professional" },
      { id: "personal", label: "Personal" }
    ],

    projects: [
      {
        id: "insolvency",
        order: 1,
        graphLabel: "Insolvency",
        title: "Insolvency Event-Log Analysis",
        type: "Data analysis",
        description:
          "An end-to-end Python analysis deriving case outcomes from event histories, linking them to person-level attributes and comparing results across groups, courts and time.",
        lattice: ["computing-data", "research"],
        contexts: ["personal"],
        facets: {
          orientation: ["empirical", "applied"],
          collaboration: ["individual"],
          format: ["analysis", "report"],
          status: "finished",
          visibility: "public"
        },
        tech: ["Python", "pandas", "Matplotlib", "LaTeX"],
        links: [
          {
            label: "Report ↗",
            href: "https://github.com/Chrasts/insolvency-success-analysis/blob/main/report/report.pdf"
          },
          {
            label: "GitHub ↗",
            href: "https://github.com/Chrasts/insolvency-success-analysis"
          }
        ]
      },

      {
        id: "modal-logic-lab",
        order: 2,
        graphLabel: "Modal Logic Lab",
        title: "Modal Logic Lab",
        type: "Interactive mathematical logic",
        description:
          "An interactive environment for constructing finite Kripke models, evaluating modal formulas, solving guided challenges and experimenting with frame properties.",
        lattice: ["logic", "computing-data", "education"],
        contexts: ["academic", "personal"],
        facets: {
          orientation: ["theoretical", "applied"],
          collaboration: ["individual"],
          format: ["software", "educational-tool"],
          status: "active",
          visibility: "public"
        },
        tech: ["React", "TypeScript", "Modal logic", "Vitest"],
        links: [
          {
            label: "Play ↗",
            href: "https://chrasts.github.io/Modal_Logic_Educational_Game/"
          },
          {
            label: "GitHub ↗",
            href: "https://github.com/Chrasts/Modal_Logic_Educational_Game"
          }
        ]
      },

      {
        id: "sql-schema",
        order: 3,
        graphLabel: "SQL Schema",
        title: "Algebraic Logic SQL Schema",
        type: "Data modelling",
        description:
          "A relational MySQL schema for logical systems, algebraic classes, axioms, properties and subclass relations.",
        lattice: ["logic", "computing-data"],
        contexts: ["academic", "personal"],
        facets: {
          orientation: ["theoretical", "applied"],
          collaboration: ["individual"],
          format: ["database"],
          status: "finished",
          visibility: "public"
        },
        tech: ["MySQL", "SQL", "Relational design"],
        links: [
          {
            label: "GitHub ↗",
            href: "https://github.com/Chrasts/algebraic_logic-SQL_database"
          }
        ]
      },

      {
        id: "film-splitter",
        order: 4,
        graphLabel: "Film Splitter",
        title: "Film Scene Character Splitter",
        type: "Automation",
        description:
          "A production utility transforming a master scene list into chronologically ordered character-specific Excel workbooks.",
        lattice: ["computing-data"],
        contexts: ["professional"],
        facets: {
          orientation: ["applied"],
          collaboration: ["individual"],
          format: ["software", "automation"],
          status: "finished",
          visibility: "public"
        },
        tech: ["Python", "pandas", "openpyxl"],
        links: [
          {
            label: "GitHub ↗",
            href: "https://github.com/Chrasts/Filming-project-scene-Splitter"
          }
        ]
      },

      {
        id: "clp-survey",
        order: 5,
        graphLabel: "CLP Survey",
        title: "The Congruence Lattice Problem - Historical Survey",
        type: "Mathematical writing",
        description:
          "A concise historical survey of the Congruence Lattice Problem, focused on the main milestones, ideas and results in lattice theory.",
        lattice: ["logic", "research", "education"],
        contexts: ["academic", "personal"],
        facets: {
          orientation: ["theoretical"],
          collaboration: ["individual"],
          format: ["paper", "survey"],
          status: "finished",
          visibility: "public"
        },
        tech: ["Lattice theory", "LaTeX", "Literature review"],
        links: [
          {
            label: "GitHub ↗",
            href: "https://github.com/Chrasts/The-Congruence-Lattice-Problem-A-Historical-Survey"
          }
        ]
      },

      {
        id: "bachelor-thesis",
        order: 6,
        graphLabel: "BSc Thesis",
        title: "Bachelor Thesis - Quantum Logic & A-ROL",
        type: "Academic research",
        description:
          "Bachelor thesis on quantum logic and associative residuated ortholattices, with a focus on algebraic structure and related varieties.",
        lattice: ["logic", "research"],
        contexts: ["academic"],
        facets: {
          orientation: ["theoretical"],
          collaboration: ["individual"],
          format: ["thesis"],
          status: "in-preparation",
          visibility: "private"
        },
        tech: ["Algebraic logic", "Universal algebra", "Lattice theory", "LaTeX"],
        note: "Portfolio version / thesis materials in preparation.",
        links: []
      },

      {
        id: "social-workers-survey",
        order: 7,
        graphLabel: "Survey Analysis",
        title: "Social Workers Survey Analysis",
        type: "Applied research · Data analysis",
        description:
          "A reproducible survey-analysis pipeline covering cleaning and audit, descriptive outputs, vignette analysis, explicit nonresponse, benchmarking and a registry for formalised statistical hypotheses.",
        lattice: ["computing-data", "research"],
        contexts: ["professional"],
        facets: {
          orientation: ["empirical", "applied"],
          collaboration: ["team"],
          format: ["analysis", "pipeline"],
          status: "active",
          visibility: "private"
        },
        tech: ["Python", "pandas", "Survey analysis", "Statistics", "Data QA"],
        note: "Project repository is currently private.",
        links: []
      },

      {
        id: "arol-lab",
        order: 8,
        graphLabel: "Wₙ Separators",
        title: "A-ROL Lab / Separating Equations for the Wₙ Family",
        type: "Computational mathematical research",
        description:
          "A reproducible experimental workflow around residuated ortholattices and the finite Wₙ family, combining finite verification, bounded equation search and ATP/model-finding support.",
        lattice: ["logic", "computing-data", "research"],
        contexts: ["academic", "personal"],
        facets: {
          orientation: ["theoretical", "computational"],
          collaboration: ["individual"],
          format: ["research-software", "experiments"],
          status: "active",
          visibility: "private"
        },
        tech: ["Python", "Prover9", "Mace4", "Automated theorem proving"],
        note: "Research repository is currently private.",
        links: []
      },

      {
        id: "tachov-workshop",
        order: 9,
        graphLabel: "Tachov Workshop",
        title: "Minecraft Participatory Workshop - Tachov",
        type: "Participatory research · Technical prototyping",
        description:
          "A Minecraft-based participatory and foresight workshop concept using an approximate 3D model of Tachov to help young participants discuss places, needs and possible futures for the city.",
        lattice: ["computing-data", "research", "education"],
        contexts: ["professional"],
        facets: {
          orientation: ["applied", "participatory"],
          collaboration: ["team"],
          format: ["workshop", "technical-prototype"],
          status: "active",
          visibility: "private"
        },
        tech: ["Minecraft Education", "Geodata", "Workshop design", "Technical research"],
        note: "Internal project materials are currently private.",
        links: []
      }
    ]
  }
};

// The global profile graph extends the Work data instead of duplicating it by hand.
// Each project remains authored once above, then receives a compact graph node and
// evidence links to the knowledge, experience and education graph.
const graphExtensions = {
  nodes: [
    { id: "algebraic-logic", type: "knowledge", label: "Algebraic Logic", parentIds: ["mathematical-logic", "universal-algebra"], route: "knowledge/logic-math/algebraic-logic", status: "studied", summary: "The algebraic study of logical systems and their associated varieties." },
    { id: "modal-logic", type: "knowledge", label: "Modal Logic", parentIds: ["mathematical-logic"], route: "knowledge/logic-math/modal-logic", status: "used in projects", summary: "Semantics, Kripke models and interactive logical reasoning." },
    { id: "computational-logic", type: "knowledge", label: "Computational Logic", parentIds: ["mathematical-logic", "data-computing"], route: "knowledge/logic-math/computational-logic", status: "used in projects", summary: "Logic supported by finite verification, model finding and automated reasoning." },
    { id: "sat-smt", type: "knowledge", label: "SAT / SMT Solving", parentIds: ["computational-logic"], route: "knowledge/logic-math/sat-smt", status: "studied", summary: "Constraint solving and satisfiability methods studied in logic and AI contexts." },
    { id: "logic-for-ai", type: "knowledge", label: "Logic for AI", parentIds: ["mathematical-logic", "computational-logic"], route: "knowledge/logic-math/logic-for-ai", status: "studied", summary: "Logical methods relevant to automated reasoning and AI systems." },
    { id: "statistics", type: "knowledge", label: "Statistics", parentIds: ["data-computing", "research-practice"], route: "knowledge/data-computing/statistics", status: "used in projects", summary: "Descriptive outputs, hypotheses and transparent treatment of uncertainty." },
    { id: "automation", type: "knowledge", label: "Automation & Pipelines", parentIds: ["data-computing"], route: "knowledge/data-computing/automation", status: "used in projects", summary: "Reliable transformations from source data to reusable outputs." },
    { id: "data-modelling", type: "knowledge", label: "Data Modelling", parentIds: ["data-computing"], route: "knowledge/data-computing/data-modelling", status: "used in projects", summary: "Relational structures, schemas and explicit modelling decisions." },
    { id: "visualisation", type: "knowledge", label: "Visualisation", parentIds: ["data-computing"], route: "knowledge/data-computing/visualisation", status: "used in projects", summary: "Clear analytical graphics and communicable reporting." },
    { id: "git", type: "knowledge", label: "Git & GitHub", parentIds: ["data-computing"], route: "knowledge/data-computing/git", status: "used in projects", summary: "Versioned, reviewable and shareable project workflows." },
    { id: "ai-methods", type: "knowledge", label: "AI & Computational Methods", parentIds: ["data-computing"], route: "knowledge/data-computing/ai-methods", status: "current learning", summary: "AI-oriented methods linking programming, logic and applied research." },
    { id: "literature-review", type: "knowledge", label: "Literature Review", parentIds: ["research-practice"], route: "knowledge/research-practice/literature-review", status: "used in projects", summary: "Structured reading, historical synthesis and source-oriented writing." },
    { id: "hypothesis-formulation", type: "knowledge", label: "Hypothesis Formulation", parentIds: ["research-practice"], route: "knowledge/research-practice/hypothesis-formulation", status: "used in projects", summary: "Making analytical questions and statistical assumptions explicit." },
    { id: "scientific-writing", type: "knowledge", label: "Scientific Writing", parentIds: ["research-practice"], route: "knowledge/research-practice/scientific-writing", status: "used in projects", summary: "Concise, evidenced and reproducible technical communication." },

    // About is intentionally a light cluster graph: these are interests, not a
    // second CV taxonomy. The clusters reveal only after selecting About.
    { id: "logic-ai-interest", type: "interest", label: "Logic & AI", parentIds: ["research-interests"], route: "about/research-interests/logic-ai", status: "interest", summary: "Questions at the boundary of formal reasoning and artificial intelligence." },
    { id: "science-evidence", type: "interest", label: "Science & Evidence", parentIds: ["research-interests", "other-interests"], route: "about/research-interests/science-evidence", status: "interest", summary: "How scientific claims are assessed, communicated and made reliable." },
    { id: "philosophy-ai", type: "interest", label: "Philosophy of AI", parentIds: ["philosophy"], route: "about/philosophy/ai", status: "interest", summary: "Conceptual questions around intelligence, agency and AI systems." },
    { id: "philosophy-mind", type: "interest", label: "Philosophy of Mind", parentIds: ["philosophy"], route: "about/philosophy/mind", status: "interest", summary: "Questions about mind, cognition and explanation." },
    { id: "philosophy-science", type: "interest", label: "Philosophy of Science", parentIds: ["philosophy"], route: "about/philosophy/science", status: "interest", summary: "How scientific knowledge, explanation and evidence work." },
    { id: "analytical-philosophy", type: "interest", label: "Analytical Philosophy", parentIds: ["philosophy"], route: "about/philosophy/analytical", status: "interest", summary: "Clear concepts, arguments and formal precision in philosophical inquiry." },
    { id: "rpg-dnd", type: "interest", label: "RPG / D&D", parentIds: ["games-rpg"], route: "about/games-rpg/rpg-dnd", status: "interest", summary: "Collaborative role-playing and shared-world storytelling." },
    { id: "mtg", type: "interest", label: "Magic: The Gathering", parentIds: ["games-rpg"], route: "about/games-rpg/mtg", status: "interest", summary: "Strategy, systems and tabletop play." },
    { id: "pc-tabletop-games", type: "interest", label: "PC & Tabletop Games", parentIds: ["games-rpg"], route: "about/games-rpg/pc-tabletop", status: "interest", summary: "Digital and tabletop games as systems, play and social spaces." },
    { id: "piano", type: "interest", label: "Piano", parentIds: ["music"], route: "about/music/piano", status: "interest", summary: "Playing piano as a continuing personal practice." },
    { id: "music-creation", type: "interest", label: "Music Creation", parentIds: ["music"], route: "about/music/creation", status: "interest", summary: "Exploring composition and the process of making music." }
  ],
  edges: [
    { source: "modal-logic", target: "esslli", type: "education-link" },
    { source: "algebraic-logic", target: "charles-university", type: "education-link" },
    { source: "computational-logic", target: "esslli", type: "education-link" },
    { source: "statistics", target: "ceske-priority", type: "experience-link" },
    { source: "automation", target: "work", type: "used-in" },
    { source: "scientific-writing", target: "credentials", type: "education-link" },
    { source: "logic-ai-interest", target: "logic-for-ai", type: "related", secondary: true },
    { source: "science-evidence", target: "research-practice", type: "related", secondary: true },
    { source: "philosophy-ai", target: "logic-for-ai", type: "related", secondary: true },
    { source: "philosophy-science", target: "research-practice", type: "related", secondary: true }
  ]
};

window.SITE_DATA.graph.nodes.push(...graphExtensions.nodes);
window.SITE_DATA.graph.edges.push(...graphExtensions.edges);

const projectGraphLinks = {
  insolvency: { knowledge: ["python", "data-analysis", "statistics", "visualisation", "reproducible-analysis"], education: [] },
  "modal-logic-lab": { knowledge: ["modal-logic", "mathematical-logic", "data-computing", "git"], education: ["charles-university"] },
  "sql-schema": { knowledge: ["sql", "algebraic-logic", "data-modelling"], education: ["charles-university"] },
  "film-splitter": { knowledge: ["python", "automation", "data-analysis"], education: [] },
  "clp-survey": { knowledge: ["lattice-theory", "literature-review", "scientific-writing"], education: ["charles-university"] },
  "bachelor-thesis": { knowledge: ["algebraic-logic", "universal-algebra", "lattice-theory", "scientific-writing"], education: ["charles-university"] },
  "social-workers-survey": { knowledge: ["python", "statistics", "data-qa", "reproducible-analysis", "hypothesis-formulation"], experience: ["ceske-priority"] },
  "arol-lab": { knowledge: ["algebraic-logic", "computational-logic", "python", "automation"], education: ["charles-university"] },
  "tachov-workshop": { knowledge: ["research-practice", "data-analysis", "visualisation"], experience: ["ceske-priority"] }
};

// A small node is sufficient for Atlas; the authoritative full detail stays in
// SITE_DATA.work and opens through the Work explorer.
window.SITE_DATA.work.projects.forEach(project => {
  const links = projectGraphLinks[project.id] || {};
  const nodeId = `project-${project.id}`;
  window.SITE_DATA.graph.nodes.push({
    id: nodeId,
    type: "project",
    label: project.graphLabel,
    detailLabel: project.title,
    parentIds: ["work"],
    route: `work/project/${project.id}`,
    status: project.facets.status,
    summary: project.description,
    meta: project.type
  });
  (links.knowledge || []).forEach(target => {
    window.SITE_DATA.graph.edges.push({ source: nodeId, target, type: "evidence" });
  });
  (links.experience || []).forEach(target => {
    window.SITE_DATA.graph.edges.push({ source: nodeId, target, type: "experience-link" });
  });
  (links.education || []).forEach(target => {
    window.SITE_DATA.graph.edges.push({ source: nodeId, target, type: "education-link" });
  });
});

// Education is a DAG: a topic may sit in a knowledge branch and also be an
// explicit part of a programme. These parent links drive local Education views
// while keeping the primary Knowledge route intact.
const educationTopicParents = {
  "charles-university": ["mathematical-logic", "universal-algebra", "lattice-theory", "algebraic-logic"],
  esslli: ["modal-logic", "computational-logic", "sat-smt", "logic-for-ai"],
  "prg-ai": ["python", "data-analysis", "ai-methods"],
  credentials: ["scientific-writing"]
};
const graphNodeById = new Map(window.SITE_DATA.graph.nodes.map(node => [node.id, node]));
Object.entries(educationTopicParents).forEach(([programmeId, topicIds]) => {
  topicIds.forEach(topicId => {
    const topic = graphNodeById.get(topicId);
    if (topic && !topic.parentIds.includes(programmeId)) topic.parentIds.push(programmeId);
  });
});

// Work has one canonical project entity in SITE_DATA.work. These lightweight
// theme nodes make the same entities legible as a subgraph inside Atlas.
const workThemeGraphNodes = window.SITE_DATA.work.attributes.map(attribute => ({
  id: `work-theme-${attribute.id}`,
  type: "work-theme",
  label: attribute.label,
  parentIds: ["work"],
  route: `work/theme/${attribute.id}`,
  summary: "A Work theme used by the concept-lattice view."
}));
window.SITE_DATA.graph.nodes.push(...workThemeGraphNodes);
const finalGraphNodeById = new Map(window.SITE_DATA.graph.nodes.map(node => [node.id, node]));
window.SITE_DATA.work.projects.forEach(project => {
  const projectNode = finalGraphNodeById.get(`project-${project.id}`);
  if (!projectNode) return;
  project.lattice.forEach(themeId => {
    const themeNodeId = `work-theme-${themeId}`;
    if (!projectNode.parentIds.includes(themeNodeId)) projectNode.parentIds.push(themeNodeId);
  });
});
