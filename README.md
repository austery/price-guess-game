# Price Guess Game 猜食材价格

一个现场互动小游戏：15 桌各用一部手机扫码参加，共 5 轮。每轮猜一道菜的食材总价，**最接近但不超过**真实价格者赢。

运行在 Cloudflare Workers + Durable Objects 上，免费版就够用。需求和规则见 [docs/spec.md](docs/spec.md)。

## 页面

| 地址 | 谁用 |
|---|---|
| `/` | 每桌手机（大屏上的二维码就指向这里） |
| `/host` | 主持人大屏 + 控制栏（需要输入主持人密钥） |

主持人快捷键：**空格** = 主按钮（开始 → 揭晓 → 下一步），**H** = 隐藏/显示控制栏。

## 修改菜品、价格和规则

全部在 [`src/config.ts`](src/config.ts) 里：

- `dishes`：5 道菜的名字、食材、图片路径、真实价格。**价格以"分"为单位**，比如 $30.75 写成 `3075`。
- `roundSeconds`：倒计时秒数。
- `rules`：几条可调整的规则（平局、能否改价、手机是否显示图片、是否公开所有报价）。
- `tiebreaker`：加赛题，只在总冠军并列时使用。
- `guessPrompt`：告诉大家要猜什么的一句话。

菜品图片放在 `public/dishes/`。**文件名要起得别人猜不到**（例如 `main1-k8d2x.jpg`），因为 `public/` 里的文件任何人都能直接访问。

> ⚠️ 真实价格只能写在 `src/config.ts` 里，不要放进 `public/`。

## 本地开发

```bash
npm install
cp .dev.vars.example .dev.vars    # 本地主持人密钥：dev-host-key
npm run dev                        # http://127.0.0.1:8787
```

主持人页面：<http://127.0.0.1:8787/host?key=dev-host-key>

同一 Wi-Fi 下用真手机测试：`npx wrangler dev --ip 0.0.0.0`，手机打开 `http://<电脑的局域网IP>:8787`。

## 测试

```bash
npm run typecheck
npm test              # 计分和状态机的单元测试
npm run simulate      # 需要先 npm run dev：模拟 15 部手机 + 主持人完整玩 5 轮
```

`simulate` 会验证：真实的 15 秒自动锁定、迟交被拒、改价、断线重连、揭晓前价格不外泄，以及每轮赢家都符合"最接近但不超过"的规则。

⚠️ `simulate` 会重置游戏，不要在活动现场对正式网址运行。

## 部署

1. `npx wrangler login`
2. `npm run deploy`
3. `npx wrangler secret put HOST_KEY`，设置一个主持人密钥（建议用 `openssl rand -hex 12` 生成）

部署后的网址是 `https://price-guess-game.<你的子域名>.workers.dev`。
