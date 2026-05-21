# Card 05: Remote Agent Installed State API

## Goal

让 agent 提供机器维度的插件安装状态事实来源。

## Scope

* 已安装插件列表
* 已安装版本
* 运行模型相关状态字段
* 最近错误 / 最近同步 / 配置状态等摘要字段

## Acceptance

* 平台可查询某台机器当前已安装插件列表
* `static / oneshot / service` 三类插件状态可正确区分
* 机器详情页可完全依赖该接口展示远端状态

## Suggested Implementation Steps

1. 定义 agent 返回的已安装插件状态结构
2. 定义平台侧状态读取接口
3. 明确三类运行模型需要返回的最小字段
4. 增加状态归一化层
5. 明确错误和空状态处理
6. 增加接口契约测试与样例数据

## Done Means

* 平台可稳定拿到机器维度安装状态
* 三类运行模型字段边界清楚
* 机器详情页可以直接消费该接口
