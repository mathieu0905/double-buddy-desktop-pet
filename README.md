# 一起摸鱼 · 双人桌宠

根据合照制作的多人桌宠。七位角色会像 QQ 宠物一样直接站在桌面底部，而不是待在一个普通应用窗口里。

## 自行构建

项目不再提供 GitHub Release 安装包。请安装 Node.js 后克隆仓库并在本机构建：

```bash
git clone https://github.com/mathieu0905/double-buddy-desktop-pet.git
cd double-buddy-desktop-pet
npm install
npm run package:mac
```

构建产物位于 `release/一起摸鱼-darwin-arm64/一起摸鱼.app`，适用于 Apple Silicon Mac。首次启动如果被 macOS 拦截，请右键应用并选择“打开”。

## 启动桌宠

```bash
npm install
npm start
```

构建后也可以直接双击 macOS 应用：

```text
release/一起摸鱼-darwin-arm64/一起摸鱼.app
```

修改代码后，可以再次运行 `npm run package:mac` 重新生成应用。支持本地更新的版本正在运行时，构建完成后会自动退出旧进程并启动刚生成的新版本；首次启用该能力需要手动打开一次新构建。

启动后，七位宠物会出现在桌面底部：

- 单击任意角色摸摸头
- 按住角色拖到桌面的任意位置
- 单击选中角色后，会直接显示喂食、玩耍、聊天、休息、动作和互动快捷栏；高频操作不再需要打开右键菜单
- “动作”面板可直接选择走路、跑步、跳舞、跳跃、伸懒腰、挥手或手出兜
- 同时显示多个角色时，可在“互动”面板选择亲一下、抱一下、打架或一起躺平，再选择互动对象
- 角色之间的亲密度达到 70 后，会在低频后台时机自动触发互动；亲密度越高，越容易亲吻或拥抱。手动双人互动也会改变亲密度，打架会略微降低亲密度
- 单击选中角色后可拖动右上角控制点缩放；鼠标滚轮和右键“角色大小”也可调整比例
- 鼠标只会在人物实际可见的区域响应，透明空白处会继续穿透到桌面；选中时不会出现人物外框
- 选中角色后可点左上角“−”直接隐藏；右键“管理显示角色”可重新显示，选择会自动保存
- 双击角色打开完整的“桌宠小屋”
- 七位角色会低频地走路、跳跃、跳舞、伸懒腰或挥手；大部分时间会折叠在最近的屏幕边缘，鼠标移到露出的部分就会回来
- 右键可切换自由散步、窗口置顶或退出全部桌宠
- 透明区域会穿透鼠标，不挡住桌面上的文件和应用
- 自动保存角色状态、桌面位置和设置

## 用照片创建新桌宠

在桌宠小屋点击“＋ 照片角色”，或右键任意桌宠并选择“用照片创建新角色…”，创建面板会直接在桌宠小屋内展开，不会额外弹出一个窗口。可以上传人物照片并生成同风格的 Q 版角色。请确保你有权使用照片中人物的肖像。

支持两种生成方式：

- **直接导入 Q 图**：选择或拖入已经制作好的 PNG、JPG、JPEG 或 WebP 图片，不调用 AI，立即作为新桌宠添加；推荐使用透明背景 PNG。
- **本机 Codex**：先安装 Codex CLI 并运行 `codex login`。应用会通过 Codex App Server 协议和 `$imagegen` 复用本机登录状态；生成会计入 Codex 使用额度。
- **兼容 API**：填写 `API Base`、`API Key` 和图像模型。默认使用 `gpt-image-1.5` 以请求透明 PNG；也可以换成服务商支持的图像编辑模型。

任务提交后会交给独立的 Codex App Server 协议工作进程，可以继续操作、关闭创建面板，或在生成期间重新 build/restart App；工作进程不会随 Electron 主进程退出。桌宠小屋底部的“生成任务”可查看排队中、进行中、已完成和失败记录。成功或失败时会发送 macOS 系统通知，成功生成的角色会自动出现在桌面。

如果选择保存 API 配置，API Key 会通过 macOS 系统钥匙串加密后保存在本机，不会写入仓库。人物照片只会发送给用户选择的 Codex 或 API 服务。有关 OpenAI 图像编辑接口及透明背景支持，请参考 [Image generation API](https://developers.openai.com/api/docs/guides/image-generation)。

## 浏览器预览

```bash
npm run preview
```

打开 `http://localhost:5173`。浏览器预览是完整的桌宠小屋；透明悬浮、自由散步和鼠标穿透只在桌面版可用。

## Sites 版本

`sites-web/` 包含完整的 Sites 网页项目，包括交互页面、两只宠物素材和分享卡片。当前部署地址为：

<https://double-buddy-pets.mathieulin0905.chatgpt.site>

由于当前 Sites 工作区未开放互联网发布，线上地址暂时需要对应账号访问；源码已经完整收录在本仓库。

## 测试

```bash
npm test
```

## 角色素材

- `public/assets/left-pet.png`：由合照左侧人物生成的透明桌宠素材
- `public/assets/right-pet.png`：由合照右侧人物生成的透明桌宠素材
- `public/assets/grad-pet.png`、`white-shirt-pet.png`：新增的学位袍与白 T 恤人物
- `public/assets/left-one-pet.png`、`left-two-pet.png`、`right-one-pet.png`：毕业合照中的左一、左二、右一人物

桌宠数据保存在本机 `localStorage`，不会上传。

## 项目结构

```text
electron/       桌面悬浮窗口与系统菜单
public/         桌宠小屋、桌面角色与透明 PNG 素材
src/            状态模型与浏览器预览服务
test/           桌宠状态测试
sites-web/      Sites 网页版完整工程
build/icon.icns macOS 应用图标
```
