# 远程 Agent 插件同步设计

## 背景

当前项目已经具备本地插件安装、平台过滤、设置页和本地 HTTP 服务等基础能力，但缺少将本地插件同步到远程 Linux 机器的标准流程。目标是让桌面端成为编排方，远程 Linux 机器运行独立 agent，接收本地下发的插件和运行前配置。

本设计聚焦以下问题：

- 为插件新增标签能力，支持按标签筛选可部署插件
- 在设置中管理远程机器
- 通过人工执行安装命令的方式，让远程 Linux 机器接入本地桌面端
- 按平台和标签策略将本地插件同步到远程 agent
- 支持按“机器-插件”维度保存并下发运行前配置

## 目标

- 为插件元数据增加 `tags` 支持，并保留现有 `platform` 机制
- 在设置页新增独立的“远程 Agent”管理入口
- 本地创建待接入机器后，生成 `curl http://本机IP:端口/... | sh` 形式的一次性安装命令
- 本地提供临时 onboarding service，用于安装脚本分发和 agent 首次注册
- 远程 Linux agent 完成注册后在设置页显示在线状态
- 按 `platform=linux` 和机器标签策略筛选可部署插件
- 支持对单个远程机器执行插件全量同步
- 支持保存并下发单插件运行前配置
- 记录基础同步日志，便于查看失败原因

## 非目标

- 不实现 SSH / SCP / 远程终端直连安装
- 不依赖 DNS、公网域名或公网穿透
- 不实现多机器批量编排
- 不实现自动定时同步
- 不实现声明式部署模型
- 不实现配置 schema 驱动的动态表单
- 不实现 agent 自升级或插件回滚

## 总体架构

桌面端是唯一编排方，负责远程机器定义、插件筛选、安装命令生成、agent 首次注册、插件部署和配置下发。远程 Linux agent 只负责：

- 报告自身状态
- 接收插件安装请求
- 接收插件运行前配置
- 执行插件重启或卸载

标签和平台决策统一在桌面端完成，远程 agent 不参与标签判断，避免规则分散在两端。

远程机器接入采用两阶段模式：

1. 本地先创建一台 `pending` 机器，填写名称、平台和标签策略，并选择本机发布地址
2. 本地生成一次性安装命令，用户在远程 Linux 机器执行后完成 agent 安装和注册

## 插件元数据设计

### plugin.json 扩展

在现有插件元数据基础上新增可选字段：

- `platform`: 继续沿用现有字段，表示插件支持的平台列表，例如 `["linux"]`
- `tags`: 新增字段，表示插件标签列表，例如 `["scp", "hci"]`

### 本地已安装插件记录

安装、市场安装、开发插件导入和内置插件加载时，都需要把 `platform` 和 `tags` 一并持久化到本地 `plugins` 数据中。这样设置页、插件市场和远程部署逻辑都可以直接使用同一份元数据，而不需要每次重新读取磁盘上的 `plugin.json`。

## 远程机器数据模型

本地数据拆分为三类文档，避免把远程机器主记录、部署配置和运行日志混在一起。

### `settings-remote-agents`

保存远程机器主记录：

- `id`: 机器唯一标识
- `name`: 机器名称
- `platform`: 一期固定为 `linux`
- `tagPolicy`: 机器允许接收的标签策略
- `status`: `pending | onboarding | online | offline | error`
- `onboardingToken`: 当前接入 token
- `onboardingExpiresAt`: token 过期时间
- `selectedLocalAddress`: 用户为该机器选定的本机局域网地址
- `agentBaseUrl`: agent 注册后的正式访问地址
- `agentVersion`: agent 版本
- `lastSeenAt`: 最近一次健康检查时间
- `lastError`: 最近错误信息

### `settings-remote-agent-plugin-configs`

保存“机器-插件”维度的运行前配置：

- `machineId`
- `pluginName`
- `config`
- `updatedAt`

同一个插件在不同机器上可以拥有不同配置，不污染本地插件本身。

### `settings-remote-agent-sync-jobs`

保存同步或部署日志：

- `machineId`
- `pluginName`
- `action`
- `status`
- `message`
- `startedAt`
- `finishedAt`

该文档用于设置页展示最近部署结果和失败原因。

## 远程机器接入流程

### 创建待接入机器

用户在设置页新增远程机器时，先填写：

- `机器名称`
- `平台`，一期固定为 `linux`
- `标签策略`
- `本机发布地址`，从本地探测到的局域网 IP 中选一个

保存后，桌面端生成：

- `machineId`
- 一次性 `token`
- `token` 过期时间
- 临时安装服务地址和端口

机器状态初始为 `pending`。

### 安装命令

安装命令固定为本机局域网 IP，不依赖 DNS：

```bash
curl -fsSL http://192.168.1.23:37121/agent/install/<token>.sh | sh
```

设置页需要明确提示：

- 命令是一次性的
- token 过期后需要重新生成
- 如果远程机无法访问当前地址，用户可以切换本机 IP 后重新生成命令

### 远程注册

远程机器执行安装命令后：

1. 下载安装脚本
2. 安装脚本下载 Linux agent 二进制或包
3. 安装脚本写入初始参数，例如 `machineId`、`token` 和本地 onboarding service 地址
4. 启动 agent
5. agent 调用桌面端注册接口完成首次绑定

桌面端校验 token、目标平台和过期时间，注册成功后：

- 将机器状态切为 `online`
- 保存 `agentBaseUrl`
- 保存 `agentVersion`
- 写入 `lastSeenAt`
- 立即使当前 token 失效

