const ALERT_STORAGE_KEY = "stockHeavenAlerts";

const defaultAlerts = [
    {symbol:"AWL", name:"AWL", alertPrice:""},
    {symbol:"ADANIENSOL", name:"ADANIENSOL", alertPrice:""},
    {symbol:"ADANIGREEN", name:"ADANIGREEN", alertPrice:""},
    {symbol:"NSLNISP", name:"NMDC Steel", alertPrice:""},
    {symbol:"TMPV", name:"TMPV", alertPrice:""}
];

function loadAlerts(){
    try{
        const saved = JSON.parse(localStorage.getItem(ALERT_STORAGE_KEY));
        if(Array.isArray(saved) && saved.length) return saved;
    }catch(e){}
    return defaultAlerts;
}

let alertStocks = loadAlerts();
let alertRefreshTimer = null;

function saveAlerts(){
    localStorage.setItem(ALERT_STORAGE_KEY, JSON.stringify(alertStocks));
}

function moneyAlert(v){
    const n=Number(v);
    return Number.isFinite(n)
        ? `₹${n.toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2})}`
        : "--";
}

function escapeAlert(v){
    return String(v ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}

function renderAlertList(){
    const box=document.getElementById("alertList");
    if(!box)return;

    if(!alertStocks.length){
        box.innerHTML='<div class="alert-empty">No stocks added. Click “Add Stock” to create an alert.</div>';
        return;
    }

    box.innerHTML=alertStocks.map((stock,i)=>`
        <div class="alert-row" id="alert-row-${i}">
            <div class="alert-stock">
                <b>${escapeAlert(stock.name || stock.symbol)}</b>
                <small>${escapeAlert(stock.symbol)}</small>
            </div>
            <input class="alert-price-input" type="number" step="0.01" min="0"
                   value="${escapeAlert(stock.alertPrice || "")}"
                   placeholder="Enter price"
                   onchange="updateAlertPrice(${i},this.value)"
                   oninput="updateAlertPrice(${i},this.value)">
            <div class="alert-current" id="alert-current-${i}">Loading...</div>
            <button class="alert-remove" type="button" onclick="removeAlertRow(${i})" title="Remove">
                <i class="fa-solid fa-trash"></i>
            </button>
        </div>
    `).join("");
}

function updateAlertPrice(index,value){
    if(!alertStocks[index])return;
    alertStocks[index].alertPrice=value;
    saveAlerts();
    checkAlertRow(index);
}

function removeAlertRow(index){
    alertStocks.splice(index,1);
    saveAlerts();
    renderAlertList();
    refreshAlertPrices();
}

function addAlertRow(){
    const symbol=prompt("Stock symbol enter karo, example: RELIANCE");
    if(!symbol)return;
    const clean=symbol.trim().toUpperCase();
    if(!clean)return;
    if(alertStocks.some(x=>String(x.symbol).toUpperCase()===clean)){
        alert("Ye stock already Alert list mein hai.");
        return;
    }
    alertStocks.push({symbol:clean,name:clean,alertPrice:""});
    saveAlerts();
    renderAlertList();
    refreshAlertPrices();
}

async function fetchAlertPrice(symbol){
    const r=await fetch(`/api/stock?symbol=${encodeURIComponent(symbol)}`);
    const d=await r.json();
    if(!r.ok || d.error) throw new Error(d.error || "Price unavailable");
    return Number(d.price);
}

function checkAlertRow(index){
    const stock=alertStocks[index];
    const currentEl=document.getElementById(`alert-current-${index}`);
    const rowEl=document.getElementById(`alert-row-${index}`);
    if(!stock || !currentEl || !rowEl)return;

    const current=Number(currentEl.dataset.price);
    const target=Number(stock.alertPrice);
    const triggered=Number.isFinite(current) && Number.isFinite(target) && current<=target;

    rowEl.classList.toggle("triggered",triggered);
    currentEl.classList.toggle("triggered",triggered);
}

async function refreshAlertPrices(){
    if(!alertStocks.length)return;

    await Promise.all(alertStocks.map(async(stock,index)=>{
        const el=document.getElementById(`alert-current-${index}`);
        if(!el)return;
        try{
            const price=await fetchAlertPrice(stock.symbol);
            if(Number.isFinite(price)){
                el.dataset.price=price;
                el.textContent=moneyAlert(price);
                checkAlertRow(index);
            }else{
                el.textContent="--";
            }
        }catch(e){
            el.textContent="--";
        }
    }));

    const updated=document.getElementById("alertUpdated");
    if(updated){
        const now=new Date();
        updated.textContent=`Last updated: ${now.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",second:"2-digit"})} • Prices refresh automatically every 60 seconds.`;
    }
}

document.addEventListener("DOMContentLoaded",()=>{
    renderAlertList();
    refreshAlertPrices();
    clearInterval(alertRefreshTimer);
    alertRefreshTimer=setInterval(refreshAlertPrices,60000);
});
