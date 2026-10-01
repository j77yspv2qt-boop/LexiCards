# LexiCards — 英語詞彙 / 短語 / 句式學習工具

離線優先（offline-first）的單機學習 App：**一個可直接開啟的單檔網頁**，外加**原生 Android APK**。

內建 Oxford 3000/5000 完整詞庫的中文釋義、音標與例句，**沒有網路也能學**；測驗以 CEFR 程度出題，答題有干擾項、動畫與震動回饋；所有記錄只存在你自己的裝置，並且有滾動備份。

- 網頁版：`index.html`（零依賴、零建置，雙擊即用）
- Android 版：Releases 頁的 `LexiCards.apk`（v2.0，約 1.4 MB）

---

## 1. 快速開始

### 1.1 網頁版

**方法 A（最簡單）**：在 Finder 雙擊 `index.html`，會用預設瀏覽器開啟。

**方法 B（建議）**：用本機伺服器開啟，避免部分瀏覽器對 `file://` 的 localStorage 隔離：

```bash
git clone https://github.com/j77yspv2qt-boop/LexiCards.git
cd LexiCards
python3 -m http.server 8000
# 瀏覽器開 http://localhost:8000/
```

> 手機測試：與電腦同一個 Wi-Fi，開 `http://<你的電腦IP>:8000/`。

### 1.2 Android 版

