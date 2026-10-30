<template>
  <div v-if="locked" class="locked-page">
    <el-result icon="warning" title="流水线尚未完成">
      <template #sub-title>
        <p>「AI 开发」自由聊天需要先完成 7 阶段流水线，确保系统基础功能已就绪。</p>
        <p class="locked-hint">完成流水线后会自动解锁「全能 Agent」。</p>
      </template>
      <template #extra>
        <el-button type="primary" @click="goPipeline">前往 AI 流水线</el-button>
      </template>
    </el-result>
  </div>

  <div v-else class="chat-page">
    <!-- 左侧：会话列表 -->
    <aside class="chat-sidebar">
      <div class="sidebar-header">
        <span class="logo">AI 开发</span>
        <el-button type="primary" size="small" @click="handleCreate" :loading="creating">
          新建会话
        </el-button>
      </div>
      <div class="session-list">
        <div
          v-for="s in sessions"
          :key="s.sessionId"
          class="session-item"
          :class="{ active: s.sessionId === currentId }"
          @click="switchSession(s.sessionId)"
        >
          <div class="session-title" :title="s.title">{{ s.title }}</div>
          <div class="session-actions">
            <el-icon class="del-btn" @click.stop="handleDelete(s.sessionId)"><Delete /></el-icon>
          </div>
        </div>
        <el-empty v-if="!sessions.length" description="暂无会话" :image-size="60" />
      </div>
    </aside>

    <!-- 右侧：对话区 -->
    <main class="chat-main">
      <template v-if="currentId">
        <div class="msg-list" ref="msgListRef">
          <div
            v-for="(m, idx) in messages"
            :key="m.key"
            class="msg-row"
            :class="m.role"
          >
            <!-- 用户消息 -->
            <template v-if="m.role === 'user'">
              <div class="msg-bubble user-bubble">{{ m.text }}</div>
            </template>

            <!-- AI 消息 -->
            <template v-else-if="m.role === 'assistant'">
              <div class="msg-avatar">AI</div>
              <div class="msg-body">
                <!-- 推理过程折叠 -->
                <el-collapse v-if="m.reasoning" class="reasoning">
                  <el-collapse-item title="推理过程" name="reasoning">
                    <pre class="reasoning-text">{{ m.reasoning }}</pre>
                  </el-collapse-item>
                </el-collapse>

                <!-- 工具调用 -->
                <div v-for="(t, ti) in m.tools" :key="ti" class="tool-call">
                  <el-collapse>
                    <el-collapse-item :name="ti">
                      <template #title>
                        <span class="tool-title">
                          <el-icon><Tools /></el-icon>
                          {{ t.name }}
                          <el-tag size="small" :type="t.state === 'completed' ? 'success' : (t.state === 'error' ? 'danger' : 'info')" class="tool-state">
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

                <!-- 正文（Markdown） -->
                <div v-if="m.text || m.streaming" class="markdown-body" v-html="renderMd(m.text)" />
                <div v-if="m.streaming && !m.text" class="typing"><span class="dot"></span></div>
              </div>
            </template>

            <!-- 系统消息 -->
            <template v-else-if="m.role === 'system'">
              <div class="msg-system">{{ m.text }}</div>
            </template>
          </div>
        </div>

        <!-- AI 状态指示条 -->
        <div class="ai-status" :class="statusClass">
          <span class="status-dot" />
          <span class="status-text">{{ statusText }}</span>
          <el-button
            v-if="status === 'stalled'"
            size="small"
            type="danger"
            :loading="restarting"
            @click="handleRestart"
          >
            重启桥接服务
          </el-button>
          <div class="status-right">
            <span v-if="compactHint" class="compact-hint">{{ compactHint }}</span>
            <el-tag
              v-if="contextPercent > 0"
              size="small"
              :type="contextLevel === 'success' ? 'info' : contextLevel"
            >
              上下文 {{ contextPercent }}%
            </el-tag>
            <el-button
              v-if="showCompactButton"
              size="small"
              :loading="compacting"
              @click="compactContext"
            >
              压缩上下文
            </el-button>
          </div>
        </div>

        <!-- 权限排队提示 -->
        <div v-if="permPendingCount > 0" class="perm-banner">
          <span>🔐 有 {{ permPendingCount }} 个权限请求等待确认</span>
          <el-button size="small" type="primary" @click="showNextPerm" v-if="!permVisible">立即查看</el-button>
        </div>

        <!-- 输入区 -->
        <div class="chat-input">
          <div class="input-box">
            <el-input
              v-model="draft"
              type="textarea"
              :rows="2"
              resize="none"
              placeholder="描述你的开发需求，Enter 发送，Shift+Enter 换行"
              @keydown.enter.exact.prevent="handleSend"
            />
            <div class="input-actions">
              <span class="hint">AI 可读取并修改项目文件，敏感命令会询问你</span>
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

      <el-empty v-else description="从左侧选择或新建一个会话开始" :image-size="120" />
    </main>

    <!-- 权限确认弹窗 -->
    <PermissionDialog
      v-model="permVisible"
      :request="permRequest"
      @allow="replyPerm('once')"
      @reject="replyPerm('reject')"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete, Tools } from '@element-plus/icons-vue'
