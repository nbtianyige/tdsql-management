# TDSQL 集群管理系统

## 1. 项目概述

TDSQL 集群管理系统是一个用于管理 TDSQL 数据库集群的 Web 后台管理系统。系统采用前后端分离架构，前端使用 React + Ant Design，后端使用 Flask。

### 1.1 项目目标

- 提供统一的集群管理入口
- 管理数据库实例和数据库
- 管理数据库用户权限
- 提供系统用户认证和授权

## 2. 功能需求

### 2.1 认证模块

- 用户登录/登出
- 基于 Session 的认证
- 角色区分（管理员/普通用户/只读用户）

### 2.2 集群管理

- 查看集群列表
- 创建/编辑/删除集群
- 集群基本信息维护

### 2.3 实例管理

- 查看实例列表
- 创建/编辑/删除实例
- 实例与集群关联
- 端口配置（内部端口/外部端口）

### 2.4 数据库管理

- 查看数据库列表
- 创建/编辑/删除数据库
- 数据库与实例关联
- 域名、开发人员、维护人员信息

### 2.5 数据库用户管理

- 管理数据库登录账号
- 用户与实例绑定（创建后不可更改）
- 配置数据库权限（SELECT/INSERT/UPDATE/DELETE）

### 2.6 系统用户管理

- 管理本系统登录用户
- 用户角色分配（管理员/普通用户/只读用户）
- 用户 CRUD 操作
- admin 用户受保护

## 3. 技术架构

### 3.1 前端技术栈

| 技术 | 说明 |
|-----|------|
| React 19 | UI 框架 |
| TypeScript | 类型安全 |
| Vite | 构建工具 |
| **Arco Design** | UI 组件库（字节跳动） |
| React Router | 路由管理 |
| Axios | HTTP 客户端 |

### 3.2 后端技术栈

| 技术 | 说明 |
|-----|------|
| Flask | Web 框架 |
| Flask-CORS | 跨域支持 |
| JSON 文件存储 | 数据持久化 |

### 3.3 项目结构

```
tdsql-management/
├── backend/
│   ├── app/
│   │   ├── api/          # API 路由
│   │   ├── data/         # JSON 数据文件
│   │   └── utils/        # 工具函数
│   └── run.py            # 启动文件
│
└── frontend/
    ├── src/
    │   ├── components/   # 组件
    │   ├── lib/          # 工具和API
    │   ├── pages/        # 页面
    │   └── App.tsx       # 应用入口
    └── index.html
```

## 4. 数据库设计

### 4.1 数据模型

#### 集群 (clusters.json)
```json
{
  "id": 1,
  "name": "集群名称",
  "description": "描述",
  "created_at": "2026-01-01"
}
```

#### 实例 (instances.json)
```json
{
  "id": 1,
  "name": "实例名称",
  "cluster_id": 1,
  "internal_port": 3306,
  "external_port": 3306,
  "description": "描述"
}
```

#### 数据库 (databases.json)
```json
{
  "id": 1,
  "name": "数据库名称",
  "instance_id": 1,
  "domain": "域名",
  "developer": "开发人员",
  "maintainer": "维护人员"
}
```

#### 数据库用户 (db_users.json)
```json
{
  "id": 1,
  "username": "用户名",
  "password": "密码",
  "instance_id": 1,
  "permissions": [
    {
      "database_id": 1,
      "privileges": ["SELECT", "INSERT"]
    }
  ]
}
```

#### 系统用户 (users.json)
```json
{
  "id": 1,
  "username": "admin",
  "password": "password123",
  "role": "admin",
  "created_at": "2026-01-01"
}
```

## 5. API 设计

### 5.1 认证接口

| 方法 | 路径 | 说明 |
|-----|------|------|
| POST | /api/auth/login | 登录 |
| POST | /api/auth/logout | 登出 |
| GET | /api/auth/users | 获取用户列表 |
| POST | /api/auth/users | 创建用户 |
| PUT | /api/auth/users/:id | 更新用户 |
| DELETE | /api/auth/users/:id | 删除用户 |

### 5.2 集群接口

| 方法 | 路径 | 说明 |
|-----|------|------|
| GET | /api/cluster | 获取集群列表 |
| POST | /api/cluster | 创建集群 |
| GET | /api/cluster/:id | 获取集群详情 |
| PUT | /api/cluster/:id | 更新集群 |
| DELETE | /api/cluster/:id | 删除集群 |

### 5.3 实例接口

| 方法 | 路径 | 说明 |
|-----|------|------|
| GET | /api/instance | 获取实例列表 |
| POST | /api/instance | 创建实例 |
| GET | /api/instance/:id | 获取实例详情 |
| PUT | /api/instance/:id | 更新实例 |
| DELETE | /api/instance/:id | 删除实例 |

### 5.4 数据库接口

| 方法 | 路径 | 说明 |
|-----|------|------|
| GET | /api/database | 获取数据库列表 |
| POST | /api/database | 创建数据库 |
| GET | /api/database/:id | 获取数据库详情 |
| PUT | /api/database/:id | 更新数据库 |
| DELETE | /api/database/:id | 删除数据库 |

### 5.5 数据库用户接口

| 方法 | 路径 | 说明 |
|-----|------|------|
| GET | /api/user/db | 获取用户列表 |
| POST | /api/user/db | 创建用户 |
| GET | /api/user/db/:id | 获取用户详情 |
| PUT | /api/user/db/:id | 更新用户 |
| DELETE | /api/user/db/:id | 删除用户 |

## 6. 角色权限

| 角色 | 说明 |
|-----|------|
| admin | 管理员，可管理所有功能 |
| user | 普通用户，可进行常规操作 |
| readonly | 只读用户，仅能查看 |

## 7. 默认账号

| 用户名 | 密码 | 角色 |
|-------|------|------|
| admin | password123 | admin |

---

*文档版本: 1.0*
*更新日期: 2026-02-22*
