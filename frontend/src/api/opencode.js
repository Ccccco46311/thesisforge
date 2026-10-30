import request from '@/utils/request'

// AI 聊天会话
export const listChatSessions = () => request.get('/ai/chat/sessions')
export const createChatSession = (data) => request.post('/ai/chat/sessions', data)
export const deleteChatSession = (sessionId) => request.delete(`/ai/chat/sessions/${sessionId}`)
export const sendChatPrompt = (sessionId, text) =>
  request.post(`/ai/chat/sessions/${sessionId}/prompt`, { text })
export const getChatMessages = (sessionId) =>
  request.get(`/ai/chat/sessions/${sessionId}/messages`)
export const getChatSessionInfo = (sessionId) =>
  request.get(`/ai/chat/sessions/${sessionId}/info`)
export const compactChatSession = (sessionId) =>
  request.post(`/ai/chat/sessions/${sessionId}/compact`)
export const getChatPermissions = (sessionId) =>
  request.get(`/ai/chat/sessions/${sessionId}/permission`)
export const describeChatPermission = (data) =>
  request.post('/ai/chat/permission/describe', data, { _silent: true })
export const replyChatPermission = (sessionId, requestId, decision) =>
  request.post(`/ai/chat/sessions/${sessionId}/permission/${requestId}/reply`, { decision })
export const getChatForms = (sessionId) =>
  request.get(`/ai/chat/sessions/${sessionId}/form`)
export const replyChatForm = (sessionId, formId, answer) =>
  request.post(`/ai/chat/sessions/${sessionId}/form/${formId}/reply`, { answer })
export const getChatStatus = () => request.get('/ai/chat/status')
