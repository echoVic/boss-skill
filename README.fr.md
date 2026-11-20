# boss-skill

[![skills.sh](https://skills.sh/b/echovic/boss-skill)](https://skills.sh/echovic/boss-skill)
[![G-Star Incubation](https://img.shields.io/badge/G--Star-Incubation-C71D23)](https://atomgit.com/echoVic/boss-skill)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**Languages / 语言 / 言語 / 언어 / Idiomas / Langues:** [English](./README.md) · [中文](./README.zh-CN.md) · [日本語](./README.ja.md) · [한국어](./README.ko.md) · [Español](./README.es.md) · Français · [Português](./README.pt-BR.md)

![boss-skill promo](https://raw.githubusercontent.com/echoVic/boss-skill/main/boss-skill-promo.png)

> Ce projet fait partie du programme AtomGit G-Star Incubation. GitHub est le dépôt canonique et AtomGit un miroir synchronisé automatiquement. Merci de soumettre les issues et pull requests sur [GitHub](https://github.com/echoVic/boss-skill).

**Boss est un workflow d'escouade d'experts pour agents de codage.** Il transforme un agent en une équipe d'ingénierie structurée : PM, Architecte, Designer UI, Lead Technique, Scrum Master, Frontend, Backend, QA et DevOps. Chaque rôle travaille selon un contrat de qualité strict et écrit son résultat sur disque, et un vérificateur indépendant contrôle le contrat à la place de l'auteur. Lancez un seul rôle sur le code que vous avez déjà, par exemple une revue de la branche courante, ou le pipeline complet, d'une idée à une pull request.

Boss fonctionne avec Claude Code, Codex, OpenClaw, Antigravity, Hermes et DeepSeek Harness.

## DeepSeek Harness

Boss fournit aussi un bundle DeepSeek Harness, [`dsh-boss-mode`](https://www.npmjs.com/package/dsh-boss-mode), avec un preset **Boss Expert Squad** et une barre latérale qui lit en direct les membres et les tâches d'Agent Teams.

```bash
dsh plugin --profile desktop add dsh-boss-mode
```

Redémarrez DeepSeek Harness, créez une session et choisissez **Boss Expert Squad**.

## Pourquoi Boss

- **Utile sur du code existant** : `/boss:review` passe en revue le diff de la branche courante, `/boss:qa` le teste et `/boss:ship` ouvre la pull request. Chaque commande exécute son unique étape puis s'arrête.
- **Contrats de qualité stricts** : chaque rôle a un tableau d'exigences non négociable (un PRD doit contenir des scénarios Given-When-Then, une architecture doit comparer deux options, QA doit consigner la commande et le code de sortie derrière chaque affirmation).
- **L'auteur ne note pas son propre travail** : un script vérifie ce qu'un script peut trancher, puis un agent vérificateur distinct juge le reste et cite ses preuves. Un contrat non rempli bloque l'étape suivante, sauf si vous y dérogez.
- **Piloté par les artefacts** : chaque étape écrit un vrai fichier dans `.boss/<feature>/` ; la progression se juge sur le disque, pas sur ce que dit l'agent.
- **TDD par défaut** : les étapes de développement écrivent d'abord un test qui échoue, le regardent passer au RED, puis écrivent le minimum de code pour le rendre GREEN.
- **Local par défaut** : pas de télémétrie ni de proxy distant. Boss ne pousse, n'ouvre une pull request ou ne déploie que lorsque vous lancez `ship` ou que vous dites oui.

## Commandes de l'escouade d'experts

Chaque commande exécute une étape, la vérifie et s'arrête en indiquant la commande suivante :

| Commande          | Rôle               | Écrit                                                           |
| ----------------- | ------------------ | --------------------------------------------------------------- |
| `/boss:pm`        | PM                 | `prd.md`                                                        |
| `/boss:architect` | Architecte         | `architecture.md`                                               |
| `/boss:ui`        | Designer UI        | `ui-spec.md`, `ui-design.json`                                  |
| `/boss:review`    | Lead Technique     | `code-review.md` pour un diff, ou `tech-review.md` et `plan.md` |
| `/boss:tasks`     | Scrum Master       | `tasks.md`                                                      |
| `/boss:dev`       | Frontend / Backend | code et tests                                                   |
| `/boss:qa`        | QA                 | `qa-report.md`                                                  |
| `/boss:ship`      | DevOps             | une pull request, ou un déploiement avec `--deploy`             |
| `/boss:verify`    | Vérificateur       | `verification.md` pour les artefacts qui existent déjà          |

Ajoutez `--continue` pour poursuivre le long de la chaîne, ou `--stop-after <stage>` pour vous arrêter à une étape ultérieure. La chaîne complète est `pm → architect → ui → review → tasks → dev → qa → ship` ; lancez-la en entier avec `/boss:boss <request>` dans Claude Code, ou en demandant à Boss de construire quelque chose de bout en bout.

Dans Claude Code, ce sont de vraies commandes slash. Sur les autres agents, invoquez la skill Boss et nommez l'étape, par exemple « utilise Boss pour passer en revue cette branche ».

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

Le premier essai le moins coûteux est une revue en lecture seule de la branche sur laquelle vous êtes : `/boss:review` écrit `.boss/<branch>/code-review.md` et ne modifie aucun fichier source. Pour la chaîne complète :

```text
/boss:boss Build a local personal todo app --skip-ui
```

`--skip-ui` saute la conception UI pour les projets API/CLI, et `--quick` saute les clarifications de routine.

Les artefacts vivent dans `.boss/<feature>/` : `prd.md`, `architecture.md`, `ui-spec.md`, `ui-design.json`, `tech-review.md`, `plan.md`, `code-review.md`, `tasks.md`, `qa-report.md`, `deploy-report.md` et `verification.md`. Chacun commence par un résumé pour que les agents suivants lisent d'abord la conclusion. Ils sont rédigés dans la langue de votre demande ; `--lang <code>` la remplace.

## Flux de travail

Le pipeline complet, chaque étape étant vérifiée avant que la suivante ne commence :

```text
demande → clarification (sauf --quick)
  → PM : prd.md
  → Architecte : architecture.md
  → UI : ui-spec.md + ui-design.json (ignoré avec --skip-ui)
  → Lead Technique : tech-review.md + plan.md
  → Scrum Master : tasks.md
  → Frontend / Backend : implémentation TDD
  → QA : qa-report.md
  → DevOps : pull request ou déploiement, deploy-report.md
```

## Portes de qualité

Le contrat de chaque étape est contrôlé deux fois : `skill/scripts/check-artifacts.mjs` applique les règles qu'un script peut trancher, et l'agent vérificateur juge le reste. En plus des contrats, chaque porte est tranchée par une vraie commande et le verdict est consigné dans l'artefact de l'étape :

| Porte               | Étape                            | Vérifie                                                                                  |
| ------------------- | -------------------------------- | ---------------------------------------------------------------------------------------- |
| 0 (qualité du code) | après le développement, avant QA | typecheck et lint passent, aucune vulnérabilité grave dans les dépendances               |
| 1 (tests)           | après QA, avant le déploiement   | tests unitaires et d'intégration passent, couverture ≥ 70 %, aucun bug P0/P1, E2E écrits |
| 2 (performance)     | avant le déploiement web         | Lighthouse ≥ 80, API P99 < 500 ms (projets web uniquement)                               |

Si vous n'avez pas besoin d'un dossier `.boss/` traçable, vous n'avez probablement pas besoin de la chaîne complète ; utilisez un seul rôle.

## Sécurité et confidentialité

Boss est local-first et ne fait aucune requête sortante par défaut ; `ship` ne pousse ou ne déploie que lorsque vous le lancez ou le confirmez. La provenance de la release est dans `.agents/plugins/provenance.json` et fixe l'URL du dépôt, le commit source, l'éditeur et les digests des manifests ; vérifiez-la avec `npm run provenance:verify`. La frontière complète des données et du réseau est dans [PRIVACY.md](./PRIVACY.md).

## Evals

Trois couches vérifient Boss lui-même :

```bash
npm run test:install-smoke   # charge le dépôt via la CLI skills et `claude plugin validate`
npm run evals                # note les transcripts capturés ; aucun modèle n'est appelé
npm run evals:agent          # exécute evals/ sur un vrai agent Claude Code (consomme du crédit API)
```

`npm run evals:agent` encapsule [`claude plugin eval`](https://code.claude.com/docs/en/plugin-evals). Ses cas vérifient qu'une petite modification ne déclenche pas Boss, qu'une étape s'arrête une fois terminée, qu'une revue ne modifie aucun fichier source et que la vérification signale un contrat non rempli. La même suite tourne chaque semaine dans `.github/workflows/skill-behavior.yml` dès qu'un secret `ANTHROPIC_API_KEY` est configuré.

## Développement

Il faut Node.js ≥ 22.18.

```bash
git clone https://github.com/echoVic/boss-skill.git
cd boss-skill
npm install
npm run typecheck
npm test
```

Autres scripts utiles : `npm run test:skills` (analyse des transcripts), `npm run test:contracts` (le vérificateur d'artefacts), `npm run lint` (Biome). Les releases passent par `npm run release -- patch|minor|major|<version>` ; le script vérifie un arbre propre, exécute typecheck, lint et tests, puis synchronise les versions, commite, tague et pousse. Voir [CONTRIBUTING.md](./CONTRIBUTING.md) et [docs/dsh-release.md](./docs/dsh-release.md).

## Conception

Boss s'inspire de BMAD (Breakthrough Method of Agile AI-Driven Development) et de la philosophie « écrire moins, mais mieux ». Le modèle d'escouade d'experts garde le harness léger — pas de machine à états en runtime, pas d'event sourcing, pas de hooks — tout en conservant des contrats de qualité stricts et une collaboration pilotée par les artefacts. Lire [DESIGN.md](./DESIGN.md) et `skill/references/principles.md`.

## Licence

[MIT](LICENSE)
