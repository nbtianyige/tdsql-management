import axios from 'axios'

const API_BASE_URL = '/api'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  validateStatus: (status) => status < 500,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('role')
      localStorage.removeItem('user')
      window.location.href = '/'
    }
    return Promise.reject(error)
  }
)

export const authAPI = {
  login: (data: { username: string; password: string }) =>
    api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  register: (data: { username: string; password: string; role?: string }) =>
    api.post('/auth/register', data),
}

export const clusterAPI = {
  getClusters: () => api.get('/cluster/'),
  createCluster: (data: {
    name: string;
    description?: string;
    is_xinchuang?: boolean;
    is_dingjia?: boolean;
  }) => api.post('/cluster', data),
  getCluster: (id: number) => api.get(`/cluster/${id}`),
  updateCluster: (id: number, data: {
    name: string;
    description?: string;
    is_xinchuang?: boolean;
    is_dingjia?: boolean;
  }) => api.put(`/cluster/${id}`, data),
  deleteCluster: (id: number) => api.delete(`/cluster/${id}`),
  getClusterRelated: (id: number) => api.get(`/cluster/${id}/related`),
}

export const instanceAPI = {
  getInstances: () => api.get('/instance/'),
  createInstance: (data: {
    name: string
    cluster_id: number
    internal_port?: number
    external_port?: number
    description?: string
    status?: string
  }) => api.post('/instance', data),
  getInstance: (id: number) => api.get(`/instance/${id}`),
  updateInstance: (
    id: number,
    data: {
      name: string
      cluster_id: number
      internal_port: number
      external_port: number
      description?: string
    }
  ) => api.put(`/instance/${id}`, data),
  deleteInstance: (id: number) => api.delete(`/instance/${id}`),
  getInstanceRelated: (id: number) => api.get(`/instance/${id}/related`),
}

export const databaseAPI = {
  getDatabases: () => api.get('/database/'),
  createDatabase: (data: {
    name: string
    instance_id: number
  }) => api.post('/database/', data),
  getDatabase: (id: number) => api.get(`/database/${id}`),
  updateDatabase: (
    id: number,
    data: {
      name: string
      instance_id: number
    }
  ) => api.put(`/database/${id}`, data),
  deleteDatabase: (id: number) => api.delete(`/database/${id}`),
}

export const dbUserAPI = {
  getDbUsers: () => api.get('/user/db'),
  createDbUser: (data: {
    username: string
    password: string
    instance_id: number
    app_id?: number | null
    permissions?: Array<{ database_id: number; privileges: string[] }>
  }) => api.post('/user/db', data),
  getDbUser: (id: number) => api.get(`/user/db/${id}`),
  updateDbUser: (
    id: number,
    data: {
      username?: string
      password?: string
      instance_id?: number
      app_id?: number | null
      permissions?: Array<{ database_id: number; privileges: string[] }>
    }
  ) => api.put(`/user/db/${id}`, data),
  deleteDbUser: (id: number) => api.delete(`/user/db/${id}`),
}

export const systemUserAPI = {
  getUsers: () => api.get('/auth/users'),
  createUser: (data: { username: string; password: string; role?: string }) =>
    api.post('/auth/users', data),
  getUser: (id: number) => api.get(`/auth/users/${id}`),
  updateUser: (id: number, data: { username?: string; password?: string; role?: string }) =>
    api.put(`/auth/users/${id}`, data),
  deleteUser: (id: number) => api.delete(`/auth/users/${id}`),
}

export const dictionaryAPI = {
  getGroups: () => api.get('/dictionary/groups'),
  createGroup: (data: { name: string; code: string }) =>
    api.post('/dictionary/groups', data),
  updateGroup: (id: number, data: { name?: string; code?: string }) =>
    api.put(`/dictionary/groups/${id}`, data),
  deleteGroup: (id: number) => api.delete(`/dictionary/groups/${id}`),

  getStaff: () => api.get('/dictionary/staff'),
  createStaff: (data: { name: string; code: string; group_id: number }) =>
    api.post('/dictionary/staff', data),
  updateStaff: (id: number, data: { name?: string; code?: string; group_id?: number }) =>
    api.put(`/dictionary/staff/${id}`, data),
  deleteStaff: (id: number) => api.delete(`/dictionary/staff/${id}`),

  getApps: () => api.get('/dictionary/apps'),
  createApp: (data: { name: string; domain?: string; developer?: string; operator?: string; description?: string }) =>
    api.post('/dictionary/apps', data),
  updateApp: (id: number, data: { name?: string; domain?: string; developer?: string; operator?: string; description?: string }) =>
    api.put(`/dictionary/apps/${id}`, data),
  deleteApp: (id: number) => api.delete(`/dictionary/apps/${id}`),
}

export const activityAPI = {
  getActivities: (limit?: number) => api.get('/activity', { params: { limit } }),
}

export const migrationAPI = {
  getMigrations: () => api.get('/migration'),
  createMigration: (data: {
    source_instance_id: number
    target_instance_id: number
    databases: number[]
    users: number[]
    source_status?: string
    target_status?: string
  }) => api.post('/migration', data),
  getMigration: (id: number) => api.get(`/migration/${id}`),
}

export default api
