import { useState, useEffect } from 'react'
import { Table, Button, Input, Modal, Form, message, Space, Tag, Select, Popconfirm, Radio, Checkbox } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, SwapOutlined } from '@ant-design/icons'
import { instanceAPI, clusterAPI, databaseAPI, dbUserAPI, migrationAPI } from '@/lib/api'

interface Instance {
  id: number
  name: string
  cluster_id: number
  cluster_name: string
  internal_port: number
  external_port: number
  description: string
  status: string
}

interface Database {
  id: number
  name: string
  instance_id: number
}

interface DbUser {
  id: number
  username: string
  instance_id: number
}

interface InstancesProps {
  role: string
}

const statusMap: Record<string, { text: string; color: string }> = {
  online: { text: '已上线', color: 'green' },
  offline: { text: '已下线', color: 'red' },
  unused: { text: '未使用', color: 'default' },
}

const Instances: React.FC<InstancesProps> = ({ role }) => {
  const [instances, setInstances] = useState<Instance[]>([])
  const [clusters, setClusters] = useState<{ id: number; name: string }[]>([])
  const [databases, setDatabases] = useState<Database[]>([])
  const [dbUsers, setDbUsers] = useState<DbUser[]>([])
  const [loading, setLoading] = useState(true)
  const [searchText, setSearchText] = useState('')
  const [modalVisible, setModalVisible] = useState(false)
  const [migrateModalVisible, setMigrateModalVisible] = useState(false)
  const [editingInstance, setEditingInstance] = useState<Instance | null>(null)
  const [migratingInstance, setMigratingInstance] = useState<Instance | null>(null)
  const [form] = Form.useForm()
  
  const [targetType, setTargetType] = useState<'existing' | 'new'>('existing')
  const [selectedTargetCluster, setSelectedTargetCluster] = useState<number | null>(null)
  const [selectedTargetInstance, setSelectedTargetInstance] = useState<number | null>(null)
  const [newInstanceName, setNewInstanceName] = useState('')
  const [newInstanceClusterId, setNewInstanceClusterId] = useState<number | null>(null)
  const [newInstanceInternalPort, setNewInstanceInternalPort] = useState<number | undefined>()
  const [newInstanceExternalPort, setNewInstanceExternalPort] = useState<number | undefined>()
  const [newInstanceDescription, setNewInstanceDescription] = useState('')
  const [sourceStatus, setSourceStatus] = useState('unused')
  const [targetStatus, setTargetStatus] = useState('online')
  
  const [selectedDatabases, setSelectedDatabases] = useState<number[]>([])
  const [selectedUsers, setSelectedUsers] = useState<number[]>([])

  const [relatedModalVisible, setRelatedModalVisible] = useState(false)
  const [relatedData, setRelatedData] = useState<{ databases: Database[]; users: DbUser[] }>({
    databases: [],
    users: []
  })
  const [deleteWithRelated, setDeleteWithRelated] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const canEdit = role === 'admin' || role === 'operator'
  const canDelete = role === 'admin' || role === 'operator'

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [instancesRes, clustersRes, dbRes, usersRes] = await Promise.all([
        instanceAPI.getInstances(),
        clusterAPI.getClusters(),
        databaseAPI.getDatabases(),
        dbUserAPI.getDbUsers(),
      ])
      setInstances(instancesRes.data)
      setClusters(clustersRes.data)
      setDatabases(dbRes.data)
      setDbUsers(usersRes.data)
    } catch {
      message.error('获取数据失败')
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = () => {
    setEditingInstance(null)
    form.resetFields()
    setModalVisible(true)
  }

  const handleEdit = (record: Instance) => {
    setEditingInstance(record)
    form.setFieldsValue(record)
    setModalVisible(true)
  }

  const handleDelete = async (id: number) => {
    try {
      const res = await instanceAPI.getInstanceRelated(id)
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
      await instanceAPI.deleteInstance(deletingId)
      message.success('删除成功')
      setRelatedModalVisible(false)
      fetchData()
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } }
      message.error(error?.response?.data?.error || '删除失败')
    }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      if (editingInstance) {
        await instanceAPI.updateInstance(editingInstance.id, values)
        message.success('更新成功')
      } else {
        await instanceAPI.createInstance(values)
        message.success('创建成功')
      }
      setModalVisible(false)
      fetchData()
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } }
      message.error(error?.response?.data?.error || '操作失败')
    }
  }

  const handleMigrate = (record: Instance) => {
    setMigratingInstance(record)
    setTargetType('existing')
    setSelectedTargetCluster(null)
    setSelectedTargetInstance(null)
    setNewInstanceName(record.name)
    setNewInstanceClusterId(null)
    setNewInstanceInternalPort(4000)
    setNewInstanceExternalPort(15000)
    setNewInstanceDescription(record.description || '')
    setSourceStatus('unused')
    setTargetStatus('online')
    
    setSelectedDatabases(databases.filter(d => d.instance_id === record.id).map(d => d.id))
    setSelectedUsers(dbUsers.filter(u => u.instance_id === record.id).map(u => u.id))
    
    setMigrateModalVisible(true)
  }

  const handleMigrateSubmit = async () => {
    if (!migratingInstance) return

    let targetInstanceId: number

    if (targetType === 'new') {
      if (!newInstanceName) {
        message.error('请填写新实例名称')
        return
      }
      if (!newInstanceClusterId) {
        message.error('请选择新实例所属集群')
        return
      }
      if (newInstanceClusterId === migratingInstance?.cluster_id) {
        message.error('不能在同一集群中迁移，请选择其他集群')
        return
      }
      
      try {
        const res = await instanceAPI.createInstance({
          name: newInstanceName,
          cluster_id: newInstanceClusterId,
          internal_port: newInstanceInternalPort || 3306,
          external_port: newInstanceExternalPort || 3306,
          description: newInstanceDescription,
          status: targetStatus
        })
        targetInstanceId = res.data.id
      } catch (err: unknown) {
        const error = err as { response?: { data?: { error?: string } } }
        message.error(error?.response?.data?.error || '创建新实例失败')
        return
      }
    } else {
      if (!selectedTargetInstance) {
        message.error('请选择目标实例')
        return
      }
      targetInstanceId = selectedTargetInstance
    }

    if (selectedDatabases.length === 0 && selectedUsers.length === 0) {
      message.error('请选择至少一个数据库或用户进行迁移')
      return
    }

    try {
      await migrationAPI.createMigration({
        source_instance_id: migratingInstance.id,
        target_instance_id: targetInstanceId,
        databases: selectedDatabases,
        users: selectedUsers,
        source_status: sourceStatus,
        target_status: targetStatus,
      })
      message.success('迁移成功')
      setMigrateModalVisible(false)
      fetchData()
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } }
      message.error(error?.response?.data?.error || '迁移失败')
    }
  }

  const filteredInstances = instances.filter((inst) => {
    const search = searchText.toLowerCase()
    return (
      inst.name.toLowerCase().includes(search) ||
      inst.cluster_name?.toLowerCase().includes(search) ||
      inst.description?.toLowerCase().includes(search)
    )
  })

  const instanceDatabases = databases.filter(d => d.instance_id === migratingInstance?.id)
  const instanceUsers = dbUsers.filter(u => u.instance_id === migratingInstance?.id)
  const targetInstances = instances.filter(i => 
    i.id !== migratingInstance?.id && i.cluster_id !== migratingInstance?.cluster_id
  )
  const filteredTargetInstances = selectedTargetCluster 
    ? targetInstances.filter(i => i.cluster_id === selectedTargetCluster)
    : targetInstances

  const getTargetInstanceName = () => {
    if (!selectedTargetInstance) return '未选择'
    const instance = targetInstances.find(i => i.id === selectedTargetInstance)
    return instance ? `${instance.name} (${instance.cluster_name})` : '未选择'
  }

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '名称', dataIndex: 'name' },
    { title: '集群', dataIndex: 'cluster_name', render: (t: string) => <Tag color="blue">{t}</Tag> },
    { title: '内部端口', dataIndex: 'internal_port', width: 100 },
    { title: '外部端口', dataIndex: 'external_port', width: 100 },
    { title: '状态', dataIndex: 'status', render: (s: string) => {
      const status = statusMap[s] || { text: s, color: 'default' }
      return <Tag color={status.color}>{status.text}</Tag>
    }},
    { title: '描述', dataIndex: 'description' },
    ...(canEdit || canDelete ? [{
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: unknown, r: Instance) => (
        <Space>
          {canEdit && (
            <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(r)}>
              编辑
            </Button>
          )}
          {canEdit && r.status !== 'offline' && (
            <Button type="link" icon={<SwapOutlined />} onClick={() => handleMigrate(r)}>
              迁移
            </Button>
          )}
          {canDelete && (
            <Popconfirm title="确定删除此实例?" onConfirm={() => handleDelete(r.id)} okButtonProps={{ danger: true }}>
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
          placeholder="搜索实例..."
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ width: 300 }}
        />
        {canEdit && (
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            添加实例
          </Button>
        )}
      </div>

      <Table columns={columns} dataSource={filteredInstances} loading={loading} rowKey="id" pagination={{ pageSize: 10 }} />

      <Modal
        title={editingInstance ? '编辑实例' : '添加实例'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        okText="确定"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="实例名称" rules={[{ required: true, message: '请输入实例名称' }]}>
            <Input placeholder="请输入实例名称" />
          </Form.Item>
          <Form.Item name="cluster_id" label="所属集群" rules={[{ required: true, message: '请选择所属集群' }]}>
            <Select
              placeholder="请选择集群"
              options={clusters.map((c) => ({ label: c.name, value: c.id }))}
            />
          </Form.Item>
          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item name="internal_port" label="内部端口" style={{ flex: 1 }}>
              <Input type="number" placeholder="默认 4000" />
            </Form.Item>
            <Form.Item name="external_port" label="外部端口" style={{ flex: 1 }}>
              <Input type="number" placeholder="默认 15000" />
            </Form.Item>
          </div>
          <Form.Item name="status" label="状态">
            <Select
              placeholder="请选择状态"
              options={[
                { label: '未使用', value: 'unused' },
                { label: '已上线', value: 'online' },
                { label: '已下线', value: 'offline' },
              ]}
            />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea placeholder="请输入描述" rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`迁移实例: ${migratingInstance?.name}`}
        open={migrateModalVisible}
        onOk={handleMigrateSubmit}
        onCancel={() => setMigrateModalVisible(false)}
        okText="确定迁移"
        cancelText="取消"
        width={600}
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8 }}>目标实例</div>
          <Radio.Group value={targetType} onChange={(e) => setTargetType(e.target.value)}>
            <Radio value="existing">选择已有实例</Radio>
            <Radio value="new">新建实例</Radio>
          </Radio.Group>
        </div>

        {targetType === 'existing' ? (
          <>
            <div style={{ marginBottom: 16 }}>
              <div style={{ marginBottom: 8 }}>选择目标集群</div>
              <Select
                placeholder="请选择目标集群"
                style={{ width: '100%' }}
                value={selectedTargetCluster}
                onChange={(value) => {
                  setSelectedTargetCluster(value)
                  setSelectedTargetInstance(null)
                }}
                options={clusters.filter(c => c.id !== migratingInstance?.cluster_id).map((c) => ({ label: c.name, value: c.id }))}
                showSearch
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ marginBottom: 8 }}>选择目标实例</div>
              <Select
                placeholder="请选择目标实例"
                style={{ width: '100%' }}
                value={selectedTargetInstance}
                onChange={setSelectedTargetInstance}
                options={filteredTargetInstances.map((i) => ({ label: `${i.name} (${i.cluster_name})`, value: i.id }))}
                disabled={!selectedTargetCluster}
                showSearch
              />
            </div>
          </>
        ) : (
          <div style={{ padding: 16, border: '1px solid #d9d9d9', borderRadius: 8, marginBottom: 16 }}>
            <div style={{ marginBottom: 12, fontWeight: 500 }}>新实例信息</div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ marginBottom: 4 }}>实例名称</div>
              <Input
                placeholder="请输入实例名称"
                value={newInstanceName}
                onChange={(e) => setNewInstanceName(e.target.value)}
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ marginBottom: 4 }}>所属集群</div>
              <Select
                placeholder="请选择集群"
                style={{ width: '100%' }}
                value={newInstanceClusterId}
                onChange={setNewInstanceClusterId}
                options={clusters.filter(c => c.id !== migratingInstance?.cluster_id).map((c) => ({ label: c.name, value: c.id }))}
                showSearch
              />
            </div>
            <div style={{ display: 'flex', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <div style={{ marginBottom: 4 }}>内部端口</div>
                <Input
                  type="number"
                  placeholder="默认 4000"
                  value={newInstanceInternalPort}
                  onChange={(e) => setNewInstanceInternalPort(Number(e.target.value))}
                />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ marginBottom: 4 }}>外部端口</div>
                <Input
                  type="number"
                  placeholder="默认 15000"
                  value={newInstanceExternalPort}
                  onChange={(e) => setNewInstanceExternalPort(Number(e.target.value))}
                />
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <div style={{ marginBottom: 4 }}>描述</div>
              <Input
                placeholder="请输入描述"
                value={newInstanceDescription}
                onChange={(e) => setNewInstanceDescription(e.target.value)}
              />
            </div>
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8, fontWeight: 500 }}>
            选择要迁移的数据库 (实例 {migratingInstance?.name} 共有 {instanceDatabases.length} 个数据库)
          </div>
          {instanceDatabases.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {instanceDatabases.map((db) => (
                <Tag.CheckableTag
                  key={db.id}
                  checked={selectedDatabases.includes(db.id)}
                  onChange={(checked) => {
                    if (checked) {
                      setSelectedDatabases([...selectedDatabases, db.id])
                    } else {
                      setSelectedDatabases(selectedDatabases.filter(id => id !== db.id))
                    }
                  }}
                >
                  {db.name}
                </Tag.CheckableTag>
              ))}
            </div>
          ) : (
            <Tag>无数据库</Tag>
          )}
        </div>

        <div>
          <div style={{ marginBottom: 8, fontWeight: 500 }}>
            选择要迁移的用户 (实例 {migratingInstance?.name} 共有 {instanceUsers.length} 个用户)
          </div>
          {instanceUsers.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {instanceUsers.map((user) => (
                <Tag.CheckableTag
                  key={user.id}
                  checked={selectedUsers.includes(user.id)}
                  onChange={(checked) => {
                    if (checked) {
                      setSelectedUsers([...selectedUsers, user.id])
                    } else {
                      setSelectedUsers(selectedUsers.filter(id => id !== user.id))
                    }
                  }}
                >
                  {user.username}
                </Tag.CheckableTag>
              ))}
            </div>
          ) : (
            <Tag>无用户</Tag>
          )}
        </div>

        <div style={{ marginTop: 16, padding: 16, border: '1px solid #d9d9d9', borderRadius: 8 }}>
          <div style={{ marginBottom: 12, fontWeight: 500 }}>迁移后状态设置</div>
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ marginBottom: 4 }}>源实例状态</div>
              <Select
                style={{ width: '100%' }}
                value={sourceStatus}
                onChange={setSourceStatus}
                options={[
                  { label: '未使用', value: 'unused' },
                  { label: '已上线', value: 'online' },
                  { label: '已下线', value: 'offline' },
                ]}
              />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ marginBottom: 4 }}>目标实例状态</div>
              <Select
                style={{ width: '100%' }}
                value={targetStatus}
                onChange={setTargetStatus}
                options={[
                  { label: '已上线', value: 'online' },
                  { label: '已下线', value: 'offline' },
                  { label: '未使用', value: 'unused' },
                ]}
              />
            </div>
          </div>
        </div>

        <div style={{ marginTop: 16, padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
          <div>迁移摘要:</div>
          <div>• 源实例: <strong>{migratingInstance?.name} ({migratingInstance?.cluster_name})</strong></div>
          <div>• 目标: <strong>{targetType === 'existing' ? getTargetInstanceName() : `${newInstanceName} (${clusters.find(c => c.id === newInstanceClusterId)?.name || '未选择'})`}</strong></div>
          <div>• 迁移数据库: <strong>{selectedDatabases.length}</strong> 个</div>
          <div>• 迁移用户: <strong>{selectedUsers.length}</strong> 个</div>
        </div>
      </Modal>

      <Modal
        title="删除实例"
        open={relatedModalVisible}
        onOk={handleDeleteConfirm}
        onCancel={() => setRelatedModalVisible(false)}
        okText="确定删除"
        cancelText="取消"
        okButtonProps={{ danger: true }}
      >
        <div style={{ marginBottom: 16 }}>
          该实例下有关联数据：
        </div>
        <div style={{ marginBottom: 16, padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
          <div>数据库: <strong>{relatedData.databases.length}</strong> 个</div>
          <div>数据库用户: <strong>{relatedData.users.length}</strong> 个</div>
        </div>
        {(relatedData.databases.length > 0 || relatedData.users.length > 0) && (
          <div>
            <Checkbox 
              checked={deleteWithRelated} 
              onChange={(e) => setDeleteWithRelated(e.target.checked)}
            >
              同时删除关联的数据库和用户
            </Checkbox>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default Instances
