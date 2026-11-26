---
created: 2026-11-08
title: 节日猜价格游戏：从和太太的对话到上线
area: tech-engineering
category: [architecture, testing]
project: price-guess-game
context: personal
description: "为太太公司的节日活动做了一个 15 桌扫码参加的猜价格游戏（Cloudflare Workers + Durable Object），核心不到一小时上线；之后两天主要在改内容和外观：单品改成礼物篮，商品全部取自 Holiday 2026 杂志 PDF，规则和篮子按组织者意见反复修改。"
tools:
  - Claude Code (cloud)
  - Cloudflare Workers / Durable Objects / wrangler
  - TypeScript + vitest
  - Playwright (Chromium screenshots, PDF)
  - PyMuPDF / pdftoppm / PIL / ImageMagick
  - GitHub (gh, draft PR)
tags:
  - live-event-game
  - cloudflare-workers
  - durable-objects
  - websocket
  - stakeholder-iteration
  - pdf-extraction
key_learnings:
  - "🔴 程序的核心逻辑往往最快完成，真正耗时的是内容和外观上的利益相关者口味问题；一开始就要把内容来源、原文文案和硬约束要齐，外观先用设计工具出草图让人挑，定稿后再写进代码。"
  - "🔴 对方已经有现成文案时，先要原文照抄，再提精简建议；自己设计的文案和花哨的排版会被一轮轮推翻。"
  - "🔴 用户可见文案里承诺的内容约束（比如“每个篮子 3-6 样、每样 1 件”）要写成测试，以后改配置时才不会悄悄违背规则页上的话。"
  - "🔴 WebSocket 应用重新部署后，旧网页会自动重连到新服务器，用旧代码渲染新数据，看起来像程序坏了；部署后要强制刷新所有客户端，或者加版本检查自动刷新。"
  - "🔴 Cloudflare 的 secret 设好之后谁都看不到原值，只能重设；浏览器 sessionStorage 里如果还存着，可以从开发者工具里取回。"
  - "🟡 现成的问答工具（Kahoot 等）都不支持“最接近但不超过”加按轮计胜和自定义加赛，所以自己开发；Workers 免费版加一个 Durable Object 当游戏房间就够 15 桌用。"
  - "🟡 单品猜价对内部员工太容易，改成礼物篮猜总价；后来又因为时间有限改成每样 1 件，只猜单价再相加，不用算乘法。"
  - "🟡 商品价格以杂志 PDF 上印的为准，不去商店网站抓；云端环境的网络代理也拦截了 Loblaws 系列网站。"
  - "🟡 杂志里的生活场景照（Joe Fresh 整套搭配、装着食物的拼盘板和烤盘）和单件商品对不上，会误导猜价，只能用单独的包装照。"
  - "🟡 加赛从“1 题后抽签”改成最多 3 道加赛篮，还平的桌接着做下一道，最后一道还平才抽签。"
  - "🟢 倒计时 15 秒 → 30 秒 → 45 秒；规则页从白板黑字到图标横幅，最后定为 4 条带编号、只高亮 “without going over”。"
  - "🟢 给单位用的交付物全部改成英文：篮子清单 CSV 和商品清单 PDF。"
related_sessions: []
---

# Session Log: 节日猜价格游戏

## 1. Context & Origin

太太公司（President's Choice / Loblaw）要办节日活动，想做一个现场猜价格游戏：15 桌，每桌一部手机扫码参加，大屏出题，最接近但不超过真实价格的一桌赢这一轮，赢的轮数最多的一桌得奖。我先和 ChatGPT 讨论过有没有现成工具，把那份讨论交给 Claude 核对，再决定买现成的还是自己写。

## 2. Exploration Path

- **Attempt 1**：找现成的免费问答工具（Kahoot、Quizado 等）。
  - *Result*：❌ Rejected。没有一个同时支持“最接近但不超过”、按轮计胜和自定义加赛。11/7 下午 3 点决定自己开发，核心引擎 20 分钟左右提交，不到一小时部署到 Cloudflare。
- **Attempt 2**：每题猜一个单品，商品来自太太幻灯片里的 16 个产品。
  - *Result*：❌ Rejected。内部员工对自家商品价格太熟，太容易。改成礼物篮：大屏显示篮子和每样商品的照片，揭晓时每件商品挂价格吊牌，下面是 Excel 样式的计算表。
- **Attempt 3**：去商店网站抓商品的价格和图片，或者写任务说明交给本地的 Codex（computer use）去抓。
  - *Result*：❌ Superseded。太太直接给了 Holiday 2026 Insiders Report 杂志 PDF，从里面抽出全部 115 个商品和价格，98 个有可用的图片。云端代理本来也拦截了 Loblaws 系列网站。
