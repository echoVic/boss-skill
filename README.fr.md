# boss-skill

[![skills.sh](https://skills.sh/b/echovic/boss-skill)](https://skills.sh/echovic/boss-skill)
[![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/echoVic/boss-skill?utm_source=oss&utm_medium=github&utm_campaign=echoVic%2Fboss-skill&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)](https://coderabbit.ai)
[![G-Star Incubation](https://img.shields.io/badge/G--Star-Incubation-C71D23)](https://atomgit.com/echoVic/boss-skill)
[![AtomGit Mirror](https://img.shields.io/badge/AtomGit-Mirror-1F6FEB)](https://atomgit.com/echoVic/boss-skill)
[![Boss trust badge](https://img.shields.io/endpoint?url=https%3A%2F%2Fhol.org%2Fapi%2Fregistry%2Fbadges%2Fplugin%3Fslug%3Dechovic%252Fboss%26metric%3Dtrust%26style%3Dflat)](https://hol.org/registry/plugins/echovic%2Fboss)

**Languages / 语言 / 言語 / 언어 / Idiomas / Langues:** [English](./README.md) · [中文](./README.zh-CN.md) · [日本語](./README.ja.md) · [한국어](./README.ko.md) · [Español](./README.es.md) · [Français](./README.fr.md) · [Português](./README.pt-BR.md)

![boss-skill promo](https://raw.githubusercontent.com/echoVic/boss-skill/main/boss-skill-promo.png)

> Ce projet fait partie du programme AtomGit G-Star Incubation. GitHub est le dépôt canonique ; AtomGit fournit un miroir synchronisé automatiquement pour un accès plus rapide en Chine. Veuillez soumettre les issues et pull requests sur [GitHub](https://github.com/echoVic/boss-skill).
>
> GitHub : <https://github.com/echoVic/boss-skill> · Miroir AtomGit : <https://atomgit.com/echoVic/boss-skill>

**Boss est un workflow d'escouade d'experts pour les agents de codage.** Il transforme un agent de codage en une équipe d'ingénierie structurée : PM, Architecte, Designer UI, Tech Lead, Scrum Master, Frontend, Backend, QA et DevOps. Contrairement aux équipes d'agents reposant uniquement sur des prompts, Boss impose des contrats de qualité stricts par rôle, produit des artefacts rejouables et enchaîne les étapes automatiquement : commencez où vous voulez, il exécute le reste jusqu'à ce que vous disiez stop.

Boss fonctionne avec Claude Code, Codex, OpenClaw, Antigravity et Hermes.

## Pourquoi Boss

L'orchestration par prompts seule peut sembler organisée, mais elle ne peut généralement pas prouver que le plan a été suivi, que les tests ont été exécutés ou que les gates ont été passées. Boss est construit autour de la preuve et des contrats stricts :
- **Contrats de qualité stricts** : chaque rôle possède un tableau d'exigences non négociables (par exemple, le PRD doit contenir des scénarios Given-When-Then ; l'architecture doit comparer au moins deux options ; QA doit enregistrer des preuves vérifiées ou honnêtement non vérifiées). Un contrat échoué bloque l'étape suivante sauf override explicite.
- **Orienté artefacts** : chaque étape écrit un fichier réel sous `.boss/<feature>/`. La progression est jugée sur les artefacts sur disque, pas sur ce que l'agent affirme.
- **Chaîne de continuation** : commencez à n'importe quelle étape (`/boss:pm`, `/boss:dev`, ...) et Boss exécute automatiquement toutes les étapes en aval jusqu'à `ship` ou jusqu'à ce que vous l'arrêtiez. Pas de transferts manuels.
- **Principes d'ingénierie** : l'escouade partage dix principes : vérifier le produit réel, corriger les causes racines, construire le levier, modéliser le domaine, discipline des frontières, séquencer les unités vérifiables, tester le comportement, minimiser la charge du lecteur, expérience structurée, règles autonomes. Chaque agent cite le principe qu'il applique.
- **TDD par défaut** : les étapes de développement doivent d'abord écrire un test qui échoue, constater l'état RED, puis écrire le code minimum pour passer à GREEN.
- **Zéro réseau par défaut** : pas de télémétrie, pas de phone-home, pas de proxy LLM distant. La seule surface réseau est un serveur de prévisualisation loopback opt-in (`127.0.0.1`) pour le prototypage UI. Voir [PRIVACY.md](./PRIVACY.md).
- **Evals déterministes** : les transcriptions capturées sont notées sans appeler de vrai LLM.

## Commandes de l'Escouade d'Experts

Boss n'est pas une seule commande monolithique. Chaque commande slash est un point d'entrée ; par défaut elle exécute automatiquement toutes les étapes en aval.

| Commande          | Commence à       | Exécute jusqu'à        | Quand l'utiliser                      |
| ----------------- | ---------------- | ---------------------- | ------------------------------------- |
| `/boss`           | PM               | chaîne complète → ship | Aller de l'idée au travail livrable   |
| `/boss:pm`        | PM               | Architect → ... → Ship | Commencer par les exigences           |
| `/boss:architect` | Architect        | UI → ... → Ship        | Vous avez une spec, besoin de design  |
| `/boss:ui`        | Designer UI      | Review → ... → Ship    | Vous avez l'architecture, besoin d'UI |
| `/boss:review`    | Tech Lead        | Tasks → ... → Ship     | Besoin de revue technique + plan      |
| `/boss:tasks`     | Scrum Master     | Dev → QA → Ship        | Besoin de décomposition des tâches    |
| `/boss:dev`       | Frontend/Backend | QA → Ship              | Commencer l'implémentation            |
| `/boss:qa`        | QA               | Ship                   | Besoin de preuves de test             |
| `/boss:ship`      | DevOps           | (fin)                  | Déployer seulement                    |

La chaîne complète :

```
pm → architect → ui → review → tasks → dev → qa → ship
```

Arrêtez la chaîne en disant "stop", "fais seulement cette étape" ou en passant `--stop-after <étape>`.

## Démarrage Rapide

### 1. Installer

Boss est une compétence que vous installez dans votre agent de codage. La distribution se fait uniquement via le marketplace : pas de package npm, pas de binaire global.

**Claude Code — marketplace de plugins (recommandé) :**

```text
/plugin marketplace add echoVic/boss-skill
/plugin install boss@boss-skill
```

**Codex — marketplace de plugins :**

```bash
codex plugin marketplace add echoVic/boss-skill
```

Ouvrez ensuite le navigateur de plugins (`/plugins`) et installez **boss**.

**Tout agent — via le CLI `skills` ([vercel-labs/skills](https://github.com/vercel-labs/skills), skills.sh) :**

```bash
npx skills add echoVic/boss-skill
```

### 2. Essayez sur un projet que vous avez déjà

La première exécution la moins coûteuse est une revue en lecture seule sur du code existant :

```
/boss:review
```

Vous obtenez `tech-review.md` (et `plan.md`) sous `.boss/<feature>/` avec les risques, les constatations et la sévérité. Aucun autre fichier du dépôt n'est touché.

Vous voulez plutôt des preuves de test vérifiables ? `/boss:qa` exécute les tests et écrit `qa-report.md`.

### 3. Exécutez le Pipeline Complet

Dans votre agent de codage :

```text
/boss Build a local personal todo app --skip-ui
```

- `--skip-ui` saute l'étape de design UI (projets API/CLI purs).
- `--quick` saute les invites de confirmation routinières.

### 4. Inspectez les Résultats

Les artefacts vivent sous `.boss/<feature>/` :

```text
.boss/todo-app/
├── prd.md
├── architecture.md
├── ui-spec.md
├── ui-design.json
├── tech-review.md
├── plan.md
├── tasks.md
├── qa-report.md
└── deploy-report.md
```

Chaque artefact Markdown commence par une section `## 摘要` (résumé) pour que les agents en aval lisent d'abord la conclusion.

## Flux de Travail

```text
Demande utilisateur
  → clarification des exigences (sauf --quick)
  → PM : découverte des exigences → prd.md
  → Architecte : conception du système → architecture.md
  → Designer UI : spécification UI/UX → ui-spec.md + ui-design.json (sauter avec --skip-ui)
  → Tech Lead : revue technique + plan d'implémentation → tech-review.md + plan.md
  → Scrum Master : décomposition des tâches → tasks.md
  → Frontend / Backend : implémentation TDD
  → QA : exécution des tests, rapports de bugs, preuves → qa-report.md
  → DevOps : build, déploiement, vérifications de santé → deploy-report.md
```

### Rôles et Artefacts

| Rôle         | Responsabilité                                                 | Artefact                       |
| ------------ | -------------------------------------------------------------- | ------------------------------ |
| PM           | Découverte des exigences, PRD, besoins cachés, cas limites     | `prd.md`                       |
| Architecte   | Architecture système, conception technique, APIs               | `architecture.md`              |
| Designer UI  | Spécification UI/UX, JSON de design rendable, prototype HTML   | `ui-spec.md`, `ui-design.json` |
| Tech Lead    | Revue technique, évaluation des risques, plan d'implémentation | `tech-review.md`, `plan.md`    |
| Scrum Master | Décomposition des tâches et critères d'acceptation             | `tasks.md`                     |
| Frontend     | Implémentation UI, TDD, tests frontend                         | code source                    |
| Backend      | API, stockage, TDD, tests backend                              | code source                    |
| QA           | Exécution des tests, rapports de bugs, preuves de vérification | `qa-report.md`                 |
| DevOps       | Build, déploiement, vérifications de santé                     | `deploy-report.md`             |

## Contrat de Qualité

Boss possède deux couches de contrôle qualité :
- **Exigences strictes par rôle** : le prompt de chaque agent définit un tableau d'exigences non négociables. L'agent s'auto-vérifie avant de transmettre ; un contrat échoué bloque l'étape suivante.
- **Gates de qualité** : de vraies commandes dont les verdicts sont enregistrés dans l'artefact de l'étape.

| Gate                     | Étape                       | Vérifications                                                                                  |
| ------------------------ | --------------------------- | ---------------------------------------------------------------------------------------------- |
| Gate 0 (qualité du code) | Après dev, avant QA         | TypeScript/lint passent, pas de vulnérabilités de dépendances haute sévérité                   |
| Gate 1 (tests)           | Après QA, avant déploiement | Tests unitaires + d'intégration passent, couverture ≥ 70%, pas de bugs P0/P1, tests E2E écrits |
| Gate 2 (performance)     | Avant déploiement web       | Lighthouse ≥ 80, API P99 < 500ms (projets web uniquement)                                      |

## Quand Utiliser Boss

| Bon ajustement                                                                                         | Mauvais ajustement                                                              |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| Nouvelles fonctionnalités nécessitant exigences, design, implémentation, tests et preuves de livraison | Corrections d'une ligne ou petites éditions locales                             |
| Travail API, full-stack, UI ou produit de taille moyenne                                               | Lecture ou explication de code pure                                             |
| Travail où les artefacts `.boss/<feature>/` ont de la valeur                                           | Tâches avec une spec existante complète où vous ne besoin que d'un patch rapide |
| Équipes voulant des gates de qualité répétables et des traces d'audit                                  | Travail ne nécessitant pas de coordination ou de preuves de revue               |

Règle de pouce : si vous n'avez pas besoin d'un dossier `.boss/` traçable, vous n'avez probablement pas besoin du pipeline complet `/boss`. Utilisez un seul rôle ou laissez votre agent éditer directement.

## Sécurité et Confidentialité

Boss est local-first et n'effectue aucune requête réseau sortante par défaut. La seule surface réseau est un serveur de prototype HTML opt-in et exclusif loopback (`127.0.0.1`) utilisé pendant l'étape de design UI.

La provenance de release vit dans `.agents/plugins/provenance.json`. Elle épingle l'URL HTTPS du dépôt, le SHA du commit source immuable, l'identité du publisher et les résumés SHA-256 des manifestes de plugins. Vérifiez-la avec :

```bash
npm run provenance:verify
```

Voir [PRIVACY.md](./PRIVACY.md) pour la limite complète de données et de réseau.

## Artefacts du Pipeline

```text
.boss/<feature>/
├── prd.md              # PM — exigences produit
├── architecture.md     # Architecte — conception du système
├── ui-spec.md          # Designer UI — spécification UI/UX (sauter avec --skip-ui)
├── ui-design.json      # Designer UI — JSON de design rendable
├── tech-review.md      # Tech Lead — revue technique
├── plan.md             # Tech Lead — plan d'implémentation
├── tasks.md            # Scrum Master — décomposition des tâches
├── qa-report.md        # QA — preuves de test
└── deploy-report.md    # DevOps — registre de déploiement
```

## Evals

Les evals de Boss notent des fixtures capturées sans lancer de vrai LLM :

```bash
npm run evals
npm run evals:release
```

L'eval de release inclut les vérifications release-evidence et pipeline-compliance : il vérifie l'enregistrement des artefacts, l'évitement des commandes runtime obsolètes et le comportement d'orchestration de l'escouade d'experts.

Voir [test/evals/README.md](./test/evals/README.md).

## Développement

Prérequis :
- Node.js >= 22.18

Installation :

```bash
git clone https://github.com/echoVic/boss-skill.git
cd boss-skill
npm install
npm run typecheck
npm test
```

Scripts utiles :

```bash
npm run typecheck    # tsc --noEmit
npm test             # vitest (unitaires + comportement skill + evals)
npm run test:skills  # tests de comportement skill uniquement
npm run evals        # evals déterministes de transcription
npm run lint         # biome ci
```

## Structure du Dépôt

```text
boss-skill/
├── skill/                      # Bundle de skill installé dans les agents de codage (autonome)
│   ├── SKILL.md                # Entrée d'orchestration principale (invariants + index)
│   ├── agents/                 # Prompts de rôle (boss-pm, boss-architect, ...)
│   ├── commands/               # Commandes slash (/boss, /boss:pm, ...)
│   ├── references/             # Méthodologie partagée (principles, quality-gate, ...)
│   ├── skills/                 # Skills de méthodologie par domaine (pm/, qa/, devops/, ...)
│   └── templates/              # Modèles d'artefacts (.md.template)
├── test/                       # Tests Vitest, comportement skill et evals
├── scripts/                    # release.js, provenance.js
├── docs/                       # Specs, plans et rapports historiques
├── examples/                   # Projets d'exemple
├── .claude-plugin/             # Manifeste de plugin Claude Code + marketplace
├── .codex-plugin/              # Manifeste de plugin Codex + marketplace
├── .agents/plugins/            # Marketplace de plugins au niveau du dépôt + provenance
├── tsconfig.json               # Config de typecheck uniquement (noEmit)
└── package.json                # Espace de travail de développement privé (jamais publié)
```

## Release

Utilisez le script de release pour que les numéros de version restent synchronisés entre les métadonnées du package et les manifestes de skill/plugin :

```bash
npm run release -- patch
npm run release -- minor
npm run release -- major
npm run release -- 4.1.0
npm run release -- 4.1.0 --dry-run
```

Le script de release vérifie que l'arbre de travail est propre, exécute la chaîne de vérification complète (typecheck, lint, test), synchronise les versions dans tous les manifestes, vérifie la cohérence, crée un commit et un tag, puis pousse. Le release est le tag git : les marketplaces lisent le dépôt — pas d'étape npm publish ni de build.

Voir [CONTRIBUTING.md](./CONTRIBUTING.md).

## Design

Boss est inspiré par BMAD : Breakthrough Method of Agile AI-Driven Development, et par la philosophie "write less, higher quality code". Le modèle d'escouade d'experts garde le harness léger — pas de machine à états runtime, pas d'event sourcing, pas de hooks — tout en préservant les contrats de qualité stricts et la collaboration orientée artefacts.

En savoir plus dans [DESIGN.md](./DESIGN.md), `skill/references/bmad-methodology.md` et `skill/references/principles.md`.

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=echoVic/boss-skill&type=Date)](https://star-history.com/#echoVic/boss-skill&Date)

## License

MIT
