package com.thesisforge.dto;

import lombok.Data;

/**
 * AI 聊天会话 VO（列表 / 创建返回）。
 */
@Data
public class ChatSessionVO {

    /** OpenCode session ID */
    private String sessionId;

    private String title;

    /** 模型标识 provider/model */
    private String model;

    /** 会话状态 active / archived */
    private String status;

    private Integer messageCount;

    private String createdAt;

    private String updatedAt;
}
