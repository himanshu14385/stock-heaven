(function(){
  const currentFile=(location.pathname.split('/').pop()||'index.html').toLowerCase();
  const pages={'index.html':'Dashboard','stuck-stock.html':'Stuck Stock','summary.html':'Summary','alert.html':'Alert','fav-stock.html':'Fav Stock'};
  let currentSession=null, sessionTimer=null, booted=false;
  let readyResolve;
  const ready=new Promise(resolve=>{readyResolve=resolve});

  async function api(path, options={}){
    const opts={credentials:'same-origin',cache:'no-store',...options,headers:{'Content-Type':'application/json',...(options.headers||{})}};
    const r=await fetch(path,opts); let data=null; try{data=await r.json()}catch(_){}
    if(!r.ok){const e=new Error(data?.error||`Request failed (${r.status})`);e.status=r.status;e.data=data;throw e;}
    return data;
  }
  async function getSession(){
    try{const data=await api('/api/auth/me',{headers:{}});currentSession=data.session||null;return currentSession}
    catch(e){if(e.status===401){currentSession=null;return null}throw e}
  }
  function role(){return currentSession?.role||null}
  function isAdmin(){return role()==='admin'}
  function isGuest(){return role()==='guest'}
  async function logout(){try{await api('/api/auth/logout',{method:'POST',body:'{}'})}catch(_){} location.replace('/login.html')}
  let activityInFlight=false, lastActivitySent=0;
  async function recordActivity(){
    if(!isGuest()||activityInFlight)return;
    const now=Date.now();
    if(now-lastActivitySent<30000)return;
    lastActivitySent=now; activityInFlight=true;
    try{
      const data=await api('/api/auth/activity',{method:'POST',body:'{}'});
      if(data?.expiresAt&&currentSession){currentSession.expiresAt=data.expiresAt;startGuestTimer();}
    }catch(e){if(e.status===401){currentSession=null;location.replace('/login.html')}}
    finally{activityInFlight=false;}
  }
  function setupActivityTracking(){
    if(!isGuest())return;
    const events=['click','keydown','scroll','touchstart','pointerdown','mousemove'];
    const onActivity=()=>recordActivity();
    events.forEach(ev=>window.addEventListener(ev,onActivity,{passive:true}));
  }
  async function loginAdmin(user,pass){return api('/api/auth/login',{method:'POST',body:JSON.stringify({role:'admin',username:user,password:pass})})}
  async function loginGuest(user,pass){return api('/api/auth/login',{method:'POST',body:JSON.stringify({role:'guest',username:user,password:pass})})}
  async function guestCredentials(){return api('/api/admin/guest-credentials')}
  async function saveGuestCredentials(username,password){return api('/api/admin/guest-credentials',{method:'POST',body:JSON.stringify({username,password})})}
  async function getLoginLog(){const d=await api('/api/admin/login-log');return d.logs||[]}
  async function clearLoginLog(){return api('/api/admin/login-log',{method:'DELETE',body:'{}'})}
  async function getRestrictions(){const d=await api('/api/auth/restrictions');return d.restrictions||{}}
  async function saveRestrictions(r){return api('/api/admin/restrictions',{method:'POST',body:JSON.stringify({restrictions:r||{}})})}
  function requireAdmin(){if(!isAdmin()){alert('Sirf Admin is action ko use kar sakta hai.');return false}return true}

  window.requireAdmin=requireAdmin;
  window.StockHeavenAuth={session:()=>currentSession,role,isAdmin,isGuest,logout,loginAdmin,loginGuest,guestCredentials,saveGuestCredentials,getLoginLog,clearLoginLog,restrictions:getRestrictions,saveRestrictions,ready,isPageAllowedForGuest:async file=>{const r=await getRestrictions();return !r[file]}};

  function injectTopbar(){
    const header=document.querySelector('.top-header'); if(!header||document.querySelector('.auth-topbar')||!currentSession)return;
    const box=document.createElement('div');box.className='auth-topbar';
    const badge=document.createElement('span');badge.className='auth-user-badge';badge.textContent=(currentSession.role==='admin'?'Admin':'Guest')+' · '+currentSession.username;box.append(badge);
    if(currentSession.role==='admin'){const a=document.createElement('a');a.className='auth-admin-link';a.href='admin.html';a.innerHTML='<i class="fa-solid fa-shield-halved"></i> Admin';box.append(a)}
    else{const timer=document.createElement('span');timer.className='auth-user-badge';timer.id='guestSessionTimer';box.append(timer)}
    const out=document.createElement('button');out.className='auth-logout';out.type='button';out.textContent='Logout';out.onclick=logout;box.append(out);header.append(box);
  }
  function startGuestTimer(){
    if(!isGuest()||!currentSession.expiresAt)return; const expiry=new Date(currentSession.expiresAt).getTime();
    if(sessionTimer)clearInterval(sessionTimer);
    const tick=()=>{const el=document.getElementById('guestSessionTimer'),left=Math.max(0,expiry-Date.now());if(el)el.textContent='Logout in '+Math.ceil(left/1000)+'s';if(left<=0){clearInterval(sessionTimer);sessionTimer=null;logout()}};
    tick();sessionTimer=setInterval(tick,1000);
  }
  function showAuthError(message){document.documentElement.style.visibility='visible';document.body.innerHTML='<div class="auth-page-lock"><div class="auth-page-lock-card"><i class="fa-solid fa-triangle-exclamation"></i><h2>Authentication Error</h2><p>'+String(message).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))+'</p><button onclick="location.reload()">Retry</button></div></div>'}
  function lockPage(message='Page Restricted'){document.documentElement.style.visibility='hidden';window.addEventListener('DOMContentLoaded',()=>{document.documentElement.style.visibility='visible';document.body.innerHTML='<div class="auth-page-lock"><div class="auth-page-lock-card"><i class="fa-solid fa-lock"></i><h2>'+message+'</h2><p>Admin ne is page ko Guest ke liye restrict kiya hai.</p><a href="index.html">Back to Dashboard</a></div></div>'},{once:true})}
  function disableGuestEditing(){
    if(!isGuest())return;
    const selectors=['.stuck-edit','.stuck-delete','.stuck-save','.stuck-cancel','.alert-input','.action-edit','.action-delete','.action-save','.action-cancel','.fav-note-stock','.fav-remove-stock','.fav-card-actions button:not(:first-child)','.fav-add-stock','[data-admin-only]'];
    const apply=()=>{selectors.forEach(sel=>document.querySelectorAll(sel).forEach(el=>{el.disabled=true;el.classList.add('guest-edit-disabled');el.setAttribute('aria-disabled','true');el.onclick=e=>{e.preventDefault();e.stopPropagation();alert('Guest mode mein editing allowed nahi hai.');return false}}));document.querySelectorAll('[draggable="true"]').forEach(el=>{el.setAttribute('draggable','false');el.classList.add('guest-edit-disabled')})};
    apply(); if(document.body)new MutationObserver(apply).observe(document.body,{childList:true,subtree:true});
  }

  async function protect(){
    if(currentFile==='login.html'){readyResolve(null);return}
    try{
      const s=await getSession();
      if(!s){readyResolve(null);location.replace('/login.html');return}
      if(currentFile==='admin.html'&&s.role!=='admin'){readyResolve(s);lockPage('Admin Only');return}
      if(s.role==='guest'&&pages[currentFile]){const restrictions=await getRestrictions();if(restrictions[currentFile]){readyResolve(s);lockPage();return}}
      readyResolve(s);
      const boot=()=>{injectTopbar();disableGuestEditing()};
      if(document.readyState==='loading')window.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
      startGuestTimer();
      setupActivityTracking();
    }catch(e){readyResolve(null);showAuthError('Server authentication service se response nahi mil raha. Page ko refresh karke dobara try karein.')}
  }
  protect();

  if(currentFile==='login.html'){
    window.addEventListener('DOMContentLoaded',async()=>{
      if(booted)return;booted=true;
      const adminTab=document.getElementById('adminTab'),guestTab=document.getElementById('guestTab'),adminForm=document.getElementById('adminForm'),guestForm=document.getElementById('guestForm'),err=document.getElementById('authError');
      function show(which){adminTab.classList.toggle('active',which==='admin');guestTab.classList.toggle('active',which==='guest');adminForm.hidden=which!=='admin';guestForm.hidden=which!=='guest';err.textContent=''}
      adminTab.onclick=()=>show('admin');guestTab.onclick=()=>show('guest');
      adminForm.onsubmit=async e=>{e.preventDefault();err.textContent='Checking...';try{await loginAdmin(document.getElementById('adminUser').value.trim(),document.getElementById('adminPass').value);location.replace('/index.html')}catch(x){err.textContent=x.status===401?'Invalid Admin username ya password.':'Server error. Dobara try karein.'}};
      guestForm.onsubmit=async e=>{e.preventDefault();err.textContent='Checking...';try{await loginGuest(document.getElementById('guestUser').value.trim(),document.getElementById('guestPass').value);location.replace('/index.html')}catch(x){err.textContent=x.status===401?'Invalid Guest username ya password.':'Server error. Dobara try karein.'}};
    },{once:true});
  }
})();
