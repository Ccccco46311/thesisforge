import axios from 'axios'
import { ElMessage } from 'element-plus'
import router from '@/router'

const request = axios.create({
  baseURL: '/api',
  timeout: 30000,
})

// 请求拦截：附加 token
request.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// 响应拦截：统一处理错误
request.interceptors.response.use(
  (response) => {
    const res = response.data
    if (res.code !== 200) {
      // _silent：由调用方自行处理（例如「文档尚未生成」属正常状态）
      if (!response.config?._silent) {
        ElMessage.error(res.msg || '请求失败')
      }
      const err = new Error(res.msg || '请求失败')
      err.code = res.code
      err.msg = res.msg
      return Promise.reject(err)
    }
    return res.data
  },
  (error) => {
    const status = error.response?.status
    if (status === 401 || status === 403) {
      // 401：token 缺失/过期；403：无权限（含旧版本后端对无效 token 返回 403 的兼容）
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      if (router.currentRoute.value.path !== '/login') {
        router.push('/login')
        ElMessage.warning('登录已过期，请重新登录')
      }
    } else {
      ElMessage.error(error.response?.data?.msg || error.message || '网络错误')
    }
    return Promise.reject(error)
  }
)

export default request
