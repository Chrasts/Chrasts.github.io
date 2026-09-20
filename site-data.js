// Profile graph model.
// parentIds encode local structural hierarchy. Typed graph.edges encode
// conceptual overlap, education, interests and evidence.

const N=(id,type,label,parent,route,status,summary,extra)=>Object.assign(
  {id,type,label,...(parent?{parentIds:[parent]}:{}),...(route?{route}:{}),...(status?{status}:{}),...(summary?{summary}:{})},
  extra||{}
);
const P=(id,order,graphLabel,title,type,description,lattice,contexts,facets,tech,note,links,extra)=>({
  id,order,graphLabel,title,type,description,lattice,contexts,facets,tech,...(note?{note}:{}),links,...(extra||{})
});

window.SITE_DATA={
  profile:{"name":"Štěpán Chrast","shortName":"ŠC","label":"Data analysis · Research · Mathematical logic","intro":"Data analyst and researcher in Prague, working with data, reproducible analysis and applied research alongside a background in mathematical logic.","email":"chraststepan@gmail.com","links":[{"label":"GitHub","href":"https://github.com/Chrasts"},{"label":"LinkedIn","href":"https://www.linkedin.com/in/stepan-chrast"}]},
  graph:{
    rootId:"stepan-chrast",
    routeAliases:{
      "education/charles-university/thesis":"work/project/bachelor-thesis",
      "education/charles-university/coursework/clp-historical-survey":"work/project/clp-survey",
      "education/charles-university/coursework":"education/charles-university/academic-work",
      "education/charles-university/coursework/amalgamation-interpolation":"education/charles-university/academic-work/amalgamation-interpolation",
      "education/charles-university/coursework/simulation-credence":"education/charles-university/academic-work/simulation-credence",
      "education/bsc-logic":"education/charles-university",
      "education/msc-logic":"education/charles-university-masters-logic",
      "knowledge/logic-math/set-theory":"knowledge/logic-math/mathematical-logic/set-theory",
      "knowledge/logic-math/number-theory":"knowledge/logic-math/mathematical-logic/number-theory",
      "knowledge/logic-math/lattice-theory/congruence-lattice-problem":"knowledge/logic-math/lattice-theory",
      "knowledge/data-computing/ai-methods/ai-research-workflows":"knowledge/research-practice/ai-research-workflows",
      "knowledge/logic-math/mathematical-logic/algebraic-logic/quantum-logic-arol":"knowledge/logic-math/mathematical-logic/algebraic-logic/quantum-logic",
      "about/research-interests/logic-ai":"about/research-interests/formal-reasoning-ai",
      "about/research-interests/algebraic-nonclassical":"about/research-interests/algebraic-semantics"
    },
    nodes:[
  N("stepan-chrast","profile","Štěpán Chrast",null,"overview",null,"Data analysis, research and mathematical logic.",null),
  N("work","section","Work","stepan-chrast","work",null,"Selected projects, explored through a concept lattice of themes and contexts.",null),
  N("knowledge","section","Knowledge","stepan-chrast","knowledge",null,"Substantive working knowledge from projects, research, sustained study and independent practice.",null),
  N("experience","section","Experience","stepan-chrast","experience",null,"Roles and practical contexts behind the work.",null),
  N("education","section","Education","stepan-chrast","education",null,"Programmes, coursework and academic foundations.",null),
  N("about","section","About","stepan-chrast","about",null,"Research interests and the wider context of the profile.",null),

  N("logic-math","knowledge","Mathematics & Logic","knowledge","knowledge/logic-math","established","Mathematical logic and the algebraic, set-theoretic and arithmetic tools used around it.",null),
  N("data-computing","knowledge","Data & Computing","knowledge","knowledge/data-computing","applied","Data analysis, programming, relational data work, automation and AI systems used in practical work.",null),
  N("research-practice","knowledge","Research Practice","knowledge","knowledge/research-practice","applied","Reproducible analytical practice, technical writing and participatory research methods used in real projects.",null),

  N("mathematical-logic","knowledge","Mathematical Logic","logic-math","knowledge/logic-math/mathematical-logic","core area","Formal languages, semantics, proof systems and metalogical reasoning.",null),
  N("first-order-logic","knowledge","First-order Logic & Metalogic","mathematical-logic","knowledge/logic-math/mathematical-logic/first-order-logic","strong foundation","Classical propositional and first-order logic, formal theories, soundness/completeness, compactness and core metalogical techniques.",null),
  N("incompleteness","knowledge","Incompleteness & Arithmetization","first-order-logic","knowledge/logic-math/mathematical-logic/first-order-logic/incompleteness","studied in depth","Arithmetization, representability and the main ideas behind Gödel-style incompleteness results.",null),
  N("model-theory","knowledge","Model Theory","mathematical-logic","knowledge/logic-math/mathematical-logic/model-theory","working foundation","Structures, elementary embeddings and equivalence, compactness, the Löwenheim-Skolem theorems, ultraproducts and Łoś-style arguments, together with standard model-theoretic constructions.",null),
  N("proof-theory","knowledge","Proof Theory","mathematical-logic","knowledge/logic-math/mathematical-logic/proof-theory","working foundation","Hilbert and Gentzen-style calculi, derivations, admissibility-style reasoning and proof-system semantics at an introductory working level.",null),
  N("modal-logic","knowledge","Modal Logic","mathematical-logic","knowledge/logic-math/mathematical-logic/modal-logic","project + study","Normal modal systems, Kripke semantics, frame correspondence and characteristic/completeness arguments.",null),
  N("dynamic-logic","knowledge","Dynamic Logic","modal-logic","knowledge/logic-math/mathematical-logic/modal-logic/dynamic-logic","coursework","Modal formalisms for programs, actions and state change, including relational semantics.",null),
  N("algebraic-logic","knowledge","Algebraic Logic","mathematical-logic","knowledge/logic-math/mathematical-logic/algebraic-logic","focus area","The algebraic study of logical systems and classes of algebras associated with them.",null),
  N("quantum-logic-arol","knowledge","Quantum Logic","algebraic-logic","knowledge/logic-math/mathematical-logic/algebraic-logic/quantum-logic","thesis focus","Quantum-logical structures and their algebraic semantics.",null),
  N("residuated-ortholattices-arol","knowledge","Residuated Ortholattices & A-ROL","quantum-logic-arol","knowledge/logic-math/mathematical-logic/algebraic-logic/quantum-logic/residuated-ortholattices-arol","thesis focus","Residuated ortholattices and associative residuated ortholattices, the specific algebraic structures studied in thesis and ongoing research.",null),
  N("computational-logic","knowledge","Computational Logic","mathematical-logic","knowledge/logic-math/mathematical-logic/computational-logic","research use","Computational support for logical reasoning through satisfiability, finite verification, automated theorem proving and model finding.",null),
  N("sat-smt","knowledge","SAT / SMT","computational-logic","knowledge/logic-math/mathematical-logic/computational-logic/sat-smt","introductory","Core SAT-solving ideas and the role of theory reasoning in SMT, with hands-on introductory exposure.",null),
  N("automated-reasoning","knowledge","Automated Reasoning & Model Finding","computational-logic","knowledge/logic-math/mathematical-logic/computational-logic/automated-reasoning","research use","Automated theorem proving and finite model finding, including Prover9/Mace4-backed experimental workflows.",null),
  N("logic-for-ai","knowledge","Logic for AI","computational-logic","knowledge/logic-math/mathematical-logic/computational-logic/logic-for-ai","introductory / interdisciplinary","Logical and argumentation-oriented methods at the interface of symbolic reasoning and contemporary AI.",null),

  N("universal-algebra","knowledge","Universal Algebra","logic-math","knowledge/logic-math/universal-algebra","research use","Algebras, homomorphisms, identities, varieties and structural methods used in algebraic logic.",null),
  N("varieties-equational","knowledge","Varieties & Equational Logic","universal-algebra","knowledge/logic-math/universal-algebra/varieties-equational","research use","Varieties, equational theories, generated varieties and inclusion/separation arguments used in thesis research.",null),
  N("semigroups-bands","knowledge","Semigroups & Bands","universal-algebra","knowledge/logic-math/universal-algebra/semigroups-bands","thesis focus","Associative idempotent semigroups and the variety theory of bands as used in the A-ROL classification work.",null),
  N("lattice-theory","knowledge","Lattice Theory","logic-math","knowledge/logic-math/lattice-theory","foundation + research use","Foundations of lattice theory: partial orders, meets and joins, distributive and complemented lattices, Boolean algebras, and classical representation and duality theorems used around algebraic logic.",null),
  N("set-theory","knowledge","Set Theory","mathematical-logic","knowledge/logic-math/mathematical-logic/set-theory","foundation","Axiomatic set-theoretic foundations, cardinal/ordinal reasoning and standard set constructions used across logic.",null),
  N("number-theory","knowledge","Number Theory & Arithmetic","mathematical-logic","knowledge/logic-math/mathematical-logic/number-theory","foundation","Elementary number theory and arithmetic algorithms, including divisibility, congruences and standard finite-number-theoretic techniques.",null),

  N("data-analysis","knowledge","Data Analysis","data-computing","knowledge/data-computing/data-analysis","applied","Cleaning, transformation, descriptive analysis and transparent reporting on real datasets.",null),
  N("statistics","knowledge","Statistical Reasoning","data-analysis","knowledge/data-computing/data-analysis/statistics","foundation + applied","Descriptive statistics, probability/statistical reasoning, hypothesis-oriented analysis and explicit treatment of uncertainty.",null),
  N("survey-analysis","knowledge","Survey Analysis","data-analysis","knowledge/data-computing/data-analysis/survey-analysis","applied","Questionnaire cleaning, nonresponse handling, descriptive outputs, vignette-oriented analysis and structured reporting.",null),
  N("data-qa","knowledge","Data Validation & QA","data-analysis","knowledge/data-computing/data-analysis/data-qa","applied","Validation checks, audit trails, consistency review and defensible data preparation.",null),
  N("visualisation","knowledge","Data Visualisation","data-analysis","knowledge/data-computing/data-analysis/visualisation","applied","Analytical graphics designed to make comparisons, distributions and results legible.",null),
  N("data-cleaning","knowledge","Data Cleaning & Transformation","data-analysis","knowledge/data-computing/data-analysis/data-cleaning","applied","Reshaping, joining, cleaning and transforming source data into analysis-ready structures.",null),
  N("qualitative-coding","knowledge","Open-text / Qualitative Coding","data-analysis","knowledge/data-computing/data-analysis/qualitative-coding","applied","Conservative, project-grounded experience with open-text coding and codebook construction for structured analysis.",null),

  N("programming-automation","knowledge","Programming & Automation","data-computing","knowledge/data-computing/programming-automation","applied","Programming, versioned workflows and automation for analysis, research and small software tools.",null),
  N("algorithms-data-structures","knowledge","Algorithms & Data Structures","programming-automation","knowledge/data-computing/programming-automation/algorithms-data-structures","foundation","Core algorithmic reasoning and standard data structures, with practical programming experience.",null),
  N("automation","knowledge","Automation & Pipelines","programming-automation","knowledge/data-computing/programming-automation/automation","used in projects","Reliable transformations from source data to reusable outputs and repeatable project workflows.",null),

  N("data-management","knowledge","Data Management","data-computing","knowledge/data-computing/data-management","applied","Relational querying, schemas and explicit data modelling.",null),
  N("data-modelling","knowledge","Relational Data Modelling","data-management","knowledge/data-computing/data-management/data-modelling","used in projects","Relational schemas, keys, normalization-oriented design and explicit modelling decisions.",null),

  N("ai-methods","knowledge","AI Systems","data-computing","knowledge/data-computing/ai-methods","independent study","Contemporary AI systems understood at a conceptual/technical working level, with particular emphasis on language models and reasoning workflows.",null),
  N("language-models","knowledge","Language Models","ai-methods","knowledge/data-computing/ai-methods/language-models","independent study","Language-model principles, capabilities, limitations, prompting/context and their interaction with formal reasoning tools.",null),
  N("ai-research-workflows","knowledge","AI-assisted Technical Workflows","research-practice","knowledge/research-practice/ai-research-workflows","used in practice","Using LLM systems in coding, analysis, formalisation support and research workflows while keeping verification and tool limits explicit.",null),

  N("reproducible-analysis","knowledge","Reproducible Analysis","research-practice","knowledge/research-practice/reproducible-analysis","used in projects","Auditable pipelines, explicit analytical decisions and reusable outputs.",null),
  N("scientific-writing","knowledge","Scientific & Technical Writing","research-practice","knowledge/research-practice/scientific-writing","used in projects","Mathematical and analytical writing that makes claims, assumptions, methods and evidence inspectable.",null),
  N("participatory-research","knowledge","Participatory Research","research-practice","knowledge/research-practice/participatory-research","used in projects","Participatory and workshop-oriented methods for eliciting perspectives, needs and possible futures.",null),

  N("ceske-priority","experience","České priority","experience","experience/ceske-priority",null,"Applied research and data analysis across survey research and participatory digital methods, with an emphasis on reproducible workflows and clear research outputs.",{"meta":"2026 - present","timelineOrder":3,"role":"Junior Researcher and Data Analyst","organisation":"Part-time","highlights":["Survey analysis and qualitative coding","Reproducible analytical workflows","Participatory digital methods"]}),
  N("escape-room","experience","EscapeTheRoom.cz","experience","experience/escape-room",null,"Customer-facing operations, incident handling and structured issue logging.",{"meta":"2019 - 2023","timelineOrder":1,"role":"Game Master","organisation":"EscapeTheRoom.cz - Part-time","highlights":["Customer-facing operations","Incident handling","Structured issue logging"]}),
  N("student-ball","experience","Student Ball","experience","experience/student-ball",null,"Two-person event project covering budgeting, sponsorship and operations.",{"meta":"2020 - 2021","timelineOrder":2,"role":"Event Co-lead","organisation":"Self-organised project - Two-person team","highlights":["Budgeting and cash-flow planning","Sponsorship","Transaction reconciliation and event operations"]}),
  N("charles-university","education","BSc in Logic","education","education/charles-university","completed","Completed Bachelor's degree in Logic at Charles University in September 2026, focused on mathematical logic, algebraic logic and related mathematics.",{"meta":"2022 - Sep 2026 · completed","layoutOrder":1,"programme":"Bachelor's degree in Logic","organisation":"Charles University","detailLabel":"Bachelor's Degree in Logic","highlights":["Mathematical and modal logic","Algebraic logic, universal algebra and lattice theory","Successfully completed degree with thesis on structures related to quantum logic"],"programmeOverview":"Mathematical logic studies formal languages, semantics and proof systems, together with the mathematical structure and limits of formal reasoning. My BSc focused especially on mathematical and non-classical logic, with a stronger concentration in algebraic logic and supporting mathematics in universal algebra and lattice theory."}),
  N("selected-coursework","education","Academic Work","charles-university","education/charles-university/academic-work",null,"Independently inspectable academic notes and papers, with completed courses retained as evidence.",{"layoutOrder":1}),
  N("metalogic-amalgamation-interpolation","education","Amalgamation & Interpolation","selected-coursework","education/charles-university/academic-work/amalgamation-interpolation",null,"A short metalogic note on the relationship between amalgamation and interpolation in equational theories.",{"meta":"Metalogic note","layoutOrder":1,"detailLabel":"Amalgamation & Interpolation in Equational Theories"}),
  N("simulation-credence-coursework","education","Simulation Credence","selected-coursework","education/charles-university/academic-work/simulation-credence",null,"A course paper formalising credence in the simulation hypothesis and examining its consequences.",{"meta":"Course paper","layoutOrder":2,"detailLabel":"Simulation Credence and Its Consequences"}),
  N("charles-university-masters-logic","education","MSc in Logic","education","education/charles-university-masters-logic","ongoing","Ongoing follow-up Master's degree in Logic at Charles University.",{"meta":"2026 - present · ongoing","layoutOrder":2,"programme":"Master's degree in Logic","organisation":"Charles University","detailLabel":"Master's Degree in Logic"}),
  N("esslli","education","ESSLLI 2026","education","education/esslli",null,"Intensive courses touching algebraic/logical methods, language models, logic for AI and SAT/SMT solving.",{"meta":"2026","layoutOrder":3,"programme":"Participant & volunteer","organisation":"ESSLLI","highlights":["Stone duality","Logic and language models","Logic for AI and SAT/SMT"]}),
  N("prg-ai","education","prg.ai Minor","education","education/prg-ai","ongoing","Inter-university AI programme combining cross-faculty coursework with industry talks and a broader AI community.",{"meta":"2026 - present","layoutOrder":4,"programme":"Inter-university AI programme","organisation":"Charles University & Czech Technical University","highlights":["Mathematical logic in AI","AI-assisted scientific workflows","AI in scientific inquiry"]}),
  N("credentials","credential","Credentials","education","education/credentials",null,"AI coursework certificates and Cambridge English B2 First.",{"layoutOrder":5,"highlights":["Ethics of AI","Introduction to Artificial Intelligence","Cambridge English B2 First - Score 170"]}),
  N("cert-cambridge-b2","credential","B2 First - Score 170","credentials","education/credentials/cambridge-b2",null,"Cambridge English B2 First certification with score 170.",{"meta":"2021","organisation":"Cambridge English"}),
  N("cert-ethics-ai","credential","Ethics of AI","credentials","education/credentials/ethics-ai",null,"University of Helsinki certificate in Ethics of AI.",{"meta":"2024","organisation":"University of Helsinki"}),
  N("cert-intro-ai","credential","Introduction to AI","credentials","education/credentials/introduction-ai",null,"University of Helsinki certificate in Introduction to Artificial Intelligence.",{"meta":"2024","organisation":"University of Helsinki","detailLabel":"Introduction to Artificial Intelligence"}),

  N("research-interests","interest","Research Interests","about","about/research-interests",null,"Current questions and directions connecting logic, AI, mathematics, science and evidence.",null),
  N("philosophy","interest","Philosophy","about","about/philosophy",null,"Philosophy of AI, mind and science.",null),
  N("games-rpg","interest","Games","about","about/games-rpg",null,"Role-playing, tabletop and digital games.",null),
  N("music","interest","Music","about","about/music",null,"Piano and music creation.",null),
  N("woodworking","interest","Woodworking / Making","about","about/woodworking",null,"Small practical woodworking projects and making physical objects.",null),
  N("hedgehog-house","interest","Hedgehog House","woodworking","about/woodworking/hedgehog-house",null,"A small wooden hedgehog house documented from construction and use.",null),
  N("entrance-terrace","interest","Entrance Terrace","woodworking","about/woodworking/entrance-terrace",null,"A small wooden entrance terrace built for a family house.",null),
  N("logic-ai-interest","interest","Formal Reasoning & AI","research-interests","about/research-interests/formal-reasoning-ai","interest","How formal reasoning, symbolic methods and statistical AI can interact.",null),
  N("ai-math-reasoning-interest","interest","AI-assisted Mathematics","research-interests","about/research-interests/ai-math-reasoning","interest","AI systems working with formal tools, proof assistants and automated reasoning in mathematics.",{"detailLabel":"AI-assisted Mathematics & Automated Reasoning"}),
  N("algebraic-nonclassical-interest","interest","Algebraic Semantics of Non-classical Logics","research-interests","about/research-interests/algebraic-semantics","interest","Algebraic, modal and quantum-logical structures beyond classical propositional logic.",null),
  N("ai-science-workflows-interest","interest","AI for Scientific Workflows","research-interests","about/research-interests/ai-science-workflows","interest","AI-supported hypothesis generation, analysis, programming and research workflows.",null),
  N("philosophy-ai","interest","Philosophy of AI","philosophy","about/philosophy/ai","interest","Conceptual questions around intelligence, agency and AI systems.",null),
  N("philosophy-mind","interest","Philosophy of Mind","philosophy","about/philosophy/mind","interest","Questions about mind, cognition and explanation.",null),
  N("philosophy-science","interest","Philosophy of Science","philosophy","about/philosophy/science","interest","How scientific knowledge, explanation and evidence work.",null),
  N("rpg-dnd","interest","RPG / D&D","games-rpg","about/games-rpg/rpg-dnd","interest","Collaborative role-playing and shared-world storytelling.",null),
  N("mtg","interest","Magic: The Gathering","games-rpg","about/games-rpg/mtg","interest","Strategy, systems and tabletop play.",null),
  N("pc-tabletop-games","interest","PC / Digital / Tabletop Games","games-rpg","about/games-rpg/pc-tabletop","interest","Digital and tabletop games as systems, play and social spaces.",null),
  N("piano","interest","Piano","music","about/music/piano","interest","Playing piano as a continuing personal practice.",null),
  N("music-creation","interest","Music Creation","music","about/music/creation","interest","Exploring composition and the process of making music.",null)
    ],
    edges:[
  {"source":"algebraic-logic","target":"universal-algebra","type":"related","secondary":true},
  {"source":"algebraic-logic","target":"lattice-theory","type":"related","secondary":true},
  {"source":"varieties-equational","target":"algebraic-logic","type":"related","secondary":true},
  {"source":"semigroups-bands","target":"varieties-equational","type":"related","secondary":true},
  {"source":"semigroups-bands","target":"residuated-ortholattices-arol","type":"related","secondary":true},
  {"source":"quantum-logic-arol","target":"lattice-theory","type":"related","secondary":true},
  {"source":"computational-logic","target":"ai-methods","type":"related","secondary":true},
  {"source":"logic-for-ai","target":"ai-methods","type":"related","secondary":true},
  {"source":"language-models","target":"logic-for-ai","type":"related","secondary":true},
  {"source":"statistics","target":"research-practice","type":"related","secondary":true},
  {"source":"survey-analysis","target":"research-practice","type":"related","secondary":true},
  {"source":"data-qa","target":"research-practice","type":"related","secondary":true},
  {"source":"reproducible-analysis","target":"data-analysis","type":"related","secondary":true},
  {"source":"mathematical-logic","target":"charles-university","type":"studied-in"},
  {"source":"first-order-logic","target":"charles-university","type":"studied-in"},
  {"source":"incompleteness","target":"charles-university","type":"studied-in"},
  {"source":"set-theory","target":"charles-university","type":"studied-in"},
  {"source":"number-theory","target":"charles-university","type":"studied-in"},
  {"source":"universal-algebra","target":"charles-university","type":"developed-in"},
  {"source":"lattice-theory","target":"charles-university","type":"developed-in"},
  {"source":"algebraic-logic","target":"charles-university","type":"developed-in"},
  {"source":"modal-logic","target":"charles-university","type":"studied-in"},
  {"source":"dynamic-logic","target":"charles-university","type":"studied-in"},
  {"source":"algebraic-logic","target":"esslli","type":"reinforced-in","secondary":true},
  {"source":"lattice-theory","target":"esslli","type":"reinforced-in","secondary":true},
  {"source":"computational-logic","target":"esslli","type":"reinforced-in","secondary":true},
  {"source":"sat-smt","target":"esslli","type":"studied-in"},
  {"source":"logic-for-ai","target":"esslli","type":"studied-in"},
  {"source":"language-models","target":"esslli","type":"reinforced-in","secondary":true},
  {"source":"ai-methods","target":"prg-ai","type":"planned-study","secondary":true},
  {"source":"cert-intro-ai","target":"ai-methods","type":"credential-link","secondary":true},
  {"source":"cert-ethics-ai","target":"philosophy-ai","type":"credential-link","secondary":true},
  {"source":"metalogic-amalgamation-interpolation","target":"varieties-equational","type":"related","secondary":true},
  {"source":"metalogic-amalgamation-interpolation","target":"algebraic-logic","type":"related","secondary":true},
  {"source":"simulation-credence-coursework","target":"philosophy-mind","type":"related","secondary":true},
  {"source":"simulation-credence-coursework","target":"philosophy-ai","type":"related","secondary":true},
  {"source":"logic-ai-interest","target":"computational-logic","type":"related","secondary":true},
  {"source":"logic-ai-interest","target":"logic-for-ai","type":"related","secondary":true},
  {"source":"ai-math-reasoning-interest","target":"automated-reasoning","type":"related","secondary":true},
  {"source":"ai-math-reasoning-interest","target":"computational-logic","type":"related","secondary":true},
  {"source":"algebraic-nonclassical-interest","target":"algebraic-logic","type":"related","secondary":true},
  {"source":"algebraic-nonclassical-interest","target":"modal-logic","type":"related","secondary":true},
  {"source":"algebraic-nonclassical-interest","target":"quantum-logic-arol","type":"related","secondary":true},
  {"source":"ai-science-workflows-interest","target":"ai-research-workflows","type":"related","secondary":true},
  {"source":"ai-science-workflows-interest","target":"research-practice","type":"related","secondary":true},
  {"source":"research-practice","target":"philosophy-science","type":"related","secondary":true}
    ]
  },
  work:{
    attributes:[{"id":"logic","label":"Logic & Mathematics"},{"id":"computing-data","label":"Data & Computing"},{"id":"research","label":"Research"},{"id":"education","label":"Education & Communication"}],
    contextFilters:[{"id":"all","label":"All"},{"id":"academic","label":"Academic"},{"id":"professional","label":"Professional"},{"id":"personal","label":"Personal"}],
    projects:[
  P("insolvency",1,"Insolvency Analysis","Insolvency Analysis","Data analysis","An end-to-end Python analysis deriving case outcomes from event histories, linking them to person-level attributes and comparing results across groups, courts and time.",["computing-data","research"],["professional"],{"orientation":["empirical","applied"],"collaboration":["individual"],"format":["analysis","report"],"status":"finished","visibility":"public"},["Python","pandas","Matplotlib","LaTeX"],null,[{"label":"Report ↗","href":"https://github.com/Chrasts/insolvency-success-analysis/blob/main/report/report.pdf"},{"label":"GitHub ↗","href":"https://github.com/Chrasts/insolvency-success-analysis"}],{"featuredRank":1,"caseStudy":{"oneLine":"Reconstructing case outcomes from event histories and turning them into a reproducible comparative analysis.","problem":"Case outcomes were not available as one clean field and had to be derived from event histories before meaningful comparison across people, courts and time.","role":"Individual end-to-end analysis, validation and reporting.","method":"Python/pandas pipeline for event-history reconstruction, joins to person-level attributes, validation checks, comparative summaries, visualisation and a LaTeX report.","result":"Public reproducible repository and report documenting the analytical workflow and results."}}),
  P("modal-logic-lab",2,"Modal Logic Lab","Modal Logic Lab","Interactive mathematical logic","An interactive environment for constructing finite Kripke models, evaluating modal formulas, solving guided challenges and experimenting with frame properties.",["logic","computing-data","education"],["academic","personal"],{"orientation":["theoretical","applied"],"collaboration":["individual"],"format":["software","educational-tool"],"status":"active","visibility":"public"},["React","TypeScript","Modal logic","Git & GitHub","Vitest"],null,[{"label":"Play ↗","href":"https://chrasts.github.io/Modal_Logic_Lab/"},{"label":"GitHub ↗","href":"https://github.com/Chrasts/Modal_Logic_Lab"}],{"featuredRank":3,"caseStudy":{"oneLine":"An interactive laboratory for building Kripke models and evaluating modal formulas.","problem":"Modal semantics is easier to learn and inspect when models, valuations and formula truth can be manipulated directly rather than only described symbolically.","role":"Independent product design and implementation.","method":"React/TypeScript application with finite Kripke structures, formula evaluation, guided challenges, frame-property experiments and automated tests.","result":"Public live application and source repository."}}),
  P("sql-schema",3,"SQL Schema","Algebraic Logic SQL Schema","Data modelling","A relational MySQL schema for logical systems, algebraic classes, axioms, properties and subclass relations.",["logic","computing-data"],["academic","personal"],{"orientation":["theoretical","applied"],"collaboration":["individual"],"format":["database"],"status":"finished","visibility":"public"},["MySQL","SQL","Relational design"],null,[{"label":"GitHub ↗","href":"https://github.com/Chrasts/algebraic_logic-SQL_database"}],{"featuredRank":5,"caseStudy":{"oneLine":"A relational model for logical systems, algebraic classes, axioms, properties and subclass relations.","problem":"A logic/algebra knowledge domain needed an explicit relational representation rather than an ad-hoc collection of records.","role":"Independent schema and relational-model design.","method":"MySQL schema design using keys, relations and explicit modelling of logical systems, algebraic classes, axioms, properties and subclass structure.","result":"Public repository plus ER and subclass-relationship diagrams exposed in the portfolio."}}),
  P("film-splitter",4,"Film Splitter","Film Scene Character Splitter","Automation","A production utility transforming a master scene list into chronologically ordered character-specific Excel workbooks.",["computing-data"],["professional"],{"orientation":["applied"],"collaboration":["individual"],"format":["software","automation"],"status":"finished","visibility":"public"},["Python","pandas","openpyxl"],null,[{"label":"GitHub ↗","href":"https://github.com/Chrasts/Filming-project-scene-Splitter"}]),
  P("clp-survey",5,"CLP Survey","The Congruence Lattice Problem - Historical Survey","Mathematical writing","A concise historical survey of the Congruence Lattice Problem, focused on the main milestones, ideas and results in lattice theory.",["logic","research","education"],["academic","personal"],{"orientation":["theoretical"],"collaboration":["individual"],"format":["paper","survey"],"status":"finished","visibility":"public"},["Lattice theory","LaTeX","Historical synthesis"],null,[{"label":"GitHub ↗","href":"https://github.com/Chrasts/The-Congruence-Lattice-Problem-A-Historical-Survey"}]),
  P("bachelor-thesis",6,"BSc Thesis","Bachelor Thesis - Quantum Logic & A-ROL","Academic research","Bachelor thesis on quantum logic and associative residuated ortholattices, with a focus on algebraic structure and related varieties.",["logic","research"],["academic"],{"orientation":["theoretical"],"collaboration":["individual"],"format":["thesis"],"status":"finished","visibility":"public"},["Algebraic logic","Universal algebra","Lattice theory","LaTeX"],"Successfully defended in 2026.",[{"label":"Thesis PDF ↗","href":"assets/documents/education/coursework/thesis.pdf"}],{"featuredRank":4,"caseStudy":{"oneLine":"Defended research thesis on quantum logic, residuated ortholattices and the associative A-ROL fragment.","problem":"The project studies algebraic structures arising around quantum logic and the behaviour of their associative fragment.","role":"Author of the defended BSc thesis.","method":"Algebraic and lattice-theoretic analysis, literature synthesis, formal proofs and structured mathematical exposition.","result":"Successfully defended in 2026; the final thesis PDF is publicly available in the portfolio."}}),
  P("social-workers-survey",7,"Survey Analysis","Survey Analysis and Open-Text Coding","Applied research · Data analysis","End-to-end survey research covering data cleaning and validation, descriptive analysis, benchmarking, vignette modelling and qualitative coding of open responses, with reproducible reports, visualisations and an interactive open-text explorer.",["computing-data","research"],["professional"],{"orientation":["empirical","applied"],"collaboration":["team"],"format":["analysis","pipeline"],"status":"active","visibility":"private"},["Python","pandas","Survey analysis","Statistics","Open-text coding","Data QA"],"Private analytical repository and internal materials.",[],{"featuredRank":2,"caseStudy":{"oneLine":"Applied survey analysis combining data QA, quantitative summaries and structured coding of open responses.","problem":"Research data required cleaning, validation, analysis and a defensible way to turn open-text responses into structured evidence.","role":"Data analysis and open-text coding within a team research context.","method":"Cleaning and validation, descriptive and vignette-oriented analysis, benchmarking, qualitative codebook construction, reproducible reporting and visualisation.","result":"Internal analytical outputs, reproducible reports and an interactive open-text exploration workflow; underlying materials remain private."}}),
  P("arol-lab",8,"A-ROL Lab","A-ROL Lab / Separating Equations for the Wₙ Family","Computational mathematical research","A reproducible experimental workflow around residuated ortholattices and the finite Wₙ family, combining finite verification, bounded equation search and ATP/model-finding support.",["logic","computing-data","research"],["academic","personal"],{"orientation":["theoretical","computational"],"collaboration":["individual"],"format":["research-software","experiments"],"status":"active","visibility":"private"},["Python","Prover9","Mace4","Automated theorem proving"],"Research repository is currently private.",[]),
  P("tachov-workshop",9,"Minecraft Foresight","Minecraft Education Participatory Foresight","Participatory foresight · Technical prototyping","Pilot participatory foresight workshop using a shared Minecraft Education world to elicit young participants' ideas, needs, barriers and proposals for local futures, covering world preparation, deployment, multiplayer infrastructure, facilitation and qualitative data capture.",["computing-data","research","education"],["professional"],{"orientation":["applied","participatory"],"collaboration":["team"],"format":["workshop","technical-prototype"],"status":"active","visibility":"private"},["Minecraft Education","Geodata","Workshop design","Server deployment","Qualitative research"],"Internal project materials are private.",[]),
  P("axiom-wilds",10,"Axiom Wilds","Axiom Wilds","Game development","A personal game project in active development, represented here by an in-development gameplay capture.",["computing-data"],["personal"],{"orientation":["applied"],"collaboration":["individual"],"format":["software","game"],"status":"active","visibility":"public"},["Game design"],"Gameplay preview available in the portfolio.",[])
    ]
  }
};

