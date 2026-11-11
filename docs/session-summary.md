# 开发总结：节日猜价格游戏

> 2026 年 11 月 7–8 日，与 Claude Code 在云端完成。
> 仓库：<https://github.com/austery/price-guess-game>，分支 `claude/core-game-engine`，PR：<https://github.com/austery/price-guess-game/pull/1>
> 线上网址：<https://price-guess-game.lucid-blog.workers.dev>（主持人：`/host`）

## 1. 目标

公司节日活动（President's Choice / Loblaw 产品）上的现场互动游戏：

- 最多 20 桌（原定 15 桌，留出余量；没人用的桌号空着即可），**每桌一部手机**，用手机相机扫大屏上的二维码进入，不用装 App。
- 大屏显示题目，各桌在倒计时内输入价格。
- **最接近但不超过**真实价格的一桌赢这一轮；赢的轮数最多者得奖。
- 免费托管在 Cloudflare Workers。

最初考虑过现成的问答工具（Kahoot、Quizado 等），但没有一个免费工具同时支持"最接近但不超过"、按轮计胜和自定义加赛，所以决定自己开发。

## 2. 最终玩法

```
扫码页 → 欢迎页 → 规则页 → 练习 2 轮（不计分）→ 正式 5 轮 →（如并列第一）加赛 → 总冠军
```

每一轮：

1. **出题**：大屏显示一个节日礼物篮，上方是装满商品的篮子，下方是每样商品的照片和规格（每样 1 件）。手机上只有篮子名字和输入框。45 秒倒计时，配圣诞音乐。
2. **作答**：每桌输入总价，倒计时内可以改，以最后一次为准。时间一到由服务器锁定。
3. **揭晓**（一页）：每件商品挂上黄色价格吊牌，右上角是大字总价；下面是本轮赢家和各桌的报价，从最接近排起，赢家绿色，超价的划掉。音乐停止。
4. **下一步**：显示排行榜，进入下一轮。

## 3. 已确认的规则

| 问题 | 决定 |
|---|---|
| 同一轮两桌报出相同的最高有效价 | 都得 1 分 |
| 某一轮所有桌都超价 | 本轮无人得分 |
| 倒计时内能否改价 | 可以，以最后一次为准 |
| 手机上显示什么 | 手机只用来输入价格，其他内容（规则、商品、结果、排名、冠军）都只在大屏上显示，让全桌一起看大屏。手机画面：等待和轮与轮之间显示 "You are Table 3"；出题时只有篮子名字、倒计时和输入框（提交后显示 "Your guess" 和绿色提示，时间到之前可以 Change）；时间到和揭晓时显示 "Time's up!" 和这桌最后提交的价格；游戏结束显示 "Thank you for participating. Have a good holiday!" |
| 揭晓时是否公开各桌报价 | 全部公开 |
| 界面语言 | 英文 |
| 是否用 PPT | 不用，只用网页 |
| 倒计时 | **45 秒**（原定 15 秒；改成礼物篮后先改 30 秒，试玩后改为 45 秒） |
| 总冠军并列 | 只让并列的桌加赛：① 最接近但不超过者赢；② 全部超价则最接近者赢；③ 仍然平局或都没作答，还平的桌再做下一道加赛题。最多 3 道，第 3 道还平才随机抽签。 |
| 练习 | 正式比赛前练 2 轮（也是礼物篮），不计分，主持人可跳过 |
| 规则页 | 组织者的规则精简成 4 条：① There are 5 baskets. Guess the total price of all the items in each basket. ② The table that is closest to the total without going over wins that round! ③ The table with the most correct guesses wins a prize! ④ You have 45 seconds per basket. If you type it wrong, enter a new price before time runs out. |
| 价格标准 | 税前货架价，以 PC Insiders Report Holiday 2026 杂志上印的价格为准 |

## 4. 当前题目（来自 Holiday 2026 杂志）

