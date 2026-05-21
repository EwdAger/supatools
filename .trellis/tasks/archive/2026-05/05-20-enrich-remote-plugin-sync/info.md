# Design Conclusion

## 1. Product Goal

本期要做的不是“把现有本地插件直接复制到远程机器”，而是建立一套完整的平台能力，使插件能够同时支持：

* 仅本地运行
* 仅远程分发和远程执行
* 本地控制面 + 远端执行面的混合模式

平台需要把“本地安装”、“远程分发来源”、“远端实际安装状态”、“运行时远程调用”四类概念拆开。

## 2. Core Domain Model

### 2.1 Local Installed Plugins

本地 `plugins` 集合继续表示“已安装到当前桌面端、可在当前桌面端打开/运行/管理”的插件。

### 2.2 Remote Plugin Warehouse

远程插件仓是独立集合，负责：

* 保存可分发插件的包快照和元数据
* 跟踪快照是否有市场新版本可更新
* 作为单服务器批量同步的条目来源

### 2.3 Remote Agent Installed State

每台远程机器上的实际安装状态，以 agent 回传结果为唯一事实来源。

### 2.4 Machine-Plugin Configuration

配置是 `machineId + pluginName` 维度的平台长期配置，不属于插件详情本身，也不属于一次性动作参数。

## 3. Plugin Packaging and Metadata

### 3.1 Single Identity

一个插件只有一个市场条目和一个插件身份，不拆成本地插件与远程插件两个条目。

### 3.2 Single Package

第一阶段采用单包模型：一个插件包同时携带本地面和远端面。

### 3.3 Explicit Entrypoints and Contracts

插件元数据需显式声明：

* 本地入口
* 远端入口
* 是否支持远程同步
* 运行模型
* 允许的远端 action
* action 的输入结构
* action 的输出结构

这些声明第一阶段统一放在 `plugin.json` 中。

### 3.4 Runtime Model

第一阶段运行模型固定为：

* `static`
* `oneshot`
* `service`

agent 内部实现要预留按运行模型切执行器的接口，但第一阶段 agent 只负责安装并执行插件显式声明的远端入口。

## 4. Distribution and Warehouse Semantics

### 4.1 Add to Warehouse

插件可以从市场直接加入远程插件仓。点击“加入远程插件仓”时，平台立即下载插件包并固化为仓快照。

### 4.2 Snapshot Semantics

远程插件仓保存的是快照，不是对当前本地安装包或市场版本的动态引用。

* 加入仓时固化当前包
* 本地安装升级不会自动刷新仓条目
* 市场有新版本时，仓条目只显示“可更新”
* 用户显式执行“更新远程仓”后，仓条目才推进到新快照

### 4.3 Coexistence with Local Install

同一个插件可以同时进入本地 `plugins` 集合和远程插件仓。是否本地可运行、是否可远程分发是两个独立维度。

## 5. UI Information Architecture

### 5.1 Plugin Detail

* 保留在本地插件中心
* 顶部动作区增加“同步到远程”
* 同步入口进入二级页选择远程服务器
* 主面板只显示远程同步摘要
* 不在插件详情中编辑机器-插件配置

### 5.2 Remote Agent Page

远程 Agent 页默认显示机器列表页，不把“创建 + 列表 + 详情”全部摊开。

* 默认列表页
* “新增远程机器”进入二级页
* 点击机器进入机器详情页
* 机器详情页展示安装命令、安装状态、配置、日志

### 5.3 Remote Plugin Warehouse Page

远程插件仓页与单服务器批量同步页合并为同一个主页面。

* 未选服务器时：展示仓总览 + 服务器选择器
* 选定服务器后：展示该服务器可分发的仓条目
* 默认不预选服务器
* 默认不展示不可分发条目
* 可通过显式切换查看不可分发条目及原因

### 5.4 Plugin Market

市场页对支持双能力的插件同时展示两个入口：

* `安装到本地`
* `加入远程插件仓`

远程仓按钮状态需要区分：

* 未加入
* 已在远程仓
* 更新远程仓

## 6. Remote Agent Runtime on Linux

### 6.1 Runtime Goal

远程 agent 不能只停留在“脚本拉起一次进程”的原型状态。第一阶段必须明确 agent 在 Linux 远端服务器上的最小可用运行方式。

### 6.2 First-Phase Supervision Model

第一阶段推荐使用 `nohup` 维护远程 agent 进程。

原因：

* 对 Linux 发行版依赖最少
* 比一次性前台运行稳定
* 足以支撑 agent 常驻、日志落盘、手动升级替换
* 不会在一期引入 `systemd` 兼容差异和守护复杂度

### 6.3 Installer Responsibilities

远程安装流程至少负责：

* 创建固定安装目录
* 落地 agent 可执行文件或运行入口
* 落地基础配置文件
* 生成启动脚本
* 使用 `nohup` 启动 agent
* 记录 PID、日志路径、安装版本

### 6.4 Platform Observability

桌面端至少要能知道：

* agent 是否在线
* agent 当前版本
* agent 日志文件位置或最近错误摘要
* 基础进程存活信息

### 6.5 Phase 1 Non-Goals

第一阶段先不做：

* `systemd` service 管理
* 多种守护模式切换
* 复杂崩溃拉起治理
* agent 自升级守护

## 7. Sync Semantics

### 7.1 Manual and Explicit

同步必须是显式动作，不自动在机器接入后全量下发。

### 7.2 Scope

第一阶段同步动作只包含：

* 安装
* 升级
* 配置下发

不包含自动卸载。

### 7.3 Server-Centric Batch Sync

批量同步是单服务器视角：

* 用户先选服务器
* 再看仓条目和该服务器上的安装状态
* 再执行批量同步

### 7.4 Eligibility

只有同时满足以下条件的条目才能进入可分发默认视图：

* 插件显式声明支持远程同步
* 平台条件匹配
* 目标服务器条件匹配
* 标签/策略满足

## 8. Runtime Remote Invocation

### 8.1 Invocation Path

混合型插件通过主程序提供的通用远程调用口执行远端动作：

* 本地插件不直连远端
* 插件传 `machineId + pluginName + action + payload`
* 主程序负责校验、转发、超时和结果归一化

### 8.2 Preconditions

* 必须显式传入 `machineId`
* 目标机器未安装插件时直接报标准错误
* 目标机器版本落后时仍允许调用已安装版本

### 8.3 Config Injection

平台自动注入该机器上已保存的插件配置。`payload` 只表示本次动作参数，不允许覆盖机器配置中的同名字段。

### 8.4 Action Contract

平台先校验：

* action 是否在白名单
* payload 是否满足声明的输入结构

远端返回后，平台继续校验：

* 返回结构是否满足声明的输出结构

### 8.5 Return Model

第一阶段只支持同步请求-响应，不做异步任务和流式输出。

### 8.6 Error Model

平台向插件暴露统一标准错误，而不是透传远端原始文本。

### 8.7 Runtime Logs

运行时远程调用会记录机器级摘要日志，但不默认持久化完整 payload 或完整返回结果。

## 9. Page Responsibility Summary

### Plugin Market

负责发现插件来源和把插件加入远程仓。

### Installed Plugins / Plugin Detail

负责本地插件生命周期，以及从本地插件详情发起单插件“同步到远程”。

### Remote Agent

负责机器接入、机器列表、机器详情、机器维度插件状态、机器-插件配置、同步日志。

### Remote Plugin Warehouse

负责远程仓条目管理、快照版本管理、可更新状态、单服务器批量同步。
