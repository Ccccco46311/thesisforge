package com.thesisforge.dto;

import lombok.Data;

import java.util.List;

/**
 * 创建进度计划请求。
 */
@Data
public class CreatePlanDTO {

    private String title;
    private String description;

    @Data
    public static class Item {
        private String title;
        private String description;
    }

    private List<Item> items;
}
