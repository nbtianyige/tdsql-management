import { useState, useEffect } from 'react'
import { Table, Button, Input, Modal, Form, message, Space, Tag, Select, Popconfirm } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons'
import { databaseAPI, instanceAPI, clusterAPI } from '@/lib/api'

interface Database {
  id: number
  name: string
  instance_id: number
  instance_name: string
  developer: string
  developer_name: string
  maintainer: string
  maintainer_name: string
}

interface DatabasesProps {
  role: string
}

const Databases: React.FC<DatabasesProps> = ({ role }) => {
  const [databases, setDatabases] = useState<Database[]>([])
  const [instances, setInstances] = useState<{ id: number; name: string; cluster_id?: number; cluster_name?: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [searchText, setSearchText] = useState('')
  const [modalVisible, setModalVisible] = useState(false)
  const [editingDb, setEditingDb] = useState<Database | null>(null)
  const [form] = Form.useForm()

  const canEdit = role === 'admin' || role === 'operator'
  const canDelete = role === 'admin' || role === 'operator'

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [dbRes, instRes, clusterRes] = await Promise.all([
        databaseAPI.getDatabases(),
        instanceAPI.getInstances(),
        clusterAPI.getClusters(),
      ])
      const instances = instRes.data
      const clusters = clusterRes.data
      
      const instanceMap: Record<number, { name: string; cluster_id: number; cluster_name: string }> = {}
      instances.forEach((inst: { id: number; name: string; cluster_id: number }) => {
        const cluster = clusters.find((c: { id: number }) => c.id === inst.cluster_id)
        instanceMap[inst.id] = {
          name: inst.name,
          cluster_id: inst.cluster_id,
          cluster_name: cluster?.name || 'Unknown'
        }
      })
      
      const databasesWithCluster = dbRes.data.map((db: { instance_id: number }) => ({
        ...db,
        instance_name: instanceMap[db.instance_id]?.name || 'Unknown',
        cluster_id: instanceMap[db.instance_id]?.cluster_id,
        cluster_name: instanceMap[db.instance_id]?.cluster_name || 'Unknown',
      }))
      
      setDatabases(databasesWithCluster)
      setInstances(instances)
    } catch {
      message.error('获取数据失败')
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = () => {
    setEditingDb(null)
    form.resetFields()
    setModalVisible(true)
  }

  const handleEdit = (record: Database) => {
    setEditingDb(record)
    form.setFieldsValue({
      ...record,
      developer: record.developer || undefined,
      maintainer: record.maintainer || undefined,
    })
    setModalVisible(true)
  }

  const handleDelete = async (id: number) => {
    try {
      await databaseAPI.deleteDatabase(id)
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
      if (editingDb) {
        await databaseAPI.updateDatabase(editingDb.id, values)
        message.success('更新成功')
      } else {
        await databaseAPI.createDatabase(values)
        message.success('创建成功')
      }
      setModalVisible(false)
      fetchData()
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } }
      message.error(error?.response?.data?.error || '操作失败')
    }
  }

  const filteredDatabases = databases.filter((db) => {
    const search = searchText.toLowerCase()
    return (
      db.name.toLowerCase().includes(search) ||
      db.instance_name?.toLowerCase().includes(search) ||
      db.developer_name?.toLowerCase().includes(search) ||
      db.maintainer_name?.toLowerCase().includes(search)
    )
  })

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '名称', dataIndex: 'name' },
    { title: '集群', dataIndex: 'cluster_name', render: (t: string) => <Tag color="purple">{t}</Tag> },
    { title: '实例', dataIndex: 'instance_name', render: (t: string) => <Tag color="green">{t}</Tag> },
    ...(canEdit || canDelete ? [{
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: unknown, r: Database) => (
        <Space>
          {canEdit && (
            <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(r)}>
              编辑
            </Button>
          )}
          {canDelete && (
            <Popconfirm title="确定删除此数据库?" onConfirm={() => handleDelete(r.id)}>
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
          placeholder="搜索数据库..."
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ width: 300 }}
        />
        {canEdit && (
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            添加数据库
          </Button>
        )}
      </div>

      <Table columns={columns} dataSource={filteredDatabases} loading={loading} rowKey="id" pagination={{ pageSize: 10 }} />

      <Modal
        title={editingDb ? '编辑数据库' : '添加数据库'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        okText="确定"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="数据库名称" rules={[{ required: true, message: '请输入数据库名称' }]}>
            <Input placeholder="请输入数据库名称" />
          </Form.Item>
          <Form.Item name="instance_id" label="所属实例" rules={[{ required: true, message: '请选择所属实例' }]}>
            <Select placeholder="请选择实例" options={instances.map((i) => ({ label: i.name, value: i.id }))} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default Databases
