# Portfolio graph semantic inventory

This is the pre-migration inventory required by `portfolio_graph_node_restructuring_prompt.txt`. It records the canonical decision for every current graph node before the data model is changed. `parent` is the current primary parent; secondary Work lattice parents are noted separately.

## Canonical decisions

| id | current label | current parent | action | new label | new parent | notes |
| --- | --- | --- | --- | --- | --- | --- |
| stepan-chrast | Štěpán Chrast | - | KEEP | Štěpán Chrast | - | Profile root. |
| work | Work | Štěpán Chrast | KEEP | Work | Štěpán Chrast | Work remains a top-level branch. |
| knowledge | Knowledge | Štěpán Chrast | KEEP | Knowledge | Štěpán Chrast | Knowledge remains a top-level branch. |
| experience | Experience | Štěpán Chrast | KEEP | Experience | Štěpán Chrast | Experience remains a top-level branch. |
| education | Education | Štěpán Chrast | KEEP | Education | Štěpán Chrast | Education remains a top-level branch. |
| about | About | Štěpán Chrast | KEEP | About | Štěpán Chrast | About remains a top-level branch. |
| logic-math | Mathematics & Logic | Knowledge | KEEP | Mathematics & Logic | Knowledge | Domain group. |
| data-computing | Data & Computing | Knowledge | KEEP | Data & Computing | Knowledge | Domain group. |
| research-practice | Research Practice | Knowledge | KEEP | Research Practice | Knowledge | Domain group. |
| mathematical-logic | Mathematical Logic | Mathematics & Logic | KEEP | Mathematical Logic | Mathematics & Logic | Set theory and arithmetic move beneath it. |
| first-order-logic | First-order Logic & Metalogic | Mathematical Logic | KEEP | First-order Logic & Metalogic | Mathematical Logic | - |
| incompleteness | Incompleteness & Arithmetization | First-order Logic & Metalogic | KEEP | Incompleteness & Arithmetization | First-order Logic & Metalogic | Coursework becomes evidence. |
| model-theory | Model Theory | Mathematical Logic | KEEP | Model Theory | Mathematical Logic | - |
| proof-theory | Proof Theory & Formal Calculi | Mathematical Logic | RENAME | Proof Theory | Mathematical Logic | Use target wording. |
| modal-logic | Modal Logic | Mathematical Logic | KEEP | Modal Logic | Mathematical Logic | - |
| dynamic-logic | Dynamic Logic | Modal Logic | KEEP | Dynamic Logic | Modal Logic | - |
| algebraic-logic | Algebraic Logic | Mathematical Logic | KEEP | Algebraic Logic | Mathematical Logic | - |
| quantum-logic-arol | Quantum Logic & A-ROL | Algebraic Logic | SPLIT | Quantum Logic | Algebraic Logic | Keep id for controlled legacy compatibility; create A-ROL specialization below it. |
| residuated-ortholattices-arol | - | - | ADD | Residuated Ortholattices & A-ROL | Quantum Logic | Specific thesis/research specialization. |
| computational-logic | Computational Logic | Mathematical Logic | KEEP | Computational Logic | Mathematical Logic | - |
| sat-smt | SAT / SMT Solving | Computational Logic | RENAME | SAT / SMT | Computational Logic | Use target wording. |
| automated-reasoning | ATP & Model Finding | Computational Logic | RENAME | Automated Reasoning & Model Finding | Computational Logic | Use target wording. |
| logic-for-ai | Logic & Argumentation for AI | Computational Logic | RENAME | Logic for AI | Computational Logic | Use target wording. |
| universal-algebra | Universal Algebra | Mathematics & Logic | KEEP | Universal Algebra | Mathematics & Logic | - |
| varieties-equational | Varieties & Equational Logic | Universal Algebra | KEEP | Varieties & Equational Logic | Universal Algebra | - |
| semigroups-bands | Semigroups & Bands | Universal Algebra | KEEP | Semigroups & Bands | Universal Algebra | - |
| lattice-theory | Lattice Theory | Mathematics & Logic | KEEP | Lattice Theory | Mathematics & Logic | Terminal Knowledge node for lattice foundations, Boolean algebras and duality/representation results. |
| congruence-lattice-problem | Congruence Lattices & CLP | Lattice Theory | REMOVE_AS_KNOWLEDGE | - | canonical CLP Survey Work project | CLP remains represented by the Work project and its Lattice Theory relation, not as a standalone Knowledge claim. |
| set-theory | Set Theory | Mathematics & Logic | MOVE | Set Theory | Mathematical Logic | Parent expresses its logical foundations role. |
| number-theory | Number Theory & Arithmetic | Mathematics & Logic | MOVE | Number Theory & Arithmetic | Mathematical Logic | Parent expresses its logical foundations role. |
| data-analysis | Data Analysis | Data & Computing | KEEP | Data Analysis | Data & Computing | - |
| statistics | Statistical Reasoning | Data Analysis | KEEP | Statistical Reasoning | Data Analysis | - |
| survey-analysis | Survey Analysis | Data Analysis | KEEP | Survey Analysis | Data Analysis | - |
| data-qa | Data Validation & QA | Data Analysis | KEEP | Data Validation & QA | Data Analysis | - |
| visualisation | Data Visualisation | Data Analysis | KEEP | Data Visualisation | Data Analysis | - |
| data-cleaning | Data Cleaning & Transformation | Data Analysis | KEEP | Data Cleaning & Transformation | Data Analysis | - |
| qualitative-coding | - | - | ADD | Open-text / Qualitative Coding | Data Analysis | Narrow claim, grounded in codebook/open-text project work. |
| programming-automation | Programming & Automation | Data & Computing | KEEP | Programming & Automation | Data & Computing | Tooling moves into metadata. |
| python | Python | Programming & Automation | DEMOTE_TO_METADATA | - | project skills/evidence | Preserve in project `tech` and a typed metadata relation. |
| algorithms-data-structures | Algorithms & Data Structures | Programming & Automation | KEEP | Algorithms & Data Structures | Programming & Automation | - |
| automation | Automation & Pipelines | Programming & Automation | KEEP | Automation & Pipelines | Programming & Automation | - |
| git | Git & GitHub | Programming & Automation | DEMOTE_TO_METADATA | - | project skills/evidence | Preserve as project workflow/tooling metadata. |
| data-management | Data Management | Data & Computing | KEEP | Data Management | Data & Computing | - |
| sql | SQL | Data Management | DEMOTE_TO_METADATA | - | project skills/evidence | Preserve in SQL Schema metadata and completed-course evidence. |
| data-modelling | Relational Data Modelling | Data Management | KEEP | Relational Data Modelling | Data Management | - |
| ai-methods | AI Systems | Data & Computing | KEEP | AI Systems | Data & Computing | - |
| language-models | Language Models | AI Systems | KEEP | Language Models | AI Systems | - |
| ai-research-workflows | AI-assisted Technical Workflows | AI Systems | MOVE | AI-assisted Technical Workflows | Research Practice | Methodology, not AI-system specialization. |
| reproducible-analysis | Reproducible Analysis | Research Practice | KEEP | Reproducible Analysis | Research Practice | - |
| scientific-writing | Scientific & Technical Writing | Research Practice | KEEP | Scientific & Technical Writing | Research Practice | - |
| participatory-research | Participatory Research | Research Practice | KEEP | Participatory Research | Research Practice | - |
| ceske-priority | České priority | Experience | KEEP | České priority | Experience | Current role retains data and Work relations. |
| escape-room | EscapeTheRoom.cz | Experience | KEEP | EscapeTheRoom.cz | Experience | - |
| student-ball | Student Ball | Experience | KEEP | Student Ball | Experience | - |
| charles-university | BSc in Logic | Education | KEEP | BSc in Logic | Education | Canonical degree node. |
| selected-coursework | Selected Coursework | BSc in Logic | RENAME | Academic Work | BSc in Logic | Holds independently inspectable academic outputs, not a course list. |
| metalogic-amalgamation-interpolation | Amalgamation & Interpolation | Selected Coursework | KEEP | Amalgamation & Interpolation | Academic Work | Inspectable note. |
| clp-historical-survey-coursework | CLP Historical Survey | Selected Coursework | REMOVE_DUPLICATE | - | canonical CLP Survey Work project | Preserve course context as education-link/evidence on the project. |
| simulation-credence-coursework | Simulation Credence | Selected Coursework | KEEP | Simulation Credence | Academic Work | Inspectable paper. |
| bachelor-thesis-education | Bachelor Thesis | BSc in Logic | REMOVE_DUPLICATE | - | canonical BSc Thesis Work project | Preserve degree relation and legacy route alias. |
| charles-university-masters-logic | Master's in Logic | Education | RENAME | MSc in Logic | Education | Use target wording. |
| esslli | ESSLLI 2026 | Education | KEEP | ESSLLI 2026 | Education | - |
| prg-ai | prg.ai Minor | Education | KEEP | prg.ai Minor | Education | - |
| credentials | Certifications | Education | RENAME | Credentials | Education | Remains lower prominence. |
| cert-cambridge-b2 | B2 First - Score 170 | Credentials | KEEP | B2 First - Score 170 | Credentials | Credential item. |
| cert-ethics-ai | Ethics of AI | Credentials | KEEP | Ethics of AI | Credentials | Credential item. |
| cert-intro-ai | Introduction to AI | Credentials | KEEP | Introduction to AI | Credentials | Credential item. |
| research-interests | Research Interests | About | KEEP | Research Interests | About | - |
| philosophy | Philosophy | About | KEEP | Philosophy | About | - |
| games-rpg | Games | About | KEEP | Games | About | - |
| music | Music | About | KEEP | Music | About | Independently inspectable child areas retained. |
| woodworking | Woodworking | About | RENAME | Woodworking / Making | About | Deep child hierarchy remains intentional. |
| hedgehog-house | Hedgehog House | Woodworking | KEEP | Hedgehog House | Woodworking / Making | Inspectable project and photo collection. |
| entrance-terrace | Entrance Terrace | Woodworking | KEEP | Entrance Terrace | Woodworking / Making | Inspectable project and photo collection. |
| logic-ai-interest | Logic & AI | Research Interests | RENAME | Formal Reasoning & AI | Research Interests | Better reflects research identity. |
| ai-math-reasoning-interest | AI-assisted Mathematics | Research Interests | KEEP | AI-assisted Mathematics | Research Interests | - |
| algebraic-nonclassical-interest | Algebraic & Non-classical Logic | Research Interests | RENAME | Algebraic Semantics of Non-classical Logics | Research Interests | Better reflects research identity. |
| ai-science-workflows-interest | AI for Scientific Workflows | Research Interests | KEEP | AI for Scientific Workflows | Research Interests | - |
| science-evidence | Science & Evidence | Research Interests | DEMOTE_TO_SCENE_CONTENT | - | Philosophy of Science + Research Practice | Preserve description through cross-links/parent details; do not retain a duplicate interest node. |
| philosophy-ai | Philosophy of AI | Philosophy | KEEP | Philosophy of AI | Philosophy | - |
| philosophy-mind | Philosophy of Mind | Philosophy | KEEP | Philosophy of Mind | Philosophy | - |
| philosophy-science | Philosophy of Science | Philosophy | KEEP | Philosophy of Science | Philosophy | Receives Science & Evidence connection. |
| rpg-dnd | RPG / D&D | Games | KEEP | RPG / D&D | Games | - |
| mtg | Magic: The Gathering | Games | KEEP | Magic: The Gathering | Games | Collection parent; deck children remain valid. |
| pc-tabletop-games | PC & Tabletop Games | Games | RENAME | PC / Digital / Tabletop Games | Games | Use target wording. |
| piano | Piano | Music | KEEP | Piano | Music | Retained as independently navigable. |
| music-creation | Music Creation | Music | KEEP | Music Creation | Music | Retained as independently navigable. |
| project-insolvency | Insolvency Analysis | Work + Work themes | KEEP | Insolvency Analysis | Work | Themes stay in the Work FCA model, not global parent hierarchy. |
| project-modal-logic-lab | Modal Logic Lab | Work + Work themes | KEEP | Modal Logic Lab | Work | Themes stay in the Work FCA model, not global parent hierarchy. |
| project-sql-schema | SQL Schema | Work + Work themes | KEEP | SQL Schema | Work | SQL becomes project skill metadata. |
| project-film-splitter | Film Splitter | Work + Work themes | KEEP | Film Splitter | Work | Python becomes project skill metadata. |
| project-clp-survey | CLP Survey | Work + Work themes | MERGE | CLP Survey | Work | Absorbs duplicate course-paper node; add education-link. |
| project-bachelor-thesis | BSc Thesis | Work + Work themes | MERGE | BSc Thesis | Work | Canonical thesis; add degree relation and route alias. |
| project-social-workers-survey | Survey Analysis | Work + Work themes | KEEP | Survey Analysis and Open-Text Coding | Work | Add conservative Open-text Coding evidence; retain experience link. |
| project-arol-lab | Wₙ Separators | Work + Work themes | RENAME | A-ROL Lab | Work | Use project identity instead of a narrow internal label. |
| project-tachov-workshop | Tachov Workshop | Work + Work themes | KEEP | Minecraft Education Participatory Foresight | Work | Retain experience link. |
| project-axiom-wilds | Axiom Wilds | Work + Work themes | KEEP | Axiom Wilds | Work | Retain Games interest link. |
| work-theme-logic | Logic & Mathematics | Work | DEMOTE_TO_METADATA | - | Work FCA attribute | Remains `SITE_DATA.work.attributes`, not a global graph node. |
| work-theme-computing-data | Data & Computing | Work | DEMOTE_TO_METADATA | - | Work FCA attribute | Remains `SITE_DATA.work.attributes`, not a global graph node. |
| work-theme-research | Research | Work | DEMOTE_TO_METADATA | - | Work FCA attribute | Remains `SITE_DATA.work.attributes`, not a global graph node. |
| work-theme-education | Education & Communication | Work | DEMOTE_TO_METADATA | - | Work FCA attribute | Remains `SITE_DATA.work.attributes`, not a global graph node. |

## Relation migration rules

- Demoted Python, Git/GitHub and SQL stay in `work.projects[].tech`. Their former evidence edges are replaced by `skill-metadata` edges to the relevant project so inspector metadata remains inspectable without turning tools into navigation nodes.
- The canonical thesis is `project-bachelor-thesis`; it links to `charles-university` through `education-link`. The legacy Education route redirects to that canonical route.
- The canonical CLP Survey is `project-clp-survey`; it links to `charles-university` through `education-link`. Its former course-paper content and PDF anchors migrate there.
- Work attributes remain the FCA input and continue to drive the Work view. They are not global Atlas nodes and never parent project nodes in the canonical graph hierarchy.
- Parent relations express specificity. Conceptual overlap stays in typed edges, including Algebraic Logic ↔ Universal Algebra/Lattice Theory and Computational Logic ↔ AI Systems.

## Integrity checklist before migration

- All five top-level branches are retained.
- Every retained node has one canonical primary parent; the two duplicate academic artifacts have one canonical graph node each.
- Removed Knowledge nodes are represented as project skill metadata; removed academic nodes are represented by canonical artifacts and typed education links.
- Deep About content remains represented as graph nodes and is left to the existing LOD mechanisms for progressive disclosure.
