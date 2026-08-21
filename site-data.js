// Profile graph model.
// parentIds encode local structural hierarchy. Typed graph.edges encode
// conceptual overlap, education, interests and evidence.

const N=(id,type,label,parent,route,status,summary,extra)=>Object.assign(
  {id,type,label,...(parent?{parentIds:[parent]}:{}),...(route?{route}:{}),...(status?{status}:{}),...(summary?{summary}:{})},
  extra||{}
);
const P=(id,order,graphLabel,title,type,description,lattice,contexts,facets,tech,note,links)=>({
  id,order,graphLabel,title,type,description,lattice,contexts,facets,tech,...(note?{note}:{}),links
});

window.SITE_DATA={
  profile:{"name":"Štěpán Chrast","shortName":"ŠC","label":"Data analysis · Research · Mathematical logic","intro":"Junior data analyst and researcher in Prague, working with data, reproducible analysis and applied research alongside a background in mathematical logic.","email":"chraststepan@gmail.com","links":[{"label":"GitHub","href":"https://github.com/Chrasts"},{"label":"LinkedIn","href":"https://www.linkedin.com/in/stepan-chrast"}]},
  graph:{
    rootId:"stepan-chrast",
    nodes:[
  N("stepan-chrast","profile","Štěpán Chrast",null,"overview",null,"Data analysis, research and mathematical logic.",null),
  N("work","section","Work","stepan-chrast","work",null,"Selected projects, explored through a concept lattice of themes and contexts.",null),
  N("knowledge","section","Knowledge","stepan-chrast","knowledge",null,"Methods, tools and theoretical areas connected to projects and study.",null),
  N("experience","section","Experience","stepan-chrast","experience",null,"Roles and practical contexts behind the work.",null),
  N("education","section","Education","stepan-chrast","education",null,"Programmes, coursework and academic foundations.",null),
  N("about","section","About","stepan-chrast","about",null,"Research interests and the wider context of the profile.",null),
  N("logic-math","knowledge","Mathematics & Logic","knowledge","knowledge/logic-math","studied","Formal methods, logical systems and the algebraic structures used to study them.",null),
  N("data-computing","knowledge","Data & Computing","knowledge","knowledge/data-computing","used in projects","Data analysis, programming, modelling, automation and computational methods.",null),
  N("research-practice","knowledge","Research Practice","knowledge","knowledge/research-practice","used in projects","Reproducible analytical practice, evidence work and research communication.",null),
  N("mathematical-logic","knowledge","Mathematical Logic","logic-math","knowledge/logic-math/mathematical-logic","studied","Logical systems, semantics, proof and formal properties.",null),
  N("universal-algebra","knowledge","Universal Algebra","logic-math","knowledge/logic-math/universal-algebra","studied","Algebraic structures, varieties and general algebraic methods.",null),
  N("lattice-theory","knowledge","Lattice Theory","logic-math","knowledge/logic-math/lattice-theory","studied","Order-theoretic and algebraic structures used throughout algebraic logic.",null),
  N("algebraic-logic","knowledge","Algebraic Logic","mathematical-logic","knowledge/logic-math/mathematical-logic/algebraic-logic","focus area","The algebraic study of logical systems and their associated classes of algebras.",null),
  N("quantum-logic-arol","knowledge","Quantum Logic & A-ROL","algebraic-logic","knowledge/logic-math/mathematical-logic/algebraic-logic/quantum-logic-arol","research / thesis","Quantum-logical algebraic structures, including associative residuated ortholattices.",null),
  N("modal-logic","knowledge","Modal Logic","mathematical-logic","knowledge/logic-math/mathematical-logic/modal-logic","used in projects","Modal systems, Kripke semantics and frame properties.",null),
  N("dynamic-logic","knowledge","Dynamic Logic","modal-logic","knowledge/logic-math/mathematical-logic/modal-logic/dynamic-logic","studied","Modal formalisms for reasoning about programs, actions and state change.",null),
  N("model-theory","knowledge","Model Theory","mathematical-logic","knowledge/logic-math/mathematical-logic/model-theory","foundations / coursework","Foundational familiarity with structures, interpretations and model-theoretic reasoning.",null),
  N("proof-theory","knowledge","Proof Theory","mathematical-logic","knowledge/logic-math/mathematical-logic/proof-theory","foundations / coursework","Foundational familiarity with formal calculi, derivations and proof-theoretic methods.",null),
  N("set-theory","knowledge","Set Theory","mathematical-logic","knowledge/logic-math/mathematical-logic/set-theory","foundations / coursework","Foundational set-theoretic concepts used across logic and mathematics.",null),
  N("computability-theory","knowledge","Computability Theory","mathematical-logic","knowledge/logic-math/mathematical-logic/computability-theory","foundations / coursework","Foundational familiarity with computability, decidability and formal models of computation.",null),
  N("computational-logic","knowledge","Computational Logic","mathematical-logic","knowledge/logic-math/mathematical-logic/computational-logic","current focus","Logic supported by satisfiability solving, finite verification, model finding and automated reasoning.",null),
  N("sat-smt","knowledge","SAT / SMT Solving","computational-logic","knowledge/logic-math/mathematical-logic/computational-logic/sat-smt","studied","Propositional and theory-aware satisfiability solving, including core SAT/SMT techniques.",null),
  N("automated-reasoning","knowledge","ATP & Model Finding","computational-logic","knowledge/logic-math/mathematical-logic/computational-logic/automated-reasoning","used in projects","Automated theorem proving and finite model finding, including Prover9 and Mace4 workflows.",null),
  N("proof-assistants","knowledge","Proof Assistants","computational-logic","knowledge/logic-math/mathematical-logic/computational-logic/proof-assistants","current learning","Interactive theorem proving and formalization workflows, including Lean and Isabelle.",{"detailLabel":"Proof Assistants & Formalization"}),
  N("logic-for-ai","knowledge","Logic for AI","computational-logic","knowledge/logic-math/mathematical-logic/computational-logic/logic-for-ai","studied","Logical methods relevant to automated reasoning and AI systems.",null),
  N("congruence-lattice-problem","knowledge","Congruence Lattice Problem","lattice-theory","knowledge/logic-math/lattice-theory/congruence-lattice-problem","studied / surveyed","The representation problem for congruence lattices and its historical development.",null),
  N("data-analysis","knowledge","Data Analysis","data-computing","knowledge/data-computing/data-analysis","used in projects","Cleaning, transformation, descriptive analysis and transparent reporting.",null),
  N("programming-automation","knowledge","Programming & Automation","data-computing","knowledge/data-computing/programming-automation","used in projects","Programming and reliable automation of analytical and operational tasks.",null),
  N("data-management","knowledge","Data Management","data-computing","knowledge/data-computing/data-management","used in projects","Relational querying, schemas and explicit data modelling.",null),
  N("ai-methods","knowledge","AI & Computational Methods","data-computing","knowledge/data-computing/ai-methods","current learning","AI-oriented computational methods connected to programming, logic and research.",null),
  N("git","knowledge","Git & GitHub","data-computing","knowledge/data-computing/git","used in projects","Versioned, reviewable and shareable project workflows.",null),
  N("statistics","knowledge","Statistics","data-analysis","knowledge/data-computing/data-analysis/statistics","used in projects","Descriptive analysis, hypotheses and transparent treatment of uncertainty.",null),
  N("survey-analysis","knowledge","Survey Analysis","data-analysis","knowledge/data-computing/data-analysis/survey-analysis","used in projects","Questionnaire-data cleaning, nonresponse handling, descriptive outputs and structured analysis.",null),
  N("data-qa","knowledge","Data Validation & QA","data-analysis","knowledge/data-computing/data-analysis/data-qa","used in projects","Quality review, validation checks and defensible data preparation.",null),
  N("visualisation","knowledge","Visualisation","data-analysis","knowledge/data-computing/data-analysis/visualisation","used in projects","Clear analytical graphics and communicable reporting.",null),
  N("data-cleaning","knowledge","Data Cleaning & Transformation","data-analysis","knowledge/data-computing/data-analysis/data-cleaning","used in projects","Reshaping, joining, cleaning and transforming data into analysis-ready structures.",null),
  N("python","knowledge","Python","programming-automation","knowledge/data-computing/programming-automation/python","used in projects","Used for analysis, automation and reproducible research workflows.",null),
  N("automation","knowledge","Automation & Pipelines","programming-automation","knowledge/data-computing/programming-automation/automation","used in projects","Reliable transformations from source data to reusable outputs.",null),
  N("sql","knowledge","SQL","data-management","knowledge/data-computing/data-management/sql","used in projects","Relational querying and practical work with structured data.",null),
  N("data-modelling","knowledge","Data Modelling","data-management","knowledge/data-computing/data-management/data-modelling","used in projects","Relational structures, schemas and explicit modelling decisions.",null),
  N("language-models","knowledge","Language Models","ai-methods","knowledge/data-computing/ai-methods/language-models","current learning","Language-model principles, capabilities, limitations and their relation to formal reasoning.",null),
  N("ai-research-workflows","knowledge","AI-assisted Research Workflows","ai-methods","knowledge/data-computing/ai-methods/ai-research-workflows","current focus","Using AI systems within literature, analysis, programming, modelling and scientific workflows.",null),
  N("reproducible-analysis","knowledge","Reproducible Analysis","research-practice","knowledge/research-practice/reproducible-analysis","used in projects","Auditable pipelines, explicit analytical decisions and reusable outputs.",null),
  N("literature-review","knowledge","Literature Review","research-practice","knowledge/research-practice/literature-review","used in projects","Structured reading, source assessment, historical synthesis and evidence-oriented writing.",null),
  N("hypothesis-formulation","knowledge","Hypothesis Formulation","research-practice","knowledge/research-practice/hypothesis-formulation","used in projects","Making analytical questions, hypotheses and assumptions explicit.",null),
  N("scientific-writing","knowledge","Scientific Writing","research-practice","knowledge/research-practice/scientific-writing","used in projects","Concise, evidenced and reproducible technical communication.",null),
  N("participatory-research","knowledge","Participatory Research","research-practice","knowledge/research-practice/participatory-research","used in projects","Participatory methods and workshop-oriented research for eliciting perspectives and possible futures.",null),
  N("ceske-priority","experience","České priority","experience","experience/ceske-priority",null,"Data analysis and research support for evidence-informed public-interest projects.",{"meta":"2026 — present","timelineOrder":3,"role":"Data Analysis & Research Intern","organisation":"Part-time","highlights":["Questionnaire data processing","Quality review","Research support"]}),
  N("escape-room","experience","EscapeTheRoom.cz","experience","experience/escape-room",null,"Customer-facing operations, incident handling and structured issue logging.",{"meta":"2019 — 2023","timelineOrder":1,"role":"Game Master","organisation":"EscapeTheRoom.cz - Part-time","highlights":["Customer-facing operations","Incident handling","Structured issue logging"]}),
  N("student-ball","experience","Student Ball","experience","experience/student-ball",null,"Two-person event project covering budgeting, sponsorship and operations.",{"meta":"2020 — 2021","timelineOrder":2,"role":"Event Co-lead","organisation":"Self-organised project - Two-person team","highlights":["Budgeting and cash-flow planning","Sponsorship","Transaction reconciliation and event operations"]}),
  N("charles-university","education","Charles University — Logic","education","education/charles-university",null,"Bachelor’s programme focused on algebraic logic, universal algebra and lattice theory.",{"meta":"2022 — 2026","programme":"Bachelor's programme in Logic","organisation":"Charles University","highlights":["Algebraic logic","Universal algebra and lattice theory","Thesis on structures related to quantum logic"]}),
  N("esslli","education","ESSLLI 2026","education","education/esslli",null,"Coursework in logic for AI, SAT/SMT solving, language models and algebraic methods.",{"meta":"2026","programme":"Participant & volunteer","organisation":"ESSLLI","highlights":["Logic for AI","SAT/SMT and higher-order logic","Language models and algebraic methods"]}),
  N("prg-ai","education","prg.ai Minor","education","education/prg-ai",null,"Inter-university AI programme across Charles University and Czech Technical University.",{"meta":"2026/27","programme":"Inter-university AI minor","organisation":"Charles University & Czech Technical University","highlights":["AI coursework across institutions","Programming, data analysis and AI methods"]}),
  N("credentials","credential","Certifications","education","education/credentials",null,"AI coursework certificates and Cambridge English B2 First.",{"highlights":["Ethics of AI","Introduction to Artificial Intelligence","Cambridge English B2 First — Score 170"]}),
  N("cert-cambridge-b2","credential","B2 First — Score 170","credentials","education/credentials/cambridge-b2",null,"Cambridge English B2 First certification with score 170.",{"meta":"2021","organisation":"Cambridge English"}),
  N("cert-ethics-ai","credential","Ethics of AI","credentials","education/credentials/ethics-ai",null,"University of Helsinki certificate in Ethics of AI.",{"meta":"2024","organisation":"University of Helsinki"}),
  N("cert-intro-ai","credential","Introduction to AI","credentials","education/credentials/introduction-ai",null,"University of Helsinki certificate in Introduction to Artificial Intelligence.",{"meta":"2024","organisation":"University of Helsinki","detailLabel":"Introduction to Artificial Intelligence"}),
  N("research-interests","interest","Research Interests","about","about/research-interests",null,"Current questions and directions connecting logic, AI, mathematics, science and evidence.",null),
  N("philosophy","interest","Philosophy","about","about/philosophy",null,"Philosophy of AI, mind, science and analytic philosophy.",null),
  N("games-rpg","interest","Games","about","about/games-rpg",null,"Role-playing, tabletop and digital games.",null),
  N("music","interest","Music","about","about/music",null,"Piano and music creation.",null),
  N("logic-ai-interest","interest","Logic & AI","research-interests","about/research-interests/logic-ai","interest","How formal reasoning, symbolic methods and statistical AI can interact.",null),
  N("ai-math-reasoning-interest","interest","AI-assisted Mathematics","research-interests","about/research-interests/ai-math-reasoning","interest","AI systems working with formal tools, proof assistants and automated reasoning in mathematics.",{"detailLabel":"AI-assisted Mathematics & Automated Reasoning"}),
  N("algebraic-nonclassical-interest","interest","Algebraic & Non-classical Logic","research-interests","about/research-interests/algebraic-nonclassical","interest","Algebraic, modal and quantum-logical structures beyond classical propositional logic.",null),
  N("ai-science-workflows-interest","interest","AI for Scientific Workflows","research-interests","about/research-interests/ai-science-workflows","interest","AI-supported literature, hypothesis, analysis, programming and research workflows.",null),
  N("science-evidence","interest","Science & Evidence","research-interests","about/research-interests/science-evidence","interest","How scientific claims are assessed, communicated and made reliable.",null),
  N("philosophy-ai","interest","Philosophy of AI","philosophy","about/philosophy/ai","interest","Conceptual questions around intelligence, agency and AI systems.",null),
  N("philosophy-mind","interest","Philosophy of Mind","philosophy","about/philosophy/mind","interest","Questions about mind, cognition and explanation.",null),
  N("philosophy-science","interest","Philosophy of Science","philosophy","about/philosophy/science","interest","How scientific knowledge, explanation and evidence work.",null),
  N("analytical-philosophy","interest","Analytic Philosophy","philosophy","about/philosophy/analytic","interest","Conceptual clarity, argument analysis and formal precision in philosophy.",null),
  N("rpg-dnd","interest","RPG / D&D","games-rpg","about/games-rpg/rpg-dnd","interest","Collaborative role-playing and shared-world storytelling.",null),
  N("mtg","interest","Magic: The Gathering","games-rpg","about/games-rpg/mtg","interest","Strategy, systems and tabletop play.",null),
  N("pc-tabletop-games","interest","PC & Tabletop Games","games-rpg","about/games-rpg/pc-tabletop","interest","Digital and tabletop games as systems, play and social spaces.",null),
  N("piano","interest","Piano","music","about/music/piano","interest","Playing piano as a continuing personal practice.",null),
  N("music-creation","interest","Music Creation","music","about/music/creation","interest","Exploring composition and the process of making music.",null)
    ],
    edges:[
  {"source":"algebraic-logic","target":"universal-algebra","type":"related","secondary":true},
  {"source":"quantum-logic-arol","target":"lattice-theory","type":"related","secondary":true},
  {"source":"congruence-lattice-problem","target":"universal-algebra","type":"related","secondary":true},
  {"source":"computational-logic","target":"ai-methods","type":"related","secondary":true},
  {"source":"logic-for-ai","target":"ai-methods","type":"related","secondary":true},
  {"source":"proof-assistants","target":"ai-methods","type":"related","secondary":true},
  {"source":"statistics","target":"research-practice","type":"related","secondary":true},
  {"source":"survey-analysis","target":"research-practice","type":"related","secondary":true},
  {"source":"data-qa","target":"research-practice","type":"related","secondary":true},
  {"source":"reproducible-analysis","target":"data-analysis","type":"related","secondary":true},
  {"source":"mathematical-logic","target":"charles-university","type":"studied-in"},
  {"source":"universal-algebra","target":"charles-university","type":"studied-in"},
  {"source":"lattice-theory","target":"charles-university","type":"studied-in"},
  {"source":"algebraic-logic","target":"charles-university","type":"studied-in"},
  {"source":"modal-logic","target":"charles-university","type":"studied-in"},
  {"source":"modal-logic","target":"esslli","type":"studied-in"},
  {"source":"computational-logic","target":"esslli","type":"studied-in"},
  {"source":"sat-smt","target":"esslli","type":"studied-in"},
  {"source":"logic-for-ai","target":"esslli","type":"studied-in"},
  {"source":"language-models","target":"esslli","type":"studied-in"},
  {"source":"ai-methods","target":"prg-ai","type":"planned-study","secondary":true},
  {"source":"cert-intro-ai","target":"ai-methods","type":"credential-link","secondary":true},
  {"source":"cert-ethics-ai","target":"philosophy-ai","type":"credential-link","secondary":true},
  {"source":"logic-ai-interest","target":"computational-logic","type":"related","secondary":true},
  {"source":"logic-ai-interest","target":"logic-for-ai","type":"related","secondary":true},
  {"source":"ai-math-reasoning-interest","target":"automated-reasoning","type":"related","secondary":true},
  {"source":"ai-math-reasoning-interest","target":"proof-assistants","type":"related","secondary":true},
  {"source":"algebraic-nonclassical-interest","target":"algebraic-logic","type":"related","secondary":true},
  {"source":"algebraic-nonclassical-interest","target":"modal-logic","type":"related","secondary":true},
  {"source":"algebraic-nonclassical-interest","target":"quantum-logic-arol","type":"related","secondary":true},
  {"source":"ai-science-workflows-interest","target":"ai-research-workflows","type":"related","secondary":true},
  {"source":"ai-science-workflows-interest","target":"research-practice","type":"related","secondary":true},
  {"source":"science-evidence","target":"research-practice","type":"related","secondary":true},
  {"source":"science-evidence","target":"philosophy-science","type":"related","secondary":true}
    ]
  },
  work:{
    attributes:[{"id":"logic","label":"Logic & Mathematics"},{"id":"computing-data","label":"Data & Computing"},{"id":"research","label":"Research"},{"id":"education","label":"Education & Communication"}],
    contextFilters:[{"id":"all","label":"All"},{"id":"academic","label":"Academic"},{"id":"professional","label":"Professional"},{"id":"personal","label":"Personal"}],
    projects:[
  P("insolvency",1,"Insolvency Analysis","Insolvency Analysis","Data analysis","An end-to-end Python analysis deriving case outcomes from event histories, linking them to person-level attributes and comparing results across groups, courts and time.",["computing-data","research"],["personal"],{"orientation":["empirical","applied"],"collaboration":["individual"],"format":["analysis","report"],"status":"finished","visibility":"public"},["Python","pandas","Matplotlib","LaTeX"],null,[{"label":"Report ↗","href":"https://github.com/Chrasts/insolvency-success-analysis/blob/main/report/report.pdf"},{"label":"GitHub ↗","href":"https://github.com/Chrasts/insolvency-success-analysis"}]),
  P("modal-logic-lab",2,"Modal Logic Lab","Modal Logic Lab","Interactive mathematical logic","An interactive environment for constructing finite Kripke models, evaluating modal formulas, solving guided challenges and experimenting with frame properties.",["logic","computing-data","education"],["academic","personal"],{"orientation":["theoretical","applied"],"collaboration":["individual"],"format":["software","educational-tool"],"status":"active","visibility":"public"},["React","TypeScript","Modal logic","Vitest"],null,[{"label":"Play ↗","href":"https://chrasts.github.io/Modal_Logic_Educational_Game/"},{"label":"GitHub ↗","href":"https://github.com/Chrasts/Modal_Logic_Educational_Game"}]),
  P("sql-schema",3,"SQL Schema","Algebraic Logic SQL Schema","Data modelling","A relational MySQL schema for logical systems, algebraic classes, axioms, properties and subclass relations.",["logic","computing-data"],["academic","personal"],{"orientation":["theoretical","applied"],"collaboration":["individual"],"format":["database"],"status":"finished","visibility":"public"},["MySQL","SQL","Relational design"],null,[{"label":"GitHub ↗","href":"https://github.com/Chrasts/algebraic_logic-SQL_database"}]),
  P("film-splitter",4,"Film Splitter","Film Scene Character Splitter","Automation","A production utility transforming a master scene list into chronologically ordered character-specific Excel workbooks.",["computing-data"],["professional"],{"orientation":["applied"],"collaboration":["individual"],"format":["software","automation"],"status":"finished","visibility":"public"},["Python","pandas","openpyxl"],null,[{"label":"GitHub ↗","href":"https://github.com/Chrasts/Filming-project-scene-Splitter"}]),
  P("clp-survey",5,"CLP Survey","The Congruence Lattice Problem - Historical Survey","Mathematical writing","A concise historical survey of the Congruence Lattice Problem, focused on the main milestones, ideas and results in lattice theory.",["logic","research","education"],["academic","personal"],{"orientation":["theoretical"],"collaboration":["individual"],"format":["paper","survey"],"status":"finished","visibility":"public"},["Lattice theory","LaTeX","Literature review"],null,[{"label":"GitHub ↗","href":"https://github.com/Chrasts/The-Congruence-Lattice-Problem-A-Historical-Survey"}]),
  P("bachelor-thesis",6,"BSc Thesis","Bachelor Thesis - Quantum Logic & A-ROL","Academic research","Bachelor thesis on quantum logic and associative residuated ortholattices, with a focus on algebraic structure and related varieties.",["logic","research"],["academic"],{"orientation":["theoretical"],"collaboration":["individual"],"format":["thesis"],"status":"in-preparation","visibility":"private"},["Algebraic logic","Universal algebra","Lattice theory","LaTeX"],"Portfolio version / thesis materials in preparation.",[]),
  P("social-workers-survey",7,"Survey Analysis","Social Workers Survey Analysis","Applied research · Data analysis","A reproducible survey-analysis pipeline covering cleaning and audit, descriptive outputs, vignette analysis, explicit nonresponse, benchmarking and a registry for formalised statistical hypotheses.",["computing-data","research"],["professional"],{"orientation":["empirical","applied"],"collaboration":["team"],"format":["analysis","pipeline"],"status":"active","visibility":"private"},["Python","pandas","Survey analysis","Statistics","Data QA"],"Project repository is currently private.",[]),
  P("arol-lab",8,"Wₙ Separators","A-ROL Lab / Separating Equations for the Wₙ Family","Computational mathematical research","A reproducible experimental workflow around residuated ortholattices and the finite Wₙ family, combining finite verification, bounded equation search and ATP/model-finding support.",["logic","computing-data","research"],["academic","personal"],{"orientation":["theoretical","computational"],"collaboration":["individual"],"format":["research-software","experiments"],"status":"active","visibility":"private"},["Python","Prover9","Mace4","Automated theorem proving"],"Research repository is currently private.",[]),
  P("tachov-workshop",9,"Tachov Workshop","Minecraft Participatory Workshop - Tachov","Participatory research · Technical prototyping","A Minecraft-based participatory and foresight workshop concept using an approximate 3D model of Tachov to help young participants discuss places, needs and possible futures for the city.",["computing-data","research","education"],["professional"],{"orientation":["applied","participatory"],"collaboration":["team"],"format":["workshop","technical-prototype"],"status":"active","visibility":"private"},["Minecraft Education","Geodata","Workshop design","Technical research"],"Internal project materials are currently private.",[])
    ]
  }
};

