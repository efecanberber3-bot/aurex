import './styles/tokens.css';
import './styles/global.css';
import './styles/app.css';
import './styles/progress.css';
import { supabase, isConfigured } from './services/supabase.js';
import { getSession, signIn, signUp, signOut, getProfile } from './services/auth.service.js';
import { listClients, createClient, updateClientStatus, getClient } from './services/clients.service.js';
import { listPrograms, createProgram, listExercises, addProgramExercise, createExercise } from './services/workouts.service.js';
import { listSessions, createSession } from './services/sessions.service.js';
import { getClientManagementData, saveClientAssessment, addClientGoal, addCoachNote } from './services/client-management.service.js';
import { escapeHtml, formatDate, initials } from './utils/helpers.js';

const app = document.querySelector('#app');
let state = { session: null, profile: null, clients: [], programs: [], sessions: [], view: 'dashboard', selectedClient: null, loading: false };

function notify(message, type = 'info') {
  const node = document.createElement('div');
  node.className = `toast ${type}`;
  node.textContent = message;
  document.body.append(node);
  setTimeout(() => node.remove(), 3600);
}

function icon(name) {
  const paths = {
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    dumbbell: '<path d="m6.5 6.5 11 11M5 3 3 5l4 4 2-2-4-4ZM19 15l-2 2 4 4 2-2-4-4ZM3 19l4-4M15 7l4-4"/>',
    calendar: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    chart: '<path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-5 5"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    arrow: '<path d="M5 12h14m-7-7 7 7-7 7"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    close: '<path d="m18 6-12 12M6 6l12 12"/>',
    activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>'
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.grid}</svg>`;
}

function shell(content) {
  const trainer = state.profile?.role === 'trainer' || state.profile?.role === 'admin';
  const links = trainer
    ? [['dashboard','Genel Bakış','grid'],['clients','Danışanlar','users'],['programs','Programlar','dumbbell'],['sessions','Seanslar','calendar']]
    : [['portal','Panelim','grid'],['my-programs','Programım','dumbbell'],['my-sessions','Seanslarım','calendar']];
  app.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar" id="sidebar">
        <a class="brand" href="#dashboard"><img class="brand-logo" src="/aurex/aurex-logo.svg" alt="AUREX Train Track Evolve"></a>
        <div class="workspace-label">WORKSPACE</div>
        <nav>${links.map(([id,label,ico])=>`<button class="nav-link ${state.view===id?'active':''}" data-view="${id}">${icon(ico)}<span>${label}</span></button>`).join('')}</nav>
        <div class="sidebar-bottom">
          <div class="user-mini"><div class="avatar">${initials(state.profile?.display_name || state.session?.user?.email || 'A')}</div><div><b>${escapeHtml(state.profile?.display_name || 'Kullanıcı')}</b><small>${trainer?'Antrenör hesabı':'Danışan hesabı'}</small></div></div>
          <button class="nav-link logout" id="logout">${icon('logout')}<span>Çıkış yap</span></button>
        </div>
      </aside>
      <main class="main-area">
        <header class="topbar"><button class="icon-button mobile-menu" id="mobile-menu" aria-label="Menüyü aç">${icon('menu')}</button><div><span class="eyebrow">PERSONAL TRAINING MANAGEMENT</span><h1>${pageTitle()}</h1></div><div class="topbar-right"><span class="status-dot"></span><span class="topbar-status">Sistem hazır</span><div class="avatar">${initials(state.profile?.display_name || 'A')}</div></div></header>
        <section class="page-content">${content}</section>
        <footer class="footer"><span>AUREX <span class="gold">●</span> by EB Digital Studio</span><span>Personal Training Management · V1.3</span></footer>
      </main>
    </div>`;
  document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.view)));
  document.querySelector('#logout')?.addEventListener('click', async()=>{ await signOut(); state={...state,session:null,profile:null}; renderAuth(); });
  document.querySelector('#mobile-menu')?.addEventListener('click',()=>document.querySelector('#sidebar').classList.toggle('open'));
}
function pageTitle() {
  return ({dashboard:'Genel Bakış',clients:'Danışan Yönetimi',programs:'Antrenman Programları',sessions:'Seans Takibi',portal:'Danışan Paneli','my-programs':'Antrenman Programım','my-sessions':'Seans Geçmişim'})[state.view] || 'Genel Bakış';
}
function navigate(view) { state.view=view; location.hash=view; render(); }
function statCard(label,value,caption,ico) { return `<article class="stat-card"><div class="stat-top"><span>${label}</span><span class="stat-icon">${icon(ico)}</span></div><strong>${value}</strong><small>${caption}</small></article>`; }

