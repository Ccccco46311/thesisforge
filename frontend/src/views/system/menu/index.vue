<template>
  <el-card>
    <div class="toolbar">
      <div style="flex: 1"></div>
      <el-button type="primary" @click="openDialog()">新增菜单</el-button>
    </div>

    <el-table
      :data="tree"
      v-loading="loading"
      border
      row-key="id"
      :tree-props="{ children: 'children' }"
      default-expand-all
    >
      <el-table-column prop="menuName" label="菜单名称" width="200" />
      <el-table-column label="类型" width="80">
        <template #default="{ row }">
          <el-tag v-if="row.menuType === 'M'" type="warning">目录</el-tag>
          <el-tag v-else-if="row.menuType === 'C'" type="success">菜单</el-tag>
          <el-tag v-else type="info">按钮</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="path" label="路由地址" width="160" />
      <el-table-column prop="component" label="组件路径" />
      <el-table-column prop="perms" label="权限标识" width="160" />
      <el-table-column prop="sortOrder" label="排序" width="70" />
      <el-table-column label="操作" width="160" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openDialog(row)">编辑</el-button>
          <el-button link type="danger" @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
  </el-card>

  <el-dialog v-model="dialogVisible" :title="form.id ? '编辑菜单' : '新增菜单'" width="520px">
    <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
      <el-form-item label="父级菜单" prop="parentId">
        <el-tree-select
          v-model="form.parentId"
          :data="treeOptions"
          :props="{ label: 'menuName', value: 'id', children: 'children' }"
          check-strictly
          clearable
          placeholder="不选则为顶级"
          style="width: 100%"
        />
      </el-form-item>
      <el-form-item label="菜单名称" prop="menuName">
        <el-input v-model="form.menuName" />
      </el-form-item>
      <el-form-item label="菜单类型" prop="menuType">
        <el-radio-group v-model="form.menuType">
          <el-radio value="M">目录</el-radio>
          <el-radio value="C">菜单</el-radio>
          <el-radio value="F">按钮</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="路由地址" prop="path">
        <el-input v-model="form.path" placeholder="如：system/user" />
      </el-form-item>
      <el-form-item label="组件路径" prop="component">
        <el-input v-model="form.component" placeholder="如：system/user/index" />
      </el-form-item>
      <el-form-item label="权限标识" prop="perms">
        <el-input v-model="form.perms" placeholder="如：system:user:list" />
      </el-form-item>
      <el-form-item label="图标" prop="icon">
        <el-input v-model="form.icon" placeholder="如：User" />
      </el-form-item>
      <el-form-item label="排序" prop="sortOrder">
        <el-input-number v-model="form.sortOrder" :min="0" />
      </el-form-item>
      <el-form-item label="显示" prop="visible">
        <el-switch v-model="form.visible" :active-value="1" :inactive-value="0" />
      </el-form-item>
      <el-form-item label="状态" prop="status">
        <el-switch v-model="form.status" :active-value="1" :inactive-value="0" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="save">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getMenuList, createMenu, updateMenu, deleteMenu } from '@/api/system'

const loading = ref(false)
const tree = ref([])
const dialogVisible = ref(false)
const saving = ref(false)
const formRef = ref()
const form = reactive({
  id: null,
  parentId: 0,
  menuName: '',
  menuType: 'C',
  path: '',
  component: '',
  perms: '',
  icon: '',
  sortOrder: 0,
  visible: 1,
  status: 1,
})

const rules = {
  menuName: [{ required: true, message: '请输入菜单名称', trigger: 'blur' }],
}

// 树形选择器选项（禁用当前编辑项自身，避免把自己设成自己的子级）
const treeOptions = computed(() => {
  const filter = (items) =>
    items
      .filter((item) => item.id !== form.id)
      .map((item) => ({ ...item, children: filter(item.children || []) }))
  return filter(tree.value)
})

async function load() {
  loading.value = true
  try {
    const data = await getMenuList()
    tree.value = buildTree(data)
  } finally {
    loading.value = false
  }
}

function buildTree(items) {
  const map = {}
  items.forEach((item) => (map[item.id] = { ...item, children: [] }))
  const roots = []
  items.forEach((item) => {
    const node = map[item.id]
    if (item.parentId && map[item.parentId]) {
      map[item.parentId].children.push(node)
    } else {
      roots.push(node)
    }
  })
  return roots
}

function openDialog(row) {
  Object.assign(form, {
    id: row?.id ?? null,
    parentId: row?.parentId ?? 0,
    menuName: row?.menuName ?? '',
    menuType: row?.menuType ?? 'C',
    path: row?.path ?? '',
    component: row?.component ?? '',
    perms: row?.perms ?? '',
    icon: row?.icon ?? '',
    sortOrder: row?.sortOrder ?? 0,
    visible: row?.visible ?? 1,
    status: row?.status ?? 1,
  })
  dialogVisible.value = true
}

async function save() {
  await formRef.value.validate()
  saving.value = true
  try {
    if (form.id) {
      await updateMenu(form)
    } else {
      await createMenu(form)
    }
    ElMessage.success('保存成功')
    dialogVisible.value = false
    load()
  } finally {
    saving.value = false
  }
}

async function handleDelete(row) {
  await ElMessageBox.confirm(`确定删除菜单「${row.menuName}」吗？`, '提示', { type: 'warning' })
  await deleteMenu(row.id)
  ElMessage.success('删除成功')
  load()
}

onMounted(load)
</script>

<style scoped>
.toolbar {
  display: flex;
  margin-bottom: 16px;
}
</style>
