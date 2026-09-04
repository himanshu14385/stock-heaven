const ALERT_STORAGE_KEY="stockHeavenAlerts";
const defaultAlerts=[
 {symbol:"AWL",name:"AWL",alertPrice:""},
 {symbol:"ADANIENSOL",name:"ADANIENSOL",alertPrice:""},
 {symbol:"ADANIGREEN",name:"ADANIGREEN",alertPrice:""},
 {symbol:"NSLNISP",name:"NMDC Steel",alertPrice:""},
 {symbol:"TMPV",name:"TMPV",alertPrice:""}
];

const stockRecommendations=[
 ["RELIANCE","Reliance Industries"],
 ["TCS","Tata Consultancy Services"],
 ["INFY","Infosys"],
 ["HDFCBANK","HDFC Bank"],
 ["ICICIBANK","ICICI Bank"],
 ["SBIN","State Bank of India"],
 ["ITC","ITC"],
 ["BHARTIARTL","Bharti Airtel"],
 ["AWL","Adani Wilmar"],
 ["ADANIENSOL","Adani Energy Solutions"],
 ["ADANIGREEN","Adani Green Energy"],
 ["NSLNISP","NMDC Steel"],
 ["TMPV","Tata Motors Passenger Vehicles"],
 ["TATASILV.NS","Tata Silver ETF"],
 ["ENERGY.NS","Mirae Asset Nifty Energy ETF"],
 ["NIFTYCASE.NS","Zerodha Nifty 50 ETF"],
 ["FMCGIETF.NS","ICICI Prudential Nifty FMCG ETF"],
 ["MIDCAPIETF.NS","ICICI Prudential Midcap 150 ETF"],
 ["NEXT50IETF.NS","ICICI Prudential Nifty Next 50 ETF"],
 ["KOTAKALPHA.NS","Kotak Nifty Alpha 50 ETF"],
 ["HDFCNIFBAN.NS","HDFC Nifty Bank ETF"],
 ["SMALLCAP.NS","Mirae Nifty Smallcap ETF"],
 ["BANKBEES","Nippon India ETF Nifty Bank BeES"],
 ["GOLDBEES","Nippon India ETF Gold BeES"],
 ["ITBEES","Nippon India ETF Nifty IT BeES"]
];

function loadAlerts(){try{const x=JSON.parse(localStorage.getItem(ALERT_STORAGE_KEY));if(Array.isArray(x))return x}catch(e){}return defaultAlerts}
let alertStocks=loadAlerts(), alertTimer;

function saveAlerts(){localStorage.setItem(ALERT_STORAGE_KEY,JSON.stringify(alertStocks))}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function money(v){return Number.isFinite(Number(v))?"₹"+Number(v).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2}):"--"}

function renderAlerts(){
 const box=document.getElementById("alertList");
 if(!alertStocks.length){box.innerHTML='<div class="alert-empty">No stocks added.</div>';return}
 box.innerHTML=alertStocks.map((s,i)=>`
 <div class="alert-row" id="alert-row-${i}">
  <div class="alert-stock"><b>${esc(s.name||s.symbol)}</b><small>${esc(s.symbol)}</small></div>
  <input class="alert-price-input" type="number" min="0" step="0.01" value="${esc(s.alertPrice||"")}" placeholder="Set price" oninput="setAlert(${i},this.value)">
  <div class="alert-current" id="alert-current-${i}">--</div>
  <button class="alert-remove" onclick="removeAlert(${i})" title="Remove"><i class="fa-solid fa-trash"></i></button>
 </div>`).join("");
}

function setAlert(i,v){alertStocks[i].alertPrice=v;saveAlerts();checkRow(i)}
function removeAlert(i){alertStocks.splice(i,1);saveAlerts();renderAlerts();refreshPrices()}
function openAddStock(){document.getElementById("addStockBox").classList.toggle("hidden");document.getElementById("stockSearch").focus()}
function addStock(symbol,name){
 if(alertStocks.some(x=>x.symbol===symbol)){document.getElementById("addStockBox").classList.add("hidden");return}
 alertStocks.push({symbol,name,alertPrice:""});saveAlerts();renderAlerts();refreshPrices();
 document.getElementById("stockSearch").value="";document.getElementById("recommendations").innerHTML="";document.getElementById("addStockBox").classList.add("hidden");
}
function showRecommendations(q){
 const box=document.getElementById("recommendations"), term=q.trim().toUpperCase();
 if(!term){box.innerHTML="";return}
 const matches=stockRecommendations.filter(x=>(x[0]+" "+x[1]).toUpperCase().includes(term)).slice(0,8);
 box.innerHTML=matches.map(x=>`<div class="rec-item" onclick="addStock('${esc(x[0])}','${esc(x[1])}')"><span class="rec-symbol">${esc(x[0])}</span><span class="rec-name">${esc(x[1])}</span></div>`).join("");
}
function checkRow(i){
 const s=alertStocks[i], el=document.getElementById("alert-current-"+i), row=document.getElementById("alert-row-"+i);
 if(!s||!el||!row)return;
 const current=Number(el.dataset.price), target=Number(s.alertPrice);
 // RED when Market Price is equal to or below My Alert Price.
 const triggered=Number.isFinite(current)&&Number.isFinite(target)&&current<=target;
 row.classList.toggle("triggered",triggered);el.classList.toggle("triggered",triggered);
}
async function getPrice(symbol){
 const r=await fetch(`/api/stock?symbol=${encodeURIComponent(symbol)}`);
 const d=await r.json();if(!r.ok||d.error)throw Error(d.error||"Price unavailable");return Number(d.price)
}
async function refreshPrices(){
 await Promise.all(alertStocks.map(async(s,i)=>{
  const el=document.getElementById("alert-current-"+i);if(!el)return;
  try{const p=await getPrice(s.symbol);el.dataset.price=p;el.textContent=money(p);checkRow(i)}
  catch(e){el.textContent="--";el.removeAttribute("data-price");checkRow(i)}
 }));
 const u=document.getElementById("alertUpdated");if(u)u.textContent="Updated "+new Date().toLocaleTimeString("en-IN")+" • Auto refresh 60s";
}

document.addEventListener("DOMContentLoaded",()=>{
 renderAlerts();refreshPrices();alertTimer=setInterval(refreshPrices,60000);
 const input=document.getElementById("stockSearch");
 input.addEventListener("input",e=>showRecommendations(e.target.value));
 input.addEventListener("focus",e=>showRecommendations(e.target.value));
 document.addEventListener("click",e=>{if(!e.target.closest(".autocomplete")&&!e.target.closest(".alert-add-btn"))document.getElementById("recommendations").innerHTML=""});
});
