-- ============================================================
-- ThesisForge 迁移 V5：AI 开发流水线
-- 7 阶段串行流水线（环境搭建 → 需求核对 → 进度计划 → 系统设计
-- → 开发 → 测试 → 验收交付），完成后解锁「全能 Agent」
-- ============================================================

-- 流水线总表（单人使用，通常只有一条）
CREATE TABLE IF NOT EXISTS ai_pipeline (
    id          BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键',
    name        VARCHAR(200) NOT NULL DEFAULT '毕设定制流水线' COMMENT '流水线名称',
    status      VARCHAR(20)  NOT NULL DEFAULT 'pending' COMMENT '状态 pending/running/done',
    unlocked    TINYINT      NOT NULL DEFAULT 0 COMMENT '是否已解锁全能 Agent 0否 1是',
    deleted     TINYINT      NOT NULL DEFAULT 0 COMMENT '逻辑删除',
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = 'AI 开发流水线表';

-- 阶段运行状态表
CREATE TABLE IF NOT EXISTS ai_pipeline_stage (
    id           BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键',
    pipeline_id  BIGINT       NOT NULL COMMENT '所属流水线ID',
    stage_code   VARCHAR(50)  NOT NULL COMMENT '阶段编码 environment/requirement/planning/design/development/testing/acceptance',
    stage_name   VARCHAR(100) NOT NULL COMMENT '阶段名称',
    seq          INT          NOT NULL DEFAULT 0 COMMENT '阶段顺序（从1开始）',
    status       VARCHAR(20)  NOT NULL DEFAULT 'pending' COMMENT '状态 pending/running/done',
    session_id   VARCHAR(64)  DEFAULT NULL COMMENT '绑定的 OpenCode session ID',
    context_json TEXT         DEFAULT NULL COMMENT '上一阶段交接的上下文摘要',
    output_path  VARCHAR(255) DEFAULT NULL COMMENT '产出文档路径（docs/xxx.md）',
    deleted      TINYINT      NOT NULL DEFAULT 0 COMMENT '逻辑删除',
    created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (id),
    UNIQUE KEY uk_pipeline_stage (pipeline_id, stage_code),
    KEY idx_pipeline_id (pipeline_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = 'AI 流水线阶段状态表';
