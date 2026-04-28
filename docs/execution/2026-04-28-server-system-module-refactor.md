# 服务器 system 模块重构

## 状态

已实现并验证。待提交。

## 目标

落实项目代码组织规则：文件应尽量遵循单一职责，具体实现细节集中放在 `system/` 目录下。

此前的 `index.js` 混合了配置、校验、vault 存储、同步状态转换、配对会话逻辑、
HTTP 中间件、路由处理、服务器启动和公开导出。本次重构保持外部入口稳定，
同时将职责迁移到聚焦模块中。

## 范围

包含：

- 保留 `index.js` 作为进程入口和兼容导出面。
- 将运行时常量迁移到 `system/config.js`。
- 将环境选项解析迁移到 `system/options.js`。
- 将领域错误迁移到 `system/errors.js`。
- 将共享日志迁移到 `system/logger.js`。
- 将随机 id helper 迁移到 `system/ids.js`。
- 将安全 id 校验迁移到 `system/validation.js`。
- 将 vault 文件持久化拆到 `system/vault/` 下的聚焦模块。
- 将同步冲突和 push 校验逻辑拆到 `system/sync/` 下的聚焦模块。
- 将配对会话和配对码规则拆到 `system/pairing/` 下的聚焦模块。
- 将 HTTP 中间件和错误响应行为拆到 `system/http/` 下的聚焦模块。
- 将 API 路由注册迁移到 `system/routes/`。
- 将 Express app 组装迁移到 `system/app.js`。
- 将服务器启动、超时和停机处理迁移到 `system/server.js`。
- 更新 README 的源码布局说明。
- 新增 `system/README.md` 职责地图，供后续服务器变更参考。
- 在初次抽取 `system/` 后，继续将较宽的 vault 和 HTTP 模块拆成更窄的子模块。
- 将 pairing helper 拆成 TTL、code、session store、authorization 和 timestamp 模块。
- 将 sync helper 拆成 since-version、push-validation、conflict 和 state-transition 模块。
- 将 pairing 路由处理拆成 `system/routes/pairing/` 下每个端点流程一个文件。

不包含：

- 修改同步、配对、持久化或限流行为。
- 重命名公开 API 路由。
- 将测试导入从 `index.js` 改到其他文件。
- 引入构建步骤或框架。

## 变更

代码：

- 将单体 `index.js` 替换为小入口：直接执行时启动服务器，并重新导出测试使用的函数。
- 新增按主要职责分组的 `system/` 模块。
- 新增 `system/routes/system_routes.js`、`system/routes/vault_routes.js`、
  `system/routes/pairing/*_route.js` 以及注册入口。
- 新增 `system/vault/` 模块，分别处理目录、路径、文档规范化、文件限制、
  原子 JSON 写入、持久化和清理。
- 新增 `system/http/` 模块，分别处理 request id、安全响应头、CORS、
  限流、JSON body 检查、请求日志和错误响应。
- 新增 `system/pairing/` 模块，分别处理 TTL 解析、配对码、会话存储、
  所有权检查和时间戳格式化。
- 新增 `system/sync/` 模块，分别处理 since-version 解析、push 校验、
  冲突响应和乐观并发状态转换。
- 保留现有 CommonJS 模块风格和无需构建的 Node 运行方式。

文档：

- 更新 `README.md`，新增源码布局章节。
- 新增 `system/README.md`，说明模块职责规则。
- 新增本执行记录。

测试：

- 未修改测试行为。
- 现有测试继续调用公开的 `index.js` 导出面。

## 验证

执行过的命令：

```bash
node --test
npm.cmd test
git diff --check
```

结果：

- `node --test`：拆分后 26 个测试通过。
- `npm.cmd test`：进一步拆分 `system/` 后 26 个测试通过。
- `git diff --check`：无空白错误；仅有 Windows CRLF 转换提示。

## 风险说明

- 本次重构刻意保留 `index.js` 的公开导出，以减少测试和本地工具的变更面。
- 路由行为通过移动 handler 保持不变，没有修改路径、响应形态或校验消息。
- 新的 `system/` 布局让后续功能执行记录更容易映射到具体职责区域。

## 后续工作

- 未来服务器实现文件默认放入 `system/`。
- 新增路由模块时按 API 领域添加，不继续堆到 `index.js`。
- 如果后续某些 `system/` 模块比当前路由级覆盖更复杂，可考虑为选定模块增加直接单元测试。
