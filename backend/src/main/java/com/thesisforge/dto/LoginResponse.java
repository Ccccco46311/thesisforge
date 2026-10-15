package com.thesisforge.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.List;

@Data
@AllArgsConstructor
public class LoginResponse {

    private String token;
    private Long userId;
    private String username;
    private String nickname;
    private List<String> roles;
    /** 用户可见菜单（用于前端动态路由） */
    private List<com.thesisforge.dto.MenuVO> menus;
}
