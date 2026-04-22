import { useState, useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { Layout, Menu, theme } from 'antd'
import {
  DashboardOutlined,
  ClusterOutlined,
  DesktopOutlined,
  DatabaseOutlined,
  UserOutlined,
  TeamOutlined,
  BookOutlined,
} from '@ant-design/icons'
import Dashboard from './pages/Dashboard'
import Clusters from './pages/Clusters'
import Instances from './pages/Instances'
import Databases from './pages/Databases'
import DbUsers from './pages/DbUsers'
import SystemUsers from './pages/SystemUsers'
import Dictionary from './pages/Dictionary'
import Login from './pages/Login'
import { authAPI } from './lib/api'

const { Header, Sider, Content } = Layout

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.exp * 1000 < Date.now()
  } catch {
    return true
  }
}

const App: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    const token = localStorage.getItem('token')
    if (!token) return false
    return !isTokenExpired(token)
  })
  const [userRole, setUserRole] = useState<string>(() => {
    return localStorage.getItem('role') || 'user'
  })
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken()

  useEffect(() => {
    if (isLoggedIn) {
      const interval = setInterval(() => {
        const token = localStorage.getItem('token')
        if (!token || isTokenExpired(token)) {
          handleLogout()
        }
      }, 60000)
      return () => clearInterval(interval)
    }
  }, [isLoggedIn])

  const handleLogin = (token: string, role: string) => {
    localStorage.setItem('token', token)
    localStorage.setItem('role', role)
    setUserRole(role)
    setIsLoggedIn(true)
  }

  const handleLogout = async () => {
    try {
      await authAPI.logout()
    } catch {
    }
    localStorage.removeItem('token')
    localStorage.removeItem('role')
    localStorage.removeItem('user')
    setIsLoggedIn(false)
  }

  if (!isLoggedIn) {
    return <Login onLogin={handleLogin} />
  }

  const menuItems = [
    { key: '/', icon: <DashboardOutlined />, label: '仪表盘' },
    { key: '/clusters', icon: <ClusterOutlined />, label: '集群管理' },
    { key: '/instances', icon: <DesktopOutlined />, label: '实例管理' },
    { key: '/databases', icon: <DatabaseOutlined />, label: '数据库管理' },
    { key: '/db-users', icon: <UserOutlined />, label: '数据库用户' },
  ]

  if (userRole === 'admin') {
    menuItems.push({ key: '/system-users', icon: <TeamOutlined />, label: '系统用户' })
  }

  if (userRole === 'admin' || userRole === 'operator') {
    menuItems.push({ key: '/dictionary', icon: <BookOutlined />, label: '字典维护' })
  }

  const getSelectedKey = () => {
    const path = location.pathname
    if (path === '/') return '/'
    const match = menuItems.find(item => item.key !== '/' && path.startsWith(item.key))
    return match?.key || '/'
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider trigger={null} collapsible collapsed={collapsed} onCollapse={setCollapsed}>
        <div style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: collapsed ? 14 : 18,
          fontWeight: 'bold'
        }}>
          {collapsed ? 'TDSQL' : 'TDSQL 数据库管理'}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[getSelectedKey()]}
          items={menuItems}
          onClick={({ key }) => {
            navigate(key)
          }}
        />
      </Sider>
      <Layout>
        <Header style={{ padding: '0 16px', background: colorBgContainer, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 16 }}>
          <span>{userRole === 'admin' ? '管理员' : userRole === 'operator' ? '运维' : '普通用户'}</span>
          <a onClick={handleLogout} style={{ cursor: 'pointer' }}>退出登录</a>
        </Header>
        <Content style={{ margin: 16, padding: 24, background: colorBgContainer, borderRadius: borderRadiusLG, overflow: 'auto' }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/clusters" element={<Clusters role={userRole} />} />
            <Route path="/instances" element={<Instances role={userRole} />} />
            <Route path="/databases" element={<Databases role={userRole} />} />
            <Route path="/db-users" element={<DbUsers role={userRole} />} />
            <Route path="/system-users" element={<SystemUsers role={userRole} />} />
            <Route path="/dictionary" element={<Dictionary role={userRole} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  )
}

export default App
