// 在舊版打包站台（Chang-Shu-H-main/index.html）的導覽列加入「營養照護紀錄」頁籤。
// 打包檔沒有原始碼，所以由部署流程在 </body> 前插入本檔，不改動打包檔本身。
(function () {
  var TAB_CLASS = 'px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 text-slate-400 hover:text-slate-200 cursor-pointer';
  var ICON = '<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/></svg>';
  var hashHandled = false;

  function tabButton(label) {
    var nav = document.getElementById('hospital_navbar');
    if (!nav) return null;
    var bs = nav.querySelectorAll('button');
    for (var i = 0; i < bs.length; i++) if (bs[i].textContent.trim() === label) return bs[i];
    return null;
  }

  function ensureTab() {
    var nutri = tabButton('營養部');
    if (!nutri) return;
    var group = nutri.parentElement;
    // 與營養照護紀錄頁的導覽列保持一致：營養照護紀錄、歷史紀錄查詢
    var HIST_ICON = '<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>';
    var NEW = '<span style="margin-left:6px;font-size:9px;line-height:14px;padding:0 4px;border-radius:4px;background:#34d399;color:#022c22;font-family:\'JetBrains Mono\',monospace">NEW</span>';
    function addTab(attr, href, icon, label) {
      if (group.querySelector('[' + attr + ']')) return;
      var a = document.createElement('a');
      a.href = href;
      a.setAttribute(attr, '');
      a.className = TAB_CLASS;
      a.style.textDecoration = 'none';
      a.innerHTML = icon + '<span>' + label + '</span>' + NEW;
      group.appendChild(a);
    }
    addTab('data-nutrition-form', 'nutrition.html', ICON, '營養照護紀錄');
    addTab('data-nutrition-history', 'nutrition.html?page=history', HIST_ICON, '歷史紀錄查詢');
    // 從營養照護紀錄頁返回時（./#nutritionist）直接切到營養部
    if (!hashHandled) {
      hashHandled = true;
      if (location.hash === '#nutritionist') nutri.click();
    }
  }

  new MutationObserver(ensureTab).observe(document.documentElement, { childList: true, subtree: true });
  ensureTab();
})();
