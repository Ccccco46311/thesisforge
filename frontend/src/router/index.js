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
          path: 'ai/opencode',
          name: 'AIOpencode',
          component: () => import('@/views/ai/opencode/index.vue'),
          meta: { title: 'AI 开发' },
        },
        {
          path: 'ai/progress',
          name: 'AIProgress',
          component: () => import('@/views/ai/progress/index.vue'),
          meta: { title: '进度计划' },
        },
      ],
    },
  ],
})

// 全局前置守卫：未登录或 token 已过期跳转登录页
router.beforeEach((to, from, next) => {
  const userStore = useUserStore()
  if (to.path !== '/login' && !userStore.isLogin) {
    userStore.logout() // 清理过期 token，避免残留
    next('/login')
  } else {
    next()
  }
})

export default router
