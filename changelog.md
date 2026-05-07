# 2.4.2

## 修复 (Fix)

- 修复远程 Agent 功能只生成安装命令但本地未真正提供 onboarding HTTP 服务的问题
- 修复远程 Agent 安装命令访问 `/agent/install/:token.sh` 返回空内容的问题
- 修复远程 Agent 安装脚本未完成注册流程的问题，补齐最小可用 bootstrap agent
- 修复远程 Agent 页面样式与现有设置页交互不一致的问题，调整为接近 HTTP 服务设置页的风格
- 修复全量测试中的既有回归问题，恢复仓库级测试绿灯

## 其他 (Chore)

- 更新包元数据到 fork 仓库 `EwdAger/supatools`

---

# 2.4.1

## 新功能 (Feat)

- 新增 Linux 平台支持（应用启动、系统指令、窗口激活、arm64 构建）（PR [#398](../../pull/398)，感谢 [@YanqingZhang](https://github.com/YanqingZhang) 的贡献 🎉）
- 支持插件内获取及订阅主题相关信息（PR [#415](../../pull/415)，感谢 [@Particaly](https://github.com/Particaly) 的贡献 🎉）
- 新增前往文件夹功能

## 修复 (Fix)

- 修复 Windows 插件目录被占用导致无法删除的问题（PR [#419](../../pull/419)，感谢 [@yg2224](https://github.com/yg2224) 的贡献 🎉）
- 修复开发中插件热更新重载页面时错误地在浏览器打开页面的问题（PR [#418](../../pull/418)，感谢 [@Particaly](https://github.com/Particaly) 的贡献 🎉）
- 修复首次启动托盘图标不显示的问题
- 修复关闭插件视图时未同步关闭所有由该插件创建的独立窗口的问题
- 修复插件升级流程，支持覆盖安装并保留插件数据
- 修复插件创建的子窗口存储数据无命名空间前缀的问题
- 修复 macOS 下双击 Option 键无法作为唤醒快捷键的问题
- 修复某些情况下出现窗口叠层问题
- 修复 node 加载路径错误导致 Windows / macOS 报错的问题
- 修复搜索结果中应用别名与主名称重复显示的问题
- 修复多屏场景下窗口显示错误问题

## 优化 (Optimize)

- 图标获取支持队列，提升并发获取性能

## 重构 (Refactor)

无

## 其他 (Chore)

无

---
