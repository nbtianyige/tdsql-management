import { useState, useEffect } from 'react'
import { Table, Button, Input, Modal, Form, message, Space, Tag, Select, Checkbox, Popconfirm } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons'
import { dbUserAPI, instanceAPI, databaseAPI, clusterAPI, dictionaryAPI } from '@/lib/api'

interface DbUser {
  id: number
  username: string
  instance_id: number
  instance_name: string
  cluster_name: string
  permissions_detail: Array<{ database_id: number; database_name: string; privileges: string[] }>
}

const PRIVILEGES = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'ALL']

interface DbUsersProps {
  role: string
}

const DbUsers: React.FC<DbUsersProps> = ({ role }) => {
  const [dbUsers, setDbUsers] = useState<DbUser[]>([])
  const [instances, setInstances] = useState<{ id: number; name: string; cluster_id: number; cluster_name: string }[]>([])
  const [databases, setDatabases] = useState<{ id: number; name: string; instance_id: number }[]>([])
  const [apps, setApps] = useState<{ id: number; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [searchText, setSearchText] = useState('')
  const [modalVisible, setModalVisible] = useState(false)
  const [editingUser, setEditingUser] = useState<DbUser | null>(null)
  const [form] = Form.useForm()
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    instance_id: null as number | null,
    app_id: null as number | null,
    permissions: [] as Array<{ database_id: number; privileges: string[] }>,
  })

  const canEdit = role === 'admin' || role === 'operator'
  const canDelete = role === 'admin' || role === 'operator'

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [usersRes, instRes, dbRes, clusterRes, appsRes] = await Promise.all([
        dbUserAPI.getDbUsers(),
        instanceAPI.getInstances(),
        databaseAPI.getDatabases(),
        clusterAPI.getClusters(),
        dictionaryAPI.getApps(),
      ])
      setApps(appsRes.data)
      setDbUsers(usersRes.data)
      const instancesWithCluster = instRes.data.map((inst: { id: number; name: string; cluster_id: number }) => {
        const cluster = clusterRes.data.find((c: { id: number }) => c.id === inst.cluster_id)
        return {
          ...inst,
          cluster_name: cluster?.name || ''
        }
      })
      setInstances(instancesWithCluster)
      setDatabases(dbRes.data)
    } catch {
      message.error('获取数据失败')
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = () => {
    setEditingUser(null)
    form.resetFields()
    setFormData({ username: '', password: '', instance_id: null, app_id: null, permissions: [] })
    setModalVisible(true)
  }

  const handleEdit = (record: DbUser) => {
    setEditingUser(record)
    const permissions = record.permissions_detail?.map(p => ({
      database_id: p.database_id,
      privileges: p.privileges,
    })) || []
    setFormData({
      username: record.username,
      password: '',
      instance_id: record.instance_id,
      app_id: (record as any).app_id || null,
      permissions,
    })
    form.setFieldsValue({
      username: record.username,
      instance_id: record.instance_id,
      app_id: (record as any).app_id || null,
    })
    setModalVisible(true)
  }

  const handleDelete = async (id: number) => {
    try {
      await dbUserAPI.deleteDbUser(id)
      message.success('删除成功')
      fetchData()
    } catch {
      message.error('删除失败')
    }
  }

  const handleInstanceChange = (value: number) => {
    setFormData({ ...formData, instance_id: value, app_id: null, permissions: [] })
  }

  const handlePermissionChange = (databaseId: number, privilege: string, checked: boolean) => {
    setFormData((prev) => {
      const currentPermissions = prev.permissions
      const existingIndex = currentPermissions.findIndex((p) => p.database_id === databaseId)
      
      let newPrivileges: string[]
      
      if (privilege === 'ALL') {
        if (checked) {
          newPrivileges = ['ALL']
        } else {
          newPrivileges = []
        }
      } else {
        const allIndex = currentPermissions.findIndex(p => p.database_id === databaseId && p.privileges.includes('ALL'))
        
        if (checked) {
          if (allIndex >= 0) {
            return prev
          }
          newPrivileges = existingIndex >= 0 ? [...currentPermissions[existingIndex].privileges, privilege] : [privilege]
        } else {
          if (allIndex >= 0) {
            return prev
          }
          newPrivileges = existingIndex >= 0 ? currentPermissions[existingIndex].privileges.filter((p) => p !== privilege) : []
        }
      }
      
      if (existingIndex >= 0) {
        const updated = [...currentPermissions]
        updated[existingIndex] = { database_id: databaseId, privileges: newPrivileges }
        return { ...prev, permissions: updated }
      } else if (checked) {
        return { ...prev, permissions: [...currentPermissions, { database_id: databaseId, privileges: newPrivileges }] }
      }
      return prev
    })
  }

  const handleSubmit = async () => {
    try {
      await form.validateFields()
      if (!formData.instance_id) {
        message.error('请选择实例')
        return
      }
      if (!editingUser && (!formData.username || !formData.password)) {
        message.error('请填写用户名和密码')
        return
      }

      const submitData: {
        username: string
        instance_id: number
        permissions: Array<{ database_id: number; privileges: string[] }>
        password?: string
        app_id?: number
      } = {
        username: formData.username,
        instance_id: formData.instance_id,
        permissions: formData.permissions.filter((p) => p.privileges.length > 0),
      }

      if (formData.password) {
        submitData.password = formData.password
      }

      if (formData.app_id) {
        submitData.app_id = formData.app_id
      }

      if (editingUser) {
        await dbUserAPI.updateDbUser(editingUser.id, submitData as any)
        message.success('更新成功')
      } else {
        await dbUserAPI.createDbUser(submitData as any)
        message.success('创建成功')
      }
      setModalVisible(false)
      fetchData()
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } }
      message.error(error?.response?.data?.error || '操作失败')
    }
  }

  const filteredUsers = dbUsers.filter((user) => {
    const search = searchText.toLowerCase()
    const permissionsStr = user.permissions_detail?.map((p) => `${p.database_name}:${p.privileges.join(',')}`).join(' ') || ''
    return user.username.toLowerCase().includes(search) || user.instance_name?.toLowerCase().includes(search) || user.cluster_name?.toLowerCase().includes(search) || permissionsStr.toLowerCase().includes(search)
  })

  const instanceDatabases = databases.filter((db) => db.instance_id === formData.instance_id)

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '用户名', dataIndex: 'username' },
    { title: '应用名称', dataIndex: 'app_name', render: (t: string) => t || '-' },
    { title: '域名', dataIndex: 'app_domain', render: (t: string) => t || '-' },
    { title: '开发人员', dataIndex: 'app_developer', render: (t: string) => t || '-' },
    { title: '运维人员', dataIndex: 'app_operator', render: (t: string) => t || '-' },
    { title: '实例', dataIndex: 'instance_name', render: (t: string) => <Tag color="orange">{t}</Tag> },
    { title: '集群', dataIndex: 'cluster_name', render: (t: string) => <Tag color="blue">{t}</Tag> },
    {
      title: '权限',
      render: (_: unknown, r: DbUser) =>
        r.permissions_detail?.map((p, i) => (
          <Tag key={i} style={{ marginBottom: 4 }} color={p.privileges.includes('ALL') ? 'red' : 'green'}>
            {p.database_name}: {p.privileges.join(',')}
          </Tag>
        )),
    },
    ...(canEdit || canDelete ? [{
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: unknown, r: DbUser) => (
        <Space>
          {canEdit && (
            <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(r)}>
              编辑
            </Button>
          )}
          {canDelete && (
            <Popconfirm title="确定删除此用户?" onConfirm={() => handleDelete(r.id)}>
              <Button type="link" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    }] : []),
  ]

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Input
          placeholder="搜索用户..."
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ width: 300 }}
        />
        {canEdit && (
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            添加用户
          </Button>
        )}
      </div>

      <Table columns={columns} dataSource={filteredUsers} loading={loading} rowKey="id" pagination={{ pageSize: 10 }} />

      <Modal
        title={editingUser ? '编辑数据库用户' : '添加数据库用户'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        okText="确定"
        cancelText="取消"
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="username"
            label="用户名"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input 
              placeholder="请输入用户名" 
              onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
              disabled={!!editingUser}
            />
          </Form.Item>
          <Form.Item
            name="password"
            label={editingUser ? '密码（留空则不修改）' : '密码'}
            rules={editingUser ? [] : [{ required: true, message: '请输入密码' }]}
          >
            <Input.Password 
              placeholder={editingUser ? '留空则不修改' : '请输入密码'} 
              onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
            />
          </Form.Item>
          <Form.Item
            name="instance_id"
            label="所属实例"
            rules={[{ required: true, message: '请选择实例' }]}
          >
            <Select
              placeholder="请选择实例"
              onChange={handleInstanceChange}
              options={instances.map((i) => ({ label: `${i.name} (${i.cluster_name})`, value: i.id }))}
              disabled={!!editingUser}
            />
          </Form.Item>
          <Form.Item
            name="app_id"
            label="应用"
            rules={[{ required: true, message: '请选择应用' }]}
          >
            <Select
              placeholder="请选择应用"
              options={apps.map((a) => ({ label: a.name, value: a.id }))}
              allowClear
              onChange={(value) => setFormData((prev) => ({ ...prev, app_id: value }))}
            />
          </Form.Item>
          {formData.instance_id && instanceDatabases.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ marginBottom: 12, fontWeight: 500 }}>数据库权限配置</div>
              {instanceDatabases.map((db) => {
                const perm = formData.permissions.find((p) => p.database_id === db.id)
                const isAll = perm?.privileges?.includes('ALL')
                return (
                  <div
                    key={db.id}
                    style={{
                      padding: 12,
                      border: '1px solid #d9d9d9',
                      borderRadius: 8,
                      marginBottom: 12,
                    }}
                  >
                    <div style={{ fontWeight: 500, marginBottom: 8 }}>{db.name}</div>
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                      {PRIVILEGES.map((priv) => (
                        <Checkbox
                          key={priv}
                          checked={priv === 'ALL' ? isAll : (perm?.privileges?.includes(priv) && !isAll)}
                          onChange={(e) => handlePermissionChange(db.id, priv, e.target.checked)}
                        >
                          {priv}
                        </Checkbox>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Form>
      </Modal>
    </div>
  )
}

export default DbUsers
