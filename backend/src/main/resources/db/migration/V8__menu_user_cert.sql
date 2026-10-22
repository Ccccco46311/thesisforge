-- ============================================================
-- ThesisForge 迁移 V8：管理端菜单补充
-- 校园认证信息查看页（子功能 2 产出），顶层菜单，admin 自动可见
-- ============================================================

INSERT INTO sys_menu (id, parent_id, menu_name, menu_type, path, component, perms, icon, sort_order, visible, status)
VALUES (25, 0, '校园认证信息', 'C', 'admin/user-cert', 'ai-biz/admin/user-cert/index', 'system:cert:list', 'Stamp', 30, 1, 1);