async function refreshData() {
  if (!state.session) return;
  if (['trainer','admin'].includes(state.profile?.role)) {
    const [clients,programs,sessions] = await Promise.all([listClients(),listPrograms(),listSessions()]);
    state.clients=clients; state.programs=programs; state.sessions=sessions;
  } else {
    state.clients = [];
    state.programs = await listPrograms();
    state.sessions = await listSessions();
  }
}

function dashboardView() {
  const upcoming = state.sessions.filter(s=>s.status==='planned').slice(0,5);
  return `
    <div class="welcome-row"><div><p class="muted">Tekrar hoş geldin,</p><h2>${escapeHtml(state.profile?.display_name || 'Antrenör')}</h2><p class="muted">Bugünün çalışmalarını ve danışan gelişimini buradan yönet.</p></div><button class="btn btn-gold" id="add-client">${icon('plus')} Danışan ekle</button></div>
    <div class="stats-grid">${statCard('Aktif danışan',state.clients.filter(c=>c.status==='active').length,'Takip edilen danışan','users')}${statCard('Program',state.programs.length,'Oluşturulan program','dumbbell')}${statCard('Planlı seans',upcoming.length,'Bekleyen seans','calendar')}${statCard('Tamamlanan seans',state.sessions.filter(s=>s.status==='completed').length,'Kayıtlı çalışmalar','chart')}</div>
    <div class="content-grid"><article class="panel"><div class="panel-heading"><div><span class="eyebrow">CLIENT MANAGEMENT</span><h3>Son danışanlar</h3></div><button class="text-button" data-view="clients">Tümünü gör ${icon('arrow')}</button></div>${clientRows(state.clients.slice(0,5))}</article><article class="panel"><div class="panel-heading"><div><span class="eyebrow">SCHEDULE</span><h3>Yaklaşan seanslar</h3></div></div>${upcoming.length?upcoming.map(s=>`<div class="session-row"><div class="date-chip">${new Date(s.scheduled_at).toLocaleDateString('tr-TR',{day:'2-digit',month:'short'})}</div><div><b>${escapeHtml(s.client_name || 'Danışan')}</b><small>${formatDate(s.scheduled_at)} · ${escapeHtml(s.status)}</small></div></div>`).join(''):'<div class="empty-state compact">Henüz planlanmış seans yok.</div>'}</article></div>`;
}

function renderTrendChart(title, unit, rows) {
  const points=rows.filter(x=>Number.isFinite(Number(x.value))).slice(0,12).reverse();
  if(points.length<2) return '<article class="trend-card"><div class="trend-title"><b>'+escapeHtml(title)+'</b><small>'+(points.length?'1 kayıt · Grafik için en az 2 kayıt gerekli':'Henüz veri yok')+'</small></div><div class="trend-empty">En az iki ölçüm kaydedildiğinde grafik burada görünecek.</div></article>';
  const values=points.map(x=>Number(x.value)), min=Math.min(...values), max=Math.max(...values), spread=max-min||Math.max(max*.08,1);
  const coords=values.map((v,i)=>({x:18+i*(304/(values.length-1)),y:84-((v-min)/spread)*62}));
  const line=coords.map(p=>p.x+','+p.y).join(' '), last=values[values.length-1], delta=last-values[0];
  return '<article class="trend-card"><div class="trend-title"><b>'+escapeHtml(title)+'</b><span class="trend-value">'+last.toFixed(1)+' '+escapeHtml(unit)+'</span></div><svg class="trend-chart" viewBox="0 0 340 112" role="img" aria-label="'+escapeHtml(title)+' gelişim grafiği"><path d="M18 22H322M18 53H322M18 84H322" stroke="rgba(255,255,255,.08)" stroke-dasharray="3 5"/><polyline points="'+line+'" fill="none" stroke="#ef233c" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="'+coords[coords.length-1].x+'" cy="'+coords[coords.length-1].y+'" r="4" fill="#ff6875"/></svg><div class="trend-meta"><small>'+new Date(points[0].date).toLocaleDateString('tr-TR')+'</small><small>'+(delta>0?'+':'')+delta.toFixed(1)+' '+escapeHtml(unit)+' toplam değişim</small><small>'+new Date(points[points.length-1].date).toLocaleDateString('tr-TR')+'</small></div></article>';
}
function progressReportPrint(){document.body.classList.add('printing-client-report');window.print();setTimeout(()=>document.body.classList.remove('printing-client-report'),800);}
function clientRows(clients) {
  if (!clients.length) return '<div class="empty-state"><div class="empty-icon">＋</div><b>Henüz danışan yok</b><p>İlk danışanını ekleyerek takip sistemini başlat.</p></div>';
  return `<div class="table-wrap"><table><thead><tr><th>DANIŞAN</th><th>HEDEF</th><th>DURUM</th><th></th></tr></thead><tbody>${clients.map(c=>`<tr><td><div class="person-cell"><div class="avatar small">${initials(c.first_name+' '+c.last_name)}</div><div><b>${escapeHtml(c.first_name+' '+c.last_name)}</b><small>${escapeHtml(c.sport || 'Genel fitness')}</small></div></div></td><td>${escapeHtml(c.goal || 'Belirtilmedi')}</td><td><span class="pill ${c.status==='active'?'green':'gray'}">${c.status==='active'?'Aktif':c.status==='paused'?'Duraklatıldı':'Tamamlandı'}</span></td><td><button class="row-action" data-client="${c.id}">İncele ${icon('arrow')}</button></td></tr>`).join('')}</tbody></table></div>`;
}

