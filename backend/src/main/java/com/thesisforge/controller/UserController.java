package com.thesisforge.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.thesisforge.common.BusinessException;
import com.thesisforge.common.Result;
import com.thesisforge.entity.SysUser;
import com.thesisforge.mapper.SysRoleMapper;
import com.thesisforge.mapper.SysUserMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 用户管理。
 */
@RestController
@RequestMapping("/api/system/user")
@RequiredArgsConstructor
public class UserController {

    private final SysUserMapper userMapper;
    private final SysRoleMapper roleMapper;
    private final PasswordEncoder passwordEncoder;

    @GetMapping("/page")
    public Result<Page<SysUser>> page(@RequestParam(defaultValue = "1") long current,
                                      @RequestParam(defaultValue = "10") long size,
                                      @RequestParam(required = false) String keyword) {
        LambdaQueryWrapper<SysUser> qw = new LambdaQueryWrapper<SysUser>()
                .and(keyword != null && !keyword.isBlank(),
                        w -> w.like(SysUser::getUsername, keyword)
                                .or().like(SysUser::getNickname, keyword))
                .orderByDesc(SysUser::getId);
        return Result.ok(userMapper.selectPage(new Page<>(current, size), qw));
    }

    @GetMapping("/list")
    public Result<List<SysUser>> list() {
        return Result.ok(userMapper.selectList(
                new LambdaQueryWrapper<SysUser>().orderByDesc(SysUser::getId)));
    }

    @GetMapping("/{id}")
    public Result<SysUser> get(@PathVariable Long id) {
        return Result.ok(userMapper.selectById(id));
    }

    @PostMapping
    public Result<Void> create(@RequestBody SysUser user) {
        Long count = userMapper.selectCount(
                new LambdaQueryWrapper<SysUser>().eq(SysUser::getUsername, user.getUsername()));
        if (count > 0) {
            throw new BusinessException("用户名已存在");
        }
        if (user.getPassword() == null || user.getPassword().isBlank()) {
            user.setPassword("123456");
        }
        user.setPassword(passwordEncoder.encode(user.getPassword()));
        if (user.getStatus() == null) {
            user.setStatus(1);
        }
        userMapper.insert(user);
        return Result.ok();
    }

    @PutMapping
    public Result<Void> update(@RequestBody SysUser user) {
        SysUser exist = userMapper.selectById(user.getId());
        if (exist == null) {
            throw new BusinessException("用户不存在");
        }
        user.setPassword(null); // 更新不走密码字段，密码用专门接口
        userMapper.updateById(user);
        return Result.ok();
    }

    @PutMapping("/password")
    public Result<Void> resetPassword(@RequestBody Map<String, Object> body) {
        Long id = Long.valueOf(String.valueOf(body.get("id")));
        String newPassword = (String) body.get("password");
        if (newPassword == null || newPassword.isBlank()) {
            throw new BusinessException("新密码不能为空");
        }
        SysUser user = new SysUser();
        user.setId(id);
        user.setPassword(passwordEncoder.encode(newPassword));
        userMapper.updateById(user);
        return Result.ok();
    }

    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        if (id == 1L) {
            throw new BusinessException("不允许删除内置管理员");
        }
        userMapper.deleteById(id);
        roleMapper.deleteUserRoles(id); // 清理用户-角色关联
        return Result.ok();
    }

    /**
     * 查询用户已分配的角色 ID 列表。
     */
    @GetMapping("/{id}/roles")
    public Result<List<Long>> getUserRoles(@PathVariable Long id) {
        return Result.ok(roleMapper.selectRoleIdsByUserId(id));
    }

    /**
     * 保存用户的角色分配（先删后插）。
     */
    @PutMapping("/{id}/roles")
    public Result<Void> assignRoles(@PathVariable Long id,
                                    @RequestBody List<Long> roleIds) {
        if (id == 1L) {
            throw new BusinessException("内置管理员角色不可修改");
        }
        roleMapper.deleteUserRoles(id);
        if (roleIds != null) {
            for (Long roleId : roleIds) {
                roleMapper.insertUserRole(id, roleId);
            }
        }
        return Result.ok();
    }
}
