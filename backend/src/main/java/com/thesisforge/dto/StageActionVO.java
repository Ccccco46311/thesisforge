package com.thesisforge.dto;

import lombok.Data;

/**
 * 阶段推进/回退结果。
 */
@Data
public class StageActionVO {

    /** 被操作的阶段编码 */
    private String stageCode;

    /** 操作后的流水线状态 */
    private PipelineVO pipeline;

    /** 本次创建的 OpenCode session ID（advance 时有值） */
    private String sessionId;

    /** 提示信息 */
    private String message;
}