function clientsView() {
  return `<div class="page-actions client-page-actions"><div><p class="muted">Danışan profillerini, hedeflerini ve durumlarını yönet.</p><div class="client-filters"><input id="client-search" type="search" placeholder="İsim veya hedef ara..." aria-label="Danışan ara"><select id="client-status-filter" aria-label="Duruma göre filtrele"><option value="all">Tüm durumlar</option><option value="active">Aktif</option><option value="paused">Duraklatıldı</option><option value="completed">Tamamlandı</option></select></div></div><button class="btn btn-gold" id="add-client">${icon('plus')} Yeni danışan</button></div><article class="panel">${clientRows(state.clients)}</article>`;
}
function clientModal() {
  return `<div class="modal-backdrop" id="modal"><form class="modal" id="client-form"><div class="modal-head"><div><span class="eyebrow">NEW CLIENT</span><h3>Danışan oluştur</h3></div><button type="button" class="icon-button" id="close-modal">${icon('close')}</button></div><label>Ad<input name="first_name" required maxlength="80" autocomplete="given-name"></label><label>Soyad<input name="last_name" required maxlength="80" autocomplete="family-name"></label><label>Doğum tarihi<input name="birth_date" type="date"></label><label>Branş / kategori<input name="sport" maxlength="100" placeholder="Örn. Futbol / Genel fitness"></label><label>Hedef<textarea name="goal" rows="2" maxlength="500" placeholder="Danışanın hedefi"></textarea></label><label>Seviye<select name="experience_level"><option value="beginner">Başlangıç</option><option value="intermediate">Orta</option><option value="advanced">İleri</option></select></label><div class="modal-actions"><button type="button" class="btn btn-ghost" id="cancel-modal">Vazgeç</button><button class="btn btn-gold" type="submit">Danışanı kaydet</button></div></form></div>`;
}

