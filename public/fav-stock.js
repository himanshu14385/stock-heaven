const FAV_STORAGE_KEY = "stockHeavenFavoriteGroups";
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

let groups = loadGroups();
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
function loadGroups(){
  try { const x=JSON.parse(localStorage.getItem(FAV_STORAGE_KEY)); if(Array.isArray(x)) return x; } catch(e){}
  return [];
}
function saveGroups(){ localStorage.setItem(FAV_STORAGE_KEY, JSON.stringify(groups)); }
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
        <div class="fav-stock-actions"><button class="fav-note-stock" type="button" title="${note?"Edit note":"Add note"}" onclick="event.stopPropagation();editStockNote('${g.id}',${idx})"><i class="fa-regular fa-note-sticky"></i></button><button class="fav-remove-stock" type="button" title="Remove stock" onclick="event.stopPropagation();removeStock('${g.id}',${idx})"><i class="fa-solid fa-xmark"></i></button></div>
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

function openCardModal(){
  modalMode="add"; editingGroupId=null;
  document.getElementById("modalTitle").textContent="Add Card";
  document.getElementById("cardTitleInput").value="";
  showModal("cardModal");
  setTimeout(()=>document.getElementById("cardTitleInput").focus(),50);
}
function openEditCard(id){
  const g=groups.find(x=>x.id===id); if(!g)return;
  modalMode="edit"; editingGroupId=id;
  document.getElementById("modalTitle").textContent="Edit Card";
  document.getElementById("cardTitleInput").value=g.title;
  showModal("cardModal"); setTimeout(()=>{const x=document.getElementById("cardTitleInput");x.focus();x.select();},50);
}
function saveCard(){
  const title=document.getElementById("cardTitleInput").value.trim();
  if(!title){ alert("Card title enter karo"); return; }
  if(modalMode==="edit") { const g=groups.find(x=>x.id===editingGroupId); if(g)g.title=title; }
  else groups.push({id:uid(),title,stocks:[]});
  saveGroups(); closeCardModal(); render();
}
function deleteCard(id){
  const g=groups.find(x=>x.id===id); if(!g)return;
  if(!confirm(`"${g.title}" card delete karna hai?`))return;
  groups=groups.filter(x=>x.id!==id); saveGroups(); render();
}
function cardTitleKey(e){ if(e.key==="Enter"){e.preventDefault();saveCard();} if(e.key==="Escape")closeCardModal(); }
function showModal(id){const x=document.getElementById(id);x.classList.add("open");x.setAttribute("aria-hidden","false");}
function hideModal(id){const x=document.getElementById(id);x.classList.remove("open");x.setAttribute("aria-hidden","true");}
function closeCardModal(){hideModal("cardModal");}

