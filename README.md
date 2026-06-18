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
pnpm install
```

启动开发服务：

```bash
pnpm dev
```

打包给后端托管：

```bash
pnpm build:backend
```

默认会把静态文件输出到 `backend/package/front/front/html`，后端默认从 `/admin` 访问。
打包默认使用单 bundle，减少后端托管时的大量小文件请求；如需恢复 Vite 拆分 chunk，可设置 `VITE_FRONT_BUNDLE=split`。
访问前缀、接口前缀、站点信息和皮肤配置由 active 组件 `dever.json.front` 合并后生成的 `runtime.js` 下发。

## 运行时配置

主要配置随组件发布：

```txt
backend/package/<name>/dever.json
backend/module/<name>/dever.json
```

常用字段：

- `front.sites.*.config`：站点名称、描述、URL、logo、favicon 等展示配置
- `front.sites.*.setting.appearance`：默认主题、侧边栏、布局方向
- `front.sites.*.setting.runtime`：皮肤、路由模式和运行时插件
- `front.sites.*.api/page/access/entry/public`：接口前缀、页面目录、访问控制、入口和站点公开路径
- `front.public`：组件提供的全局公开后端路径

`access.mode` 支持 `rbac`、`login`、`public`。`admin` 是共享站点，业务组件只追加 `auth/public`；非 `admin` 站点由一个组件定义站点壳字段，避免同名站点互相覆盖。

## Git 提交建议

需要提交：

- `src/`
- `package.json`
- 锁文件：`pnpm-lock.yaml`
- `vite.config.ts`
- `tsconfig*.json`
- `components.json`

站点 logo、favicon 等项目覆盖资源提交到后端 `backend/config/front/assets/{siteKey}/`，并在 `backend/config/front.json` 中用 `config/assets/{siteKey}/...` 引用；组件默认资源放在组件自己的 `front/assets/{siteKey}/`。

- `README.md`

不要提交：

- `node_modules/`
- `dist/`
- `dist-ssr/`
- `.vite/`
- `.tanstack/tmp/`
- `.env`
- `package-lock.json`
- `yarn.lock`
- 日志文件
- 本地编辑器缓存

说明：`src/routeTree.gen.ts` 是 TanStack Router 生成的路由树。为了 clone 后更稳定地直接运行，当前建议保留提交，不放入 `.gitignore`。

## 和后端的关系

前端只负责协议解析和通用渲染。

业务页面结构、列表字段、表单字段、操作动作、权限信息等由 Dever 后端通过 JSON 下发。前端通过 `runtime.js` 中的 `apiHost` 请求对应页面配置。