| 用途 | 篮子 | 内容（每样 1 件） | 总价 |
|---|---|---|---|
| 练习 1 | Soup Night Basket（汤） | 龙虾汤、番茄汤、泰式鸡汤、牛肉辣酱、烤土豆汤、酸面包脆片 | $40.50 |
| 练习 2 | Holiday Sweets Basket（冰淇淋甜品） | 黄油挞派、蛋酒冰淇淋、提拉米苏雪糕、圣诞老人牛奶饼干冰淇淋、椰枣 | $34.50 |
| 第 1 轮 | Holiday Party Snacks（开胃小吃） | Beef Wellie Bites、Fish & Chips Stacks、Bombas、T&T 虾片、韩式焦糖爆米花、意式辣肠披萨味薯片 | $41.00 |
| 第 2 轮 | Favourite Things Gift Box | 护手霜三件套、浴盐、痘痘贴、Cica 爽肤棉片 | $47.00 |
| 第 3 轮 | Cheese Board（奶酪） | G.O.A.T. 羊奶酪组合、樱桃羊奶酪、White Fox、Isle of Man 切达、无乳糖马苏里拉、无乳糖奶酪条 | $46.50 |
| 第 4 轮 | Bakery Basket（面包） | 迷迭香佛卡夏、橄榄佛卡夏、酸面包法棍、蒜香手撕包、黄油可颂、香蕉巧克力蛋白松饼 | $29.00 |
| 第 5 轮 | Chocolate Lover's Basket（巧克力） | 比利时松露巧克力、2 种巧克力米饼、2 种巧克力杏仁、拐杖糖巧克力冰淇淋 | $31.50 |
| 加赛 1 | Kitchen & Home Basket（厨房家居） | 大号相思木拼盘板、蜂巢烤盘、CeraWare 不粘煎锅 11.5"、TidyStack 玻璃保鲜盒 | $130.00 |
| 加赛 2 | Pampered Pets Basket（宠物食品） | 3 种狗粮、猫粮 | $104.00 |
| 加赛 3 | Pasta Night Basket | 博洛尼亚肉酱饺、布拉塔饺、Solerama 番茄、松露乳清干酪团子 | $24.00 |

**数据来源**：从杂志 PDF（39 页）抽出全部 115 个商品，其中 98 个有图片，已放进游戏商品库（Isle of Man 和 Bombas 的图是从拼盘照片裁的）。所有商品和价格都来自 PDF，没有从商店网站抓取。全部商品按类别排的清单见 `docs/Holiday-2026-All-Products-and-Baskets.pdf`（英文，可在公司内部分享）；10 个篮子的清单另有英文 CSV：`docs/basket-lineup.csv`。完整清单（含杂志页码、SKU、游戏 ID）在 `preview-baskets/holiday-products-and-baskets.xlsx`，商品图鉴在 `preview-baskets/product-ids-*.png`。`preview-baskets/` 只在 Claude 的云端环境里，不上传 GitHub；需要的话请 Claude 重新生成。

**与之前表格的差异**：Belgian 松露巧克力（600 g）杂志印的是 **$15**，之前的表格写的是 $13（$13 是同一页 210 g 的 Praline Collection）。已改为 $15。

## 5. 大屏和音乐

- **背景**：经典圣诞风格，用代码绘制。品牌洋红、酒红、常青绿、午夜蓝四种底色每屏轮换，配金色雪花、光点和细边框。主持人网址后加 `?bg=photo` 可以换成虚化的杂志封面。
- **音乐**：只在主持人电脑上播放，由浏览器现场合成，不占服务器。每一题换一首传统圣诞歌（Jingle Bells、Deck the Halls、We Wish You a Merry Christmas、God Rest Ye Merry Gentlemen、Good King Wenceslas、Joy to the World），快节奏乐队编排。最后 5 秒加滴答声，时间到响蜂鸣，揭晓时安静。
- **主持人快捷键**：空格 = 主按钮，← = 开场页返回，M = 音乐开关，H = 隐藏控制栏。

## 6. 怎么部署

在本地仓库目录里：

```bash
git checkout -- package-lock.json
git pull
npx wrangler deploy
```

部署后打开 `/host`，点 **Reset game**，第二个确认框选 **OK**（清空各桌的选桌），游戏就从扫码页开始。

## 7. 主持人密钥（HOST_KEY）

- 设一次一直有效，**不是一次性的**。任何电脑打开 `/host` 输入同一个密钥即可。同一个浏览器标签页会记住；换浏览器或新标签页要再输一次。
- Cloudflare 不能查看密钥内容。忘了的话，用下面的命令重设，立即生效，旧密钥作废：
  ```bash
  openssl rand -hex 12
  npx wrangler secret put HOST_KEY
  ```
