import * as XLSX from 'xlsx'

const styles = {
  header: {
    fill: { fgColor: { rgb: '1F4E79' } },
    font: { color: { rgb: 'FFFFFF' }, sz: 12, bold: true },
    alignment: { horizontal: 'center', vertical: 'center' }
  },
  clusterTitle: {
    fill: { fgColor: { rgb: '2E75B6' } },
    font: { color: { rgb: 'FFFFFF' }, sz: 12, bold: true },
    alignment: { horizontal: 'center', vertical: 'center' }
  },
  clusterInfo: {
    fill: { fgColor: { rgb: 'D6DCE4' } },
    font: { color: { rgb: '1F4E79' }, bold: true },
    alignment: { horizontal: 'left', vertical: 'center' }
  },
  dataRow: {
    alignment: { vertical: 'center' },
    border: {
      top: { style: 'thin', color: { rgb: 'CCCCCC' } },
      bottom: { style: 'thin', color: { rgb: 'CCCCCC' } },
      left: { style: 'thin', color: { rgb: 'CCCCCC' } },
      right: { style: 'thin', color: { rgb: 'CCCCCC' } }
    }
  },
  instanceCol: {
    alignment: { vertical: 'center' },
    font: { bold: true },
    fill: { fgColor: { rgb: 'DEEBF7' } },
    border: {
      top: { style: 'thin', color: { rgb: 'CCCCCC' } },
      bottom: { style: 'thin', color: { rgb: 'CCCCCC' } },
      left: { style: 'thin', color: { rgb: 'CCCCCC' } },
      right: { style: 'thin', color: { rgb: 'CCCCCC' } }
    }
  },
  dbCol: {
    alignment: { vertical: 'center' },
    fill: { fgColor: { rgb: 'E2EFDA' } },
    border: {
      top: { style: 'thin', color: { rgb: 'CCCCCC' } },
      bottom: { style: 'thin', color: { rgb: 'CCCCCC' } },
      left: { style: 'thin', color: { rgb: 'CCCCCC' } },
      right: { style: 'thin', color: { rgb: 'CCCCCC' } }
    }
  }
}

export interface ClusterInfo {
  id: number
  name: string
  description: string
  is_xinchuang: boolean
  is_dingjia: boolean
}

export interface InstanceInfo {
  id: number
  name: string
  cluster_id: number
  cluster_name: string
  internal_port: number
  external_port: number
  status: string
  description: string
}

export interface DatabaseInfo {
  id: number
  name: string
  instance_id: number
  instance_name: string
  cluster_id: number
  cluster_name: string
}

export interface DbUserInfo {
  id: number
  username: string
  instance_id: number
  instance_name: string
  cluster_id: number
  cluster_name: string
  app_id: number | null
  app_name: string
  app_developer: string
  app_operator: string
  permissions_detail: { database_name: string; privileges: string[] }[]
}

export interface AppInfo {
  id: number
  name: string
  domain: string
  developer: string
  developer_name: string
  operator: string
  operator_name: string
  description: string
}

function setCellStyle(ws: XLSX.WorkSheet, row: number, col: number, style: any) {
  const cellRef = XLSX.utils.encode_cell({ r: row, c: col })
  if (!ws[cellRef]) return
  ws[cellRef].s = style
}

function setRowStyle(ws: XLSX.WorkSheet, row: number, startCol: number, endCol: number, style: any) {
  for (let c = startCol; c <= endCol; c++) {
    setCellStyle(ws, row, c, style)
  }
}

function mergeCell(ws: XLSX.WorkSheet, s: { r: number; c: number }, e: { r: number; c: number }) {
  if (!ws['!merges']) ws['!merges'] = []
  ws['!merges'].push({ s, e })
}

