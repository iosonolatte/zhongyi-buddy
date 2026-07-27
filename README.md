# 中医Buddy · 六经辨证 AI（网页版）

> 倪海厦汉唐中医 App 的**更好看的静态网页版** —— 纯 HTML / CSS / 原生 JS，无框架、可离线运行。

将开源 Flutter / 安卓应用 [`nihaixia-app`](https://github.com/jangviktor-web/nihaixia-app)（倪海厦六经辨证诊断）完整移植为静态网页，并重做了 UI 与移动端体验。

## ✨ 功能

- **辨证问诊** —— 对话式七步问诊（主诉 → 寒热 → 舌脉 → 十问 → 定位 → 结果）。内置六经辨证引擎，含合病、鉴别诊断、真寒假热 / 真热假寒、脉舌矛盾、瘀血五法、用药铁律、汗法禁忌、传经、组合脉等检测器。结果卡片带经别徽章、置信度、处方组成表、调护与警示。
- **方剂查询** —— 290 首经方，支持搜索 + 分类筛选，含组成 / 剂量 / 方解 / 禁忌。
- **中药查询** —— 440 味药，性味归经、剂量、禁忌、临床按语。
- **针灸经络** —— 症状 → 穴位 + 透针（透刺）两大板块。
- **实用工具**
  - 子午流注：纳子法 / 五门十变，天干日 + 地支时辰 → 本穴，可实时选时间推算。
  - 经方剂量换算：汉 / 台 / 唐三制，重量 / 容量 / 长度 + 特殊药量换算。

## 🛠 技术栈

原生 JavaScript（无框架）+ 静态 JSON 数据 + 响应式布局（明暗主题、移动端底部导航、表格横向滚动）。

## 🚀 本地运行

数据通过 `fetch` 加载，**必须用本地服务器**，不能直接 `file://` 打开。

```bash
cd nihaixia-web
python -m http.server 8000
# 浏览器访问 http://localhost:8000
```

## 🌐 在线访问

- **GitHub Pages**：https://iosonolatte.github.io/zhongyi-buddy/
- **云端版（CloudStudio）**：https://9707061ea881456c8b0c3f1cb91f7eac.app.codebuddy.work

## 📁 目录结构

```
nihaixia-web/        # 网页源码（站点根）
  index.html
  styles.css
  app.js             # UI 与视图逻辑
  engine.js          # 六经辨证引擎
  diagnose.js        # 各经辨证方法与出方
  rules-a.js / rules-b.js   # 规则数据
  data-loader.js
  data/              # formulas / herbs / acupuncture / acupoints 等 JSON
nihaixia-app/        # 原始 Flutter / 安卓源码（移植来源，未纳入本仓库）
```

## ⚠️ 免责声明

本工具仅供中医学习与研究参考。所作的"辨证 / 出方"结果**不构成任何医疗建议**，实际诊疗请遵医嘱。

## 📚 数据来源

方剂、中药、针灸数据移植自 [`nihaixia-app`](https://github.com/jangviktor-web/nihaixia-app)（原作者发布的六经辨证 Android App）。
