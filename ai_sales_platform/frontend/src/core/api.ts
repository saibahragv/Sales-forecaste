import axios from 'axios'

export const api = axios.create({
  baseURL: 'http://localhost:8000',
  timeout: 180000,
})

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.code === 'ECONNABORTED' || String(err?.message ?? '').toLowerCase().includes('timeout')) {
      err.message = 'Request timed out. This query can be expensive; try weekly/monthly aggregation, reduce horizon, or disable confidence band.'
    }
    return Promise.reject(err)
  },
)
