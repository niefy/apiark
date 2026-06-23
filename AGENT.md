# AGENT.md

AI 开发索引 — 供 AI 助手快速理解项目结构、定位代码、执行开发任务。

## 项目概述

ApiArk 是一个 Local-first API 开发平台，基于 Tauri v2（Rust 后端 + React 前端）。支持 REST、GraphQL、gRPC、WebSocket、SSE、MQTT、Socket.IO 协议。数据以纯 YAML 文件存储在本地文件系统，无云依赖。

## Monorepo Structure

```
apiark/
├── apps/
│   ├── desktop/           # Tauri v2 desktop app (main product)
│   │   ├── src/           # React frontend (TypeScript)
│   │   └── src-tauri/     # Rust backend
│   ├── cli/               # CLI tool (Rust) — run collections from terminal
│   ├── mcp-server/        # MCP server (Rust) — AI editor integration
│   ├── vscode-extension/  # VS Code extension (TypeScript)
│   └── web/               # Marketing site (Next.js)
├── packages/
│   ├── types/             # Shared TypeScript types (@apiark/types)
│   └── importer/          # Collection importers (@apiark/importer)
└── docs/                  # Documentation and legal
```

Managed by pnpm workspaces + Turborepo. The `pnpm-workspace.yaml` includes `apps/*` and `packages/*`.

## Common Commands

### Development

```bash
pnpm install              # Install all dependencies
pnpm dev                  # Run desktop app in dev mode (Vite + Tauri)
pnpm tauri dev            # Same as above (alias via pnpm --filter)
```

### Build

```bash
pnpm build                # Build desktop for production (tsc + vite build)
pnpm tauri build          # Full Tauri build (frontend + Rust binary)
```

### Lint & Type Check

```bash
pnpm lint                 # ESLint (frontend)
pnpm -C apps/desktop exec tsc --noEmit   # TypeScript check
```

### Tests

```bash
# Frontend (Vitest)
pnpm --filter @apiark/desktop test          # Run once
pnpm --filter @apiark/desktop test:watch    # Watch mode

# Rust (desktop backend)
cd apps/desktop/src-tauri && cargo test

# Rust (CLI)
cd apps/cli && cargo test
```

### Rust Quality

```bash
cd apps/desktop/src-tauri
cargo clippy -- -W warnings    # Lint
cargo fmt -- --check           # Format check
cargo bench                    # Run criterion benchmarks
```

## Architecture

### Frontend (apps/desktop/src/)

- **React 19** + **TypeScript** + **Vite 6** + **Tailwind CSS 4**
- **State**: Zustand stores in `src/stores/` — each domain has its own store (tabs, collections, settings, etc.)
- **IPC**: All Rust calls go through `src/lib/tauri-api.ts` which wraps `@tauri-apps/api` invoke calls
- **Components**: Organized by domain in `src/components/` (request, response, grpc, websocket, etc.)
- **Routing**: No router — single-page app with tab-based navigation managed by `tab-store.ts`
- **i18n**: react-i18next with locale files in `src/locales/`
- **UI**: Radix UI primitives + Tailwind + class-variance-authority. Lucide icons.
- **Editor**: Monaco Editor for request bodies, scripts, and OpenAPI specs
- **Lazy loading**: Dialogs are lazy-loaded via `React.lazy()` in `App.tsx`

### Backend (apps/desktop/src-tauri/src/)

- **Tauri v2** with Rust. Entry point: `main.rs` → `lib.rs::run()`
- **Commands**: `src/commands/` — each file exposes `#[tauri::command]` functions that the frontend invokes
- **Modules**: Domain logic in `src/{http,grpc,websocket,sse,mqtt,mock,proxy,runner,scheduler,scripting,plugins,...}/`
- **Models**: `src/models/` — shared Rust types (request, response, auth, errors)
- **Storage**: `src/storage/` — SQLite via rusqlite for history/audit, JSON for settings/state, filesystem for collections
- **Scripting**: `src/scripting/` — QuickJS (rquickjs) engine for pre/post-request scripts. JS API defined in `ark_api.js`
- **State management**: Tauri's managed state (`app.manage()`) with `Arc<Mutex<T>>` for shared state

### Data Format

Requests are YAML files on disk. Collections are directories. Example:

```yaml
name: Create User
method: POST
url: "{{baseUrl}}/api/users"
auth:
  type: bearer
  token: "{{adminToken}}"
body:
  type: json
  content: '{"name": "{{userName}}"}'
assert:
  status: 201
tests: |
  ark.test("should return created user", () => {
    const body = ark.response.json();
    ark.expect(body).to.have.property("id");
  });
```

### IPC Pattern

