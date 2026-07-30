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

修改代码后，可以再次运行 `npm run package:mac` 重新生成应用。

启动后，七位宠物会出现在桌面底部：

- 单击任意角色摸摸头
- 按住角色拖到桌面的任意位置
- 右键角色喂食、陪玩、聊天或哄睡
- 单击选中角色后可拖动右上角控制点缩放；鼠标滚轮和右键“角色大小”也可调整比例
- 右键“显示角色”可选择要留在桌面上的角色，选择会自动保存
- 双击角色打开完整的“桌宠小屋”
- 七位角色会在桌面底部自由散步、自己说话
- 右键可切换自由散步、窗口置顶或退出全部桌宠
- 透明区域会穿透鼠标，不挡住桌面上的文件和应用
- 自动保存角色状态、桌面位置和设置

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
