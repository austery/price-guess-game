# 任务：收集礼物篮商品的资料（名称、规格、价格、包装图）

> 给本地 Codex（有 Computer Use，可以操作浏览器）的任务说明。
> 背景：这是公司节日活动的"猜价格"游戏（仓库 `austery/price-guess-game`）。每一题是一个礼物篮，大屏显示篮子里每样商品的照片和数量，各桌猜总价。你只负责**收集资料**，不要改游戏代码。

## 1. 输入：篮子清单（由组织者填写）

商品清单在下面这一节。如果某个篮子只写了主题、没写具体商品，就在商店里挑 4～6 样合适的 **PC®（President's Choice）商品**，写进结果表，并在 `notes` 里注明"Codex 推荐"。

```
篮子 1：<名字，例如 Holiday Soup Night Basket>
  - <商品名或关键词> × <数量>
  - ...
篮子 2：...
```

## 2. 去哪里查

- 商店网站：<组织者给的链接，例如 https://www.realcanadiansuperstore.ca>
- **价格因门店而异**：开始前先在网站上选定同一家门店（组织者指定的，没指定就选多伦多地区的一家），全部商品都在这家门店查。记下门店名称。
- 搜索时优先选 PC® 品牌、规格和清单一致的商品。如果有好几个规格，选最常见的那个，并在 `notes` 里说明。

## 3. 每个商品要收集的内容

| 字段 | 说明 |
|---|---|
| `basket` | 属于哪个篮子（篮子名字） |
| `slug` | 英文短 ID，小写加连字符，例如 `pc-tomato-basil-bisque`。**不要包含价格** |
| `qty` | 篮子里放几个 |
| `name` | 网站上的完整商品名，例如 `PC® Slow Simmered Tomato Basil Bisque Soup` |
| `size` | 规格，例如 `700 ml`、`288 g`、`3 pack` |
| `regular_price` | **单件的常规货架价，税前**，只写数字，例如 `9.00` |
| `sale_price` | 如果正在打折，写折扣价；没有就留空 |
| `price_note` | 特殊情况，例如 "2 for $7"、"按重量计价 $x/kg"、"会员价" |
| `url` | 商品页链接 |
| `image_file` | 图片文件名，例如 `images/pc-tomato-basil-bisque.jpg` |
| `notes` | 其他需要人确认的事 |

再加两个全表统一的信息，写在 `README.txt` 里：`store`（门店）和 `date_checked`（查询日期）。

## 4. 图片要求

- 每个商品下载**一张主图**：白底的包装正面照（商品页第一张大图），尽量选最大尺寸，最好宽度 ≥ 800 像素。
- 图片里**不能有价格**、促销角标或"Sale"标签。如果主图有这些，就换一张没有的。
- 存成 `images/<slug>.jpg`（或 `.png`）。
- 另外给每个商品页截一张全屏截图，存成 `screenshots/<slug>.png`，要能看到价格，用来人工核对。

## 5. 交付

在仓库里新建文件夹 `incoming/baskets/`，结构如下：

```
incoming/baskets/
  README.txt          门店、查询日期、遇到的问题
  products.csv        每个商品一行，列按第 3 节的顺序
  images/<slug>.jpg
  screenshots/<slug>.png
```

然后新建分支 `codex/basket-products`，只提交 `incoming/baskets/` 这个文件夹，推送到 GitHub。**不要修改仓库里其他任何文件**，不要合并到其他分支。

如果不方便推送，就把 `incoming/baskets/` 打包成 zip 交给组织者。

## 6. 完成标准

- 清单里每个商品在 `products.csv` 都有一行，`regular_price` 和图片都有；找不到的商品也要有一行，并在 `notes` 写明原因和备选商品。
- 价格和截图上的价格一致。
- 最后报告：一共几个商品，有哪些在打折，有哪些需要人工确认。
