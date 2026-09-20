# AtmosScope Apps

天衡气象包含普通天气和专业图集，两页均随 Android 与 Windows 应用打包，也可作为静态网页在本地打开。页面代码不依赖 ChatGPT Site 或登录；天气数据仍需联网获取。

## 平台与数据

- Android 7.0+（`com.atmosscope.weather`）：WebView 通过 AndroidX 的 HTTPS 本地资源映射加载安装包内的页面。
- Windows 10/11 x64：WPF 与 Evergreen WebView2 Runtime 通过本地虚拟主机加载安装包内的页面。
- 普通天气的城市搜索和模式预报来自 [Open-Meteo](https://open-meteo.com/)。模式当前场并非气象站实况，页面不提供官方预警。
- 专业图集使用相应的真实雷达和数值模式数据源；部分图表脚本通过 CDN 加载。

普通天气仍未部署为公共网址。计划公共部署前需根据 [Open-Meteo 使用条款](https://open-meteo.com/en/terms)核对非商业用途、调用量和许可。

## 本地运行与检查

```bash
python3 -m http.server --directory web 8765
```

浏览器访问 `http://localhost:8765/ordinary.html`（普通天气）或 `http://localhost:8765/index.html`（专业图集）。运行：

```bash
npm test
```

PR 的 CI 还会检查浏览器交互及两个原生平台的构建和页面打包。Android 正式签名仅由 CI 环境变量提供；不要提交密钥库或密码。
