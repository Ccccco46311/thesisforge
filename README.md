# ThesisForge 🔨

> 让 AI 帮你锻造自己的毕设系统。

**ThesisForge** 是一个开源的后台管理系统框架，核心卖点是内置 **AI 定制**能力：你在网页里通过嵌入的 OpenCode（AI 编程助手）直接让 AI 修改这个系统自身的源代码和样式，把一套通用后台逐步改造成你想要的业务系统。

面向**本科毕业设计 / 个人项目**：学生把自己的毕设想法告诉 AI，AI 将基础后台逐步改造成他想要的系统。

## ✨ 核心特性

- **AI 定制模块**：网页内嵌入 OpenCode，AI 直接读写本项目源码
- **进度计划 + 节点图**：AI 出分步方案 → 你确认 → 每完成一个子功能认定一个节点，全程留痕
- **AI 能改前后端 + 数据库**：结构变更自动生成 Flyway 迁移脚本，可复现、可追踪
- **基础后台开箱即用**：登录 + 用户 / 角色 / 菜单管理 + 日志

## 🧱 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Vue 3 + Element Plus + Vite |
| 后端 | Spring Boot + Spring Security + JWT + MyBatis-Plus + Flyway |
| AI 层 | Node 服务 + OpenCode (SDK / 官方 Web UI) |
| 数据库 | MySQL |

## 📁 仓库结构

```
ThesisForge/
├─ frontend/        Vue 3 + Element Plus 前端
├─ backend/         Spring Boot 后端
│  └─ src/main/resources/db/migration/   Flyway 迁移脚本
├─ bridge/          Node 服务（托管 OpenCode）
├─ docs/            DESIGN.md 设计文档
├─ LICENSE          MIT
└─ README.md
```

## 🚀 快速开始

> 前置要求：Node 18+（推荐 20/24）、JDK 17+、Maven、MySQL 8+

```bash
# 1. 克隆项目
git clone <repo-url>
cd ThesisForge

# 2. 启动后端（详见 backend/README.md）
# 3. 启动前端（详见 frontend/README.md）
# 4. 启动 bridge（详见 bridge/README.md）
```

完整设计见 [docs/DESIGN.md](docs/DESIGN.md)。

## 📄 许可证

[MIT](LICENSE)
