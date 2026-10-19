package com.thesisforge.constant;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

import java.util.Arrays;
import java.util.List;

/**
 * AI 开发流水线阶段定义。
 *
 * <p>阶段顺序固定为：环境搭建 → 需求核对 → 进度计划 → 系统设计 → 开发 → 测试 → 验收交付。
 * 每个阶段对应一个 OpenCode agent（同 code），拥有独立的系统提示词和产出文档。</p>
 */
@Getter
@RequiredArgsConstructor
public enum PipelineStage {

    ENVIRONMENT("environment", "环境搭建", 1,
            "docs/environment-report.md",
            "environment"),

    REQUIREMENT("requirement", "需求核对", 2,
            "docs/requirements.md",
            "requirement"),

    PLANNING("planning", "进度计划", 3,
            "docs/plan.md",
            "planning"),

    DESIGN("design", "系统设计", 4,
            "docs/system-design.md",
            "design"),

    DEVELOPMENT("development", "开发", 5,
            null,
            "development"),

    TESTING("testing", "测试", 6,
            "docs/test-report.md",
            "testing"),

    ACCEPTANCE("acceptance", "验收交付", 7,
            "docs/acceptance.md",
            "acceptance");

    /** 阶段编码 */
    private final String code;
    /** 阶段中文名 */
    private final String name;
    /** 顺序，从 1 开始 */
    private final int seq;
    /** 产出文档路径，null 表示该阶段不产出文档 */
    private final String outputPath;
    /** 对应的 OpenCode agent ID */
    private final String agentId;

    /** 全部阶段（按顺序） */
    public static final List<PipelineStage> ALL = Arrays.asList(values());

    public static PipelineStage of(String code) {
        for (PipelineStage s : values()) {
            if (s.code.equals(code)) {
                return s;
            }
        }
        return null;
    }

    /**
     * 下一个阶段，最后一个阶段返回 null。
     */
    public PipelineStage next() {
        int idx = ALL.indexOf(this);
        return idx >= 0 && idx + 1 < ALL.size() ? ALL.get(idx + 1) : null;
    }

    public boolean isLast() {
        return ALL.indexOf(this) == ALL.size() - 1;
    }
}
