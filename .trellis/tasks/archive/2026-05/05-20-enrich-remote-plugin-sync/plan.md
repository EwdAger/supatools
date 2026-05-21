# Execution Plan

## MVP / Phase 2 / Later

### MVP

* 扩展插件元数据：显式声明远程同步能力与运行模型 `static / oneshot / service`
* 建立独立远程插件仓
* 支持从市场加入远程插件仓并固化快照
* 远程 agent Linux 运行时使用 `nohup` 常驻
* agent 提供机器维度的已安装插件列表与状态接口
* 远程服务器管理页展示插件安装情况、版本状态、最近同步时间、最近错误，以及按运行模型适用的状态字段
* 远程服务器管理页提供“机器-插件”配置编辑入口
* 插件页提供单插件 `同步到` 入口，只展示已配置远程服务器
* 远程插件仓页支持单服务器批量同步
* 混合型插件支持通用远程调用平台能力

### Phase 2

* 细化插件状态，例如 `needs_restart`、最近执行结果、更多诊断信息
* 补充远端独立卸载动作
* 增加同步前差异预览或 dry-run
* 完善失败重试、错误分类和日志检索体验
* 为更多插件类型补齐远程同步声明与适配
* 探索更强的远端守护方式或升级策略

### Later

* 多服务器同时批量分发
* 自动定时同步
* 更强的声明式目标状态管理
* 更复杂的远端运行时编排和健康检查
* `systemd` 等更完整守护体系
* agent 自升级或更复杂的远端生命周期管理

## Priority

1. Card 1: Plugin Metadata Contract Upgrade
2. Card 2: Remote Plugin Warehouse Data Model
3. Card 12: Remote Distribution Eligibility Rules
4. Card 3: Market to Warehouse Flow
5. Card 6: Remote Agent Runtime on Linux
6. Card 5: Remote Agent Installed State API
7. Card 8: Machine-Plugin Configuration
8. Card 7: Remote Agent Page Refactor
9. Card 4: Remote Warehouse Page
10. Card 10: Manual Sync Engine Upgrade
11. Card 9: Single Plugin Sync Entry
12. Card 11: Remote Invocation Platform API
13. Card 13: Warehouse Snapshot Update Flow

## Execution Waves

### Wave 1: Contracts and Data Models

**Cards**:

* Card 1: Plugin Metadata Contract Upgrade
* Card 2: Remote Plugin Warehouse Data Model
* Card 12: Remote Distribution Eligibility Rules

**Why first**:

这些卡片定义了所有后续能力的基础契约。如果元数据、仓模型、可分发判定规则不先稳定，页面、agent、调用协议都会反复改。

**Wave Done Means**:

* 插件元数据能表达本地面、远端面、运行模型、远端 action 契约
* 远程插件仓数据结构稳定
* 平台能判断一个条目对某台服务器是否可分发，以及原因是什么

### Wave 2: Warehouse Ingestion and Snapshot Lifecycle

**Cards**:

* Card 3: Market to Warehouse Flow
* Card 13: Warehouse Snapshot Update Flow

**Depends on**:

* Wave 1

**Why second**:

只有先能把真实插件包稳定放进远程仓，后面的仓页、同步、agent 安装才有真实数据源。

**Wave Done Means**:

* 市场可把插件加入远程仓
* 加入时会立即生成仓快照
* 仓条目可显示“已在远程仓 / 可更新”
* 更新仓条目是显式动作

### Wave 3: Remote Agent State and Machine Configuration

**Cards**:

* Card 6: Remote Agent Runtime on Linux
* Card 5: Remote Agent Installed State API
* Card 8: Machine-Plugin Configuration

**Depends on**:

* Wave 1

**Why third**:

仓和同步有了来源之后，还要先拿到“远端现在是什么状态”以及“机器-插件配置怎么存”，否则页面和同步只能靠猜。

**Wave Done Means**:

* agent 能在 Linux 远端以 `nohup` 稳定运行
* agent 能返回机器维度的安装状态
* 平台能保存并读取机器-插件配置
* 运行模型差异化状态能在数据层表达清楚

### Wave 4: Remote Agent Page Refactor

**Cards**:

* Card 7: Remote Agent Page Refactor

**Depends on**:

* Wave 3

**Why fourth**:

远程 Agent 页的小窗交互要收敛成列表 -> 详情结构。这个页面依赖远端状态和机器配置，适合在它们稳定后实现。

**Wave Done Means**:

* 默认列表页成立
* 新增机器和机器详情是独立二级页
* 机器详情能承载安装状态、配置、日志

### Wave 5: Warehouse Page and Server-Centric Batch Sync

