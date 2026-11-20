# boss-skill

[![skills.sh](https://skills.sh/b/echovic/boss-skill)](https://skills.sh/echovic/boss-skill)
[![G-Star Incubation](https://img.shields.io/badge/G--Star-Incubation-C71D23)](https://atomgit.com/echoVic/boss-skill)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**Languages / 语言 / 言語 / 언어 / Idiomas / Langues:** [English](./README.md) · [中文](./README.zh-CN.md) · [日本語](./README.ja.md) · 한국어 · [Español](./README.es.md) · [Français](./README.fr.md) · [Português](./README.pt-BR.md)

![boss-skill promo](https://raw.githubusercontent.com/echoVic/boss-skill/main/boss-skill-promo.png)

> 이 프로젝트는 AtomGit G-Star Incubation Program의 일부입니다. GitHub가 정식 리포지토리이며 AtomGit은 자동으로 동기화되는 미러입니다. Issue와 Pull Request는 [GitHub](https://github.com/echoVic/boss-skill)에 제출해 주세요.

**Boss는 코딩 에이전트를 위한 전문가 스쿼드 워크플로입니다.** 에이전트 하나를 구조화된 엔지니어링 팀으로 바꿉니다. PM, 아키텍트, UI 디자이너, 테크 리드, 스크럼 마스터, 프론트엔드, 백엔드, QA, DevOps. 각 역할은 엄격한 품질 계약에 따라 작업하고 결과를 디스크에 기록하며, 계약은 작성자가 아니라 독립된 검증자가 확인합니다. 현재 브랜치 리뷰처럼 이미 있는 코드에 역할 하나만 실행할 수도 있고, 아이디어에서 Pull Request까지 전체 파이프라인을 실행할 수도 있습니다.

Boss는 Claude Code, Codex, OpenClaw, Antigravity, Hermes, DeepSeek Harness와 함께 동작합니다.

## DeepSeek Harness

Boss는 DeepSeek Harness 번들 [`dsh-boss-mode`](https://www.npmjs.com/package/dsh-boss-mode)도 제공합니다. **Boss Expert Squad** 프리셋과 Agent Teams 멤버 및 작업을 실시간으로 읽는 사이드바가 포함됩니다.

```bash
dsh plugin --profile desktop add dsh-boss-mode
```

DeepSeek Harness를 재시작하고 새 세션을 만든 뒤 **Boss Expert Squad**를 선택하세요.

## Boss가 필요한 이유

- **기존 코드에도 유용**: `/boss:review`는 현재 브랜치의 diff를 리뷰하고, `/boss:qa`는 이를 테스트하며, `/boss:ship`은 Pull Request를 엽니다. 각 명령은 자기 단계 하나만 수행하고 멈춥니다.
- **엄격한 품질 계약**: 각 역할에는 협상 불가능한 요구 사항 표가 있습니다(PRD에는 Given-When-Then 시나리오, 아키텍처는 최소 두 가지 옵션 비교, QA는 모든 주장을 뒷받침하는 명령과 종료 코드 기록).
- **작성자는 자기 작업을 채점하지 않습니다**: 스크립트로 판정할 수 있는 것은 스크립트가 확인하고, 나머지는 별도의 검증 에이전트가 판단하며 그 근거를 인용합니다. 계약을 통과하지 못하면 면제하지 않는 한 다음 단계가 막힙니다.
- **산출물 기반**: 각 단계는 `.boss/<feature>/` 아래에 실제 파일을 씁니다. 진행 상황은 에이전트의 주장이 아니라 디스크의 산출물로 판단합니다.
- **기본 TDD**: 개발 단계는 먼저 실패하는 테스트를 작성하고 RED를 확인한 뒤 최소한의 코드로 GREEN으로 만듭니다.
- **로컬 우선**: 텔레메트리도 원격 프록시도 없습니다. Boss는 `ship`을 실행하거나 동의할 때만 푸시하거나 Pull Request를 열거나 배포합니다.

## 전문가 스쿼드 명령

각 명령은 한 단계를 실행하고 검증한 뒤 멈추며, 다음 명령을 알려 줍니다:

| 명령              | 역할                | 쓰는 것                                                         |
| ----------------- | ------------------- | --------------------------------------------------------------- |
| `/boss:pm`        | PM                  | `prd.md`                                                        |
| `/boss:architect` | 아키텍트            | `architecture.md`                                               |
| `/boss:ui`        | UI 디자이너         | `ui-spec.md`, `ui-design.json`                                  |
| `/boss:review`    | 테크 리드           | diff에 대한 `code-review.md`, 또는 `tech-review.md`와 `plan.md` |
| `/boss:tasks`     | 스크럼 마스터       | `tasks.md`                                                      |
| `/boss:dev`       | 프론트엔드 / 백엔드 | 코드와 테스트                                                   |
| `/boss:qa`        | QA                  | `qa-report.md`                                                  |
| `/boss:ship`      | DevOps              | Pull Request, 또는 `--deploy`로 배포                            |
| `/boss:verify`    | 검증자              | 이미 있는 산출물에 대한 `verification.md`                       |

`--continue`를 붙이면 체인을 따라 계속 진행하고, `--stop-after <stage>`를 붙이면 이후 단계에서 멈춥니다. 전체 체인은 `pm → architect → ui → review → tasks → dev → qa → ship`입니다. Claude Code에서 `/boss:boss <request>`로 전체를 실행하거나, Boss에게 처음부터 끝까지 만들어 달라고 요청하세요.

Claude Code에서는 이 명령들이 실제 슬래시 명령입니다. 다른 에이전트에서는 Boss 스킬을 호출하고 단계를 지정하세요. 예를 들어 "Boss로 이 브랜치를 리뷰해 줘"라고 하면 됩니다.

## 빠른 시작

Boss를 코딩 에이전트에 설치하세요. 스킬은 마켓플레이스를 통해 배포되고 DeepSeek Harness 번들은 npm에 별도로 게시됩니다:

```text
# Claude Code
/plugin marketplace add echoVic/boss-skill
/plugin install boss@boss-skill

# Codex
codex plugin marketplace add echoVic/boss-skill   # 그다음 /plugins에서 boss 설치

# skills CLI를 쓰는 모든 에이전트
npx skills add echoVic/boss-skill

# DeepSeek Harness
dsh plugin --profile desktop add dsh-boss-mode
```

가장 저렴한 첫 시도는 지금 있는 브랜치에 대한 읽기 전용 리뷰입니다. `/boss:review`는 `.boss/<branch>/code-review.md`를 쓰고 소스 파일은 하나도 바꾸지 않습니다. 전체 체인은:

```text
/boss:boss Build a local personal todo app --skip-ui
```

`--skip-ui`는 API/CLI 프로젝트에서 UI 설계를 건너뛰고, `--quick`은 일상적인 확인을 건너뜁니다.

산출물은 `.boss/<feature>/`에 있습니다: `prd.md`, `architecture.md`, `ui-spec.md`, `ui-design.json`, `tech-review.md`, `plan.md`, `code-review.md`, `tasks.md`, `qa-report.md`, `deploy-report.md`, `verification.md`. 각 파일은 요약으로 시작해 하위 에이전트가 결론을 먼저 읽습니다. 산출물은 요청에 쓴 언어로 작성되며, `--lang <code>`로 바꿀 수 있습니다.

## 워크플로

전체 파이프라인이며, 각 단계는 다음 단계가 시작되기 전에 검증됩니다:

```text
요청 → 명확화 (--quick 제외)
  → PM: prd.md
  → 아키텍트: architecture.md
  → UI: ui-spec.md + ui-design.json (--skip-ui로 생략)
  → 테크 리드: tech-review.md + plan.md
  → 스크럼 마스터: tasks.md
  → 프론트엔드 / 백엔드: TDD 구현
  → QA: qa-report.md
  → DevOps: Pull Request 또는 배포, deploy-report.md
```

## 품질 게이트

각 단계의 계약은 두 번 확인됩니다. `skill/scripts/check-artifacts.mjs`가 스크립트로 판정할 수 있는 규칙을 적용하고, 나머지는 검증 에이전트가 판단합니다. 계약 외에도 각 게이트는 실제 명령으로 판정되고 결과는 해당 단계의 산출물에 기록됩니다:

| 게이트       | 단계           | 확인                                                           |
| ------------ | -------------- | -------------------------------------------------------------- |
| 0(코드 품질) | 개발 후, QA 전 | typecheck와 lint 통과, 의존성에 고위험 취약점 없음             |
| 1(테스트)    | QA 후, 배포 전 | 단위 및 통합 테스트 통과, 커버리지 ≥ 70%, P0/P1 없음, E2E 작성 |
| 2(성능)      | 웹 배포 전     | Lighthouse ≥ 80, API P99 < 500ms(웹 프로젝트만)                |

추적 가능한 `.boss/` 폴더가 필요 없다면 전체 체인도 필요 없을 가능성이 큽니다. 단일 역할을 쓰세요.

## 보안 및 개인정보

Boss는 로컬 우선이며 기본적으로 외부 요청을 하지 않습니다. `ship`은 직접 실행하거나 확인할 때만 푸시하거나 배포합니다. 릴리스 출처는 `.agents/plugins/provenance.json`에 있으며 저장소 URL, 소스 커밋, 게시자, 매니페스트 다이제스트를 고정합니다. `npm run provenance:verify`로 검증하세요. 전체 데이터 및 네트워크 경계는 [PRIVACY.md](./PRIVACY.md)에 있습니다.

## Evals

세 개의 계층이 Boss 자체를 검사합니다:

```bash
npm run test:install-smoke   # skills CLI와 `claude plugin validate`로 저장소를 로드
npm run evals                # 캡처한 트랜스크립트를 채점, 모델은 호출하지 않음
npm run evals:agent          # evals/를 실제 Claude Code 에이전트로 실행 (API 크레딧 사용)
```

`npm run evals:agent`는 [`claude plugin eval`](https://code.claude.com/docs/en/plugin-evals)을 감쌉니다. 케이스들은 작은 수정이 Boss를 트리거하지 않는지, 단계가 끝나면 멈추는지, 리뷰가 소스 파일을 수정하지 않는지, 검증이 깨진 계약을 보고하는지 확인합니다. `ANTHROPIC_API_KEY` 시크릿을 설정하면 같은 스위트가 `.github/workflows/skill-behavior.yml`에서 매주 실행됩니다.

## 개발

Node.js ≥ 22.18이 필요합니다.

```bash
git clone https://github.com/echoVic/boss-skill.git
cd boss-skill
npm install
npm run typecheck
npm test
```

다른 스크립트: `npm run test:skills`(트랜스크립트 파싱), `npm run test:contracts`(산출물 검사기), `npm run lint`(Biome). 릴리스는 `npm run release -- patch|minor|major|<version>`으로 합니다. 스크립트는 깨끗한 워크트리를 확인하고 typecheck, lint, 테스트를 실행한 뒤 버전 동기화, 커밋, 태그, 푸시를 수행합니다. [CONTRIBUTING.md](./CONTRIBUTING.md)와 [docs/dsh-release.md](./docs/dsh-release.md)를 참고하세요.

## 설계

Boss는 BMAD(Breakthrough Method of Agile AI-Driven Development)와 "더 적게, 더 높은 품질의 코드를 쓰기" 철학에서 영감을 받았습니다. 전문가 스쿼드 모델은 harness를 가볍게 유지합니다 — 런타임 상태 머신, 이벤트 소싱, hooks 없음 — 엄격한 품질 계약과 산출물 기반 협업은 유지합니다. [DESIGN.md](./DESIGN.md)와 `skill/references/principles.md`를 읽어 보세요.

## 라이선스

[MIT](LICENSE)