1. 到 [Releases](https://github.com/j77yspv2qt-boop/LexiCards/releases) 下載 `LexiCards.apk`。
2. 首次安裝時系統會要求允許「安裝未知來源的應用程式」，同意即可。
3. 需求：Android 7.0（API 24）以上；不需要網路權限以外的任何權限。

---

## 2. 功能說明

App 共**四個頁面**，由左至右依序為 **Discover → My Cards → Records → Quiz**。
在畫面上**左右滑動**即可換頁，底部導覽列（每頁一顆圖示）也可以直接點擊跳頁。
每個頁面標題旁都有對應的圖示：字典書本、卡片、清單、問號。

> 舊版的 **Dictionary / Revision** 兩層切換已改為上述四頁的單層滑動；
> `state.view` / `dictSub` / `revSub` 仍在內部保留，程式其他部分無需改動。

| 頁面 | 內容 |
|---|---|
| **Discover** | 內建詞庫隨機洗牌輪播（5,717 筆，見第 3 節） |
| **My Cards** | 你已記錄的詞彙 / 短語 / 句式，同樣以卡片輪播 |
| **Records** | 全部已儲存詞彙的清單，可搜尋、排序、編輯、刪除 |
| **Quiz** | 三選一測驗，可選範圍並統計正確率 |

### 2.1 Dictionary（字典頁）

兩個副頁：

| 副頁 | 內容 |
|---|---|
| **Discover** | 內建詞庫隨機洗牌輪播（5,717 筆，見第 3 節） |
| **My Cards** | 你已記錄的詞彙 / 短語 / 句式，同樣以卡片輪播 |

工具列：

- **等級與種類篩選**：`All levels & kinds` / `A1` / `A2` / `B1` / `B2–C1` / `Phrases` / `Patterns`
- **Shuffle**：保留目前篩選並重新洗牌
- **My list**：貼上自己的詞表（一行一個），會加在 Discover 最前面
- **搜尋框**：輸入任何單字、片語或中文詞義後按 `Enter`，該詞立刻插到卡片堆最上層

### 2.2 卡片內容

一張卡片由上到下包含：

- **詞彙**大字、**類型標籤**（Word / Phrase / Pattern）、**CEFR 等級標籤**（A1…C1）
- **音標**：內建表中有可靠來源時顯示（5,717 筆中有 3,775 筆）
- **發音鈕**：Web Speech API 發音，Android 版走原生 TTS
- **中文釋義（Definition in Chinese）**：上線時顯示翻譯後的完整定義；離線或翻譯失敗時退回內建詞義
- **英文解釋**：Free Dictionary API → Wiktionary → Datamuse 依序備援
- **例句（Example Sentence）**：內建語料挑選，**英文與中文例句裡的詞彙都會高亮**（中文譯文在非同步補上後同樣會標出對應的詞）；內建表查不到、或你自行搜尋的字，會另外向線上來源補抓一句
- **來源標籤**：`Dictionary API` / `Wiktionary` / `Datamuse` / `Translation only` / `Built-in list` / `Manual`
- **狀態標籤**：`Saved`（剛存檔）、`My list`（自訂詞表）、`Record`（已記錄）
- **失敗時**：若該詞連內建表都沒有，卡片會顯示 `Retry` 按鈕與失敗原因

### 2.3 手勢與快捷鍵

| 操作 | 行為 |
|---|---|
| 在頁面背景左右滑動 | 換頁：Discover → My Cards → Records → Quiz（拖曳超過 18% 寬度、或快速輕掃即換頁，否則彈回） |
| 點底部導覽列 | 直接跳到該頁 |
| 在卡片上左右撥動 | 切換上一張 / 下一張卡片（3 層卡片堆疊視覺） |
| 長按卡片 450ms | 頁面下方滑出「加入記錄」面板，卡片變成可拖曳 |
| 拖到面板上 | 面板變紅色並放大，出現紅框與震動提示 |
| 在面板上鬆手 | 存入 Records，顯示 `Saved` |
| 在面板外鬆手 / 手勢被系統中斷 | 全部復位，**不會寫入** |
| 點面板（滑鼠／鍵盤使用者） | 等同鬆手，直接存入 |
| 點卡片內文的 `Retry` | 重新抓取該詞的詞義 |
| Android 返回鍵 | 依序退回上一頁；在第一頁才交還系統（離開 App） |
| 桌機快捷鍵 | `←` / `→` 換卡、`S` 儲存、`R` 洗牌、`PageUp` / `PageDown` 換頁、`Esc` 關閉面板 |

> 換頁的滑動在每一頁的內容區都生效（包含 Records 清單與 Quiz 選項區），
> 只有卡片、晶片、按鈕與輸入框會自行處理手勢；直向滑動仍然是清單與例句的捲動。

### 2.4 Revision → Records（記錄）

- **搜尋**：可比對詞彙、中文釋義、英文解釋、標籤、筆記
- **排序**：`Newest` / `A to Z` / `Most missed` / `Most reviewed`
- **每列顯示**：詞、類型、CEFR 等級、中文釋義（可多義項）、英文解釋、複習次數、日期、正確 / 錯誤次數
- **點一列** → 編輯面板：詞、類型、中文釋義（多義項以 `/` 分隔）、英文解釋、音標、筆記、標籤；`Fetch meaning` 可自動抓取預填
- **紅色 ✕** 刪除（附確認框；滾動備份仍保留，可事後還原）
- **右下 `+`**：手動新增詞語 / 片語 / 句式
- **右上 `⋯`**：開啟 Data & settings

### 2.5 Revision → Quiz（三選一測驗）

**範圍選擇**：`My saved words`（你的記錄）／`A1` / `A2` / `B1` / `B2–C1`，右側即時顯示該範圍的詞數。

**出題方式**：一題一個詞，三個中文選項——1 個正解 ＋ 2 個**易混淆干擾項**。干擾項是刻意挑的：

- 拼寫接近（編輯距離 1–3 內，例如 `adopt` / `adapt`）
- 共用前綴、首字母或字尾
- 中文釋義用字重疊（意思接近的近義詞）
- 從**同一個 CEFR 等級**的詞庫中挑選，不會拿超綱詞來誤導

（在 Data & settings 關掉 `Tricky Quiz options` 即改為純隨機選項。）

**答題回饋**：

| 結果 | 畫面 | 震動 |
|---|---|---|
| 答對 | 選項變綠並放大、題目區**綠色閃爍** | 單次輕震 |
| 答錯 | 選項變紅、正解標綠、題目區**紅色閃爍**並抖動，並展開完整釋義與例句 | 兩段輕震 |

**答完後**：`✓ Next`（下一題）、`+ Add to Records`（答對答錯都能把這個詞收進記錄）、`Skip`、`Reset round`。

**統計**：Round（題數）、Correct、Missed、Streak（連對）、Accuracy；下方列出「本回合答錯」清單。

**出題偏好**：錯得多、久沒複習的詞權重較高；短期內不會重複出同一個詞（記住最近 12 題）。

**桌機快捷鍵**：`1` `2` `3` 選項、`Enter` 或 `空白鍵` 下一題。

### 2.6 Data & settings（資料與設定）

| 項目 | 說明 |
|---|---|
| `Vibration feedback` | 答對 / 答錯 / 收藏時的震動開關 |
| `Tricky Quiz options` | 是否使用易混淆詞作為干擾項 |
| `Storage` | 記錄數、已快取的詞義與翻譯數、占用大小、是否可持久保存 |
| `Records backup` | 最近一次滾動備份的時間與筆數 |
| `Export JSON` | 匯出全部資料備份 |
| `Import JSON` | 匯入並與現有記錄合併 |
| `Restore from backup` | 從滾動備份救回遺漏的記錄 |
| `Clear meaning cache` | 清除詞義與翻譯快取（不影響記錄） |
| `Delete all records` | 清空全部記錄（**備份仍保留**，可再還原） |

### 2.7 App info（應用資訊）

- 目前版本（Android 版直接讀取 APK 的 `versionName`）
- **Definition in Chinese**：繁體 / 簡體切換，卡片、Quiz 選項與例句譯文都會即時跟著切換
- **App skin**：外觀選擇器（見第 2.8 節）
- **User guide**：使用說明按鈕，開啟後可切換**繁體中文 / 简体中文**（見第 2.9 節）
- **Updates**：見第 5.2 節「App 內更新檢查」

### 2.8 App skin（外觀）

v1.9 內建**兩款外觀**，在 **App info → App skin** 切換，選擇會記在 `settings.skin`：

| skin | 樣子 | 說明 |
|---|---|---|
| **Classic** | 經典藍 | 從 1.0 到現在的樣子，預設值 |
| **Gothic** | 灰底 + 黑白銀 | 頁面底色是**灰色** `#3A3A3A`，卡片、面板、底部抽屜都是近黑色 `#1B1B1B` 的**獨立色塊**，因此各板塊之間一眼分得開；卡片**不投影，改成四周泛光**。文字與線條走銀灰階，只有 App bar 右上那把劍保留原本的紅色作為點綴 |

Gothic 另外換掉了這些（規則見下表 `icons` / `wordmarkImage` / `appbarImage` / `appIcon`）：
四個頁面標題圖示、底部頁籤圖示、最上方的 App 名稱、App bar 右上的裝飾圖，以及 App 圖示
（網頁 favicon 與 **Android 桌面圖示**都會換）。哪裡出現該圖示就換哪裡，
頁面標題與底部頁籤是同一組圖示，兩處都換。

一個 skin 是一份設定表（`build/skin.js` 的 `SKINS`），可以控制：

| 欄位 | 作用 |
|---|---|
| `vars` | 覆寫 CSS 自訂-properties：主色、強調色、底色、卡片色、文字色、圓角、陰影、highlight 色、頁籤列配色⋯（可用變數見 `SKIN_VARS`） |
| `icons` | 四個頁面標題與底部頁籤的圖示（`discover` / `mine` / `records` / `quiz`），未列出的沿用內建圖示 |
| `wordmark` / `wordmarkImage` | App 最上方「LexiCards」的字體（`--brand-font` 等）或直接換成圖片 |
| `appbarImage` | App bar 右側那塊空白（見你的截圖）的圖片 |
| `themeColor` / `androidStatus` / `androidNav` | 瀏覽器、Android 狀態列與導覽列的顏色 |
| `appIcon` | App 圖示（網頁 favicon） |

選擇會記在 `settings.skin`，重開 App 仍生效；切換時會先清除上一個 skin 的
所有覆寫，**不會互相殘留**。

Gothic 的圖像素材放在 `build/skins/gothic/`（原始檔 `source/`、處理後 `out/`），
`make.py` 會把黑背景抠成透明、縮成 App 需要的尺寸，並輸出 `build/skin_gothic.js`
（base64 data URI）與 Android 的桌面圖示／啟動圖資源；**改圖請改 source 再重跑腳本**。

> **Android 桌面圖示**：已裝好的 App 不能就地改桌面圖示，所以 manifest 裡放了兩個
> launcher `activity-alias`（`LauncherClassic` 預設啟用、`LauncherGothic` 預設停用），
> 切換 skin 時由 `LexiNative.setLauncherIcon()` 用 `PackageManager` 啟用其中一個、
> 停用另一個（`DONT_KILL_APP`，App 不會被關掉）；狀態列與導覽列則由
> `LexiNative.setSystemBars()` 一起換色。兩者都對 classic 也會執行，所以切回去也會復原。

### 2.9 User guide（使用說明）

**App info → User guide → Open the guide** 會彈出完整說明書，涵蓋十一個主題：
四個頁面、Discover 的看卡與發音、存檔手勢、Records 管理、Quiz、中文繁簡、
外觀、資料與備份、更新、Android 與桌機操作、以及幾個小提示。

說明書自己有語言切換（**繁體中文 / 简体中文**），跟「Definition in Chinese」是**兩個獨立設定**：
你可以讓卡片用繁體、說明書看簡體。內文寫在 `build/guide.js`，只寫一份繁體，
切到簡體時用 App 內同一張繁簡對照表即時轉換，所以說明書與卡片不會對同一個字有不同結果。

---

## 3. 內建詞庫與離線資料

### 3.1 組成

| 類型 | 筆數 | 來源 |
|---|---|---|
| 單字（Oxford 3000/5000） | 4,937 | Oxford 學習者辭典分級 |
| 擴充單字 | 680 | 依詞頻與考試標籤挑選的高頻實用詞（四個等級各 170 個） |
| 片語 | 60 | 常用慣用語 |
| 句式 | 40 | 常用句型（`the more ..., the more ...` 這類） |
| **合計** | **5,717** | |

### 3.2 CEFR 程度分布

| 等級 | 筆數 | Discover / Quiz 篩選 |
|---|---|---|
| A1 | 1,036 | `A1` |
| A2 | 955 | `A2` |
| B1 | 862 | `B1` |
| B2 | 1,492 | `B2–C1`（與 C1 合併為「上階」範圍） |
| C1 | 1,265 | 同上 |
| 無標定 | 7 | 依原本分級歸入，僅在 `All` 中出現 |

分級衝突時一律取**較低**等級，避免把已掌握的詞藏起來。

### 3.3 涵蓋率（內建表）

| 項目 | 涵蓋率 |
|---|---|
| 單字的中文釋義 | 4,937 / 4,937（100%） |
| 單字的例句 | 4,937 / 4,937（100%） |
| 片語 + 句式的中文釋義 | 100 / 100（100%） |
| 片語 + 句式的例句 | 100 / 100（100%） |
| 音標 | 3,775 / 5,717（可信來源才收錄，絕不臆造） |

### 3.4 例句是怎麼挑的

- 句子必須**包含該詞**（單詞還要求是完整單字邊界，避免 `an` 命中 `and`）
- 4–14 個詞、只用常見標點、結尾有句號／驚嘆號／問號
- 越接近 8 個詞越優先；詞不在句首優先；同一句最多服務 3 個詞（避免整頁都在重複同一句）
- 句式（內含 `...`）以**片段比對**找例句，顯示時分段高亮
- 語料庫與字典都找不到的少數罕見詞（12 個）改用手寫例句

### 3.5 線上查詢（可選，離線不影響）

內建表已經能讓 App 完整運作；連上網路時再「加料」補上更完整的內容：

| 步驟 | 來源 | 說明 |
|---|---|---|
| 英文定義 | **Free Dictionary API** | 主來源，只支援單字 |
| ↳ 備援 1 | **Wiktionary REST** | 主來源失敗時自動接手，並清除 HTML 標籤 |
| ↳ 備援 2 | **Datamuse** | 再失敗才用 |
| 中文詞義 / 定義翻譯 | **MyMemory** → **Google 翻譯** | 詞彙本身與第一條英文定義各翻一次，得到雙語對照 |
| 例句中文翻譯 | 同上 | 非同步補上，不阻塞卡片顯示 |
| 缺例句時的補抓 | **Free Dictionary API** → **Wiktionary REST** → **Wiktionary 原始碼** | 內建表查不到、又沒搜過的詞（例如自行輸入的字）才會走這條鏈；Wiktionary 原始碼裡的 `#:` 用例行連片語都查得到 |

工程細節：

- **並行請求**：英文與中文同時送出，等待時間是較慢的那一個，不是兩者相加
- **非同步補丁**：卡片先顯示，再把翻譯結果貼回去
- **預加載**：顯示當前卡片時，背景預載後續 4 張卡片的詞義，翻卡零等待
- **失效節點跳過**：連續失敗兩次的來源進入 10 分鐘冷卻，不再浪費逾時等待
- **雙層快取**：成功結果 30 天、失敗結果 5 分鐘；翻譯另有獨立快取並定期修剪
- **手動編輯優先**：你自己輸入或修改的釋義永遠不會被 API 覆蓋

---

## 4. 資料儲存與安全

全部資料存在瀏覽器 `localStorage`，不上傳任何伺服器：

| Key | 內容 |
|---|---|
| `lexi.records.v1` | 你的記錄（詞、類型、中文義項、英文解釋、音標、標籤、複習統計） |
| `lexi.records.bak.v1` | **記錄的滾動備份**（每次儲存後 0.7 秒內同步；空內容不會覆蓋） |
| `lexi.cache.v1` | 詞義快取 |
| `lexi.settings.v1` | 設定（震動、Quiz 干擾項、定義語言、Quiz 範圍） |
| `lexi.custom.v1` | 自訂詞表 |

**三層保護**：

1. 每次改動記錄都會同步一份備份。
2. 啟動時若主資料讀不到或是空的，會自動從備份還原並提示。
3. 設定頁可隨時 `Restore from backup` 手動合併回來（即使「刪除全部記錄」也保留備份）。

**升版不會清空記錄**：APK 使用同一套簽章與套件名，覆蓋安裝只替換 WebView 內的 `index.html`，`localStorage` 原封不動。

建議仍然定期用 `Export JSON` 備一份到自己的雲端。

---

## 5. Android APK

- **版本**：1.6（versionCode 5，minSdk 24 / targetSdk 35），約 820 KB，零額外依賴
- **權限**：僅 `INTERNET`、`ACCESS_NETWORK_STATE`、`VIBRATE`
- **安裝**：從 Releases 下載 APK → 允許安裝未知來源 → 完成
- **升級**：直接安裝新版本即可覆蓋，記錄保留（見第 4 節）
- **重新打包**：

```bash
cd android
python3 build_apk.py
```

腳本會自動把最新的 `index.html` 同步進 `assets/`、編譯資源與 dex、對齊並重新簽署成根目錄的 `LexiCards.apk`（簽章金鑰 `android/debug.keystore` 為本機檔案，已排除在 git 之外；首次建置時若不存在會自動產生）。

### 5.2 App 內更新檢查

App info 面板多了一個 **Updates** 區塊：

| 動作 | 行為 |
|---|---|
| 打開 App info | 自動向 GitHub 查一次最新 Release（結果快取 6 小時，之後再打開不重複查） |
| `Check for updates` | 手動重查；有新版會顯示版本號與前三行 Release 說明 |
| `Download vX.Y` | 開啟該 Release 的 `LexiCards.apk` 下載網址：Android 版交給系統瀏覽器下載，網頁版開新分頁 |
| `Releases page` | 直接開 GitHub Releases 頁（查不到時的備援） |

查詢來源依序為：

1. `https://api.github.com/repos/j77yspv2qt-boop/LexiCards/releases/latest` — 取 tag、說明與 APK 資產網址
2. `version.json`（repo 根目錄，走 `raw.githubusercontent.com`）— API 被擋或限流時的備援

兩個端點都回傳 `Access-Control-Allow-Origin: *`，瀏覽器與 WebView 都能直接讀；版本比較是逐段數字比較（`1.10 > 1.9`）。比較的是**正在執行的版本**（Android 版讀 APK 的 `versionName`），所以裝完新版本後同一個面板會自動變成 `Up to date`。

啟動時不會主動連線；只有你打開 App info 或按按鈕時才查。

### 5.3 發版流程

版本規則：**每次發佈 +0.1**（1.4 → 1.6），`versionCode` 同步 +1。

```bash
# 1. 改三處版本號
#    build/core.js            APP_VERSION = '1.7'
#    android/AndroidManifest.xml   versionName 1.7 / versionCode 6
#    version.json             "version": "1.7"
# 2. 重建並驗證
cd build && python3 build.py && python3 smoke.py && cd ..
cd android && python3 build_apk.py && cd ..
# 3. 提交、推送並發佈（tag 名即 App 顯示的版本）
git add -A && git commit -m "LexiCards v1.7" && git push
gh release create v1.7 LexiCards.apk --title "LexiCards v1.7" --notes "..."
```

Release 的資產檔名固定為 `LexiCards.apk`，App 的更新檢查就是抓這個資產。

---

## 6. 開發

`index.html` 是由 `build/` 內的零件合併而成，方便並行修改與自動驗證。

### 6.1 常用指令

```bash
cd build
python3 build.py      # 合併零件 → ../index.html，並檢查 JS 語法、HTML id 對照、重複宣告
python3 smoke.py      # headless Chromium 跑 224 項功能測試（手勢、拖放、Quiz、API fallback、外觀），輸出截圖
python3 shots.py      # 產生 Records / Quiz 畫面截圖（/tmp/shot-*.png）
python3 make_data.py  # 重新產生內建詞彙表 data_*.js（需備妥原始資料，見 6.3）
```

> `build.py` 產生的 `index.html` 就是完整可跑的單檔；只想改網頁的話直接編輯它也可以。

### 6.2 檔案結構

| 路徑 | 內容 |
|---|---|
| `index.html` | 合併後的單檔應用（可直接執行） |
| `build/head.html`、`build/body.html` | HTML 骨架與標記 |
| `build/style1.css`、`build/style2.css` | 樣式（主題 tokens、卡片、拖放面板、Quiz 選項、動畫） |
| `build/core.js`、`build/core2.js` | 工具函式、localStorage、記錄 CRUD ＋ 滾動備份、繁簡對照表（以 code point 建表，見第 9 節） |
| `build/data_cefr.js`、`data_gloss.js`、`data_examples.js`、`data_extra.js` | **內建詞彙表**（由 `make_data.py` 產生） |
| `build/offline.js` | 讀取詞彙表、等級池、易混淆干擾項挑選 |
| `build/seed.js`、`build/seed2.js` | 內建詞庫與洗牌牌堆 |
| `build/api.js`、`build/api2.js` | 線上查詢與快取 / fallback 流程（結果會補上內建表缺的欄位）、例句補丁 |
| `build/cards.js`、`build/cards2.js` | 卡片渲染、詞義注入、例句詞彙高亮（英文連詞形變、中文連共用片段） |
| `build/gesture.js`、`build/gesture2.js` | 撥動 / 長按拖放手勢引擎與存檔 |
| `build/dict.js` | 字典頁（Discover / My Cards、篩選、洗牌、即時查詢） |
| `build/records.js` | 記錄列表（搜尋、排序、編輯、紅叉刪除） |
| `build/entry.js` | 新增 / 編輯詞語面板 |
| `build/quiz.js`、`build/quiz2.js` | 測驗出題與畫面 |
| `build/data.js` | 設定、匯出 / 匯入、備份還原、App info 面板 |
| `build/guide.js` | 使用說明（繁中撰寫，即時轉簡中）與它的語言切換 |
| `build/update.js` | App 內更新檢查（GitHub Release ＋ `version.json` 備援） |
| `build/nav.js`、`build/init.js` | 頁籤導覽與啟動流程 |
| `build/skin.js`、`build/skin_gothic.js` | 外觀系統：`SKINS` 設定表、套用 / 清除、選擇器；Gothic 的圖像（base64） |
| `build/skins/gothic/` | Gothic 素材：`source/` 原圖、`out/` 成品、`make.py` 生成腳本 |
| `build/smoke*.py`／`build/smoke_*.js` | 224 項功能測試 |
| `build/shots.py` | 畫面截圖腳本 |
| `build/make_data.py` | 內建詞彙表的資料管線 |
| `version.json` | 目前版本與 APK 下載網址（更新檢查的備援來源） |
| `android/` | 原生 WebView 外殼（Java、res、圖示、打包腳本） |

### 6.3 詞彙表資料管線

`make_data.py` 讀取原始資料（預設放在 `.lcdata/`，可用環境變數 `LC_DATA_DIR` 改位置；此資料夾已在 `.gitignore` 中），產生四個 `data_*.js`：

| 原始檔 | 來源 | 用途 |
|---|---|---|
| `oxford_full.json` | Oxford 學習者辭典條目（詞、CEFR 等級、IPA、例句） | 分級、音標、備用例句 |
| `kolia_package.txt` | A1–B2 分級字表 | 分級補完（衝突取較低級） |
| `ecdict.csv` | ECDICT 英漢詞典（釋義、詞性、考試標籤、詞頻） | 中文釋義、音標、分級、擴充詞挑選 |
| `eng_sentences.tsv.bz2` | Tatoeba 英文例句 | 自然例句來源 |

```bash
pip install opencc-python-reimplemented   # 簡→繁轉換（缺了也能跑，只是不做轉換）
python3 build/make_data.py                # 約 2–3 分鐘
```

產出的涵蓋率報告會寫在 `.lcdata/DATA_REPORT.md`（詞彙釋義 4,937/4,937、例句 4,937/4,937；片語與句式 100/100；擴充詞四等級各 170 個）。

---

## 7. 已知限制

1. 片語 / 句式沒有英文定義（免費字典 API 不支援多字詞），只會有中文釋義與例句。
2. 機翻（MyMemory / Google）品質不穩，專業用法建議自行修正；修正後不會被覆蓋。
3. 記錄存在瀏覽器，清除網站資料會一併清掉（但有滾動備份可還原），仍建議定期 `Export JSON`。
4. Quiz 沒有間隔重複演算法，只有「錯得多 / 久沒複習」加權。
5. 範圍測驗至少要有三個不同釋義才能出題，否則該範圍會顯示提示。
6. 內建例句取自 Tatoeba 語料，自然但非教材句；少數罕見詞以手寫例句補足。
7. CEFR 分級以 Oxford／字表為準，與其他機構的分級可能略有出入。
8. 更新檢查需要連得到 GitHub；離線時 App info 會顯示無法連線，可改按 `Releases page` 手動確認。

---

## 8. 資料來源與授權

內建詞彙表由下列公開資料彙整而成：

| 資料 | 用途 | 說明 |
|---|---|---|
| Oxford 3000/5000 學習者辭典 | CEFR 分級、IPA、例句 | 詞條資料版權屬出版方，商業散布前請先確認授權 |
| ECDICT（`skywind3000/ECDICT`） | 英文／繁中釋義、詞性、考試標籤、詞頻 | MIT |
| Tatoeba 英文句子 | 例句來源 | CC BY 2.0 FR，引用時需保留出處與授權 |

程式碼部分尚未加入 LICENSE 檔案；如需再利用或散布整個專案，請自行選定並加入合適的授權條款。

---

## 9. 中國大陸使用說明

核心功能（查詞、內建詞庫、例句與高亮、CEFR 篩選、三選一測驗、記錄與備份）**完全離線可用**，不依賴任何境外服務。下面只說明「需要網路」的部分。

### 9.1 需要網路的服務與內地狀況

| 服務 | 內地狀況 | App 的處理 |
|---|---|---|
| Google 翻譯 `translate.googleapis.com` | 被封 | **並行競速**：第一個引擎安靜 350ms 就同時啟動下一個，先回者勝，不會等 4.5 秒逾時；失敗兩次後該來源被冷卻 10 分鐘，之後完全不再嘗試 |
| 維基百科 `en.wiktionary.org` | 被封 | 英文定義自動改走 Free Dictionary API → Datamuse |
| GitHub API `api.github.com` | 通常被封 | 更新檢查改走 jsDelivr 的三組 CDN（cdn / fastly / gcore） |
| `raw.githubusercontent.com` | 被封 | 同上 |
| Free Dictionary API、Datamuse | 一般可用（跨境可能偏慢） | 超時 4.5 秒自動切換來源；連續失敗兩次會冷卻 10 分鐘 |
| MyMemory 翻譯 | 可用（有每日額度） | Google 掛掉後的主要翻譯來源 |
| 有道 `dict.youdao.com` 發音 | 可用（境內服務） | 發音的預設來源 |

**最壞情況**（以上翻譯來源全部不可用）：卡片仍顯示**內建釋義與例句**（涵蓋率 100%），只少顯示英文定義與例句中文翻譯，不影響任何功能。

### 9.2 檢查更新

設定 → App info → **Check for updates**：

- 五個來源（GitHub API、jsDelivr×3、GitHub raw）**同時**發出，先回者勝 —— GitHub 被封時會自動用 jsDelivr 鏡像，不需手動干預
- 提示會標明實際來源，例如 `Up to date - v1.7 is the newest release (checked via jsDelivr (Fastly))`
- 發現新版本時會多一個 **Mirror download** 按鈕：透過 jsDelivr 直接下載版本 tag 內的 `LexiCards.apk`（`cdn.jsdelivr.net` 內地通常可連），不必開 GitHub Releases
- 若全部來源都失敗，只會顯示一行錯誤提示，不影響任何功能

### 9.3 取得安裝檔（GitHub Releases 不穩時）

`github.com` 的 Release 下載在內地時通時斷，可改用 jsDelivr 鏡像直連（把 `v1.7` 換成要下載的 tag）：

```
https://cdn.jsdelivr.net/gh/j77yspv2qt-boop/LexiCards@v1.7/LexiCards.apk
```

也可自行放一份到 Gitee Release 或網盤；App 內的 Mirror download 按鈕指向的就是同一條鏡像路徑。

### 9.4 首次使用提示

- 第一次查詞若遇到約 4 秒的延遲，是被封來源的逾時冷啟動成本；來源失效被記錄後，之後的查詞會直接走可用來源（實測約 300–600ms）
- 若開啟後偶爾出現「reached the update servers」提示，代表當時五個更新來源都不可達，稍後再試即可


---

## 9. 修訂紀錄

### v2.0

| # | 修掉什麼 / 做了什麼 | 原因 |
|---|---|---|
| 1 | **第一個真實 skin：Gothic** | App info → App skin 可切換並存檔。**背景改成灰色**（`#3A3A3A`），卡片、面板、底部抽屜是獨立的近黑色塊，板塊之間一眼分得開；卡片**不投影、改成四周泛光**；四個頁面圖示（頁面標題與底部頁籤兩處）、App 名稱、App bar 右上那把劍、favicon 與 **Android 桌面圖示**全部換成 Gothic 素材，字標與劍都放大、劍可以突出 app bar 一點，而劍上的紅色保留下來當點綴 |
| 2 | **App 內建使用說明** | **App info → User guide** 彈出完整說明書（十一個主題：四頁、換卡與發音、存檔手勢、Records、Quiz、繁簡、外觀、備份、更新、Android 與桌機操作、小提示），並可切換 **繁體中文 / 简体中文**。說明書的語言是**獨立設定**，可以讓卡片用繁體、說明書看簡體 |
| 3 | 切換外觀不再會留下上一套的顏色 | skin 的變數原本是逐一寫在 `<html>` 的行內樣式上，靠 90 次屬性變更去失效整棵樹；改成**一條以 `data-skin` 為選擇器的樣式表規則**，換掉了就等於整條換掉，任何引擎都一次重繪完成。素材管線也改成直接讀 skin 表裡的色碼產生 Android 啟動畫面與系統列顏色，兩邊不會再各寫一份而漂移 |

> 測試：headless Chromium 功能測試由 **189 項增加到 224 項**。新增項目包含
> 外觀的灰階檢查（走訪整張 skin 表）、灰色背景與板塊對比、全 App 逐元素「零彩色」
> 掃描，以及使用說明的開啟、繁簡切換與持久化。

### v1.9

| # | 修掉什麼 / 做了什麼 | 原因 |
|---|---|---|
| 1 | **Records 與 Quiz 兩頁可以滑動換頁了** | 這兩頁的內容是一個**直向捲動容器**（`#recordsList` 與 `.quiz`）。觸控落在捲動容器上時，瀏覽器預設（`touch-action:auto`）會自行判斷這個手勢是不是捲動，於是**把水平拖曳吃掉、送出 `pointercancel`**，換頁的程式從此收不到後續事件（`pagerMove` 只跑了 1 次就結束）。容器補上 `touch-action:pan-y`——跟 `.card__scroller` 一開始就有的一樣——之後，直向捲動保留、水平拖曳交還給換頁 |
| 2 | **換頁所需的滑動幅度調低** | 原本要拖超過寬度 **28%** 才換頁，手機上像在做工。改為 **18%**，並加上**快速輕掃**：速度超過 `SWIPE_VELOCITY`（與卡片滑動手勢同一組門檻）且位移 > 24px 也能換頁，短而快的撥動不會再有「怎麼沒反應」的感覺 |
| 3 | **底部頁籤的高亮會跟著換頁移動** | 高亮原本只寫在 `:hover` 上；觸控裝置點一下之後 `:hover` 會**卡住**，高亮就留在最後被點的那個頁籤，跟畫面上的頁面對不起來。現在高亮綁在 `.is-active`（跟著選取頁跑），`:hover` 用 `@media (hover:hover)` 包住，只有真正的滑鼠才觸發 |

> 測試：headless Chromium 功能測試由 **193 項增加到 199 項**。
> 新增的 6 項分別釘住：三個頁面捲動容器的 `touch-action` 算出來必須是 `pan-y`、
> 換頁門檻必須 ≤ 0.2、從 Records 的**真實列**（而不是 pager 本身）拖曳要能換頁、
> 短促輕掃要能換頁、以及高亮必須在 `.is-active` 頁籤上並隨換頁移動。
>
> 第 1 點是**用真實觸控**重現才找到的：功能測試把合成事件直接丟在 `#pager` 上，
> 瀏覽器永遠不會取消它，所以舊測試全綠也照樣漏掉這個 bug；改用 CDP
> `Input.dispatchTouchEvent` 送出真正的觸控後，`pointercancel` 立刻現形。

### v1.8

| # | 修掉什麼 / 做了什麼 | 原因 |
|---|---|---|
| 1 | **例句中文高亮**：剩下沒 highlight 的例句現在也會標出來 | 比對時只拿**第一個**中文釋義去找，比不到就整句不標。現在會把**所有義項**都拿來比；真的完全沒有共同字時（例如 `hike` 的釋義是「徒步旅行」，但譯文寫成「明天我們要去**健行**」），再用**該詞在英文例句中的位置**推估它在中文裡的位置，取最合理的一個詞。沒有任何關聯時仍然不標，寧可不高亮也不要標錯 |
| 2 | **主選單改到下方**，並改成**左右滑動換頁** | 原本 Dictionary / Revision 在右上角，副頁還要再點一次。現在是 Discover → My Cards → Records → Quiz 四頁平鋪，滑動或點底部頁籤都能換頁 |
| 3 | **每個頁面標題旁都有圖示** | 字典書本、卡片、清單、問號；底部頁籤用同一組圖示 |
| 4 | 修掉頁面在底部頁籤列**下方漏出**、換頁時**卡片被壓成窄條**的版面問題 | 換頁改成 track 之後，track 的高度百分比沒有依據、頁面寬度又被 flex 縮走 |

> 測試：headless Chromium 功能測試由 **137 項增加到 189 項**。
> 新增項目包含滑動換頁、頁面圖示、頁籤列、版面幾何斷言、外觀切換與高亮比對；
> 其中「版面幾何」是實際量測頁面寬高與捲動範圍——純看 class 與文字的測試
> 抓不到卡片被壓扁這種問題。

### v1.7

| # | 修掉什麼 | 原因 |
|---|---|---|
| 1 | 翻譯速度 | 中國大陸常見 Google 不可連線時，例句高亮要等逾 4 秒；改為多引擎競速 + 350ms 對沖，實測降至約 360ms |
| 2 | 更新檢查 | GitHub 在大陸常被封鎖；改為 GitHub API / raw / jsDelivr 三個 CDN 同時問，先回先贏 |

### v1.6

| # | 修掉什麼 | 原因 |
|---|---|---|
| 1 | **例句高亮**：中文例句也會標出對應的詞；英文例句連詞形變一起比對（`sing` → `singing`、`adopt` → `adopted`、`study` → `studies`） | 中文譯文非同步回填時走的是純文字路徑，高亮被整段蓋掉；比對又只認完全相同的字串，譯文只要換個說法（`唱歌` → `唱這首歌`）就完全對不上 |
| 2 | **每張卡片都有例句** | 詞義快取命中時只會補中文解釋，不會補例句；早期看過的詞（例如 `ethical`）就永遠缺例句。現在命中時會用內建表補上，內建表沒有才連線抓（Free Dictionary → Wiktionary REST → Wiktionary 原始碼的用例行），你搜尋字詞後新增的卡片同樣會有例句 |
| 3 | **繁簡轉換錯字**（`權` → `杠`） | 繁簡對照表以字元對串接，但其中有 28 個非 BMP 字（`𣈶` 等）；舊程式以 UTF-16 單位每次跳 2 格，第一個非 BMP 字之後整張表錯位一格，190 組對應損壞（`權`→`杠`、`條`→`来`、`機構`→`杀枞`），內建 5,717 個詞義中有 545 個會顯示錯字。改以 code point 建表，並把舊版已寫進瀏覽器的中文修正回來（自行輸入的釋義不動） |
| 4 | **App 內更新檢查** | App info 新增 Updates 區塊，向 GitHub Release 查最新版，可直接下載新 APK（見 5.2） |

> 測試：headless Chromium 功能測試由 100 項增加到 **123 項**，第 14 節專門釘住上面四項。




