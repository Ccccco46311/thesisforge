<template>
  <el-card class="opencode-card">
    <template #header>
      <div class="card-header">
        <span>AI 开发</span>
        <el-tag type="success" size="small">OpenCode 已嵌入</el-tag>
      </div>
    </template>
    <div class="frame-wrap">
      <iframe
        v-if="src"
        :src="src"
        class="opencode-frame"
        allow="clipboard-write; clipboard-read"
      />
      <el-empty v-else description="未配置 OpenCode 服务地址，请先在「供应商配置」填写" />
    </div>
  </el-card>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getProviderConfig } from '@/api/ai'

const src = ref('')

onMounted(async () => {
  try {
    const data = await getProviderConfig()
    if (data?.opencodeUrl) {
      src.value = data.opencodeUrl
    }
  } catch {
    // ignore
  }
})
</script>

<style scoped>
.opencode-card {
  height: calc(100vh - 120px);
  display: flex;
  flex-direction: column;
}
.card-header {
  display: flex;
  align-items: center;
  gap: 10px;
}
.frame-wrap {
  flex: 1;
  min-height: 0;
}
.opencode-frame {
  width: 100%;
  height: 100%;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #fff;
}
</style>
