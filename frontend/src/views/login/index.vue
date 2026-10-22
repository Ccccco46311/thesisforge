<template>
  <div class="login-page">
    <div class="login-card">
      <div class="login-title">
        <span class="login-icon">🔨</span>
        <h2>ThesisForge</h2>
        <p>让 AI 帮你锻造自己的毕设系统</p>
      </div>
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        size="large"
        @keyup.enter="handleLogin"
      >
        <el-form-item prop="username">
          <el-input v-model="form.username" placeholder="用户名" :prefix-icon="User" />
        </el-form-item>
        <el-form-item prop="password">
          <el-input
            v-model="form.password"
            type="password"
            placeholder="密码"
            show-password
            :prefix-icon="Lock"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" class="login-btn" :loading="loading" @click="handleLogin">
            登 录
          </el-button>
        </el-form-item>
      </el-form>
      <div class="login-tip">默认账号：admin / admin123</div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { User, Lock } from '@element-plus/icons-vue'
import { login } from '@/api/system'
import { useUserStore } from '@/store/user'

const router = useRouter()
const userStore = useUserStore()
const formRef = ref()
const loading = ref(false)

const form = reactive({
  username: 'admin',
  password: 'admin123',
})

const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
}

async function handleLogin() {
  await formRef.value.validate()
  loading.value = true
  try {
    const data = await login(form)
    userStore.setLogin(data)
    ElMessage.success('登录成功')
    // 角色分流：管理员进管理后台，普通用户进商城端
    const isAdmin = (data.roles || []).includes('admin')
    router.push(isAdmin ? '/dashboard' : '/mall/home')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1f2937 0%, #111827 100%);
}
.login-card {
  width: 400px;
  background: #fff;
  border-radius: 12px;
  padding: 40px 36px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
}
.login-title {
  text-align: center;
  margin-bottom: 28px;
}
.login-icon {
  font-size: 40px;
}
.login-title h2 {
  margin-top: 8px;
  font-size: 24px;
  color: #111827;
}
.login-title p {
  margin-top: 6px;
  font-size: 13px;
  color: #9ca3af;
}
.login-btn {
  width: 100%;
}
.login-tip {
  margin-top: 12px;
  text-align: center;
  font-size: 12px;
  color: #9ca3af;
}
</style>
