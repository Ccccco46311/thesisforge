# 数据库搭建

ThesisForge 使用 **MySQL 8+**，后端通过 **Flyway** 自动管理表结构：启动时自动执行迁移脚本建表，无需手动建表。

## 一、初始化（一次性）

### 1. 用 root 执行初始化脚本

脚本位置：`docs/sql/setup_db.sql`

```bash
mysql -uroot -p < docs/sql/setup_db.sql
```

脚本会完成：

| 项目 | 值 |
|---|---|
| 数据库 | `thesisforge`（utf8mb4 / utf8mb4_unicode_ci） |
| 专用账号 | `thesisforge` / `thesisforge`（localhost） |
| 权限 | 仅 `thesisforge.*` 全权限，不触碰其他库 |

### 2. 建表

无需手动建表。后端首次启动时 Flyway 自动执行 `backend/src/main/resources/db/migration/` 下的脚本：

| 脚本 | 内容 |
|---|---|
| `V1__init_system.sql` | 系统管理：用户/角色/菜单/用户角色/角色菜单/操作日志/登录日志（7 张） |
| `V2__ai_module.sql` | AI 定制：供应商配置/进度计划/计划子功能/节点（4 张） |

建表后自动插入基础数据：超级管理员角色、普通用户角色；默认管理员 `admin / admin123` 由后端启动时自动创建。

## 二、连接配置

后端默认连接参数（`backend/src/main/resources/application.yml`）：

| 环境变量 | 默认值 | 说明 |
|---|---|---|
| `MYSQL_HOST` | `localhost` | 数据库地址 |
| `MYSQL_PORT` | `3306` | 端口 |
| `MYSQL_DATABASE` | `thesisforge` | 库名 |
| `MYSQL_USERNAME` | `thesisforge` | 用户名 |
| `MYSQL_PASSWORD` | `thesisforge` | 密码 |
| `JWT_SECRET` | dev 默认值 | JWT 签名密钥（生产务必替换） |
| `JWT_EXPIRE_MILLIS` | `86400000` | token 有效期(ms) |

覆盖示例（Windows PowerShell）：

```powershell
$env:MYSQL_PASSWORD = "你的密码"
mvn spring-boot:run
```

## 三、Flyway 迁移约定（AI 改库核心）

> 这是 AI 定制系统的关键约定，AI 生成的任何表结构变更都必须落成迁移脚本。

- **位置**：`backend/src/main/resources/db/migration/`
- **命名**：`V3__描述.sql`、`V4__描述.sql`（版本号递增，禁止修改已执行过的脚本）
- **生效**：开发环境已集成 Spring Boot DevTools，新增脚本后应用自动重启，Flyway 自动执行新版本
- **禁止**：直接手改数据库表结构（测试数据可直接连库写，但 DDL 必须走脚本）
- **查看**：已执行记录在 `flyway_schema_history` 表

## 四、常用操作

```bash
# 进入数据库
mysql -uthesisforge -pthesisforge thesisforge

# 查看已执行的迁移
SELECT version, description, success FROM flyway_schema_history;
```
