<template>
  <div class="pipeline-page">
    <!-- 顶部：阶段步骤条 -->
    <div class="pipeline-header">
      <div class="header-left">
        <span class="pipeline-title">AI 开发流水线</span>
        <el-tag v-if="pipeline" size="small" :type="statusTagType">{{ statusText }}</el-tag>
        <el-tag v-if="pipeline?.unlocked" size="small" type="success" effect="dark">
          全能 Agent 已解锁
        </el-tag>
      </div>
      <div class="header-actions">
        <el-button v-if="pipeline?.unlocked" type="primary" size="small" @click="goAlmighty">
          进入全能 Agent
        </el-button>
        <el-button size="small" @click="handleReset" :disabled="!pipeline || pipeline.status === 'pending'">
          重置流水线
        </el-button>
      </div>
    </div>

    <!-- 阶段步骤条 -->
    <div class="stage-bar" v-if="pipeline">
      <div
        v-for="(s, idx) in pipeline.stages"
        :key="s.stageCode"
        class="stage-node"
        :class="stageClass(s)"
        @click="handleStageClick(s)"
      >
        <div class="stage-index">
          <el-icon v-if="s.status === 'done'"><Check /></el-icon>
          <span v-else>{{ idx + 1 }}</span>
        </div>
        <div class="stage-meta">
          <div class="stage-name">{{ s.stageName }}</div>
          <div class="stage-status">{{ stageStatusText(s) }}</div>
        </div>
        <div v-if="idx < pipeline.stages.length - 1" class="stage-line" />
      </div>
    </div>

    <!-- 主体：左聊天 + 右产出 -->
    <div class="pipeline-body">
      <!-- 左：当前阶段聊天 -->
      <div class="chat-panel">
        <template v-if="!pipeline">
          <div class="center-tip">
            <el-icon class="is-loading"><Loading /></el-icon>
            <span>加载中…</span>
          </div>
        </template>

        <template v-else-if="!currentStage">
          <div class="center-tip done-tip">
            <el-icon :size="40" color="#67c23a"><CircleCheckFilled /></el-icon>
            <div class="done-title">流水线已全部完成</div>
            <div class="done-desc">所有阶段均已通过验收，「全能 Agent」已解锁，可以自由开发了。</div>
            <el-button type="primary" @click="goAlmighty">进入全能 Agent</el-button>
          </div>
        </template>

        <template v-else-if="!currentStage.sessionId">
          <div class="center-tip">
            <div class="start-title">{{ currentStage.stageName }}</div>
            <div class="start-desc">{{ stageIntro(currentStage.stageCode) }}</div>
            <el-button type="primary" :loading="starting" @click="handleStart">
              开始本阶段
            </el-button>
          </div>
        </template>

        <template v-else>
          <!-- 消息列表 -->
          <div class="msg-list" ref="msgListRef">
            <div v-for="m in messages" :key="m.key" class="msg-row" :class="m.role">
              <template v-if="m.role === 'user'">
                <div class="msg-bubble user-bubble">{{ m.text }}</div>
              </template>
              <template v-else-if="m.role === 'assistant'">
                <div class="msg-avatar">AI</div>
                <div class="msg-body">
                  <el-collapse v-if="m.reasoning" class="reasoning">
                    <el-collapse-item title="推理过程" name="reasoning">
                      <pre class="reasoning-text">{{ m.reasoning }}</pre>
                    </el-collapse-item>
                  </el-collapse>
                  <div v-for="(t, ti) in m.tools" :key="ti" class="tool-call">
                    <el-collapse>
                      <el-collapse-item :name="ti">
                        <template #title>
                          <span class="tool-title">
                            <el-icon><Tools /></el-icon>
                            {{ t.name }}
                            <el-tag size="small" :type="t.state === 'completed' ? 'success' : (t.state === 'error' ? 'danger' : 'info')">
                              {{ t.state === 'error' ? '失败' : (t.state === 'completed' ? '完成' : '运行中') }}
                            </el-tag>
                          </span>
                        </template>
                        <div class="tool-detail">
                          <div v-if="t.input" class="tool-block">
                            <div class="tool-label">输入</div>
                            <pre>{{ formatToolInput(t.input) }}</pre>
                          </div>
                          <div v-if="t.output" class="tool-block">
                            <div class="tool-label">输出</div>
                            <pre>{{ formatToolOutput(t.output) }}</pre>
                          </div>
                          <div v-if="t.error" class="tool-block error">
                            <div class="tool-label">错误</div>
                            <pre>{{ t.error }}</pre>
                          </div>
                        </div>
                      </el-collapse-item>
                    </el-collapse>
                  </div>
                  <div v-if="m.text || m.streaming" class="markdown-body" v-html="renderMd(m.text)" />
                  <div v-if="m.streaming && !m.text" class="typing"><span class="dot" /></div>
                </div>
              </template>
              <template v-else-if="m.role === 'system'">
                <div class="msg-system">{{ m.text }}</div>
              </template>
            </div>
          </div>

          <!-- AI 状态指示条 -->
          <div class="ai-status" :class="aiStatusClass">
            <span class="status-dot" />
            <span class="status-text">{{ aiStatusText }}</span>
            <el-button
              v-if="status === 'stalled'"
              size="small"
              type="danger"
              :loading="restarting"
              @click="handleRestart"
            >
              重启桥接服务
            </el-button>
          </div>

          <!-- 权限排队提示 -->
          <div v-if="permPendingCount > 0" class="perm-banner">
            <span>🔐 有 {{ permPendingCount }} 个权限请求等待确认</span>
            <el-button v-if="!permVisible" size="small" type="primary" @click="showNextPerm">
              立即查看
            </el-button>
          </div>

          <!-- 输入区 -->
          <div class="chat-input">
            <el-input
              v-model="draft"
              type="textarea"
              :rows="2"
              resize="none"
              :placeholder="`在「${currentStage.stageName}」阶段继续对话，Enter 发送`"
              @keydown.enter.exact.prevent="handleSend"
            />
            <div class="input-actions">
              <span class="hint">AI 会按本阶段职责工作，敏感命令会询问你</span>
              <div class="input-buttons">
                <el-button
                  type="success"
                  :disabled="running || !idle"
                  :loading="advancing"
                  @click="handleAdvance"
                >
                  {{ isLastStage ? '完成并结束流水线' : '确认完成，进入下一阶段' }}
                </el-button>
                <el-button
                  type="primary"
                  :loading="sending"
                  :disabled="!draft.trim() || running"
                  @click="handleSend"
                >
                  发送
                </el-button>
              </div>
            </div>
          </div>
        </template>
      </div>

      <!-- 右：产出预览 -->
      <div class="doc-panel">
        <div class="doc-header">
          <span>阶段产出</span>
          <el-tag v-if="currentStage?.outputPath" size="small" type="info">
            {{ currentStage.outputPath }}
          </el-tag>
        </div>
        <div class="doc-content">
          <DocPreview :key="docKey" :path="docPath" :placeholder="docPlaceholder" />
        </div>
      </div>
    </div>

    <!-- 权限弹窗 -->
    <el-dialog
      v-model="permVisible"
      title="权限确认"
      width="480px"
      :close-on-click-modal="false"
      :show-close="false"
      append-to-body
    >
      <div class="perm-content">
        <p class="perm-desc">AI 请求执行以下操作，是否允许？</p>
        <div class="perm-action">{{ permRequest?.action }}</div>
        <pre class="perm-resources">{{ permRequest?.resources?.join('\n') }}</pre>
      </div>
      <template #footer>
        <el-button type="danger" @click="replyPerm('reject')">拒绝</el-button>
        <el-button type="primary" @click="replyPerm('once')">仅此一次</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Check, Tools, Loading, CircleCheckFilled,
} from '@element-plus/icons-vue'
import DocPreview from '@/components/DocPreview.vue'
import { useOpencodeChat } from '@/composables/useOpencodeChat'
import {
  getPipeline, startPipeline, advanceStage, reopenStage, resetPipeline,
} from '@/api/ai'

