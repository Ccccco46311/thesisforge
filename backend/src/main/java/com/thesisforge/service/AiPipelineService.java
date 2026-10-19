package com.thesisforge.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.thesisforge.client.BridgeClient;
import com.thesisforge.common.BusinessException;
import com.thesisforge.constant.PipelineStage;
import com.thesisforge.dto.CreatePlanDTO;
import com.thesisforge.dto.PipelineVO;
import com.thesisforge.dto.StageActionVO;
import com.thesisforge.entity.AiPipeline;
import com.thesisforge.entity.AiPipelineStage;
import com.thesisforge.mapper.AiPipelineMapper;
import com.thesisforge.mapper.AiPipelineStageMapper;
import com.thesisforge.util.PlanJsonParser;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * AI 开发流水线服务。
 *
 * <p>7 阶段严格串行：每个阶段一个独立 OpenCode session + 专属 agent，
 * 用户手动确认后推进到下一阶段；全部完成后解锁「全能 Agent」。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AiPipelineService {

    private final AiPipelineMapper pipelineMapper;
    private final AiPipelineStageMapper stageMapper;
    private final BridgeClient bridgeClient;
    private final AiService aiService;
    private final ObjectMapper objectMapper;

    // ================ 查询 ================

    /**
     * 获取（或惰性初始化）流水线状态。
     */
    public PipelineVO getPipeline() {
        AiPipeline pipeline = findPipeline();
        if (pipeline == null) {
            pipeline = initPipeline();
        }
        return buildVO(pipeline);
    }

    /**
     * 当前阶段（第一个非 done 的阶段）。
     */
    public AiPipelineStage currentStage(AiPipeline pipeline) {
        List<AiPipelineStage> stages = listStages(pipeline.getId());
        for (AiPipelineStage s : stages) {
            if (!"done".equals(s.getStatus())) {
                return s;
            }
        }
        return null;
    }

    // ================ 启动 ================

    /**
     * 启动流水线：创建当前待开始阶段的 session 并注入引导消息。
     * 也用于「回退后重新进入当前阶段」。
     */
    @Transactional
    public StageActionVO start() {
        AiPipeline pipeline = findPipeline();
        if (pipeline == null) {
            pipeline = initPipeline();
        }
        if ("done".equals(pipeline.getStatus())) {
            throw new BusinessException("流水线已完成，如需重来请先重置");
        }

        // 当前阶段 = 第一个未完成的阶段（回退后可能是任意阶段）
        AiPipelineStage current = currentStage(pipeline);
        if (current == null) {
            throw new BusinessException("流水线阶段数据缺失，请重置流水线");
        }
        if (current.getSessionId() != null && !current.getSessionId().isBlank()) {
            // 已启动过，直接返回现有 session
            StageActionVO vo = new StageActionVO();
            vo.setStageCode(current.getStageCode());
            vo.setSessionId(current.getSessionId());
            vo.setPipeline(buildVO(pipeline));
            vo.setMessage("该阶段已在进行中");
            return vo;
        }

        return startStage(pipeline, current, current.getContextJson());
    }

    // ================ 推进 / 回退 / 重置 ================

    /**
     * 确认当前阶段完成，进入下一阶段。
     */
    @Transactional
    public StageActionVO advance(String stageCode) {
        AiPipeline pipeline = findPipeline();
        if (pipeline == null) {
            throw new BusinessException("流水线尚未创建");
        }
        PipelineStage def = PipelineStage.of(stageCode);
        if (def == null) {
            throw new BusinessException("未知阶段: " + stageCode);
        }
        AiPipelineStage stage = findStage(pipeline.getId(), stageCode);
        if (stage == null) {
            throw new BusinessException("阶段不存在: " + stageCode);
        }
        if ("pending".equals(stage.getStatus())) {
            throw new BusinessException("该阶段尚未开始");
        }

        // 标记当前阶段完成
        stage.setStatus("done");
        stageMapper.updateById(stage);

        // 进度计划阶段完成：尝试从该阶段会话中解析 PLAN_JSON 并自动导入
        if (def == PipelineStage.PLANNING) {
            importPlanFromStage(stage);
        }

        PipelineStage nextDef = def.next();
        if (nextDef == null) {
            // 最后一个阶段：流水线完成，解锁全能 Agent
            pipeline.setStatus("done");
            pipeline.setUnlocked(1);
            pipelineMapper.updateById(pipeline);
            StageActionVO vo = new StageActionVO();
            vo.setStageCode(stageCode);
            vo.setPipeline(buildVO(pipeline));
            vo.setMessage("流水线已全部完成，「全能 Agent」已解锁");
            return vo;
        }

        AiPipelineStage next = findStage(pipeline.getId(), nextDef.getCode());
        if (next == null) {
            throw new BusinessException("下一阶段数据缺失，请重置流水线");
        }

        // 构造上下文：上一阶段产出路径 + 摘要提示
        String context = buildContext(stage, nextDef);
        next.setContextJson(context);
        stageMapper.updateById(next);

        return startStage(pipeline, next, context);
    }

    /**
     * 回退到某个已完成/进行中的阶段重跑：该阶段及其之后全部置为 pending，清空 session 绑定。
     */
    @Transactional
    public StageActionVO reopen(String stageCode) {
        AiPipeline pipeline = findPipeline();
        if (pipeline == null) {
            throw new BusinessException("流水线尚未创建");
        }
        PipelineStage def = PipelineStage.of(stageCode);
        if (def == null) {
            throw new BusinessException("未知阶段: " + stageCode);
        }
        AiPipelineStage target = findStage(pipeline.getId(), stageCode);
        if (target == null) {
            throw new BusinessException("阶段不存在: " + stageCode);
        }

        List<AiPipelineStage> stages = listStages(pipeline.getId());
        for (AiPipelineStage s : stages) {
            if (s.getSeq() >= def.getSeq()) {
                // 注意：MyBatis-Plus updateById 默认忽略 null，sessionId/contextJson 必须用 UpdateWrapper 显式置空
                var update = new com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper<AiPipelineStage>()
                        .eq(AiPipelineStage::getId, s.getId())
                        .set(AiPipelineStage::getStatus, "pending")
                        .set(AiPipelineStage::getSessionId, null);
                // 目标阶段自身的上下文（来自上一阶段）仍然有效，保留；
                // 后续阶段的上下文依赖本次重跑结果，必须清空。
                if (s.getSeq() > def.getSeq()) {
                    update.set(AiPipelineStage::getContextJson, null);
                }
                stageMapper.update(null, update);
            }
        }

        pipeline.setStatus("running");
        pipeline.setUnlocked(0);
        pipelineMapper.updateById(pipeline);

        StageActionVO vo = new StageActionVO();
        vo.setStageCode(stageCode);
        vo.setPipeline(buildVO(pipeline));
        vo.setMessage("已回退到「" + def.getName() + "」，点击「开始本阶段」重新进入");
        return vo;
    }

    /**
     * 重置整条流水线：阶段全部置 pending、清空 session 绑定、关闭全能 Agent。
     * 不删除 docs 产出和历史 session（可回溯）。
     */
    @Transactional
    public PipelineVO reset() {
        AiPipeline pipeline = findPipeline();
        if (pipeline == null) {
            return getPipeline();
        }
        List<AiPipelineStage> stages = listStages(pipeline.getId());
        for (AiPipelineStage s : stages) {
            var update = new com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper<AiPipelineStage>()
                    .eq(AiPipelineStage::getId, s.getId())
                    .set(AiPipelineStage::getStatus, "pending")
                    .set(AiPipelineStage::getSessionId, null)
                    .set(AiPipelineStage::getContextJson, null);
            stageMapper.update(null, update);
        }
        pipeline.setStatus("pending");
        pipeline.setUnlocked(0);
        pipelineMapper.updateById(pipeline);
        log.info("流水线已重置: pipelineId={}", pipeline.getId());
        return buildVO(pipeline);
    }

    // ================ 阶段内部 ================

    /**
     * 从进度计划阶段的会话消息中解析 PLAN_JSON，并自动创建进度计划。
     * 解析失败不影响阶段推进（降级为手动创建）。
     */
    private void importPlanFromStage(AiPipelineStage stage) {
        String sessionId = stage.getSessionId();
        if (sessionId == null || sessionId.isBlank()) {
            log.warn("进度计划阶段无 session，跳过自动导入");
            return;
        }
        try {
            JsonNode messages = bridgeClient.getChatMessages(sessionId);
            CreatePlanDTO dto = PlanJsonParser.parseFromMessages(messages, objectMapper);
            if (dto == null) {
                log.warn("未在进度计划阶段找到有效的 PLAN_JSON，跳过自动导入（可手动创建）");
                return;
            }
            aiService.createPlan(dto);
            log.info("已自动导入进度计划: title={}, items={}", dto.getTitle(), dto.getItems().size());
        } catch (Exception e) {
            log.warn("自动导入进度计划失败（不影响流水线推进）: {}", e.getMessage());
        }
    }

    /**
     * 启动指定阶段：创建 session + 注入引导消息。
     */
    private StageActionVO startStage(AiPipeline pipeline, AiPipelineStage stage, String context) {
        PipelineStage def = PipelineStage.of(stage.getStageCode());
        if (def == null) {
            throw new BusinessException("未知阶段: " + stage.getStageCode());
        }

        JsonNode session = bridgeClient.createChatSession(
                "[流水线] " + def.getName(), null, def.getAgentId());
        if (session == null) {
            throw new BusinessException("创建阶段会话失败：bridge 不可用或 agent 未注册");
        }
        String sessionId = session.path("id").asText();
        if (sessionId.isBlank()) {
            throw new BusinessException("创建阶段会话失败：返回 session 为空");
        }

        stage.setSessionId(sessionId);
        stage.setStatus("running");
        stageMapper.updateById(stage);

        pipeline.setStatus("running");
        pipelineMapper.updateById(pipeline);

        // 注入引导消息（带上上下文）
        String guide = buildGuideMessage(def, context);
        bridgeClient.sendChatPrompt(sessionId, guide);

        StageActionVO vo = new StageActionVO();
        vo.setStageCode(def.getCode());
        vo.setSessionId(sessionId);
        vo.setPipeline(buildVO(pipeline));
        vo.setMessage("已进入「" + def.getName() + "」阶段");
        return vo;
    }

    /**
     * 构造下一阶段收到的上下文摘要。
     */
    private String buildContext(AiPipelineStage finished, PipelineStage nextDef) {
        StringBuilder sb = new StringBuilder();
        sb.append("上一阶段「").append(finished.getStageName()).append("」已完成。\n");
        if (finished.getOutputPath() != null && !finished.getOutputPath().isBlank()) {
            sb.append("产出文档：").append(finished.getOutputPath()).append("\n");
        }
        sb.append("请先读取上述文档（如果存在），再开始本阶段工作。");
        return sb.toString();
    }

    /**
     * 构造阶段引导消息。
     */
    private String buildGuideMessage(PipelineStage def, String context) {
        StringBuilder sb = new StringBuilder();
        sb.append("现在是毕设流水线的第 ").append(def.getSeq()).append(" 阶段：")
                .append(def.getName()).append("。\n\n");
        if (context != null && !context.isBlank()) {
            sb.append("【上下文】\n").append(context).append("\n\n");
        }
        if (def.getOutputPath() != null) {
            sb.append("本阶段产出要求写入：").append(def.getOutputPath()).append("\n\n");
        }
        switch (def) {
            case ENVIRONMENT ->
                    sb.append("请开始检查本机开发环境（JDK、Maven、Node.js、MySQL、浏览器、端口占用）。"
                            + "一项一项来，每项给出结论，发现缺失给出 Windows 下的具体修复步骤。");
            case REQUIREMENT ->
                    sb.append("请先让我描述想做的系统，然后通过对话逐步核对需求，"
                            + "重点判断是否适合本科毕设体量，最后产出需求文档。");
            case PLANNING ->
                    sb.append("请基于已确认的需求文档，拆解成 8-15 个可验收的子功能，"
                            + "产出进度计划文档，并在回复末尾输出 PLAN_JSON 代码块供系统导入。");
            case DESIGN ->
                    sb.append("请基于需求文档和进度计划，完成系统设计：技术栈、模块划分、"
                            + "数据库表设计（含 ER 图）、数据流图、核心业务流程。"
                            + "ER 图和数据流图必须用 Mermaid 语法，保证能渲染。");
            case DEVELOPMENT ->
                    sb.append("请按照设计文档和进度计划，一次实现一个子功能。"
                            + "先告诉我第一个要做哪个，以及会改哪些文件。"
                            + "数据库结构变更必须写 Flyway 迁移脚本。");
            case TESTING ->
                    sb.append("请对照需求文档逐项测试已实现的功能，能自动化的直接跑，"
                            + "不能的给出具体手工测试步骤。发现问题先说明再修，修完重新验证。");
            case ACCEPTANCE ->
                    sb.append("请对照需求文档逐项验收，如实记录未实现的功能，"
                            + "并输出从零开始的完整运行说明和交付物清单。");
            default -> sb.append("请开始本阶段的工作。");
        }
        return sb.toString();
    }

    // ================ 数据访问 ================

    private AiPipeline findPipeline() {
        return pipelineMapper.selectOne(new LambdaQueryWrapper<AiPipeline>()
                .orderByDesc(AiPipeline::getId)
                .last("LIMIT 1"));
    }

    private AiPipeline initPipeline() {
        AiPipeline pipeline = new AiPipeline();
        pipeline.setName("毕设定制流水线");
        pipeline.setStatus("pending");
        pipeline.setUnlocked(0);
        pipelineMapper.insert(pipeline);

        for (PipelineStage def : PipelineStage.ALL) {
            AiPipelineStage stage = new AiPipelineStage();
            stage.setPipelineId(pipeline.getId());
            stage.setStageCode(def.getCode());
            stage.setStageName(def.getName());
            stage.setSeq(def.getSeq());
            stage.setStatus("pending");
            stage.setOutputPath(def.getOutputPath());
            stageMapper.insert(stage);
        }
        log.info("流水线已初始化: pipelineId={}", pipeline.getId());
        return pipeline;
    }

    private List<AiPipelineStage> listStages(Long pipelineId) {
        return stageMapper.selectList(new LambdaQueryWrapper<AiPipelineStage>()
                .eq(AiPipelineStage::getPipelineId, pipelineId)
                .orderByAsc(AiPipelineStage::getSeq));
    }

    private AiPipelineStage findStage(Long pipelineId, String code) {
        return stageMapper.selectOne(new LambdaQueryWrapper<AiPipelineStage>()
                .eq(AiPipelineStage::getPipelineId, pipelineId)
                .eq(AiPipelineStage::getStageCode, code)
                .last("LIMIT 1"));
    }

    private PipelineVO buildVO(AiPipeline pipeline) {
        PipelineVO vo = new PipelineVO();
        vo.setId(pipeline.getId());
        vo.setName(pipeline.getName());
        vo.setStatus(pipeline.getStatus());
        vo.setUnlocked(pipeline.getUnlocked() != null && pipeline.getUnlocked() == 1);
        vo.setStages(listStages(pipeline.getId()));
        for (AiPipelineStage s : vo.getStages()) {
            // 产出路径以枚举为准，避免历史数据里的旧路径生效
            PipelineStage def = PipelineStage.of(s.getStageCode());
            if (def != null) {
                s.setOutputPath(def.getOutputPath());
            }
            if (!"done".equals(s.getStatus()) && vo.getCurrentStage() == null) {
                vo.setCurrentStage(s.getStageCode());
            }
        }
        return vo;
    }
}
