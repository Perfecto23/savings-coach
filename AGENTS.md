# Savings Coach 项目指令

## 读取路由与权威源

开始仓库任务时先读取 [README.md](README.md)。README 是开发、验证和发布入口，不是 live 状态证明。

- 修改产品文案、领域行为、持久化类型、金额计算、报告或 Prompt 前，完整读取 [CONTEXT.md](CONTEXT.md)。该文件是领域术语、状态词和禁止描述的唯一真源。
- 修改产品目的、用户、能力边界、范围、优先级或投资判断前，读取 [PRODUCT.md](PRODUCT.md)。
- 修改页面、组件、样式、响应式、Setup 或无障碍行为前，读取 [DESIGN.md](DESIGN.md)。
- 修改发布、生产配置、migration、Function、rollback 或 live claim 前，读取 README 的发布边界，并从 GitHub、Vercel、Supabase 和 Resend 重新验证当前状态。
- 修改 `supabase/functions/**`、Reminder schema/RPC、Settings Email tab、Resend、Cron、Vault 或 Reminder gate 前，完整读取 [docs/runbooks/monthly-review-email-reminder.md](docs/runbooks/monthly-review-email-reminder.md)。
- 重新评估 EdgeOne 属于新的 hosting 决策。开始前必须重新定义验证范围，不沿用历史 POC 状态。

当前代码、`supabase/migrations/` 和 `lib/types/database.ts` 是实现真源。当前命令、依赖和工具设置以 `package.json`、lockfile 和仓库配置为准。完成读取后，先确定本轮权威源、领域术语和验证矩阵，再修改文件。

## 产品与访问边界

- Savings Coach 服务个人储蓄者。每名登录用户对应一个 `owner` 和一个数据空间。Household、角色、共享空间和跨 owner 协作不在当前范围。
- 所有业务读取和写入必须保持 owner scope。数据库 RLS 是数据边界；Server Action、Route Handler 和服务侧 Function 仍需独立校验身份、权限和输入。
- Public signup 和 anonymous sign-in 保持关闭。当前用户通过邀请或预创建方式获得访问。
- 每名 owner 只有一种基础货币。产品不提供 FX 或多币种资产组合。
- 产品记录计划、余额快照和用户完成确认。产品不连接银行、不导入交易、不执行资金转移，也不把用户确认描述为银行确认。
- Consumer AI Coach、BYOK 和 AI config 写入保持关闭。`/api/chat` 必须继续返回稳定的 `404 feature_disabled`，除非新的产品范围、隐私审查和 Provider 授权明确重新开放该能力。
- Paid Intent 只表示对未来 Pro beta 的兴趣。不得创建或暗示付款、银行卡、checkout、subscription、trial、entitlement、Pro access 或价格承诺。
- Monthly Review Email Reminder 默认关闭。Schema 或 Function 已发布不表示 UI、发送、Cron 或真实用户触达已经开放。
- 源码、fixture、文档和截图只使用合成账户、机构、金额和身份。禁止写入真实用户财务数据或凭据。

## 数据与密钥安全

- `.env.local`、Edge Function secrets、Vault values、Provider token、Supabase server credential 和 `ai_configs.api_key` 属于密钥。禁止读取、回显、记录、提交、渲染，或写入错误、测试快照和 Client props。
- `NEXT_PUBLIC_*` 只能保存 Supabase public URL 和 anon key。任何 service credential 均不得进入浏览器 bundle。
- 新增外部传输前，检查必要性、数据最小化、用户可见性、删除和保留边界。Reminder Email 不得包含账户、余额、金额、Monthly Action 名称或 Paid Intent。
- Auth 用户删除受 owner 外键 `RESTRICT` 保护。删除 owner 前必须先做精确影响清单，并使用已验证的事务清理路径；当前没有用户自助删除账号流程。

## 数据库与生命周期

- `supabase/migrations/` 是有序 schema 真源。每次 schema、RLS、ACL、约束、索引或数据库函数变更都必须新增 migration。禁止修改已发布 migration、补造 `002`、重命名、重排或只执行 `001_initial_schema.sql`。
- 同一数据库改动必须同步 migration、RLS、ACL、外键行为、数据库测试和 `lib/types/database.ts`。
- Owner migration、RLS 或跨 owner 外键变更必须验证 backfill、null owner、owner-scoped unique、复合外键、PUBLIC/anon/authenticated ACL 和跨 owner 负向路径。
- 多行派生写入必须使用显式事务或逐项检查数据库结果。存在未检查写入时，禁止报告生命周期操作成功。
- 计划激活、月度行动、Progress 重建、Monthly Review、Rollover、Paid Intent 和 Reminder claim 等并发敏感操作必须使用 owner lock、幂等键或数据库约束保持单一结果。
- 新增持久化实体前，先证明现有实体或字段不能表达生命周期。避免为事件、状态、通知、付款或计划创建平行模型。

## Server、API 与 Edge Function

- 代表已登录 owner 的 Server Action 和 Route Handler 必须调用 `getUser`，校验 owner 和输入，返回稳定结果或结构化错误，并刷新受影响路径。公开 Login Action 使用 Supabase Auth 校验凭据，不伪造已登录 owner。`proxy`、layout 和 RLS 不能替代函数内部校验。
- `app/api/**` 是外部 API 边界。Route Handler 必须独立鉴权和校验，限制请求体，使用正确状态码，并避免直接镜像数据库结构。
- 服务侧 Edge Function 使用自己的认证模型。Sender 校验 named secret；Webhook 校验 raw body 签名和时间窗口；Unsubscribe 校验随机 token，并保持 GET 只读、POST 幂等。服务侧 Function 不伪造用户身份。
- Edge Function 的 `verify_jwt = false` 是刻意的入口设置，不表示无鉴权。不得删除应用层认证、签名、token、ACL 或 kill switch。

