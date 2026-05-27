# brainstorm: remote agent install runtime hooks

## Goal

增强远程 agent 的安装脚本和运行时安装模型：

- 在 Linux 侧优先检测并使用 `systemctl`
- 如果目标环境没有 `systemctl`，再回退到 `nohup`
- 支持由当前代码仓内定义安装后的后置脚本模板，用于执行如 `iptables`、目录准备或系统配置等额外操作

## What I already know

- 当前远程安装脚本由 `src/main/core/remoteAgent/onboardingService.ts` 动态生成
- 现有实现已经具备：
  - 固定 agent 目录
  - PID / log / runtime metadata
  - `nohup` 常驻运行
- 目前还没有：
  - `systemctl` 优先策略
  - 安装后置脚本模板机制
  - 基于平台或场景装配安装脚本片段的能力

## Requirements

- 安装脚本在 Linux 上优先检测 `systemctl`
- 如果检测到 `systemctl`，优先用 service 模式安装和启动 agent
- 如果未检测到 `systemctl`，回退到当前 `nohup` 模型
- 后置脚本采用仓库内静态模板文件管理，不允许直接在配置中写任意 shell 文本
- 平台要能按平台标签自动选择不同的后置脚本模板，而不是让用户手工选择安装 profile
- 这个“平台标签”需要是独立字段，不复用现有 `tagPolicy.tags`；它专门用于安装模板选择，避免和插件分发策略耦合。
- 仓库里必须建立用于选择安装模板的目录结构和至少一个示例模板，避免只新增字段而没有实际模板落点。
- 第一阶段至少支持“无后置脚本”与“单个模板脚本”两种装配路径

## Acceptance Criteria

- [x] 安装脚本具备 `systemctl` 优先 / `nohup` 回退逻辑
- [x] 后置脚本模板机制完成最小设计
- [x] 安装脚本可拼入仓库内模板脚本
- [x] 补足安装脚本与装配逻辑测试

## Out of Scope

- 允许用户在配置中直接输入 shell 片段
- 同时支持多种守护体系并自由切换
- 复杂的脚本参数化 DSL