// Completed coursework is evidence for substantive knowledge nodes, never a
// parallel course-node hierarchy. The inspector presents this compact record
// only where it adds context to an independently navigable knowledge area.
const knowledgeCourseEvidence={
  "mathematical-logic":["Propositional and Predicate Logic","Properties of Axiomatic Theories","Introduction to Mathematical Logic"],
  "incompleteness":["Incompleteness and Gödel's Theorems"],
  "modal-logic":["Modal and Non-classical Logics"],
  "dynamic-logic":["Dynamic Logic"],
  "programming-automation":["Programming and Algorithms","Algorithms and Data Structures"],
  "data-management":["SQL Databases"],
  "data-modelling":["SQL Databases"],
  "statistics":["Principles of Statistical Reasoning","Probability and Statistical Problems"],
  "ai-methods":["AI in Context","Elements of AI+"],
  "scientific-writing":["Academic papers and seminar work"]
};
Object.entries(knowledgeCourseEvidence).forEach(([id,courses])=>{
  const node=window.SITE_DATA.graph.nodes.find(item=>item.id===id);
  if(node)node.courseEvidence=courses;
});

const projectGraphLinks={"insolvency":{"knowledge":["data-analysis","statistics","visualisation","reproducible-analysis","data-cleaning","data-qa"],"education":[]},"modal-logic-lab":{"knowledge":["modal-logic","mathematical-logic"],"education":["charles-university"]},"sql-schema":{"knowledge":["algebraic-logic","data-modelling"],"education":["charles-university"]},"film-splitter":{"knowledge":["automation","data-cleaning"],"education":[]},"clp-survey":{"knowledge":["lattice-theory","scientific-writing"],"education":["charles-university"]},"bachelor-thesis":{"knowledge":["algebraic-logic","quantum-logic-arol","residuated-ortholattices-arol","universal-algebra","varieties-equational","semigroups-bands","lattice-theory","scientific-writing"],"education":["charles-university"]},"social-workers-survey":{"knowledge":["statistics","survey-analysis","data-qa","reproducible-analysis","visualisation","data-cleaning","qualitative-coding"],"experience":["ceske-priority"]},"arol-lab":{"knowledge":["algebraic-logic","quantum-logic-arol","residuated-ortholattices-arol","varieties-equational","computational-logic","automated-reasoning","automation"],"education":["charles-university"]},"tachov-workshop":{"knowledge":["participatory-research","visualisation"],"experience":["ceske-priority"]},"axiom-wilds":{"about":["games-rpg"]}};
window.SITE_DATA.work.projects.forEach(project=>{
  const links=projectGraphLinks[project.id]||{},nodeId=`project-${project.id}`;
  window.SITE_DATA.graph.nodes.push({
    id:nodeId,type:"project",label:project.graphLabel,detailLabel:project.title,
    parentIds:["work"],route:`work/project/${project.id}`,status:project.facets.status,
    summary:project.description,meta:project.type
  });
  (links.knowledge||[]).forEach(target=>window.SITE_DATA.graph.edges.push({source:nodeId,target,type:"evidence"}));
  // Work projects remain canonical project entities. Experience only points
  // at them through a typed relation; it never receives a copied project node.
  (links.experience||[]).forEach(source=>window.SITE_DATA.graph.edges.push({source,target:nodeId,type:"role-project"}));
  (links.education||[]).forEach(target=>window.SITE_DATA.graph.edges.push({source:nodeId,target,type:"education-link"}));
  (links.about||[]).forEach(target=>window.SITE_DATA.graph.edges.push({source:nodeId,target,type:"interest-link",secondary:true}));
});
// The thesis is a single Work project with an explicit Education relation;
// replace the generic project-to-education edge rather than duplicating it.
window.SITE_DATA.graph.edges=window.SITE_DATA.graph.edges.filter(edge=>!(edge.source==="project-bachelor-thesis"&&edge.target==="charles-university"&&edge.type==="education-link"));
window.SITE_DATA.graph.edges.push({source:"charles-university",target:"project-bachelor-thesis",type:"thesis-of"});

