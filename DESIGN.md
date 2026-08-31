---
name: Savings Coach
description: A calm, manual-first savings workspace with warm paper surfaces and decisive orange actions.
colors:
  canvas: "#fffbf5"
  setup-canvas: "#f6f1e8"
  surface: "#ffffff"
  ink: "#1c1917"
  ink-inverse: "#0c0a09"
  copy-muted: "#57534e"
  border: "#d6d3d1"
  action: "#c2410c"
  action-hover: "#9a3412"
  action-bright: "#f97316"
  action-soft: "#ffedd5"
  focus: "#fed7aa"
  success: "#34d399"
  error: "#b91c1c"
typography:
  display:
    fontFamily: "var(--font-geist-sans), system-ui, -apple-system, sans-serif"
    fontSize: "3rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.045em"
  headline:
    fontFamily: "var(--font-geist-sans), system-ui, -apple-system, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 600
    lineHeight: "2.25rem"
    letterSpacing: "-0.035em"
  body:
    fontFamily: "var(--font-geist-sans), system-ui, -apple-system, sans-serif"
    fontSize: "1rem"
    lineHeight: "1.75rem"
  label:
    fontFamily: "var(--font-geist-sans), system-ui, -apple-system, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: "1.25rem"
rounded:
  focus: "4px"
  compact: "8px"
  control: "12px"
  pill: "9999px"
spacing:
  "3": "12px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
  "8": "32px"
  "10": "40px"
  "16": "64px"
components:
  button-primary:
    backgroundColor: "{colors.action}"
    textColor: "{colors.surface}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 20px"
    height: "48px"
  button-primary-hover:
    backgroundColor: "{colors.action-hover}"
  field-default:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "48px"
  choice-card-selected:
    backgroundColor: "{colors.action-soft}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "56px"
  navigation-active:
    backgroundColor: "{colors.action-soft}"
    textColor: "{colors.action}"
    typography: "{typography.label}"
    rounded: "{rounded.compact}"
    padding: "8px 12px"
---

## Overview

**Creative North Star: "The Calm Ledger."** Savings Coach treats financial input as a deliberate record, not a performance dashboard. Warm paper surfaces make manual entry approachable. Dark anchoring areas mark orientation and completion. Orange identifies the next action, not generic decoration.

**Key Characteristics:**

- Quiet warm neutrals keep planning and balance entry readable for extended use.
- Orange has a single job: mark an action, current route, current checkpoint, or measured progress.
- Rounded controls soften data entry, while dark panels create a stable visual anchor.
- Numbers use tabular figures when the value needs comparison or confirmation.

**The Manual-First Rule.** The interface must make a user-entered amount feel explicit and recoverable. It must not imply a bank connection, transaction confirmation, or automatic money movement.

## Colors

The palette separates a warm, low-pressure workspace from explicit action. Use the warm canvases for page backgrounds, white for ordinary cards and controls, and dark ink for setup orientation or a completion state. Use the orange family only for primary action, selected navigation, checkpoint progress, focus reinforcement, and progress indicators. Emerald marks completion and an explicitly enabled status; red marks errors.

**The Orange Is Evidence Rule.** Orange must communicate the current or next meaningful state. Do not use it as a second neutral, a decorative page wash, or a substitute for hierarchy.

**The Dark Anchor Rule.** The dark panel is reserved for navigation, orientation, and success confirmation. Keep its supporting copy subdued so the current checkpoint or confirmed value remains dominant.

## Typography

Geist is the application voice. It is compact, neutral, and legible for data entry. The largest display treatment appears only in the completion state. Setup headings use the headline role. Labels, navigation, and checkpoint labels use the label role. Body copy stays generous enough to explain manual-entry boundaries without becoming instructional clutter.

Use `tabular-nums` for values that users compare, confirm, or scan in a list. Keep numeric inputs larger than ordinary form text. Avoid uppercase label systems and decorative type styles.

**The Value First Rule.** When an amount is the action's subject, give the amount a larger numeric treatment than its supporting label.

## Language

Owner locale 是已登录产品的界面语言真源。`zh-CN` 使用中文；`en-US` 与 `en-SG` 使用英文。同一 Surface 的标题、说明、label、placeholder、按钮、状态、ARIA 名称、确认框和错误提示必须使用同一种语言。

日期和金额使用完整 owner locale。币种继续使用 owner base currency。用户输入、账户名、币种代码和 IANA 时区保持原值。Server Component 选择 feature-local typed copy；Client Component 只接收当前交互所需的 copy slice。

**The One Language Rule.** 已知另一语言的内建产品文案不能出现在当前 Surface。用户输入和标准标识符不属于语言泄漏。

## Layout

The ordinary application uses a constrained content column (`max-width: 1024px`) inside an app shell. Desktop navigation is a fixed 240px rail; mobile navigation moves to a fixed bottom bar. Cards use 24px internal padding and 16px to 24px gaps.

Setup changes the density, not the brand. It uses a two-column grid from the large breakpoint: a dark orientation panel and a light task panel. The outer grid is capped at 1440px, with a 320px minimum left column and a 560px minimum right column. On smaller screens, the same sequence becomes one column; checkpoints remain visible as a compact vertical list before the current form.