function programExerciseSummary(program) {
  const exercises=[...(program.program_exercises||[])].sort((a,b)=>a.day_number-b.day_number||a.order_number-b.order_number);
  if(!exercises.length)return '<small class="muted">Hareket detayı bulunmuyor.</small>';
  const days=[...new Set(exercises.map(x=>x.day_number))];
  return '<div class="program-exercise-summary">'+days.map(day=>{
    const items=exercises.filter(x=>x.day_number===day);
    return '<div class="program-day-preview"><b>'+day+'. Gün</b><span>'+items.map(x=>escapeHtml(x.exercise_library?.name||'Hareket')+' · '+(x.sets||'—')+'×'+escapeHtml(x.reps||'—')).join(' / ')+'</span></div>';
  }).join('')+'</div>';
}
function programsView() {
  return `<div class="page-actions"><p class="muted">Danışanlara özel, gün ve hareket bazlı antrenman planları oluştur.</p><button class="btn btn-gold" id="add-program">${icon('plus')} Program oluştur</button></div><div class="program-grid">${state.programs.length?state.programs.map(p=>`<article class="panel program-card"><div class="program-symbol">${icon('dumbbell')}</div><span class="pill ${p.status==='active'?'green':'gray'}">${p.status==='active'?'Aktif':escapeHtml(p.status)}</span><h3>${escapeHtml(p.name)}</h3><p>${escapeHtml(p.objective||'Hedef belirtilmedi')}</p><small>${escapeHtml(p.client_name||'Danışan atanmadı')}</small>${programExerciseSummary(p)}</article>`).join(''):'<article class="panel empty-state"><b>Henüz program yok</b><p>İlk antrenman programını oluştur.</p></article>'}</div>`;
}
function exerciseBuilderRow() {
  return `<div class="exercise-builder-row"><div class="exercise-row-top"><label>Antrenman günü<select name="day_number" required><option value="1">1. Gün</option><option value="2">2. Gün</option><option value="3">3. Gün</option><option value="4">4. Gün</option><option value="5">5. Gün</option><option value="6">6. Gün</option><option value="7">7. Gün</option></select></label><button type="button" class="text-button remove-exercise">Kaldır</button></div><label>Hareket adı<input name="exercise_name" required maxlength="120" placeholder="Örn. Bench Press"></label><div class="exercise-fields"><label>Bölge<input name="muscle_group" maxlength="60" placeholder="Göğüs"></label><label>Set<input name="sets" type="number" min="1" max="20" value="3" required></label><label>Tekrar<input name="reps" maxlength="30" value="10-12" required></label><label>Dinlenme (sn)<input name="rest_seconds" type="number" min="0" max="900" step="15" value="90"></label></div><label>Antrenör notu<input name="exercise_notes" maxlength="300" placeholder="Tempo, teknik veya özel talimat"></label></div>`;
}
function programModal() {
  return `<div class="modal-backdrop" id="modal"><form class="modal program-builder-modal" id="program-form"><div class="modal-head"><div><span class="eyebrow">AUREX WORKOUT BUILDER</span><h3>Yeni antrenman programı</h3></div><button type="button" class="icon-button" id="close-modal">${icon('close')}</button></div><div class="builder-section"><span class="builder-step">01 / PROGRAM BİLGİLERİ</span><label>Program adı<input name="name" required maxlength="120" placeholder="Örn. 4 Günlük Hipertrofi"></label><label>Danışan<select name="client_id" required>${state.clients.map(c=>`<option value="${c.id}">${escapeHtml(c.first_name+' '+c.last_name)}</option>`).join('')}</select></label><label>Ana hedef<textarea name="objective" rows="2" maxlength="500" placeholder="Örn. Kas kütlesi kazanımı ve kuvvet gelişimi"></textarea></label><label>Başlangıç tarihi<input name="start_date" type="date"></label></div><div class="builder-section"><div class="builder-section-head"><div><span class="builder-step">02 / ANTRENMAN PLANI</span><h4>Hareketleri ekle</h4><p class="muted">Her hareket için gün, set, tekrar ve dinlenme süresini belirle.</p></div><button type="button" class="btn btn-ghost" id="add-exercise-row">${icon('plus')} Hareket ekle</button></div><div id="exercise-builder-list">${exerciseBuilderRow()}</div></div><div class="modal-actions"><button type="button" class="btn btn-ghost" id="cancel-modal">Vazgeç</button><button class="btn btn-gold" type="submit">Programı kaydet</button></div></form></div>`;
}
function sessionsView() {
  return `<div class="page-actions"><p class="muted">Planlanan ve tamamlanan özel ders kayıtları.</p><button class="btn btn-gold" id="add-session">${icon('plus')} Seans planla</button></div><article class="panel">${state.sessions.length?`<div class="table-wrap"><table><thead><tr><th>DANIŞAN</th><th>TARİH</th><th>SÜRE</th><th>DURUM</th></tr></thead><tbody>${state.sessions.map(s=>`<tr><td><b>${escapeHtml(s.client_name || 'Danışan')}</b></td><td>${formatDate(s.scheduled_at)}</td><td>${s.duration_minutes || '—'} dk</td><td><span class="pill ${s.status==='completed'?'green':'gray'}">${s.status==='completed'?'Tamamlandı':'Planlandı'}</span></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty-state"><b>Henüz seans kaydı yok</b><p>İlk seansını planla.</p></div>'}</article>`;
}
function sessionModal() {
  return `<div class="modal-backdrop" id="modal"><form class="modal" id="session-form"><div class="modal-head"><div><span class="eyebrow">SESSION PLANNER</span><h3>Seans planla</h3></div><button type="button" class="icon-button" id="close-modal">${icon('close')}</button></div><label>Danışan<select name="client_id" required>${state.clients.map(c=>`<option value="${c.id}">${escapeHtml(c.first_name+' '+c.last_name)}</option>`).join('')}</select></label><label>Tarih ve saat<input name="scheduled_at" type="datetime-local" required></label><label>Süre (dakika)<input name="duration_minutes" type="number" min="10" max="240" value="60"></label><div class="modal-actions"><button type="button" class="btn btn-ghost" id="cancel-modal">Vazgeç</button><button class="btn btn-gold" type="submit">Seansı kaydet</button></div></form></div>`;
}
function clientPortalView() {
  const me = state.clients[0];
  return `<div class="welcome-row"><div><p class="muted">AUREX danışan alanına hoş geldin.</p><h2>${escapeHtml(state.profile?.display_name || 'Sporcu')}</h2><p class="muted">Antrenörün tarafından paylaşılan çalışmalarını buradan takip edebilirsin.</p></div></div><div class="stats-grid">${statCard('Programlarım',state.programs.length,'Atanmış program','dumbbell')}${statCard('Seanslarım',state.sessions.length,'Kayıtlı seans','calendar')}</div><div class="content-grid"><article class="panel"><div class="panel-heading"><h3>Programlarım</h3></div>${state.programs.length?state.programs.map(p=>`<div class="session-row"><div class="program-symbol">${icon('dumbbell')}</div><div><b>${escapeHtml(p.name)}</b><small>${escapeHtml(p.objective||'')}</small>${programExerciseSummary(p)}</div></div>`).join(''):'<div class="empty-state compact">Henüz program atanmadı.</div>'}</article><article class="panel"><div class="panel-heading"><h3>Son seanslarım</h3></div>${state.sessions.length?state.sessions.map(s=>`<div class="session-row"><div class="date-chip">${new Date(s.scheduled_at).toLocaleDateString('tr-TR',{day:'2-digit',month:'short'})}</div><div><b>${formatDate(s.scheduled_at)}</b><small>${s.duration_minutes||'—'} dakika</small></div></div>`).join(''):'<div class="empty-state compact">Henüz seans kaydı yok.</div>'}</article></div>`;
}
function render() {
  if (!state.session) return renderAuth();
  const isTrainer = ['trainer','admin'].includes(state.profile?.role);
  if (isTrainer && !['dashboard','clients','programs','sessions'].includes(state.view)) state.view='dashboard';
  if (!isTrainer && !['portal','my-programs','my-sessions'].includes(state.view)) state.view='portal';
  let content = state.view==='dashboard'?dashboardView():state.view==='clients'?clientsView():state.view==='programs'?programsView():state.view==='sessions'?sessionsView():clientPortalView();
  shell(content);
  bindPageActions();
}
function bindModalClose() {
  const close=()=>document.querySelector('#modal')?.remove();
  document.querySelector('#close-modal')?.addEventListener('click',close);
  document.querySelector('#cancel-modal')?.addEventListener('click',close);
  document.querySelector('#modal')?.addEventListener('click',e=>{if(e.target.id==='modal')close();});
}
function bindPageActions() {
  document.querySelectorAll('#add-client').forEach(b=>b.addEventListener('click',()=>{app.insertAdjacentHTML('beforeend',clientModal());bindModalClose();document.querySelector('#client-form').addEventListener('submit',saveClient);}));
  document.querySelectorAll('[data-client]').forEach(b=>b.addEventListener('click',()=>openClient(b.dataset.client)));
  const filterClients=()=>{const q=(document.querySelector('#client-search')?.value||'').trim().toLocaleLowerCase('tr-TR');const status=document.querySelector('#client-status-filter')?.value||'all';document.querySelectorAll('tbody tr').forEach(row=>{const pill=row.querySelector('.pill');const rowStatus=pill?.textContent.trim()==='Aktif'?'active':pill?.textContent.trim()==='Duraklatıldı'?'paused':'completed';const matchesText=row.textContent.toLocaleLowerCase('tr-TR').includes(q);const matchesStatus=status==='all'||status===rowStatus;row.hidden=!(matchesText&&matchesStatus);});};
  document.querySelector('#client-search')?.addEventListener('input',filterClients);
  document.querySelector('#client-status-filter')?.addEventListener('change',filterClients);
  document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.view)));
  document.querySelector('#add-program')?.addEventListener('click',()=>{if(!state.clients.length)return notify('Önce bir danışan eklemelisin.','error');app.insertAdjacentHTML('beforeend',programModal());bindModalClose();const form=document.querySelector('#program-form');form.addEventListener('submit',saveProgram);document.querySelector('#add-exercise-row')?.addEventListener('click',()=>document.querySelector('#exercise-builder-list').insertAdjacentHTML('beforeend',exerciseBuilderRow()));document.querySelector('#exercise-builder-list')?.addEventListener('click',e=>{if(e.target.closest('.remove-exercise')){const rows=document.querySelectorAll('.exercise-builder-row');if(rows.length===1)return notify('Programda en az bir hareket kalmalı.','error');e.target.closest('.exercise-builder-row').remove();}});});
  document.querySelector('#add-session')?.addEventListener('click',()=>{if(!state.clients.length)return notify('Önce bir danışan eklemelisin.','error');app.insertAdjacentHTML('beforeend',sessionModal());bindModalClose();document.querySelector('#session-form').addEventListener('submit',saveSession);});
}
async function saveClient(e) {
  e.preventDefault(); const data=Object.fromEntries(new FormData(e.currentTarget));
  try { await createClient(data); notify('Danışan başarıyla oluşturuldu.','success'); await refreshData(); render(); }
  catch(err){notify(err.message,'error');}
}
async function saveProgram(e) {
  e.preventDefault();
  const form=e.currentTarget,data=Object.fromEntries(new FormData(form));
  const rows=[...form.querySelectorAll('.exercise-builder-row')];
  if(!rows.length)return notify('En az bir hareket eklemelisin.','error');
  const submit=form.querySelector('button[type="submit"]');submit.disabled=true;submit.textContent='Program kaydediliyor...';
  try {
    const program=await createProgram(data);
    for(let i=0;i<rows.length;i++){
      const values=Object.fromEntries(new FormData(rows[i]));
      const exercise=await createExercise({name:values.exercise_name,muscle_group:values.muscle_group,category:'strength'});
      await addProgramExercise({program_id:program.id,exercise_id:exercise.id,day_number:Number(values.day_number),order_number:i+1,sets:Number(values.sets),reps:values.reps.trim(),rest_seconds:values.rest_seconds===''?null:Number(values.rest_seconds),notes:values.exercise_notes?.trim()||null});
    }
    notify('Program ve '+rows.length+' hareket başarıyla kaydedildi.','success');await refreshData();render();
  } catch(err){notify('Kayıt sırasında hata: '+err.message+' Program kaydı oluşmuş olabilir; kontrol et.','error');submit.disabled=false;submit.textContent='Tekrar dene';}
}
async function saveSession(e) {
  e.preventDefault(); const data=Object.fromEntries(new FormData(e.currentTarget));
  try { await createSession(data); notify('Seans kaydedildi.','success'); await refreshData(); render(); }
  catch(err){notify(err.message,'error');}
}
async function openClient(id) {
  state.selectedClient = id;
  try {
    const [c, records] = await Promise.all([getClient(id), getClientManagementData(id)]);
    const metricLabel = key => ({waist_cm:'Bel',body_fat_pct:'Yağ oranı',chest_cm:'Göğüs',arm_cm:'Kol',leg_cm:'Bacak'}[key] || key);
    const latest = records.assessments[0];
    const weightHistory=records.assessments.filter(a=>a.weight_kg!=null).map(a=>({value:Number(a.weight_kg),date:a.assessed_at}));
    const metricHistory=key=>records.progress.filter(p=>p.metric_key===key).map(p=>({value:Number(p.metric_value),date:p.recorded_at}));
    const metricCharts=[renderTrendChart('Kilo gelişimi','kg',weightHistory),renderTrendChart('Bel çevresi','cm',metricHistory('waist_cm')),renderTrendChart('Yağ oranı','%',metricHistory('body_fat_pct')),renderTrendChart('Göğüs ölçüsü','cm',metricHistory('chest_cm'))].join('');
    const allHistory=[...weightHistory.map(x=>({...x,label:'Kilo',unit:'kg'})),...records.progress.map(x=>({value:Number(x.metric_value),date:x.recorded_at,label:metricLabel(x.metric_key),unit:x.unit||''}))].sort((a,b)=>new Date(b.date)-new Date(a.date));
    const body = `<div class="modal-backdrop" id="modal"><article class="modal client-profile-modal">
      <div class="modal-head"><div><span class="eyebrow">CLIENT PROFILE</span><h3>${escapeHtml(c.first_name+' '+c.last_name)}</h3></div><button class="icon-button" id="close-modal">${icon('close')}</button></div>
      <div class="profile-detail-grid">
        <div><small>Branş</small><b>${escapeHtml(c.sport||'Belirtilmedi')}</b></div>
        <div><small>Hedef</small><b>${escapeHtml(c.goal||'Belirtilmedi')}</b></div>
        <div><small>Seviye</small><b>${escapeHtml(c.experience_level||'beginner')}</b></div>
        <div><small>Durum</small><b>${c.status==='active'?'Aktif':c.status==='paused'?'Duraklatıldı':'Tamamlandı'}</b></div>
      </div>
      <div class="profile-toolbar"><span class="muted">Hesap: ${c.auth_user_id?'Bağlı':'Henüz bağlanmadı'}</span>
        <div class="profile-toolbar-actions"><button class="btn btn-ghost" id="print-client-report">Gelişim raporu</button><button class="btn btn-ghost" id="toggle-client-status">${c.status==='active'?'Danışanı duraklat':'Danışanı aktifleştir'}</button></div></div>
      <section class="record-section"><div class="panel-heading"><h3>Son değerlendirme</h3><button class="text-button" id="add-assessment">+ Ölçüm ekle</button></div>
        ${latest ? `<div class="metric-grid"><div><small>Boy</small><b>${latest.height_cm ?? '—'} cm</b></div><div><small>Kilo</small><b>${latest.weight_kg ?? '—'} kg</b></div><div><small>Değerlendirme</small><b>${new Date(latest.assessed_at).toLocaleDateString('tr-TR')}</b></div></div><p class="muted">${escapeHtml(latest.fitness_notes||'Not eklenmemiş.')}</p>` : '<p class="muted">Henüz ölçüm kaydı yok.</p>'}
        ${records.progress.length ? `<div class="record-list">${records.progress.map(p=>`<div class="record-row"><span>${escapeHtml(metricLabel(p.metric_key))}</span><b>${p.metric_value} ${escapeHtml(p.unit||'')}</b><small>${new Date(p.recorded_at).toLocaleDateString('tr-TR')}</small></div>`).join('')}</div>` : ''}
      </section>
      <section class="record-section progress-report"><div class="panel-heading"><div><span class="eyebrow">PROGRESS ANALYTICS</span><h3>Gelişim analizi</h3></div><span class="muted">${allHistory.length} ölçüm kaydı</span></div><div class="trend-grid">${metricCharts}</div><div class="record-section"><div class="panel-heading"><h3>Ölçüm geçmişi</h3></div>${allHistory.length?'<div class="table-wrap"><table class="history-table"><thead><tr><th>TARİH</th><th>ÖLÇÜM</th><th>DEĞER</th></tr></thead><tbody>'+allHistory.map(x=>'<tr><td>'+new Date(x.date).toLocaleDateString('tr-TR')+'</td><td>'+escapeHtml(x.label)+'</td><td><b>'+x.value+' '+escapeHtml(x.unit)+'</b></td></tr>').join('')+'</tbody></table></div>':'<p class="muted">Henüz ölçüm geçmişi bulunmuyor.</p>'}</div></section>
      <section class="record-section"><div class="panel-heading"><h3>Hedefler</h3><button class="text-button" id="add-goal">+ Hedef ekle</button></div>
        ${records.goals.length ? `<div class="record-list">${records.goals.map(g=>`<div class="record-row goal-row"><div><b>${escapeHtml(g.title)}</b><small>${escapeHtml(g.description||'')}</small></div><span class="pill ${g.status==='active'?'green':'gray'}">${g.status==='active'?'Aktif':escapeHtml(g.status)}</span></div>`).join('')}</div>` : '<p class="muted">Henüz hedef tanımlanmamış.</p>'}
      </section>
      <section class="record-section"><div class="panel-heading"><h3>Antrenör notları</h3><button class="text-button" id="add-note">+ Not ekle</button></div>
        ${records.notes.length ? `<div class="record-list">${records.notes.map(n=>`<div class="note-card"><p>${escapeHtml(n.note)}</p><small>${new Date(n.created_at).toLocaleString('tr-TR')}</small></div>`).join('')}</div>` : '<p class="muted">Henüz not eklenmemiş.</p>'}
      </section>
      <div class="modal-actions"><button class="btn btn-ghost" id="close-profile">Kapat</button></div>
    </article></div>`;
    app.insertAdjacentHTML('beforeend', body);
    const close=()=>document.querySelector('#modal')?.remove();
    document.querySelector('#close-modal')?.addEventListener('click',close);
    document.querySelector('#close-profile')?.addEventListener('click',close);
    document.querySelector('#print-client-report')?.addEventListener('click',progressReportPrint);
    document.querySelector('#modal')?.addEventListener('click',e=>{if(e.target.id==='modal')close();});
    document.querySelector('#toggle-client-status')?.addEventListener('click',async()=>{
      try { await updateClientStatus(id,c.status==='active'?'paused':'active'); notify('Danışan durumu güncellendi.','success'); await refreshData(); close(); render(); }
      catch(err){notify(err.message,'error');}
    });
    document.querySelector('#add-assessment')?.addEventListener('click',()=>showRecordForm(id,'Ölçüm ekle',[
      ['height_cm','Boy (cm)','number'],['weight_kg','Kilo (kg)','number'],['waist_cm','Bel (cm)','number'],['body_fat_pct','Yağ oranı (%)','number'],['chest_cm','Göğüs (cm)','number'],['arm_cm','Kol (cm)','number'],['leg_cm','Bacak (cm)','number'],['fitness_notes','Değerlendirme notu','textarea']
    ],async data=>{await saveClientAssessment(id,data);}));
    document.querySelector('#add-goal')?.addEventListener('click',()=>showRecordForm(id,'Hedef ekle',[
      ['title','Hedef başlığı','text'],['description','Açıklama','textarea'],['target_date','Hedef tarihi','date']
    ],async data=>{await addClientGoal(id,data);}));
    document.querySelector('#add-note')?.addEventListener('click',()=>showRecordForm(id,'Antrenör notu',[
      ['note','Not','textarea']
    ],async data=>{await addCoachNote(id,state.session.user.id,data.note);}));
  } catch(err){notify(err.message,'error');}
}
function showRecordForm(clientId, title, fields, save) {
  const modal=document.querySelector('#modal .modal');
  const form=document.createElement('form');
  form.className='inline-record-form';
  form.innerHTML=`<div class="modal-head"><h3>${escapeHtml(title)}</h3><button type="button" class="icon-button" id="cancel-record">${icon('close')}</button></div>${fields.map(([name,label,type])=>`<label>${escapeHtml(label)}${type==='textarea'? `<textarea name="${name}" rows="3" ${name==='note'||name==='title'?'required':''}></textarea>`:`<input name="${name}" type="${type}" ${type==='number'?'step="0.1" min="0"':''} ${name==='title'?'required':''}>`}</label>`).join('')}<div class="modal-actions"><button type="button" class="btn btn-ghost" id="cancel-record-2">Vazgeç</button><button class="btn btn-gold" type="submit">Kaydet</button></div>`;
  modal.append(form);
  const remove=()=>form.remove();
  form.querySelector('#cancel-record').addEventListener('click',remove);
  form.querySelector('#cancel-record-2').addEventListener('click',remove);
  form.addEventListener('submit',async e=>{
    e.preventDefault();
    const data=Object.fromEntries(new FormData(form));
    try { await save(data); notify('Kayıt başarıyla eklendi.','success'); await refreshData(); document.querySelector('#modal')?.remove(); await openClient(clientId); }
    catch(err){notify(err.message,'error');}
  });
}
function renderAuth() {
  app.innerHTML=`<main class="auth-layout"><section class="auth-brand"><div class="brand auth-brand-logo"><img class="brand-logo" src="/aurex/aurex-logo.svg" alt="AUREX Train Track Evolve"></div><div class="auth-hero"><span class="eyebrow">TRAIN SMARTER. TRACK BETTER.</span><h1>Gelişimin<br><span class="gold">kontrolü</span><br>senin elinde.</h1><p>Antrenörler ve danışanlar için sade, güçlü ve kişisel bir takip deneyimi.</p></div><div class="auth-foot">AUREX · by EB Digital Studio</div></section><section class="auth-form-side"><form class="auth-card" id="auth-form"><div class="auth-heading"><span class="eyebrow">WELCOME BACK</span><h2>Hesabına giriş yap</h2><p class="muted">AUREX çalışma alanına devam et.</p></div><div class="auth-tabs"><button type="button" class="auth-tab active" data-mode="login">Giriş yap</button><button type="button" class="auth-tab" data-mode="signup">Hesap oluştur</button></div><label>Ad soyad <input name="display_name" id="display-name" placeholder="Adınız Soyadınız" autocomplete="name" hidden></label><label>E-posta<input name="email" type="email" required autocomplete="email" placeholder="ornek@email.com"></label><label>Şifre<input name="password" type="password" required minlength="8" autocomplete="current-password" placeholder="En az 8 karakter"></label><button class="btn btn-gold full" type="submit" id="auth-submit">Giriş yap ${icon('arrow')}</button><p class="auth-note">Hesap oluşturduğunda varsayılan rolün danışan olur. Antrenör erişimi yönetici tarafından ayrıca tanımlanır.</p><p class="auth-error" id="auth-error"></p></form></section></main>`;
  let mode='login';
  document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{mode=b.dataset.mode;document.querySelectorAll('[data-mode]').forEach(x=>x.classList.toggle('active',x===b));const name=document.querySelector('#display-name');name.hidden=mode!=='signup';name.required=mode==='signup';document.querySelector('#auth-submit').innerHTML=(mode==='login'?'Giriş yap ':'Hesap oluştur ')+icon('arrow');}));
  document.querySelector('#auth-form').addEventListener('submit',async e=>{
    e.preventDefault();const fd=new FormData(e.currentTarget);const error=document.querySelector('#auth-error');error.textContent='';
    try {
      if(!isConfigured) throw new Error('Supabase bağlantısı yapılandırılmamış. .env.local dosyanı oluştur.');
      if(mode==='login') await signIn(fd.get('email'),fd.get('password'));
      else {const result=await signUp(fd.get('email'),fd.get('password'),fd.get('display_name'));if(!result.session){error.textContent='Hesap oluşturuldu. E-posta doğrulamasını tamamladıktan sonra giriş yap.';return;}}
      await boot();
    } catch(err){error.textContent=err.message;}
  });
}
async function boot() {
  if (!isConfigured) { renderAuth(); const err=document.querySelector('#auth-error'); if(err)err.textContent='AUREX arayüzü hazır. Giriş ve kayıt işlemlerini etkinleştirmek için Supabase bağlantısını daha sonra kuracağız.'; return; }
  try {
    state.session=await getSession();
    if(!state.session){renderAuth();return;}
    state.profile=await getProfile();
    await refreshData();
    const hash=location.hash.replace('#','');
    state.view=hash || (['trainer','admin'].includes(state.profile?.role)?'dashboard':'portal');
    render();
  } catch(err){console.error(err);renderAuth();notify(err.message,'error');}
}
boot();
window.addEventListener('hashchange',()=>{const v=location.hash.replace('#','');if(v){state.view=v;render();}});