const router = useRouter()

const pipeline = ref(null)
const starting = ref(false)
const advancing = ref(false)
const msgListRef = ref(null)

const sessionId = ref('')

const {
  messages, draft, sending, running, idle,
  permVisible, permRequest, permPendingCount,
  status, stalled, restartServer,
  handleSend, replyPerm, showNextPerm,
  resetForSession, dispose, mount,
  renderMd, formatToolInput, formatToolOutput,
} = useOpencodeChat({ sessionId, msgListRef })

const restarting = ref(false)

// ---------- 计算属性 ----------

// AI 状态展示文案
const aiStatusText = computed(() => {
  const map = {
    idle: '空闲',
    thinking: 'AI 思考中…',
    working: 'AI 执行工具中…',
    streaming: 'AI 生成回复中…',
    'waiting-permission': '等待权限确认',
    stalled: 'AI 可能卡住了：超过 90 秒无进展',
  }
  return map[status.value] || '空闲'
})

const aiStatusClass = computed(() => `status-${status.value}`)

async function handleRestart() {
  restarting.value = true
  try {
    await restartServer()
    ElMessage.success('桥接服务已重启，会话已恢复')
  } finally {
    restarting.value = false
  }
}

const currentStage = computed(() => {
  if (!pipeline.value) return null
  return pipeline.value.stages.find((s) => s.status !== 'done') || null
})

