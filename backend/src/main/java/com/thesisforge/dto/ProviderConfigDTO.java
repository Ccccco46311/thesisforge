package com.thesisforge.dto;

import lombok.Data;

/**
 * AI 供应商配置 DTO（前端表单）。
 */
@Data
public class ProviderConfigDTO {

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
}
