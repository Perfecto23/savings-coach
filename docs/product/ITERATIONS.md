# Savings Coach Iteration Ledger

本文件记录当前交付状态。产品方向和范围以 `PRODUCT-CHARTER.md` 为准。

## Status Language

- `planned`：尚未开始。
- `in_progress`：正在实现或验证。
- `ready_for_release`：本地验收完成，尚未 push 或部署。
- `released`：代码已经发布，但不自动代表 live 行为正确。
- `verified_preview`：Preview 已完成独立 readback，但 production 尚未生效。
- `verified_live`：目标环境已经完成独立 readback。
- `blocked`：满足项目 blocker 定义，且没有安全的继续路径。

## Roadmap Status

| Iteration | Outcome | Status | Release evidence |
|---:|---|---|---|
| 1 | Quality foundation | `verified_preview` | [PR #1](https://github.com/Perfecto23/savings-coach/pull/1)；Vercel Preview readback |
| 2 | EdgeOne hosting decision | `planned` | — |
| 3 | Safe English beta access | `planned` | — |
| 4 | Setup checkpoint | `planned` | — |
| 5 | Income-independent Plan activation | `planned` | — |
| 6 | Monthly execution Home | `planned` | — |
| 7 | Trustworthy Progress | `planned` | — |
| 8 | Monthly close and rollover | `planned` | — |
| 9 | One-channel reminder experiment | `planned` | — |
| 10 | Paid-intent beta and release candidate | `planned` | — |

## Iteration 1 Readback

- Date: 2026-08-30
- Outcome: 建立可重复的产品治理和公开登录页自动化回归。
- Status: `verified_preview`
- Local branch: `codex/iteration-1-quality-foundation`
- Implementation commit: `70ced96`
- Remote branch: `origin/codex/iteration-1-quality-foundation`
- Pull request: [#1](https://github.com/Perfecto23/savings-coach/pull/1)
- Preview: `https://savings-coach-git-codex-iteration-1-39733f-perfecto23-projects.vercel.app`

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

### Not Claimed

- 尚未 merge 到 `main` 或部署 production。
- 尚未验证 EdgeOne、真实 Supabase 登录成功或 session refresh。
- 尚未运行 Firefox、WebKit 或真实移动设备。
- 尚未修改 production schema 或 production data。

## Release Gate

每次迭代发布前必须：

1. Review 当前 diff 和未跟踪文件。
2. 运行 `lint`、`typecheck`、`build` 和相关 E2E。
3. UI 改动使用 Codex 侧边栏浏览器验收。
4. Push 或部署前获得 Perfecto 的单次明确确认。
5. 发布后独立 readback，并按目标环境更新为 `verified_preview` 或 `verified_live`。

## Iteration 2 Entry Conditions

- 获得当前 EdgeOne 项目和 preview 入口。
- 准备隔离的 staging Supabase 数据。
- 明确 preview deployment 的单次授权。
- POC 不得读取或修改 production data。
