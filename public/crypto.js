const $=id=>document.getElementById(id);
let cryptoMarkets=[],cryptoCoins=[],searchTimer=null,refreshTimer=null;

function esc(s){return String(s??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\\':'&#92;','"':'&quot;'}[c]))}
function priceFmt(v){const n=Number(v);if(!Number.isFinite(n))return '--';const digits=n>=1?2:6;return `₹${n.toLocaleString('en-IN',{minimumFractionDigits:digits,maximumFractionDigits:digits})}`}
function changeHtml(v){const n=Number(v);if(!Number.isFinite(n))return '<span class="crypto-change flat">--</span>';const up=n>=0;return `<span class="crypto-change ${up?'up':'down'}"><i class="fa-solid fa-arrow-${up?'trend-up':'trend-down'}"></i>${up?'+':''}${n.toFixed(2)}%</span>`}
function shortNum(v){const n=Number(v);if(!Number.isFinite(n))return '--';if(n>=1e7)return `${(n/1e7).toFixed(2)}Cr`;if(n>=1e5)return `${(n/1e5).toFixed(2)}L`;if(n>=1e3)return `${(n/1e3).toFixed(2)}K`;return n.toLocaleString('en-IN',{maximumFractionDigits:2})}
function setStatus(html,type=''){const el=$('cryptoStatus');if(!el)return;el.className=`crypto-status ${type}`;el.innerHTML=html}
function coinInitial(symbol){return String(symbol||'C').replace(/[^A-Za-z0-9]/g,'').slice(0,1).toUpperCase()||'C'}

function render(){
 const box=$('cryptoList');if(!box)return;
 const count=$('cryptoCount');if(count)count.textContent=cryptoCoins.length;
 if(!cryptoCoins.length){
   box.innerHTML='<div class="crypto-empty"><div class="empty-icon"><i class="fa-brands fa-bitcoin"></i></div><strong>No coins in your watchlist</strong><span>Search a CoinDCX INR coin above and click Add Coin to start tracking it.</span></div>';
   return;
 }
 box.innerHTML=cryptoCoins.map((c,i)=>{
   const symbol=String(c.symbol||c.market||'').replace(/INR$/i,'').toUpperCase();
   const name=String(c.name||symbol);
   return `<article class="crypto-card">
      <div class="crypto-card-top">
        <div class="coin-avatar">${esc(coinInitial(symbol))}</div>
        <div class="coin-title"><strong>${esc(name)}</strong><span>${esc(symbol)} / INR</span></div>
        <button class="crypto-remove" title="Remove ${esc(symbol)}" data-remove="${esc(c.market)}"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div class="crypto-main-price">
        <div><span class="price-label">CURRENT PRICE</span><strong>${priceFmt(c.last_price)}</strong></div>
        <div class="change-wrap">${changeHtml(c.change_24_hour)}<small>24H</small></div>
      </div>
      <div class="crypto-metrics">
        <div><span>24H HIGH</span><b>${priceFmt(c.high)}</b></div>
        <div><span>24H LOW</span><b>${priceFmt(c.low)}</b></div>
        <div><span>24H VOLUME</span><b>${shortNum(c.volume)}</b></div>
      </div>
      <div class="crypto-card-foot"><span class="live-dot"><i class="fa-solid fa-circle"></i> Live CoinDCX</span><span>#${i+1}</span></div>
   </article>`
 }).join('');
 box.querySelectorAll('[data-remove]').forEach(btn=>btn.addEventListener('click',()=>removeCoin(btn.dataset.remove)));
}

async function loadMarkets(){
 if(cryptoMarkets.length)return cryptoMarkets;
 const r=await fetch('/api/crypto/markets',{cache:'no-store'});
 const d=await r.json().catch(()=>({}));
 if(!r.ok||d.error)throw Error(d.error||'Crypto market search failed');
 cryptoMarkets=Array.isArray(d.results)?d.results:[];
 return cryptoMarkets;
}
async function searchCrypto(q){
 const term=String(q||'').trim().toUpperCase();if(!term)return[];
 const markets=await loadMarkets();
 return markets.filter(x=>String(x.symbol||'').toUpperCase().includes(term)||String(x.name||'').toUpperCase().includes(term)).slice(0,8);
}
function showSuggestions(items){
 const box=$('cryptoSuggestions');if(!box)return;
 box.innerHTML=items.map(x=>`<div class="suggestion" data-market="${esc(x.market)}"><span class="suggestion-icon">${esc(coinInitial(x.symbol))}</span><span class="suggestion-copy"><b>${esc(x.name)}</b><small>${esc(x.symbol)}/INR</small></span><i class="fa-solid fa-plus"></i></div>`).join('');
 box.style.display=items.length?'block':'none';
 box.querySelectorAll('.suggestion').forEach(x=>x.addEventListener('click',()=>addCoin(x.dataset.market)));
}

async function saveCoins(items){
 const r=await fetch('/api/data/crypto',{method:'PUT',headers:{'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify({items:items.map(c=>({market:c.market,symbol:c.symbol,name:c.name}))})});
 const d=await r.json().catch(()=>({}));
 if(!r.ok||d.error)throw Error(d.error||'Crypto watchlist save failed');
 const saved=Array.isArray(d.items)?d.items:[];
 cryptoCoins=saved.map(x=>{const old=items.find(c=>c.market===x.market)||{};return {...old,...x}});
 render();
 return saved;
}
async function loadCoins(){
 try{
   const r=await fetch('/api/data/crypto',{cache:'no-store'});
   const d=await r.json().catch(()=>({}));
   if(!r.ok||d.error)throw Error(d.error||'Crypto watchlist load failed');
   cryptoCoins=Array.isArray(d.items)?d.items:[];
   render();
   await refreshPrices();
 }catch(e){setStatus(`<i class="fa-solid fa-circle-exclamation"></i> ${esc(e.message||'Unable to load crypto watchlist.')}`,'error')}
}
async function getTicker(market){
 const r=await fetch(`/api/crypto/ticker?market=${encodeURIComponent(market)}`,{cache:'no-store'});
 const d=await r.json().catch(()=>({}));
 if(!r.ok||d.error)throw Error(d.error||'Crypto price unavailable');
 if(!d.market)throw Error('CoinDCX did not return a valid market price. Please try again.');
 return d;
}
async function addCoin(market){
 if(!market)return;
 const input=$('cryptoInput');const btn=$('cryptoAddBtn');
 if($('cryptoSuggestions'))$('cryptoSuggestions').style.display='none';
 if(cryptoCoins.some(c=>c.market===market)){setStatus('<i class="fa-solid fa-circle-info"></i> This coin is already in your watchlist.','info');return;}
 if(btn)btn.disabled=true;
 setStatus('<i class="fa-solid fa-spinner fa-spin"></i> Fetching live CoinDCX price…','loading');
 try{
   const d=await getTicker(market);
   const coin={market:d.market,symbol:d.symbol,name:d.name,last_price:d.last_price,change_24_hour:d.change_24_hour,high:d.high,low:d.low,volume:d.volume,timestamp:d.timestamp};
   const next=[...cryptoCoins,coin];
   render();
   const saved=await saveCoins(next);
   if(!saved.some(x=>x.market===coin.market))throw Error('Coin could not be confirmed in the D1 database.');
   if(input)input.value='';
   setStatus('<i class="fa-solid fa-circle-check"></i> Coin added. Saved securely in D1 and live price is updating automatically.','success');
 }catch(e){
   await loadCoins();
   setStatus(`<i class="fa-solid fa-circle-exclamation"></i> ${esc(e.message||'Unable to add coin.')}`,'error');
 }finally{if(btn)btn.disabled=false;}
}
async function removeCoin(market){
 const previous=[...cryptoCoins];
 cryptoCoins=cryptoCoins.filter(c=>c.market!==market);render();
 setStatus('<i class="fa-solid fa-spinner fa-spin"></i> Removing from D1…','loading');
 try{await saveCoins(cryptoCoins);setStatus('<i class="fa-solid fa-circle-check"></i> Coin removed from the D1 watchlist.','success')}
 catch(e){cryptoCoins=previous;render();setStatus(`<i class="fa-solid fa-circle-exclamation"></i> ${esc(e.message||'Unable to remove coin.')}`,'error')}
}
async function refreshPrices(){
 if(!cryptoCoins.length)return;
 try{
   const markets=cryptoCoins.map(c=>c.market).join(',');
   const r=await fetch(`/api/crypto/ticker?markets=${encodeURIComponent(markets)}`,{cache:'no-store'});
   const d=await r.json().catch(()=>({}));
   if(!r.ok||d.error)return;
   const list=Array.isArray(d.results)?d.results:(d.results?[d.results]:[]);
   const map=new Map(list.map(x=>[x.market,x]));
   cryptoCoins=cryptoCoins.map(c=>map.get(c.market)?{...c,...map.get(c.market)}:c);
   render();
   const stamp=$('cryptoLastUpdate');if(stamp)stamp.textContent='Updated just now';
 }catch(_){/* keep last known price */}
}

const input=$('cryptoInput');
if(input)input.addEventListener('input',()=>{clearTimeout(searchTimer);const q=input.value.trim();if(!q){$('cryptoSuggestions').style.display='none';return}searchTimer=setTimeout(async()=>{try{showSuggestions(await searchCrypto(q))}catch(_){showSuggestions([])}},160)});
if(input)input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();const q=input.value.trim();if(q)searchCrypto(q).then(x=>x[0]&&addCoin(x[0].market)).catch(e=>setStatus(`<i class="fa-solid fa-circle-exclamation"></i> ${esc(e.message||'Search failed.')}`,'error'))}});
const addBtn=$('cryptoAddBtn');if(addBtn)addBtn.addEventListener('click',()=>{const q=input?.value.trim();if(q)searchCrypto(q).then(x=>x[0]?addCoin(x[0].market):setStatus('<i class="fa-solid fa-circle-info"></i> No INR coin found for that search.','info')).catch(e=>setStatus(`<i class="fa-solid fa-circle-exclamation"></i> ${esc(e.message||'Search failed.')}`,'error'))});
document.addEventListener('click',e=>{if(!e.target.closest('.crypto-search-wrap')){const s=$('cryptoSuggestions');if(s)s.style.display='none'}});
render();loadCoins();refreshTimer=setInterval(refreshPrices,5000);
