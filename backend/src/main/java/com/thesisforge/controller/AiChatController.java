package com.thesisforge.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.thesisforge.common.Result;
import com.thesisforge.dto.ChatPromptDTO;
import com.thesisforge.dto.ChatSessionVO;
import com.thesisforge.service.AiChatService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Map;

/**
 * AI 聊天接口（内嵌 OpenCode 聊天界面）。
 */
@Slf4j
@RestController
@RequestMapping("/api/ai/chat")
@RequiredArgsConstructor
public class AiChatController {

    private final AiChatService aiChatService;

    @Value("${thesisforge.bridge.url:http://localhost:3010}")
    private String bridgeUrl;

    // ---------- 会话 ----------

    @GetMapping("/sessions")
    public Result<List<ChatSessionVO>> listSessions() {
        return Result.ok(aiChatService.listSessions());
    }

    @PostMapping("/sessions")
    public Result<ChatSessionVO> createSession(@RequestBody(required = false) Map<String, String> body) {
        String title = body != null ? body.get("title") : null;
        String model = body != null ? body.get("model") : null;
        return Result.ok(aiChatService.createSession(title, model));
    }

    @DeleteMapping("/sessions/{sessionId}")
    public Result<Void> deleteSession(@PathVariable String sessionId) {
        aiChatService.deleteSession(sessionId);
        return Result.ok();
    }

    @GetMapping("/status")
    public Result<JsonNode> status() {
        return Result.ok(aiChatService.getStatus());
    }

    /**
     * 重启 opencode serve（执行引擎偶发卡死时自愈）。
     */
    @PostMapping("/restart")
    public Result<Void> restart() {
        if (!aiChatService.restartServer()) {
            return Result.fail("重启 OpenCode 服务失败：bridge 不可用");
        }
        return Result.ok();
    }

    // ---------- 消息 ----------

    @PostMapping("/sessions/{sessionId}/prompt")
    public Result<JsonNode> sendPrompt(@PathVariable String sessionId, @RequestBody ChatPromptDTO dto) {
        if (dto.getText() == null || dto.getText().isBlank()) {
            return Result.fail("消息内容不能为空");
        }
        return Result.ok(aiChatService.sendPrompt(sessionId, dto.getText()));
    }

    @GetMapping("/sessions/{sessionId}/messages")
    public Result<JsonNode> getMessages(@PathVariable String sessionId) {
        return Result.ok(aiChatService.getMessages(sessionId));
    }

    @GetMapping("/sessions/{sessionId}/permission")
    public Result<JsonNode> listPermissions(@PathVariable String sessionId) {
        return Result.ok(aiChatService.listPermissions(sessionId));
    }

    @PostMapping("/sessions/{sessionId}/permission/{requestId}/reply")
    public Result<Void> replyPermission(@PathVariable String sessionId,
                                        @PathVariable String requestId,
                                        @RequestBody Map<String, String> body) {
        aiChatService.replyPermission(sessionId, requestId, body.get("decision"));
        return Result.ok();
    }

    // ---------- SSE ----------

    /**
     * SSE 事件流：代理 bridge 的 /api/opencode/events，向浏览器实时推送。
     */
    @GetMapping(value = "/events", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter events() {
        SseEmitter emitter = new SseEmitter(0L); // 不超时
        proxySse(emitter, bridgeUrl + "/api/opencode/events");
        return emitter;
    }

    private void proxySse(SseEmitter emitter, String upstreamUrl) {
        HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(upstreamUrl))
                .timeout(Duration.ofMinutes(30))
                .header("Accept", "text/event-stream")
                .GET()
                .build();

        Thread t = new Thread(() -> {
            try {
                HttpResponse<java.io.InputStream> resp =
                        client.send(request, HttpResponse.BodyHandlers.ofInputStream());
                if (resp.statusCode() != 200) {
                    emitter.completeWithError(new RuntimeException("上游 SSE HTTP " + resp.statusCode()));
                    return;
                }
                byte[] buf = new byte[8192];
                int n;
                try (var in = resp.body()) {
                    while ((n = in.read(buf)) != -1) {
                        String chunk = new String(buf, 0, n, StandardCharsets.UTF_8);
                        for (String line : chunk.split("\n")) {
                            if (line.startsWith("data:")) {
                                emitter.send(SseEmitter.event().data(line.substring(5).trim()));
                            } else if (!line.isBlank()) {
                                emitter.send(SseEmitter.event().data(line));
                            }
                        }
                    }
                }
                emitter.complete();
            } catch (Exception e) {
                log.warn("SSE 代理中断: {}", e.getMessage());
                emitter.completeWithError(e);
            }
        }, "chat-sse-proxy");
        t.setDaemon(true);
        t.start();

        emitter.onCompletion(() -> t.interrupt());
        emitter.onTimeout(() -> t.interrupt());
        emitter.onError((e) -> t.interrupt());
    }
}
