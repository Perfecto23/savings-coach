# 储蓄教练（Savings Coach）

Savings Coach 是 manual-first 的个人储蓄执行与复盘工具。用户建立储蓄计划，确认月度行动，记录余额快照，并完成月度复盘。产品不连接银行，不转移资金，也不导入银行交易。

- Production：<https://savings-coach.vercel.app>
- Live 状态必须从 GitHub、Vercel、Supabase 和 Resend 独立回读。
- 产品范围：[PRODUCT.md](PRODUCT.md)

## 当前产品

### 已发布能力

1. 受邀用户通过 Email 和密码登录。Public signup 保持关闭。
2. Setup 保存 locale、timezone、单一基础货币、一个储蓄账户和初始余额快照。
3. Plan Rule 按月生成 Monthly Action。Plan Activation 创建当前月行动和 12 个月 Plan Path。
4. Home 显示下一行动。用户可以确认或撤销步骤完成；该操作不表示银行已经转账。
5. Balance Snapshot、Progress 和 Monthly Report 分别展示余额观察、计划转入、目标余额和净值变化。
6. Monthly Review 关闭上一自然月，并根据当前 Plan Rule 完成 Monthly Rollover。
7. Income、Bonus Event、Monthly SOP、Impulse Check、账户和 SOP 模板继续作为辅助能力。
8. 完成过 Monthly Review 的用户可以记录 Pro beta Paid Intent。该记录不是付款、订阅、trial 或 entitlement。

### 当前关闭的能力

- Consumer AI Coach、BYOK 和 AI config 写入保持关闭。`POST /api/chat` 固定返回 `404 feature_disabled`。
- Public signup、密码找回 UI 和用户自助删除账号未开放。
- Monthly Review Email Reminder 是 gated capability，不属于默认开放范围。操作前重新回读 live gate；启用顺序见 [Reminder runbook](docs/runbooks/monthly-review-email-reminder.md)。
- Billing、checkout、subscription、银行同步、Household、角色和共享空间未实现。
- Locale 目前驱动金额、日期和月界。完整 UI 多语言切换未实现，当前界面仍有中英混合文案。

## 用户流程

```text
Invited login
  → Setup
  → Savings Plan / Plan Activation
  → Monthly Action on Home
  → Balance Snapshot and Progress
  → Monthly Review and Rollover
  → optional Pro beta Paid Intent
```

每名登录用户对应一个 `owner` 和一个数据空间。数据库使用 owner-scoped RLS、唯一约束和复合外键隔离数据。

核心概念复用现有表，不建立平行模型：

| 产品概念 | 持久化位置 |
|---|---|
| Setup、Plan Activation、Paid Intent、Reminder Consent | `owner_setup` |
| Plan Rule | `sop_templates`，`is_plan_rule = true` |
| Monthly Action | `sop_records`，`is_monthly_action = true` |
| Plan Path、Review Completion | `monthly_milestones` |
| Reminder Delivery | `review_reminder_deliveries` |

领域术语和金额口径以 [CONTEXT.md](CONTEXT.md) 为准。

## 系统架构

```text
Browser
  → Next.js App Router on Vercel
    → Server Components for first reads
    → Server Actions / Route Handlers for validated commands
      → Supabase Auth + PostgreSQL + owner-scoped RLS
      → owner-locked RPCs for lifecycle transactions

Gated reminder path (activation-only)
  Supabase Cron → Sender Edge Function → Resend
    → signed webhook → Reminder Delivery ledger
```

| 层 | 当前职责 |
|---|---|
| Next.js / React | 页面、RSC、安全 DTO、Server Actions 和公开 API 边界 |
| Supabase Auth | 邀请制 Email/password 身份和 session |
| PostgreSQL | 业务数据、RLS、约束、RPC 和事务 |
| Supabase Edge Functions | Sender、Resend webhook 和公开退订流程 |
| Vercel | 当前 Web production host |
| Resend | 受控 Reminder pipeline；启用、发送和回滚遵循专用 runbook |

