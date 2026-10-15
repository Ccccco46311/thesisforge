# ThesisForge Backend

Spring Boot 后端服务，端口 `8080`。

## 技术栈

- Spring Boot 3.3.5
- Spring Security + JWT（无状态认证）
- MyBatis-Plus 3.5.7
- Flyway（数据库迁移）
- MySQL 8+

## 快速开始

### 1. 准备数据库

```sql
CREATE DATABASE thesisforge DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

数据库连接通过环境变量配置（默认值见下），也可以在 `src/main/resources/application.yml` 中修改：

| 环境变量 | 默认值 | 说明 |
|---|---|---|
| `MYSQL_HOST` | `localhost` | 数据库地址 |
| `MYSQL_PORT` | `3306` | 端口 |
| `MYSQL_DATABASE` | `thesisforge` | 库名 |
| `MYSQL_USERNAME` | `root` | 用户名 |
| `MYSQL_PASSWORD` | `root` | 密码 |
| `JWT_SECRET` | dev 默认值 | JWT 签名密钥 |
| `JWT_EXPIRE_MILLIS` | `86400000` | token 有效期(ms) |

### 2. 启动

```bash
mvn spring-boot:run
```

首次启动 Flyway 会自动执行 `src/main/resources/db/migration/` 下的迁移脚本建表。

### 3. 默认账号

| 用户名 | 密码 |
|---|---|
| `admin` | `admin123` |

首次启动时自动创建，密码请尽快修改。

## 开发模式热重载

已集成 Spring Boot DevTools：修改 Java / resources 后自动重启。

> **AI 定制核心约定**：AI 生成的 Flyway 迁移脚本放在
> `src/main/resources/db/migration/` 下（如 `V2__xxx.sql`），DevTools 检测到变化
> 自动重启应用，Flyway 自动应用新脚本。

## API 说明

- 登录：`POST /api/auth/login`（返回 JWT + 菜单树）
- 用户：`/api/system/user/*`
- 角色：`/api/system/role/*`
- 菜单：`/api/system/menu/*`

请求需带请求头：`Authorization: Bearer <token>`

统一响应格式：`{ "code": 200, "msg": "操作成功", "data": ... }`
