# Savings Coach 产品章程

> Mode: Charter + Solution | Status: 初始 10 次迭代已关闭；业务结果待验证 | Owner / CEO: Codex | Sponsor: Perfecto | Date: 2026-08-31

标记：`已知`、`推断`、`假设`、`待决策`。

初始 10 次迭代已经交付并发布。该状态只证明项目 Output 完成，不证明激活、留存、付费意愿或市场需求成立。后续产品投入需要新的范围和授权。

## Business Case

### Opportunity

- **Customer class**：`假设` 已经用多个账户分配资金，并希望在不连接银行的前提下执行月度储蓄计划的英语薪资用户。
- **Primary desire**：把储蓄意图变成容易执行和复盘的月度计划。
- **Business outcome**：验证聚焦型 B2C SaaS 的激活、月度留存和付费意愿。
- **Solved well**：用户无需导入银行交易，也能建立计划、完成月度行动、复盘进展，并进入下一个月度周期。

### Supporting Observations

| Observation | Evidence | Confidence |
|---|---|---|
| 仓库已覆盖计划、月度执行、余额观察和复盘；Consumer AI 保持关闭。 | `README.md:1-3,53-76` | Strong |
| 产品已把里程碑执行状态与净值变化分开。 | `lib/milestones.ts:41-61` | Strong |
| Setup 支持 locale、timezone 和单一基础货币；全局 shell 仍使用中文，完整多语言体验尚未交付。 | `lib/setup/contracts.ts:1-16`; `app/layout.tsx:11-50` | Strong |
| 业务数据已经完成 owner-scoped RLS；Consumer AI 和 BYOK 保持关闭。 | `supabase/migrations/004_owner_isolation.sql:293-409`; `docs/product/ITERATIONS.md` Iteration 3 readback | Strong |
| 当前没有客户访谈、激活、留存或付费证据。 | 当前 schema 与 route 清单 | Weak opportunity evidence |

Opportunity 仍是 provisional。当前证据证明产品闭环存在，但不证明市场需求成立。

### Why Now

1. **Cost of Delay**：当前共享数据模型不能安全开放第二个用户。继续加功能会增加 owner 和 i18n 迁移成本。
2. **Current Window**：已有可运行闭环。Perfecto 已授权 Codex 管理至少 10 次敏捷迭代。EdgeOne 兼容性也可在继续扩展前用 bounded POC 验证。

## Objectives And Success Measures

以下 target 是首批邀请用户的假设，不是预测。至少有 20 名 activated users 后再校准。

| Outcome | Measure | Baseline | Hypothetical target | Checkpoint |
|---|---|---:|---:|---|
| 用户建立可执行计划 | `plan_activated / invited_signup` | Unknown | 24 小时内 ≥50% | Iteration 5 结束 |
| 用户执行计划 | `behavior_activated / plan_activated` | Unknown | 7 天内 ≥30% | Iteration 6 结束 |
| 用户完成月度闭环 | 首月到次月 `monthly_review_completed` | Unknown | ≥25% | Iteration 8 后一个完整周期 |
| 用户表现付费意愿 | `paid_intent / retained_user` | Unknown | ≥10% | Iteration 10 结束 |
| 每次发布可验证 | 公开入口 Playwright smoke | Iteration 1 前：No test | Release candidate 100% 通过 | 每次迭代 |

## High-Level Scope

### In

- English-first 的公开入口和登录后体验。
- 每名用户一个 owner 和一个数据空间。
- Owner-scoped 数据与 RLS。
- 每名 owner 一种 base currency。
- Locale 和 timezone 偏好。
- 手工账户、余额、Savings Plan 和月度执行。
- 可信的 Progress 和月度复盘。
- 最小激活、留存和 paid-intent 事件。
- 一种 reminder channel 实验。
- EdgeOne preview POC、发布门禁和回滚证据。

### Out

- 银行同步、银行交易导入和真实资金转移。
- Household、FX 和多币种资产组合。
- 投资管理、完整预算和支出记账。
- 全球税务计算。
- 没有 billing 真源时建立 subscription entitlement。
- 未经 Perfecto 单次确认的 push 或生产部署。

### Deferred

