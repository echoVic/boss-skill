# boss-skill

[![npm version](https://img.shields.io/npm/v/@blade-ai/boss-skill)](https://www.npmjs.com/package/@blade-ai/boss-skill)
[![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/echoVic/boss-skill?utm_source=oss&utm_medium=github&utm_campaign=echoVic%2Fboss-skill&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)](https://coderabbit.ai)
[![Boss trust badge](https://img.shields.io/endpoint?url=https%3A%2F%2Fhol.org%2Fapi%2Fregistry%2Fbadges%2Fplugin%3Fslug%3Dechovic%252Fboss%26metric%3Dtrust%26style%3Dflat)](https://hol.org/registry/plugins/echovic%2Fboss)

**Languages / 语言 / 言語 / 언어 / Idiomas / Langues:** [English](./README.md) · [中文](./README.zh-CN.md) · [日本語](./README.ja.md) · [한국어](./README.ko.md) · [Español](./README.es.md) · [Français](./README.fr.md) · [Português](./README.pt-BR.md)

![boss-skill promo](https://raw.githubusercontent.com/echoVic/boss-skill/main/boss-skill-promo.png)

**Boss est un workflow d'équipe d'agents auditable pour les agents de codage.** Il transforme un agent de codage en une équipe d'ingénierie structurée : PM, Architect, UI Designer, Tech Lead, Scrum Master, Frontend, Backend, QA et DevOps. Contrairement aux équipes d'agents reposant uniquement sur des prompts, Boss ajoute un état de runtime, des événements append-only, des gates de qualité, des evals déterministes, des hooks et des artefacts rejouables.

Boss fonctionne avec Claude Code, Codex, OpenClaw, Antigravity et Hermes.

## Pourquoi Boss

Une orchestration reposant uniquement sur des prompts peut sembler organisée, mais elle ne peut généralement pas prouver que le plan a été suivi, que les tests ont été exécutés, que les gates ont été franchies ou que l'état n'a pas été halluciné. Boss est construit autour de preuves :

- **Runtime à event sourcing** : l'état du pipeline est ajouté à `.boss/<feature>/.meta/events.jsonl` et projeté dans un état d'exécution en lecture seule.
- **Gates vérifiables** : la QA, le déploiement et les vérifications finales sont de vraies commandes dont les verdicts sont enregistrés comme événements. `boss gate final` et `boss doctor` échouent lorsqu'une étape marquée terminée porte un gate en échec. L'application reste tributaire du respect du protocole par l'agent orchestrateur : la CLI rend le verdict vérifiable, pas inévitable.
- **Artefacts rejouables** : les PRD, documents d'architecture, listes de tâches, rapports QA, rapports de déploiement et résumés sont stockés sous `.boss/<feature>/`.
- **Evals déterministes** : les transcriptions capturées peuvent être notées sans appeler un vrai LLM.
- **CLI adaptée aux agents** : les commandes prennent en charge la sortie JSON, `--describe`, les exécutions à blanc, les champs limités et les erreurs structurées.

## Utiliser un seul rôle ou toute l'équipe

Boss n'est pas une commande monolithique unique. Vous pouvez exécuter un seul rôle sur un projet existant, ou lancer le pipeline complet de l'idée à la livraison.

| Commande | Ce qu'elle fait | Quand l'utiliser |
| --- | --- | --- |
| `/boss` | Pipeline complet en 4 étapes | Vous voulez passer de l'idée à un travail livrable |
| `/boss:plan` | Planification PM + Architect | Vous voulez une PRD et l'architecture avant l'implémentation |
| `/boss:review` | Revue par le Tech Lead | Vous avez besoin d'une revue en lecture seule du code, d'une PR ou du design |
| `/boss:qa` | QA plus gates | Vous avez besoin de preuves de test vérifiables |
| `/boss:ship` | Vérifications de build et de déploiement DevOps | Vous êtes prêt à livrer |
| `/boss:extend` | Agent, pack ou gate personnalisé | Vous voulez adapter Boss à votre équipe |
| `/boss:upgrade` | Mettre à niveau Boss Skill et réinstaller les hooks | Vous voulez le dernier package npm et la config des hooks |

## Démarrage rapide

### 1. Installation

Boss est un skill que vous installez dans votre agent de codage — pas un outil qui installe d'autres skills.

**Recommandé — via la CLI `skills` ([vercel-labs/skills](https://github.com/vercel-labs/skills), skills.sh) :**

```bash
npx skills add echoVic/boss-skill
```

C'est la méthode standard, indépendante de l'agent, pour installer un skill : elle découvre `boss` depuis le dépôt, demande l'agent cible / la portée (projet ou global) / la méthode d'installation, et enregistre un fichier `skills-lock.json` que vous pouvez committer. Boss fournit une racine de skill unique, le sélecteur n'affiche donc que `boss` — ses méthodologies internes l'accompagnent.

**Alternative — l'installateur multi-agents de Boss** (détecte automatiquement Claude Code, Codex, OpenClaw, Antigravity, Hermes et installe dans chacun d'eux, en plus de fusionner les hooks Codex) :

```bash
# One-shot, no global install
npx @blade-ai/boss-skill

# Or install globally, then run the self-install wizard
npm install -g @blade-ai/boss-skill
boss-skill
```

Pour le mode plugin de Claude Code :

```bash
claude --plugin-dir "$(boss-skill path)"
```

### 2. Exécuter un pipeline léger

Dans votre agent de codage :

```text
/boss Build a local personal todo app --roles core --skip-deploy
```

- `--roles core` utilise les rôles PM, Architect, Dev et QA.
- `--skip-deploy` s'arrête après l'implémentation et les preuves de test.

### 3. Inspecter les résultats

```bash
boss status todo-app --json
boss runtime inspect-pipeline todo-app
```

Structure des artefacts attendue :

```text
.boss/todo-app/
├── design-brief.md
├── prd.md
├── architecture.md
├── tasks.md
├── qa-report.md
└── .meta/
    ├── events.jsonl
    ├── execution.json
    └── workflow-plan.json
```

## Quand utiliser Boss

| Bien adapté | Peu adapté |
| --- | --- |
| Nouvelles fonctionnalités nécessitant exigences, design, implémentation, tests et preuves de livraison | Corrections d'une ligne ou petites modifications locales |
| Travail sur des API, du full-stack, de l'UI ou des produits de taille moyenne | Simple lecture ou explication de code |
| Travaux où les artefacts `.boss/<feature>/` ont de la valeur | Tâches avec une spec existante complète où seul un patch rapide est nécessaire |
| Équipes qui veulent des gates reproductibles et des pistes d'audit | Travaux qui n'ont pas besoin de coordination ni de preuves de revue |

Règle générale : si vous n'avez pas besoin d'un dossier `.boss/` traçable, vous n'avez probablement pas besoin du pipeline `/boss` complet. Utilisez un seul rôle ou laissez votre agent de codage modifier directement.

## Pas de CLI ? Ça marche quand même

Boss détecte la CLI `boss` au runtime. Sans elle, le workflow peut se replier sur des artefacts Markdown sous `.boss/<feature>/` au lieu du flux d'événements. La CLI est la mise à niveau en matière d'auditabilité : event sourcing, reprise rejouable, evals déterministes, gates de runtime et diagnostics structurés.

Boss ne signifie pas « installez une fois et obtenez une livraison autonome garantie ». Il fournit un workflow de runtime et des gates de preuve ; l'agent de codage actif doit toujours suivre le protocole Boss.

## Détails d'installation

```bash
npm install -g @blade-ai/boss-skill
boss-skill install
```

Commandes d'installation utiles :

```bash
boss-skill install --dry-run
boss-skill uninstall
boss-skill path
boss-skill --version
```

Cibles détectées automatiquement :

| Agent | Détection | Méthode d'installation |
| --- | --- | --- |
| OpenClaw | `~/.openclaw/` | Copie vers `~/.openclaw/skills/boss/` et injection des métadonnées |
| Codex | `~/.codex/` | Copie vers `~/.codex/skills/boss/`, injection des métadonnées, fusion des hooks |
| Antigravity | `~/.gemini/antigravity/` | Copie vers le répertoire de skills d'Antigravity et injection des métadonnées |
| Hermes | `~/.hermes/` | Copie vers `~/.hermes/skills/boss/` et injection des métadonnées |
| Claude Code | Toujours disponible | Mode plugin avec `--plugin-dir` |

## Support des plateformes

Boss cible Node.js `>=20` et fonctionne sous Linux, macOS et Windows. La CLI n'exécute des commandes externes que via `spawnSync` avec des tableaux d'arguments explicites (jamais `shell: true`) et résout `npm`/`npx` vers leurs variantes `.cmd` sous Windows : le pipeline principal ne fait donc aucune supposition propre à POSIX.

Deux capacités dépendent d'outils externes optionnels et se dégradent proprement lorsqu'ils sont absents :

- Les **checkpoints WIP** (stash/commit/branche) nécessitent `git` et un arbre de travail git. En dehors d'un dépôt, ou sans `git` dans le `PATH`, la création de checkpoints est silencieusement ignorée — le pipeline n'est pas affecté.
- Les **plugins `gate.sh` legacy écrits à la main** sont exécutés via `bash`. Sous Windows sans bash dans le `PATH`, ils ne pourront pas se lancer ; préférez le point d'entrée de gate Node multiplateforme (`gate.js` / `gate.mjs`) pour des plugins portables.

Exécutez `boss doctor` pour voir l'environnement de runtime résolu (version de Node, plateforme et disponibilité de `git`), ainsi que l'état de l'installation et du flux d'événements.

## Commandes

Commandes slash courantes :

```text
/boss Build a todo app
/boss Add authentication to this existing project --skip-ui
/boss Build an API service --skip-deploy --quick
/boss Continue the previous task --continue-from 3
/boss Lightweight mode --roles core --hitl-level off
/boss:upgrade
```

Options courantes :

| Option | Signification |
| --- | --- |
| `--roles <preset>` | `full` pour les 9 rôles, ou `core` pour PM/Architect/Dev/QA |
| `--skip-ui` | Ignorer le design UI |
| `--skip-deploy` | Ignorer le déploiement |
| `--quick` | Ignorer les nœuds de confirmation et de clarification des exigences |
| `--template` | Initialiser `.boss/templates/` et faire une pause |
| `--continue-from <1-4>` | Reprendre depuis une étape du pipeline |
| `--hitl-level <level>` | Mode human-in-the-loop : `auto`, `interactive` ou `off` |

Commandes de la CLI Boss :

```bash
boss --help
boss status FEATURE
boss continue FEATURE
boss gate FEATURE
boss qa attack FEATURE
boss project init FEATURE
boss design preview FEATURE
boss packs detect
boss runtime inspect-pipeline FEATURE
boss runtime generate-summary FEATURE
```

Les commandes `boss` destinées aux agents utilisent ces options courantes lorsqu'elles s'appliquent ; exécutez `--describe` sur une commande pour obtenir son schéma JSON exact :

- `--json` : sortie structurée ; sur une sortie standard non TTY, la sortie par défaut est du JSON
- `--describe` : schéma JSON de la commande
- `--dry-run` : plan d'action structuré pour les écritures ou les opérations risquées
- `--json-input=<json|->` : charge utile d'entrée JSON
- `--fields=<a,b>` et `--limit=<n>` : sortie limitée
- `--yes` : requis uniquement pour les commandes non interactives à haut risque qui nécessitent une confirmation supplémentaire

Les erreurs structurées sont écrites sur stderr sous la forme `{"error":{...}}` et incluent `code`, `message`, `input`, `retryable` et `suggestion`.

## Workflow

Boss suit un workflow en quatre étapes :

```text
User request
  -> requirement clarification
  -> Stage 1: PM, Architect, UI Designer
  -> Stage 2: Tech Lead, Scrum Master
  -> Stage 3: Frontend, Backend, QA, gates
  -> Stage 4: DevOps, deployment checks, summary
```

L'ensemble complet des rôles :

| Rôle | Responsabilité |
| --- | --- |
| PM | Découverte des exigences, PRD, besoins cachés, cas limites |
| Architect | Architecture système, design technique, API |
| UI Designer | Spec UI/UX plus design JSON affichable |
| Tech Lead | Revue technique, évaluation des risques |
| Scrum Master | Décomposition des tâches et critères d'acceptation |
| Frontend | Implémentation de l'UI et tests frontend |
| Backend | API, stockage, tests backend |
| QA | Exécution des tests, rapports de bugs, preuves de vérification |
| DevOps | Build, déploiement, vérifications de santé |

## Runtime et gates de qualité

Boss possède deux niveaux de contrôle qualité :

- **Contraintes dures** vérifiées par le code et la CI : événements de runtime, `execution.json` protégé, hooks, tests de la matrice d'installation, scénarios du harness et couverture Vitest.
- **Contraintes du protocole d'agent** guidées par le bundle de skill : dispatch DAG, chargement progressif des références, preuves de test et discipline de gate.

Gates intégrées :

| Gate | Moment | Vérifications |
| --- | --- | --- |
| Gate 0 | Après le développement, avant la QA | TypeScript, lint, vérifications de compilation de base |
| Gate 1 | Après la QA, avant le déploiement | Preuves de test, aucun bug P0/P1, attentes E2E |
| Gate 2 | Avant le déploiement web | Cibles Lighthouse et de latence API le cas échéant |

Les hooks sont contrôlés par des variables d'environnement :

| Variable | Valeurs |
| --- | --- |
| `BOSS_HOOK_PROFILE` | `minimal`, `standard`, `strict` |
| `BOSS_DISABLED_HOOKS` | IDs de hooks séparés par des virgules |

L'état du runtime s'appuie sur `.boss/<feature>/.meta/workflow-plan.json` et `.boss/<feature>/.meta/execution.json`. La définition du workflow enregistre `workflowHash`, `packHash` et les hashs du DAG d'artefacts. La reprise au runtime utilise `boss runtime resume <feature> --from-run <run-id>` pour recharger le plan, comparer les entrées des nœuds et matérialiser `execution.workflow.nextNodeIds` pour les prochains nœuds planifiables. Les événements `GateEvaluated` / `WaveVerified` mettent à jour le statut des nœuds du workflow lorsque les gates et les vagues de preuves sont terminées.

## Surfaces sensibles pour la sécurité

Boss garde volontairement le manifeste de plugin publié minimal : il ne déclare que les skills fournis et omet les serveurs MCP, les manifestes d'application et les références d'assets, sauf si ces fichiers compagnons existent. Les hooks Codex sont installés par le flux `boss-skill install`, et non par le manifeste du marketplace.

Le package npm exclut les réglages locaux de l'agent de développement tels que `.claude/settings.json` et `.claude/settings.local.json`. Les métadonnées de plugin publiables se trouvent sous `.claude-plugin/`, `.codex-plugin/` et `.agents/plugins/marketplace.json`.

La provenance des releases se trouve dans `.agents/plugins/provenance.json`. Elle fige l'URL HTTPS du dépôt, le SHA immuable du commit source, l'identité de l'éditeur et les empreintes SHA-256 des manifestes de plugin et des composants sensibles pour la sécurité. Vérifiez-la avec :

```bash
npm run provenance:verify
```

La vérification de l'éditeur est externe au package. Pour le registre HOL, revendiquez le plugin avec le compte GitHub du propriétaire du dépôt sur `https://hol.org/guard/plugins`. La carte de confiance publique est disponible sur `https://hol.org/registry/plugins/echovic%2Fboss/embed`.

Comportements sensibles pour la sécurité à vérifier avant de publier ou d'installer :

- `boss-skill install` peut écrire dans les répertoires de configuration de l'agent, comme `~/.codex/skills/boss/`, et fusionner des entrées gérées par Boss dans `~/.codex/hooks.json`.
- Les entrées de hook exécutent `boss hooks run ...`, qui dispatche des scripts depuis `scripts/hooks/`.
- Les plugins de runtime sous `.boss/plugins/<name>/plugin.json` peuvent enregistrer des hooks de gate ou de reporter ; examinez les plugins locaux au projet avant de les activer.
- Utilisez `BOSS_HOOK_PROFILE=minimal` ou `BOSS_DISABLED_HOOKS=<ids>` lorsque vous devez réduire le comportement des hooks dans un environnement sensible.

Boss est local-first et n'effectue aucune requête réseau sortante par défaut ; la seule surface réseau est le serveur optionnel `boss design preview`, limité à la boucle locale. Consultez [PRIVACY.md](PRIVACY.md) pour la description complète des données et de la frontière réseau.

## Artefacts du pipeline

```text
.boss/<feature>/
├── design-brief.md
├── prd.md
├── architecture.md
├── ui-spec.md
├── ui-design.json
├── tech-review.md
├── tasks.md
├── qa-report.md
├── deploy-report.md
├── summary-report.md
└── .meta/
    ├── events.jsonl
    ├── execution.json
    └── workflow-plan.json
```

Exécutez ceci dans un environnement interactif pour prévisualiser un design UI généré :

```bash
boss design preview <feature>
```

## Evals

Les evals de Boss notent les fixtures capturées sans démarrer un vrai LLM :

```bash
npm run evals
npm run evals:release
```

L'eval de release inclut des vérifications release-evidence et pipeline-compliance. Elle vérifie l'utilisation des commandes de runtime, l'enregistrement des artefacts, l'absence de modifications directes de `execution.json` et les champs d'ordonnancement du workflow.

Voir [test/evals/README.md](./test/evals/README.md).

## Développement

Prérequis :

- Node.js >= 20
- `jq` pour les helpers de test basés sur le shell

Installation :

```bash
git clone https://github.com/echoVic/boss-skill.git
cd boss-skill
npm install
npm run build
npm run typecheck
npm test
```

Scripts utiles :

```bash
npm run build
npm run typecheck
npm test
npm run test:skills
npm run test:harness
npm run test:install-matrix
npm run evals
```

## Structure du dépôt

```text
boss-skill/
├── packages/boss-cli/          # TypeScript CLI and runtime
├── skill/                      # Skill bundle installed into coding agents
├── scripts/hooks/              # Node.js hook scripts
├── scripts/lib/                # Hook helpers
├── test/                       # Vitest, harness, eval, hook, and install tests
├── docs/superpowers/           # Historical specs, plans, and reports
├── examples/                   # Example projects
├── .claude-plugin/             # Claude Code plugin manifest
├── .codex-plugin/              # Codex plugin manifest
└── package.json
```

Zones de source importantes :

- `packages/boss-cli/src/` contient le code source TypeScript de la CLI et du runtime.
- `packages/boss-cli/dist/` contient la sortie CLI générée, utilisée par le binaire npm publié ; ne la modifiez pas à la main.
- `packages/boss-cli/assets/` contient les DAG intégrés, les packs de pipeline, le schéma de plugin et les plugins.
- `skill/SKILL.md` est le point d'entrée principal d'orchestration destiné aux agents.
- `skill/agents/` contient les prompts des rôles.
- `skill/commands/` contient les commandes slash.
- `skill/templates/` contient les templates d'artefacts.

## Release

Utilisez le script de release afin que les numéros de version restent synchronisés entre les métadonnées du package et les manifestes de skill/plugin :

```bash
npm run release -- patch
npm run release -- minor
npm run release -- major
npm run release -- 3.11.0
npm run release -- 3.11.0 --dry-run
npm run release -- 3.11.0 --no-publish
```

Le script de release vérifie que l'arbre de travail est propre, exécute les tests, synchronise les versions, vérifie la cohérence, crée un commit et un tag, puis publie sauf si `--no-publish` est utilisé.

Voir [CONTRIBUTING.md](./CONTRIBUTING.md).

## Design

Boss s'inspire de BMAD : Breakthrough Method of Agile AI-Driven Development. Le projet adapte cette idée en un runtime auditable pour le travail logiciel agentique.

Pour en savoir plus, voir [DESIGN.md](./DESIGN.md) et `skill/references/bmad-methodology.md`.

## Historique des étoiles

[![Star History Chart](https://api.star-history.com/svg?repos=echoVic/boss-skill&type=Date)](https://star-history.com/#echoVic/boss-skill&Date)

## Licence

MIT
