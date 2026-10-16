-- ============================================================
-- ThesisForge 数据库初始化脚本
-- 创建数据库 + 专用账号
-- 用法: mysql -uroot -p < setup_db.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS thesisforge
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- 专用账号（本地开发默认密码 thesisforge，可用环境变量覆盖）
CREATE USER IF NOT EXISTS 'thesisforge'@'localhost' IDENTIFIED BY 'thesisforge';

-- 只授权 thesisforge 库
GRANT ALL PRIVILEGES ON thesisforge.* TO 'thesisforge'@'localhost';
FLUSH PRIVILEGES;

SELECT 'database created: thesisforge' AS info;
SELECT 'user created: thesisforge' AS info;