| Capability | Trigger |
|---|---|
| Hosted AI Coach | 激活成立；隐私、删除、限流和单位成本边界通过评审 |
| Consumer BYOK | 保留用户明确提出需求，且原始密钥不跨 RSC–Client boundary |
| Full Billing | paid-intent 证据支持引入支付真源 |
| Bank sync | 手工余额录入被确认是主要留存阻力 |
| Additional currencies / Household | retained users 重复提出需求 |

## Stakeholder And Authorization

| Role | Authority | Status |
|---|---|---|
| Perfecto — Sponsor | 优先级、重大范围、预算上限、push 和生产部署 | Confirmed；预算上限未知 |
| Codex — CEO / Owner | 产品方向、迭代排序、范围控制、交付和验证 | Confirmed |
| Codex Agents — Resources | 有边界的产品、工程、设计、测试和 review | 按每次迭代可用性调度 |

- Codex 自主决定可逆产品和实现事项。
- 安全边界、不可逆迁移、付费 vendor 或跨项目影响升级给 Perfecto。
- 每次迭代交付独立价值、验证证据、风险和下一步。
- 生产 push 和部署每次单独确认。

## Solution

### Direction

保留 Next.js 与 Supabase。EdgeOne POC 已得到 `FAIL_FOR_CURRENT_SEQUENCE`，当前发布 host 为 Vercel。owner 安全边界、Setup 偏好、激活和月度留存闭环已经交付。平台不能反向定义产品架构。

### Alternatives

| Direction | Benefit | Cost | Decision |
|---|---|---|---|
| 渐进演进 | 保留已运行闭环，更早获得用户证据 | 需要谨慎完成 owner migration | Chosen |
| Full rewrite | 数据和 UI 可从零设计 | 延迟学习，重新实现已有行为 | Rejected，除非现架构被证实阻塞 |
| Bank-first | 减少手工录入 | Vendor、安全、地区和支持成本高 | Deferred |
| EdgeOne-first | 可针对单平台优化 | 兼容性未证实，形成平台耦合 | Rejected；先做 POC |

### Load-bearing Assumptions

| Assumption | Failure impact | Validation |
|---|---|---|
| Manual-first 足以产生首批价值 | Bank sync 进入关键路径 | Iteration 5–8 的激活和流失访谈 |
| 用户理解月度执行计划 | Positioning 失败 | 公开文案测试和 onboarding completion |
| 当前代码可在不重写下增加 owner 隔离 | 工期扩大 | Iteration 3 migration 与 RLS proof |
| 单一 base currency 足够 | 首批 ICP 变窄 | Setup abandonment 与反馈 |
| 月度行动会形成复访 | Retention thesis 失败 | 两个周期的 `monthly_review_completed` |
| EdgeOne 可安全运行当前 stack | Hosting 方向失败 | Iteration 2 POC |
| 不连接银行也存在付费价值 | Monetization 失败 | Iteration 10 paid-intent test |

### EdgeOne POC

POC 只使用 preview 和非生产 Supabase 数据。任何 preview deployment 仍需 Perfecto 明确确认。

POC 只验证六个会改变 hosting 决策的平台门槛：

1. **Build compatibility**：当前 commit 可构建和启动，不维护平台专属 source fork。
2. **Auth runtime**：未登录跳转、登录 Cookie、session refresh、dashboard 和 logout 全部成立。
3. **Server Action lifecycle**：一个 staging probe 完成写入、fresh readback、`revalidatePath` 和精确清理。
4. **Diagnostics**：Build、deployment 和 request ID 可关联；失败可从 24 小时内的日志定位。
5. **Deterministic recovery**：从已知 commit 和配置重新部署，并重新通过 auth 与 write journey。
6. **Environment isolation**：只使用 staging Supabase；Client bundle、artifact 和日志不包含 server secret canary。

`/login` 渲染是 sanity check。它已经由 Iteration 1 Playwright 覆盖，不单独决定 hosting。

POC 明确不验证：

- 产品需求、激活、留存或付费意愿。
- Owner isolation 或 tenant-safe RLS。
- Consumer AI、Chat streaming 或 AI persistence。
- Production traffic SLO 和 custom domain。

**Pass**：六个平台门槛全部通过。EdgeOne 保留为候选 host。

**Fail**：存在局部、可逆、在 Iteration 2 内未解决的门槛。当前 10 次迭代改用标准 Next.js host，只有新平台证据出现后才重试。

**Kill**：需要核心重写，或环境隔离、secret safety、diagnostics、recovery 无法保证。当前章程内停止 EdgeOne 投入。

