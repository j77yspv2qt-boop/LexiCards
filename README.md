# LexiCards — 英語詞彙 / 短語 / 句式記錄軟件

單一檔案網頁應用：`index.html`（零依賴、零建置、可直接雙擊開啟）。

---

## 0. v1.4 重點

1. **每個詞都有例句**：內建 Oxford 3000/5000 全詞庫（4,937 單字 ＋ 60 片語 ＋ 40 句式）的**中文釋義、音標與例句**（涵蓋率 100%），例句中的詞彙**高亮標示**，例句中英文對照可選。
2. **Quiz 改為三選一**：可選範圍（我的記錄 / A1 / A2 / B1 / B2-C1），錯誤選項刻意挑**易混淆詞**（拼寫相近或中文義重疊）；答對綠色閃爍＋輕震，答錯紅色閃爍＋兩段輕震並顯示正解；答完出現 **`✓ Next`** 與 **`+ Add to Records`**。
3. **CEFR 等級篩選**：Discover 與 Quiz 皆可依 A1 / A2 / B1 / B2-C1 過濾，卡片、記錄、Quiz 題目都會顯示等級標籤。
4. **詞庫擴充**：額外加入 680 個高頻實用詞（四個等級各 170 個），總詞彙由 4,937 增至 5,618。
5. **記錄更安全**：每次儲存同步一份滾動備份，主資料異常時自動還原，並可在設定頁手動 `Restore from backup`；APK 升版（1.3 → 1.4）不影響既有記錄。
6. **記錄頁**：每列右側改為**紅色 ✕** 刪除鈕。

---

## 1. 開啟方式

**方法 A（最簡單）**：在 Finder 雙擊 `index.html`（會用預設瀏覽器開啟）。

**方法 B（建議）**：用本機伺服器開啟，避免部分瀏覽器對 `file://` 的 localStorage 隔離：

```bash
cd /Users/wongty99/Desktop/LexiCards
python3 -m http.server 8000
# 然後瀏覽器開 http://localhost:8000/
```

> 手機測試：與電腦同一個 Wi-Fi，開 `http://<你的電腦IP>:8000/`。

---

## 2. 頁面與操作

### 主頁 1：Dictionary（字典頁）

| 副頁 | 內容 |
|---|---|
| **Discover** | 內建詞庫 **4,937 單字 ＋ 60 片語 ＋ 40 句式 ＋ 680 條擴充詞（依 CEFR 分級）**，隨機洗牌輪播；每張卡片自帶**中文詞義、音標與例句**（內建表，離線可用），API 可再補英文解釋與例句翻譯 |
| **My Cards** | 已記錄的詞彙 / 短語 / 句式，同樣以卡片隨機輪播 |

上方工具列：`All levels & kinds` 篩選（**A1 / A2 / B1 / B2-C1** 等級、片語、句式）、`Shuffle`（重新洗牌）、`My list`（貼上自己的詞表，一行一個）。


**手勢**
- **左右撥動** → 切換下一張卡片（3 層卡片堆疊視覺）
- **長按 450ms** → 頁面下方滑出「加入記錄」面板，卡片變成可拖曳
- **拖到面板上** → 面板變**紅色**並放大，卡片出現紅框，手機震動提示
- **鬆手** → 加入 Revision → Records，顯示 `Saved to Revision`
- 放開在面板外 / 系統中斷 → 全部復位，不寫入
- 點卡片內文的 `Retry` → 重新抓該詞的詞義
- 桌機快捷鍵：`←` / `→` 換卡、`S` 儲存、`R` 洗牌、`Esc` 關閉面板

### 主頁 2：Revision

| 副頁 | 內容 |
|---|---|
| **Records** | 記錄列表：搜尋、排序（Newest / A to Z / Most missed / Most reviewed）、顯示 CEFR 等級與複習統計。點一筆可編輯，**紅色 ✕** 可刪除（有確認框）。右上 `⋯` 可開啟資料與設定 |
| **Quiz** | **三選一選擇題**：上方可選範圍（**我的記錄 / A1 / A2 / B1 / B2-C1**）。選項包含 1 個正解 ＋ 2 個「易混淆」干擾項（拼寫相近或中文義重疊）。答對→**綠色閃爍＋輕震**、答錯→**紅色閃爍＋兩段輕震**並標出正解與完整詞義；之後顯示 **`✓ Next`** 與 **`+ Add to Records`**（兩種結果都能收詞）。桌機可用 `1` `2` `3` 選項、`Enter` 下一題 |


