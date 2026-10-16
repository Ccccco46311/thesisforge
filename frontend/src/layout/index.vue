<template>
  <el-container class="layout">
    <!-- 侧边栏 -->
    <el-aside width="220px" class="aside">
      <div class="logo">
        <span class="logo-icon">🔨</span>
        <span class="logo-text">ThesisForge</span>
      </div>
      <el-menu
        :default-active="activeMenu"
        router
        background-color="#001529"
        text-color="rgba(255,255,255,0.68)"
        active-text-color="#ffffff"
        class="menu"
      >
        <!-- 动态菜单：由后端登录接口返回的菜单树渲染 -->
        <template v-for="item in menuTree" :key="item.id">
          <!-- 目录/有子菜单 -->
          <el-sub-menu v-if="item.children && item.children.length" :index="String(item.id)">
            <template #title>
              <el-icon v-if="item.icon"><component :is="item.icon" /></el-icon>
              <span>{{ item.menuName }}</span>
            </template>
            <el-menu-item
              v-for="child in item.children"
              :key="child.id"
              :index="menuPath(child)"
            >
              <el-icon v-if="child.icon"><component :is="child.icon" /></el-icon>
              <span>{{ child.menuName }}</span>
            </el-menu-item>
          </el-sub-menu>
          <!-- 单菜单 -->
          <el-menu-item v-else :index="menuPath(item)">
            <el-icon v-if="item.icon"><component :is="item.icon" /></el-icon>
            <span>{{ item.menuName }}</span>
          </el-menu-item>
        </template>
      </el-menu>
    </el-aside>

    <el-container>
      <!-- 顶栏 -->
      <el-header class="header">
        <div class="page-title">{{ pageTitle }}</div>
        <el-dropdown @command="handleCommand">
          <span class="user-info">
            <el-icon><UserFilled /></el-icon>
            {{ userStore.userInfo?.nickname || userStore.userInfo?.username }}
            <el-icon><ArrowDown /></el-icon>
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="logout">退出登录</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </el-header>

      <!-- 主内容 -->
      <el-main class="main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import { useUserStore } from '@/store/user'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const activeMenu = computed(() => route.path)
const pageTitle = computed(() => route.meta.title || '')

/**
 * 由后端返回的菜单树计算侧边栏层级。
 * 后端返回的是扁平化的 menuType: M(目录)/C(菜单)，已按 parentId 构建好树。
 */
/**
 * 菜单树：后端登录接口已按 parentId 构建好嵌套树，直接使用。
 * 根节点：menuType=M(目录，带 children) 或 C(叶子菜单)。
 */
const menuTree = computed(() => userStore.menus || [])

/**
 * 生成菜单的完整路由路径：父级 path + '/' + 子级 path。
 * 在后端返回的嵌套树中查找父级。
 */
function menuPath(menu) {
  if (menu.parentId === 0) {
    return menu.path ? `/${menu.path}` : '/'
  }
  const parent = findInTree(userStore.menus || [], menu.parentId)
  const parentPath = parent && parent.path ? parent.path : ''
  return `/${parentPath}/${menu.path}`.replace(/\/+/g, '/')
}

/** 在嵌套菜单树中按 id 查找节点 */
function findInTree(tree, id) {
  for (const node of tree) {
    if (node.id === id) return node
    if (node.children && node.children.length) {
      const found = findInTree(node.children, id)
      if (found) return found
    }
  }
  return null
}

async function handleCommand(command) {
  if (command === 'logout') {
    await ElMessageBox.confirm('确定要退出登录吗？', '提示', { type: 'warning' })
    userStore.logout()
    router.push('/login')
  }
}
</script>

<style scoped>
.layout {
  height: 100%;
}
.aside {
  background: #001529;
  overflow-x: hidden;
}
.logo {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #fff;
  font-size: 18px;
  font-weight: 600;
}
.logo-icon {
  font-size: 22px;
}
.menu {
  border-right: none;
}
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
}
.page-title {
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
}
.user-info {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  color: #374151;
}
.main {
  background: #f5f7fa;
  padding: 16px;
}
</style>