当前 POC 只能证明 Auth connectivity 和 Server Action runtime。Decision Record 必须写 `tenant isolation: NOT TESTED`。

Chat 首 token、超过 30 秒、断连和最终持久化属于 Deferred capability probe。它们不影响 manual-first hosting 结论。

## Delivery Outlook

### Initial 10 Iterations

| # | Independently valuable outcome | Acceptance evidence |
|---:|---|---|
| 1 | **Quality foundation.** 建立产品章程、Playwright 公开登录 smoke 和项目验证基线。 | `lint`、`typecheck`、`build`、desktop/mobile E2E 通过 |
| 2 | **EdgeOne hosting decision.** 完成六门槛 Preview POC：build、auth Cookie、Server Action、diagnostics、deterministic recovery 和 staging isolation。 | POC matrix 得到 Pass、Fail 或 Kill 结论 |
| 3 | **Safe invited-user access.** 按 `nullable owner_id → backfill → readback → owner RLS/unique → NOT NULL` 迁移。关闭 Consumer Coach/BYOK。 | 两 owner 隔离测试通过；没有 secret 跨 RSC–Client boundary |
| 4 | **Setup checkpoint.** 用户保存 locale、timezone、base currency、储蓄账户和初始余额。 | Setup 可保存和恢复，不需要重复录入 |
| 5 | **Income-independent Plan activation.** 定义 Savings Plan、Plan Rule、Monthly Action。创建正金额规则，实例化月份，生成计划路径并发出幂等 `plan_activated`。 | 不依赖中国 SalaryConfig 即可激活计划 |
| 6 | **Monthly execution Home.** 首页优先展示下一步。用户完成计入里程碑的 Monthly Action，并发出 `behavior_activated`。 | 执行状态改变；净值变化保持独立 |
| 7 | **Trustworthy Progress.** 修正余额、计划、拦截、删除、历史步骤和报告语义。 | UI、报告、类型和计算使用 `CONTEXT.md` 术语 |
| 8 | **Monthly close and rollover.** 完成显式复盘、发出 `monthly_review_completed`、冻结已关闭月份并准备下月。 | 模板变化不影响已关闭月份；留存 baseline 可查询 |
| 9 | **One-channel reminder experiment.** 只做一种渠道，包含 timezone、consent、scheduler、幂等和 unsubscribe。 | Reminder 只发送一次，并可停用 |
| 10 | **Paid-intent beta and release candidate.** 增加 Pro offer CTA 与 `paid_intent`。不创建 entitlement。完成 smoke、rollback、安全和发布 readback。 | paid intent 可测；release candidate 证据完整 |

后续迭代只有在 Opportunity 和 Scope 未变化时沿用本章程。重大方向变化需要更新章程。

Critical path：`1 → 2 → 3 → 4 → 5 → 6 → 8 → 10`。

每次迭代预留 20% 给验证和 repair。

### Risk And Uncertainty

| Item | Type | Impact | Trigger | Owner | Action |
|---|---|---:|---|---|---|
| Cross-owner access | Confirmed blocker | Critical | 任意 owner 能读写另一 owner 的数据 | Codex | Iteration 3 隔离测试前不开放 beta |
| Client secret exposure | Confirmed blocker | Critical | `api_key` 进入 Client props 或 bundle | Codex | 关闭 Consumer AI；只传安全 DTO |
| EdgeOne incompatibility | Uncertainty | High | POC fail | Codex | 局部失败或证据不足使用 fallback；只有命中明确 Kill criteria 才 Kill |
| Customer need weak | Uncertainty | High | 可用 onboarding 的激活率仍低 | Codex / Perfecto | 暂停扩功能，访谈并调整定位 |
| Monthly learning delay | Uncertainty | Medium | 没有第二周期数据 | Codex | 使用 behavior activation 作早期代理 |
| Timezone boundary error | Risk | High | 跨时区测试不一致 | Codex | 单 timezone；月界测试 |
| Reminder duplication | Risk | Medium | 重复或取消后仍发送 | Codex | 单渠道、幂等键、delivery readback |
| Resource continuity | Risk | High | 反复 carry-over 或跳过验证 | Perfecto | 先削减 Deferred scope，不削验证 |

### Benefits Realization