## RSC、React 与 UI

- 首屏数据、鉴权和初始化判断在 Server Component 完成。独立读取使用 `Promise.all`。禁止在 mount `useEffect` 中补取首屏数据或发起初始化写入。
- Server Component 只查询必要字段，并只向 Client Component 传 UI 所需 DTO。禁止跨 RSC 边界传递 `owner_id`、密钥、内部状态、原始 SQL error 或完整数据库 row。
- Client state 只保存交互事实。派生值在 render 中计算。复杂行为使用明确 variant 和 children 组合；没有真实跨组件共享需求时不新增 Context。
- UI 改动沿用 `DESIGN.md` 的 Calm Ledger 系统。金额使用 tabular figures；orange 只表达动作、选中、当前 checkpoint 或进度；交互目标和 focus 必须可见。
- Owner locale 控制已登录产品的全部内建文案、ARIA 名称、确认框、错误提示、日期和金额格式。`zh-CN` 使用中文；`en-US` 与 `en-SG` 使用英文。Server Component 选择 feature-local typed copy；Client Component 只接收当前 Surface 所需的 string-only copy。Server Action 返回 stable code，由 UI 本地化。用户输入、账户名、币种代码和 IANA 时区保持原值。
- E2E 使用 role、label、accessible name 和用户可观察行为。禁止依赖 class、DOM 层级或 `data-testid`。

## 领域影响检查

领域术语和金额口径不在本文件重复定义。修改前读取 `CONTEXT.md`，并在 UI、计算、报告、类型和测试中使用同一术语。

- 修改账户、Balance Snapshot、Income、Bonus Event、Plan Rule、SOP 模板或 Monthly Action 时，必须评估并验证对 `monthly_milestones`、Plan Path、Monthly Report 和 Setup 的影响。
- 已实例化月份保留 Monthly Action 和 SOP 步骤快照。Plan Rule 或模板变更只影响未实例化月份。
- Closed Month 的执行记录、计划字段和 Review Completion 保持不变；Balance Snapshot 仍可后补或纠正，但不得改变执行状态。
- 修改删除行为或确认文案前，核对 `RESTRICT`、`CASCADE` 和 column-list `SET NULL` 的真实外键行为，并验证历史记录保留。
- `year_month` 使用 `YYYY-MM`，日期使用 `YYYY-MM-DD`。日期逻辑必须覆盖 owner timezone、月界和短月。
- Provider Acceptance 与 delivered 保持不同状态。只有签名 webhook 可以确认 delivery receipt。

## 验证

验证命令和前置条件以 README 的“验证矩阵”为唯一命令入口。按改动影响选择全部相关门禁，不按修改文件数量缩减验证。

- 仅修改文档：完整回读全部修改文件，验证链接和命令，运行 `git diff --check`，并审查最终 diff。
- 修改 TypeScript 或配置：运行应用基线 `lint`、TypeScript 和 production build；涉及依赖时再运行 production audit。
- 修改 schema、RLS、ACL、数据库函数或类型：按文件名顺序重建本地数据库，运行完整 pgTAP，并验证 migration、RLS、ACL、外键和 TypeScript 类型。
- 修改 Setup、Plan、Home、Progress、Monthly Review、Paid Intent 或 Reminder：运行对应 Playwright 和 concurrency suite。Reminder 还必须运行 Edge Function tests。
- 修改 UI：完成相关 desktop/mobile Playwright，并用 Codex 侧边栏浏览器验收真实页面、响应式、keyboard、focus、错误恢复和 browser logs。
- 修改已登录产品文案、locale、导航、ARIA、日期或金额展示：运行 `pnpm test:e2e:locale`。该 suite 必须覆盖 `zh-CN` 与 `en-SG` 的 desktop/mobile 独立 owner，并断言已知另一语言的内建产品文案不出现。
- 公开页面测试使用隔离端口和 fake public Supabase 配置。禁止读取 `.env.local`。
- Authenticated E2E、migration preflight 和 concurrency 测试会重建本地数据库。只对可丢弃的项目本地实例运行；测试后停止本地 Supabase。

只有所有适用门禁都通过，且没有未解释的 warning、未验证影响或半成品时，才可报告验证完成。

## 发布与状态记录

- Database、Edge Functions、Vercel Web、Resend 和 Cron 是独立发布层。任一层成功都不能证明其他层成功。
- 发布前读取 README 和相关 runbook，固定目标环境，审查 diff、migration 和外部影响，并在危险操作点取得明确确认。
- 发布后必须独立回读受影响层和用户流程。没有 live readback 时只能写 `released`，不能写 `verified_live`。
- 在 PR 或交接中分开记录 local validation、merged、deployed、live、paused 和 Not Claimed；不得把计划、历史方案或 synthetic evidence 写成真实用户结果。
- README 和 AGENTS.md 不缓存 commit SHA、人数、测试计数、secret 状态或当前 owner。Live 状态以 GitHub、Vercel、Supabase 和 Resend 的当前 readback 为准。

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
