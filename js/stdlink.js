/* ลิงก์ มทช. ที่ระบุ data-std="มทช.(ท)611" → เปิดไฟล์ PDF จริงจากรายการ 4 โฟลเดอร์ Drive (Apps Script ?action=std)
   ถ้าดึงไม่ได้ ลิงก์จะเปิดโฟลเดอร์หมวดนั้นแทน */
(function () {
  const API = window.PHOTO_API || 'https://script.google.com/macros/s/AKfycbyoLhtSeG7GeF4dh0Q25uvg7tqESwGeewG7b8IbsuMqLlJ_Tl1cI9_lxL0s1isLsFo_/exec';
  const els = [...document.querySelectorAll('a[data-std]')];
  if (!els.length) return;
  const key = s => String(s).replace(/\.pdf$/i, '').replace(/\s+/g, '').replace(/^\(ร่าง\)/, '').replace(/^มทช\.?/, 'มทช.')
    .match(/^มทช\.(?:\(ท\))?\d{3}(?:\.\d+)?/);
  fetch(API + '?action=std').then(r => r.json()).then(j => {
    if (!j.ok || !j.std) return;
    const map = {};
    j.std.forEach(g => g.files.forEach(f => { const k = key(f.name); if (k && !map[k[0]]) map[k[0]] = f.id; }));
    els.forEach(a => { const id = map[a.dataset.std]; if (id) a.href = 'https://drive.google.com/file/d/' + id + '/view'; });
  }).catch(() => {});
})();
