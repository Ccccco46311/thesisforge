package com.thesisforge.config;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.thesisforge.entity.SysRole;
import com.thesisforge.entity.SysUser;
import com.thesisforge.mapper.SysRoleMapper;
import com.thesisforge.mapper.SysUserMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * 启动初始化：
 * - 若无管理员，创建默认管理员 admin / admin123
 * - 默认管理员绑定"超级管理员"角色
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private final SysUserMapper userMapper;
    private final SysRoleMapper roleMapper;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) {
        Long adminCount = userMapper.selectCount(
                new LambdaQueryWrapper<SysUser>().eq(SysUser::getUsername, "admin"));
        if (adminCount > 0) {
            return;
        }

        SysUser admin = new SysUser();
        admin.setUsername("admin");
        admin.setPassword(passwordEncoder.encode("admin123"));
        admin.setNickname("系统管理员");
        admin.setEmail("admin@thesisforge.local");
        admin.setStatus(1);
        userMapper.insert(admin);

        // 绑定超级管理员角色
        SysRole adminRole = roleMapper.selectOne(
                new LambdaQueryWrapper<SysRole>().eq(SysRole::getRoleKey, "admin"));
        if (adminRole != null) {
            // 使用 MyBatis-Plus 原生插入关联（简化处理：直接执行）
            insertUserRole(admin.getId(), adminRole.getId());
        }
        log.info("已创建默认管理员 admin / admin123");
    }

    private void insertUserRole(Long userId, Long roleId) {
        // 直接通过 roleMapper 的基类方法不方便，这里用简单 SQL 执行
        roleMapper.insertUserRole(userId, roleId);
    }
}
