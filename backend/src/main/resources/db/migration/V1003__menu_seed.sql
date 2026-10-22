-- ============================================================
-- ThesisForge 迁移 V3：菜单种子数据
-- 初始化系统菜单（与前端路由/侧边栏对应）
-- ============================================================

-- 首页
INSERT INTO sys_menu (id, parent_id, menu_name, menu_type, path, component, perms, icon, sort_order, visible, status)
VALUES (1, 0, '首页', 'C', 'dashboard', 'dashboard/index', NULL, 'HomeFilled', 1, 1, 1);

-- 系统管理
INSERT INTO sys_menu (id, parent_id, menu_name, menu_type, path, component, perms, icon, sort_order, visible, status)
VALUES (10, 0, '系统管理', 'M', 'system', NULL, NULL, 'Setting', 10, 1, 1);

INSERT INTO sys_menu (id, parent_id, menu_name, menu_type, path, component, perms, icon, sort_order, visible, status)
VALUES (11, 10, '用户管理', 'C', 'user', 'system/user/index', 'system:user:list', 'User', 1, 1, 1);

INSERT INTO sys_menu (id, parent_id, menu_name, menu_type, path, component, perms, icon, sort_order, visible, status)
VALUES (12, 10, '角色管理', 'C', 'role', 'system/role/index', 'system:role:list', 'Avatar', 2, 1, 1);

INSERT INTO sys_menu (id, parent_id, menu_name, menu_type, path, component, perms, icon, sort_order, visible, status)
VALUES (13, 10, '菜单管理', 'C', 'menu', 'system/menu/index', 'system:menu:list', 'Menu', 3, 1, 1);

-- AI定制
INSERT INTO sys_menu (id, parent_id, menu_name, menu_type, path, component, perms, icon, sort_order, visible, status)
VALUES (20, 0, 'AI定制', 'M', 'ai', NULL, NULL, 'MagicStick', 20, 1, 1);

INSERT INTO sys_menu (id, parent_id, menu_name, menu_type, path, component, perms, icon, sort_order, visible, status)
VALUES (21, 20, '供应商配置', 'C', 'config', 'ai/config/index', 'ai:config:list', 'Connection', 1, 1, 1);

INSERT INTO sys_menu (id, parent_id, menu_name, menu_type, path, component, perms, icon, sort_order, visible, status)
VALUES (22, 20, 'AI 开发', 'C', 'opencode', 'ai/opencode/index', 'ai:opencode:list', 'ChatDotRound', 2, 1, 1);

INSERT INTO sys_menu (id, parent_id, menu_name, menu_type, path, component, perms, icon, sort_order, visible, status)
VALUES (23, 20, '进度计划', 'C', 'progress', 'ai/progress/index', 'ai:plan:list', 'List', 3, 1, 1);
