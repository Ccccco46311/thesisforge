import request from '@/utils/request'

// AI 供应商配置
export const getProviderConfig = () => request.get('/ai/provider-config')
export const saveProviderConfig = (data) => request.post('/ai/provider-config', data)

// 进度计划
export const getPlan = (params) => request.get('/ai/plan', { params })
export const createPlan = (data) => request.post('/ai/plan', data)
export const createPlanItem = (planId, data) => request.post(`/ai/plan/${planId}/items`, data)
export const updatePlanItem = (id, data) => request.put(`/ai/plan/item/${id}`, data)
export const completePlanItem = (id) => request.post(`/ai/plan/item/${id}/complete`)

// 节点
export const getNodes = (params) => request.get('/ai/node', { params })
export const getNode = (id) => request.get(`/ai/node/${id}`)

// AI 开发流水线
export const getPipeline = () => request.get('/ai/pipeline')
export const startPipeline = () => request.post('/ai/pipeline/start')
export const advanceStage = (code) => request.post(`/ai/pipeline/stage/${code}/advance`)
export const reopenStage = (code) => request.post(`/ai/pipeline/stage/${code}/reopen`)
export const resetPipeline = () => request.post('/ai/pipeline/reset')