import { marked } from 'marked'
import {
  listChatSessions,
  createChatSession,
  deleteChatSession,
  sendChatPrompt,
  getChatMessages,
  getChatPermissions,
  getChatSessionInfo,
  compactChatSession,
} from '@/api/opencode'
import { getProviderConfig, getPipeline } from '@/api/ai'
import PermissionDialog from '@/components/PermissionDialog.vue'
import router from '@/router'

// ---------- 状态 ----------
const sessions = ref([])
const currentId = ref('')
const messages = ref([])
const draft = ref('')
const creating = ref(false)
const sending = ref(false)
const running = ref(false)
const msgListRef = ref(null)
const providerModel = ref('')
// 流水线完成前锁定自由聊天
const locked = ref(true)
const lockChecked = ref(false)

// 权限弹窗
const permVisible = ref(false)
const permRequest = ref(null)
const pendingPermId = ref('')
const permQueue = ref([]) // 待确认的权限请求队列（SSE/轮询可能同时收到多个）
const shownPermIds = new Set() // 已提示过的权限 id，防止重复弹窗
let permTimer = null

// 排队待确认的权限数量（含当前弹窗中的）
const permPendingCount = computed(() =>
  (permVisible.value ? 1 : 0) + permQueue.value.length)

// SSE
let sseController = null
let sseAborted = false
let sseTimer = null
let pollTimer = null
let stallTimer = null

// ---------- 活动状态（思考/工作/卡住检测） ----------
let lastActivityAt = 0
const stalled = ref(false)
const STALL_TIMEOUT = 90 * 1000
const restarting = ref(false)
/** 整轮 AI 执行是否进行中（execution 级，区别于 step 级的 running） */
const executing = ref(false)

// ---------- 上下文占用（展示 + 压缩） ----------
const CONTEXT_LIMIT = 1048576
/** 当前上下文真实 token 占用（bridge 基于 /context 计算） */
const contextTokens = ref(0)
const compacting = ref(false)
const compactHint = ref('')
const lastCompaction = ref(null)
const contextPercent = computed(() => {
  if (contextTokens.value <= 0) return 0
  return Math.round((contextTokens.value / CONTEXT_LIMIT) * 100)
})
/** 真实占用 >= 50% 才显示压缩按钮 */
const showCompactButton = computed(() => contextPercent.value >= 50)
const contextLevel = computed(() => {
  const p = contextPercent.value
  if (p >= 90) return 'danger'
  if (p >= 70) return 'warning'
  return 'success'
})
let contextTimer = null

async function refreshContext() {
  if (!currentId.value) return
  try {
    const info = await getChatSessionInfo(currentId.value)
    if (!info) return
    if (typeof info.contextTokens === 'number') {
      contextTokens.value = info.contextTokens
    } else if (info.tokens) {
      // 兼容旧 bridge：回退到累计值
      contextTokens.value = info.tokens.input || 0
    }
    lastCompaction.value = info.lastCompaction || lastCompaction.value
  } catch {
    // 静默失败
  }
}

/** 轮询等待压缩真正结束（成功/失败） */
async function waitForCompaction(prevTime, timeoutMs = 60000) {
  const startAt = Date.now()
  while (Date.now() - startAt < timeoutMs) {
    await new Promise((r) => setTimeout(r, 1500))
    if (!currentId.value) break
    try {
      const info = await getChatSessionInfo(currentId.value)
      if (!info) continue
      if (typeof info.contextTokens === 'number') {
        contextTokens.value = info.contextTokens
      }
      const lc = info.lastCompaction
      if (lc && (lc.time || 0) > prevTime) {
        lastCompaction.value = lc
        if (lc.status === 'completed') {
          return { ok: true, message: '上下文已压缩完成' }
        }
        if (lc.status === 'failed') {
          const reason =
            lc.error === 'Nothing to compact yet'
              ? '当前上下文较小，无需压缩'
              : lc.error || '压缩未执行'
          return { ok: false, message: reason }
        }
      }
    } catch {
      // 继续轮询
    }
  }
  return {
    ok: false,
    timeout: true,
    message: '压缩请求已提交，将在当前步骤结束后自动执行',
  }
}

