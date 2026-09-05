const fallbackStocks = [
  ["RELIANCE", "Reliance Industries Limited"], ["TCS", "Tata Consultancy Services Limited"],
  ["HDFCBANK", "HDFC Bank Limited"], ["INFY", "Infosys Limited"], ["ICICIBANK", "ICICI Bank Limited"],
  ["SBIN", "State Bank of India"], ["ITC", "ITC Limited"], ["BHARTIARTL", "Bharti Airtel Limited"],
  ["TATAGOLD", "Tata Gold Exchange Traded Fund"], ["TATASILV.NS", "Tata Silver Exchange Traded Fund"],
  ["ENERGY.NS", "Mirae Asset Nifty Energy ETF"], ["CPSEETF", "CPSE Exchange Traded Fund"],
  ["NIFTYCASE.NS", "Zerodha Nifty 50 ETF"], ["FMCGIETF.NS", "ICICI Prudential Nifty FMCG ETF"],
  ["MIDCAPIETF.NS", "ICICI Prudential Nifty Midcap 150 ETF"], ["NEXT50IETF.NS", "ICICI Prudential Nifty Next 50 ETF"],
  ["KOTAKALPHA.NS", "Kotak Nifty Alpha 50 ETF"], ["ITBEES", "Nippon India ETF Nifty IT BeES"],
  ["HDFCNIFBAN.NS", "HDFC Nifty Bank ETF"], ["SMALLCAP.NS", "Mirae Asset Nifty Smallcap ETF"],
  ["BANKBEES", "Nippon India ETF Nifty Bank BeES"], ["GOLDBEES", "Nippon India ETF Gold BeES"],
  ["AWL", "Adani Wilmar Limited"], ["ADANIENSOL", "Adani Energy Solutions Limited"], ["ADANIGREEN", "Adani Green Energy Limited"],
  ["NSLNISP", "NMDC Steel"], ["TMPV", "Tata Motors Passenger Vehicles"]
];

let groups = [];
let modalMode = "add";
let editingGroupId = null;
let activeGroupId = null;
let searchTimer = null;
let searchRequest = 0;
const prices = {};

