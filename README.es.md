# boss-skill

[![skills.sh](https://skills.sh/b/echovic/boss-skill)](https://skills.sh/echovic/boss-skill)
[![G-Star Incubation](https://img.shields.io/badge/G--Star-Incubation-C71D23)](https://atomgit.com/echoVic/boss-skill)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**Languages / 语言 / 言語 / 언어 / Idiomas / Langues:** [English](./README.md) · [中文](./README.zh-CN.md) · [日本語](./README.ja.md) · [한국어](./README.ko.md) · Español · [Français](./README.fr.md) · [Português](./README.pt-BR.md)

![boss-skill promo](https://raw.githubusercontent.com/echoVic/boss-skill/main/boss-skill-promo.png)

> Este proyecto forma parte del programa AtomGit G-Star Incubation. GitHub es el repositorio canónico y AtomGit es un espejo sincronizado automáticamente. Envía issues y pull requests en [GitHub](https://github.com/echoVic/boss-skill).

**Boss es un flujo de trabajo de escuadrón de expertos para agentes de programación.** Convierte un agente en un equipo de ingeniería estructurado: PM, Arquitecto, Diseñador UI, Líder Técnico, Scrum Master, Frontend, Backend, QA y DevOps. A diferencia de los equipos de agentes basados solo en prompts, Boss impone un contrato de calidad estricto por rol, produce artefactos reproducibles y encadena las etapas automáticamente: empieza por donde quieras y ejecutará el resto hasta que le digas que pare.

Boss funciona con Claude Code, Codex, OpenClaw, Antigravity, Hermes y DeepSeek Harness.

## DeepSeek Harness

Boss también incluye un bundle para DeepSeek Harness, [`dsh-boss-mode`](https://www.npmjs.com/package/dsh-boss-mode), con un preset **Boss Expert Squad** y una barra lateral que lee los miembros y tareas de Agent Teams en vivo.

```bash
dsh plugin --profile desktop add dsh-boss-mode
```

Reinicia DeepSeek Harness, crea una sesión y elige **Boss Expert Squad**.

## Por qué Boss

- **Contratos de calidad estrictos**: cada rol tiene una tabla de requisitos innegociable (un PRD necesita escenarios Dado-Cuando-Entonces, una arquitectura debe comparar dos opciones, QA debe registrar evidencia verificada o declarada como no verificada). Un contrato incumplido bloquea la siguiente etapa salvo que lo autorices.
- **Guiado por artefactos**: cada etapa escribe un archivo real en `.boss/<feature>/`; el progreso se juzga por lo que hay en disco, no por lo que dice el agente.
- **Cadena de continuación**: empieza en cualquier etapa y Boss ejecuta automáticamente todas las etapas posteriores hasta `ship`.
- **TDD por defecto**: las etapas de desarrollo escriben primero una prueba que falla, la ven en RED y luego la ponen en GREEN con el mínimo código.
- **Local por defecto**: sin telemetría ni proxy remoto; la única superficie de red es un servidor de vista previa opcional en `127.0.0.1`.

## Comandos del escuadrón de expertos

Cada comando es un punto de entrada que ejecuta automáticamente las etapas posteriores:

| Comando           | Empieza en         | Ejecuta hasta             |
| ----------------- | ------------------ | ------------------------- |
| `/boss`           | PM                 | la cadena completa → ship |
| `/boss:pm`        | PM                 | Arquitecto → … → Ship     |
| `/boss:architect` | Arquitecto         | UI → … → Ship             |
| `/boss:ui`        | Diseñador UI       | Revisión → … → Ship       |
| `/boss:review`    | Líder Técnico      | Tareas → … → Ship         |
| `/boss:tasks`     | Scrum Master       | Desarrollo → QA → Ship    |
| `/boss:dev`       | Frontend / Backend | QA → Ship                 |
| `/boss:qa`        | QA                 | Ship                      |
| `/boss:ship`      | DevOps             | termina la cadena         |

La cadena completa es `pm → architect → ui → review → tasks → dev → qa → ship`. Detenla diciendo «stop», «solo este paso» o pasando `--stop-after <stage>`.

## Inicio rápido

Instala Boss en tu agente de programación: la skill se distribuye por marketplaces y el bundle de DeepSeek Harness se publica aparte en npm:

```text
# Claude Code
/plugin marketplace add echoVic/boss-skill
/plugin install boss@boss-skill

# Codex
codex plugin marketplace add echoVic/boss-skill   # luego instala boss en /plugins

# Cualquier agente con la CLI skills
npx skills add echoVic/boss-skill

# DeepSeek Harness
dsh plugin --profile desktop add dsh-boss-mode
```

La primera prueba más económica es una revisión de solo lectura sobre código existente: `/boss:review` escribe `tech-review.md` y `plan.md` y no toca nada más. Para ejecutar la cadena completa:

```text
/boss Build a local personal todo app --skip-ui
```

`--skip-ui` omite el diseño UI en proyectos de API o CLI, y `--quick` omite las aclaraciones rutinarias.

Los artefactos viven en `.boss/<feature>/`: `prd.md`, `architecture.md`, `ui-spec.md`, `ui-design.json`, `tech-review.md`, `plan.md`, `tasks.md`, `qa-report.md` y `deploy-report.md`. Cada uno empieza con un resumen para que los agentes posteriores lean primero la conclusión.

## Flujo de trabajo

```text
petición → aclaración (salvo --quick)
  → PM: prd.md
  → Arquitecto: architecture.md
  → UI: ui-spec.md + ui-design.json (omitir con --skip-ui)
  → Líder Técnico: tech-review.md + plan.md
  → Scrum Master: tasks.md
  → Frontend / Backend: implementación TDD
  → QA: qa-report.md
  → DevOps: deploy-report.md
```

## Puertas de calidad

Además de los contratos por rol, cada puerta la decide un comando real y el veredicto se registra en el artefacto de la etapa:

| Puerta                 | Etapa                         | Comprueba                                                                               |
| ---------------------- | ----------------------------- | --------------------------------------------------------------------------------------- |
| 0 (calidad del código) | tras desarrollo, antes de QA  | typecheck y lint pasan, sin vulnerabilidades graves en dependencias                     |
| 1 (pruebas)            | tras QA, antes del despliegue | pruebas unitarias y de integración pasan, cobertura ≥ 70%, sin bugs P0/P1, E2E escritos |
| 2 (rendimiento)        | antes del despliegue web      | Lighthouse ≥ 80, API P99 < 500 ms (solo proyectos web)                                  |

Si no necesitas una carpeta `.boss/` trazable, probablemente no necesites la cadena completa; usa un solo rol.

## Seguridad y privacidad

Boss es local-first y por defecto no hace peticiones salientes. La procedencia de la release vive en `.agents/plugins/provenance.json` y fija la URL del repositorio, el commit de origen, el publicador y los digests de los manifiestos; verifícala con `npm run provenance:verify`. La frontera completa de datos y red está en [PRIVACY.md](./PRIVACY.md).

## Evals

Los transcripts capturados se puntúan sin iniciar un LLM real:

```bash
npm run evals
npm run evals:release   # añade comprobaciones de evidencia de release y cumplimiento del pipeline
```

## Desarrollo

Necesitas Node.js ≥ 22.18.

```bash
git clone https://github.com/echoVic/boss-skill.git
cd boss-skill
npm install
npm run typecheck
npm test
```

Otros scripts útiles: `npm run test:skills` (solo comportamiento de la skill), `npm run evals`, `npm run lint` (Biome). Las releases usan `npm run release -- patch|minor|major|<versión>`; el script comprueba que el árbol esté limpio, ejecuta typecheck, lint y pruebas, y después sincroniza versiones, hace commit, crea la etiqueta y hace push. Consulta [CONTRIBUTING.md](./CONTRIBUTING.md) y [docs/dsh-release.md](./docs/dsh-release.md).

## Diseño

Boss se inspira en BMAD (Breakthrough Method of Agile AI-Driven Development) y en la filosofía de «escribir menos código y de mayor calidad». El modelo de escuadrón de expertos mantiene el harness ligero —sin máquina de estados en runtime, sin event sourcing, sin hooks— a la vez que conserva contratos de calidad estrictos y colaboración guiada por artefactos. Lee [DESIGN.md](./DESIGN.md) y `skill/references/principles.md`.

## Licencia

[MIT](LICENSE)
