import { useState, useEffect } from 'react'
import { Table, Button, Input, Modal, Form, message, Space, Popconfirm, Tag, Checkbox } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons'
import { clusterAPI } from '@/lib/api'

interface Cluster {
  id: number
  name: string
  description: string
  is_xinchuang: boolean
  is_dingjia: boolean
}

interface ClustersProps {
  role: string
}

const Clusters: React.FC<ClustersProps> = ({ role }) => {
  const [clusters, setClusters] = useState<Cluster[]>([])
  const [loading, setLoading] = useState(true)
  const [searchText, setSearchText] = useState('')
  const [modalVisible, setModalVisible] = useState(false)
  const [editingCluster, setEditingCluster] = useState<Cluster | null>(null)
  const [form] = Form.useForm()
  
  const [relatedModalVisible, setRelatedModalVisible] = useState(false)
  const [relatedData, setRelatedData] = useState<{ instances: Cluster[]; databases: Cluster[]; users: Cluster[] }>({
    instances: [],
    databases: [],
    users: []
  })
  const [deleteWithRelated, setDeleteWithRelated] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const canEdit = role === 'admin' || role === 'operator'
  const canDelete = role === 'admin' || role === 'operator'

  useEffect(() => {
    fetchClusters()
  }, [])

  const fetchClusters = async () => {
    setLoading(true)
    try {
      const res = await clusterAPI.getClusters()
      setClusters(res.data)
    } catch {
      message.error('获取集群失败')
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = () => {
    setEditingCluster(null)
    form.resetFields()
    setModalVisible(true)
  }

  const handleEdit = (record: Cluster) => {
    setEditingCluster(record)
    form.setFieldsValue(record)
    setModalVisible(true)
  }

  const handleDeleteClick = async (id: number) => {
    try {
      const res = await clusterAPI.getClusterRelated(id)
      setRelatedData(res.data)
      setDeletingId(id)
      setDeleteWithRelated(false)
      setRelatedModalVisible(true)
    } catch {
      message.error('获取关联数据失败')
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deletingId) return
    
    try {
      await clusterAPI.deleteCluster(deletingId)
      message.success('删除成功')
      setRelatedModalVisible(false)
      fetchClusters()
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } }
      message.error(error?.response?.data?.error || '删除失败')
    }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      if (editingCluster) {
        await clusterAPI.updateCluster(editingCluster.id, values)
        message.success('更新成功')
      } else {
        await clusterAPI.createCluster(values)
        message.success('创建成功')
      }
      setModalVisible(false)
      fetchClusters()
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } }
      message.error(error?.response?.data?.error || '操作失败')
    }
  }

  const filteredClusters = clusters.filter((c) =>
    c.name.toLowerCase().includes(searchText.toLowerCase()) ||
    c.description?.toLowerCase().includes(searchText.toLowerCase())
  )

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '名称', dataIndex: 'name', width: 150 },
    { title: '描述', dataIndex: 'description' },
    { 
      title: '信创', 
      dataIndex: 'is_xinchuang', 
      width: 80,
      render: (v: boolean) => v ? <Tag color="green">是</Tag> : <Tag>否</Tag>
    },
    { 
      title: '鼎甲', 
      dataIndex: 'is_dingjia', 
      width: 80,
      render: (v: boolean) => v ? <Tag color="blue">是</Tag> : <Tag>否</Tag>
    },
    ...(canEdit || canDelete ? [{
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: unknown, record: Cluster) => (
        <Space>
          {canEdit && (
            <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
              编辑
            </Button>
          )}
          {canDelete && (
            <Popconfirm title="确定删除此集群?" onConfirm={() => handleDeleteClick(record.id)}>
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
          placeholder="搜索集群..."
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ width: 300 }}
        />
        {canEdit && (
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            添加集群
          </Button>
        )}
      </div>

      <Table columns={columns} dataSource={filteredClusters} loading={loading} rowKey="id" pagination={{ pageSize: 10 }} />

      <Modal
        title={editingCluster ? '编辑集群' : '添加集群'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        okText="确定"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="集群名称" rules={[{ required: true, message: '请输入集群名称' }]}>
            <Input placeholder="请输入集群名称" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea placeholder="请输入描述" rows={2} />
          </Form.Item>
          <Form.Item name="is_xinchuang" valuePropName="checked">
            <Checkbox>是否信创</Checkbox>
          </Form.Item>
          <Form.Item name="is_dingjia" valuePropName="checked">
            <Checkbox>是否接入鼎甲</Checkbox>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="删除集群"
        open={relatedModalVisible}
        onOk={handleDeleteConfirm}
        onCancel={() => setRelatedModalVisible(false)}
        okText="确定删除"
        cancelText="取消"
        okButtonProps={{ danger: true }}
      >
        <div style={{ marginBottom: 16 }}>
          该集群下有关联数据：
        </div>
        <div style={{ marginBottom: 16, padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
          <div>实例: <strong>{relatedData.instances.length}</strong> 个</div>
          <div>数据库: <strong>{relatedData.databases.length}</strong> 个</div>
          <div>数据库用户: <strong>{relatedData.users.length}</strong> 个</div>
        </div>
        {(relatedData.instances.length > 0 || relatedData.databases.length > 0 || relatedData.users.length > 0) && (
          <div>
            <Checkbox 
              checked={deleteWithRelated} 
              onChange={(e) => setDeleteWithRelated(e.target.checked)}
            >
              同时删除关联的实例、数据库和用户
            </Checkbox>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default Clusters
