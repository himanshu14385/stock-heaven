(() => {
  'use strict';

  const MAX_STOCKS = 15;
  const stocks = [];
  let selectedSuggestion = null;
  let searchTimer = null;
  let lastUpdated = null;

  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const n = v => { const x = Number(v); return Number.isFinite(x) ? x : null; };
  const money = v => n(v) == null ? '—' : '₹' + n(v).toLocaleString('en-IN', {maximumFractionDigits:2});
  const fixed = (v,d=2) => n(v) == null ? '—' : n(v).toFixed(d);
  const median = arr => { const a=arr.filter(x=>n(x)!=null).map(Number).sort((x,y)=>x-y); if(!a.length)return null; const m=Math.floor(a.length/2); return a.length%2?a[m]:(a[m-1]+a[m])/2; };

  function setStatus(text, error=false){ $('statusText').textContent=text||''; $('statusText').style.color=error?'#df3038':'#70809a'; }
  function fmtTime(){ return new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',second:'2-digit'}); }

  function closes(data){ return (data.history||[]).map(x=>n(x.close)).filter(x=>x!=null); }
  function volumes(data){ return (data.history||[]).map(x=>n(x.volume)); }
  function sma(a,p){ if(a.length<p)return null; const s=a.slice(-p); return s.reduce((x,y)=>x+y,0)/p; }
  function emaSeries(a,p){
    if(a.length<p)return [];
    const k=2/(p+1); let e=a.slice(0,p).reduce((x,y)=>x+y,0)/p; const out=new Array(p-1).fill(null); out.push(e);
    for(let i=p;i<a.length;i++){ e=a[i]*k+e*(1-k); out.push(e); }
    return out;
  }
  function rsi(a,p=14){
    if(a.length<=p)return null; let gain=0,loss=0;
    for(let i=1;i<=p;i++){const d=a[i]-a[i-1]; if(d>=0)gain+=d;else loss-=d;}
    let ag=gain/p, al=loss/p;
    for(let i=p+1;i<a.length;i++){const d=a[i]-a[i-1];ag=((ag*(p-1))+Math.max(d,0))/p;al=((al*(p-1))+Math.max(-d,0))/p;}
    if(al===0)return 100; return 100-(100/(1+ag/al));
  }
  function macd(a){
    const e12=emaSeries(a,12),e26=emaSeries(a,26); if(!e12.length||!e26.length)return null;
    const vals=[]; for(let i=0;i<a.length;i++){if(e12[i]!=null&&e26[i]!=null)vals.push(e12[i]-e26[i]);}
    const sig=emaSeries(vals,9); if(!sig.length)return null; return {line:vals[vals.length-1],signal:sig[sig.length-1],hist:vals[vals.length-1]-sig[sig.length-1]};
  }
  function bollinger(a,p=20,m=2){
    if(a.length<p)return null; const s=a.slice(-p),mid=s.reduce((x,y)=>x+y,0)/p; const sd=Math.sqrt(s.reduce((x,y)=>x+(y-mid)**2,0)/p); return {mid,upper:mid+m*sd,lower:mid-m*sd};
  }
  function vwap(data,p=20){
    const rows=(data.history||[]).slice(-p); let pv=0,v=0; rows.forEach(r=>{const price=n(r.close);const vol=n(r.volume);if(price!=null&&vol!=null&&vol>0){pv+=price*vol;v+=vol;}}); return v?pv/v:null;
  }
  function volumeRatio(data,p=20){const vs=volumes(data).filter(x=>x!=null&&x>=0);if(vs.length<p+1)return null;const latest=vs[vs.length-1],avg=vs.slice(-p-1,-1).reduce((a,b)=>a+b,0)/p;return avg?latest/avg:null;}

  function tech(data){
    const c=closes(data), price=n(data.price) ?? c[c.length-1];
    const r=rsi(c), m=macd(c), s20=sma(c,20),s50=sma(c,50),s200=sma(c,200),bb=bollinger(c),vw=vwap(data),vr=volumeRatio(data);
    const near=(x)=>x==null||price==null?false:Math.abs(price-x)/x<=0.01;
    const trend = s20==null||s50==null ? 'Neutral' : (price>s20 && s20>s50?'Uptrend':(price<s20&&s20<s50?'Downtrend':'Sideways'));
    return {price,rsi:r,macd:m,s20,s50,s200,bb,vw,vr,trend,near};
  }

  function rsiState(r){ if(r==null)return ['Neutral','warn']; if(r<30)return ['Oversold','good']; if(r>70)return ['Overbought','bad']; return ['Neutral','warn']; }
  function boolState(v){return v?'Bullish':'Bearish';}
  function techCell(label,value,status,type='neutral'){
    return `<div class="tech-item tech-${type}"><div class="tech-label">${esc(label)}</div><div class="tech-value">${esc(value)}</div><span class="tech-tag">${esc(status)}</span></div>`;
  }

  async function api(path, options={}){
    const r=await fetch(path,{cache:'no-store',credentials:'same-origin',...options});
    const d=await r.json().catch(()=>({}));
    if(!r.ok||d.error)throw new Error(d.error||`Request failed (${r.status})`); return d;
  }

  async function loadSavedStocks(){
    setStatus('Loading saved stocks…');
    try{
      const d=await api('/api/data/buy-zone');
      const items=Array.isArray(d.items)?d.items:[];
      stocks.length=0;
      items.slice(0,MAX_STOCKS).forEach(x=>stocks.push({id:x.id,symbol:String(x.symbol||'').toUpperCase(),name:x.name||x.symbol,loading:true}));
      render();
      if(!stocks.length){setStatus('No stocks saved yet.');return;}
      await Promise.all(stocks.map(async e=>{
        try{
          const [stock,peers]=await Promise.all([api(`/api/stock?symbol=${encodeURIComponent(e.symbol)}`),api(`/api/peers?symbol=${encodeURIComponent(e.symbol)}`).catch(()=>({}))]);
          e.data=stock;e.peers=peers;e.loading=false;e.analysis=buildAnalysis(e);
        }catch(err){e.loading=false;e.refreshError=err.message||'Unable to analyse';}
      }));
      lastUpdated=new Date();$('lastUpdated').textContent=fmtTime();render();setStatus('Saved stocks loaded.');
    }catch(e){
      render();
      setStatus(e.message||'Unable to load saved stocks',true);
    }
  }

  async function saveStocks(){
    const items=stocks.map(x=>({symbol:x.symbol,name:x.name}));
    const d=await api('/api/data/buy-zone',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({items})});
    const saved=Array.isArray(d.items)?d.items:[];
    saved.forEach((x,i)=>{if(stocks[i])stocks[i].id=x.id;});
    return d;
  }

  async function searchStocks(q){
    if(!q.trim()){ hideSuggestions(); return; }
    try{
      const d=await api(`/api/search?q=${encodeURIComponent(q.trim())}`);
      const results=Array.isArray(d.results)?d.results:[];
      const box=$('stockSuggestions');
      if(!results.length){box.innerHTML='<div class="suggestion"><span>No stocks found</span></div>';box.classList.add('show');return;}
      box.innerHTML=results.slice(0,8).map((x,i)=>`<div class="suggestion" data-index="${i}"><b>${esc(x.name)}</b><span>${esc(x.symbol)}</span></div>`).join('');
      box.classList.add('show');
      box.querySelectorAll('.suggestion[data-index]').forEach(el=>el.addEventListener('click',()=>{
        const x=results[Number(el.dataset.index)]; selectedSuggestion=x; $('stockSearch').value=x.name; hideSuggestions();
      }));
    }catch(e){ setStatus(e.message||'Search failed',true); }
  }
  function hideSuggestions(){ $('stockSuggestions').classList.remove('show'); }

  async function addStock(item){
    if(stocks.length>=MAX_STOCKS){setStatus('Maximum 15 stocks reached.',true);return;}
    const symbol=String(item.symbol||'').trim().toUpperCase().replace(/\.NS$/i,''); if(!symbol)return;
    if(stocks.some(x=>x.symbol===symbol)){setStatus(`${symbol} is already added.`,true);return;}
    const entry={symbol,name:item.name||symbol,loading:true}; stocks.push(entry); render(); setStatus(`Analysing ${symbol}…`);
    try{
      const [stock,peers] = await Promise.all([api(`/api/stock?symbol=${encodeURIComponent(symbol)}`), api(`/api/peers?symbol=${encodeURIComponent(symbol)}`).catch(()=>({}))]);
      entry.data=stock; entry.peers=peers; entry.loading=false; entry.analysis=buildAnalysis(entry);
      await saveStocks();
      lastUpdated=new Date(); $('lastUpdated').textContent=fmtTime();
      render(); setStatus(`${symbol} added and saved to database.`);
    }catch(e){
      const idx=stocks.indexOf(entry);if(idx>=0)stocks.splice(idx,1);render();setStatus(`${symbol}: ${e.message||'Unable to analyse/save'}`,true);
    }
  }

  function buildAnalysis(entry){
    const d=entry.data||{}, t=tech(d), price=t.price;
    const selectedPe=n(entry.peers?.selected?.pe ?? entry.peers?.selected?.pe);
    const peerPes=(entry.peers?.peers||[]).map(x=>n(x.pe)).filter(x=>x!=null&&x>0&&x<200);
    const peerPe=median(peerPes);
    const basePe=selectedPe!=null&&selectedPe>0 ? selectedPe : null;
    const fairPe=peerPe!=null ? peerPe : basePe;
    let fairValue=null, eps=null;
    if(price!=null&&basePe!=null&&basePe>0&&fairPe!=null){eps=price/basePe;fairValue=eps*fairPe;}
    const fair=fairValue!=null?fairValue:price;
    let zone='HOLD', zoneClass='hold';
    if(price!=null&&fairValue!=null){
      const ratio=price/fairValue;
      if(ratio<0.80){zone='STRONG BUY';zoneClass='strong';}
      else if(ratio<0.95){zone='BUY';zoneClass='buy';}
      else if(ratio<=1.10){zone='HOLD';zoneClass='hold';}
      else {zone='SELL';zoneClass='sell';}
    }
    return {t,selectedPe,peerPe,fairValue,fair,eps,zone,zoneClass};
  }

  function render(){
    const body=$('analysisRows'); body.innerHTML=''; $('emptyState').style.display=stocks.length?'none':'block';
    let counts={BUY:0,HOLD:0,SELL:0,'STRONG BUY':0};
    stocks.forEach((entry,i)=>{
      if(entry.analysis)counts[entry.analysis.zone]=(counts[entry.analysis.zone]||0)+1;
      body.insertAdjacentHTML('beforeend', rowHtml(entry,i));
    });
    $('countAll').textContent=stocks.length;$('countBuy').textContent=counts.BUY||0;$('countHold').textContent=counts.HOLD||0;$('countSell').textContent=counts.SELL||0;$('countStrong').textContent=counts['STRONG BUY']||0;
    body.querySelectorAll('[data-delete]').forEach(b=>b.addEventListener('click',async()=>{
      const i=Number(b.dataset.delete); const removed=stocks[i]; if(!removed)return;
      stocks.splice(i,1); render(); setStatus('Saving…');
      try{await saveStocks();setStatus(`${removed.symbol} removed.`);}catch(e){stocks.splice(i,0,removed);render();setStatus(e.message||'Unable to save changes',true);}
    }));
  }

  function logoUrl(symbol){return `https://cdn.simpleicons.org/${encodeURIComponent(String(symbol).toLowerCase())}`;}
  function zoneClass(a){return a.zoneClass==='strong'?'zone-strong':a.zoneClass==='buy'?'zone-buy':a.zoneClass==='sell'?'zone-sell':'zone-hold';}
  function viewClass(a){return a.zoneClass==='strong'||a.zoneClass==='buy'?'':'view-'+a.zoneClass;}
  function zoneRange(a){
    if(a.fairValue==null)return 'Fair value unavailable';
    const f=a.fairValue; return `Strong Buy < ${money(f*.80)} · Buy ${money(f*.80)}–${money(f*.95)} · Hold ${money(f*.95)}–${money(f*1.10)} · Sell > ${money(f*1.10)}`;
  }
  function markerPos(a){
    if(a.fairValue==null||a.t.price==null)return 50;
    const ratio=a.t.price/a.fairValue; return Math.max(4,Math.min(96,50+(ratio-1)*65));
  }

  function rowHtml(e,i){
    if(e.loading)return `<tr><td>${i+1}</td><td colspan="6"><div style="color:#71839b;padding:10px 0">Loading ${esc(e.symbol)} analysis…</div></td><td></td></tr>`;
    const d=e.data||{},a=e.analysis||buildAnalysis(e),t=a.t, price=t.price, ch=n(d.change), pct=n(d.percent_change);
    const [rsiStatus,rsiType]=rsiState(t.rsi); const macBull=t.macd?t.macd.hist>=0:null; const macType=macBull?'good':'bad';
    const s20Type=t.s20==null?'warn':t.near(t.s20)?'warn':price>t.s20?'good':'bad'; const s50Type=t.s50==null?'warn':t.near(t.s50)?'warn':price>t.s50?'good':'bad'; const s200Type=t.s200==null?'warn':t.near(t.s200)?'warn':price>t.s200?'good':'bad';
    let bbLabel='—',bbStatus='Neutral',bbType='warn'; if(t.bb&&price!=null){if(price<t.bb.lower){bbLabel='Below Lower';bbStatus='Oversold';bbType='good'}else if(price>t.bb.upper){bbLabel='Above Upper';bbStatus='Overbought';bbType='bad'}else{bbLabel='In Range';bbStatus='Neutral';bbType='warn'}}
    const vwType=t.vw==null?'warn':price>=t.vw?'good':'bad'; const volType=t.vr==null?'warn':t.vr>=1.5?'good':t.vr<0.8?'bad':'warn';
    const trendType=t.trend==='Uptrend'?'good':t.trend==='Downtrend'?'bad':'warn';
    const currentClass=a.zoneClass==='hold'?'view-hold':a.zoneClass==='sell'?'view-sell':'';
    const currentView=a.zoneClass==='hold'?'HOLD':a.zoneClass==='sell'?'SELL':'BUY';
    return `<tr>
      <td class="row-num">${i+1}</td>
      <td><div class="stock-cell"><div class="stock-logo"><img src="${logoUrl(e.symbol)}" alt="" loading="lazy" onerror="this.style.display='none';this.parentElement.textContent='${esc(e.symbol.slice(0,2))}'"></div><div class="stock-name"><b>${esc(e.name)}</b><span>${esc(e.symbol)}</span></div></div></td>
      <td><div class="price-main">${money(price)}</div><div class="price-change ${ch!=null&&ch>=0?'up':'down'}">${ch==null?'—':(ch>=0?'+':'')+fixed(ch)} (${pct==null?'—':(pct>=0?'+':'')+fixed(pct,2)+'%'})</div></td>
      <td><span class="zone-badge ${zoneClass(a)}">${esc(a.zone)}</span><div class="zone-range">Fair: <b>${money(a.fairValue)}</b></div></td>
      <td><div class="view-box ${currentClass}"><div class="view-icon"><i class="fa-solid fa-bullseye"></i></div><div class="view-text">Current View<b>${currentView}</b></div></div></td>
      <td><div class="tech-grid">
        ${techCell('RSI (14)',fixed(t.rsi,1),rsiStatus,rsiType)}
        ${techCell('MACD',t.macd?fixed(t.macd.hist,2):'—',macBull?'Bullish':'Bearish',macType)}
        ${techCell('SMA 20',money(t.s20),t.s20==null?'—':price>t.s20?'Bullish':'Bearish',s20Type)}
        ${techCell('SMA 50',money(t.s50),t.s50==null?'—':price>t.s50?'Bullish':'Bearish',s50Type)}
        ${techCell('SMA 200',money(t.s200),t.s200==null?'—':price>t.s200?'Bullish':'Bearish',s200Type)}
        ${techCell('Bollinger',bbLabel,bbStatus,bbType)}
        ${techCell('VWAP',money(t.vw),t.vw==null?'—':price>=t.vw?'Bullish':'Bearish',vwType)}
        ${techCell('Volume',t.vr==null?'—':fixed(t.vr,1)+'× Avg',t.vr==null?'—':t.vr>=1.5?'Bullish':t.vr<0.8?'Weak':'Neutral',volType)}
      </div></td>
      <td class="action-cell"><button class="action-delete" title="Remove" data-delete="${i}"><i class="fa-solid fa-trash"></i></button></td>
    </tr>`;
  }


  async function refreshAll(){
    if(!stocks.length){setStatus('Add stocks first.');return;}
    setStatus('Refreshing…'); const copy=stocks.slice();
    await Promise.all(copy.map(async e=>{try{const [d,p]=await Promise.all([api(`/api/stock?symbol=${encodeURIComponent(e.symbol)}`),api(`/api/peers?symbol=${encodeURIComponent(e.symbol)}`).catch(()=>({}))]);e.data=d;e.peers=p;e.analysis=buildAnalysis(e);}catch(err){e.refreshError=err.message||'Refresh failed';}}));
    lastUpdated=new Date();$('lastUpdated').textContent=fmtTime();render();setStatus('Analysis refreshed.');
  }


  $('stockSearch').addEventListener('input',()=>{selectedSuggestion=null;clearTimeout(searchTimer);searchTimer=setTimeout(()=>searchStocks($('stockSearch').value),220);});
  $('stockSearch').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();const item=selectedSuggestion||{symbol:$('stockSearch').value.trim().toUpperCase(),name:$('stockSearch').value.trim()};if(item.symbol){addStock(item);$('stockSearch').value='';selectedSuggestion=null;hideSuggestions();}}});
  document.addEventListener('click',e=>{if(!e.target.closest('.analysis-search-box'))hideSuggestions();});
  $('addBtn').addEventListener('click',()=>{const item=selectedSuggestion||{symbol:$('stockSearch').value.trim().toUpperCase(),name:$('stockSearch').value.trim()};if(!item.symbol){setStatus('Search a stock first.',true);return;}addStock(item);$('stockSearch').value='';selectedSuggestion=null;hideSuggestions();});
  $('clearAllBtn').addEventListener('click',async()=>{
    if(!stocks.length)return;
    if(!confirm('Remove all stocks from Buy Zone?'))return;
    const backup=stocks.slice(); stocks.length=0; render(); setStatus('Removing all stocks…');
    try{await saveStocks();setStatus('All stocks removed from database.');}
    catch(e){stocks.push(...backup);render();setStatus(e.message||'Unable to clear database',true);}
  });
  $('refreshBtn').addEventListener('click',refreshAll);
  loadSavedStocks();
})();
