package com.thesisforge.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * AI 聊天会话记录（对应独立 OpenCode serve 中的会话）。
 */
@Data
@TableName("ai_chat_session")
public class AiChatSession {

    @TableId(type = IdType.AUTO)
    private Long id;

    /** OpenCode session ID（如 ses_xxx） */
    private String sessionId;

    private String title;

    /** 项目目录 */
    private String projectDir;

    /** 模型标识 provider/model */
    private String model;

    /** active / archived */
    private String status;

    private Integer messageCount;

    @TableLogic
    private Integer deleted;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
