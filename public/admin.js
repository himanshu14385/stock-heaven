(function(){
  const pages=[['index.html','Dashboard','Main stock analysis'],['stuck-stock.html','Stuck Stock','Saved stuck-stock positions'],['summary.html','Summary','Stock summary and comparison'],['alert.html','Alert','Price alert list'],['fav-stock.html','Fav Stock','Favourite stock cards']];
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const db={alerts:[],stuck:[],favorites:[]};
  let dbTab='alerts', dbBusy=false;

  async function waitForAdmin(){
    try{const s=await window.StockHeavenAuth.ready;if(s?.role==='admin')return true}catch(_){ }
    return !!window.StockHeavenAuth?.isAdmin?.();
  }
  async function api(path,opts={}){
    const r=await fetch(path,{credentials:'same-origin',cache:'no-store',...opts});
    let d={};try{d=await r.json()}catch(_){ }
    if(!r.ok){const e=new Error(d.error||`Request failed (${r.status})`);e.status=r.status;e.detail=d.detail;throw e}
    return d;
  }
  function setDbStatus(text,type=''){const el=$('dbStatus');if(el){el.textContent=text;el.className='db-status '+type}}
  function setPanel(html){$('dbManagerPanel').innerHTML=html}
  function errorPanel(title,e){setPanel(`<div class="db-error"><div class="db-error-icon"><i class="fa-solid fa-triangle-exclamation"></i></div><div><b>${esc(title)}</b><p>${esc(e?.message||'Unable to load server data.')}</p><small>API: /api/data/${dbTab}</small></div><button class="db-btn" id="dbRetry"><i class="fa-solid fa-rotate-right"></i> Retry</button></div>`);$('dbRetry')?.addEventListener('click',()=>loadTab(dbTab))}

  async function renderRestrictions(){
    const r=await window.StockHeavenAuth.restrictions();
    $('restrictionList').innerHTML=pages.map(([file,name,sub])=>`<div class="restrict-row"><div><div class="restrict-name">${name}</div><div class="restrict-sub">${sub}</div></div><label class="switch"><input type="checkbox" data-page="${file}" ${r[file]?'checked':''}><span class="slider"></span></label></div>`).join('');
    document.querySelectorAll('[data-page]').forEach(x=>x.addEventListener('change',async()=>{x.disabled=true;try{const next=await window.StockHeavenAuth.restrictions();next[x.dataset.page]=x.checked;await window.StockHeavenAuth.saveRestrictions(next);$('saveNote').textContent='Saved · '+new Date().toLocaleTimeString('en-IN')}catch(e){x.checked=!x.checked;$('saveNote').textContent=e.message||'Unable to save';}finally{x.disabled=false}}));
  }
  async function renderLog(){
    const logs=await window.StockHeavenAuth.getLoginLog(),box=$('loginLog');
    if(!logs.length){box.innerHTML='<div class="empty-log"><i class="fa-regular fa-clock"></i><b>No login activity</b><span>Successful Admin aur Guest logins yahan appear honge.</span></div>';return}
    box.innerHTML=`<div class="login-table-wrap"><table class="login-table"><thead><tr><th>Role</th><th>User</th><th>Login Date & Time</th></tr></thead><tbody>${logs.map(x=>{const d=new Date(x.loginAt);return `<tr><td><span class="role-pill ${x.role==='guest'?'guest':''}">${esc(x.role)}</span></td><td><b>${esc(x.username)}</b></td><td>${d.toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'medium'})}</td></tr>`}).join('')}</tbody></table></div>`;
  }

  async function loadTab(tab){
    if(dbBusy)return; dbBusy=true;dbTab=tab;setDbStatus('Connecting…','loading');
    setPanel(`<div class="db-loading"><span class="loading-ring"></span><div><b>Loading ${tab==='alerts'?'Alerts':tab==='stuck'?'Stuck Stock':'Fav Stock'}</b><small>D1 server data read ho raha hai…</small></div></div>`);
    try{
      if(tab==='alerts'){const d=await api('/api/data/alerts');db.alerts=d.items||[]}
      else if(tab==='stuck'){const d=await api('/api/data/stuck');db.stuck=d.items||[]}
      else {const d=await api('/api/data/favorites');db.favorites=d.groups||[]}
      setDbStatus('D1 Connected','ok');renderDb();
    }catch(e){setDbStatus('Connection error','bad');errorPanel('Database data load failed',e)}finally{dbBusy=false}
  }
  function renderDb(){
    document.querySelectorAll('[data-db-tab]').forEach(b=>b.classList.toggle('active',b.dataset.dbTab===dbTab));
    if(dbTab==='alerts')renderAlerts();else if(dbTab==='stuck')renderStuck();else renderFavorites();
  }
  function renderAlerts(){
    const rows=db.alerts;
    setPanel(`<div class="db-toolbar"><div><b class="db-title">Alerts</b><span class="db-count">${rows.length} saved</span></div><div class="db-actions"><button class="db-btn" id="dbAlertAdd"><i class="fa-solid fa-plus"></i> Add Alert</button><button class="db-btn primary" id="dbAlertSave"><i class="fa-solid fa-cloud-arrow-up"></i> Save to D1</button></div></div><div class="db-table-wrap"><table class="db-table"><thead><tr><th>#</th><th>Symbol</th><th>Name</th><th>Alert Price</th><th></th></tr></thead><tbody>${rows.length?rows.map((x,i)=>`<tr data-i="${i}"><td class="row-num">${i+1}</td><td><input class="db-input" data-k="symbol" value="${esc(x.symbol)}" placeholder="RELIANCE"></td><td><input class="db-input" data-k="name" value="${esc(x.name)}" placeholder="Company name"></td><td><input class="db-input db-num" type="number" min="0" step="0.01" data-k="alertPrice" value="${esc(x.alertPrice)}" placeholder="Optional"></td><td><button class="db-icon-btn danger" data-del="${i}" title="Delete"><i class="fa-solid fa-trash-can"></i></button></td></tr>`).join(''):`<tr><td colspan="5" class="db-empty"><i class="fa-regular fa-bell"></i><b>No alerts saved</b><span>+ Add Alert se first alert banaiye.</span></td></tr>`}</tbody></table></div><div class="db-footer-note"><i class="fa-solid fa-circle-info"></i> Blank Alert Price allowed hai.</div>`);
    $('dbAlertAdd')?.addEventListener('click',()=>{db.alerts.push({symbol:'',name:'',alertPrice:''});renderDb()});
    $('dbAlertSave')?.addEventListener('click',()=>saveTab('alerts'));
    document.querySelectorAll('[data-del]').forEach(b=>b.addEventListener('click',()=>{db.alerts.splice(+b.dataset.del,1);renderDb()}));
  }
  function renderStuck(){
    const rows=db.stuck;
    setPanel(`<div class="db-toolbar"><div><b class="db-title">Stuck Stock</b><span class="db-count">${rows.length} saved</span></div><div class="db-actions"><button class="db-btn" id="dbStuckAdd"><i class="fa-solid fa-plus"></i> Add Position</button><button class="db-btn primary" id="dbStuckSave"><i class="fa-solid fa-cloud-arrow-up"></i> Save to D1</button></div></div><div class="db-table-wrap"><table class="db-table"><thead><tr><th>#</th><th>Symbol</th><th>Name</th><th>Quantity</th><th>Buy Price</th><th></th></tr></thead><tbody>${rows.length?rows.map((x,i)=>{const m=String(x.stuckInfo||'').match(/^\s*([\d.]+)\s*[×x*]\s*([\d.]+)\s*$/i)||[];return `<tr data-i="${i}"><td class="row-num">${i+1}</td><td><input class="db-input" data-k="symbol" value="${esc(x.symbol)}"></td><td><input class="db-input" data-k="name" value="${esc(x.name)}"></td><td><input class="db-input db-num" type="number" min="0" step="1" data-k="quantity" value="${esc(m[1]||'')}"></td><td><input class="db-input db-num" type="number" min="0" step="0.01" data-k="buyPrice" value="${esc(m[2]||'')}"></td><td><button class="db-icon-btn danger" data-del="${i}" title="Delete"><i class="fa-solid fa-trash-can"></i></button></td></tr>`}).join(''):`<tr><td colspan="6" class="db-empty"><i class="fa-solid fa-thumbtack"></i><b>No positions saved</b><span>+ Add Position se first position banaiye.</span></td></tr>`}</tbody></table></div>`);
    $('dbStuckAdd')?.addEventListener('click',()=>{db.stuck.push({symbol:'',name:'',stuckInfo:'0 × 0.00'});renderDb()});$('dbStuckSave')?.addEventListener('click',()=>saveTab('stuck'));document.querySelectorAll('[data-del]').forEach(b=>b.addEventListener('click',()=>{db.stuck.splice(+b.dataset.del,1);renderDb()}));
  }
  function renderFavorites(){
    const groups=db.favorites;
    setPanel(`<div class="db-toolbar"><div><b class="db-title">Fav Stock</b><span class="db-count">${groups.length} groups</span></div><div class="db-actions"><button class="db-btn" id="dbFavAdd"><i class="fa-solid fa-plus"></i> Add Group</button><button class="db-btn primary" id="dbFavSave"><i class="fa-solid fa-cloud-arrow-up"></i> Save to D1</button></div></div><div class="db-fav-list">${groups.length?groups.map((g,gi)=>`<div class="db-group" data-gi="${gi}"><div class="db-group-head"><div class="db-group-title"><span class="db-group-index">${gi+1}</span><input class="db-input" data-gk="title" value="${esc(g.title)}" placeholder="Group title"></div><label class="db-collapse"><input type="checkbox" data-gk="collapsed" ${g.collapsed?'checked':''}> Collapsed</label><button class="db-icon-btn danger" data-gdel="${gi}" title="Delete group"><i class="fa-solid fa-trash-can"></i></button></div><div class="db-stock-list">${(g.stocks||[]).map((x,si)=>`<div class="db-stock-row" data-si="${si}"><input class="db-input" data-sk="symbol" value="${esc(x.symbol)}" placeholder="Symbol"><input class="db-input" data-sk="name" value="${esc(x.name)}" placeholder="Name"><input class="db-input" data-sk="note" value="${esc(x.note)}" placeholder="Short note"><button class="db-icon-btn danger" data-sdel="${gi}:${si}" title="Remove stock"><i class="fa-solid fa-xmark"></i></button></div>`).join('')||'<div class="db-sub-empty">No stocks in this group.</div>'}<button class="db-add-stock" data-sadd="${gi}"><i class="fa-solid fa-plus"></i> Add Stock</button></div></div>`).join(''):`<div class="db-empty large"><i class="fa-solid fa-star"></i><b>No favourite groups</b><span>+ Add Group se apna first group banaiye.</span></div>`}</div>`);
    $('dbFavAdd')?.addEventListener('click',()=>{db.favorites.push({id:null,title:'New Group',collapsed:false,stocks:[]});renderDb()});$('dbFavSave')?.addEventListener('click',()=>saveTab('favorites'));document.querySelectorAll('[data-gdel]').forEach(b=>b.addEventListener('click',()=>{db.favorites.splice(+b.dataset.gdel,1);renderDb()}));document.querySelectorAll('[data-sadd]').forEach(b=>b.addEventListener('click',()=>{db.favorites[+b.dataset.sadd].stocks.push({id:null,symbol:'',name:'',note:''});renderDb()}));document.querySelectorAll('[data-sdel]').forEach(b=>b.addEventListener('click',()=>{const [gi,si]=b.dataset.sdel.split(':').map(Number);db.favorites[gi].stocks.splice(si,1);renderDb()}));
  }
  function syncRows(type){const rows=db[type];document.querySelectorAll('#dbManagerPanel tbody tr[data-i]').forEach(tr=>{const i=+tr.dataset.i;if(type==='alerts'){rows[i].symbol=tr.querySelector('[data-k="symbol"]').value.trim().toUpperCase();rows[i].name=tr.querySelector('[data-k="name"]').value.trim();rows[i].alertPrice=tr.querySelector('[data-k="alertPrice"]').value.trim()}else{const q=tr.querySelector('[data-k="quantity"]').value.trim()||'0',p=tr.querySelector('[data-k="buyPrice"]').value.trim()||'0';rows[i].symbol=tr.querySelector('[data-k="symbol"]').value.trim().toUpperCase();rows[i].name=tr.querySelector('[data-k="name"]').value.trim();rows[i].stuckInfo=`${q} × ${p}`}})}
  function syncFavorites(){document.querySelectorAll('#dbManagerPanel .db-group').forEach((el,gi)=>{const g=db.favorites[gi];g.title=el.querySelector('[data-gk="title"]').value.trim();g.collapsed=el.querySelector('[data-gk="collapsed"]').checked;el.querySelectorAll('.db-stock-row').forEach((row,si)=>{const s=g.stocks[si];s.symbol=row.querySelector('[data-sk="symbol"]').value.trim().toUpperCase();s.name=row.querySelector('[data-sk="name"]').value.trim();s.note=row.querySelector('[data-sk="note"]').value})})}
  async function saveTab(type){
    if(dbBusy)return;dbBusy=true;setDbStatus('Saving…','loading');
    try{if(type==='alerts'){syncRows('alerts');const d=await api('/api/data/alerts',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({items:db.alerts})});db.alerts=d.items||db.alerts}else if(type==='stuck'){syncRows('stuck');const d=await api('/api/data/stuck',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({items:db.stuck})});db.stuck=d.items||db.stuck}else{syncFavorites();const d=await api('/api/data/favorites',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({groups:db.favorites})});db.favorites=d.groups||db.favorites}setDbStatus('Saved to D1','ok');renderDb()}catch(e){setDbStatus('Save failed','bad');alert(e.message||'Unable to save')}finally{dbBusy=false}}

  document.addEventListener('DOMContentLoaded',async()=>{
    if(!await waitForAdmin())return;
    document.querySelectorAll('[data-db-tab]').forEach(b=>b.addEventListener('click',()=>{if(!dbBusy&&b.dataset.dbTab!==dbTab)loadTab(b.dataset.dbTab)}));
    try{await renderRestrictions();const c=await window.StockHeavenAuth.guestCredentials();$('guestUsername').value=c.username||'';$('guestPassword').value='';await renderLog();await loadTab('alerts');
      $('guestCredForm').onsubmit=async e=>{e.preventDefault();const u=$('guestUsername').value.trim(),p=$('guestPassword').value;if(u.length<3||p.length<4){$('guestCredNote').textContent='Username min 3 aur password min 4 characters.';return}try{await window.StockHeavenAuth.saveGuestCredentials(u,p);$('guestPassword').value='';$('guestCredNote').textContent='Guest login updated · '+new Date().toLocaleTimeString('en-IN')}catch(err){$('guestCredNote').textContent=err.message||'Unable to update.'}};
      $('clearLog').onclick=async()=>{if(confirm('Login activity clear karni hai?')){await window.StockHeavenAuth.clearLoginLog();await renderLog()}};
    }catch(err){$('guestCredNote').textContent=err.message||'Server setup required.'}
  });
})();
