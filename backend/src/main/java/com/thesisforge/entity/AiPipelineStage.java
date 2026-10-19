package com.thesisforge.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * AI 流水线阶段运行状态。
 */
@Data
@TableName("ai_pipeline_stage")
public class AiPipelineStage {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long pipelineId;

    /** 阶段编码 environment/requirement/planning/design/development/testing/acceptance */
    private String stageCode;

    private String stageName;

    /** 阶段顺序（从 1 开始） */
    private Integer seq;

    /** pending / running / done */
    private String status;

    /** 绑定的 OpenCode session ID */
    private String sessionId;

    /** 上一阶段交接的上下文摘要 */
    private String contextJson;

    /** 产出文档路径（docs/xxx.md） */
    private String outputPath;

    @TableLogic
    private Integer deleted;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