| Checkpoint | Benefit question | Owner | Course correction |
|---|---|---|---|
| Iteration 2 | EdgeOne 是否无需扭曲架构即可运行？ | Codex | 结构性失败则 Kill |
| Iteration 5 | 邀请用户能否激活计划？ | Codex | 先修定位和 onboarding，不继续扩功能 |
| Iteration 8 后一个周期 | 产品是否形成月度复访？ | Codex | 核心循环失败则暂停 reminder 和 paid work |
| Iteration 10 | 是否有付费意愿和安全 release candidate？ | Codex / Perfecto | 依据证据继续、收窄或停止 |

## Initial Program Closure

- **Closure date**：2026-08-31。
- **Delivery status**：初始 10 次迭代全部达到 `released` 或 `verified_live`。
- **Current release**：Vercel production；Supabase production schema 已应用到 migration 011。
- **Feature decision**：不增加 Iteration 11。International Preferences 在实现前取消，没有代码、schema 或生产状态变化。
- **Internationalization boundary**：locale、timezone 和基础货币语义已经进入 Setup 与核心金额格式化；完整 UI 多语言切换未交付。
- **Reminder boundary**：synthetic delivery 已验证；真实用户 sender domain、Cron 和 production UI 保持关闭。
- **Business outcome boundary**：当前没有 beta cohort、激活率、月度留存、真实 Paid Intent 或收入证据。

## Post-Program Decision Inputs

1. 后续投入的 Budget、vendor spend 和 engineering effort ceiling。
2. 首批 beta 地区和 privacy jurisdiction。
3. Beta cohort 和招募渠道。
4. 真实用户 Email Reminder 的 verified sender domain、Cron 和 production UI 授权。

这些输入不阻止初始 10 次迭代关闭。它们阻止真实用户 beta、Email Reminder launch 和下一阶段投资决策。

## Rubric Self-Review

| Dimension | Rating | Finding |
|---|---|---|
| Opportunity | ⚠️ | Customer 明确；没有市场观察 |
| Evidence | ⚠️ | 仓库证据强；客户证据缺失 |
| Why Now | ✅ | Cost of Delay 与 Current Window 已分开 |
| Objectives | ✅ | Outcome 对齐激活、留存和 paid intent |
| Success Measures | ⚠️ | Baseline 未知；target 是假设 |
| Scope | ✅ | In / Out / Deferred 可判定 |
| Authorization | ⚠️ | Sponsor 与 Owner 明确；预算未知 |
| Risk | ✅ | Risk、Uncertainty、Owner 和动作已分开 |
| Solution consistency | ✅ | 渐进 manual-first 回应 Opportunity |
| Governance readiness | ⚠️ | 本文不是 Full Initiation；cadence 和 backup 未定义 |
| Benefits Realization | ✅ | 有 checkpoint、owner 和 course correction |

**总体判定**：作为初始 10 次迭代的历史执行 Charter，交付已经关闭。作为下一阶段投资 Charter，仍是 `需重大修正`；缺少客户证据、预算上限、beta 地区和 cohort。

## Decision Trace

- 2026-08-30 — Perfecto 授权 Codex 作为 CEO，管理至少 10 次敏捷迭代。
- 2026-08-30 — 决定保留 Next.js + Supabase，首发采用 English-first、manual-first、single-owner、single-base-currency。
- 2026-08-30 — 决定自动化回归使用项目 Playwright，人工产品验收使用 Codex 侧边栏浏览器。
- 2026-08-31 — Iteration 9 拒绝将 Home prompt 表示为 scheduler-backed reminder。Outbound reminder 等待 provider credential、verified sender 和费用授权。
- 2026-08-31 — Iteration 9 将 Send Commit 定义为取消边界。模糊 Provider 结果使用同一 idempotency key 恢复，不得错误标记为 cancelled 或 failed。
- 2026-08-31 — Iteration 10 冻结 `pro_beta_usd_499_monthly_v1` 价格假设。Paid Intent 不创建付款、订阅、trial 或 entitlement。
- 2026-08-31 — Iteration 9 使用 Resend synthetic recipient 完成 delivery readback。真实用户 sender domain、Cron 和 production UI 继续保持关闭。
- 2026-08-31 — 初始 10 次迭代关闭。项目交付与业务结果分开记录；当前不声称激活、留存、付费或市场验证成功。
- 2026-08-31 — 取消 Iteration 11 International Preferences。该方案没有进入实现，不以低价值功能增加迭代数量。
