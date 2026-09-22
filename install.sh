#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

REPO_URL="${PHONE_MCP_REPO_URL:-https://github.com/kkjlsad/KK1.git}"
APP_DIR="${PHONE_MCP_HOME:-$HOME/.local/share/termux-phone-mcp}"
CONFIG_DIR="$HOME/.config/termux-phone-mcp"
ENV_FILE="$CONFIG_DIR/.env"

if [ -z "${PREFIX:-}" ] || [ ! -x "$PREFIX/bin/pkg" ]; then
  echo "此安装脚本只能在 Termux 内执行。" >&2
  exit 1
fi

echo "[1/5] 安装运行依赖"
pkg install -y nodejs-lts git termux-api procps iproute2 proot-distro

echo "[2/5] 获取代码"
mkdir -p "$(dirname "$APP_DIR")"
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" pull --ff-only origin main
elif [ -e "$APP_DIR" ]; then
  echo "目标路径已存在且不是本项目 Git 仓库：$APP_DIR" >&2
  exit 1
else
  git clone --depth 1 "$REPO_URL" "$APP_DIR"
fi

echo "[3/5] 安装 Node 依赖"
cd "$APP_DIR"
npm ci --omit=dev

echo "[4/5] 创建本机配置"
mkdir -p "$CONFIG_DIR"
if [ ! -f "$ENV_FILE" ]; then
  token="$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"
  umask 077
  cat > "$ENV_FILE" <<EOF
PHONE_MCP_HOST=127.0.0.1
PHONE_MCP_PORT=8765
PHONE_MCP_TOKEN=$token
PHONE_MCP_ALLOW_ACTIONS=1
PHONE_MCP_ALLOW_COMMANDS=0
PHONE_MCP_SERVICE_ROOT=$HOME/services
EOF
fi
chmod 600 "$ENV_FILE"
install -m 700 "$APP_DIR/scripts/phone-mcp" "$PREFIX/bin/phone-mcp"

mkdir -p "$HOME/.termux/boot"
cat > "$HOME/.termux/boot/termux-phone-mcp" <<'EOF'
#!/data/data/com.termux/files/usr/bin/sh
sleep 8
phone-mcp start
EOF
chmod 700 "$HOME/.termux/boot/termux-phone-mcp"

echo "[5/5] 启动并验证"
phone-mcp restart
phone-mcp test

echo
echo "安装完成。把下面配置填入 RikkaHub："
phone-mcp show-config
echo
echo "注意：还需安装与 Termux 同来源签名的 Termux:API APK，并授予所需权限。"
echo "需要任意 Termux/PRoot 命令时执行：phone-mcp enable-commands"