export function exportToExcel(
  clusters: ClusterInfo[],
  instances: InstanceInfo[],
  databases: DatabaseInfo[],
  dbUsers: DbUserInfo[],
  apps?: AppInfo[]
) {
  const workbook = XLSX.utils.book_new()

  const databaseMap = new Map<number, DatabaseInfo[]>()
  databases.forEach(d => {
    const list = databaseMap.get(d.instance_id) || []
    list.push(d)
    databaseMap.set(d.instance_id, list)
  })

  const dbUserMap = new Map<number, DbUserInfo[]>()
  dbUsers.forEach(u => {
    const list = dbUserMap.get(u.instance_id) || []
    list.push(u)
    dbUserMap.set(u.instance_id, list)
  })

  const appMap = new Map<number, AppInfo>()
  if (apps) {
    apps.forEach(a => {
      appMap.set(a.id, a)
    })
  }

  clusters.forEach(cluster => {
    const clusterInstances = instances.filter(i => i.cluster_id === cluster.id)
    const sheetName = cluster.name.slice(0, 31)

    const rows: (string | number)[][] = []

    rows.push(['', '', '', '', '', '', '', '', '', '', '', '', ''])
    rows.push([`集群：${cluster.name}`, '', '', '', '', '', '', '', '', '', '', '', ''])
    rows.push(['描述', cluster.description || '-', '', '', '', '', '', '', '', '', '', '', ''])
    rows.push(['信创', cluster.is_xinchuang ? '是' : '否', '', '鼎甲', cluster.is_dingjia ? '是' : '否', '', '', '', '', '', '', '', ''])
    rows.push(['', '', '', '', '', '', '', '', '', '', '', '', ''])

    const headers = [
      '实例名称', '内部端口', '外部端口', '状态', '描述',
      '数据库', '数据库用户', '开发人员', '维护人员',
      '应用', '应用开发', '应用运维'
    ]
    rows.push(headers)

    const merges: { s: { r: number; c: number }; e: { r: number; c: number } }[] = []
    const rowStyles: { row: number; style: any }[] = []

    clusterInstances.forEach(instance => {
      const instanceDatabases = databaseMap.get(instance.id) || []
      const instanceUsers = dbUserMap.get(instance.id) || []

      const dbCount = Math.max(instanceDatabases.length, 1)
      const instanceStartRow = rows.length

      if (instanceDatabases.length > 0) {
        instanceDatabases.forEach((db, idx) => {
          const usersForDb = instanceUsers.filter(u => 
            u.permissions_detail?.some(p => p.database_name === db.name)
          )

          const userNames = [...new Set(usersForDb.map(u => u.username))].join(', ')
          const appIds = [...new Set(usersForDb.map(u => u.app_id).filter(Boolean))] as number[]
          const appNames = appIds.map(id => appMap.get(id)?.name || '').filter(Boolean).join(', ')
          const appDevs = appIds.map(id => appMap.get(id)?.developer_name || '').filter(Boolean).join(', ')
          const appOps = appIds.map(id => appMap.get(id)?.operator_name || '').filter(Boolean).join(', ')

          if (idx === 0) {
            rows.push([
              instance.name,
              instance.internal_port,
              instance.external_port,
              instance.status,
              instance.description || '',
              db.name,
              userNames,
              '',
              '',
              appNames,
              appDevs,
              appOps
            ])
          } else {
            rows.push([
              '',
              '',
              '',
              '',
              '',
              db.name,
              userNames,
              '',
              '',
              appNames,
              appDevs,
              appOps
            ])
          }
        })
      } else {
        const userNames = instanceUsers.map(u => u.username).join(', ')
        const appIds = [...new Set(instanceUsers.map(u => u.app_id).filter(Boolean))] as number[]
        const appNames = appIds.map(id => appMap.get(id)?.name || '').filter(Boolean).join(', ')
        const appDevs = appIds.map(id => appMap.get(id)?.developer_name || '').filter(Boolean).join(', ')
        const appOps = appIds.map(id => appMap.get(id)?.operator_name || '').filter(Boolean).join(', ')

        rows.push([
          instance.name,
          instance.internal_port,
          instance.external_port,
          instance.status,
          instance.description || '',
          '',
          userNames,
          '',
          '',
          appNames,
          appDevs,
          appOps
        ])
      }

      const instanceEndRow = rows.length - 1

      if (dbCount > 1) {
        for (let c = 0; c <= 4; c++) {
          merges.push({
            s: { r: instanceStartRow, c },
            e: { r: instanceEndRow, c }
          })
        }
      }

      for (let r = instanceStartRow; r <= instanceEndRow; r++) {
        rowStyles.push({ row: r, style: styles.dbCol })
      }
    })

    const ws = XLSX.utils.aoa_to_sheet(rows)

    ws['!cols'] = [
      { wch: 15 },
      { wch: 10 },
      { wch: 10 },
      { wch: 10 },
      { wch: 18 },
      { wch: 18 },
      { wch: 20 },
      { wch: 12 },
      { wch: 12 },
      { wch: 15 },
      { wch: 12 },
      { wch: 12 }
    ]

    mergeCell(ws, { r: 1, c: 0 }, { r: 1, c: 11 })
    setRowStyle(ws, 1, 0, 11, styles.clusterTitle)

    mergeCell(ws, { r: 2, c: 1 }, { r: 2, c: 11 })
    mergeCell(ws, { r: 3, c: 2 }, { r: 3, c: 4 })
    mergeCell(ws, { r: 3, c: 5 }, { r: 3, c: 11 })
    setRowStyle(ws, 2, 0, 11, styles.clusterInfo)
    setRowStyle(ws, 3, 0, 11, styles.clusterInfo)

    setRowStyle(ws, 5, 0, 11, styles.header)

    merges.forEach(m => {
      mergeCell(ws, m.s, m.e)
    })

    rowStyles.forEach(({ row, style }) => {
      setRowStyle(ws, row, 0, 11, style)
    })

    const lastRow = rows.length
    rows.push(['说明：', '', '', '', '', '', '', '', '', '', '', '', ''])
    rows.push(['1. 每个数据库单独一行，同实例的实例信息合并显示', '', '', '', '', '', '', '', '', '', '', '', ''])
    rows.push(['2. 无数据库的实例显示为一行', '', '', '', '', '', '', '', '', '', '', '', ''])

    for (let r = lastRow; r < rows.length; r++) {
      mergeCell(ws, { r, c: 0 }, { r, c: 11 })
      setRowStyle(ws, r, 0, 11, { font: { italic: true, color: { rgb: '666666' } } })
    }

    XLSX.utils.book_append_sheet(workbook, ws, sheetName)
  })

  const date = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(workbook, `TDSQL汇总_${date}.xlsx`)
}

