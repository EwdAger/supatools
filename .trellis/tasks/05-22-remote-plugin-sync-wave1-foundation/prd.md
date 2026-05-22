# implement: remote plugin sync wave 1 foundation

## Goal

实现远程插件同步平台的 Wave 1 基础层，为后续远程插件仓、单服务器批量同步、远程 agent 运行时、机器级插件状态和混合型插件远端调用奠定稳定契约。

## What I already know

- 上一个任务已经完成远程插件同步的结构化需求、页面原型和卡片拆分。
- Wave 1 目标只覆盖三张基础卡片：
  - Card 1: Plugin Metadata Contract Upgrade
  - Card 2: Remote Plugin Warehouse Data Model
  - Card 12: Remote Distribution Eligibility Rules
- 当前项目已有：
  - 插件元数据标准化：`src/shared/pluginMetadata.ts`
  - 本地插件安装链路：`src/main/api/renderer/pluginInstaller.ts`
  - 开发态插件注册表：`src/main/api/renderer/pluginDevelopmentRegistry.ts`
  - 内置插件加载：`src/main/core/internalPluginLoader.ts`
  - 远程可部署插件筛选：`src/main/core/remoteAgent/deployment.ts`
- 现有远程筛选仍只看 `platform` 与 `tags`，还没有远程插件仓模型和远程能力契约。

## Requirements

- 扩展插件元数据，显式表达：
  - 本地入口
  - 远端入口
  - 是否支持远程同步
  - 运行模型 `static / oneshot / service`
  - 允许的远端 action 及输入输出契约
- 保持对现有插件元数据的向后兼容，不破坏当前本地插件安装/加载链路。
- 建立独立的远程插件仓共享数据模型，不混入本地 `plugins` 集合。
- 建立统一的远程分发可用性判断函数，并能解释不可分发原因。
- Wave 1 不接入 UI，不实现市场入仓和仓页，只先完成契约与数据基础。
- 对现有老插件保持向后兼容：缺少新远程字段时，本地安装/加载链路仍然放行，但远程能力默认视为缺失。
- 单插件“同步到远程”入口不得绕过远程插件仓；未进入远程仓的插件不能直接发起远程同步。
- 对不支持远程分发元信息的插件，相关远程入口应默认不显示或置灰，而不是允许进入后再失败。
- Wave 1 中“支持远程分发”的最小条件必须同时满足：
  - `remoteSync = true`
  - `runtimeModel` 已声明
  - `remote.entry` 已声明
    缺少任一项都视为“不支持远程分发”。
- 对现有老插件保持向后兼容：缺少新远程字段时，本地安装/加载链路仍然放行，但远程能力默认视为缺失。

## Acceptance Criteria

- [ ] 插件元数据新字段完成共享层定义和归一化
- [ ] 本地安装、开发态、内置插件三条链路都能携带新元数据字段
- [ ] 远程插件仓共享类型与基础 upsert/empty helper 完成
- [ ] 可分发判定函数能够返回布尔结果和不可分发原因
- [ ] 为上述纯逻辑补足单元测试
- [ ] 现有老插件在不声明新远程字段时仍保留原有本地行为
- [ ] 平台已明确“未入远程仓不可直接同步”与“不支持远程分发时入口隐藏/置灰”的契约边界
- [ ] 平台已明确“支持远程分发”的最小条件集合，并能稳定据此判定
- [ ] 现有老插件在不声明新远程字段时仍能保留原本地行为

## Out of Scope

- 市场加入远程插件仓
- 远程插件仓页面
- 远程 agent Linux 运行时
- 机器-插件配置编辑页
- 批量同步和单插件同步 UI
- 混合型插件运行时远程调用

## References

- 归档任务 PRD:
  - `.trellis/tasks/archive/2026-05/05-20-enrich-remote-plugin-sync/prd.md`
- 归档任务设计结论:
  - `.trellis/tasks/archive/2026-05/05-20-enrich-remote-plugin-sync/info.md`
- 归档任务执行计划:
  - `.trellis/tasks/archive/2026-05/05-20-enrich-remote-plugin-sync/plan.md`
- 相关卡片:
  - `.trellis/tasks/archive/2026-05/05-20-enrich-remote-plugin-sync/cards/card-01-plugin-metadata-contract-upgrade.md`
  - `.trellis/tasks/archive/2026-05/05-20-enrich-remote-plugin-sync/cards/card-02-remote-plugin-warehouse-data-model.md`
  - `.trellis/tasks/archive/2026-05/05-20-enrich-remote-plugin-sync/cards/card-12-remote-distribution-eligibility-rules.md`