**Cards**:

* Card 4: Remote Warehouse Page
* Card 10: Manual Sync Engine Upgrade

**Depends on**:

* Wave 2
* Wave 3

**Why fifth**:

这是远程分发的核心操作面。它要消费远程仓条目、可分发规则、机器状态和配置数据。

**Wave Done Means**:

* 远程插件仓页能展示仓总览
* 选定服务器后能切换到该服务器视角
* 可执行单服务器批量同步
* 同步语义固定为安装、升级、配置下发

### Wave 6: Single Plugin Sync Entry

**Cards**:

* Card 9: Single Plugin Sync Entry

**Depends on**:

* Wave 4
* Wave 5

**Why sixth**:

单插件“同步到远程”是仓页/同步能力在插件详情中的投影。应在底层同步和机器页都稳定后再挂入口。

**Wave Done Means**:

* 插件详情可进入“同步到远程”二级页
* 可选择已配置服务器发起单插件同步
* 不和机器配置编辑职责混淆

### Wave 7: Runtime Remote Invocation Platform

**Cards**:

* Card 11: Remote Invocation Platform API

**Depends on**:

* Wave 1
* Wave 3

**Recommended after**:

* Wave 5

**Why seventh**:

它在业务优先级上很高，但实现复杂度也高。严格来说，它依赖元数据契约和机器状态即可开始；但从风险控制上，最好在“仓 + 同步 + 机器页”闭环成立后再做。

**Wave Done Means**:

* 平台提供统一远程调用口
* 输入输出结构校验成立
* 标准错误模型成立
* 调用摘要日志可查

## Dependency Map

* Card 1 -> Card 2, 3, 5, 11, 12
* Card 2 -> Card 3, 4, 10, 13
* Card 3 -> Card 4
* Card 6 -> Card 5, 7, 10, 11
* Card 5 -> Card 7, 10
* Card 8 -> Card 7, 10, 11
* Card 12 -> Card 4, 10
* Card 4 -> Card 9
* Card 10 -> Card 9

## Parallelism Notes

### Can Parallelize

* Card 1 和远程 Agent 页交互原型细化可以并行
* Card 2 与 Card 5 可以并行推进，因为一个偏仓数据，一个偏远端状态
* Card 7 和 Card 4 可以在 UI 层并行，但最终都依赖统一的数据契约

### Avoid Parallelizing

* Card 10 不应在 Card 12 之前落，因为可分发规则不稳定会导致同步策略返工
* Card 11 不应早于 Card 1，因为 action 契约和入口声明不稳时远程调用 API 会反复改

## Suggested Milestones

### Milestone A: Remote Distribution Foundation

**Contains**:

* Card 1
* Card 2
* Card 3
* Card 12
* Card 13

**User-visible outcome**:

* 插件可以被加入远程插件仓
* 仓条目可显示快照版本和可更新状态
* 平台知道哪些条目理论上可分发

### Milestone B: Remote Machine Management

**Contains**:

* Card 6
* Card 5
* Card 7
* Card 8

**User-visible outcome**:

* 远程 agent 能在 Linux 侧以 `nohup` 常驻运行
* 远程 Agent 页完成小窗友好的列表 -> 详情重构
* 能看机器安装状态
* 能维护机器-插件配置

### Milestone C: Server-Centric Distribution

**Contains**:

* Card 4
* Card 10
* Card 9

**User-visible outcome**:

* 远程插件仓页可选服务器并执行批量同步
* 插件详情可对单插件执行同步到远程

### Milestone D: Hybrid Runtime Invocation

**Contains**:

* Card 11

**User-visible outcome**:

* 混合型插件可从本地控制面发起远端执行并拿到结果

## Recommendation

建议落地顺序：

1. Milestone A
2. Milestone B
3. Milestone C
4. Milestone D

理由：

* A 先定义“什么能分发、分发源在哪里”
* B 再定义“远端现在是什么状态、配置怎么管、agent 怎么稳定运行”
* C 再做“如何真正把东西发出去”
* D 最后才做“运行时远端调用”，因为这是最复杂、最容易把平台能力做重的一层

## Suggested PR Sequence

* PR1: 插件元数据扩展与可同步插件筛选基线
* PR2: 远程插件仓数据模型 + 市场入仓 + 仓快照更新链路
* PR3: 远程 agent Linux 运行时（`nohup`）+ agent 状态接口
* PR4: 远程服务器管理页重构 + 机器-插件配置
* PR5: 远程插件仓页（含单服务器批量同步）
* PR6: 插件详情单插件 `同步到`
* PR7: 混合型插件远程调用平台 API
