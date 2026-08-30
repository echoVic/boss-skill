# boss-skill

[![npm version](https://img.shields.io/npm/v/@blade-ai/boss-skill)](https://www.npmjs.com/package/@blade-ai/boss-skill)
[![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/echoVic/boss-skill?utm_source=oss&utm_medium=github&utm_campaign=echoVic%2Fboss-skill&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)](https://coderabbit.ai)
[![Boss trust badge](https://img.shields.io/endpoint?url=https%3A%2F%2Fhol.org%2Fapi%2Fregistry%2Fbadges%2Fplugin%3Fslug%3Dechovic%252Fboss%26metric%3Dtrust%26style%3Dflat)](https://hol.org/registry/plugins/echovic%2Fboss)

**Languages / 语言 / 言語 / 언어 / Idiomas / Langues:** [English](./README.md) · [中文](./README.zh-CN.md) · [日本語](./README.ja.md) · [한국어](./README.ko.md) · [Español](./README.es.md) · [Français](./README.fr.md) · [Português](./README.pt-BR.md)

![boss-skill promo](https://raw.githubusercontent.com/echoVic/boss-skill/main/boss-skill-promo.png)

**Boss는 코딩 에이전트를 위한 감사 가능한 에이전트 팀 워크플로입니다.** 하나의 코딩 에이전트를 구조화된 엔지니어링 팀으로 바꿔 줍니다: PM, Architect, UI Designer, Tech Lead, Scrum Master, Frontend, Backend, QA, DevOps. 프롬프트만 있는 에이전트 팀과 달리 Boss는 런타임 상태, 추가 전용(append-only) 이벤트, 품질 게이트, 결정론적 평가(eval), 훅, 리플레이 가능한 산출물을 더합니다.

Boss는 Claude Code, Codex, OpenClaw, Antigravity, Hermes와 함께 동작합니다.

## Boss가 필요한 이유

프롬프트만으로 오케스트레이션하면 체계적으로 들릴 수 있지만, 대개 계획이 실제로 지켜졌는지, 테스트가 실행되었는지, 게이트가 통과했는지, 상태가 환각되지 않았는지 증명할 수 없습니다. Boss는 증거를 중심으로 설계되었습니다:

- **이벤트 소싱 런타임**: 파이프라인 상태는 `.boss/<feature>/.meta/events.jsonl`에 추가되고 읽기 전용 실행 상태로 투영됩니다.
- **우회할 수 없는 게이트**: QA, 배포, 최종 점검이 느슨한 지시 대신 런타임 스테이지로 모델링됩니다.
- **리플레이 가능한 산출물**: PRD, 아키텍처 문서, 작업 목록, QA 보고서, 배포 보고서, 요약이 `.boss/<feature>/` 아래에 보관됩니다.
- **결정론적 평가(eval)**: 캡처된 트랜스크립트를 실제 LLM을 호출하지 않고 채점할 수 있습니다.
- **에이전트 친화적인 CLI**: 명령어가 JSON 출력, `--describe`, 드라이 런, 제한된 필드, 구조화된 오류를 지원합니다.

## 역할 하나 또는 팀 전체 사용

Boss는 하나의 모놀리식 명령어가 아닙니다. 기존 프로젝트에 역할 하나만 실행하거나, 아이디어에서 전달까지 전체 파이프라인을 실행할 수 있습니다.

| 명령어 | 역할 | 사용 시기 |
| --- | --- | --- |
| `/boss` | 전체 4단계 파이프라인 | 아이디어에서 출시 가능한 결과물까지 진행하려는 경우 |
| `/boss:plan` | PM + Architect 계획 | 구현 전에 PRD와 아키텍처가 필요한 경우 |
| `/boss:review` | Tech Lead 리뷰 | 읽기 전용 코드, PR, 디자인 리뷰가 필요한 경우 |
| `/boss:qa` | QA + 게이트 | 검증 가능한 테스트 증거가 필요한 경우 |
| `/boss:ship` | DevOps 빌드 및 배포 점검 | 출시할 준비가 된 경우 |
| `/boss:extend` | 커스텀 에이전트, 팩, 게이트 | 팀에 맞게 Boss를 조정하려는 경우 |
| `/boss:upgrade` | Boss 스킬 업그레이드 및 훅 재설치 | 최신 npm 패키지와 훅 설정을 원하는 경우 |

## Boss를 사용해야 할 때

| 적합한 경우 | 적합하지 않은 경우 |
| --- | --- |
| 요구사항, 설계, 구현, 테스트, 전달 증거가 필요한 새 기능 | 한 줄 수정이나 아주 작은 로컬 편집 |
| API, 풀스택, UI 또는 중간 규모 제품 작업 | 순수한 코드 읽기나 설명 |
| `.boss/<feature>/` 산출물이 가치 있는 작업 | 완전한 스펙이 이미 있어 빠른 패치만 필요한 작업 |
| 반복 가능한 게이트와 감사 추적을 원하는 팀 | 조정이나 리뷰 증거가 필요 없는 작업 |

경험 법칙: 추적 가능한 `.boss/` 폴더가 필요 없다면 전체 `/boss` 파이프라인도 대개 필요하지 않습니다. 역할 하나만 사용하거나 코딩 에이전트가 직접 편집하게 하세요.

## CLI가 없어도 동작합니다

Boss는 런타임에 `boss` CLI를 감지합니다. CLI가 없으면 워크플로는 이벤트 스트림 대신 `.boss/<feature>/` 아래의 Markdown 산출물로 저하될 수 있습니다. CLI는 감사성 업그레이드입니다: 이벤트 소싱, 리플레이 가능한 재개, 결정론적 평가(eval), 런타임 게이트, 구조화된 진단을 제공합니다.

Boss가 "한 번 설치하면 자율 전달이 보장된다"는 의미는 아닙니다. 런타임 워크플로와 증거 게이트를 제공할 뿐이며, 활성 코딩 에이전트는 여전히 Boss 프로토콜을 따라야 합니다.

## 빠른 시작

### 1. 설치

Boss는 코딩 에이전트에 설치하는 스킬이지, 다른 스킬을 설치하는 도구가 아닙니다.

**권장 — `skills` CLI 사용([vercel-labs/skills](https://github.com/vercel-labs/skills), skills.sh):**

```bash
npx skills add echoVic/boss-skill
```

스킬을 설치하는 표준적이고 에이전트에 구애받지 않는 방법입니다. 저장소에서 `boss`를 찾아내고, 대상 에이전트 / 범위(프로젝트 vs 전역) / 설치 방법을 물어본 뒤, 커밋할 수 있는 `skills-lock.json`을 기록합니다. Boss는 단일 스킬 루트로 제공되므로 선택 목록에는 `boss` 하나만 표시됩니다 — 내부 방법론도 함께 따라옵니다.

**대안 — Boss 자체 멀티 에이전트 설치 프로그램**(Claude Code, Codex, OpenClaw, Antigravity, Hermes를 자동 감지하여 모두에 설치하고 Codex 훅도 병합):

```bash
# One-shot, no global install
npx @blade-ai/boss-skill

# Or install globally, then run the self-install wizard
npm install -g @blade-ai/boss-skill
boss-skill
```

Claude Code 플러그인 모드의 경우:

```bash
claude --plugin-dir "$(boss-skill path)"
```

### 2. 경량 파이프라인 실행

코딩 에이전트 안에서:

```text
/boss Build a local personal todo app --roles core --skip-deploy
```

- `--roles core`는 PM, Architect, Dev, QA를 사용합니다.
- `--skip-deploy`는 구현과 테스트 증거 이후에 중지합니다.

### 3. 결과 확인

```bash
boss status todo-app --json
boss runtime inspect-pipeline todo-app
```

예상되는 산출물 구조:

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

## 설치 세부 사항

```bash
npm install -g @blade-ai/boss-skill
boss-skill install
```

유용한 설치 명령어:

```bash
boss-skill install --dry-run
boss-skill uninstall
boss-skill path
boss-skill --version
```

자동 감지 대상:

| 에이전트 | 감지 | 설치 방법 |
| --- | --- | --- |
| OpenClaw | `~/.openclaw/` | `~/.openclaw/skills/boss/`로 복사하고 메타데이터 주입 |
| Codex | `~/.codex/` | `~/.codex/skills/boss/`로 복사, 메타데이터 주입, 훅 병합 |
| Antigravity | `~/.gemini/antigravity/` | Antigravity 스킬 디렉터리로 복사하고 메타데이터 주입 |
| Hermes | `~/.hermes/` | `~/.hermes/skills/boss/`로 복사하고 메타데이터 주입 |
| Claude Code | 항상 사용 가능 | `--plugin-dir`을 사용하는 플러그인 모드 |

## 플랫폼 지원

Boss는 Node.js `>=20`을 대상으로 하며 Linux, macOS, Windows에서 실행됩니다. CLI는 명시적 인자 배열을 사용하는 `spawnSync`로만 외부 프로세스를 실행하고(`shell: true`는 사용하지 않음), Windows에서는 `npm`/`npx`를 `.cmd` 변형으로 해석하므로 핵심 파이프라인에 POSIX 전용 가정이 없습니다.

두 가지 기능은 선택적 외부 도구에 의존하며, 도구가 없으면 우아하게 저하됩니다:

- **WIP 체크포인트**(stash/commit/branch)에는 `git`과 git 워킹 트리가 필요합니다. 저장소 밖이거나 `PATH`에 `git`이 없으면 체크포인트가 조용히 건너뛰어지며 파이프라인에는 영향이 없습니다.
- **레거시 수기 작성 `gate.sh` 플러그인**은 `bash`를 통해 실행됩니다. Windows에서 `PATH`에 bash가 없으면 실행에 실패하므로, 이식 가능한 플러그인에는 크로스 플랫폼 Node 게이트 진입점(`gate.js` / `gate.mjs`)을 권장합니다.

`boss doctor`를 실행하면 설치 및 이벤트 스트림 상태와 함께 해결된 런타임 환경(Node 버전, 플랫폼, `git` 사용 가능 여부)을 확인할 수 있습니다.

## 명령어

일반적인 슬래시 명령어:

```text
/boss Build a todo app
/boss Add authentication to this existing project --skip-ui
/boss Build an API service --skip-deploy --quick
/boss Continue the previous task --continue-from 3
/boss Lightweight mode --roles core --hitl-level off
/boss:upgrade
```

일반적인 옵션:

| 옵션 | 의미 |
| --- | --- |
| `--roles <preset>` | `full`은 9개 역할 전체, `core`는 PM/Architect/Dev/QA |
| `--skip-ui` | UI 설계 건너뛰기 |
| `--skip-deploy` | 배포 건너뛰기 |
| `--quick` | 확인 및 요구사항 명확화 노드 건너뛰기 |
| `--template` | `.boss/templates/` 초기화 후 일시 중지 |
| `--continue-from <1-4>` | 파이프라인 스테이지에서 재개 |
| `--hitl-level <level>` | 휴먼 인 더 루프 모드: `auto`, `interactive`, `off` |

Boss CLI 명령어:

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

에이전트 대상 `boss` 명령어는 해당되는 경우 위 공통 옵션을 사용합니다. 정확한 JSON 스키마를 보려면 명령어에 `--describe`를 실행하세요:

- `--json`: 구조화된 출력. TTY가 아닌 stdout은 기본적으로 JSON
- `--describe`: JSON 명령어 스키마
- `--dry-run`: 쓰기 또는 위험한 작업에 대한 구조화된 작업 계획
- `--json-input=<json|->`: JSON 입력 페이로드
- `--fields=<a,b>` 및 `--limit=<n>`: 제한된 출력
- `--yes`: 추가 확인이 필요한 고위험 비대화형 명령어에만 필요

구조화된 오류는 stderr에 `{"error":{...}}` 형식으로 기록되며 `code`, `message`, `input`, `retryable`, `suggestion`을 포함합니다.

## 워크플로

Boss는 4단계 워크플로를 따릅니다:

```text
User request
  -> requirement clarification
  -> Stage 1: PM, Architect, UI Designer
  -> Stage 2: Tech Lead, Scrum Master
  -> Stage 3: Frontend, Backend, QA, gates
  -> Stage 4: DevOps, deployment checks, summary
```

전체 역할 구성:

| 역할 | 담당 업무 |
| --- | --- |
| PM | 요구사항 발굴, PRD, 숨은 요구사항, 엣지 케이스 |
| Architect | 시스템 아키텍처, 기술 설계, API |
| UI Designer | UI/UX 스펙과 렌더링 가능한 디자인 JSON |
| Tech Lead | 기술 리뷰, 리스크 평가 |
| Scrum Master | 작업 분할과 수락 기준 |
| Frontend | UI 구현과 프런트엔드 테스트 |
| Backend | API, 스토리지, 백엔드 테스트 |
| QA | 테스트 실행, 버그 리포트, 검증 증거 |
| DevOps | 빌드, 배포, 헬스 체크 |

## 런타임 및 품질 게이트

Boss에는 두 계층의 품질 관리가 있습니다:

- **하드 제약** — 코드와 CI로 검증: 런타임 이벤트, 보호된 `execution.json`, 훅, 설치 매트릭스 테스트, 하네스 시나리오, Vitest 커버리지.
- **에이전트 프로토콜 제약** — 스킬 번들이 안내: DAG 디스패치, 점진적 참조 로딩, 테스트 증거, 게이트 규율.

내장 게이트:

| 게이트 | 시점 | 점검 사항 |
| --- | --- | --- |
| Gate 0 | 개발 후, QA 전 | TypeScript, lint, 기본 컴파일 점검 |
| Gate 1 | QA 후, 배포 전 | 테스트 증거, P0/P1 버그 없음, E2E 기대치 |
| Gate 2 | 웹 배포 전 | 적용 가능한 경우 Lighthouse 및 API 지연 시간 목표 |

훅은 환경 변수로 제어됩니다:

| 변수 | 값 |
| --- | --- |
| `BOSS_HOOK_PROFILE` | `minimal`, `standard`, `strict` |
| `BOSS_DISABLED_HOOKS` | 쉼표로 구분된 훅 ID |

런타임 상태는 `.boss/<feature>/.meta/workflow-plan.json`과 `.boss/<feature>/.meta/execution.json`이 뒷받침합니다. 워크플로 정의는 `workflowHash`, `packHash`, 산출물 DAG 해시를 기록합니다. 런타임 재개는 `boss runtime resume <feature> --from-run <run-id>`를 사용해 플랜을 다시 로드하고 노드 입력을 비교하며, 다음에 스케줄 가능한 노드를 위해 `execution.workflow.nextNodeIds`를 구체화합니다. `GateEvaluated` / `WaveVerified` 이벤트는 게이트와 증거 웨이브가 완료되면 워크플로 노드 상태를 업데이트합니다.

## 보안에 민감한 영역

Boss는 의도적으로 게시되는 플러그인 매니페스트를 작게 유지합니다. 번들된 스킬만 선언하며, 관련 컴패니언 파일이 존재하지 않는 한 MCP 서버, 앱 매니페스트, 에셋 참조를 생략합니다. Codex 훅은 마켓플레이스 매니페스트가 아니라 `boss-skill install` 흐름에서 설치됩니다.

npm 패키지는 `.claude/settings.json`, `.claude/settings.local.json` 같은 로컬 개발 에이전트 설정을 제외합니다. 게시 가능한 플러그인 메타데이터는 `.claude-plugin/`, `.codex-plugin/`, `.agents/plugins/marketplace.json` 아래에 있습니다.

릴리스 프로비넌스는 `.agents/plugins/provenance.json`에 있습니다. 저장소 HTTPS URL, 불변 소스 커밋 SHA, 게시자 신원, 플러그인 매니페스트 및 보안에 민감한 구성 요소의 SHA-256 다이제스트를 고정합니다. 다음으로 검증하세요:

```bash
npm run provenance:verify
```

게시자 검증은 패키지 외부에서 이루어집니다. HOL 레지스트리의 경우 `https://hol.org/guard/plugins`에서 저장소 소유자의 GitHub 계정으로 플러그인을 등록하세요. 공개 트러스트 카드는 `https://hol.org/registry/plugins/echovic%2Fboss/embed`에서 확인할 수 있습니다.

게시하거나 설치하기 전에 검토해야 할 보안에 민감한 동작:

- `boss-skill install`은 `~/.codex/skills/boss/` 같은 에이전트 설정 디렉터리에 쓸 수 있고, Boss가 관리하는 항목을 `~/.codex/hooks.json`에 병합할 수 있습니다.
- 훅 항목은 `boss hooks run ...`을 실행하며, 이는 `scripts/hooks/`의 스크립트를 디스패치합니다.
- `.boss/plugins/<name>/plugin.json` 아래의 런타임 플러그인은 게이트 또는 리포터 훅을 등록할 수 있습니다. 활성화하기 전에 프로젝트 로컬 플러그인을 검토하세요.
- 민감한 환경에서 훅 동작을 줄여야 할 때는 `BOSS_HOOK_PROFILE=minimal` 또는 `BOSS_DISABLED_HOOKS=<ids>`를 사용하세요.

Boss는 로컬 우선이며 기본적으로 아웃바운드 네트워크 요청을 하지 않습니다. 유일한 네트워크 표면은 옵트인 방식의 루프백 전용 `boss design preview` 서버입니다. 전체 데이터 및 네트워크 경계는 [PRIVACY.md](PRIVACY.md)를 참조하세요.

## 파이프라인 산출물

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

생성된 UI 디자인을 미리 보려면 대화형 환경에서 다음을 실행하세요:

```bash
boss design preview <feature>
```

## 평가(Eval)

Boss 평가(eval)는 실제 LLM을 시작하지 않고 캡처된 픽스처를 채점합니다:

```bash
npm run evals
npm run evals:release
```

릴리스 평가에는 release-evidence 및 pipeline-compliance 점검이 포함됩니다. 런타임 명령어 사용, 산출물 기록, `execution.json` 직접 수정 방지, 워크플로 스케줄링 필드를 검증합니다.

자세한 내용은 [test/evals/README.md](./test/evals/README.md)를 참조하세요.

## 개발

요구 사항:

- Node.js >= 20
- 셸 기반 테스트 헬퍼용 `jq`

설정:

```bash
git clone https://github.com/echoVic/boss-skill.git
cd boss-skill
npm install
npm run build
npm run typecheck
npm test
```

유용한 스크립트:

```bash
npm run build
npm run typecheck
npm test
npm run test:skills
npm run test:harness
npm run test:install-matrix
npm run evals
```

## 저장소 구조

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

주요 소스 영역:

- `packages/boss-cli/src/`에는 CLI 및 런타임 TypeScript 소스가 있습니다.
- `packages/boss-cli/dist/`에는 게시된 npm bin이 사용하는 생성된 CLI 출력이 있습니다. 직접 수정하지 마세요.
- `packages/boss-cli/assets/`에는 내장 DAG, 파이프라인 팩, 플러그인 스키마, 플러그인이 있습니다.
- `skill/SKILL.md`는 에이전트 대상 오케스트레이션의 주요 진입점입니다.
- `skill/agents/`에는 역할 프롬프트가 있습니다.
- `skill/commands/`에는 슬래시 명령어가 있습니다.
- `skill/templates/`에는 산출물 템플릿이 있습니다.

## 릴리스

패키지 메타데이터와 스킬/플러그인 매니페스트 전반에서 버전 번호가 동기화된 상태를 유지하도록 릴리스 스크립트를 사용하세요:

```bash
npm run release -- patch
npm run release -- minor
npm run release -- major
npm run release -- 3.11.0
npm run release -- 3.11.0 --dry-run
npm run release -- 3.11.0 --no-publish
```

릴리스 스크립트는 깨끗한 워킹 트리를 확인하고, 테스트를 실행하고, 버전을 동기화하고, 일관성을 검증하고, 커밋과 태그를 생성한 뒤, `--no-publish`를 사용하지 않는 한 게시합니다.

자세한 내용은 [CONTRIBUTING.md](./CONTRIBUTING.md)를 참조하세요.

## 설계

Boss는 BMAD(Breakthrough Method of Agile AI-Driven Development)에서 영감을 받았습니다. 이 프로젝트는 그 아이디어를 에이전틱 소프트웨어 작업을 위한 감사 가능한 런타임으로 적용했습니다.

자세한 내용은 [DESIGN.md](./DESIGN.md)와 `skill/references/bmad-methodology.md`를 참조하세요.

## 스타 히스토리

[![Star History Chart](https://api.star-history.com/svg?repos=echoVic/boss-skill&type=Date)](https://star-history.com/#echoVic/boss-skill&Date)

## 라이선스

MIT
