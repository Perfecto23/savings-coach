# Savings Coach Iteration Ledger

本文件记录当前交付状态。产品方向和范围以 `PRODUCT-CHARTER.md` 为准。

## Status Language

- `planned`：尚未开始。
- `in_progress`：正在实现或验证。
- `ready_for_release`：本地验收完成，尚未完成目标环境发布。
- `released`：代码已经发布，但不自动代表 live 行为正确。
- `verified_preview`：Preview 已完成独立 readback，但 production 尚未生效。
- `verified_live`：目标环境已经完成独立 readback。
- `blocked`：满足项目 blocker 定义，且没有安全的继续路径。

## Roadmap Status

| Iteration | Outcome | Status | Release evidence |
|---:|---|---|---|
| 1 | Quality foundation | `verified_live` | [PR #1](https://github.com/Perfecto23/savings-coach/pull/1)；Vercel production readback |
| 2 | EdgeOne hosting decision | `verified_live` | [PR #2](https://github.com/Perfecto23/savings-coach/pull/2)；`FAIL_FOR_CURRENT_SEQUENCE` |
| 3 | Safe invited-user access | `released` | [PR #4](https://github.com/Perfecto23/savings-coach/pull/4)；hosted 004 readback；Vercel production |
| 4 | Setup checkpoint | `ready_for_release` | [Draft PR #5](https://github.com/Perfecto23/savings-coach/pull/5)；local gates passed |
| 5 | Income-independent Plan activation | `planned` | — |
| 6 | Monthly execution Home | `planned` | — |
| 7 | Trustworthy Progress | `planned` | — |
| 8 | Monthly close and rollover | `planned` | — |
| 9 | One-channel reminder experiment | `planned` | — |
| 10 | Paid-intent beta and release candidate | `planned` | — |

## Iteration 1 Readback

- Date: 2026-08-30
- Outcome: 建立可重复的产品治理和公开登录页自动化回归。
- Status: `verified_live`
- Local branch: `codex/iteration-1-quality-foundation`
- Commits: `70ced96`、`8d41afc`、`089a9f1`
- Merge commit: `eeab88c`
- Remote branch: `origin/codex/iteration-1-quality-foundation`
- Pull request: [#1](https://github.com/Perfecto23/savings-coach/pull/1)
- Preview: `https://savings-coach-git-codex-iteration-1-39733f-perfecto23-projects.vercel.app`
- Production: `https://savings-coach.vercel.app`

### Delivered

- 项目级 `AGENTS.md` 和领域术语 `CONTEXT.md`。
- `docs/product/PRODUCT-CHARTER.md`，包含初始 10 次迭代。
- 项目级 `@playwright/test` 和 `test:e2e` 命令。
- Desktop Chrome 与 Pixel 5 两个 Playwright project。
- 公开 `/login` smoke，覆盖标题、语言、表单语义、浏览器原生校验和水平溢出。
- API、RSC、React composition 和 E2E 项目规则。

### Verified

- `pnpm lint`：exit 0；存在 3 条迭代前 warning。
- `pnpm exec tsc --noEmit`：exit 0。
- `pnpm build`：exit 0；13 个页面完成生成。
- `pnpm test:e2e`：2 passed；desktop 与 mobile 均通过。
- `git diff --check`：无 whitespace error。
- GitGuardian Security Checks：pass。
- Vercel Preview：pass。
- Codex 侧边栏浏览器：`/` 跳转 `/login`，标题、表单和 DOM 正常；无 browser error/warning log。
- PR #1 已合并到 `main`；Vercel production build 和独立浏览器 readback 通过。

### Not Claimed

- 尚未验证真实 Supabase 登录成功或 session refresh。
- 尚未运行 Firefox、WebKit 或真实移动设备。
- 尚未修改 production schema 或 production data。

## Release Gate

每次迭代发布前必须：

1. Review 当前 diff 和未跟踪文件。
2. 运行 `lint`、`typecheck`、`build` 和相关 E2E。
3. UI 改动使用 Codex 侧边栏浏览器验收。
4. Push 或部署前获得 Perfecto 的单次明确确认。
5. 发布后独立 readback，并按目标环境更新为 `verified_preview` 或 `verified_live`。

## Iteration 2 Safety Boundary

- EdgeOne 使用独立 POC 项目，不连接 production Supabase。
- Build 与公开入口使用无效的 fake public Supabase 配置。
- Auth 和 Server Action gate 必须等待隔离 staging Supabase。
- POC 不得读取或修改 production data。

## Iteration 2 Readback

- Local branch: `codex/iteration-2-edgeone-poc`
- Status: `verified_live`
- Pull request: [PR #2](https://github.com/Perfecto23/savings-coach/pull/2)
- Merge commit: `f06a348`
- GitGuardian and Vercel checks: pass。
- EdgeOne project: `makers-5llzko3fa3m5`，仅用于 POC。
- Deployment A: `dpfr2ly4pgcc`；clean Preview。
- Deployment B: `dpx9iypqi6g4`；临时 marker 与 server canary。
- Deployment A′: `dpx4kn6wo1b4`；从 clean commit 重新构建恢复。
- Result: `FAIL_FOR_CURRENT_SEQUENCE`；当前 10 次迭代选择 Vercel。
- Completed: 官方支持矩阵、Pass / Fail / Kill、原样 webpack build、Proxy 307、公开登录页和 Preview A/B/A′。
- Recovery evidence: known-source public redeploy verified；authenticated session/write recovery `NOT TESTED`。
- Environment evidence: canary 未进入测试过的 HTML 或 Client JS，但进入 `edge-functions/index.js`。冻结的 artifact isolation 条件未通过。
- Not tested: staging Auth、Server Action probe、Console log correlation 和 runtime secret isolation。
- Tenant isolation: `NOT TESTED`。
- External state changed: 创建隔离 EdgeOne POC 项目及四个 deployment；未连接生产数据或 secret。
- Revisit only with new evidence defined in `EDGEONE-POC.md`。
- Vercel production build: pass。
- Production browser readback: `/` 跳转 `/login`，标题与登录表单正常。

## Iteration 3 Readback

- Local branch: `codex/iteration-3-owner-isolation`
- Commit: `64f2f73`
- Pull request: [PR #4](https://github.com/Perfecto23/savings-coach/pull/4)
- Merge commit: `bc72e81`
- GitGuardian and Vercel Preview checks: pass。
- Vercel Preview browser readback: `NOT TESTED`；Preview 需要 Vercel 登录。
- Status: `released`
- Outcome: 两名受邀用户可以使用同一 deployment，且不能读取或修改对方的财务数据。
- Access model: `one auth user = one owner`；不新增 Tenant、Organization、Profile、Membership 或 RBAC。
- In scope: owner migration、RLS、owner-scoped unique、cross-owner FK、两用户负向测试、Consumer AI 关闭。
- Out of scope: public signup、Household、共享、角色、Billing、Onboarding 和 English shell。
- Local migration preflight: 5 个场景通过；错误 owner mapping 在 schema 变更前停止。
- Local RLS and constraint suite: 82 assertions passed。
- Local application suite: lint 0 error、typecheck pass、build pass、Playwright 4/4。
- Codex 侧边栏浏览器：desktop/mobile 登录页正常；无 signup；无水平溢出；`/api/chat` 返回 `404 feature_disabled`。
- Browser data boundary: RSC DTO 不包含 `owner_id`；Consumer BYOK 没有 Data API grant。
- Hosted Supabase preflight: 1 Auth user、81 business rows、0 owner columns、11 broad policies。
- Hosted migration: 004 applied；81 business rows preserved；0 null owner；44 owner policies；0 broad policies。
- Hosted grants and FKs: business anon CRUD 0；BYOK CRUD 0；released authenticated CRUD 40；owner RESTRICT FKs 9。
- Hosted Auth: Email provider enabled；public signup disabled；anonymous sign-in disabled；reload readback passed。
- Vercel production: merge deployment passed；`/` → `/login`；`/api/chat` returns `404 feature_disabled`。
- Remaining live gate: second invited user creation and A/B browser isolation readback。
- Production state changed: Yes；Supabase project resumed、004 applied、public signup disabled、PR #4 merged and deployed。

## Iteration 4 Readback

- Local branch: `codex/iteration-4-setup-checkpoint`
- Commit: `47ff7b7`
- Pull request: [Draft PR #5](https://github.com/Perfecto23/savings-coach/pull/5)
- Base branch: `main` after PR #4
- Status: `ready_for_release`
- Outcome: 受邀用户保存地区设置、一个储蓄账户和当前余额；返回后恢复同一个储蓄起点。
- In scope: locale、timezone、基础货币、储蓄账户、首个余额快照、Setup completion 和 redirect。
- Out of scope: public signup、Plan、月度里程碑、Income、AI、Reminder、Billing、Household、FX 和完整 i18n。
- Release boundary: Iteration 3 已完成 hosted migration；第二名受邀用户的 A/B live readback 必须先通过。
- Database: migration 005；owner-scoped `owner_setup`；58 Setup assertions；existing isolation suite 82 assertions。
- Concurrency: preferences、Account create、same-balance retry 和 conflicting-balance race passed。
- Authenticated Playwright: desktop and Pixel 5 passed；真实 local Auth、three-checkpoint recovery、logout/login、RSC canary and currency readback。
- Public Playwright: 4/4 passed；login 和 disabled AI boundary unchanged。
- Application validation: lint 0 error、typecheck pass、build pass。
- Design review: Impeccable verdict `ship` after CTA contrast、mobile hierarchy、field errors、loading、rail summary and copy fixes。
- Manual browser: desktop/mobile Setup、completion、dashboard currency and complete redirect passed；no browser error or warning。
- Production state changed: No。
