<template>
  <div class="mermaid-block">
    <div v-if="error" class="mermaid-error">
      <div class="error-title">图表渲染失败</div>
      <pre class="error-code">{{ code }}</pre>
      <div class="error-msg">{{ error }}</div>
    </div>
    <div v-else ref="el" class="mermaid-target" />
  </div>
</template>

<script setup>
import { ref, watch, onMounted, nextTick } from 'vue'

const props = defineProps({
  code: { type: String, required: true },
})

const el = ref(null)
const error = ref('')
let mermaidApi = null
let seq = 0

/**
 * 懒加载 mermaid（体积较大，避免拖慢首屏）。
 */
async function loadMermaid() {
  if (mermaidApi) return mermaidApi
  const mod = await import('mermaid')
  mermaidApi = mod.default
  mermaidApi.initialize({
    startOnLoad: false,
    theme: 'default',
    securityLevel: 'loose',
    fontFamily: 'inherit',
  })
  return mermaidApi
}

async function render() {
  if (!props.code || !el.value) return
  error.value = ''
  try {
    const api = await loadMermaid()
    const id = `mermaid-${Date.now()}-${seq++}`
    const { svg } = await api.render(id, props.code)
    await nextTick()
    if (el.value) el.value.innerHTML = svg
  } catch (e) {
    error.value = e?.message || String(e)
  }
}

onMounted(render)
watch(() => props.code, render)
</script>

<style scoped>
.mermaid-block {
  margin: 12px 0;
  padding: 12px;
  background: #fafbfc;
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  overflow-x: auto;
}
.mermaid-target :deep(svg) {
  max-width: 100%;
  height: auto;
}
.mermaid-error {
  color: #f56c6c;
  font-size: 13px;
}
.error-title {
  font-weight: 600;
  margin-bottom: 6px;
}
.error-code {
  background: #fff5f5;
  padding: 8px;
  border-radius: 4px;
  overflow-x: auto;
  font-size: 12px;
  color: #606266;
}
.error-msg {
  margin-top: 6px;
  font-size: 12px;
  color: #909399;
}
</style>
