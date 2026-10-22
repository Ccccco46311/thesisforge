<template>
  <el-card>
    <div class="toolbar">
      <div style="flex: 1"></div>
      <el-button type="primary" @click="openDialog()">新增角色</el-button>
    </div>

    <el-table :data="list" v-loading="loading" border stripe>
      <el-table-column prop="id" label="ID" width="70" />
      <el-table-column prop="roleName" label="角色名" width="160" />
      <el-table-column prop="roleKey" label="角色标识" width="160" />
      <el-table-column prop="remark" label="备注" />
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-tag :type="row.status === 1 ? 'success' : 'danger'">
            {{ row.status === 1 ? '启用' : '禁用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="220" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openDialog(row)">编辑</el-button>
          <el-button link type="success" @click="openMenuDialog(row)">分配菜单</el-button>
          <el-button link type="danger" @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
  </el-card>

  <el-dialog v-model="dialogVisible" :title="form.id ? '编辑角色' : '新增角色'" width="460px">
    <el-form ref="formRef" :model="form" :rules="rules" label-width="80px">
      <el-form-item label="角色名" prop="roleName">
        <el-input v-model="form.roleName" />
      </el-form-item>
      <el-form-item label="角色标识" prop="roleKey">
        <el-input v-model="form.roleKey" :disabled="!!form.id" placeholder="如：admin" />
      </el-form-item>
      <el-form-item label="备注" prop="remark">
        <el-input v-model="form.remark" type="textarea" />
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

  <!-- 分配菜单弹窗 -->
  <el-dialog v-model="menuVisible" :title="`分配菜单 - ${menuForm.roleName}`" width="420px">
    <el-tree
      ref="menuTreeRef"
      :data="menuTree"
      show-checkbox
      node-key="id"
      :props="{ label: 'menuName', children: 'children' }"
      default-expand-all
    />
    <template #footer>
      <el-button @click="menuVisible = false">取消</el-button>
      <el-button type="primary" :loading="menuSaving" @click="saveMenus">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, onMounted, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getRolePage, createRole, updateRole, deleteRole, getRoleMenus, assignRoleMenus, getMenuList } from '@/api/system'

const loading = ref(false)
const list = ref([])
const dialogVisible = ref(false)
const saving = ref(false)
const formRef = ref()
const form = reactive({ id: null, roleName: '', roleKey: '', remark: '', status: 1 })

const rules = {
  roleName: [{ required: true, message: '请输入角色名', trigger: 'blur' }],
  roleKey: [{ required: true, message: '请输入角色标识', trigger: 'blur' }],
}

// 分配菜单
const menuVisible = ref(false)
const menuSaving = ref(false)
const menuTreeRef = ref()
const menuTree = ref([])
const menuForm = reactive({ id: null, roleName: '', menuIds: [] })

async function load() {
  loading.value = true
  try {
    const data = await getRolePage({ current: 1, size: 100 })
    list.value = data.records
  } finally {
    loading.value = false
  }
}

function openDialog(row) {
  Object.assign(form, {
    id: row?.id ?? null,
    roleName: row?.roleName ?? '',
    roleKey: row?.roleKey ?? '',
    remark: row?.remark ?? '',
    status: row?.status ?? 1,
  })
  dialogVisible.value = true
}

async function save() {
  await formRef.value.validate()
  saving.value = true
  try {
    if (form.id) {
      await updateRole(form)
    } else {
      await createRole(form)
    }
    ElMessage.success('保存成功')
    dialogVisible.value = false
    load()
  } finally {
    saving.value = false
  }
}

async function handleDelete(row) {
  await ElMessageBox.confirm(`确定删除角色「${row.roleName}」吗？`, '提示', { type: 'warning' })
  await deleteRole(row.id)
  ElMessage.success('删除成功')
  load()
}

function buildMenuTree(menus) {
  const map = {}
  menus.forEach((m) => { map[m.id] = { ...m, children: [] } })
  const roots = []
  menus.forEach((m) => {
    if (m.parentId === 0) roots.push(map[m.id])
    else if (map[m.parentId]) map[m.parentId].children.push(map[m.id])
  })
  return roots
}

async function openMenuDialog(row) {
  if (!menuTree.value.length) {
    const menus = await getMenuList()
    menuTree.value = buildMenuTree(menus)
  }
  menuForm.id = row.id
  menuForm.roleName = row.roleName
  menuVisible.value = true
  await nextTick()
  const ids = (await getRoleMenus(row.id)) || []
  menuTreeRef.value?.setCheckedKeys(ids)
}

async function saveMenus() {
  menuSaving.value = true
  try {
    const checked = menuTreeRef.value?.getCheckedKeys() || []
    const half = menuTreeRef.value?.getHalfCheckedKeys() || []
    await assignRoleMenus(menuForm.id, [...checked, ...half])
    ElMessage.success('菜单分配成功')
    menuVisible.value = false
  } finally {
    menuSaving.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.toolbar {
  display: flex;
  margin-bottom: 16px;
}
</style>