async function compactContext() {
  if (!currentId.value || compacting.value) return
  compacting.value = true
  compactHint.value = '正在压缩上下文…'
  // 先刷新一次，拿到当前最新的压缩记录时间，避免误判历史记录
  await refreshContext()
  const prevTime = lastCompaction.value?.time || 0
  try {
    await compactChatSession(currentId.value)
    const res = await waitForCompaction(prevTime)
    if (res.ok) {
      ElMessage.success(res.message)
    } else if (res.timeout) {
      ElMessage.warning(res.message)
    } else {
      ElMessage.warning(res.message)
    }
    compactHint.value = ''
    await refreshContext()
    // 重新拉取消息，让压缩标记（compaction）显示在聊天中
    if (currentId.value) await loadMessages(currentId.value)
  } catch (e) {
    compactHint.value = ''
    ElMessage.error(`压缩上下文失败: ${e.message}`)
  } finally {
    compacting.value = false
  }
}

function startContextWatch() {
  stopContextWatch()
  refreshContext()
  contextTimer = setInterval(() => refreshContext(), 10000)
}

function stopContextWatch() {
  if (contextTimer) {
    clearInterval(contextTimer)
    contextTimer = null
  }
}

function markActivity() {
  lastActivityAt = Date.now()
  if (stalled.value) stalled.value = false
}

function startStallWatch() {
  stopStallWatch()
  stallTimer = setInterval(() => {
    if (!running.value && !sending.value) {
      stalled.value = false
      return
    }
    if (Date.now() - lastActivityAt >= STALL_TIMEOUT) {
      stalled.value = true
    }
  }, 5000)
}

function stopStallWatch() {
  if (stallTimer) {
    clearInterval(stallTimer)
    stallTimer = null
  }
}

const ACTIVE_WINDOW = 45 * 1000 // 45 秒内有过活动都视为工作中
const status = computed(() => {
  if (permPendingCount.value > 0) return 'waiting-permission'
  if (stalled.value) return 'stalled'
  const recentlyActive = Date.now() - lastActivityAt < ACTIVE_WINDOW
  if (!executing.value && !sending.value && !recentlyActive) return 'idle'
  const streamingMsg = messages.value.find((m) => m.streaming)
  if (streamingMsg) {
    if (streamingMsg.text) return 'streaming'
    if (streamingMsg.tools.length) return 'working'
    return 'thinking'
  }
  return 'thinking'
})

