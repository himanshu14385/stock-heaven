const $=id=>document.getElementById(id);
let cryptoMarkets=[],cryptoCoins=[],searchTimer=null,refreshTimer=null;
function esc(s){return String(s??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\\':'&#92;'}[c]))}
function priceFmt(v){const n=Number(v);if(!Number.isFinite(n))return '--';const max=n>=1?2:6;return `₹${n.toLocaleString('en-IN',{minimumFractionDigits:max,maximumFractionDigits:max})}`}
function changeHtml(v){const n=Number(v);if(!Number.isFinite(n))return '<span class="crypto-change flat">--</span>';const cls=n>=0?'up':'down',sign=n>=0?'+':'';return `<span class="crypto-change ${cls}"><i class="fa-solid fa-arrow-${n>=0?'trend-up':'trend-down'}"></i>${sign}${n.toFixed(2)}%</span>`}
function shortNum(v){const n=Number(v);if(!Number.isFinite(n))return '--';if(n>=1e7)return `${(n/1e7).toFixed(2)}Cr`;if(n>=1e5)return `${(n/1e5).toFixed(2)}L`;if(n>=1e3)return `${(n/1e3).toFixed(2)}K`;return n.toLocaleString('en-IN',{maximumFractionDigits:2})}
function render(){
 const box=$('cryptoList');if(!box)return;
 const count=$('cryptoCount');if(count)count.textContent=cryptoCoins.length;
 if(!cryptoCoins.length){box.innerHTML='<div class="crypto-empty"><div class="empty-icon"><i class="fa-brands fa-bitcoin"></i></div><strong>Your crypto watchlist is empty</strong><span>Search any CoinDCX INR coin above and add it to start tracking live prices.</span></div>';return}
 box.innerHTML=cryptoCoins.map((c,i)=>{
   const ch=Number(c.change_24_hour), cls=Number.isFinite(ch)?(ch>=0?'up':'down'):'';
   const symbol=String(c.symbol||c.market||'').replace(/INR$/i,'').toUpperCase();
   const name=String(c.name||symbol);
   return `<article class="crypto-card">
      <div class="crypto-card-top"><div class="coin-avatar">${esc(symbol.slice(0,1))}</div><div class="coin-title"><strong>${esc(name)}</strong><span>${esc(symbol)} / INR</span></div><button class="crypto-remove" title="Remove coin" data-remove="${esc(c.market)}"><i class="fa-solid fa-xmark"></i></button></div>
      <div class="crypto-main-price"><div><span class="price-label">CURRENT PRICE</span><strong>${priceFmt(c.last_price)}</strong></div><div class="change-wrap">${changeHtml(c.change_24_hour)}<small>24H</small></div></div>
      <div class="crypto-metrics"><div><span>24H HIGH</span><b>${priceFmt(c.high)}</b></div><div><span>24H LOW</span><b>${priceFmt(c.low)}</b></div><div><span>24H VOLUME</span><b>${shortNum(c.volume)}</b></div></div>
      <div class="crypto-card-foot"><span><i class="fa-solid fa-circle"></i> Live CoinDCX</span><span>${i+1}</span></div>
   </article>`
 }).join('');
 box.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>removeCoin(b.dataset.remove));
}
async function loadMarkets(){if(cryptoMarkets.length)return cryptoMarkets;const r=await fetch('/api/crypto/markets',{cache:'no-store'});const d=await r.json();if(!r.ok||d.error)throw Error(d.error||'Crypto market search failed');cryptoMarkets=d.results||[];return cryptoMarkets}
async function searchCrypto(q){const term=String(q||'').trim().toUpperCase();if(!term)return[];const markets=await loadMarkets();return markets.filter(x=>String(x.symbol||'').includes(term)||String(x.name||'').toUpperCase().includes(term)).slice(0,8)}
function showSuggestions(items){const b=$('cryptoSuggestions');b.innerHTML=items.map(x=>`<div class="suggestion" data-market="${esc(x.market)}"><span class="suggestion-icon">${esc(String(x.symbol||'').slice(0,1))}</span><span><b>${esc(x.name)}</b><small>${esc(x.symbol)}/INR</small></span><i class="fa-solid fa-plus"></i></div>`).join('');b.style.display=items.length?'block':'none';b.querySelectorAll('.suggestion').forEach(x=>x.onclick=()=>addCoin(x.dataset.market))}
async function saveCoins(){
 const r=await fetch('/api/data/crypto',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({items:cryptoCoins.map(c=>({market:c.market,symbol:c.symbol,name:c.name}))})});
 const d=await r.json();if(!r.ok||d.error)throw Error(d.error||'Crypto watchlist save failed');
 const old=cryptoCoins;cryptoCoins=(d.items||[]).map(x=>({...x,...(old.find(c=>c.market===x.market)||{})}));render();
}
async function loadCoins(){try{const r=await fetch('/api/data/crypto',{cache:'no-store'});const d=await r.json();if(!r.ok||d.error)throw Error(d.error||'Crypto watchlist load failed');cryptoCoins=d.items||[];render();await refreshPrices()}catch(e){$('cryptoStatus').textContent=e.message||'Unable to load crypto watchlist.'}}
async function getTicker(market){const r=await fetch(`/api/crypto/ticker?market=${encodeURIComponent(market)}`,{cache:'no-store'});const d=await r.json();if(!r.ok||d.error)throw Error(d.error||'Crypto price unavailable');return d}
async function addCoin(market){if(!market)return;$('cryptoSuggestions').style.display='none';$('cryptoStatus').textContent='Adding coin to your D1 watchlist…';try{const d=await getTicker(market);cryptoCoins=cryptoCoins.filter(c=>c.market!==market);cryptoCoins.push({market:d.market,symbol:d.symbol,name:d.name,last_price:d.last_price,change_24_hour:d.change_24_hour,high:d.high,low:d.low,volume:d.volume,timestamp:d.timestamp});await saveCoins();$('cryptoInput').value='';$('cryptoStatus').innerHTML='<i class="fa-solid fa-circle-check"></i> Coin added successfully. Your watchlist is saved in the server database.'}catch(e){$('cryptoStatus').textContent=e.message||'Unable to add coin.'}}
async function removeCoin(market){$('cryptoStatus').textContent='Removing coin…';try{cryptoCoins=cryptoCoins.filter(c=>c.market!==market);await saveCoins();$('cryptoStatus').innerHTML='<i class="fa-solid fa-circle-check"></i> Coin removed from the server watchlist.'}catch(e){$('cryptoStatus').textContent=e.message||'Unable to remove coin.'}}
async function refreshPrices(){if(!cryptoCoins.length)return;try{const markets=cryptoCoins.map(c=>c.market).join(',');const r=await fetch(`/api/crypto/ticker?markets=${encodeURIComponent(markets)}`,{cache:'no-store'});const d=await r.json();if(!r.ok||d.error)return;const list=Array.isArray(d.results)?d.results:[d.results].filter(Boolean);const map=new Map(list.map(x=>[x.market,x]));cryptoCoins=cryptoCoins.map(c=>map.get(c.market)?{...c,...map.get(c.market)}:c);render();const stamp=$('cryptoLastUpdate');if(stamp)stamp.textContent='Updated just now'}catch(_) {}}
$('cryptoInput').addEventListener('input',()=>{clearTimeout(searchTimer);const q=$('cryptoInput').value.trim();if(!q){$('cryptoSuggestions').style.display='none';return}searchTimer=setTimeout(async()=>{try{showSuggestions(await searchCrypto(q))}catch(_){showSuggestions([])}},180)});
$('cryptoInput').addEventListener('keydown',e=>{if(e.key==='Enter'){const q=$('cryptoInput').value.trim();if(q)searchCrypto(q).then(x=>x[0]&&addCoin(x[0].market)).catch(()=>{})}});
$('cryptoAddBtn').onclick=()=>{const q=$('cryptoInput').value.trim();if(q)searchCrypto(q).then(x=>x[0]&&addCoin(x[0].market)).catch(()=>{})};
document.addEventListener('click',e=>{if(!e.target.closest('.crypto-search-wrap'))$('cryptoSuggestions').style.display='none'});
loadCoins();refreshTimer=setInterval(refreshPrices,5000);
