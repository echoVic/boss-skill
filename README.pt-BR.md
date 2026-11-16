# boss-skill

[![skills.sh](https://skills.sh/b/echovic/boss-skill)](https://skills.sh/echovic/boss-skill)
[![G-Star Incubation](https://img.shields.io/badge/G--Star-Incubation-C71D23)](https://atomgit.com/echoVic/boss-skill)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**Languages / 语言 / 言語 / 언어 / Idiomas / Langues:** [English](./README.md) · [中文](./README.zh-CN.md) · [日本語](./README.ja.md) · [한국어](./README.ko.md) · [Español](./README.es.md) · [Français](./README.fr.md) · Português

![boss-skill promo](https://raw.githubusercontent.com/echoVic/boss-skill/main/boss-skill-promo.png)

> Este projeto faz parte do programa AtomGit G-Star Incubation. O GitHub é o repositório canônico e o AtomGit é um espelho sincronizado automaticamente. Envie issues e pull requests no [GitHub](https://github.com/echoVic/boss-skill).

**O Boss é um fluxo de trabalho de esquadrão de especialistas para agentes de programação.** Ele transforma um agente em um time de engenharia estruturado: PM, Arquiteto, Designer de UI, Tech Lead, Scrum Master, Frontend, Backend, QA e DevOps. Diferente de times de agentes só com prompts, o Boss impõe um contrato de qualidade rígido por papel, produz artefatos reproduzíveis e encadeia as etapas automaticamente — comece em qualquer ponto e ele executa o resto até você mandar parar.

O Boss funciona com Claude Code, Codex, OpenClaw, Antigravity, Hermes e DeepSeek Harness.

## DeepSeek Harness

O Boss também inclui um bundle para DeepSeek Harness, [`dsh-boss-mode`](https://www.npmjs.com/package/dsh-boss-mode), com um preset **Boss Expert Squad** e uma barra lateral que lê membros e tarefas do Agent Teams em tempo real.

```bash
dsh plugin --profile desktop add dsh-boss-mode
```

Reinicie o DeepSeek Harness, crie uma sessão e escolha **Boss Expert Squad**.

## Por que o Boss

- **Contratos de qualidade rígidos**: cada papel tem uma tabela de requisitos inegociável (um PRD precisa de cenários Dado-Quando-Então, a arquitetura deve comparar duas opções, o QA deve registrar evidências verificadas ou honestamente declaradas como não verificadas). Um contrato não cumprido bloqueia a próxima etapa, a menos que você autorize.
- **Orientado por artefatos**: cada etapa grava um arquivo real em `.boss/<feature>/`; o progresso é julgado pelo que está no disco, não pelo que o agente diz.
- **Cadeia de continuação**: comece em qualquer etapa e o Boss executa automaticamente todas as etapas seguintes até `ship`.
- **TDD por padrão**: as etapas de desenvolvimento escrevem primeiro um teste que falha, veem o RED e então fazem o GREEN com o mínimo de código.
- **Local por padrão**: sem telemetria e sem proxy remoto; a única superfície de rede é um servidor de pré-visualização opcional em `127.0.0.1`.

## Comandos do esquadrão de especialistas

Cada comando é um ponto de entrada que executa automaticamente as etapas seguintes:

| Comando | Começa em | Executa até |
| --- | --- | --- |
| `/boss` | PM | a cadeia completa → ship |
| `/boss:pm` | PM | Arquiteto → … → Ship |
| `/boss:architect` | Arquiteto | UI → … → Ship |
| `/boss:ui` | Designer de UI | Revisão → … → Ship |
| `/boss:review` | Tech Lead | Tarefas → … → Ship |
| `/boss:tasks` | Scrum Master | Desenvolvimento → QA → Ship |
| `/boss:dev` | Frontend / Backend | QA → Ship |
| `/boss:qa` | QA | Ship |
| `/boss:ship` | DevOps | encerra a cadeia |

A cadeia completa é `pm → architect → ui → review → tasks → dev → qa → ship`. Pare dizendo "stop", "só este passo", ou passando `--stop-after <stage>`.

## Início rápido

Instale o Boss no seu agente de programação — a skill é distribuída pelos marketplaces e o bundle do DeepSeek Harness é publicado separadamente no npm:

```text
# Claude Code
/plugin marketplace add echoVic/boss-skill
/plugin install boss@boss-skill

# Codex
codex plugin marketplace add echoVic/boss-skill   # depois instale boss em /plugins

# Qualquer agente com a CLI skills
npx skills add echoVic/boss-skill

# DeepSeek Harness
dsh plugin --profile desktop add dsh-boss-mode
```

A primeira tentativa mais barata é uma revisão somente leitura do código existente: `/boss:review` grava `tech-review.md` e `plan.md` e não toca em mais nada. Para a cadeia completa:

```text
/boss Build a local personal todo app --skip-ui
```

`--skip-ui` pula o design de UI em projetos API/CLI, e `--quick` pula as clarificações de rotina.

Os artefatos ficam em `.boss/<feature>/`: `prd.md`, `architecture.md`, `ui-spec.md`, `ui-design.json`, `tech-review.md`, `plan.md`, `tasks.md`, `qa-report.md` e `deploy-report.md`. Cada um começa com um resumo para que os agentes seguintes leiam a conclusão primeiro.

## Fluxo de trabalho

```text
pedido → esclarecimento (exceto --quick)
  → PM: prd.md
  → Arquiteto: architecture.md
  → UI: ui-spec.md + ui-design.json (pulado com --skip-ui)
  → Tech Lead: tech-review.md + plan.md
  → Scrum Master: tasks.md
  → Frontend / Backend: implementação TDD
  → QA: qa-report.md
  → DevOps: deploy-report.md
```

## Portões de qualidade

Além dos contratos por papel, cada portão é decidido por um comando real e o veredito é registrado no artefato da etapa:

| Portão | Etapa | Verifica |
| --- | --- | --- |
| 0 (qualidade do código) | após o desenvolvimento, antes do QA | typecheck e lint passam, sem vulnerabilidades graves em dependências |
| 1 (testes) | após o QA, antes do deploy | testes unitários e de integração passam, cobertura ≥ 70%, sem bugs P0/P1, E2E escritos |
| 2 (desempenho) | antes do deploy web | Lighthouse ≥ 80, API P99 < 500 ms (apenas projetos web) |

Se você não precisa de uma pasta `.boss/` rastreável, provavelmente não precisa da cadeia completa; use um único papel.

## Segurança e privacidade

O Boss é local-first e por padrão não faz requisições externas. A proveniência da release fica em `.agents/plugins/provenance.json` e fixa a URL do repositório, o commit de origem, o publicador e os digests dos manifestos; verifique com `npm run provenance:verify`. A fronteira completa de dados e rede está em [PRIVACY.md](./PRIVACY.md).

## Evals

Os transcripts capturados são pontuados sem iniciar um LLM real:

```bash
npm run evals
npm run evals:release   # adiciona checagens de evidência de release e conformidade do pipeline
```

## Desenvolvimento

Você precisa de Node.js ≥ 22.18.

```bash
git clone https://github.com/echoVic/boss-skill.git
cd boss-skill
npm install
npm run typecheck
npm test
```

Outros scripts úteis: `npm run test:skills` (somente o comportamento da skill), `npm run evals`, `npm run lint` (Biome). As releases usam `npm run release -- patch|minor|major|<versão>`; o script verifica se a árvore está limpa, roda typecheck, lint e testes, e então sincroniza versões, faz commit, cria a tag e envia. Veja [CONTRIBUTING.md](./CONTRIBUTING.md) e [docs/dsh-release.md](./docs/dsh-release.md).

## Design

O Boss se inspira no BMAD (Breakthrough Method of Agile AI-Driven Development) e na filosofia de "escrever menos código e com mais qualidade". O modelo de esquadrão de especialistas mantém o harness leve — sem máquina de estados em runtime, sem event sourcing, sem hooks — preservando contratos de qualidade rígidos e colaboração orientada por artefatos. Leia [DESIGN.md](./DESIGN.md) e `skill/references/principles.md`.

## Licença

[MIT](LICENSE)
