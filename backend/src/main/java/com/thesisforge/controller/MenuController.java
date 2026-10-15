package com.thesisforge.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.thesisforge.common.Result;
import com.thesisforge.entity.SysMenu;
import com.thesisforge.mapper.SysMenuMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 菜单管理。
 */
@RestController
@RequestMapping("/api/system/menu")
@RequiredArgsConstructor
public class MenuController {

    private final SysMenuMapper menuMapper;

    @GetMapping("/list")
    public Result<List<SysMenu>> list() {
        return Result.ok(menuMapper.selectList(
                new LambdaQueryWrapper<SysMenu>()
                        .orderByAsc(SysMenu::getSortOrder)
                        .orderByAsc(SysMenu::getId)));
    }

    @PostMapping
    public Result<Void> create(@RequestBody SysMenu menu) {
        if (menu.getParentId() == null) {
            menu.setParentId(0L);
        }
        if (menu.getStatus() == null) {
            menu.setStatus(1);
        }
        if (menu.getVisible() == null) {
            menu.setVisible(1);
        }
        if (menu.getSortOrder() == null) {
            menu.setSortOrder(0);
        }
        menuMapper.insert(menu);
        return Result.ok();
    }

    @PutMapping
    public Result<Void> update(@RequestBody SysMenu menu) {
        menuMapper.updateById(menu);
        return Result.ok();
    }

    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        menuMapper.deleteById(id);
        return Result.ok();
    }
}
