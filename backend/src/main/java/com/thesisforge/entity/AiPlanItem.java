package com.thesisforge.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 进度计划子功能。
 */
@Data
@TableName("ai_plan_item")
public class AiPlanItem {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long planId;

    private Integer seq;

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
