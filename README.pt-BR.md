# boss-skill

[![skills.sh](https://skills.sh/b/echovic/boss-skill)](https://skills.sh/echovic/boss-skill)
[![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/echoVic/boss-skill?utm_source=oss&utm_medium=github&utm_campaign=echoVic%2Fboss-skill&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)](https://coderabbit.ai)
[![G-Star Incubation](https://img.shields.io/badge/G--Star-Incubation-C71D23)](https://atomgit.com/echoVic/boss-skill)
[![AtomGit Mirror](https://img.shields.io/badge/AtomGit-Mirror-1F6FEB)](https://atomgit.com/echoVic/boss-skill)
[![Boss trust badge](https://img.shields.io/endpoint?url=https%3A%2F%2Fhol.org%2Fapi%2Fregistry%2Fbadges%2Fplugin%3Fslug%3Dechovic%252Fboss%26metric%3Dtrust%26style%3Dflat)](https://hol.org/registry/plugins/echovic%2Fboss)

**Languages / 语言 / 言語 / 언어 / Idiomas / Langues:** [English](./README.md) · [中文](./README.zh-CN.md) · [日本語](./README.ja.md) · [한국어](./README.ko.md) · [Español](./README.es.md) · [Français](./README.fr.md) · [Português](./README.pt-BR.md)

![boss-skill promo](https://raw.githubusercontent.com/echoVic/boss-skill/main/boss-skill-promo.png)

> Este projeto faz parte do programa AtomGit G-Star Incubation. O GitHub é o repositório canônico; o AtomGit fornece um espelho sincronizado automaticamente para acesso mais rápido na China. Por favor, envie issues e pull requests no [GitHub](https://github.com/echoVic/boss-skill).
>
> GitHub: <https://github.com/echoVic/boss-skill> · Espelho AtomGit: <https://atomgit.com/echoVic/boss-skill>

**O Boss é um workflow de esquadrão de especialistas para agentes de codificação.** Ele transforma um agente de codificação em uma equipe de engenharia estruturada: PM, Arquiteto, Designer de UI, Tech Lead, Scrum Master, Frontend, Backend, QA e DevOps. Ao contrário das equipes de agentes baseadas apenas em prompts, o Boss impõe contratos de qualidade rígidos por papel, produz artefatos reproduzíveis e encadeia etapas automaticamente — comece onde quiser, ele executa o resto até você dizer para parar.

O Boss funciona com Claude Code, Codex, OpenClaw, Antigravity e Hermes.

## Por que o Boss

A orquestração baseada apenas em prompts pode parecer organizada, mas geralmente não consegue provar que o plano foi seguido, que os testes foram executados ou que os gates foram passados. O Boss é construído em torno de evidência e contratos rígidos:
- **Contratos de qualidade rígidos**: cada papel possui uma tabela de requisitos inegociáveis (por exemplo, o PRD deve incluir cenários Given-When-Then; a arquitetura deve comparar pelo menos duas opções; o QA deve registrar evidência verificada ou honestamente não verificada). Contratos falhos bloqueiam a próxima etapa a menos que você os anule explicitamente.
- **Orientado a artefatos**: cada etapa escreve um arquivo real sob `.boss/<feature>/`. O progresso é julgado pelos artefatos em disco, não pelo que o agente afirma.
- **Cadeia de continuação**: comece em qualquer etapa (`/boss:pm`, `/boss:dev`, ...) e o Boss executa automaticamente todas as etapas posteriores até `ship` ou até você parar. Sem entregas manuais.
- **Princípios de engenharia**: o esquadrão compartilha dez princípios — verificar o produto real, corrigir causas raiz, construir a alavanca, modelar o domínio, disciplina de limites, sequenciar unidades verificáveis, testar o comportamento, minimizar a carga do leitor, experiência estruturada, regras autônomas. Cada agente cita o princípio que aplica.
- **TDD por padrão**: as etapas de desenvolvimento devem primeiro escrever um teste que falha, ver o estado RED e depois escrever o código mínimo para chegar ao GREEN.
- **Zero rede por padrão**: sem telemetria, sem phone-home, sem proxy LLM remoto. A única superfície de rede é um servidor de preview loopback opt-in (`127.0.0.1`) para prototipagem de UI. Veja [PRIVACY.md](./PRIVACY.md).
- **Evals determinísticos**: as transcrições capturadas são pontuadas sem chamar um LLM real.

## Comandos do Esquadrão de Especialistas

O Boss não é um único comando monolítico. Cada comando de barra é um ponto de entrada; por padrão ele executa automaticamente todas as etapas posteriores.

| Comando           | Começa em        | Executa até            | Quando usar                          |
| ----------------- | ---------------- | ---------------------- | ------------------------------------ |
| `/boss`           | PM               | cadeia completa → ship | Ir da ideia ao trabalho entregável   |
| `/boss:pm`        | PM               | Architect → ... → Ship | Começar pelos requisitos             |
| `/boss:architect` | Architect        | UI → ... → Ship        | Você tem uma spec, precisa de design |
| `/boss:ui`        | Designer de UI   | Review → ... → Ship    | Você tem arquitetura, precisa de UI  |
| `/boss:review`    | Tech Lead        | Tasks → ... → Ship     | Precisa de revisão técnica + plano   |
| `/boss:tasks`     | Scrum Master     | Dev → QA → Ship        | Precisa de decomposição de tarefas   |
| `/boss:dev`       | Frontend/Backend | QA → Ship              | Começar a implementação              |
| `/boss:qa`        | QA               | Ship                   | Precisa de evidência de teste        |
| `/boss:ship`      | DevOps           | (fim)                  | Apenas implantar                     |

A cadeia completa:

```
pm → architect → ui → review → tasks → dev → qa → ship
```

Pare a cadeia dizendo "pare", "só faça este passo" ou passando `--stop-after <etapa>`.

## Início Rápido

### 1. Instalar

O Boss é uma skill que você instala no seu agente de codificação. A distribuição é apenas por marketplace: sem pacote npm, sem binário global.

**Claude Code — marketplace de plugins (recomendado):**

```text
/plugin marketplace add echoVic/boss-skill
/plugin install boss@boss-skill
```

**Codex — marketplace de plugins:**

```bash
codex plugin marketplace add echoVic/boss-skill
```

Depois abra o navegador de plugins (`/plugins`) e instale o **boss**.

**Qualquer agente — via o CLI `skills` ([vercel-labs/skills](https://github.com/vercel-labs/skills), skills.sh):**

```bash
npx skills add echoVic/boss-skill
```

### 2. Teste em um projeto que você já tem

A primeira execução de menor custo é uma revisão somente leitura contra código existente:

```
/boss:review
```

Você obtém `tech-review.md` (e `plan.md`) sob `.boss/<feature>/` com riscos, achados e severidade. Nenhum outro arquivo do repositório é tocado.

Quer evidência de teste verificável em vez disso? `/boss:qa` executa os testes e escreve `qa-report.md`.

### 3. Execute o Pipeline Completo

Dentro do seu agente de codificação:

```text
/boss Build a local personal todo app --skip-ui
```

- `--skip-ui` pula a etapa de design de UI (projetos API/CLI puros).
- `--quick` pula os prompts de confirmação rotineiros.

### 4. Inspecione os Resultados

Os artefatos ficam sob `.boss/<feature>/`:

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

Cada artefato Markdown começa com uma seção `## 摘要` (resumo) para que os agentes posteriores leiam a conclusão primeiro.

## Fluxo de Trabalho

```text
Solicitação do usuário
  → esclarecimento de requisitos (exceto --quick)
  → PM: descoberta de requisitos → prd.md
  → Arquiteto: design do sistema → architecture.md
  → Designer de UI: especificação UI/UX → ui-spec.md + ui-design.json (pular com --skip-ui)
  → Tech Lead: revisão técnica + plano de implementação → tech-review.md + plan.md
  → Scrum Master: decomposição de tarefas → tasks.md
  → Frontend / Backend: implementação TDD
  → QA: execução de testes, relatórios de bugs, evidência → qa-report.md
  → DevOps: build, implantação, verificações de saúde → deploy-report.md
```

### Papéis e Artefatos

| Papel          | Responsabilidade                                                    | Artefato                       |
| -------------- | ------------------------------------------------------------------- | ------------------------------ |
| PM             | Descoberta de requisitos, PRD, necessidades ocultas, casos de borda | `prd.md`                       |
| Arquiteto      | Arquitetura do sistema, design técnico, APIs                        | `architecture.md`              |
| Designer de UI | Especificação UI/UX, JSON de design renderizável, protótipo HTML    | `ui-spec.md`, `ui-design.json` |
| Tech Lead      | Revisão técnica, avaliação de riscos, plano de implementação        | `tech-review.md`, `plan.md`    |
| Scrum Master   | Decomposição de tarefas e critérios de aceitação                    | `tasks.md`                     |
| Frontend       | Implementação de UI, TDD, testes de frontend                        | código-fonte                   |
| Backend        | API, armazenamento, TDD, testes de backend                          | código-fonte                   |
| QA             | Execução de testes, relatórios de bugs, evidência de verificação    | `qa-report.md`                 |
| DevOps         | Build, implantação, verificações de saúde                           | `deploy-report.md`             |

## Contrato de Qualidade

O Boss possui duas camadas de controle de qualidade:
- **Requisitos rígidos por papel**: o prompt de cada agente define uma tabela de requisitos inegociáveis. O agente se auto-verifica antes de entregar; um contrato falho bloqueia a próxima etapa.
- **Gates de qualidade**: comandos reais cujos vereditos são registrados no artefato da etapa.

| Gate                         | Etapa                       | Verificações                                                                                  |
| ---------------------------- | --------------------------- | --------------------------------------------------------------------------------------------- |
| Gate 0 (qualidade do código) | Após dev, antes de QA       | TypeScript/lint passam, sem vulnerabilidades de dependências de alta severidade               |
| Gate 1 (testes)              | Após QA, antes de implantar | Testes unitários + de integração passam, cobertura ≥ 70%, sem bugs P0/P1, testes E2E escritos |
| Gate 2 (performance)         | Antes de implantar web      | Lighthouse ≥ 80, API P99 < 500ms (apenas projetos web)                                        |

## Quando Usar o Boss

| Bom ajuste                                                                                             | Mau ajuste                                                                      |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| Novas funcionalidades que precisam de requisitos, design, implementação, testes e evidência de entrega | Correções de uma linha ou pequenas edições locais                               |
| Trabalho de API, full-stack, UI ou produto de tamanho médio                                            | Leitura ou explicação de código pura                                            |
| Trabalho onde os artefatos `.boss/<feature>/` são valiosos                                             | Tarefas com uma spec existente completa onde você só precisa de um patch rápido |
| Equipes que querem gates de qualidade repetíveis e trilhas de auditoria                                | Trabalho que não precisa de coordenação ou evidência de revisão                 |

Regra de bolso: se você não precisa de uma pasta `.boss/` rastreável, provavelmente não precisa do pipeline completo `/boss`. Use um único papel ou deixe seu agente editar diretamente.

## Segurança e Privacidade

O Boss é local-first e não faz solicitações de rede de saída por padrão. A única superfície de rede é um servidor de protótipo HTML opt-in e exclusivo de loopback (`127.0.0.1`) usado durante a etapa de design de UI.

A procedência do release fica em `.agents/plugins/provenance.json`. Ela fixa a URL HTTPS do repositório, o SHA do commit de origem imutável, a identidade do publicador e os resumos SHA-256 dos manifestos de plugins. Verifique com:

```bash
npm run provenance:verify
```

Veja [PRIVACY.md](./PRIVACY.md) para o limite completo de dados e rede.

## Artefatos do Pipeline

```text
.boss/<feature>/
├── prd.md              # PM — requisitos do produto
├── architecture.md     # Arquiteto — design do sistema
├── ui-spec.md          # Designer de UI — especificação UI/UX (pular com --skip-ui)
├── ui-design.json      # Designer de UI — JSON de design renderizável
├── tech-review.md      # Tech Lead — revisão técnica
├── plan.md             # Tech Lead — plano de implementação
├── tasks.md            # Scrum Master — decomposição de tarefas
├── qa-report.md        # QA — evidência de teste
└── deploy-report.md    # DevOps — registro de implantação
```

## Evals

Os evals do Boss pontuam fixtures capturados sem iniciar um LLM real:

```bash
npm run evals
npm run evals:release
```

O eval de release inclui verificações de release-evidence e pipeline-compliance: verifica o registro de artefatos, a evitação de comandos de runtime obsoletos e o comportamento de orquestração do esquadrão de especialistas.

Veja [test/evals/README.md](./test/evals/README.md).

## Desenvolvimento

Requisitos:
- Node.js >= 22.18

Configuração:

```bash
git clone https://github.com/echoVic/boss-skill.git
cd boss-skill
npm install
npm run typecheck
npm test
```

Scripts úteis:

```bash
npm run typecheck    # tsc --noEmit
npm test             # vitest (unitárias + comportamento de skill + evals)
npm run test:skills  # apenas testes de comportamento de skill
npm run evals        # evals determinísticos de transcrição
npm run lint         # biome ci
```

## Estrutura do Repositório

```text
boss-skill/
├── skill/                      # Bundle de skill instalado em agentes de codificação (autocontido)
│   ├── SKILL.md                # Entrada principal de orquestração (invariantes + índice)
│   ├── agents/                 # Prompts de papel (boss-pm, boss-architect, ...)
│   ├── commands/               # Comandos de barra (/boss, /boss:pm, ...)
│   ├── references/             # Metodologia compartilhada (principles, quality-gate, ...)
│   ├── skills/                 # Skills de metodologia por domínio (pm/, qa/, devops/, ...)
│   └── templates/              # Modelos de artefatos (.md.template)
├── test/                       # Testes de Vitest, comportamento de skill e evals
├── scripts/                    # release.js, provenance.js
├── docs/                       # Specs, planos e relatórios históricos
├── examples/                   # Projetos de exemplo
├── .claude-plugin/             # Manifesto de plugin Claude Code + marketplace
├── .codex-plugin/              # Manifesto de plugin Codex + marketplace
├── .agents/plugins/            # Marketplace de plugins no nível do repositório + provenance
├── tsconfig.json               # Configuração de typecheck apenas (noEmit)
└── package.json                # Workspace de desenvolvimento privado (nunca publicado)
```

## Release

Use o script de release para que os números de versão permaneçam sincronizados entre os metadados do pacote e os manifestos de skill/plugin:

```bash
npm run release -- patch
npm run release -- minor
npm run release -- major
npm run release -- 4.1.0
npm run release -- 4.1.0 --dry-run
```

O script de release verifica se a árvore de trabalho está limpa, executa a cadeia de verificação completa (typecheck, lint, test), sincroniza as versões em todos os manifestos, verifica a consistência, cria um commit e uma tag, e faz push. O release é a tag git: os marketplaces leem o repositório — não há etapa de npm publish nem de build.

Veja [CONTRIBUTING.md](./CONTRIBUTING.md).

## Design

O Boss é inspirado no BMAD: Breakthrough Method of Agile AI-Driven Development, e na filosofia "write less, higher quality code". O modelo de esquadrão de especialistas mantém o harness leve — sem máquina de estados de runtime, sem event sourcing, sem hooks — enquanto preserva os contratos de qualidade rígidos e a colaboração orientada a artefatos.

Leia mais em [DESIGN.md](./DESIGN.md), `skill/references/bmad-methodology.md` e `skill/references/principles.md`.

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=echoVic/boss-skill&type=Date)](https://star-history.com/#echoVic/boss-skill&Date)

## License

MIT
