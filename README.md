# Dever Front

基于 Dever 框架开发的 JSON 驱动前端界面运行时。

这个项目的核心目标是：前端不手写具体业务页面结构，而是通过后端返回的 JSON 协议渲染后台页面、菜单、表格、表单、弹窗和权限交互。

## 技术栈

- React
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui
- Zustand
- Zod
- TanStack Router

## 核心能力

- JSON 驱动页面渲染
- 支持 `page / layout / nodes / data / state / action` 六段协议
- 支持主页面和子页面嵌套
- 支持左侧菜单、顶部栏、内容区布局
- 支持表格、表单、详情、弹窗、抽屉等通用节点
- 支持按钮、行操作、行内编辑等权限推导
- 支持运行时配置和皮肤配置

## 目录说明

```txt
front/
  public/
    config.js          # 运行时配置，如接口地址、站点信息、皮肤
    skin/              # 皮肤变量
  src/
    page/              # JSON 页面运行时、布局、节点组件
    lib/               # schema、store、action、request、path 等核心能力
    components/ui/     # shadcn/ui 基础组件
    components/        # 通用业务外壳组件
    routes/            # 前端路由入口
```

## 本地运行

安装依赖：

```bash
cd front
npm install
```

启动开发服务：

```bash
npm run dev
```

## 运行时配置

主要配置在：

```txt
public/config.js
```

常用字段：

- `site`：站点名称、描述、图标
- `appearance`：默认主题、侧边栏、布局方向
- `runtime.host`：Dever 后端 JSON 页面接口地址
- `runtime.skin`：当前皮肤名称
- `runtime.routerMode`：路由模式

## Git 提交建议

需要提交：

- `src/`
- `public/`
- `package.json`
- 锁文件：`package-lock.json`
- `vite.config.ts`
- `tsconfig*.json`
- `components.json`
- `README.md`

不要提交：

- `node_modules/`
- `dist/`
- `dist-ssr/`
- `.vite/`
- `.tanstack/tmp/`
- `.env`
- `pnpm-lock.yaml`
- 日志文件
- 本地编辑器缓存

说明：`src/routeTree.gen.ts` 是 TanStack Router 生成的路由树。为了 clone 后更稳定地直接运行，当前建议保留提交，不放入 `.gitignore`。

## 和后端的关系

前端只负责协议解析和通用渲染。

业务页面结构、列表字段、表单字段、操作动作、权限信息等由 Dever 后端通过 JSON 下发。前端通过 `public/config.js` 中的 `runtime.host` 请求对应页面配置。
