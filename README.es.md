# boss-skill

[![skills.sh](https://skills.sh/b/echovic/boss-skill)](https://skills.sh/echovic/boss-skill)
[![G-Star Incubation](https://img.shields.io/badge/G--Star-Incubation-C71D23)](https://atomgit.com/echoVic/boss-skill)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**Languages / 语言 / 言語 / 언어 / Idiomas / Langues:** [English](./README.md) · [中文](./README.zh-CN.md) · [日本語](./README.ja.md) · [한국어](./README.ko.md) · Español · [Français](./README.fr.md) · [Português](./README.pt-BR.md)

![boss-skill promo](https://raw.githubusercontent.com/echoVic/boss-skill/main/boss-skill-promo.png)

> Este proyecto forma parte del programa AtomGit G-Star Incubation. GitHub es el repositorio canónico y AtomGit es un espejo sincronizado automáticamente. Envía issues y pull requests en [GitHub](https://github.com/echoVic/boss-skill).

**Boss es un flujo de trabajo de escuadrón de expertos para agentes de programación.** Convierte un agente en un equipo de ingeniería estructurado: PM, Arquitecto, Diseñador UI, Líder Técnico, Scrum Master, Frontend, Backend, QA y DevOps. Cada rol trabaja conforme a un contrato de calidad estricto y escribe su resultado en disco, y un verificador independiente comprueba el contrato en lugar del autor. Ejecuta un solo rol sobre el código que ya tienes, por ejemplo una revisión de la rama actual, o el pipeline completo, desde una idea hasta un pull request.

Boss funciona con Claude Code, Codex, OpenClaw, Antigravity, Hermes y DeepSeek Harness.

## DeepSeek Harness

Boss también incluye un bundle para DeepSeek Harness, [`dsh-boss-mode`](https://www.npmjs.com/package/dsh-boss-mode), con un preset **Boss Expert Squad** y una barra lateral que lee los miembros y tareas de Agent Teams en vivo.

```bash
dsh plugin --profile desktop add dsh-boss-mode
```

Reinicia DeepSeek Harness, crea una sesión y elige **Boss Expert Squad**.

## Por qué Boss

- **Útil sobre código existente**: `/boss:review` revisa el diff de la rama actual, `/boss:qa` lo prueba y `/boss:ship` abre el pull request. Cada comando hace su única etapa y se detiene.
- **Contratos de calidad estrictos**: cada rol tiene una tabla de requisitos innegociable (un PRD necesita escenarios Dado-Cuando-Entonces, una arquitectura debe comparar dos opciones, QA debe registrar el comando y el código de salida que respaldan cada afirmación).
- **El autor no califica su propio trabajo**: un script comprueba lo que un script puede decidir y después un agente verificador aparte juzga el resto y cita su evidencia. Un contrato incumplido bloquea la siguiente etapa salvo que lo dispenses.
- **Guiado por artefactos**: cada etapa escribe un archivo real en `.boss/<feature>/`; el progreso se juzga por lo que hay en disco, no por lo que dice el agente.
- **TDD por defecto**: las etapas de desarrollo escriben primero una prueba que falla, la ven en RED y luego la ponen en GREEN con el mínimo código.
- **Local por defecto**: sin telemetría ni proxy remoto. Boss solo hace push, abre un pull request o despliega cuando ejecutas `ship` o dices que sí.

## Comandos del escuadrón de expertos

Cada comando ejecuta una etapa, la verifica y se detiene, indicando el siguiente comando:

| Comando           | Rol                | Escribe                                                       |
| ----------------- | ------------------ | ------------------------------------------------------------- |
| `/boss:pm`        | PM                 | `prd.md`                                                      |
| `/boss:architect` | Arquitecto         | `architecture.md`                                             |
| `/boss:ui`        | Diseñador UI       | `ui-spec.md`, `ui-design.json`                                |
| `/boss:review`    | Líder Técnico      | `code-review.md` para un diff, o `tech-review.md` y `plan.md` |
| `/boss:tasks`     | Scrum Master       | `tasks.md`                                                    |
| `/boss:dev`       | Frontend / Backend | código y pruebas                                              |
| `/boss:qa`        | QA                 | `qa-report.md`                                                |
| `/boss:ship`      | DevOps             | un pull request, o un despliegue con `--deploy`               |
| `/boss:verify`    | Verificador        | `verification.md` para los artefactos que ya existen          |

Añade `--continue` para seguir avanzando por la cadena, o `--stop-after <stage>` para detenerte en una etapa posterior. La cadena completa es `pm → architect → ui → review → tasks → dev → qa → ship`; ejecútala entera con `/boss:boss <request>` en Claude Code, o pidiéndole a Boss que construya algo de principio a fin.

En Claude Code son comandos slash reales. En otros agentes, invoca la skill Boss e indica la etapa, por ejemplo «usa Boss para revisar esta rama».

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

La primera prueba más económica es una revisión de solo lectura de la rama en la que estás: `/boss:review` escribe `.boss/<branch>/code-review.md` y no cambia ningún archivo fuente. Para ejecutar la cadena completa:

```text
/boss:boss Build a local personal todo app --skip-ui
```

`--skip-ui` omite el diseño UI en proyectos de API o CLI, y `--quick` omite las aclaraciones rutinarias.

Los artefactos viven en `.boss/<feature>/`: `prd.md`, `architecture.md`, `ui-spec.md`, `ui-design.json`, `tech-review.md`, `plan.md`, `code-review.md`, `tasks.md`, `qa-report.md`, `deploy-report.md` y `verification.md`. Cada uno empieza con un resumen para que los agentes posteriores lean primero la conclusión. Se escriben en el idioma de tu petición; `--lang <code>` lo sustituye.

## Flujo de trabajo

El pipeline completo, con cada etapa verificada antes de que empiece la siguiente:

```text
petición → aclaración (salvo --quick)
  → PM: prd.md
  → Arquitecto: architecture.md
  → UI: ui-spec.md + ui-design.json (omitir con --skip-ui)
  → Líder Técnico: tech-review.md + plan.md
  → Scrum Master: tasks.md
  → Frontend / Backend: implementación TDD
  → QA: qa-report.md
  → DevOps: pull request o despliegue, deploy-report.md
```

## Puertas de calidad

El contrato de cada etapa se comprueba dos veces: `skill/scripts/check-artifacts.mjs` aplica las reglas que un script puede decidir y el agente verificador juzga el resto. Además de los contratos, cada puerta la decide un comando real y el veredicto se registra en el artefacto de la etapa:

| Puerta                 | Etapa                         | Comprueba                                                                               |
| ---------------------- | ----------------------------- | --------------------------------------------------------------------------------------- |
| 0 (calidad del código) | tras desarrollo, antes de QA  | typecheck y lint pasan, sin vulnerabilidades graves en dependencias                     |
| 1 (pruebas)            | tras QA, antes del despliegue | pruebas unitarias y de integración pasan, cobertura ≥ 70%, sin bugs P0/P1, E2E escritos |
| 2 (rendimiento)        | antes del despliegue web      | Lighthouse ≥ 80, API P99 < 500 ms (solo proyectos web)                                  |

Si no necesitas una carpeta `.boss/` trazable, probablemente no necesites la cadena completa; usa un solo rol.

## Seguridad y privacidad

Boss es local-first y por defecto no hace peticiones salientes; `ship` solo hace push o despliega cuando lo ejecutas o lo confirmas. La procedencia de la release vive en `.agents/plugins/provenance.json` y fija la URL del repositorio, el commit de origen, el publicador y los digests de los manifiestos; verifícala con `npm run provenance:verify`. La frontera completa de datos y red está en [PRIVACY.md](./PRIVACY.md).

## Evals

Tres capas comprueban el propio Boss:

```bash
npm run test:install-smoke   # carga el repo mediante la CLI skills y `claude plugin validate`
npm run evals                # puntúa los transcripts capturados; no se llama a ningún modelo
npm run evals:agent          # ejecuta evals/ contra un agente real de Claude Code (consume crédito de API)
```

`npm run evals:agent` envuelve [`claude plugin eval`](https://code.claude.com/docs/en/plugin-evals). Sus casos comprueban que una edición pequeña no activa Boss, que una etapa se detiene cuando termina, que una revisión no edita ningún archivo fuente y que la verificación informa de un contrato incumplido. La misma suite se ejecuta cada semana en `.github/workflows/skill-behavior.yml` una vez configurado un secreto `ANTHROPIC_API_KEY`.

## Desarrollo

Necesitas Node.js ≥ 22.18.

```bash
git clone https://github.com/echoVic/boss-skill.git
cd boss-skill
npm install
npm run typecheck
npm test
```

Otros scripts útiles: `npm run test:skills` (análisis de transcripts), `npm run test:contracts` (el comprobador de artefactos), `npm run lint` (Biome). Las releases usan `npm run release -- patch|minor|major|<versión>`; el script comprueba que el árbol esté limpio, ejecuta typecheck, lint y pruebas, y después sincroniza versiones, hace commit, crea la etiqueta y hace push. Consulta [CONTRIBUTING.md](./CONTRIBUTING.md) y [docs/dsh-release.md](./docs/dsh-release.md).

## Diseño

Boss se inspira en BMAD (Breakthrough Method of Agile AI-Driven Development) y en la filosofía de «escribir menos código y de mayor calidad». El modelo de escuadrón de expertos mantiene el harness ligero —sin máquina de estados en runtime, sin event sourcing, sin hooks— a la vez que conserva contratos de calidad estrictos y colaboración guiada por artefactos. Lee [DESIGN.md](./DESIGN.md) y `skill/references/principles.md`.

## Licencia

[MIT](LICENSE)
