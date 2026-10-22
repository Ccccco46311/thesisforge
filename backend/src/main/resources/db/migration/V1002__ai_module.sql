-- ============================================================
-- ThesisForge 迁移 V2：AI 定制模块
-- 供应商配置、进度计划、节点
-- ============================================================

-- AI 供应商配置表（单行配置，id 恒为 1）
CREATE TABLE IF NOT EXISTS ai_provider_config (
    id          BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键',
    provider    VARCHAR(50)  NOT NULL DEFAULT 'deepseek' COMMENT '供应商类型',
    api_key     VARCHAR(500) DEFAULT NULL COMMENT 'API Key',
    base_url    VARCHAR(500) DEFAULT NULL COMMENT '接口地址',
    model       VARCHAR(100) DEFAULT NULL COMMENT '模型名称',
    db_host     VARCHAR(100) DEFAULT NULL COMMENT '数据库地址',
    db_port     VARCHAR(20)  DEFAULT NULL COMMENT '数据库端口',
    db_name     VARCHAR(100) DEFAULT NULL COMMENT '数据库名',
    db_user     VARCHAR(100) DEFAULT NULL COMMENT '数据库账号',
    db_password VARCHAR(200) DEFAULT NULL COMMENT '数据库密码',
    opencode_url VARCHAR(500) DEFAULT NULL COMMENT 'OpenCode 服务地址',
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = 'AI 供应商配置表';

-- 进度计划表
CREATE TABLE IF NOT EXISTS ai_plan (
    id          BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键',
    title       VARCHAR(200) NOT NULL COMMENT '计划标题',
    description VARCHAR(1000) DEFAULT NULL COMMENT '计划描述',
    status      VARCHAR(20)  NOT NULL DEFAULT 'pending' COMMENT '状态 pending/doing/done',
    deleted     TINYINT      NOT NULL DEFAULT 0 COMMENT '逻辑删除',
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = 'AI 进度计划表';

-- 计划子功能表
CREATE TABLE IF NOT EXISTS ai_plan_item (
    id          BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键',
    plan_id     BIGINT       NOT NULL COMMENT '所属计划ID',
    seq         INT          NOT NULL DEFAULT 0 COMMENT '序号',
    title       VARCHAR(300) NOT NULL COMMENT '子功能标题',
    description VARCHAR(1000) DEFAULT NULL COMMENT '描述',
    status      VARCHAR(20)  NOT NULL DEFAULT 'pending' COMMENT '状态 pending/doing/done',
    deleted     TINYINT      NOT NULL DEFAULT 0 COMMENT '逻辑删除',
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (id),
    KEY idx_plan_id (plan_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '进度计划子功能表';

-- 节点表
CREATE TABLE IF NOT EXISTS ai_node (
    id             BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键',
    plan_id        BIGINT       NOT NULL COMMENT '所属计划ID',
    plan_item_id   BIGINT       DEFAULT NULL COMMENT '关联子功能ID',
    title          VARCHAR(300) NOT NULL COMMENT '节点标题',
    description    VARCHAR(1000) DEFAULT NULL COMMENT '节点描述',
    git_commit     VARCHAR(64)  DEFAULT NULL COMMENT 'git commit hash',
    files_changed  TEXT         DEFAULT NULL COMMENT '改动文件清单(JSON)',
    migrations     TEXT         DEFAULT NULL COMMENT '迁移脚本清单(JSON)',
    has_data_change TINYINT     NOT NULL DEFAULT 0 COMMENT '是否含数据变更 0否 1是',
    created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    PRIMARY KEY (id),
    KEY idx_plan_id (plan_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = 'AI 节点表';
