<template>
  <el-card>
    <template #header>
      <div class="card-header">
        <span>AI 供应商配置</span>
        <el-tag type="info" size="small">配置后写入 bridge 的 OpenCode 配置</el-tag>
      </div>
    </template>

    <el-alert
      title="说明：此处配置将应用到嵌入的 OpenCode。保存后 bridge 服务会更新配置并重启 OpenCode server 生效。"
      type="info"
      :closable="false"
      class="tip"
    />

    <el-form :model="form" label-width="120px" style="max-width: 560px; margin-top: 20px">
      <el-form-item label="供应商类型">
        <el-select v-model="form.provider" style="width: 100%">
          <el-option label="DeepSeek" value="deepseek" />
          <el-option label="OpenAI" value="openai" />
          <el-option label="Ollama（本地）" value="ollama" />
          <el-option label="自定义兼容接口" value="custom" />
        </el-select>
      </el-form-item>

      <el-form-item label="API Key">
        <el-input v-model="form.apiKey" type="password" show-password placeholder="sk-..." />
      </el-form-item>

      <el-form-item label="接口地址">
        <el-input v-model="form.baseUrl" placeholder="如：https://api.deepseek.com/v1" />
      </el-form-item>

      <el-form-item label="模型名称">
        <el-input v-model="form.model" placeholder="如：deepseek-chat" />
      </el-form-item>

      <el-divider content-position="left">数据库连接（供 AI 访问）</el-divider>

      <el-form-item label="数据库地址">
        <el-input v-model="form.dbHost" placeholder="localhost" />
      </el-form-item>
      <el-form-item label="数据库端口">
        <el-input v-model="form.dbPort" placeholder="3306" />
      </el-form-item>
      <el-form-item label="数据库名">
        <el-input v-model="form.dbName" placeholder="thesisforge" />
      </el-form-item>
      <el-form-item label="数据库账号">
        <el-input v-model="form.dbUser" placeholder="root" />
      </el-form-item>
      <el-form-item label="数据库密码">
        <el-input v-model="form.dbPassword" type="password" show-password />
      </el-form-item>

      <el-form-item>
        <el-button type="primary" :loading="saving" @click="save">保存配置</el-button>
        <el-button :loading="testing" @click="runTest">测试连接</el-button>
      </el-form-item>

      <el-form-item v-if="testResult">
        <el-alert
          :type="testResult.ok ? 'success' : 'error'"
          :title="testResult.ok ? '连接成功' : testResult.message"
          :closable="false"
          show-icon
        />
      </el-form-item>
    </el-form>
  </el-card>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { getProviderConfig, saveProviderConfig, testProviderConfig } from '@/api/ai'

const saving = ref(false)
const testing = ref(false)
const testResult = ref(null)
const form = reactive({
  provider: 'deepseek',
  apiKey: '',
  baseUrl: '',
  model: '',
  dbHost: 'localhost',
  dbPort: '3306',
  dbName: 'thesisforge',
  dbUser: 'root',
  dbPassword: '',
})

onMounted(async () => {
  try {
    const data = await getProviderConfig()
    if (data) Object.assign(form, data)
  } catch {
    // 无配置时忽略
  }
})

function validate() {
  if (!form.provider) {
    ElMessage.warning('请选择供应商类型')
    return false
  }
  if (!form.apiKey || !form.apiKey.trim()) {
    ElMessage.warning('请填写 API Key')
    return false
  }
  if (!form.baseUrl || !form.baseUrl.trim()) {
    ElMessage.warning('请填写接口地址')
    return false
  }
  if (!form.model || !form.model.trim()) {
    ElMessage.warning('请填写模型名称')
    return false
  }
  return true
}

/** 测试供应商连接（models 优先，chat 回退），返回是否成功。 */
async function runTest() {
  if (!validate()) return false
  testing.value = true
  testResult.value = null
  try {
    const r = await testProviderConfig(form)
    testResult.value = r || { ok: false, message: '测试接口没有返回结果' }
    if (r?.ok) {
      ElMessage.success('连接成功')
    } else {
      ElMessage.error(r?.message || '连接测试未通过')
    }
    return !!r?.ok
  } catch (e) {
    testResult.value = { ok: false, message: e.message || '连接测试失败' }
    return false
  } finally {
    testing.value = false
  }
}

async function save() {
  if (!validate()) return
  saving.value = true
  testResult.value = null
  try {
    // 后端保存前会强制连接测试，失败会返回具体原因
    await saveProviderConfig(form)
    ElMessage.success('配置已保存并生效')
  } catch {
    // 错误提示由 request 拦截器统一显示（含连接测试未通过的具体原因）
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.card-header {
  display: flex;
  align-items: center;
  gap: 10px;
}
.tip {
  margin-bottom: 4px;
}
</style>
