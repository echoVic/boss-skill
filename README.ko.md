# boss-skill

[![skills.sh](https://skills.sh/b/echovic/boss-skill)](https://skills.sh/echovic/boss-skill)
[![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/echoVic/boss-skill?utm_source=oss&utm_medium=github&utm_campaign=echoVic%2Fboss-skill&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)](https://coderabbit.ai)
[![G-Star Incubation](https://img.shields.io/badge/G--Star-Incubation-C71D23)](https://atomgit.com/echoVic/boss-skill)
[![AtomGit Mirror](https://img.shields.io/badge/AtomGit-Mirror-1F6FEB)](https://atomgit.com/echoVic/boss-skill)
[![Boss trust badge](https://img.shields.io/endpoint?url=https%3A%2F%2Fhol.org%2Fapi%2Fregistry%2Fbadges%2Fplugin%3Fslug%3Dechovic%252Fboss%26metric%3Dtrust%26style%3Dflat)](https://hol.org/registry/plugins/echovic%2Fboss)

**Languages / 语言 / 言語 / 언어 / Idiomas / Langues:** [English](./README.md) · [中文](./README.zh-CN.md) · [日本語](./README.ja.md) · [한국어](./README.ko.md) · [Español](./README.es.md) · [Français](./README.fr.md) · [Português](./README.pt-BR.md)

![boss-skill promo](https://raw.githubusercontent.com/echoVic/boss-skill/main/boss-skill-promo.png)

> 이 프로젝트는 AtomGit G-Star Incubation Program의 일부입니다. GitHub가 정식 리포지토리이며, AtomGit은 중국 내 빠른 액세스를 위한 자동 동기화 미러를 제공합니다. Issue와 Pull Request는 [GitHub](https://github.com/echoVic/boss-skill)에 제출해 주세요.
>
> GitHub: <https://github.com/echoVic/boss-skill> · AtomGit 미러: <https://atomgit.com/echoVic/boss-skill>

**Boss는 코딩 에이전트를 위한 전문가 스쿼드 워크플로입니다.** 하나의 코딩 에이전트를 구조화된 엔지니어링 팀으로 바꿔 줍니다: PM, Architect, UI Designer, Tech Lead, Scrum Master, Frontend, Backend, QA, DevOps. 프롬프트만 있는 에이전트 팀과 달리 Boss는 역할별 하드 품질 계약을 강제하고, 재생 가능한 산출물을 생성하며, 단계를 자동으로 연결합니다——어디서 시작하든 당신이 멈출 때까지 후속 단계를 실행합니다.

Boss는 Claude Code, Codex, OpenClaw, Antigravity, Hermes와 함께 동작합니다.

## Boss가 필요한 이유

프롬프트만 있는 오케스트레이션은 체계적으로 보여도 계획이 실제로 이행됐는지, 테스트가 실행됐는지, 게이트를 통과했는지 증명할 수 없는 경우가 많습니다. Boss는 증거와 하드 계약을 중심으로 구축됩니다:
- **하드 품질 계약**: 모든 역할에는 타협 불가한 요구사항 테이블이 있습니다(예: PRD는 Given-When-Then 시나리오 필수, 아키텍처는 최소 2가지 옵션 비교, QA는 검증됐거나 솔직하게 미검증으로 표기한 증거 필수). 계약 실패 시 명시적으로 재정의하지 않는 한 다음 단계로 진행할 수 없습니다.
- **산출물 기반**: 모든 단계는 `.boss/<feature>/` 아래에 실제 파일을 씁니다. 진행 상황은 에이전트의 주장이 아닌 디스크의 산출물로 판단합니다.
- **연속 체인**: 임의의 단계(`/boss:pm`, `/boss:dev` ...)에서 시작하면 Boss는 `ship` 또는 당신이 멈출 때까지 모든 하위 단계를 자동 실행합니다. 수동 인계가 필요 없습니다.
- **엔지니어링 원칙**: 스쿼드는 10가지 원칙을 공유합니다——실제 산출물 검증, 근본 원인 수정, 레버리지 구축, 도메인 모델링, 경계 규율, 검증 가능한 단위 시퀀싱, 동작 테스트, 독자 부담 최소화, 구조화된 경험, 자율 규칙. 각 에이전트는 적용한 원칙을 명시합니다.
- **기본 TDD**: 개발 단계는 먼저 실패하는 테스트를 작성하고 RED를 확인한 후 GREEN으로 만드는 최소 코드를 작성합니다.
- **기본 제로 네트워크**: 원격 측정 없음, 폰홈 없음, 원격 LLM 프록시 없음. 유일한 네트워크 표면은 UI 프로토타이핑용 옵트인 루프백 미리보기 서버(`127.0.0.1`)입니다. 자세한 내용은 [PRIVACY.md](./PRIVACY.md)를 참조하세요.
- **결정론적 eval**: 캡처된 트랜스크립트는 실제 LLM을 호출하지 않고 채점할 수 있습니다.

## 전문가 스쿼드 명령

Boss는 단일 모놀리식 명령이 아닙니다. 각 슬래시 명령은 진입점이며, 기본적으로 모든 하위 단계를 자동 실행합니다.

| 명령              | 시작점           | 자동 실행 범위         | 사용 시기                           |
| ----------------- | ---------------- | ---------------------- | ----------------------------------- |
| `/boss`           | PM               | 전체 체인 → ship       | 아이디어에서 출시 가능한 결과물까지 |
| `/boss:pm`        | PM               | Architect → ... → Ship | 요구사항 분석부터 시작              |
| `/boss:architect` | Architect        | UI → ... → Ship        | 스펙은 있지만 설계가 필요할 때      |
| `/boss:ui`        | UI Designer      | Review → ... → Ship    | 아키텍처는 있지만 UI가 필요할 때    |
| `/boss:review`    | Tech Lead        | Tasks → ... → Ship     | 기술 리뷰 + 구현 계획이 필요할 때   |
| `/boss:tasks`     | Scrum Master     | Dev → QA → Ship        | 작업 분해가 필요할 때               |
| `/boss:dev`       | Frontend/Backend | QA → Ship              | 구현 시작                           |
| `/boss:qa`        | QA               | Ship                   | 테스트 증거가 필요할 때             |
| `/boss:ship`      | DevOps           | (종료)                 | 배포만                              |

전체 체인:

```
pm → architect → ui → review → tasks → dev → qa → ship
```

"멈춰", "이 단계만"이라고 말하거나 `--stop-after <단계>`를 전달하면 연속이 중지됩니다.

## 빠른 시작

### 1. 설치

Boss는 코딩 에이전트에 설치하는 스킬입니다. 배포는 마켓플레이스만 통해 이뤄지며, npm 패키지도 전역 바이너리도 없습니다.

**Claude Code — 플러그인 마켓플레이스(권장):**

```text
/plugin marketplace add echoVic/boss-skill
/plugin install boss@boss-skill
```

**Codex — 플러그인 마켓플레이스:**

```bash
codex plugin marketplace add echoVic/boss-skill
```

플러그인 브라우저(`/plugins`)를 열고 **boss**를 설치하세요.

**모든 에이전트 — `skills` CLI([vercel-labs/skills](https://github.com/vercel-labs/skills), skills.sh) 경유:**

```bash
npx skills add echoVic/boss-skill
```

### 2. 기존 프로젝트에서 시도

가장 저렴한 첫 실행은 기존 코드에 대한 읽기 전용 리뷰입니다:

```
/boss:review
```

`.boss/<feature>/` 아래에 위험, 발견사항, 심각도를 담은 `tech-review.md`(와 `plan.md`)를 얻습니다. 리포지토리의 다른 파일은 건드리지 않습니다.

검증 가능한 테스트 증거가 필요한가요? `/boss:qa`가 테스트를 실행하고 `qa-report.md`를 씁니다.

### 3. 전체 파이프라인 실행

코딩 에이전트 내에서:

```text
/boss Build a local personal todo app --skip-ui
```

- `--skip-ui`는 UI 설계 단계를 건너뜁니다(API 전용/CLI 프로젝트용).
- `--quick`은 일상적인 확인 프롬프트를 건너뜁니다.

### 4. 결과 확인

산출물은 `.boss/<feature>/` 아래에 있습니다:

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

각 Markdown 산출물은 `## 摘要`(요약) 섹션으로 시작하며, 하위 에이전트는 결론을 먼저 읽고 필요할 때 전문을 읽습니다.

## 워크플로

```text
사용자 요청
  → 요구사항 명확화(--quick 제외)
  → PM: 요구사항 분석 → prd.md
  → Architect: 시스템 설계 → architecture.md
  → UI Designer: UI/UX 스펙 → ui-spec.md + ui-design.json(--skip-ui로 건너뜀)
  → Tech Lead: 기술 리뷰 + 구현 계획 → tech-review.md + plan.md
  → Scrum Master: 작업 분해 → tasks.md
  → Frontend / Backend: TDD 구현
  → QA: 테스트 실행, 버그 리포트, 증거 → qa-report.md
  → DevOps: 빌드, 배포, 상태 검사 → deploy-report.md
```

### 역할과 산출물

| 역할         | 책임                                                 | 산출물                         |
| ------------ | ---------------------------------------------------- | ------------------------------ |
| PM           | 요구사항 분석, PRD, 숨겨진 니즈, 엣지 케이스         | `prd.md`                       |
| Architect    | 시스템 아키텍처, 기술 설계, API                      | `architecture.md`              |
| UI Designer  | UI/UX 스펙, 렌더링 가능한 설계 JSON, HTML 프로토타입 | `ui-spec.md`, `ui-design.json` |
| Tech Lead    | 기술 리뷰, 위험 평가, 구현 계획                      | `tech-review.md`, `plan.md`    |
| Scrum Master | 작업 분해와 인수 기준                                | `tasks.md`                     |
| Frontend     | UI 구현, TDD, 프론트엔드 테스트                      | 소스 코드                      |
| Backend      | API, 스토리지, TDD, 백엔드 테스트                    | 소스 코드                      |
| QA           | 테스트 실행, 버그 리포트, 검증 증거                  | `qa-report.md`                 |
| DevOps       | 빌드, 배포, 상태 검사                                | `deploy-report.md`             |

## 품질 계약

Boss의 품질 관리는 두 계층으로 이뤄집니다:
- **역할별 하드 요구사항**: 각 에이전트의 프롬프트에는 타협 불가한 요구사항 테이블이 정의돼 있습니다. 에이전트는 인계 전 자가 검사하며, 계약 실패 시 다음 단계로 진행할 수 없습니다.
- **품질 게이트**: 실제로 실행되는 명령이며, 그 판정은 단계 산출물에 기록됩니다.

| 게이트            | 시점           | 검사                                                                        |
| ----------------- | -------------- | --------------------------------------------------------------------------- |
| Gate 0(코드 품질) | 개발 후, QA 전 | TypeScript/lint 통과, 고심각도 의존성 취약점 없음                           |
| Gate 1(테스트)    | QA 후, 배포 전 | 단위 + 통합 테스트 통과, 커버리지 ≥ 70%, P0/P1 버그 없음, E2E 테스트 작성됨 |
| Gate 2(성능)      | 웹 배포 전     | Lighthouse ≥ 80, API P99 < 500ms(웹 프로젝트만)                             |

## Boss를 사용해야 할 때

| 적합                                                     | 부적합                                          |
| -------------------------------------------------------- | ----------------------------------------------- |
| 요구사항, 설계, 구현, 테스트, 납품 증거가 필요한 새 기능 | 한 줄 수정이나 작은 로컬 편집                   |
| API, 풀스택, UI, 중간 규모 제품 작업                     | 순수 코드 읽기나 설명                           |
| `.boss/<feature>/` 산출물이 가치 있는 작업               | 완전한 기존 스펙이 있고 빠른 패치만 필요한 작업 |
| 반복 가능한 품질 게이트와 감사 추적을 원하는 팀          | 조정이나 리뷰 증거가 필요 없는 작업             |

경험 법칙: 추적 가능한 `.boss/` 폴더가 필요 없다면 완전한 `/boss` 파이프라인이 필요 없을 수 있습니다. 단일 역할을 사용하거나 코딩 에이전트에 직접 편집시키세요.

## 보안 및 개인정보

Boss는 로컬 우선이며 기본적으로 외부 네트워크 요청을 하지 않습니다. 유일한 네트워크 표면은 UI 설계 단계에서 사용되는 옵트인 루프백 전용(`127.0.0.1`) HTML 프로토타입 서버입니다.

릴리스 provenance는 `.agents/plugins/provenance.json`에 있습니다. 리포지토리 HTTPS URL, 불변 소스 커밋 SHA, 게시자 ID, 플러그인 매니페스트의 SHA-256 다이제스트를 기록합니다. 다음으로 검증하세요:

```bash
npm run provenance:verify
```

전체 데이터 및 네트워크 경계는 [PRIVACY.md](./PRIVACY.md)를 참조하세요.

## 파이프라인 산출물

```text
.boss/<feature>/
├── prd.md              # PM — 제품 요구사항
├── architecture.md     # Architect — 시스템 설계
├── ui-spec.md          # UI Designer — UI/UX 스펙(--skip-ui로 건너뜀)
├── ui-design.json      # UI Designer — 렌더링 가능한 설계 JSON
├── tech-review.md      # Tech Lead — 기술 리뷰
├── plan.md             # Tech Lead — 구현 계획
├── tasks.md            # Scrum Master — 작업 분해
├── qa-report.md        # QA — 테스트 증거
└── deploy-report.md    # DevOps — 배포 기록
```

## Evals

Boss eval은 실제 LLM을 시작하지 않고 캡처된 픽스처를 채점합니다:

```bash
npm run evals
npm run evals:release
```

릴리스 eval에는 release-evidence와 pipeline-compliance 검사가 포함됩니다——산출물 기록, 폐기된 runtime 명령 회피, 전문가 스쿼드 오케스트레이션 동작을 검증합니다.

자세한 내용은 [test/evals/README.md](./test/evals/README.md)를 참조하세요.

## 개발

요구사항:
- Node.js >= 22.18

설정:

```bash
git clone https://github.com/echoVic/boss-skill.git
cd boss-skill
npm install
npm run typecheck
npm test
```

유용한 스크립트:

```bash
npm run typecheck    # tsc --noEmit
npm test             # vitest(단위 + 스킬 동작 + evals)
npm run test:skills  # 스킬 동작 테스트만
npm run evals        # 결정론적 트랜스크립트 eval
npm run lint         # biome ci
```

## 리포지토리 구조

```text
boss-skill/
├── skill/                      # 코딩 에이전트에 설치되는 스킬 번들(자체 완결)
│   ├── SKILL.md                # 메인 오케스트레이션 진입점(불변 조건 + 인덱스)
│   ├── agents/                 # 역할 프롬프트(boss-pm, boss-architect, ...)
│   ├── commands/               # 슬래시 명령(/boss, /boss:pm, ...)
│   ├── references/             # 공유 방법론(principles, quality-gate, ...)
│   ├── skills/                 # 도메인별 방법론 스킬(pm/, qa/, devops/, ...)
│   └── templates/              # 산출물 템플릿(.md.template)
├── test/                       # Vitest, 스킬 동작, eval 테스트
├── scripts/                    # release.js, provenance.js
├── docs/                       # 역사적 specs, plans, reports
├── examples/                   # 예시 프로젝트
├── .claude-plugin/             # Claude Code 플러그인 매니페스트 + 마켓플레이스
├── .codex-plugin/              # Codex 플러그인 매니페스트 + 마켓플레이스
├── .agents/plugins/            # 리포지토리 범위 플러그인 마켓플레이스 + provenance
├── tsconfig.json               # 타입 체크 전용 설정(noEmit)
└── package.json                # 비공개 개발 워크스페이스(게시되지 않음)
```

## 릴리스

릴리스 스크립트를 사용해 패키지 메타데이터와 스킬/플러그인 매니페스트 간 버전 번호를 동기화하세요:

```bash
npm run release -- patch
npm run release -- minor
npm run release -- major
npm run release -- 4.1.0
npm run release -- 4.1.0 --dry-run
```

릴리스 스크립트는 작업 트리 클린 상태를 확인하고, 전체 검증 체인(typecheck, lint, test)을 실행하며, 모든 매니페스트의 버전을 동기화하고, 일관성을 검증한 후 커밋과 태그를 만들어 푸시합니다. 릴리스는 git 태그입니다: 마켓플레이스는 리포지토리를 읽습니다——npm publish도 빌드 단계도 없습니다.

자세한 내용은 [CONTRIBUTING.md](./CONTRIBUTING.md)를 참조하세요.

## 설계

Boss는 BMAD(Breakthrough Method of Agile AI-Driven Development)와 "write less, higher quality code" 철학에서 영감을 받았습니다. 전문가 스쿼드 모델은 하네스를 가볍게 유지합니다——runtime 상태 머신도 이벤트 소싱도 hooks도 없습니다——그러면서도 하드 품질 계약과 산출물 기반 협업을 유지합니다.

자세한 내용은 [DESIGN.md](./DESIGN.md), `skill/references/bmad-methodology.md`, `skill/references/principles.md`를 참조하세요.

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=echoVic/boss-skill&type=Date)](https://star-history.com/#echoVic/boss-skill&Date)

## License

MIT
