<template>
  <el-card>
    <div class="toolbar">
      <el-input
        v-model="query.keyword"
        placeholder="搜索用户名/昵称"
        clearable
        style="width: 220px"
        @keyup.enter="load"
      />
      <el-button type="primary" @click="load">查询</el-button>
      <div style="flex: 1"></div>
      <el-button type="primary" @click="openDialog()">新增用户</el-button>
    </div>

    <el-table :data="list" v-loading="loading" border stripe>
      <el-table-column prop="id" label="ID" width="70" />
      <el-table-column prop="username" label="用户名" width="140" />
      <el-table-column prop="nickname" label="昵称" width="140" />
      <el-table-column prop="email" label="邮箱" />
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-tag :type="row.status === 1 ? 'success' : 'danger'">
            {{ row.status === 1 ? '启用' : '禁用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="createdAt" label="创建时间" width="170" />
      <el-table-column label="操作" width="320" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openDialog(row)">编辑</el-button>
          <el-button link type="success" @click="openRoleDialog(row)">分配角色</el-button>
          <el-button link type="warning" @click="openPassword(row)">重置密码</el-button>
          <el-button link type="danger" @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination
      class="pager"
      v-model:current-page="query.current"
      v-model:page-size="query.size"
      :total="total"
      :page-sizes="[10, 20, 50]"
      layout="total, sizes, prev, pager, next"
      @change="load"
    />
  </el-card>

  <!-- 新增/编辑弹窗 -->
  <el-dialog v-model="dialogVisible" :title="form.id ? '编辑用户' : '新增用户'" width="460px">
    <el-form ref="formRef" :model="form" :rules="rules" label-width="80px">
      <el-form-item label="用户名" prop="username">
        <el-input v-model="form.username" :disabled="!!form.id" />
      </el-form-item>
      <el-form-item label="昵称" prop="nickname">
        <el-input v-model="form.nickname" />
      </el-form-item>
      <el-form-item label="邮箱" prop="email">
        <el-input v-model="form.email" />
      </el-form-item>
      <el-form-item label="密码" prop="password" v-if="!form.id">
        <el-input v-model="form.password" placeholder="默认 123456" />
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

  <!-- 重置密码弹窗 -->
  <el-dialog v-model="pwdVisible" title="重置密码" width="400px">
    <el-form label-width="80px">
      <el-form-item label="新密码">
        <el-input v-model="pwdForm.password" show-password />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="pwdVisible = false">取消</el-button>
      <el-button type="primary" @click="savePassword">确定</el-button>
    </template>
  </el-dialog>

  <!-- 分配角色弹窗 -->
  <el-dialog v-model="roleVisible" :title="`分配角色 - ${roleForm.username}`" width="420px">
    <el-checkbox-group v-model="roleForm.roleIds">
      <el-checkbox v-for="r in allRoles" :key="r.id" :label="r.id" class="role-item">
        {{ r.roleName }}（{{ r.roleKey }}）
      </el-checkbox>
    </el-checkbox-group>
    <template #footer>
      <el-button @click="roleVisible = false">取消</el-button>
      <el-button type="primary" :loading="roleSaving" @click="saveRoles">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getUserPage, createUser, updateUser, deleteUser, resetPassword, getUserRoles, assignUserRoles, getRoleList } from '@/api/system'

const loading = ref(false)
const list = ref([])
const total = ref(0)
const query = reactive({ current: 1, size: 10, keyword: '' })

const dialogVisible = ref(false)
const saving = ref(false)
const formRef = ref()
const form = reactive({ id: null, username: '', nickname: '', email: '', password: '', status: 1 })

const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
}

const pwdVisible = ref(false)
const pwdForm = reactive({ id: null, password: '' })

// 分配角色
const roleVisible = ref(false)
const roleSaving = ref(false)
const allRoles = ref([])
const roleForm = reactive({ id: null, username: '', roleIds: [] })

async function load() {
  loading.value = true
  try {
    const data = await getUserPage(query)
    list.value = data.records
    total.value = data.total
  } finally {
    loading.value = false
  }
}

function openDialog(row) {
  Object.assign(form, {
    id: row?.id ?? null,
    username: row?.username ?? '',
    nickname: row?.nickname ?? '',
    email: row?.email ?? '',
    password: '',
    status: row?.status ?? 1,
  })
  dialogVisible.value = true
}

async function save() {
  await formRef.value.validate()
  saving.value = true
  try {
    if (form.id) {
      await updateUser(form)
    } else {
      await createUser(form)
    }
    ElMessage.success('保存成功')
    dialogVisible.value = false
    load()
  } finally {
    saving.value = false
  }
}

function openPassword(row) {
  pwdForm.id = row.id
  pwdForm.password = ''
  pwdVisible.value = true
}

async function savePassword() {
  if (!pwdForm.password) {
    ElMessage.warning('请输入新密码')
    return
  }
  await resetPassword({ id: pwdForm.id, password: pwdForm.password })
  ElMessage.success('密码已重置')
  pwdVisible.value = false
}

async function handleDelete(row) {
  await ElMessageBox.confirm(`确定删除用户「${row.username}」吗？`, '提示', { type: 'warning' })
  await deleteUser(row.id)
  ElMessage.success('删除成功')
  load()
}

async function openRoleDialog(row) {
  if (!allRoles.value.length) {
    allRoles.value = await getRoleList()
  }
  roleForm.id = row.id
  roleForm.username = row.username
  roleForm.roleIds = (await getUserRoles(row.id)) || []
  roleVisible.value = true
}

async function saveRoles() {
  roleSaving.value = true
  try {
    await assignUserRoles(roleForm.id, roleForm.roleIds)
    ElMessage.success('角色分配成功')
    roleVisible.value = false
  } finally {
    roleSaving.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.toolbar {
  display: flex;
  gap: 10px;
  margin-bottom: 16px;
}
.pager {
  margin-top: 16px;
  justify-content: flex-end;
}
.role-item {
  display: flex;
  margin-right: 0;
  margin-bottom: 8px;
}
</style>
