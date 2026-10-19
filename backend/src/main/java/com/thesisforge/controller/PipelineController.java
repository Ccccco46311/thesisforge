package com.thesisforge.controller;

import com.thesisforge.common.Result;
import com.thesisforge.dto.PipelineVO;
import com.thesisforge.dto.StageActionVO;
import com.thesisforge.service.AiPipelineService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

/**
 * AI 开发流水线接口。
 */
@RestController
@RequestMapping("/api/ai/pipeline")
@RequiredArgsConstructor
public class PipelineController {

    private final AiPipelineService pipelineService;

    /**
     * 流水线状态（阶段列表 + 全能 Agent 是否解锁）。
     */
    @GetMapping
    public Result<PipelineVO> getPipeline() {
        return Result.ok(pipelineService.getPipeline());
    }

    /**
     * 启动流水线（创建第 1 阶段会话并注入引导消息）。
     */
    @PostMapping("/start")
    public Result<StageActionVO> start() {
        return Result.ok(pipelineService.start());
    }

    /**
     * 确认当前阶段完成，进入下一阶段。
     */
    @PostMapping("/stage/{code}/advance")
    public Result<StageActionVO> advance(@PathVariable String code) {
        return Result.ok(pipelineService.advance(code));
    }

    /**
     * 回退到指定阶段重跑（其后阶段全部重置为待开始）。
     */
    @PostMapping("/stage/{code}/reopen")
    public Result<StageActionVO> reopen(@PathVariable String code) {
        return Result.ok(pipelineService.reopen(code));
    }

    /**
     * 重置整条流水线（不删除 docs 产出和历史会话）。
     */
    @PostMapping("/reset")
    public Result<PipelineVO> reset() {
        return Result.ok(pipelineService.reset());
    }
}
