import { ref, computed, watch, onBeforeUnmount, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { marked } from 'marked'
import {
  sendChatPrompt,
  getChatMessages,
  getChatPermissions,
  getChatForms,
  replyChatForm,
  getChatSessionInfo,
  compactChatSession,
} from '@/api/opencode'
import router from '@/router'
import { useUserStore } from '@/store/user'
import { getToken } from '@/utils/authStorage'

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
  const userStore = useUserStore()
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

  // 选择题弹窗（OpenCode question 工具 → serve 表单）
  const questionVisible = ref(false)
  const questionData = ref(null) // { formId, fields: [...], title }
  const questionQueue = ref([])
  const seenQuestionIds = new Set()
  let questionTimer = null

  // SSE / 轮询
  let sseController = null
  let sseAborted = false
  let sseTimer = null
  let pollTimer = null
  let permWatchTimer = null
  let stallTimer = null
  let pollSeq = 0
  let streamingKey = ''

  /** 本轮执行是否已结束（供外部判断「可推进阶段」） */
  const idle = ref(true)

  /**
   * 整轮 AI 执行是否进行中（execution 级）。
   *
   * opencode 一次回复（一个 execution）可能包含多个 step（思考/工具调用/输出），
   * 每个 step 结束都会发 session.step.ended。若用 running（step 级）判断执行状态，
   * step 间隙会误判为「空闲」。executing 只在 execution.started 置 true、
   * execution.succeeded/failed 置 false，保证状态条在整个回复期间保持活动。
   */
  const executing = ref(false)

  // ---------- 上下文占用（展示 + 压缩） ----------

  /** 上下文 limit（从 serve 配置，deepseek-v4-flash/pro 均为 100 万） */
  const CONTEXT_LIMIT = 1048576
  /** 当前上下文真实 token 占用（bridge 基于 /context 计算，非累计值） */
  const contextTokens = ref(0)
  /** 是否正在压缩 */
  const compacting = ref(false)
  /** 压缩过程中的提示文案（展示在状态条/按钮旁） */
  const compactHint = ref('')
  /** 最近一次压缩记录 { status, error, time } */
  const lastCompaction = ref(null)
  /** 上下文占用百分比（0-100+） */
  const contextPercent = computed(() => {
    if (contextTokens.value <= 0) return 0
    return Math.round((contextTokens.value / CONTEXT_LIMIT) * 100)
  })
  /** 是否显示「压缩上下文」按钮：真实占用 >= 50% 才提示 */
  const showCompactButton = computed(() => contextPercent.value >= 50)
  /** 占用颜色分级 */
  const contextLevel = computed(() => {
    const p = contextPercent.value
    if (p >= 90) return 'danger'
    if (p >= 70) return 'warning'
    return 'success'
  })

  let contextTimer = null

  /** 拉取当前会话上下文真实占用 + 最近压缩状态 */
  async function refreshContext() {
    if (!sessionId.value) return
    try {
      const info = await getChatSessionInfo(sessionId.value)
      if (!info) return
      if (typeof info.contextTokens === 'number') {
        contextTokens.value = info.contextTokens
      } else if (info.tokens) {
        // 兼容旧 bridge：回退到累计值
        contextTokens.value = info.tokens.input || 0
      }
      lastCompaction.value = info.lastCompaction || lastCompaction.value
    } catch {
      // 静默失败，下次轮询再试
    }
  }

  /**
   * 轮询等待压缩真正结束（成功/失败）。
   * compact 接口只负责「受理」，真正的结果体现在 compaction 消息的 status 上。
   */
  async function waitForCompaction(prevTime, timeoutMs = 60000) {
    const startAt = Date.now()
    while (Date.now() - startAt < timeoutMs) {
      await new Promise((r) => setTimeout(r, 1500))
      if (!sessionId.value) break
      try {
        const info = await getChatSessionInfo(sessionId.value)
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

  /** 请求压缩会话上下文，并等待/反馈真实结果 */
  async function compactContext() {
    if (!sessionId.value || compacting.value) return
    compacting.value = true
    compactHint.value = '正在压缩上下文…'
    // 先刷新一次，拿到当前最新的压缩记录时间，避免误判历史记录
    await refreshContext()
    const prevTime = lastCompaction.value?.time || 0
    try {
      await compactChatSession(sessionId.value)
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
      await loadMessages()
    } catch (e) {
      compactHint.value = ''
      ElMessage.error(`压缩上下文失败: ${e.message}`)
    } finally {
      compacting.value = false
    }
  }

  /** 启动/重启 10 秒上下文占用轮询 */
  function startContextWatch() {
    stopContextWatch()
    refreshContext()
    contextTimer = setInterval(() => {
      refreshContext()
    }, 10000)
  }

  function stopContextWatch() {
    if (contextTimer) {
      clearInterval(contextTimer)
      contextTimer = null
    }
  }

  // ---------- 活动状态（思考/工作/卡住检测） ----------

  /** 最近一次收到 AI 活动事件的时间戳（ms） */
  let lastActivityAt = 0
  /** 是否疑似卡住（运行中且超过阈值无任何活动） */
  const stalled = ref(false)
  /** 卡住判定阈值（ms） */
  const STALL_TIMEOUT = 90 * 1000

  /**
   * 记录一次 AI 活动（SSE 事件 / 轮询进展 / 权限请求都算）。
   * 重置卡住状态并刷新最后活动时间。
   */
  function markActivity() {
    lastActivityAt = Date.now()
    if (stalled.value) stalled.value = false
  }

  /**
   * 心跳检测：运行中但超过阈值无活动 → 判定疑似卡住。
   */
  function startStallWatch() {
    stopStallWatch()
    stallTimer = setInterval(() => {
      if (!running.value && !sending.value) {
        stalled.value = false
        return
      }
      const silent = Date.now() - lastActivityAt
      if (silent >= STALL_TIMEOUT) {
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

  /**
   * 当前 AI 运行状态（供界面显示）：
   * idle 空闲 / thinking 思考中 / working 执行工具中 / streaming 生成回复中 /
   * waiting-permission 等待权限确认 / stalled 疑似卡住
   *
   * 「活动窗口」兜底：即使 executing 因 SSE 事件偶发丢失被误重置，只要
   * 距离最近一次 AI 活动在阈值内（AI 还在动），也不显示「空闲」，
   * 避免「AI 在干活但状态条显示空闲」的误导。
   */
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

  // ---------- 会话 ----------

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
        // 本地正在流式占位：若服务端已有同会话流式消息则跳过，否则保留
        const already = parsed.some((p) => p.role === 'assistant' && p.streaming)
        if (!already) merged.push(m)
      }
    }
    return merged.sort((a, b) => (a.time || 0) - (b.time || 0))
  }

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
      messages.value = mergeWithServer(parseMessageList(raw))
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
    executing.value = false
    idle.value = true
    stalled.value = false
    lastActivityAt = 0
    stopPolling()
    stopStallWatch()
    stopContextWatch()
    // 切换会话：清空选择题弹窗状态
    questionQueue.value = []
    seenQuestionIds.clear()
    questionData.value = null
    questionVisible.value = false
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
    executing.value = true

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
    markActivity()
    startStallWatch()
    scrollToBottom()

    try {
      await sendChatPrompt(sessionId.value, text)
      checkPendingPerms()
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
    // 注意：这里不再清 running/executing。session.step.ended 也会调用本函数，
    // 但一次 execution 可能包含多个 step，step 间隙执行仍在进行中。
    // running（按钮禁用）与 executing（状态条）都在 execution.succeeded/failed 时统一清零。
  }

  // ---------- SSE ----------

  function connectSse() {
    const token = getToken()
    if (!token) return
    sseController = new AbortController()
    const url = `${import.meta.env.VITE_API_BASE || ''}/api/ai/chat/events`
    fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: sseController.signal,
    })
      .then((resp) => {
        if (resp.status === 401) {
          sseAborted = true
          userStore.logout()
          ElMessage.warning('登录已过期，请重新登录')
          router.push('/login')
          throw new Error(`SSE HTTP ${resp.status}`)
        }
        if (resp.status === 403) {
          sseAborted = true
          ElMessage.error('没有访问 AI 开发功能的权限')
          throw new Error('没有访问 AI 开发功能的权限')
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

    // 任何 AI 相关活动都刷新「最后活动时间」（卡住检测依据）
    if (type.startsWith('session.') || type === 'permission.asked') {
      markActivity()
    }

    if (type === 'session.step.started' || type === 'session.text.started' || type === 'session.reasoning.started') {
      // 确保当前存在一个流式占位消息，让后续 delta 有处可写。
      // 流水线阶段由后端注入引导消息触发执行时，handleSend 未被调用、
      // 没有本地占位；若不在此创建，streamingKey 为空，所有 reasoning/text
      // delta 都会被 findStreamingKey() 丢弃（表现为「等一会一次性出现结果」）。
      const hasStreaming = messages.value.find((m) => m.streaming)
      if (!hasStreaming) {
        const now = Date.now()
        const key = `assistant-${now}`
        messages.value.push({
          key, time: now, role: 'assistant',
          text: '', reasoning: '', tools: [], streaming: true,
        })
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
      // 执行结束：清空活动窗口，让状态条回到「空闲」
      lastActivityAt = 0
      stopStallWatch()
      idle.value = true
      syncMessagesFromServer()
      return
    }

    if (type === 'permission.asked') {
      handlePermission(data)
      return
    }

    if (type === 'question.asked') {
      handleQuestionAsked(data)
      return
    }

    if (type === 'session.execution.started') {
      running.value = true
      executing.value = true
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
    if (!id) return
    // 非当前会话的权限事件直接忽略（SSE 是全局事件流）
    if (data.sessionID && data.sessionID !== sessionId.value) return
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
    while (permQueue.value.length && permQueue.value[0].sessionId
      && permQueue.value[0].sessionId !== sessionId.value) {
      permQueue.value.shift()
    }
    const p = permQueue.value.shift()
    if (!p) return
    pendingPermId.value = p.id
    permRequest.value = { ...p }
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
            Authorization: `Bearer ${getToken()}`,
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
          handlePermission({ ...p, sessionID: p.sessionID || sessionId.value })
        }
      }
    } catch {
      // 静默忽略，下一轮再试
    }
  }

  // ---------- 选择题（question 工具 → serve 表单） ----------

  const questionPendingCount = computed(() =>
    (questionVisible.value ? 1 : 0) + questionQueue.value.length)

  /**
   * 把 serve 返回的表单归一化成弹窗可用结构。
   * question 工具生成的表单：fields 里的 description 即题目，options 即选项。
   */
  function normalizeQuestionForm(form) {
    const fields = (form.fields || []).map((f) => ({
      key: f.key,
      title: f.title,
      description: f.description,
      type: f.type,
      options: f.options || [],
      custom: !!f.custom,
      selected: '',
    }))
    return { formId: form.id, title: form.title || '选择题', fields }
  }

  function showNextQuestion() {
    while (questionQueue.value.length) {
      const q = questionQueue.value.shift()
      if (!q) continue
      questionData.value = q
      questionVisible.value = true
      clearTimeout(questionTimer)
      questionTimer = setTimeout(() => {
        if (questionVisible.value) ElMessage.warning('选择题长时间未确认，可随时点「查看题目」重新弹出')
      }, 5 * 60 * 1000)
      return
    }
  }

  function handleQuestionAsked() {
    // question.asked 事件里没有 formId，具体题目靠拉取表单拿；触发一次拉取即可
    checkPendingQuestions()
  }

  async function checkPendingQuestions() {
    if (!sessionId.value) return
    let forms = []
    try {
      forms = await getChatForms(sessionId.value)
    } catch {
      return
    }
    if (!Array.isArray(forms) || !forms.length) return
    for (const f of forms) {
      if (f.id && !seenQuestionIds.has(f.id)) {
        seenQuestionIds.add(f.id)
        questionQueue.value.push(normalizeQuestionForm(f))
      }
    }
    if (questionQueue.value.length && !questionVisible.value) {
      showNextQuestion()
    }
  }

  /**
   * 提交选择题答案（answers 形如 { [fieldKey]: value }），会话随即继续执行。
   */
  async function submitQuestionAnswer(answers) {
    const q = questionData.value
    if (!q) return
    try {
      await replyChatForm(sessionId.value, q.formId, answers)
      ElMessage.success('已确认，AI 继续执行')
    } catch (e) {
      ElMessage.error(`提交选择失败: ${e.message}`)
      return
    }
    questionData.value = null
    questionVisible.value = false
    clearTimeout(questionTimer)
    showNextQuestion()
    syncMessagesFromServer()
  }

  function closeQuestion() {
    // 暂不回答：从 seen 里移除，下次轮询会重新弹出（不回答 AI 会一直等待）
    if (questionData.value) {
      seenQuestionIds.delete(questionData.value.formId)
    }
    questionData.value = null
    questionVisible.value = false
    clearTimeout(questionTimer)
    showNextQuestion()
  }

  // ---------- 兜底轮询 ----------

  function startPolling() {
    stopPolling()
    pollTimer = setInterval(() => {
      if (!sessionId.value) return
      const mySeq = ++pollSeq
      checkPendingPerms()
      checkPendingQuestions()
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
          messages.value = mergeWithServer(parsed)
          running.value = false
          executing.value = false
          stalled.value = false
          // 执行结束：清空活动窗口，让状态条回到「空闲」
          lastActivityAt = 0
          stopStallWatch()
          idle.value = true
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
          // 执行结束：清空活动窗口，让状态条回到「空闲」
          lastActivityAt = 0
          stopStallWatch()
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
    clearTimeout(questionTimer)
    sseController?.abort()
    stopPolling()
    stopPermWatch()
    stopStallWatch()
    stopContextWatch()
    questionQueue.value = []
    seenQuestionIds.clear()
    questionData.value = null
    questionVisible.value = false
  }

  // ---------- 常驻权限 watchdog ----------

  /**
   * 只要当前会话非空，就定期轮询挂起的权限请求。
   * 流水线阶段由后端注入引导消息、用户未手动发消息，若依赖 handleSend 后的轮询，
   * SSE 事件一旦丢失权限弹窗就永远不出现（AI 会一直等待确认）。此 watchdog 兜底解决。
   */
  function startPermWatch() {
    stopPermWatch()
    if (!sessionId.value) return
    permWatchTimer = setInterval(() => {
      checkPendingPerms()
      checkPendingQuestions()
    }, 3000)
    // 启动即查一次，避免 SSE 事件在订阅前已发生
    checkPendingPerms()
    checkPendingQuestions()
  }

  function stopPermWatch() {
    if (permWatchTimer) {
      clearInterval(permWatchTimer)
      permWatchTimer = null
    }
  }

  // 会话切换时重启 watchdog + 上下文占用轮询
  watch(sessionId, () => {
    startPermWatch()
    startContextWatch()
  })

  function mount() {
    connectSse()
    startPermWatch()
    startContextWatch()
  }

  /**
   * 重启 opencode serve（执行引擎偶发卡死时自愈）。
   * 重启后重新加载当前会话消息。返回是否成功。
   */
  async function restartServer() {
    try {
      await fetch(`${import.meta.env.VITE_API_BASE || ''}/api/ai/chat/restart`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      stalled.value = false
      running.value = false
      executing.value = false
      // 等 serve 恢复后重新同步当前会话
      await new Promise((r) => setTimeout(r, 3000))
      if (sessionId.value) {
        await loadMessages()
        startPermWatch()
      }
      return true
    } catch (e) {
      ElMessage.error(`重启 OpenCode 服务失败: ${e.message}`)
      return false
    }
  }

  return {
    messages, draft, sending, running, executing, idle,
    permVisible, permRequest, permPendingCount,
    questionVisible, questionData, questionPendingCount,
    submitQuestionAnswer, closeQuestion, checkPendingQuestions,
    status, stalled, restartServer,
    contextPercent, contextLevel, contextTokens, showCompactButton,
    compacting, compactHint, compactContext,
    handleSend, replyPerm, showNextPerm,
    loadMessages, resetForSession, dispose, mount,
    renderMd, formatToolInput, formatToolOutput, scrollToBottom,
  }
}
