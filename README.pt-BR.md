# boss-skill

[![npm version](https://img.shields.io/npm/v/@blade-ai/boss-skill)](https://www.npmjs.com/package/@blade-ai/boss-skill)
[![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/echoVic/boss-skill?utm_source=oss&utm_medium=github&utm_campaign=echoVic%2Fboss-skill&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)](https://coderabbit.ai)
[![Boss trust badge](https://img.shields.io/endpoint?url=https%3A%2F%2Fhol.org%2Fapi%2Fregistry%2Fbadges%2Fplugin%3Fslug%3Dechovic%252Fboss%26metric%3Dtrust%26style%3Dflat)](https://hol.org/registry/plugins/echovic%2Fboss)

**Languages / 语言 / 言語 / 언어 / Idiomas / Langues:** [English](./README.md) · [中文](./README.zh-CN.md) · [日本語](./README.ja.md) · [한국어](./README.ko.md) · [Español](./README.es.md) · [Français](./README.fr.md) · [Português](./README.pt-BR.md)

![boss-skill promo](https://raw.githubusercontent.com/echoVic/boss-skill/main/boss-skill-promo.png)

**O Boss é um workflow de equipe de agentes auditável para agentes de codificação.** Ele transforma um agente de codificação em uma equipe de engenharia estruturada: PM, Arquiteto, UI Designer, Tech Lead, Scrum Master, Frontend, Backend, QA e DevOps. Diferentemente das equipes de agentes baseadas apenas em prompts, o Boss adiciona estado de runtime, eventos append-only, gates de qualidade, avaliações determinísticas (evals), hooks e artefatos reproduzíveis.

O Boss funciona com Claude Code, Codex, OpenClaw, Antigravity e Hermes.

## Por que o Boss

A orquestração baseada apenas em prompts pode parecer organizada, mas normalmente não consegue provar que o plano foi seguido, que os testes foram executados, que os gates foram aprovados ou que o estado não foi alucinado. O Boss é construído em torno de evidências:

- **Runtime orientado a eventos (event-sourced)**: o estado do pipeline é anexado a `.boss/<feature>/.meta/events.jsonl` e projetado em um estado de execução somente leitura.
- **Gates não contornáveis**: QA, implantação e verificações finais são modelados como estágios de runtime em vez de instruções soltas.
- **Artefatos reproduzíveis**: PRDs, documentos de arquitetura, listas de tarefas, relatórios de QA, relatórios de deploy e resumos ficam em `.boss/<feature>/`.
- **Avaliações determinísticas (evals)**: transcrições capturadas podem ser pontuadas sem chamar um LLM real.
- **CLI amigável para agentes**: os comandos oferecem saída JSON, `--describe`, dry runs, campos limitados e erros estruturados.

## Use um papel ou a equipe inteira

O Boss não é um único comando monolítico. Você pode executar um papel contra um projeto existente ou rodar o pipeline completo, da ideia à entrega.

| Comando | O que faz | Quando usar |
| --- | --- | --- |
| `/boss` | Pipeline completo de 4 estágios | Você quer ir da ideia a um trabalho entregável |
| `/boss:plan` | Planejamento de PM + Arquiteto | Você quer PRD e arquitetura antes da implementação |
| `/boss:review` | Revisão do Tech Lead | Você precisa de uma revisão somente leitura de código, PR ou design |
| `/boss:qa` | QA mais gates | Você precisa de evidências de teste verificáveis |
| `/boss:ship` | Build do DevOps e verificações de implantação | Você está pronto para entregar |
| `/boss:extend` | Agente, pack ou gate personalizado | Você quer adaptar o Boss para a sua equipe |
| `/boss:upgrade` | Atualiza o Boss Skill e reinstala os hooks | Você quer o pacote npm e a configuração de hooks mais recentes |

## Quando usar o Boss

| Bom encaixe | Mau encaixe |
| --- | --- |
| Novas features que precisam de requisitos, design, implementação, testes e evidência de entrega | Correções de uma linha ou pequenas edições locais |
| Trabalho de API, full-stack, UI ou de produto de porte médio | Apenas leitura ou explicação de código |
| Trabalho em que os artefatos de `.boss/<feature>/` são valiosos | Tarefas com uma especificação existente completa em que você só precisa de um patch rápido |
| Equipes que querem gates repetíveis e trilhas de auditoria | Trabalho que não precisa de coordenação nem de evidência de revisão |

Regra prática: se você não precisa de uma pasta `.boss/` rastreável, provavelmente não precisa do pipeline completo do `/boss`. Use um único papel ou deixe o seu agente de codificação editar diretamente.

## Sem CLI? Ainda funciona

O Boss detecta a CLI `boss` em runtime. Sem ela, o workflow pode ser degradado para artefatos Markdown em `.boss/<feature>/` em vez do fluxo de eventos. A CLI é a atualização de auditabilidade: event sourcing, retomada reproduzível, avaliações determinísticas, gates em runtime e diagnósticos estruturados.

O Boss não significa "instale uma vez e tenha entrega autônoma garantida". Ele fornece um workflow de runtime e gates de evidência; o agente de codificação ativo ainda precisa seguir o protocolo do Boss.

## Início rápido

### 1. Instalação

O Boss é uma skill que você instala no seu agente de codificação — não uma ferramenta que instala outras skills.

**Recomendado — pela CLI `skills` ([vercel-labs/skills](https://github.com/vercel-labs/skills), skills.sh):**

```bash
npx skills add echoVic/boss-skill
```

Esta é a forma padrão e independente de agente de instalar uma skill: ela descobre o `boss` no repositório, pergunta o agente de destino / escopo (projeto vs global) / método de instalação e grava um `skills-lock.json` que você pode commitar. O Boss envia uma única raiz de skill, então o seletor mostra apenas `boss` — suas metodologias internas viajam junto com ela.

**Alternativa — o instalador multiagente do próprio Boss** (detecta automaticamente Claude Code, Codex, OpenClaw, Antigravity, Hermes e instala em todos eles, além de mesclar os hooks do Codex):

```bash
# One-shot, no global install
npx @blade-ai/boss-skill

# Or install globally, then run the self-install wizard
npm install -g @blade-ai/boss-skill
boss-skill
```

Para o modo plugin do Claude Code:

```bash
claude --plugin-dir "$(boss-skill path)"
```

### 2. Execute um pipeline leve

Dentro do seu agente de codificação:

```text
/boss Build a local personal todo app --roles core --skip-deploy
```

- `--roles core` usa PM, Arquiteto, Dev e QA.
- `--skip-deploy` para após a implementação e a evidência de testes.

### 3. Inspecione os resultados

```bash
boss status todo-app --json
boss runtime inspect-pipeline todo-app
```

Layout de artefatos esperado:

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

## Detalhes da instalação

```bash
npm install -g @blade-ai/boss-skill
boss-skill install
```

Comandos de instalação úteis:

```bash
boss-skill install --dry-run
boss-skill uninstall
boss-skill path
boss-skill --version
```

Destinos detectados automaticamente:

| Agente | Detecção | Método de instalação |
| --- | --- | --- |
| OpenClaw | `~/.openclaw/` | Copia para `~/.openclaw/skills/boss/` e injeta metadados |
| Codex | `~/.codex/` | Copia para `~/.codex/skills/boss/`, injeta metadados e mescla hooks |
| Antigravity | `~/.gemini/antigravity/` | Copia para o diretório de skills do Antigravity e injeta metadados |
| Hermes | `~/.hermes/` | Copia para `~/.hermes/skills/boss/` e injeta metadados |
| Claude Code | Sempre disponível | Modo plugin com `--plugin-dir` |

## Suporte a plataformas

O Boss tem como alvo Node.js `>=20` e roda em Linux, macOS e Windows. A CLI executa
comandos externos apenas por meio de `spawnSync` com arrays de argumentos explícitos
(nunca `shell: true`) e resolve `npm`/`npx` para suas variantes `.cmd` no Windows,
portanto não há nenhuma suposição exclusiva de POSIX no pipeline principal.

Duas capacidades dependem de ferramentas externas opcionais e são degradadas com
elegância quando ausentes:

- **Checkpoints de WIP** (stash/commit/branch) exigem `git` e uma árvore de trabalho git. Fora de um
  repositório, ou sem `git` no `PATH`, o checkpoint é silenciosamente ignorado — o pipeline
  não é afetado.
- **Plugins legados escritos à mão em `gate.sh`** são executados via `bash`. No Windows sem um
  bash no `PATH`, eles não conseguirão iniciar; prefira o ponto de entrada Node multiplataforma
  para gate (`gate.js` / `gate.mjs`) para plugins portáteis.

Execute `boss doctor` para ver o ambiente de runtime resolvido (versão do Node, plataforma e
se o `git` está disponível) junto com a saúde da instalação e do fluxo de eventos.

## Comandos

Comandos slash comuns:

```text
/boss Build a todo app
/boss Add authentication to this existing project --skip-ui
/boss Build an API service --skip-deploy --quick
/boss Continue the previous task --continue-from 3
/boss Lightweight mode --roles core --hitl-level off
/boss:upgrade
```

Opções comuns:

| Opção | Significado |
| --- | --- |
| `--roles <preset>` | `full` para os 9 papéis, ou `core` para PM/Arquiteto/Dev/QA |
| `--skip-ui` | Pula o design de UI |
| `--skip-deploy` | Pula a implantação |
| `--quick` | Pula os nós de confirmação e de esclarecimento de requisitos |
| `--template` | Inicializa `.boss/templates/` e pausa |
| `--continue-from <1-4>` | Retoma a partir de um estágio do pipeline |
| `--hitl-level <level>` | Modo human-in-the-loop: `auto`, `interactive` ou `off` |

Comandos da CLI do Boss:

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

Os comandos `boss` voltados a agentes usam essas opções comuns quando aplicável; execute `--describe` em um comando para obter o seu esquema JSON exato:

- `--json`: saída estruturada; stdout não-TTY usa JSON por padrão
- `--describe`: esquema JSON do comando
- `--dry-run`: plano de ação estruturado para gravações ou operações arriscadas
- `--json-input=<json|->`: payload de entrada JSON
- `--fields=<a,b>` e `--limit=<n>`: saída limitada
- `--yes`: exigido apenas para comandos não interativos de alto risco que precisam de uma confirmação extra

Erros estruturados são gravados em stderr como `{"error":{...}}` e incluem `code`, `message`, `input`, `retryable` e `suggestion`.

## Workflow

O Boss segue um workflow de quatro estágios:

```text
User request
  -> requirement clarification
  -> Stage 1: PM, Architect, UI Designer
  -> Stage 2: Tech Lead, Scrum Master
  -> Stage 3: Frontend, Backend, QA, gates
  -> Stage 4: DevOps, deployment checks, summary
```

O conjunto completo de papéis:

| Papel | Responsabilidade |
| --- | --- |
| PM | Descoberta de requisitos, PRD, necessidades ocultas, casos extremos |
| Arquiteto | Arquitetura do sistema, design técnico, APIs |
| UI Designer | Especificação de UI/UX mais JSON de design renderizável |
| Tech Lead | Revisão técnica, avaliação de riscos |
| Scrum Master | Divisão de tarefas e critérios de aceitação |
| Frontend | Implementação de UI e testes de frontend |
| Backend | API, armazenamento, testes de backend |
| QA | Execução de testes, relatórios de bugs, evidência de verificação |
| DevOps | Build, implantação, verificações de integridade |

## Runtime e gates de qualidade

O Boss tem duas camadas de controle de qualidade:

- **Restrições rígidas** verificadas por código e CI: eventos de runtime, `execution.json` protegido, hooks, testes de matriz de instalação, cenários de harness e cobertura Vitest.
- **Restrições de protocolo do agente** guiadas pelo pacote de skill: despacho via DAG, carregamento progressivo de referências, evidência de testes e disciplina de gates.

Gates integrados:

| Gate | Momento | Verificações |
| --- | --- | --- |
| Gate 0 | Após o desenvolvimento, antes do QA | TypeScript, lint, verificações básicas de compilação |
| Gate 1 | Após o QA, antes da implantação | Evidência de testes, sem bugs P0/P1, expectativas de E2E |
| Gate 2 | Antes da implantação web | Metas de Lighthouse e de latência de API quando aplicável |

Os hooks são controlados por variáveis de ambiente:

| Variável | Valores |
| --- | --- |
| `BOSS_HOOK_PROFILE` | `minimal`, `standard`, `strict` |
| `BOSS_DISABLED_HOOKS` | IDs de hooks separados por vírgula |

O estado de runtime é respaldado por `.boss/<feature>/.meta/workflow-plan.json` e `.boss/<feature>/.meta/execution.json`. A definição do workflow registra `workflowHash`, `packHash` e hashes DAG dos artefatos. A retomada do runtime usa `boss runtime resume <feature> --from-run <run-id>` para recarregar o plano, comparar as entradas dos nós e materializar `execution.workflow.nextNodeIds` para os próximos nós agendáveis. Eventos `GateEvaluated` / `WaveVerified` atualizam o status dos nós do workflow quando gates e ondas de evidência são concluídos.

## Superfícies sensíveis à segurança

O Boss mantém intencionalmente o manifesto de plugin publicado pequeno: ele declara apenas skills empacotadas e omite servidores MCP, manifestos de app e referências de assets, a menos que esses arquivos complementares existam. Os hooks do Codex são instalados pelo fluxo `boss-skill install`, não pelo manifesto do marketplace.

O pacote npm exclui configurações locais de desenvolvimento do agente, como `.claude/settings.json` e `.claude/settings.local.json`. Os metadados de plugin publicáveis ficam em `.claude-plugin/`, `.codex-plugin/` e `.agents/plugins/marketplace.json`.

A procedência do release fica em `.agents/plugins/provenance.json`. Ela fixa a URL HTTPS do repositório, o SHA do commit de origem imutável, a identidade do publicador e os digests SHA-256 dos manifestos de plugin e dos componentes sensíveis à segurança. Verifique com:

```bash
npm run provenance:verify
```

A verificação do publicador é externa ao pacote. Para o registro HOL, reivindique o plugin com a conta GitHub do proprietário do repositório em `https://hol.org/guard/plugins`. O cartão público de confiança está disponível em `https://hol.org/registry/plugins/echovic%2Fboss/embed`.

Comportamentos sensíveis à segurança para revisar antes de publicar ou instalar:

- `boss-skill install` pode gravar em diretórios de configuração do agente, como `~/.codex/skills/boss/`, e mesclar entradas gerenciadas pelo Boss em `~/.codex/hooks.json`.
- Entradas de hook executam `boss hooks run ...`, que despacha scripts de `scripts/hooks/`.
- Plugins de runtime em `.boss/plugins/<name>/plugin.json` podem registrar hooks de gate ou de relatório; revise os plugins locais do projeto antes de habilitá-los.
- Use `BOSS_HOOK_PROFILE=minimal` ou `BOSS_DISABLED_HOOKS=<ids>` quando precisar reduzir o comportamento dos hooks em um ambiente sensível.

O Boss é local-first e não faz nenhuma solicitação de rede de saída por padrão; a única superfície
de rede é o servidor opcional, somente loopback, `boss design preview`. Consulte [PRIVACY.md](PRIVACY.md)
para o limite completo de dados e rede.

## Artefatos do pipeline

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

Execute isto em um ambiente interativo para visualizar um design de UI gerado:

```bash
boss design preview <feature>
```

## Evals

As avaliações (evals) do Boss pontuam fixtures capturados sem iniciar um LLM real:

```bash
npm run evals
npm run evals:release
```

A avaliação de release inclui verificações de release-evidence e pipeline-compliance. Ela verifica o uso de comandos de runtime, o registro de artefatos, a não edição direta de `execution.json` e os campos de agendamento do workflow.

Consulte [test/evals/README.md](./test/evals/README.md).

## Desenvolvimento

Requisitos:

- Node.js >= 20
- `jq` para helpers de teste baseados em shell

Configuração:

```bash
git clone https://github.com/echoVic/boss-skill.git
cd boss-skill
npm install
npm run build
npm run typecheck
npm test
```

Scripts úteis:

```bash
npm run build
npm run typecheck
npm test
npm run test:skills
npm run test:harness
npm run test:install-matrix
npm run evals
```

## Layout do repositório

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

Áreas de origem importantes:

- `packages/boss-cli/src/` contém o código-fonte TypeScript da CLI e do runtime.
- `packages/boss-cli/dist/` contém a saída gerada da CLI usada pelo bin npm publicado; não a edite manualmente.
- `packages/boss-cli/assets/` contém DAGs integrados, pipeline packs, esquema de plugin e plugins.
- `skill/SKILL.md` é o principal ponto de entrada de orquestração voltado ao agente.
- `skill/agents/` contém os prompts dos papéis.
- `skill/commands/` contém os comandos slash.
- `skill/templates/` contém os templates de artefatos.

## Release

Use o script de release para que os números de versão permaneçam sincronizados entre os metadados do pacote e os manifestos de skill/plugin:

```bash
npm run release -- patch
npm run release -- minor
npm run release -- major
npm run release -- 3.11.0
npm run release -- 3.11.0 --dry-run
npm run release -- 3.11.0 --no-publish
```

O script de release verifica uma worktree limpa, executa os testes, sincroniza as versões, verifica a consistência, cria um commit e uma tag e publica, a menos que `--no-publish` seja usado.

Consulte [CONTRIBUTING.md](./CONTRIBUTING.md).

## Design

O Boss é inspirado no BMAD: Breakthrough Method of Agile AI-Driven Development. O projeto adapta essa ideia para um runtime auditável para trabalho de software agêntico.

Leia mais em [DESIGN.md](./DESIGN.md) e `skill/references/bmad-methodology.md`.

## Histórico de estrelas

[![Star History Chart](https://api.star-history.com/svg?repos=echoVic/boss-skill&type=Date)](https://star-history.com/#echoVic/boss-skill&Date)

## Licença

MIT
