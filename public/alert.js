const ALERT_STORAGE_KEY="stockHeavenAlerts";
const defaultAlerts=[
 {symbol:"AWL",name:"AWL",alertPrice:""},
 {symbol:"ADANIENSOL",name:"ADANIENSOL",alertPrice:""},
 {symbol:"ADANIGREEN",name:"ADANIGREEN",alertPrice:""},
 {symbol:"NSLNISP",name:"NMDC Steel",alertPrice:""},
 {symbol:"TMPV",name:"TMPV",alertPrice:""},
 {symbol:"RELIANCE",name:"Reliance Industries",alertPrice:""},
 {symbol:"HDFCBANK",name:"HDFC Bank",alertPrice:""},
 {symbol:"TCS",name:"Tata Consultancy Services",alertPrice:""},
 {symbol:"INFY",name:"Infosys",alertPrice:""},
 {symbol:"HINDUNILVR",name:"Hindustan Unilever",alertPrice:""},
 {symbol:"ICICIBANK",name:"ICICI Bank",alertPrice:""},
 {symbol:"SBIN",name:"State Bank of India",alertPrice:""}
];

function loadAlerts(){try{const x=JSON.parse(localStorage.getItem(ALERT_STORAGE_KEY));if(Array.isArray(x))return x}catch(e){}return defaultAlerts}
let alertStocks=loadAlerts(), prices={}, timer=null;

function saveAlerts(){localStorage.setItem(ALERT_STORAGE_KEY,JSON.stringify(alertStocks))}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function money(v){return Number.isFinite(Number(v))?"₹"+Number(v).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2}):"--"}
function initials(name){return String(name||"ST").replace(/[^A-Za-z0-9 ]/g,"").split(" ").filter(Boolean).slice(0,2).map(x=>x[0]).join("").toUpperCase()}

function stateOf(s){
 const p=prices[s.symbol], target=Number(s.alertPrice);
 if(!Number.isFinite(target))return "none";
 if(Number.isFinite(p?.price)&&p.price<=target)return "hit";
 return "watching";
}
function filtered(){
 const q=(document.getElementById("tableSearch")?.value||"").trim().toUpperCase();
 const f=document.getElementById("stockFilter")?.value||"all";
 return alertStocks.filter(s=>{
  const text=(s.symbol+" "+s.name).toUpperCase();
  return (!q||text.includes(q))&&(f==="all"||stateOf(s)===f);
 })
}
function render(){
 const box=document.getElementById("alertRows"), list=filtered();
 document.getElementById("totalCount").textContent=alertStocks.length;
 document.getElementById("activeCount").textContent=alertStocks.filter(s=>stateOf(s)!=="none").length;
 document.getElementById("hitCount").textContent=alertStocks.filter(s=>stateOf(s)==="hit").length;
 document.getElementById("watchCount").textContent=alertStocks.filter(s=>stateOf(s)==="watching").length;
 document.getElementById("showingText").textContent=`Showing 1 – ${list.length} of ${list.length} stocks`;
 if(!list.length){box.innerHTML='<div class="alert-empty">No stocks match your search.</div>';return}

 box.innerHTML=list.map((s)=> {
  const i=alertStocks.indexOf(s), p=prices[s.symbol], st=stateOf(s), target=Number(s.alertPrice);
  const change=Number(p?.change), pct=Number(p?.percent_change), market=Number(p?.price);
  const hit=st==="hit";
  const diff=Number.isFinite(market)&&Number.isFinite(target)?market-target:null;
  const logo=initials(s.name||s.symbol);
  return `<div class="alert-row ${hit?"triggered":""}">
   <div class="check-col"><input class="alert-check" type="checkbox"></div>
   <div>${i+1}</div>
   <div class="stock-cell"><div class="stock-logo">${esc(logo)}</div><div class="stock-meta"><b>${esc(s.name||s.symbol)}</b><small>${esc(s.symbol)}</small></div></div>
   <div><input class="alert-input" type="number" min="0" step="0.01" placeholder="Set price" value="${esc(s.alertPrice||"")}" oninput="setAlert(${i},this.value)"></div>
   <div class="market-cell ${Number.isFinite(change)&&change<0?"market-down":"market-up"}"><b>${money(market)}</b><small>${Number.isFinite(change)?(change>=0?"+":"")+money(Math.abs(change)).replace("₹","₹"):"--"} ${Number.isFinite(pct)?`(${pct>=0?"+":""}${pct.toFixed(2)}%)`:""}</small></div>
   <div class="diff-cell ${hit?"diff-hit":(st==="watching"?"diff-safe":"diff-none")}"><b>${diff===null?"-":(diff>=0?"+":"-")+money(Math.abs(diff))}</b><small>${diff===null?"":target?`(${((diff/target)*100).toFixed(2)}%)`:""}</small></div>
   <div><span class="status-pill ${hit?"hit":st==="watching"?"watch":"none"}"><i class="fa-solid ${hit?"fa-bell":st==="watching"?"fa-eye":"fa-bell"}"></i>${hit?"Price Hit":st==="watching"?"Watching":"No Alert"}</span></div>
   <div><button class="action-delete" onclick="removeAlert(${i})" title="Remove"><i class="fa-solid fa-trash-can"></i></button></div>
  </div>`;
 }).join("");
}
function setAlert(i,v){alertStocks[i].alertPrice=v;saveAlerts();render()}
function removeAlert(i){alertStocks.splice(i,1);delete prices[alertStocks[i]?.symbol];saveAlerts();render();refreshPrices()}
function openAddStock(){document.getElementById("addStockPanel").classList.add("open");document.getElementById("addStockInput").focus()}
function closeAddStock(){document.getElementById("addStockPanel").classList.remove("open");document.getElementById("addStockInput").value="";document.getElementById("recommendations").innerHTML=""}

