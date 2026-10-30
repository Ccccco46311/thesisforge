package com.thesisforge.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;

/**
 * Node bridge 客户端。
 *
 * <p>bridge 负责 git 操作（git commit 等）。未启动时返回 null，调用方降级处理，
 * 保证前后端可独立开发。</p>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class BridgeClient {

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    @Value("${thesisforge.bridge.url:http://localhost:3010}")
    private String bridgeUrl;

    /**
     * 通知 bridge 提交当前工作区改动。
     *
     * @return commit hash；bridge 不可用时返回 null
     */
    public String commit(String message) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, String>> entity =
                    new HttpEntity<>(Map.of("message", message), headers);
            ResponseEntity<String> resp = restTemplate.exchange(
                    bridgeUrl + "/git/commit", HttpMethod.POST, entity, String.class);
            JsonNode json = objectMapper.readTree(resp.getBody());
            JsonNode data = json.path("data");
            return data.isMissingNode() ? null : data.asText();
        } catch (Exception e) {
            log.warn("bridge 不可用，git commit 降级跳过: {}", e.getMessage());
            return null;
        }
    }

    /**
     * 通知 bridge 重新应用供应商配置。
     */
    public void applyProviderConfig(Map<String, String> config) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, String>> entity = new HttpEntity<>(config, headers);
            restTemplate.exchange(bridgeUrl + "/provider/apply", HttpMethod.POST, entity, String.class);
        } catch (Exception e) {
            log.warn("bridge 不可用，供应商配置未应用到 OpenCode: {}", e.getMessage());
        }
    }

    // ---------- OpenCode 聊天 ----------

    /**
     * 列出当前项目的 OpenCode 会话。
     *
     * @return 会话数组；bridge 不可用时返回空列表
     */
    public JsonNode listChatSessions() {
        try {
            ResponseEntity<String> resp = restTemplate.getForEntity(
                    bridgeUrl + "/api/opencode/sessions", String.class);
            JsonNode json = objectMapper.readTree(resp.getBody());
            return json.path("data");
        } catch (Exception e) {
            log.warn("bridge 不可用，获取会话列表失败: {}", e.getMessage());
            return objectMapper.createArrayNode();
        }
    }

    /**
     * 创建 OpenCode 会话。
     *
     * @param title 会话标题
     * @param model 模型标识（provider/model）
     * @param agent agent ID（流水线阶段 agent），null 用默认
     * @return 会话对象；失败返回 null
     */
    public JsonNode createChatSession(String title, String model, String agent) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            Map<String, String> body = new java.util.HashMap<>();
            body.put("title", title);
            if (model != null) {
                body.put("model", model);
            }
            if (agent != null) {
                body.put("agent", agent);
            }
            HttpEntity<Map<String, String>> entity = new HttpEntity<>(body, headers);
            ResponseEntity<String> resp = restTemplate.exchange(
                    bridgeUrl + "/api/opencode/sessions", HttpMethod.POST, entity, String.class);
            JsonNode json = objectMapper.readTree(resp.getBody());
            return json.path("data").isMissingNode() ? null : json.path("data");
        } catch (Exception e) {
            log.warn("bridge 不可用，创建会话失败: {}", e.getMessage());
            return null;
        }
    }

    /**
     * 创建 OpenCode 会话（不指定 agent）。
     */
    public JsonNode createChatSession(String title, String model) {
        return createChatSession(title, model, null);
    }

    /**
     * 列出 OpenCode 可用 agent。
     */
    public JsonNode listAgents() {
        try {
            ResponseEntity<String> resp = restTemplate.getForEntity(
                    bridgeUrl + "/api/opencode/agents", String.class);
            JsonNode json = objectMapper.readTree(resp.getBody());
            return json.path("data");
        } catch (Exception e) {
            log.warn("bridge 不可用，获取 agent 列表失败: {}", e.getMessage());
            return objectMapper.createArrayNode();
        }
    }

    /**
     * 向会话发送消息。
     *
     * @return 响应；失败返回 null
     */
    public JsonNode sendChatPrompt(String sessionId, String text) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, String>> entity =
                    new HttpEntity<>(Map.of("text", text), headers);
            ResponseEntity<String> resp = restTemplate.exchange(
                    bridgeUrl + "/api/opencode/sessions/" + sessionId + "/prompt",
                    HttpMethod.POST, entity, String.class);
            JsonNode json = objectMapper.readTree(resp.getBody());
            return json.path("data").isMissingNode() ? null : json.path("data");
        } catch (Exception e) {
            log.warn("bridge 不可用，发送消息失败: {}", e.getMessage());
            return null;
        }
    }

    /**
     * 读取会话消息列表。
     */
    public JsonNode getChatMessages(String sessionId) {
        try {
            ResponseEntity<String> resp = restTemplate.getForEntity(
                    bridgeUrl + "/api/opencode/sessions/" + sessionId + "/message", String.class);
            JsonNode json = objectMapper.readTree(resp.getBody());
            return json.path("data");
        } catch (Exception e) {
            log.warn("bridge 不可用，读取消息失败: {}", e.getMessage());
            return objectMapper.createArrayNode();
        }
    }

    /**
     * 获取会话详情（含 tokens 使用量）。
     */
    public JsonNode getChatSessionInfo(String sessionId) {
        try {
            ResponseEntity<String> resp = restTemplate.getForEntity(
                    bridgeUrl + "/api/opencode/sessions/" + sessionId + "/info", String.class);
            JsonNode json = objectMapper.readTree(resp.getBody());
            return json.path("data");
        } catch (Exception e) {
            log.warn("bridge 不可用，读取会话信息失败: {}", e.getMessage());
            return objectMapper.createObjectNode();
        }
    }

    /**
     * 请求压缩会话上下文。
     *
     * @return 是否成功提交
     */
    public boolean compactChatSession(String sessionId) {
        try {
            ResponseEntity<String> resp = restTemplate.postForEntity(
                    bridgeUrl + "/api/opencode/sessions/" + sessionId + "/compact",
                    null, String.class);
            JsonNode json = objectMapper.readTree(resp.getBody());
            return json.path("code").asInt() == 200;
        } catch (Exception e) {
            log.warn("bridge 不可用，压缩会话上下文失败: {}", e.getMessage());
            return false;
        }
    }

    /**
     * 删除会话。
     *
     * @return 是否成功
     */
    public boolean deleteChatSession(String sessionId) {
        try {
            ResponseEntity<String> resp = restTemplate.exchange(
                    bridgeUrl + "/api/opencode/sessions/" + sessionId,
                    HttpMethod.DELETE, null, String.class);
            JsonNode json = objectMapper.readTree(resp.getBody());
            return json.path("code").asInt() == 200;
        } catch (Exception e) {
            log.warn("bridge 不可用，删除会话失败: {}", e.getMessage());
            return false;
        }
    }

    /**
     * 列出会话挂起的权限请求。
     */
    public JsonNode listChatPermissions(String sessionId) {
        try {
            ResponseEntity<String> resp = restTemplate.getForEntity(
                    bridgeUrl + "/api/opencode/sessions/" + sessionId + "/permission", String.class);
            JsonNode json = objectMapper.readTree(resp.getBody());
            return json.path("data");
        } catch (Exception e) {
            log.warn("bridge 不可用，读取权限请求失败: {}", e.getMessage());
            return objectMapper.createArrayNode();
        }
    }

    /**
     * 为权限请求生成 AI 描述和风险点。
     *
     * @param payload 权限请求 { action, resources, metadata, message }
     * @return {summary, risk, risks}；bridge 或模型不可用时返回 null
     */
    public JsonNode describeChatPermission(JsonNode payload) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<String> entity =
                    new HttpEntity<>(objectMapper.writeValueAsString(payload), headers);
            ResponseEntity<String> resp = restTemplate.exchange(
                    bridgeUrl + "/api/ai/permission/describe",
                    HttpMethod.POST, entity, String.class);
            JsonNode json = objectMapper.readTree(resp.getBody());
            JsonNode data = json.path("data");
            return data.isMissingNode() || data.isNull() ? null : data;
        } catch (Exception e) {
            log.warn("bridge 不可用，生成权限描述失败: {}", e.getMessage());
            return null;
        }
    }

    /**
     * 回复权限请求。
     *
     * @return 是否成功
     */
    public boolean replyChatPermission(String sessionId, String requestId, String decision) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, String>> entity =
                    new HttpEntity<>(Map.of("decision", decision), headers);
            restTemplate.exchange(
                    bridgeUrl + "/api/opencode/sessions/" + sessionId
                            + "/permission/" + requestId + "/reply",
                    HttpMethod.POST, entity, String.class);
            return true;
        } catch (Exception e) {
            log.warn("bridge 不可用，回复权限失败: {}", e.getMessage());
            return false;
        }
    }

    /**
     * 获取 OpenCode 运行状态。
     */
    public JsonNode getChatStatus() {
        try {
            ResponseEntity<String> resp = restTemplate.getForEntity(
                    bridgeUrl + "/api/opencode/status", String.class);
            return objectMapper.readTree(resp.getBody()).path("data");
        } catch (Exception e) {
            log.warn("bridge 不可用，获取 OpenCode 状态失败: {}", e.getMessage());
            return objectMapper.createObjectNode();
        }
    }

    /**
     * 重启 opencode serve 进程（用于执行引擎偶发卡死时自愈）。
     *
     * @return true 重启成功；失败返回 false
     */
    public boolean restartServer() {
        try {
            ResponseEntity<String> resp = restTemplate.postForEntity(
                    bridgeUrl + "/api/opencode/restart", null, String.class);
            JsonNode json = objectMapper.readTree(resp.getBody());
            return json.path("code").asInt() == 200;
        } catch (Exception e) {
            log.warn("bridge 不可用，重启 OpenCode serve 失败: {}", e.getMessage());
            return false;
        }
    }
}