Frontend → Rust communication follows this pattern:

1. Frontend calls a function from `src/lib/tauri-api.ts`
2. That function calls `invoke("command_name", { args })` from `@tauri-apps/api`
3. Rust `#[tauri::command]` in `src/commands/` handles the call
4. Business logic lives in the corresponding module

### Shared Packages

- `@apiark/types` — TypeScript interfaces/types used by frontend and importer
- `@apiark/importer` — Import logic for Postman, Insomnia, Bruno, Hoppscotch, OpenAPI, HAR, cURL

## Key Technical Decisions

- **Tauri v2 over Electron**: ~60MB RAM vs 300-800MB. Native OS webview.
- **YAML over JSON for collections**: Human-readable, git-diffable, comment-friendly
- **SQLite for history/audit**: Local DB at `~/.apiark/data.db` and `~/.apiark/audit.db`
- **QuickJS for scripting**: Lightweight JS engine embedded in Rust, no Node.js dependency
- **rquickjs** (not deno_core): Smaller binary, simpler embedding for user scripts

## Prerequisites

- Node.js 22+
- pnpm 10+
- Rust toolchain (stable)
- Tauri v2 system deps (platform-specific: webkit2gtk on Linux, etc.)

## CI

GitHub Actions workflows in `.github/workflows/`:

- `ci.yml` — Frontend lint/typecheck + Rust check/clippy/fmt/test + benchmarks on main push
- `release.yml` — Build release binaries
- `nightly.yml` — Nightly builds
- `benchmarks.yml` — Performance benchmarks
- `package-managers.yml` — Package manager integration tests

---

## AI 开发索引（快速定位）

### 前端关键文件

| 文件 | 用途 |
|------|------|
| `src/App.tsx` | 根组件，路由/布局入口，Dialog lazy-load |
| `src/main.tsx` | 应用入口 |
| `src/lib/tauri-api.ts` | **IPC 总入口** — 所有 Rust 调用封装在此，新增后端功能必改 |
| `src/stores/*.ts` | Zustand 状态管理（tab、collection、environment、history、settings 等 18 个 store） |
| `src/locales/*.json` | 国际化文件（zh/en/ja/ko/de/fr/es/ar/pt） |
| `src/hooks/*.ts` | 自定义 hooks（WebSocket、SSE、MQTT、auto-save 等） |
| `src/lib/utils.ts` | 工具函数 |
| `src/lib/code-generators.ts` | 代码生成（cURL、fetch、axios 等） |
| `src/styles/tokens.ts` | 设计 tokens（颜色、间距等） |

### 前端组件目录（src/components/）

| 目录 | 功能域 |
|------|--------|
| `request/` | 请求编辑面板（url-bar、key-value-editor、curl-import、save-as） |
| `response/` | 响应展示（response-panel、test-results、timing、code-generation、diff） |
| `grpc/` | gRPC 客户端视图 |
| `websocket/` | WebSocket 客户端视图 |
| `sse/` | SSE 客户端视图 |
| `mqtt/` | MQTT 客户端视图 |
| `socketio/` | Socket.IO 客户端视图 |
| `graphql/` | GraphQL 视图 |
| `collection/` | 集合侧边栏（sidebar、tree、cookie-jar） |
| `environment/` | 环境变量选择器 |
| `history/` | 历史记录面板 |
| `runner/` | 集合运行器（collection-runner、run-results-table） |
| `settings/` | 设置对话框 |
| `ai/` | AI 助手对话框 |
| `proxy/` | 代理抓包面板 |
| `mock/` | Mock 服务器管理 |
| `scheduler/` | 监控/定时任务 |
| `git/` | Git 版本控制面板 |
| `audit/` | 审计日志面板 |
| `console/` | 控制台面板 |
| `terminal/` | 终端面板 |
| `layout/` | 布局组件（activity-bar、bottom-panel、breadcrumb、side-panel、status-bar） |
| `tabs/` | 标签栏 |
| `ui/` | 通用 UI 原子组件（code-editor、empty-state、toast 等） |
| `import/` | 导入对话框 |
| `openapi/` | OpenAPI 编辑器 |
| `plugins/` | 插件管理 |
| `docs/` | API 文档预览 |
| `command-palette/` | 命令面板 |
| `onboarding/` | 新手引导 |

### 后端关键文件