export interface ImportDataItem {
  type: '集群' | '实例' | '数据库' | '数据库用户'
  name: string
  internal_port?: string
  external_port?: string
  status?: string
  description?: string
  domain?: string
  developer?: string
  maintainer?: string
  permissions?: string
  instance_name?: string
  cluster_name?: string
}

export function parseImportExcel(file: File): Promise<ImportDataItem[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const allData: ImportDataItem[] = []

        workbook.SheetNames.forEach(sheetName => {
          const worksheet = workbook.Sheets[sheetName]
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]

          let currentCluster = ''
          let currentInstance = ''

          for (let i = 0; i < jsonData.length; i++) {
            const row = jsonData[i]
            if (!row || row.length === 0) continue

            const firstCell = String(row[0] || '').trim()

            if (firstCell.startsWith('集群：')) {
              currentCluster = firstCell.replace('集群：', '').trim()
              currentInstance = ''
              allData.push({
                type: '集群',
                name: currentCluster,
                description: String(row[1] || '').trim()
              })
              continue
            }

            if (firstCell === '实例名称' || firstCell === '') continue
            if (firstCell.startsWith('说明：') || firstCell.startsWith('1.') || firstCell.startsWith('2.')) continue

            const instanceName = String(row[0] || '').trim()
            if (instanceName) {
              currentInstance = instanceName

              allData.push({
                type: '实例',
                name: instanceName,
                internal_port: String(row[1] || ''),
                external_port: String(row[2] || ''),
                status: String(row[3] || 'unused'),
                description: String(row[4] || ''),
                cluster_name: currentCluster
              })

              const dbName = String(row[5] || '').trim()
              if (dbName) {
                allData.push({
                  type: '数据库',
                  name: dbName,
                  instance_name: currentInstance,
                  cluster_name: currentCluster
                })
              }

              const userName = String(row[6] || '').trim()
              if (userName) {
                userName.split(',').forEach(name => {
                  if (name.trim()) {
                    allData.push({
                      type: '数据库用户',
                      name: name.trim(),
                      instance_name: currentInstance,
                      cluster_name: currentCluster
                    })
                  }
                })
              }
            } else {
              const dbName = String(row[5] || '').trim()
              if (dbName && currentInstance) {
                allData.push({
                  type: '数据库',
                  name: dbName,
                  instance_name: currentInstance,
                  cluster_name: currentCluster
                })
              }
            }
          }
        })

        resolve(allData)
      } catch (error) {
        reject(error)
      }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

