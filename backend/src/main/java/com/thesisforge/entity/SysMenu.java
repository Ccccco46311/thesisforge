package com.thesisforge.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 菜单。
 */
@Data
@TableName("sys_menu")
public class SysMenu {

    @TableId(type = IdType.AUTO)
    private Long id;

    /** 父菜单ID，0为根 */
    private Long parentId;

    private String menuName;

    /** 类型 M目录 C菜单 F按钮 */
    private String menuType;

    private String path;

    private String component;

    private String perms;

    private String icon;

    private Integer sortOrder;

    /** 是否显示 0隐藏 1显示 */
    private Integer visible;

    /** 状态 0禁用 1启用 */
    private Integer status;

    @TableLogic
    private Integer deleted;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