| 文件 | 用途 |
|------|------|
| `main.rs` | 入口点，调用 `lib.rs::run()` |
| `lib.rs` | **核心注册** — Tauri Builder、state 管理、command 注册、插件初始化 |
| `commands/mod.rs` | 命令模块汇总 |
| `commands/http.rs` | HTTP 请求相关 commands（send_request 等） |
| `commands/collection.rs` | 集合 CRUD commands |
| `commands/environment.rs` | 环境变量 commands |
| `commands/history.rs` | 历史记录 commands |
| `commands/settings.rs` | 设置 commands |
| `commands/runner.rs` | 集合运行器 command |
| `commands/ai.rs` | AI 功能 commands |
| `commands/git.rs` | Git 操作 commands |
| `commands/grpc.rs` | gRPC commands |
| `commands/websocket.rs` | WebSocket commands |
| `commands/sse.rs` | SSE commands |
| `commands/mqtt.rs` | MQTT commands |
| `commands/proxy.rs` | 代理抓包 commands |
| `commands/mock.rs` | Mock 服务器 commands |
| `commands/terminal.rs` | 终端 commands |

### 后端模块目录

| 目录 | 功能域 |
|------|--------|
| `http/` | HTTP 客户端、请求构建、响应解析、cURL 解析、cookie、认证、插值 |
| `grpc/` | gRPC 客户端、proto 解析、reflection |
| `websocket/` | WebSocket 连接管理器 |
| `sse/` | SSE 客户端 |
| `mqtt/` | MQTT 客户端 |
| `mock/` | Mock 服务器实现 |
| `proxy/` | 代理抓包、CA 证书生成 |
| `runner/` | 集合运行器、数据读取器 |
| `scheduler/` | 定时监控 |
| `scripting/` | QuickJS 脚本引擎、断言库 |
| `plugins/` | 插件管理器、JS 插件运行时 |
| `storage/` | SQLite（history/audit）、JSON（settings/state）、集合文件系统 |
| `oauth/` | OAuth 回调与流程 |
| `watcher/` | 集合文件监控 |
| `importer/` | 集合导入（Postman/Insomnia/Bruno/Hoppscotch/OpenAPI/HAR） |
| `exporter/` | 集合导出（Postman/Insomnia/Bruno/OpenAPI/ApiArk） |
| `docs/` | API 文档生成 |
| `models/` | 共享数据模型（request/response/auth/error/collection/environment） |

### IPC 完整命令列表

所有前后端通信通过 `src/lib/tauri-api.ts` → `invoke()` → Rust `#[tauri::command]`。按功能域分组：

- **HTTP**: `send_request`, `send_request_with_scripts`, `read_full_response`
- **集合**: `open_collection`, `read_request_file`, `save_request_file`, `create_request`, `create_folder`, `delete_item`, `rename_item`, `save_folder_order`, `create_sample_collection`, `create_collection`, `get_collection_defaults`, `update_collection_defaults`
- **迁移**: `check_collection_version`, `migrate_collection`
- **备份**: `export_app_state`, `import_app_state`
- **环境**: `load_environments`, `save_environment`, `get_resolved_variables`, `load_root_dotenv`
- **历史**: `get_history`, `search_history`, `clear_history`, `delete_history_entry`
- **cURL**: `parse_curl_command`, `export_curl_command`
- **状态持久化**: `load_persisted_state`, `save_persisted_state`
- **Runner**: `run_collection_command`
- **WebSocket**: `ws_connect`, `ws_send`, `ws_disconnect`
- **SSE**: `sse_connect`, `sse_disconnect`, `sse_is_connected`
- **OAuth**: `oauth_start_flow`, `oauth_get_token_status`, `oauth_clear_token`
- **导入导出**: `detect_import_format`, `import_preview`, `import_collection`, `import_environment`, `export_collection`, `download_import_url`
- **设置**: `get_settings`, `update_settings`
- **监控**: `watch_collection`, `unwatch_collection`
- **gRPC**: `grpc_load_proto`, `grpc_call_unary`, `grpc_call_server_stream`, `grpc_call_client_stream`, `grpc_call_bidi_stream`, `grpc_disconnect`
- **Cookie**: `get_cookie_jar`, `delete_cookie`, `clear_cookie_jar`
- **Mock**: `start_mock_server`, `stop_mock_server`, `list_mock_servers`
- **文档**: `generate_docs`, `preview_docs`
- **定时**: `create_monitor`, `delete_monitor`, `toggle_monitor`, `list_monitors`, `get_monitor_results`
- **回收站**: `list_trash`, `restore_from_trash`, `empty_trash`
- **License**: `get_license_status`, `activate_license`, `deactivate_license`
- **窗口**: `open_new_window`
- **Socket.IO**: `socketio_build_url`
- **MQTT**: `mqtt_connect`, `mqtt_subscribe`, `mqtt_publish`, `mqtt_disconnect`
- **代理**: `proxy_start`, `proxy_stop`, `proxy_status`, `proxy_get_captures`, `proxy_clear_captures`, `proxy_set_passthrough`, `proxy_generate_ca`, `proxy_get_ca_cert`, `proxy_ca_exists`
- **插件**: `list_plugins`, `toggle_plugin`, `uninstall_plugin`, `install_plugin`
- **AI**: `ai_chat`, `ai_generate_request`, `ai_generate_tests`
- **审计**: `audit_get_logs`, `audit_clear`, `audit_log_action`
- **终端**: `terminal_create`, `terminal_write`, `terminal_resize`, `terminal_close`
- **更新**: `list_rollback_versions`, `backup_current_binary`, `clear_backups`, `get_install_type`
- **Git**: `git_status`, `git_stage`, `git_unstage`, `git_commit`, `git_push`, `git_pull`, `git_diff`, `git_log`, `git_init`

