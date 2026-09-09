# Weather Dashboard

这是一个使用 Open‑Meteo、Leaflet 与 Chart.js 的前端 Weather Dashboard 示例。

主要功能：
- 城市搜索（Open‑Meteo geocoding）
- 在地图上点击选择位置
- 当前天气、小时级（24 小时）温度与降雨概率
- 7 天预报
- 温度单位切换（°C / °F），支持持久化
- 使用 Weather Icons 作为天气图标

部署
1. 已把文件提交到仓库的 `main` 分支。
2. 若要启用 GitHub Pages：进入仓库 Settings -> Pages，选择 Branch `main`、Folder `root`，保存后几分钟内网站应可访问。

Pages URL（通常）：
https://7YYYB.github.io/weather-dashboard/

本地运行
- 直接打开 `index.html`（有些浏览器可能限制本地模块/请求），建议使用一个简单静态服务器，例如：
  - Python: `python -m http.server 8000`
  - 或使用 VSCode Live Server

后续增强建议
- 用更完整的 weathercode 到图标的映射或自定义 SVG 图标
- 添加小时温度的滑动细节/tooltip
- 支持多语言
- 为需要 API Key 的服务（例如 OpenWeatherMap）增加后端代理以安全存放密钥