const statusText = computed(() => {
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

const statusClass = computed(() => `status-${status.value}`)

async function handleRestart() {
  restarting.value = true
  try {
    const resp = await fetch(`${import.meta.env.VITE_API_BASE || ''}/api/ai/chat/restart`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    })
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    stalled.value = false
    await new Promise((r) => setTimeout(r, 3000))
    if (currentId.value) {
      await loadMessages(currentId.value)
      startPermWatch()
    }
    ElMessage.success('桥接服务已重启，会话已恢复')
  } catch (e) {
    ElMessage.error(`重启 OpenCode 服务失败: ${e.message}`)
  } finally {
    restarting.value = false
  }
}
let pollSeq = 0
let permWatchTimer = null

// 正在流式输出的 assistant 消息 key
let streamingKey = ''

marked.setOptions({ gfm: true, breaks: true })

// ---------- 生命周期 ----------
onMounted(async () => {
  // 先检查流水线是否已完成（完成前锁定自由聊天）
  try {
    const p = await getPipeline()
    locked.value = !p?.unlocked
  } catch {
    // 流水线接口不可用时保持锁定，避免绕过
    locked.value = true
  } finally {
    lockChecked.value = true
  }
  if (locked.value) return

  await loadProviderModel()
  await loadSessions()
  connectSse()
  startPermWatch()
  startContextWatch()
})

onBeforeUnmount(() => {
  sseAborted = true
  clearTimeout(sseTimer)
  clearTimeout(permTimer)
  sseController?.abort()
  clearInterval(pollTimer)
  stopPermWatch()
  stopStallWatch()
  stopContextWatch()
})

function goPipeline() {
  router.push('/ai/pipeline')
}

async function loadProviderModel() {
  try {
    const cfg = await getProviderConfig()
    if (cfg?.provider && cfg?.model) {
      providerModel.value = `${cfg.provider}/${cfg.model}`
    }
  } catch {
    // 无配置时忽略，serve 用默认模型
  }
}

async function loadSessions() {
  try {
    sessions.value = await listChatSessions()
    if (sessions.value.length && !currentId.value) {
      await switchSession(sessions.value[0].sessionId)
    }
  } catch (e) {
    ElMessage.error(`加载会话列表失败: ${e.message}`)
  }
}

// ---------- 会话操作 ----------

async function handleCreate() {
  creating.value = true
  try {
    const model = providerModel.value || undefined
    const s = await createChatSession({ title: `新会话 ${new Date().toLocaleTimeString()}`, model })
    sessions.value.unshift(s)
    await switchSession(s.sessionId)
  } catch (e) {
    ElMessage.error(`创建会话失败: ${e.message}`)
  } finally {
    creating.value = false
  }
}

async function handleDelete(sessionId) {
  try {
    await ElMessageBox.confirm('删除后不可恢复，确认删除该会话？', '提示', { type: 'warning' })
  } catch {
    return
  }
  try {
    await deleteChatSession(sessionId)
    sessions.value = sessions.value.filter((s) => s.sessionId !== sessionId)
    if (currentId.value === sessionId) {
      currentId.value = ''
      messages.value = []
      if (sessions.value.length) {
        await switchSession(sessions.value[0].sessionId)
      }
    }
    ElMessage.success('已删除')
  } catch (e) {
    ElMessage.error(`删除失败: ${e.message}`)
  }
}

async function switchSession(sessionId) {
  if (sessionId === currentId.value) return
  currentId.value = sessionId
  messages.value = []
  streamingKey = ''
  running.value = false
  executing.value = false
  lastActivityAt = 0
  await loadMessages(sessionId)
  scrollToBottom()
  startPermWatch()
  startContextWatch()
}

async function loadMessages(sessionId) {
  try {
    const raw = await getChatMessages(sessionId)
    messages.value = parseMessageList(raw)
    scrollToBottom()
  } catch (e) {
    ElMessage.error(`加载消息失败: ${e.message}`)
  }
}

/**
 * 合并服务端消息与本地未确认消息。
 *
 * opencode 对消息有延迟（异步写入/索引），服务端拉取可能暂时不含刚发送的消息；
 * 若直接覆盖，用户刚发的问题会「消失」。此函数保留本地以 user-/assistant- 开头、
 * 服务端尚未出现的临时消息（按文本去重），并按时间升序排回。
 */
function mergeWithServer(parsed) {
  const serverTexts = new Set(
    parsed.filter((m) => m.role === 'user').map((m) => m.text)
  )
  const merged = [...parsed]
  for (const m of messages.value) {
    const isLocal = m.key && (m.key.startsWith('user-') || m.key.startsWith('assistant-'))
    if (!isLocal) continue
    if (m.role === 'user') {
      if (serverTexts.has(m.text)) continue // 服务端已有，丢弃本地临时
      merged.push(m)
    } else if (m.role === 'assistant' && m.streaming) {
      const already = parsed.some((p) => p.role === 'assistant' && p.streaming)
      if (!already) merged.push(m)
    }
  }
  return merged.sort((a, b) => (a.time || 0) - (b.time || 0))
}

/**
 * 用服务端数据校准当前会话消息（执行结束后调用）。
 * 保证消息 key 换成服务端真实 ID、顺序正确、内容完整。
 */
async function syncMessagesFromServer() {
  const sid = currentId.value
  if (!sid) return
  try {
    const raw = await getChatMessages(sid)
    if (sid !== currentId.value) return // 期间切换了会话，丢弃
    messages.value = mergeWithServer(parseMessageList(raw))
    scrollToBottom()
  } catch {
    // 校准失败不影响本地展示
  }
}

/**
 * 把服务端消息数组解析为前端模型，并按时间升序排序。
 * OpenCode 返回顺序是倒序（新 → 旧），必须显式排序，否则 AI 回复会显示在提问上方。
 */
function parseMessageList(list) {
  if (!Array.isArray(list)) return []
  return list
    .map(parseMessage)
    .filter(Boolean)
    .sort((a, b) => (a.time || 0) - (b.time || 0))
}

/**
 * 将 OpenCode Message.Info 转为前端消息模型。
 * 注意：OpenCode 返回的消息是倒序（新 → 旧），调用方需按 time.created 升序排序。
 */
function parseMessage(m) {
  const base = {
    key: m.id || `${Math.random()}`,
    time: m.time?.created || 0,
    role: null, text: '', reasoning: '', tools: [], streaming: false,
  }
  if (m.type === 'user') {
    // user 消息的文本在顶层 text 字段（兼容旧版 payload.text）
    return { ...base, role: 'user', text: m.text || m.payload?.text || '' }
  }
  if (m.type === 'synthetic') {
    const content = m.payload?.message || m.payload?.text
    if (content) {
      return { ...base, role: 'system', text: typeof content === 'string' ? content : JSON.stringify(content) }
    }
    return null
  }
  if (m.type === 'assistant') {
    const content = m.content || []
    let text = ''
    let reasoning = ''
    const tools = []
    for (const c of content) {
      if (c.type === 'text') text += c.text || ''
      else if (c.type === 'reasoning') reasoning += c.text || ''
      else if (c.type === 'tool') tools.push({
        name: c.name || 'tool',
        input: c.input,
        output: c.output,
        error: c.error,
        state: c.state === 'error' ? 'error' : 'completed',
      })
    }
    return { ...base, role: 'assistant', text, reasoning, tools }
  }
  if (m.type === 'tool') {
    const p = m.payload || {}
    const name = p.name || p.tool || 'tool'
    return {
      ...base,
      role: 'assistant',
      text: '',
      tools: [{
        name,
        input: p.input || (p.state?.input),
        output: p.state?.output || p.output,
        error: p.state?.error || p.error,
        state: p.state?.status === 'error' ? 'error' : 'completed',
      }],
    }
  }
  if (m.type === 'compaction') {
    const ok = m.status === 'completed'
    const errMsg = m.error?.message || ''
    let text
    if (ok) {
      text = '🗜 上下文已压缩（历史消息已摘要）'
    } else if (errMsg === 'Nothing to compact yet') {
      text = '🗜 无需压缩：当前上下文较小'
    } else {
      text = `🗜 压缩未执行：${errMsg || '未知原因'}`
    }
    return { ...base, role: 'system', text }
  }
  if (m.type === 'idle' && m.outcome === 'error') {
    return { ...base, role: 'system', text: 'AI 回复失败' }
  }
  return null
}

// ---------- 发送 ----------

async function handleSend() {
  const text = draft.value.trim()
  if (!text || sending.value || running.value) return
  draft.value = ''
  sending.value = true

  // 用同一个时间戳生成 key，避免多次 Date.now() 不一致导致流式内容写不进占位消息
  const now = Date.now()
  const userKey = `user-${now}`
  const assistantKey = `assistant-${now}`
  messages.value.push({ key: userKey, time: now, role: 'user', text })
  messages.value.push({ key: assistantKey, time: now + 1, role: 'assistant', text: '', reasoning: '', tools: [], streaming: true })
  streamingKey = assistantKey
  running.value = true
  executing.value = true
  markActivity()
  startStallWatch()
  scrollToBottom()

  try {
    await sendChatPrompt(currentId.value, text)
    checkPendingPerms() // SSE 若已断开，第一时间兜底发现挂起权限
    startPolling()
  } catch (e) {
    finishStreaming()
    executing.value = false
    stopStallWatch()
    messages.value.push({ key: `sys-${Date.now()}`, role: 'system', text: `发送失败: ${e.message}` })
    ElMessage.error(`发送失败: ${e.message}`)
  } finally {
    sending.value = false
  }
}

function finishStreaming() {
  const idx = messages.value.findIndex((m) => m.key === streamingKey)
  if (idx !== -1) {
    messages.value[idx].streaming = false
    if (!messages.value[idx].text && !messages.value[idx].tools.length) {
      messages.value[idx].text = messages.value[idx].reasoning ? '(完成)' : ''
    }
  }
  streamingKey = ''
  // 注意：这里不清 running/executing。session.step.ended 也会调用本函数，
  // 但一次 execution 可能包含多个 step，step 间隙执行仍在进行中。
  // running（按钮禁用）与 executing（状态条）都在 execution.succeeded/failed 时统一清零。
}

// ---------- SSE ----------

function connectSse() {
  const token = localStorage.getItem('token')
  if (!token) return
  sseController = new AbortController()
  const url = `${import.meta.env.VITE_API_BASE || ''}/api/ai/chat/events`
  fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: sseController.signal,
  })
    .then((resp) => {
      if (resp.status === 401 || resp.status === 403) {
        // 登录态失效：停止重连并跳转登录页
        sseAborted = true
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        ElMessage.warning('登录已过期，请重新登录')
        router.push('/login')
        throw new Error(`SSE HTTP ${resp.status}`)
      }
      if (!resp.ok) throw new Error(`SSE HTTP ${resp.status}`)
      return resp.body.getReader()
    })
    .then((reader) => {
      const decoder = new TextDecoder()
      let buffer = ''
      const pump = () => {
        if (sseAborted) return
        reader.read().then(({ done, value }) => {
          if (sseAborted) return
          if (done) {
            // 连接正常结束 → 重连
            scheduleSseReconnect()
            return
          }
          buffer += decoder.decode(value, { stream: true })
          const chunks = buffer.split('\n')
          buffer = chunks.pop()
          for (const line of chunks) {
            const m = line.match(/^data:\s*(.+)$/)
            if (m) {
              try {
                handleEvent(JSON.parse(m[1]))
              } catch {
                // 忽略非 JSON 行
              }
            }
          }
          pump()
        }).catch(() => {
          // 读取中断 → 重连（组件卸载除外）
          if (!sseAborted) scheduleSseReconnect()
        })
      }
      pump()
    })
    .catch(() => {
      if (!sseAborted) scheduleSseReconnect()
    })
}

