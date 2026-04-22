# EdgeOne Pages 全栈部署指南

## 步骤 1：在 EdgeOne 控制台创建项目

1. 打开 https://pages.edgeone.ai
2. 点击 **创建 Pages 项目**
3. 选择 **导入 Git 仓库**
4. 选择 `nbtianyige/tdsql-management` 仓库
5. 分支选择 `main`
6. 构建命令：`cd frontend && npm install && npm run build`
7. 输出目录：`frontend/dist`
8. 点击 **创建项目**

## 步骤 2：配置 Python Cloud Functions

创建项目后，在 EdgeOne 控制台：

1. 进入项目设置
2. 找到 **函数管理** 或 **Cloud Functions**
3. 点击 **添加函数**
4. 选择运行时：`Python 3.10`
5. 入口文件：`cloud-functions/api/index.py`
6. 部署区域：选择你的目标区域

或者使用 CLI 初始化：

```bash
# 1. 安装 CLI
npm install -g edgeone

# 2. 登录
edgeone login

# 3. 初始化函数
edgeone pages init

# 4. 关联项目（项目名称填写你在 EdgeOne 创建的项目名）
edgeone pages link

# 5. 本地开发测试
edgeone pages dev
```

## 步骤 3：验证部署

部署完成后：
- 前端：https://your-project.edgeone.dev
- API：https://your-project.edgeone.dev/api/auth/login

## 项目结构

```
tdsql-management/
├── cloud-functions/       # Python 后端 (Flask API)
│   ├── api/index.py      # Flask 入口 (app = Flask(__name__))
│   └── app/              # API 路由和数据处理
├── frontend/             # React 前端
│   ├── src/             # 前端源码
│   └── dist/            # 构建产物
├── edgeone.json         # EdgeOne 配置
└── requirements.txt     # Python 依赖
```

## 环境变量

EdgeOne 会自动安装 requirements.txt 中的依赖：
- Flask
- Flask-CORS
- Flask-JWT-Extended
- PyJWT
- bcrypt
