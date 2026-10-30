<template>
  <el-dialog
    :model-value="modelValue"
    title="权限确认"
    width="560px"
    :close-on-click-modal="false"
    :show-close="false"
    append-to-body
    @update:model-value="(v) => emit('update:modelValue', v)"
  >
    <div class="perm-content">
      <p class="perm-lead">AI 请求执行以下操作，是否允许？</p>

      <!-- 执行描述：单独一行 -->
      <div class="perm-summary-line">
        <el-icon v-if="loading" class="perm-loading is-loading"><Loading /></el-icon>
        <span class="perm-summary-label">执行描述：</span>
        <span class="perm-summary">{{ desc.summary }}</span>
      </div>

      <!-- 风险点：单独一行 -->
      <div class="perm-risk-line">
        <el-tag :type="riskMeta.type" size="small" effect="dark">{{ riskMeta.label }}</el-tag>
        <span v-for="(item, i) in desc.risks" :key="i" class="perm-risk-item">⚠ {{ item }}</span>
      </div>

      <el-alert
        v-if="desc.risk === 'destructive'"
        type="error"
        :closable="false"
        show-icon
        title="该操作可能删除、覆盖数据或强制推送，请仔细确认"
        class="perm-danger"
      />

      <el-collapse class="perm-raw">
        <el-collapse-item title="查看原始内容" name="raw">
          <div class="perm-action">{{ request?.action || 'unknown' }}</div>
          <pre class="perm-resources">{{ resourcesText }}</pre>
          <pre v-if="metadataText" class="perm-metadata">{{ metadataText }}</pre>
        </el-collapse-item>
      </el-collapse>
    </div>

    <template #footer>
      <el-button type="danger" @click="emit('reject')">拒绝</el-button>
      <el-button type="primary" @click="emit('allow')">允许</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { Loading } from '@element-plus/icons-vue'
import { describeChatPermission } from '@/api/opencode'
import {
  describePermissionFallback,
  getRiskMeta,
  normalizePermissionDescription,
} from '@/utils/permissionDescription'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  request: { type: Object, default: null },
})

const emit = defineEmits(['update:modelValue', 'allow', 'reject'])

// 页面内缓存：同一条权限请求重复弹起时不再调用模型
const cache = new Map()
let seq = 0

const loading = ref(false)
const desc = ref({ summary: '', risk: 'execute', risks: [] })

const riskMeta = computed(() => getRiskMeta(desc.value.risk))
const resourcesText = computed(() => {
  const list = Array.isArray(props.request?.resources) ? props.request.resources : []
  return list.length ? list.join('\n') : '（无）'
})
const metadataText = computed(() => {
  const metadata = props.request?.metadata
  if (!metadata || typeof metadata !== 'object' || !Object.keys(metadata).length) return ''
  try {
    return JSON.stringify(metadata, null, 2)
  } catch {
    return ''
  }
})

function cacheKey(req) {
  return JSON.stringify({
    action: req?.action,
    resources: req?.resources,
    message: req?.message,
    files: Array.isArray(req?.metadata?.files)
      ? req.metadata.files.map((f) => ({
          file: f?.file,
          additions: f?.additions,
          deletions: f?.deletions,
          status: f?.status,
        }))
      : undefined,
  })
}

function describePayload(req) {
  const metadata = req?.metadata && typeof req.metadata === 'object'
    ? {
        ...req.metadata,
        files: Array.isArray(req.metadata.files)
          ? req.metadata.files.map((f) => ({
              file: f?.file,
              status: f?.status,
              additions: f?.additions,
              deletions: f?.deletions,
            }))
          : undefined,
      }
    : undefined
  return {
    action: req?.action,
    resources: req?.resources,
    metadata,
    message: req?.message,
  }
}

async function load(req) {
  if (!req) return
  const mySeq = ++seq
  const key = cacheKey(req)
  const cached = cache.get(key)
  const fallback = describePermissionFallback(req)

  if (cached) {
    desc.value = cached
    loading.value = false
    return
  }

  // 先显示本地规则描述，AI 结果回来后替换，避免弹窗出现空白等待
  desc.value = fallback
  loading.value = true

  try {
    const data = await describeChatPermission(describePayload(req))
    if (mySeq !== seq) return
    const normalized = normalizePermissionDescription(data, fallback)
    desc.value = normalized
    if (data && data.summary) cache.set(key, normalized)
  } catch {
    if (mySeq === seq) desc.value = fallback
  } finally {
    if (mySeq === seq) loading.value = false
  }
}

watch(
  () => [props.modelValue, props.request],
  ([visible, req]) => {
    if (visible && req) load(req)
  },
  { immediate: true },
)
</script>

<style scoped>
.perm-content {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.perm-lead {
  margin: 0;
  color: #606266;
  font-size: 13px;
}

.perm-summary-line {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  min-height: 22px;
  font-size: 15px;
  color: #303133;
  line-height: 1.5;
}

.perm-loading {
  margin-top: 3px;
  color: #909399;
  flex: none;
}

.perm-summary-label {
  flex: none;
  color: #909399;
  font-size: 13px;
  line-height: 1.6;
}

.perm-summary {
  flex: 1;
  word-break: break-word;
}

.perm-risk-line {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  min-height: 24px;
}

.perm-risk-item {
  color: #e6a23c;
  font-size: 12px;
  line-height: 1.4;
}

.perm-danger {
  margin-top: 2px;
}

.perm-raw {
  margin-top: 2px;
}

.perm-action {
  margin-bottom: 4px;
  color: #909399;
  font-size: 12px;
}

.perm-resources,
.perm-metadata {
  margin: 0 0 8px;
  padding: 8px 10px;
  max-height: 180px;
  overflow: auto;
  border-radius: 4px;
  background: #f5f7fa;
  color: #303133;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
}

.perm-metadata {
  color: #606266;
}
</style>