Forms use a 32px lead-in from explanatory copy and a 24px vertical rhythm between field groups. Interactive controls have at least 48px height. Account-choice cards use 56px height.

**The One Task Rule.** A form surface presents one current user decision. Keep secondary detail in helper copy, the progress rail, or a following step.

### Setup behavior

- Setup 依次呈现地区偏好、储蓄账户和当前余额三个 checkpoint。用户不能跳过 checkpoint。
- 首个 viewport 同时显示产品目的、当前 checkpoint、预计耗时和当前表单。不使用欢迎轮播或功能营销卡。
- 储蓄账户步骤明确区分 create 和 existing 两种选择。复用既有账户时保留显式 radio selection。
- Returning user 从首个未完成 checkpoint 继续。完成用户访问 Setup 时进入 Home。
- Checkpoint 使用 `aria-current="step"`。Field error 使用 `role="alert"`。Setup 图标使用同一套 inline SVG，不使用 emoji。

## Elevation & Depth

The system is border-first at rest. White cards separate from the warm canvas through a light border and a tonal background change, not through permanent floating shadows. Setup fields use the small native control shadow. Primary Setup actions add a diffuse orange shadow (`0 10px 24px rgba(194,65,12,0.24)`) to confirm their affordance. The completion action uses a slightly larger orange shadow (`0 12px 32px rgba(249,115,22,0.22)`). Linked dashboard cards can lift on hover.

**The Resting Surface Rule.** Do not add a shadow to every card. Elevation must indicate an interactive response or the next action.

## Shapes

The system uses gently rounded rectangles. Ordinary compact navigation and local links use the compact radius. Forms, cards, action buttons, alerts, and account-choice controls use the control radius. Checkpoints, status markers, and small icon containers are circular. Sign-out controls and compact counters are pills.

Use thin, low-contrast borders for fields and containers. Preserve the visible 2px focus outline and 2px outline offset from the global stylesheet. Do not replace focus with a color-only treatment.

## Components

### Buttons

- **Primary:** Full-width in Setup and inline on the completion screen. It uses the action color, a 48px minimum height, strong body weight, and the control radius.
- **Hover / Focus:** Hover darkens the primary Setup action. Focus keeps the visible global outline; Setup fields also add the soft orange ring.
- **Disabled:** Preserve the action shape and reduce opacity. Replace the pointer cursor with the not-allowed cursor.
- **Quiet action:** Sign-out is text-first, pill-shaped, and only brightens on hover. It must not compete with the primary action.

### Inputs / Fields

- **Style:** White control surface, thin neutral border, small control shadow, and the control radius.
- **Focus:** Shift the border toward orange and show the soft orange ring. The global focus outline remains visible for keyboard users.
- **Error / Disabled:** Place an error message below the related field in red. Show submission errors in a bordered pale-red alert. Disabled controls use a muted stone background and text.
- **Numeric input:** Use a larger, semibold, tabular numeric treatment for balance entry.

### Choice Cards

- **Style:** Two 56px option cards can sit side by side at the small breakpoint and above. Each uses a radio input with the orange accent.
- **Selected:** A checked option changes its border and surface to the action family. The selected state must remain recognizable without relying on color alone because the radio stays visible.

### Cards / Containers

- **Ordinary card:** White surface, thin neutral border, 24px padding, and the control radius.
- **Interactive card:** Keep the ordinary resting treatment. A pointer-linked card may lift with a medium shadow on hover.
- **Status panel:** Use the dark inverse surface for progress orientation and the final confirmation state. Keep faint circular ornament restrained and non-interactive.

### Navigation

- **Desktop rail:** White translucent surface with a warm divider. The active item uses the soft action surface and action-colored text; inactive items stay muted until hover.
- **Mobile bar:** Fixed, translucent white surface with a warm top divider. Active icons and labels use bright orange. The more-menu is a raised white container above a dimmed backdrop.

### Progress

- **Checkpoint marker:** A small circular sequence marker is orange when current, emerald when complete, and muted stone when pending. The current list item uses `aria-current="step"`.
- **Progress ring:** A gray track and orange gradient value arc pair a percentage with an optional fraction. The value arc uses rounded ends and an ease-out transition.

## Do's and Don'ts

### Do:

- **Do** use a warm canvas, white fields, and dark text for routine data entry.
- **Do** reserve orange for the current step, the primary action, selected navigation, and progress.
- **Do** use tabular numerals for financial values and comparison counts.
- **Do** maintain 48px minimum targets and visible keyboard focus.
- **Do** state manual-entry limits plainly when a balance or completion could be mistaken for a bank-confirmed event.

### Don't:

- **Don't** imply that Savings Coach connects to a bank, transfers money, or confirms a bank transaction.
- **Don't** turn every card into a raised container or add shadows without a state purpose.
- **Don't** use orange as ordinary body text or a general background color.
- **Don't** hide validation in placeholders or color alone; keep labels, error text, and focus visible.
- **Don't** introduce a display font, uppercase dashboard labels, or non-tabular financial figures.
