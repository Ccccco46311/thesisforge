package com.thesisforge.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.thesisforge.entity.SysMenu;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface SysMenuMapper extends BaseMapper<SysMenu> {

    /**
     * 查询全部可见菜单。
     */
    @Select("""
            SELECT m.*
            FROM sys_menu m
            WHERE m.deleted = 0 AND m.status = 1 AND m.visible = 1
            ORDER BY m.sort_order ASC
            """)
    List<SysMenu> selectAllVisibleMenus();

    /**
     * 查询用户可见的菜单（通过角色关联）。
     */
    @Select("""
            SELECT DISTINCT m.*
            FROM sys_menu m
            JOIN sys_role_menu rm ON rm.menu_id = m.id
            JOIN sys_user_role ur ON ur.role_id = rm.role_id
            WHERE ur.user_id = #{userId}
              AND m.deleted = 0 AND m.status = 1 AND m.visible = 1
            ORDER BY m.sort_order ASC
            """)
    List<SysMenu> selectMenusByUserId(@Param("userId") Long userId);
}