function scheduleSseReconnect() {
  clearTimeout(sseTimer)
  sseTimer = setTimeout(connectSse, 3000)
}

function handleEvent(evt) {
  const type = evt.type || ''
  const data = evt.data || {}

  // 只处理当前会话事件
  if (type.startsWith('session.') && data.sessionID && data.sessionID !== currentId.value) {
    return
  }

  // 任何 AI 相关活动都刷新「最后活动时间」（卡住检测依据）
  if (type.startsWith('session.') || type === 'permission.asked') {
    markActivity()
  }

  if (type === 'session.step.started' || type === 'session.text.started' || type === 'session.reasoning.started') {
    // 确保当前存在一个流式占位消息，让后续 delta 有处可写。
    // 后端注入触发执行时无本地占位，若不在此创建则 streamingKey 为空，
    // 所有 reasoning/text delta 都会被 findStreamingKey() 丢弃。
    const hasStreaming = messages.value.find((m) => m.streaming)
    if (!hasStreaming) {
      const now = Date.now()
      const key = `assistant-${now}`
      messages.value.push({ key, time: now, role: 'assistant', text: '', reasoning: '', tools: [], streaming: true })
      streamingKey = key
      running.value = true
      executing.value = true
    }
    return
  }

  if (type === 'session.reasoning.delta') {
    const k = findStreamingKey()
    if (k) {
      const idx = messages.value.findIndex((m) => m.key === k)
      if (idx !== -1) messages.value[idx].reasoning += data.delta || ''
    }
    return
  }

  if (type === 'session.text.delta') {
    const k = findStreamingKey()
    if (k) {
      const idx = messages.value.findIndex((m) => m.key === k)
      if (idx !== -1) messages.value[idx].text += data.delta || ''
    }
    return
  }

  if (type === 'session.tool.input.started' || type === 'session.tool.called') {
    const k = findStreamingKey()
    if (!k) return
    const idx = messages.value.findIndex((m) => m.key === k)
    if (idx === -1) return
    const existing = messages.value[idx].tools.find((t) => t.id === data.id)
    if (!existing) {
      messages.value[idx].tools.push({
        id: data.id,
        name: data.name || 'tool',
        input: data.input,
        state: 'running',
      })
    } else {
      existing.state = 'running'
      if (data.input) existing.input = data.input
    }
    return
  }

  if (type === 'session.tool.called' && data.executed === false) {
    // 等待权限/执行的工具
    const k = findStreamingKey()
    if (!k) return
    const idx = messages.value.findIndex((m) => m.key === k)
    if (idx !== -1) {
      const existing = messages.value[idx].tools.find((t) => t.id === data.id)
      if (!existing) {
        messages.value[idx].tools.push({ id: data.id, name: data.name || 'tool', input: data.input, state: 'running' })
      }
    }
    return
  }

  if (type === 'session.step.ended') {
    finishStreaming()
    return
  }

  if (type === 'session.execution.succeeded' || type === 'session.execution.failed') {
    finishStreaming()
    stopPolling()
    running.value = false
    executing.value = false
    stalled.value = false
    lastActivityAt = 0 // 执行结束：清空活动窗口，状态条回到「空闲」
    stopStallWatch()
    // 执行结束：用服务端最终数据校准（真实消息 ID / 完整内容 / 正确顺序）
    syncMessagesFromServer()
    return
  }

  if (type === 'permission.asked') {
    handlePermission(data)
    return
  }

  if (type === 'session.execution.started') {
    running.value = true
    executing.value = true
    return
  }
}