- **右下角圓形 `+` 按鈕**（只在 Records 副頁出現）→ 新增詞語 / 短語 / 句式 ＋ 輸入詞義。輸入 Term 後會自動抓 API 預填（也可按 `Fetch meaning`）；抓不到就自己打。
- 中文義項可用 `/` 分隔多個，例如 `有韌性的 / 適應力強的` → 兩個義項，Quiz 答中任何一個都算對。

---

## 3. 詞義來源（Pipeline）

| 步驟 | 來源 | 說明 |
|---|---|---|
| 英文解釋 | **Free Dictionary API**（`api.dictionaryapi.dev`） | 主來源，只支援單字 |
| ↳ 備援 1 | **Wiktionary REST**（`en.wiktionary.org/api/rest_v1`） | 主來源失敗時自動接手，會清除 HTML 標籤 |
| ↳ 備援 2 | **Datamuse**（`api.datamuse.com`） | 再失敗才用 |
| 繁中詞義 | **MyMemory**（`api.mymemory.translated.net`，`langpair=en\|zh-TW`） | 詞彙本身 ＋ 第一條英文定義各翻一次，得到雙語對照 |
| 全部失敗 | — | 卡片顯示 `Definition unavailable` ＋ `Retry`，仍可存下並自行輸入 |

- 結果會**快取在瀏覽器**：成功快取 30 天，失敗只快取 5 分鐘（方便重試）。已快取的詞**不再打網路**。
- 片語 / 句式不被字典 API 支援，因此只會有繁中機翻；卡片會提示可自行補英文解釋。
- **你手動編輯過的釋義不會被 API 覆蓋**。

### ⚠️ 實測注意（2026-09-28）
- `api.dictionaryapi.dev` 目前從此網路**連不上**（`HTTP 522` / timeout，重試多次皆失敗）→ 應用會自動改用 Wiktionary（畫面上來源標籤會顯示 `Wiktionary`），功能不受影響。
- MyMemory 匿名使用有**每日額度**；額度用完會提示 `Translation limit reached`，此時請手動輸入詞義（已抓過的詞不受影響）。

---

## 4. 資料儲存

全部存在瀏覽器 `localStorage`：

| Key | 內容 |
|---|---|
| `lexi.records.v1` | 你的記錄（詞、類型、繁中義項、英文解釋、音標、標籤、複習統計） |
| `lexi.records.bak.v1` | **記錄的滾動備份**（每次儲存後 0.7 秒內同步一份；主檔讀不到時會自動還原） |
| `lexi.cache.v1` | 詞義快取 |
| `lexi.settings.v1` | 設定（震動回饋、Quiz 干擾項難度、定義語言） |
| `lexi.custom.v1` | 自訂詞表 |

`⋯` → **Data & settings**：可切換上述設定、`Export JSON` 匯出備份、`Import JSON` 匯入合併、`Restore from backup` 從滾動備份還原、清除快取、刪除全部記錄。**建議定期匯出備份。**

**記錄不會因升級而消失**：APK 使用同一套簽章與套件名，覆蓋安裝只更新 WebView assets，`localStorage` 全數保留；再加 `records.bak` 備份與自動還原，即使主資料被清空也能一鍵救回（刪除全部記錄時備份也會保留）。


---

## 5. 開發（可選）

`index.html` 是由 `build/` 內的零件合併而成，方便日後修改：

```bash
cd /Users/wongty99/Desktop/LexiCards/build
python3 build.py      # 合併零件 → ../index.html，並自動檢查：JS 語法、HTML id 對照、重複宣告
python3 smoke.py      # 用 headless Chromium 跑完整功能測試（手勢、拖放、Quiz、API fallback），輸出截圖
python3 shots.py      # 產生 Records / Quiz 畫面截圖（/tmp/shot-*.png）
python3 make_data.py  # 重新產生內建詞彙表 data_*.js（需先備妥 /tmp/lcdata 原始資料，見下方）
```

| 零件 | 內容 |
|---|---|
| `head.html` / `body.html` | HTML 骨架與標記 |
| `style1.css` / `style2.css` | 樣式（藍白主題 tokens、卡片、拖放面板、底部彈層、Quiz 選項） |
| `core.js` / `core2.js` | 工具函式、localStorage、記錄 CRUD ＋ 滾動備份、繁簡對照 |
| `data_cefr.js` / `data_gloss.js` / `data_examples.js` / `data_extra.js` | **內建詞彙表**（CEFR 分級 / 中文釋義 / 例句 / 擴充詞，由 `make_data.py` 產生） |
| `offline.js` | 讀取上述表、CEFR 等級池、易混淆干擾項挑選 |
| `seed.js` / `seed2.js` | 內建詞庫與洗牌牌堆 |
| `api.js` / `api2.js` | 四個 API 與 `getMeaning()` 快取 / fallback 流程（結果會補上內建表缺的欄位） |
| `cards.js` / `cards2.js` | 卡片渲染與詞義注入（含例句詞彙高亮） |
| `gesture.js` / `gesture2.js` | 撥動 / 長按拖放手勢引擎與存檔 |
| `dict.js` / `records.js` / `entry.js` / `data.js` / `quiz.js` / `quiz2.js` / `nav.js` / `init.js` | 各頁控制器 |

