package com.thesisforge.controller;

import com.thesisforge.common.Result;
import com.thesisforge.dto.CreatePlanDTO;
import com.thesisforge.dto.PlanVO;
import com.thesisforge.dto.ProviderConfigDTO;
import com.thesisforge.entity.AiNode;
import com.thesisforge.service.AiService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * AI 定制模块接口。
 */
@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
public class AiController {

    private final AiService aiService;

    // ---------- 供应商配置 ----------

    @GetMapping("/provider-config")
    public Result<ProviderConfigDTO> getProviderConfig() {
        return Result.ok(aiService.getProviderConfig());
    }

    @PostMapping("/provider-config")
    public Result<Void> saveProviderConfig(@RequestBody ProviderConfigDTO dto) {
        aiService.saveProviderConfig(dto);
        return Result.ok();
    }

    // ---------- 进度计划 ----------

    @GetMapping("/plan")
    public Result<PlanVO> getCurrentPlan() {
        return Result.ok(aiService.getCurrentPlan());
    }

    @PostMapping("/plan")
    public Result<PlanVO> createPlan(@RequestBody CreatePlanDTO dto) {
        return Result.ok(aiService.createPlan(dto));
    }

    @PutMapping("/plan/item/{id}")
    public Result<Void> updatePlanItem(@PathVariable Long id,
                                       @RequestBody Map<String, String> body) {
        aiService.updatePlanItem(id, body.get("title"), body.get("description"), body.get("status"));
        return Result.ok();
    }

    @PostMapping("/plan/item/{id}/complete")
    public Result<AiNode> completePlanItem(@PathVariable Long id) {
        return Result.ok(aiService.completePlanItem(id));
    }

    // ---------- 节点 ----------

    @GetMapping("/node")
    public Result<List<AiNode>> listNodes(@RequestParam(required = false) Long planId) {
        return Result.ok(aiService.listNodes(planId));
    }

    @GetMapping("/node/{id}")
    public Result<AiNode> getNode(@PathVariable Long id) {
        return Result.ok(aiService.getNode(id));
    }
}