function findStreamingKey() {
  if (streamingKey) return streamingKey
  const m = messages.value.find((x) => x.streaming)
  if (m) {
    streamingKey = m.key
    return m.key
  }
  return null
}

// ---------- 权限 ----------

/**
 * 收到权限请求（SSE 或轮询兜底）后入队，逐个弹窗确认。
 */
function handlePermission(data) {
  const id = data.id || ''
  if (!id) return
  // 非当前会话的权限事件直接忽略（SSE 是全局事件流）
  if (data.sessionID && data.sessionID !== currentId.value) return
  if (shownPermIds.has(id)) return
  shownPermIds.add(id)
  const item = {
    id,
    action: data.action || 'shell',
    resources: data.resources || [],
    metadata: data.metadata,
    message: data.message,
    source: data.source,
  }
  if (data.sessionID) item.sessionId = data.sessionID
  permQueue.value.push(item)
  if (!permVisible.value) showNextPerm()
}

function showNextPerm() {
  // 跳过不属于当前会话的请求（用户可能已切换会话）
  while (permQueue.value.length && permQueue.value[0].sessionId && permQueue.value[0].sessionId !== currentId.value) {
    permQueue.value.shift()
  }
  const p = permQueue.value.shift()
  if (!p) return
  pendingPermId.value = p.id
  permRequest.value = { ...p }
  permVisible.value = true
  // 防漏：弹窗长时未操作自动拒绝，避免无限卡死
  clearTimeout(permTimer)
  permTimer = setTimeout(() => {
    if (permVisible.value && pendingPermId.value === p.id) {
      ElMessage.warning('权限请求超时（5 分钟未确认），已自动拒绝')
      replyPerm('reject')
    }
  }, 5 * 60 * 1000)
}

