#!/bin/bash

echo "========================================="
echo "TDSQL 数据库管理系统"
echo "========================================="

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# 设置 Python 路径，包含依赖目录
export PYTHONPATH="$SCRIPT_DIR/dependencies:$SCRIPT_DIR:$PYTHONPATH"

echo ""
echo "正在启动服务..."
echo "访问地址: http://localhost:5001"
echo ""

python main.py
