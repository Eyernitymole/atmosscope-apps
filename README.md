# AtmosScope Apps

天衡气象包含普通天气和专业图集，两页均随 Android 与 Windows 应用打包，也可作为静态网页在本地打开。页面代码不依赖 ChatGPT Site 或登录；天气数据仍需联网获取。

## 平台与数据

- Android 7.0+（`com.atmosscope.weather`）：WebView 通过 AndroidX 的 HTTPS 本地资源映射加载安装包内的页面。
- Windows 10/11 x64：WPF 与 Evergreen WebView2 Runtime 通过本地虚拟主机加载安装包内的页面。
- 普通天气的城市搜索和模式预报来自 [Open-Meteo](https://open-meteo.com/)。模式当前场并非气象站实况，页面不提供官方预警。
- 专业图集使用相应的真实雷达和数值模式数据源；部分图表脚本通过 CDN 加载。

## 非商业公开体验版（待启用）

仓库已准备 GitHub Pages 部署工作流，但公开网站是否可访问以实际部署和未登录浏览器验收为准，不能仅凭以下预期地址判断已上线：

- 普通天气：`https://eyernitymole.github.io/atmosscope-apps/ordinary.html`
- 专业图集：`https://eyernitymole.github.io/atmosscope-apps/index.html`

仓库拥有者需要在 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。随后在 Actions 中运行 **Deploy AtmosScope Pages**（可手动触发），确认部署成功，再以未登录浏览器分别打开两个地址，检查页面互链、静态资源、城市搜索及天气请求状态。部署失败时查看该工作流日志；网页能打开而天气缺测时，还需检查外部数据源与当前网络。

此体验版不含广告或订阅，不用于商业推广，也不保证中国大陆稳定访问。免费 Open-Meteo API 仅限非商业用途，并受[使用条款](https://open-meteo.com/en/terms)中的调用量与许可约束；实际访问量超限或改作商业用途前，须另定数据授权与部署方案。页面仍需联网获取气象数据，专业图集部分资源依赖外部 CDN。

## 本地运行与检查

```bash
python3 -m http.server --directory web 8765
```

浏览器访问 `http://localhost:8765/ordinary.html`（普通天气）或 `http://localhost:8765/index.html`（专业图集）。运行：

```bash
npm test
```

PR 的 CI 还会检查浏览器交互及两个原生平台的构建和页面打包。Android 正式签名仅由 CI 环境变量提供；不要提交密钥库或密码。