function openStockModal(groupId){
  activeGroupId=groupId; const g=groups.find(x=>x.id===groupId); if(!g)return;
  document.getElementById("stockModalSubtitle").textContent=`Add a stock to ${g.title}`;
  document.getElementById("favStockInput").value="";
  document.getElementById("favSuggestions").innerHTML="";
  showModal("stockModal"); setTimeout(()=>document.getElementById("favStockInput").focus(),50);
}
function closeStockModal(){hideModal("stockModal"); activeGroupId=null;}
async function searchRemote(q){
  try{ const r=await fetch(`/api/search?q=${encodeURIComponent(q)}`); const d=await r.json(); if(r.ok&&!d.error&&Array.isArray(d.results))return d.results; }catch(e){}
  const u=q.toUpperCase(); return fallbackStocks.filter(s=>s[0].includes(u)||s[1].toUpperCase().includes(u)).map(s=>({symbol:s[0],name:s[1]})).slice(0,10);
}
function renderSuggestions(list){
  const box=document.getElementById("favSuggestions");
  if(!list.length){box.innerHTML=`<div class="fav-suggestion-empty">No stock found. You can add the symbol manually.</div>`;return;}
  box.innerHTML=list.slice(0,10).map(s=>`<button class="fav-suggestion" type="button" onclick="addStock('${String(s.symbol).replace(/'/g,"\\'")}','${String(s.name||s.symbol).replace(/'/g,"\\'")}')"><span class="fav-suggestion-logo"><i class="fa-solid fa-chart-line"></i></span><span><b>${esc(s.name||s.symbol)}</b><small>NSE · ${esc(displaySymbol(s.symbol))}</small></span></button>`).join("");
}
function searchFavStocks(){
  const q=document.getElementById("favStockInput").value.trim(); const box=document.getElementById("favSuggestions");
  clearTimeout(searchTimer); if(!q){box.innerHTML="";return;}
  const id=++searchRequest; searchTimer=setTimeout(async()=>{const list=await searchRemote(q); if(id===searchRequest)renderSuggestions(list);},250);
}
function favStockKey(e){ if(e.key==="Escape")closeStockModal(); if(e.key==="Enter"){e.preventDefault(); const first=document.querySelector(".fav-suggestion"); if(first)first.click(); else addManualStock();} }
function addStock(symbol,name){
  const g=groups.find(x=>x.id===activeGroupId); if(!g)return;
  const clean=symbolClean(symbol); if(!clean)return;
  if((g.stocks||[]).some(s=>symbolClean(s.symbol)===clean)){alert("Ye stock is card me already added hai");return;}
  g.stocks=g.stocks||[]; g.stocks.push({symbol:clean,name:name||clean}); saveGroups(); closeStockModal(); render(); fetchPrice(clean);
}
function addManualStock(){ const q=symbolClean(document.getElementById("favStockInput").value); if(!q){alert("Stock symbol enter karo");return;} addStock(q,q); }
function removeStock(groupId,index){ const g=groups.find(x=>x.id===groupId); if(!g)return; g.stocks.splice(index,1); saveGroups(); render(); }
async function fetchPrice(symbol, force=false){
  if(!force && prices[symbol]) return;
  try{const r=await fetch(`/api/stock?symbol=${encodeURIComponent(symbol)}&t=${Date.now()}`, {cache:"no-store"}); const d=await r.json(); if(r.ok&&!d.error){prices[symbol]={price:Number(d.price),change:Number(d.change),percent_change:Number(d.percent_change),as_of:d.as_of||null}; render();}}catch(e){}
}
async function refreshPrices(){
  const symbols=[...new Set(groups.flatMap(g=>(g.stocks||[]).map(s=>s.symbol)))];
  await Promise.all(symbols.map(s=>fetchPrice(s,true)));
}
let draggedStock=null;
function dragStock(event,groupId,index){ draggedStock={groupId,index}; event.dataTransfer.effectAllowed="move"; event.dataTransfer.setData("text/plain", `${groupId}:${index}`); event.currentTarget.classList.add("dragging"); }
function allowStockDrop(event){ event.preventDefault(); event.dataTransfer.dropEffect="move"; }
function dropStock(event,groupId,targetIndex){
  event.preventDefault();
  if(!draggedStock || draggedStock.groupId!==groupId) return;
  const g=groups.find(x=>x.id===groupId); if(!g) return;
  const from=draggedStock.index; if(from===targetIndex) return;
  const [item]=g.stocks.splice(from,1);
  g.stocks.splice(from<targetIndex?targetIndex-1:targetIndex,0,item);
  draggedStock=null; saveGroups(); render();
}
document.addEventListener("dragend",()=>{document.querySelectorAll(".fav-stock-row.dragging").forEach(x=>x.classList.remove("dragging")); draggedStock=null;});
function toggleCard(id){ const g=groups.find(x=>x.id===id); if(!g)return; g.collapsed=!g.collapsed; saveGroups(); render(); }
function editStockNote(groupId,index){
  const g=groups.find(x=>x.id===groupId); if(!g||!g.stocks[index])return;
  const current=String(g.stocks[index].note||"");
  const note=prompt("Stock note enter kijiye (blank chhodne par note remove ho jayega):", current);
  if(note===null)return;
  g.stocks[index].note=note.trim(); saveGroups(); render();
}
render(); refreshPrices();
setInterval(refreshPrices,60000);
