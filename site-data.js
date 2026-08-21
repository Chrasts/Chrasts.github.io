window.SITE_DATA = {
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
