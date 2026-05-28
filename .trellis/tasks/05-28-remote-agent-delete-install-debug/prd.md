# brainstorm: remote agent delete and install debug controls

## Goal

补齐远程 Agent 管理里的两个缺口：机器列表需要删除能力；远程环境执行安装/连接脚本时出现卡住场景，需要预留一个明确的调试参数，方便排查安装过程。

## What I already know

- 当前远程 Agent 页面已经有机器列表、创建页、详情页，但列表页没有删除入口
- 远程环境执行安装脚本时存在“卡住”的真实场景
- 用户希望增加一个“调试用参数”，用于远程安装/连接阶段问题排查
- 当前远程 Agent 安装流程已经支持 `systemctl` 优先、`nohup` 回退，以及安装后置脚本模板
- 用户已确认：删除机器时同时删除本地机器记录、本地插件配置和同步日志；不尝试远程卸载，也不要求机器在线
- 用户已确认：调试参数采用安装命令追加 `sh -s -- --debug` 的形态；开启后输出详细阶段日志并帮助定位卡住步骤

## Assumptions (temporary)

- 机器删除会发生在设置页的远程 Agent 机器列表中
- 删除会清理该机器的本地记录、机器级插件配置和同步日志
- 调试参数会体现在安装命令或安装脚本行为里，而不是单独开一套调试页面
- 默认安装命令保持不变，调试命令作为显式备用入口展示

## Open Questions

- 无

## Requirements (evolving)

- 远程 Agent 机器列表支持删除机器
- 删除交互需要避免误删
- 删除机器时同步清理本地机器记录、机器级插件配置和同步日志
- 删除不尝试操作远端已安装插件
- 安装/连接脚本支持一个明确的调试参数
- 调试参数采用 `--debug`，通过 `sh -s -- --debug` 透传给安装脚本
- 调试参数需要能帮助定位“卡住”发生在哪一步

## Acceptance Criteria (evolving)

- [ ] 机器列表中可对单台远程机器执行删除
- [ ] 删除行为的本地数据清理范围明确且一致
- [ ] 安装/连接脚本支持调试模式或调试参数
- [ ] 调试模式下能输出足够的安装过程信息辅助定位卡住问题

## Out of Scope (explicit)

- 远端 agent 自恢复机制
- 自动诊断和自动修复卡住问题
- 多机批量删除

## Technical Notes

- 预计涉及 `internal-plugins/setting/src/views/RemoteAgentSetting/RemoteAgentSetting.vue`
- 预计涉及 `src/main/core/remoteAgent/manager.ts` 与 onboarding/install script 生成逻辑
