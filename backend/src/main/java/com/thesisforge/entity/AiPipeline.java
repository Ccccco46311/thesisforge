package com.thesisforge.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * AI 开发流水线（单人使用，通常只有一条）。
 */
@Data
@TableName("ai_pipeline")
public class AiPipeline {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String name;

    /** pending / running / done */
    private String status;

    /** 是否已解锁「全能 Agent」0否 1是 */
    private Integer unlocked;

    @TableLogic
    private Integer deleted;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