- 把密钥存进密码管理器，**不要发到聊天里**。

## 8. 怎么改题目

全部在 `src/config.ts`：

```ts
basket("Soup Night Basket", [
  ["lobster-bisque", 1],
  ["tomato-basil-bisque", 2],
]),
```

- 商品 ID 见商品图鉴或 Excel 的 "Game ID" 列。总价自动相加。
- `dishes` 里放几个篮子，正式比赛就玩几轮；`practice` 是练习题；`tiebreakers` 是加赛题（按顺序用）。
- `roundSeconds` 是倒计时秒数。单题可以加 `{ seconds: 40 }` 另设时间；加 `{ hero: "/items/xxx.jpg" }` 可以换成一张真实的整篮照片。
- 改完后运行 `npx wrangler deploy`。
- 也可以把 Excel 第 1 页改好发给 Claude，由 Claude 来改。

## 9. 活动前检查清单

- [ ] 部署最新版本，在大屏上 Reset game（第二个确认框选 OK）。
- [ ] **在活动现场实测网络**：用几部手机扫码、作答，确认场地 Wi-Fi 或手机流量能用。程序解决不了网络问题，建议准备纸卡作为后备。
- [ ] 主持人电脑接上投影和音响，打开声音，按空格开始后确认能听到音乐。
- [ ] 准备好主持人密钥。
- [ ] 把后备 PowerPoint（`docs/Guess-the-Price-Backup-Slides.pptx`）存到主持人电脑和一个 U 盘里，再准备纸和笔；万一网站用不了，就各桌写价格举牌。
- [ ] 彩排完再 Reset game 一次（第二个确认框选 OK），否则正式开始时各桌已经被占用。
- [ ] 每桌指定一个人负责手机输入。

## 10. 现场出问题怎么办

| 情况 | 处理 |
|---|---|
| 手机刷新、断线或锁屏 | 自动重连，桌号和本轮报价都保留 |
| 手机没电要换手机 | 主持人在大屏上点击该桌号 → 释放 → 新手机重新选桌 |
| 两部手机抢同一个桌号 | 先到先得，后来的提示已被占用 |
| 主持人页面刷新 | 游戏状态存在服务器上，不会丢 |
| 某一轮要重来 | 按 Redo round |
| 时间不够 | 在 `dishes` 里减少篮子；或按 Skip practice 跳过练习 |

## 11. 技术要点

- Cloudflare Workers（免费版）+ 一个 Durable Object 作为唯一的游戏房间。状态存在 SQLite 里，用 alarm 执行截止锁定，用 WebSocket 把状态实时推送给大屏和手机。
- 前端是纯 HTML 和 JavaScript，没有框架，也不需要构建。
- **真实价格和单价在揭晓前不会发给任何浏览器**。商品图片的文件名不含价格，图片里也都检查过没有价格。
- 测试：83 个单元测试，加一个模拟 20 部手机和主持人完整玩一局的脚本（`npm run simulate`），GitHub 上的 CI 会自动运行。

## 12. 开发过程

