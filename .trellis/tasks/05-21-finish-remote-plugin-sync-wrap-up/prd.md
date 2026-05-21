# bookkeeping: finish remote plugin sync wrap-up

## Goal

在非 `main` 分支上完成上一个任务的 Trellis 收尾：处理 `.trellis` 下的任务归档和 journal 更新，补齐缺失的 bookkeeping 提交，同时不纳入无关的未识别文件。

## Requirements

* 创建并切换到非 `main` 分支
* 只处理 `.trellis` 下与任务归档、session journal 相关的变更
* 不提交 `.agents/`、`.claude/`、`.codex/`、`.opencode/`、`AGENTS.md`
* 完成后工作区中不再残留这次收尾需要的 `.trellis` 改动

## Acceptance Criteria

* [ ] 已切换到非 `main` 分支
* [ ] 归档与 journal 相关 `.trellis` 变更完成提交
* [ ] 无关脏文件未被纳入提交

## Out of Scope

* 功能代码修改
* 重新开启远程插件同步开发
