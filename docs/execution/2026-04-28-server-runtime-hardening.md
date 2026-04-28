# 服务器运行时加固

## 状态

已实现并验证。待提交。

## 目标

提升轻量级 SecretRoy 同步服务器在弱单机部署场景下的稳健性，
同时不引入集群、数据库服务或额外基础设施。

重点是运行安全：异常运行路径、过大的 vault 文件、中断写入、
陈旧临时文件、需要配置入口的宽松运行默认值、缓慢或半开的 HTTP
连接，以及不必要的依赖面。

## 范围

包含：

- 运行时数据目录解析和启动时可写性检查。
- 在解析和写入前限制已存储 vault JSON 文件的最大大小。
- 使用临时文件、`fsync` 和 `.bak` 恢复机制提升原子 vault 写入的可靠性。
- 启动时清理陈旧的 `vault_*.json.<pid>.tmp` 文件。
- 通过 `CORS_ORIGIN` 支持可选的 CORS origin 允许列表。
- 为 Node HTTP 请求、请求头、keep-alive 和优雅停机设置有界超时。
- 清理未使用的 `sqlite3` 和 `ws` 依赖。
- 清理 `.gitignore` 编码。
- 更新 README，并补充聚焦测试。

不包含：

- 集群协调。
- 外部数据库迁移。
- 认证或授权模型变更。
- 现有同步和配对路由的协议形态变更。

## 变更

代码：

- 增加 `DATA_DIR` 支持，并执行路径规范化。
- 增加数据目录存在性、目录类型和写入探测校验。
- 增加 `MAX_VAULT_FILE_BYTES`，并在读取和写入时执行限制。
- 保留 vault push 的乐观并发行为。
- 增加更持久的临时文件写入和尽力而为的目录 `fsync`。
- 在 app 创建时清理陈旧的临时 vault 文件。
- 增加可配置 CORS 中间件，同时保持未配置时的开发默认宽松策略。
- 通过 `REQUEST_TIMEOUT_MS`、`HEADERS_TIMEOUT_MS`、
  `KEEP_ALIVE_TIMEOUT_MS` 和 `SHUTDOWN_TIMEOUT_MS` 增加服务器超时配置。
- 使停机流程具备幂等性，避免重复处理信号。

测试：

- 增加超大 vault 读取拒绝测试。
- 增加超大 vault 写入拒绝和 HTTP `413` 路由覆盖。
- 增加陈旧临时文件清理行为测试。
- 增加数据路径类型校验测试。
- 增加 HTTP 超时配置行为测试。

文档：

- 更新 `README.md`，补充新的环境变量、限制和加固说明。
- 在 `docs/execution/` 下新增本执行记录。
- 新增 `docs/execution/README.md`，作为后续执行记录约定。

依赖：

- 从 `package.json` 和 `package-lock.json` 移除未使用的 `sqlite3` 和 `ws`。
- 执行 `npm prune --ignore-scripts`，使本地 `node_modules` 与 manifest 保持一致。

仓库卫生：

- 检测到 `.gitignore` 内嵌 NUL 字节后，将其重写为普通文本。

## 验证

执行过的命令：

```bash
node --test
npm.cmd test
git diff --check
npm.cmd ls --depth=0
```

结果：

- `node --test`：26 个测试通过。
- `npm.cmd test`：26 个测试通过。
- `git diff --check`：无空白错误；仅有 Windows CRLF 转换提示。
- `npm.cmd ls --depth=0`：仅保留 `cors`、`express` 和 `nodemon`。

说明：`npm.cmd test` 最初在普通沙箱中因 `spawn EPERM` 失败；
使用已批准的提升权限命令重跑后通过。

## 风险说明

- 默认 `MAX_VAULT_FILE_BYTES` 为 `128mb`，刻意大于常规加密同步载荷，
  但仍可避免进程解析异常大的 JSON 文件。
- `CORS_ORIGIN` 是可选配置。未设置时，服务器仍保持适合本地开发和移动端测试的宽松策略。
- 目录 `fsync` 是尽力而为，因为不同平台支持程度不同。临时载荷文件在 rename 前仍会执行文件 `fsync`。
- 当前代码和测试均未导入 `sqlite3` 或 `ws`，因此移除这些依赖对现有代码库是安全的。

## 后续工作

- 未来每个功能、安全改进或加固任务都新增一份执行记录。
- 如果服务器面向公网，补充反向代理 TLS、origin 允许列表和进程守护的部署指南。
- 如果运维监控需要在启动后发现数据目录故障，可考虑增加一个轻量的 `/healthz` 持久化检查模式。