// Canonical semantic inventory for the two non-taxonomic sections.  Layouts,
// inspectors and richer scenes read this record; coordinates are deliberately
// absent so the data can remain truthful across desktop and mobile geometry.
const semanticNodes=new Map(window.SITE_DATA.graph.nodes.map(node=>[node.id,node]));
const applySemanticMeta=(id,meta)=>Object.assign(semanticNodes.get(id)||{},meta);
applySemanticMeta("ceske-priority",{status:"ongoing",meta:"Jul 2026 - present",startDate:"2026-07",endDate:null,ongoing:true,prominence:3,role:"Junior Researcher and Data Analyst",organisation:"České priority",relatedWorkIds:["social-workers-survey","tachov-workshop"]});
applySemanticMeta("student-ball",{status:"completed",startDate:"2020-01",endDate:"2021-12",ongoing:false,prominence:1,role:"Event co-lead",organisation:"Student Ball",relatedWorkIds:[]});
applySemanticMeta("escape-room",{status:"completed",startDate:"2019-01",endDate:"2023-12",ongoing:false,prominence:1,role:"Game Master",organisation:"EscapeTheRoom.cz",relatedWorkIds:[]});
applySemanticMeta("charles-university",{startDate:"2022-09",endDate:"2026-09",ongoing:false,prominence:3,degreeType:"BSc",thesisProjectId:"bachelor-thesis"});
applySemanticMeta("charles-university-masters-logic",{startDate:"2026-09",endDate:null,ongoing:true,prominence:3,degreeType:"MSc"});
applySemanticMeta("esslli",{status:"completed",meta:"2026 · completed",startDate:"2026-07",endDate:"2026-08",ongoing:false,prominence:2,programmeRelation:"parallel-programme"});
applySemanticMeta("prg-ai",{startDate:"2026-09",endDate:null,ongoing:true,prominence:3,programmeRelation:"parallel-programme"});
applySemanticMeta("credentials",{prominence:1,programmeRelation:"documentary"});
applySemanticMeta("cert-cambridge-b2",{awardDate:"2021",datePrecision:"year",prominence:1});
applySemanticMeta("cert-ethics-ai",{awardDate:"2024",datePrecision:"year",prominence:1});
applySemanticMeta("cert-intro-ai",{awardDate:"2024",datePrecision:"year",prominence:1});

