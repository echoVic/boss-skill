# boss-skill

[![skills.sh](https://skills.sh/b/echovic/boss-skill)](https://skills.sh/echovic/boss-skill)
[![G-Star Incubation](https://img.shields.io/badge/G--Star-Incubation-C71D23)](https://atomgit.com/echoVic/boss-skill)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**Languages / 语言 / 言語 / 언어 / Idiomas / Langues:** [English](./README.md) · [中文](./README.zh-CN.md) · [日本語](./README.ja.md) · [한국어](./README.ko.md) · [Español](./README.es.md) · [Français](./README.fr.md) · Português

![boss-skill promo](https://raw.githubusercontent.com/echoVic/boss-skill/main/boss-skill-promo.png)

> Este projeto faz parte do programa AtomGit G-Star Incubation. O GitHub é o repositório canônico e o AtomGit é um espelho sincronizado automaticamente. Envie issues e pull requests no [GitHub](https://github.com/echoVic/boss-skill).

**O Boss é um fluxo de trabalho de esquadrão de especialistas para agentes de programação.** Ele transforma um agente em um time de engenharia estruturado: PM, Arquiteto, Designer de UI, Tech Lead, Scrum Master, Frontend, Backend, QA e DevOps. Cada papel trabalha segundo um contrato de qualidade rígido e grava seu resultado em disco, e um verificador independente confere o contrato no lugar do autor. Execute um único papel sobre o código que você já tem, como uma revisão da branch atual, ou o pipeline inteiro, de uma ideia até um pull request.

O Boss funciona com Claude Code, Codex, OpenClaw, Antigravity, Hermes e DeepSeek Harness.

## DeepSeek Harness

O Boss também inclui um bundle para DeepSeek Harness, [`dsh-boss-mode`](https://www.npmjs.com/package/dsh-boss-mode), com um preset **Boss Expert Squad** e uma barra lateral que lê membros e tarefas do Agent Teams em tempo real.

```bash
dsh plugin --profile desktop add dsh-boss-mode
```

Reinicie o DeepSeek Harness, crie uma sessão e escolha **Boss Expert Squad**.

## Por que o Boss

- **Útil em código existente**: `/boss:review` revisa o diff da branch atual, `/boss:qa` o testa e `/boss:ship` abre o pull request. Cada comando faz a sua única etapa e para.
- **Contratos de qualidade rígidos**: cada papel tem uma tabela de requisitos inegociável (um PRD precisa de cenários Dado-Quando-Então, a arquitetura deve comparar duas opções, o QA deve registrar o comando e o código de saída por trás de cada afirmação).
- **O autor não avalia o próprio trabalho**: um script verifica o que um script consegue decidir, depois um agente verificador separado julga o resto e cita suas evidências. Um contrato não cumprido bloqueia a próxima etapa, a menos que você o dispense.
- **Orientado por artefatos**: cada etapa grava um arquivo real em `.boss/<feature>/`; o progresso é julgado pelo que está no disco, não pelo que o agente diz.
- **TDD por padrão**: as etapas de desenvolvimento escrevem primeiro um teste que falha, veem o RED e então fazem o GREEN com o mínimo de código.
- **Local por padrão**: sem telemetria e sem proxy remoto. O Boss só faz push, abre um pull request ou faz deploy quando você executa `ship` ou diz sim.

## Comandos do esquadrão de especialistas

Cada comando executa uma etapa, verifica o resultado e para, indicando o próximo comando:

| Comando           | Papel              | Grava                                                          |
| ----------------- | ------------------ | -------------------------------------------------------------- |
| `/boss:pm`        | PM                 | `prd.md`                                                       |
| `/boss:architect` | Arquiteto          | `architecture.md`                                              |
| `/boss:ui`        | Designer de UI     | `ui-spec.md`, `ui-design.json`                                 |
| `/boss:review`    | Tech Lead          | `code-review.md` para um diff, ou `tech-review.md` e `plan.md` |
| `/boss:tasks`     | Scrum Master       | `tasks.md`                                                     |
| `/boss:dev`       | Frontend / Backend | código e testes                                                |
| `/boss:qa`        | QA                 | `qa-report.md`                                                 |
| `/boss:ship`      | DevOps             | um pull request, ou um deploy com `--deploy`                   |
| `/boss:verify`    | Verificador        | `verification.md` para os artefatos que já existem             |

Adicione `--continue` para seguir adiante na cadeia, ou `--stop-after <stage>` para parar em uma etapa posterior. A cadeia completa é `pm → architect → ui → review → tasks → dev → qa → ship`; execute-a inteira com `/boss:boss <request>` no Claude Code, ou pedindo ao Boss para construir algo de ponta a ponta.

No Claude Code, estes são slash commands de verdade. Em outros agentes, invoque a skill Boss e diga a etapa, por exemplo "use o Boss para revisar esta branch".

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

A primeira tentativa mais barata é uma revisão somente leitura da branch em que você está: `/boss:review` grava `.boss/<branch>/code-review.md` e não altera nenhum arquivo de código-fonte. Para a cadeia completa:

```text
/boss:boss Build a local personal todo app --skip-ui
```

`--skip-ui` pula o design de UI em projetos API/CLI, e `--quick` pula as clarificações de rotina.

Os artefatos ficam em `.boss/<feature>/`: `prd.md`, `architecture.md`, `ui-spec.md`, `ui-design.json`, `tech-review.md`, `plan.md`, `code-review.md`, `tasks.md`, `qa-report.md`, `deploy-report.md` e `verification.md`. Cada um começa com um resumo para que os agentes seguintes leiam a conclusão primeiro. Eles são escritos no idioma do seu pedido; `--lang <code>` substitui esse idioma.

## Fluxo de trabalho

O pipeline completo, com cada etapa verificada antes de a próxima começar:

```text
pedido → esclarecimento (exceto --quick)
  → PM: prd.md
  → Arquiteto: architecture.md
  → UI: ui-spec.md + ui-design.json (pulado com --skip-ui)
  → Tech Lead: tech-review.md + plan.md
  → Scrum Master: tasks.md
  → Frontend / Backend: implementação TDD
  → QA: qa-report.md
  → DevOps: pull request ou deploy, deploy-report.md
```

## Portões de qualidade

O contrato de cada etapa é verificado duas vezes: `skill/scripts/check-artifacts.mjs` aplica as regras que um script consegue decidir, e o agente verificador julga o resto. Além dos contratos, cada portão é decidido por um comando real e o veredito é registrado no artefato da etapa:

| Portão                  | Etapa                               | Verifica                                                                               |
| ----------------------- | ----------------------------------- | -------------------------------------------------------------------------------------- |
| 0 (qualidade do código) | após o desenvolvimento, antes do QA | typecheck e lint passam, sem vulnerabilidades graves em dependências                   |
| 1 (testes)              | após o QA, antes do deploy          | testes unitários e de integração passam, cobertura ≥ 70%, sem bugs P0/P1, E2E escritos |
| 2 (desempenho)          | antes do deploy web                 | Lighthouse ≥ 80, API P99 < 500 ms (apenas projetos web)                                |

Se você não precisa de uma pasta `.boss/` rastreável, provavelmente não precisa da cadeia completa; use um único papel.

## Segurança e privacidade

O Boss é local-first e por padrão não faz requisições externas; `ship` só faz push ou deploy quando você o executa ou confirma. A proveniência da release fica em `.agents/plugins/provenance.json` e fixa a URL do repositório, o commit de origem, o publicador e os digests dos manifestos; verifique com `npm run provenance:verify`. A fronteira completa de dados e rede está em [PRIVACY.md](./PRIVACY.md).

## Evals

Três camadas verificam o próprio Boss:

```bash
npm run test:install-smoke   # carrega o repositório pela CLI skills e por `claude plugin validate`
npm run evals                # pontua os transcripts capturados; nenhum modelo é chamado
npm run evals:agent          # roda evals/ contra um agente real do Claude Code (consome crédito de API)
```

`npm run evals:agent` encapsula [`claude plugin eval`](https://code.claude.com/docs/en/plugin-evals). Seus casos verificam que uma edição pequena não aciona o Boss, que uma etapa para quando termina, que uma revisão não edita nenhum arquivo de código-fonte e que a verificação relata um contrato quebrado. A mesma suíte roda semanalmente em `.github/workflows/skill-behavior.yml` assim que um secret `ANTHROPIC_API_KEY` é configurado.

## Desenvolvimento

Você precisa de Node.js ≥ 22.18.

```bash
git clone https://github.com/echoVic/boss-skill.git
cd boss-skill
npm install
npm run typecheck
npm test
```

Outros scripts úteis: `npm run test:skills` (análise de transcripts), `npm run test:contracts` (o verificador de artefatos), `npm run lint` (Biome). As releases usam `npm run release -- patch|minor|major|<versão>`; o script verifica se a árvore está limpa, roda typecheck, lint e testes, e então sincroniza versões, faz commit, cria a tag e envia. Veja [CONTRIBUTING.md](./CONTRIBUTING.md) e [docs/dsh-release.md](./docs/dsh-release.md).

## Design

O Boss se inspira no BMAD (Breakthrough Method of Agile AI-Driven Development) e na filosofia de "escrever menos código e com mais qualidade". O modelo de esquadrão de especialistas mantém o harness leve — sem máquina de estados em runtime, sem event sourcing, sem hooks — preservando contratos de qualidade rígidos e colaboração orientada por artefatos. Leia [DESIGN.md](./DESIGN.md) e `skill/references/principles.md`.

## Licença

[MIT](LICENSE)
