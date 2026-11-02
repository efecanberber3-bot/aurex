export function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, char => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  })[char]);
}
export function initials(value = '') {
  return String(value).trim().split(/\s+/).slice(0,2).map(x=>x[0] || '').join('').toUpperCase() || 'A';
}
export function formatDate(value) {
  if (!value) return 'Tarih belirtilmedi';
  return new Date(value).toLocaleString('tr-TR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
}