### 內建詞彙表資料管線

`make_data.py` 讀取 `/tmp/lcdata/` 底下的原始資料，產生四個 `data_*.js`（`build.py` 會自動合併；缺檔時可退回純線上查詢）：

| 原始檔 | 來源 | 用途 |
|---|---|---|
| `oxford_full.json` | Oxford 3000/5000 條目（字、CEFR 等級、音標、例句） | CEFR 分級、音標、備用例句 |
| `kolia_package.txt` | A1-B2 分級字表 | CEFR 補完（衝突取較低級） |
| `ecdict.csv` | ECDICT 英漢詞典（繁/簡釋義、詞性、考試標籤、詞頻） | 中文釋義、音標、分級、擴充詞挑選 |
| `eng_sentences.tsv.bz2` | Tatoeba 英文例句 | 自然的例句來源 |

涵蓋率報告寫在 `/tmp/lcdata/DATA_REPORT.md`（詞彙 4,937 筆：中文釋義 4,937/4,937、例句 4,937/4,937；片語 ＋ 句式 100 筆：釋義 100/100、例句 100/100）。


**只要改 `index.html` 也可以**（它就是完整可跑的單檔）；`build/` 只是為了並行開發與自動驗證而保留。

---

## 6. 已知限制

1. 片語 / 句式的英文解釋只能靠英文關鍵詞比對或自行輸入（免費字典 API 不支援多字詞）。
2. 機翻（MyMemory）品質不穩，專業用法請自行修正；修正後不會被覆蓋。
3. 記錄存在瀏覽器；清除網站資料會一併清掉（但有 `records.bak` 滾動備份可還原），仍建議定期 Export。
4. Quiz 沒有間隔重複演算法，只有「錯得多 / 久沒複習」加權。
5. 範圍 Quiz 至少需要該等級內有三個不同釋義才能出題，否則該範圍會顯示提示。
6. 內建例句取自 Tatoeba 語料庫，屬於自然但非教材級句子；少數罕見詞用手寫例句補足。


---

## 7. Android APK 安裝檔

本應用已打包成原生 Android APK（約 820 KB，超輕量零額外依賴；v1.4 起內建詞彙表佔約 600 KB）：
- **APK 路徑**：`/Users/wongty99/Desktop/LexiCards/LexiCards.apk`
- **版本**：`1.4`（versionCode 3，minSdk 24 / targetSdk 35）
- **圖示**：已套用專屬卡片藍色圖示，包含 Adaptive Icon、Round Icon、Legacy Icon 以及 Splash 啟動畫面。
- **覆蓋安裝**：簽章與套件名不變，直接安裝即可升級；WebView assets 會更新，**`localStorage` 內的記錄完整保留**。
- **重新打包**：如日後修改了網頁內容，直接執行：
  ```bash
  cd /Users/wongty99/Desktop/LexiCards/android
  python3 build_apk.py
  ```
  該腳本會自動將最新 `index.html` 同步進 assets，編譯資源、dex 並重新簽署成 `LexiCards.apk`。

### 詞義生成加速優化說明
1. **並行請求架構**：英文釋義（Wiktionary / Dictionary API）與中文翻譯（MyMemory）同時發起請求（非以往之依序等待），等待時間縮短為兩者中較慢者（而非兩者相加）。
2. **非同步雙語註解**：卡片在獲取英文與中文釋義後立即渲染展示，例句/英文定義之中文翻譯隨後透過資料修補（Patch）即時更新，不阻塞卡片載入。
3. **預加載（Read-ahead Prefetching）**：當前卡片展示時，後續 4 張卡片的詞義會在背景預先載入快取，翻卡時直接命中快取，達成零等待刷新。
4. **失效節點跳過機制（Circuit Breaker）**：連續失敗兩次的字典來源會進入冷卻期（10分鐘內自動跳過），避免在已知失效端點上浪費逾時等待。
5. **翻譯獨立快取**：翻譯文字獨立快取，相同單字或解釋免除重複呼叫 API。