function renderRecommendations(data){
 const box=document.getElementById("recommendations");
 if(!data.length){box.innerHTML="";return}
 box.innerHTML=data.slice(0,8).map(x=>`<div class="recommendation" onclick="addRecommended('${esc(x.symbol)}','${esc(x.name)}')"><span class="rec-symbol">${esc(x.symbol)}</span><span class="rec-name">${esc(x.name)}</span></div>`).join("");
}
async function searchStocks(q){
 if(!q.trim()){document.getElementById("recommendations").innerHTML="";return}
 try{
  const r=await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`);
  const d=await r.json();
  const arr=Array.isArray(d)?d:(d.results||d.data||[]);
  const normalized=arr.map(x=>({symbol:x.symbol||x.nse_code||x.code||"",name:x.name||x.company_name||x.company||""})).filter(x=>x.symbol&&x.name);
  renderRecommendations(normalized);
 }catch(e){document.getElementById("recommendations").innerHTML="";}

}
function addRecommended(symbol,name){
 if(alertStocks.some(x=>x.symbol===symbol)){closeAddStock();return}
 alertStocks.push({symbol,name,alertPrice:""});saveAlerts();render();closeAddStock();refreshPrices();
}
async function getPrice(symbol){
 const r=await fetch(`/api/stock?symbol=${encodeURIComponent(symbol)}`);
 const d=await r.json();if(!r.ok||d.error)throw Error(d.error||"Price unavailable");
 return {price:Number(d.price),change:Number(d.change),percent_change:Number(d.percent_change)};
}
async function refreshPrices(){
 await Promise.all(alertStocks.map(async s=>{
  try{prices[s.symbol]=await getPrice(s.symbol)}catch(e){prices[s.symbol]={}}
 }));
 render();
 const u=document.getElementById("showingText"); if(u)u.title="Prices refresh automatically every 60 seconds";
}

document.addEventListener("DOMContentLoaded",()=>{
 render();refreshPrices();timer=setInterval(refreshPrices,60000);
 document.getElementById("tableSearch").addEventListener("input",render);
 document.getElementById("stockFilter").addEventListener("change",render);
 document.getElementById("rowsPerPage").addEventListener("change",render);
 const input=document.getElementById("addStockInput");
 let searchTimer;
 input.addEventListener("input",e=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>searchStocks(e.target.value),180)});
 document.addEventListener("click",e=>{
  if(!e.target.closest(".add-stock-panel")&&!e.target.closest(".add-stock-main"))document.getElementById("recommendations").innerHTML="";
 });
 document.getElementById("selectAll").addEventListener("change",e=>document.querySelectorAll(".alert-check").forEach(x=>x.checked=e.target.checked));
});
