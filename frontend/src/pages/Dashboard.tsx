import { Card, Row, Col, Statistic, Table, Tag, Timeline, Typography, Input, Button, Upload, message, Modal } from 'antd'
import { ClusterOutlined, DesktopOutlined, DatabaseOutlined, UserOutlined, TeamOutlined, ClockCircleOutlined, PlusOutlined, EditOutlined, DeleteOutlined, SwapOutlined, SearchOutlined, ExportOutlined, ImportOutlined, DownloadOutlined } from '@ant-design/icons'
import { useState, useEffect, useMemo } from 'react'
import { clusterAPI, instanceAPI, databaseAPI, dbUserAPI, dictionaryAPI, activityAPI } from '@/lib/api'
import { exportToExcel, parseImportExcel, ImportDataItem, generateImportTemplate } from '@/lib/exportExcel'

const { Text } = Typography

interface Activity {
  id: number
  action: string
  target_type: string
  target_name: string
  operator: string
  created_at: string
}

interface InstanceSummary {
  id: number
  name: string
  cluster_name: string
  status: string
  database_count: number
  user_count: number
}

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState({
    clusters: 0,
    instances: 0,
    databases: 0,
    dbUsers: 0,
    groups: 0,
    staff: 0,
  })
  const [instanceList, setInstanceList] = useState<InstanceSummary[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [instanceSearch, setInstanceSearch] = useState('')
  const [rawData, setRawData] = useState<{
    clusters: unknown[]
    instances: unknown[]
    databases: unknown[]
    dbUsers: unknown[]
    apps: unknown[]
  }>({ clusters: [], instances: [], databases: [], dbUsers: [], apps: [] })
  const [importModalVisible, setImportModalVisible] = useState(false)
  const [importData, setImportData] = useState<ImportDataItem[]>([])
  const [importing, setImporting] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [clustersRes, instancesRes, databasesRes, dbUsersRes, groupsRes, staffRes, activitiesRes, appsRes] = await Promise.all([
        clusterAPI.getClusters(),
        instanceAPI.getInstances(),
        databaseAPI.getDatabases(),
        dbUserAPI.getDbUsers(),
        dictionaryAPI.getGroups(),
        dictionaryAPI.getStaff(),
        activityAPI.getActivities(20),
        dictionaryAPI.getApps(),
      ])

      const clusters = clustersRes.data
      const instances = instancesRes.data
      const databases = databasesRes.data
      const dbUsers = dbUsersRes.data
      const groups = groupsRes.data
      const staff = staffRes.data
      const apps = appsRes.data

      setStats({
        clusters: clusters.length,
        instances: instances.length,
        databases: databases.length,
        dbUsers: dbUsers.length,
        groups: groups.length,
        staff: staff.length,
      })

      setRawData({ clusters, instances, databases, dbUsers, apps })

      const statusCount: Record<string, number> = { online: 0, offline: 0, unused: 0 }
      const dbPerInstance: Record<number, number> = {}
      const userPerInstance: Record<number, number> = {}
      
      instances.forEach((inst: { status: string }) => {
        statusCount[inst.status] = (statusCount[inst.status] || 0) + 1
      })
      
      databases.forEach((db: { instance_id: number }) => {
        dbPerInstance[db.instance_id] = (dbPerInstance[db.instance_id] || 0) + 1
      })
      
      dbUsers.forEach((u: { instance_id: number }) => {
        userPerInstance[u.instance_id] = (userPerInstance[u.instance_id] || 0) + 1
      })

      const instanceSummary: InstanceSummary[] = instances.map((inst: { id: number; name: string; cluster_name: string; status: string }) => ({
        id: inst.id,
        name: inst.name,
        cluster_name: inst.cluster_name,
        status: inst.status,
        database_count: dbPerInstance[inst.id] || 0,
        user_count: userPerInstance[inst.id] || 0,
      }))
      setInstanceList(instanceSummary)

      setActivities(activitiesRes.data || [])

    } catch (error) {
      console.error('获取数据失败', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredInstances = useMemo(() => {
    if (!instanceSearch) return instanceList
    const search = instanceSearch.toLowerCase()
    return instanceList.filter(i => 
      i.name.toLowerCase().includes(search) || 
      i.cluster_name.toLowerCase().includes(search)
    )
  }, [instanceList, instanceSearch])

  const instanceColumns = [
    { 
      title: '实例名称', 
      dataIndex: 'name', 
      render: (t: string) => <Tag color="orange">{t}</Tag>,
      width: 180,
      sorter: (a: InstanceSummary, b: InstanceSummary) => a.name.localeCompare(b.name),
    },
    { 
      title: '所属集群', 
      dataIndex: 'cluster_name', 
      width: 150,
      sorter: (a: InstanceSummary, b: InstanceSummary) => a.cluster_name.localeCompare(b.cluster_name),
    },
    { 
      title: '状态', 
      dataIndex: 'status',
      width: 100,
      sorter: (a: InstanceSummary, b: InstanceSummary) => a.status.localeCompare(b.status),
      render: (s: string) => {
        const colorMap: Record<string, string> = { online: 'green', offline: 'red', unused: 'default' }
        const textMap: Record<string, string> = { online: '已上线', offline: '已下线', unused: '未使用' }
        return <Tag color={colorMap[s]}>{textMap[s]}</Tag>
      }
    },
    { 
      title: '数据库数', 
      dataIndex: 'database_count', 
      width: 100,
      sorter: (a: InstanceSummary, b: InstanceSummary) => a.database_count - b.database_count,
    },
    { 
      title: '用户数', 
      dataIndex: 'user_count', 
      width: 100,
      sorter: (a: InstanceSummary, b: InstanceSummary) => a.user_count - b.user_count,
    },
  ]

  const getActivityIcon = (action: string) => {
    switch (action) {
      case '创建': return <PlusOutlined style={{ color: '#52c41a' }} />
      case '更新': return <EditOutlined style={{ color: '#1890ff' }} />
      case '删除': return <DeleteOutlined style={{ color: '#ff4d4f' }} />
      case '迁移': return <SwapOutlined style={{ color: '#722ed1' }} />
      default: return <ClockCircleOutlined />
    }
  }

  const getActivityColor = (action: string) => {
    switch (action) {
      case '创建': return 'green'
      case '更新': return 'blue'
      case '删除': return 'red'
      case '迁移': return 'purple'
      default: return 'gray'
    }
  }

  const handleExport = () => {
    exportToExcel(
      rawData.clusters as any,
      rawData.instances as any,
      rawData.databases as any,
      rawData.dbUsers as any,
      rawData.apps as any
    )
  }

  const handleImport = async (file: File) => {
    try {
      const data = await parseImportExcel(file)
      if (data.length === 0) {
        message.error('导入文件为空')
        return false
      }
      setImportData(data)
      setImportModalVisible(true)
    } catch (error) {
      message.error('解析Excel失败')
    }
    return false
  }

  const handleImportConfirm = async () => {
    setImporting(true)
    try {
      const clusters = rawData.clusters as any[]
      const instances = rawData.instances as any[]
      const databases = rawData.databases as any[]
      const dbUsers = rawData.dbUsers as any[]

      const clusterMap = new Map(clusters.map(c => [c.name, c]))
      const instanceMap = new Map(instances.map(i => [i.name, i]))

      let successCount = 0
      const errors: string[] = []

      for (const item of importData) {
        try {
          if (item.type === '集群') {
            const existing = clusterMap.get(item.name)
            if (existing) {
              await clusterAPI.updateCluster(existing.id, { name: item.name, description: item.description || '' })
            } else {
              await clusterAPI.createCluster({ name: item.name, description: item.description || '' })
            }
            successCount++
          } else if (item.type === '实例') {
            const cluster = clusterMap.get(item.cluster_name || '')
            if (!cluster) {
              errors.push(`实例 ${item.name}: 所属集群不存在`)
              continue
            }
            const existing = Array.from(instanceMap.values()).find(i => i.name === item.name && i.cluster_id === cluster.id)
            if (existing) {
              await instanceAPI.updateInstance(existing.id, {
                name: item.name,
                cluster_id: cluster.id,
                internal_port: Number(item.internal_port) || 0,
                external_port: Number(item.external_port) || 0,
                description: item.description || ''
              })
            } else {
              await instanceAPI.createInstance({
                name: item.name,
                cluster_id: cluster.id,
                internal_port: Number(item.internal_port) || 0,
                external_port: Number(item.external_port) || 0,
                status: item.status || 'unused',
                description: item.description || ''
              })
            }
            successCount++
          } else if (item.type === '数据库') {
            const cluster = clusterMap.get(item.cluster_name || '')
            if (!cluster) {
              errors.push(`数据库 ${item.name}: 所属集群不存在`)
              continue
            }
            const instancesInCluster = instances.filter(i => i.cluster_id === cluster.id)
            const instance = instancesInCluster.find(i => i.name === item.instance_name)
            if (!instance) {
              errors.push(`数据库 ${item.name}: 所属实例不存在`)
              continue
            }
            const existing = databases.find(d => d.name === item.name && d.instance_id === instance.id)
            if (existing) {
              await databaseAPI.updateDatabase(existing.id, {
                name: item.name,
                instance_id: instance.id
              })
            } else {
              await databaseAPI.createDatabase({
                name: item.name,
                instance_id: instance.id
              })
            }
            successCount++
          } else if (item.type === '数据库用户') {
            const cluster = clusterMap.get(item.cluster_name || '')
            if (!cluster) {
              errors.push(`数据库用户 ${item.name}: 所属集群不存在`)
              continue
            }
            const instancesInCluster = instances.filter(i => i.cluster_id === cluster.id)
            const instance = instancesInCluster.find(i => i.name === item.instance_name)
            if (!instance) {
              errors.push(`数据库用户 ${item.name}: 所属实例不存在`)
              continue
            }

            const dbRes = await databaseAPI.getDatabases()
            const instanceDbs = dbRes.data.filter((d: any) => d.instance_id === instance.id)
            const dbMap = new Map(instanceDbs.map((d: any) => [d.name, d.id]))

            const permissions: { database_id: number; privileges: string[] }[] = []
            if (item.permissions) {
              const perms = item.permissions.split(';')
              for (const p of perms) {
                const [dbName, privs] = p.split(':')
                if (dbName && privs) {
                  const dbId = Number(dbMap.get(dbName))
                  if (dbId) {
                    permissions.push({ database_id: dbId, privileges: privs.split(',') })
                  }
                }
              }
            }

            const existing = dbUsers.find(u => u.username === item.name && u.instance_id === instance.id)
            if (existing) {
              await dbUserAPI.updateDbUser(existing.id, {
                username: item.name,
                password: 'password123',
                instance_id: Number(instance.id),
                permissions
              })
            } else {
              await dbUserAPI.createDbUser({
                username: item.name,
                password: 'password123',
                instance_id: Number(instance.id),
                permissions
              })
            }
            successCount++
          }
        } catch (err: any) {
          errors.push(`处理 ${item.name} 失败: ${err.message || err}`)
        }
      }

      if (errors.length > 0) {
        message.warning(`导入完成: 成功 ${successCount} 条, 失败 ${errors.length} 条`)
      } else {
        message.success(`导入成功: ${successCount} 条`)
      }

      setImportModalVisible(false)
      fetchData()
    } catch (error: any) {
      message.error(`导入失败: ${error.message}`)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>仪表盘</h1>
        <Button type="primary" icon={<ExportOutlined />} onClick={handleExport}>
          导出 Excel
        </Button>
        <Upload beforeUpload={handleImport} showUploadList={false} accept=".xlsx,.xls">
          <Button icon={<ImportOutlined />}>导入 Excel</Button>
        </Upload>
        <Button icon={<DownloadOutlined />} onClick={() => generateImportTemplate()}>
          下载模板
        </Button>
      </div>
      
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={8} md={4}>
          <Card>
            <Statistic
              title="集群数量"
              value={stats.clusters}
              prefix={<ClusterOutlined />}
              loading={loading}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card>
            <Statistic
              title="实例数量"
              value={stats.instances}
              prefix={<DesktopOutlined />}
              loading={loading}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card>
            <Statistic
              title="数据库数量"
              value={stats.databases}
              prefix={<DatabaseOutlined />}
              loading={loading}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card>
            <Statistic
              title="数据库用户"
              value={stats.dbUsers}
              prefix={<UserOutlined />}
              loading={loading}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card>
            <Statistic
              title="组数量"
              value={stats.groups}
              prefix={<TeamOutlined />}
              loading={loading}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card>
            <Statistic
              title="人员数量"
              value={stats.staff}
              prefix={<UserOutlined />}
              loading={loading}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={24}>
          <Card 
            title={<><ClockCircleOutlined /> 最新动态</>}
            styles={{ body: { maxHeight: 300, overflow: 'auto' } }}
          >
            {loading ? (
              <div style={{ textAlign: 'center', padding: 20 }}>加载中...</div>
            ) : activities.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 20, color: '#999' }}>暂无动态</div>
            ) : (
              <Timeline
                items={activities.slice(0, 15).map((activity) => ({
                  dot: getActivityIcon(activity.action),
                  color: getActivityColor(activity.action),
                  children: (
                    <div style={{ padding: '2px 0' }}>
                      <Text strong>{activity.action}</Text>
                      <Text> {activity.target_type}</Text>
                      <Tag>{activity.target_name}</Tag>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {activity.operator} | {activity.created_at}
                      </Text>
                    </div>
                  ),
                }))}
              />
            )}
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card 
            title={<><DesktopOutlined /> 实例列表 ({filteredInstances.length})</>}
            extra={
              <Input
                placeholder="搜索实例..."
                prefix={<SearchOutlined />}
                value={instanceSearch}
                onChange={(e) => setInstanceSearch(e.target.value)}
                style={{ width: 200 }}
              />
            }
          >
            <Table
              columns={instanceColumns}
              dataSource={filteredInstances}
              loading={loading}
              rowKey="id"
              pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }}
              size="small"
              scroll={{ x: 650 }}
            />
          </Card>
        </Col>
      </Row>

      <Modal
        title="导入确认"
        open={importModalVisible}
        onOk={handleImportConfirm}
        onCancel={() => setImportModalVisible(false)}
        confirmLoading={importing}
        width={800}
      >
        <p>共导入 {importData.length} 条数据，确认执行导入操作？</p>
        <Table
          dataSource={importData.slice(0, 10)}
          columns={[
            { title: '类型', dataIndex: 'type', width: 80 },
            { title: '名称', dataIndex: 'name' },
            { title: '所属集群', dataIndex: 'cluster_name' },
            { title: '所属实例', dataIndex: 'instance_name' }
          ]}
          size="small"
          pagination={false}
        />
        {importData.length > 10 && <p>...还有 {importData.length - 10} 条数据</p>}
      </Modal>
    </div>
  )
}

export default Dashboard
