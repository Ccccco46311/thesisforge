package com.thesisforge.dto;

import lombok.Data;

import java.util.List;

/**
 * 菜单视图对象（树形，供前端渲染动态菜单）。
 */
@Data
public class MenuVO {

    private Long id;
    private Long parentId;
    private String menuName;
    private String menuType;
    private String path;
    private String component;
    private String perms;
    private String icon;
    private Integer sortOrder;
    private List<MenuVO> children;
}
