import { useState, useEffect } from 'react'
import { Table, Button, Input, Modal, Form, message, Space, Tag, Select, Popconfirm } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons'
import { systemUserAPI } from '@/lib/api'

interface SystemUser {
  id: number
  username: string
  role: string
}

const roleOptions = [
  { label: '管理员', value: 'admin' },
  { label: '运维', value: 'operator' },
  { label: '普通用户', value: 'user' },
]

interface SystemUsersProps {
  role: string
}

const SystemUsers: React.FC<SystemUsersProps> = ({ role }) => {
  const [users, setUsers] = useState<SystemUser[]>([])
  const [loading, setLoading] = useState(true)
  const [searchText, setSearchText] = useState('')
  const [modalVisible, setModalVisible] = useState(false)
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null)
  const [form] = Form.useForm()

  const canEdit = role === 'admin'
  const canDelete = role === 'admin'

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const response = await systemUserAPI.getUsers()
      setUsers(response.data)
    } catch {
      message.error('获取用户失败')
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = () => {
    setEditingUser(null)
    form.resetFields()
    setModalVisible(true)
  }

  const handleEdit = (record: SystemUser) => {
    setEditingUser(record)
    form.setFieldsValue(record)
    setModalVisible(true)
  }

  const handleDelete = async (id: number) => {
    try {
      await systemUserAPI.deleteUser(id)
      message.success('删除成功')
      fetchUsers()
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } }
      message.error(error?.response?.data?.error || '删除失败')
    }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      if (editingUser) {
        await systemUserAPI.updateUser(editingUser.id, values)
        message.success('更新成功')
      } else {
        await systemUserAPI.createUser(values)
        message.success('创建成功')
      }
      setModalVisible(false)
      fetchUsers()
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } }
      message.error(error?.response?.data?.error || '操作失败')
    }
  }

  const filteredUsers = users.filter(
    (user) =>
      user.username.toLowerCase().includes(searchText.toLowerCase()) ||
      user.role.toLowerCase().includes(searchText.toLowerCase())
  )

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '用户名', dataIndex: 'username' },
    {
      title: '角色',
      dataIndex: 'role',
      render: (r: string) => (
        <Tag color={r === 'admin' ? 'red' : r === 'operator' ? 'orange' : 'blue'}>
          {r === 'admin' ? '管理员' : r === 'operator' ? '运维' : '普通用户'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: unknown, record: SystemUser) => (
        <Space>
          {canEdit && (
            <Button
              type="link"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
              disabled={record.username === 'admin'}
            >
              编辑
            </Button>
          )}
          {canDelete && (
            <Popconfirm
              title="确定删除此用户?"
              onConfirm={() => handleDelete(record.id)}
              disabled={record.username === 'admin'}
            >
              <Button type="link" danger icon={<DeleteOutlined />} disabled={record.username === 'admin'}>
                删除
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Input
          placeholder="搜索用户名或角色..."
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
        title={editingUser ? '编辑用户' : '添加用户'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        okText="确定"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input placeholder="请输入用户名" disabled={editingUser?.username === 'admin'} />
          </Form.Item>
          <Form.Item
            name="password"
            label={editingUser ? '密码（留空则不修改）' : '密码'}
            rules={editingUser ? [] : [{ required: true, message: '请输入密码' }]}
          >
            <Input.Password placeholder={editingUser ? '留空则不修改' : '请输入密码'} />
          </Form.Item>
          <Form.Item name="role" label="角色" rules={[{ required: true, message: '请选择角色' }]}>
            <Select
              placeholder="请选择角色"
              options={roleOptions.map((r) => ({ label: r.label, value: r.value }))}
              disabled={editingUser?.username === 'admin'}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default SystemUsers
