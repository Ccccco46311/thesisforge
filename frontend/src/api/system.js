import request from '@/utils/request'

// 认证
export const login = (data) => request.post('/auth/login', data)

// 用户管理
export const getUserPage = (params) => request.get('/system/user/page', { params })
export const getUserList = () => request.get('/system/user/list')
export const createUser = (data) => request.post('/system/user', data)
export const updateUser = (data) => request.put('/system/user', data)
export const resetPassword = (data) => request.put('/system/user/password', data)
export const deleteUser = (id) => request.delete(`/system/user/${id}`)
export const getUserRoles = (id) => request.get(`/system/user/${id}/roles`)
export const assignUserRoles = (id, roleIds) => request.put(`/system/user/${id}/roles`, roleIds)

// 角色管理
export const getRolePage = (params) => request.get('/system/role/page', { params })
export const getRoleList = () => request.get('/system/role/list')
export const createRole = (data) => request.post('/system/role', data)
export const updateRole = (data) => request.put('/system/role', data)
export const deleteRole = (id) => request.delete(`/system/role/${id}`)
export const getRoleMenus = (id) => request.get(`/system/role/${id}/menus`)
export const assignRoleMenus = (id, menuIds) => request.put(`/system/role/${id}/menus`, menuIds)

// 菜单管理
export const getMenuList = () => request.get('/system/menu/list')
export const createMenu = (data) => request.post('/system/menu', data)
export const updateMenu = (data) => request.put('/system/menu', data)
export const deleteMenu = (id) => request.delete(`/system/menu/${id}`)
