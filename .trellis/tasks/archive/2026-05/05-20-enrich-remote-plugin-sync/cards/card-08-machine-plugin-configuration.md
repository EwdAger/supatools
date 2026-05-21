# Card 08: Machine-Plugin Configuration

## Goal

建立机器-插件配置数据模型和管理入口。

## Scope

* 配置持久化
* 机器详情页配置编辑
* 同步时配置下发
* 运行时调用时自动注入

## Acceptance

* 每台机器可保存独立插件配置
* 同步插件时可自动带配置
* 远程调用时平台自动注入该配置

## Suggested Implementation Steps

1. 定义 `machineId + pluginName` 配置存储模型
2. 设计配置读取/保存 API
3. 明确配置编辑入口和使用入口的分离
4. 把配置注入同步链路
5. 把配置注入运行时调用链路
6. 增加配置存在/缺失/非法的处理策略

## Done Means

* 配置能独立持久化
* 同步与调用都能自动消费同一份配置
* 页面和平台职责一致
