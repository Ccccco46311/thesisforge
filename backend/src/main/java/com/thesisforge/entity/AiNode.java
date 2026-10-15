package com.thesisforge.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * AI 节点（记录一次"完成"认定时的系统状态）。
 */
@Data
@TableName("ai_node")
public class AiNode {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long planId;

    private Long planItemId;

    private String title;

    private String description;

    /** git commit hash */
    private String gitCommit;

    /** 改动文件清单 JSON */
    private String filesChanged;

    /** 迁移脚本清单 JSON */
    private String migrations;

    /** 是否含数据变更 0否 1是 */
    private Integer hasDataChange;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
}
