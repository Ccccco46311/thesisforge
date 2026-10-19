import { ref, computed, onBeforeUnmount, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { marked } from 'marked'
import {
  sendChatPrompt,
  getChatMessages,
  getChatPermissions,
} from '@/api/opencode'
import router from '@/router'

/**
 * OpenCode 聊天核心逻辑（SSE 流式 + 权限弹窗 + 兜底轮询）。
 *
 * 流水线页和自由聊天页共用。调用方负责提供 sessionId，并在切换会话时调用
 * `resetForSession()`。
 *
 * @param {object} opts
 * @param {import('vue').Ref<string>} opts.sessionId 当前会话 ID
 * @param {import('vue').Ref<HTMLElement>} opts.msgListRef 消息列表容器（用于滚动到底部）
 */
export function useOpencodeChat({ sessionId, msgListRef }) {
  const messages = ref([])
  const draft = ref('')
  const sending = ref(false)
  const running = ref(false)

  // 权限弹窗
  const permVisible = ref(false)
  const permRequest = ref(null)
  const pendingPermId = ref('')
  const permQueue = ref([])
  const shownPermIds = new Set()
  let permTimer = null

  const permPendingCount = computed(() =>
    (permVisible.value ? 1 : 0) + permQueue.value.length)

  // SSE / 轮询
  let sseController = null
  let sseAborted = false
  let sseTimer = null
  let pollTimer = null
  let pollSeq = 0
  let streamingKey = ''

  /** 本轮执行是否已结束（供外部判断「可推进阶段」） */
  const idle = ref(true)

  marked.setOptions({ gfm: true, breaks: true })

  // ---------- 消息解析 ----------

  function parseMessageList(list) {
    if (!Array.isArray(list)) return []
    return list
      .map(parseMessage)
      .filter(Boolean)
      .sort((a, b) => (a.time || 0) - (b.time || 0))
  }

  function parseMessage(m) {
    const base = {
      key: m.id || `${Math.random()}`,
      time: m.time?.created || 0,
      role: null, text: '', reasoning: '', tools: [], streaming: false,
    }
    if (m.type === 'user') {
      return { ...base, role: 'user', text: m.text || m.payload?.text || '' }
    }
    if (m.type === 'synthetic') {
      const content = m.payload?.message || m.payload?.text
      if (content) {
        return {
          ...base,
          role: 'system',
          text: typeof content === 'string' ? content : JSON.stringify(content),
        }
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
        else if (c.type === 'tool') {
          tools.push({
            name: c.name || 'tool',
            input: c.input,
            output: c.output,
            error: c.error,
            state: c.state === 'error' ? 'error' : 'completed',
          })
        }
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
    if (m.type === 'idle' && m.outcome === 'error') {
      return { ...base, role: 'system', text: 'AI 回复失败' }
    }
    return null
  }

  // ---------- 会话 ----------

  async function loadMessages() {
    if (!sessionId.value) return
    try {
      const raw = await getChatMessages(sessionId.value)
      messages.value = parseMessageList(raw)
      updateIdle(raw)
      scrollToBottom()
    } catch (e) {
      ElMessage.error(`加载消息失败: ${e.message}`)
    }
  }

  async function syncMessagesFromServer() {
    const sid = sessionId.value
    if (!sid) return
    try {
      const raw = await getChatMessages(sid)
      if (sid !== sessionId.value) return
      messages.value = parseMessageList(raw)
      updateIdle(raw)
      scrollToBottom()
    } catch {
      // 校准失败不影响本地展示
    }
  }

  function resetForSession() {
    messages.value = []
    streamingKey = ''
    running.value = false
    idle.value = true
    stopPolling()
    loadMessages()
  }

  function updateIdle(list) {
    if (!Array.isArray(list) || !list.length) return
    const hasIdle = list.some((m) => m.type === 'idle')
    if (hasIdle) idle.value = true
  }

  // ---------- 发送 ----------

  async function handleSend() {
    const text = draft.value.trim()
    if (!text || sending.value || running.value || !sessionId.value) return
    draft.value = ''
    sending.value = true
    idle.value = false

    const now = Date.now()
    const userKey = `user-${now}`
    const assistantKey = `assistant-${now}`
    messages.value.push({ key: userKey, time: now, role: 'user', text })
    messages.value.push({
      key: assistantKey, time: now + 1, role: 'assistant',
      text: '', reasoning: '', tools: [], streaming: true,
    })
    streamingKey = assistantKey
    running.value = true
    scrollToBottom()

    try {
      await sendChatPrompt(sessionId.value, text)
      checkPendingPerms()
      startPolling()
    } catch (e) {
      finishStreaming()
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
    running.value = false
    streamingKey = ''
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

    if (type.startsWith('session.') && data.sessionID && data.sessionID !== sessionId.value) {
      return
    }

    if (type === 'session.step.started') {
      if (!running.value && !messages.value.find((m) => m.streaming)) {
        const now = Date.now()
        const key = `assistant-${now}`
        messages.value.push({
          key, time: now, role: 'assistant',
          text: '', reasoning: '', tools: [], streaming: true,
        })
        streamingKey = key
        running.value = true
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

    if (type === 'session.step.ended') {
      finishStreaming()
      return
    }

    if (type === 'session.execution.succeeded' || type === 'session.execution.failed') {
      finishStreaming()
      stopPolling()
      idle.value = true
      syncMessagesFromServer()
      return
    }

    if (type === 'permission.asked') {
      handlePermission(data)
      return
    }

    if (type === 'session.execution.started') {
      running.value = true
      idle.value = false
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

  function handlePermission(data) {
    const id = data.id || ''
    if (!id || shownPermIds.has(id)) return
    shownPermIds.add(id)
    if (data.sessionID && data.sessionID !== sessionId.value) return
    const item = { id, action: data.action || 'shell', resources: data.resources || [] }
    if (data.sessionID) item.sessionId = data.sessionID
    permQueue.value.push(item)
    if (!permVisible.value) showNextPerm()
  }

  function showNextPerm() {
    while (permQueue.value.length && permQueue.value[0].sessionId
      && permQueue.value[0].sessionId !== sessionId.value) {
      permQueue.value.shift()
    }
    const p = permQueue.value.shift()
    if (!p) return
    pendingPermId.value = p.id
    permRequest.value = { action: p.action, resources: p.resources }
    permVisible.value = true
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
      const resp = await fetch(
        `/api/ai/chat/sessions/${sessionId.value}/permission/${reqId}/reply`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify({ decision }),
        },
      )
      if (resp.ok) ok = true
      else ElMessage.error(`权限回复失败: HTTP ${resp.status}`)
    } catch (e) {
      ElMessage.error(`权限回复失败: ${e.message}`)
    }
    if (!ok) shownPermIds.delete(reqId)
    showNextPerm()
  }

  async function checkPendingPerms() {
    if (!sessionId.value) return
    try {
      const perms = await getChatPermissions(sessionId.value)
      if (!Array.isArray(perms) || !perms.length) return
      for (const p of perms) {
        if (p.id && !shownPermIds.has(p.id)) {
          handlePermission({
            id: p.id, action: p.action, resources: p.resources, sessionID: sessionId.value,
          })
        }
      }
    } catch {
      // 静默忽略，下一轮再试
    }
  }

  // ---------- 兜底轮询 ----------

  function startPolling() {
    stopPolling()
    pollTimer = setInterval(() => {
      if (!sessionId.value) return
      const mySeq = ++pollSeq
      checkPendingPerms()
      getChatMessages(sessionId.value).then((raw) => {
        if (mySeq !== pollSeq) return
        const list = (raw && Array.isArray(raw)) ? raw : []
        const parsed = parseMessageList(list)
        const done = list.some((m) => m.type === 'idle'
          && (m.outcome === 'succeeded' || m.outcome === 'error'))
        const hasStreaming = messages.value.some((m) => m.streaming)

        if (hasStreaming && !done) return

        if (hasStreaming && done) {
          finishStreaming()
          messages.value = parsed
          idle.value = true
          stopPolling()
          scrollToBottom()
          return
        }

        messages.value = parsed
        if (done) {
          idle.value = true
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
      if (msgListRef?.value) {
        msgListRef.value.scrollTop = msgListRef.value.scrollHeight
      }
    })
  }

  function dispose() {
    sseAborted = true
    clearTimeout(sseTimer)
    clearTimeout(permTimer)
    sseController?.abort()
    stopPolling()
  }

  function mount() {
    connectSse()
  }

  return {
    messages, draft, sending, running, idle,
    permVisible, permRequest, permPendingCount,
    handleSend, replyPerm, showNextPerm,
    loadMessages, resetForSession, dispose, mount,
    renderMd, formatToolInput, formatToolOutput, scrollToBottom,
  }
}