## Onboarding Service 设计

不复用现有第三方控制用 `HTTP 服务`，新增独立的 `agent onboarding service`。原因如下：

- 现有服务只监听 `127.0.0.1`
- 现有服务职责是控制桌面端窗口，不适合承担远程接入职责
- 接入逻辑需要独立 token、安全边界和生命周期

### 生命周期

- 默认关闭
- 仅在存在 `pending` 或 `onboarding` 机器时启动
- 注册成功或 token 全部过期后尽量停止

### 监听策略

- 监听 `0.0.0.0:<ephemeralPort>` 或用户显式选择的端口
- 设置页展示当前发布地址和端口，供用户复制安装命令

### 接口

- `GET /agent/install/:token.sh`
  - 返回按当前机器信息生成的安装脚本
- `POST /agent/register`
  - agent 首次注册
- `GET /agent/ping/:token`
  - 可选，用于安装脚本预检本地服务是否可达

### 安全约束

- token 一次性、短时有效
- token 绑定 `machineId` 和 `platform=linux`
- 注册成功后立即作废
- 不在该服务中暴露插件同步接口

## 远程 Agent 正式 API

agent 完成注册后，日常通信走 agent 自己的 HTTP API。第一版接口控制在最小集合：

- `GET /api/agent/info`
  - 返回机器 ID、平台、agent 版本、健康状态
- `GET /api/plugins`
  - 返回远程已安装插件清单和版本
- `POST /api/plugins/install`
  - 安装或升级插件
- `POST /api/plugins/configure`
  - 写入插件运行前配置
- `POST /api/plugins/restart`
  - 重启插件
- `POST /api/plugins/uninstall`
  - 卸载插件

第一版不引入 `POST /api/sync/apply` 这种批量编排接口。桌面端显式调用 `install -> configure -> restart`，这样调试和错误定位最直接。后续若协议稳定，再考虑收敛成批量同步接口。

## 插件筛选与同步流程

### 可部署插件筛选

桌面端读取本地已安装插件后，依次做两层过滤：

1. `platform` 必须包含 `linux`
2. 插件 `tags` 必须符合目标机器的 `tagPolicy`

未通过过滤的插件不进入该机器的可部署列表，设置页需明确展示为“被策略排除”。

### 部署流程

对单台远程机器执行“全量同步插件”时：

1. 拉取远程机器当前插件清单
2. 计算本地目标插件集合
3. 对缺失插件执行安装
4. 对版本不同插件执行升级
5. 对有运行前配置的插件下发配置
6. 配置更新后按需重启插件
7. 根据策略决定是否卸载远程多余插件

第一版允许“全量同步”以手动触发为主，不做自动调度。

### 运行前配置

运行前配置保存在本地 `settings-remote-agent-plugin-configs` 中。同步时按 `machineId + pluginName` 查找并下发。配置状态和安装状态分别展示，避免“插件已安装但配置失败”被误判为整体成功。

## 设置页交互设计

新增独立的“远程 Agent”设置页，不塞进现有 “WebDAV 同步” 或 “HTTP 服务” 页面。

### 机器列表

展示：

- `名称`
- `平台`
- `状态`
- `最近在线时间`
- `标签策略`

支持操作：

- `新增机器`
- `重新生成安装命令`
- `查看 agent 信息`
- `同步插件`
- `编辑标签策略`
- `删除机器`

### 接入面板

新增机器时展示：

- `机器名称`
- `平台`
- `标签策略`
- `本机发布地址`

创建后展示：

- 安装命令
- token 过期时间
- 当前发布地址和端口
- 复制命令按钮

### 机器详情

展示：

- `agentVersion`
- `agentBaseUrl`
- `lastSeenAt`
- `lastError`
- 远程已安装插件数

并展示可部署插件列表，每个插件显示：

- 版本
- 标签
- 是否已部署
- 配置状态

支持操作：

- 单插件配置运行前参数
- 单插件部署
- 全量同步
- 查看最近同步日志

## 错误处理

- token 过期：允许一键重新生成安装命令
- 本机地址不可达：允许切换本机 IP 后重新发布
- 重复注册：如果 `machineId` 已存在，仅允许“重新接入”
- 插件不匹配平台或标签：明确显示为策略排除
- 配置下发失败：安装状态和配置状态分开显示
- 部分插件同步失败：整机同步结果标记为 `partial_success`

## 一期范围

### 一期包含

- 插件 `tags` 元数据支持
- 设置页新增“远程 Agent”页面
- 本地创建 `pending` 机器
- 生成 `curl http://本机IP:端口/... | sh` 安装命令
- 独立 onboarding service
- agent 首次注册
- 远程机器状态展示
- 按 `platform + tags` 过滤插件
- 单机器手动全量同步
- 单插件运行前配置保存与下发
- 基础同步日志

### 一期不包含

- 多机器批量编排
- 自动定时同步
- 声明式部署
- SSH / 远程终端安装
- DNS / 公网穿透
- 配置 schema 动态表单
- 一键回滚
- agent 自升级编排

## 验收标准

- 本地可以创建一台 Linux 远程机器并生成安装命令
- 远程机器执行安装命令后可以成功注册，并在设置页显示为 `online`
- 一个 `platform` 包含 `linux` 且标签匹配的本地插件可以同步到远程机器
- 同一个插件可以为不同机器保存不同运行前配置
- 标签不匹配的插件不会出现在该机器的可部署列表中
