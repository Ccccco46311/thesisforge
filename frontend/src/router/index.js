import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '@/store/user'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'Login',
      component: () => import('@/views/login/index.vue'),
    },
    {
      path: '/register',
      name: 'Register',
      component: () => import('@/views/ai-biz/register/index.vue'),
    },
    // ===== AI 定制业务：用户端（商城前台布局，隔离目录 ai-biz）=====
    {
      path: '/mall',
      component: () => import('@/views/ai-biz/layout/UserLayout.vue'),
      redirect: '/mall/home',
      children: [
        {
          path: 'home',
          name: 'MallHome',
          component: () => import('@/views/ai-biz/home/index.vue'),
          meta: { title: '商城首页' },
        },
        {
          path: 'profile',
          name: 'MallProfile',
          component: () => import('@/views/ai-biz/profile/index.vue'),
          meta: { title: '个人中心' },
        },
        // 后续子功能在 ai-biz 下追加用户端页面路由（商品/求购/订单/钱包/私信/个人中心）
      ],
    },
    {
      path: '/',
      component: () => import('@/layout/index.vue'),
      redirect: '/dashboard',
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
        // AI定制
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
        // AI 定制业务：管理端（隔离目录 ai-biz）
        {
          path: 'admin/user-cert',
          name: 'AdminUserCert',
          component: () => import('@/views/ai-biz/admin/user-cert/index.vue'),
          meta: { title: '校园认证信息' },
        },
      ],
    },
  ],
})

// 全局前置守卫：未登录或 token 已过期跳转登录页
router.beforeEach((to, from, next) => {
  const userStore = useUserStore()
  const publicPages = ['/login', '/register']
  if (!publicPages.includes(to.path) && !userStore.isLogin) {
    userStore.logout() // 清理过期 token，避免残留
    next('/login')
  } else {
    next()
  }
})

export default router
