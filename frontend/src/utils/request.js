import axios from 'axios'
import { ElMessage } from 'element-plus'
import router from '@/router'
import { useUserStore } from '@/store/user'
import { getToken } from '@/utils/authStorage'

const request = axios.create({
  baseURL: '/api',
  timeout: 30000,
})

/** 清理当前标签页登录态并跳转登录页（不影响其它标签页）。 */
function logoutAndRedirect() {
  useUserStore().logout()
  if (router.currentRoute.value.path !== '/login') {
    router.push('/login')
    ElMessage.warning('登录已过期，请重新登录')
  }
}

// 请求拦截：附加 token
request.interceptors.request.use((config) => {
  const token = getToken()
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
      if (res.code === 401) {
        logoutAndRedirect()
      } else if (!response.config?._silent) {
        // _silent：由调用方自行处理（例如「文档尚未生成」属正常状态）
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
    if (status === 401) {
      // token 缺失/过期：只清理当前标签页
      logoutAndRedirect()
    } else if (status === 403) {
      // 已登录但无权限：保留登录态，避免把普通用户误踢到登录页
      ElMessage.error(error.response?.data?.msg || '没有访问权限')
    } else {
      ElMessage.error(error.response?.data?.msg || error.message || '网络错误')
    }
    return Promise.reject(error)
  }
)

export default request
