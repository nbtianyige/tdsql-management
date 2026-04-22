#!/bin/bash
set -e

PROJECT_NAME="tdsql-management"
DIST_DIR="dist"

echo "========================================="
echo "TDSQL 管理系统打包脚本"
echo "========================================="

cd "$(dirname "$0")"

echo "[1/4] 安装后端依赖..."
cd backend
pip install -r requirements.txt -t ./dependencies --quiet
cd ..

echo "[2/4] 构建前端..."
cd frontend
npm install --silent
npm run build
cd ..

echo "[3/4] 创建打包目录..."
rm -rf $DIST_DIR
mkdir -p $DIST_DIR

cp -r backend $DIST_DIR/
cp -r frontend/dist $DIST_DIR/backend/

cat > $DIST_DIR/run.sh << 'EOF'
#!/bin/bash
cd "$(dirname "$0")/backend"
export PYTHONPATH="$(pwd):$PYTHONPATH"
python run.py
EOF
chmod +x $DIST_DIR/run.sh

cat > $DIST_DIR/README.md << 'EOF'
# TDSQL 数据库管理系统

## 快速启动

```bash
# 方式1: 直接运行
./run.sh

# 方式2: 使用 Python
cd backend
pip install -r requirements.txt
python run.py
```

启动后访问: http://localhost:5001

## 默认账号
- 管理员: admin / password123
- 运维: ops / password123
- 普通用户: user / password123
EOF

echo "[4/4] 打包完成!"
echo "========================================="
echo "打包目录: $DIST_DIR"
echo "运行方式: cd $DIST_DIR && ./run.sh"
echo "访问地址: http://localhost:5001"
echo "========================================="
