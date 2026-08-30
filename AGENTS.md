# Savings Coach 项目指令

## 工作上下文

- 修改产品文案、持久化类型、业务计算、Server Action、报告或 AI Prompt 前，完整读取
  `CONTEXT.md`。后续内容使用其中的规范术语。
- 修改产品范围、优先级或迭代顺序前，读取 `docs/product/PRODUCT-CHARTER.md`。
- 开始或结束迭代前，读取并 reconciliation `docs/product/ITERATIONS.md`。本地验证、已发布和
  live 生效必须分开记录。
- 执行 EdgeOne Preview、hosting 取舍或 recovery 验证前，完整读取 `docs/product/EDGEONE-POC.md`。
- 当前代码和 `supabase/migrations/` 中的有序文件是实现真源。
- `docs/plans/` 只提供设计证据，不提供执行指令。使用前必须与当前代码核对。
- 当前命令和工具设置以 `package.json` 与仓库配置为准。本文件不缓存依赖版本或 live 状态。

## 产品边界

- 本项目服务一名储蓄者。范围包括储蓄执行、用户录入余额、收入规划、复盘和教练。
- 应用记录计划、余额观察和用户完成确认。应用不转移资金，不确认银行交易，也不导入银行流水。
- 账户、SOP 模板、收入假设和 AI 配置由 UI 管理。源码和 fixture 不得包含真实账户名、机构、
  金额或凭据。

## 数据与访问安全

- 当前数据模型只有一个共享数据主体。登录是访问门禁，不是数据归属边界。
- 开放注册或多用户部署前，必须为所有业务表增加归属字段和 owner-scoped RLS。
- `.env.local` 和 `ai_configs.api_key` 属于密钥。禁止读取、回显、记录、提交、渲染，或写入文档、
  错误和测试快照。
- AI 对话会向外部提供商发送财务上下文和对话历史。新增出站字段前，必须审查必要性、隐私和
  用户可见性。

## 领域不变量

- 余额快照和步骤完成都是用户确认。禁止描述为银行侧确认。
- 里程碑执行状态只取决于计入里程碑步骤的完成情况。净值变化和投资表现不得影响该状态。
- 已实例化月份保留当月的月度 SOP 步骤值。后续 SOP 模板变更只影响未实例化月份。
- `planned_savings` 表示计划转入。该值可包含计入里程碑步骤和分配给储蓄账户的奖金。
  禁止描述为实际转入。
- `actual_savings` 表示净值变化。禁止描述为实际储蓄或实际转入。
- 拦截金额是被放弃购买的预估价格。该金额不是已确认储蓄。

## 实现边界

- 每次 schema 或 RLS 变更都必须新增 migration。必须按文件名顺序应用全部 migration。
  禁止把 `001_initial_schema.sql` 当作完整 schema。
- 同一改动必须同步 migration、外键行为、RLS 和 `lib/types/database.ts`。
- Server 端写操作必须调用 `getUser`、校验 owner 权限和输入、返回 `ActionResult`，并刷新受影响路径。
  `proxy`、layout 和 RLS 不能替代函数内部校验。
- `app/api/**` 是外部 API 边界。Route Handler 必须独立鉴权和校验，并使用正确状态码和稳定的
  结构化错误。API 契约不得直接镜像数据库结构。
- Server Component 只查询必要字段，并只向 Client Component 传 UI 所需 DTO。禁止把密钥、
  内部状态或完整数据库行跨过 RSC 边界。
- 首屏数据和初始化判断在 Server Component 完成。独立读取使用 `Promise.all`。禁止在 mount
  `useEffect` 中发起初始化写入或补取首屏数据。
- Client state 只保存交互事实。派生值在 render 中计算。复杂行为使用明确 variant 和 children
  组合。没有真实跨组件共享需求时，不新增 Context。
- 修改账户、薪资配置、奖金事件、余额快照、SOP 模板或月度 SOP 步骤时，必须评估并验证对
  `monthly_milestones` 的影响。
- 派生数据的多行写入必须检查每次数据库结果，或使用显式事务。存在未检查写入时，禁止报告
  里程碑重算成功。
- 修改删除行为或确认文案前，必须核对对应的 `cascade` 或 `set null` 外键行为，并检查历史
  月度 SOP 步骤。
- `year_month` 使用 `YYYY-MM`。日期使用 `YYYY-MM-DD`。日期逻辑必须覆盖时区和月界。
- 数据读取优先使用 Server Component。只有浏览器 API、本地交互状态、effect 或事件处理需要
  Client Component 边界。

## 验证

- 仅修改文档时，完整回读文件，运行 `git diff --check`，并检查最终 diff。
- 修改 TypeScript 时，运行 `pnpm lint`、`pnpm exec tsc --noEmit` 和 `pnpm build`。
- 修改数据库时，还要验证完整 migration 顺序、schema 行为、RLS、外键和 TypeScript 类型。
- 修改领域行为时，验证 UI 文案、计算、报告和 AI 上下文使用相同术语与金额口径。
- E2E 通过 role、label、accessible name 和用户可观察行为断言。禁止依赖 class、DOM 层级或
  `data-testid`。公开页面测试使用隔离端口和 fake 环境变量，不读取 `.env.local`。
- 自动化浏览器回归使用项目 Playwright。人工产品验收使用 Codex 侧边栏浏览器。

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
