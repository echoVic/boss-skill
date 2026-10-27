# boss-skill

[![skills.sh](https://skills.sh/b/echovic/boss-skill)](https://skills.sh/echovic/boss-skill)
[![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/echoVic/boss-skill?utm_source=oss&utm_medium=github&utm_campaign=echoVic%2Fboss-skill&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)](https://coderabbit.ai)
[![G-Star Incubation](https://img.shields.io/badge/G--Star-Incubation-C71D23)](https://atomgit.com/echoVic/boss-skill)
[![AtomGit Mirror](https://img.shields.io/badge/AtomGit-Mirror-1F6FEB)](https://atomgit.com/echoVic/boss-skill)
[![Boss trust badge](https://img.shields.io/endpoint?url=https%3A%2F%2Fhol.org%2Fapi%2Fregistry%2Fbadges%2Fplugin%3Fslug%3Dechovic%252Fboss%26metric%3Dtrust%26style%3Dflat)](https://hol.org/registry/plugins/echovic%2Fboss)

**Languages / 语言 / 言語 / 언어 / Idiomas / Langues:** [English](./README.md) · [中文](./README.zh-CN.md) · [日本語](./README.ja.md) · [한국어](./README.ko.md) · [Español](./README.es.md) · [Français](./README.fr.md) · [Português](./README.pt-BR.md)

![boss-skill promo](https://raw.githubusercontent.com/echoVic/boss-skill/main/boss-skill-promo.png)

> Este proyecto forma parte del programa AtomGit G-Star Incubation. GitHub es el repositorio canónico; AtomGit proporciona un espejo sincronizado automáticamente para un acceso más rápido en China. Por favor, envía issues y pull requests en [GitHub](https://github.com/echoVic/boss-skill).
>
> GitHub: <https://github.com/echoVic/boss-skill> · Espejo AtomGit: <https://atomgit.com/echoVic/boss-skill>

**Boss es un flujo de trabajo de escuadrón de expertos para agentes de programación.** Convierte un agente de programación en un equipo de ingeniería estructurado: PM, Arquitecto, Diseñador de UI, Tech Lead, Scrum Master, Frontend, Backend, QA y DevOps. A diferencia de los equipos de agentes basados solo en prompts, Boss impone contratos de calidad estrictos por rol, produce artefactos reproducibles y encadena etapas automáticamente: empieza donde quieras y ejecuta el resto hasta que digas que pares.

Boss funciona con Claude Code, Codex, OpenClaw, Antigravity y Hermes.

## Por qué Boss

La orquestación basada solo en prompts puede parecer organizada, pero normalmente no puede demostrar que se siguió el plan, que se ejecutaron las pruebas o que se superaron las puertas. Boss se construye en torno a la evidencia y los contratos estrictos:

- **Contratos de calidad estrictos**: cada rol tiene una tabla de requisitos innegociables (por ejemplo, el PRD debe incluir escenarios Given-When-Then; la arquitectura debe comparar al menos dos opciones; QA debe registrar evidencia verificada o honestamente no verificada). Los contratos fallidos bloquean la siguiente etapa a menos que los anules explícitamente.
- **Orientado a artefactos**: cada etapa escribe un archivo real bajo `.boss/<feature>/`. El progreso se juzga por los artefactos en disco, no por lo que el agente afirma.
- **Cadena de continuación**: empieza en cualquier etapa (`/boss:pm`, `/boss:dev`, ...) y Boss ejecuta automáticamente todas las etapas posteriores hasta `ship` o hasta que lo detengas. Sin entregas manuales.
- **Principios de ingeniería**: el escuadrón comparte diez principios: verificar el producto real, corregir causas raíz, construir la palanca, modelar el dominio, disciplina de límites, secuenciar unidades verificables, probar el comportamiento, minimizar la carga del lector, experiencia estructurada, reglas autónomas. Cada agente cita el principio que aplica.
- **TDD por defecto**: las etapas de desarrollo deben escribir primero una prueba que falle, ver el estado RED y luego escribir el código mínimo para pasar a GREEN.
- **Cero red por defecto**: sin telemetría, sin phone-home, sin proxy LLM remoto. La única superficie de red es un servidor de vista previa optativo de loopback (`127.0.0.1`) para el prototipado de UI. Ver [PRIVACY.md](./PRIVACY.md).
- **Evals deterministas**: las transcripciones capturadas se puntúan sin llamar a un LLM real.

## Comandos del Escuadrón de Expertos

Boss no es un único comando monolítico. Cada comando de barra es un punto de entrada; por defecto ejecuta automáticamente todas las etapas posteriores.

| Comando | Empieza en | Ejecuta hasta | Cuándo usarlo |
| --- | --- | --- | --- |
| `/boss` | PM | cadena completa → ship | Ir de la idea al trabajo entregable |
| `/boss:pm` | PM | Architect → ... → Ship | Empezar desde los requisitos |
| `/boss:architect` | Architect | UI → ... → Ship | Tienes una especificación, necesitas diseño |
| `/boss:ui` | UI Designer | Review → ... → Ship | Tienes arquitectura, necesitas UI |
| `/boss:review` | Tech Lead | Tasks → ... → Ship | Necesitas revisión técnica + plan |
| `/boss:tasks` | Scrum Master | Dev → QA → Ship | Necesitas desglose de tareas |
| `/boss:dev` | Frontend/Backend | QA → Ship | Empezar la implementación |
| `/boss:qa` | QA | Ship | Necesitas evidencia de pruebas |
| `/boss:ship` | DevOps | (fin) | Solo desplegar |

La cadena completa:

```
pm → architect → ui → review → tasks → dev → qa → ship
```

Detén la cadena diciendo "para", "solo haz este paso" o pasando `--stop-after <etapa>`.

## Inicio Rápido

### 1. Instalar

Boss es una skill que instalas en tu agente de programación. La distribución es solo por marketplace: sin paquete npm, sin binario global.

**Claude Code — marketplace de plugins (recomendado):**

```text
/plugin marketplace add echoVic/boss-skill
/plugin install boss@boss-skill
```

**Codex — marketplace de plugins:**

```bash
codex plugin marketplace add echoVic/boss-skill
```

Luego abre el navegador de plugins (`/plugins`) e instala **boss**.

**Cualquier agente — mediante el CLI `skills` ([vercel-labs/skills](https://github.com/vercel-labs/skills), skills.sh):**

```bash
npx skills add echoVic/boss-skill
```

### 2. Pruébalo en un proyecto que ya tengas

La primera ejecución de menor coste es una revisión de solo lectura contra código existente:

```
/boss:review
```

Obtienes `tech-review.md` (y `plan.md`) bajo `.boss/<feature>/` con riesgos, hallazgos y severidad. No se toca ningún otro archivo del repositorio.

¿Quieres evidencia de pruebas verificable en su lugar? `/boss:qa` ejecuta las pruebas y escribe `qa-report.md`.

### 3. Ejecuta el Pipeline Completo

Dentro de tu agente de programación:

```text
/boss Build a local personal todo app --skip-ui
```

- `--skip-ui` omite la etapa de diseño de UI (proyectos API/CLI puros).
- `--quick` omite las indicaciones de confirmación rutinarias.

### 4. Inspecciona los Resultados

Los artefactos viven bajo `.boss/<feature>/`:

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

Cada artefacto Markdown empieza con una sección `## 摘要` (resumen) para que los agentes posteriores lean la conclusión primero.

## Flujo de Trabajo

```text
Solicitud del usuario
  → aclaración de requisitos (salvo --quick)
  → PM: descubrimiento de requisitos → prd.md
  → Architect: diseño del sistema → architecture.md
  → UI Designer: especificación UI/UX → ui-spec.md + ui-design.json (omitir con --skip-ui)
  → Tech Lead: revisión técnica + plan de implementación → tech-review.md + plan.md
  → Scrum Master: desglose de tareas → tasks.md
  → Frontend / Backend: implementación TDD
  → QA: ejecución de pruebas, informes de bugs, evidencia → qa-report.md
  → DevOps: build, despliegue, comprobaciones de salud → deploy-report.md
```

### Roles y Artefactos

| Rol | Responsabilidad | Artefacto |
| --- | --- | --- |
| PM | Descubrimiento de requisitos, PRD, necesidades ocultas, casos límite | `prd.md` |
| Architect | Arquitectura del sistema, diseño técnico, APIs | `architecture.md` |
| UI Designer | Especificación UI/UX, JSON de diseño renderizable, prototipo HTML | `ui-spec.md`, `ui-design.json` |
| Tech Lead | Revisión técnica, evaluación de riesgos, plan de implementación | `tech-review.md`, `plan.md` |
| Scrum Master | Desglose de tareas y criterios de aceptación | `tasks.md` |
| Frontend | Implementación de UI, TDD, pruebas de frontend | código fuente |
| Backend | API, almacenamiento, TDD, pruebas de backend | código fuente |
| QA | Ejecución de pruebas, informes de bugs, evidencia de verificación | `qa-report.md` |
| DevOps | Build, despliegue, comprobaciones de salud | `deploy-report.md` |

## Contrato de Calidad

Boss tiene dos capas de control de calidad:

- **Requisitos estrictos por rol**: el prompt de cada agente define una tabla de requisitos innegociables. El agente se autocontrola antes de entregar; un contrato fallido bloquea la siguiente etapa.
- **Puertas de calidad**: comandos reales cuyos veredictos se registran en el artefacto de la etapa.

| Puerta | Etapa | Comprobaciones |
| --- | --- | --- |
| Gate 0 (calidad de código) | Tras dev, antes de QA | TypeScript/lint pasan, sin vulnerabilidades de dependencias de alta severidad |
| Gate 1 (pruebas) | Tras QA, antes de despliegue | Pruebas unitarias + de integración pasan, cobertura ≥ 70%, sin bugs P0/P1, pruebas E2E escritas |
| Gate 2 (rendimiento) | Antes de despliegue web | Lighthouse ≥ 80, API P99 < 500ms (solo proyectos web) |

## Cuándo Usar Boss

| Buen ajuste | Mal ajuste |
| --- | --- |
| Nuevas funcionalidades que necesitan requisitos, diseño, implementación, pruebas y evidencia de entrega | Arreglos de una línea o pequeñas ediciones locales |
| Trabajo de API, full-stack, UI o producto de tamaño medio | Lectura o explicación de código pura |
| Trabajo donde los artefactos `.boss/<feature>/` son valiosos | Tareas con una especificación completa existente donde solo necesitas un parche rápido |
| Equipos que quieren puertas de calidad repetibles y trazabilidad de auditoría | Trabajo que no necesita coordinación ni evidencia de revisión |

Regla de oro: si no necesitas una carpeta `.boss/` trazable, probablemente no necesitas el pipeline completo `/boss`. Usa un solo rol o deja que tu agente edite directamente.

## Seguridad y Privacidad

Boss es local-first y no realiza solicitudes de red salientes por defecto. La única superficie de red es un servidor de prototipos HTML optativo y exclusivo de loopback (`127.0.0.1`) usado durante la etapa de diseño de UI.

La procedencia del release vive en `.agents/plugins/provenance.json`. Fija la URL HTTPS del repositorio, el SHA del commit fuente inmutable, la identidad del publicador y los resúmenes SHA-256 de los manifiestos de plugins. Verifícalo con:

```bash
npm run provenance:verify
```

Ver [PRIVACY.md](./PRIVACY.md) para el límite completo de datos y red.

## Artefactos del Pipeline

```text
.boss/<feature>/
├── prd.md              # PM — requisitos del producto
├── architecture.md     # Architect — diseño del sistema
├── ui-spec.md          # UI Designer — especificación UI/UX (omitir con --skip-ui)
├── ui-design.json      # UI Designer — JSON de diseño renderizable
├── tech-review.md      # Tech Lead — revisión técnica
├── plan.md             # Tech Lead — plan de implementación
├── tasks.md            # Scrum Master — desglose de tareas
├── qa-report.md        # QA — evidencia de pruebas
└── deploy-report.md    # DevOps — registro de despliegue
```

## Evals

Los evals de Boss puntúan fixtures capturados sin iniciar un LLM real:

```bash
npm run evals
npm run evals:release
```

El eval de release incluye comprobaciones de release-evidence y pipeline-compliance: verifica el registro de artefactos, la evitación de comandos de runtime obsoletos y el comportamiento de orquestación del escuadrón de expertos.

Ver [test/evals/README.md](./test/evals/README.md).

## Desarrollo

Requisitos:

- Node.js >= 22.18

Configuración:

```bash
git clone https://github.com/echoVic/boss-skill.git
cd boss-skill
npm install
npm run typecheck
npm test
```

Scripts útiles:

```bash
npm run typecheck    # tsc --noEmit
npm test             # vitest (unitarias + comportamiento de skill + evals)
npm run test:skills  # solo pruebas de comportamiento de skill
npm run evals        # evals deterministas de transcripción
npm run lint         # biome ci
```

## Estructura del Repositorio

```text
boss-skill/
├── skill/                      # Bundle de skill instalado en agentes de programación (autocontenido)
│   ├── SKILL.md                # Entrada principal de orquestación (invariantes + índice)
│   ├── agents/                 # Prompts de rol (boss-pm, boss-architect, ...)
│   ├── commands/               # Comandos de barra (/boss, /boss:pm, ...)
│   ├── references/             # Metodología compartida (principles, quality-gate, ...)
│   ├── skills/                 # Skills de metodología por dominio (pm/, qa/, devops/, ...)
│   └── templates/              # Plantillas de artefactos (.md.template)
├── test/                       # Pruebas de Vitest, comportamiento de skill y evals
├── scripts/                    # release.js, provenance.js
├── docs/                       # Specs, planes e informes históricos
├── examples/                   # Proyectos de ejemplo
├── .claude-plugin/             # Manifiesto de plugin Claude Code + marketplace
├── .codex-plugin/              # Manifiesto de plugin Codex + marketplace
├── .agents/plugins/            # Marketplace de plugins a nivel de repositorio + provenance
├── tsconfig.json               # Configuración de solo typecheck (noEmit)
└── package.json                # Workspace de desarrollo privado (nunca publicado)
```

## Release

Usa el script de release para que los números de versión se mantengan sincronizados entre los metadatos del paquete y los manifiestos de skill/plugin:

```bash
npm run release -- patch
npm run release -- minor
npm run release -- major
npm run release -- 4.1.0
npm run release -- 4.1.0 --dry-run
```

El script de release comprueba que el árbol de trabajo esté limpio, ejecuta la cadena de verificación completa (typecheck, lint, test), sincroniza las versiones en todos los manifiestos, verifica la consistencia, crea un commit y una etiqueta, y hace push. El release es la etiqueta git: los marketplaces leen el repositorio — no hay paso de npm publish ni de build.

Ver [CONTRIBUTING.md](./CONTRIBUTING.md).

## Diseño

Boss está inspirado en BMAD: Breakthrough Method of Agile AI-Driven Development, y en la filosofía "write less, higher quality code". El modelo de escuadrón de expertos mantiene el harness ligero — sin máquina de estados de runtime, sin event sourcing, sin hooks — mientras preserva los contratos de calidad estrictos y la colaboración orientada a artefactos.

Lee más en [DESIGN.md](./DESIGN.md), `skill/references/bmad-methodology.md` y `skill/references/principles.md`.

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=echoVic/boss-skill&type=Date)](https://star-history.com/#echoVic/boss-skill&Date)

## License

MIT
