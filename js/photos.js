/* คลังรูปวัสดุ ดี/ไม่ดี — ดึงรูปจาก Google Drive ผ่าน Apps Script และให้ สตว. เพิ่ม/ลบรูปเองได้ (ใส่รหัส PIN) */
(function () {
  const API = window.PHOTO_API || '';               // URL Web app ของ Apps Script (ตั้งใน quality.html)
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const gals = $$('.gal[data-slot]');
  let data = {}, pin = null;
  const img = id => `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w1000`;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function render() {
    gals.forEach(g => {
      const list = data[g.dataset.slot] || [];
      let h = list.map((p, i) => `<figure class="ph" data-i="${i}"><img src="${img(p.id)}" alt="${esc(p.cap || g.dataset.ph)}" loading="lazy" referrerpolicy="no-referrer">` +
        (p.cap ? `<figcaption>${esc(p.cap)}</figcaption>` : '') +
        (pin ? `<button class="phdel" data-id="${esc(p.id)}" aria-label="ลบรูป">−</button>` : '') + `</figure>`).join('');
      if (pin) h += `<label class="phadd"><input type="file" accept="image/*" multiple hidden><span>＋</span>เพิ่มรูป</label>`;
      if (!h) h = `<div class="photo">${esc(g.dataset.ph)}</div>`;
      g.innerHTML = h;
      g.classList.toggle('one', list.length === 1 && !pin);
    });
  }

  async function load() {
    if (!API) { render(); return; }
    try {
      const r = await fetch(API + '?action=list', { cache: 'no-store' });
      const j = await r.json(); if (j.ok) data = j.photos || {};
    } catch (e) { console.warn('photos', e); }
    render();
  }

  async function post(o) {
    const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(Object.assign({ pin }, o)) });
    return r.json();
  }

  /* ย่อรูปก่อนส่ง: ด้านยาวไม่เกิน 1280 px, JPEG คุณภาพ 0.82 */
  function shrink(file) {
    return new Promise((ok, no) => {
      const u = URL.createObjectURL(file), im = new Image();
      im.onload = () => {
        const k = Math.min(1, 1280 / Math.max(im.width, im.height)), c = document.createElement('canvas');
        c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(u);
        ok(c.toDataURL('image/jpeg', 0.82).split(',')[1]);
      };
      im.onerror = () => no(new Error('อ่านรูปไม่ได้')); im.src = u;
    });
  }

  const bar = document.getElementById('phbar'), msg = document.getElementById('phmsg');
  const say = (t, err) => { if (msg) { msg.textContent = t; msg.className = 'phmsg' + (err ? ' err' : ''); } };

  document.addEventListener('change', async e => {
    const inp = e.target; if (!inp.matches('.phadd input')) return;
    const g = inp.closest('.gal'), files = [...inp.files]; if (!files.length) return;
    const cap = prompt('คำอธิบายรูป (ไม่ใส่ก็ได้)', '') || '';
    for (let i = 0; i < files.length; i++) {
      say(`กำลังอัปโหลด ${i + 1}/${files.length}…`);
      try {
        const d = await shrink(files[i]); const j = await post({ action: 'add', slot: g.dataset.slot, mime: 'image/jpeg', data: d, cap });
        if (!j.ok) throw new Error(j.err);
        (data[g.dataset.slot] = data[g.dataset.slot] || []).push({ id: j.id, cap });
      } catch (err) { say('เพิ่มรูปไม่สำเร็จ: ' + err.message, 1); render(); return; }
    }
    say('เพิ่มรูปแล้ว'); render();
  });

  document.addEventListener('click', async e => {
    const del = e.target.closest('.phdel');
    if (del) {
      if (!confirm('ลบรูปนี้? (ย้ายไปถังขยะ Drive กู้คืนได้ภายใน 30 วัน)')) return;
      say('กำลังลบรูป…');
      try { const j = await post({ action: 'del', id: del.dataset.id }); if (!j.ok) throw new Error(j.err);
        Object.keys(data).forEach(k => data[k] = data[k].filter(p => p.id !== del.dataset.id)); say('ลบรูปแล้ว'); render();
      } catch (err) { say('ลบไม่สำเร็จ: ' + err.message, 1); }
      return;
    }
    const ph = e.target.closest('.ph img');
    if (ph && !pin) { const lb = document.createElement('div'); lb.className = 'lb'; lb.innerHTML = `<img src="${ph.src}" alt="">`; lb.onclick = () => lb.remove(); document.body.appendChild(lb); return; }
    if (e.target.id === 'phedit') {
      if (pin) { pin = null; e.target.textContent = 'จัดการรูป (สำหรับ สตว.)'; say(''); render(); return; }
      if (!API) { say('ยังไม่ได้เชื่อมคลังรูป (รอตั้งค่า Apps Script)', 1); return; }
      const p = prompt('รหัส PIN ของ สตว.'); if (!p) return;
      say('กำลังตรวจรหัส…');
      try { pin = p; const j = await post({ action: 'check' }); if (!j.ok) { pin = null; throw new Error(j.err); } }
      catch (err) { say(err.message, 1); return; }
      e.target.textContent = 'เสร็จสิ้นการแก้ไข'; say('โหมดแก้ไข: กด ＋ เพิ่มรูป · กด − ลบรูป'); render();
    }
  });

  load();
})();
