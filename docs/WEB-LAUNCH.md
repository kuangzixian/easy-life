# 好好生活网页版

网页版“好好生活”与原生微信小程序“匡子闲学”共享内容快照、检索和收藏规则，小程序审核名称保持不变。浏览器界面使用标准 HTML/CSS/JavaScript，支持手机和电脑；无需登录、数据库、服务端代码或模型 API。

截至 2026-10-05：已通过 Cloudflare Workers Builds 完成首次公开部署，默认地址已调整为 <https://easy-life.kznb.workers.dev/>；新地址 HTTP 200，Chrome 已成功渲染 `/#cards` 卡片页。本次网页名称更新的发布待验证，网址保持不变。尚未购买或绑定独立域名；此前项目所有者反馈手机移动网络无法访问，新地址的国内手机网络访问仍需真机验证。小程序备案与网页托管是不同的流程，不以小程序的备案状态推断网站状态。

## 本地运行

Node.js 20+，无需安装依赖：

```sh
npm run web
```

打开 <http://127.0.0.1:4173/>。此命令先构建，再仅从 `dist/` 提供公开文件。`npm run preview` 仍是旧的小程序设计预览；两个服务不能同时占用 4173 端口。

```sh
npm run build:web
npm run verify
```

生成的 `dist/` 可以直接上传到静态托管。构建采用公开文件白名单，不发布 `project.private.config.json`、AppID 配置、原生页面、输出截图、`.env` 或 Git 文件。浏览器内容包约 1.83 MiB，托管服务可传输压缩后的版本。

## 功能与数据

- 首页：每日建议、从头读、接着读、主题入口。
- 阅读：34 章、630 条完整建议；成本、收益、备注、引文、固定版本原文。
- 检索：复用关键词和同义表达规则；输入不写进 URL，不上传、不生成回答。
- 卡片：精选日常主题、换组、箭头/键盘/左右滑动、收藏。
- 分享：每篇独立 `#read/3-1` 链接；支持系统分享的浏览器使用分享面板，其余复制链接，剪贴板不可用时显示可选中文本。
- 收藏与已读：只在当前浏览器的 `localStorage` 中保存；换设备、清理数据或从测试域名切换到正式域名不会自动迁移。

当前没有 Service Worker，不承诺断网重开页面；打开后的检索和阅读不调用后端。搜索输入不持久化，刷新页面会清空搜索。浏览器正常返回可回到已有检索结果。

首页、每条文章、关于页均有来源与许可入口。文字基于 eternity4719 及 HowToLiveBetter 贡献者的《高性价比人生指南》，遵循 CC BY 4.0；本项目代码 MIT。页面说明结构化整理、界面改编、安全修订和不构成作者背书。

## 选择的免费方案

只使用 GitHub 与 **Cloudflare Workers Static Assets**。Cloudflare 官方目前优先推荐新静态项目使用 Workers，Pages 仍正常工作。静态文件请求免费且不限次数；Workers Free 支持 20,000 个文件、单文件 25 MiB。本项目仅有少量静态文件，没有执行 Worker 后端请求。

这与截图的“每日 10 万次 Worker 请求”是不同的计费边界。Workers Builds 免费额度为每月 3,000 构建分钟；额度和费用以后仍以官方页面为准。

