# Termux Phone MCP

把 Android 手机和 Termux 能力通过本机 Streamable HTTP MCP 提供给 RikkaHub。服务只监听 `127.0.0.1`，默认使用随机 Bearer Token。

## 能做什么

- 读取机型、Android/内核/SoC、CPU、内存、存储、温度、网络和 Termux 可见进程。
- 读取电池电量、健康、温度、电压、电流、循环次数，并进行 2-30 秒整机功率采样。
- 安装 Termux 软件包，部署/删除 `proot-distro` Linux 环境。
- 检测并管理设备上真实存在的 Docker/Podman Compose；没有运行时就明确报告，不把 PRoot 当 Docker。
- 调整亮度和音量。
- 可选授予模型 Termux 或 PRoot 任意命令权限。
- 手机提示与控制：Toast、震动、TTS 朗读、剪贴板读写、手电筒、媒体控制、打开链接。
- 文件与下载：列出/读取/写入 Termux HOME 内文件，用 curl 下载到手机共享存储。
- Android 数据：通知栏、短信、通话记录、联系人、定位、传感器、相机拍照。

## Android 的硬边界

- 普通非 root Termux 无法可靠读取其他 App 的 CPU/内存、逐 App 耗电或完整 `dumpsys batterystats`。
- `phone_sample_power` 是 BatteryManager 电流 × 电压的整机趋势估算，适合比较调整前后，不是逐 App 电量归因。
- PRoot 是用户态 Linux 文件系统，不是真正容器。Docker/Podman 通常需要 root、内核 namespace/cgroup 支持或特制系统。
- 无 root 时无法截图（`screencap`）、无法运行 `dumpsys`、无法列出完整应用列表（`pm list packages` 被拒）。`phone_list_installed_apps` 只能靠共享存储 `Android/media`、`Android/obb` 的目录名推断，结果不完整。

## 一条命令安装

先安装官方 Termux。为读取电池、Wi-Fi、亮度和音量，还要安装与 Termux **同来源签名**的 [Termux:API APK](https://github.com/termux/termux-api/releases)。然后在 Termux 运行：

```bash
curl -fsSL https://raw.githubusercontent.com/kkjlsad/KK1/main/install.sh | bash
```

安装程序会：

- 安装 Node.js、Termux:API 命令、PRoot 等依赖；
- 安装到 `~/.local/share/termux-phone-mcp`；
- 生成 `~/.config/termux-phone-mcp/.env` 和随机 Token；
- 启动服务并打印 RikkaHub 配置；
- 写入 Termux:Boot 启动脚本（需要另装 [Termux:Boot](https://github.com/termux/termux-boot/releases) 才会在开机后生效）。

建议在 Android 设置中取消 Termux 的电池优化，否则系统可能在后台杀掉服务。服务不持续轮询，只有模型调用工具时才采样；是否常驻的主要开销来自 Node/Termux 后台进程。

## RikkaHub 接入

安装结束会直接打印以下四项，也可随时运行 `phone-mcp show-config` 查看：

- 类型：`Streamable HTTP`
- URL：`http://127.0.0.1:8765/mcp`
- Header：`Authorization`
- Value：`Bearer <安装时生成的 Token>`

在 RikkaHub 新增 MCP 后同步工具。若旧聊天没有出现工具，新建聊天或重启 RikkaHub。Android 弹出“本地网络”权限时需要允许。

这些工具建议在 RikkaHub 开启“每次审批”：

- `phone_install_packages`
- `phone_install_proot`
- `phone_remove_proot`
- `phone_exec_proot`
- `phone_run_termux_command`
- `phone_manage_compose`
- `phone_set_brightness`
- `phone_set_volume`

## 权限档位

默认：读取能力开启、有限写操作开启、任意命令关闭。

```bash
# 开启完整 Termux/PRoot 命令权（高权限）
phone-mcp enable-commands

# 关闭任意命令
phone-mcp disable-commands

# 关闭所有有限写操作
phone-mcp disable-actions
```

`phone_run_termux_command` 相当于把 Termux 用户的文件与进程权限交给模型。它仍不是 Android root；只有设备本身已有 root 且 Termux 可调用 `su` 时，才可能进一步获得系统权限。

## 日常命令

```bash
phone-mcp status
phone-mcp restart
phone-mcp logs
phone-mcp show-config
```

更新时重新执行同一条安装命令即可；本机 `.env` 和 Token 会保留。

## 工具清单

共 43 个工具。

**只读**

- 系统状态：`phone_get_overview`、`phone_get_battery`、`phone_sample_power`、`phone_get_resources`、`phone_get_thermal`、`phone_get_network`、`phone_get_capabilities`、`phone_list_environments`
- 文件：`phone_list_files`、`phone_read_file`
- 剪贴板：`phone_clipboard_get`
- Android 数据（需授权，见下节）：`phone_get_notifications`、`phone_get_sms`、`phone_get_call_log`、`phone_get_contacts`、`phone_get_location`、`phone_get_sensors`、`phone_list_installed_apps`

**有限写入**（需要 `PHONE_MCP_ALLOW_ACTIONS=1`）

- 环境管理：`phone_install_packages`、`phone_install_proot`、`phone_remove_proot`、`phone_manage_compose`
- 系统设置：`phone_set_brightness`、`phone_set_volume`
- 提示与控制：`phone_toast`、`phone_vibrate`、`phone_speak`、`phone_torch`、`phone_media_control`、`phone_open_url`、`phone_clipboard_set`
- 文件与下载：`phone_write_file`、`phone_download`
- 相机与消息：`phone_camera_photo`、`phone_send_sms`

**高权限命令**（需要 `PHONE_MCP_ALLOW_COMMANDS=1`）

- `phone_exec_proot`、`phone_run_termux_command`

## 文件与 Git 工作流

- `phone_edit_file`、`phone_move_path`、`phone_delete_path`（删除需确认串）
- `phone_search_files`（按文件名或内容搜索）
- `phone_git`（status / diff / log / add / commit / push / pull…）
- `phone_clone_repo`

## 需要 Android 权限的工具

下列工具依赖你在系统里给 Termux:API 授权，未授权时会返回带指引的错误：

| 工具 | 需要的权限 |
| --- | --- |
| `phone_get_sms`、`phone_send_sms` | 短信（读取 / 发送） |
| `phone_get_contacts` | 通讯录 |
| `phone_get_call_log` | 通话记录 |
| `phone_get_location` | 位置信息 |
| `phone_camera_photo` | 相机 |
| `phone_get_notifications` | 通知使用权（特殊权限，不在应用权限列表里） |
