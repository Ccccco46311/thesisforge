package com.thesisforge;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * ThesisForge 后端启动类。
 *
 * <p>AI 定制系统的核心约定：本项目源码目录（backend/）是 AI 可以直接修改的目录，
 * 修改后通过 Spring DevTools 热重载生效。</p>
 */
@SpringBootApplication
@MapperScan("com.thesisforge.**.mapper")
public class ThesisForgeApplication {

    public static void main(String[] args) {
        SpringApplication.run(ThesisForgeApplication.class, args);
    }
}
