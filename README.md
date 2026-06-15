# RectCanvas 坐标画布

一个开箱即用的 React 坐标画框工具，用来快速生成 `[L, T, W, H]` 矩形坐标。

## 功能

- 鼠标拖拽创建画框
- 拖动画框移动位置
- 拖拽四角缩放大小
- 支持 `21:9`、`16:9`、`9:16`、`4:3`、`3:4`、`1:1`
- 支持百分比输出：`[L=0.1, T=0.1, W=0.1, H=0.1]`
- 支持像素输出，画布宽高可自行设置
- 右侧坐标列表支持单个复制和一键复制全部
- GitHub Actions 自动部署到 GitHub Pages

## 本地运行

```bash
npm install
npm run dev
```

## 一键部署到 GitHub Pages

1. 把仓库推送到 GitHub。
2. 打开仓库 `Settings -> Pages`。
3. `Build and deployment` 选择 `GitHub Actions`。
4. 推送到 `main` 或 `master` 后，Actions 会自动构建并部署。

如果仓库名是 `你的用户名.github.io`，访问地址就是：

```text
https://你的用户名.github.io/
```

如果仓库是普通项目仓库，例如 `rectcanvas`，访问地址就是：

```text
https://你的用户名.github.io/rectcanvas/
```
