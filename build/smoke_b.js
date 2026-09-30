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
  } catch (err) {
    R.ok = false;
    R.steps.push({ name: 'exception thrown', pass: false, info: String((err && err.stack) || err).slice(0, 400) });
  }
  finish();
}

window.addEventListener('load', function () { setTimeout(run, 150); });
