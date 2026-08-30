# Setup Surface Brief

## Job And Audience

受邀储蓄者第一次进入产品。用户了解自己的账户和余额，但不了解产品内部术语。页面属于 Operate 模式。

## Outcome And Proof

用户依次保存地区设置、一个储蓄账户和当前余额。完成后页面显示本地化金额与账户名称。刷新和重新登录后，产品恢复同一个储蓄起点。

## Direction

Setup 使用“储蓄起点账页”结构。Desktop 左侧固定展示三个 checkpoint、当前选择和金额预览；右侧只展示当前步骤。Mobile 使用同一顺序的单列布局。

FIRST VIEWPORT：用户在一个视口内看到产品目的、当前 checkpoint、预计耗时和当前步骤的真实表单。页面不使用欢迎轮播、功能介绍卡或营销证明。

Signature interaction：每个步骤保存后，checkpoint 状态就地推进。最后一个步骤完成后进入独立成功页，显示本地化储蓄起点。

## Scope And Boundaries

- 三个步骤：Your region、Your savings account、Your current balance。
- 不允许跳过必填步骤。
- 不展示 Plan、SOP、milestone、owner、RLS 或 AI。
- 复用已有储蓄账户时必须由用户选择。
- 不修改全局视觉身份。页面沿用 warm neutral、orange action 和现有圆角语言。
- 不使用 emoji 作为 Setup 图标。图标使用一致的内联 SVG。

## States

- Preferences incomplete。
- Savings Account incomplete；包含 create 和 existing 两个明确 variant。
- Current balance incomplete。
- Loading、field error、save error 和 success。
- Returning user 从首个 incomplete checkpoint 恢复。
- Complete user 访问 `/setup` 时进入 dashboard。

## Constraints

- English-first copy。
- Keyboard、visible focus、44px target、`role=alert` 和 `aria-current=step`。
- Desktop、Pixel 5 和 Codex sidebar browser viewport 无水平溢出。
- Client DTO 不包含 `owner_id`、raw SQL error 或完整数据库 row。
