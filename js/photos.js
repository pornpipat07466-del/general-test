/* คลังรูปวัสดุ ดี/ไม่ดี + ปัญหาอุปสรรคที่พบบ่อย
   ข้อมูลเก็บใน Google Drive ผ่าน Apps Script · สตว. เพิ่ม/แก้/ลบเองได้เมื่อใส่รหัส PIN */
(function () {
  const API = window.PHOTO_API || '';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const MATS = ['ทั่วไป', 'ดินเดิม / ดินถม', 'ลูกรัง', 'หินคลุก', 'ทราย', 'หิน คอนกรีต/AC', 'เหล็กเสริม', 'ผลิตภัณฑ์สำเร็จรูป'];
  let data = {}, issues = [], pin = null, editing = null, loaded = false;
  const img = id => `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w1000`;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const br = s => esc(s).replace(/\n/g, '<br>');
  const msg = $('#phmsg');
  const say = (t, err) => { if (msg) { msg.textContent = t; msg.className = 'phmsg' + (err ? ' err' : ''); } };

  function galHTML(slot, ph) {
    const list = data[slot] || [];
    let h = list.map(p => `<figure class="ph"><img src="${img(p.id)}" alt="${esc(p.cap || ph || 'รูป')}" loading="lazy" referrerpolicy="no-referrer">` +
      (p.cap ? `<figcaption>${esc(p.cap)}</figcaption>` : '') +
      (pin ? `<button class="phdel" data-id="${esc(p.id)}" aria-label="ลบรูป">−</button>` : '') + `</figure>`).join('');
    if (pin) h += `<label class="phadd"><input type="file" accept="image/*" multiple hidden><span>＋</span>เพิ่มรูป</label>`;
    if (!h && ph) h = `<div class="photo">${esc(ph)}</div>`;
    return h;
  }
  function renderGals() {
    $$('.gal[data-slot]').forEach(g => {
      g.innerHTML = galHTML(g.dataset.slot, g.dataset.ph);
      g.classList.toggle('one', (data[g.dataset.slot] || []).length === 1 && !pin);
      g.hidden = !g.innerHTML;
    });
  }

  function form(it) {
    it = it || {};
    return `<form class="isf" data-id="${esc(it.id || '')}">
      <label>ปัญหา / อุปสรรค *<input name="title" maxlength="150" required value="${esc(it.title)}" placeholder="เช่น ส่งตัวอย่างไม่พอทดสอบ"></label>
      <label>วัสดุ<select name="mat">${MATS.map(m => `<option${m === (it.mat || 'ทั่วไป') ? ' selected' : ''}>${m}</option>`).join('')}</select></label>
      <label>สาเหตุ / ที่พบ<textarea name="detail" rows="3" maxlength="2000">${esc(it.detail)}</textarea></label>
      <label>แนวทางแก้ไข<textarea name="fix" rows="3" maxlength="2000">${esc(it.fix)}</textarea></label>
      <div class="isbtn"><button class="btn" type="submit">บันทึก</button><button class="btn ghost" type="button" data-cancel>ยกเลิก</button></div>
    </form>`;
  }
  function renderIssues() {
    const box = $('#issues-list'); if (!box) return;
    let h = '';
    if (pin) h += editing === 'new' ? form() : `<button class="isnew" type="button" data-new>＋ เพิ่มปัญหาอุปสรรค</button>`;
    h += issues.map(it => editing === it.id ? form(it) : `<article class="is">
        <div class="ish"><b>${esc(it.title)}</b><span class="mchip off">${esc(it.mat || 'ทั่วไป')}</span></div>
        ${it.detail ? `<p><span class="isl">สาเหตุ / ที่พบ</span>${br(it.detail)}</p>` : ''}
        ${it.fix ? `<p class="fix"><span class="isl">แนวทางแก้ไข</span>${br(it.fix)}</p>` : ''}
        <div class="gal" data-slot="iss_${esc(it.id)}"></div>
        ${pin ? `<div class="isbtn"><button class="btn ghost sm" type="button" data-edit="${esc(it.id)}">แก้ไข</button><button class="btn ghost sm del" type="button" data-del="${esc(it.id)}">ลบปัญหา</button></div>` : ''}
      </article>`).join('');
    if (!issues.length && !pin) h += `<p class="ref">${loaded ? 'ยังไม่มีรายการ' : (API ? 'กำลังโหลด…' : 'ยังไม่ได้เชื่อมคลังข้อมูล')}</p>`;
    box.innerHTML = h;
  }
  function render() { renderIssues(); renderGals(); }

  async function load() {
    if (API) {
      try { const r = await fetch(API + '?action=list', { cache: 'no-store' }); const j = await r.json();
        if (j.ok) { data = j.photos || {}; issues = (j.issues || []).sort((a, b) => b.t - a.t); } } catch (e) { console.warn('photos', e); }
    }
    loaded = true; render();
  }
  async function post(o) {
    const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(Object.assign({ pin }, o)) });
    const j = await r.json(); if (!j.ok) throw new Error(j.err || 'ไม่สำเร็จ'); return j;
  }
  function shrink(file) {
    return new Promise((ok, no) => {
      const u = URL.createObjectURL(file), im = new Image();
      im.onload = () => { const k = Math.min(1, 1280 / Math.max(im.width, im.height)), c = document.createElement('canvas');
        c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(u); ok(c.toDataURL('image/jpeg', 0.82).split(',')[1]); };
      im.onerror = () => no(new Error('อ่านรูปไม่ได้')); im.src = u;
    });
  }

  document.addEventListener('change', async e => {
    const inp = e.target; if (!inp.matches('.phadd input')) return;
    const g = inp.closest('.gal'), files = [...inp.files]; if (!files.length) return;
    const cap = prompt('คำอธิบายรูป (ไม่ใส่ก็ได้)', '') || '';
    for (let i = 0; i < files.length; i++) {
      say(`กำลังอัปโหลด ${i + 1}/${files.length}…`);
      try { const j = await post({ action: 'add', slot: g.dataset.slot, mime: 'image/jpeg', data: await shrink(files[i]), cap });
        (data[g.dataset.slot] = data[g.dataset.slot] || []).push({ id: j.id, cap });
      } catch (err) { say('เพิ่มรูปไม่สำเร็จ: ' + err.message, 1); renderGals(); return; }
    }
    say('เพิ่มรูปแล้ว'); renderGals();
  });

  document.addEventListener('submit', async e => {
    const f = e.target; if (!f.matches('.isf')) return; e.preventDefault();
    const v = Object.fromEntries(new FormData(f)); const id = f.dataset.id;
    say('กำลังบันทึก…');
    try { const j = await post(Object.assign({ action: id ? 'issue_edit' : 'issue_add', id }, v));
      if (id) Object.assign(issues.find(x => x.id === id), v); else issues.unshift(Object.assign({ id: j.id, t: Date.now() }, v));
      editing = null; say('บันทึกแล้ว · เพิ่มรูปประกอบได้ที่ ＋ ใต้รายการ (ไม่บังคับ)'); render();
    } catch (err) { say('บันทึกไม่สำเร็จ: ' + err.message, 1); }
  });

  document.addEventListener('click', async e => {
    const t = e.target;
    const del = t.closest('.phdel');
    if (del) {
      if (!confirm('ลบรูปนี้? (ย้ายไปถังขยะ Drive กู้คืนได้ภายใน 30 วัน)')) return;
      say('กำลังลบรูป…');
      try { await post({ action: 'del', id: del.dataset.id }); Object.keys(data).forEach(k => data[k] = data[k].filter(p => p.id !== del.dataset.id)); say('ลบรูปแล้ว'); renderGals(); }
      catch (err) { say('ลบไม่สำเร็จ: ' + err.message, 1); }
      return;
    }
    if (t.closest('[data-new]')) { editing = 'new'; render(); $('.isf input').focus(); return; }
    if (t.closest('[data-cancel]')) { editing = null; render(); return; }
    const ed = t.closest('[data-edit]'); if (ed) { editing = ed.dataset.edit; render(); return; }
    const di = t.closest('[data-del]');
    if (di) {
      if (!confirm('ลบปัญหานี้และรูปประกอบ? (กู้คืนได้จากถังขยะ Drive ภายใน 30 วัน)')) return;
      say('กำลังลบ…');
      try { await post({ action: 'issue_del', id: di.dataset.del }); issues = issues.filter(x => x.id !== di.dataset.del); say('ลบแล้ว'); render(); }
      catch (err) { say('ลบไม่สำเร็จ: ' + err.message, 1); }
      return;
    }
    const ph = t.closest('.ph img');
    if (ph && !pin) { const lb = document.createElement('div'); lb.className = 'lb'; lb.innerHTML = `<img src="${ph.src}" alt="">`; lb.onclick = () => lb.remove(); document.body.appendChild(lb); return; }
    if (t.id === 'phedit') {
      if (pin) { pin = null; editing = null; t.textContent = 'จัดการรูปและปัญหา (สำหรับ สตว.)'; say(''); render(); return; }
      if (!API) { say('ยังไม่ได้เชื่อมคลังข้อมูล', 1); return; }
      const p = prompt('รหัส PIN ของ สตว.'); if (!p) return;
      say('กำลังตรวจรหัส…');
      try { pin = p; await post({ action: 'check' }); } catch (err) { pin = null; say(err.message, 1); return; }
      t.textContent = 'เสร็จสิ้นการแก้ไข'; say('โหมดแก้ไข: ＋ เพิ่ม · − ลบรูป · แก้ไข/ลบปัญหา'); render();
    }
  });

  render(); load();
})();
