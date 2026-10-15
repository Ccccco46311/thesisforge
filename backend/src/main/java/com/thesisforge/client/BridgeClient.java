package com.thesisforge.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

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
}