const projectGraphLinks={"insolvency":{"knowledge":["python","data-analysis","statistics","visualisation","reproducible-analysis","data-cleaning","data-qa"],"education":[]},"modal-logic-lab":{"knowledge":["modal-logic","mathematical-logic","git"],"education":["charles-university"]},"sql-schema":{"knowledge":["sql","algebraic-logic","data-modelling"],"education":["charles-university"]},"film-splitter":{"knowledge":["python","automation","data-cleaning"],"education":[]},"clp-survey":{"knowledge":["lattice-theory","congruence-lattice-problem","literature-review","scientific-writing"],"education":["charles-university"]},"bachelor-thesis":{"knowledge":["algebraic-logic","quantum-logic-arol","universal-algebra","lattice-theory","scientific-writing"],"education":["charles-university"]},"social-workers-survey":{"knowledge":["python","statistics","survey-analysis","data-qa","reproducible-analysis","hypothesis-formulation","visualisation","data-cleaning"],"experience":["ceske-priority"]},"arol-lab":{"knowledge":["algebraic-logic","quantum-logic-arol","computational-logic","automated-reasoning","python","automation"],"education":["charles-university"]},"tachov-workshop":{"knowledge":["participatory-research","visualisation"],"experience":["ceske-priority"]}};
window.SITE_DATA.work.projects.forEach(project=>{
  const links=projectGraphLinks[project.id]||{},nodeId=`project-${project.id}`;
  window.SITE_DATA.graph.nodes.push({
    id:nodeId,type:"project",label:project.graphLabel,detailLabel:project.title,
    parentIds:["work"],route:`work/project/${project.id}`,status:project.facets.status,
    summary:project.description,meta:project.type
  });
  (links.knowledge||[]).forEach(target=>window.SITE_DATA.graph.edges.push({source:nodeId,target,type:"evidence"}));
  (links.experience||[]).forEach(target=>window.SITE_DATA.graph.edges.push({source:nodeId,target,type:"experience-link"}));
  (links.education||[]).forEach(target=>window.SITE_DATA.graph.edges.push({source:nodeId,target,type:"education-link"}));
});

const workThemeGraphNodes=window.SITE_DATA.work.attributes.map(attribute=>({
  id:`work-theme-${attribute.id}`,type:"work-theme",label:attribute.label,parentIds:["work"],
  route:`work/theme/${attribute.id}`,summary:"A Work theme used by the concept-lattice view."
}));
window.SITE_DATA.graph.nodes.push(...workThemeGraphNodes);

const finalGraphNodeById=new Map(window.SITE_DATA.graph.nodes.map(node=>[node.id,node]));
window.SITE_DATA.work.projects.forEach(project=>{
  const projectNode=finalGraphNodeById.get(`project-${project.id}`);
  if(!projectNode)return;
  project.lattice.forEach(themeId=>{
    const themeNodeId=`work-theme-${themeId}`;
    if(!projectNode.parentIds.includes(themeNodeId))projectNode.parentIds.push(themeNodeId);
  });
});