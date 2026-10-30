/* ระบบภายใน สตว. สทช.14 — ทะเบียนรับตัวอย่าง (ลงรับ · ถ่ายรูปพร้อมลายน้ำ · ติดตามสถานะ/ผลทดสอบ)
   ข้อมูลทั้งหมดอยู่ใน Google Sheets/Drive ผ่าน Apps Script (Code-staff.gs v2) · หน้านี้ไม่มีข้อมูลหรือรหัสใด ๆ
   v2: เร็วขึ้น (แคชในเครื่อง · เปิดฟอร์มทันที · บันทึก+รูปในคำสั่งเดียว · เปลี่ยนสถานะ/ผลทันทีแล้วค่อยซิงก์)
       รายการย่อยต่อวัสดุ (ครบ/ไม่ครบ) · ลบทะเบียน (ผู้สร้าง/ผู้ดูแล) · เลขรับปีปฏิทิน พ.ศ. · โครงการไม่บังคับ */
(function () {
  'use strict';
  const API = window.STAFF_API || '';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const app = $('#app'), ttl = $('#ttl'), whoBtn = $('#who');
  const esc = s => String(s == null ? '' : s).replace(/^'(?=[=+\-@])/, '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const raw = s => String(s == null ? '' : s).replace(/^'(?=[=+\-@])/, '');
  const LS = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); sessionStorage.removeItem(k); } catch (e) {} }
  };
  const STATUS = ['รับแล้ว', 'กำลังทดสอบ', 'ผลออก', 'ส่งผลแล้ว'];
  const GRP = { A: ['สทช.14', 'สทช.14'], B: ['ขทช.', 'แขวงทางหลวงชนบท'], C: ['หน่วยงานนอก', 'หน่วยงานภายนอก'], D: ['ผู้รับจ้าง', 'ผู้รับจ้าง/ประชาชน'] };
  const KHT = ['แขวงทางหลวงชนบทกระบี่', 'แขวงทางหลวงชนบทตรัง', 'แขวงทางหลวงชนบทพัทลุง', 'แขวงทางหลวงชนบทพังงา', 'แขวงทางหลวงชนบทภูเก็ต'];
  const MAX_PHOTO = 10, IMG_MAX = 1600, THUMB = 280;            // [รอยืนยัน] สูงสุด 10 รูป · ด้านยาว 1,600 px · รูปย่อ 280 px (เก็บใน Sheet)
  const TM = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const TMF = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  const pad = n => String(n).padStart(2, '0');
  const isoToday = () => { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  const thDate = iso => { const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? Number(m[3]) + ' ' + TM[m[2] - 1] + ' ' + (Number(m[1]) + 543) : ''; };
  const thShort = iso => { const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? Number(m[3]) + ' ' + TM[m[2] - 1] : ''; };
  const thStamp = s => { const m = String(s || '').match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/); return m ? thDate(m[1]) + ' ' + m[2] : esc(s); };
  const yrOf = iso => Number(String(iso).slice(0, 4)) + 543;          // เลขรับนับตามปีปฏิทิน พ.ศ.
  const slug = no => String(no).replace('/', '-'), unslug = s => String(s).replace('-', '/');
  const grpLabel = r => r.grp ? r.grp + ' · ' + (r.agency ? raw(r.agency).replace('แขวงทางหลวงชนบท', 'ขทช.') : GRP[r.grp][0]) : '';
  const prjLine = r => [raw(r.prj), r.road ? (r.prj ? '' : 'สาย ') + raw(r.road) : ''].filter(Boolean).map(esc).join(' · ') || '<span class="ref">(ไม่ระบุโครงการ)</span>';
  const badge = r => {
    if (r.status === 'ผลออก') return r.nFail ? `<span class="bd s3b">ผลออก · ไม่ผ่าน ${r.nFail}</span>` : `<span class="bd s3">ผลออก${r.nPass ? ' · ผ่าน' : ''}</span>`;
    return `<span class="bd s${STATUS.indexOf(r.status) + 1}">${esc(r.status)}</span>`;
  };
  const IC = {
    cam: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
    img: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 16l5-5 5 5 3-3 5 5"/></svg>',
    srch: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>',
    plus: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    lock: '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>',
    x: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>'
  };

  /* ---------- รายการวัสดุ: ดึงจากหน้าแรก หัวข้อ General Test (#qty) · แคชในเครื่อง ---------- */
  let CAT = LS.get('gt_staff_cat2');
  /* แยก "ส่ง" เป็นรายการย่อยตามเครื่องหมาย · */
  const splitSubs = s => String(s || '').split(/\s+·\s+/).map(x => x.trim()).filter(Boolean);
  async function loadCatalog() {
    try {
      const r = await fetch('../index.html', { cache: 'no-cache' }); const d = new DOMParser().parseFromString(await r.text(), 'text/html');
      const box = d.querySelector('#qty + .qty');
      const cat = $$('details', box).map(det => ({
        g: $('summary', det).textContent.replace(/\s*\(\d+\).*$/, '').trim(),
        items: $$('.qi', det).map(qi => {
          const qd = {}; $$('.qd', qi).forEach(x => { const k = $('span', x); if (k) qd[k.textContent.trim()] = x.textContent.slice(k.textContent.length).trim(); });
          return { name: $('.qh b', qi).textContent.replace(/^└\s*/, '').trim(), sub: qi.classList.contains('sub'), std: $$('.qh .mchip', qi).map(x => x.textContent.trim()).join(' · '), send: qd['ส่ง'] || '', freq: qd['ความถี่'] || '' };
        })
      })).filter(g => g.items.length);
      if (cat.length) { CAT = cat; LS.set('gt_staff_cat2', cat); }
    } catch (e) { if (!CAT) CAT = []; }
    return CAT;
  }
  const catFind = n => { for (const g of CAT || []) for (const it of g.items) if (it.name === n) return it; return null; };
  const OTHER = '__other';

  /* ---------- สถานะการเข้าใช้ + แคช ---------- */
  let sess = LS.get('gt_staff_tok') || (function () { try { return JSON.parse(sessionStorage.getItem('gt_staff_tok')); } catch (e) { return null; } })();
  if (sess && !(sess.exp > Date.now())) { LS.del('gt_staff_tok'); sess = null; }
  const C = LS.get('gt_staff_cache') || {};                    // { items, users } เปิดทะเบียนได้ทันที แล้วค่อยซิงก์
  let listCache = C.items || null, users = C.users || [];
  const det = {};                                              // รายละเอียดที่เปิดแล้ว (ในหน่วยความจำ)
  const saveCache = () => LS.set('gt_staff_cache', { items: listCache || [], users });
  let filt = { q: '', st: '' }, viewTok = 0;

  function toast(t, err) {
    const el = $('#toast'); el.textContent = t; el.className = 'toast' + (err ? ' err' : ''); el.hidden = false;
    clearTimeout(toast.t); toast.t = setTimeout(() => { el.hidden = true; }, err ? 5000 : 2200);
  }
  async function call(action, data) {
    if (!API) throw Object.assign(new Error('ยังไม่ได้เชื่อมระบบ (รอใส่ URL Apps Script)'), { code: 'NO_API' });
    let r;
    try {
      r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(Object.assign({ action, token: sess && sess.t }, data || {})), cache: 'no-store' });
    } catch (e) { throw Object.assign(new Error('เชื่อมต่อไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่'), { code: 'NET' }); }
    let j; try { j = await r.json(); } catch (e) { throw Object.assign(new Error('ระบบตอบกลับไม่ถูกต้อง (' + r.status + ')'), { code: 'BAD' }); }
    if (!j.ok) {
      if (j.code === 'AUTH') { LS.del('gt_staff_tok'); sess = null; setWho(); location.hash = '#login'; }
      throw Object.assign(new Error(j.err || 'ผิดพลาด'), { code: j.code });
    }
    if (j.users) { users = j.users; saveCache(); }
    if (j.rec) { j.rec._t = Date.now(); det[j.rec.no] = j.rec; upsertList(j.rec); }
    return j;
  }
  /* ปรับรายการในทะเบียนจากรายละเอียดล่าสุด (ไม่ต้องโหลดทะเบียนใหม่ทั้งหมด) */
  function upsertList(rec) {
    if (!listCache) return;
    const s = { no: rec.no, date: rec.date, grp: rec.grp, agency: rec.agency, prj: rec.prj, road: rec.road, con: rec.con, sender: rec.sender, tel: rec.tel, status: rec.status, report: rec.report, by: rec.by,
      nMat: rec.mats.length, nFail: rec.mats.filter(m => m.result === 'ไม่ผ่าน').length, nPass: rec.mats.filter(m => m.result === 'ผ่าน').length, nPhoto: rec.photos.length, nMiss: rec.mats.filter(m => m.done === 'ไม่ครบ').length };
    const i = listCache.findIndex(x => x.no === rec.no);
    if (i >= 0) listCache[i] = s; else listCache.push(s);
    listCache.sort((a, b) => b.no.localeCompare(a.no)); saveCache();
  }
  function setWho() {
    if (sess && sess.me) { whoBtn.hidden = false; whoBtn.innerHTML = `<span class="av">${esc(sess.me.slice(0, 1))}</span><span class="nm">${esc(sess.me)}</span>`; }
    else whoBtn.hidden = true;
  }
  whoBtn.addEventListener('click', () => {
    sheet(`<h2>${esc(sess.me)}</h2><p class="ref" style="margin:0 0 12px">เข้าระบบถึง ${new Date(sess.exp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.</p>
      <button class="btn" type="button" data-out>ออกจากระบบ</button><button class="btn ghost" type="button" data-close>ปิด</button>`, m => {
      $('[data-out]', m).onclick = async () => { try { await call('logout'); } catch (e) {} LS.del('gt_staff_tok'); LS.del('gt_staff_cache'); sess = null; listCache = null; setWho(); closeSheet(); location.hash = '#login'; };
    });
  });

  /* ---------- แผ่นล่าง (modal) ---------- */
  function sheet(html, init) {
    closeSheet();
    const m = document.createElement('div'); m.className = 'mdl'; m.innerHTML = `<div class="mbox" role="dialog" aria-modal="true">${html}</div>`;
    m.addEventListener('click', e => { if (e.target === m || e.target.closest('[data-close]')) closeSheet(); });
    document.body.appendChild(m); document.body.classList.add('noscroll');
    if (init) init(m);
    return m;
  }
  function closeSheet() { $$('.mdl').forEach(x => x.remove()); document.body.classList.remove('noscroll'); }

  /* ---------- เส้นทางหน้า ---------- */
  async function route() {
    closeSheet();
    const h = location.hash.slice(1), my = ++viewTok;
    if (!API) { ttl.textContent = 'ทะเบียนรับตัวอย่าง'; app.innerHTML = `<div class="box st-empty"><div class="lock">${IC.lock}</div><h2>ยังไม่ได้เชื่อมระบบ</h2><p class="ref">ผู้ดูแลต้อง Deploy Apps Script ระบบภายใน แล้วใส่ URL ในหน้านี้ก่อน</p></div>`; return; }
    if (!sess) return viewLogin();
    setWho();
    window.scrollTo(0, 0);
    try {
      if (h === 'new') return await viewForm(null, my);
      if (h.startsWith('r/')) return await viewDetail(unslug(h.slice(2)), my);
      if (h.startsWith('e/')) return await viewForm(unslug(h.slice(2)), my);
      return await viewList(my);
    } catch (e) { if (my === viewTok) fail(e); }
  }
  function fail(e) {
    if (e.code === 'AUTH') return;
    app.innerHTML = `<div class="box st-empty"><h2>ทำรายการไม่สำเร็จ</h2><p class="ref">${esc(e.message)}</p><button class="btn" type="button" onclick="location.reload()">ลองใหม่</button></div>`;
  }
  const busy = t => { app.innerHTML = `<p class="ref st-load">${t || 'กำลังโหลด…'}</p>`; };

  /* ---------- เข้าสู่ระบบ: PIN ส่วนตัว 4 หลักอย่างเดียว ---------- */
  function viewLogin() {
    ttl.textContent = 'เข้าสู่ระบบภายใน'; setWho();
    app.innerHTML = `<form class="box st-login" autocomplete="off" novalidate>
      <div class="lock">${IC.lock}</div>
      <h2>ทะเบียนรับตัวอย่าง</h2>
      <p class="ref" style="margin:0 0 10px">ใส่ PIN ส่วนตัว 4 หลัก</p>
      <span class="pinw"><input class="pinin" name="pin" type="password" inputmode="numeric" pattern="\\d{4}" maxlength="4" autocomplete="one-time-code" aria-label="PIN 4 หลัก" required>
        <span class="pin" aria-hidden="true"><span></span><span></span><span></span><span></span></span></span>
      <p class="st-err" id="lerr" role="alert"></p>
      <button class="btn" type="submit">เข้าสู่ระบบ</button>
      <label class="chk"><input type="checkbox" name="rem" checked> จำการเข้าสู่ระบบในเครื่องนี้ 8 ชั่วโมง</label>
    </form>
    <p class="ref">• ใส่ PIN ผิดหลายครั้ง ระบบจะพักการเข้าระบบชั่วคราวและแจ้งผู้ดูแล<br>• ลืม PIN ติดต่อผู้ดูแลระบบ สตว.<br>• ไม่ใช่เจ้าหน้าที่ สตว.? <a href="../submit/index.html">สร้างใบนำส่งตัวอย่าง →</a></p>`;
    const f = $('form', app), pin = f.pin, dots = $$('.pin span', f);
    const paint = () => { pin.value = pin.value.replace(/\D/g, '').slice(0, 4); dots.forEach((d, i) => { d.textContent = i < pin.value.length ? '•' : ''; d.classList.toggle('f', i < pin.value.length); d.classList.toggle('cur', i === pin.value.length && document.activeElement === pin); }); };
    pin.addEventListener('input', () => { paint(); if (pin.value.length === 4) f.requestSubmit(); });
    pin.addEventListener('focus', paint); pin.addEventListener('blur', paint);
    pin.focus();
    loadCatalog();                                  // เตรียมรายการวัสดุไว้ล่วงหน้า
    f.addEventListener('submit', async e => {
      e.preventDefault();
      const er = $('#lerr'); er.textContent = '';
      if (!/^\d{4}$/.test(pin.value)) { er.textContent = 'PIN ต้องเป็นตัวเลข 4 หลัก'; return; }
      const b = $('button[type=submit]', f); b.disabled = true; b.textContent = 'กำลังตรวจสอบ…';
      try {
        const j = await call('login', { pin: pin.value, remember: f.rem.checked });
        sess = { t: j.token, me: j.me, exp: j.exp, admin: !!j.admin };
        if (f.rem.checked) LS.set('gt_staff_tok', sess); else try { sessionStorage.setItem('gt_staff_tok', JSON.stringify(sess)); } catch (x) {}
        const to = location.hash === '#login' || !location.hash ? '#list' : location.hash; if (location.hash !== to) location.hash = to; else route();
      } catch (x) { er.textContent = x.message; pin.value = ''; paint(); pin.focus(); b.disabled = false; b.textContent = 'เข้าสู่ระบบ'; }
    });
  }

  /* ---------- ทะเบียน: แสดงจากแคชทันที แล้วซิงก์ ---------- */
  async function viewList(my) {
    ttl.textContent = 'ทะเบียนรับตัวอย่าง';
    if (listCache) drawList(true); else busy();
    try { const j = await call('list'); listCache = j.items || []; saveCache(); if (my === viewTok) drawList(); }
    catch (e) { if (my !== viewTok) return; if (!listCache) throw e; toast(e.message, true); drawList(); }
  }
  function drawList(syncing) {
    const it = listCache || [];
    const cnt = s => it.filter(r => r.status === s).length;
    const q = filt.q.trim().toLowerCase();
    const show = it.filter(r => (!filt.st || r.status === filt.st || (filt.st === '__miss' && r.nMiss)) &&
      (!q || [r.no, r.prj, r.road, r.con, r.agency, r.sender].some(v => raw(v).toLowerCase().includes(q))));
    let h = `<label class="stsearch">${IC.srch}<input type="search" id="q" placeholder="ค้นหา เลขรับ · โครงการ · สายทาง · ผู้รับจ้าง" value="${esc(filt.q)}" aria-label="ค้นหา"></label>
      <div class="chips" role="tablist">${[['', 'ทั้งหมด', it.length]].concat(STATUS.map(s => [s, s, cnt(s)]), [['__miss', 'ตัวอย่างไม่ครบ', it.filter(r => r.nMiss).length]]).map(([v, t, n]) =>
        `<button type="button" class="chip${filt.st === v ? ' on' : ''}" data-st="${esc(v)}">${t}<i>${n}</i></button>`).join('')}</div>${syncing ? '<p class="ref sync">กำลังซิงก์…</p>' : ''}`;
    let lastM = '';
    show.forEach(r => {
      const m = String(r.date).slice(0, 7);
      if (m !== lastM) { lastM = m; const [y, mo] = m.split('-').map(Number); h += `<div class="mhd">${TMF[mo - 1] || ''} ${y + 543}</div>`; }
      h += `<a class="rec" href="#r/${slug(r.no)}"><div class="t"><span class="no">${esc(r.no)}</span>${badge(r)}</div>
        <p>${prjLine(r)}</p>
        <div class="m">${r.nMiss ? `<span class="missb">ไม่ครบ ${r.nMiss}</span>` : ''}<span>${esc(grpLabel(r))}</span><span>${thShort(r.date)}</span><span>📷 ${r.nPhoto}</span><span>วัสดุ ${r.nMat}</span></div></a>`;
    });
    if (!show.length) h += `<div class="box st-empty"><p class="ref" style="margin:0">${it.length ? 'ไม่พบรายการที่ตรงกับการค้นหา' : 'ยังไม่มีรายการ · กด "+ ลงรับ" เพื่อเริ่ม'}</p></div>`;
    h += `<a class="fab" href="#new">${IC.plus}ลงรับ</a>`;
    app.innerHTML = h;
    const qi = $('#q', app);
    qi.addEventListener('input', () => { filt.q = qi.value; const p = qi.selectionStart; drawList(); const n = $('#q', app); n.focus(); n.setSelectionRange(p, p); });
    $$('.chip', app).forEach(c => c.onclick = () => { filt.st = c.dataset.st; drawList(); });
  }
  /* เลขรับถัดไป คำนวณจากทะเบียนในเครื่อง (ระบบตรวจซ้ำและเลื่อนเลขให้เองถ้าชน) */
  function nextNoLocal(date) {
    const y = yrOf(date); let max = 0;
    (listCache || []).forEach(r => { const m = String(r.no).match(/^(\d{4})\/(\d{4})$/); if (m && Number(m[1]) === y) max = Math.max(max, Number(m[2])); });
    return y + '/' + pad3(max + 1);
  }
  const pad3 = n => ('000' + n).slice(-4);

  /* ---------- ฟอร์มลงรับ / แก้ไข: เปิดทันทีจากข้อมูลในเครื่อง ---------- */
  async function viewForm(no, my) {
    ttl.textContent = no ? 'แก้ไข ' + no : 'ลงรับตัวอย่าง';
    let rec = { no: '', date: isoToday(), grp: 'B', agency: KHT[0], prj: '', road: '', con: '', sender: '', tel: '', note: '', by: sess.me, mats: [blank()] };
    let autoNo = !no;
    if (no) { rec = det[no] || (busy(), (await call('get', { no })).rec); if (my !== viewTok) return; }
    else rec.no = nextNoLocal(rec.date);
    if (!CAT || !CAT.length) { busy(); await loadCatalog(); if (my !== viewTok) return; } else loadCatalog();
    if (!users.length) { try { users = (await call('users')).users || []; saveCache(); } catch (e) {} }
    const us = users.slice(); if (rec.by && us.indexOf(raw(rec.by)) < 0) us.push(raw(rec.by));
    const queue = [];                    // รูปที่ถ่ายก่อนบันทึก (ส่งพร้อมบันทึกลงรับ)
    const agencyField = g => g === 'A' ? `<input class="in" name="agency" value="สทช.14" readonly>`
      : g === 'B' ? (() => { const own = rec.grp === 'B' && rec.agency && KHT.indexOf(raw(rec.agency)) < 0;
          return `<select class="in" name="agsel">${KHT.map(k => `<option${k === raw(rec.agency) ? ' selected' : ''}>${k}</option>`).join('')}<option value="${OTHER}"${own ? ' selected' : ''}>อื่น ๆ (พิมพ์เอง)</option></select>
          <input class="in mother0" name="agency" maxlength="150" value="${esc(own ? rec.agency : '')}" placeholder="พิมพ์ชื่อหน่วยงาน"${own ? '' : ' hidden'}>`; })()
      : `<input class="in" name="agency" maxlength="150" value="${esc(GRP[g] && rec.grp === g ? rec.agency : '')}" placeholder="${g === 'C' ? 'เช่น อบต. … / ยผ. …' : 'ชื่อผู้รับบริการ / บริษัท'}">`;
    const subsFor = (name, old) => {
      const it = catFind(name), parts = it ? splitSubs(it.send) : [];
      const list = parts.length ? parts : ['ตัวอย่าง'];
      return list.map(t => { const o = (old || []).find(x => x.t === t); return { t, d: o ? o.d : 'ครบ' }; });
    };
    const subRows = subs => subs.map((s, k) => `<div class="sub" data-k="${k}"><span>${esc(s.t)}</span><div class="seg2" role="radiogroup" aria-label="${esc(s.t)}"><button type="button" role="radio" data-d="ครบ" class="${s.d !== 'ไม่ครบ' ? 'on ok' : ''}" aria-checked="${s.d !== 'ไม่ครบ'}">✓ ครบ</button><button type="button" role="radio" data-d="ไม่ครบ" class="${s.d === 'ไม่ครบ' ? 'on bad' : ''}" aria-checked="${s.d === 'ไม่ครบ'}">ไม่ครบ</button></div></div>`).join('');
    const qtyNum = q => { const m = String(raw(q)).match(/^\s*(\d+(?:\.\d+)?)/); return m ? m[1] : raw(q); };
    const matRow = (m, i) => {
      const it = catFind(raw(m.name)), other = !!m.name && !it;
      const subs = m.subs && m.subs.length ? m.subs : (m.name ? subsFor(raw(m.name), m.done === 'ไม่ครบ' ? [{ t: 'ตัวอย่าง', d: 'ไม่ครบ' }] : []) : []);
      const anyMiss = subs.some(s => s.d === 'ไม่ครบ');
      return `<div class="mrow" data-i="${i}">
        <div class="mtop"><b>${i + 1}</b><select class="in" name="mpick" aria-label="วัสดุ"><option value="">— เลือกวัสดุ —</option>${(CAT || []).map(g => `<optgroup label="${esc(g.g)}">${g.items.map(x => `<option value="${esc(x.name)}"${it && it.name === x.name ? ' selected' : ''}>${x.sub ? '└ ' : ''}${esc(x.name)}</option>`).join('')}</optgroup>`).join('')}<option value="${OTHER}"${other ? ' selected' : ''}>อื่น ๆ (พิมพ์เอง)</option></select><button class="mdel" type="button" aria-label="ลบรายการ">${IC.x}</button></div>
        <input class="in mother" name="mname" maxlength="200" value="${esc(other ? m.name : '')}" placeholder="ชื่อวัสดุ" aria-label="ชื่อวัสดุ (อื่น ๆ)"${other ? '' : ' hidden'}>
        <div class="mq"${m.name ? '' : ' hidden'}><label class="qty"><input class="in" name="mqty" inputmode="decimal" maxlength="10" value="${esc(qtyNum(m.qty) || '1')}" aria-label="จำนวนชุด"><span>ชุด</span></label><input class="in" name="msrc" maxlength="200" value="${esc(m.src)}" placeholder="แหล่ง / กม." aria-label="แหล่ง"><input class="in" name="mstd" maxlength="60" value="${esc(m.std)}" placeholder="มทช." aria-label="มาตรฐาน"></div>
        <small class="mhint">${it && it.freq ? 'ความถี่ ' + esc(it.freq) : ''}</small>
        <div class="subs">${subRows(subs)}</div>
        <div class="mmiss"${anyMiss ? '' : ' hidden'}><textarea class="in" name="mmiss" rows="2" maxlength="300" placeholder="หมายเหตุ: เช่น ปูนซีเมนต์ ผู้รับจ้างจะส่งชดเชย" aria-label="หมายเหตุวัสดุไม่ครบ">${esc(m.miss)}</textarea>
          <label class="fld"><span>วันที่ส่งชดเชย <em>ถ้าทราบ</em></span><input class="in" type="date" name="mdue" value="${esc(m.due)}"></label></div>
      </div>`;
    };
    app.innerHTML = `<form class="st-form" novalidate>
      <div class="box">
        <div class="row2">
          <label class="fld"><span>เลขรับ <em id="noHint">${no ? 'แก้ได้' : 'อัตโนมัติ'}</em></span><input class="in auto" name="no" value="${esc(rec.no)}" inputmode="numeric" pattern="\\d{4}/\\d{4}" maxlength="9" placeholder="2569/0001" required></label>
          <label class="fld"><span>วันที่รับ</span><input class="in auto" name="date" type="date" value="${esc(rec.date)}" required></label>
        </div>
        <div class="fld"><span>กลุ่มผู้ส่ง</span><div class="seg" role="radiogroup">${Object.keys(GRP).map(g => `<button type="button" role="radio" aria-checked="${rec.grp === g}" class="${rec.grp === g ? 'on' : ''}" data-g="${g}">${g}<small>${GRP[g][0]}</small></button>`).join('')}</div></div>
        <label class="fld"><span id="agl">${rec.grp === 'A' ? 'หน่วยงาน' : rec.grp === 'B' ? 'แขวง' : rec.grp === 'C' ? 'ชื่อหน่วยงาน' : 'ผู้รับบริการ'}</span><span id="agw">${agencyField(rec.grp)}</span></label>
        <label class="fld"><span>โครงการ</span><input class="in" name="prj" maxlength="300" value="${esc(rec.prj)}"></label>
        <div class="row2"><label class="fld"><span>สายทาง</span><input class="in" name="road" maxlength="150" value="${esc(rec.road)}" placeholder="กบ.ถ.1-0001"></label>
        <label class="fld"><span>ผู้รับจ้าง</span><input class="in" name="con" maxlength="200" value="${esc(rec.con)}"></label></div>
        <details class="more"${rec.sender || rec.tel || rec.note ? ' open' : ''}><summary>ผู้นำส่ง · โทร · หมายเหตุ</summary>
        <div class="row2"><label class="fld"><span>ผู้นำส่ง</span><input class="in" name="sender" maxlength="150" value="${esc(rec.sender)}"></label>
        <label class="fld"><span>โทร</span><input class="in" name="tel" type="tel" maxlength="40" value="${esc(rec.tel)}" placeholder="0xx-xxx-xxxx"></label></div>
        <label class="fld"><span>หมายเหตุ</span><textarea class="in" name="note" rows="2" maxlength="1000">${esc(rec.note)}</textarea></label></details>
      </div>
      <div class="box"><h2>รายการวัสดุ *</h2><div id="mats">${(rec.mats.length ? rec.mats : [blank()]).map(matRow).join('')}</div>
        <button class="btn ghost sm" type="button" id="addMat" style="margin:10px 0 0;width:100%">+ เพิ่มวัสดุ</button>
        ${CAT && CAT.length ? '<p class="ref" style="margin:8px 0 0">รายการย่อยและความถี่ ดึงจากหน้าแรก (General Test)</p>' : '<p class="ref" style="margin:8px 0 0">โหลดรายการจากหน้าแรกไม่ได้ · เลือก "อื่น ๆ" แล้วพิมพ์ชื่อวัสดุ</p>'}</div>
      ${no ? '' : `<div class="box"><h2>รูปภาพ <span class="ref" style="font-weight:500">ใส่ลายน้ำอัตโนมัติ</span></h2>
        <div class="pb"><label class="btn">${IC.cam}ถ่ายรูป<input type="file" accept="image/*" capture="environment" hidden data-pick></label>
        <label class="btn ghost">${IC.img}เลือกรูป<input type="file" accept="image/*" multiple hidden data-pick></label></div>
        <div class="stph" id="qph"></div></div>`}
      <div class="box"><h2>ผู้บันทึกข้อมูล *</h2>
        <select class="in sel" name="by" required aria-label="ผู้บันทึกข้อมูล"><option value="">— เลือกผู้บันทึกข้อมูล —</option>${us.map(u => `<option${u === raw(rec.by) ? ' selected' : ''}>${esc(u)}</option>`).join('')}</select>
        <p class="ref" style="margin:6px 0 0">ชื่อนี้ลงในทะเบียนและลายน้ำรูป</p></div>
      <p class="st-err" id="ferr" role="alert"></p>
      <div class="bar"><a class="btn ghost" href="${no ? '#r/' + slug(no) : '#list'}">ยกเลิก</a><button class="btn" type="submit">${no ? 'บันทึกการแก้ไข' : 'บันทึกลงรับ'}</button></div>
    </form>`;
    const f = $('form', app);
    let grp = rec.grp;
    $$('.seg button', f).forEach(b => b.onclick = () => {
      grp = b.dataset.g; rec.grp = grp;
      $$('.seg button', f).forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', x === b); });
      $('#agl').textContent = grp === 'A' ? 'หน่วยงาน' : grp === 'B' ? 'แขวง' : grp === 'C' ? 'ชื่อหน่วยงาน' : 'ผู้รับบริการ';
      $('#agw').innerHTML = agencyField(grp);
    });
    $('#agw').addEventListener('change', e => { if (e.target.name !== 'agsel') return; const o = f.agency; o.hidden = e.target.value !== OTHER; if (!o.hidden) { o.value = ''; o.focus(); } });
    f.no.addEventListener('input', () => { autoNo = false; $('#noHint').textContent = 'กำหนดเอง'; });
    f.date.addEventListener('change', () => { if (autoNo && f.date.value) f.no.value = nextNoLocal(f.date.value); });
    const matsEl = $('#mats', f);
    const readSubs = r => $$('.sub', r).map(s => ({ t: $('span', s).textContent, d: ($('.seg2 .on', s) || {}).dataset ? $('.seg2 .on', s).dataset.d : 'ครบ' }));
    const readMats = () => $$('.mrow', matsEl).map(r => {
      const pk = $('[name=mpick]', r).value, subs = readSubs(r), q = $('[name=mqty]', r).value.trim();
      return { name: pk === OTHER ? $('[name=mname]', r).value.trim() : pk, qty: q ? (/^\d+(\.\d+)?$/.test(q) ? q + ' ชุด' : q) : '', src: $('[name=msrc]', r).value.trim(), std: $('[name=mstd]', r).value.trim(),
        subs, done: subs.some(s => s.d === 'ไม่ครบ') ? 'ไม่ครบ' : 'ครบ', miss: $('[name=mmiss]', r).value.trim(), due: $('[name=mdue]', r).value };
    });
    const syncMiss = r => { const mm = $('.mmiss', r), any = readSubs(r).some(s => s.d === 'ไม่ครบ'); const was = mm.hidden; mm.hidden = !any; if (was && any) $('[name=mmiss]', r).focus(); };
    matsEl.addEventListener('change', e => {
      const sel = e.target.closest('[name=mpick]'); if (!sel) return;
      const r = sel.closest('.mrow'), it = catFind(sel.value), o = $('[name=mname]', r);
      o.hidden = sel.value !== OTHER; if (!o.hidden) o.focus();
      $('.mq', r).hidden = !sel.value;
      $('.mhint', r).innerHTML = it && it.freq ? 'ความถี่ ' + esc(it.freq) : '';
      if (it) $('[name=mstd]', r).value = it.std;
      $('.subs', r).innerHTML = sel.value ? subRows(subsFor(sel.value === OTHER ? '' : sel.value, [])) : '';
      syncMiss(r);
    });
    matsEl.addEventListener('click', e => {
      const b = e.target.closest('.seg2 button'); if (!b) return;
      const s = b.closest('.sub'); $$('.seg2 button', s).forEach(x => { const on = x === b; x.classList.toggle('on', on); x.classList.toggle('ok', on && x.dataset.d === 'ครบ'); x.classList.toggle('bad', on && x.dataset.d === 'ไม่ครบ'); x.setAttribute('aria-checked', on); });
      syncMiss(b.closest('.mrow'));
    });
    const redrawMats = ms => { matsEl.innerHTML = ms.map(matRow).join(''); };
    $('#addMat').onclick = () => { const ms = readMats(); ms.push(blank()); redrawMats(ms); $$('[name=mpick]', matsEl).pop().focus(); };
    matsEl.addEventListener('click', e => { const d = e.target.closest('.mdel'); if (!d) return; const ms = readMats(); ms.splice(Number(d.closest('.mrow').dataset.i), 1); redrawMats(ms.length ? ms : [blank()]); });
    const formData = () => ({ no: f.no.value.trim(), date: f.date.value, grp, agency: (f.agsel && f.agsel.value !== OTHER ? f.agsel.value : f.agency.value).trim(), prj: f.prj.value.trim(), road: f.road.value.trim(), con: f.con.value.trim(), sender: f.sender.value.trim(), tel: f.tel.value.trim(), note: f.note.value.trim(), by: f.by.value, mats: readMats().filter(m => m.name) });
    if (!no) {
      const drawQ = () => { $('#qph').innerHTML = queue.map((q, i) => `<figure><img src="data:image/jpeg;base64,${q.thumb}" alt="รูปที่ ${i + 1}"><button type="button" class="phx" data-qi="${i}" aria-label="เอารูปออก">${IC.x}</button></figure>`).join('') + (queue.length ? '' : '<p class="ref" style="grid-column:1/-1;margin:0">ยังไม่มีรูป · ถ่ายกองวัสดุ ป้ายกอง หรือสัญลักษณ์</p>'); };
      drawQ();
      $('#qph').addEventListener('click', e => { const x = e.target.closest('[data-qi]'); if (x) { queue.splice(Number(x.dataset.qi), 1); drawQ(); } });
      $$('[data-pick]', f).forEach(inp => inp.addEventListener('change', async () => {
        const fs = [...inp.files]; inp.value = '';
        for (const file of fs) {
          if (queue.length >= MAX_PHOTO) { toast('ครบ ' + MAX_PHOTO + ' รูปแล้ว', true); break; }
          const out = await photoFlow(file, wmFrom(formData()));
          if (out) { queue.push(out); drawQ(); }
        }
      }));
    }
    f.addEventListener('submit', async e => {
      e.preventDefault();
      const d = formData(), er = $('#ferr'); er.textContent = '';
      const bad = !/^\d{4}\/\d{4}$/.test(d.no) ? 'เลขรับต้องเป็นรูปแบบ ปปปป/นนนน เช่น 2569/0012' : !d.date ? 'กรุณาระบุวันที่รับ' : !d.mats.length ? 'กรุณาเลือกวัสดุอย่างน้อย 1 รายการ' : d.mats.some(m => m.done === 'ไม่ครบ' && !m.miss) ? 'วัสดุที่มีรายการ "ไม่ครบ" ต้องใส่หมายเหตุ' : !d.by ? 'กรุณาเลือกผู้บันทึกข้อมูล' : '';
      if (bad === 'กรุณาเลือกผู้บันทึกข้อมูล') f.by.focus();
      if (bad) { er.textContent = bad; return; }
      if (no && rec.mats) d.mats.forEach(m => { const o = rec.mats.find(x => raw(x.name) === m.name && raw(x.src) === m.src); if (o) { m.result = o.result; m.note = o.note; } });
      const b = $('button[type=submit]', f); b.disabled = true; b.textContent = queue.length ? `กำลังบันทึก + รูป ${queue.length}…` : 'กำลังบันทึก…';
      try {
        const photos = []; for (const q of queue) photos.push(await restamp(q, d));
        const j = await call('save', { rec: d, orig: no || '', auto: autoNo, photos });
        if (j.photoErr) toast('อัปโหลดรูปไม่สำเร็จ ' + j.photoErr + ' รูป', true); else toast(no ? 'บันทึกการแก้ไขแล้ว' : 'ลงรับ ' + j.rec.no + ' แล้ว');
        if (no && no !== j.rec.no) { delete det[no]; listCache = (listCache || []).filter(x => x.no !== no); saveCache(); }
        location.hash = '#r/' + slug(j.rec.no);
      } catch (x) { er.textContent = x.message; b.disabled = false; b.textContent = no ? 'บันทึกการแก้ไข' : 'บันทึกลงรับ'; }
    });
  }
  function blank() { return { name: '', qty: '', src: '', std: '', done: 'ครบ', miss: '', due: '', subs: [] }; }

  /* ---------- รายละเอียด / สถานะ / ผล: แสดงจากแคชทันที แล้วซิงก์ ---------- */
  async function viewDetail(no, my) {
    ttl.textContent = no;
    if (det[no]) drawDetail(det[no]); else busy();
    if (det[no] && Date.now() - (det[no]._t || 0) < 8000) return;   // เพิ่งได้จากการบันทึก ไม่ต้องโหลดซ้ำ
    const j = await call('get', { no });
    if (my === viewTok && location.hash === '#r/' + slug(no)) drawDetail(j.rec);
  }
  function drawDetail(rec) {
    const si = STATUS.indexOf(rec.status);
    const subTxt = m => (m.subs || []).length ? `<ul class="subl">${m.subs.map(s => `<li class="${s.d === 'ไม่ครบ' ? 'no' : ''}">${s.d === 'ไม่ครบ' ? '✗' : '✓'} ${esc(s.t)}</li>`).join('')}</ul>` : '';
    app.innerHTML = `<div class="box"><div class="dh"><b>${esc(rec.no)}</b>${badge(Object.assign({}, rec, { nFail: rec.mats.filter(m => m.result === 'ไม่ผ่าน').length, nPass: rec.mats.filter(m => m.result === 'ผ่าน').length }))}</div>
        <p class="dp">${prjLine(rec)}<br><span class="ref">${esc(grpLabel(rec))}${rec.con ? ' · ผู้รับจ้าง ' + esc(rec.con) : ''}${rec.sender ? ' · ผู้นำส่ง ' + esc(rec.sender) : ''}${rec.tel ? ' (' + esc(rec.tel) + ')' : ''}<br>รับ ${thDate(rec.date)} โดย ${esc(rec.by)}</span></p>
        ${rec.note ? `<p class="ref" style="margin:6px 0 0">หมายเหตุ: ${esc(rec.note)}</p>` : ''}
        <div class="steps">${STATUS.map((s, i) => { const lg = (rec.log || []).find(l => l.act === 'เปลี่ยนสถานะ' && raw(l.det).endsWith('→ ' + s)) || (i === 0 ? { at: rec.created } : null);
          return `<div class="${i < si ? 'd' : i === si ? 'c' : ''}">${s}${i <= si && lg && lg.at ? '<br>' + thShort(lg.at) : ''}</div>`; }).join('')}</div>
        <div class="pb">${si > 0 ? `<button class="btn ghost sm" type="button" data-to="${STATUS[si - 1]}">← ${STATUS[si - 1]}</button>` : '<span></span>'}${si < 3 ? `<button class="btn sm" type="button" data-to="${STATUS[si + 1]}">${STATUS[si + 1]} →</button>` : '<span class="ref" style="align-self:center;text-align:right">เสร็จสิ้น</span>'}</div>
      </div>
      <div class="box"><h2>ผลทดสอบรายวัสดุ</h2>${rec.mats.map(m => `<div class="mat"><div>${esc(m.name)}${m.qty ? ' <span class="ref">' + esc(m.qty) + '</span>' : ''}<small>${[m.src && 'แหล่ง ' + esc(m.src), m.std && esc(m.std)].filter(Boolean).join(' · ')}</small>${subTxt(m)}${m.done === 'ไม่ครบ' ? `<span class="miss">ไม่ครบ · ${esc(m.miss)}${m.due ? ' · ส่งชดเชย ' + thDate(m.due) : ''} <button type="button" class="lnk" data-full="${m.i}">รับครบแล้ว</button></span>` : `<span class="full">✓ ตัวอย่างครบ${m.miss ? ' · ' + esc(m.miss) : ''}</span>`}</div>
          <div class="pf" role="group" aria-label="ผลทดสอบ ${esc(m.name)}"><button type="button" class="${m.result === 'ผ่าน' ? 'ok' : ''}" data-i="${m.i}" data-r="ผ่าน" aria-pressed="${m.result === 'ผ่าน'}">ผ่าน</button><button type="button" class="${m.result === 'ไม่ผ่าน' ? 'bad' : ''}" data-i="${m.i}" data-r="ไม่ผ่าน" aria-pressed="${m.result === 'ไม่ผ่าน'}">ไม่ผ่าน</button></div></div>`).join('')}
        <form class="fld rep"><span>เลขที่รายงานผล</span><div class="row2b"><input class="in" name="rep" maxlength="150" value="${esc(rec.report)}" placeholder="เช่น รายงานผลทดสอบเลขที่ …"><button class="btn sm" type="submit">บันทึก</button></div></form>
      </div>
      <div class="box"><h2>รูปภาพ (${rec.photos.length}/${MAX_PHOTO})</h2>
        <div class="stph">${rec.photos.map((p, i) => `<figure><button type="button" class="phv" data-id="${esc(p.id)}" aria-label="เปิดรูปที่ ${i + 1}">${p.thumb ? `<img src="data:image/jpeg;base64,${p.thumb}" alt="รูปที่ ${i + 1} โดย ${esc(p.by)}">` : '<span class="ph0">รูป</span>'}</button></figure>`).join('') || '<p class="ref" style="grid-column:1/-1;margin:0">ยังไม่มีรูป</p>'}</div>
        ${rec.photos.length < MAX_PHOTO ? `<div class="pb"><label class="btn sm">${IC.cam}ถ่ายรูป<input type="file" accept="image/*" capture="environment" hidden data-pick></label><label class="btn ghost sm">${IC.img}เลือกรูป<input type="file" accept="image/*" multiple hidden data-pick></label></div>` : ''}
      </div>
      <div class="box"><h2>ประวัติ</h2><ul class="log">${(rec.log || []).map(l => `<li><b>${thStamp(l.at)}</b> ${esc(l.act)}${l.det ? ' · ' + esc(l.det) : ''} · ${esc(l.by)}</li>`).join('')}</ul>
        ${rec.canDel ? `<button class="btn ghost sm delrec" type="button" data-delrec>ลบทะเบียนนี้</button><p class="ref" style="margin:6px 0 0">ลบได้เฉพาะผู้สร้าง${rec.creator ? ' (' + esc(rec.creator) + ')' : ''} หรือผู้ดูแล · ลบแล้วกู้คืนไม่ได้ (รูปอยู่ในถังขยะ Drive 30 วัน)</p>` : ''}</div>
      <div class="bar"><a class="btn ghost" href="#list">← ทะเบียน</a><a class="btn" href="#e/${slug(rec.no)}">แก้ไขข้อมูล</a></div>`;
    /* เปลี่ยนบนจอทันที แล้วส่งไปบันทึกเบื้องหลัง · ไม่สำเร็จ → คืนค่าเดิม */
    const optimistic = (mutate, req, msg) => {
      const before = JSON.parse(JSON.stringify(rec)), next = JSON.parse(JSON.stringify(rec));
      mutate(next); det[rec.no] = next; upsertList(next); drawDetail(next);
      req().then(j => { if (location.hash === '#r/' + slug(rec.no)) drawDetail(j.rec); if (msg) toast(msg); })
        .catch(e => { det[rec.no] = before; upsertList(before); if (location.hash === '#r/' + slug(rec.no)) drawDetail(before); toast('บันทึกไม่สำเร็จ: ' + e.message, true); });
    };
    $$('[data-to]', app).forEach(b => b.onclick = () => { const to = b.dataset.to;
      optimistic(r => { r.log = [{ at: new Date().toISOString().slice(0, 16), act: 'เปลี่ยนสถานะ', det: r.status + ' → ' + to, by: sess.me }].concat(r.log || []); r.status = to; }, () => call('status', { no: rec.no, to }), 'บันทึกสถานะ ' + to + ' แล้ว'); });
    $$('.pf button', app).forEach(b => b.onclick = () => { const i = Number(b.dataset.i), cur = rec.mats.find(m => m.i === i).result, val = cur === b.dataset.r ? '' : b.dataset.r;
      optimistic(r => { r.mats.find(m => m.i === i).result = val; }, () => call('result', { no: rec.no, i, result: val })); });
    $$('[data-full]', app).forEach(b => b.onclick = () => { const i = Number(b.dataset.full);
      optimistic(r => { const m = r.mats.find(x => x.i === i); m.done = 'ครบ'; m.subs = (m.subs || []).map(s => ({ t: s.t, d: 'ครบ' })); m.miss = 'รับครบแล้ว'; m.due = ''; }, () => call('complete', { no: rec.no, i }), 'บันทึกรับครบแล้ว'); });
    $('.rep', app).onsubmit = e => { e.preventDefault(); const v = e.target.rep.value.trim(); optimistic(r => { r.report = v; }, () => call('report', { no: rec.no, report: v }), 'บันทึกเลขที่รายงานแล้ว'); };
    $$('.phv', app).forEach(b => b.onclick = () => openPhoto(rec, b.dataset.id));
    const dr = $('[data-delrec]', app);
    if (dr) dr.onclick = async () => {
      if (!confirm('ลบทะเบียน ' + rec.no + ' ?\nข้อมูลวัสดุ ผล และรูปของเลขรับนี้จะถูกลบทั้งหมด (บันทึกการลบไว้ในประวัติ)')) return;
      dr.disabled = true; dr.textContent = 'กำลังลบ…';
      try { await call('del', { no: rec.no }); delete det[rec.no]; listCache = (listCache || []).filter(x => x.no !== rec.no); saveCache(); toast('ลบ ' + rec.no + ' แล้ว'); location.hash = '#list'; }
      catch (e) { toast(e.message, true); dr.disabled = false; dr.textContent = 'ลบทะเบียนนี้'; }
    };
    $$('[data-pick]', app).forEach(inp => inp.addEventListener('change', async () => {
      const fs = [...inp.files]; inp.value = ''; let left = MAX_PHOTO - rec.photos.length, last = null;
      for (const file of fs) {
        if (left <= 0) { toast('ครบ ' + MAX_PHOTO + ' รูปแล้ว', true); break; }
        const out = await photoFlow(file, wmFrom(rec));
        if (!out) continue;
        toast('กำลังอัปโหลดรูป…');
        try { last = (await call('photo', { no: rec.no, data: out.data, thumb: out.thumb })).rec; left--; } catch (e) { toast(e.message, true); }
      }
      if (last) { drawDetail(last); toast('เพิ่มรูปแล้ว'); }
    }));
  }
  function openPhoto(rec, id) {
    sheet(`<div class="pv"><p class="ref">กำลังโหลดรูป…</p></div><div class="pb"><button class="btn ghost sm del" type="button" data-del>ลบรูป</button><button class="btn sm" type="button" data-close>ปิด</button></div>`, async m => {
      try { const j = await call('getPhoto', { id }); $('.pv', m).innerHTML = `<img src="data:image/jpeg;base64,${j.data}" alt="รูปขนาดเต็ม">`; } catch (e) { $('.pv', m).innerHTML = `<p class="st-err">${esc(e.message)}</p>`; }
      $('[data-del]', m).onclick = async () => {
        if (!confirm('ลบรูปนี้? (ไฟล์ย้ายลงถังขยะ Drive กู้คืนได้ 30 วัน)')) return;
        try { const j = await call('delPhoto', { id }); closeSheet(); drawDetail(j.rec); toast('ลบรูปแล้ว'); } catch (e) { toast(e.message, true); }
      };
    });
  }

  /* ---------- รูป + ลายน้ำ ---------- */
  function wmFrom(r) {
    const now = new Date();
    return [
      ['no', 'เลขรับ ' + raw(r.no), true],
      ['date', 'วันที่รับ ' + thDate(r.date) + ' · ถ่าย ' + pad(now.getHours()) + ':' + pad(now.getMinutes()) + ' น.', true],
      ['grp', 'ผู้ส่ง ' + grpLabel(r), true],
      ['prj', [raw(r.prj), r.road ? 'สาย ' + raw(r.road) : ''].filter(Boolean).join(' · '), !!(r.prj || r.road)],
      ['con', r.con ? 'ผู้รับจ้าง ' + raw(r.con) : '', !!r.con],
      ['by', 'ผู้บันทึก ' + (raw(r.by) || '(ตามที่เลือกก่อนบันทึก)'), true]   // [รอยืนยัน] ค่าเริ่มต้นเปิด
    ];
  }
  async function loadBitmap(file) {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (e) {}
    return await new Promise((ok, no) => { const u = URL.createObjectURL(file), im = new Image(); im.onload = () => { ok(im); }; im.onerror = () => no(new Error('เปิดไฟล์รูปไม่ได้ (รองรับ JPG/PNG/HEIC ที่เบราว์เซอร์อ่านได้)')); im.src = u; });
  }
  function wrapLines(x, text, maxW) {
    const out = []; let line = '';
    for (const ch of Array.from(text)) { const t = line + ch; if (x.measureText(t).width > maxW && line) { out.push(line); line = ch; } else line = t; }
    if (line) out.push(line); return out;
  }
  function stamp(src, lines, bare) {
    const sw = src.width, sh = src.height, k = Math.min(1, IMG_MAX / Math.max(sw, sh));
    const c = document.createElement('canvas'); c.width = Math.round(sw * k); c.height = Math.round(sh * k);
    const x = c.getContext('2d'); x.drawImage(src, 0, 0, c.width, c.height);
    const w = c.width, h = c.height, fs = Math.max(14, Math.round(Math.min(w, h) * 0.034)), padX = fs * 0.8;
    const L = [];
    lines.filter(l => l[2] && l[1].trim()).forEach((l, i) => { x.font = (i ? '600 ' : '700 ') + (i ? fs : Math.round(fs * 1.15)) + 'px Sarabun, sans-serif'; wrapLines(x, l[1], w - padX * 2).forEach(t => L.push([t, x.font, i ? fs : fs * 1.15])); });
    if (L.length) {
      const bh = L.reduce((s, l) => s + l[2] * 1.32, 0) + fs * 0.9;
      x.fillStyle = 'rgba(0,0,0,.55)'; x.fillRect(0, h - bh, w, bh);
      x.fillStyle = '#fff'; x.textBaseline = 'top'; let y = h - bh + fs * 0.45;
      L.forEach(l => { x.font = l[1]; x.fillText(l[0], padX, y); y += l[2] * 1.32; });
    }
    if (bare) return c;
    x.font = '700 ' + Math.round(fs * 0.8) + 'px Sarabun, sans-serif'; x.textAlign = 'right'; x.textBaseline = 'top';
    x.fillStyle = 'rgba(0,0,0,.35)'; const tw = x.measureText('สตว. สทช.14').width; x.fillRect(w - tw - fs * 1.1, fs * 0.35, tw + fs * 0.8, fs * 1.25);
    x.fillStyle = '#fff'; x.fillText('สตว. สทช.14', w - fs * 0.7, fs * 0.5); x.textAlign = 'left';
    return c;
  }
  const b64 = (canvas, q) => canvas.toDataURL('image/jpeg', q).split(',')[1];
  /* รูปที่ถ่ายก่อนกรอกครบ: ตอนบันทึกจะวาดลายน้ำใหม่ให้ตรงข้อมูลที่บันทึกจริง (เว้นบรรทัดที่ผู้ใช้แก้เอง) */
  async function restamp(q, rec) {
    if (!q.base) return q;
    const fresh = wmFrom(rec), lines = q.lines.map((l, i) => { const f = fresh.find(x => x[0] === l[0]); const keep = l[1] !== q.defs[i] || !f; const vis = keep || !q.defv || l[2] !== q.defv[i] ? l[2] : f[2];   // ไม่ได้แตะสวิตช์ → ตามข้อมูลจริง
      return [l[0], keep ? l[1] : (l[0] === 'date' ? l[1].replace(/^วันที่รับ .*? ·/, f[1].split(' ·')[0] + ' ·') : f[1]), vis]; });
    const im = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = 'data:image/jpeg;base64,' + q.base; });
    const c = stamp(im, lines); return { data: b64(c, 0.82), thumb: thumbOf(c) };
  }
  function thumbOf(c) { const k = THUMB / Math.max(c.width, c.height), t = document.createElement('canvas'); t.width = Math.round(c.width * k); t.height = Math.round(c.height * k); t.getContext('2d').drawImage(c, 0, 0, t.width, t.height); return b64(t, 0.7); }
  async function photoFlow(file, lines) {
    let bmp; try { if (document.fonts) await document.fonts.load('700 20px Sarabun'); bmp = await loadBitmap(file); } catch (e) { toast(e.message, true); return null; }
    const defs = lines.map(l => l[1]);            // ข้อความตั้งต้น ใช้แยกว่าบรรทัดไหนผู้ใช้แก้เอง
    const defv = lines.map(l => l[2]);
    return new Promise(done => {
      let cv = stamp(bmp, lines);
      const m = sheet(`<h2>ตรวจรูปก่อนบันทึก</h2><div class="pv" id="pvc"></div>
        <div class="wmf">${lines.map((l, i) => `<label class="tg"><input type="checkbox" data-wi="${i}"${l[2] ? ' checked' : ''} aria-label="แสดงบรรทัด ${i + 1}"><span></span></label><input class="in" data-wt="${i}" maxlength="160" value="${esc(l[1])}">`).join('')}</div>
        <p class="ref" style="margin:8px 0 0">ติ๊ก = แสดงบรรทัดนั้น · แก้ข้อความได้เฉพาะรูปนี้ · ลายน้ำฝังลงในไฟล์รูป</p>
        <div class="pb"><button class="btn ghost" type="button" data-cancel>ไม่ใช้รูปนี้</button><button class="btn" type="button" data-ok>ใช้รูปนี้</button></div>`);
      const box = $('#pvc', m); box.appendChild(cv);
      const redraw = () => { $$('[data-wi]', m).forEach(c => { lines[c.dataset.wi][2] = c.checked; }); $$('[data-wt]', m).forEach(t => { lines[t.dataset.wt][1] = t.value; }); cv = stamp(bmp, lines); box.innerHTML = ''; box.appendChild(cv); };
      let tmr; m.addEventListener('input', () => { clearTimeout(tmr); tmr = setTimeout(redraw, 250); });
      m.addEventListener('change', redraw);
      const end = v => { closeSheet(); done(v); };
      $('[data-cancel]', m).onclick = () => end(null);
      m.addEventListener('click', e => { if (e.target === m) done(null); });
      $('[data-ok]', m).onclick = () => { redraw(); end({ data: b64(cv, 0.82), thumb: thumbOf(cv), base: b64(stamp(bmp, [], true), 0.9), lines: lines.map(l => l.slice()), defs: defs, defv: defv }); };
    });
  }

  window.addEventListener('hashchange', route);
  route();
})();
