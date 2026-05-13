window.appConfig = {
  site: {
    name: 'Dever通用后台',
    subtitle: 'JSON 驱动前端界面',
    description: '基于 Dever 框架的 JSON 驱动前端界面运行时。',
    url: '/',
    logo: '/images/logo.svg',
    favicon: '/images/favicon.svg',
  },
  appearance: {
    theme: 'light',
    sidebar: 'floating',
    layout: 'compact', //full、compact、boxed
    direction: 'ltr',
  },
  runtime: {
    skin: 'default',
    routerMode: 'hash',
    host: `${window.location.protocol}//${window.location.hostname}:8085/front/`,
  },
}
