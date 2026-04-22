import { useState, useEffect } from 'react'
import { Table, Button, Input, Modal, Form, message, Space, Tabs, Tag, Select, Alert } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, TeamOutlined, UserOutlined, AppstoreOutlined } from '@ant-design/icons'
import { dictionaryAPI } from '@/lib/api'

interface DictionaryProps {
  role: string
}

interface Group {
  id: number
  name: string
  code: string
}

interface Staff {
  id: number
  name: string
  code: string
  group_id: number
  group_name: string
}

interface App {
  id: number
  name: string
  domain: string
  developer: string
  developer_name: string
  operator: string
  operator_name: string
  description: string
}

const Dictionary: React.FC<DictionaryProps> = ({ role }) => {
  const canEdit = role === 'admin' || role === 'operator'
  const [activeTab, setActiveTab] = useState('groups')
  const [groups, setGroups] = useState<Group[]>([])
  const [staff, setStaff] = useState<Staff[]>([])
  const [apps, setApps] = useState<App[]>([])
  const [loading, setLoading] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [modalVisible, setModalVisible] = useState(false)
  const [editingItem, setEditingItem] = useState<Group | Staff | App | null>(null)
  const [groupConflictWarning, setGroupConflictWarning] = useState<string | null>(null)
  const [form] = Form.useForm()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [groupsRes, staffRes, appsRes] = await Promise.all([
        dictionaryAPI.getGroups(),
        dictionaryAPI.getStaff(),
        dictionaryAPI.getApps(),
      ])
      setGroups(groupsRes.data)
      setStaff(staffRes.data)
      setApps(appsRes.data)
    } catch {
      message.error('获取数据失败')
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = () => {
    setEditingItem(null)
    form.resetFields()
    setGroupConflictWarning(null)
    setModalVisible(true)
  }

  const handleEdit = (record: Group | Staff | App) => {
    setEditingItem(record)
    form.setFieldsValue(record)
    setGroupConflictWarning(null)
    setModalVisible(true)
  }

  const handleGroupChange = (newGroupId: number) => {
    if (activeTab !== 'staff') return
    
    const newGroup = groups.find(g => g.id === newGroupId)
    if (!newGroup) return
    
    let warning: string | null = null
    
    if (editingItem) {
      const staffMember = editingItem as Staff
      const oldGroup = groups.find(g => g.id === staffMember.group_id)
      
      if (oldGroup && newGroup && oldGroup.name !== newGroup.name) {
        const affectedApps = apps.filter(app => 
          app.developer === staffMember.code || app.operator === staffMember.code
        )
        
        if (affectedApps.length > 0) {
          const appNames = affectedApps.map(a => a.name).join('、')
          warning = `该人员正担任应用「${appNames}」的开发人员或运维人员，修改组可能会造成人员与角色不匹配。`
        }
      }
    }
    
    const staffCode = editingItem ? (editingItem as Staff).code : form.getFieldValue('code')
    if (staffCode) {
      const devApps = apps.filter(app => app.developer === staffCode)
      const opApps = apps.filter(app => app.operator === staffCode)
      
      if (devApps.length > 0 && !newGroup.name.includes('开发') && !newGroup.name.includes('维护')) {
        const appNames = devApps.map(a => a.name).join('、')
        warning = warning 
          ? warning + ` 该人员是应用「${appNames}」的开发人员，不应属于「${newGroup.name}」组。`
          : `该人员是应用「${appNames}」的开发人员，不应属于「${newGroup.name}」组。`
      }
      
      if (opApps.length > 0 && !newGroup.name.includes('维护')) {
        const appNames = opApps.map(a => a.name).join('、')
        warning = warning 
          ? warning + ` 该人员是应用「${appNames}」的运维人员，应属于「维护」组。`
          : `该人员是应用「${appNames}」的运维人员，应属于「维护」组。`
      }
    }
    
    setGroupConflictWarning(warning)
  }

  const handleDelete = async (id: number, type: 'group' | 'staff' | 'app') => {
    try {
      if (type === 'group') {
        await dictionaryAPI.deleteGroup(id)
      } else if (type === 'staff') {
        await dictionaryAPI.deleteStaff(id)
      } else {
        await dictionaryAPI.deleteApp(id)
      }
      message.success('删除成功')
      fetchData()
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } }
      message.error(error?.response?.data?.error || '删除失败')
    }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      if (editingItem) {
        if (activeTab === 'groups') {
          await dictionaryAPI.updateGroup((editingItem as Group).id, values)
        } else if (activeTab === 'staff') {
          await dictionaryAPI.updateStaff((editingItem as Staff).id, values)
        } else {
          await dictionaryAPI.updateApp((editingItem as App).id, values)
        }
        message.success('更新成功')
      } else {
        if (activeTab === 'groups') {
          await dictionaryAPI.createGroup(values)
        } else if (activeTab === 'staff') {
          await dictionaryAPI.createStaff(values)
        } else {
          await dictionaryAPI.createApp(values)
        }
        message.success('创建成功')
      }
      setModalVisible(false)
      fetchData()
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } }
      message.error(error?.response?.data?.error || '操作失败')
    }
  }

  const groupColumns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '组名称', dataIndex: 'name' },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: unknown, record: Group) => (
        <Space>
          {canEdit && (
            <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
              编辑
            </Button>
          )}
          {canEdit && (
            <Button type="link" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id, 'group')}>
              删除
            </Button>
          )}
        </Space>
      ),
    },
  ]

  const staffColumns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '姓名', dataIndex: 'name' },
    { title: '所属组', dataIndex: 'group_name', render: (t: string) => <Tag color="orange">{t}</Tag> },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: unknown, record: Staff) => (
        <Space>
          {canEdit && (
            <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
              编辑
            </Button>
          )}
          {canEdit && (
            <Button type="link" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id, 'staff')}>
              删除
            </Button>
          )}
        </Space>
      ),
    },
  ]

  const filteredGroups = groups.filter(
    (g) =>
      g.name.toLowerCase().includes(searchText.toLowerCase()) ||
      g.code.toLowerCase().includes(searchText.toLowerCase())
  )

  const filteredStaff = staff.filter(
    (s) =>
      s.name.toLowerCase().includes(searchText.toLowerCase()) ||
      s.code.toLowerCase().includes(searchText.toLowerCase()) ||
      s.group_name?.toLowerCase().includes(searchText.toLowerCase())
  )

  const groupOptions = groups.map(g => ({ label: g.name, value: g.id }))

  const appColumns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '应用名称', dataIndex: 'name' },
    { title: '域名', dataIndex: 'domain', render: (t: string) => t || '-' },
    { title: '开发人员', dataIndex: 'developer_name', render: (t: string) => t ? <Tag color="blue">{t}</Tag> : '-' },
    { title: '运维人员', dataIndex: 'operator_name', render: (t: string) => t ? <Tag color="orange">{t}</Tag> : '-' },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: unknown, record: App) => (
        <Space>
          {canEdit && (
            <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
              编辑
            </Button>
          )}
          {canEdit && (
            <Button type="link" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id, 'app')}>
              删除
            </Button>
          )}
        </Space>
      ),
    },
  ]

  const filteredApps = apps.filter(
    (a) =>
      a.name.toLowerCase().includes(searchText.toLowerCase()) ||
      a.domain?.toLowerCase().includes(searchText.toLowerCase())
  )

  const staffOptions = staff.map(s => ({ 
    label: `${s.name} (${s.group_name})`, 
    value: s.code 
  }))

  const developerOptions = staffOptions.filter(s => {
    const staffMember = staff.find(st => st.code === s.value)
    return staffMember?.group_name?.includes('开发')
  })

  const operatorOptions = staffOptions.filter(s => {
    const staffMember = staff.find(st => st.code === s.value)
    return staffMember?.group_name?.includes('维护')
  })

  const tabItems = [
    {
      key: 'groups',
      label: (
        <span>
          <TeamOutlined />
          组维护
        </span>
      ),
      children: (
        <div>
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
            <Input
              placeholder="搜索组..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 300 }}
            />
            {canEdit && (
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
                添加组
              </Button>
            )}
          </div>
          <Table columns={groupColumns} dataSource={filteredGroups} loading={loading} rowKey="id" pagination={{ pageSize: 10 }} />
        </div>
      ),
    },
    {
      key: 'staff',
      label: (
        <span>
          <UserOutlined />
          人员维护
        </span>
      ),
      children: (
        <div>
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
            <Input
              placeholder="搜索人员..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 300 }}
            />
            {canEdit && (
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
                添加人员
              </Button>
            )}
          </div>
          <Table columns={staffColumns} dataSource={filteredStaff} loading={loading} rowKey="id" pagination={{ pageSize: 10 }} />
        </div>
      ),
    },
    {
      key: 'apps',
      label: (
        <span>
          <AppstoreOutlined />
          应用维护
        </span>
      ),
      children: (
        <div>
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
            <Input
              placeholder="搜索应用..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 300 }}
            />
            {canEdit && (
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
                添加应用
              </Button>
            )}
          </div>
          <Table columns={appColumns} dataSource={filteredApps} loading={loading} rowKey="id" pagination={{ pageSize: 10 }} />
        </div>
      ),
    },
  ]

  return (
    <div>
      <Tabs activeKey={activeTab} items={tabItems} onChange={(key) => { setActiveTab(key); setSearchText(''); }} />

      <Modal
        title={activeTab === 'groups' ? (editingItem ? '编辑组' : '添加组') : activeTab === 'staff' ? (editingItem ? '编辑人员' : '添加人员') : (editingItem ? '编辑应用' : '添加应用')}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        okText="确定"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          {activeTab === 'groups' ? (
            <>
              <Form.Item name="name" label="组名称" rules={[{ required: true, message: '请输入组名称' }]}>
                <Input placeholder="请输入组名称" />
              </Form.Item>
            </>
          ) : activeTab === 'apps' ? (
            <>
              <Form.Item name="name" label="应用名称" rules={[{ required: true, message: '请输入应用名称' }]}>
                <Input placeholder="请输入应用名称" />
              </Form.Item>
              <Form.Item name="domain" label="域名">
                <Input placeholder="请输入域名" />
              </Form.Item>
              <Form.Item name="developer" label="开发人员">
                <Select placeholder="请选择开发人员" options={developerOptions} allowClear showSearch />
              </Form.Item>
              <Form.Item name="operator" label="运维人员">
                <Select placeholder="请选择运维人员" options={operatorOptions} allowClear showSearch />
              </Form.Item>
              <Form.Item name="description" label="描述">
                <Input.TextArea placeholder="请输入描述" rows={2} />
              </Form.Item>
            </>
          ) : (
            <>
              <Form.Item name="name" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}>
                <Input placeholder="请输入姓名" />
              </Form.Item>
              <Form.Item name="group_id" label="所属组" rules={[{ required: true, message: '请选择所属组' }]}>
                <Select
                  placeholder="请选择所属组"
                  options={groupOptions}
                  showSearch
                  filterOption={(input, option) =>
                    (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                  onChange={handleGroupChange}
                />
              </Form.Item>
              {groupConflictWarning && (
                <Alert 
                  message="人员组冲突" 
                  description={groupConflictWarning} 
                  type="warning" 
                  showIcon 
                  style={{ marginBottom: 16 }}
                />
              )}
            </>
          )}
        </Form>
      </Modal>
    </div>
  )
}

export default Dictionary
