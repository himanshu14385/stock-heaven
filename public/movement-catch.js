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
function atr(h,l,c,n=14){
    if(h.length<=n||l.length<=n||c.length<=n)return null;
    const tr=[];
    for(let i=1;i<c.length;i++){
        const hi=Number(h[i]),lo=Number(l[i]),pc=Number(c[i-1]);
        if(Number.isFinite(hi)&&Number.isFinite(lo)&&Number.isFinite(pc))tr.push(Math.max(hi-lo,Math.abs(hi-pc),Math.abs(lo-pc)));
    }
    return tr.length<n?null:tr.slice(-n).reduce((a,b)=>a+b,0)/n;
}
function renderSwing(d){
    const {price,e20,e50,e200,R,av,vw,res,sup,volume,atr14,relativeStrength,stockReturn20,niftyReturn20}=d;
    const trend=e20!=null&&e50!=null&&e20>e50;
    const above20=Number.isFinite(e20)&&price>e20;
    const longTrend=e200!=null&&price>e200;
    const pullback=Number.isFinite(e20)&&price>=e20*0.985&&price<=e20*1.03;
    const swingRsi=R>=50&&R<=68;
    const volOk=Number.isFinite(av)&&Number(volume)>av*1.15;
    const vwapOk=vw!=null&&price>vw;
    const room=res!=null&&price<res*0.985;
    const atrRoom=atr14!=null&&sup!=null&&(price-Math.min(sup,e20!=null?e20*0.97:sup))>=atr14*0.75;
    const relativeOk=relativeStrength!=null&&relativeStrength>0;
    const checks=[trend,above20,longTrend,pullback,swingRsi,volOk,vwapOk,room,atrRoom,relativeOk];
    const score=checks.filter(Boolean).length;
    const signal=score>=8?'BUY SETUP':score>=5?'WAIT':'AVOID';

    let entry=null,sl=null,target=null,rr=null;
    if(price!=null){
        entry=price;
        const supportStop=sup!=null?sup:null;
        const atrStop=atr14!=null?price-1.5*atr14:null;
        sl=supportStop!=null&&atrStop!=null?Math.min(supportStop,atrStop):supportStop!=null?supportStop:atrStop;
        if(sl!=null&&sl<entry){
            const risk=entry-sl;
            target=entry+risk*2;
            rr=(target-entry)/risk;
        }
    }

    setSignal(signal,score,10,
        score>=8?'Trend, momentum, volume and risk structure are aligned for a swing setup.':
        score>=5?'The swing structure is developing. Wait for stronger confirmation and better risk room.':
        'The stock does not currently show enough swing-trade confirmations.'
    );
    set('entry',fmt(entry));set('sl',fmt(sl));set('target',fmt(target));set('rr',rr?`1:${rr.toFixed(1)}`:'--');set('swingDataDate',d.as_of?`Data: ${d.as_of}`:'Daily data');

    const rsDetail=relativeStrength==null?'NIFTY comparison unavailable':`${fmtPct(stockReturn20)} stock vs ${fmtPct(niftyReturn20)} NIFTY`;
    $('swingConditionList').innerHTML=[
        condition('20 EMA > 50 EMA',`${fmt(e20)} > ${fmt(e50)}`,trend),
        condition('Price > 20 EMA',`${fmt(price)} vs ${fmt(e20)}`,above20),
        condition('Price > 200 EMA',`${fmt(price)} vs ${fmt(e200)}`,longTrend),
        condition('Healthy pullback zone',pullback?'Price is near the 20 EMA zone.':'Price is outside the pullback zone.',pullback),
        condition('RSI (14) 50–68',`Current RSI ${R?.toFixed(1)||'--'}`,swingRsi),
        condition('Volume support',`${fmtN(volume)} vs 1.15× avg ${fmtN(av)}`,volOk),
        condition('Price > VWAP',`${fmt(price)} vs ${fmt(vw)}`,vwapOk),
        condition('Room to resistance',res!=null?`${fmt(price)} vs ${fmt(res)}`:'Resistance unavailable',room),
        condition('ATR / SL room',atr14!=null?`ATR ${fmt(atr14)} · enough room for SL`:'ATR unavailable',atrRoom),
        condition('Relative strength vs NIFTY',rsDetail,relativeOk)
    ].join('');
}
function stddev(a){if(!a.length)return null;const m=a.reduce((x,y)=>x+y,0)/a.length;return Math.sqrt(a.reduce((x,y)=>x+(y-m)**2,0)/a.length)}
function renderBBIndi(d){
    const {price,e20,vw,R,bbUpper,bbMiddle,bbLower,av,volume,res,sup,bbNearUpper,bbVolume,bbCandle,bbBreakout}=d;
    const checks=[
        price>e20,
        vw!=null&&price>vw,
        R!=null&&R>55,
        bbNearUpper,
        bbVolume,
        bbCandle&&bbBreakout
    ];
    const score=checks.filter(Boolean).length;
    const signal=score>=5?'BUY SETUP':score>=3?'WAIT':'AVOID';
    let entry=bbBreakout?price:null;
    if(bbBreakout&&res!=null) entry=Math.max(price,res);
    const slBase=sup!=null?sup:null;
    const bandStop=bbMiddle!=null?bbMiddle*0.995:null;
    const sl=slBase!=null&&bandStop!=null?Math.min(slBase,bandStop):slBase!=null?slBase:bandStop;
    const risk=entry!=null&&sl!=null&&sl<entry?entry-sl:null;
    const target=res!=null&&res>entry?res:(risk!=null?entry+risk*2:null);
    const rr=entry!=null&&risk!=null&&target!=null?(target-entry)/risk:null;
    setSignal(signal,score,6,score>=5?'Trend, VWAP, momentum, Bollinger expansion and volume are aligned for a BB Indi move.':score>=3?'The BB Indi setup is developing. Wait for stronger breakout and confirmation.':'The current setup does not meet enough BB Indi confirmations.');
    set('entry',fmt(entry));set('sl',fmt(sl));set('target',fmt(target));set('rr',rr?`1:${rr.toFixed(1)}`:'--');set('bbDataDate',d.as_of?`Data: ${d.as_of}`:'Daily data');
    $('bbConditionList').innerHTML=[
        condition('Price > 20 EMA',`${fmt(price)} vs ${fmt(e20)}`,price>e20),
        condition('Price > VWAP',`${fmt(price)} vs ${fmt(vw)}`,vw!=null&&price>vw),
        condition('RSI (14) > 55',`Current RSI ${R?.toFixed(1)||'--'}`,R!=null&&R>55),
        condition('Upper Bollinger Band',`${fmt(price)} vs upper ${fmt(bbUpper)}`,bbNearUpper),
        condition('Volume expansion',`${fmtN(volume)} vs 1.5× avg ${fmtN(av)}`,bbVolume),
        condition('Strong candle + resistance breakout',bbBreakout?(bbCandle?'Bullish candle confirmed above the prior high.':'Breakout confirmed; candle strength is weak.'):(bbCandle?'Bullish candle, but resistance breakout is not confirmed.':'No strong bullish breakout candle yet.'),bbCandle&&bbBreakout)
    ].join('');
}
function renderTab(){
    if(!currentData)return;
    const swing=currentTab==='swing',bb=currentTab==='bbindi';
    $('movementConditions').hidden=swing||bb;
    $('swingConditions').hidden=!swing;
    $('bbConditions').hidden=!bb;
    renderSwingOrMovement();
}

