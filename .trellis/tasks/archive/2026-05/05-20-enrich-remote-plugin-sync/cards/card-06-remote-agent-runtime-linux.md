# Card 06: Remote Agent Runtime on Linux

## Goal

让远程 agent 在 Linux 上具备一期可用、稳定、可观测的运行方式。

## Scope

* 安装目录约定
* 启动脚本生成
* `nohup` 常驻启动
* PID / 日志 / 版本记录
* 重复安装或升级时的替换策略

## Acceptance

* 安装脚本执行后，agent 能以 `nohup` 方式稳定常驻
* 平台能感知 agent 是否在线及基础版本信息
* PID 与日志落点明确
* 当前实现不再依赖一次性前台拉起

## Suggested Implementation Steps

1. 定义远端安装目录结构
2. 设计 `nohup` 启动脚本
3. 定义重复安装/升级替换策略
4. 定义 agent 基础自检信息
5. 更新 onboarding / 安装脚本产物
6. 增加 Linux 远端运行链路验证

## Done Means

* 远端 agent 能在 Linux 侧以 `nohup` 稳定常驻
* 安装、重装、升级替换过程具备基本可控性
* 平台可查询其基础运行信息
