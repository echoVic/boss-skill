# boss-skill

[![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/echoVic/boss-skill?utm_source=oss&utm_medium=github&utm_campaign=echoVic%2Fboss-skill&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)](https://coderabbit.ai)
[![Boss trust badge](https://img.shields.io/endpoint?url=https%3A%2F%2Fhol.org%2Fapi%2Fregistry%2Fbadges%2Fplugin%3Fslug%3Dechovic%252Fboss%26metric%3Dtrust%26style%3Dflat)](https://hol.org/registry/plugins/echovic%2Fboss)

**Languages / 语言 / 言語 / 언어 / Idiomas / Langues:** [English](./README.md) · [中文](./README.zh-CN.md) · [日本語](./README.ja.md) · [한국어](./README.ko.md) · [Español](./README.es.md) · [Français](./README.fr.md) · [Português](./README.pt-BR.md)

![boss-skill promo](https://raw.githubusercontent.com/echoVic/boss-skill/main/boss-skill-promo.png)

**Boss est un workflow d'équipe d'agents auditable pour les agents de codage.** Il transforme un agent de codage en une équipe d'ingénierie structurée : PM, Architect, UI Designer, Tech Lead, Scrum Master, Frontend, Backend, QA et DevOps. Contrairement aux équipes d'agents reposant uniquement sur des prompts, Boss ajoute un état de runtime, des événements append-only, des gates de qualité, des evals déterministes, des hooks et des artefacts rejouables.

Boss fonctionne avec Claude Code, Codex, OpenClaw, Antigravity et Hermes.

## Pourquoi Boss

Une orchestration reposant uniquement sur des prompts peut sembler organisée, mais elle ne peut généralement pas prouver que le plan a été suivi, que les tests ont été exécutés, que les gates ont été franchies ou que l'état n'a pas été halluciné. Boss est construit autour de preuves :

- **Zéro réseau par défaut** : aucune télémétrie, aucun phone-home, aucun proxy LLM distant. La seule surface réseau est un serveur d'aperçu opt-in lié à `127.0.0.1`. Un [test network-boundary](./test/runtime/network-boundary.test.ts) au niveau du code source fait échouer la CI si quelqu'un réintroduit un client sortant. Voir [PRIVACY.md](./PRIVACY.md).
- **Pas d'injection shell** : la vérification des waves s'exécute via un `argv` structuré (`waves.json`), jamais via une shell. Cloner un dépôt malveillant ne peut pas glisser de commandes via `tasks.md`.
- **Runtime à event sourcing** : l'état du pipeline est ajouté à `.boss/<feature>/.meta/events.jsonl` et projeté dans un état d'exécution en lecture seule.
- **Gates vérifiables** : la QA, le déploiement et les vérifications finales sont de vraies commandes dont les verdicts sont enregistrés comme événements. `boss gate final` et `boss doctor` échouent lorsqu'une étape marquée terminée porte un gate en échec. L'application reste tributaire du respect du protocole par l'agent orchestrateur : la CLI rend le verdict vérifiable, pas inévitable.
- **Artefacts rejouables** : les PRD, documents d'architecture, listes de tâches, rapports QA, rapports de déploiement et résumés sont stockés sous `.boss/<feature>/`.
- **Evals déterministes** : les transcriptions capturées peuvent être notées sans appeler un vrai LLM.
- **CLI adaptée aux agents** : les commandes prennent en charge la sortie JSON, `--describe`, les exécutions à blanc, les champs limités et les erreurs structurées.
- **Auto-vérifiable** : lancez `boss doctor` pour confirmer le runtime résolu, les emplacements d'installation, l'intégrité du flux d'événements et la limite réseau — l'affirmation « zéro réseau » est auditable, pas seulement déclarée.

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
| `/boss:upgrade` | Mettre à jour Boss Skill et refusionner les hooks | Vous voulez la dernière version du marketplace et la config des hooks |

## Démarrage rapide

### 1. Installation

Boss est un skill que vous installez dans votre agent de codage — pas un outil qui installe d'autres skills. La distribution passe uniquement par les marketplaces : pas de package npm, pas de binaire global. Le skill embarque sa propre CLI (`skill/cli/`), que les hooks et l'agent invoquent via `node`.

**Claude Code — marketplace de plugins (recommandé ; les hooks sont déjà câblés) :**

```text
/plugin marketplace add echoVic/boss-skill
/plugin install boss@boss-skill
```

**Codex — marketplace de plugins :**

```bash
codex plugin marketplace add echoVic/boss-skill
```

Ouvrez ensuite le navigateur de plugins (`/plugins`) et installez **boss**.

**N'importe quel agent — via la CLI `skills` ([vercel-labs/skills](https://github.com/vercel-labs/skills), skills.sh) :**

```bash
npx skills add echoVic/boss-skill
```

Elle découvre `boss` depuis le dépôt, demande l'agent cible / la portée (projet ou global) / la méthode d'installation, et enregistre un fichier `skills-lock.json` que vous pouvez committer. Boss fournit une racine de skill unique, le sélecteur n'affiche donc que `boss` — ses méthodologies internes l'accompagnent.

Pour Codex et les autres installations par copie, câblez les hooks Boss avec la CLI embarquée :

```bash
node <installed-skill>/cli/bin/boss.js install
```

### 2. Exécuter un pipeline léger

Dans votre agent de codage :

```text
/boss Build a local personal todo app --roles core --skip-deploy
```

- `--roles core` utilise les rôles PM, Architect, Dev et QA.
- `--skip-deploy` s'arrête après l'implémentation et les preuves de test.

### 3. Inspecter les résultats

Boss embarque sa propre CLI dans le skill — aucune installation npm, aucune configuration du PATH. Dans les extraits ci-dessous, `<skill>` est le répertoire qui contient `SKILL.md` (pour les installations via le marketplace de plugins Claude Code : `<plugin-root>/skill` ; pour les installations par copie, par ex. `~/.codex/skills/boss`).

```bash
node <skill>/cli/bin/boss.js status todo-app --json
node <skill>/cli/bin/boss.js runtime inspect-pipeline todo-app
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

La CLI est embarquée dans le skill, donc une installation via un marketplace la fournit toujours. Lorsque `node` n'est pas disponible ou que la CLI est introuvable, le workflow se replie sur des artefacts Markdown sous `.boss/<feature>/` au lieu du flux d'événements. La CLI est la mise à niveau en matière d'auditabilité : event sourcing, reprise rejouable, evals déterministes, gates de runtime et diagnostics structurés.

Boss ne signifie pas « installez une fois et obtenez une livraison autonome garantie ». Il fournit un workflow de runtime et des gates de preuve ; l'agent de codage actif doit toujours suivre le protocole Boss.

## Détails d'installation

Les installations via un marketplace copient (ou lient) tout le répertoire `skill/`. La CLI embarquée se trouve à `<skill>/cli/bin/boss.js` et ne nécessite que Node.js `>=20` ; les hooks la référencent par chemin complet, donc rien ne dépend de npm ni d'un binaire global `boss`.

Commandes utiles (exécutées via la CLI embarquée) :

```bash
node <skill>/cli/bin/boss.js install --dry-run
node <skill>/cli/bin/boss.js uninstall
node <skill>/cli/bin/boss.js path
node <skill>/cli/bin/boss.js --version
```

Cibles détectées automatiquement :

| Agent | Détection | Méthode d'installation |
| --- | --- | --- |
| OpenClaw | `~/.openclaw/` | Copie vers `~/.openclaw/skills/boss/` et injection des métadonnées |
| Codex | `~/.codex/` | Copie vers `~/.codex/skills/boss/`, injection des métadonnées, fusion des hooks |
| Antigravity | `~/.gemini/antigravity/` | Copie vers le répertoire de skills d'Antigravity et injection des métadonnées |
| Hermes | `~/.hermes/` | Copie vers `~/.hermes/skills/boss/` et injection des métadonnées |
| Claude Code | Toujours disponible | Marketplace de plugins (voir Démarrage rapide) |

## Support des plateformes

Boss cible Node.js `>=20` et fonctionne sous Linux, macOS et Windows. La CLI est embarquée dans le skill et n'exécute des commandes externes que via `spawnSync` avec des tableaux d'arguments explicites (jamais `shell: true`) et résout `npm`/`npx` vers leurs variantes `.cmd` sous Windows : le pipeline principal ne fait donc aucune supposition propre à POSIX.

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
npm run build:skill   # build + sync de skill/cli (committez le bundle avec votre modification)
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
├── packages/boss-cli/          # TypeScript CLI and runtime source
├── skill/                      # Skill bundle installed into coding agents (self-contained)
│   ├── cli/                    # Generated CLI bundle (runs with node, no npm)
│   ├── scripts/                # Hook runtime (dispatcher + hook scripts)
│   └── assets/                 # Built-in DAGs, pipeline packs, plugin schema
├── test/                       # Vitest, harness, eval, hook, and install tests
├── docs/superpowers/           # Historical specs, plans, and reports
├── examples/                   # Example projects
├── .claude-plugin/             # Claude Code plugin manifest + marketplace
├── .codex-plugin/              # Codex plugin manifest + marketplace
├── .agents/plugins/            # Repo-scoped plugin marketplace + provenance
└── package.json                # Private dev workspace (never published)
```

Zones de source importantes :

- `packages/boss-cli/src/` contient le code source TypeScript de la CLI et du runtime.
- `skill/cli/` est le bundle CLI généré qui est livré avec le skill ; `packages/boss-cli/dist/` est le build intermédiaire de développement. Les deux proviennent de `npm run build:skill` — ne modifiez ni l'un ni l'autre à la main.
- `skill/assets/` contient les DAG intégrés, les packs de pipeline, le schéma de plugin et les plugins.
- `skill/scripts/` contient le runtime des hooks (`lib/run-with-flags.js`) et les scripts de hooks.
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
npm run release -- 4.1.0
npm run release -- 4.1.0 --dry-run
```

Le script de release vérifie que l'arbre de travail est propre, reconstruit la CLI du skill (`skill/cli/`), exécute les tests, synchronise les versions, vérifie la cohérence, crée un commit et un tag, puis pousse. La release est le tag git : les marketplaces lisent le dépôt — il n'y a aucune étape de publication npm.

Voir [CONTRIBUTING.md](./CONTRIBUTING.md).

## Design

Boss s'inspire de BMAD : Breakthrough Method of Agile AI-Driven Development. Le projet adapte cette idée en un runtime auditable pour le travail logiciel agentique.

Pour en savoir plus, voir [DESIGN.md](./DESIGN.md) et `skill/references/bmad-methodology.md`.

## Historique des étoiles

[![Star History Chart](https://api.star-history.com/svg?repos=echoVic/boss-skill&type=Date)](https://star-history.com/#echoVic/boss-skill&Date)

## Licence

MIT
