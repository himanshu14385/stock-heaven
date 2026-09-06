const $=id=>document.getElementById(id);
let timer=null,req=0,currentData=null,currentTab='movement';
function fmt(v){return Number.isFinite(Number(v))?`₹${Number(v).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}`:'--'}
function fmtN(v){return Number.isFinite(Number(v))?Number(v).toLocaleString('en-IN',{maximumFractionDigits:0}):'--'}
function fmtPct(v){return Number.isFinite(Number(v))?`${v>=0?'+':''}${Number(v).toFixed(2)}%`:'--'}
function sma(a,n){return a.length<n?null:a.slice(-n).reduce((x,y)=>x+y,0)/n}
function ema(a,n){if(a.length<n)return null;let e=a.slice(0,n).reduce((x,y)=>x+y,0)/n,k=2/(n+1);for(let i=n;i<a.length;i++)e=a[i]*k+e*(1-k);return e}
function rsi(a,n=14){if(a.length<=n)return null;let g=0,l=0;for(let i=a.length-n;i<a.length;i++){let d=a[i]-a[i-1];if(d>0)g+=d;else l-=d}if(l===0)return 100;return 100-100/(1+g/l)}
function vwap20(h,l,c,v){let H=h.slice(-20),L=l.slice(-20),C=c.slice(-20),V=v.slice(-20),pv=0,vol=0;for(let i=0;i<C.length;i++){let x=(H[i]+L[i]+C[i])/3,vv=Number(V[i]||0);pv+=x*vv;vol+=vv}return vol?pv/vol:null}
function set(id,v){if($(id))$(id).textContent=v}
function esc(s){return String(s??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\\':'&#92;'}[c]))}
async function search(q){const r=await fetch(`/api/search?q=${encodeURIComponent(q)}`);const d=await r.json();return r.ok&&!d.error?d.results||[]:[]}
function suggestions(items){const b=$('movementSuggestions');if(!b)return;b.innerHTML=items.slice(0,8).map(x=>`<div class="suggestion" data-symbol="${esc(x.symbol)}"><b>${esc(x.name)}</b><small>NSE · ${esc(x.symbol)}</small></div>`).join('');b.style.display=items.length?'block':'none';b.querySelectorAll('.suggestion').forEach(x=>x.onclick=()=>{$('movementInput').value=x.dataset.symbol.replace(/\.NS$/i,'');b.style.display='none';analyze(x.dataset.symbol)})}
function condition(title,detail,pass){let cls=pass===null?'pending':pass?'pass':'fail',icon=pass===null?'fa-minus':pass?'fa-check':'fa-xmark',badge=pass===null?'WAIT':pass?'PASS':'FAIL';return `<div class="condition ${cls}"><div class="condition-left"><div class="condition-icon"><i class="fa-solid ${icon}"></i></div><div><div class="condition-title">${title}</div><div class="condition-detail">${detail}</div></div></div><span class="condition-badge">${badge}</span></div>`}
function setSignal(signal,score,max,text){set('score',`${score}/${max}`);if($('signalBarFill'))$('signalBarFill').style.width=`${Math.round(score/max*100)}%`;$('signal').textContent=signal;$('signalText').textContent=text;$('signalCard').className='signal-panel card '+(signal==='BUY SETUP'?'buy':signal==='AVOID'?'avoid':'wait')}
function renderMovement(d){
    const {price,e20,e50,R,av,vw,res,sup,volume,trend,above20,volBreak,rsiz,aboveVwap,breakout,retest,checks,score,entry,sl,target,rr}=d;
    setSignal(score>=6?'BUY SETUP':score>=4?'WAIT':'AVOID',score,7,score>=6?'Most key confirmations are aligned. Wait for your execution trigger and risk confirmation.':score>=4?'The setup is developing. Wait for the missing breakout/retest confirmations.':'The current setup does not meet enough conditions for a movement-catch trade.');
    set('entry',fmt(entry));set('sl',fmt(sl));set('target',fmt(target));set('rr',rr?`1:${rr.toFixed(1)}`:'--');set('dataDate',d.as_of?`Data: ${d.as_of}`:'Daily data');
    $('conditionList').innerHTML=[
        condition('20 EMA > 50 EMA',`${fmt(e20)} > ${fmt(e50)}`,trend),
        condition('Price > 20 EMA',`${fmt(price)} vs ${fmt(e20)}`,above20),
        condition('Volume breakout',`${fmtN(volume)} vs 1.5× avg ${fmtN(av)}`,volBreak),
        condition('RSI (14) 55–70',`Current RSI ${R?.toFixed(1)||'--'}`,rsiz),
        condition('Price > VWAP',`${fmt(price)} vs ${fmt(vw)}`,aboveVwap),
        condition('Resistance breakout',`${fmt(price)} vs ${fmt(res)}`,breakout),
        condition('Breakout retest',retest?'Recent candle tested the breakout zone.':'Retest not confirmed yet.',retest)
    ].join('');
}
function renderSwing(d){
    const {price,e20,e50,R,av,vw,res,sup,volume}=d;
    const trend=e20!=null&&e50!=null&&e20>e50;
    const above20=price>e20;
    const pullback=price>=e20*0.985&&price<=e20*1.03;
    const swingRsi=R>=50&&R<=68;
    const volOk=Number(volume)>av*1.15;
    const vwapOk=vw!=null&&price>vw;
    const room=res!=null&&price<res*0.985;
    const checks=[trend,above20,pullback,swingRsi,volOk,vwapOk,room];
    const score=checks.filter(Boolean).length;
    const signal=score>=6?'BUY SETUP':score>=4?'WAIT':'AVOID';
    let entry=null,sl=null,target=null,rr=null;
    if(sup!=null&&res!=null){
        entry=Math.max(price,e20);
        sl=Math.min(sup,e20*0.97);
        const risk=entry-sl;
        target=entry+risk*2;
        rr=risk>0?(target-entry)/risk:null;
    }
    setSignal(signal,score,7,score>=6?'Trend, momentum and pullback structure are aligned for a swing setup.':score>=4?'The swing structure is developing. Wait for a cleaner pullback or confirmation.':'The stock does not currently show enough swing-trade confirmations.');
    set('entry',fmt(entry));set('sl',fmt(sl));set('target',fmt(target));set('rr',rr?`1:${rr.toFixed(1)}`:'--');set('swingDataDate',d.as_of?`Data: ${d.as_of}`:'Daily data');
    $('swingConditionList').innerHTML=[
        condition('20 EMA > 50 EMA',`${fmt(e20)} > ${fmt(e50)}`,trend),
        condition('Price above 20 EMA',`${fmt(price)} vs ${fmt(e20)}`,above20),
        condition('Healthy pullback zone',pullback?'Price is near the 20 EMA zone.':`Price is outside the pullback zone.`,pullback),
        condition('RSI (14) 50–68',`Current RSI ${R?.toFixed(1)||'--'}`,swingRsi),
        condition('Volume support',`${fmtN(volume)} vs 1.15× avg ${fmtN(av)}`,volOk),
        condition('Price > VWAP',`${fmt(price)} vs ${fmt(vw)}`,vwapOk),
        condition('Room to resistance',res!=null?`${fmt(price)} vs ${fmt(res)}`:'Resistance unavailable',room)
    ].join('');
}
function renderTab(){
    if(!currentData)return;
    const swing=currentTab==='swing';
    $('movementConditions').hidden=swing;
    $('swingConditions').hidden=!swing;
    renderSwingOrMovement();
}
function renderSwingOrMovement(){if(!currentData)return;currentTab==='swing'?renderSwing(currentData):renderMovement(currentData)}
async function analyze(symbol){const id=++req;symbol=(symbol||'').trim().toUpperCase();if(!symbol)return;$('status').textContent='Loading market data…';$('result').hidden=true;try{const r=await fetch(`/api/stock?symbol=${encodeURIComponent(symbol)}`);const d=await r.json();if(id!==req)return;if(!r.ok||d.error)throw Error(d.error||'Stock not found');let hist=d.history||[];let c=hist.map(x=>Number(x.close)).filter(Number.isFinite),h=hist.map(x=>Number(x.high)),l=hist.map(x=>Number(x.low)),v=hist.map(x=>Number(x.volume||0));if(c.length<50)throw Error(`Only ${c.length} daily records available. At least 50 are needed.`);let price=Number(d.price),e20=ema(c,20),e50=ema(c,50),R=rsi(c),av=sma(v,20),vw=vwap20(h,l,c,v);let prevHigh=h.slice(0,-1).slice(-20).filter(Number.isFinite),prevLow=l.slice(0,-1).slice(-20).filter(Number.isFinite),res=prevHigh.length?Math.max(...prevHigh):null,sup=prevLow.length?Math.min(...prevLow):null;let trend=price>e20&&e20>e50,above20=price>e20,volBreak=Number(d.volume)>av*1.5,rsiz=R>=55&&R<=70,aboveVwap=vw!=null&&price>vw,breakout=res!=null&&price>res;let retest=false;if(res!=null){for(let i=Math.max(0,l.length-5);i<l.length-1;i++){if(l[i]<=res*1.015&&c[i]>=res*0.995&&c[i]<=res*1.03){retest=true;break}}}let checks=[trend,above20,volBreak,rsiz,aboveVwap,breakout,retest],score=checks.filter(Boolean).length;let entry=breakout?(retest?Math.max(price,res):res):null,sl=(retest&&sup?Math.min(sup,res*0.985):res?res*0.985:null),risk=entry&&sl?entry-sl:null,target=entry&&risk?entry+risk*2:null,rr=entry&&risk&&target?(target-entry)/risk:null;currentData={...d,price,e20,e50,R,av,vw,res,sup,volume:Number(d.volume),trend,above20,volBreak,rsiz,aboveVwap,breakout,retest,checks,score,entry,sl,target,rr};set('symbol',symbol.replace(/\.NS$/,''));set('company',d.name||symbol);set('price',fmt(price));set('change',`${fmt(d.change)} (${fmtPct(d.percent_change)})`);$('result').hidden=false;$('status').textContent='Analysis complete.';renderTab()}catch(e){if(id===req){currentData=null;$('status').textContent=e.message||'Unable to analyze stock.'}}}

document.querySelectorAll('.catch-tab').forEach(tab=>tab.addEventListener('click',()=>{currentTab=tab.dataset.tab;document.querySelectorAll('.catch-tab').forEach(x=>{const active=x===tab;x.classList.toggle('active',active);x.setAttribute('aria-selected',active?'true':'false')});if(currentData){$('result').hidden=false;renderTab()}}));
$('movementInput').addEventListener('input',()=>{clearTimeout(timer);let q=$('movementInput').value.trim();if(!q){$('movementSuggestions').style.display='none';return}timer=setTimeout(async()=>{try{suggestions(await search(q))}catch(_){suggestions([])}},250)});
$('movementInput').addEventListener('keydown',e=>{if(e.key==='Enter')analyze($('movementInput').value)});$('analyzeBtn').onclick=()=>analyze($('movementInput').value);document.addEventListener('click',e=>{if(!e.target.closest('.movement-search-wrap'))$('movementSuggestions').style.display='none'});
