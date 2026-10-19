<template>
  <div class="doc-preview">
    <el-empty v-if="!path" description="本阶段暂无产出文档" :image-size="80" />
    <div v-else-if="loading" class="doc-loading">
      <el-icon class="is-loading"><Loading /></el-icon>
      <span>加载中…</span>
    </div>
    <el-empty v-else-if="error" :description="error" :image-size="80" />
    <div v-else class="doc-body">
      <div class="doc-toolbar">
        <span class="doc-path">{{ path }}</span>
        <el-button size="small" text @click="refresh">刷新</el-button>
      </div>
      <template v-for="(block, idx) in blocks" :key="idx">
        <MermaidBlock v-if="block.type === 'mermaid'" :code="block.content" />
        <div v-else class="markdown-body" v-html="renderMd(block.content)" />
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import { Loading } from '@element-plus/icons-vue'
import { marked } from 'marked'
import MermaidBlock from '@/components/MermaidBlock.vue'
import request from '@/utils/request'

const props = defineProps({
  path: { type: String, default: '' },
})

const blocks = ref([])
const loading = ref(false)
const error = ref('')

marked.setOptions({ gfm: true, breaks: true })

/**
 * 把 Markdown 按 ```mermaid 代码块切分成普通文本块和图表块。
 */
function splitBlocks(md) {
  const result = []
  const regex = /```mermaid\s*\n([\s\S]*?)```/g
  let lastIndex = 0
  let m
  while ((m = regex.exec(md)) !== null) {
    const before = md.slice(lastIndex, m.index)
    if (before.trim()) result.push({ type: 'markdown', content: before })
    result.push({ type: 'mermaid', content: m[1].trim() })
    lastIndex = m.index + m[0].length
  }
  const rest = md.slice(lastIndex)
  if (rest.trim()) result.push({ type: 'markdown', content: rest })
  return result
}

async function load() {
  if (!props.path) {
    blocks.value = []
    return
  }
  loading.value = true
  error.value = ''
  try {
    const content = await request.get('/ai/doc', { params: { path: props.path } })
    blocks.value = splitBlocks(content || '')
  } catch (e) {
    error.value = e?.response?.data?.msg || e.message || '读取文档失败'
    blocks.value = []
  } finally {
    loading.value = false
  }
}

function refresh() {
  load()
}

function renderMd(text) {
  if (!text) return ''
  return marked.parse(text)
}

onMounted(load)
watch(() => props.path, load)
</script>

<style scoped>
.doc-preview {
  height: 100%;
  overflow-y: auto;
}
.doc-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #909399;
  padding: 24px;
  font-size: 13px;
}
.doc-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 8px;
  margin-bottom: 12px;
  border-bottom: 1px solid #f0f2f5;
}
.doc-path {
  font-size: 12px;
  color: #909399;
  font-family: Consolas, Monaco, monospace;
}
.markdown-body {
  font-size: 14px;
  line-height: 1.7;
  color: #303133;
}
.markdown-body :deep(h1) {
  font-size: 20px;
  margin: 16px 0 10px;
}
.markdown-body :deep(h2) {
  font-size: 17px;
  margin: 16px 0 8px;
  padding-bottom: 4px;
  border-bottom: 1px solid #f0f2f5;
}
.markdown-body :deep(h3) {
  font-size: 15px;
  margin: 12px 0 6px;
}
.markdown-body :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 10px 0;
  font-size: 13px;
}
.markdown-body :deep(th),
.markdown-body :deep(td) {
  border: 1px solid #e4e7ed;
  padding: 6px 10px;
  text-align: left;
}
.markdown-body :deep(th) {
  background: #fafafa;
  font-weight: 600;
}
.markdown-body :deep(code) {
  background: #f5f7fa;
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 12px;
}
.markdown-body :deep(pre) {
  background: #f5f7fa;
  padding: 10px;
  border-radius: 6px;
  overflow-x: auto;
}
</style>
