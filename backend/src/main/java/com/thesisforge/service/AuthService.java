package com.thesisforge.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.thesisforge.common.BusinessException;
import com.thesisforge.dto.LoginRequest;
import com.thesisforge.dto.LoginResponse;
import com.thesisforge.dto.MenuVO;
import com.thesisforge.entity.SysMenu;
import com.thesisforge.entity.SysUser;
import com.thesisforge.mapper.SysMenuMapper;
import com.thesisforge.mapper.SysRoleMapper;
import com.thesisforge.mapper.SysUserMapper;
import com.thesisforge.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

/**
 * 认证服务。
 */
@Service
@RequiredArgsConstructor
public class AuthService {

    private final SysUserMapper userMapper;
    private final SysRoleMapper roleMapper;
    private final SysMenuMapper menuMapper;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    public LoginResponse login(LoginRequest req) {
        SysUser user = userMapper.selectOne(
                new LambdaQueryWrapper<SysUser>().eq(SysUser::getUsername, req.getUsername()));
        if (user == null || !passwordEncoder.matches(req.getPassword(), user.getPassword())) {
            throw new BusinessException("用户名或密码错误");
        }
        if (user.getStatus() != null && user.getStatus() == 0) {
            throw new BusinessException("账号已被禁用");
        }

        String token = jwtUtil.generateToken(user.getId(), user.getUsername());
        List<String> roles = roleMapper.selectRoleKeysByUserId(user.getId());
        boolean isAdmin = roles.contains("admin");
        List<SysMenu> menus = isAdmin
                ? menuMapper.selectAllVisibleMenus()
                : menuMapper.selectMenusByUserId(user.getId());

        return new LoginResponse(
                token,
                user.getId(),
                user.getUsername(),
                user.getNickname(),
                roles,
                buildMenuTree(menus)
        );
    }

    /**
     * 将菜单列表构建为树。
     */
    public static List<MenuVO> buildMenuTree(List<SysMenu> menus) {
        List<MenuVO> tree = new ArrayList<>();
        for (SysMenu m : menus) {
            if (m.getParentId() == 0) {
                tree.add(toVO(m, menus));
            }
        }
        return tree;
    }

    private static MenuVO toVO(SysMenu m, List<SysMenu> all) {
        MenuVO vo = new MenuVO();
        vo.setId(m.getId());
        vo.setParentId(m.getParentId());
        vo.setMenuName(m.getMenuName());
        vo.setMenuType(m.getMenuType());
        vo.setPath(m.getPath());
        vo.setComponent(m.getComponent());
        vo.setPerms(m.getPerms());
        vo.setIcon(m.getIcon());
        vo.setSortOrder(m.getSortOrder());
        List<MenuVO> children = new ArrayList<>();
        for (SysMenu child : all) {
            if (child.getParentId() != null && child.getParentId().equals(m.getId())) {
                children.add(toVO(child, all));
            }
        }
        vo.setChildren(children);
        return vo;
    }
}
