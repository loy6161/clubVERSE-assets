'use strict';
/* VERSE CITY 設定エディタ（画面の案 v3 に沿った実装・修正1）
   読み書き: GitHub API（キーはこのブラウザの localStorage にだけ保存）。
   試験モード: URL に ?test=1 を付けたときだけ。通信先を同じオリジンの /__fakegh（手元のダミー）にする。api.github.com には何も送らない。 */

const PAGES_BASE = 'https://loy6161.github.io/clubVERSE-assets/';
const CFG_PATH = 'images/sphere/config.json';
const LS_KEY = 'svcfg.v1';
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fmtB = n => n >= 1048576 ? (n / 1048576).toFixed(2) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
const clone = v => JSON.parse(JSON.stringify(v));
const deepEq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const jstr = v => { try { return JSON.stringify(v); } catch (e) { return String(v); } };

/* ---------- 設定（ブラウザ内だけ。試験モードは URL の ?test=1 のときだけで、保存しない） ---------- */
const S = { token: '', repo: 'loy6161/clubVERSE', branch: 'main', test: false, comp: {}, dith: {} };
function loadSettings() {
  try { const o = JSON.parse(localStorage.getItem(LS_KEY) || '{}'); ['token', 'repo', 'branch', 'comp', 'dith'].forEach(k => { if (o[k] !== undefined && o[k] !== null) S[k] = o[k]; }); } catch (e) { }
  try { S.test = new URLSearchParams(location.search).get('test') === '1'; } catch (e) { }
}
function persistSettings() {
  if (S.test) return;   // 試験モードでは何も書き残さない
  try { localStorage.setItem(LS_KEY, JSON.stringify({ token: S.token, repo: S.repo, branch: S.branch, comp: S.comp, dith: S.dith })); } catch (e) { }
}

/* ---------- 選択肢 ---------- */
const ROOF = [
  { v: 0, n: '閉じる', s: '' },
  { v: 1, n: '客席側だけ開く', s: '' },
  { v: 3, n: 'ステージ側だけ開く', s: '' },
  { v: 2, n: '全開', s: '客席側＋ステージ側' }];
const CEIL_NAMES = { 0: 'ガラス', 1: '天空', 2: 'プラネタリウム', 3: '宇宙', 5: '深海', 7: 'オーロラ', 9: '桜', 10: 'アリーナ', 11: '動画', 12: '廃墟', 13: '海辺', 15: '星空', 16: '中世', 17: '九龍城', 18: '砂浜', 19: '月夜', 20: '海底', 21: 'スタジアム', 22: '雪の街' };
const CEIL_GRAD = { 0: '#9fd3e6,#e8f6fb', 11: '#444,#999' };
const CEIL_MODES = Object.keys(CEIL_NAMES).map(Number);
const FX = [
  { v: 0, n: 'なし', s: 'Off' },
  { v: 1, n: '基本', s: 'Post Processing' },
  { v: 2, n: 'Bloom 明るめ', s: 'Switch_1' },
  { v: 3, n: 'カメラ用（やや暗い）', s: 'Switch_3 CAMERA用' },
  { v: 4, n: '暗め・Bloom 強い', s: 'Switch_5' },
  { v: 5, n: 'ライブ用（暖色）', s: 'Switch_4_forLIVE' }];
const MOTION = ['ゆっくり楕円', '速い楕円', '左右スイープ', 'ステージ集中', '客席に散らす', '真上', '真下', 'ピンスポット'];
const COLORS = [
  { v: 0, n: '暖白', c: '#FFE1B7' }, { v: 1, n: '白', c: '#FFFFFF' }, { v: 2, n: '青白', c: '#C5E5FF' }, { v: 3, n: '赤', c: '#FF3B30' },
  { v: 4, n: 'オレンジ', c: '#FF7A1A' }, { v: 5, n: '琥珀', c: '#FFB020' }, { v: 6, n: '黄緑', c: '#B4FF3C' }, { v: 7, n: '緑', c: '#3CFF6E' },
  { v: 8, n: '水色', c: '#46D8FF' }, { v: 9, n: '青', c: '#4169E1' }, { v: 10, n: '紫', c: '#9400D3' }, { v: 11, n: 'ピンク', c: '#FF5FA8' }];
const COLOR_SPECIAL = [{ v: 12, n: '曲に合わせる' }, { v: 13, n: 'パレット' }, { v: 14, n: '映像の色' }, { v: 15, n: '天井の色' }];
const COLOR_LIGHT = new Set([0, 1, 2, 5, 6, 7, 8, 11]);   // 明るい色は黒文字
const MAX_MEM = 16, MAX_SETS = 24;
// メモリーの 5 項目: [キー, 最大値, 表示名]（最大値はワールド SphereVersePresetMemory.cs と同じ）
const MEMF = [['roof', 3, '屋根'], ['ceiling', 22, '天井'], ['fx', 5, 'ポストエフェクト'], ['motion', 7, '照明の動き'], ['color', 15, '照明の色']];

/* ---------- ポスターのケース（大きさは今の実ファイルの実測。枚ごとの実寸は data.js の FILESZ） ---------- */
const rng = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const p2 = n => String(n).padStart(2, '0');
const CASES = [
  { k: 'info1_5', n: 'INFO 1-5', sz: '810×1080', w: 810, h: 1080, f: rng(1, 5).map(i => 'Info/INFO' + p2(i) + '.png') },
  { k: 'info6_10', n: 'INFO 6-10', sz: '810×1080', w: 810, h: 1080, f: ['06', '07', '08', '09', '10'].map(i => 'Info/INFO' + i + '.png') },
  { k: 'weekly', n: 'WEEKLY', sz: '810×1080（WEEK5 は 763×1080）', w: 810, h: 1080, f: rng(1, 5).map(i => 'thisMonth/WEEK' + i + '.png') },
  { k: 'today', n: 'TODAY', sz: '1440×1920', w: 1440, h: 1920, f: ['thisMonth/TODAY.png'] },
  { k: 'members', n: 'MEMBERS', sz: '810×1080 前後（枚ごとに 761〜811 の幅）', w: 810, h: 1080, f: rng(0, 19).map(i => 'Member/L' + p2(i) + '.png') },
  { k: 'cd', n: 'CD BOOTH', sz: '500×500（CD01 は 506×500）／ POST は 764×1080 前後', w: 500, h: 500, f: ['CD/CD01.png', 'CD/CD02.png', 'CD/CD03.png', 'CD/CD04.png', 'CD/CD08.png', ...rng(1, 4).map(i => 'CD/POST' + p2(i) + '.png')] },
  { k: 'info11_15', n: 'INFO 11-15', sz: '810×1080', w: 810, h: 1080, f: rng(11, 15).map(i => 'Info/INFO' + i + '.png') },
  { k: 'info_wide1_3', n: 'INFO WIDE 1-3', sz: '1080×608', w: 1080, h: 608, f: rng(1, 3).map(i => 'Info/INFO_WIDE' + p2(i) + '.png') },
  { k: 'info_wide4_6', n: 'INFO WIDE 4-6', sz: '1080×608', w: 1080, h: 608, f: rng(4, 6).map(i => 'Info/INFO_WIDE' + p2(i) + '.png') },
  { k: 'info_wide7_9', n: 'INFO WIDE 7-9', sz: '1080×608', w: 1080, h: 608, f: rng(7, 9).map(i => 'Info/INFO_WIDE' + p2(i) + '.png') }];
const POSTER_KEYS = CASES.map(c => c.k);
// 差し替え先の大きさ: 今の実ファイルの寸法（FILESZ）。無い物（新しい枠）はケースの基準
function sizeOfFile(c, f) { const z = (typeof FILESZ !== 'undefined') && FILESZ[f]; return z ? [z[0], z[1]] : [c.w, c.h]; }
const caseOf = k => CASES.find(c => c.k === k);

// 色数の段階（UPNG は 257 色以上だとフルカラーになるので、256 色までにする）
const LEVELS = {
  strong: { n: '強め（64 色・絵が荒れることがあります）', cnum: 64 },
  std: { n: '標準（128 色）', cnum: 128 },
  weak: { n: '弱め（256 色）', cnum: 256 }
};
const defLevel = k => k === 'today' ? 'weak' : 'std';
const levelOf = k => (S.comp && LEVELS[S.comp[k]]) ? S.comp[k] : defLevel(k);
const dithOf = k => (S.dith && S.dith[k] !== undefined) ? !!S.dith[k] : true;
const FITN = { cover: '中央で切り取る', contain: '全体を収める（余白は透明）', stretch: '引き伸ばす' };

/* ---------- 状態 ---------- */
const st = {
  baseCfg: null, baseText: '', cfgSha: null, source: '', readOnly: false, rev: 1,
  posters: {}, basePosters: {}, mems: [], baseMems: [], sets: [], baseSets: [], nextId: 1,
  pending: new Map(), skyUrls: {}, topBad: [], shas: null, local: {}, tv: String(Date.now())
};
let selMem = null, selSlot = [0, 0], selCase = 'info1_5', selImg = null, selBoard = null, selFloor = 1;
let up = null, bulk = null, same = null;

const memOf = id => st.mems.find(x => x.id === id);
const memByName = n => st.mems.find(x => x.name === n);

