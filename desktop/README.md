# 爱巴基桌面版

Claude Code 桌面伴侣应用，将工作状态实时转化为角色表情动作。

## 开发

```bash
cd desktop
npm install
npm run dev
```

## 构建

```bash
npm run build
npm run pack
```

## 项目结构

```
desktop/
├── src/
│   ├── main/          # Electron 主进程
│   ├── preload/       # 预加载脚本
│   └── renderer/      # React 渲染进程
├── resources/         # 应用资源（图标等）
├── electron.vite.config.ts
├── electron-builder.yml
└── package.json
```
