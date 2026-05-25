# implement: remote plugin sync wave 3 agent runtime and machine state

## Goal

实现远程插件同步平台的 Wave 3，让远程 agent 在 Linux 侧具备一期稳定可用的常驻运行方式，并让平台能够读取机器维度的插件安装状态，同时建立机器-插件配置的数据模型与注入基础。

## What I already know

- Wave 1 已完成：
  - 插件元数据契约
  - 远程插件仓模型
  - 可分发规则
- Wave 2 已完成：
  - 市场加入远程插件仓
  - 远程仓快照更新链路
  - 市场卡片的远程仓状态表达
- 当前仓里已经存在一版远程 Agent 原型实现：
  - `src/main/core/remoteAgent/onboardingService.ts`
  - `src/main/core/remoteAgent/manager.ts`
  - `src/main/core/remoteAgent/store.ts`
  - `src/shared/remoteAgent.ts`
- 现有 agent 原型还不满足一期稳定运行要求，尤其是 Linux 侧常驻方式、PID/日志/版本信息、机器级插件状态接口、以及机器-插件配置消费链还没有收紧。

## Requirements

- 远程 agent 在 Linux 侧的第一阶段常驻运行方式采用 `nohup`
- 远程安装流程至少负责：
  - 安装目录落地
  - 启动脚本生成
  - `nohup` 启动
  - PID / 日志 / 版本记录
- 平台必须能获得机器维度的插件安装状态事实来源
- 状态结构必须区分：
  - 通用状态
  - `static / oneshot / service` 三类运行模型差异字段
- 建立 `machineId + pluginName` 维度的配置数据模型
- 机器-插件配置必须能被：
  - 同步链路消费
  - 运行时远程调用链路自动注入

## Acceptance Criteria

- [x] 远程 agent Linux 常驻运行模型完成并可被平台识别
- [x] 平台可以获取某台机器当前已安装插件状态
- [x] 三类运行模型的最小状态字段边界清楚
- [x] 机器-插件配置模型与读写入口完成
- [x] 配置可被同步和远程调用两条链路自动消费
- [x] 相关数据层与 agent 层补足测试

## Out of Scope

- 远程插件仓总览页
- 单服务器批量同步 UI
- 插件详情“同步到远程”入口
- 混合型插件运行时远程调用平台 API 全量实现
- `systemd` 或多守护模式支持
- agent 自升级守护

## References

- 归档任务执行计划：
  - `.trellis/tasks/archive/2026-05/05-20-enrich-remote-plugin-sync/plan.md`
- 相关卡片：
  - `.trellis/tasks/archive/2026-05/05-20-enrich-remote-plugin-sync/cards/card-05-remote-agent-installed-state-api.md`
  - `.trellis/tasks/archive/2026-05/05-20-enrich-remote-plugin-sync/cards/card-06-remote-agent-runtime-linux.md`
  - `.trellis/tasks/archive/2026-05/05-20-enrich-remote-plugin-sync/cards/card-08-machine-plugin-configuration.md`
