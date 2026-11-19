# boss-skill

[![skills.sh](https://skills.sh/b/echovic/boss-skill)](https://skills.sh/echovic/boss-skill)
[![G-Star Incubation](https://img.shields.io/badge/G--Star-Incubation-C71D23)](https://atomgit.com/echoVic/boss-skill)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**Languages / 语言 / 言語 / 언어 / Idiomas / Langues:** [English](./README.md) · [中文](./README.zh-CN.md) · [日本語](./README.ja.md) · [한국어](./README.ko.md) · [Español](./README.es.md) · Français · [Português](./README.pt-BR.md)

![boss-skill promo](https://raw.githubusercontent.com/echoVic/boss-skill/main/boss-skill-promo.png)

> Ce projet fait partie du programme AtomGit G-Star Incubation. GitHub est le dépôt canonique et AtomGit un miroir synchronisé automatiquement. Merci de soumettre les issues et pull requests sur [GitHub](https://github.com/echoVic/boss-skill).

**Boss est un workflow d'escouade d'experts pour agents de codage.** Il transforme un agent en une équipe d'ingénierie structurée : PM, Architecte, Designer UI, Lead Technique, Scrum Master, Frontend, Backend, QA et DevOps. Contrairement aux équipes d'agents purement conversationnelles, Boss impose un contrat de qualité strict par rôle, produit des artefacts rejouables et enchaîne les étapes automatiquement — commencez n'importe où, il exécute le reste jusqu'à ce que vous disiez stop.

Boss fonctionne avec Claude Code, Codex, OpenClaw, Antigravity, Hermes et DeepSeek Harness.

## DeepSeek Harness

Boss fournit aussi un bundle DeepSeek Harness, [`dsh-boss-mode`](https://www.npmjs.com/package/dsh-boss-mode), avec un preset **Boss Expert Squad** et une barre latérale qui lit en direct les membres et les tâches d'Agent Teams.

```bash
dsh plugin --profile desktop add dsh-boss-mode
```

Redémarrez DeepSeek Harness, créez une session et choisissez **Boss Expert Squad**.

## Pourquoi Boss

- **Contrats de qualité stricts** : chaque rôle a un tableau d'exigences non négociable (un PRD doit contenir des scénarios Given-When-Then, une architecture doit comparer deux options, QA doit consigner des preuves vérifiées ou honnêtement non vérifiées). Un contrat non rempli bloque l'étape suivante, sauf autorisation explicite.
- **Piloté par les artefacts** : chaque étape écrit un vrai fichier dans `.boss/<feature>/` ; la progression se juge sur le disque, pas sur ce que dit l'agent.
- **Chaîne de continuation** : démarrez à n'importe quelle étape et Boss exécute automatiquement toutes les suivantes jusqu'à `ship`.
- **TDD par défaut** : les étapes de développement écrivent d'abord un test qui échoue, le regardent passer au RED, puis écrivent le minimum de code pour le rendre GREEN.
- **Local par défaut** : pas de télémétrie ni de proxy distant ; la seule surface réseau est un serveur de prévisualisation optionnel sur `127.0.0.1`.

## Commandes de l'escouade d'experts

Chaque commande est un point d'entrée qui enchaîne automatiquement les étapes suivantes :

| Commande          | Démarre à          | Enchaîne jusqu'à          |
| ----------------- | ------------------ | ------------------------- |
| `/boss`           | PM                 | la chaîne complète → ship |
| `/boss:pm`        | PM                 | Architecte → … → Ship     |
| `/boss:architect` | Architecte         | UI → … → Ship             |
| `/boss:ui`        | Designer UI        | Revue → … → Ship          |
| `/boss:review`    | Lead Technique     | Tâches → … → Ship         |
| `/boss:tasks`     | Scrum Master       | Développement → QA → Ship |
| `/boss:dev`       | Frontend / Backend | QA → Ship                 |
| `/boss:qa`        | QA                 | Ship                      |
| `/boss:ship`      | DevOps             | termine la chaîne         |

La chaîne complète est `pm → architect → ui → review → tasks → dev → qa → ship`. Arrêtez-la en disant « stop », « seulement cette étape », ou avec `--stop-after <stage>`.

## Démarrage rapide

Installez Boss dans votre agent de codage — la skill passe par les marketplaces et le bundle DeepSeek Harness est publié à part sur npm :

```text
# Claude Code
/plugin marketplace add echoVic/boss-skill
/plugin install boss@boss-skill

# Codex
codex plugin marketplace add echoVic/boss-skill   # puis installez boss dans /plugins

# N'importe quel agent avec la CLI skills
npx skills add echoVic/boss-skill

# DeepSeek Harness
dsh plugin --profile desktop add dsh-boss-mode
```

Le premier essai le moins coûteux est une revue en lecture seule du code existant : `/boss:review` écrit `tech-review.md` et `plan.md` et ne touche à rien d'autre. Pour la chaîne complète :

```text
/boss Build a local personal todo app --skip-ui
```

`--skip-ui` saute la conception UI pour les projets API/CLI, et `--quick` saute les clarifications de routine.

Les artefacts vivent dans `.boss/<feature>/` : `prd.md`, `architecture.md`, `ui-spec.md`, `ui-design.json`, `tech-review.md`, `plan.md`, `tasks.md`, `qa-report.md` et `deploy-report.md`. Chacun commence par un résumé pour que les agents suivants lisent d'abord la conclusion.

## Flux de travail

```text
demande → clarification (sauf --quick)
  → PM : prd.md
  → Architecte : architecture.md
  → UI : ui-spec.md + ui-design.json (ignoré avec --skip-ui)
  → Lead Technique : tech-review.md + plan.md
  → Scrum Master : tasks.md
  → Frontend / Backend : implémentation TDD
  → QA : qa-report.md
  → DevOps : deploy-report.md
```

## Portes de qualité

En plus des contrats par rôle, chaque porte est tranchée par une vraie commande et le verdict est consigné dans l'artefact de l'étape :

| Porte               | Étape                            | Vérifie                                                                                  |
| ------------------- | -------------------------------- | ---------------------------------------------------------------------------------------- |
| 0 (qualité du code) | après le développement, avant QA | typecheck et lint passent, aucune vulnérabilité grave dans les dépendances               |
| 1 (tests)           | après QA, avant le déploiement   | tests unitaires et d'intégration passent, couverture ≥ 70 %, aucun bug P0/P1, E2E écrits |
| 2 (performance)     | avant le déploiement web         | Lighthouse ≥ 80, API P99 < 500 ms (projets web uniquement)                               |

Si vous n'avez pas besoin d'un dossier `.boss/` traçable, vous n'avez probablement pas besoin de la chaîne complète ; utilisez un seul rôle.

## Sécurité et confidentialité

Boss est local-first et ne fait aucune requête sortante par défaut. La provenance de la release est dans `.agents/plugins/provenance.json` et fixe l'URL du dépôt, le commit source, l'éditeur et les digests des manifests ; vérifiez-la avec `npm run provenance:verify`. La frontière complète des données et du réseau est dans [PRIVACY.md](./PRIVACY.md).

## Evals

Les transcripts capturés sont notés sans démarrer de vrai LLM :

```bash
npm run evals
npm run evals:release   # ajoute les contrôles de preuve de release et de conformité du pipeline
```

## Développement

Il faut Node.js ≥ 22.18.

```bash
git clone https://github.com/echoVic/boss-skill.git
cd boss-skill
npm install
npm run typecheck
npm test
```

Autres scripts utiles : `npm run test:skills` (comportement de la skill seulement), `npm run evals`, `npm run lint` (Biome). Les releases passent par `npm run release -- patch|minor|major|<version>` ; le script vérifie un arbre propre, exécute typecheck, lint et tests, puis synchronise les versions, commite, tague et pousse. Voir [CONTRIBUTING.md](./CONTRIBUTING.md) et [docs/dsh-release.md](./docs/dsh-release.md).

## Conception

Boss s'inspire de BMAD (Breakthrough Method of Agile AI-Driven Development) et de la philosophie « écrire moins, mais mieux ». Le modèle d'escouade d'experts garde le harness léger — pas de machine à états en runtime, pas d'event sourcing, pas de hooks — tout en conservant des contrats de qualité stricts et une collaboration pilotée par les artefacts. Lire [DESIGN.md](./DESIGN.md) et `skill/references/principles.md`.

## Licence

[MIT](LICENSE)
