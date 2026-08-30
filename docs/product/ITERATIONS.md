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
| 3 | Safe invited-user access | `verified_live` | [PR #4](https://github.com/Perfecto23/savings-coach/pull/4)；hosted A/B RLS and browser readback |
| 4 | Setup checkpoint | `verified_live` | [PR #6](https://github.com/Perfecto23/savings-coach/pull/6)；hosted 005 and production recovery journey |
| 5 | Income-independent Plan activation | `released` | [PR #8](https://github.com/Perfecto23/savings-coach/pull/8)；hosted 006、Vercel production and live activation readback |
| 6 | Monthly execution Home | `verified_live` | [PR #10](https://github.com/Perfecto23/savings-coach/pull/10)；hosted 007 and authenticated production journey |
| 7 | Trustworthy Progress | `verified_live` | [PR #12](https://github.com/Perfecto23/savings-coach/pull/12)；hosted 008 and authenticated production journey |
| 8 | Monthly close and rollover | `released` | [PR #14](https://github.com/Perfecto23/savings-coach/pull/14)；hosted 009 and Vercel production |
| 9 | One-channel reminder experiment | `released` | [PR #18](https://github.com/Perfecto23/savings-coach/pull/18)、[PR #19](https://github.com/Perfecto23/savings-coach/pull/19)；hosted 011、Vercel production and dark Edge Function readback |
| 10 | Paid-intent beta and release candidate | `released` | [PR #16](https://github.com/Perfecto23/savings-coach/pull/16)；hosted 010 and Vercel production |

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
- Status: `verified_live`
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
- Hosted A/B RLS transaction: second owner sees 0 existing rows；owner spoof rejected；cross-owner update affects 0 rows；own CRUD succeeds inside rollback。
- Hosted second-owner browser: login passed；existing Account visibility 0；dashboard empty state rendered；browser error/warning 0。
- Production state changed: Yes；Supabase project resumed、004 applied、public signup disabled、PR #4 merged and deployed。

## Iteration 4 Readback

- Local branch: `codex/iteration-4-setup-checkpoint-clean`
- Commit: `dcf66fa`
- Pull request: [PR #6](https://github.com/Perfecto23/savings-coach/pull/6)
- Merge commit: `faef63e`
- Base branch: `main` after PR #4
- Status: `verified_live`
- Outcome: 受邀用户保存地区设置、一个储蓄账户和当前余额；返回后恢复同一个储蓄起点。
- In scope: locale、timezone、基础货币、储蓄账户、首个余额快照、Setup completion 和 redirect。
- Out of scope: public signup、Plan、月度里程碑、Income、AI、Reminder、Billing、Household、FX 和完整 i18n。
- Release boundary: Iteration 3 已完成 hosted A/B live readback。
- Database: migration 005；owner-scoped `owner_setup`；58 Setup assertions；existing isolation suite 82 assertions。
- Concurrency: preferences、Account create、same-balance retry 和 conflicting-balance race passed。
- Authenticated Playwright: desktop and Pixel 5 passed；真实 local Auth、three-checkpoint recovery、logout/login、RSC canary and currency readback。
- Public Playwright: 4/4 passed；login 和 disabled AI boundary unchanged。
- Application validation: lint 0 error、typecheck pass、build pass。
- Design review: Impeccable verdict `ship` after CTA contrast、mobile hierarchy、field errors、loading、rail summary and copy fixes。
- Manual browser: desktop/mobile Setup、completion、dashboard currency and complete redirect passed；no browser error or warning。
- Hosted preflight: 2 Auth users、5 Accounts、30 Balance Snapshots、institution `NOT NULL`、0 Setup table/RPC。
- Hosted migration: 005 applied；Account and Snapshot counts preserved；institution nullable；`owner_setup` RLS and 3 policies enabled。
- Hosted RPC: 2 parameters、JSONB return、Security Invoker；authenticated execute enabled；anon execute disabled。
- Production journey: incomplete owner redirected to Setup；three checkpoints、completion、reload、logout/login、dashboard currency and complete redirect passed。
- Temporary hosted test user: separate deletion approval received；test owner、1 Setup、1 Account、1 Balance Snapshot 均已删除。独立回读为 1 Auth user、81 business rows、5 Accounts、30 Balance Snapshots、0 Setup。
- Production state changed: Yes；005 applied、PR #6 merged and Vercel production verified。

## Iteration 5 Current State

- Local branch: `codex/iteration-5-plan-activation`
- Commits: `91c694e`、`9e84af0`
- Pull request: [PR #8](https://github.com/Perfecto23/savings-coach/pull/8)
- Merge commit: `3d1eb1e`
- Status: `released`
- Outcome: Setup 已完成的受邀用户无需薪资配置，也能建立可执行的储蓄计划、生成当前月度行动并查看 12 个月计划路径。
- In scope: 每名 owner 一个隐式储蓄计划、一条或多条月度计划规则、正数计划规则金额、可选来源账户、Setup 选定的目标账户、当前月度行动、12 个月计划路径、幂等计划激活和现有 SOP 兼容。
- Out of scope: 多储蓄计划、多目标账户、银行同步、真实资金转移、收入能力校验、零或负数规则、非月度频率、Household、AI、Reminder、计划关闭和月度复盘。

### Frozen Seam

- 不新增独立 Savings Plan 实体。现有兼容 SOP 模板承载计划规则，规则生成的月度 SOP 步骤承载月度行动，月度里程碑承载计划路径节点。
- 现有 SOP 模板只有在 active、金额大于零且目标账户为 Setup 选定的储蓄账户时，才属于当前储蓄计划。其他 SOP 数据保持原语义。
- 计划激活要求 Setup 完成、至少一条有效计划规则、当前月度行动和当前月起连续 12 个月计划路径同时成立。薪资配置和奖金事件不是激活前提。
- 来源账户可为空。目标账户必须是 Setup 选定的储蓄账户。计划规则金额必须大于零。
- 月度频率支持每月 1–31 日。短月没有指定日期时，月度行动落在该月最后一天。
- 当前月即使已经超过执行日，也必须生成月度行动并显示为到期或逾期。
- 计划规则修改和停用只影响未实例化月份。当前和历史月度行动保留快照；产生过月度行动的计划规则不做硬删除。
- 部分 legacy 月份按计划规则 identity 补齐缺失月度行动，不重复或改写已有月度行动。
- `plan_activated` 是一次性幂等状态转换。重复或并发请求不得重复生成激活记录、月度行动或计划路径节点。

### Delivered

- 新增 `/plan`，支持创建、编辑、停用和重新启用计划规则。
- 计划激活生成当前月度行动和 12 个月计划路径，不依赖薪资配置。
- 月度行动保存规则金额、日期、来源账户和目标账户快照。
- 月度行动更新与计划路径重算在同一数据库事务完成。
- legacy SOP 初始化和 Settings 不读取或修改计划规则。
- 不新增 Savings Plan、event、schedule 或 version 表。

### Verified

- Full pgTAP：215/215；Plan suite：74/74。
- Concurrency：相同 activation、activation + edit、跨 owner 相同 UUID 均通过。
- Migration preflight：5 个 owner mapping 场景通过。
- Setup concurrency：4 个并发场景和最终不变量通过。
- Public Playwright：4/4；Setup Playwright：2/2；Plan Playwright：2/2。
- `lint`：0 error，保留 3 条迭代前 warning。
- `tsc --noEmit`、production build 和 `git diff --check` 通过。
- Security review：无 Critical / High；timestamp spoof、non-finite amount、Target Account lifecycle 和同 UUID 假成功已修复并覆盖测试。
- Bounded code re-review：`ship`。
- Codex 侧边栏浏览器：Plan activation、12 个月路径、edit future-only、deactivate history 和 reload 通过；新日志 0 error / 0 warning。

### Not Claimed

- authenticated production Plan activation 已完成。
- production 的 Plan Rule edit、deactivate 和 reactivate 尚未执行。

### Release Readback

- GitGuardian：pass；Vercel Preview：pass；Vercel production：pass。
- Hosted preflight：1 Auth user、81 business rows、5 Accounts、30 Balance Snapshots、0 Setup、0 Plan columns、0 Plan RPC。
- Hosted backfill candidates：0 计划规则、4 月度行动、0 non-finite amount、0 duplicate group。
- Hosted migration：006 在单事务内成功；81 business rows 保持不变。
- Hosted catalog：10 个 Plan 字段、4 个 authenticated-only definer RPC；private projector 未对 authenticated 开放。
- Hosted activation evidence：direct INSERT / UPDATE 均关闭；Setup column INSERT allowlist 保持有效。
- Hosted state：0 计划规则、4 月度行动、0 计划路径、0 activation timestamp、0 duplicate group。
- Vercel production：merge commit `3d1eb1e` 部署完成；`/plan` → `/login`；新日志 0 error / 0 warning。
- Authenticated production：disposable owner 完成 Setup、S$500 Plan Rule、Plan Activation、1 条 Monthly Action 和 12 个 Plan Path 节点；reload 后状态保持。
- Remaining live gate：production Plan Rule edit、deactivate 和 reactivate。不得使用现有用户数据执行该 gate。
- Production state changed: Yes；006 applied、PR #8 merged and Vercel production deployed。

## Iteration 6 Current State

- Local branch: `codex/iteration-6-monthly-execution-home`
- Commit: `839a2d1`
- Pull request: [PR #10](https://github.com/Perfecto23/savings-coach/pull/10)
- Merge commit: `1bb2ef6`
- Status: `verified_live`
- Outcome: 已激活储蓄计划的用户在 Home 看到下一行动，手工完成后确认步骤完成，并形成行为激活。
- In scope: Home 的下一行动、月度行动完成确认、当前月度行动进度、逾期显示、行为激活、Plan Path 摘要和 desktop/mobile 验收。
- Out of scope: 银行同步、真实资金转移、余额快照录入、净值变化、计划规则编辑、月度复盘、Reminder、AI、Billing、Household 和多币种资产组合。

### Frozen Seam

- Home 只优先呈现当前自然月中计入里程碑的未完成月度行动。没有已激活储蓄计划时，Home 引导用户建立储蓄计划。
- 下一行动按用户 timezone 的当前自然月和计划执行顺序确定。逾期月度行动仍然可确认完成。
- 用户确认步骤完成后，产品更新月度行动和执行进度。产品不创建余额快照，不更新净值变化，也不表示银行已经确认资金转移。
- 行为激活是 owner 首次确认计入里程碑月度行动完成的一次性事实。撤销后续步骤完成确认不会撤销行为激活。
- Home 不编辑计划规则、计划规则金额、来源账户、目标账户或余额快照。计划规则管理继续在 `/plan`，余额观察继续在 `/balances`。
- 行为激活不新增独立 event 实体。实现必须保持 owner-scoped、幂等和并发安全。

### Delivered

- Home 以用户 timezone 选择当前月最早未完成的下一行动。
- Home 支持完成确认、安静撤销、月度行动进度和 Plan Path 摘要。
- 首次合格完成在同一事务内写入一次行为激活。
- Migration 007 关闭月度行动的 direct INSERT / UPDATE / DELETE；legacy SOP CRUD 保持可用。
- 月度行动、Plan Path 和行为激活在同一 owner-locked RPC 内更新。
- Home 不展示旧 dashboard 的收入、成就、冲动拦截或账户总额卡片。
- 不新增 event、task、home 或 schedule 表。

### Verified

- Full pgTAP：247/247；Monthly execution suite：32/32。
- Monthly execution concurrency：两行动并发完成、complete / reopen 串行化、一次性行为激活、Plan Path / 净值独立和 cross-owner negative 均通过。
- Public Playwright：4/4；Setup Playwright：2/2；Plan + Home Playwright：2/2。
- `lint`：0 error，保留 2 条迭代前 warning。
- `tsc --noEmit`、production build 和 `git diff --check` 通过。
- Impeccable detector：0 finding。
- Security review：`ship`，无 confirmed finding。
- Bounded code review：`ship`。
- Codex 侧边栏浏览器：Next Action、Behavior Activation Aha、reload、undo 和 Plan Path summary 通过；新日志 0 error / 0 warning。

### Not Claimed

- 不表示银行已经执行或确认转账。
- production 验收数据未保留为长期样本。

### Release Readback

- GitGuardian：pass；Vercel Preview：pass；Vercel production：pass。
- Hosted preflight：1 Auth user、81 business rows、0 Setup、0 Plan Activation、4 条已完成的兼容月度行动、0 Behavior Activation column。
- Hosted migration：007 在单事务内成功；81 business rows 和 4 条历史月度行动保持不变；0 Behavior Activation backfill。
- Hosted ACL：3 个 Monthly Action direct-write policies 已关闭；owner SELECT 保持；legacy SOP CRUD 条件保持。
- Hosted RPC：`update_monthly_action` 为 authenticated-only definer；PUBLIC / anon 无执行权限。
- Hosted evidence：Behavior Activation direct INSERT / UPDATE 均关闭；Plan-before-Behavior CHECK 生效；无 event / home 表。
- Vercel production：merge commit `1bb2ef6` 部署完成；`/` → `/login`；新日志 0 error / 0 warning。
- Authenticated production：Plan Activation 后，Home 显示下一 Monthly Action；首次完成写入 Behavior Activation；reload 保持完成状态；undo 恢复下一行动且不撤销 Behavior Activation。
- 验收时独立回读为 1 Setup、1 Plan Activation、1 Behavior Activation、1 Account、1 Snapshot、1 Plan Rule、1 Monthly Action 和 12 个 Plan Path 节点。
- disposable owner 和关联数据已在单事务内精确清理。清理后恢复 1 Auth user、81 行业务数据、5 Accounts、30 Balance Snapshots、0 Setup、0 Plan Activation 和 0 Behavior Activation。
- Production state changed: Yes；007 applied、PR #10 merged and Vercel production deployed。

## Iteration 7 Current State

- Local branch: `codex/iteration-7-trustworthy-progress`
- Commit: `7f76aa5`
- Pull request: [PR #12](https://github.com/Perfecto23/savings-coach/pull/12)
- Merge commit: `029288f`
- Status: `verified_live`
- Outcome: 用户在手工储蓄执行路径中区分计划转入、余额快照、净值变化和拦截金额，并以基础货币查看金额。
- In scope: 余额观察、月度里程碑、月度报告、月度行动、冲动拦截和关联删除确认的金额口径、术语、基础货币格式化和历史保留规则。
- Out of scope: 银行同步、真实资金转移、交易导入、全球税务计算、Income 模型重写、AI、月度复盘、Reminder、Billing、Household、FX 和多币种账户实体。

### Frozen Seam

- 计划转入、目标余额、净值变化、余额快照和拦截金额保持独立。产品不把任何一种金额表示为其他种金额。
- 活跃手工储蓄执行路径中的金额使用 owner 的 locale 和基础货币。中国薪资税务能力不在本迭代中转换为全球税务能力。
- 月度行动金额是当月计划金额。用户调整月度行动金额时，产品不把该操作描述为实际转入或到账。
- 月度报告只把实际存在的余额快照描述为余额观察。产品不把当月第一条或最后一条余额快照默认描述为月初或月末余额。
- 产品不将净值变化与计划转入的差额表示为储蓄表现或执行状态。里程碑执行状态继续只取决于计入里程碑的步骤完成。
- 拦截金额是放弃购买的预估价格。产品不把拦截金额表示为已省下或已确认储蓄。
- 删除账户前必须说明真实影响。产品保留历史月度 SOP 步骤和月度行动快照；产品不允许删除活跃 Plan Path 节点，且不会静默破坏 Setup 或储蓄计划。
- 本迭代不新增银行交易、余额、计划或 event 实体。

### Delivered

- Balance Snapshot 保存和按日期删除通过 owner-locked RPC 与 Progress 重算保持原子。
- Progress 使用 Savings Account 的月末最近观察和账户 carry-forward；首个观察月净值变化为空，后续使用相邻观察月差值。
- 计划转入、目标余额、净值变化和 Balance Snapshot total 在 UI 中分列，不显示“净值偏差”。
- Balance、Progress、报告、SOP、Impulse 和 Settings 金额使用 owner locale 与基础货币。
- 报告使用 Earliest / Latest Balance Snapshot，不再假设月初或月末。
- Impulse amount 明确是预估价格，不是 confirmed savings。
- Setup-linked Account、最后一条 Setup Snapshot 和 marked Plan Path 删除均受保护。
- Setup initial balance 只允许首次写入和精确幂等重试；后续观察必须走 Balance Snapshot seam。
- SOP 初始读取和 mutation 返回 safe display DTO，不传 owner、template、step key 或 account IDs。
- 不新增数据实体。

### Verified

- Full pgTAP：313/313；Trustworthy Progress suite：66/66。
- Trustworthy Progress concurrency：full-payload save race、same-date delete / save race、cross-owner negative 均通过。
- Setup concurrency：精确重试通过，第二日期和不同金额重试均被锁定。
- Public Playwright：4/4；Setup Playwright：2/2；Plan + Home + Progress Playwright：2/2。
- `lint`：0 error，保留 1 条迭代前 warning。
- `tsc --noEmit`、production build 和 `git diff --check` 通过。
- Impeccable detector：2 个 token drift 已修复。
- Security review：`ship`，无 confirmed finding。
- Bounded code review：`ship`。
- Codex 侧边栏浏览器：Balance save → Progress readback、Monthly report、Impulse semantics 通过；新日志 0 error / 0 warning。

### Not Claimed

- 不验证银行余额、银行交易或真实资金转移。
- 不提供 public signup 或用户自助删除账号。
- production 验收数据未保留为长期样本。

### Release Readback

- GitGuardian：pass；Vercel Preview：pass；Vercel production：pass。
- Hosted preflight：1 Auth user、81 行业务数据、5 Accounts、30 Balance Snapshots、0 非法余额、0 Setup、0 Plan Activation 和 0 Behavior Activation。
- Hosted migration：008 在单事务内成功；81 行业务数据和 30 Balance Snapshots 保持不变。
- Hosted integrity：Balance Snapshot→Account 为 `RESTRICT`；金额 CHECK、Setup-linked Account、最后 Setup Snapshot 和 Plan Path 删除保护均生效。
- Hosted ACL：3 个 Balance Snapshot 直写策略关闭；4 个新函数存在；6 个 definer 函数固定空 `search_path`；private Setup helper 对 PUBLIC、anon 和 authenticated 的授权为 0。
- Hosted RPC：authenticated 获得 3 个安全 RPC；anon 获得 0。
- Authenticated production：Balance Snapshot 从 S$1,000 更新为 S$1,100；Progress 分列显示 S$500 planned transfer、S$1,500 target balance、空 net value change 和 S$1,100 Snapshot total。
- Monthly report 使用 Earliest / Latest Balance Snapshot；SOP 显示 Monthly Action amount；Impulse amount 明确不是 confirmed savings。
- Supabase Dashboard 直接删除 owner 因 Iteration 3 的 owner 外键 `RESTRICT` 失败，且未产生部分删除。产品当前没有用户自助删除账号功能。
- disposable owner 和关联数据随后在单事务内精确清理。清理后恢复 1 Auth user、81 行业务数据、5 Accounts、30 Balance Snapshots、0 Setup、0 Plan Activation 和 0 Behavior Activation。
- Vercel production：merge commit `029288f` 部署完成；公开 `/` → `/login`；authenticated journey 通过。
- Production state changed: Yes；008 applied、PR #12 merged and Vercel production verified。

## Iteration 8 Current State

- Local branch: `codex/iteration-8-monthly-close`
- Commit: `89abeac`
- Pull request: [PR #14](https://github.com/Perfecto23/savings-coach/pull/14)
- Merge commit: `b03ad4f`
- Status: `released`
- Outcome: 用户在新自然月查看上一月报告，显式完成月度复盘，并获得当前月的月度行动和计划路径。
- In scope: 上一 owner-local 自然月、月度报告入口、复盘完成、已关闭月份执行冻结、当前月月度行动实例化、计划路径重建、Home 引导和 desktop/mobile 验收。
- Out of scope: 财务结账、强制余额快照、银行确认、历史月份补造、reopen、Reminder、AI、Billing、Plan Rule version 和新事件实体。

### Frozen Seam

- 月度复盘是执行复盘，不是财务结账。复盘完成只证明用户查看并关闭了上一月执行记录。
- 只有 owner timezone 的上一自然月可以复盘完成。当前月、未来月和更早月份均不可通过本 seam 关闭。
- 上一月必须存在至少一条月度行动，且所有月度行动已经完成。Balance Snapshot 不是复盘完成前提。
- 复盘完成写入月度里程碑的单个 `review_completed_at` 字段。`monthly_review_completed` 由该字段查询，不新增 event 或 review 表。
- 已关闭月份的月度 SOP 执行记录、计划转入、目标余额、执行状态、计划路径标记和复盘时间保持不变。
- 已关闭月份仍允许后补或纠正 Balance Snapshot。净值变化和 Balance Snapshot total 可以更新，但不改变执行状态或复盘时间。
- 月度结转使用当前 active Plan Rules 生成当前月月度行动，并重建 current + 11 个月计划路径。操作必须 owner-scoped、幂等和并发安全。
- 缺失多月时不使用当前 Plan Rule 伪造历史月度行动或复盘完成。用户可以重新 Plan Activation，从当前月继续。
- 本迭代不新增持久化实体。

### Delivered

- 月度里程碑新增 `review_completed_at`。`monthly_review_completed` 可以直接查询，不新增 event 或 review 表。
- 新增 authenticated-only `close_monthly_review` RPC。RPC 校验 owner timezone、上一自然月、月度行动完成状态和当前月 Plan readiness。
- Close、Review Completion、当前月行动实例化和 Plan Path 重建在同一 owner-locked 事务完成。
- Home 在新月份先显示 Monthly Review gate。用户从现有月度报告完成复盘。
- 已关闭月份的月度 SOP 执行写入和 Plan Path 字段受数据库保护；Balance Snapshot 后补仍可更新 `actual_*`。
- 已关闭月份 UI 隐藏 toggle、edit、delete 和新增临时步骤控件。Progress 显示 `Reviewed`。
- Account 和 legacy template 删除仍可把历史记录的内部 FK 置空，同时保留金额、名称和完成快照。
- 无 active Plan Rule 且当前月无行动时，Close 原子回滚，并引导用户打开 Savings Plan。
- 不新增持久化实体。

### Verified

- Focused Monthly Close pgTAP：42/42；Full pgTAP：355/355。
- Monthly Close concurrency：Close / Close、Close / legacy SOP insert/update/delete 和 owner isolation 通过。
- Monthly Execution concurrency 与 Trustworthy Progress concurrency 回归通过。
- Public Playwright：4/4；Setup Playwright：2/2；Plan + Home + Progress Playwright：2/2；Monthly Review Playwright：2/2。
- Monthly Review Playwright 覆盖 Desktop Chrome 与 Pixel 5、Home gate、报告、Close、当前月行动、reload、closed SOP、Progress 和 RSC canary。
- `lint`：0 error，保留 1 条迭代前 warning。
- `tsc --noEmit`、production build、shell syntax 和 `git diff --check` 通过。
- Product review：`ship`；bounded code review：`ship`；security review：`ship`，无 confirmed finding。
- Codex 侧边栏浏览器：Home、Monthly report、Close success、当前月行动和 closed SOP 通过。
- 浏览器验收发现并修复 `ProgressRing` hydration error。修复后 Next.js issue overlay 为 0，local server log 无 error / warning。

### Not Claimed

- 尚未完成 authenticated production Monthly Review → Close → rollover journey。
- Production 仍有 0 Review Completion；未创建历史复盘数据。
- external analytics exactly-once 未实现。留存 baseline 只使用数据库 `review_completed_at`。
- 缺失多月不做历史 catch-up。Iteration 8 不提供 reopen。

### Release Readback

- GitGuardian：pass；Vercel Preview：pass；Vercel production：pass。
- Hosted preflight：1 Auth user、81 行业务数据、5 Accounts、30 Balance Snapshots、0 Setup、0 Plan Activation、0 Plan Rules、4 条兼容 Monthly Actions、0 Plan Path 和 0 duplicate Monthly Action group。
- Hosted migration：009 在单事务内成功；81 行业务数据、5 Accounts 和 30 Balance Snapshots 保持不变；无历史 backfill。
- Hosted catalog：`review_completed_at` 字段 1 个；review triggers 2 个；hardened Close RPC 1 个。
- Hosted ACL：authenticated 可执行 Close RPC；PUBLIC / anon 不可执行。
- Hosted state：0 Review Completion、0 Plan Path、0 Plan Rule 和 0 Plan Activation。
- Vercel production：merge commit `b03ad4f` 部署完成；公开 `/` → `/login`；标题与登录表单正常。
- Status boundary：代码和 schema 已发布。authenticated production Monthly Review journey 尚未执行，因此状态为 `released`，不是 `verified_live`。
- Production state changed: Yes；009 applied、PR #14 merged and Vercel production deployed。

## Iteration 9 Decision

- Local branch: `codex/iteration-9-email-reminder`
- Status: `released`
- Intended outcome: opt-in owner 在新月份收到一次 Monthly Review reminder，并可随时 unsubscribe。
- Required contract: one outbound channel、owner timezone、explicit consent、background scheduler、idempotent delivery 和 unsubscribe。

### Decision

- in-app Home prompt 不满足 Iteration 9。用户不访问 Home 时不会发生调度或交付。
- Iteration 8 已经在 Home 显示 Monthly Review gate。新增同页 prompt 没有独立产品价值。
- Home GET / RSC 不得通过隐式 claim 产生 render-write。重复显示也不能表示“只发送一次”。
- 当前项目没有可用的 outbound email provider credential、verified sender 或 vendor spend authorization。
- 代码和本地测试可以继续。Production sending 在 provider credential、verified sender 和费用授权存在前保持关闭。

### Frozen Seam

- Email 是唯一 reminder channel。Iteration 9 不实现 Push、SMS、WhatsApp 或 browser notification。
- owner-local 每月 2 日 09:00 后，若上一月 Plan Path 存在、Review Completion 为空且月度行动存在，则该月 reminder eligible。
- Supabase Cron 每 5 分钟调用 sender Edge Function。Edge Function 原子 claim delivery。发送前二次授权会把 delivery 转为 `sending`。随后 Edge Function 调用 Resend，再写入 Provider Acceptance。
- Reminder Consent 默认关闭。启用和退订只能由显式 POST 完成。Paid Intent、登录、计划激活或复盘完成都不能推断 Reminder Consent。
- `review_reminder_deliveries` 是必要 delivery ledger。唯一键为 owner、review month 和固定 reminder kind；不保存 email、正文、金额、账户名、余额或密钥。
- 同一 delivery 的 Resend idempotency key 在重试中保持不变。Provider 24 小时去重窗口结束后，模糊结果进入 `unknown`，不自动重发。
- Resend API success 只写 Provider Acceptance。只有签名 webhook 可以写 `delivered`、`bounced`、`complained` 或 `suppressed`。
- 早于 Provider Acceptance 到达的签名 webhook 返回非 2xx。Resend 重试后才能写入 receipt。
- 退订和 Review Completion 会取消尚未 Send Commit 的 delivery。Send Commit 后外部请求可能已经开始，当前 Email 不能保证停止。Provider Acceptance 仍需独立 receipt。
- Email 只包含 Monthly Review month、固定 CTA 和退订链接。禁止包含财务金额、账户名、余额、月度行动名称或 Paid Intent。
- Open tracking 和 click tracking 保持关闭。
- Delivery ledger 保留 90 天。Service-only purge 不删除 active lease。
- Reminder Delivery 是本迭代唯一新增持久化实体。不得扩展为通用 notification、event 或 campaign 平台。

### Delivered

- Reminder Consent 默认关闭。Settings 提供显式启用、reload 恢复和 unsubscribe。
- Vercel availability gate 默认关闭。数据库 RPC ACL 默认撤销 authenticated 执行权，并作为权威 availability gate。关闭时，Settings 不显示 Email tab，直连 RPC 也不能写入 Reminder Consent。
- `review_reminder_deliveries` 保存 owner、review month、Provider Acceptance 和签名 webhook receipt。表不保存 Email、正文或财务内容。
- Sender 使用 Supabase named secret、全局 kill switch、23 小时 retry cutoff 和稳定 Resend idempotency key。
- Send Commit 是不可取消边界。模糊 Provider 结果保持同一个 idempotency key，并在 23 小时内恢复。
- Webhook 使用 raw body Svix verification。未知 provider message 返回非 2xx。状态使用单调 precedence。
- Unsubscribe GET 不写入。POST 幂等。公开 request body 分别限制为 64 KiB 和 8 KiB。
- Service-only retention purge 支持 dry-run、actual readback 和 90 天清理。
- Activation runbook 要求 Cron 在 Single-Owner Activation 后创建。

### Verified

- Database：454/454。测试在完整 E2E fixture 存在时仍通过。
- Reminder concurrency：duplicate claim、authorize vs unsubscribe、claim vs Review Completion 全部通过。
- Edge Function：30/30。三个 Function entrypoint 使用 frozen `deno.lock` 并通过 `deno check`。
- Public、Setup、Plan、Monthly Review 和 Reminder Playwright：12/12。
- `lint`、`tsc --noEmit`、production build 和 `git diff --check` 通过。
- Next.js 16.3.3、Supabase JS 2.112.4 和 eslint-config-next 16.3.3 完成安全升级。Production dependency audit 为 0 个已知漏洞。
- Codex 侧边栏浏览器 preflight：Supabase production 初始为 0 自定义 Edge Function、0 自定义 Function Secret。
- Product review：`ship`。邮件只包含 Review month、固定 CTA、同意来源和 unsubscribe。
- Final code review：`ship`。Final security review：`ship`。Production activation 仍需 live gates。

### Required Production Activation Inputs

- 一个 outbound email provider 的 production credential。
- 一个 verified sender domain 或 sender address。
- 对该 provider 费用和 production delivery 的明确授权。

### Not Claimed

- 没有 Provider Acceptance、signed delivery receipt 或 unsubscribe production evidence。
- 没有创建 Sender Cron、retention Cron、Vault 或 Provider credential Secret。仅 `APP_BASE_URL` 和 `REVIEW_EMAIL_SENDING_ENABLED=false` 已配置。Vercel 和数据库 availability gate 均保持关闭。
- 没有实现 push、SMS、WhatsApp 或 browser notification。
- Production state changed: Yes。只发布 dark schema、Functions 和隐藏 UI code。

### Release Readback

- PR #18 merge commit：`cd3b702`。Vercel production deployment：pass。
- PR #19 修复 Supabase Runtime entrypoint。TDD contract、code review 和 security review：`ship`。
- Hosted preflight：1 Auth user、81 行业务数据、0 Setup、0 Reminder table、0 Reminder column、0 Reminder function。
- Hosted migration：011 在单事务内成功。81 行业务数据保持不变；无 Reminder Consent backfill。
- Hosted catalog：1 Reminder Delivery table、3 Reminder Consent columns、9 Reminder functions。
- Hosted ACL：authenticated availability gate grants 0；service internal grants 7；direct delivery table grants 0。
- Hosted state：0 Setup、0 Reminder Consent、0 Reminder Delivery。
- Supabase Edge Functions：3/3。三个 legacy JWT gate 均为关闭。
- Supabase custom Secret key names：`APP_BASE_URL`、`REVIEW_EMAIL_SENDING_ENABLED`。Provider credential Secret 为 0。
- Scheduler extensions：0。Sender Cron 和 retention Cron 均不存在。
- Dark smoke：Sender GET 405；Sender POST 无 named secret 401；Webhook 无 signing secret 503；Unsubscribe GET 200；Unsubscribe POST 200 空响应。
- Vercel production：`/` → `/login`；标题和登录表单正常；browser error / warning 为 0。
- Status boundary：dark code、schema 和 Functions 已发布。Outbound Email 未 activation，因此状态为 `released`，不是 `verified_live`。

## Iteration 10 Current State

- Local branch: `codex/iteration-10-paid-intent`
- Commit: `5bff5eb`
- Pull request: [PR #16](https://github.com/Perfecto23/savings-coach/pull/16)
- Merge commit: `8d1214e`
- Status: `released`
- Outcome: 完成过月度复盘的 owner 可以在不付款、不提供银行卡和不创建订阅的前提下，表达对未来 Pro beta 的付费意愿。
- In scope: Review Completion eligibility、固定 Pro beta offer、明确价格、一次性 Paid Intent、owner isolation、idempotence、desktop/mobile 和 release candidate evidence。
- Out of scope: payment provider、checkout、银行卡、trial、subscription、entitlement、feature unlock、invoice、refund 和 billing portal。

### Frozen Seam

- Pro beta offer code 固定为 `pro_beta_usd_499_monthly_v1`。UI 将该 code 映射为 `US$4.99/month after launch`。
- Offer 只对至少存在一条 Review Completion 的 owner 显示。
- Offer 必须同屏说明：今天不收费、不收卡、不创建订阅、不启动 trial、不锁定未来价格。
- Paid Intent 只表示用户点击明确的兴趣 CTA。产品不把 Paid Intent 表示为付款、订阅、trial、entitlement 或 Pro access。
- Paid Intent 首次写入后保持原始 offer code 和 timestamp。重复或并发请求返回同一 receipt。
- RPC 不接收 owner、offer code、价格、Review month 或 timestamp。
- 数据只复用 `owner_setup` 的两个字段，不新增 payment、billing、subscription、entitlement 或 event 实体。
- US$4.99 是窄范围 manual-first 产品的价格假设。作为参照，[YNAB](https://www.ynab.com/pricing) 当前月付为 US$14.99，[Monarch Money](https://partners.monarchmoney.com/pricing) 年付折算为 US$8.33/month；本产品不宣称具备同等功能或价值。

### Delivered

- `owner_setup` 新增固定 offer code 和首次 Paid Intent timestamp。两个字段必须同时为空或同时有效。
- 新增 authenticated-only safe read RPC 和 zero-argument Paid Intent command RPC。
- RPC 使用 `auth.uid()`、owner advisory lock、Review Completion eligibility 和固定数据库 offer code。
- 首次 Paid Intent 保存 `pro_beta_usd_499_monthly_v1` 与数据库时间。重复或并发请求返回原 receipt。
- Offer 只显示在已完成 Monthly Review 的报告中。Client 只接收 `eligible` 和 `recorded` 两个布尔值。
- Offer 和成功态均明确 no charge、no card、no subscription、no trial、no price reservation 和 no Pro unlock。
- `Not now` 不写入负向事件。当前页面 dismiss 后，reload 会重新显示 offer。
- 不新增 billing、payment、checkout、subscription、entitlement 或 event 实体。

### Verified

- Focused Paid Intent pgTAP：25/25；Full pgTAP：380/380。
- Paid Intent concurrency：duplicate request、A/B isolation 和 Close / record 通过。
- Monthly Close concurrency 回归通过。
- Public Playwright：4/4；Setup Playwright：2/2；Plan + Home + Progress Playwright：2/2；Monthly Review + Paid Intent Playwright：2/2。
- Paid Intent E2E 覆盖 Desktop Chrome 与 Pixel 5、价格文案、消费保护、首次记录、reload、Desktop logout/login、RSC canary 和 0 payment provider request。
- 静态搜索确认没有 Stripe、checkout session、payment intent、subscription 或 entitlement dependency / implementation。
- `lint`：0 error，保留 1 条迭代前 warning。
- `tsc --noEmit`、production build、shell syntax 和 `git diff --check` 通过。
- Product review：`ship`；bounded code review：`ship`；security review：`ship`，无 confirmed finding。
- Codex 侧边栏浏览器：Pro beta offer、价格与消费保护、Paid Intent success 通过；local server log 无 error / warning。

### Not Claimed

- 尚未完成 authenticated production Paid Intent journey。
- 没有付款、订阅、trial、entitlement、Pro access 或收入证据。
- 没有 offer exposure event。指标只能称为 retained-owner paid-intent rate，不能称为 CTA conversion rate。
- 当前样本为 0，不能声称价格验证、购买转化或市场验证。

### Release Readback

- GitGuardian：pass；Vercel Preview：pass；Vercel production：pass。
- Hosted preflight：1 Auth user、0 Setup、0 Review Completion、0 Paid Intent fields、0 Paid Intent RPC 和 0 billing/payment/subscription/entitlement tables。
- Hosted migration：010 在单事务内成功；81 行业务数据保持不变；无 historical backfill。
- Hosted catalog：Paid Intent fields 2 个；paired fixed-offer CHECK 1 个；hardened zero-argument RPC 2 个。
- Hosted ACL：authenticated execute 2；PUBLIC / anon execute 0；authenticated direct Paid Intent column write grant 0。
- Hosted state：0 Review Completion、0 Paid Intent、0 billing/payment/subscription/entitlement tables。
- Vercel production：merge commit `8d1214e` 部署完成；公开 `/` → `/login`；标题与登录表单正常。
- Status boundary：代码和 schema 已发布。authenticated production Paid Intent journey 尚未执行，因此状态为 `released`，不是 `verified_live`。
- Program boundary：Iteration 9 和 Iteration 10 均已发布。Iteration 9 Production activation 仍需要 outbound provider credential、verified sender 和费用授权。
- Production state changed: Yes；010 applied、PR #16 merged and Vercel production deployed。