/* ---------- アセット URL ---------- */
// サムネの URL には「中身ごとに変わる印」を付ける（同じ URL のままだとブラウザ／CDN のキャッシュで古い絵が出るため）。
// 印 = Git の木から取った blob sha の先頭 8 桁。取れなかった（キーが無い等）ときは、読み込みごとの時刻。
// 保存した直後は、保存した画像（手元のデータ）をそのまま出す。
function assetUrl(path) {
  if (st.local[path]) return st.local[path];
  const v = st.shas && st.shas[path] ? st.shas[path].slice(0, 8) : st.tv;
  return (S.test ? 'mock-repo/' : PAGES_BASE) + path + '?v=' + v;
}
async function loadShas() {
  st.shas = null; st.tv = String(Date.now());
  Object.values(st.local).forEach(u => URL.revokeObjectURL(u)); st.local = {};
  if (!canApi()) return;
  try {
    const ref = await gh('GET', `/repos/${S.repo}/git/ref/heads/${branchPath()}`);
    const c = await gh('GET', `/repos/${S.repo}/git/commits/${ref.object.sha}`);
    const t = await gh('GET', `/repos/${S.repo}/git/trees/${c.tree.sha}?recursive=1`);
    if (t.truncated || !Array.isArray(t.tree)) return;
    const m = {}; t.tree.forEach(e => { if (e.type === 'blob' && e.path.startsWith('images/')) m[e.path] = e.sha; });
    st.shas = m;
  } catch (e) { st.shas = null; }
}
const blobShaCache = new WeakMap();
async function gitBlobSha(bytes) {
  if (blobShaCache.has(bytes)) return blobShaCache.get(bytes);
  const head = new TextEncoder().encode('blob ' + bytes.length + ' '); const all = new Uint8Array(head.length + bytes.length); all.set(head); all.set(bytes, head.length);
  const h = await crypto.subtle.digest('SHA-1', all); const hex = [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('');
  blobShaCache.set(bytes, hex); return hex;
}
function skyThumb(mode) {
  const a = st.skyUrls[mode]; if (!a || typeof a[0] !== 'string') return null;
  const u = a[0].startsWith(PAGES_BASE) ? a[0].slice(PAGES_BASE.length) : null;
  return u ? assetUrl(u) : a[0];
}
// CSS の url("…") に入れる文字列を壊れないようにする（config.json は外から書き換えられうる値）
const cssUrl = u => 'url("' + String(u).replace(/["\\\n\r()<>]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')) + '")';
// style 属性に入れる値を返す。使う側は style="${esc(thStyle(n))}" と必ずエスケープする
const thStyle = n => {
  const u = skyThumb(n);
  if (u) return 'background-image:' + cssUrl(u);
  return `background-image:linear-gradient(135deg,${CEIL_GRAD[n] || '#556,#99a'})`;
};
const thAttr = n => `style="${esc(thStyle(n))}"`;

/* ---------- GitHub API ---------- */
const apiBase = () => S.test ? location.origin + '/__fakegh' : 'https://api.github.com';
const tokenNow = () => S.test ? 'dummy-test-token' : S.token;
const canApi = () => S.test || !!S.token;
const encPath = p => String(p).split('/').map(encodeURIComponent).join('/');
const branchPath = () => encPath(S.branch);          // ブランチ名の「/」は壊さない
function ghJa(status, raw) {
  if (status === 401) return 'キーが正しくないか、期限が切れています。「設定（キー）」でキーを入れ直してください。';
  if (status === 403) return /rate limit/i.test(raw) ? 'GitHub の利用回数の上限に達しました。しばらく待ってからやり直してください。' : 'このキーには、この操作の権限がありません。キーの権限（Contents: Read and write）と、対象のリポジトリを確認してください。';
  if (status === 404) return 'リポジトリ・ブランチ・ファイルのどれかが見つかりません。リポジトリ名とブランチ名を確認してください。キーが別のリポジトリ専用だと、404 になることもあります。';
  if (status === 409) return '別の変更とぶつかりました。「読み直す」でやり直してください。';
  if (status === 422) return /fast.?forward/i.test(raw) ? 'この画面を開いたあとに、ブランチが先へ進んでいました。「読み直す」でやり直してください（いまの変更は消えます）。' : 'GitHub が内容を受け付けませんでした。';
  if (status >= 500) return 'GitHub 側の一時的な不具合です。少し待ってからやり直してください。';
  return 'GitHub から想定外の返事がありました。';
}
async function gh(method, path, body) {
  let r;
  try {
    r = await fetch(apiBase() + path, {
      method,
      headers: Object.assign({ Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + tokenNow(), 'X-GitHub-Api-Version': '2022-11-28' }, body ? { 'Content-Type': 'application/json' } : {}),
      body: body ? JSON.stringify(body) : undefined, cache: 'no-store'
    });
  } catch (e) {
    const er = new Error(String(e.message || e)); er.ja = '通信できませんでした。ネットワークにつながっているか、ブラウザの拡張機能が止めていないか確認してください。'; er.raw = String(e.message || e); throw er;
  }
  let j = null; try { j = await r.json(); } catch (e) { }
  if (!r.ok) {
    const raw = (j && j.message) || ('HTTP ' + r.status);
    const e = new Error(raw); e.status = r.status; e.raw = 'HTTP ' + r.status + ' ' + raw; e.ja = ghJa(r.status, raw); throw e;
  }
  return j;
}
// 日本語の説明 ＋ 原文（小さく）
const errHtml = e => `${esc(e.ja || e.message)}${e.raw && e.ja ? `<br><small style="opacity:.75">原文: ${esc(e.raw)}</small>` : ''}`;
function b64Utf8(b64) { const bin = atob(b64.replace(/\n/g, '')); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new TextDecoder('utf-8').decode(u); }
function bytesB64(u8) { let s = ''; const C = 0x8000; for (let i = 0; i < u8.length; i += C) s += String.fromCharCode.apply(null, u8.subarray(i, i + C)); return btoa(s); }

/* ---------- 読み込み ---------- */
function toast(t) { const e = $('toast'); e.textContent = t; e.style.display = 'block'; clearTimeout(toast.t); toast.t = setTimeout(() => e.style.display = 'none', 2600); }

async function loadAll() {
  $('topMsg').innerHTML = '<div class="banner info">読み込み中…</div>';
  let text, sha = null, src;
  st.readOnly = false;
  try {
    if (canApi()) {
      const j = await gh('GET', `/repos/${S.repo}/contents/${encPath(CFG_PATH)}?ref=${encodeURIComponent(S.branch)}`);
      text = b64Utf8(j.content); sha = j.sha;
      src = S.test ? '試験モード: 手元のダミー（本番と同じ写し）から読み込みました' : `GitHub（${S.repo} の ${S.branch}）から読み込みました`;
    } else {
      const r = await fetch(PAGES_BASE + CFG_PATH + '?t=' + Date.now(), { cache: 'no-store' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      text = await r.text(); st.readOnly = true;
      src = '公開されている config.json を表示しています（キーが未設定なので保存はできません。「設定（キー）」で入れてください）';
    }
  } catch (e) {
    if (canApi() && !S.test) {
      try {
        const r = await fetch(PAGES_BASE + CFG_PATH + '?t=' + Date.now(), { cache: 'no-store' });
        text = await r.text(); st.readOnly = true; sha = null;
        src = null;
        st.srcErr = e;
      } catch (e2) { $('topMsg').innerHTML = `<div class="banner err">読み込めませんでした: ${errHtml(e)}</div>`; return false; }
    } else { $('topMsg').innerHTML = `<div class="banner err">読み込めませんでした: ${errHtml(e)}</div>`; return false; }
  }
  let cfg;
  try { cfg = JSON.parse(text); } catch (e) { $('topMsg').innerHTML = `<div class="banner err">config.json が JSON として読めません: ${esc(e.message)}</div>`; return false; }
  st.cfgSha = sha;
  await loadShas();
  initFromConfig(cfg, text);
  if (src === null) {
    st.source = '';
    $('topMsg').innerHTML = `<div class="banner warn">GitHub から読み込めませんでした。公開されている config.json を表示しています。保存はできません。キーとリポジトリ名を確認してください。<br>${errHtml(st.srcErr)}</div>`;
  } else {
    st.source = src;
    $('topMsg').innerHTML = `<div class="banner ${st.readOnly ? 'warn' : 'info'}">${esc(src)}</div>`;
  }
  return true;
}

/* config.json → 画面の状態。読めない値は直さずに「不正」として持ち、画面で赤く出す。配列の位置は詰めない。 */
function readMemField(v, max, key) {
  if (v === undefined || v === null || v === -1) return { v: -1 };
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > max) return { v: -1, bad: true };
  if (key === 'ceiling' && CEIL_NAMES[v] == null) return { v: -1, bad: true };
  return { v };
}
function parseMem(p) {
  const id = st.nextId++;
  if (!isObj(p)) return { id, name: '', roof: -1, ceiling: -1, fx: -1, motion: -1, color: -1, bad: {}, rawEntry: p, raw: null, n0: null };
  const m = { id, name: typeof p.name === 'string' ? p.name : '', name0: typeof p.name === 'string' ? p.name : '', roof: -1, ceiling: -1, fx: -1, motion: -1, color: -1, bad: {}, raw: clone(p), n0: {} };
  if ('name' in p && p.name !== null && typeof p.name !== 'string') m.bad.name = p.name;
  MEMF.forEach(([k, max]) => { const r = readMemField(p[k], max, k); m[k] = r.v; m.n0[k] = r.v; if (r.bad) m.bad[k] = p[k]; });
  return m;
}
function parseSet(s, byName) {
  if (!isObj(s)) return { name: '', name0: '', p: [null, null, null, null], rawEntry: s, raw: null, info: {} };
  const rawP = s.presets, rawM = s.memories, info = {};
  if (rawP !== undefined && rawP !== null && !Array.isArray(rawP)) info.badP = true;
  if (rawM !== undefined && rawM !== null && !Array.isArray(rawM)) info.badM = true;
  const aP = Array.isArray(rawP) ? rawP : [], aM = Array.isArray(rawM) ? rawM : [];
  if (aP.length > 4) info.extraP = true;
  if (aM.length > 4) info.extraM = true;
  const p = [null, null, null, null];
  for (let i = 0; i < 4; i++) {
    const nm = aM[i], nu = aP[i]; let why = null;
    if (nm !== undefined && nm !== null && typeof nm !== 'string') why = `memories の ${i + 1} 番目 ${jstr(nm)} が文字列ではありません`;
    else if (nu !== undefined && nu !== null && (typeof nu !== 'number' || !Number.isInteger(nu) || nu < -1)) why = `presets の ${i + 1} 番目 ${jstr(nu)} が整数ではありません`;
    if (why) { p[i] = { t: 'bad', why, rawP: nu, rawM: nm }; continue; }
    if (typeof nm === 'string' && nm !== '') {
      if (byName.has(nm)) p[i] = { t: 'm', id: byName.get(nm), pv: typeof nu === 'number' ? nu : -1 };
      else p[i] = { t: 'miss', v: nm };
    } else if (typeof nu === 'number' && nu >= 0) p[i] = { t: 'old', v: nu };
  }
  const name = typeof s.name === 'string' ? s.name : '';
  return { name, name0: name, p, raw: clone(s), info };
}
function initFromConfig(cfg, text) {
  st.baseCfg = clone(cfg); st.baseText = text; st.topBad = [];
  st.posters = {};
  const P = cfg.posters;
  if (P !== undefined && !Array.isArray(P) && !isObj(P)) st.topBad.push('posters が { } でも [ ] でもありません');
  POSTER_KEYS.forEach(k => st.posters[k] = Array.isArray(P) ? P.includes(k) : (isObj(P) && P[k] === true));
  st.basePosters = Object.assign({}, st.posters);
  st.skyUrls = {};
  if (isObj(cfg.sky)) Object.keys(cfg.sky).forEach(k => { if (Array.isArray(cfg.sky[k]) && cfg.sky[k].length) st.skyUrls[+k] = cfg.sky[k]; });
  st.mems = []; st.nextId = 1;
  if (cfg.presets !== undefined && !Array.isArray(cfg.presets)) st.topBad.push('presets が配列（[ ]）ではありません');
  (Array.isArray(cfg.presets) ? cfg.presets : []).forEach(p => st.mems.push(parseMem(p)));
  st.baseMems = clone(st.mems);
  const byName = new Map(); st.mems.forEach(m => { if (!('rawEntry' in m) && !byName.has(m.name)) byName.set(m.name, m.id); });
  if (cfg.sets !== undefined && !Array.isArray(cfg.sets)) st.topBad.push('sets が配列（[ ]）ではありません');
  st.sets = (Array.isArray(cfg.sets) ? cfg.sets : []).map(s => parseSet(s, byName));
  st.sets.forEach(s => { if (s.p) s.p.forEach(sl => { if (sl && sl.t === 'm') { const mm = memOf(sl.id); if (mm && sl.pv !== mm.ceiling) sl.mis = sl.pv; } }); });
  st.baseSets = clone(st.sets);
  st.pending.forEach(v => v.url && URL.revokeObjectURL(v.url)); st.pending.clear();
  selMem = st.mems.length ? st.mems[0].id : null; selSlot = [0, 0]; up = null; bulk = null; selImg = null; selBoard = null;
}

/* ---------- 画面の状態 → config.json（読み込んで何も変えなければ、元と一字一句同じ） ---------- */
function memOut(m) {
  if ('rawEntry' in m) return m.rawEntry;
  const out = m.raw ? clone(m.raw) : {};
  if (m.bad.name !== undefined) out.name = m.bad.name; else if (!m.raw || m.name !== m.name0) out.name = m.name;
  MEMF.forEach(([k]) => {
    if (m.bad[k] !== undefined) { out[k] = m.bad[k]; return; }
    const cur = m[k];
    if (k in out) { if (!(m.n0 && m.n0[k] === cur)) out[k] = cur; }
    else if (cur !== -1 || !m.raw) out[k] = cur;
  });
  return out;
}
const norm4 = (arr, fill) => { const a = Array.isArray(arr) ? arr.slice(0, 4) : []; while (a.length < 4) a.push(fill); return a.map(v => v == null ? fill : v); };
function slotNumbers(s) {
  return {
    p: s.p.map(sl => !sl ? -1 : sl.t === 'm' ? ((memOf(sl.id) || {}).ceiling ?? -1) : sl.t === 'old' ? sl.v : sl.t === 'bad' ? (sl.rawP ?? -1) : -1),
    m: s.p.map(sl => !sl ? '' : sl.t === 'm' ? ((memOf(sl.id) || {}).name ?? '') : sl.t === 'miss' ? sl.v : sl.t === 'bad' ? (sl.rawM ?? '') : '')
  };
}
function setOut(s) {
  if ('rawEntry' in s) return s.rawEntry;
  const out = s.raw ? clone(s.raw) : {};
  if (!s.raw || s.name !== s.name0) out.name = s.name;
  const g = slotNumbers(s);
  // presets: 天井の mode 番号（数値）4 枠。位置を保ち、-1 は空き・変えない（ワールドの背景の先読みが読む）
  if (!s.raw || !deepEq(norm4(s.raw.presets, -1), g.p)) out.presets = g.p;
  // memories: 枠ごとのメモリーの名前 4 枠（空きは ""）。元が旧形式で、選び直していなければ足さない
  if (!s.raw || !deepEq(norm4(s.raw.memories, ''), g.m)) out.memories = g.m;
  return out;
}
function postersOut() {
  const b = st.baseCfg.posters;
  if (Array.isArray(b)) {
    const out = [];
    b.forEach(x => { if (typeof x === 'string' && POSTER_KEYS.includes(x)) { if (st.posters[x]) out.push(x); } else out.push(x); });
    POSTER_KEYS.forEach(k => { if (st.posters[k] && !out.includes(k)) out.push(k); });
    return out;
  }
  const bo = isObj(b) ? b : {}, out = {};
  Object.keys(bo).forEach(k => {
    if (k === 'info_wide') out[k] = (!!st.posters.info_wide1_3 !== !!st.basePosters.info_wide1_3) ? !!st.posters.info_wide1_3 : bo[k];
    else if (POSTER_KEYS.includes(k)) out[k] = ((bo[k] === true) === !!st.posters[k]) ? bo[k] : !!st.posters[k];
    else out[k] = bo[k];
  });
  POSTER_KEYS.forEach(k => { if (!(k in bo) && st.posters[k]) out[k] = true; });
  return out;
}
function buildConfig() {
  const base = st.baseCfg || {};
  const pOut = postersOut(), presets = st.mems.map(memOut), sets = st.sets.map(setOut);
  const nP = Array.isArray(pOut) ? pOut.length : Object.keys(pOut).length;
  const want = { posters: 'posters' in base || nP > 0, presets: 'presets' in base || presets.length > 0, sets: 'sets' in base || sets.length > 0 };
  const out = {}; let pre = false;
  Object.keys(base).forEach(k => {
    if (k === 'posters') out.posters = pOut;
    else if (k === 'presets') { out.presets = presets; pre = true; }
    else if (k === 'sets') { if (!pre && !('presets' in base) && want.presets) { out.presets = presets; pre = true; } out.sets = sets; }
    else out[k] = base[k];
  });
  if (!('posters' in out) && want.posters) out.posters = pOut;
  if (!('presets' in out) && want.presets) out.presets = presets;
  if (!('sets' in out) && want.sets) out.sets = sets;
  return out;
}
function configText() {
  const b = buildConfig();
  if (st.baseCfg && jstr(b) === jstr(st.baseCfg)) return st.baseText;   // 何も変えていなければ元のまま
  return JSON.stringify(b, null, 2) + '\n';
}

/* ---------- 差分 ---------- */
const roofLabel = v => v < 0 ? '変えない' : (ROOF.find(r => r.v === v) || { n: '?' }).n;
const ceilLabel = v => v < 0 ? '変えない' : (CEIL_NAMES[v] != null ? CEIL_NAMES[v] : 'mode ' + v);
const fxLabel = v => v < 0 ? '変えない' : (FX.find(f => f.v === v) || { n: '?' }).n;
const motLabel = v => v < 0 ? '変えない' : (MOTION[v] || '?');
const colorLabel = v => v < 0 ? '変えない' : ((COLORS.find(c => c.v === v) || COLOR_SPECIAL.find(c => c.v === v) || { n: '?' }).n);
const LAB = { roof: roofLabel, ceiling: ceilLabel, fx: fxLabel, motion: motLabel, color: colorLabel };
const memFieldLabel = (m, k) => m.bad && m.bad[k] !== undefined ? '不正な値 ' + jstr(m.bad[k]) : LAB[k](m[k]);
function slotLabelOf(sl, memsSrc) {
  if (sl == null) return '空き';
  if (sl.t === 'old') return `旧形式: 天井 ${ceilLabel(sl.v)}`;
  if (sl.t === 'miss') return sl.v + '（見つかりません）';
  if (sl.t === 'bad') return '不正な値';
  const m = (memsSrc || st.mems).find(x => x.id === sl.id); return m ? m.name : '?';
}
function computeChanges() {
  const ch = [];
  CASES.forEach(c => { if (!!st.posters[c.k] !== !!st.basePosters[c.k]) ch.push({ t: 'poster', h: `ポスター <b>${esc(c.n)}</b>: ${st.basePosters[c.k] ? '最初から読む' : '最初は読まない'} → <b>${st.posters[c.k] ? '最初から読む' : '最初は読まない'}</b>` }); });
  const bm = new Map(st.baseMems.map(m => [m.id, m]));
  st.mems.forEach((m, i) => {
    const b = bm.get(m.id);
    if (!b) { ch.push({ t: 'mem', cls: 'add', h: `メモリー追加: <b>${esc(m.name)}</b>（屋根 ${roofLabel(m.roof)} / 天井 ${ceilLabel(m.ceiling)} / ポストエフェクト ${fxLabel(m.fx)} / 照明の動き ${motLabel(m.motion)} / 照明の色 ${colorLabel(m.color)}）` }); return; }
    if ('rawEntry' in m) return;
    const d = [];
    if (b.name !== m.name) d.push(`名前 ${esc(b.name)} → ${esc(m.name)}`);
    MEMF.forEach(([k, , nm]) => { const x = memFieldLabel(b, k), y = memFieldLabel(m, k); if (x !== y) d.push(`${nm} ${esc(x)} → ${esc(y)}`); });
    if (d.length) ch.push({ t: 'mem', h: `メモリー変更 <b>${esc(b.name)}</b>: ${d.join(' / ')}` });
  });
  st.baseMems.forEach(b => { if (!st.mems.find(m => m.id === b.id)) ch.push({ t: 'mem', cls: 'del', h: `メモリー削除: <b>${esc(b.name)}</b>` }); });
  const n = Math.max(st.sets.length, st.baseSets.length);
  for (let i = 0; i < n; i++) {
    const a = st.baseSets[i], b = st.sets[i];
    if (!a) { ch.push({ t: 'set', cls: 'add', h: `組を追加: <b>${esc(b.name)}</b>（${b.p.map(x => esc(slotLabelOf(x))).join(' / ')}）` }); continue; }
    if (!b) { ch.push({ t: 'set', cls: 'del', h: `組を削除: <b>${esc(a.name)}</b>` }); continue; }
    const d = [];
    if (a.name !== b.name) d.push(`名前 ${esc(a.name)} → ${esc(b.name)}`);
    for (let j = 0; j < 4; j++) {
      const la = slotLabelOf(a.p[j], st.baseMems), lb = slotLabelOf(b.p[j]);
      if (la !== lb) d.push(`メモリー${j + 1}: ${esc(la)} → ${esc(lb)}`);
    }
    if (d.length) ch.push({ t: 'set', h: `組 ${i + 1} <b>${esc(b.name)}</b>: ${d.join(' / ')}` });
  }
  const bp = st.baseCfg && st.baseCfg.posters;
  if (isObj(bp) && 'info_wide' in bp && !!st.posters.info_wide1_3 !== !!st.basePosters.info_wide1_3) ch.push({ t: 'poster', h: `旧キー <b>info_wide</b>（古いワールド用）: ${bp.info_wide} → <b>${!!st.posters.info_wide1_3}</b>（INFO WIDE 1-3 に合わせます）` });
  pendGroups().forEach(g => { const v = g.d, path = g.paths[0];
    if (v.unchanged) { ch.push({ t: 'imgsame', cls: 'noop', h: `<b>${g.paths.length > 1 ? '同じ画像 × ' + g.paths.length + ' 枠（' + esc(groupNames(g.paths)) + '）' : esc(path)}</b>: 今のファイルと同じ画像なので、保存しません` }); return; }
    if (g.paths.length > 1) ch.push({ t: 'img', h: `画像を差し替え: <b>同じ画像 × ${g.paths.length} 枠（${esc(groupNames(g.paths))}）</b>（${fmtB(v.bytes.length)}）<br><small>${esc(g.paths.join(' ／ '))}<br>方式: ${esc(v.methodLabel)} ・ はみ出し: ${esc(v.fitText)}</small>` });
    else ch.push({ t: 'img', h: `画像を差し替え: <b>${esc(path)}</b>（${v.beforeSize ? fmtB(v.beforeSize) + ' → ' : ''}${fmtB(v.bytes.length)}）<br><small>方式: ${esc(v.methodLabel)} ・ はみ出し: ${esc(v.fitText)}</small>` }); });
  if (!ch.length && configText() !== st.baseText) ch.push({ t: 'other', h: 'config.json の中身が変わります（下の差分を見てください）' });
  return ch;
}
function updateDirty() {
  const n = computeChanges().length;
  $('dirty').textContent = '未保存の変更: ' + n + ' 件';
  $('saveBtn').disabled = false;
  json();
  return n;
}

/* ---------- 検証（不正値は黙って直さず、保存を止める） ---------- */
function memProblems(m) {
  const e = [];
  if ('rawEntry' in m) { e.push(`この項目は、メモリーの形式（{ } のかたまり）ではありません: ${jstr(m.rawEntry)}。削除してください`); return e; }
  if (m.bad.name !== undefined) e.push(`名前 ${jstr(m.bad.name)} が文字列ではありません。入れ直してください`);
  else if (!m.name.trim()) e.push('名前が空です');
  MEMF.forEach(([k, max, nm]) => { if (m.bad[k] !== undefined) e.push(`${nm}の値 ${jstr(m.bad[k])} が正しくありません（0〜${max}${k === 'ceiling' ? ' のうち使える番号' : ''}、または「変えない」）。選び直してください`); });
  if (!Object.keys(m.bad).length && m.roof < 0 && m.ceiling < 0 && m.fx < 0 && m.motion < 0 && m.color < 0) e.push('5 項目ぜんぶ「変えない」です。ワールドはこのメモリーを無視します（何か 1 つ選ぶか、削除してください）');
  if (m.roof > 0 && m.ceiling > 0) e.push('屋根を開くときは、天井をガラスか「変えない」にしてください（没入型の天井は屋根を閉じます）');
  return e;
}
function memDup(m) { return !('rawEntry' in m) && m.name.trim() && st.mems.filter(x => !('rawEntry' in x) && x.name.trim() === m.name.trim()).length > 1; }
function validate() {
  const errors = [], warns = [];
  st.topBad.forEach(t => errors.push('config.json: ' + t + '。直してから保存してください'));
  if (st.mems.length > MAX_MEM) errors.push(`メモリーは最大 ${MAX_MEM} 個です（いま ${st.mems.length} 個）`);
  st.mems.forEach((m, i) => {
    const label = `メモリー ${i + 1}${m.name ? '「' + m.name + '」' : ''}`;
    memProblems(m).forEach(t => errors.push(`${label}: ${t}`));
    if (memDup(m)) errors.push(`${label}: 名前が他のメモリーと重なっています（組からは名前で呼ぶので、重ならないようにしてください）`);
    if (m.name.length > 40) warns.push(`${label}: 名前が 40 文字を超えています（ワールドでは 40 文字までで切れます）`);
  });
  if (st.sets.length > MAX_SETS) errors.push(`出演者の組は最大 ${MAX_SETS} 個です`);
  st.sets.forEach((s, i) => {
    if ('rawEntry' in s) { errors.push(`組 ${i + 1}: { } のかたまりではありません: ${jstr(s.rawEntry)}。削除してください`); return; }
    if (s.info.badP) errors.push(`組 ${i + 1}「${s.name}」: presets が配列ではありません`);
    if (s.info.badM) errors.push(`組 ${i + 1}「${s.name}」: memories が配列ではありません`);
    if (s.info.extraP || s.info.extraM) warns.push(`組 ${i + 1}「${s.name}」: presets / memories に 5 個目以降があります。ワールドは読みません（この組を変えて保存すると消えます）`);
    s.p.forEach((sl, j) => {
      if (sl && sl.t === 'miss') errors.push(`組 ${i + 1}「${s.name}」のメモリー ${j + 1}「${sl.v}」が見つかりません。選び直してください`);
      if (sl && sl.t === 'bad') errors.push(`組 ${i + 1}「${s.name}」のメモリー ${j + 1}: ${sl.why}。選び直してください`);
      if (sl && sl.t === 'old') warns.push(`組 ${i + 1}「${s.name}」のメモリー ${j + 1} は旧形式（天井 ${ceilLabel(sl.v)} だけ）です。メモリーを選び直すまで、そのまま数値で残ります`);
      if (sl && sl.t === 'm' && sl.mis !== undefined) { const m = memOf(sl.id); warns.push(`組 ${i + 1}「${s.name}」のメモリー ${j + 1}: presets の数値（${sl.mis}）がメモリーの天井（${m ? m.ceiling : '?'}）と食い違っています。保存すると天井に合わせます`); }
    });
    if (!s.name.trim()) warns.push(`組 ${i + 1} の名前が空です`);
  });
  try { JSON.parse(configText()); } catch (e) { errors.push('config.json が JSON になりません: ' + e.message); }
  return { errors, warns };
}

/* ---------- 画面: 出演者の組 ---------- */
const slotPre = sl => { const m = sl && sl.t === 'm' ? memOf(sl.id) : null; return !!m && m.ceiling < 0; };
function renderSets() {
  $('setsBox').innerHTML = st.sets.length ? st.sets.map((s, i) => {
    if ('rawEntry' in s) return `<div class="set"><div class="banner err">${i + 1} 番目は組の形式（{ } のかたまり）ではありません: <code>${esc(jstr(s.rawEntry))}</code> <button class="sm danger" onclick="delSet(${i})">削除</button></div></div>`;
    return `<div class="set">
  <div class="hd"><span class="tag">${i + 1}番目</span><input type="text" value="${esc(s.name)}" oninput="st.sets[${i}].name=this.value;updateDirty()">
   <button class="sm" onclick="mv(${i},-1)">↑</button><button class="sm" onclick="mv(${i},1)">↓</button><button class="sm danger" onclick="delSet(${i})">削除</button></div>
  <div class="slots">${s.p.map((sl, j) => {
      const sel = selSlot[0] === i && selSlot[1] === j; const m = sl && sl.t === 'm' ? memOf(sl.id) : null;
      const bad = sl && (sl.t === 'miss' || sl.t === 'bad');
      let inner;
      if (m) inner = `<div class="th" ${thAttr(m.ceiling)}></div><b>${esc(m.name)}</b>${m.ceiling < 0 ? '<small class="nopre">先読みなし</small>' : ''}`;
      else if (sl && sl.t === 'old') inner = `<div class="em" style="flex-direction:column"><span>旧形式</span><span>天井 ${esc(ceilLabel(sl.v))}</span></div>`;
      else if (sl && sl.t === 'miss') inner = `<div class="em" style="color:var(--bad)">${esc(sl.v)}<br>（見つかりません）</div>`;
      else if (sl && sl.t === 'bad') inner = `<div class="em" style="color:var(--bad)">値が正しくありません</div>`;
      else inner = `<div class="em">空き</div>`;
      return `<div class="slot ${sel ? 'sel' : ''} ${bad ? 'bad' : ''}" onclick="selSlotF(${i},${j})"><div class="n">メモリー ${j + 1}</div>${inner}</div>`;
    }).join('')}</div>
  ${s.p.filter(x => x && x.t === 'bad').map(x => `<p class="help" style="color:var(--bad);margin:4px 0 0">${esc(x.why)}</p>`).join('')}
  ${selSlot[0] === i ? pickerHtml(i) : ''}
 </div>`;
  }).join('<hr style="border:0;border-top:1px solid var(--line);margin:14px 0">') : '<p class="help">組がありません。「＋ 出演者を追加」で作ります。</p>';
  $('setsCnt').textContent = `${st.sets.length} / ${MAX_SETS} 組`;
  $('addSetBtn').disabled = st.sets.length >= MAX_SETS;
  updateDirty();
}
function pickerHtml(i) {
  const j = selSlot[1]; const s = st.sets[i]; const cur = s.p[j];
  return `<div class="picker"><div class="help" style="margin-bottom:6px">${esc(s.name)} の メモリー ${j + 1} に入れる物を選ぶ</div>
 ${slotPre(cur) ? '<div class="note">このメモリーは天井が「変えない」なので、背景の先読みの対象がありません（presets には -1 を書きます）。</div>' : ''}<div class="lst">
 ${st.mems.filter(m => !('rawEntry' in m)).map(m => `<div class="mem ${cur && cur.t === 'm' && cur.id === m.id ? 'sel' : ''}" onclick="pick(${i},${j},${m.id})"><div class="th" ${thAttr(m.ceiling)}></div><div class="t"><b>${esc(m.name)}</b><span>${esc(memSummary(m))}${m.ceiling < 0 ? ' ・ 先読みなし' : ''}</span></div></div>`).join('')}
 <div class="mem" onclick="pick(${i},${j},null)"><div class="t"><b>空きにする</b></div></div></div>${st.mems.length ? '' : '<p class="help">先に「プリセットメモリー」でメモリーを作ってください。</p>'}</div>`;
}
function memSummary(m) {
  const p = [];
  if (m.roof >= 0) p.push('屋根 ' + roofLabel(m.roof));
  if (m.ceiling >= 0) p.push('天井 ' + ceilLabel(m.ceiling));
  if (m.fx >= 0) p.push(fxLabel(m.fx));
  if (m.motion >= 0) p.push(motLabel(m.motion));
  if (m.color >= 0) p.push('色 ' + colorLabel(m.color));
  Object.keys(m.bad || {}).forEach(k => p.push('不正な値(' + k + ')'));
  return p.length ? p.join(' ・ ') : '（何も変えない）';
}
function selSlotF(i, j) { selSlot = [i, j]; renderSets(); }
function pick(i, j, id) { st.sets[i].p[j] = id == null ? null : { t: 'm', id }; renderSets(); }
function mv(i, d) { const k = i + d; if (k < 0 || k >= st.sets.length) return; [st.sets[i], st.sets[k]] = [st.sets[k], st.sets[i]]; selSlot = [k, selSlot[1]]; renderSets(); }
function delSet(i) { if (!confirm(`組「${st.sets[i].name}」を削除します。よいですか？（保存するまでは「読み直す」で戻せます）`)) return; st.sets.splice(i, 1); selSlot = [0, 0]; renderSets(); }
function addSet() { if (st.sets.length >= MAX_SETS) return; st.sets.push({ name: '新しい出演者', name0: '', p: [null, null, null, null], raw: null, info: {} }); selSlot = [st.sets.length - 1, 0]; renderSets(); }

/* ---------- 画面: プリセットメモリー ---------- */
function memListHtml() {
  return st.mems.map(m => `<div class="mem ${m.id === selMem ? 'sel' : ''} ${(memProblems(m).length || memDup(m)) ? 'bad' : ''}" onclick="selMem=${m.id};renderMem()"><div class="th" ${thAttr(m.ceiling)}></div><div class="t"><b>${esc(m.name) || '（名前なし）'}</b><span>${esc(memSummary(m))}</span></div></div>`).join('') || '<p class="help">メモリーがありません。</p>';
}
function renderMemList() { $('memList').innerHTML = memListHtml(); $('addMemBtn').disabled = st.mems.length >= MAX_MEM; $('addMemBtn').textContent = st.mems.length >= MAX_MEM ? `メモリーは最大 ${MAX_MEM} 個です` : `＋ 新しいメモリー（${st.mems.length} / ${MAX_MEM}）`; updateDirty(); }
function renderMem() {
  renderMemList();
  const m = memOf(selMem);
  if (!m) { $('memEd').innerHTML = '<p class="help">左の「＋ 新しいメモリー」で作ります。</p>'; return; }
  const probs = memProblems(m).concat(memDup(m) ? ['名前が他のメモリーと重なっています'] : []);
  const probHtml = probs.length ? `<div class="banner err" style="margin-bottom:10px"><b>直してから保存してください</b><ul style="margin:4px 0 0 18px;padding:0">${probs.map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>` : '';
  if ('rawEntry' in m) { $('memEd').innerHTML = probHtml + `<div class="acts"><button class="danger" onclick="delMem()">削除</button></div>`; return; }
  const ceilOpts = [-1, ...CEIL_MODES];
  const bd = k => m.bad[k] !== undefined;
  const none = k => bd(k) ? `<option value="-2" selected>（不正な値 ${esc(jstr(m.bad[k]))}）</option>` : '';
  const cOn = v => !bd('color') && m.color === v ? 'sel' : '';
  const colorChips = `<div class="chip none ${cOn(-1)}" onclick="setColor(-1)"><div class="th"></div><b>変えない</b></div>`
    + COLORS.map(c => `<div class="chip cc ${COLOR_LIGHT.has(c.v) ? 'light' : 'dark'} ${cOn(c.v)}" onclick="setColor(${c.v})" style="--cc:${c.c}"><b>${c.n}</b></div>`).join('')
    + COLOR_SPECIAL.map(c => `<div class="chip sp ${cOn(c.v)}" onclick="setColor(${c.v})"><div class="th"></div><b>${c.n}</b></div>`).join('');
  $('memEd').innerHTML = probHtml + `<label class="f" style="margin-top:0">名前</label><input type="text" value="${esc(m.name)}" oninput="memName(this.value)">
 <label class="f">屋根</label>
 <div class="rf">${[{ v: -1, n: '変えない', s: '' }, ...ROOF].map(r => `<div class="opt ${!bd('roof') && m.roof === r.v ? 'sel' : ''}" onclick="setRoof(${r.v})">${r.n}${r.s ? `<small>${r.s}</small>` : ''}</div>`).join('')}</div>
 <label class="f">天井のプリセット</label>
 <div class="chips">${ceilOpts.map(n => n < 0 ? `<div class="chip none ${!bd('ceiling') && m.ceiling === -1 ? 'sel' : ''}" onclick="setCeil(-1)"><div class="th"></div><b>変えない</b></div>` : `<div class="chip ${!bd('ceiling') && n === m.ceiling ? 'sel' : ''}" onclick="setCeil(${n})"><div class="th" ${thAttr(n)}></div><b>${n} ${CEIL_NAMES[n]}</b></div>`).join('')}</div>
 <div class="row" style="gap:12px;margin-top:2px"><div style="flex:1;min-width:0"><label class="f">ポストエフェクト</label><select onchange="setFx(+this.value)">${none('fx')}<option value="-1" ${!bd('fx') && m.fx === -1 ? 'selected' : ''}>変えない</option>${FX.map(x => `<option value="${x.v}" ${!bd('fx') && x.v === m.fx ? 'selected' : ''}>${x.n}（${x.s}）</option>`).join('')}</select></div>
 <div style="flex:1;min-width:0"><label class="f">照明の動き</label><select onchange="setMotion(+this.value)">${none('motion')}<option value="-1" ${!bd('motion') && m.motion === -1 ? 'selected' : ''}>変えない</option>${MOTION.map((x, i) => `<option value="${i}" ${!bd('motion') && i === m.motion ? 'selected' : ''}>${i} ${x}</option>`).join('')}</select></div></div>
 <label class="f">照明の色</label>
 <div class="chips colors">${colorChips}</div>
 <div class="note">没入型の天井（ガラス以外）を選ぶと屋根は閉じます。屋根を開く場合は、天井はガラスか「変えない」になります。5 項目ぜんぶ「変えない」のメモリーは保存できません。「パレット」は、呼んだときにパレットで今拾っている色へ切り替えるだけで、色そのものは保存されません。</div>
 <p class="help">使われている出演者: ${esc(st.sets.filter(s => s.p.some(x => x && x.t === 'm' && x.id === m.id)).map(s => s.name).join('、')) || 'なし'}</p>
 <div class="acts"><button disabled title="ワールドの中で確かめてください">見え方を試す（未対応）</button><button onclick="dupMem()" ${st.mems.length >= MAX_MEM ? 'disabled' : ''}>複製</button><button class="danger" onclick="delMem()">削除</button></div>`;
}
function memName(v) { const m = memOf(selMem); m.name = v; delete m.bad.name; renderMemList(); }
function setRoof(v) {
  const m = memOf(selMem); m.roof = v; if (m.bad.roof !== undefined && m.n0) m.n0.roof = undefined; delete m.bad.roof;
  if (v > 0 && m.ceiling > 0) { m.ceiling = 0; delete m.bad.ceiling; toast('屋根を開くので、天井をガラスにしました'); }
  renderMem();
}
function setCeil(n) {
  const m = memOf(selMem); m.ceiling = n; if (m.bad.ceiling !== undefined && m.n0) m.n0.ceiling = undefined; delete m.bad.ceiling;
  if (n > 0 && m.roof > 0) { m.roof = 0; delete m.bad.roof; toast('没入型の天井なので、屋根を「閉じる」にしました'); }
  renderMem();
}
function setFx(v) { const m = memOf(selMem); if (v === -2) return; m.fx = v; if (m.bad.fx !== undefined && m.n0) m.n0.fx = undefined; delete m.bad.fx; renderMem(); }
function setColor(v) { const m = memOf(selMem); m.color = v; if (m.bad.color !== undefined && m.n0) m.n0.color = undefined; delete m.bad.color; renderMem(); }
function setMotion(v) { const m = memOf(selMem); if (v === -2) return; m.motion = v; if (m.bad.motion !== undefined && m.n0) m.n0.motion = undefined; delete m.bad.motion; renderMem(); }
function newMem(o) { return Object.assign({ id: st.nextId++, name: '', roof: -1, ceiling: -1, fx: -1, motion: -1, color: -1, bad: {}, raw: null, n0: null }, o); }
function addMem() {
  if (st.mems.length >= MAX_MEM) return;
  let k = st.mems.length + 1, name; do { name = '新しいメモリー' + (k > 1 ? ' ' + k : ''); k++; } while (memByName(name));
  const m = newMem({ name }); st.mems.push(m); selMem = m.id; renderMem();
}
function dupMem() {
  if (st.mems.length >= MAX_MEM) return;
  const m = memOf(selMem); if ('rawEntry' in m) return; let name = m.name + '（コピー）', k = 2; while (memByName(name)) name = m.name + '（コピー' + (k++) + '）';
  const c = newMem({ name, roof: m.roof, ceiling: m.ceiling, fx: m.fx, motion: m.motion, color: m.color, bad: clone(m.bad) }); st.mems.push(c); selMem = c.id; renderMem();
}
function delMem() {
  const m = memOf(selMem); if (!m) return;
  const used = st.sets.filter(s => s.p && s.p.some(x => x && x.t === 'm' && x.id === m.id));
  if (!confirm(used.length ? `メモリー「${m.name}」は ${used.map(s => '「' + s.name + '」').join('、')} で使われています。削除すると、その枠は空きになります。削除しますか？` : `メモリー「${m.name}」を削除します。よいですか？（後ろのメモリーの番号が 1 つずつ前にずれます）`)) return;
  st.sets.forEach(s => { if (s.p) s.p = s.p.map(x => (x && x.t === 'm' && x.id === m.id) ? null : x); });
  st.mems = st.mems.filter(x => x.id !== m.id); selMem = st.mems.length ? st.mems[0].id : null; renderMem(); renderSets();
}

/* ---------- 画面: ポスター（見取り図は案と同じ） ---------- */
const AREA_ORDER = ['外', '入口', '入口（内側）', 'カジノ', '1階 東', '1階 西', '2階 奥'];
const MAPS = [{ f: 1, img: 'map/map_1f.png', t: '1階・外・入口' }, { f: 2, img: 'map/map_2f.png', t: '2階（カジノ）' }];
const SVX = x => +(x + 251).toFixed(2), SVY = z => +(-11 - z).toFixed(2);
const boardsOf = k => BOARDS.filter(b => b.case === k);
function areasOf(k) { const a = []; boardsOf(k).forEach(b => { if (!a.includes(b.area)) a.push(b.area) }); return a.sort((x, y) => AREA_ORDER.indexOf(x) - AREA_ORDER.indexOf(y)) }
function rowText(b) { return b.row > 0 ? '（上の段）' : b.row < 0 ? '（下の段）' : '' }
function segOf(b) {
  let [x1, z1, x2, z2] = b.seg; let ax = SVX(x1), ay = SVY(z1), bx = SVX(x2), by = SVY(z2);
  const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, o = b.row * 0.6;
  return { ax: ax + nx * o, ay: ay + ny * o, bx: bx + nx * o, by: by + ny * o, mx: (ax + bx) / 2, my: (ay + by) / 2 };
}
function mapSvg(f) {
  const sel = selCase; let s = '';
  const lab = (x, z, t) => `<text x="${SVX(x)}" y="${SVY(z)}" font-size="2.7" fill="#8c97c4" text-anchor="middle" opacity=".85">${t}</text>`;
  if (f === 1) {
    s += lab(-215, -24, '道路・バス停') + lab(-214, -100, 'ステージ');
    s += `<text x="${SVX(-226)}" y="${SVY(-52)}" font-size="2.3" fill="#8c97c4" text-anchor="middle" opacity=".8" transform="rotate(-29 ${SVX(-226)} ${SVY(-52)})">斜めの壁（入口）</text>`;
  } else s += lab(-218, -60, 'カジノ（2階の床）') + lab(-213, -91, 'ドーム');
  BOARDS.filter(b => b.floor === f && b.case !== sel).forEach(b => {
    const g = segOf(b);
    s += `<line x1="${g.ax}" y1="${g.ay}" x2="${g.bx}" y2="${g.by}" stroke="#9aa6d6" stroke-width=".8" stroke-linecap="round" opacity=".38"/>`
  });
  BOARDS.filter(b => b.floor === f && b.case === sel).forEach(b => {
    const g = segOf(b);
    const side = b.row < 0 ? -1 : 1, fx = b.face[0] * side, fy = -b.face[1] * side, bx = g.mx + fx * 3.4, by = g.my + fy * 3.4;
    s += `<g class="hl"><line x1="${g.ax}" y1="${g.ay}" x2="${g.bx}" y2="${g.by}" stroke="#ffc53d" stroke-width="1.25" stroke-linecap="round"/></g>`;
    s += `<line x1="${g.mx}" y1="${g.my}" x2="${bx}" y2="${by}" stroke="#ffc53d" stroke-width=".35"/>`;
    s += `<g style="cursor:pointer" onclick="selBoard=${selBoard === b.n ? 'null' : b.n};renderPosters()"><circle cx="${bx}" cy="${by}" r="2.5" fill="#ffc53d" stroke="${selBoard === b.n ? '#fff' : '#1c2030'}" stroke-width="${selBoard === b.n ? .7 : .35}"/><text x="${bx}" y="${by + 1}" font-size="2.9" font-weight="700" fill="#1c2030" text-anchor="middle">${b.n}</text></g>`;
    if (selBoard === b.n) s += `<circle cx="${g.mx}" cy="${g.my}" r="4.6" fill="none" stroke="#fff" stroke-width=".5" stroke-dasharray="1.2 1"/>`;
  });
  if (selImg !== null) {
    ((IMGPOS[sel] || {})[selImg] || []).filter(p => (p.y >= 10 ? 2 : 1) === f).forEach(p => {
      s += `<g class="hl"><circle cx="${SVX(p.x)}" cy="${SVY(p.z)}" r="1.5" fill="#3ee0b0" stroke="#fff" stroke-width=".4"/><circle cx="${SVX(p.x)}" cy="${SVY(p.z)}" r="3" fill="none" stroke="#3ee0b0" stroke-width=".4"/></g>`
    });
  }
  return `<svg viewBox="0 0 72 94" preserveAspectRatio="none">${s}</svg>`
}
function renderMap(c) {
  const bs = boardsOf(c.k), ar = areasOf(c.k), cnt = c.f.map((_, i) => ((IMGPOS[c.k] || {})[i] || []).length), same = cnt.every(n => n === cnt[0]) ? cnt[0] : 0;
  const n1 = bs.filter(b => b.floor === 1).length, n2 = bs.filter(b => b.floor === 2).length;
  $('mapBox').innerHTML = `<div class="hd"><b style="font-size:16px">置かれている場所</b><span class="help">${c.n} を選んでいます。光っている黄色の線が、このケースの板です</span></div>
 <p class="sum"><b>${c.n}</b> は <b>${ar.length} エリア</b>（${ar.join('・')}）に <b>${bs.length} 面</b>あります。${same > 1 ? `1 枚の絵が ${same} か所に出ます。` : ''}${/^info_wide/.test(c.k) ? 'どのエリアにも、この 3 枚 1 組の板が 1 つずつあります。' : ''}<br><span class="help">スイッチは 1 つなので、これらは全部いっしょに出入りします。</span></p>
 <div class="mtabs">${MAPS.map(m => `<button class="${selFloor === m.f ? 'on' : ''}" onclick="selFloor=${m.f};renderPosters()">${m.t}（${m.f === 1 ? n1 : n2} 面）</button>`).join('')}</div>
 <div class="maps">${MAPS.map(m => `<div class="mapcell ${selFloor === m.f ? '' : 'off'}"><h4><span>${m.t}</span><span>${(m.f === 1 ? n1 : n2) ? `このケース ${(m.f === 1 ? n1 : n2)} 面` : 'このケースは置かれていません'}</span></h4><div class="mapwrap"><img src="${m.img}" alt="${m.t}の見取り図">${mapSvg(m.f)}</div></div>`).join('')}</div>
 <div class="legend"><span><i style="background:#ffc53d"></i>このケースの板（番号つき）</span><span><i style="background:#9aa6d6;opacity:.6"></i>ほかのケースの板</span>${selImg !== null ? '<span><i style="background:#3ee0b0"></i>選んだ絵の位置</span>' : ''}</div>
 <div class="blist">${bs.map(b => `<div class="bitem ${selBoard === b.n ? 'sel' : ''}" onclick="selBoard=${selBoard === b.n ? 'null' : b.n};selFloor=${b.floor};renderPosters()"><span class="bn">${b.n}</span><span class="bt"><b>${b.area}</b> ・ ${b.label}${rowText(b)}<small>${b.floor === 1 ? '1階' : '2階'} ・ 高さ ${b.y} m</small></span></div>`).join('')}</div>
 <p class="map-note">見取り図は Sphere VERSE のシーンを真上から撮った物（床から輪切り）。位置は実際の座標です。名前の付け方は仮。</p>`
}
function renderPosters() {
  $('cases').innerHTML = CASES.map(c => `<div class="case ${c.k === selCase ? 'sel' : ''}" onclick="selCaseF('${c.k}')">
  <div class="im" style='background-image:url("${assetUrl('images/' + c.f[0])}")'></div>
  <div class="nm"><b>${c.n}</b><div class="sw ${st.posters[c.k] ? 'on' : ''}" onclick="event.stopPropagation();st.posters['${c.k}']=!st.posters['${c.k}'];renderPosters()"></div></div>
  <small>${c.f.length} 枚 ・ ${areasOf(c.k).length} エリア</small><small>${st.posters[c.k] ? '最初から読む' : '最初は読まない'}</small></div>`).join('');
  const c = caseOf(selCase);
  renderMap(c);
  $('caseBox').innerHTML = `<b>${c.n}</b> <span class="help">の画像（${c.f.length} 枚・今のファイルの大きさ ${c.sz}）。絵を押すと、その絵が出る場所が見取り図に出ます</span>
 <div class="pgrid" style="margin-top:10px">${c.f.map((f, i) => {
    const pd = st.pending.get('images/' + f);
    return `<div class="pimg ${selImg === i ? 'sel' : ''} ${pd ? 'pend' : ''}" onclick="selImgF(${i})"><div class="im" style='background-image:url("${pd ? pd.url : assetUrl('images/' + f)}")'></div><div class="ft"><span>${i + 1}枚目${pd ? ' <i class="pendtag">差し替え予定</i>' : ''}</span><span>${f.split('/').pop()}</span></div></div>`
  }).join('')}</div>
 ${selImg !== null ? `<p class="help" style="margin-top:8px">${selImg + 1} 枚目は、${((IMGPOS[c.k] || {})[selImg] || []).map(p => p.n).filter((v, i, a) => a.indexOf(v) === i).length} 面（番号 ${((IMGPOS[c.k] || {})[selImg] || []).map(p => p.n).filter((v, i, a) => a.indexOf(v) === i).join('・')}）に出ます。</p>` : ''}
 <div class="acts"><button onclick="openBulk()">まとめて ${c.f.length} 枚選ぶ</button>${c.f.length > 1 ? '<button onclick="openSame()">同じ画像をまとめて入れる</button>' : ''}</div>`;
  keyTbl(); renderBulk(); renderSame(); renderUpload(); updateDirty();
}
function selCaseF(k) { cancelSame(false); selCase = k; selImg = null; selBoard = null; up = null; bulk = null; selFloor = (boardsOf(k)[0] || { floor: 1 }).floor; renderPosters(); }
function selImgF(i) { cancelSame(false); selImg = selImg === i ? null : i; up = null; renderPosters(); }
function keyTbl() {
  $('keyTbl').innerHTML = '<tr><th>ボタン名</th><th>config.json のキー</th><th>絵</th><th>エリア（面の数）</th></tr>' + CASES.map(c => `<tr><td>${c.n}</td><td><code>${c.k}</code></td><td>${c.f.length} 枚</td><td>${areasOf(c.k).map(a => a + '（' + boardsOf(c.k).filter(b => b.area === a).length + '）').join('・')}　計 ${boardsOf(c.k).length} 面</td></tr>`).join('') + '<tr><td>（旧）INFO WIDE 全部</td><td><code>info_wide</code></td><td>9 枚</td><td>古いワールド用。元の config.json にあるときだけ、INFO WIDE 1-3 を変えたとき同じ値にします</td></tr>';
}


/* ---------- 画像の変換 ---------- */
function stepResize(bmp, w, h, fit) {
  // fit: cover（はみ出しを切る）/ contain（全体を収める・余白は透明）/ stretch（引き伸ばす）
  let sx = 0, sy = 0, sw = bmp.width, sh = bmp.height, dx = 0, dy = 0, dw = w, dh = h;
  if (fit === 'cover') {
    const r = Math.max(w / bmp.width, h / bmp.height); const cw = w / r, ch = h / r; sx = (bmp.width - cw) / 2; sy = (bmp.height - ch) / 2; sw = cw; sh = ch;
  } else if (fit === 'contain') {
    const r = Math.min(w / bmp.width, h / bmp.height); dw = Math.round(bmp.width * r); dh = Math.round(bmp.height * r); dx = Math.round((w - dw) / 2); dy = Math.round((h - dh) / 2);
  }
  // 大きく縮めるときは半分ずつ縮めて粗さを避ける
  let src = bmp, cw = sw, ch = sh, cx = sx, cy = sy;
  while (cw / dw > 2 || ch / dh > 2) {
    const nw = Math.max(dw, Math.ceil(cw / 2)), nh = Math.max(dh, Math.ceil(ch / 2));
    const t = document.createElement('canvas'); t.width = nw; t.height = nh; const tc = t.getContext('2d'); tc.imageSmoothingQuality = 'high';
    tc.drawImage(src, cx, cy, cw, ch, 0, 0, nw, nh); src = t; cx = 0; cy = 0; cw = nw; ch = nh;
  }
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const ctx = cv.getContext('2d'); ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, cx, cy, cw, ch, dx, dy, dw, dh);
  return cv;
}

/* 減色（UPNG の色の選び方）＋ フロイド–スタインバーグのディザリング。出力は「パレットの色だけ」の RGBA。 */
function quantizeRGBA(data, w, h, cnum, dither) {
  const copy = new Uint8Array(data.length); copy.set(data);
  // UPNG の encode は透明用に 1 色を使うので、色の選び方は cnum-1 色にする
  const q = UPNG.quantize([copy.buffer], cnum - 1, false);
  const qb = new Uint8Array(q.bufs[0]);
  if (!dither) return qb;
  const pal = q.plte.map(l => l.est.rgba);   // uint32（リトルエンディアンの RGBA）
  const OP = []; pal.forEach((c, i) => { if ((c >>> 24) === 255) OP.push(i); });
  if (!OP.length) return qb;
  const PR = new Int16Array(pal.length), PG = new Int16Array(pal.length), PB = new Int16Array(pal.length);
  pal.forEach((c, i) => { PR[i] = c & 255; PG[i] = (c >> 8) & 255; PB[i] = (c >> 16) & 255; });
  const cache = new Int16Array(1 << 18).fill(-1);   // 6bit×3 の色 → 最も近い「不透明な」パレット番号
  const nearest = (r, g, b) => {
    const key = ((r >> 2) << 12) | ((g >> 2) << 6) | (b >> 2); let v = cache[key];
    if (v >= 0) return v;
    const rr = (r & 252) + 2, gg = (g & 252) + 2, bb = (b & 252) + 2; let best = OP[0], bd = 1e12;
    for (let j = 0; j < OP.length; j++) { const i = OP[j], dr = rr - PR[i], dg = gg - PG[i], db = bb - PB[i], d = dr * dr * 3 + dg * dg * 4 + db * db * 2; if (d < bd) { bd = d; best = i; } }
    return cache[key] = best;
  };
  // 不透明な画素だけディザする。透明・半透明の画素は、UPNG の減色結果をそのまま使い、誤差は広げない。
  const out = new Uint8Array(data.length);
  let e0 = new Float32Array((w + 2) * 3), e1 = new Float32Array((w + 2) * 3);
  for (let y = 0; y < h; y++) {
    e1.fill(0);
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4, k = (x + 1) * 3;
      if (data[i + 3] !== 255) { out[i] = qb[i]; out[i + 1] = qb[i + 1]; out[i + 2] = qb[i + 2]; out[i + 3] = qb[i + 3]; continue; }
      let r = data[i] + e0[k], g = data[i + 1] + e0[k + 1], b = data[i + 2] + e0[k + 2];
      r = r < 0 ? 0 : r > 255 ? 255 : r; g = g < 0 ? 0 : g > 255 ? 255 : g; b = b < 0 ? 0 : b > 255 ? 255 : b;
      const n = nearest(r | 0, g | 0, b | 0);
      out[i] = PR[n]; out[i + 1] = PG[n]; out[i + 2] = PB[n]; out[i + 3] = 255;
      const er = r - PR[n], eg = g - PG[n], eb = b - PB[n];
      e0[k + 3] += er * 7 / 16; e0[k + 4] += eg * 7 / 16; e0[k + 5] += eb * 7 / 16;
      e1[k - 3] += er * 3 / 16; e1[k - 2] += eg * 3 / 16; e1[k - 1] += eb * 3 / 16;
      e1[k] += er * 5 / 16; e1[k + 1] += eg * 5 / 16; e1[k + 2] += eb * 5 / 16;
      e1[k + 3] += er / 16; e1[k + 4] += eg / 16; e1[k + 5] += eb / 16;
    }
    const t = e0; e0 = e1; e1 = t;
  }
  return out;
}

/* 候補（減色 PNG ／ 可逆 PNG ／ 元のまま）のうち、いちばん小さい物を選ぶ。
   「元のまま」は、選んだ画像が PNG で、大きさがちょうど基準のときだけ候補になる。 */
async function convertImage(file, w, h, fit, level, dither) {
  const cnum = LEVELS[level].cnum;
  const bmp = await createImageBitmap(file);
  const cv = stepResize(bmp, w, h, fit);
  const id = cv.getContext('2d').getImageData(0, 0, w, h);
  await sleep(10);
  const t0 = performance.now();
  const cands = [];
  if (file.type === 'image/png' && bmp.width === w && bmp.height === h) cands.push({ id: 'orig', label: '元のまま（変換しない）', bytes: new Uint8Array(await file.arrayBuffer()) });
  cands.push({ id: 'lossless', label: '可逆 PNG', bytes: new Uint8Array(UPNG.encode([id.data.buffer.slice(0)], w, h, 0)) });
  await sleep(10);
  const qd = quantizeRGBA(id.data, w, h, cnum, dither);
  cands.push({ id: 'quant', label: `減色 PNG（${cnum} 色${dither ? '・ディザあり' : ''}）`, bytes: new Uint8Array(UPNG.encode([qd.buffer], w, h, 0)) });
  const best = cands.reduce((a, b) => b.bytes.length < a.bytes.length ? b : a, cands[0]);   // 同じ大きさなら先の候補（元のまま > 可逆 > 減色）
  const out = { bytes: best.bytes, w, h, srcW: bmp.width, srcH: bmp.height, method: best.id, methodLabel: best.label, cands: cands.map(c => ({ id: c.id, label: c.label, size: c.bytes.length })), fit, ms: Math.round(performance.now() - t0) };
  if (bmp.close) bmp.close();
  return out;
}
const blobUrl = (bytes, type) => URL.createObjectURL(new Blob([bytes], { type: type || 'image/png' }));
const aspectDiff = (sw, sh, w, h) => Math.abs((sw / sh) / (w / h) - 1);
// はみ出しの扱いを文にする（確認画面にも出す）
function fitText(fit, srcW, srcH, w, h) {
  const asp = srcW && srcH ? aspectDiff(srcW, srcH, w, h) > 0.02 : false;
  if (fit === 'cover') return '中央で切り取る' + (asp ? '（縦横の比が違うので、はみ出す分は切れます）' : '（ほぼ同じ比なので、切れるのはわずかです）');
  if (fit === 'contain') return '全体を収める' + (asp ? '（足りない所は透明な余白になります）' : '（余白はほぼ出ません）');
  return '引き伸ばす' + (asp ? '（縦横の比が変わります）' : '（比はほぼ同じです）');
}

let upTok = 0;
async function runUp() {
  if (!up) return;
  const tok = ++upTok; up.busy = true; renderUpload();
  const c = caseOf(selCase), f = c.f[selImg]; const [w, h] = sizeOfFile(c, f);
  try {
    const r = await convertImage(up.file, w, h, up.fit, up.level, up.dither);
    if (tok !== upTok || !up) return;
    if (up.resUrl) URL.revokeObjectURL(up.resUrl);
    up.res = r; up.resUrl = blobUrl(r.bytes); up.err = null;
  } catch (e) { if (tok === upTok && up) up.err = e.message; }
  if (tok === upTok && up) { up.busy = false; renderUpload(); }
}
function pickOne(file) {
  if (!file) return; if (selImg === null) return; cancelSame(false);
  const c = caseOf(selCase);
  up = { file, srcUrl: URL.createObjectURL(file), fit: 'cover', level: levelOf(c.k), dither: dithOf(c.k), res: null, resUrl: null, busy: true, err: null };
  const im = new Image(); im.onload = () => { if (up) { up.srcW = im.naturalWidth; up.srcH = im.naturalHeight; renderUpload(); } }; im.src = up.srcUrl;
  runUp();
}
function dragOver(e) { e.preventDefault(); e.currentTarget.classList.add('over'); }
function dragLeave(e) { e.currentTarget.classList.remove('over'); }
function dropOne(e) { e.preventDefault(); e.currentTarget.classList.remove('over'); const f = [...e.dataTransfer.files].find(x => x.type.startsWith('image/')); if (f) pickOne(f); }
function chooseOne() { const i = $('fileOne'); i.value = ''; i.onchange = () => pickOne(i.files[0]); i.click(); }
function upSet(k, v) { up[k] = v; runUp(); }
async function addPending(path, res, srcFile, meta, fit, grp) {
  const newSha = await gitBlobSha(res.bytes);
  const old = st.pending.get(path); if (old && old.url) URL.revokeObjectURL(old.url);
  st.pending.set(path, { bytes: res.bytes, url: blobUrl(res.bytes), w: res.w, h: res.h, srcName: srcFile ? srcFile.name : '', srcSize: srcFile ? srcFile.size : 0, beforeSize: meta.size, beforeSha: meta.sha, method: res.method, methodLabel: res.methodLabel, fit, fitText: fitText(fit, res.srcW, res.srcH, res.w, res.h), grp: grp || null, newSha, unchanged: !!meta.sha && meta.sha === newSha });
}
async function curSize(path) {
  try { const r = await fetch(assetUrl(path), { cache: 'no-store' }); if (!r.ok) return 0; return (await r.blob()).size; } catch (e) { return 0; }
}
// 差し替え前の状態（sha と大きさ）。保存のとき、これと比べて変わっていたら止める
async function curMeta(path) {
  if (canApi()) {
    try { const j = await gh('GET', `/repos/${S.repo}/contents/${encPath(path)}?ref=${encodeURIComponent(S.branch)}`); return { size: j.size || 0, sha: j.sha || '' }; }
    catch (e) { if (e.status === 404) return { size: 0, sha: '' }; }
  }
  return { size: await curSize(path), sha: null };
}
async function commitUp() {
  if (!up || !up.res) return;
  const c = caseOf(selCase), f = c.f[selImg]; const path = 'images/' + f;
  const meta = await curMeta(path);
  await addPending(path, up.res, up.file, meta, up.fit);
  toast(`${f.split('/').pop()} を保存待ちに入れました`); cancelUp(false); renderPosters();
}
function cancelUp(render = true) { if (up) { upTok++; up.srcUrl && URL.revokeObjectURL(up.srcUrl); up.resUrl && URL.revokeObjectURL(up.resUrl); } up = null; if (render) renderUpload(); }
function dropPending(path) { const p = st.pending.get(path); if (p && p.url) URL.revokeObjectURL(p.url); st.pending.delete(path); renderPosters(); }
const ditherBox = (on, fn) => `<label class="help" style="display:inline-flex;gap:4px;align-items:center"><input type="checkbox" ${on ? 'checked' : ''} onchange="${fn}(this.checked)" style="width:auto"> ディザリング</label>`;
function candHtml(r) { return r.cands.map(x => x.id === r.method ? `<b>${esc(x.label)} ${fmtB(x.size)}</b>` : `${esc(x.label)} ${fmtB(x.size)}`).join(' ／ '); }
function renderUpload() {
  const box = $('upBox');
  if (selImg === null) { box.innerHTML = ''; return; }
  const c = caseOf(selCase), f = c.f[selImg]; const [w, h] = sizeOfFile(c, f); const path = 'images/' + f; const pd = st.pending.get(path);
  let h1 = `<div class="up"><b>${c.n} の ${selImg + 1} 枚目（${f.split('/').pop()}）を差し替える</b> <span class="help">今のファイルの大きさ ${w}×${h}</span>`;
  if (pd) h1 += `<div class="banner info" style="margin-top:8px">保存待ち: ${pd.srcName ? esc(pd.srcName) + ' から ' : ''}変換した画像（${pd.w}×${pd.h}・${fmtB(pd.bytes.length)}・${esc(pd.methodLabel)}）があります。 <button class="sm" onclick="dropPending('${path}')">取り消す</button></div>`;
  h1 += `<div class="drop" style="margin-top:10px" ondragover="dragOver(event)" ondragleave="dragLeave(event)" ondrop="dropOne(event)">画像をここに置くか <button class="sm" onclick="chooseOne()">ファイルを選ぶ</button>　<span class="help">${up ? '選んだ画像: ' + esc(up.file.name) : 'PNG・JPEG・WebP など'}</span></div>`;
  if (up) {
    const r = up.res; const asp = up.srcW ? aspectDiff(up.srcW, up.srcH, w, h) : 0;
    h1 += `<div class="inl" style="margin-top:10px"><span class="help">はみ出し:</span><select onchange="upSet('fit',this.value)">${Object.keys(FITN).map(k => `<option value="${k}" ${up.fit === k ? 'selected' : ''}>${FITN[k]}</option>`).join('')}</select>
     <span class="help">減色:</span><select onchange="upSet('level',this.value)">${Object.keys(LEVELS).map(k => `<option value="${k}" ${up.level === k ? 'selected' : ''}>${LEVELS[k].n}</option>`).join('')}</select>${ditherBox(up.dither, "upSet.bind(null,'dither')")}${up.busy ? '<span class="help">変換中…</span>' : ''}</div>`;
    if (asp > 0.02) h1 += `<div class="note">縦横の比が今のファイル（${w}×${h}）と違います（${up.srcW}×${up.srcH}）。上の「はみ出し」で扱いを選べます。</div>`;
    if (up.err) h1 += `<div class="banner err">変換できませんでした: ${esc(up.err)}</div>`;
    if (r && r.bytes.length > up.file.size && r.method !== 'orig') h1 += `<div class="note">変換後のほうが、選んだ画像（${esc((up.file.type || '').replace('image/', '').toUpperCase())}）より大きくなりました。JPEG などを PNG にすると大きくなることがあります。PNG のまま基準の大きさに合わせて選ぶと、元のままで入れられます。</div>`;
    h1 += `<div class="cmp"><div class="p"><h4>変換前（選んだ画像）</h4><div class="im" style="background-image:${esc(cssUrl(up.srcUrl))}"></div></div>
     <div class="p"><h4>変換後（アップロードする画像）</h4><div class="im" style="${r ? 'background-image:' + esc(cssUrl(up.resUrl)) : ''}"></div></div></div>`;
    h1 += `<div class="tw"><table class="t"><tr><th></th><th>変換前</th><th>変換後</th></tr>
     <tr><td>大きさ</td><td>${up.srcW || '?'}×${up.srcH || '?'}</td><td class="good">${r ? r.w + '×' + r.h : '…'}</td></tr>
     <tr><td>方式（自動で小さい物を選択）</td><td>${esc((up.file.type || '').replace('image/', '').toUpperCase())}</td><td class="good">${r ? esc(r.methodLabel) : '…'}</td></tr>
     <tr><td>ファイルサイズ</td><td>${fmtB(up.file.size)}</td><td class="good">${r ? fmtB(r.bytes.length) + '（' + (r.bytes.length <= up.file.size ? '約 ' + Math.round(100 - r.bytes.length / up.file.size * 100) + '% 減' : '約 ' + Math.round(r.bytes.length / up.file.size * 100 - 100) + '% 増') + '）' : '…'}</td></tr>
     <tr><td>候補の大きさ</td><td colspan="2">${r ? candHtml(r) : '…'}</td></tr>
     <tr><td>はみ出し</td><td colspan="2">${esc(fitText(up.fit, up.srcW, up.srcH, w, h))}</td></tr>
     <tr><td>置き換える先</td><td colspan="2">${path}</td></tr></table></div>
     <div class="acts"><button class="pri" onclick="commitUp()" ${r && !up.busy ? '' : 'disabled'}>この画像に差し替える</button><button onclick="show('settings')">変換の設定を変える</button><button onclick="cancelUp()">やめる</button></div>`;
  } else {
    h1 += `<div class="acts"><button onclick="show('settings')">変換の設定を変える</button></div>`;
  }
  box.innerHTML = h1 + '</div>';
}

/* ---------- まとめて選ぶ ---------- */
const natKey = s => s.replace(/\d+/g, m => m.padStart(6, '0')).toLowerCase();
function openBulk() { const i = $('fileMany'); i.value = ''; i.onchange = () => pickMany([...i.files]); i.click(); }
function bulkDrop(e) { e.preventDefault(); e.currentTarget.classList.remove('over'); pickMany([...e.dataTransfer.files]); }
async function pickMany(files) {
  files = files.filter(f => f.type.startsWith('image/')); if (!files.length) return;
  const c = caseOf(selCase); selImg = null; up = null; cancelSame(false);
  const slotKey = f => f.split('/').pop().replace(/\.png$/i, '').toLowerCase();
  const items = files.map(file => ({ file, slot: -1, srcUrl: URL.createObjectURL(file), res: null, resUrl: null, status: '待ち' }));
  const used = new Set();
  items.forEach(it => { const b = it.file.name.replace(/\.[^.]+$/, '').toLowerCase(); const i = c.f.findIndex(f => slotKey(f) === b); if (i >= 0 && !used.has(i)) { it.slot = i; used.add(i); } });
  items.filter(it => it.slot < 0).sort((a, b) => natKey(a.file.name) < natKey(b.file.name) ? -1 : 1).forEach(it => { for (let i = 0; i < c.f.length; i++) if (!used.has(i)) { it.slot = i; used.add(i); break; } });
  items.sort((a, b) => (a.slot < 0 ? 99 : a.slot) - (b.slot < 0 ? 99 : b.slot));
  bulk = { items, caseKey: c.k, level: levelOf(c.k), dither: dithOf(c.k), fit: 'cover', busy: true, tok: ++upTok };
  renderPosters();
  await runBulk();
}
async function runBulk() {
  if (!bulk) return; const B = bulk; const tok = B.tok = ++upTok; B.busy = true;
  const c = caseOf(B.caseKey);
  for (const it of B.items) {
    if (tok !== B.tok || bulk !== B) return;
    if (it.slot < 0) { it.status = '枠なし'; continue; }
    it.status = '変換中…'; renderBulk();
    try {
      const [w, h] = sizeOfFile(c, c.f[it.slot]);
      const r = await convertImage(it.file, w, h, B.fit, B.level, B.dither);
      if (it.resUrl) URL.revokeObjectURL(it.resUrl);
      it.res = r; it.resUrl = blobUrl(r.bytes); it.status = '変換済み';
    } catch (e) { it.status = '失敗: ' + e.message; }
    renderBulk();
  }
  if (bulk === B) { B.busy = false; renderBulk(); }
}
function bulkSet(k, v) { bulk[k] = v; bulk.items.forEach(it => { it.res = null; }); runBulk(); }
function bulkSlot(i, v) {
  const it = bulk.items[i]; const s = +v; bulk.items.forEach(o => { if (o !== it && o.slot === s && s >= 0) o.slot = -1; }); it.slot = s; it.res = null; runBulk();
}
async function bulkCommit() {
  if (!bulk || bulk.busy) return; const c = caseOf(bulk.caseKey); let n = 0;
  for (const it of bulk.items) {
    if (it.slot < 0 || !it.res) continue; const path = 'images/' + c.f[it.slot];
    await addPending(path, it.res, it.file, await curMeta(path), bulk.fit); n++;
  }
  toast(`${n} 枚を保存待ちに入れました`); cancelBulk(false); renderPosters();
}
function cancelBulk(render = true) { if (bulk) { bulk.tok = ++upTok; bulk.items.forEach(it => { URL.revokeObjectURL(it.srcUrl); it.resUrl && URL.revokeObjectURL(it.resUrl); }); } bulk = null; if (render) renderBulk(); }
function renderBulk() {
  const box = $('bulkBox'); if (!bulk) { box.innerHTML = ''; return; }
  const c = caseOf(bulk.caseKey);
  const ok = bulk.items.filter(it => it.slot >= 0 && it.res).length, tgt = bulk.items.filter(it => it.slot >= 0).length;
  box.innerHTML = `<div class="up"><b>${c.n} をまとめて差し替える</b> <span class="help">ファイル名が枠の名前（例 INFO03）と同じならその枠へ、ほかは名前順に空いている枠へ入れました。枠は変えられます</span>
  <div class="drop" style="margin-top:10px" ondragover="dragOver(event)" ondragleave="dragLeave(event)" ondrop="bulkDrop(event)">ほかの画像に変えるには、ここに置くか <button class="sm" onclick="openBulk()">ファイルを選ぶ</button></div>
  <div class="inl" style="margin-top:10px"><span class="help">はみ出し:</span><select onchange="bulkSet('fit',this.value)">${Object.keys(FITN).map(k => `<option value="${k}" ${bulk.fit === k ? 'selected' : ''}>${FITN[k]}</option>`).join('')}</select>
   <span class="help">減色:</span><select onchange="bulkSet('level',this.value)">${Object.keys(LEVELS).map(k => `<option value="${k}" ${bulk.level === k ? 'selected' : ''}>${LEVELS[k].n}</option>`).join('')}</select>${ditherBox(bulk.dither, "bulkSet.bind(null,'dither')")}${bulk.busy ? '<span class="help">変換中…</span>' : ''}</div>
  <div class="tw" style="margin-top:8px"><table class="t bulk"><tr><th>選んだ画像</th><th>入れる枠</th><th>変換前</th><th>変換後（自動で小さい方式）</th><th>状態</th></tr>
  ${bulk.items.map((it, i) => `<tr><td><div class="inl"><img src="${it.srcUrl}" alt=""><span>${esc(it.file.name)}</span></div></td>
   <td><select onchange="bulkSlot(${i},this.value)"><option value="-1" ${it.slot < 0 ? 'selected' : ''}>入れない</option>${c.f.map((f, j) => `<option value="${j}" ${it.slot === j ? 'selected' : ''}>${j + 1}枚目 ${f.split('/').pop()}</option>`).join('')}</select></td>
   <td>${fmtB(it.file.size)}</td><td>${it.res ? it.res.w + '×' + it.res.h + ' ・ ' + fmtB(it.res.bytes.length) + '<br><small>' + esc(it.res.methodLabel) + (it.res.bytes.length > it.file.size && it.res.method !== 'orig' ? ' ・ 選んだ画像より大きい' : '') + '</small>' : '—'}</td><td>${esc(it.status)}</td></tr>`).join('')}</table></div>
  <div class="acts"><button class="pri" onclick="bulkCommit()" ${(!bulk.busy && ok > 0 && ok === tgt) ? '' : 'disabled'}>${ok} 枚を保存待ちに入れる</button><button onclick="cancelBulk()">やめる</button></div></div>`;
}

/* ---------- 同じ画像をまとめて入れる ---------- */
const baseNm = f => f.split('/').pop().replace(/\.png$/i, '');
// 枠の名前をまとめて書く: INFO_WIDE04・05・06
function groupNames(paths) {
  const n = paths.map(p => baseNm(p.replace(/^images\//, '')));
  const m = n.map(x => x.match(/^(.*?)(\d+)$/));
  if (n.length > 1 && m.every(x => x && x[1] === m[0][1])) return m[0][1] + m[0][2] + m.slice(1).map(x => '・' + x[2]).join('');
  return n.join('・');
}
// 保存待ちを「同じ画像」の組ごとにまとめる（組でない物は 1 件ずつ）
function pendGroups() {
  const gs = [], by = new Map();
  st.pending.forEach((d, path) => {
    if (d.grp) { const key = d.grp + '|' + d.w + 'x' + d.h + '|' + !!d.unchanged; let g = by.get(key); if (!g) { g = { paths: [], d }; by.set(key, g); gs.push(g); } g.paths.push(path); }
    else gs.push({ paths: [path], d });
  });
  return gs;
}
function openSame() { const i = $('fileOne'); i.value = ''; i.onchange = () => pickSame(i.files[0]); i.click(); }
function sameDrop(e) { e.preventDefault(); e.currentTarget.classList.remove('over'); const f = [...e.dataTransfer.files].find(x => x.type.startsWith('image/')); if (f) pickSame(f); }
function pickSame(file) {
  if (!file) return; const c = caseOf(selCase);
  const keep = same && same.caseKey === c.k ? same.on.slice() : null;
  cancelSame(false); selImg = null; up = null; cancelBulk(false);
  same = { file, caseKey: c.k, srcUrl: URL.createObjectURL(file), on: keep || c.f.map(() => true), fit: 'cover', level: levelOf(c.k), dither: dithOf(c.k), cache: {}, busy: true, err: null, tok: ++upTok };
  const S0 = same; const im = new Image(); im.onload = () => { if (same === S0) { S0.srcW = im.naturalWidth; S0.srcH = im.naturalHeight; renderSame(); } }; im.src = S0.srcUrl;
  renderPosters(); runSame();
}
const sameKey = (w, h) => w + 'x' + h;
async function runSame() {
  if (!same) return; const A = same; const tok = A.tok = ++upTok; A.busy = true; A.err = null;
  const c = caseOf(A.caseKey);
  const sizes = []; c.f.forEach((f, i) => { if (A.on[i]) { const [w, h] = sizeOfFile(c, f); const k = sameKey(w, h); if (!sizes.some(x => x.k === k)) sizes.push({ k, w, h }); } });
  renderSame();
  for (const z of sizes) {
    if (A.cache[z.k]) continue;
    try {
      const r = await convertImage(A.file, z.w, z.h, A.fit, A.level, A.dither);
      if (tok !== A.tok || same !== A) return;
      r.url = blobUrl(r.bytes); A.cache[z.k] = r;
    } catch (e) { if (tok === A.tok && same === A) { A.err = e.message; } }
    if (tok !== A.tok || same !== A) return;
    renderSame();
  }
  if (same === A && tok === A.tok) { A.busy = false; renderSame(); }
}
function sameClearCache(A) { Object.values(A.cache).forEach(r => r.url && URL.revokeObjectURL(r.url)); A.cache = {}; }
function sameSet(k, v) { sameClearCache(same); same[k] = v; runSame(); }
function sameTog(i, v) { same.on[i] = !!v; runSame(); }
function sameAll(v) { same.on = same.on.map(() => !!v); runSame(); }
async function sameCommit() {
  if (!same || same.busy) return; const A = same, c = caseOf(A.caseKey); const grp = 'g' + (++upTok); let n = 0;
  for (let i = 0; i < c.f.length; i++) {
    if (!A.on[i]) continue; const [w, h] = sizeOfFile(c, c.f[i]); const r = A.cache[sameKey(w, h)]; if (!r) return;
    const path = 'images/' + c.f[i];
    await addPending(path, r, A.file, await curMeta(path), A.fit, grp); n++;
  }
  toast(`同じ画像を ${n} 枠、保存待ちに入れました`); cancelSame(false); renderPosters();
}
function cancelSame(render = true) { if (same) { same.tok = ++upTok; URL.revokeObjectURL(same.srcUrl); sameClearCache(same); } same = null; if (render) renderSame(); }
function renderSame() {
  const box = $('sameBox'); if (!box) return; if (!same) { box.innerHTML = ''; return; }
  const c = caseOf(same.caseKey), A = same;
  const sel = c.f.map((f, i) => i).filter(i => A.on[i]);
  const sizes = {}; sel.forEach(i => { const [w, h] = sizeOfFile(c, c.f[i]); (sizes[sameKey(w, h)] = sizes[sameKey(w, h)] || { w, h, n: 0 }).n++; });
  const ready = sel.length > 0 && Object.keys(sizes).every(k => A.cache[k]);
  const fsz = Object.keys(sizes).map(k => A.cache[k] ? `${sizes[k].w}×${sizes[k].h}（${sizes[k].n} 枠）: ${fmtB(A.cache[k].bytes.length)} ・ ${esc(A.cache[k].methodLabel)}` : `${sizes[k].w}×${sizes[k].h}（${sizes[k].n} 枠）: 変換中…`);
  const r0 = Object.keys(sizes).map(k => A.cache[k]).find(Boolean);
  const asp = A.srcW && sel.length ? (() => { const [w, h] = sizeOfFile(c, c.f[sel[0]]); return { d: aspectDiff(A.srcW, A.srcH, w, h), w, h }; })() : null;
  box.innerHTML = `<div class="up"><b>${c.n} に同じ画像をまとめて入れる</b> <span class="help">1 枚の画像を、チェックした枠すべてに入れます。変換は 1 回だけ（枠の大きさが違うときは大きさごとに 1 回）</span>
  <div class="drop" style="margin-top:10px" ondragover="dragOver(event)" ondragleave="dragLeave(event)" ondrop="sameDrop(event)">ほかの画像に変えるには、ここに置くか <button class="sm" onclick="openSame()">ファイルを選ぶ</button>　<span class="help">選んだ画像: ${esc(A.file.name)}（${A.srcW ? A.srcW + '×' + A.srcH : '?'} ・ ${fmtB(A.file.size)}）</span></div>
  <div style="margin-top:10px"><span class="help">入れる枠:</span> <button class="sm" onclick="sameAll(true)">全部</button> <button class="sm" onclick="sameAll(false)">全部外す</button>
   <div class="slots">${c.f.map((f, i) => `<label class="slot ${A.on[i] ? 'on' : ''}"><input type="checkbox" ${A.on[i] ? 'checked' : ''} onchange="sameTog(${i},this.checked)"> ${i + 1}枚目 ${esc(baseNm(f))}</label>`).join('')}</div></div>
  <div class="inl" style="margin-top:10px"><span class="help">はみ出し:</span><select onchange="sameSet('fit',this.value)">${Object.keys(FITN).map(k => `<option value="${k}" ${A.fit === k ? 'selected' : ''}>${FITN[k]}</option>`).join('')}</select>
   <span class="help">減色:</span><select onchange="sameSet('level',this.value)">${Object.keys(LEVELS).map(k => `<option value="${k}" ${A.level === k ? 'selected' : ''}>${LEVELS[k].n}</option>`).join('')}</select>${ditherBox(A.dither, "sameSet.bind(null,'dither')")}${A.busy ? '<span class="help">変換中…</span>' : ''}</div>
  ${asp && asp.d > 0.02 ? `<div class="note">縦横の比が枠のファイル（${asp.w}×${asp.h}）と違います（${A.srcW}×${A.srcH}）。上の「はみ出し」で扱いを選べます。</div>` : ''}
  ${A.err ? `<div class="banner err">変換できませんでした: ${esc(A.err)}</div>` : ''}
  <div class="cmp"><div class="p"><h4>変換前（選んだ画像）</h4><div class="im" style="background-image:${esc(cssUrl(A.srcUrl))}"></div></div>
   <div class="p"><h4>変換後（全部の枠に入れる画像）</h4><div class="im" style="${r0 ? 'background-image:' + esc(cssUrl(r0.url)) : ''}"></div></div></div>
  <p class="help" style="margin-top:8px">${sel.length ? fsz.join('<br>') : '枠が 1 つも選ばれていません'}</p>
  <div class="acts"><button class="pri" onclick="sameCommit()" ${ready && !A.busy ? '' : 'disabled'}>同じ画像を ${sel.length} 枠、保存待ちに入れる</button><button onclick="cancelSame()">やめる</button></div></div>`;
}

/* ---------- 設定タブ ---------- */
function renderConv() {
  $('convTbl').innerHTML = '<tr><th>ケース</th><th>今のファイルの大きさ</th><th>形式</th><th>減色</th><th>ディザ</th></tr>' + CASES.map(c => `<tr><td>${c.n}</td><td>${c.sz}</td><td>PNG</td><td><select onchange="S.comp['${c.k}']=this.value;persistSettings()">${Object.keys(LEVELS).map(k => `<option value="${k}" ${levelOf(c.k) === k ? 'selected' : ''}>${LEVELS[k].n}</option>`).join('')}</select></td><td><input type="checkbox" style="width:auto" ${dithOf(c.k) ? 'checked' : ''} onchange="S.dith['${c.k}']=this.checked;persistSettings()"></td></tr>`).join('');
}
function renderSettings() {
  $('setToken').value = S.token; $('setRepo').value = S.repo; $('setBranch').value = S.branch;
  $('testBar').style.display = S.test ? '' : 'none';
  document.body.classList.toggle('testmode', !!S.test);
  $('modeTag').style.display = S.test ? '' : 'none'; $('roTag').style.display = st.readOnly ? '' : 'none';
  $('testLink').innerHTML = S.test ? '<a href="./">通常モードで開き直す</a>（試験モードの設定は、どこにも保存されていません）' : '<a href="?test=1">試験モードで開く</a>（本物の GitHub には何も送らず、手元のダミーで動きを確かめます。URL に <code>?test=1</code> を付けたときだけの状態で、設定には残りません）';
  $('connState').innerHTML = S.test ? '状態: <span class="propt">試験モード（本物の GitHub には何も送りません）</span>' : (S.token ? '状態: <span class="good">キー入力済み</span>' : '状態: キー未設定（読み取り専用）');
  renderConv();
}
function saveSettingsUi() {
  S.token = $('setToken').value.trim(); S.repo = $('setRepo').value.trim() || 'loy6161/clubVERSE'; S.branch = $('setBranch').value.trim() || 'main'; persistSettings(); renderSettings(); toast(S.test ? '試験モードなので、設定は保存していません' : '設定を保存しました（このブラウザの中だけ）');
  // 読み取り専用で開いていたら、キーを入れた時点で GitHub から読み直す
  if (!S.test && S.token && st.readOnly) reloadAll();
}
function clearToken() { S.token = ''; $('setToken').value = ''; persistSettings(); renderSettings(); toast('キーをこのブラウザから消しました'); }
async function testConn() {
  saveSettingsUi();
  if (!canApi()) { $('connState').textContent = '状態: キーが未設定です'; return; }
  $('connState').textContent = '接続テスト中…';
  try {
    const r = await gh('GET', `/repos/${S.repo}`);
    const c = await gh('GET', `/repos/${S.repo}/contents/${encPath(CFG_PATH)}?ref=${encodeURIComponent(S.branch)}`);
    const canPush = r.permissions ? (r.permissions.push ? '書き込みOK' : '書き込み権限なし') : '権限は不明';
    $('connState').innerHTML = `状態: <span class="good">接続できました</span>（${esc(r.full_name)} ・ ${canPush} ・ config.json ${fmtB(c.size || 0)}）`;
  } catch (e) { $('connState').innerHTML = `状態: <span style="color:var(--bad)">失敗: ${errHtml(e)}</span>`; }
}

/* ---------- 保存の確認と実行 ---------- */
function lineDiff(a, b) {
  const A = a.split('\n'), B = b.split('\n'), n = A.length, m = B.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const ops = []; let i = 0, j = 0;
  while (i < n && j < m) { if (A[i] === B[j]) { ops.push([' ', A[i]]); i++; j++; } else if (dp[i + 1][j] >= dp[i][j + 1]) ops.push(['-', A[i++]]); else ops.push(['+', B[j++]]); }
  while (i < n) ops.push(['-', A[i++]]); while (j < m) ops.push(['+', B[j++]]);
  const keep = new Array(ops.length).fill(false);
  ops.forEach((o, k) => { if (o[0] !== ' ') for (let d = -2; d <= 2; d++) if (ops[k + d]) keep[k + d] = true; });
  const out = []; let gap = false;
  ops.forEach((o, k) => { if (keep[k]) { out.push(`<div class="${o[0] === '+' ? 'a' : o[0] === '-' ? 'd' : ''}">${o[0]} ${esc(o[1])}</div>`); gap = false; } else if (!gap) { out.push('<div style="color:var(--sub)">  …</div>'); gap = true; } });
  return out.join('');
}
let saving = false, lastResult = null;
function openConfirm() {
  const ch = computeChanges(), v = validate(); const txt = configText();
  const nImg = [...st.pending.values()].filter(d => !d.unchanged).length;
  const defMsg = 'VERSE CITY 設定: ' + [ch.some(c => c.t !== 'img' && c.t !== 'imgsame') ? 'config.json' : '', nImg ? `ポスター画像 ${nImg} 枚` : ''].filter(Boolean).join(' / ');
  const noChange = !ch.some(c => c.t !== 'imgsame');
  const canSave = !st.readOnly && !noChange && !v.errors.length;
  $('modalBox').innerHTML = `<h3>保存の確認${S.test ? ' <span class="mock">試験モード</span>' : ''}</h3>
  ${S.test ? '<div class="banner warn">試験モードです。本物の GitHub には何も送りません（手元のダミーに書くだけです）。</div>' : `<p class="help" style="margin:0 0 6px">${esc(S.repo)} の ${esc(S.branch)} に、1 回のコミットで書き込みます。</p>`}
  ${st.readOnly ? '<div class="banner err">キーが未設定か、GitHub から読めなかったので、保存できません。「設定（キー）」で確かめてください。</div>' : ''}
  ${v.errors.length ? `<div class="banner err"><b>直してから保存してください</b><ul style="margin:4px 0 0 18px;padding:0">${v.errors.map(e => `<li>${esc(e)}</li>`).join('')}</ul></div>` : ''}
  ${v.warns.length ? `<div class="banner warn"><ul style="margin:0 0 0 18px;padding:0">${v.warns.map(e => `<li>${esc(e)}</li>`).join('')}</ul></div>` : ''}
  <b>変更の一覧（${ch.filter(c => c.t !== 'imgsame').length} 件）</b>
  ${ch.length ? `<ul class="chg">${ch.map(c => `<li class="${c.cls || ''}">${c.h}</li>`).join('')}</ul>` : '<p class="help">変更はありません。</p>'}
  ${noChange && ch.length ? '<p class="help">書き換わる物がないので、コミットは作りません。</p>' : ''}
  ${nImg ? `<b style="display:block;margin-top:12px">差し替える画像（${nImg} 枚）</b><div class="imgs">${pendGroups().filter(g => !g.d.unchanged).map(g => { const d = g.d; return `<div class="it"><img src="${d.url}" alt=""><div><b>${g.paths.length > 1 ? '同じ画像 × ' + g.paths.length + ' 枠（' + esc(groupNames(g.paths)) + '）' : esc(g.paths[0].replace(/^images\//, ''))}</b><br>${d.w}×${d.h} ・ ${g.paths.length === 1 && d.beforeSize ? fmtB(d.beforeSize) + ' → ' : ''}${fmtB(d.bytes.length)}<br>方式: ${esc(d.methodLabel)}<br>はみ出し: ${esc(d.fitText)}</div></div>`; }).join('')}</div>` : ''}
  <details style="margin-top:12px"><summary>config.json の差分</summary><div class="dfx" style="margin-top:8px">${lineDiff(st.baseText.replace(/\r\n/g, '\n'), txt)}</div></details>
  <label class="f">コミットメッセージ</label><input type="text" id="commitMsg" value="${esc(defMsg)}">
  <div id="saveState" class="help" style="margin-top:8px"></div>
  <div class="acts"><button class="pri" id="doSaveBtn" onclick="doSave()" ${canSave ? '' : 'disabled'}>${S.test ? '試験保存（ダミーに書く）' : 'この内容で GitHub に保存'}</button><button onclick="closeModal()">閉じる</button></div>`;
  $('modal').classList.add('on');
}
function closeModal() { if (saving) return; $('modal').classList.remove('on'); }
function setSaveState(t, bad, html) { const e = $('saveState'); if (e) e.innerHTML = bad ? `<span style="color:var(--bad)">${html || esc(t)}</span>` : esc(t); }
const conflict = m => { const e = new Error(m); e.ja = m; return e; };
async function doSave() {
  if (saving) return; const v = validate(); if (v.errors.length || st.readOnly) return;
  saving = true; $('doSaveBtn').disabled = true;
  const msg = $('commitMsg').value.trim() || 'VERSE CITY 設定を更新';
  try {
    const cfgText = configText();
    const R = `/repos/${S.repo}`, B = branchPath();
    // 1. ブランチの先頭を先に取り、その木の中の config.json と画像の sha で、読み込み時と比べる
    setSaveState('ブランチの先頭を確かめています…');
    const ref = await gh('GET', `${R}/git/ref/heads/${B}`);
    const headSha = ref.object.sha;
    const head = await gh('GET', `${R}/git/commits/${headSha}`);
    setSaveState('config.json が読み込んだときのままか確かめています…');
    const cur = await gh('GET', `${R}/contents/${encPath(CFG_PATH)}?ref=${headSha}`);
    if (cur.sha !== st.cfgSha) throw conflict('config.json が、読み込んだあとに別の場所で書き換えられています。「読み直す」でやり直してください（いまの変更は消えます。必要なら先に内容を控えてください）');
    for (const [path, d] of st.pending) {
      setSaveState(`画像が読み込んだときのままか確かめています: ${path}`);
      if (d.beforeSha === null) throw conflict(`画像 ${path} の差し替え前の状態を確認できていません。画像をもう一度選び直してください`);
      let sha = '';
      try { sha = (await gh('GET', `${R}/contents/${encPath(path)}?ref=${headSha}`)).sha || ''; } catch (e) { if (e.status !== 404) throw e; }
      if (sha !== d.beforeSha) throw conflict(`画像 ${path} が、選んだあとに別の場所で書き換えられています。この画像を選び直すか、「読み直す」でやり直してください`);
    }
    const items = [];
    const real = [...st.pending].filter(([p, d]) => !d.unchanged);
    if (!real.length && !computeChanges().some(c => c.t !== 'img' && c.t !== 'imgsame')) { saving = false; $('doSaveBtn').disabled = false; setSaveState('書き換わる物がないので、コミットは作りませんでした。'); return; }
    const files = [[CFG_PATH, new TextEncoder().encode(cfgText)]].concat(real.map(([p, d]) => [p, d.bytes]));
    let k = 0; const blobOf = new Map();     // 同じ中身（同じ画像データ）の blob は 1 回だけ作り、枠の数だけ木に並べる
    const uniq = new Set(files.map(f => f[1])).size;
    for (const [path, bytes] of files) {
      let sha = blobOf.get(bytes);
      if (!sha) { setSaveState(`アップロード中 ${++k} / ${uniq}: ${path}`); sha = (await gh('POST', `${R}/git/blobs`, { content: bytesB64(bytes), encoding: 'base64' })).sha; blobOf.set(bytes, sha); }
      items.push({ path, mode: '100644', type: 'blob', sha });
    }
    setSaveState('コミットを作っています…');
    const tree = await gh('POST', `${R}/git/trees`, { base_tree: head.tree.sha, tree: items });
    const commit = await gh('POST', `${R}/git/commits`, { message: msg, tree: tree.sha, parents: [headSha] });
    await gh('PATCH', `${R}/git/refs/heads/${B}`, { sha: commit.sha, force: false });
    lastResult = { commit: commit.sha, files: files.map(f => f[0]), cfgBlob: items[0].sha };
    // 新しい状態を基準にする
    st.cfgSha = items[0].sha; const parsed = JSON.parse(cfgText);
    const savedLocal = {}; real.forEach(([p, d]) => { savedLocal[p] = d.url; d.url = null; });
    st.pending.forEach(d => d.url && URL.revokeObjectURL(d.url));
    const mi = st.mems.findIndex(m => m.id === selMem), ss = selSlot.slice();
    initFromConfig(parsed, cfgText);    // 保存した内容を読み込み直した形にそろえる
    selMem = st.mems[mi] ? st.mems[mi].id : (st.mems[0] || {}).id; selSlot = ss;
    st.rev++;
    if (st.shas) items.forEach(it => { if (it.path !== CFG_PATH) st.shas[it.path] = it.sha; });
    Object.assign(st.local, savedLocal);    // 保存した画像は、手元のデータをそのまま出す（読み直すと新しい sha で読む）
    saving = false;
    $('modalBox').innerHTML = `<h3>保存しました</h3><p>コミット <code>${commit.sha.slice(0, 7)}</code> を ${S.test ? '手元のダミー' : esc(S.repo)} の ${esc(S.branch)} に書きました（${files.length} ファイル）。</p>
     <p class="help">公開側への反映は保存から 1〜2 分、ワールドや他の人のブラウザには最大 10 分ほど古い絵が出ることがあります。</p>
     <div class="acts"><button class="pri" onclick="closeModal();renderAll()">閉じる</button></div>`;
    return;
  } catch (e) {
    saving = false; $('doSaveBtn').disabled = false; setSaveState('', true, '保存できませんでした: ' + errHtml(e));
  }
}
/* ---------- JSON 表示・全体描画 ---------- */
function json() { try { $('json').textContent = configText(); } catch (e) { $('json').textContent = String(e); } }
const tabs = ['sets', 'memory', 'posters', 'ander', 'settings'];
function show(t) {
  if (!tabs.includes(t)) t = 'sets';
  document.querySelectorAll('.tab').forEach(e => e.classList.toggle('on', e.id === 'tab-' + t));
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
  try { history.replaceState(null, '', location.search + '#' + t) } catch (e) { }; window.scrollTo(0, 0);
}
function renderAll() { renderSettings(); renderSets(); renderMem(); renderPosters(); json(); updateDirty(); }
async function reloadAll() {
  if (computeChanges().length && !confirm('未保存の変更は消えます。読み直しますか？')) return;
  if (await loadAll()) renderAll();
}
window.addEventListener('beforeunload', e => { if (st.baseCfg && computeChanges().length) { e.preventDefault(); e.returnValue = ''; } });
document.querySelectorAll('#nav button').forEach(b => b.onclick = () => show(b.dataset.t));
$('modal').addEventListener('click', e => { if (e.target === $('modal')) closeModal(); });

(async function init() {
  loadSettings();
  renderSettings();
  const h = location.hash.slice(1);
  const ok = await loadAll();
  if (ok) {
    if (h === 'posters-up' || h === 'posters-img') { selCase = h === 'posters-up' ? 'weekly' : 'info_wide4_6'; selImg = 1; selFloor = (boardsOf(selCase)[0] || { floor: 1 }).floor; }
    renderAll();
  } else { renderSettings(); }
  show(h === 'posters-up' || h === 'posters-img' ? 'posters' : h);
  window.__sv = { st, S, pickSame, get same() { return same; }, buildConfig, configText, computeChanges, validate, pickOne, pickMany, convertImage, quantizeRGBA, get up() { return up; }, get bulk() { return bulk; }, get last() { return lastResult; } };
})();
