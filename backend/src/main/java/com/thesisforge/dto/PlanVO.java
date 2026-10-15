package com.thesisforge.dto;

import com.thesisforge.entity.AiNode;
import com.thesisforge.entity.AiPlan;
import com.thesisforge.entity.AiPlanItem;
import lombok.Data;

import java.util.List;

/**
 * 进度计划视图（含子功能列表）。
 */
@Data
public class PlanVO {

    private AiPlan plan;
    private List<AiPlanItem> items;
    private List<AiNode> nodes;
}
