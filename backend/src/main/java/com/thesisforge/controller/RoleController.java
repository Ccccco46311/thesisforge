package com.thesisforge.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.thesisforge.common.BusinessException;
import com.thesisforge.common.Result;
import com.thesisforge.entity.SysRole;
import com.thesisforge.mapper.SysRoleMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 角色管理。
 */
@RestController
@RequestMapping("/api/system/role")
@RequiredArgsConstructor
public class RoleController {

    private final SysRoleMapper roleMapper;

    @GetMapping("/page")
    public Result<Page<SysRole>> page(@RequestParam(defaultValue = "1") long current,
                                      @RequestParam(defaultValue = "10") long size) {
        return Result.ok(roleMapper.selectPage(new Page<>(current, size),
                new LambdaQueryWrapper<SysRole>().orderByAsc(SysRole::getId)));
    }

    @GetMapping("/list")
    public Result<List<SysRole>> list() {
        return Result.ok(roleMapper.selectList(
                new LambdaQueryWrapper<SysRole>().orderByAsc(SysRole::getId)));
    }

    @PostMapping
    public Result<Void> create(@RequestBody SysRole role) {
        Long count = roleMapper.selectCount(
                new LambdaQueryWrapper<SysRole>().eq(SysRole::getRoleKey, role.getRoleKey()));
        if (count > 0) {
            throw new BusinessException("角色标识已存在");
        }
        if (role.getStatus() == null) {
            role.setStatus(1);
        }
        roleMapper.insert(role);
        return Result.ok();
    }

    @PutMapping
    public Result<Void> update(@RequestBody SysRole role) {
        roleMapper.updateById(role);
        return Result.ok();
    }

    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        if (id == 1L) {
            throw new BusinessException("不允许删除内置角色");
        }
        roleMapper.deleteById(id);
        return Result.ok();
    }
}
