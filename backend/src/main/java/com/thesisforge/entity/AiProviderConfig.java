package com.thesisforge.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * AI 供应商配置（单行，id 恒为 1）。
 */
@Data
@TableName("ai_provider_config")
public class AiProviderConfig {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String provider;

    private String apiKey;

    private String baseUrl;

    private String model;

    private String dbHost;

    private String dbPort;

    private String dbName;

    private String dbUser;

    private String dbPassword;

    private String opencodeUrl;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
