# ⚔️ 迷你多人RTS

一个超轻量级的多人实时战略游戏，5分钟即可部署完成！

## 🎮 游戏特点

- 🚀 **极简设计**：核心玩法，快速上手
- 🌐 **实时对战**：WebSocket 多人联机
- 📱 **移动友好**：响应式界面
- ⚡ **快速部署**：单文件前端 + 轻量后端

## 🚀 快速开始

### 1. 部署后端到 Render

```bash
# 1. 推送代码到 GitHub
git push origin main

# 2. 在 Render 创建 Web Service
# - 连接你的 GitHub 仓库
# - 选择 mini-rts 仓库
# - 环境: Node
# - 构建命令: npm install
# - 启动命令: npm start
# - 计划: Free
# - 环境变量: PORT=10000

# 3. 获取后端 URL (如: https://mini-rts.onrender.com)
```

### 2. 配置前端

```bash
# 编辑 game.js，设置 SERVER_URL 为你的后端地址
const SERVER_URL = 'https://mini-rts.onrender.com';
```

### 3. 部署前端到 GitHub Pages

```bash
git add .
git commit -m "Update server URL"
git push origin main
# GitHub Pages 自动从根目录部署
# 访问: https://你的用户名.github.io/mini-rts
```

## 🎯 游戏规则

1. **采集资源**：工人自动采集金矿和木材
2. **建造基地**：消耗资源建造更多建筑
3. **训练军队**：生产士兵攻击敌人
4. **摧毁基地**：消灭敌方基地获胜！

## 📁 文件结构

```
mini-rts/
├── index.html      # 游戏界面
├── style.css       # 样式
├── game.js         # 前端逻辑
├── server.js       # 后端服务器
├── package.json    # 依赖
└── README.md       # 说明
```

## 🔧 技术栈

- 前端：HTML5 Canvas + 原生 JS
- 后端：Node.js + Express + Socket.io
- 部署：GitHub Pages + Railway/Render

## 📝 开发日志

- v1.0 (2026-03-02): 初始版本，基础RTS玩法