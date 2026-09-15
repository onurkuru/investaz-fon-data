/* InvestAZ Yatırım Fonları — widget (canlı-borsa / investaz-edge modeliyle aynı desen)
 * Kök: #investaz-fon-app  ·  Hub: #iaf-list-view  ·  Detay: #iaf-detail-view
 * API tabanı: bu script'in yüklendiği Worker (data-api ile geçersiz kılınabilir)
 */
(function () {
  "use strict";
  var ROOT_ID = "investaz-fon-app";
  var root = document.getElementById(ROOT_ID);
  if (!root) return;
  var script = document.currentScript || document.querySelector('script[src*="fon-app.js"]');
  var API = root.getAttribute("data-api") || (script && script.src ? script.src.replace(/\/assets\/.*$/, "") : "");
  var HUB = root.getAttribute("data-hub") || "/fon-fiyatlari";
  var SITE = "https://www.investaz.com.tr";
  var TYPE_LABEL = { YAT: "Yatırım Fonu", EMK: "BES Fonu", BYF: "Borsa Yatırım Fonu" };
  var TYPE_SLUG = { YAT: "yatirim-fonu", EMK: "bes-fonu", BYF: "borsa-yatirim-fonu" };

  /* ---------- biçimlendirme ---------- */
  var nfCache = {};
  function nf(min, max) { var k = min + ":" + max; return nfCache[k] || (nfCache[k] = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: min, maximumFractionDigits: max })); }
  function fmtPrice(v) { if (v == null || !isFinite(v)) return "-"; var a = Math.abs(v); var d = a >= 1000 ? 2 : a >= 1 ? 4 : a >= 0.01 ? 4 : 6; return nf(d, d).format(v); }
  function fmtNum(v, d) { if (v == null || !isFinite(v)) return "-"; d = d == null ? 2 : d; return nf(d, d).format(v); }
  function fmtPct(v, d) { if (v == null || !isFinite(v)) return "-"; d = d == null ? 2 : d; return (v > 0 ? "+" : v < 0 ? "−" : "") + "%" + nf(d, d).format(Math.abs(v)); }
  function fmtCompact(v) { if (v == null || !isFinite(v)) return "-"; var a = Math.abs(v); if (a >= 1e12) return nf(2, 2).format(v / 1e12) + " Tr"; if (a >= 1e9) return nf(2, 2).format(v / 1e9) + " Mr"; if (a >= 1e6) return nf(1, 1).format(v / 1e6) + " Mn"; if (a >= 1e3) return nf(0, 0).format(v / 1e3) + " B"; return nf(0, 0).format(v); }
  function fmtDate(iso, o) { if (!iso) return "-"; var d = new Date(iso.length === 10 ? iso + "T00:00:00" : iso); if (isNaN(d)) return iso; return new Intl.DateTimeFormat("tr-TR", o || { day: "numeric", month: "long", year: "numeric" }).format(d); }
  function pctClass(v) { return v > 0 ? "text-emerald-600 dark:text-emerald-400" : v < 0 ? "text-red-500 dark:text-red-400" : "text-gray-500 dark:text-gray-400"; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function trUpper(s) { return String(s || "").toLocaleUpperCase("tr-TR"); }
  function riskClass(r) { return !r ? "bg-gray-100 text-gray-500 dark:bg-iaz-dark dark:text-gray-400" : r >= 6 ? "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20" : r >= 4 ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"; }
  function riskText(r) { return !r ? "-" : r <= 2 ? "Düşük" : r <= 4 ? "Orta" : r <= 5 ? "Orta-Yüksek" : "Yüksek"; }
  var TR_MAP = { "ç": "c", "ğ": "g", "ı": "i", "ö": "o", "ş": "s", "ü": "u", "â": "a", "î": "i", "û": "u" };
  function slugify(name) { return String(name || "").toLocaleLowerCase("tr-TR").replace(/[çğıöşüâîû]/g, function (c) { return TR_MAP[c] || c; }).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80); }
  /* /fon-fiyatlari/fon/afa-ak-portfoy-amerika-yabanci-hisse-senedi-fonu (fvt/fintables gibi: kod + ad slug'ı URL'de) */
  var LINKMODE = root.getAttribute("data-linkmode") || "path"; // "query": CMS'te joker yol yoksa /fon?kod=AAL
  function fundUrl(code, name) {
    if (LINKMODE === "query") return HUB + "/fon?kod=" + String(code).toUpperCase();
    return HUB + "/fon/" + String(code).toLowerCase() + (name ? "-" + slugify(name) : "");
  }
  var SRC = root.getAttribute("data-src") || ""; // jsDelivr tabanı: veri script etiketiyle yüklenir (CSP script-src izinli, connect-src gerekmez)
  window.IAF_DATA = window.IAF_DATA || {};
  function loadScript(url) {
    return new Promise(function (res, rej) { var sc = document.createElement("script"); sc.src = url; sc.async = true; sc.onload = function () { res(); }; sc.onerror = function () { rej(new Error("script " + url)); }; document.head.appendChild(sc); });
  }
  /* path → veri. Worker modu: fetch(API+path). jsDelivr modu: /api/funds→funds.js, /fund/X→fon/X.js */
  function getJSON(path) {
    if (!SRC) return fetch(API + path, { headers: { Accept: "application/json" } }).then(function (r) { if (!r.ok) throw new Error(path + " -> " + r.status); return r.json(); });
    var m = path.match(/^\/fund\/([A-Z0-9]+)/);
    var key = path.indexOf("/api/funds") === 0 ? "funds" : m ? "fund:" + m[1] : path.replace(/^\//, "");
    var file = key === "funds" ? "funds.js" : m ? "fon/" + m[1] + ".js" : key + ".js";
    if (window.IAF_DATA[key]) return Promise.resolve(window.IAF_DATA[key]);
    return loadScript(SRC + "/" + file + "?v=" + Math.floor(Date.now() / 3600000)).then(function () { if (!window.IAF_DATA[key]) throw new Error(path + " -> veri yok"); return window.IAF_DATA[key]; });
  }
  function $(id) { return document.getElementById(id); }
  function setText(id, v) { var e = $(id); if (e) e.textContent = v; }
  function setHTML(id, v) { var e = $(id); if (e) e.innerHTML = v; }

  /* ---------- stil (widget'a özel, Tailwind dışı) ---------- */
  var css = "\
#" + ROOT_ID + " .iaf-section-nav{position:sticky;top:0;z-index:30;background:#fff;border-bottom:1px solid #DBDDEA;margin:0 -12px}\
#" + ROOT_ID + " .iaf-section-nav a{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#5D6674;padding:6px 10px;border-radius:8px;text-decoration:none;white-space:nowrap}\
#" + ROOT_ID + " .iaf-section-nav a:hover,#" + ROOT_ID + " .iaf-section-nav a.active{color:#008C98;background:rgba(0,140,152,.08)}\
@media (prefers-color-scheme:dark){#" + ROOT_ID + " .iaf-section-nav{background:#212229;border-color:#3d3e56}}\
#" + ROOT_ID + " .iaf-animate-in{animation:iafIn .35s ease-out both}@keyframes iafIn{from{opacity:.001;transform:translateY(6px)}to{opacity:1;transform:none}}\
@media (prefers-reduced-motion:reduce){#" + ROOT_ID + " .iaf-animate-in{animation:none}}\
#" + ROOT_ID + " .iaf-row{cursor:pointer;transition:background .15s}#" + ROOT_ID + " .iaf-row:hover{background:rgba(0,140,152,.05)}\
#" + ROOT_ID + " .iaf-bar{height:6px;border-radius:999px;background:rgba(0,140,152,.12);overflow:hidden}#" + ROOT_ID + " .iaf-bar>i{display:block;height:100%;background:#008C98;border-radius:999px}\
#" + ROOT_ID + " .iaf-range-btn{font-size:11px;font-weight:700;padding:4px 9px;border-radius:6px;color:#5D6674}#" + ROOT_ID + " .iaf-range-btn.active{background:rgba(0,140,152,.1);color:#008C98}\
#" + ROOT_ID + " .iaf-faq summary{cursor:pointer;font-weight:700;list-style:none}#" + ROOT_ID + " .iaf-faq summary::-webkit-details-marker{display:none}\
#" + ROOT_ID + " .iaf-faq details{border-top:1px solid rgba(219,221,234,.6);padding:10px 0}#" + ROOT_ID + " .iaf-faq details:first-child{border-top:0}\
#" + ROOT_ID + " .iaf-ring-fill{transition:stroke-dashoffset .8s ease-out}\
@media (max-width:767px){#" + ROOT_ID + " #iaf-fund-table th:nth-child(2),#" + ROOT_ID + " #iaf-fund-table td:nth-child(2),#" + ROOT_ID + " #iaf-fund-table th:nth-child(5),#" + ROOT_ID + " #iaf-fund-table td:nth-child(5),#" + ROOT_ID + " #iaf-fund-table th:nth-child(6),#" + ROOT_ID + " #iaf-fund-table td:nth-child(6),#" + ROOT_ID + " #iaf-fund-table th:nth-child(8),#" + ROOT_ID + " #iaf-fund-table td:nth-child(8){display:none}\
#" + ROOT_ID + " #iaf-fund-table th,#" + ROOT_ID + " #iaf-fund-table td{padding-left:6px;padding-right:6px;font-size:12px}#" + ROOT_ID + " #iaf-fund-table th{letter-spacing:.02em}#" + ROOT_ID + " #iaf-fund-table th:first-child{min-width:0}#" + ROOT_ID + " #iaf-fund-table td:first-child div{max-width:30vw}}\
@media (max-width:479px){#" + ROOT_ID + " #iaf-fund-table th:nth-child(9),#" + ROOT_ID + " #iaf-fund-table td:nth-child(9){display:none}}\
#" + ROOT_ID + " #iaf-fund-table tbody tr:nth-child(even){background:rgba(0,140,152,.02)}\
";
  var styleEl = document.createElement("style"); styleEl.id = "iaf-style"; styleEl.textContent = css; document.head.appendChild(styleEl);

  /* ---------- SEO yardımcıları ---------- */
  function setMeta(name, content, attr) {
    attr = attr || "name";
    var el = document.querySelector("meta[" + attr + '="' + name + '"]');
    if (!el) { el = document.createElement("meta"); el.setAttribute(attr, name); document.head.appendChild(el); }
    el.setAttribute("content", content);
  }
  function setCanonical(href) {
    var el = document.querySelector('link[rel="canonical"]');
    if (!el) { el = document.createElement("link"); el.setAttribute("rel", "canonical"); document.head.appendChild(el); }
    el.setAttribute("href", href);
  }
  function setJsonLd(id, obj) {
    var el = document.getElementById(id);
    if (!el) { el = document.createElement("script"); el.type = "application/ld+json"; el.id = id; document.head.appendChild(el); }
    el.textContent = JSON.stringify(obj);
  }

  /* ======================= HUB ======================= */
  var listView = $("iaf-list-view");
  var detailView = $("iaf-detail-view");
  var state = { funds: [], type: "YAT", q: "", cat: "", sort: "size", desc: true, limit: 150 };

  function initHub() {
    var typeFromPath = (location.pathname.match(/\/(bes-fonlari|borsa-yatirim-fonlari)/) || [])[1];
    state.type = typeFromPath === "bes-fonlari" ? "EMK" : typeFromPath === "borsa-yatirim-fonlari" ? "BYF" : (root.getAttribute("data-type") || "YAT");
    var qs = new URLSearchParams(location.search);
    if (qs.get("tur") && TYPE_LABEL[trUpper(qs.get("tur"))]) state.type = trUpper(qs.get("tur"));
    if (qs.get("kategori")) state.cat = qs.get("kategori");
    if (qs.get("q")) state.q = qs.get("q");
    bindHub();
    tickClock();
    setCanonical(SITE + (state.type === "EMK" ? HUB + "/bes-fonlari" : state.type === "BYF" ? HUB + "/borsa-yatirim-fonlari" : HUB));
    setMeta("robots", "index, follow, max-snippet:-1, max-image-preview:large");
    setMeta("og:type", "website", "property"); setMeta("og:site_name", "InvestAZ", "property"); setMeta("og:locale", "tr_TR", "property");
    getJSON("/api/funds").then(function (j) {
      state.funds = j.funds || [];
      setText("iaf-last-update", j.generatedAt ? fmtDate(j.generatedAt, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-");
      renderCats();
      renderTypeTabs();
      renderTable();
    }).catch(function (e) {
      setHTML("iaf-table-body", '<tr><td colspan="9" class="px-4 py-8 text-center text-sm text-gray-400">Fon verisi şu an yüklenemiyor. Lütfen sayfayı yenileyin.</td></tr>');
      console.warn("[iaf]", e);
    });
  }
  function tickClock() { var c = $("iaf-clock"); if (!c) return; function t() { c.textContent = new Date().toLocaleTimeString("tr-TR"); } t(); setInterval(t, 1000); }
  function bindHub() {
    var s = $("iaf-search");
    if (s) { s.value = state.q; s.addEventListener("input", function () { state.q = s.value; state.limit = 150; renderTable(); }); document.addEventListener("keydown", function (e) { if (e.key === "/" && document.activeElement !== s) { e.preventDefault(); s.focus(); } }); }
    var c = $("iaf-category"); if (c) c.addEventListener("change", function () { state.cat = c.value; state.limit = 150; renderTable(); });
    var more = $("iaf-more"); if (more) more.addEventListener("click", function () { state.limit += 200; renderTable(); });
  }
  function currentFunds() { return state.funds.filter(function (f) { return f.type === state.type; }); }
  function renderTypeTabs() {
    var el = $("iaf-type-tabs"); if (!el) return;
    var counts = {}; state.funds.forEach(function (f) { counts[f.type] = (counts[f.type] || 0) + 1; });
    el.innerHTML = ["YAT", "EMK", "BYF"].map(function (t) {
      var on = t === state.type;
      return '<button data-type="' + t + '" class="px-3.5 py-2 rounded-lg text-xs font-bold transition-all ' + (on ? "bg-iaz-cyan text-white shadow-sm" : "bg-white dark:bg-iaz-dark-card border border-iaz-mist dark:border-iaz-dark-border text-gray-600 dark:text-gray-300 hover:border-iaz-cyan/40") + '">' + TYPE_LABEL[t] + ' <span class="' + (on ? "text-white/70" : "text-gray-400") + '">' + (counts[t] || 0) + "</span></button>";
    }).join("");
    el.querySelectorAll("button").forEach(function (b) { b.addEventListener("click", function () { state.type = b.getAttribute("data-type"); state.cat = ""; state.limit = 150; renderCats(); renderTypeTabs(); renderTable(); }); });
  }
  function renderCats() {
    var sel = $("iaf-category"); if (!sel) return;
    var cats = {}; currentFunds().forEach(function (f) { if (f.category) cats[f.category] = (cats[f.category] || 0) + 1; });
    var keys = Object.keys(cats).sort(function (a, b) { return a.localeCompare(b, "tr"); });
    sel.innerHTML = '<option value="">Tüm Kategoriler (' + currentFunds().length + ")</option>" + keys.map(function (k) { return '<option value="' + esc(k) + '"' + (k === state.cat ? " selected" : "") + ">" + esc(k) + " (" + cats[k] + ")</option>"; }).join("");
  }
  var SORT_KEYS = { code: "code", category: "category", price: "price", dailyPct: "dailyPct", r1m: "r1m", ytd: "ytd", r1y: "r1y", size: "size", risk: "risk" };
  function sortBy(k) { if (state.sort === k) state.desc = !state.desc; else { state.sort = k; state.desc = k !== "code" && k !== "category"; } renderTable(); }
  function renderTable() {
    var body = $("iaf-table-body"); if (!body) return;
    var q = trUpper(state.q.trim());
    var rows = currentFunds().filter(function (f) { return (!state.cat || f.category === state.cat) && (!q || f.code.indexOf(q) >= 0 || trUpper(f.name).indexOf(q) >= 0); });
    var k = SORT_KEYS[state.sort] || "size";
    rows.sort(function (a, b) {
      var va = a[k], vb = b[k];
      if (typeof va === "string" || typeof vb === "string") { var r = String(va || "").localeCompare(String(vb || ""), "tr"); return state.desc ? -r : r; }
      if (va == null && vb == null) return 0; if (va == null) return 1; if (vb == null) return -1;
      return state.desc ? vb - va : va - vb;
    });
    Object.keys(SORT_KEYS).forEach(function (key) { var s = $("iaf-sort-" + key); if (s) s.textContent = state.sort === key ? (state.desc ? "▼" : "▲") : ""; });
    setText("iaf-table-count", nf(0, 0).format(rows.length) + " fon listeleniyor");
    var html = rows.slice(0, state.limit).map(function (f) {
      return '<tr class="iaf-row border-b border-gray-100 dark:border-iaz-dark-border/60" data-code="' + f.code + '" data-name="' + esc(f.name) + '">' +
        '<td class="px-4 py-3"><a href="' + fundUrl(f.code, f.name) + '" class="font-black text-gray-900 dark:text-gray-100 hover:text-iaz-cyan">' + f.code + '</a><div class="text-[11px] text-gray-400 dark:text-gray-500 truncate max-w-[280px]" title="' + esc(f.name) + '">' + esc(f.name) + "</div></td>" +
        '<td class="px-4 py-3"><span class="inline-block text-[10px] font-semibold px-2 py-0.5 rounded border border-gray-200 dark:border-iaz-dark-border text-gray-600 dark:text-gray-300 whitespace-nowrap">' + esc(f.category || "-") + "</span></td>" +
        '<td class="px-4 py-3 text-right font-bold tabular-nums text-gray-900 dark:text-gray-100">' + (f.price ? fmtPrice(f.price) : "-") + "</td>" +
        '<td class="px-4 py-3 text-right font-bold tabular-nums ' + pctClass(f.dailyPct) + '">' + fmtPct(f.dailyPct) + "</td>" +
        '<td class="px-4 py-3 text-right tabular-nums ' + pctClass(f.r1m) + '">' + fmtPct(f.r1m) + "</td>" +
        '<td class="px-4 py-3 text-right tabular-nums ' + pctClass(f.ytd) + '">' + fmtPct(f.ytd) + "</td>" +
        '<td class="px-4 py-3 text-right tabular-nums ' + pctClass(f.r1y) + '">' + fmtPct(f.r1y) + "</td>" +
        '<td class="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">' + (f.size ? fmtCompact(f.size) + " ₺" : "-") + "</td>" +
        '<td class="px-4 py-3 text-center"><span class="inline-block min-w-[26px] text-[11px] font-bold px-2 py-0.5 rounded-full ' + riskClass(f.risk) + '">' + (f.risk || "-") + "</span></td></tr>";
    }).join("");
    body.innerHTML = html || '<tr><td colspan="9" class="px-4 py-8 text-center text-sm text-gray-400">Aramanızla eşleşen fon bulunamadı.</td></tr>';
    body.querySelectorAll("tr.iaf-row").forEach(function (tr) { tr.addEventListener("click", function (e) { if (e.target.closest("a")) return; location.href = fundUrl(tr.getAttribute("data-code"), tr.getAttribute("data-name")); }); });
    var more = $("iaf-more"); if (more) { more.style.display = rows.length > state.limit ? "" : "none"; more.textContent = "Daha fazla göster (" + nf(0, 0).format(rows.length - state.limit) + ")"; }
    // hub SEO: tür/kategoriye göre başlık
    var t = TYPE_LABEL[state.type] === "Yatırım Fonu" ? "Yatırım Fonları" : TYPE_LABEL[state.type] === "BES Fonu" ? "BES Fonları" : "Borsa Yatırım Fonları";
    setMeta("description", t + (state.cat ? " — " + state.cat : "") + ": TEFAS güncel fiyatları, günlük, aylık ve yıllık getiriler, fon büyüklüğü ve risk değerleri. " + nf(0, 0).format(rows.length) + " fon.");
  }

  /* ======================= DETAY ======================= */
  var chart = { prices: [], range: "1Y" };
  var RANGES = { "1A": 30, "3A": 91, "6A": 182, "1Y": 365, "3Y": 1095, "Tümü": 100000 };

  function initDetail() {
    var qs0 = new URLSearchParams(location.search);
    var code = (root.getAttribute("data-code") || (location.pathname.match(/\/fon\/([A-Za-z0-9]{2,6})(?:-|\/|$)/) || [])[1] || qs0.get("kod") || qs0.get("fon") || "").toUpperCase();
    if (!/^[A-Z0-9]{2,6}$/.test(code)) code = ""; // TEFAS kodu 2-6 alfasayısal; başka her şey (ör. enjeksiyon denemesi) "kod yok" sayılır
    if (code) {
      // Veri gelmeden önce canonical/başlık (canlı-borsa "instant SEO" deseni): CMS'in ortak canonical'ını fon bazlı hale getirir
      document.querySelectorAll('link[rel="canonical"]').forEach(function (l, i) { if (i) l.remove(); });
      setCanonical(SITE + fundUrl(code)); // veri gelince slug'lı haliyle güncellenir
      if (!/\bFon\b/.test(document.title)) document.title = code + " Fon Fiyatı ve Getirisi | InvestAZ";
      setMeta("robots", "index, follow, max-snippet:-1, max-image-preview:large");
      setMeta("og:type", "article", "property"); setMeta("og:site_name", "InvestAZ", "property"); setMeta("og:locale", "tr_TR", "property");
    }
    if (!code) { // iskelete dokunma (CMS editörü kaydederse şablon bozulmasın); yalnız başlık alanına mesaj + noindex
      setText("iaf-det-name", "Fon kodu bulunamadı."); setHTML("iaf-summary-text", '<p>Adreste fon kodu yok. <a class="text-iaz-cyan font-semibold" href="' + HUB + '">Fon listesinden</a> bir fon seçin.</p>'); setMeta("robots", "noindex, follow"); return;
    }
    setText("iaf-det-code", code);
    var nav = $("iaf-section-nav"); if (nav) { nav.style.display = ""; nav.querySelectorAll("a").forEach(function (a) { a.addEventListener("click", function (e) { e.preventDefault(); var t = document.querySelector(a.getAttribute("href")); if (t) t.scrollIntoView({ behavior: "smooth", block: "start" }); }); }); }
    var back = $("iaf-back"); if (back) back.addEventListener("click", function () { if (document.referrer && document.referrer.indexOf(HUB) >= 0) history.back(); else location.href = HUB; });
    getJSON("/fund/" + code).then(renderDetail).catch(function (e) {
      console.warn("[iaf]", e);
      setText("iaf-det-name", "Bu fon için veri bulunamadı.");
      setHTML("iaf-summary-text", '<p>' + code + ' koduyla TEFAS\'ta işlem gören bir fon bulunamadı. Kodu kontrol edin veya <a class="text-iaz-cyan font-semibold" href="' + HUB + '">fon listesinden</a> seçin.</p>');
      setMeta("robots", "noindex, follow");
    });
  }

  function renderDetail(f) {
    var code = f.code, name = f.name || "", tl = TYPE_LABEL[f.type] || "Fon";
    var typeHub = f.type === "EMK" ? HUB + "/bes-fonlari" : f.type === "BYF" ? HUB + "/borsa-yatirim-fonlari" : HUB;
    setText("iaf-det-code", code);
    setText("iaf-bc-code", code);
    setText("iaf-det-name", name);
    setText("iaf-det-cat", f.category || tl);
    setText("iaf-det-type", tl);
    setText("iaf-det-company", f.company || "");
    // risk halkası
    var r = f.risk || 0; var ring = $("iaf-ring-fill"); if (ring) ring.style.strokeDashoffset = String(314 - (314 * r) / 7);
    setText("iaf-ring-score", r ? String(r) : "-"); setText("iaf-ring-text", r ? "RİSK " + riskText(r) : "RİSK");
    if (ring) ring.setAttribute("stroke", r >= 6 ? "#ef4444" : r >= 4 ? "#f59e0b" : "#10b981");
    // fiyat
    setText("iaf-det-price", f.price ? fmtPrice(f.price) + " TL" : "-");
    var ch = $("iaf-det-change"); if (ch) { ch.textContent = fmtPct(f.dailyPct) + (f.dailyPct != null ? " (günlük)" : ""); ch.className = "text-base md:text-lg font-bold tabular-nums " + pctClass(f.dailyPct); }
    setText("iaf-det-date", f.date ? "Fiyat tarihi: " + fmtDate(f.date) : "");
    setText("iaf-tefas-label", code);
    // metrik kartlar
    var m = { "iaf-m-daily": [fmtPct(f.dailyPct), pctClass(f.dailyPct)], "iaf-m-1m": [fmtPct(f.r1m), pctClass(f.r1m)], "iaf-m-ytd": [fmtPct(f.ytd), pctClass(f.ytd)], "iaf-m-1y": [fmtPct(f.r1y), pctClass(f.r1y)], "iaf-m-size": [f.size ? fmtCompact(f.size) + " ₺" : "-", ""], "iaf-m-investors": [f.investors ? nf(0, 0).format(f.investors) : "-", ""] };
    Object.keys(m).forEach(function (id) { var e = $(id); if (!e) return; e.textContent = m[id][0]; e.className = "text-xl font-black " + (m[id][1] || "text-gray-900 dark:text-gray-100"); });
    // grafik
    chart.prices = f.prices || [];
    renderRangeButtons(); drawChart();
    // getiri tablosu
    var rets = [["1 Hafta", ret(chart.prices, 7)], ["1 Ay", f.r1m != null ? f.r1m : ret(chart.prices, 30)], ["3 Ay", f.r3m != null ? f.r3m : ret(chart.prices, 91)], ["6 Ay", f.r6m != null ? f.r6m : ret(chart.prices, 182)], ["Yılbaşından", f.ytd], ["1 Yıl", f.r1y != null ? f.r1y : ret(chart.prices, 365)], ["3 Yıl", f.r3y], ["5 Yıl", f.r5y]];
    setHTML("iaf-returns", rets.map(function (x) { return '<div class="flex items-center justify-between py-2 border-b border-iaz-mist/60 dark:border-iaz-dark-border/60 last:border-0"><span class="text-xs font-semibold text-gray-500 dark:text-gray-400">' + x[0] + '</span><span class="text-sm font-black tabular-nums ' + pctClass(x[1]) + '">' + fmtPct(x[1]) + "</span></div>"; }).join(""));
    // dağılım
    var alloc = (f.allocation || []).slice(0, 10);
    setHTML("iaf-alloc", alloc.length ? alloc.map(function (a) { return '<div class="mb-2.5"><div class="flex justify-between text-xs mb-1"><span class="text-gray-700 dark:text-gray-300 font-medium">' + esc(a.label) + '</span><span class="font-bold tabular-nums text-gray-900 dark:text-gray-100">%' + fmtNum(a.pct, 2) + '</span></div><div class="iaf-bar"><i style="width:' + Math.min(100, a.pct) + '%"></i></div></div>'; }).join("") : '<p class="text-sm text-gray-400">Dağılım verisi henüz yok.</p>');
    setText("iaf-alloc-note", alloc.length ? "TEFAS son açıklanan portföy dağılımı, varlık sınıfı bazında." : "");
    // fon bilgileri
    var info = [["Fon Kodu", code], ["Fon Türü", tl], ["Kategori", f.category || "-"], ["Kurucu / Yönetici", f.company || "-"], ["Kategori Sırası (1 Yıl)", f.rank && f.rankOf ? f.rank + " / " + f.rankOf : "-"], ["Risk Değeri", r ? r + " / 7 (" + riskText(r) + ")" : "-"], ["Fon Büyüklüğü", f.size ? fmtNum(f.size, 0) + " ₺" : "-"], ["Yatırımcı Sayısı", f.investors ? nf(0, 0).format(f.investors) : "-"], ["Tedavüldeki Pay", f.shares ? fmtCompact(f.shares) : "-"], ["ISIN", f.isin || "-"], ["Son Fiyat Tarihi", f.date ? fmtDate(f.date) : "-"], ["Kategorideki Fon Sayısı", f.catCount ? String(f.catCount) : "-"]];
    setHTML("iaf-info", info.map(function (x) { return '<div class="bg-iaz-smoke/60 dark:bg-iaz-dark/40 rounded-lg px-3.5 py-2.5"><div class="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide">' + x[0] + '</div><div class="text-sm font-bold text-gray-900 dark:text-gray-100 mt-0.5 break-words">' + esc(x[1]) + "</div></div>"; }).join(""));
    var kap = $("iaf-kap-link"); if (kap) { if (f.kapLink) { kap.href = f.kapLink; kap.style.display = ""; } else kap.style.display = "none"; }
    // benzer fonlar
    var sim = (f.similar && f.similar.category) || [];
    setText("iaf-similar-title", f.category ? "Aynı Kategorideki Fonlar — " + f.category : "Benzer Fonlar");
    setHTML("iaf-similar-body", sim.length ? sim.map(function (s) { return '<tr class="iaf-row border-b border-gray-100 dark:border-iaz-dark-border/60" data-code="' + s.code + '" data-name="' + esc(s.name) + '"><td class="px-4 py-2.5"><a href="' + fundUrl(s.code, s.name) + '" class="font-black text-gray-900 dark:text-gray-100 hover:text-iaz-cyan">' + s.code + '</a><div class="text-[11px] text-gray-400 truncate max-w-[260px]">' + esc(s.name) + '</div></td><td class="px-4 py-2.5 text-right tabular-nums font-bold">' + (s.price ? fmtPrice(s.price) : "-") + '</td><td class="px-4 py-2.5 text-right tabular-nums ' + pctClass(s.r1m) + '">' + fmtPct(s.r1m) + '</td><td class="px-4 py-2.5 text-right tabular-nums ' + pctClass(s.r1y) + '">' + fmtPct(s.r1y) + '</td><td class="px-4 py-2.5 text-right tabular-nums text-gray-600 dark:text-gray-300">' + (s.size ? fmtCompact(s.size) + " ₺" : "-") + "</td></tr>"; }).join("") : '<tr><td colspan="5" class="px-4 py-6 text-center text-sm text-gray-400">Aynı kategoride başka fon bulunamadı.</td></tr>');
    document.querySelectorAll("#iaf-similar-body tr.iaf-row").forEach(function (tr) { tr.addEventListener("click", function (e) { if (e.target.closest("a")) return; location.href = fundUrl(tr.getAttribute("data-code"), tr.getAttribute("data-name")); }); });
    var co = (f.similar && f.similar.company) || [];
    setHTML("iaf-company-funds", co.length ? '<div class="text-xs font-bold text-gray-500 dark:text-gray-400 mb-2">' + esc(f.company) + " yönetimindeki diğer fonlar</div>" + co.map(function (s) { return '<a href="' + fundUrl(s.code, s.name) + '" class="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border border-iaz-mist dark:border-iaz-dark-border text-gray-700 dark:text-gray-300 hover:border-iaz-cyan hover:text-iaz-cyan mr-1.5 mb-1.5" title="' + esc(s.name) + '">' + s.code + ' <span class="' + pctClass(s.ytd) + '">' + fmtPct(s.ytd, 1) + "</span></a>"; }).join("") : "");
    var catLink = $("iaf-cat-link"); if (catLink) { catLink.href = typeHub + (f.category ? "?kategori=" + encodeURIComponent(f.category) : ""); catLink.textContent = f.category ? "Tüm " + f.category + " fonları" : "Tüm fonlar"; }
    // yorum metni (veriye dayalı, şablon)
    setHTML("iaf-summary-text", summaryText(f));
    // SSS
    var faq = faqFor(f);
    setHTML("iaf-faq", faq.map(function (x) { return "<details><summary class=\"text-sm text-gray-800 dark:text-gray-200 flex items-center justify-between gap-3\"><span>" + esc(x.q) + '</span><span class="text-iaz-cyan text-lg leading-none">+</span></summary><p class="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mt-2 mb-0">' + esc(x.a) + "</p></details>"; }).join(""));
    // SEO
    var title = code + " Fon Fiyatı " + (f.price ? fmtPrice(f.price) + " TL" : "") + (f.dailyPct != null ? " (" + fmtPct(f.dailyPct) + ")" : "") + " | " + name + " | InvestAZ";
    document.title = title;
    var desc = code + " " + name + " güncel fiyatı " + (f.price ? fmtPrice(f.price) + " TL" : "-") + ". Günlük " + fmtPct(f.dailyPct) + ", 1 aylık " + fmtPct(f.r1m) + ", yılbaşından " + fmtPct(f.ytd) + ", 1 yıllık " + fmtPct(f.r1y) + ". Büyüklük " + (f.size ? fmtCompact(f.size) + " ₺" : "-") + ", risk " + (r || "-") + "/7. TEFAS fon getirileri ve portföy dağılımı.";
    var canon = SITE + fundUrl(code, name);
    setMeta("description", desc); setMeta("og:title", title, "property"); setMeta("og:description", desc, "property"); setMeta("og:url", canon, "property");
    setCanonical(canon);
    if (!f.price) setMeta("robots", "noindex, follow");
    setJsonLd("iaf-ld-breadcrumb", { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Ana Sayfa", item: SITE + "/" }, { "@type": "ListItem", position: 2, name: "Fon Fiyatları", item: SITE + HUB }, { "@type": "ListItem", position: 3, name: code + " " + name, item: canon }] });
    setJsonLd("iaf-ld-product", { "@context": "https://schema.org", "@type": "InvestmentFund", name: name, alternateName: code, identifier: f.isin || code, category: f.category || tl, url: canon, provider: { "@type": "Organization", name: f.company || "" }, offers: { "@type": "Offer", price: f.price || undefined, priceCurrency: "TRY", availability: "https://schema.org/InStock", seller: { "@type": "Organization", name: "InvestAZ Yatırım Menkul Değerler A.Ş.", url: SITE } }, annualPercentageRate: f.r1y != null ? { "@type": "QuantitativeValue", value: Math.round(f.r1y * 100) / 100, unitText: "PERCENT" } : undefined });
    setJsonLd("iaf-ld-faq", { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faq.map(function (x) { return { "@type": "Question", name: x.q, acceptedAnswer: { "@type": "Answer", text: x.a } }; }) });
    observeSections();
  }

  function ret(prices, days) {
    if (!prices || prices.length < 2) return null;
    var last = prices[prices.length - 1]; var target = new Date(new Date(last.d).getTime() - days * 864e5).toISOString().slice(0, 10);
    if (prices[0].d > target) return null;
    var base = prices[0]; for (var i = 0; i < prices.length; i++) { if (prices[i].d <= target) base = prices[i]; else break; }
    return ((last.c - base.c) / base.c) * 100;
  }
  function summaryText(f) {
    var code = f.code, r = f.risk || 0, parts = [];
    parts.push("<strong>" + esc(code) + "</strong> (" + esc(f.name) + "), " + (f.company ? "<strong>" + esc(f.company) + "</strong> tarafından yönetilen" : "TEFAS'ta işlem gören") + " bir <strong>" + esc(f.category || TYPE_LABEL[f.type] || "fon") + "</strong>dur." + (f.size ? " Fon büyüklüğü <strong>" + fmtCompact(f.size) + " ₺</strong>" + (f.investors ? ", yatırımcı sayısı <strong>" + nf(0, 0).format(f.investors) + "</strong>" : "") + "." : ""));
    if (f.price) parts.push("Son açıklanan birim pay fiyatı <strong>" + fmtPrice(f.price) + " TL</strong>" + (f.dailyPct != null ? " (günlük " + fmtPct(f.dailyPct) + ")" : "") + (f.date ? ", " + fmtDate(f.date) + " tarihli." : "."));
    var ytd = f.ytd, y1 = f.r1y;
    if (ytd != null || y1 != null) parts.push("Getiri: yılbaşından bugüne <strong>" + fmtPct(ytd) + "</strong>" + (y1 != null ? ", son 1 yılda <strong>" + fmtPct(y1) + "</strong>" : "") + (f.rank && f.rankOf ? "; kategorisindeki " + f.rankOf + " fon arasında 1 yıllık getiride <strong>" + f.rank + ". sırada</strong>." : "."));
    if (r) parts.push("SPK risk değeri <strong>" + r + "/7</strong> (" + riskText(r).toLocaleLowerCase("tr-TR") + " risk); " + (r <= 2 ? "fiyat dalgalanması düşük, kısa vadeli birikim için tercih edilen sınıfta." : r <= 4 ? "orta düzeyde dalgalanma; dengeli portföylerde yer alan sınıfta." : "yüksek dalgalanma; uzun vadeli ve riske toleranslı yatırımcılara uygun sınıfta."));
    var top = (f.allocation || [])[0]; if (top) parts.push("Portföyün en büyük kalemi <strong>" + esc(top.label) + " (%" + fmtNum(top.pct, 1) + ")</strong>.");
    return parts.map(function (p) { return "<p>" + p + "</p>"; }).join("");
  }
  function faqFor(f) {
    var code = f.code, r = f.risk || 0, out = [];
    out.push({ q: code + " fonu ne kadar kazandırdı?", a: code + " fonu yılbaşından bugüne " + fmtPct(f.ytd) + ", son 1 ayda " + fmtPct(f.r1m) + ", son 1 yılda " + fmtPct(f.r1y) + " getiri sağladı. Geçmiş getiri gelecekteki getirinin garantisi değildir." });
    out.push({ q: code + " fonunun güncel fiyatı nedir?", a: "Son açıklanan birim pay fiyatı " + (f.price ? fmtPrice(f.price) + " TL" : "henüz yayımlanmadı") + (f.date ? " (" + fmtDate(f.date) + ")" : "") + ". TEFAS fon fiyatları her iş günü bir kez açıklanır." });
    out.push({ q: code + " fonu nasıl alınır?", a: code + " fonu TEFAS'ta işlem gördüğü için InvestAZ hesabınızla e-şube veya mobil uygulama üzerinden alınıp satılabilir. Alım ve satım talimatları fonun izahnamesindeki valör süresine göre gerçekleşir." });
    if (r) out.push({ q: code + " fonu riskli mi?", a: code + " fonunun SPK risk değeri " + r + "/7'dir; bu " + riskText(r).toLocaleLowerCase("tr-TR") + " risk sınıfına karşılık gelir. Risk değeri fonun geçmiş fiyat dalgalanmasına göre hesaplanır." });
    if (f.category) out.push({ q: code + " hangi kategoride?", a: code + ", TEFAS sınıflandırmasında \"" + f.category + "\" kategorisindedir" + (f.catCount ? "; bu kategoride " + f.catCount + " fon bulunur." : ".") });
    return out;
  }

  function renderRangeButtons() {
    var el = $("iaf-ranges"); if (!el) return;
    el.innerHTML = Object.keys(RANGES).map(function (k) { return '<button class="iaf-range-btn' + (k === chart.range ? " active" : "") + '" data-r="' + k + '">' + k + "</button>"; }).join("");
    el.querySelectorAll("button").forEach(function (b) { b.addEventListener("click", function () { chart.range = b.getAttribute("data-r"); renderRangeButtons(); drawChart(); }); });
  }
  function drawChart() {
    var host = $("iaf-chart"); if (!host) return;
    var all = chart.prices; if (!all || all.length < 2) { host.innerHTML = '<div class="h-[220px] flex items-center justify-center text-sm text-gray-400">Fiyat geçmişi henüz çekilmedi.</div>'; return; }
    var days = RANGES[chart.range] || 365; var last = all[all.length - 1];
    var cutoff = new Date(new Date(last.d).getTime() - days * 864e5).toISOString().slice(0, 10);
    var pts = all.filter(function (p) { return p.d >= cutoff; }); if (pts.length < 2) pts = all;
    var W = 800, H = 260, pl = 58, pr = 10, pt = 12, pb = 26;
    var vals = pts.map(function (p) { return p.c; }); var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals); if (min === max) { min -= 1; max += 1; }
    var pad = (max - min) * 0.06; min -= pad; max += pad;
    var x = function (i) { return pl + (i * (W - pl - pr)) / (pts.length - 1); }, y = function (v) { return pt + ((max - v) * (H - pt - pb)) / (max - min); };
    var d = pts.map(function (p, i) { return (i ? "L" : "M") + x(i).toFixed(1) + "," + y(p.c).toFixed(1); }).join(" ");
    var up = vals[vals.length - 1] >= vals[0]; var col = up ? "#10b981" : "#ef4444";
    var area = d + " L" + x(pts.length - 1).toFixed(1) + "," + (H - pb) + " L" + x(0).toFixed(1) + "," + (H - pb) + " Z";
    var ticks = ""; for (var i = 0; i <= 4; i++) { var v = min + ((max - min) * i) / 4; ticks += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + y(v) + '" y2="' + y(v) + '" stroke="currentColor" stroke-opacity=".12"/><text x="' + (pl - 6) + '" y="' + (y(v) + 4) + '" font-size="11" text-anchor="end" fill="currentColor" fill-opacity=".6">' + fmtPrice(v) + "</text>"; }
    var xi = [0, Math.floor(pts.length / 3), Math.floor((2 * pts.length) / 3), pts.length - 1];
    var xl = xi.map(function (i) { return '<text x="' + x(i) + '" y="' + (H - 6) + '" font-size="11" fill="currentColor" fill-opacity=".6" text-anchor="' + (i === 0 ? "start" : i === pts.length - 1 ? "end" : "middle") + '">' + fmtDate(pts[i].d, { day: "numeric", month: "short", year: "2-digit" }) + "</text>"; }).join("");
    var chg = ((vals[vals.length - 1] - vals[0]) / vals[0]) * 100;
    host.innerHTML = '<div class="flex items-center justify-between px-1 pb-2 text-xs text-gray-500 dark:text-gray-400"><span>' + fmtDate(pts[0].d, { day: "numeric", month: "short", year: "numeric" }) + " – " + fmtDate(last.d, { day: "numeric", month: "short", year: "numeric" }) + '</span><span class="font-bold ' + pctClass(chg) + '">' + fmtPct(chg) + '</span></div><svg viewBox="0 0 ' + W + " " + H + '" class="w-full h-auto text-gray-700 dark:text-gray-300" preserveAspectRatio="none" role="img" aria-label="' + esc($("iaf-det-code") ? $("iaf-det-code").textContent : "") + ' fiyat grafiği"><defs><linearGradient id="iafg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="' + col + '" stop-opacity=".22"/><stop offset="1" stop-color="' + col + '" stop-opacity="0"/></linearGradient></defs>' + ticks + '<path d="' + area + '" fill="url(#iafg)"/><path d="' + d + '" fill="none" stroke="' + col + '" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>' + xl + "</svg>";
  }
  function observeSections() {
    var nav = $("iaf-section-nav"); if (!nav || !("IntersectionObserver" in window)) return;
    var links = nav.querySelectorAll("a"); var map = {};
    links.forEach(function (a) { map[a.getAttribute("href").slice(1)] = a; });
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { links.forEach(function (a) { a.classList.remove("active"); }); var a = map[e.target.id]; if (a) a.classList.add("active"); } }); }, { rootMargin: "-40% 0px -55% 0px" });
    Object.keys(map).forEach(function (id) { var t = $(id); if (t) io.observe(t); });
  }

  window.IAF = { sort: sortBy, state: state };
  // Editör koruması: CMS editörü/önizlemesi yapıştırılan HTML'i çalıştırırsa widget DOM'a dokunmasın;
  // aksi halde editör, widget'ın değiştirdiği DOM'u kaydeder ve statik iskelet (SEO fallback) bozulur.
  var inEditor = document.designMode === "on" || !!root.closest("[contenteditable]") || location.pathname.indexOf(HUB) !== 0;
  if (inEditor) { try { console.warn("[iaf] editör/önizleme bağlamı, widget çalıştırılmadı:", location.pathname); } catch (e) {} return; }
  if (detailView) initDetail(); else if (listView) initHub();
})();