function renderSwingOrMovement(){if(!currentData)return;currentTab==='swing'?renderSwing(currentData):currentTab==='bbindi'?renderBBIndi(currentData):renderMovement(currentData)}
async function analyze(symbol){
    const id=++req;
    symbol=(symbol||'').trim().toUpperCase();
    if(!symbol)return;
    $('status').textContent='Loading market data…';
    $('result').hidden=true;
    try{
        const [stockResponse,niftyResponse]=await Promise.all([
            fetch(`/api/stock?symbol=${encodeURIComponent(symbol)}`),
            fetch('/api/stock?symbol=%5ENSEI')
        ]);
        const d=await stockResponse.json();
        const nifty=await niftyResponse.json().catch(()=>({}));
        if(id!==req)return;
        if(!stockResponse.ok||d.error)throw Error(d.error||'Stock not found');

        let hist=d.history||[];
        let c=hist.map(x=>Number(x.close)).filter(Number.isFinite),
            h=hist.map(x=>Number(x.high)),
            l=hist.map(x=>Number(x.low)),
            v=hist.map(x=>Number(x.volume||0));
        if(c.length<50)throw Error(`Only ${c.length} daily records available. At least 50 are needed.`);

        let price=Number(d.price),
            e20=ema(c,20),
            e50=ema(c,50),
            e200=ema(c,200),
            R=rsi(c),
            av=sma(v,20),
            vw=vwap20(h,l,c,v),
            atr14=atr(h,l,c,14);

        const bbWindow=c.slice(-20);
        const bbMiddle=bbWindow.length>=20?sma(bbWindow,20):null;
        const bbStd=bbWindow.length>=20?stddev(bbWindow):null;
        const bbUpper=bbMiddle!=null&&bbStd!=null?bbMiddle+2*bbStd:null;
        const bbLower=bbMiddle!=null&&bbStd!=null?bbMiddle-2*bbStd:null;
        const bbNearUpper=bbUpper!=null&&price>=bbUpper*0.99;
        const bbVolume=Number.isFinite(av)&&Number(d.volume)>av*1.5;
        const lastH=Number(h[h.length-1]),lastL=Number(l[l.length-1]),lastO=Number(d.open);
        const range=lastH-lastL;
        const body=Math.abs(price-lastO);
        const bbCandle=Number.isFinite(lastO)&&Number.isFinite(lastH)&&Number.isFinite(lastL)&&range>0&&price>lastO&&body/range>=0.6&&price>=lastH*0.985;

        let prevHigh=h.slice(0,-1).slice(-20).filter(Number.isFinite),
            prevLow=l.slice(0,-1).slice(-20).filter(Number.isFinite),
            res=prevHigh.length?Math.max(...prevHigh):null,
            sup=prevLow.length?Math.min(...prevLow):null;
        const bbBreakout=res!=null&&price>res;

        let trend=price>e20&&e20>e50,
            above20=price>e20,
            volBreak=Number(d.volume)>av*1.5,
            rsiz=R>=55&&R<=70,
            aboveVwap=vw!=null&&price>vw,
            breakout=res!=null&&price>res;

        let retest=false;
        if(res!=null){
            for(let i=Math.max(0,l.length-5);i<l.length-1;i++){
                if(l[i]<=res*1.015&&c[i]>=res*0.995&&c[i]<=res*1.03){retest=true;break}
            }
        }

        let checks=[trend,above20,volBreak,rsiz,aboveVwap,breakout,retest],
            score=checks.filter(Boolean).length,
            entry=breakout?(retest?Math.max(price,res):res):null,
            sl=(retest&&sup?Math.min(sup,res*0.985):res?res*0.985:null),
            risk=entry&&sl?entry-sl:null,
            target=entry&&risk?entry+risk*2:null,
            rr=entry&&risk&&target?(target-entry)/risk:null;

        // Compare the stock's recent performance with NIFTY once at search time.
        let stockReturn20=null,niftyReturn20=null,relativeStrength=null;
        const nc=(nifty.history||[]).map(x=>Number(x.close)).filter(Number.isFinite);
        if(c.length>=21&&nc.length>=21){
            stockReturn20=((c[c.length-1]/c[c.length-21])-1)*100;
            niftyReturn20=((nc[nc.length-1]/nc[nc.length-21])-1)*100;
            relativeStrength=stockReturn20-niftyReturn20;
        }

        currentData={...d,price,e20,e50,e200,R,av,vw,res,sup,volume:Number(d.volume),atr14,bbMiddle,bbUpper,bbLower,bbNearUpper,bbVolume,bbCandle,bbBreakout,stockReturn20,niftyReturn20,relativeStrength,trend,above20,volBreak,rsiz,aboveVwap,breakout,retest,checks,score,entry,sl,target,rr};
        set('symbol',symbol.replace(/\.NS$/,''));
        set('company',d.name||symbol);
        set('price',fmt(price));
        set('change',`${fmt(d.change)} (${fmtPct(d.percent_change)})`);
        $('result').hidden=false;
        $('status').textContent='Analysis complete.';
        renderTab();
    }catch(e){
        if(id===req){currentData=null;$('status').textContent=e.message||'Unable to analyze stock.'}
    }
}

document.querySelectorAll('.catch-tab').forEach(tab=>tab.addEventListener('click',()=>{currentTab=tab.dataset.tab;document.querySelectorAll('.catch-tab').forEach(x=>{const active=x===tab;x.classList.toggle('active',active);x.setAttribute('aria-selected',active?'true':'false')});if(currentData){$('result').hidden=false;renderTab()}}));
$('movementInput').addEventListener('input',()=>{clearTimeout(timer);let q=$('movementInput').value.trim();if(!q){$('movementSuggestions').style.display='none';return}timer=setTimeout(async()=>{try{suggestions(await search(q))}catch(_){suggestions([])}},250)});
$('movementInput').addEventListener('keydown',e=>{if(e.key==='Enter')analyze($('movementInput').value)});$('analyzeBtn').onclick=()=>analyze($('movementInput').value);document.addEventListener('click',e=>{if(!e.target.closest('.movement-search-wrap'))$('movementSuggestions').style.display='none'});