- **Attempt 4**：按杂志版面自己搭篮子（Aperitivo Hour、Pasta Night、Favourite Things 等）。
  - *Result*：❌ Rejected。用户觉得搭配不合理，直接指定了主题：汤、宠物食品、Joe Fresh、面包、巧克力、开胃小吃、奶酪，后来又加了厨房家居。
- **Attempt 5**：Joe Fresh 服装篮、火鸡加配菜的节日大餐篮、篮子里放 2 件同样的商品。
  - *Result*：❌ Rejected。服装照片是整套搭配，和单件商品对不上；火鸡配别的东西不合理；时间有限，不想让大家算乘法。改成每样 1 件，汤篮放进杂志里全部 5 种汤。
- **Attempt 6**：厨房家居篮里放 Bring A Board 和烤饼干盘。
  - *Result*：❌ Rejected。这两样杂志上只有装着食物的照片，会误导，所以去掉，剩下 4 样的篮子移到加赛 1。
- **Attempt 7**：规则页的样式。
  - *Result*：先是 4 张图标卡片 → 照抄组织者原文的白板黑字（“太单调”）→ 金色编号加图标、黄色横幅（“太花”）→ ✅ Accepted：4 条规则，只留编号，原第 1–3 条合并成一句，只高亮 “without going over”。
- **Attempt 8**：第一次部署后大屏不显示商品图片。
  - *Result*：✅ 原因是部署前打开的网页没刷新：WebSocket 重连到新服务器，旧代码不认识礼物篮。强制刷新就好。
- **Attempt 9**：加赛规则。
  - *Result*：✅ 从“1 道加赛题，还平就抽签”改成最多 3 道加赛篮，还平的桌接着做下一道，最后一道还平才抽签。

## 3. Key Decisions

- **Decision**：Cloudflare Workers 免费版加一个 Durable Object 作为唯一的游戏房间（SQLite 存状态，用 alarm 到点锁定，WebSocket 推送给大屏和手机）。
  - **Reason**：免费、不用管服务器，15 桌的规模绰绰有余。
- **Decision**：真实价格和单价只存在服务器上，揭晓前不发给任何浏览器；图片文件名不含价格，图片也都检查过没有价格。
  - **Reason**：防止有人看网页源码或图片拿到答案。
- **Decision**：价格以杂志上印的价格为准，用整数“分”计算。
  - **Reason**：大家有统一可查的标准，也避免小数误差。
- **Decision**：篮子在 `src/config.ts` 里用 `basket()` 定义，总价自动相加；测试检查每个篮子 3–6 样不同商品、每样 1 件。
  - **Reason**：组织者常改题，改错了测试会报错。
- **Decision**：倒计时 45 秒，练习 2 轮，正式 5 轮，加赛最多 3 道。
  - **Reason**：试玩后发现礼物篮需要时间看清和相加；规则写的是 5 个篮子。
- **Decision**：给公司内部看的交付物全部用英文。
  - **Reason**：要在太太公司内部分享。

## 4. Notable Artifacts

```bash
# 仓库 / 分支 / PR / 线上
https://github.com/austery/price-guess-game   # 分支 claude/core-game-engine
https://github.com/austery/price-guess-game/pull/1
https://price-guess-game.lucid-blog.workers.dev   # 主持人页面：/host

# 每次改完的部署步骤（本地仓库目录）
git pull
npx wrangler deploy
# 然后刷新大屏页面，点 Reset game，第二个确认框选 OK

# 忘了主持人密钥：只能重设
openssl rand -hex 12
npx wrangler secret put HOST_KEY

# 关键文件
src/config.ts        # 篮子、倒计时、规则
src/magazine.ts      # 从杂志 PDF 生成的商品库
src/game.ts          # 状态机和各屏幕的视图（价格揭晓前不外发）
docs/session-summary.md                          # 中文开发总结
docs/basket-lineup.csv                           # 10 个篮子（英文）
docs/Holiday-2026-All-Products-and-Baskets.pdf   # 全部商品和篮子（英文）
```

## 5. User Preferences Learned

- 用平实的中文交流，不要绕；游戏界面和给单位的文件用英文。
- 组织者给了原文就照抄，提精简建议可以，但不要自作主张加内容。
- 外观要简单明了，但不能苍白：不要图标堆砌，高亮只留最关键的一处。
- 主持人密钥绝不在聊天里出现。
- 文件存在项目里，自己下载；需要的话放进仓库 `docs`，`git pull` 就能拿到。
- 每次改完都提醒部署三步：`git pull`、`npx wrangler deploy`、刷新并 Reset game。

## 6. Obsidian Bridge (Optional)

- **Suggested MOC**: [[price-guess-game]]
- **Suggested Note Title**: `核心逻辑一小时，内容和外观两天：利益相关者驱动的迭代`
- **Extraction Status**: pending