| 日期 | 内容 |
|---|---|
| 11/7 | 评估现成工具，决定自己开发；核心游戏引擎、主持人大屏、手机页面 |
| 11/7 | 总冠军并列时的加赛；练习轮；可配置轮数 |
| 11/7 | 导入太太幻灯片里的 16 个产品（去掉价格卡） |
| 11/7 | 节日主题、开场欢迎页和规则页、产品拼贴 |
| 11/7 | 倒计时音乐（每题一首圣诞歌）、经典圣诞背景、"seconds left" |
| 11/7 | 首次部署到 Cloudflare |
| 11/8 | 改为礼物篮玩法：商品照片 + 数量，揭晓时显示价格吊牌和计算表 |
| 11/8 | 从 Holiday 2026 杂志抽取全部商品，组成 5 个主题礼物篮；更正松露价格 |
| 11/8 | 倒计时从 15 秒改为 30 秒 |
| 11/8 | 首次部署试玩；倒计时改为 45 秒；规则页改为组织者原文；按 7 个主题重组 10 个篮子（练习 2、正式 5、加赛 3）；加赛最多 3 道 |
| 11/8 | 去掉 Joe Fresh 篮子（杂志的服装照片是整套搭配，和单件商品对不上）；奶酪篮升为第 3 轮，节日大餐改为练习 2，加赛 3 换成 Pasta Night |
| 11/8 | 每样商品改为 1 件（只猜单价，不用算乘法）；去掉节日大餐，练习 2 改为厨房家居篮；汤篮、面包篮补到 6 样 |
| 11/8 | 厨房家居篮去掉两样图片会误导的商品，移到加赛 1；冰淇淋甜品篮改为练习 2 |
| 11/8 | 规则页几轮修改：白板黑字（太单调）→ 图标 + 黄色横幅（太花）→ 只留编号的 4 条规则，只高亮 "without going over" |
| 11/8 | 篮子清单导出成英文 CSV；商品清单 PDF 改成英文，方便在公司内部分享 |
| 11/9 | 桌数从 15 改为 20，留出余量；大屏桌号排成两行，手机选桌页每行 4 个 |
| 11/10 | 手机作答：提交后输入框清空，上方用大号金色数字显示 "Your guess"，按钮从 Submit 变成 Change，改价格后大数字直接更新；提交后输入框下方一直显示绿色提示 "Submitted! You can change it until time's up."，直到时间到 |
| 11/10 | 手机只用来输入：去掉规则、商品清单、每轮结果和排行榜，全部看大屏；游戏结束时手机显示 "Thank you for participating. Have a good holiday!" |
| 11/11 | 同事试玩反馈：揭晓改成一页，去掉 Excel 计算表；商品价格吊牌、总价、赢家和各桌报价一起显示，少按一次空格 |
| 11/11 | 汤篮（5 种汤同价，太简单）和开胃小吃对调，汤改为练习 1；宠物食品（3 种狗粮同价）和 Life Brand 礼盒对调，礼盒改为第 2 轮；做了一份纸笔玩法的后备 PowerPoint |

## 13. 主要文件

| 文件 | 内容 |
|---|---|
| `src/config.ts` | 题目、价格、规则、倒计时，**改题目只改这里** |
| `src/magazine.ts` | 从杂志自动生成的约 80 个商品 |
| `src/game.ts` | 游戏状态机，以及各个屏幕能看到的内容 |
| `src/scoring.ts` | 计分和加赛判定 |
| `src/room.ts` / `src/worker.ts` | 游戏房间和网络入口 |
| `public/host.html` | 主持人大屏 |
| `public/index.html` | 手机页面 |
| `public/sound.js` | 倒计时音乐 |
| `public/items/` | 商品图片 |
| `docs/spec.md` | 详细需求说明 |
| `docs/basket-lineup.csv` | 10 个篮子的商品和价格（英文） |
| `docs/Holiday-2026-All-Products-and-Baskets.pdf` | 杂志全部商品和 10 个篮子（英文，可分享） |
| `docs/Guess-the-Price-Backup-Slides.pptx` | 后备 PowerPoint（服务器或电脑出问题时用纸笔玩）：欢迎、规则、每个篮子一页题目一页答案、感谢页 |
| `docs/session-log/` | 按 session-summary 技能格式写的会话日志、交接说明和保存用的 JSON |

## 14. 回顾

- **从对话到程序**：一开始是和太太的一段对话，再拿和 ChatGPT 讨论的现成工具清单来核对。11/7 下午 3 点决定自己开发，20 分钟左右核心引擎就提交了，不到一个小时就部署上线。
- **时间真正花在哪里**：程序本身很快，后面大部分时间花在内容和外观上：选商品、配篮子、规则怎么写、颜色和高亮。这些主要是太太和组织者的口味问题，来回改了很多轮，有点吹毛求疵。
- **下次可以更快**：
  - 一开始就要到三样东西：商品来源（杂志 PDF）、规则原文、"每样 1 件"这类硬约束。这次这三样都是中途才确定的，导致篮子重做了好几次。
  - 篮子主题和商品搭配让组织者先在表格里定好，程序只负责读进来。
  - 外观细节（规则页的样式、颜色、高亮）可以用 Claude Design 这类设计工具先出几版草图给太太挑，定稿后再写进程序，比在代码里一版一版改省事。
