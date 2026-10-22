package com.thesisforge.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.thesisforge.client.BridgeClient;
import com.thesisforge.dto.ChatSessionVO;
import com.thesisforge.entity.AiChatSession;
import com.thesisforge.mapper.AiChatSessionMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

/**
 * AI 聊天会话服务：会话记录存取 + 转发 bridge。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AiChatService {

    private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final AiChatSessionMapper chatSessionMapper;
    private final BridgeClient bridgeClient;

    // ================ 会话列表 ================

    /**
     * 会话列表：以 bridge 返回为准，并同步补录到本库。
     * 流水线阶段会话（标题以 [流水线] 开头）不出现在自由聊天列表中。
     */
    public List<ChatSessionVO> listSessions() {
        JsonNode sessions = bridgeClient.listChatSessions();
        List<ChatSessionVO> result = new ArrayList<>();
        if (sessions != null && sessions.isArray()) {
            for (JsonNode s : sessions) {
                String sessionId = s.path("id").asText();
                if (sessionId.isEmpty()) {
                    continue;
                }
                syncSessionRecord(sessionId, s);
                if (isPipelineSession(s)) {
                    continue;
                }
                result.add(toVO(s));
            }
        }
        return result;
    }

    /**
     * 是否为流水线阶段会话（由 AiPipelineService 创建，标题带 [流水线] 前缀）。
     */
    private boolean isPipelineSession(JsonNode s) {
        String title = s.path("title").asText("");
        return title.startsWith("[流水线]");
    }

    /**
     * 将 bridge 返回的会话补录到本库（不存在则插入）。
     */
    private void syncSessionRecord(String sessionId, JsonNode s) {
        try {
            AiChatSession exist = chatSessionMapper.selectOne(
                    new LambdaQueryWrapper<AiChatSession>()
                            .eq(AiChatSession::getSessionId, sessionId)
                            .last("LIMIT 1"));
            String title = s.path("title").asText("AI 开发会话");
            if (title.isBlank()) {
                title = "AI 开发会话";
            }
            String model = s.path("model").path("providerID").asText() + "/"
                    + s.path("model").path("id").asText();
            if (model.equals("/")) {
                model = null;
            }
            if (exist == null) {
                AiChatSession record = new AiChatSession();
                record.setSessionId(sessionId);
                record.setTitle(title);
                record.setModel(model);
                record.setProjectDir(s.path("location").path("directory").asText());
                record.setStatus("active");
                record.setMessageCount(0);
                chatSessionMapper.insert(record);
            } else {
                boolean needUpdate = false;
                if (!title.equals(exist.getTitle())) {
                    exist.setTitle(title);
                    needUpdate = true;
                }
                if (model != null && !model.equals(exist.getModel())) {
                    exist.setModel(model);
                    needUpdate = true;
                }
                if (needUpdate) {
                    chatSessionMapper.updateById(exist);
                }
            }
        } catch (Exception e) {
            log.warn("同步会话记录失败: {}", e.getMessage());
        }
    }

    private ChatSessionVO toVO(JsonNode s) {
        ChatSessionVO vo = new ChatSessionVO();
        vo.setSessionId(s.path("id").asText());
        String title = s.path("title").asText();
        vo.setTitle(title.isBlank() ? "AI 开发会话" : title);
        vo.setModel(s.path("model").path("providerID").asText() + "/" + s.path("model").path("id").asText());
        vo.setStatus("active");
        return vo;
    }

    // ================ 创建 / 删除 ================

    /**
     * 创建会话：调 bridge，成功后补录本库。
     */
    public ChatSessionVO createSession(String title, String model) {
        JsonNode s = bridgeClient.createChatSession(title, model);
        if (s == null) {
            throw new com.thesisforge.common.BusinessException("创建会话失败：bridge 不可用");
        }
        String sessionId = s.path("id").asText();
        syncSessionRecord(sessionId, s);
        return toVO(s);
    }

    /**
     * 删除会话：bridge 删除 + 本库逻辑删除。
     */
    public boolean deleteSession(String sessionId) {
        bridgeClient.deleteChatSession(sessionId);
        AiChatSession exist = chatSessionMapper.selectOne(
                new LambdaQueryWrapper<AiChatSession>()
                        .eq(AiChatSession::getSessionId, sessionId)
                        .last("LIMIT 1"));
        if (exist != null) {
            chatSessionMapper.deleteById(exist.getId());
        }
        return true;
    }

    // ================ 消息 ================

    /**
     * 发送消息。
     */
    public JsonNode sendPrompt(String sessionId, String text) {
        JsonNode result = bridgeClient.sendChatPrompt(sessionId, text);
        if (result == null) {
            throw new com.thesisforge.common.BusinessException("发送消息失败：bridge 不可用");
        }
        bumpMessageCount(sessionId);
        return result;
    }

    /**
     * 读取会话消息。
     */
    public JsonNode getMessages(String sessionId) {
        JsonNode messages = bridgeClient.getChatMessages(sessionId);
        if (messages != null && messages.isArray()) {
            AiChatSession exist = chatSessionMapper.selectOne(
                    new LambdaQueryWrapper<AiChatSession>()
                            .eq(AiChatSession::getSessionId, sessionId)
                            .last("LIMIT 1"));
            if (exist != null) {
                int count = messages.size();
                if (!Integer.valueOf(count).equals(exist.getMessageCount())) {
                    exist.setMessageCount(count);
                    chatSessionMapper.updateById(exist);
                }
            }
        }
        return messages;
    }

    /**
     * 获取会话详情（含 tokens 使用量，用于展示上下文占用）。
     */
    public JsonNode getSessionInfo(String sessionId) {
        return bridgeClient.getChatSessionInfo(sessionId);
    }

    /**
     * 请求压缩会话上下文。
     *
     * @return 是否成功提交
     */
    public boolean compactSession(String sessionId) {
        return bridgeClient.compactChatSession(sessionId);
    }

    /**
     * 回复权限请求。
     */
    public void replyPermission(String sessionId, String requestId, String decision) {
        if (decision == null || !List.of("once", "always", "reject").contains(decision)) {
            throw new com.thesisforge.common.BusinessException("decision 必须为 once/always/reject");
        }
        bridgeClient.replyChatPermission(sessionId, requestId, decision);
    }

    /**
     * 列出会话挂起的权限请求（前端兜底轮询用）。
     */
    public JsonNode listPermissions(String sessionId) {
        return bridgeClient.listChatPermissions(sessionId);
    }

    private void bumpMessageCount(String sessionId) {
        try {
            AiChatSession exist = chatSessionMapper.selectOne(
                    new LambdaQueryWrapper<AiChatSession>()
                            .eq(AiChatSession::getSessionId, sessionId)
                            .last("LIMIT 1"));
            if (exist != null) {
                exist.setMessageCount(exist.getMessageCount() + 1);
                chatSessionMapper.updateById(exist);
            }
        } catch (Exception e) {
            log.warn("更新消息数失败: {}", e.getMessage());
        }
    }

    /**
     * OpenCode 运行状态。
     */
    public JsonNode getStatus() {
        return bridgeClient.getChatStatus();
    }

    /**
     * 重启 opencode serve（执行引擎偶发卡死时自愈）。
     *
     * @return 是否重启成功
     */
    public boolean restartServer() {
        return bridgeClient.restartServer();
    }
}
