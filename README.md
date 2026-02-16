# 储蓄教练 (Savings Coach)

个人储蓄管理应用，通过月度 SOP 流程、多账户余额追踪和 AI 教练帮你实现存钱目标。

## 技术栈

- **Next.js 16** App Router + Server Actions
- **Supabase** Auth + PostgreSQL + RLS
- **Tailwind CSS 4**
- **Vercel AI SDK** 多模型对话
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

在 Supabase Dashboard → SQL Editor 中执行 `supabase/migrations/001_initial_schema.sql`，创建表结构、RLS 策略和索引。

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
    coach/            # AI 教练对话
    settings/         # 账户/SOP模板/AI配置
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
