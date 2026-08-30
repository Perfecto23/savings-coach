# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

首批用户是通过邀请获得访问权限的个人储蓄者。用户希望建立可执行的储蓄流程，但不希望连接银行或导入交易。

## Product Purpose

Savings Coach 帮助用户建立储蓄计划、执行月度行动、记录余额观察并完成月度复盘。成功表示用户能持续完成真实的储蓄流程，而不是只查看财务数据。

## Positioning

Savings Coach 是 manual-first 的储蓄执行工具。产品把计划转入、步骤完成和净值变化分开记录，不把余额变化描述为已确认储蓄。

## Operating Context

用户每月执行月度 SOP。用户在关键日期手工记录余额快照，并在月末查看月度报告。Setup 只收集恢复产品运行所需的偏好、一个储蓄账户和初始余额。

## Capabilities and Constraints

- 每名登录用户对应一个 owner 和一个数据空间。
- 每名 owner 只有一种 base currency。
- 产品保存 locale 和 timezone 偏好。
- 产品不转移资金，不同步银行，不导入交易。
- Public signup 保持关闭。首批用户由邀请或预创建方式获得访问。
- Consumer AI Coach 和 BYOK 保持关闭。
- Household、角色、共享、多币种资产组合和全球税务不在当前范围。
- Next.js 和 Supabase 是当前实现真源。当前发布 host 是 Vercel。

## Brand Commitments

产品名称是 Savings Coach；当前中文产品名是“储蓄教练”。产品文案保持直接、克制，不使用财富承诺或银行侧确认语气。

## Evidence on Hand

- 当前产品闭环和行为以仓库代码、`CONTEXT.md` 与 `docs/product/PRODUCT-CHARTER.md` 为准。
- 当前没有客户访谈、激活率、留存率、付费意愿或商业证明。未来界面不得虚构这些证据。

## Product Principles

- 先让用户完成真实行动，再解释功能。
- 手工输入必须产生可恢复的持久状态。
- 计划、完成确认和余额观察保持独立。
- 先验证单 owner、单 base currency 的闭环，再增加协作或多币种。
- 安全门禁优先于功能数量。

## Accessibility & Inclusion

公开入口和 Setup 必须支持键盘操作、明确 label、可见 focus、错误恢复和 desktop/mobile 响应式布局。
