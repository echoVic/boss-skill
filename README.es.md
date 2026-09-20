# boss-skill

[![npm version](https://img.shields.io/npm/v/@blade-ai/boss-skill)](https://www.npmjs.com/package/@blade-ai/boss-skill)
[![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/echoVic/boss-skill?utm_source=oss&utm_medium=github&utm_campaign=echoVic%2Fboss-skill&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)](https://coderabbit.ai)
[![Boss trust badge](https://img.shields.io/endpoint?url=https%3A%2F%2Fhol.org%2Fapi%2Fregistry%2Fbadges%2Fplugin%3Fslug%3Dechovic%252Fboss%26metric%3Dtrust%26style%3Dflat)](https://hol.org/registry/plugins/echovic%2Fboss)

**Languages / 语言 / 言語 / 언어 / Idiomas / Langues:** [English](./README.md) · [中文](./README.zh-CN.md) · [日本語](./README.ja.md) · [한국어](./README.ko.md) · [Español](./README.es.md) · [Français](./README.fr.md) · [Português](./README.pt-BR.md)

![boss-skill promo](https://raw.githubusercontent.com/echoVic/boss-skill/main/boss-skill-promo.png)

**Boss es un flujo de trabajo de equipo de agentes auditable para agentes de programación.** Convierte un agente de programación en un equipo de ingeniería estructurado: PM, Arquitecto, Diseñador de UI, Tech Lead, Scrum Master, Frontend, Backend, QA y DevOps. A diferencia de los equipos de agentes basados solo en prompts, Boss añade estado del runtime, eventos append-only, puertas de calidad, evaluaciones deterministas, hooks y artefactos reproducibles.

Boss funciona con Claude Code, Codex, OpenClaw, Antigravity y Hermes.

## Por qué Boss

La orquestación basada solo en prompts puede parecer organizada, pero normalmente no puede demostrar que se siguió el plan, que se ejecutaron las pruebas, que se superaron las puertas o que el estado no fue alucinado. Boss se construye en torno a la evidencia:

- **Runtime con event sourcing**: el estado del pipeline se agrega a `.boss/<feature>/.meta/events.jsonl` y se proyecta en un estado de ejecución de solo lectura.
- **Puertas verificables**: QA, el despliegue y las comprobaciones finales se ejecutan como comandos reales cuyos veredictos quedan registrados como eventos. `boss gate final` y `boss doctor` fallan cuando una etapa marcada como completada arrastra una puerta fallida. La aplicación sigue dependiendo de que el agente orquestador respete el protocolo: la CLI hace que el veredicto sea comprobable, no inevitable.
- **Artefactos reproducibles**: los PRD, los documentos de arquitectura, las listas de tareas, los informes de QA, los informes de despliegue y los resúmenes viven bajo `.boss/<feature>/`.
- **Evaluaciones deterministas**: las transcripciones capturadas se pueden puntuar sin llamar a un LLM real.
- **CLI amigable para agentes**: los comandos admiten salida JSON, `--describe`, ejecuciones en seco, campos acotados y errores estructurados.

## Usa un rol o todo el equipo

Boss no es un único comando monolítico. Puedes ejecutar un rol sobre un proyecto existente, o ejecutar el pipeline completo desde la idea hasta la entrega.

| Comando | Qué hace | Cuándo usarlo |
| --- | --- | --- |
| `/boss` | Pipeline completo de 4 etapas | Quieres pasar de la idea a un trabajo entregable |
| `/boss:plan` | Planificación de PM + Arquitecto | Quieres el PRD y la arquitectura antes de la implementación |
| `/boss:review` | Revisión del Tech Lead | Necesitas una revisión de código, PR o diseño de solo lectura |
| `/boss:qa` | QA más puertas | Necesitas evidencia de pruebas verificable |
| `/boss:ship` | Comprobaciones de build y despliegue de DevOps | Estás listo para entregar |
| `/boss:extend` | Agente, pack o puerta personalizados | Quieres adaptar Boss a tu equipo |
| `/boss:upgrade` | Actualiza Boss Skill y reinstala los hooks | Quieres el paquete npm y la configuración de hooks más recientes |

## Inicio rápido

### 1. Instalación

Boss es una skill que instalas en tu agente de programación — no una herramienta que instala otras skills.

**Recomendado — mediante la CLI `skills` ([vercel-labs/skills](https://github.com/vercel-labs/skills), skills.sh):**

```bash
npx skills add echoVic/boss-skill
```

Esta es la forma estándar e independiente del agente de instalar una skill: descubre `boss` en el repositorio, pregunta por el agente de destino, el alcance (proyecto o global) y el método de instalación, y registra un `skills-lock.json` que puedes commitear. Boss distribuye una única raíz de skill, por lo que el selector muestra solo `boss` — sus metodologías internas viajan con ella.

**Alternativa — el instalador multiagente propio de Boss** (detecta automáticamente Claude Code, Codex, OpenClaw, Antigravity y Hermes e instala en todos ellos, y además fusiona los hooks de Codex):

```bash
# One-shot, no global install
npx @blade-ai/boss-skill

# Or install globally, then run the self-install wizard
npm install -g @blade-ai/boss-skill
boss-skill
```

Para el modo plugin de Claude Code:

```bash
claude --plugin-dir "$(boss-skill path)"
```

### 2. Ejecuta un pipeline ligero

Dentro de tu agente de programación:

```text
/boss Build a local personal todo app --roles core --skip-deploy
```

- `--roles core` usa PM, Arquitecto, Dev y QA.
- `--skip-deploy` se detiene después de la implementación y la evidencia de pruebas.

### 3. Inspecciona los resultados

```bash
boss status todo-app --json
boss runtime inspect-pipeline todo-app
```

Distribución esperada de artefactos:

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

## Cuándo usar Boss

| Buen encaje | Mal encaje |
| --- | --- |
| Funcionalidades nuevas que necesitan requisitos, diseño, implementación, pruebas y evidencia de entrega | Correcciones de una línea o ediciones locales mínimas |
| Trabajo de API, full-stack, UI o de producto de tamaño medio | Lectura o explicación pura de código |
| Trabajo donde los artefactos `.boss/<feature>/` son valiosos | Tareas con una especificación existente completa en las que solo necesitas un parche rápido |
| Equipos que quieren puertas repetibles y rastros de auditoría | Trabajo que no necesita coordinación ni evidencia de revisión |

Regla general: si no necesitas una carpeta `.boss/` rastreable, probablemente no necesitas el pipeline completo de `/boss`. Usa un único rol o deja que tu agente de programación edite directamente.

## ¿Sin CLI? Sigue funcionando

Boss detecta la CLI `boss` en tiempo de ejecución. Sin ella, el flujo de trabajo puede degradarse a artefactos Markdown bajo `.boss/<feature>/` en lugar del flujo de eventos. La CLI es la mejora de auditabilidad: event sourcing, reanudación reproducible, evaluaciones deterministas, puertas del runtime y diagnósticos estructurados.

Boss no significa «instálalo una vez y obtén una entrega autónoma garantizada». Proporciona un flujo de trabajo en tiempo de ejecución y puertas de evidencia; el agente de programación activo todavía tiene que seguir el protocolo de Boss.

## Detalles de la instalación

```bash
npm install -g @blade-ai/boss-skill
boss-skill install
```

Comandos de instalación útiles:

```bash
boss-skill install --dry-run
boss-skill uninstall
boss-skill path
boss-skill --version
```

Destinos detectados automáticamente:

| Agente | Detección | Método de instalación |
| --- | --- | --- |
| OpenClaw | `~/.openclaw/` | Copia a `~/.openclaw/skills/boss/` e inyecta metadatos |
| Codex | `~/.codex/` | Copia a `~/.codex/skills/boss/`, inyecta metadatos y fusiona hooks |
| Antigravity | `~/.gemini/antigravity/` | Copia al directorio de skills de Antigravity e inyecta metadatos |
| Hermes | `~/.hermes/` | Copia a `~/.hermes/skills/boss/` e inyecta metadatos |
| Claude Code | Siempre disponible | Modo plugin con `--plugin-dir` |

## Soporte de plataformas

Boss está orientado a Node.js `>=20` y funciona en Linux, macOS y Windows. La CLI invoca procesos externos solo mediante `spawnSync` con arrays de argumentos explícitos (nunca `shell: true`) y resuelve `npm`/`npx` a sus variantes `.cmd` en Windows, de modo que no hay ninguna suposición exclusiva de POSIX en el pipeline principal.

Dos capacidades dependen de herramientas externas opcionales y se degradan de forma elegante cuando no están presentes:

- **Puntos de control WIP** (stash/commit/branch) requieren `git` y un árbol de trabajo de git. Fuera de un repositorio, o sin `git` en el `PATH`, los puntos de control se omiten silenciosamente — el pipeline no se ve afectado.
- **Los plugins heredados `gate.sh` escritos a mano** se ejecutan mediante `bash`. En Windows, sin un bash en el `PATH`, no podrán iniciarse; prefiere el punto de entrada Node multiplataforma para puertas (`gate.js` / `gate.mjs`) para plugins portables.

Ejecuta `boss doctor` para ver el entorno de ejecución resuelto (versión de Node, plataforma y si `git` está disponible) junto con el estado de la instalación y del flujo de eventos.

## Comandos

Comandos slash habituales:

```text
/boss Build a todo app
/boss Add authentication to this existing project --skip-ui
/boss Build an API service --skip-deploy --quick
/boss Continue the previous task --continue-from 3
/boss Lightweight mode --roles core --hitl-level off
/boss:upgrade
```

Opciones habituales:

| Opción | Significado |
| --- | --- |
| `--roles <preset>` | `full` para los 9 roles, o `core` para PM/Arquitecto/Dev/QA |
| `--skip-ui` | Omite el diseño de UI |
| `--skip-deploy` | Omite el despliegue |
| `--quick` | Omite los nodos de confirmación y de clarificación de requisitos |
| `--template` | Inicializa `.boss/templates/` y hace una pausa |
| `--continue-from <1-4>` | Reanuda desde una etapa del pipeline |
| `--hitl-level <level>` | Modo human-in-the-loop: `auto`, `interactive` u `off` |

Comandos de la CLI de Boss:

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

Los comandos `boss` orientados al agente usan estas opciones habituales cuando corresponde; ejecuta `--describe` en un comando para obtener su esquema JSON exacto:

- `--json`: salida estructurada; la stdout no TTY usa JSON por defecto
- `--describe`: esquema JSON del comando
- `--dry-run`: plan de acción estructurado para escrituras u operaciones de riesgo
- `--json-input=<json|->`: payload de entrada JSON
- `--fields=<a,b>` y `--limit=<n>`: salida acotada
- `--yes`: obligatorio solo para comandos no interactivos de alto riesgo que necesitan una confirmación adicional

Los errores estructurados se escriben en stderr como `{"error":{...}}` e incluyen `code`, `message`, `input`, `retryable` y `suggestion`.

## Flujo de trabajo

Boss sigue un flujo de trabajo de cuatro etapas:

```text
User request
  -> requirement clarification
  -> Stage 1: PM, Architect, UI Designer
  -> Stage 2: Tech Lead, Scrum Master
  -> Stage 3: Frontend, Backend, QA, gates
  -> Stage 4: DevOps, deployment checks, summary
```

El conjunto completo de roles:

| Rol | Responsabilidad |
| --- | --- |
| PM | Descubrimiento de requisitos, PRD, necesidades ocultas, casos límite |
| Arquitecto | Arquitectura del sistema, diseño técnico, APIs |
| Diseñador de UI | Especificación de UI/UX más JSON de diseño renderizable |
| Tech Lead | Revisión técnica, evaluación de riesgos |
| Scrum Master | Desglose de tareas y criterios de aceptación |
| Frontend | Implementación de UI y pruebas de frontend |
| Backend | API, almacenamiento, pruebas de backend |
| QA | Ejecución de pruebas, informes de errores, evidencia de verificación |
| DevOps | Build, despliegue, comprobaciones de estado |

## Runtime y puertas de calidad

Boss tiene dos capas de control de calidad:

- **Restricciones estrictas** verificadas por código y CI: eventos del runtime, `execution.json` protegido, hooks, pruebas de matriz de instalación, escenarios de harness y cobertura de Vitest.
- **Restricciones del protocolo del agente** guiadas por el paquete de skills: despacho DAG, carga progresiva de referencias, evidencia de pruebas y disciplina de puertas.

Puertas integradas:

| Puerta | Momento | Comprobaciones |
| --- | --- | --- |
| Puerta 0 | Después del desarrollo, antes de QA | TypeScript, lint, comprobaciones básicas de compilación |
| Puerta 1 | Después de QA, antes del despliegue | Evidencia de pruebas, sin bugs P0/P1, expectativas E2E |
| Puerta 2 | Antes del despliegue web | Objetivos de Lighthouse y latencia de API cuando corresponde |

Los hooks se controlan mediante variables de entorno:

| Variable | Valores |
| --- | --- |
| `BOSS_HOOK_PROFILE` | `minimal`, `standard`, `strict` |
| `BOSS_DISABLED_HOOKS` | IDs de hooks separados por comas |

El estado del runtime se respalda en `.boss/<feature>/.meta/workflow-plan.json` y `.boss/<feature>/.meta/execution.json`. La definición del flujo de trabajo registra `workflowHash`, `packHash` y los hashes del DAG de artefactos. La reanudación del runtime usa `boss runtime resume <feature> --from-run <run-id>` para recargar el plan, comparar las entradas de los nodos y materializar `execution.workflow.nextNodeIds` para los siguientes nodos planificables. Los eventos `GateEvaluated` / `WaveVerified` actualizan el estado de los nodos del flujo de trabajo cuando se completan las puertas y las oleadas de evidencia.

## Superficies sensibles a la seguridad

Boss mantiene intencionadamente pequeño el manifiesto de plugin publicado: declara solo las skills incluidas y omite servidores MCP, manifiestos de aplicación y referencias a assets a menos que existan esos archivos complementarios. Los hooks de Codex se instalan mediante el flujo `boss-skill install`, no mediante el manifiesto del marketplace.

El paquete npm excluye la configuración local del agente de desarrollo, como `.claude/settings.json` y `.claude/settings.local.json`. Los metadatos publicables del plugin se encuentran en `.claude-plugin/`, `.codex-plugin/` y `.agents/plugins/marketplace.json`.

La procedencia de las releases se encuentra en `.agents/plugins/provenance.json`. Fija la URL HTTPS del repositorio, el SHA inmutable del commit de origen, la identidad del publicador y los resúmenes SHA-256 de los manifiestos de plugins y de los componentes sensibles a la seguridad. Verifícala con:

```bash
npm run provenance:verify
```

La verificación del publicador es externa al paquete. Para el registro HOL, reclama el plugin con la cuenta de GitHub del propietario del repositorio en `https://hol.org/guard/plugins`. La tarjeta pública de confianza está disponible en `https://hol.org/registry/plugins/echovic%2Fboss/embed`.

Comportamiento sensible a la seguridad que revisar antes de publicar o instalar:

- `boss-skill install` puede escribir en directorios de configuración del agente como `~/.codex/skills/boss/` y fusionar entradas gestionadas por Boss en `~/.codex/hooks.json`.
- Las entradas de hooks ejecutan `boss hooks run ...`, que despacha scripts desde `scripts/hooks/`.
- Los plugins del runtime bajo `.boss/plugins/<name>/plugin.json` pueden registrar hooks de puerta o de reporter; revisa los plugins locales del proyecto antes de habilitarlos.
- Usa `BOSS_HOOK_PROFILE=minimal` o `BOSS_DISABLED_HOOKS=<ids>` cuando necesites reducir el comportamiento de los hooks en un entorno sensible.

Boss es local-first y no realiza solicitudes de red salientes por defecto; la única superficie de red es el servidor opcional y solo de loopback `boss design preview`. Consulta [PRIVACY.md](PRIVACY.md) para conocer el límite completo de datos y red.

## Artefactos del pipeline

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

Ejecuta esto en un entorno interactivo para previsualizar un diseño de UI generado:

```bash
boss design preview <feature>
```

## Evaluaciones

Las evaluaciones de Boss puntúan los fixtures capturados sin iniciar un LLM real:

```bash
npm run evals
npm run evals:release
```

La evaluación de release incluye comprobaciones de evidencia de release y de conformidad del pipeline. Verifica el uso de los comandos del runtime, el registro de artefactos, la ausencia de ediciones directas de `execution.json` y los campos de planificación del flujo de trabajo.

Consulta [test/evals/README.md](./test/evals/README.md).

## Desarrollo

Requisitos:

- Node.js >= 20
- `jq` para los helpers de prueba basados en shell

Configuración:

```bash
git clone https://github.com/echoVic/boss-skill.git
cd boss-skill
npm install
npm run build
npm run typecheck
npm test
```

Scripts útiles:

```bash
npm run build
npm run typecheck
npm test
npm run test:skills
npm run test:harness
npm run test:install-matrix
npm run evals
```

## Estructura del repositorio

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

Áreas importantes del código fuente:

- `packages/boss-cli/src/` contiene el código fuente TypeScript de la CLI y del runtime.
- `packages/boss-cli/dist/` contiene la salida generada de la CLI que usa el binario npm publicado; no la edites a mano.
- `packages/boss-cli/assets/` contiene los DAG integrados, los packs de pipeline, el esquema de plugins y los plugins.
- `skill/SKILL.md` es el punto de entrada principal de orquestación orientado al agente.
- `skill/agents/` contiene los prompts de los roles.
- `skill/commands/` contiene los comandos slash.
- `skill/templates/` contiene las plantillas de artefactos.

## Release

Usa el script de release para que los números de versión permanezcan sincronizados entre los metadatos del paquete y los manifiestos de skill/plugin:

```bash
npm run release -- patch
npm run release -- minor
npm run release -- major
npm run release -- 3.11.0
npm run release -- 3.11.0 --dry-run
npm run release -- 3.11.0 --no-publish
```

El script de release comprueba que el árbol de trabajo esté limpio, ejecuta las pruebas, sincroniza las versiones, verifica la coherencia, crea un commit y una etiqueta, y publica salvo que se use `--no-publish`.

Consulta [CONTRIBUTING.md](./CONTRIBUTING.md).

## Diseño

Boss está inspirado en BMAD: Breakthrough Method of Agile AI-Driven Development. El proyecto adapta esa idea a un runtime auditable para el trabajo de software agéntico.

Lee más en [DESIGN.md](./DESIGN.md) y `skill/references/bmad-methodology.md`.

## Historial de estrellas

[![Star History Chart](https://api.star-history.com/svg?repos=echoVic/boss-skill&type=Date)](https://star-history.com/#echoVic/boss-skill&Date)

## Licencia

MIT
