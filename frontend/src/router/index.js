import { createRouter, createWebHistory } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/store/user'

// ===== AI 定制业务路由（隔离目录）=====
// 约定路径：../views/ai-biz/routes.js。
// 该文件不存在时（干净 clone / 无 AI 定制），glob 返回空对象，不影响框架构建。
// AI 新增页面只改该文件，不再修改本框架 router。
const aiRouteModules = import.meta.glob('../views/ai-biz/routes.js', { eager: true })
const aiRoutes = Object.values(aiRouteModules)[0]?.default || {}
const aiTopLevel = aiRoutes.topLevel || []
const aiAdminChildren = aiRoutes.adminChildren || []

const router = createRouter({
  history: createWebHistory(),
  routes: [
    // AI 定制：独立布局的顶层路由（注册页、商城前台等）
    ...aiTopLevel,
    {
      path: '/login',
      name: 'Login',
      component: () => import('@/views/login/index.vue'),
    },
    {
      path: '/',
      component: () => import('@/layout/index.vue'),
      redirect: '/dashboard',
      // 后台布局及其所有子路由仅管理员可访问；商城前台在 /mall 下独立判断。
      meta: { requiresAdmin: true },
      children: [
        {
          path: 'dashboard',
          name: 'Dashboard',
          component: () => import('@/views/dashboard/index.vue'),
          meta: { title: '首页' },
        },
        // 系统管理
        {
          path: 'system/user',
          name: 'SystemUser',
          component: () => import('@/views/system/user/index.vue'),
          meta: { title: '用户管理' },
        },
        {
          path: 'system/role',
          name: 'SystemRole',
          component: () => import('@/views/system/role/index.vue'),
          meta: { title: '角色管理' },
        },
        {
          path: 'system/menu',
          name: 'SystemMenu',
          component: () => import('@/views/system/menu/index.vue'),
          meta: { title: '菜单管理' },
        },
        // AI 定制（框架能力：供应商配置 / 流水线 / 开发聊天）
        {
          path: 'ai/config',
          name: 'AIConfig',
          component: () => import('@/views/ai/config/index.vue'),
          meta: { title: 'AI 供应商配置' },
        },
        {
          path: 'ai/pipeline',
          name: 'AIPipeline',
          component: () => import('@/views/ai/pipeline/index.vue'),
          meta: { title: 'AI 流水线' },
        },
        {
          path: 'ai/opencode',
          name: 'AIOpencode',
          component: () => import('@/views/ai/opencode/index.vue'),
          meta: { title: 'AI 开发' },
        },
        // AI 定制业务：管理端（隔离目录 ai-biz，路由来自 ../views/ai-biz/routes.js）
        ...aiAdminChildren,
      ],
    },
  ],
})

// 全局前置守卫：未登录或 token 已过期跳转登录页。
// 公开页统一用 meta.public 标记（AI 路由在隔离文件里自行声明），框架不再硬编码业务路径。
router.beforeEach((to, from, next) => {
  const userStore = useUserStore()
  const isPublic = to.meta?.public === true || to.path === '/login'
  if (!isPublic && !userStore.isLogin) {
    userStore.logout() // 清理过期 token，避免残留
    next('/login')
    return
  }

  // 后台路由（/dashboard、/system/**、/ai/**、AI 业务管理端）仅 admin 可进。
  const requiresAdmin = to.meta?.requiresAdmin === true
  const isAdmin = (userStore.userInfo?.roles || []).includes('admin')
  if (requiresAdmin && !isAdmin) {
    ElMessage.warning('没有访问权限')
    next(router.hasRoute('MallHome') ? '/mall/home' : '/login')
    return
  }

  next()
})

export default router
