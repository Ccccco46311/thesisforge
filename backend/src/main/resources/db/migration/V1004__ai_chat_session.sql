-- ============================================================
-- ThesisForge 迁移 V4：AI 聊天会话记录
-- 记录「AI 开发」页在独立 OpenCode serve 中创建的会话
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_chat_session (
    id            BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键',
    session_id    VARCHAR(64)  NOT NULL COMMENT 'OpenCode session ID',
    title         VARCHAR(200) NOT NULL COMMENT '会话标题',
    project_dir   VARCHAR(500) DEFAULT NULL COMMENT '项目目录',
    model         VARCHAR(200) DEFAULT NULL COMMENT '模型标识 provider/model',
    status        VARCHAR(20)  NOT NULL DEFAULT 'active' COMMENT '状态 active/archived',
    message_count INT          NOT NULL DEFAULT 0 COMMENT '消息数',
    deleted       TINYINT      NOT NULL DEFAULT 0 COMMENT '逻辑删除',
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (id),
    UNIQUE KEY uk_session_id (session_id),
    KEY idx_project_dir (project_dir),
    KEY idx_created_at (created_at)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = 'AI 聊天会话记录表';
