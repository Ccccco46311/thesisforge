-- ============================================================
-- ThesisForge 迁移 V6：流水线菜单
-- 新增「AI 流水线」菜单，并把「AI 开发」调整到流水线之后
-- ============================================================

INSERT INTO sys_menu (id, parent_id, menu_name, menu_type, path, component, perms, icon, sort_order, visible, status)
VALUES (24, 20, 'AI 流水线', 'C', 'pipeline', 'ai/pipeline/index', 'ai:pipeline:list', 'Guide', 2, 1, 1);

-- AI 开发排在流水线之后（流水线完成前该页面会锁定）
UPDATE sys_menu SET sort_order = 3 WHERE id = 22;
UPDATE sys_menu SET sort_order = 4 WHERE id = 23;
