package com.thesisforge.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.thesisforge.client.BridgeClient;
import com.thesisforge.common.BusinessException;
import com.thesisforge.dto.CreatePlanDTO;
import com.thesisforge.dto.PlanVO;
import com.thesisforge.dto.ProviderConfigDTO;
import com.thesisforge.entity.*;
import com.thesisforge.mapper.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * AI 定制服务：供应商配置、进度计划、节点认定。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AiService {

    private final AiProviderConfigMapper providerConfigMapper;
    private final AiPlanMapper planMapper;
    private final AiPlanItemMapper planItemMapper;
    private final AiNodeMapper nodeMapper;
    private final BridgeClient bridgeClient;
    private final ObjectMapper objectMapper;

    // ================ 供应商配置 ================

    public ProviderConfigDTO getProviderConfig() {
        AiProviderConfig config = providerConfigMapper.selectById(1L);
        if (config == null) {
            return new ProviderConfigDTO();
        }
        ProviderConfigDTO dto = new ProviderConfigDTO();
        dto.setProvider(config.getProvider());
        dto.setApiKey(config.getApiKey());
        dto.setBaseUrl(config.getBaseUrl());
        dto.setModel(config.getModel());
        dto.setDbHost(config.getDbHost());
        dto.setDbPort(config.getDbPort());
        dto.setDbName(config.getDbName());
        dto.setDbUser(config.getDbUser());
        dto.setDbPassword(config.getDbPassword());
        dto.setOpencodeUrl(config.getOpencodeUrl());
        return dto;
    }

    public void saveProviderConfig(ProviderConfigDTO dto) {
        AiProviderConfig config = providerConfigMapper.selectById(1L);
        if (config == null) {
            config = new AiProviderConfig();
            config.setId(1L);
        }
        config.setProvider(dto.getProvider());
        config.setApiKey(dto.getApiKey());
        config.setBaseUrl(dto.getBaseUrl());
        config.setModel(dto.getModel());
        config.setDbHost(dto.getDbHost());
        config.setDbPort(dto.getDbPort());
        config.setDbName(dto.getDbName());
        config.setDbUser(dto.getDbUser());
        config.setDbPassword(dto.getDbPassword());
        config.setOpencodeUrl(dto.getOpencodeUrl());

        if (config.getId() == null) {
            providerConfigMapper.insert(config);
        } else {
            providerConfigMapper.updateById(config);
        }

        // 同步到 bridge，让 OpenCode 生效（bridge 不可用则记录日志，不阻塞）
        Map<String, String> bridgeConfig = new HashMap<>();
        bridgeConfig.put("provider", dto.getProvider());
        bridgeConfig.put("apiKey", dto.getApiKey());
        bridgeConfig.put("baseUrl", dto.getBaseUrl());
        bridgeConfig.put("model", dto.getModel());
        bridgeConfig.put("dbHost", dto.getDbHost());
        bridgeConfig.put("dbPort", dto.getDbPort());
        bridgeConfig.put("dbName", dto.getDbName());
        bridgeConfig.put("dbUser", dto.getDbUser());
        bridgeConfig.put("dbPassword", dto.getDbPassword());
        bridgeConfig.put("opencodeUrl", dto.getOpencodeUrl());
        bridgeClient.applyProviderConfig(bridgeConfig);
    }

    // ================ 进度计划 ================

    /**
     * 获取当前（最近一条）进度计划及其子功能、节点。
     */
    public PlanVO getCurrentPlan() {
        AiPlan plan = planMapper.selectOne(
                new LambdaQueryWrapper<AiPlan>()
                        .orderByDesc(AiPlan::getId)
                        .last("LIMIT 1"));
        if (plan == null) {
            return null;
        }
        return buildPlanVO(plan);
    }

    @Transactional
    public PlanVO createPlan(CreatePlanDTO dto) {
        if (dto.getTitle() == null || dto.getTitle().isBlank()) {
            throw new BusinessException("计划标题不能为空");
        }
        if (dto.getItems() == null || dto.getItems().isEmpty()) {
            throw new BusinessException("至少需要一个子功能");
        }

        AiPlan plan = new AiPlan();
        plan.setTitle(dto.getTitle());
        plan.setDescription(dto.getDescription());
        plan.setStatus("pending");
        planMapper.insert(plan);

        int seq = 1;
        for (CreatePlanDTO.Item item : dto.getItems()) {
            AiPlanItem planItem = new AiPlanItem();
            planItem.setPlanId(plan.getId());
            planItem.setSeq(seq++);
            planItem.setTitle(item.getTitle());
            planItem.setDescription(item.getDescription());
            planItem.setStatus("pending");
            planItemMapper.insert(planItem);
        }
        return buildPlanVO(plan);
    }

    public void updatePlanItem(Long itemId, String title, String description, String status) {
        AiPlanItem item = planItemMapper.selectById(itemId);
        if (item == null) {
            throw new BusinessException("子功能不存在");
        }
        if (title != null) {
            item.setTitle(title);
        }
        if (description != null) {
            item.setDescription(description);
        }
        if (status != null) {
            item.setStatus(status);
        }
        planItemMapper.updateById(item);
    }

    /**
     * 完成子功能，认定节点。
     */
    @Transactional
    public AiNode completePlanItem(Long itemId) {
        AiPlanItem item = planItemMapper.selectById(itemId);
        if (item == null) {
            throw new BusinessException("子功能不存在");
        }
        if ("done".equals(item.getStatus())) {
            throw new BusinessException("该子功能已完成并认定过节点");
        }

        // 1. 通知 bridge 提交代码（bridge 不可用则 commit 为 null，不阻塞）
        String commitHash = bridgeClient.commit(
                "ThesisForge: 完成子功能「" + item.getTitle() + "」");

        // 2. 更新子功能状态
        item.setStatus("done");
        planItemMapper.updateById(item);

        // 3. 更新计划状态
        AiPlan plan = planMapper.selectById(item.getPlanId());
        if (plan != null && !"done".equals(plan.getStatus())) {
            plan.setStatus("doing");
            planMapper.updateById(plan);
        }

        // 4. 记录节点
        AiNode node = new AiNode();
        node.setPlanId(item.getPlanId());
        node.setPlanItemId(item.getId());
        node.setTitle("完成「" + item.getTitle() + "」");
        node.setDescription(item.getDescription());
        node.setGitCommit(commitHash);
        node.setFilesChanged("[]");
        node.setMigrations("[]");
        node.setHasDataChange(0);
        nodeMapper.insert(node);
        log.info("节点已认定: item={}, commit={}", item.getTitle(), commitHash);
        return node;
    }

    // ================ 节点查询 ================

    public List<AiNode> listNodes(Long planId) {
        return nodeMapper.selectList(new LambdaQueryWrapper<AiNode>()
                .eq(planId != null, AiNode::getPlanId, planId)
                .orderByAsc(AiNode::getId));
    }

    public AiNode getNode(Long id) {
        return nodeMapper.selectById(id);
    }

    // ================ 内部工具 ================

    private PlanVO buildPlanVO(AiPlan plan) {
        PlanVO vo = new PlanVO();
        vo.setPlan(plan);
        vo.setItems(planItemMapper.selectList(
                new LambdaQueryWrapper<AiPlanItem>()
                        .eq(AiPlanItem::getPlanId, plan.getId())
                        .orderByAsc(AiPlanItem::getSeq)));
        vo.setNodes(nodeMapper.selectList(
                new LambdaQueryWrapper<AiNode>()
                        .eq(AiNode::getPlanId, plan.getId())
                        .orderByAsc(AiNode::getId)));
        return vo;
    }
}
