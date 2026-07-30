# 一起摸鱼 · Sites 网页版

这是双人桌宠项目的在线版本，使用 vinext、React 和 Sites 构建。页面包含：

- 阿蓝与小博的完整角色介绍
- 饱腹、心情、精力和默契状态
- 喂食、陪玩、聊天与休息互动
- 浏览器本地状态保存
- 桌面悬浮版介绍及社交分享卡片

## 本地运行

需要 Node.js `>=22.13.0`。

```bash
npm install
npm run dev
```

## 验证

```bash
npm test
```

测试会生成 Cloudflare Worker 兼容构建，并检查服务器渲染结果。

## 部署

站点配置位于 `.openai/hosting.json`。当前 Sites 地址：

<https://double-buddy-pets.mathieulin0905.chatgpt.site>

当前工作区未开放互联网公开访问，因此访问策略暂时保持为所有者可见。