export function generateImportTemplate() {
  const workbook = XLSX.utils.book_new()

  const rows: (string | number)[][] = []

  rows.push(['', '', '', '', '', '', '', '', '', '', '', '', ''])
  rows.push(['集群：示例集群', '', '', '', '', '', '', '', '', '', '', '', ''])
  rows.push(['描述', '请填写集群描述', '', '', '', '', '', '', '', '', '', '', ''])
  rows.push(['信创', '是/否', '', '鼎甲', '是/否', '', '', '', '', '', '', '', ''])
  rows.push(['', '', '', '', '', '', '', '', '', '', '', '', ''])

  rows.push([
    '实例名称', '内部端口', '外部端口', '状态', '描述',
    '数据库', '数据库用户', '开发人员', '维护人员',
    '应用', '应用开发', '应用运维'
  ])

  rows.push(['示例实例1', '3306', '13306', 'online', '描述', '数据库1', '用户1', '', '', '应用1', '张三', '李四'])
  rows.push(['', '', '', '', '', '数据库2', '用户2', '', '', '', '', ''])
  rows.push(['', '', '', '', '', '数据库3', '用户3', '', '', '', '', ''])
  rows.push(['示例实例2', '3307', '13307', 'unused', '描述', '', '用户4', '', '', '', '', ''])

  rows.push(['', '', '', '', '', '', '', '', '', '', '', '', ''])
  rows.push(['说明：', '', '', '', '', '', '', '', '', '', '', '', ''])
  rows.push(['1. 每个数据库单独一行，同实例的实例信息合并显示', '', '', '', '', '', '', '', '', '', '', '', ''])
  rows.push(['2. 实例名称为空时表示继续使用上一个实例的信息', '', '', '', '', '', '', '', '', '', '', '', ''])
  rows.push(['3. 数据库用户支持多用户（用逗号分隔）', '', '', '', '', '', '', '', '', '', '', '', ''])

  const ws = XLSX.utils.aoa_to_sheet(rows)

  ws['!cols'] = [
    { wch: 15 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 18 },
    { wch: 18 },
    { wch: 20 },
    { wch: 12 },
    { wch: 12 },
    { wch: 15 },
    { wch: 12 },
    { wch: 12 }
  ]

  mergeCell(ws, { r: 1, c: 0 }, { r: 1, c: 11 })
  setRowStyle(ws, 1, 0, 11, styles.clusterTitle)

  mergeCell(ws, { r: 2, c: 1 }, { r: 2, c: 11 })
  mergeCell(ws, { r: 3, c: 2 }, { r: 3, c: 4 })
  mergeCell(ws, { r: 3, c: 5 }, { r: 3, c: 11 })
  setRowStyle(ws, 2, 0, 11, styles.clusterInfo)
  setRowStyle(ws, 3, 0, 11, styles.clusterInfo)

  setRowStyle(ws, 5, 0, 11, styles.header)

  for (let r = 6; r <= 9; r++) {
    setRowStyle(ws, r, 0, 11, styles.dbCol)
  }

  mergeCell(ws, { r: 6, c: 0 }, { r: 8, c: 0 })
  mergeCell(ws, { r: 6, c: 1 }, { r: 8, c: 1 })
  mergeCell(ws, { r: 6, c: 2 }, { r: 8, c: 2 })
  mergeCell(ws, { r: 6, c: 3 }, { r: 8, c: 3 })
  mergeCell(ws, { r: 6, c: 4 }, { r: 8, c: 4 })

  for (let r = 11; r <= 13; r++) {
    mergeCell(ws, { r, c: 0 }, { r, c: 11 })
    setRowStyle(ws, r, 0, 11, { font: { italic: true, color: { rgb: '666666' } } })
  }

  XLSX.utils.book_append_sheet(workbook, ws, '模板')

  XLSX.writeFile(workbook, 'TDSQL导入模板.xlsx')
}