const isLastStage = computed(() => {
  if (!pipeline.value || !currentStage.value) return false
  return currentStage.value.stageCode === 'acceptance'
})

/**
 * 右侧产出文档路径：未开始的阶段不发起请求，避免「文档尚未生成」打扰。
 */
const docPath = computed(() => {
  const s = currentStage.value
  if (!s || !s.outputPath) return ''
  if (s.status === 'pending') return ''
  return s.outputPath
})

/**
 * 产出区占位文案：按阶段状态区分「未开始 / 生成中 / 无产出要求」。
 */
const docPlaceholder = computed(() => {
  const s = currentStage.value
  if (!s) return '流水线已全部完成'
  if (!s.outputPath) return '本阶段不要求产出文档，进度可在「进度计划」页查看'
  if (s.status === 'pending') return '本阶段尚未开始，AI 产出文档会显示在这里'
  if (s.status === 'running') return 'AI 正在生成产出文档，完成后点「刷新」查看'
  return '本阶段未产出文档'
})

/** 变更时强制 DocPreview 重新加载（AI 执行结束后自动刷新产出） */
const docKey = ref(0)

const statusText = computed(() => {
  const s = pipeline.value?.status
  if (s === 'done') return '已完成'
  if (s === 'running') return '进行中'
  return '未开始'
})

const statusTagType = computed(() => {
  const s = pipeline.value?.status
  if (s === 'done') return 'success'
  if (s === 'running') return 'warning'
  return 'info'
})

// ---------- 阶段展示 ----------

function stageClass(s) {
  if (s.status === 'done') return 'is-done'
  if (s.status === 'running') return 'is-running'
  if (currentStage.value?.stageCode === s.stageCode) return 'is-current'
  return 'is-pending'
}

function stageStatusText(s) {
  if (s.status === 'done') return '已完成'
  if (s.status === 'running') return '进行中'
  return '待开始'
}

function stageIntro(code) {
  const map = {
    environment: '检查 JDK、Maven、Node.js、MySQL、浏览器和端口占用，确保项目能跑起来。',
    requirement: '通过对话梳理你要做的系统，核对功能是否适合本科毕设体量。',
    planning: '把需求拆成 8-15 个可验收的子功能，自动导入进度计划。',
    design: '技术栈选型、数据库表设计、ER 图、数据流图（论文核心产出）。',
    development: '按设计文档逐个实现功能模块，数据库变更写 Flyway 迁移。',
    testing: '对照需求逐项测试，发现问题并修复，输出测试报告。',
    acceptance: '逐项验收并输出从零开始的运行说明和交付清单。',
  }
  return map[code] || ''
}

// ---------- 操作 ----------

async function load() {
  try {
    pipeline.value = await getPipeline()
    bindCurrentSession()
  } catch (e) {
    ElMessage.error(`加载流水线失败: ${e.message}`)
  }
}

/**
 * 把当前阶段的 session 绑定到聊天 composable。
 */
function bindCurrentSession() {
  const sid = currentStage.value?.sessionId || ''
  if (sid === sessionId.value) return
  sessionId.value = sid
  if (sid) {
    resetForSession()
  } else {
    messages.value = []
  }
}

async function handleStart() {
  starting.value = true
  try {
    const r = await startPipeline()
    pipeline.value = r.pipeline
    ElMessage.success(r.message || '阶段已启动')
    bindCurrentSession()
  } catch (e) {
    ElMessage.error(`启动失败: ${e.response?.data?.msg || e.message}`)
  } finally {
    starting.value = false
  }
}

async function handleAdvance() {
  const stage = currentStage.value
  if (!stage) return
  const nextTip = isLastStage.value
    ? '确认完成验收？完成后流水线结束并解锁「全能 Agent」。'
    : `确认「${stage.stageName}」已完成？确认后将进入下一阶段，后续如需修改可以回退重跑。`
  try {
    await ElMessageBox.confirm(nextTip, '确认推进', { type: 'warning' })
  } catch {
    return
  }
  advancing.value = true
  try {
    const r = await advanceStage(stage.stageCode)
    pipeline.value = r.pipeline
    ElMessage.success(r.message || '已进入下一阶段')
    bindCurrentSession()
  } catch (e) {
    ElMessage.error(`推进失败: ${e.response?.data?.msg || e.message}`)
  } finally {
    advancing.value = false
  }
}

