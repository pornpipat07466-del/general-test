/* หน้า มาตรฐาน: ดึงรายการไฟล์ มทช. จาก 4 โฟลเดอร์ Drive (ผ่าน Apps Script) ให้ครบและอัปเดตอัตโนมัติ + ค้นหา */
(function () {
  const API = window.PHOTO_API || '';
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const q = $('#q');
  function parse(name) {
    const n = String(name).replace(/\.pdf$/i, '').replace(/\s+/g, ' ').trim();
    const m = n.match(/^(\(ร่าง\)\s*)?(มทช\.?\s*(?:\(ท\)\s*)?\d{3}(?:\.\d+)?)\s*[-–]\s*(\d{4})\s*(.*)$/);
    if (!m) return { no: '', nm: n, key: [9999] };
    const no = (m[1] ? '(ร่าง) ' : '') + m[2].replace(/มทช\.?\s*\(ท\)\s*/, 'มทช.(ท) ').replace(/^มทช\.?\s*(?=\d)/, 'มทช.') + '-' + m[3];
    return { no: no, nm: m[4], key: m[2].match(/\d+/g).map(Number) };
  }
  const cmp = (a, b) => { for (let i = 0; i < Math.max(a.key.length, b.key.length); i++) { const d = (a.key[i] || 0) - (b.key[i] || 0); if (d) return d; } return a.nm.localeCompare(b.nm, 'th'); };
  function render(std) {
    std.forEach(g => {
      const box = $(`.sgrp[data-k="${g.k}"]`); if (!box) return;
      const L = g.files.map(f => Object.assign(parse(f.name), f)).sort(cmp);
      $('.gc', box).textContent = L.length;
      $('.stdlist', box).innerHTML = L.map(f => `<a class="std" href="https://drive.google.com/file/d/${encodeURIComponent(f.id)}/view" target="_blank" rel="noopener"><span class="no">${esc(f.no || '—')}</span><span class="nm">${esc(f.nm)}${f.sub ? ` <span class="ref">(${esc(f.sub)})</span>` : ''}</span><span class="pdf">PDF</span></a>`).join('');
    });
    $$('section#std, section#test').forEach(s => { $('.sc', s).textContent = $$('.std', s).length; });
    const d = new Date(); const src = $('#stdsrc');
    if (src) src.textContent = `ที่มา: โฟลเดอร์ Google Drive "มทช. หมวด…" ของ สตว. (อัปเดตอัตโนมัติ ${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear() + 543}) · ตรวจฉบับล่าสุดกับประกาศกรมทางหลวงชนบทก่อนใช้งาน`;
    filter();
  }
  function filter() {
    const v = (q.value || '').trim().toLowerCase().replace(/\s+/g, ' ');
    $$('.std').forEach(a => { a.hidden = !!v && !a.textContent.toLowerCase().replace(/\s+/g, ' ').includes(v); });
    $$('.sgrp').forEach(g => {
      if (v && g.dataset.o == null) g.dataset.o = g.open ? '1' : '';      // จำสถานะพับ/กาง ก่อนค้นหา
      g.hidden = !!v && !$$('.std', g).some(a => !a.hidden);
      if (v) g.open = !g.hidden;                                         // ค้นหา → กางหมวดที่พบ
      else if (g.dataset.o != null) { g.open = !!g.dataset.o; delete g.dataset.o; }  // ล้างคำค้น → คืนสถานะเดิม
    });
    let none = $('#nores'); const any = $$('.std').some(a => !a.hidden);
    if (!none) { none = document.createElement('p'); none.id = 'nores'; none.className = 'ref'; none.style.margin = '0 4px 12px'; q.after(none); }
    none.textContent = v && !any ? 'ไม่พบ "' + q.value + '" ในรายการ มทช.' : '';
  }
  ['input', 'search', 'keyup', 'change'].forEach(ev => q.addEventListener(ev, filter));
  if (API) fetch(API + '?action=std', { cache: 'no-store' }).then(r => r.json()).then(j => { if (j.ok && j.std) render(j.std); }).catch(() => {});
})();
