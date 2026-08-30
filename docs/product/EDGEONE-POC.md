# EdgeOne Preview POC

> Status: 准备中 | Owner: Codex | Verified on: 2026-08-30

## Decision Question

EdgeOne Makers 能否在不维护 source fork、不泄露 secret、且具备诊断和确定性恢复能力的前提下，运行当前 manual-first Next.js 与 Supabase stack？

本 POC 只决定 hosting。它不验证产品需求、owner isolation、月度留存或付费意愿。

## Preconditions

- Perfecto 明确批准本次 Preview deployment。
- 使用 `codex/iteration-2-edgeone-poc` 的干净 commit。
- 使用独立 staging Supabase，不使用 production endpoint 或 production data。
- 使用 staging 测试用户和唯一 `probe_id`。
- EdgeOne 只使用 Preview scope 的变量和 domain。
- 记录 commit、lockfile hash、deployment ID、Preview URL 和配置 hash。
- 证据不包含 Cookie、密码、财务值、API Key 或 secret canary 原文。

任一前置条件缺失时，不执行 Preview POC。

## Official Support Boundary

| Capability | Current evidence | POC treatment |
|---|---|---|
| Next.js 16、App Router、SSR、RSC | 官方支持表明确列出 | Build sanity |
| Next.js 16 `proxy.ts` | 官方文档明确说明 | Must-gate |
| Route Handlers、Response Streaming | 官方支持表明确列出 | Route Handler 是 must-gate；AI stream deferred |
| `revalidatePath` | 官方 ISR 文档给出示例 | Must-gate |
| Server Actions | 正式支持表未单列 | Must-gate |
| Supabase Cookie refresh | 有 Supabase 模板，但未覆盖当前完整组合 | Must-gate |
| `next build --webpack` | 官方允许自定义 build command，但未明确此 flag | Must-gate |

Primary sources:

- [Next.js Framework Guide](https://pages.edgeone.ai/document/framework-nextjs)
- [Build Guide](https://pages.edgeone.ai/document/build-guide)
- [Limits and Quotas](https://pages.edgeone.ai/document/limits-and-quotas)
- [Log Analysis](https://pages.edgeone.ai/document/log-analysis)
- [Deployment Overview](https://pages.edgeone.ai/document/deployment-overview)

## Platform Limits To Record

- Build：并发 1，20 分钟，4 CPU / 6 GB。
- Cloud Function：128 MB package，6 MB request/response。
- Cloud Function duration：默认 30 秒，可配置 10–120 秒。
- Runtime logs：默认保留 24 小时；单条最大 5 MB。
- Preview：每次 deployment 有独立 URL。
- Artifact：只保留最近 3 个成功 deployment。更旧记录可能返回 401。

以上是当前 Free Edition 文档值，不是 SLA。

## Must-Gate Matrix

| Gate | Setup and action | Required readback | Cleanup | Decision impact |
|---|---|---|---|---|
| Build compatibility | 使用当前 lockfile 与 `pnpm build` 创建 Preview | Commit、Node/pnpm、build command、artifact；无需 source fork；SSR/RSC 与字体加载 | 无数据写入 | 需要核心 source fork 则 Kill |
| Auth runtime | 新浏览器依次执行未登录 `/`、登录、dashboard、session refresh、logout | 30x、Cookie 更新、dashboard 200、logout 后再次跳登录 | Revoke staging session | Proxy、Cookie 或 Login Action 需核心重写则 Kill |
| Server Action lifecycle | 在 `/impulse` 用唯一 `probe_id` 新增记录，fresh navigation 回读，再精确删除 | Action success、row ID、UI 与 DB 回读、`revalidatePath`、`affected_rows=1`、最终 0 行 | Count 恢复写前值；无 probe 残留 | 任一步重复、残留或 stale read 则 Fail |
| Diagnostics | 触发一个受控 400 和一次 Server Action；按 request ID 查 log | Build、deployment、request 可关联；status、duration、Memory、MemUsage 可读；无敏感值 | 24 小时内保存脱敏证据 | 无法定位请求或出现 secret 则 Kill |
| Environment isolation | 配置 Preview-only dummy canary，扫描 HTML、bundle、artifact 和 logs | Server-only canary 不出现在 Client 或日志；Production 配置无变化 | 删除 canary，触发新 Preview 并确认不再可读 | Preview 能读 Production secret 或 secret 泄露则 Kill |
| Deterministic recovery | 部署 A、B，再从 A 的 commit/config 重新部署 A′ | A′ 有新 deployment ID/URL；commit/config 与 A 相同；Auth 和 Server Action journey 再次通过 | 清理 probe 与 Preview 变量 | 无法恢复已知版本则 Kill |

## Probe Ledger

同一 Server Action probe 必须记录：

1. `probe_id`。
2. 写前目标表 count。
3. Action success 和 row ID。
4. UI fresh navigation readback。
5. DB 侧 `id`、预设字段和 `created_at`。
6. 按精确 ID 删除。
7. `affected_rows = 1`。
8. 再查询 ID 得到 0 行。
9. 目标表 count 恢复写前值。

禁止复用或修改真实业务行。

本 POC 只能写：

```text
Auth connectivity: TESTED
Server Action runtime: TESTED
Tenant isolation: NOT TESTED
```

## Deferred Capability Probes

以下能力记录结果，但不改变 manual-first hosting 决策：

- Chat 首 token。
- Stream 超过 30 秒。
- Client abort 后 upstream 取消。
- Stream `finally` 中 assistant message 持久化。
- AI provider timeout 和 120 秒上限。

Hosted AI 重新进入 Scope 时，这些 probe 才升级为 release gate。

## Decision Rule

### Pass

六个 must-gate 全部通过。EdgeOne 保留为候选 host。

### Fail

存在局部、可逆、在 Iteration 2 内未解决的问题。当前 10 次迭代改用标准 Next.js host。只有新平台证据出现后才重试。

### Kill

满足任一条件即停止 EdgeOne 投入：

- 需要核心 source fork 或重写。
- Preview 和 production 无法隔离。
- Secret safety 无法保证。
- Runtime diagnostics 无法支持事故定位。
- 已知版本无法确定性恢复。

## Decision Record

POC 完成后填写：

| Field | Value |
|---|---|
| Date | |
| Sponsor approval | |
| Commit | |
| EdgeOne project / Preview | |
| Deployment A / B / A′ | |
| Staging Supabase alias | |
| Build gate | NOT RUN |
| Auth gate | NOT RUN |
| Server Action gate | NOT RUN |
| Diagnostics gate | NOT RUN |
| Environment isolation gate | NOT RUN |
| Recovery gate | NOT RUN |
| Tenant isolation | NOT TESTED |
| Result | NOT RUN |
| Selected host | |
| Fallback | Standard Next.js host |
| Production state changed | No |

## Current Blockers

- Iteration 1 尚未 push 或进入 Preview。
- 没有当前 EdgeOne project 和 Preview readback。
- 没有隔离 staging Supabase。
- 没有本次 Preview deployment 的单次授权。
- 本机 EdgeOne CLI 是 `1.6.17`；官方 latest 是 `1.6.28`。未获授权前不执行全局升级。