async function handleStageClick(s) {
  // 只允许点击已完成的阶段进行回退
  if (s.status !== 'done') return
  if (s.stageCode === currentStage.value?.stageCode) return
  try {
    await ElMessageBox.confirm(
      `回退到「${s.stageName}」重新开始？该阶段之后的进度会被重置（已产出的文档和历史会话会保留）。`,
      '回退重跑',
      { type: 'warning' },
    )
  } catch {
    return
  }
  try {
    const r = await reopenStage(s.stageCode)
    pipeline.value = r.pipeline
    ElMessage.success(r.message || '已回退')
    bindCurrentSession()
  } catch (e) {
    ElMessage.error(`回退失败: ${e.response?.data?.msg || e.message}`)
  }
}

async function handleReset() {
  try {
    await ElMessageBox.confirm(
      '重置后所有阶段回到「待开始」，需要重新走一遍。已产出的文档和历史会话会保留。确认重置？',
      '重置流水线',
      { type: 'warning' },
    )
  } catch {
    return
  }
  try {
    pipeline.value = await resetPipeline()
    ElMessage.success('流水线已重置')
    bindCurrentSession()
  } catch (e) {
    ElMessage.error(`重置失败: ${e.response?.data?.msg || e.message}`)
  }
}

function goAlmighty() {
  router.push('/ai/opencode')
}

// ---------- 生命周期 ----------

// AI 每轮执行结束（idle 由 false → true）时刷新产出文档
watch(idle, (now, before) => {
  if (now && !before) {
    docKey.value++
  }
})

onMounted(async () => {
  mount()
  await load()
})

onBeforeUnmount(dispose)
</script>

<style scoped>
.pipeline-page {
  height: calc(100vh - 60px);
  display: flex;
  flex-direction: column;
  background: #fff;
  overflow: hidden;
}

/* 顶部 */
.pipeline-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  border-bottom: 1px solid #e4e7ed;
  flex-shrink: 0;
}
.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}
.pipeline-title {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
}
.header-actions {
  display: flex;
  gap: 8px;
}

/* 阶段步骤条 */
.stage-bar {
  display: flex;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #f0f2f5;
  background: #fafbfc;
  flex-shrink: 0;
  overflow-x: auto;
}
.stage-node {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 110px;
  cursor: default;
}
.stage-node.is-done {
  cursor: pointer;
}
.stage-index {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #e4e7ed;
  color: #909399;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
  flex-shrink: 0;
  z-index: 1;
}
.stage-node.is-done .stage-index {
  background: #67c23a;
  color: #fff;
}
.stage-node.is-running .stage-index {
  background: #e6a23c;
  color: #fff;
}
.stage-node.is-current .stage-index {
  background: #409eff;
  color: #fff;
}
.stage-meta {
  min-width: 0;
}
.stage-name {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
  white-space: nowrap;
}
.stage-node.is-pending .stage-name {
  color: #a8abb2;
}
.stage-status {
  font-size: 11px;
  color: #909399;
}
.stage-line {
  position: absolute;
  left: 28px;
  right: 8px;
  top: 14px;
  height: 2px;
  background: #e4e7ed;
  z-index: 0;
}
.stage-node.is-done .stage-line {
  background: #b3e19d;
}

/* 主体 */
.pipeline-body {
  flex: 1;
  display: flex;
  min-height: 0;
}
.chat-panel {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.doc-panel {
  width: 42%;
  min-width: 340px;
  border-left: 1px solid #e4e7ed;
  display: flex;
  flex-direction: column;
  background: #fcfcfd;
}
.doc-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-bottom: 1px solid #f0f2f5;
  font-size: 13px;
  font-weight: 600;
  color: #303133;
  flex-shrink: 0;
}
.doc-content {
  flex: 1;
  overflow-y: auto;
  padding: 14px 16px;
}

/* 居中提示 */
.center-tip {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #606266;
  padding: 40px;
}
.start-title {
  font-size: 18px;
  font-weight: 600;
  color: #111827;
}
.start-desc {
  font-size: 13px;
  color: #909399;
  max-width: 460px;
  text-align: center;
  line-height: 1.7;
}
.done-tip {
  gap: 14px;
}
.done-title {
  font-size: 18px;
  font-weight: 600;
  color: #67c23a;
}
.done-desc {
  font-size: 13px;
  color: #909399;
  max-width: 420px;
  text-align: center;
}