EdgeOne 不是当前发布路径。重新评估前必须重新验证 artifact isolation、Auth session、Server Action、日志关联、确定性恢复和 secret isolation。

## 本地开发

### 前置条件

- Node.js `>=20.9.0`
- `pnpm`
- Docker-compatible runtime
- Bash、`psql` 和 `curl`
- Deno 2，仅 Reminder Edge Function 测试需要

安装依赖和 Chromium：

```bash
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
```

### 启动本地环境

以下命令会清空并重建项目本地数据库。只对可丢弃的本地 Supabase 实例执行。

```bash
pnpm exec supabase start
pnpm exec supabase db reset
cp -n .env.local.example .env.local
```

`cp -n` 只在 `.env.local` 不存在时创建文件，不覆盖已有配置。使用以下过滤命令读取 local public URL 和 anon key，并只写入本机 `.env.local`：

```bash
pnpm exec supabase status -o env | awk -F= '$1 == "API_URL" || $1 == "ANON_KEY" { print }'
```

不要输出或分享完整 status。不要把凭据或 token 粘贴到文档、Issue、日志或测试快照。

完成 `.env.local` 后启动应用：

```bash
pnpm dev
```

- App：<http://localhost:3000>
- Supabase API：<http://127.0.0.1:54321>
- PostgreSQL：`127.0.0.1:54322`
- Supabase Studio：<http://127.0.0.1:54323>
- Inbucket：<http://127.0.0.1:54324>

本地 Auth 也关闭 public signup。通过本地 Supabase Studio 创建测试用户。`supabase/seed.sql` 故意保持为空。

停止本地栈：

```bash
pnpm exec supabase stop
```

## 环境变量

Tracked 模板是 [.env.local.example](.env.local.example)。

| Key | 位置 | 用途 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Next.js / Vercel | Supabase public URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Next.js / Vercel | Supabase anon key |
| `REVIEW_EMAIL_FEATURE_ENABLED` | Next.js / Vercel | Settings Reminder UI gate，默认 `false` |

`NEXT_PUBLIC_*` 会进入浏览器。只能存放 public URL 和 anon key。

Reminder Edge Function secret、Supabase named secret、Vault key name 和启用顺序以 [docs/runbooks/monthly-review-email-reminder.md](docs/runbooks/monthly-review-email-reminder.md) 为唯一操作入口。README 不保存 secret value。

## 数据库

`supabase/migrations/` 是 schema 真源。必须按文件名顺序应用全部 migration。当前序列没有 `002`；不要补号、重命名或重排文件。

禁止单独执行 `001_initial_schema.sql`。Migration 001 的宽 authenticated policy 只用于历史初始状态；migration 004 才建立 owner-scoped RLS、ACL 和复合外键。

本地重建：

```bash
pnpm exec supabase db reset
```

Linked 远端项目：

1. 确认目标 project ref。
2. 审查已应用和待应用 migration。
3. 审查数据影响、RLS、ACL、外键和 RPC。
4. 获得生产变更确认后运行 `pnpm exec supabase db push`。
5. 独立回读 migration、RLS、ACL 和关键 RPC。

`db reset`、authenticated E2E、migration preflight 和 concurrency 测试都会清空或重建本地数据库。不要对含有需要保留数据的本地实例运行这些命令。

## 验证矩阵

仓库没有统一的 `test:all` 命令。按改动范围选择下列门禁。

### 应用基线

```bash
pnpm lint
pnpm exec tsc --noEmit
pnpm build
pnpm audit --prod
git diff --check
```

### 数据库与 migration

先启动项目本地 Supabase。以下命令会重建本地数据库。

```bash
pnpm test:db
pnpm test:migration-preflight
```

### Concurrency

先启动项目本地 Supabase。以下脚本会反复重建本地数据库。

