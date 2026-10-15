package com.thesisforge.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * AI 进度计划。
 */
@Data
@TableName("ai_plan")
public class AiPlan {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String title;

    private String description;

    /** pending / doing / done */
    private String status;

    @TableLogic
    private Integer deleted;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