window.SITE_DATA.semantics={
  experience:{
    entityIds:["escape-room","student-ball","ceske-priority"],
    relationTypes:["role-project","professional-evidence","developed-through"],
    timeline:{careerFocusStart:"2026-07",earlierStart:"2019-01",earlierEnd:"2023-12",present:"2026-10"}
  },
  education:{
    programmeIds:["charles-university","charles-university-masters-logic","esslli","prg-ai","credentials"],
    courseEvidence:[
      {id:"bsc-logic-core",title:"Logic & metalogic",programmeId:"charles-university",status:"completed",description:"Formal languages, semantics, proof systems and metalogical properties, from first-order logic through modal, dynamic and incompleteness-related topics.",courses:["Propositional and Predicate Logic I","Propositional and Predicate Logic II","Introduction to Mathematical Logic","Properties of Axiomatic Theories","Modal and Non-classical Logics","Dynamic Logic","Incompleteness and Gödel's Theorems","Logic in Contexts and Applications","Methods in Philosophical Logic","Readings on Material Inference","Seminar: Trends in Metalogic","Conditionals: Logic, Probability, and New Perspectives","History of Logic","History of Modern Mathematics and Logic","Foundations of Modern Mathematics","Logic and Complexity"],supportsKnowledgeIds:["mathematical-logic","first-order-logic","model-theory","modal-logic","dynamic-logic","incompleteness"]},
      {id:"bsc-mathematics",title:"Mathematics & algebra",programmeId:"charles-university",status:"completed",description:"Mathematical foundations supporting logic, especially set theory, number theory, algebraic structures and lattice-theoretic methods.",courses:["Seminar in Mathematics","Introduction to Mathematics","Set Theory I","Arithmetic and Algorithms","Algebra and Structures in Logic","Selected Topics in Mathematics","Number Theory Seminar","Model Theory","Lattice Theory","Quantum Physics"],supportsKnowledgeIds:["set-theory","number-theory","universal-algebra","lattice-theory"]},
      {id:"bsc-computing-data",title:"Computing & data",programmeId:"charles-university",status:"completed",description:"Programming, algorithms, relational databases and introductory quantitative and statistical methods used alongside the logic curriculum.",courses:["Algorithms and Data Structures","Programming and Algorithms","SQL Databases","Introduction to Quantitative Methods in Social Sciences","Principles of Statistical Reasoning","Probability and Statistical Problems"],supportsKnowledgeIds:["programming-automation","algorithms-data-structures","data-management","statistics"]},
      {id:"bsc-ai-philosophy",title:"AI & philosophy",programmeId:"charles-university",status:"completed",description:"Conceptual work around AI, cognition, logic and mathematics, combined with introductory AI coursework and analytic philosophy.",courses:["AI in Context","Elements of AI+","Ethics of AI+","AI and Philosophy","Can Machines Think?","AI and Cognition","Philosophical Aspects of Logic and Mathematics","Analytic Philosophy I","Analytic Philosophy II","What Cannot Be Spoken About"],supportsKnowledgeIds:["ai-methods","philosophy-ai"]}
    ],
    prgAiBlocks:[
      {id:"foundation",label:"Foundation",status:"current"},
      {id:"methods",label:"Methods",status:"planned"},
      {id:"applied-ai",label:"Applied AI",status:"planned"},
      {id:"capstone",label:"Capstone",status:"planned"}
    ]
  }
};
