/* =====================================================================
   User guide (App info -> User guide)

   The whole guide is written once, in Traditional Chinese, and converted on
   the spot with the app's own traditional-to-simplified table when the reader
   picks 简体中文 - the same converter the card definitions use, so the guide
   and the cards can never disagree about a character.

   It lives in one sheet with a language switch of its own: the reader may
   read the guide in simplified while keeping their cards in traditional.
   ===================================================================== */
const GUIDE_TITLE = { traditional: '使用說明', simplified: '使用说明' };

const GUIDE_INTRO = 'LexiCards 是一套離線優先的英文單字卡：內建 5,717 筆詞庫' +
  '（Oxford 3000/5000、片語與句式），中文釋義、音標與例句都存在你的裝置上，' +
  '沒有網路也能複習。';

const GUIDE_SECTIONS = [
  {
    h: '四個頁面',
    p: ['由左到右是 Discover → My Cards → Records → Quiz。在頁面上左右滑動即可換頁，' +
      '也可以點最下方的頁籤直接跳頁。'],
    ul: [
      'Discover：內建詞庫輪播，用來找新詞',
      'My Cards：你已儲存的詞輪播',
      'Records：全部記錄的清單，可搜尋、排序、編輯、刪除',
      'Quiz：三選一測驗'
    ]
  },
  {
    h: 'Discover：看卡片、換卡、發音',
    ul: [
      '在卡片上向右滑＝下一張，向左滑＝上一張',
      '點卡片右上角的喇叭圖示聽發音',
      '搜尋框輸入任何字詞後按 Enter，會即時查詢並做成卡片',
      '上方可篩選：All levels & kinds、各 CEFR 等級（A1～B2/C1）、Phrases、Patterns',
      'Shuffle 把內建詞庫重新洗牌；My list 可貼上自己的字表，一起加入輪播'
    ]
  },
  {
    h: '把卡片存進 Records',
    p: ['這是整個 App 最重要的手勢：'],
    ul: [
      '按住卡片底部的橫線把手往下拖',
      '下方會浮出存檔面板，把卡片拖到面板上（面板變亮並震動一下）再鬆手',
      '拖到面板外鬆手＝取消，不會寫入任何資料',
      '用滑鼠或鍵盤時，直接點面板也有同樣效果'
    ]
  },
  {
    h: 'Records：管理你的字',
    ul: [
      '搜尋框可找字詞或中文意思；右邊可排序：Newest、A to Z、Most missed、Most reviewed、Due today',
      '點一筆記錄即可編輯中文釋義、英文解釋、音標、筆記與標籤',
      '右側紅色 ✕ 刪除該筆（會先請你確認）',
      '右下角 + 可手動新增一筆記錄',
      '右上角 ⋯ 開啟 Data & settings（見下方「資料與備份」）'
    ]
  },
  {
    h: 'Quiz：三選一測驗',
    ul: [
      '上方選範圍：My saved words、Due today（今天到期）、My wrong list，或任一 CEFR 等級（會從內建詞庫出題）',
      '想讓干擾選項更難：Data & settings → Tricky Quiz options',
      '答對／答錯都有動畫與震動；答完可按 Next，或把這題 Add to Records',
      'Skip 跳過這題、Reset round 重新開始這一回合',
      '下方統計：Round、Correct、Missed、Streak、Accuracy；' +
        'Missed in this round 會列出這回合答錯的詞'
    ]
  },
  {
    h: '間隔重複與每日目標（v2.2）',
    p: ['Quiz 會照記憶曲線安排每個詞下次複習的時間：'],
    ul: [
      '答對＝間隔拉長（最長約半年），答錯＝明天再來；到期的詞會優先出題',
      'Records 的排序選項新增 Due today，列上出現紅色「Due today」就是今天該複習',
      'Quiz 頁頂部的圓環顯示今日答題進度，旁邊是連續天數、今天到期數與近 7 天正確率',
      '每日達到目標時會輕震一下；目標可在 Data & settings → Daily goal 調整',
      'Quiz 範圍新增 Due today 與 My wrong list：後者收集常答錯的詞，答對數超過答錯數就自動畢業',
      '不想要這套排程？Data & settings → Spaced repetition 關掉即可回到純隨機加權'
    ]
  },
  {
    h: '外觀（App skin）',
    p: ['App info → App skin 可更換整個 App 的外觀：配色、四個頁面的圖示、LexiCards 字標與 ' +
      'App 圖示會整組一起換，選擇會記住，重開 App 仍生效' +
      '（Android 版的桌面圖示、狀態列與導覽列顏色也一起換）。']
  },
  {
    h: '資料與備份',
    p: ['Records → 右上角 ⋯ 開啟 Data & settings：'],
    ul: [
      'Vibration feedback：關掉震動回饋',
      'Tricky Quiz options：用容易混淆的字當干擾選項',
      'Storage、Records backup、Lookup speed：目前佔用、備份時間、查詢速度',
      'Export JSON：把記錄匯出成檔案，建議定期做',
      'Import JSON、Restore from backup：匯入檔案或還原自動備份',
      'Clear meaning cache：清掉查詢快取，記錄不會不見',
      'Delete all records：清空所有記錄，無法復原'
    ]
  },
  {
    h: '更新',
    p: ['App info → Updates → Check for updates 會向 GitHub 查最新版本；' +
      '有新版時可用 Download update 下載 APK，或用 Mirror download 走備援線路。' +
      'Releases page 會用瀏覽器開啟發佈頁。']
  },
  {
    h: '小提示',
    ul: [
      '所有記錄與快取都只存在你自己的裝置（localStorage），不會上傳',
      '例句與中文釋義大多已內建，飛航模式也能複習；只有新查詢的字需要連線',
      '換裝置或重裝前，記得先 Export JSON 或使用備份'
    ]
  }
];