```bash
pnpm test:setup-concurrency
bash scripts/test-plan-activation-concurrency.sh
pnpm test:monthly-execution-concurrency
pnpm test:trustworthy-progress-concurrency
pnpm test:monthly-close-concurrency
pnpm test:paid-intent-concurrency
pnpm test:review-reminder-concurrency
```

### Reminder Edge Functions

```bash
pnpm test:review-reminder-functions
```

该脚本使用 frozen Deno lockfile，并主动移除真实邮件环境变量。测试不得触达外部 Provider。

### Playwright

```bash
pnpm test:e2e
pnpm test:e2e:setup
pnpm test:e2e:plan
pnpm test:e2e:review
pnpm test:e2e:reminder
```

- 默认 E2E 只覆盖公开 Login 和 release boundaries。
- 四个 authenticated suite 要求项目本地 Supabase 已启动，并覆盖 Desktop Chromium 和 Pixel 5 viewport。
- Authenticated suite 会重建本地数据库并写入测试 fixture。
- E2E 不自动停止 Supabase。验证完成后运行 `pnpm exec supabase stop`。

## 发布

仓库没有 GitHub Actions、数据库自动发布或 Edge Function 自动发布。Web 部署依赖 Vercel GitHub integration。

1. 完成本地验证和 diff review。
2. 独立审查并应用 Supabase migration。
3. 若改动 Edge Functions，独立部署并验证每个 endpoint。
4. 确认 Vercel production 环境变量 key names。
5. 合并 `main`，等待 Vercel production deployment。
6. 分别回读数据库、Functions 和 Web。任一层成功都不能证明其他层成功。
7. 在 PR 或交接中分开记录 `merged`、`deployed` 和 `verified_live`，并附当前证据入口。

真实用户 Reminder activation 必须完整执行 [Reminder runbook](docs/runbooks/monthly-review-email-reminder.md)。Schema 或 Function 已发布不表示发送已经开放。

## 项目结构

```text
app/
  (app)/              authenticated product surfaces
  api/chat/            disabled Consumer AI boundary
  login/               invited-user sign-in
  setup/               Setup checkpoints
components/            feature UI and reusable components
lib/
  */contracts.ts       application DTO and command contracts
  supabase/            browser/server clients, session middleware, env
  types/database.ts    database types
supabase/
  migrations/          ordered schema truth
  tests/               pgTAP suites
  functions/           Reminder Edge Functions and Deno tests
scripts/               E2E harnesses, migration and concurrency tests
tests/e2e/             Playwright user journeys
docs/runbooks/         production activation and rollback procedures
```

## 文档入口

| 文档 | 职责 |
|---|---|
| [AGENTS.md](AGENTS.md) | Agent 长期工作规则和读取路由 |
| [CONTEXT.md](CONTEXT.md) | 领域术语、状态词和禁止描述 |
| [PRODUCT.md](PRODUCT.md) | 当前产品目的、用户和范围 |
| [DESIGN.md](DESIGN.md) | 设计系统、组件与无障碍规则 |
| [monthly-review-email-reminder.md](docs/runbooks/monthly-review-email-reminder.md) | Reminder 部署、启用、回滚和指标边界 |

## 安全边界

- `.env.local`、Edge Function secrets、Vault values 和 `ai_configs.api_key` 禁止提交、回显或进入 Client props。
- Server Action 和用户 Route Handler 必须验证当前用户、owner scope 和输入。RLS 不能替代应用层校验。
- Reminder Sender、Webhook 和 Unsubscribe 使用不同的服务认证边界。`verify_jwt = false` 不表示无鉴权。
- Reminder Email 不包含账户、余额、金额或 Monthly Action 内容。
- Provider Acceptance 不等于 delivered。只有签名 webhook 可以确认 delivery receipt。
- Auth 用户删除受 `RESTRICT` 外键保护。当前没有用户自助删除账号流程。
- 扩大 beta 前必须重新验证浏览器安全响应头，并把结果写入对应 PR 或发布交接。