- [新项目官方建议](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/#use-workers-static-assets-for-new-projects)
- [静态文件费用](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)
- [Workers 限制](https://developers.cloudflare.com/workers/platform/limits/)
- [构建额度](https://developers.cloudflare.com/workers/ci-cd/builds/limits-and-pricing/)

Supabase、D1、Redis、Turnstile 和 PostHog 当前都不需要；以后有账户、同步或接口，再按实际需求添加。字体与图标放在本站，没有外部字体 CDN 依赖。

## 域名规划

用户选择 **kuangzi.cc**，计划当前产品使用 **life.kuangzi.cc**；主域以后用于个人作品入口，其他小网站各用一个子域。

2026-10-04 Cloudflare 官方标准价：`.cc` 注册 US$8.00/年、续费 US$8.00/年。公开注册局 RDAP 未查到 `kuangzi.cc` 登记；这不保证可注册，也不是该名字的结账报价。购买前在用户账号确认实时状态、是否溢价、税费及最终总价。

若选择 Cloudflare 购买，由用户在 **Domain Registration / 域名注册 → Register Domains / 注册域名** 搜索 `kuangzi.cc`。注册联系人信息、邮箱验证、支付及注册条款由用户本人填写并确认，不放入仓库或聊天。Cloudflare Registrar 使用 Cloudflare DNS，并默认自动续费，按个人偏好检查该设置。

- [官方域名价格](https://pricing.registrar.cloudflare.com/)
- [注册步骤与条件](https://developers.cloudflare.com/registrar/get-started/register-domain/)

Cloudflare 免费全球网络不包含另购的中国网络服务，不能据此保证大陆手机访问速度；公开部署后再测试不同手机网络。

主要面向中国大陆用户时，建议在境内获工信部批复的注册商（如阿里云中国站或腾讯云）购买域名并完成实名认证，为以后使用境内托管和办理 ICP 备案做好准备。`.cc` 在可备案后缀列表中，但还须满足注册商资质、域名实名认证及持有人与备案主体一致等要求。Cloudflare 等境外注册商注册的域名不能直接用于国内 ICP 备案，需要先转入境内有资质的注册商并完成实名认证，再申请备案。详见[阿里云域名准备与检查](https://help.aliyun.com/zh/icp-filing/basic-icp-service/user-guide/prepare-and-check-the-domain-name)与[腾讯云准备 ICP 备案域名](https://cloud.tencent.com/document/product/243/18905)。

## 连接 GitHub 自动部署

Cloudflare 个人账号已连接 GitHub 的 `kuangzixian/easy-life` 仓库。Cloudflare Builds 使用保存在平台内的部署令牌发布，不把令牌写入源码；当前不需要微信 AppSecret、上传密钥或 GitHub Actions Secrets。

1. Cloudflare → **Workers & Pages → Create application → Import a repository → Get started**。
2. 连接 GitHub，仅选择 `kuangzixian/easy-life` 仓库。
3. 按下面填写，检查选择 Free 套餐，再 **Save and Deploy**。

| 配置 | 值 |
| --- | --- |
| Worker name | `easy-life`，必须与 `wrangler.jsonc` 一致 |
| Production / Git branch | `main` |
| Build command | `npm run verify && npm run build:web` |
| Deploy command | `npx wrangler deploy` |
| Root directory | 仓库根目录，留空或 `./` |
| Variables / Secrets | 不需要新增 |

`dist` 已在 `wrangler.jsonc` 的 `assets.directory` 指定。此流程是 Workers Builds，不使用 Pages 的输出目录字段。GitHub Actions 只检查并保存网页构建产物；Cloudflare 连接完成后，Cloudflare 才会自动构建部署新的 main 提交。

当前默认地址为 <https://easy-life.kznb.workers.dev/>。Cloudflare 后台的 Worker 已改名为 `easy-life`，账号的 workers.dev 子域已改为 `kznb`，与本地 Worker 配置一致。GitHub 仓库 `kuangzixian/easy-life`、`main` 分支及上表中的构建和部署命令均已保留；改名后的 `main` 提交 `5e63ce6` 已触发并通过 Cloudflare 自动构建与发布。文章路由保持 `/#read/3-1` 等形式；更换网址后，旧网址的浏览器收藏与已读记录不会自动迁移。

上面的 Build command 已在 Cloudflare 后台设置，并在首次构建日志中确认执行。它先执行 `npm run verify`，检查通过后才构建静态文件；检查失败会中止此次 Cloudflare 构建，不进入后续部署。这一步才是 Cloudflare 部署前的检查，GitHub Actions 的绿灯不能证明 Cloudflare 已执行检查或发布成功。

先验证后台生成的 `*.workers.dev` URL。部署成功后，每个提交应检查 Cloudflare 对应构建的成功状态与实际网页，不能把 GitHub 检查通过等同于发布成功。

- [创建并连接新 Worker](https://developers.cloudflare.com/workers/ci-cd/builds/#connect-a-new-worker)
- [构建字段](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)

## 绑定 life.kuangzi.cc

域名注册完成且 Cloudflare zone 为 Active 后：

**Workers & Pages → easy-life → Settings → Domains & Routes → Add → Custom Domain → life.kuangzi.cc → Add Custom Domain**。

Cloudflare 自动创建 DNS 和证书。不要提前创建同名 CNAME。HTTPS 生效后，验证首页、直接打开/刷新 `/#read/3-1`、分享链接、收藏、搜索和不存在路径的 HTTP 404。

- [官方自定义域名步骤](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/#set-up-a-custom-domain-in-the-dashboard)

## 验证记录与边界

`npm run verify` 覆盖内容、检索、存储、原生页面、网页打包隔离、真实 HTTP 响应和网页安全 URL/深链接解析。构建发布白名单、CSP 和 `no-referrer` 一并配置。

手机尺寸的浏览器检查不代替 iOS Safari、Android Chrome、微信内置浏览器或大陆手机网络的实际测试。Cloudflare 部署成功也不代表域名注册成功或所有地区均能访问。

2026-10-05 首次部署记录（旧默认地址）：`main` 提交 `4187a6a`，Cloudflare Build `37858a53-7a6e-4a1b-884d-304e2cc12d2b` 成功，36 项测试通过，Worker Version `b71ecbbc-cf41-4a91-a2c6-60c2fd1eecb1`。线上首页、`app.js`、`styles.css`、`bundle.js` 返回 200，未找到路径返回自定义 404；五项响应内容与本地构建的 SHA256 一致，CSP 等响应头已生效。Chrome 已实际渲染首页与卡片。项目所有者反馈手机流量下浏览器报错、超时或无法连接，尚不能据此区分默认域名和跨境网络等原因。

同日完成 Worker 与账号子域改名后，新地址 <https://easy-life.kznb.workers.dev/> 的 `index.html`、`app.js`、`styles.css`、`bundle.js` 均返回 HTTP 200，SHA256 与当前本地 `dist/` 完全一致。Chrome 成功渲染 `/#cards` 卡片内容，并通过下一张卡交互检查；本地再次执行 `npm run verify && npm run build:web` 通过，包含 36 项测试。`main` 提交 `5e63ce6` 随后触发 Cloudflare Build `3b885275-87ad-4916-8d5b-4f62f9f3bd2e`，36 项测试、构建与自动部署均成功，Worker Version 为 `8eaf2347-1c2b-4431-acfc-31ddc590192e`；GitHub 的 verify 和 build 检查也通过。国内手机网络访问仍需真机验证。

本次本地检查：375×812、390×844 与桌面宽度；首页、34 章目录、空结果恢复、问句检索、收藏刷新保持、文章原文链接、复制分享链接、卡片指针滑动与末张边界、主题换组、多个标签页的阅读进度刷新。页面没有浏览器控制台错误，检查页面无横向溢出。系统原生分享面板与触屏真机手势仍需手机验收。
