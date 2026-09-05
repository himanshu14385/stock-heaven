(function(){
  const GUEST_MS=5*60*1000;
  const currentFile=(location.pathname.split('/').pop()||'index.html').toLowerCase();
  const pages={'index.html':'Dashboard','stuck-stock.html':'Stuck Stock','summary.html':'Summary','alert.html':'Alert','fav-stock.html':'Fav Stock'};
  let currentSession=null;

  async function api(path, options={}){
    const opts={credentials:'same-origin',cache:'no-store',...options,headers:{'Content-Type':'application/json',...(options.headers||{})}};
    const r=await fetch(path,opts);
    let data=null; try{data=await r.json()}catch(_){}
    if(!r.ok){const e=new Error(data?.error||'Request failed');e.status=r.status;e.data=data;throw e;}
    return data;
  }
  async function getSession(){
    try{const data=await api('/api/auth/me',{headers:{}});currentSession=data.session||null;return currentSession}catch(_){currentSession=null;return null}
  }
  function role(){return currentSession?.role||null}
  function isAdmin(){return role()==='admin'}
  function isGuest(){return role()==='guest'}
  function logout(){api('/api/auth/logout',{method:'POST',body:'{}'}).catch(()=>{}).finally(()=>location.href='login.html')}
  async function loginAdmin(user,pass){return api('/api/auth/login',{method:'POST',body:JSON.stringify({role:'admin',username:user,password:pass})})}
  async function loginGuest(user,pass){return api('/api/auth/login',{method:'POST',body:JSON.stringify({role:'guest',username:user,password:pass})})}
  async function guestCredentials(){return api('/api/admin/guest-credentials')}
  async function saveGuestCredentials(username,password){return api('/api/admin/guest-credentials',{method:'POST',body:JSON.stringify({username,password})})}
  async function getLoginLog(){const d=await api('/api/admin/login-log');return d.logs||[]}
  async function clearLoginLog(){return api('/api/admin/login-log',{method:'DELETE',body:'{}'})}
  async function getRestrictions(){const d=await api('/api/admin/restrictions');return d.restrictions||{}}
  async function saveRestrictions(r){return api('/api/admin/restrictions',{method:'POST',body:JSON.stringify({restrictions:r||{}})})}
  function requireAdmin(){if(!isAdmin()){alert('Sirf Admin is action ko use kar sakta hai.');return false}return true}

  window.requireAdmin=requireAdmin;
  window.StockHeavenAuth={session:()=>currentSession,role,isAdmin,isGuest,logout,loginAdmin,loginGuest,guestCredentials,saveGuestCredentials,getLoginLog,clearLoginLog,restrictions:getRestrictions,saveRestrictions,isPageAllowedForGuest:async file=>{try{const r=await getRestrictions();return !r[file]}catch(_){return false}}};

  function injectTopbar(){
    const header=document.querySelector('.top-header');if(!header||document.querySelector('.auth-topbar')||!currentSession)return;
    const box=document.createElement('div');box.className='auth-topbar';
    const badge=document.createElement('span');badge.className='auth-user-badge';badge.textContent=(currentSession.role==='admin'?'Admin':'Guest')+' · '+currentSession.username;box.append(badge);
    if(currentSession.role==='admin'){const a=document.createElement('a');a.className='auth-admin-link';a.href='admin.html';a.innerHTML='<i class="fa-solid fa-shield-halved"></i> Admin';box.append(a)}
    else {const timer=document.createElement('span');timer.className='auth-user-badge';timer.id='guestSessionTimer';box.append(timer)}
    const out=document.createElement('button');out.className='auth-logout';out.type='button';out.textContent='Logout';out.onclick=logout;box.append(out);header.append(box);
  }
  function startGuestTimer(){
    if(!isGuest())return;
    const expiry=new Date(currentSession.expiresAt).getTime();
    const tick=()=>{const el=document.getElementById('guestSessionTimer');const left=Math.max(0,expiry-Date.now());if(el)el.textContent='Logout in '+Math.ceil(left/1000)+'s';if(left<=0){clearInterval(timer);logout()}};
    tick();const timer=setInterval(tick,1000);
  }
  function lockPage(message='Page Restricted'){
    document.documentElement.style.visibility='hidden';
    window.addEventListener('DOMContentLoaded',()=>{document.documentElement.style.visibility='visible';document.body.innerHTML='<div class="auth-page-lock"><div class="auth-page-lock-card"><i class="fa-solid fa-lock"></i><h2>'+message+'</h2><p>Admin ne is page ko Guest ke liye restrict kiya hai.</p><a href="index.html">Back to Dashboard</a></div></div>';});
  }
  function disableGuestEditing(){
    if(!isGuest())return;
    const selectors=['.stuck-edit','.stuck-delete','.stuck-save','.stuck-cancel','.alert-input','.action-edit','.action-delete','.action-save','.action-cancel','.fav-note-stock','.fav-remove-stock','.fav-card-actions button:not(:first-child)','.fav-add-stock','[data-admin-only]'];
    const apply=()=>selectors.forEach(sel=>document.querySelectorAll(sel).forEach(el=>{el.disabled=true;el.classList.add('guest-edit-disabled');el.setAttribute('aria-disabled','true');el.onclick=(e)=>{e.preventDefault();e.stopPropagation();alert('Guest mode mein editing allowed nahi hai.');return false;};}));
    apply();new MutationObserver(apply).observe(document.body,{childList:true,subtree:true});document.querySelectorAll('[draggable="true"]').forEach(el=>{el.setAttribute('draggable','false');el.classList.add('guest-edit-disabled')});
  }

  async function protect(){
    if(currentFile==='login.html')return;
    const s=await getSession();
    if(!s){location.replace('login.html');return}
    if(currentFile==='admin.html'&&s.role!=='admin'){lockPage('Admin Only');return}
    if(s.role==='guest'&&pages[currentFile]){
      try{const restrictions=await getRestrictions();if(restrictions[currentFile]){lockPage();return}}catch(_){/* server page protection remains authoritative */}
    }
    window.addEventListener('DOMContentLoaded',()=>{injectTopbar();disableGuestEditing()});
    startGuestTimer();
  }
  protect();

  if(currentFile==='login.html'){
    window.addEventListener('DOMContentLoaded',async()=>{
      const existing=await getSession();if(existing){location.replace('index.html');return}
      const adminTab=document.getElementById('adminTab'),guestTab=document.getElementById('guestTab'),adminForm=document.getElementById('adminForm'),guestForm=document.getElementById('guestForm'),err=document.getElementById('authError');
      function show(which){adminTab.classList.toggle('active',which==='admin');guestTab.classList.toggle('active',which==='guest');adminForm.hidden=which!=='admin';guestForm.hidden=which!=='guest';err.textContent=''}
      adminTab.onclick=()=>show('admin');guestTab.onclick=()=>show('guest');
      adminForm.onsubmit=async e=>{e.preventDefault();err.textContent='Checking...';try{await loginAdmin(document.getElementById('adminUser').value.trim(),document.getElementById('adminPass').value);location.replace('index.html')}catch(_){err.textContent='Invalid Admin username ya password.'}};
      guestForm.onsubmit=async e=>{e.preventDefault();err.textContent='Checking...';try{await loginGuest(document.getElementById('guestUser').value.trim(),document.getElementById('guestPass').value);location.replace('index.html')}catch(_){err.textContent='Invalid Guest username ya password.'}};
    });
  }
})();