async function replyPerm(decision) {
  clearTimeout(permTimer)
  const reqId = pendingPermId.value
  permVisible.value = false
  pendingPermId.value = ''
  if (!reqId) return
  let ok = false
  try {
    const resp = await fetch(`/api/ai/chat/sessions/${currentId.value}/permission/${reqId}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
      body: JSON.stringify({ decision }),
    })
    if (resp.ok) ok = true
    else ElMessage.error(`权限回复失败: HTTP ${resp.status}`)
  } catch (e) {
    ElMessage.error(`权限回复失败: ${e.message}`)
  }
  if (!ok) {
    shownPermIds.delete(reqId) // 回复失败后允许轮询重新弹起
  }
  showNextPerm()
}

/**
 * 兜底：SSE 断开时通过轮询发现挂起的权限请求并弹窗。
 */
async function checkPendingPerms() {
  if (!currentId.value) return
  try {
    const perms = await getChatPermissions(currentId.value)
    if (!Array.isArray(perms) || !perms.length) return
    for (const p of perms) {
      if (p.id && !shownPermIds.has(p.id)) {
        handlePermission({ ...p, sessionID: p.sessionID || currentId.value })
      }
    }
  } catch {
    // bridge 不可用等场景静默忽略，下一轮再试
  }
}

// ---------- 兜底轮询 ----------

function startPolling() {
  stopPolling()
  pollTimer = setInterval(() => {
    if (!currentId.value) return
    const mySeq = ++pollSeq
    checkPendingPerms()
    getChatMessages(currentId.value).then((raw) => {
      if (mySeq !== pollSeq) return
      const list = (raw && Array.isArray(raw)) ? raw : []
      const parsed = parseMessageList(list)
      const done = list.some((m) => m.type === 'idle' && (m.outcome === 'succeeded' || m.outcome === 'error'))
      const hasStreaming = messages.value.some((m) => m.streaming)

      if (hasStreaming && !done) {
        // 流式进行中：不动消息列表，避免本地占位被服务端数据覆盖（会造成消息重复/顺序错乱）
        return
      }

      if (hasStreaming && done) {
        // 本轮执行结束：结束流式占位，用服务端最终数据校准
        finishStreaming()
        messages.value = mergeWithServer(parsed)
        running.value = false
        executing.value = false
        stalled.value = false
        lastActivityAt = 0 // 执行结束：清空活动窗口
        stopStallWatch()
        stopPolling()
        scrollToBottom()
        return
      }

      // 空闲态兜底同步；消息数有变化说明有进展，刷新活动时间
      if (parsed.length !== messages.value.length) markActivity()
      messages.value = mergeWithServer(parsed)
      if (done) {
        running.value = false
        executing.value = false
        stalled.value = false
        lastActivityAt = 0 // 执行结束：清空活动窗口
        stopStallWatch()
        stopPolling()
      }
      scrollToBottom()
    }).catch(() => {})
  }, 3000)
}

function stopPolling() {
  clearInterval(pollTimer)
  pollTimer = null
}

/**
 * 常驻权限 watchdog：只要当前会话非空，就定期轮询挂起的权限请求。
 * 自由聊天页用户可能长时间不发消息，SSE 事件一旦丢失权限弹窗就永远不出现
 * （AI 会一直等待确认）。此 watchdog 兜底解决。
 */
function startPermWatch() {
  stopPermWatch()
  if (!currentId.value) return
  permWatchTimer = setInterval(() => {
    checkPendingPerms()
  }, 3000)
  // 启动即查一次，避免 SSE 事件在订阅前已发生
  checkPendingPerms()
}

function stopPermWatch() {
  if (permWatchTimer) {
    clearInterval(permWatchTimer)
    permWatchTimer = null
  }
}

// ---------- 工具 ----------

function renderMd(text) {
  if (!text) return ''
  return marked.parse(text)
}

function formatToolInput(input) {
  if (typeof input === 'string') return input
  try { return JSON.stringify(input, null, 2) } catch { return String(input) }
}

function formatToolOutput(output) {
  if (typeof output === 'string') return output
  try { return JSON.stringify(output, null, 2) } catch { return String(output) }
}

function scrollToBottom() {
  nextTick(() => {
    if (msgListRef.value) {
      msgListRef.value.scrollTop = msgListRef.value.scrollHeight
    }
  })
}
</script>

<style scoped>
.locked-page {
  height: calc(100vh - 60px);
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
}
.locked-hint {
  color: #909399;
  font-size: 13px;
}

.chat-page {
  height: calc(100vh - 60px);
  display: flex;
  background: #fff;
  overflow: hidden;
}

/* 左侧会话列表 */
.chat-sidebar {
  width: 260px;
  flex-shrink: 0;
  border-right: 1px solid #e4e7ed;
  display: flex;
  flex-direction: column;
  background: #f8f9fb;
}
.sidebar-header {
  padding: 12px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #e4e7ed;
}
.logo {
  font-weight: 600;
  font-size: 15px;
}
.session-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}
.session-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 9px 10px;
  border-radius: 6px;
  cursor: pointer;
  margin-bottom: 2px;
  transition: background 0.15s;
}
.session-item:hover {
  background: #eef1f6;
}
.session-item.active {
  background: #e6f0ff;
  color: #2b6de8;
}
.session-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
}
.del-btn {
  opacity: 0;
  transition: opacity 0.15s;
  color: #c0c4cc;
}
.session-item:hover .del-btn {
  opacity: 1;
}
.del-btn:hover {
  color: #f56c6c;
}

/* 右侧对话区 */
.chat-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.msg-list {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px;
}
/* AI 状态指示条 */
.ai-status {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 16px;
  font-size: 12px;
  color: #909399;
  background: #fafbfc;
  border-bottom: 1px solid #f0f2f5;
  flex-shrink: 0;
}
.status-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
}
.compact-hint {
  color: #e6a23c;
  font-size: 12px;
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
  border-bottom: 1px solid #fbc4c4;
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
  padding: 8px 16px;
  background: #fdf6ec;
  border-bottom: 1px solid #f5dab1;
  color: #b88230;
  font-size: 13px;
}
.msg-row {
  display: flex;
  margin-bottom: 18px;
  align-items: flex-start;
}
.msg-row.user {
  justify-content: flex-end;
}
.user-bubble {
  background: #2b6de8;
  color: #fff;
  padding: 10px 14px;
  border-radius: 10px 10px 2px 10px;
  max-width: 70%;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 14px;
  line-height: 1.6;
}
.msg-avatar {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  background: #e6f0ff;
  color: #2b6de8;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  flex-shrink: 0;
  margin-right: 10px;
}
.msg-body {
  max-width: calc(100% - 42px);
  min-width: 0;
}
.msg-system {
  margin: 0 auto;
  padding: 6px 14px;
  background: #f4f4f5;
  color: #909399;
  border-radius: 6px;
  font-size: 12px;
}
.reasoning {
  margin-bottom: 8px;
}
.reasoning :deep(.el-collapse-item__header) {
  font-size: 12px;
  color: #909399;
  height: 30px;
  background: #fafafa;
}
.reasoning-text {
  font-size: 12px;
  color: #909399;
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
  max-height: 200px;
  overflow-y: auto;
}
.tool-call {
  margin: 6px 0;
}
.tool-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-family: 'Consolas', monospace;
}
.tool-state {
  margin-left: 4px;
}
.tool-detail {
  font-family: 'Consolas', 'Courier New', monospace;
}
.tool-block {
  background: #f8f8f8;
  border-radius: 4px;
  padding: 8px;
  margin-bottom: 6px;
}
.tool-block.error {
  background: #fef0f0;
}
.tool-label {
  font-size: 12px;
  color: #909399;
  margin-bottom: 4px;
}
.tool-block pre {
  margin: 0;
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 220px;
  overflow-y: auto;
  color: #303133;
}
.markdown-body {
  font-size: 14px;
  line-height: 1.7;
  word-break: break-word;
}
.typing .dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #2b6de8;
  animation: blink 1s infinite;
}
@keyframes blink {
  0%, 100% { opacity: 0.2; }
  50% { opacity: 1; }
}

/* 输入区 */
.chat-input {
  border-top: 1px solid #e4e7ed;
  padding: 12px 24px 16px;
}
.input-box {
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  padding: 8px;
  transition: border-color 0.2s;
}
.input-box:focus-within {
  border-color: #2b6de8;
}
.input-box :deep(.el-textarea__inner) {
  border: none;
  box-shadow: none;
  padding: 4px 8px;
}
.input-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 6px;
}
.hint {
  font-size: 12px;
  color: #909399;
}

:deep(.markdown-body pre) {
  background: #f6f8fa;
  padding: 12px;
  border-radius: 6px;
  overflow-x: auto;
  font-size: 13px;
  line-height: 1.5;
}
:deep(.markdown-body code) {
  background: #f0f2f5;
  padding: 2px 5px;
  border-radius: 3px;
  font-family: 'Consolas', monospace;
  font-size: 13px;
}
:deep(.markdown-body pre code) {
  background: transparent;
  padding: 0;
}
:deep(.markdown-body p) {
  margin: 0 0 8px;
}
:deep(.markdown-body ul, .markdown-body ol) {
  padding-left: 20px;
  margin: 0 0 8px;
}
:deep(.markdown-body table) {
  border-collapse: collapse;
  margin: 8px 0;
}
:deep(.markdown-body th, .markdown-body td) {
  border: 1px solid #e4e7ed;
  padding: 6px 10px;
}
:deep(.markdown-body h1, .markdown-body h2, .markdown-body h3, .markdown-body h4) {
  margin: 12px 0 8px;
}
</style>