### Zustand Store 速查

| Store | 文件 | 职责 |
|-------|------|------|
| tab-store | `stores/tab-store.ts` | 标签页管理（打开/关闭/切换/拖拽） |
| collection-store | `stores/collection-store.ts` | 集合树数据、展开状态、选中项 |
| environment-store | `stores/environment-store.ts` | 环境变量、当前活跃环境 |
| history-store | `stores/history-store.ts` | 历史记录 |
| settings-store | `stores/settings-store.ts` | 应用设置 |
| runner-store | `stores/runner-store.ts` | 集合运行状态与结果 |
| console-store | `stores/console-store.ts` | 控制台日志 |
| diff-store | `stores/diff-store.ts` | 响应对比 |
| docs-store | `stores/docs-store.ts` | API 文档预览 |
| git-store | `stores/git-store.ts` | Git 操作状态 |
| license-store | `stores/license-store.ts` | License 状态 |
| mock-store | `stores/mock-store.ts` | Mock 服务器状态 |
| monitor-store | `stores/monitor-store.ts` | 定时监控状态 |
| proxy-store | `stores/proxy-store.ts` | 代理抓包状态 |
| audit-store | `stores/audit-store.ts` | 审计日志 |
| shortcuts-store | `stores/shortcuts-store.ts` | 快捷键配置 |
| toast-store | `stores/toast-store.ts` | Toast 通知队列 |
| undo-store | `stores/undo-store.ts` | 撤销/重做栈 |

### 典型开发任务路径

#### 新增一个前端功能

1. 在 `src/lib/tauri-api.ts` 添加对应的 invoke 封装函数
2. 在对应 store（`src/stores/`）添加状态与 action
3. 在 `src/components/` 对应目录创建/修改组件
4. 如需国际化，更新 `src/locales/*.json`
5. 如需新的后端命令，在 `src-tauri/src/commands/` 添加 `#[tauri::command]`，并在 `lib.rs` 注册

#### 新增一个后端命令

1. 在 `src-tauri/src/commands/` 对应文件添加 `#[tauri::command]` 函数
2. 在 `lib.rs` 的 `invoke_handler!` 宏中注册新命令
3. 在 `src/lib/tauri-api.ts` 添加前端调用封装

#### 修改数据模型

1. 后端：`src-tauri/src/models/` 对应文件
2. 前端：`packages/types/` 对应文件（需两边同步）
3. 如涉及存储，检查 `src-tauri/src/storage/` 中的序列化逻辑

### 数据文件路径

| 路径 | 内容 |
|------|------|
| `~/.apiark/data.db` | 历史记录 SQLite |
| `~/.apiark/audit.db` | 审计日志 SQLite |
| `~/.apiark/settings.json` | 应用设置 |
| `~/.apiark/state.json` | 窗口状态、持久化状态 |
| `~/.apiark/logs/` | 日志文件（按日滚动） |
| `~/.apiark/crash-reports/` | 崩溃报告 |

### 技术栈速查

| 层 | 技术 |
|---|------|
| 桌面框架 | Tauri v2 |
| 前端 | React 19 + TypeScript 5.7 + Vite 6 + Tailwind CSS 4 |
| 状态管理 | Zustand 5 |
| UI 组件 | Radix UI + class-variance-authority + Lucide icons |
| 代码编辑器 | Monaco Editor |
| 国际化 | react-i18next |
| 后端语言 | Rust (edition 2021) |
| HTTP 客户端 | reqwest 0.12 |
| 数据库 | SQLite (rusqlite 0.31) |
| JS 引擎 | QuickJS (rquickjs 0.9) |
| gRPC | tonic 0.12 + prost 0.13 |
| WebSocket | tokio-tungstenite 0.24 |
| MQTT | rumqttc 0.24 |
| 包管理 | pnpm workspaces |
| 构建 | Turborepo |
| CI | GitHub Actions |
