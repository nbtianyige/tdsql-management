# TDSQL 数据库管理系统

## 快速启动

```bash
# 方式1: 使用启动脚本
./start.sh

# 方式2: 手动运行
python main.py
```

启动后访问: http://localhost:5001

## 默认账号

| 角色 | 用户名 | 密码 |
|-----|-------|------|
| 管理员 | admin | password123 |
| 运维 | ops | password123 |
| 普通用户 | user | password123 |

## 目录结构

```
deploy/
├── start.sh              # 启动脚本
├── main.py              # Python 入口（自动加载依赖）
├── run.py               # Flask 应用
├── requirements.txt     # Python 依赖列表
├── dependencies/        # Python 依赖包（离线）
├── app/                 # 后端代码
│   ├── api/             # API 路由
│   ├── data/            # 数据文件 (JSON)
│   └── utils/           # 工具函数
└── frontend-dist/       # 前端静态文件
    ├── index.html
    └── assets/
```

## 离线部署

本包已包含所有 Python 依赖，无需网络安装：

- Flask 2.0.1
- Flask-CORS 3.0.10
- Flask-JWT-Extended 4.4.0
- PyJWT 2.4.0
- bcrypt 4.0.1

## 端口

默认监听: 5001
