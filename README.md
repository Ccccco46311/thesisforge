# ThesisForge 🔨

> 让 AI 帮你锻造自己的毕设系统。

**ThesisForge** 是一个开源的后台管理系统框架，核心卖点是内置 **AI 定制**能力：你在网页的聊天界面里让 AI（OpenCode）直接修改这个系统自身的源代码和样式，把一套通用后台逐步改造成你想要的业务系统。

面向**本科毕业设计 / 个人项目**：学生把自己的毕设想法告诉 AI，AI 将基础后台逐步改造成他想要的系统。

## ✨ 核心特性

- **7 阶段 AI 流水线**：环境搭建 → 需求核对 → 进度计划 → 系统设计 → 开发 → 测试 → 验收交付，每个阶段一个专属 Agent，逐环确认推进；全部完成后解锁「全能 Agent」自由开发
- **论文核心产出自动生成**：系统设计阶段输出数据库表设计、**ER 图**、**数据流图**（Mermaid 渲染，可直接用于论文）
- **AI 定制模块**：自研聊天界面驱动内嵌 OpenCode，AI 直接读写本项目源码；无需手动安装 opencode（`npm install` 自动下载二进制）
- **进度计划 + 节点图**：AI 出分步方案 → 自动导入进度计划 → 每完成一个子功能认定一个节点，全程留痕
- **AI 能改前后端 + 数据库**：结构变更自动生成 Flyway 迁移脚本，可复现、可追踪
- **会话隔离**：AI 会话绑定当前项目目录 + 独立数据库 + 会话级权限（只读放行 / 危险命令拒绝）
- **基础后台开箱即用**：登录 + 用户 / 角色 / 菜单管理 + 日志

## 🧱 AI 定制内容与框架隔离

ThesisForge 保证 **GitHub 仓库永远只含框架本体**，AI 为你的毕设定制的内容只存在于本地：

| 类别 | 本地位置 | 是否进 git |
|---|---|---|
| AI 生成的文档 | `docs/ai/` | ❌ 已忽略 |
| AI 新增的后端代码 | `backend/src/main/java/com/thesisforge/ai/`（包 `com.thesisforge.ai`） | ❌ 已忽略 |
| AI 新增的前端页面 | `frontend/src/views/ai-biz/` + `frontend/src/api/ai-biz.js` | ❌ 已忽略 |
| AI 对框架文件的修改（路由/菜单/安全配置等） | 框架文件原位 | ✅ 在 git 中（可回滚） |

- **新增内容进隔离目录**：AI 开发阶段被约束把新增业务代码写入上述目录，`.gitignore` 排除，不提交
- **框架文件改动靠 git**：不可避免的修改（注册路由、加菜单等）保留在 git 历史中，可通过 `git reset` 回滚
- **AI 提交只在本地**：流水线节点的 git commit 不会自动 push，GitHub 上始终是干净框架

## 🔄 AI 开发流水线

```
①环境搭建 → ②需求核对 → ③进度计划 → ④系统设计 → ⑤开发 → ⑥测试 → ⑦验收交付
      └──────────── 严格串行，手动确认推进 ────────────┘
                            ↓ ⑦完成自动解锁
                  全能 Agent（无阶段限制的自由开发）
```

| 阶段 | 产出文档 | 说明 |
|---|---|---|
| ① 环境搭建 | `docs/ai/environment-report.md` | 检查 JDK / Maven / Node / MySQL / 浏览器 / 端口 |
| ② 需求核对 | `docs/ai/requirements.md` | 对话式梳理需求，核对本科毕设体量 |
| ③ 进度计划 | `docs/ai/plan.md` | 自动导入「进度计划」页 |
| ④ 系统设计 | `docs/ai/system-design.md` | 技术栈、表设计、**ER 图**、**数据流图** |
| ⑤ 开发 | — | 逐模块实现，数据库变更写 Flyway |
| ⑥ 测试 | `docs/ai/test-report.md` | 逐项测试并修复 |
| ⑦ 验收交付 | `docs/ai/acceptance.md` | 验收清单 + 从零运行说明 |

**支持**：阶段回退重跑（点已完成的阶段）、整条流水线重置；产出文档与历史会话永久保留可回溯。


## 🧱 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Vue 3 + Element Plus + Vite |
| 后端 | Spring Boot + Spring Security + JWT + MyBatis-Plus + Flyway |
| AI 层 | Node 服务 + `@opencode/cli`（内嵌二进制，自研聊天界面） |
| 数据库 | MySQL |

## 📁 仓库结构

```
ThesisForge/
├─ frontend/        Vue 3 + Element Plus 前端
├─ backend/         Spring Boot 后端
│  └─ src/main/resources/db/migration/   Flyway 迁移脚本
├─ bridge/          Node 服务（托管 opencode serve + git 操作）
├─ docs/            DESIGN.md 设计文档
├─ LICENSE          MIT
└─ README.md
```

## 🚀 快速开始

> 前置要求：**Node 18+（推荐 20/24）**、JDK 17+、Maven、MySQL 8+

> ⚠️ **Node 版本提醒**：本项目的 Vite 5 与 bridge 需要 Node 18+。
> 如果你的机器默认 node 是旧版本（如 v16），务必先切换到 18+ 再启动，
> 否则前端会报 `crypto.getRandomValues is not a function`、bridge 会报 `fetch is not defined`。
> 使用 nvm 时：`nvm use 20`（或 24），再用 `node -v` 确认版本 ≥ 18。

```bash
# 1. 克隆项目
git clone <repo-url>
cd ThesisForge

# 2. 安装并启动 bridge（首次安装会自动下载 opencode 二进制，约 213MB）
cd bridge
npm install
npm start

# 3. 启动后端（详见 backend/README.md）
# 4. 启动前端（详见 frontend/README.md）
```

完整设计见 [docs/DESIGN.md](docs/DESIGN.md)。

## 📄 许可证

[MIT](LICENSE)
