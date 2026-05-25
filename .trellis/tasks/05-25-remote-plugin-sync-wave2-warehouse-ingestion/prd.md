# implement: remote plugin sync wave 2 warehouse ingestion

## Goal

实现远程插件同步平台的 Wave 2，让插件可以从插件市场进入远程插件仓，并让远程仓快照拥有独立、可控的更新链路。

## What I already know

- Wave 1 已完成：
  - 插件元数据契约
  - 远程插件仓共享模型
  - 远程仓 registry 入口
  - 远程可分发规则
- 当前已经有：
  - `src/shared/remotePluginWarehouse.ts`
  - `src/main/api/renderer/remotePluginWarehouseRegistry.ts`
  - `src/main/api/renderer/plugins.ts` 中的仓读写入口
  - 市场页与市场 API：
    - `src/main/api/renderer/pluginMarket.ts`
    - `internal-plugins/setting/src/views/PluginMarketSetting/PluginMarketSetting.vue`
- 远程仓目前还不能从市场真正入仓，也没有“已在远程仓 / 更新远程仓”的状态表达。

## Requirements

- 插件市场对支持双能力的插件，必须能触发“加入远程插件仓”动作。
- 当插件已在远程仓且快照是当前版本时，市场页能表达“已在远程仓”状态。
- 当市场有更高版本时，市场页能表达“更新远程仓”状态。
- 点击“加入远程插件仓”或“更新远程仓”时，平台立即下载对应插件包并固化为仓快照。
- 仓快照升级是显式动作，不自动跟随本地安装升级或市场版本变化。
- 本阶段不要求实现完整的远程插件仓页面，但必须把后续仓页所需的状态基础打齐。

## Acceptance Criteria

- [x] 平台能把市场插件写入远程仓快照
- [x] 平台能更新已有仓条目的快照版本
- [x] 平台能为市场卡片提供远程仓状态判断
- [x] 相关失败场景有稳定返回结果
- [x] 为入仓、更新和状态判断补足测试

## Out of Scope

- 远程插件仓总览页
- 单服务器批量同步页面
- 远程 Agent Linux 运行时
- 机器级安装状态 API
- 单插件“同步到远程”
- 混合型插件远程调用平台

## References

- 归档任务执行计划：
  - `.trellis/tasks/archive/2026-05/05-20-enrich-remote-plugin-sync/plan.md`
- 相关卡片：
  - `.trellis/tasks/archive/2026-05/05-20-enrich-remote-plugin-sync/cards/card-03-market-to-warehouse-flow.md`
  - `.trellis/tasks/archive/2026-05/05-20-enrich-remote-plugin-sync/cards/card-13-warehouse-snapshot-update-flow.md`
