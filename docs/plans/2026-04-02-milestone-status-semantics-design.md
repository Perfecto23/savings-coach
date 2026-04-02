# 里程碑状态语义修正设计

日期：2026-04-02

## 背景

当前 `monthly_milestones.status` 由储蓄账户月度净值变化推导。

这会把两类完全不同的概念混在一起：

1. 当月是否按 SOP 执行到位
2. 月底储蓄账户净值是否达到计划路径

在存在基金/理财浮亏时，即使当月已经按计划完成转账，badge 仍会显示 `missed`。这与产品预期不一致。

## 目标

1. 里程碑 badge 只表达“执行是否达标”
2. 投资涨跌继续保留，但不再影响 badge
3. 历史月份的判断不依赖当前模板，避免后续改模板导致历史结果漂移
4. 让 2026-03 这类“已转够钱但净值受投资波动影响”的月份恢复为达标

## 方案

### 1. 拆分语义

保留现有 `monthly_milestones` 字段，但重新定义含义：

- `status`：执行状态，只用于 badge / 连胜 / 进度环
- `actual_savings`：储蓄账户净值变化
- `actual_total_savings`：储蓄账户月末总净值

### 2. 在 `sop_records` 固化里程碑快照

新增字段：

- `counts_toward_milestone boolean not null default false`
- `milestone_amount numeric(12,2)`

规则：

- 模板指向 `purpose = savings` 的账户
- 且模板默认金额大于 0
- 则该月实例化出来的 `sop_record` 记为“计入里程碑”

这样月度判断直接依赖当月 `sop_records`，不再回头读取当前模板。

### 3. 里程碑状态判定

对某个月：

1. 找出当月所有 `counts_toward_milestone = true` 的 `sop_records`
2. 如果全部完成，`status = on_track`
3. 如果当月已结束且仍有未完成，`status = missed`
4. 如果当月未结束且仍有未完成，`status = pending`

`exceeded` 保留在类型和数据库枚举里兼容旧数据，但本次不再主动生成。

### 4. 计划金额的历史冻结

- 对已实例化的月份，`planned_savings` 优先取当月 `sop_records.milestone_amount` 之和
- 对尚未实例化的未来月份，继续用当前模板推导
- 奖金仍按既有逻辑叠加到 `planned_savings`

### 5. 展示层修正

涉及 `actual_savings` 的页面文案统一改成“净值变化”，避免继续误导成“实际存入”。

主要包括：

- 里程碑表
- 仪表盘本月状态卡片
- 月度报告
- AI system prompt

## 数据回填

新增 migration 回填历史 `sop_records`：

- 通过 `sop_records.template_id -> sop_templates -> accounts.purpose`
- 补齐 `counts_toward_milestone` 和 `milestone_amount`
- 然后按新规则重算 `monthly_milestones`

## 验证标准

1. 2026-03 在“储蓄类 SOP 全完成、但投资有浮亏”的情况下显示 `on_track`
2. 2026-03 的净值变化仍保留原始计算结果
3. 当前月未完成储蓄类 SOP 时，badge 为 `pending`
4. 过往月份若储蓄类 SOP 未完成，badge 为 `missed`
5. 修改模板后，已实例化历史月份的 `planned_savings` 不发生漂移
