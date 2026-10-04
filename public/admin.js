(function(){
  const pages=[['index.html','Dashboard','Main stock analysis'],['stuck-stock.html','Stuck Stock','Saved stuck-stock positions'],['summary.html','Summary','Stock summary and comparison'],['alert.html','Alert','Price alert list'],['fav-stock.html','Fav Stock','Favourite stock cards'],['movement-catch.html','Catch','Technical breakout setup scanner'],['crypto.html','Crypto','CoinDCX INR live prices']];
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  async function waitForAdmin(){try{const s=await window.StockHeavenAuth.ready;if(s?.role==='admin')return true}catch(_){}return !!window.StockHeavenAuth?.isAdmin?.()}
  async function renderRestrictions(){
    const r=await window.StockHeavenAuth.restrictions();
    $('restrictionList').innerHTML=pages.map(([file,name,sub])=>`<div class="restrict-row"><div><div class="restrict-name">${name}</div><div class="restrict-sub">${sub}</div></div><label class="switch"><input type="checkbox" data-page="${file}" ${r[file]?'checked':''}><span class="slider"></span></label></div>`).join('');
    document.querySelectorAll('[data-page]').forEach(x=>x.addEventListener('change',async()=>{x.disabled=true;try{const next=await window.StockHeavenAuth.restrictions();next[x.dataset.page]=x.checked;await window.StockHeavenAuth.saveRestrictions(next);$('saveNote').textContent='Saved · '+new Date().toLocaleTimeString('en-IN')}catch(e){x.checked=!x.checked;$('saveNote').textContent=e.message||'Unable to save'}finally{x.disabled=false}}));
  }
  async function renderLog(){
    const logs=await window.StockHeavenAuth.getLoginLog(),box=$('loginLog');
    if(!logs.length){box.innerHTML='<div class="empty-log"><i class="fa-regular fa-clock"></i><b>No login activity</b><span>Successful Admin aur Guest logins yahan appear honge.</span></div>';return}
    box.innerHTML=`<div class="login-table-wrap"><table class="login-table"><thead><tr><th>Role</th><th>User</th><th>Login Date & Time</th></tr></thead><tbody>${logs.map(x=>{const d=new Date(x.loginAt);return `<tr><td><span class="role-pill ${x.role==='guest'?'guest':''}">${esc(x.role)}</span></td><td><b>${esc(x.username)}</b></td><td>${d.toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'medium'})}</td></tr>`}).join('')}</tbody></table></div>`;
  }
  async function loadGuestUsers(){
    const box=$('guestUsersList');box.innerHTML='<div class="guest-users-loading"><i class="fa-solid fa-spinner fa-spin"></i> Loading guest users…</div>';
    try{
      const data=await window.StockHeavenAuth.guestUsers();const users=data.users||[];
      if(!users.length){box.innerHTML='<div class="guest-users-empty"><i class="fa-regular fa-user"></i><span>Abhi koi guest user nahi hai.</span></div>';return}
      box.innerHTML=`<div class="guest-users-table-wrap"><table class="guest-users-table"><thead><tr><th>#</th><th>Username</th><th>Created</th><th>Action</th></tr></thead><tbody>${users.map((u,i)=>`<tr><td>${i+1}</td><td><b>${esc(u.username)}</b></td><td>${u.createdAt?new Date(u.createdAt).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}):'—'}</td><td><button class="guest-password-btn" type="button" data-guest-password="${Number(u.id)}" data-guest-name="${esc(u.username)}" aria-label="Edit password for ${esc(u.username)}"><i class="fa-solid fa-key"></i><span>Edit Password</span></button> <button class="guest-delete-btn" type="button" data-guest-delete="${Number(u.id)}" data-guest-name="${esc(u.username)}" aria-label="Delete ${esc(u.username)}"><i class="fa-solid fa-trash-can"></i><span>Delete</span></button></td></tr>`).join('')}</tbody></table></div>`;
      box.querySelectorAll('[data-guest-password]').forEach(btn=>btn.addEventListener('click',async()=>{
        const id=Number(btn.dataset.guestPassword),name=btn.dataset.guestName;
        const password=prompt(`${name} ke liye naya password enter karein:`);
        if(password===null)return;
        if(!password){$('guestUserNote').textContent='Password blank nahi ho sakta.';return}
        btn.disabled=true;try{await window.StockHeavenAuth.updateGuestPassword(id,password);$('guestUserNote').textContent=`${name} ka password update ho gaya.`}
        catch(e){$('guestUserNote').textContent=e.message||'Password update nahi hua.'}
        finally{btn.disabled=false}
      }));
      box.querySelectorAll('[data-guest-delete]').forEach(btn=>btn.addEventListener('click',async()=>{
        const id=Number(btn.dataset.guestDelete),name=btn.dataset.guestName;
        if(!Number.isInteger(id)||id<1||!confirm(`Guest user “${name}” ko delete karna hai?`))return;
        btn.disabled=true;try{await window.StockHeavenAuth.deleteGuestUser(id);$('guestUserNote').textContent=`${name} deleted`;await loadGuestUsers()}catch(e){$('guestUserNote').textContent=e.message||'Unable to delete user';btn.disabled=false}
      }));
    }catch(e){box.innerHTML=`<div class="guest-users-error">${esc(e.message||'Guest users load nahi ho paaye.')}</div>`}
  }
  document.addEventListener('DOMContentLoaded',async()=>{
    if(!await waitForAdmin())return;
    try{
      await renderRestrictions();await renderLog();await loadGuestUsers();
      $('guestUserForm').onsubmit=async e=>{
        e.preventDefault();const username=$('guestUsername').value.trim(),password=$('guestPassword').value,note=$('guestUserNote'),submit=e.submitter||$('guestUserForm').querySelector('[type="submit"]');
        if(username.length<3||!password){note.textContent='Username kam se kam 3 characters aur password required hai.';return}
        submit.disabled=true;note.textContent='Creating…';
        try{await window.StockHeavenAuth.createGuestUser(username,password);$('guestPassword').value='';note.textContent='Guest user created';await loadGuestUsers()}
        catch(err){note.textContent=err.message||'Unable to create guest user.'}
        finally{submit.disabled=false}
      };
      $('clearLog').onclick=async()=>{if(confirm('Login activity clear karni hai?')){await window.StockHeavenAuth.clearLoginLog();await renderLog()}};
    }catch(err){$('guestUserNote').textContent=err.message||'Server setup required.'}
  });
})();
