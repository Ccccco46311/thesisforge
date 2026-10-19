package com.thesisforge.util;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.thesisforge.dto.CreatePlanDTO;
import lombok.extern.slf4j.Slf4j;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 从 Agent 回复文本中解析结构化计划（PLAN_JSON 代码块）。
 */
@Slf4j
public final class PlanJsonParser {

    /** 匹配 ```PLAN_JSON ... ``` 或 ```plan_json ... ``` 代码块 */
    private static final Pattern PLAN_BLOCK = Pattern.compile(
            "```(?:PLAN_JSON|plan_json|json:plan)\\s*\\n(.*?)```",
            Pattern.DOTALL);

    private PlanJsonParser() {
    }

    /**
     * 从消息列表（倒序或正序均可）中找出最近一条包含 PLAN_JSON 的 assistant 文本，解析为计划 DTO。
     *
     * @param messages bridge 返回的消息数组
     * @return 解析成功返回 DTO；未找到或解析失败返回 null
     */
    public static CreatePlanDTO parseFromMessages(JsonNode messages, ObjectMapper mapper) {
        if (messages == null || !messages.isArray()) {
            return null;
        }
        // 倒序遍历，优先取最新的
        for (int i = messages.size() - 1; i >= 0; i--) {
            JsonNode m = messages.get(i);
            if (!"assistant".equals(m.path("type").asText())) {
                continue;
            }
            String text = extractAssistantText(m);
            if (text.isEmpty()) {
                continue;
            }
            CreatePlanDTO dto = parse(text, mapper);
            if (dto != null) {
                return dto;
            }
        }
        return null;
    }

    /**
     * 解析文本中的 PLAN_JSON 代码块。
     */
    public static CreatePlanDTO parse(String text, ObjectMapper mapper) {
        if (text == null || text.isBlank()) {
            return null;
        }
        Matcher matcher = PLAN_BLOCK.matcher(text);
        if (!matcher.find()) {
            return null;
        }
        String json = matcher.group(1).trim();
        try {
            JsonNode node = mapper.readTree(json);
            String title = node.path("title").asText("").trim();
            String description = node.path("description").asText("").trim();
            JsonNode itemsNode = node.path("items");
            if (title.isEmpty() || !itemsNode.isArray() || itemsNode.isEmpty()) {
                log.warn("PLAN_JSON 内容不完整，跳过导入: title={}, items={}", title, itemsNode.size());
                return null;
            }
            List<CreatePlanDTO.Item> items = new ArrayList<>();
            for (JsonNode it : itemsNode) {
                String itemTitle = it.path("title").asText("").trim();
                if (itemTitle.isEmpty()) {
                    continue;
                }
                CreatePlanDTO.Item item = new CreatePlanDTO.Item();
                item.setTitle(itemTitle);
                item.setDescription(it.path("description").asText(""));
                items.add(item);
            }
            if (items.isEmpty()) {
                return null;
            }
            CreatePlanDTO dto = new CreatePlanDTO();
            dto.setTitle(title);
            dto.setDescription(description);
            dto.setItems(items);
            return dto;
        } catch (Exception e) {
            log.warn("PLAN_JSON 解析失败: {}", e.getMessage());
            return null;
        }
    }

    /**
     * 从 assistant 消息的 content 数组提取纯文本。
     */
    private static String extractAssistantText(JsonNode m) {
        StringBuilder sb = new StringBuilder();
        JsonNode content = m.path("content");
        if (content.isArray()) {
            for (JsonNode c : content) {
                if ("text".equals(c.path("type").asText())) {
                    sb.append(c.path("text").asText(""));
                }
            }
        }
        return sb.toString();
    }
}
