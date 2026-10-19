package com.thesisforge.controller;

import com.thesisforge.common.BusinessException;
import com.thesisforge.common.Result;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * 流水线产出文档读取接口。
 *
 * <p>只允许读取项目 docs/ 目录下的文件，防止路径穿越。</p>
 */
@Slf4j
@RestController
@RequestMapping("/api/ai")
public class DocController {

    /** 项目根目录（后端启动目录的上一级，可用配置覆盖） */
    @Value("${thesisforge.project-root:..}")
    private String projectRoot;

    /**
     * 读取 docs/ 下的文档内容。
     */
    @GetMapping("/doc")
    public Result<String> readDoc(@RequestParam String path) {
        if (path == null || path.isBlank()) {
            throw new BusinessException("文档路径不能为空");
        }
        // 归一化并限制在 docs/ 目录内
        String normalized = path.replace('\\', '/').trim();
        if (normalized.startsWith("/")) {
            normalized = normalized.substring(1);
        }
        if (!normalized.startsWith("docs/")) {
            throw new BusinessException("只允许读取 docs/ 目录下的文档");
        }
        if (normalized.contains("..")) {
            throw new BusinessException("非法路径");
        }

        try {
            Path docsDir = Paths.get(projectRoot, "docs").toAbsolutePath().normalize();
            Path target = docsDir.resolve(normalized.substring("docs/".length())).normalize();
            if (!target.startsWith(docsDir)) {
                throw new BusinessException("非法路径");
            }
            if (!Files.exists(target)) {
                throw new BusinessException("文档尚未生成：" + normalized);
            }
            String content = Files.readString(target, StandardCharsets.UTF_8);
            return Result.ok(content);
        } catch (BusinessException e) {
            throw e;
        } catch (IOException e) {
            log.warn("读取文档失败: {} - {}", path, e.getMessage());
            throw new BusinessException("读取文档失败：" + e.getMessage());
        }
    }
}