function uid(){ return "g" + Date.now().toString(36) + Math.random().toString(36).slice(2,7); }
function esc(v){ return String(v ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function symbolClean(v){ return String(v||"").trim().toUpperCase(); }
function displaySymbol(v){ return symbolClean(v).replace(/\.NS$/i,""); }
async function loadGroups(){
  try{ if(window.StockHeavenAuth?.ready) await window.StockHeavenAuth.ready; }catch(_){}
  const r=await fetch('/api/data/favorites',{credentials:'same-origin',cache:'no-store'}); const d=await r.json(); if(!r.ok) throw new Error(d.error||'Unable to load favorites'); groups=Array.isArray(d.groups)?d.groups:[];
}
let saveInProgress=false;
async function saveGroups(){
  if(saveInProgress) throw new Error('Another save is already in progress.');
  saveInProgress=true;
  try{
    const r=await fetch('/api/data/favorites',{method:'PUT',credentials:'same-origin',headers:{'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify({groups})});
    let d={};try{d=await r.json()}catch(_){}
    if(!r.ok) throw new Error(d.error||d.detail||`Unable to save favorites (${r.status})`);
    if(!Array.isArray(d.groups)) throw new Error('Server returned invalid favorite data.');
    groups=d.groups;
  }finally{saveInProgress=false}
}
function formatPrice(v){ return Number.isFinite(Number(v)) ? `₹${Number(v).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2})}` : "--"; }
function formatChange(v,p){
  if(!Number.isFinite(Number(v))) return "--";
  const n=Number(v), pct=Number(p);
  return `${n>=0?"+":""}${n.toFixed(2)}${Number.isFinite(pct)?` (${pct>=0?"+":""}${pct.toFixed(2)}%)`:""}`;
}
function initials(name){ return String(name||"ST").replace(/[^A-Za-z0-9 ]/g,"").split(" ").filter(Boolean).slice(0,2).map(x=>x[0]).join("").toUpperCase() || "ST"; }

function render(){
  const box=document.getElementById("favCards");
  document.getElementById("cardCount").textContent=`${groups.length} ${groups.length===1?"card":"cards"}`;
  if(!groups.length){
    box.innerHTML=`<div class="fav-empty"><div class="fav-empty-icon"><i class="fa-regular fa-star"></i></div><h3>No favourite cards yet</h3><p>Create a card such as <b>Focus ETF</b> or <b>Swing ETF</b>, then add your stocks inside it.</p><button type="button" onclick="openCardModal()"><i class="fa-solid fa-plus"></i> Create First Card</button></div>`;
    return;
  }
  box.innerHTML=groups.map(g=>{
    const collapsed=!!g.collapsed;
    const rows=(g.stocks||[]).map((s,idx)=>{
      const p=prices[s.symbol]||{};
      const ch=Number(p.change), pc=Number(p.percent_change);
      const cls=Number.isFinite(ch)&&ch<0?"down":"up";
      const note=String(s.note||"").trim();
      return `<div class="fav-stock-row" draggable="true" data-group-id="${esc(g.id)}" data-stock-index="${idx}" ondragstart="dragStock(event,'${g.id}',${idx})" ondragover="allowStockDrop(event)" ondrop="dropStock(event,'${g.id}',${idx})">
        <div class="fav-drag-handle" title="Drag to reorder"><i class="fa-solid fa-grip-vertical"></i></div>
        <div class="fav-stock-main"><div class="fav-logo">${esc(initials(s.name||s.symbol))}</div><div class="fav-stock-copy"><b>${esc(s.name||s.symbol)}</b><small>${esc(displaySymbol(s.symbol))}</small>${note?`<span class="fav-stock-note"><i class="fa-regular fa-note-sticky"></i> ${esc(note)}</span>`:""}</div></div>
        <div class="fav-stock-market"><strong>${formatPrice(p.price)}</strong><span class="${cls}">${formatChange(ch,pc)}</span></div>
        <div class="fav-stock-actions"><button class="fav-move-stock" type="button" title="Move up" ${idx===0?'disabled':''} onclick="event.stopPropagation();moveStock('${g.id}',${idx},-1)"><i class="fa-solid fa-chevron-up"></i></button><button class="fav-move-stock" type="button" title="Move down" ${(idx===(g.stocks||[]).length-1)?'disabled':''} onclick="event.stopPropagation();moveStock('${g.id}',${idx},1)"><i class="fa-solid fa-chevron-down"></i></button><button class="fav-note-stock" type="button" title="${note?"Edit note":"Add note"}" onclick="event.stopPropagation();editStockNote('${g.id}',${idx})"><i class="fa-regular fa-note-sticky"></i></button><button class="fav-remove-stock" type="button" title="Remove stock" onclick="event.stopPropagation();removeStock('${g.id}',${idx})"><i class="fa-solid fa-xmark"></i></button></div>
      </div>`;
    }).join("");
    return `<article class="fav-card ${collapsed?"is-collapsed":""}">
      <div class="fav-card-head"><div class="fav-card-title" onclick="toggleCard('${g.id}')" title="${collapsed?"Expand":"Collapse"} card"><div class="fav-card-star"><i class="fa-solid fa-star"></i></div><div><h3>${esc(g.title)}</h3><span>${(g.stocks||[]).length} ${(g.stocks||[]).length===1?"stock":"stocks"}</span></div></div>
      <div class="fav-card-actions"><button type="button" title="${collapsed?"Expand":"Collapse"} card" onclick="toggleCard('${g.id}')"><i class="fa-solid fa-chevron-${collapsed?"down":"up"}"></i></button><button type="button" title="Edit title" onclick="openEditCard('${g.id}')"><i class="fa-solid fa-pen"></i></button><button type="button" title="Delete card" onclick="deleteCard('${g.id}')"><i class="fa-solid fa-trash"></i></button></div></div>
      <div class="fav-card-body"><div class="fav-stock-list">${rows || `<div class="fav-card-empty"><i class="fa-regular fa-star"></i><span>No stocks added yet</span></div>`}</div>
      <button class="fav-add-stock" type="button" onclick="openStockModal('${g.id}')"><i class="fa-solid fa-plus"></i> Add Stock</button></div>
    </article>`;
  }).join("");
}

function openCardModal(){if(!window.requireAdmin())return;
  modalMode="add"; editingGroupId=null;
  document.getElementById("modalTitle").textContent="Add Card";
  document.getElementById("cardTitleInput").value="";
  showModal("cardModal");
  setTimeout(()=>document.getElementById("cardTitleInput").focus(),50);
}
function openEditCard(id){if(!window.requireAdmin())return;
  const g=groups.find(x=>String(x.id)===String(id)); if(!g)return;
  modalMode="edit"; editingGroupId=id;
  document.getElementById("modalTitle").textContent="Edit Card";
  document.getElementById("cardTitleInput").value=g.title;
  showModal("cardModal"); setTimeout(()=>{const x=document.getElementById("cardTitleInput");x.focus();x.select();},50);
}
function saveCard(){if(!window.requireAdmin())return;
  const title=document.getElementById("cardTitleInput").value.trim();
  if(!title){ alert("Card title enter karo"); return; }
  if(modalMode==="edit") { const g=groups.find(x=>String(x.id)===String(editingGroupId)); if(g)g.title=title; }
  else groups.push({id:null,title,stocks:[]});
  saveGroups().then(()=>{closeCardModal();render();}).catch(e=>alert(e.message||"Save failed"));
}
function deleteCard(id){if(!window.requireAdmin())return;
  const g=groups.find(x=>String(x.id)===String(id)); if(!g)return;
  if(!confirm(`"${g.title}" card delete karna hai?`))return;
  groups=groups.filter(x=>String(x.id)!==String(id)); saveGroups().then(render).catch(e=>alert(e.message||"Delete failed"));
}
function cardTitleKey(e){ if(e.key==="Enter"){e.preventDefault();saveCard();} if(e.key==="Escape")closeCardModal(); }
function showModal(id){const x=document.getElementById(id);x.classList.add("open");x.setAttribute("aria-hidden","false");}
function hideModal(id){const x=document.getElementById(id);x.classList.remove("open");x.setAttribute("aria-hidden","true");}
function closeCardModal(){hideModal("cardModal");}

function openStockModal(groupId){if(!window.requireAdmin())return;
  activeGroupId=groupId; const g=groups.find(x=>String(x.id)===String(groupId)); if(!g)return;
  document.getElementById("stockModalSubtitle").textContent=`Add a stock to ${g.title}`;
  document.getElementById("favStockInput").value="";
  document.getElementById("favSuggestions").innerHTML="";
  showModal("stockModal"); setTimeout(()=>document.getElementById("favStockInput").focus(),50);
}
function closeStockModal(){hideModal("stockModal"); activeGroupId=null;}
async function searchRemote(q){
  try{ const r=await fetch(`/api/search?q=${encodeURIComponent(q)}`, {credentials:'same-origin',cache:'no-store'}); const d=await r.json(); if(r.ok&&!d.error&&Array.isArray(d.results))return d.results; }catch(e){}
  const u=q.toUpperCase(); return fallbackStocks.filter(s=>s[0].includes(u)||s[1].toUpperCase().includes(u)).map(s=>({symbol:s[0],name:s[1]})).slice(0,10);
}
function renderSuggestions(list){
  const box=document.getElementById("favSuggestions");
  if(!list.length){box.innerHTML=`<div class="fav-suggestion-empty"><i class="fa-solid fa-magnifying-glass"></i><div><b>No stock found</b><span>Use the symbol below to add it manually.</span></div></div>`;return;}
  box.innerHTML=list.slice(0,10).map((s,i)=>`<button class="fav-suggestion" type="button" data-suggestion-index="${i}"><span class="fav-suggestion-logo"><i class="fa-solid fa-chart-line"></i></span><span><b>${esc(s.name||s.symbol)}</b><small>NSE · ${esc(displaySymbol(s.symbol))}</small></span><i class="fa-solid fa-plus"></i></button>`).join("");
  box.querySelectorAll('[data-suggestion-index]').forEach(btn=>btn.addEventListener('click',()=>{
    const item=list[Number(btn.dataset.suggestionIndex)];
    if(item) addStock(item.symbol,item.name||item.symbol);
  }));
}
function searchFavStocks(){
  const q=document.getElementById("favStockInput").value.trim(); const box=document.getElementById("favSuggestions");
  clearTimeout(searchTimer); if(!q){box.innerHTML="";return;}
  const id=++searchRequest; box.innerHTML=`<div class="fav-searching"><i class="fa-solid fa-spinner fa-spin"></i> Searching stocks…</div>`;
  searchTimer=setTimeout(async()=>{const list=await searchRemote(q); if(id===searchRequest)renderSuggestions(list);},220);
}
function favStockKey(e){
  if(e.key==="Escape"){e.preventDefault();closeStockModal();return;}
  if(e.key==="Enter"){
    e.preventDefault();
    const first=document.querySelector(".fav-suggestion");
    if(first) first.click(); else addManualStock();
  }
}
async function addStock(symbol,name){
  if(!window.requireAdmin())return;
  const g=groups.find(x=>String(x.id)===String(activeGroupId)); if(!g)return;
  const clean=symbolClean(symbol); if(!clean){alert("Stock symbol enter karo");return;}
  if((g.stocks||[]).some(s=>symbolClean(s.symbol)===clean)){alert("Ye stock is card me already added hai");return;}
  const btn=document.querySelector('#stockModal .fav-btn.primary');
  if(btn){btn.disabled=true;btn.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Saving…';}
  g.stocks=g.stocks||[];
  const old=g.stocks.slice();
  g.stocks.push({id:null,symbol:clean,name:String(name||clean).trim()||clean,note:""});
  try{
    await saveGroups();
    closeStockModal();render();fetchPrice(clean);
  }catch(e){
    g.stocks=old; render(); alert(e.message||"Stock save failed. Please try again.");
  }finally{
    if(btn){btn.disabled=false;btn.innerHTML='<i class="fa-solid fa-check"></i> Add Stock';}
  }
}
function addManualStock(){
  if(!window.requireAdmin())return;
  const q=symbolClean(document.getElementById("favStockInput").value);
  if(!q){alert("Stock symbol enter karo");return;}
  addStock(q,q);
}

async function moveStock(groupId,index,direction){
  if(!window.requireAdmin())return;
  const g=groups.find(x=>String(x.id)===String(groupId));
  if(!g||!Array.isArray(g.stocks))return;
  const to=index+direction;
  if(index<0||to<0||to>=g.stocks.length)return;
  const copy=g.stocks.slice();
  [copy[index],copy[to]]=[copy[to],copy[index]];
  g.stocks=copy;
  try{await saveGroups();render();}catch(e){alert(e.message||"Reorder failed");await loadGroups().catch(()=>{});render();}
}
function removeStock(groupId,index){if(!window.requireAdmin())return; const g=groups.find(x=>String(x.id)===String(groupId)); if(!g)return; g.stocks.splice(index,1); saveGroups().then(render).catch(e=>alert(e.message||"Delete failed")); }
async function fetchPrice(symbol, force=false){
  if(!force && prices[symbol]) return;
  try{const r=await fetch(`/api/stock?symbol=${encodeURIComponent(symbol)}&t=${Date.now()}`, {cache:"no-store"}); const d=await r.json(); if(r.ok&&!d.error){prices[symbol]={price:Number(d.price),change:Number(d.change),percent_change:Number(d.percent_change),as_of:d.as_of||null}; render();}}catch(e){}
}
async function refreshPrices(){
  const symbols=[...new Set(groups.flatMap(g=>(g.stocks||[]).map(s=>s.symbol)))];
  await Promise.all(symbols.map(s=>fetchPrice(s,true)));
}
let draggedStock=null;
function dragStock(event,groupId,index){if(!window.requireAdmin())return; draggedStock={groupId,index}; event.dataTransfer.effectAllowed="move"; event.dataTransfer.setData("text/plain", `${groupId}:${index}`); event.currentTarget.classList.add("dragging"); }
function allowStockDrop(event){ event.preventDefault(); event.dataTransfer.dropEffect="move"; }
function dropStock(event,groupId,targetIndex){if(!window.requireAdmin())return;
  event.preventDefault();
  if(!draggedStock || String(draggedStock.groupId)!==String(groupId)) return;
  const g=groups.find(x=>String(x.id)===String(groupId)); if(!g) return;
  const from=draggedStock.index; if(from===targetIndex) return;
  const [item]=g.stocks.splice(from,1);
  g.stocks.splice(from<targetIndex?targetIndex-1:targetIndex,0,item);
  draggedStock=null; saveGroups().then(render).catch(e=>alert(e.message||"Reorder failed"));
}
document.addEventListener("dragend",()=>{document.querySelectorAll(".fav-stock-row.dragging").forEach(x=>x.classList.remove("dragging")); draggedStock=null;});
function toggleCard(id){ const g=groups.find(x=>String(x.id)===String(id)); if(!g)return; g.collapsed=!g.collapsed; saveGroups().then(render).catch(e=>alert(e.message||"Save failed")); }
function editStockNote(groupId,index){if(!window.requireAdmin())return;
  const g=groups.find(x=>String(x.id)===String(groupId)); if(!g||!g.stocks[index])return;
  const current=String(g.stocks[index].note||"");
  const note=prompt("Stock note enter kijiye (blank chhodne par note remove ho jayega):", current);
  if(note===null)return;
  g.stocks[index].note=note.trim(); saveGroups().then(render).catch(e=>alert(e.message||"Save failed"));
}
document.addEventListener("DOMContentLoaded",async()=>{ try{if(window.StockHeavenAuth?.ready) await window.StockHeavenAuth.ready; await loadGroups();render();await refreshPrices();}catch(e){console.error(e);const box=document.getElementById("favCards");if(box)box.innerHTML=`<div class="fav-empty"><div class="fav-empty-icon"><i class="fa-solid fa-triangle-exclamation"></i></div><h3>Favourite data load nahi ho paya</h3><p>${esc(e.message||"Server se data nahi mil raha.")}</p><button type="button" onclick="location.reload()"><i class="fa-solid fa-rotate-right"></i> Retry</button></div>`;} });
setInterval(refreshPrices,60000);
