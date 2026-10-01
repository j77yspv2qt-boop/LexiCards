    /* ---- 8. My Cards deck ---- */
    setView('dictionary');
    setDictSub('mine');
    await wait(150);
    var mine = document.querySelectorAll('#stage .card');
    step('My Cards deck renders saved records', mine.length >= 1, mine.length);
    var zhShown = document.querySelector('#stage .defblock__zh');
    step('saved card shows its Chinese meaning', !!zhShown && zhShown.textContent.length > 0,
      zhShown ? zhShown.textContent : '');

    /* ---- 9. filters + custom list ---- */
    state.custom = ['apple'];
    saveCustom();
    setDictSub('discover');
    state.filter = 'pattern';
    rebuildDeck();
    step('pattern filter keeps only patterns', state.deck.every(function (d) { return d.type === 'pattern'; }), state.deck.length);
    state.filter = 'B2';
    rebuildDeck();
    step('B2 range keeps upper-intermediate words (B2 and C1)',
      state.deck.length > 0 && state.deck.every(function (d) {
        return d.type === 'word' && (d.level === 'B2' || d.level === 'C1');
      }), state.deck.length);
    state.filter = 'A1';
    rebuildDeck();
    step('A1 level filter returns words', state.deck.length > 0, state.deck.length);
    state.filter = 'phrase';
    rebuildDeck();
    step('phrases still filter by kind',
      state.deck.length > 0 && state.deck.every(function (d) { return d.type === 'phrase'; }), state.deck.length);

    state.filter = 'all';
    rebuildDeck();
    step('custom term enters the deck', state.deck.some(function (d) { return d.term === 'apple'; }));
    step('built-in deck is large enough', state.deck.length > 5000, state.deck.length);

    /* ---- 9b. bundled vocabulary tables (offline ceiling) ---- */
    var bw = 'abandon';
    step('bundled: Chinese gloss available without a network', offlineZh(bw).length > 0, offlineZh(bw).join(' / '));
    step('bundled: example sentence contains the term', offlineExample(bw).toLowerCase().indexOf(bw) >= 0, offlineExample(bw));
    step('bundled: CEFR level known', !!cefrOf(bw), cefrOf(bw));
    var lv = cefrOf(bw) || 'A1';
    step('bundled: level pool is quiz-ready', levelPool(lv).length > 100, levelPool(lv).length);
    step('bundled: example highlights the term', markHits(offlineExample(bw), bw).indexOf('ex-hit') > 0,
      markHits(offlineExample(bw), bw));
    var pat = 'the more ..., the more ...';
    step('bundled: pattern example is fragment-matched', !!offlineExample(pat), offlineExample(pat));
    step('bundled: every deck word has an example', (function () {
      var words = sourceTerms('all').filter(function (d) { return d.type === 'word'; });
      var bad = words.filter(function (d) { return !offlineExample(d.term); });
      return bad.length === 0;
    })(), 'checked ' + sourceTerms('all').filter(function (d) { return d.type === 'word'; }).length + ' words');
    step('deck now carries the extra vocabulary', sourceTerms('all').length > 5600, sourceTerms('all').length);
    step('bundled glosses are stored in Traditional Chinese', (function () {
      var bad = [];
      ['abandon', 'teaching', 'basket', 'call', 'coalition'].forEach(function (w) {
        offlineZh(w).forEach(function (z) { if (displayZh(z) !== z) bad.push(w + ' -> ' + z); });
      });
      return bad.length === 0;
    })(), offlineZh('teaching').join(' / '));
    step('bundled gloss follows the script setting', (function () {
      var z = offlineZh('teaching')[0] || '';
      setDefLang('simplified');
      var s = displayZh(z);
      setDefLang('traditional');
      return z.indexOf('學') >= 0 && s !== z && s.indexOf('学') >= 0;
    })(), 'traditional -> simplified round trip');


    /* ---- 10. meaning pipeline (network stubbed so the test is deterministic) ---- */
    window.__fetchMode = 'ok';
    var m1 = await getMeaning('hello', 'word', true);
    step('pipeline: english definition from Free Dictionary API',
      m1.en.length === 2 && m1.source === 'dictionaryapi', m1.source + ' | ' + (m1.en[0] ? m1.en[0].text : ''));
    step('pipeline: phonetic captured', m1.phonetic === '/stub/', m1.phonetic);
    step('pipeline: traditional chinese translation', m1.zh[0] === '你好', m1.zh.join(''));
    step('pipeline: audio URL captured', m1.audio === 'https://example.com/hello.mp3', m1.audio);
    step('pipeline: example sentence captured', m1.example === 'hello world', m1.example);
    step('pipeline: card is ready before the bilingual gloss lands', !!m1.ok && m1.zh.length === 1, m1.defZh.length);
    await whenMeaningSettled('hello', 'word');
    step('pipeline: bilingual definition translated too', m1.defZh.length === 1, m1.defZh.join(''));

    var helloURLs = function () { return window.__fetchLog.filter(function (u) { return u.indexOf('hello') >= 0; }).length; };
    var helloBefore = helloURLs();
    await getMeaning('hello', 'word', false);
    step('pipeline: cached meaning skips the network', helloURLs() === helloBefore,
      helloBefore + ' -> ' + helloURLs());

    window.__fetchMode = 'no-dict';
    var m2log = window.__fetchLog.length;
    var m2 = await getMeaning('goodbye', 'word', true);
    step('pipeline: falls back to Wiktionary when the dictionary API fails', m2.source === 'wiktionary', m2.source);
    step('pipeline: wiktionary html is stripped', !!m2.en[0] && m2.en[0].text.indexOf('<') < 0,
      m2.en[0] ? m2.en[0].text : '');
    step('pipeline: fallback starts without waiting for the dead provider to time out',
      window.__fetchLog.some(function (u, i) { return i >= m2log && u.indexOf('wiktionary') >= 0; }),
      window.__fetchLog.slice(m2log).join(' '));

    window.__fetchMode = 'all-fail';
    var m3 = await getMeaning('zzzunknown', 'word', true);
    step('pipeline: fails gracefully when every provider is down', m3.ok === false && m3.en.length === 0,
      m3.source + ' | ' + m3.note);
    step('pipeline: failure reason surfaced to the user', !!m3.note, m3.note);

    state.cache = {};
    setDictSub('discover');
    await wait(500);
    step('pipeline: a card still renders when every provider is down', (function () {
      var sc = document.querySelector('#stage .card--top [data-scroller]');
      if (!sc) return false;
      /* built-in words fall back to the bundled gloss, others show Retry */
      return sc.innerHTML.indexOf('data-retry') >= 0 || !!sc.querySelector('.defblock__zh');
    })(), (document.querySelector('#stage .card--top [data-scroller]') || {}).textContent);

    lookupInstantTerm('zzzunknown');
    await wait(1200);
    step('pipeline: unknown words offer a Retry button',
      !!document.querySelector('#stage [data-retry]'));
    setDictSub('discover');
    await wait(200);
    step('pipeline: card shows the source chip', !!document.querySelector('#stage [data-src]'),
      document.querySelector('#stage [data-src]') ? document.querySelector('#stage [data-src]').textContent : '');

    window.__fetchMode = 'ok';
    state.cache = {};
    var m4 = await getMeaning('give up the ghost', 'phrase', true);
    step('pipeline: phrases skip the dictionary API and use translation',
      m4.zh[0] === '你好' && m4.en.length === 0, JSON.stringify(m4.zh));
    step('pipeline: phrase lookup used the translation endpoint',
      window.__fetchLog.some(function (u) {
        return (u.indexOf('mymemory') >= 0 || u.indexOf('translate.googleapis.com') >= 0) && u.indexOf('ghost') >= 0;
      }),
      window.__fetchLog.slice(-1).join(''));

    /* ---- 10b. lookup speed: provider health, translation cache, read-ahead ---- */
    function defTrCalls() {
      return window.__fetchLog.filter(function (u) {
        return (u.indexOf('mymemory') >= 0 || u.indexOf('translate.googleapis.com') >= 0) &&
          u.indexOf('a%20greeting') >= 0;
      }).length;
    }
    step('pipeline: the same sentence is translated once and then reused', defTrCalls() === 1, defTrCalls());

    Object.keys(PROVIDER_STATE).forEach(function (k) { delete PROVIDER_STATE[k]; });
    window.__fetchMode = 'no-dict';
    await getMeaning('breakerone', 'word', true);
    await getMeaning('breakertwo', 'word', true);
    window.__fetchLog.length = 0;
    var m5 = await getMeaning('breakerthree', 'word', true);
    step('pipeline: a provider that keeps failing is skipped afterwards',
      m5.source === 'wiktionary' && !window.__fetchLog.some(function (u) { return u.indexOf('dictionaryapi') >= 0; }),
      window.__fetchLog.length + ' requests -> ' + window.__fetchLog.join(' '));

    /* the app must not spend background traffic while it is not on screen */
    Object.defineProperty(document, 'hidden', { configurable: true, get: function () { return false; } });
    window.__fetchMode = 'ok';
    state.cache = {};
    state.tr = {};
    setDictSub('discover');
    rebuildDeck();
    await wait(900);
    var nextTerms = currentCards(PREFETCH_AHEAD + 1).slice(1);
    var ready = nextTerms.filter(function (d) { return isMeaningReady(d.term, d.type); });
    step('pipeline: read-ahead pre-fetches the cards behind the visible one',
      ready.length >= Math.min(2, nextTerms.length), ready.length + ' / ' + nextTerms.length + ' warm');
    flipCard(1);
    await wait(300);
    var topZh = document.querySelector('#stage .card--top .defblock__zh');
    step('pipeline: the next card is already filled in when it arrives',
      !!topZh && topZh.textContent.length > 0, topZh ? topZh.textContent : 'still a skeleton');
    delete document.hidden;

    /* ---- 10c. translation provider chain + self-healing cache ---- */
    window.__fetchMode = 'no-google';
    var m6 = await getMeaning('fallbackword', 'word', true);
    step('translation falls back when the first provider fails',
      m6.zh.length === 1 && m6.zh[0] === '你好', m6.zh.join(''));
    step('fallback translation used the second provider',
      window.__fetchLog.slice(-8).some(function (u) { return u.indexOf('mymemory') >= 0; }));
    await whenMeaningSettled('fallbackword', 'word');
    window.__fetchMode = 'ok';
    await getMeaning('hello', 'word', true);
    await whenMeaningSettled('hello', 'word');
    var hk = meaningKey('hello', 'word');
    state.cache[hk] = Object.assign({}, state.cache[hk], { defZh: [] });
    await getMeaning('hello', 'word', false);
    await whenMeaningSettled('hello', 'word');
    step('a cached card without a Chinese explanation heals itself',
      (state.cache[hk].defZh || []).length === 1, (state.cache[hk].defZh || []).join(''));

    /* ---- 10d. translation speed on a network where one engine is silent ---- */
    Object.keys(PROVIDER_STATE).forEach(function (k) { delete PROVIDER_STATE[k]; });
    state.tr = {};
    window.__fetchMode = 'hang-google';
    var logFrom = window.__fetchLog.length;
    var mh = await getMeaning('hedgeword', 'word', true);
    var hedgeLog = window.__fetchLog.slice(logFrom);
    step('hedge: the answer lands although the first engine never answers',
      mh.zh.length === 1 && mh.zh[0] === '你好', mh.zh.join(''));
    step('hedge: the next engine starts while the first is still quiet',
      hedgeLog.some(function (u) { return u.indexOf('mymemory') >= 0; }) &&
      hedgeLog.some(function (u) { return u.indexOf('translate.googleapis.com') >= 0; }),
      hedgeLog.length + ' requests');
    window.__fetchMode = 'ok';

    /* the measured latency reorders the chain, and a two-time loser is skipped */
    noteProviderResult('mymemory', true, 120);
    noteProviderResult('google-trans', false, 4500);
    noteProviderResult('google-trans', false, 4500);
    step('chain order puts the engine that answered first',
      translatorOrder()[0].id === 'mymemory',
      translatorOrder().map(function (t) { return t.id; }).join(' > '));
    step('a two-time loser is taken out of the chain', providerIsDown('google-trans') === true);

    /* worst case: every engine is down - the bundled table still answers */
    window.__fetchMode = 'all-fail';
    var mw = await getMeaning('basket', 'word', true);
    step('bundled gloss covers the case where every engine is down',
      mw.zh.length > 0 && !!mw.example, mw.zh.join(' / ') + ' | ' + mw.example);
    window.__fetchMode = 'ok';

    /* ---- 10e. the update check survives a blocked GitHub ---- */
    window.__updateMode = 'github-blocked';
    await checkForUpdate(true);
    step('update: falls back to the jsDelivr mirror when GitHub is blocked',
      updateState.source.indexOf('jsdelivr') === 0 && updateState.version === '9.9',
      updateState.source + ' -> v' + updateState.version);
    step('update: a newer release is recognised', updateState.newer === true, updateState.version);
    step('update: a mirror download is offered',
      document.getElementById('btnInstallMirror').hidden === false,
      document.getElementById('btnInstallMirror').textContent);
    step('update: the hint names the new version', updateHintText().indexOf('9.9') >= 0, updateHintText());

    window.__updateMode = 'github-ok';
    updateState.checked = false; updateState.at = 0;
    await checkForUpdate(true);
    step('update: every source agrees on 9.9',
      updateState.version === '9.9' &&
      ['github', 'jsdelivr', 'jsdelivr-fastly', 'jsdelivr-gcore', 'raw'].indexOf(updateState.source) >= 0,
      updateState.source + ' -> v' + updateState.version);
    step('update: a release payload gives the APK asset link',
      parseGithubRelease({ tag_name: 'v9.9', html_url: 'https://example.com/page',
        body: 'b', assets: [{ name: 'LexiCards.apk', browser_download_url: 'https://example.com/a.apk' }] }).url
        === 'https://example.com/a.apk', 'asset url parsed');
    step('update: version.json gives the jsDelivr mirror link',
      parseVersionFile({ version: '9.9', apk_mirror: 'https://cdn.jsdelivr.net/gh/a@v9.9/LexiCards.apk' }).mirror
        .indexOf('jsdelivr') >= 0, 'mirror url parsed');
    var stampBefore = updateState.at;
    var logBefore = window.__fetchLog.length;
    await checkForUpdate(false);
    step('update: a second tap inside the window costs no request',
      updateState.at === stampBefore && window.__fetchLog.length === logBefore,
      'throttled for ' + Math.round(UPDATE_CHECK_MS / 3600000) + 'h');


    /* ---- 11. settings + sheets + storage ---- */
    toggleSwitch('swHaptics');
    step('settings switch toggles', state.settings.haptics === false);
    toggleSwitch('swHaptics');
    step('settings persist to localStorage', JSON.parse(localStorage.getItem('lexi.settings.v1')).haptics === true);
    openSheet('sheetData');
    step('data sheet opens', document.getElementById('sheetData').classList.contains('is-open'));
    closeAllSheets();
    step('sheets close', document.querySelectorAll('.sheet.is-open').length === 0);
    step('storage info is filled in', document.getElementById('storageInfo').textContent.length > 10,
      document.getElementById('storageInfo').textContent);

    /* ---- 11b. app info sheet + definition language ---- */
    openSheet('sheetInfo');
    var infoSheet = document.getElementById('sheetInfo');
    step('app info sheet opens', infoSheet.classList.contains('is-open'));
    var vText = document.getElementById('appVersionInfo').textContent;
    step('app info shows the current version', vText.indexOf(APP_VERSION) >= 0, vText);

    step('definition language defaults to traditional',
      state.settings.definitionLang === 'traditional', state.settings.definitionLang);
    setDefLang('simplified');
    step('definition language switches to simplified',
      state.settings.definitionLang === 'simplified' &&
      JSON.parse(localStorage.getItem('lexi.settings.v1')).definitionLang === 'simplified',
      state.settings.definitionLang);
    step('traditional text converts to simplified',
      toSimp('習慣') === '习惯' && displayZh('習慣') === '习惯', toSimp('習慣'));
    setDefLang('traditional');
    step('definition language switches back to traditional', displayZh('習慣') === '習慣');
    closeSheet('sheetInfo');
    step('app info sheet closes', !infoSheet.classList.contains('is-open'));

    /* ---- 11c. the user guide, and its own language switch ---- */
    step('guide: App info offers the guide', !!document.getElementById('btnGuide'));
    document.getElementById('btnGuide').click();
    await wait(150);
    var guideSheet = document.getElementById('sheetGuide');
    step('guide: the button opens the guide sheet', guideSheet.classList.contains('is-open'));
    step('guide: it opens in Traditional Chinese',
      document.getElementById('guideTitle').textContent === '使用說明' &&
      document.getElementById('guideBody').textContent.indexOf('四個頁面') > 0,
      document.getElementById('guideTitle').textContent);
    step('guide: every section and its bullets are rendered', (function () {
      var secs = document.querySelectorAll('#guideBody .guide__sec');
      var items = document.querySelectorAll('#guideBody li');
      return secs.length >= 8 && items.length >= 20;
    })(), document.querySelectorAll('#guideBody .guide__sec').length + ' sections, ' +
      document.querySelectorAll('#guideBody li').length + ' bullets');
    var tradGuide = document.getElementById('guideBody').textContent;
    document.querySelector('#guideLangSeg .seg[data-guide-lang="simplified"]').click();
    await wait(150);
    var simpGuide = document.getElementById('guideBody').textContent;
    step('guide: 简体中文 rerenders the same guide in simplified characters',
      document.getElementById('guideTitle').textContent === '使用说明' &&
      simpGuide.indexOf('四个页面') > 0 && simpGuide !== tradGuide,
      document.getElementById('guideTitle').textContent);
    step('guide: the guide language is remembered on its own',
      state.settings.guideLang === 'simplified' &&
      JSON.parse(localStorage.getItem('lexi.settings.v1')).guideLang === 'simplified',
      state.settings.guideLang);
    step('guide: reading the guide in simplified leaves the cards in Traditional',
      state.settings.definitionLang === 'traditional' && displayZh('習慣') === '習慣',
      state.settings.definitionLang);
    document.querySelector('#guideLangSeg .seg[data-guide-lang="traditional"]').click();
    closeSheet('sheetGuide');
    step('guide: switching back to Traditional and closing works',
      !guideSheet.classList.contains('is-open') &&
      document.getElementById('guideTitle').textContent === '使用說明',
      document.getElementById('guideTitle').textContent);

    /* ---- 12. drag-handle simulation (pointer events) ---- */
    setDictSub('discover');
    await wait(150);
    var topCard = document.querySelector('#stage .card--top');
    var zone = document.getElementById('dropzone');
    var dragTerm = topCard.getAttribute('data-term');
    var r0 = topCard.getBoundingClientRect();
    /* a long-press on the card body must NOT open the save panel any more */
    var bodyPe = function (type, x, y) {
      topCard.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 6, pointerType: 'touch', clientX: x, clientY: y, isPrimary: true }));
    };
    bodyPe('pointerdown', r0.left + 40, r0.top + 30);
    await wait(520);
    step('long-press on the card body no longer opens the save panel',
      !zone.classList.contains('is-visible'));
    bodyPe('pointerup', r0.left + 40, r0.top + 30);
    await wait(80);
    var handle = topCard.querySelector('[data-drag-handle]');
    step('card has a drag handle at the bottom', !!handle);
    var hr = handle.getBoundingClientRect();
    var pe = function (type, x, y) {
      handle.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 7, pointerType: 'touch', clientX: x, clientY: y, isPrimary: true }));
    };
    pe('pointerdown', hr.left + hr.width / 2, hr.top + hr.height / 2);
    await wait(60);
    step('dragging the handle reveals the save panel', zone.classList.contains('is-visible'));
    var zr = zone.querySelector('.dropzone__inner').getBoundingClientRect();
    pe('pointermove', r0.left + 45, r0.top + 35);
    pe('pointermove', zr.left + zr.width / 2, zr.top + zr.height / 2);
    step('panel turns red over the drop target', zone.classList.contains('is-hot'));
    step('card is flagged as draggable', topCard.classList.contains('card--dragging'));
    pe('pointerup', zr.left + zr.width / 2, zr.top + zr.height / 2);
    await wait(150);
    step('dropping on the panel saves the card', !!findRecordByTerm(dragTerm), dragTerm);
    step('panel hides again after the drop', !zone.classList.contains('is-visible'));
    step('card returns to its place', topCard.style.transform === '' || topCard.style.transform === 'none',
      topCard.style.transform);

    /* ---- 13. swipe directions: right = next card, left = previous card ---- */
    var t2 = document.querySelector('#stage .card--top');
    var startTerm = t2.getAttribute('data-term');
    var b = t2.getBoundingClientRect();
    var pe2 = function (type, x, y) {
      t2.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 9, pointerType: 'touch', clientX: x, clientY: y, isPrimary: true }));
    };
    /* swipe right -> next card */
    pe2('pointerdown', b.left + 40, b.top + 150);
    pe2('pointermove', b.left + 90, b.top + 150);
    pe2('pointermove', b.left + b.width - 10, b.top + 152);
    pe2('pointerup', b.left + b.width - 10, b.top + 152);
    await wait(420);
    var nextTerm = document.querySelector('#stage .card--top').getAttribute('data-term');
    step('swiping right moves to the next card', nextTerm !== startTerm, startTerm + ' -> ' + nextTerm);
    /* swipe left -> back to the previous card */
    var t3 = document.querySelector('#stage .card--top');
    var b3 = t3.getBoundingClientRect();
    var pe3 = function (type, x, y) {
      t3.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 11, pointerType: 'touch', clientX: x, clientY: y, isPrimary: true }));
    };
    pe3('pointerdown', b3.left + b3.width - 40, b3.top + 150);
    pe3('pointermove', b3.left + b3.width - 90, b3.top + 150);
    pe3('pointermove', b3.left + 10, b3.top + 152);
    pe3('pointerup', b3.left + 10, b3.top + 152);
    await wait(420);
    var prevTerm = document.querySelector('#stage .card--top').getAttribute('data-term');
    step('swiping left returns to the previous card', prevTerm === startTerm,
      prevTerm + ' (expected ' + startTerm + ')');
    /* ---- 14. v1.6 fixes: script table, highlights, examples, update check ---- */

    /* 14a. the simplified -> traditional table (人權 used to print as 人杠
       because a non-BMP pair shifted the old build by one UTF-16 unit) */
    step('script table: Traditional text is left untouched',
      toTrad('人權') === '人權' && toTrad('權利與組織') === '權利與組織', toTrad('人權'));
    step('script table: Simplified text still converts',
      toTrad('人权') === '人權' && toTrad('组织机构') === '組織機構', toTrad('人权'));
    step('script table: Traditional converts back to Simplified',
      toSimp('人權') === '人权' && toSimp('習慣') === '习惯', toSimp('人權'));
    step('script table: every pair maps to its Traditional character', (function () {
      var cps = Array.from(S2T_PAIRS), bad = 0;
      for (var i = 0; i + 1 < cps.length; i += 2) if (toTrad(cps[i]) !== cps[i + 1]) bad++;
      return bad === 0;
    })(), 'pairs checked: ' + Math.floor(Array.from(S2T_PAIRS).length / 2));
    step('script table: corrupted text left by the old build is repaired',
      repairScript('人杠') === '人權' && repairScript('杀枞') === '機構' && repairScript('人權') === '人權',
      repairScript('人杠') + ' / ' + repairScript('杀枞'));
    state.cache[meaningKey('right', 'word')] = {
      term: 'right', type: 'word', zh: ['杠利'], defZh: [], en: [],
      phonetic: '', audio: '', example: '', exampleZh: '性自由是必要的人杠。',
      source: 'translation', ok: true, fetchedAt: Date.now()
    };
    state.settings.scriptFix = 0;
    repairLegacyScriptData();
    var repaired = state.cache[meaningKey('right', 'word')];
    step('stored Chinese from the old table is repaired once',
      repaired.exampleZh === '性自由是必要的人權。' && repaired.zh[0] === '權利',
      repaired.exampleZh + ' / ' + repaired.zh[0]);
    var typedRec = upsertRecord({ term: 'gong', type: 'word', zh: ['杠'], source: 'manual' });
    state.settings.scriptFix = 0;
    repairLegacyScriptData();
    step('a meaning typed by hand is never rewritten', typedRec.zh[0] === '杠', typedRec.zh[0]);

    /* 14b. highlighting, both sides of the example */
    step('English highlight covers inflected forms',
      markHits('Birds are singing in the trees.', 'sing').indexOf('ex-hit') > 0 &&
      markHits('The policy was adopted last year.', 'adopt').indexOf('ex-hit') > 0,
      markHits('Birds are singing in the trees.', 'sing'));
    step('English highlight keeps whole-word matching',
      markHits('He landed in the sand.', 'an').indexOf('ex-hit') < 0);
    step('Chinese highlight marks a shared part of the gloss',
      markZhHits('我們希望你唱這首歌。', '唱歌').indexOf('ex-hit') > 0,
      markZhHits('我們希望你唱這首歌。', '唱歌'));
    step('Chinese highlight marks an exact gloss',
      markZhHits('性自由是必要的人權。', '人權').indexOf('ex-hit') > 0,
      markZhHits('性自由是必要的人權。', '人權'));
    step('Chinese highlight does not light up a stray character',
      markZhHits('這是一個例子。', '倫理').indexOf('ex-hit') < 0);

    /* 14c. a cached meaning without an example is healed (the card that showed
       no sentence at all, e.g. "ethical") */
    state.cache[meaningKey('ethical', 'word')] = {
      term: 'ethical', type: 'word', en: [{ pos: 'adj', text: 'of or relating to ethics' }],
      zh: ['倫理的'], defZh: [], phonetic: '', audio: '', example: '', exampleZh: '',
      source: 'dictionaryapi', ok: true, fetchedAt: Date.now()
    };
    saveCache();
    var healed = await getMeaning('ethical', 'word');
    step('cached entry without an example is healed from the bundled table',
      !!healed.example && healed.example.toLowerCase().indexOf('ethical') >= 0, healed.example);
    await wait(30);
    step('the healed example is written back to the cache',
      !!state.cache[meaningKey('ethical', 'word')].example,
      state.cache[meaningKey('ethical', 'word')].example);
    /* 14d. an example sentence for a term the bundled table does not know */
    var wt = await lookupWiktionaryText('sing');
    step('wikitext usage lines are used as example candidates',
      Array.isArray(wt) && wt.length >= 1 && wt[0].indexOf('sings') > 0, wt[0]);
    step('a candidate that contains the term is preferred',
      pickSentence(['Nothing here at all.', 'A stub sings.'], 'sings') === 'A stub sings.',
      pickSentence(['Nothing here at all.', 'A stub sings.'], 'sings'));
    state.deck = [];
    state.deckIndex = 0;
    lookupInstantTerm('zorbulate');
    await wait(340);
    var zorb = state.cache[meaningKey('zorbulate', 'word')];
    step('a searched term gets an example sentence', !!zorb && !!zorb.example,
      zorb ? zorb.example : 'no cache entry');
    var zCard = document.querySelector('#stage .card--top');
    step('the searched card renders the example block',
      !!zCard && !!zCard.querySelector('[data-example]'),
      zCard ? zCard.querySelector('.card__example').textContent : 'no card');

    /* 14e. the GitHub update check */
    step('version compare handles multi-digit parts',
      compareVersion('1.10', '1.9') > 0 && compareVersion('1.6', '1.6') === 0 &&
      compareVersion('1.5', '1.6') < 0 && compareVersion('v1.7', '1.6') > 0);
    await checkForUpdate(true);
    if (updateState.version !== '9.9') await checkForUpdate(true);
    step('update check reads the newest release from GitHub',
      updateState.version === '9.9' && updateState.newer === true, updateState.version);
    step('update check prefers the APK asset of the release',
      updateState.url.indexOf('LexiCards-v9.9.apk') >= 0, updateState.url);
    syncUpdateUI();
    step('app info offers the download of the newer release',
      document.getElementById('btnInstallUpdate').hidden === false &&
      document.getElementById('btnInstallUpdate').textContent.indexOf('9.9') >= 0,
      document.getElementById('btnInstallUpdate').textContent);
    step('app info names the newer release',
      /9\.9/.test(document.getElementById('updateInfo').textContent),
      document.getElementById('updateInfo').textContent);

    /* ---- 15. v1.8: the four pages, the swipe, the tab bar and the icons ---- */

    /* the navigation moved out of the app bar and into a bottom tab bar */
    step('pages: the old Dictionary/Revision pill is gone from the app bar',
      !document.querySelector('.appbar .maintabs') &&
      !document.getElementById('dictSeg') && !document.getElementById('revSeg'));
    step('pages: the tab bar carries all four pages',
      document.querySelectorAll('#mainTabs .tabbar__btn').length === 4,
      document.querySelectorAll('#mainTabs .tabbar__btn').length);
    step('pages: the tab bar is below the content, not in the app bar',
      !!document.querySelector('.tabbar') && !document.querySelector('.appbar .tabbar'));

    /* every page title has an icon, and the tab bar repeats the same four */
    step('pages: every page title has an icon',
      ['discover', 'mine', 'records', 'quiz'].every(function (p) {
        var el = document.querySelector('.pagehead__icon[data-pageicon="' + p + '"]');
        return !!el && el.querySelector('svg') !== null;
      }), document.querySelectorAll('.pagehead__icon svg').length + ' title icons drawn');
    step('pages: every tab carries an icon too',
      document.querySelectorAll('#mainTabs .tabbar__icon svg').length === 4,
      document.querySelectorAll('#mainTabs .tabbar__icon svg').length);
    step('pages: the four page titles are named',
      ['Discover', 'My Cards', 'Records', 'Quiz'].every(function (label) {
        return Array.prototype.some.call(document.querySelectorAll('.pagehead__title'),
          function (el) { return el.textContent.trim() === label; });
      }), Array.prototype.map.call(document.querySelectorAll('.pagehead__title'),
        function (el) { return el.textContent.trim(); }).join(' / '));

    /* the swipe moves between the pages, in order */
    step('pages: the app starts on Discover',
      state.page === 'discover' &&
      document.getElementById('view-discover').classList.contains('is-active'));
    var pagerEl = document.getElementById('pager');
    var pagerBox = pagerEl.getBoundingClientRect();
    /* a drag on the page head, clear of the card stack (the card owns its own
       horizontal swipe for next / previous) */
    function swipe(fromX, toX) {
      var y = pagerBox.top + 8;
      function fire(type, x) {
        pagerEl.dispatchEvent(new PointerEvent(type, {
          bubbles: true, cancelable: true, pointerId: 31, pointerType: 'touch',
          isPrimary: true, clientX: x, clientY: y
        }));
      }
      fire('pointerdown', fromX);
      fire('pointermove', (fromX + toX) / 2);
      fire('pointermove', toX);
      fire('pointerup', toX);
    }
    var L = pagerBox.left, W = pagerBox.width;
    swipe(L + W - 30, L + 30);
    await wait(420);
    step('pages: swiping left moves Discover -> My Cards',
      state.page === 'mine' && document.getElementById('view-mine').classList.contains('is-active'), state.page);
    swipe(L + W - 30, L + 30);
    await wait(420);
    step('pages: swiping again moves My Cards -> Records', state.page === 'records', state.page);
    swipe(L + W - 30, L + 30);
    await wait(420);
    step('pages: Records -> Quiz is the last step of the swipe', state.page === 'quiz', state.page);
    var beforeQuiz = state.page;
    swipe(L + W - 30, L + 30);
    step('pages: the swipe cannot go past the last page', state.page === beforeQuiz, state.page);
    swipe(L + 30, L + W - 30);
    await wait(420);
    step('pages: swiping right walks back', state.page === 'records', state.page);

    /* a short drag snaps back instead of turning the page */
    swipe(L + W - 30, L + W - 70);
    await wait(420);
    step('pages: a short drag snaps back to the same page', state.page === 'records', state.page);

    /* the tab bar follows the swipe, and tapping it jumps */
    step('pages: the tab bar marks the current page',
      document.querySelector('#mainTabs .tabbar__btn.is-active').getAttribute('data-page') === 'records',
      document.querySelector('#mainTabs .tabbar__btn.is-active').getAttribute('data-page'));
    document.querySelector('#mainTabs .tabbar__btn[data-page="discover"]').click();
    await wait(420);
    step('pages: tapping a tab jumps straight to that page', state.page === 'discover', state.page);
    step('pages: the track is parked on the current page',
      /translate3d\(0%/.test(document.getElementById('pagerTrack').style.transform),
      document.getElementById('pagerTrack').style.transform);

    /* Each page has to LAND INSIDE the pager.  Checking the transform string
       only proves something on page one, where every formula returns 0% - so
       here every page is walked and its real box is compared with the pager.
       A track offset expressed in the wrong unit still reads as a valid
       transform and passes a string match, but parks the page off screen. */
    (async function () {
      var pagerL = document.getElementById('pager').getBoundingClientRect().left;
      for (var _i = 0; _i < 4; _i++) {
        var id = ['discover', 'mine', 'records', 'quiz'][_i];
        setPage(id);
        await wait(420);
        var r = document.getElementById('view-' + id).getBoundingClientRect();
        step('layout: ' + id + ' lands inside the pager', Math.abs(r.left - pagerL) < 2 && r.width > 0,
          'left ' + Math.round(r.left - pagerL) + 'px, width ' + Math.round(r.width) + 'px, track ' +
          document.getElementById('pagerTrack').style.transform);
      }
      setPage('discover');
      await wait(420);
    })();
    await wait(2000);

    /* The pages have to actually FILL the pager and be as wide as the window -
       a page that collapses still passes every class and text check above, so
       the geometry is asserted here. */
    (function () {
      var pagerBox = document.getElementById('pager').getBoundingClientRect();
      var track = document.getElementById('pagerTrack').getBoundingClientRect();
      var view = document.getElementById('view-discover').getBoundingClientRect();
      var stageBox = document.getElementById('stage').getBoundingClientRect();
      var tab = document.querySelector('.tabbar').getBoundingClientRect();
      step('layout: the track fills the pager height', Math.abs(track.height - pagerBox.height) < 2,
        'track ' + Math.round(track.height) + ' vs pager ' + Math.round(pagerBox.height));
      step('layout: the track is four pages wide', Math.abs(track.width - pagerBox.width * 4) < 2,
        'track ' + Math.round(track.width) + ' vs 4x' + Math.round(pagerBox.width));
      step('layout: a page is one window wide', Math.abs(view.width - pagerBox.width) < 2,
        'page ' + Math.round(view.width) + ' vs pager ' + Math.round(pagerBox.width));
      step('layout: the card stage is as wide as the page',
        stageBox.width > view.width * 0.8, Math.round(stageBox.width) + ' of ' + Math.round(view.width));
      step('layout: the card stage keeps a usable height', stageBox.height > 200,
        Math.round(stageBox.height) + 'px');
      step('layout: the page does not run under the tab bar',
        view.bottom <= tab.top + 1, 'page ends ' + Math.round(view.bottom) + ', tab bar at ' + Math.round(tab.top));
      step('layout: the app is exactly one screen tall',
        Math.abs(document.querySelector('.app').getBoundingClientRect().height - window.innerHeight) < 2,
        Math.round(document.querySelector('.app').getBoundingClientRect().height) + ' vs ' + window.innerHeight);
      step('layout: nothing is left scrolling the whole document sideways',
        document.documentElement.scrollWidth <= window.innerWidth + 1,
        document.documentElement.scrollWidth + ' vs ' + window.innerWidth);
    })();

    /* each page keeps its own state, and My Cards renders its own stage */
    setPage('mine');
    await wait(260);
    step('pages: My Cards has its own card stage', document.querySelectorAll('#stageMine .card').length >= 1,
      document.querySelectorAll('#stageMine .card').length);
    step('pages: My Cards has its own progress row',
      /\d+ \/ \d+/.test(document.getElementById('dictPosMine').textContent),
      document.getElementById('dictPosMine').textContent);
    setPage('discover');
    await wait(260);
    step('pages: going back to Discover keeps its own deck', document.querySelectorAll('#stage .card').length >= 1,
      document.querySelectorAll('#stage .card').length);

    /* the Android back button walks the same list */
    setPage('quiz');
    step('back: the hardware back button steps back one page',
      window.lexiHandleBack() === true && state.page === 'records', state.page);
    while (state.page !== 'discover') window.lexiHandleBack();
    step('back: the first page hands control back to Android', window.lexiHandleBack() === false, state.page);

    /* ---- 15b. the three swipe fixes ---- */

    /* (a) A page-level scroller has to hand the horizontal drag back to the
       pager.  On a vertical scroller the browser otherwise decides the drag is
       a scroll, cancels the pointer stream (pointercancel) and the page never
       turns - which is exactly why Records and Quiz could not be swiped.  The
       fix is `touch-action:pan-y` on the list and the quiz pane, so this asserts
       it is actually there (a class/text check would never catch it). */
    step('swipe fix: every page-level scroller allows pan-y',
      ['.list', '.quiz', '.card__scroller'].every(function (sel) {
        var el = document.querySelector(sel);
        return !!el && getComputedStyle(el).touchAction === 'pan-y';
      }), ['.list', '.quiz', '.card__scroller'].map(function (sel) {
        var el = document.querySelector(sel);
        return el ? getComputedStyle(el).touchAction : 'missing';
      }).join(' / '));

    /* (b) the drag needed to turn the page was lowered (0.28 -> 0.18) */
    step('swipe fix: the page-swipe distance was lowered',
      typeof PAGE_SWIPE_RATIO === 'number' && PAGE_SWIPE_RATIO <= 0.2,
      'PAGE_SWIPE_RATIO = ' + PAGE_SWIPE_RATIO);

    /* (c) a drag that starts on a real descendant (a records row), not on the
       pager element itself, still turns the page */
    setPage('records');
    await wait(360);
    (function () {
      var row = document.querySelector('#recordsList .item');
      if (!row) return;
      var b = row.getBoundingClientRect();
      function fire(type, x) {
        row.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true,
          pointerId: 41, pointerType: 'touch', isPrimary: true, clientX: x, clientY: 300 }));
      }
      fire('pointerdown', b.right - 20);
      fire('pointermove', b.left + 20);
      fire('pointermove', b.left + 2);
      fire('pointerup', b.left + 2);
    })();
    await wait(440);
    step('swipe fix: a drag that starts on a records row turns the page', state.page === 'quiz', state.page);

    /* (d) a short but quick flick turns the page even without the distance */
    setPage('records');
    await wait(360);
    var flickRow = document.querySelector('#recordsList .item');
    if (flickRow) {
      var fb = flickRow.getBoundingClientRect();
      function fireFlick(type, x) {
        flickRow.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true,
          pointerId: 43, pointerType: 'touch', isPrimary: true, clientX: x, clientY: 300 }));
      }
      fireFlick('pointerdown', fb.left + 90);
      await wait(26);
      fireFlick('pointermove', fb.left + 80);
      await wait(6);
      fireFlick('pointermove', fb.left + 40);
      fireFlick('pointerup', fb.left + 40);
    }
    await wait(440);
    step('swipe fix: a quick short flick turns the page', state.page === 'quiz', state.page);

    /* (e) the tab highlight marks the SELECTED page, so it moves with the page.
       It used to come from :hover only, which sticks after a tap, so the tint
       stayed on whatever tab was tapped last.  The colour is read with the
       transition switched off: headless runs under virtual time, where the CSS
       transition does not settle, so a plain read would report the value it is
       transitioning away from. */
    function settledBg(el) {
      var prev = el.style.transition;
      el.style.transition = 'none';
      var bg = getComputedStyle(el).backgroundColor;
      el.style.transition = prev;
      return bg;
    }
    setPage('mine');
    await wait(320);
    var actTab = document.querySelector('#mainTabs .tabbar__btn.is-active');
    step('swipe fix: the selected tab carries the highlight',
      !!actTab && actTab.getAttribute('data-page') === 'mine' &&
      settledBg(actTab) !== 'rgba(0, 0, 0, 0)',
      actTab ? actTab.getAttribute('data-page') + ' ' + settledBg(actTab) : 'none');
    setPage('quiz');
    await wait(320);
    var actTab2 = document.querySelector('#mainTabs .tabbar__btn.is-active');
    var mineTab = document.querySelector('#mainTabs .tabbar__btn[data-page="mine"]');
    step('swipe fix: the highlight follows the page change',
      !!actTab2 && actTab2.getAttribute('data-page') === 'quiz' &&
      settledBg(actTab2) !== 'rgba(0, 0, 0, 0)' &&
      settledBg(mineTab) === 'rgba(0, 0, 0, 0)',
      actTab2 ? actTab2.getAttribute('data-page') + ' ' + settledBg(actTab2) : 'none');
    setPage('discover');
    await wait(200);

    /* ---- 16. the skin machinery ---- */
    step('skin: classic, gothic and primevere are the skins that ship', skinIds().join(',') === 'classic,gothic,primevere', skinIds().join(','));
    step('skin: the chosen skin is applied as data-skin on <html>',
      document.documentElement.getAttribute('data-skin') === 'classic',
      document.documentElement.getAttribute('data-skin'));
    step('skin: the picker lists every skin in App info',
      document.querySelectorAll('#skinPicker .skinopt').length === skinIds().length,
      document.querySelectorAll('#skinPicker .skinopt').length);
    step('skin: the current skin is marked in the picker',
      document.querySelector('#skinPicker .skinopt.is-active').getAttribute('data-skin') === 'classic');
    /* The picker shows each skin's app icon instead of a chip of its primary
       colour, so every row has to bring a picture - its own, or the built-in
       launcher tile it would fall back to. */
    step('skin: every picker row shows that skin\'s app icon', (function () {
      var rows = document.querySelectorAll('#skinPicker .skinopt');
      if (rows.length !== skinIds().length) return false;
      for (var i = 0; i < rows.length; i++) {
        var id = rows[i].getAttribute('data-skin');
        var img = rows[i].querySelector('img.skinopt__icon');
        if (!img || !img.getAttribute('src')) return false;
        if (SKINS[id].appIcon && img.getAttribute('src').indexOf('data:image/png;base64,') !== 0) return false;
        if (SKINS[id].appIcon && img.getAttribute('src') !== SKINS[id].appIcon) return false;
      }
      return true;
    })(), document.querySelectorAll('#skinPicker .skinopt__icon').length + ' icons, ' +
      document.querySelector('#skinPicker .skinopt__icon').getAttribute('src').slice(0, 24));
    step('skin: a skin with no icon of its own falls back to the built-in tile',
      skinAppIcon(SKINS.classic).indexOf('data:image/svg+xml') === 0,
      skinAppIcon(SKINS.classic).slice(0, 24));
    step('skin: the wordmark is the one the app bar shows',
      document.getElementById('brandName').textContent === 'LexiCards',
      document.getElementById('brandName').textContent);
    step('skin: the app bar keeps a slot for a skin to fill', !!document.getElementById('appbarSlot'));

    /* ---- 16b. the first real skin: Gothic ---- */
    /* Gothic is the skin that proves the machinery: it drives every colour to
       greyscale, replaces all four page icons (page title AND tab bar) with
       artwork, swaps the wordmark for an image, fills the app bar slot and
       brings its own favicon. */
    setSkin('gothic');
    step('skin: gothic is applied as data-skin on <html>',
      document.documentElement.getAttribute('data-skin') === 'gothic',
      document.documentElement.getAttribute('data-skin'));
    /* every colour the skin controls, not a hand-picked few: the whole table is
       walked, so a token added to the skin later cannot quietly stay coloured.
       The list is checked against the skin's own values AND against what the
       document actually resolved them to. */
    var nonGrey = (function () {
      var cs = getComputedStyle(document.documentElement);
      var vars = SKINS.gothic.vars;
      for (var name in vars) {
        var m = String(vars[name]).trim();
        if (m.charAt(0) !== '#' || m.length !== 7) continue;   /* rgba() tokens are fine */
        var n = parseInt(m.slice(1), 16);
        var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
        if (Math.max(r, g, b) - Math.min(r, g, b) > 2) return name + '=' + m;
        if (cs.getPropertyValue(name).trim() !== m) return name + ' not applied';
      }
      return null;
    })();
    step('skin: gothic drives every colour token to greyscale', nonGrey === null,
      nonGrey || 'every hex token is on the grey axis');
    step('skin: gothic replaces all four page-title icons with artwork', (function () {
      var list = document.querySelectorAll('.pagehead__icon[data-pageicon]');
      if (list.length !== 4) return false;
      for (var i = 0; i < list.length; i++) {
        var img = list[i].querySelector('img');
        if (!img || img.getAttribute('src').indexOf('data:image/png;base64,') !== 0) return false;
      }
      return true;
    })(), document.querySelectorAll('.pagehead__icon img').length + ' replaced');
    step('skin: gothic replaces all four tab-bar icons with artwork', (function () {
      var list = document.querySelectorAll('.tabbar__icon[data-pageicon]');
      if (list.length !== 4) return false;
      for (var i = 0; i < list.length; i++) {
        var img = list[i].querySelector('img');
        if (!img || img.getAttribute('src').indexOf('data:image/png;base64,') !== 0) return false;
      }
      return true;
    })(), document.querySelectorAll('.tabbar__icon img').length + ' replaced');
    step('skin: gothic swaps the wordmark for the chrome lettering', (function () {
      var img = document.querySelector('#brandName .brand__logo');
      return !!img && img.getAttribute('src').indexOf('data:image/png;base64,') === 0;
    })(), document.getElementById('brandName').innerHTML.slice(0, 40));
    step('skin: gothic fills the app bar slot',
      !!document.querySelector('#appbarSlot .appbar__slot-img'));
    step('skin: gothic repaints the browser chrome',
      document.querySelector('meta[name="theme-color"]').getAttribute('content') === '#1C1C1E',
      document.querySelector('meta[name="theme-color"]').getAttribute('content'));
    step('skin: gothic brings its own favicon',
      document.querySelector('link[rel="icon"]').getAttribute('href').indexOf('data:image/png;base64,') === 0);
    step('skin: the gothic row is the one marked active in the picker',
      document.querySelector('#skinPicker .skinopt.is-active').getAttribute('data-skin') === 'gothic');
    /* the on-screen result: a token nothing consumes would pass every check
       above and still leave a white page, so measure real elements */
    step('skin: gothic actually paints the surfaces dark', (function () {
      function lum(c) {
        if (c.indexOf('rgb') !== 0) return 999;
        var p = c.slice(c.indexOf('(') + 1, c.length - 1).split(',');
        return (Number(p[0]) + Number(p[1]) + Number(p[2])) / 3;
      }
      var bar = lum(getComputedStyle(document.querySelector('.tabbar')).backgroundColor);
      var panel = lum(getComputedStyle(document.querySelector('.sheet__panel')).backgroundColor);
      return bar < 90 && panel < 90;
    })(), 'tab bar and sheet panel go black');

    /* The page background has to be a real grey, and the blocks on it have to
       sit clearly apart from it - that is the point of the skin's background,
       and a token nothing consumes would still pass every check above. */
    function greyLum(c) {
      var s = String(c).trim(), r, g, b;
      if (s.charAt(0) === '#') {
        var n = parseInt(s.slice(1), 16);
        r = (n >> 16) & 255; g = (n >> 8) & 255; b = n & 255;
      } else if (s.indexOf('rgb') === 0) {
        var p = s.slice(s.indexOf('(') + 1, s.length - 1).split(',');
        r = Number(p[0]); g = Number(p[1]); b = Number(p[2]);
      } else return -1;
      if (Math.max(r, g, b) - Math.min(r, g, b) > 4) return -1;
      return (r + g + b) / 3;
    }
    step('skin: gothic turns the page background grey, not black',
      greyLum(getComputedStyle(document.documentElement).getPropertyValue('--bg')) >= 40,
      getComputedStyle(document.documentElement).getPropertyValue('--bg'));
    step('skin: gothic keeps the blocks clear of the page background', (function () {
      var cs = getComputedStyle(document.documentElement);
      var page = greyLum(cs.getPropertyValue('--bg'));
      var token = greyLum(cs.getPropertyValue('--surface'));
      var card = greyLum(getComputedStyle(document.querySelector('#stage .card')).backgroundColor);
      return page > 0 && token > 0 && page - token >= 18 && Math.abs(card - token) < 2;
    })(), 'page ' + getComputedStyle(document.documentElement).getPropertyValue('--bg') +
      ' vs card ' + getComputedStyle(document.querySelector('#stage .card')).backgroundColor);

    /* The render-time inline colours follow the palette too: a record with no
       Chinese gloss used to be painted with a hard-coded blue. */
    var chromatic = upsertRecord({ term: 'chromatic', type: 'word', source: 'manual' });
    refreshRecords();
    step('skin: gothic repaints the inline gloss hint grey', (function () {
      var rows = document.querySelectorAll('#recordsList .item__zh');
      for (var i = 0; i < rows.length; i++) {
        if (rows[i].textContent.indexOf('No Chinese meaning yet') >= 0) {
          return greyLum(getComputedStyle(rows[i]).color) > 0;
        }
      }
      return false;
    })(), 'records hint on the palette');
    removeRecord(chromatic.id);
    refreshRecords();

    /* The whole app has to be greyscale in this skin - not the tokens the table
       lists, but every colour the browser actually ends up painting, on all
       four pages and all three sheets.  Transitions are switched off for the
       check first: a headless run does not advance the animation clock, so a
       running transition would be sampled at its start value and report the
       previous skin's colour.  The picker rows are no longer an exception: their
       icon slots carry pictures of a skin rather than a painted swatch of its
       colour, and a picture is not a computed style. */
    (function () {
      var kill = document.createElement('style');
      kill.id = 'smoke-no-motion';
      kill.textContent = '*,*::before,*::after{transition:none !important;animation:none !important}';
      document.head.appendChild(kill);
      setSkin('gothic');
    })();
    var colourLeaks = [];
    step('skin: nothing on any page or sheet paints a colour', (function () {
      function grey(css) {
        var s = String(css || '').trim();
        if (!s || s === 'none' || s === 'transparent') return true;
        var m = /rgba?\(([^)]+)\)/.exec(s);
        if (!m) return true;
        var p = m[1].split(',');
        if (p.length > 3 && parseFloat(p[3]) === 0) return true;
        var r = parseFloat(p[0]), g = parseFloat(p[1]), b = parseFloat(p[2]);
        return Math.max(r, g, b) - Math.min(r, g, b) <= 6;
      }
      var props = ['color', 'backgroundColor', 'borderTopColor', 'borderRightColor',
        'borderBottomColor', 'borderLeftColor', 'outlineColor', 'stroke', 'fill',
        'boxShadow', 'textShadow'];
      var seen = {};
      function scan(tag) {
        $$('*').forEach(function (el) {
          var cs = getComputedStyle(el);
          props.forEach(function (p) {
            if (grey(cs[p])) return;
            var key = tag + '|' + el.tagName + '|' + (el.id || '') + '|' +
              (typeof el.className === 'string' ? el.className : '') + '|' + p + '|' + cs[p];
            if (seen[key]) return;
            seen[key] = 1;
            colourLeaks.push(key);
          });
        });
      }
      ['discover', 'mine', 'records', 'quiz'].forEach(function (pg) { setPage(pg); scan(pg); });
      ['sheetInfo', 'sheetEntry', 'sheetData'].forEach(function (sh) { openSheet(sh); scan(sh); closeSheet(sh); });
      setPage('discover');
      var kill = document.getElementById('smoke-no-motion');
      if (kill) kill.remove();
      return colourLeaks.length === 0;
    })(), colourLeaks.length ? colourLeaks.slice(0, 3).join('  /  ')
      : 'every painted colour is on the grey axis, on all four pages and all three sheets');

    /* ---- 16c. the spring skin: Primevere ---- */
    /* Where Gothic takes every colour away, Primevere brings a whole palette and
       a set of pictures with it, so these checks run the other way round: the
       page has to come out pale and green, the panels have to sit above it, and
       the artwork has to arrive with its colour intact.  A skin that only had
       to lose its colours could be half-built and still pass the suite above. */
    function channel(c) {
      var s = String(c).trim(), r, g, b;
      if (s.charAt(0) === '#') {
        var n = parseInt(s.slice(1), 16);
        r = (n >> 16) & 255; g = (n >> 8) & 255; b = n & 255;
      } else if (s.indexOf('rgb') === 0) {
        var p = s.slice(s.indexOf('(') + 1, s.length - 1).split(',');
        r = Number(p[0]); g = Number(p[1]); b = Number(p[2]);
      } else return null;
      return { r: r, g: g, b: b, lum: (r + g + b) / 3 };
    }
    setSkin('primevere');
    step('skin: primevere is applied as data-skin on <html>',
      document.documentElement.getAttribute('data-skin') === 'primevere',
      document.documentElement.getAttribute('data-skin'));
    step('skin: primevere applies every token it names, verbatim', (function () {
      var cs = getComputedStyle(document.documentElement);
      var vars = SKINS.primevere.vars;
      function same(a, b) {
        return String(a).replace(/\s+/g, ' ').trim() === String(b).replace(/\s+/g, ' ').trim();
      }
      for (var name in vars) {
        if (!same(cs.getPropertyValue(name), vars[name])) return name + ' = ' + cs.getPropertyValue(name);
      }
      return null;
    })() === null, Object.keys(SKINS.primevere.vars).length + ' tokens');
    step('skin: primevere replaces all four page-title icons with artwork', (function () {
      var list = document.querySelectorAll('.pagehead__icon[data-pageicon]');
      if (list.length !== 4) return false;
      for (var i = 0; i < list.length; i++) {
        var img = list[i].querySelector('img');
        if (!img || img.getAttribute('src').indexOf('data:image/png;base64,') !== 0) return false;
      }
      return true;
    })(), document.querySelectorAll('.pagehead__icon img').length + ' replaced');
    step('skin: primevere replaces all four tab-bar icons with artwork', (function () {
      var list = document.querySelectorAll('.tabbar__icon[data-pageicon]');
      if (list.length !== 4) return false;
      for (var i = 0; i < list.length; i++) {
        var img = list[i].querySelector('img');
        if (!img || img.getAttribute('src').indexOf('data:image/png;base64,') !== 0) return false;
      }
      return true;
    })(), document.querySelectorAll('.tabbar__icon img').length + ' replaced');
    step('skin: primevere swaps the wordmark for its gilt lettering', (function () {
      var img = document.querySelector('#brandName .brand__logo');
      return !!img && img.getAttribute('src').indexOf('data:image/png;base64,') === 0;
    })(), document.getElementById('brandName').innerHTML.slice(0, 40));
    step('skin: primevere fills the app bar slot',
      !!document.querySelector('#appbarSlot .appbar__slot-img'));
    step('skin: primevere repaints the browser chrome',
      document.querySelector('meta[name="theme-color"]').getAttribute('content') === '#4E8C4E',
      document.querySelector('meta[name="theme-color"]').getAttribute('content'));
    step('skin: primevere brings its own favicon',
      document.querySelector('link[rel="icon"]').getAttribute('href').indexOf('data:image/png;base64,') === 0);
    step('skin: the primevere row is the one marked active in the picker',
      document.querySelector('#skinPicker .skinopt.is-active').getAttribute('data-skin') === 'primevere');
    step('skin: primevere turns the page pale green and stands the cards on it', (function () {
      var page = channel(getComputedStyle(document.documentElement).getPropertyValue('--bg'));
      var card = channel(getComputedStyle(document.querySelector('#stage .card')).backgroundColor);
      if (!page || !card) return false;
      return page.g > page.r + 6 && page.g > page.b + 6 && page.lum > 200 && card.lum > page.lum;
    })(), 'page ' + getComputedStyle(document.documentElement).getPropertyValue('--bg') +
      ' vs card ' + getComputedStyle(document.querySelector('#stage .card')).backgroundColor);
    step('skin: the page-title art is drawn at the size the skin asked for', (function () {
      var el = document.querySelector('.pagehead__icon[data-pageicon="discover"]');
      var img = el.querySelector('img');
      var box = el.getBoundingClientRect(), art = img.getBoundingClientRect();
      return Math.round(box.width) === 34 && Math.round(art.width) === 34 &&
        Math.round(art.height) === 34;
    })(), 'header icon box ' +
      document.querySelector('.pagehead__icon').getBoundingClientRect().width + 'px');
    step('skin: primevere is not greyscale', (function () {
      var vars = SKINS.primevere.vars, chromatic = 0;
      for (var name in vars) {
        var m = String(vars[name]).trim();
        if (m.charAt(0) !== '#' || m.length !== 7) continue;
        var n = parseInt(m.slice(1), 16);
        if (Math.max((n >> 16) & 255, (n >> 8) & 255, n & 255) -
            Math.min((n >> 16) & 255, (n >> 8) & 255, n & 255) > 2) chromatic++;
      }
      return chromatic > 30;
    })(), 'coloured tokens in the table');

    setSkin('classic');
    step('skin: switching back to classic restores the built-in icons',
      !!document.querySelector('.pagehead__icon[data-pageicon="quiz"] svg'));
    step('skin: switching back to classic restores the favicon',
      document.querySelector('link[rel="icon"]').getAttribute('href').indexOf('data:image/svg+xml') === 0,
      document.querySelector('link[rel="icon"]').getAttribute('href').slice(0, 26));
    step('skin: switching back to classic drops the artwork',
      document.getElementById('appbarSlot').innerHTML === '' &&
      document.getElementById('brandName').textContent === 'LexiCards');

    /* a second skin can be added at runtime and takes over cleanly - that is
       the whole point of the registry, so prove it without shipping one */
    SKINS.midnight = {
      id: 'midnight', name: 'Midnight', note: 'test skin',
      vars: { '--primary': '#5B21B6', '--primary-dark': '#2E1065', '--highlight': '#FDE68A' },
      themeColor: '#5B21B6', androidStatus: '#2E1065',
      icons: { quiz: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/></svg>' },
      wordmark: 'LexiCards Night', appbarImage: 'data:image/gif;base64,R0lGODlhAQABAAAAACw='
    };
    setSkin('midnight');
    step('skin: a new skin takes over the colour tokens',
      getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() === '#5B21B6',
      getComputedStyle(document.documentElement).getPropertyValue('--primary').trim());
    step('skin: the new skin repaints the page icons', (function () {
      var el = document.querySelector('.pagehead__icon[data-pageicon="quiz"] svg');
      return !!el && el.querySelector('circle') !== null;
    })(), 'quiz icon replaced');
    step('skin: the new skin restyles the wordmark',
      document.getElementById('brandName').textContent === 'LexiCards Night',
      document.getElementById('brandName').textContent);
    step('skin: the new skin fills the app bar slot',
      !!document.querySelector('#appbarSlot .appbar__slot-img'));
    step('skin: the browser chrome follows the skin',
      document.querySelector('meta[name="theme-color"]').getAttribute('content') === '#5B21B6',
      document.querySelector('meta[name="theme-color"]').getAttribute('content'));
    step('skin: the choice is persisted', state.settings.skin === 'midnight' &&
      JSON.parse(localStorage.getItem('lexi.settings.v1')).skin === 'midnight', state.settings.skin);

    /* switching back must clear the overrides - a skin may not leak into the
       next one, which is the bug this catches */
    setSkin('classic');
    step('skin: switching back clears the previous skin overrides',
      getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() === '#1565C0',
      getComputedStyle(document.documentElement).getPropertyValue('--primary').trim());
    step('skin: the classic icons come back',
      !!document.querySelector('.pagehead__icon[data-pageicon="quiz"] svg path'));
    step('skin: the classic wordmark comes back',
      document.getElementById('brandName').textContent === 'LexiCards');
    step('skin: the app bar slot is empty again', document.getElementById('appbarSlot').innerHTML === '');
    step('skin: an unknown skin falls back to the default', (function () {
      setSkin('does-not-exist');
      return state.settings.skin === 'classic' && currentSkin().id === 'classic';
    })(), state.settings.skin);
    delete SKINS.midnight;

    /* ---- 17. the example highlight, including the case that was broken ---- */
    step('zh highlight: every sense of the gloss is tried, not just the first',
      markZhHits('我們放棄了這個計畫。', ['vt. 放棄', 'vt. 拋棄']).indexOf('ex-hit') > 0);
    step('zh highlight: a word the translator reworded is still lit up (hike -> 健行)',
      markZhHits('明天我們要去健行。', ['n. 徒步旅行', 'n. 遠足', 'n. 漲價'],
        { anchorText: 'We are to go on a hike tomorrow.', anchorTerm: 'hike' })
        .indexOf('健行') > 0 && markZhHits('明天我們要去健行。', ['n. 徒步旅行'],
          { anchorText: 'We are to go on a hike tomorrow.', anchorTerm: 'hike' }).indexOf('ex-hit') > 0,
      markZhHits('明天我們要去健行。', ['n. 徒步旅行'], { anchorText: 'We are to go on a hike tomorrow.', anchorTerm: 'hike' }));
    step('zh highlight: the term is found in its inflected form for the anchor',
      !!termAnchor('Birds are singing in the trees.', 'sing'),
      JSON.stringify(termAnchor('Birds are singing in the trees.', 'sing')));
    step('zh highlight: no guess is made when the term is not in the sentence',
      termAnchor('Nothing to see here.', 'hike') === null);
    step('zh highlight: a gloss with nothing in common still stays unhighlighted',
      markZhHits('這是一個例子。', '倫理', { anchorText: 'This is an example.', anchorTerm: 'ethical' })
        .indexOf('ex-hit') < 0);
    step('zh highlight: the example block uses the same helper',
      exampleZhHTML({ term: 'hike', zh: ['n. 徒步旅行'], example: 'We are to go on a hike tomorrow.',
        exampleZh: '明天我們要去健行。' }).indexOf('健行') > 0,
      exampleZhHTML({ term: 'hike', zh: ['n. 徒步旅行'], example: 'We are to go on a hike tomorrow.', exampleZh: '明天我們要去健行。' }));
  } catch (err) {
    R.ok = false;
    R.steps.push({ name: 'exception thrown', pass: false, info: String((err && err.stack) || err).slice(0, 400) });
  }
  finish();
}

window.addEventListener('load', function () { setTimeout(run, 150); });
