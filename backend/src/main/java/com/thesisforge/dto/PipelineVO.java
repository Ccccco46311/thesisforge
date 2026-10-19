package com.thesisforge.dto;

import com.thesisforge.entity.AiPipelineStage;
import lombok.Data;

import java.util.List;

/**
 * 流水线状态视图。
 */
@Data
public class PipelineVO {

    private Long id;
    private String name;

    /** pending / running / done */
    private String status;

    /** 是否已解锁「全能 Agent」 */
    private Boolean unlocked;

    /** 当前阶段编码；流水线未开始或已完成时为 null */
    private String currentStage;

    /** 全部阶段（按顺序） */
    private List<AiPipelineStage> stages;
}