function guideLang() {
  const l = state.settings && state.settings.guideLang;
  return l === 'simplified' ? 'simplified' : 'traditional';
}

function guideHTML(lang) {
  const conv = lang === 'simplified' ? toSimp : (s => s);
  const sections = GUIDE_SECTIONS.map(sec => {
    let out = '<div class="guide__sec"><h3>' + escapeHTML(conv(sec.h)) + '</h3>';
    if (sec.p) out += sec.p.map(t => '<p>' + escapeHTML(conv(t)) + '</p>').join('');
    if (sec.ul) out += '<ul>' + sec.ul.map(t => '<li>' + escapeHTML(conv(t)) + '</li>').join('') + '</ul>';
    return out + '</div>';
  }).join('');
  return '<p class="guide__intro">' + escapeHTML(conv(GUIDE_INTRO)) + '</p>' + sections;
}

function syncGuideUI() {
  const lang = guideLang();
  const title = $('#guideTitle');
  if (title) title.textContent = GUIDE_TITLE[lang];
  $$('#guideLangSeg .seg').forEach(b =>
    b.classList.toggle('is-active', b.getAttribute('data-guide-lang') === lang));
  const body = $('#guideBody');
  if (body) body.innerHTML = guideHTML(lang);
  /* a language switch is a fresh read: start it at the top rather than
     halfway down the previous script's text */
  const sheet = $('#sheetGuide');
  const scroller = sheet ? $('.sheet__body', sheet) : null;
  if (scroller) scroller.scrollTop = 0;
}

function setGuideLang(lang) {
  state.settings.guideLang = lang === 'simplified' ? 'simplified' : 'traditional';
  saveSettings();
  syncGuideUI();
}

function initGuide() {
  const open = $('#btnGuide');
  if (open) open.addEventListener('click', () => {
    openSheet('sheetGuide');
    syncGuideUI();
  });
  $$('#guideLangSeg .seg').forEach(b =>
    b.addEventListener('click', () => setGuideLang(b.getAttribute('data-guide-lang'))));
  syncGuideUI();
}