/* 消息区 */
.msg-list {
  flex: 1;
  overflow-y: auto;
  padding: 18px 20px;
}
.msg-row {
  margin-bottom: 16px;
  display: flex;
}
.msg-row.user {
  justify-content: flex-end;
}
.user-bubble {
  max-width: 70%;
  background: #409eff;
  color: #fff;
  padding: 9px 13px;
  border-radius: 10px 10px 2px 10px;
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}
.msg-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #409eff;
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-right: 10px;
}
.msg-body {
  flex: 1;
  min-width: 0;
}
.msg-system {
  width: 100%;
  text-align: center;
  font-size: 12px;
  color: #909399;
  padding: 4px 0;
}
.reasoning {
  margin-bottom: 8px;
}
.reasoning-text {
  white-space: pre-wrap;
  font-size: 12px;
  color: #606266;
  margin: 0;
  max-height: 220px;
  overflow-y: auto;
}
.tool-call {
  margin-bottom: 8px;
}
.tool-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}
.tool-detail {
  font-size: 12px;
}
.tool-block {
  margin-bottom: 8px;
}
.tool-label {
  color: #909399;
  margin-bottom: 3px;
}
.tool-block pre {
  margin: 0;
  background: #f5f7fa;
  padding: 8px;
  border-radius: 4px;
  overflow-x: auto;
  max-height: 200px;
}
.tool-block.error pre {
  background: #fff5f5;
  color: #f56c6c;
}
.markdown-body {
  font-size: 14px;
  line-height: 1.7;
  color: #303133;
  word-break: break-word;
}
.markdown-body :deep(table) {
  border-collapse: collapse;
  margin: 8px 0;
  font-size: 13px;
}
.markdown-body :deep(th),
.markdown-body :deep(td) {
  border: 1px solid #e4e7ed;
  padding: 5px 9px;
}
.markdown-body :deep(th) {
  background: #fafafa;
}
.markdown-body :deep(pre) {
  background: #f5f7fa;
  padding: 10px;
  border-radius: 6px;
  overflow-x: auto;
}
.markdown-body :deep(code) {
  background: #f5f7fa;
  padding: 1px 4px;
  border-radius: 3px;
  font-size: 12px;
}
.typing .dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #409eff;
  animation: blink 1s infinite;
}
@keyframes blink {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 1; }
}

/* 权限提示 */
/* AI 状态指示条 */
.ai-status {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 20px;
  font-size: 12px;
  color: #909399;
  background: #fafbfc;
  border-top: 1px solid #f0f2f5;
  flex-shrink: 0;
}
.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #c0c4cc;
  flex-shrink: 0;
}
.status-idle .status-dot { background: #c0c4cc; }
.status-thinking .status-dot { background: #409eff; animation: blink 1.2s infinite; }
.status-working .status-dot { background: #e6a23c; animation: blink 1.2s infinite; }
.status-streaming .status-dot { background: #67c23a; animation: blink 1.2s infinite; }
.status-waiting-permission .status-dot { background: #e6a23c; }
.status-stalled {
  color: #f56c6c;
  background: #fef0f0;
  border-top: 1px solid #fbc4c4;
}
.status-stalled .status-dot { background: #f56c6c; animation: blink 0.8s infinite; }
.status-stalled .status-text { font-weight: 600; }
@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.perm-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 20px;
  background: #fdf6ec;
  border-top: 1px solid #faecd8;
  font-size: 13px;
  color: #e6a23c;
  flex-shrink: 0;
}

/* 输入区 */
.chat-input {
  border-top: 1px solid #e4e7ed;
  padding: 12px 20px;
  flex-shrink: 0;
}
.input-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
  gap: 12px;
}
.hint {
  font-size: 12px;
  color: #a8abb2;
}
.input-buttons {
  display: flex;
  gap: 8px;
}

/* 权限弹窗 */
.perm-content {
  font-size: 14px;
}
.perm-desc {
  margin: 0 0 10px;
  color: #606266;
}
.perm-action {
  font-weight: 600;
  color: #e6a23c;
  margin-bottom: 6px;
}
.perm-resources {
  background: #f5f7fa;
  padding: 10px;
  border-radius: 4px;
  font-size: 12px;
  max-height: 220px;
  overflow-y: auto;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
