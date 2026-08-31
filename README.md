# 储蓄教练 (Savings Coach)

Manual-first 的个人储蓄执行与复盘应用。产品记录储蓄计划、月度行动、余额快照和月度复盘，不转移资金，也不导入银行交易。

## 技术栈

- **Next.js 16** App Router + Server Actions
- **Supabase** Auth + PostgreSQL + RLS
- **Tailwind CSS 4**
- **Vercel AI SDK**（Consumer AI 当前保持关闭）
- **Recharts** 数据可视化

## 本地开发

```bash
pnpm install
cp .env.local.example .env.local  # 填入 Supabase 凭据
pnpm dev
```

### 环境变量

在 `.env.local` 中配置：

```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

### 数据库初始化

`supabase/migrations/` 是数据库真源。必须按文件名顺序应用全部 migration。禁止单独执行 `001_initial_schema.sql`；该文件不包含后续 owner-scoped RLS、Setup、Savings Plan、Monthly Review、Paid Intent 和 Reminder 结构。

本地数据库：

```bash
pnpm exec supabase start
pnpm exec supabase db reset
```

已链接的远端项目必须先审查 migration diff，再通过 Supabase CLI 应用全部待执行 migration：

```bash
pnpm exec supabase db push
```

## 部署到 Vercel

1. 在 Vercel 导入 GitHub 仓库
2. 在 Vercel 项目设置中添加环境变量（同上）
3. 自动部署，无需额外配置

## 项目结构

```
app/
  (app)/              # 需要登录的页面
    page.tsx          # 仪表盘
    sop/              # 月度 SOP 清单
    balances/         # 余额记录
    income/           # 薪资配置 + 奖金事件
    milestones/       # 储蓄里程碑
    impulse/          # 冲动拦截
    coach/            # Consumer AI 当前关闭
    settings/         # 账户/SOP 模板/提醒偏好
  login/              # 登录页
  api/chat/           # AI 对话 API
components/           # UI 组件
lib/
  supabase/           # Supabase 客户端封装
  types/              # TypeScript 类型定义
  tax-calculator.ts   # 累计预扣预缴个税计算
  achievements.ts     # 成就系统
supabase/
  migrations/         # 数据库迁移文件
  config.toml         # Supabase CLI 本地开发配置
```
