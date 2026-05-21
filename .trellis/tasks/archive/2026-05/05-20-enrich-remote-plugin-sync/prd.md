# enrich remote plugin sync

## Goal

在当前仓库已有一版远程 Agent 原型能力的基础上，定义一套完整、可演进的远程插件同步平台能力，使插件能够：

* 仅本地运行
* 仅远程分发与远程执行
* 以“本地控制面 + 远端执行面”的混合模式工作

## Product Scope

第一阶段目标是建立单服务器、显式触发、增量下发的远程插件平台闭环，而不是把现有本地插件模型直接复制到远程机器。

第一阶段聚焦：

* 远程插件仓
* 远程 Agent Linux 运行方式
* 机器维度插件状态与配置
* 单服务器批量同步
* 单插件同步到远程
* 混合型插件的运行时远程调用平台能力

## Core Requirements

* 远程机器接入与插件同步解耦；接入成功后不自动同步全部本机插件
* 远程插件分发来源采用独立“远程插件仓”模型，不等同于本地安装插件
* 同一个插件身份允许同时存在于本地 `plugins` 和远程插件仓中
* 插件必须显式声明：
  * 本地入口
  * 远端入口
  * 运行模型 `static / oneshot / service`
  * 是否支持远程同步
  * 允许的远端 `action`
  * `action` 的输入结构与输出结构
* 远端实际安装状态以 agent 回传结果为准
* “机器-插件配置”是平台长期配置，主编辑入口在远程机器详情页
* 同步语义仅包含安装、升级、配置下发；第一阶段不自动卸载
* 单插件同步入口位于插件详情页
* 远程插件仓页与单服务器批量同步页合并为同一主页面
* 混合型插件运行时远程调用通过主程序平台能力转发，不允许插件直连远端 agent

## Acceptance Criteria

* [x] 形成完整的结构化需求结论
* [x] 明确远程插件仓、本地安装、远端安装状态三者边界
* [x] 明确远程 Agent 页、插件详情页、市场页、远程插件仓页的页面职责
* [x] 明确单服务器批量同步和单插件同步的交互模式
* [x] 明确混合型插件远程调用的基本协议边界
* [x] 拆成可独立实现和验收的需求卡片

## Out of Scope

* 多服务器同时批量分发
* 自动定时同步
* 自动卸载远端多余插件
* `systemd` / 多守护模式并存
* agent 自升级守护
* 长任务队列、流式输出远程调用

## Documents

* 设计结论：[info.md](/Users/ewdager/ewdager/code/tiny-project/supatools/supatools/.trellis/tasks/05-20-enrich-remote-plugin-sync/info.md)
* 执行计划：[plan.md](/Users/ewdager/ewdager/code/tiny-project/supatools/supatools/.trellis/tasks/05-20-enrich-remote-plugin-sync/plan.md)
* 需求卡片索引：[cards/README.md](/Users/ewdager/ewdager/code/tiny-project/supatools/supatools/.trellis/tasks/05-20-enrich-remote-plugin-sync/cards/README.md)

## Notes

这份 `prd.md` 只保留产品目标、范围、核心要求和边界。实现分层、协议结论、波次规划和卡片拆分已迁移到配套文档。
