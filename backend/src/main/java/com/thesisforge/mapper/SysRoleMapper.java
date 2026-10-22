package com.thesisforge.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.thesisforge.entity.SysRole;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface SysRoleMapper extends BaseMapper<SysRole> {

    /**
     * 查询用户拥有的角色标识。
     */
    @Select("""
            SELECT r.role_key
            FROM sys_role r
            JOIN sys_user_role ur ON ur.role_id = r.id
            WHERE ur.user_id = #{userId} AND r.deleted = 0 AND r.status = 1
            """)
    List<String> selectRoleKeysByUserId(@Param("userId") Long userId);

    /**
     * 插入用户-角色关联。
     */
    @Insert("INSERT INTO sys_user_role (user_id, role_id) VALUES (#{userId}, #{roleId})")
    int insertUserRole(@Param("userId") Long userId, @Param("roleId") Long roleId);

    /**
     * 查询用户已分配的角色 ID 列表。
     */
    @Select("SELECT role_id FROM sys_user_role WHERE user_id = #{userId}")
    List<Long> selectRoleIdsByUserId(@Param("userId") Long userId);

    /**
     * 删除用户的全部角色关联。
     */
    @Delete("DELETE FROM sys_user_role WHERE user_id = #{userId}")
    int deleteUserRoles(@Param("userId") Long userId);

    /**
     * 删除角色时清理其所有用户关联。
     */
    @Delete("DELETE FROM sys_user_role WHERE role_id = #{roleId}")
    int deleteUserRoleByRoleId(@Param("roleId") Long roleId);
}
