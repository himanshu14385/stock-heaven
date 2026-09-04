const summaryStockList = [
    ["RELIANCE", "Reliance Industries Limited"], ["TCS", "Tata Consultancy Services Limited"], ["HDFCBANK", "HDFC Bank Limited"], ["INFY", "Infosys Limited"], ["ICICIBANK", "ICICI Bank Limited"], ["SBIN", "State Bank of India"], ["ITC", "ITC Limited"], ["BHARTIARTL", "Bharti Airtel Limited"],
    ["TATAGOLD", "Tata Gold Exchange Traded Fund"], ["TATASILV.NS", "Tata Silver Exchange Traded Fund"], ["ENERGY.NS", "Mirae Asset Nifty Energy ETF"], ["CPSEETF", "CPSE Exchange Traded Fund"], ["NIFTYCASE.NS", "Zerodha Nifty 50 ETF"], ["FMCGIETF.NS", "ICICI Prudential Nifty FMCG ETF"], ["MIDCAPIETF.NS", "ICICI Prudential Nifty Midcap 150 ETF"], ["NEXT50IETF.NS", "ICICI Prudential Nifty Next 50 ETF"], ["KOTAKALPHA.NS", "Kotak Nifty Alpha 50 ETF"], ["ITBEES", "Nippon India ETF Nifty IT BeES"], ["HDFCNIFBAN.NS", "HDFC Nifty Bank ETF"], ["SMALLCAP.NS", "Mirae Asset Nifty Smallcap 250 Momentum Quality 100 ETF"], ["BANKBEES", "Nippon India ETF Nifty Bank BeES"], ["GOLDBEES", "Nippon India ETF Gold BeES"]
];

function cleanSummarySymbol(s){return (s||"").trim().toUpperCase();}
function formatSummaryPrice(v){return v==null||Number.isNaN(Number(v))?"--":`₹${Number(v).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2})}`;}
function formatNum(v,d=2){return v==null||!Number.isFinite(Number(v))?"--":Number(v).toLocaleString("en-IN",{minimumFractionDigits:d,maximumFractionDigits:d});}
function setSummary(id,value){const el=document.getElementById(id);if(el)el.textContent=value;}
function setClass(id,cls,on=true){const el=document.getElementById(id);if(el)el.classList.toggle(cls,on);}
function sma(a,n){if(!a||a.length<n)return null;return a.slice(-n).reduce((x,y)=>x+Number(y),0)/n;}
function pctReturn(a,n){if(!a||a.length<=n)return null;const old=Number(a[a.length-1-n]),now=Number(a[a.length-1]);return old?((now-old)/old)*100:null;}
function dailyVolatility(a,n=20){if(!a||a.length<n+1)return null;const r=[];for(let i=a.length-n;i<a.length;i++){const prev=Number(a[i-1]),cur=Number(a[i]);if(prev>0)r.push((cur/prev-1)*100);}if(!r.length)return null;const avg=r.reduce((x,y)=>x+y,0)/r.length;return Math.sqrt(r.reduce((x,y)=>x+(y-avg)**2,0)/r.length);}
function rsi14(a){if(!a||a.length<15)return null;let gains=0,losses=0;for(let i=a.length-14;i<a.length;i++){const d=Number(a[i])-Number(a[i-1]);if(d>0)gains+=d;else losses-=d;}const ag=gains/14,al=losses/14;if(al===0)return 100;return 100-(100/(1+ag/al));}
function fmtPct(v){return v==null?"--":`${v>=0?"+":""}${v.toFixed(2)}%`;}
function fmtVol(v){if(v==null)return "--";if(v>=1e7)return `${(v/1e7).toFixed(2)} Cr`;if(v>=1e5)return `${(v/1e5).toFixed(2)} L`;if(v>=1e3)return `${(v/1e3).toFixed(1)}K`;return Math.round(v).toLocaleString("en-IN");}
function scoreRing(id,score,label,desc){setSummary(id,score==null?"--":score);setSummary(id.replace("Score","Label"),label||"--");setSummary(id.replace("Score","Desc"),desc||"");const ring=document.getElementById(id.replace("Score","Ring"));if(ring){ring.classList.toggle("muted",score==null);ring.style.setProperty("--score",score==null?0:score*10);}}
let summarySearchTimer=null;
async function showSummarySuggestions(){
  const input=document.getElementById("stockInput"),box=document.getElementById("stockSuggestions");
  if(!input||!box)return;
  const q=input.value.trim();
  if(!q){box.style.display="none";box.innerHTML="";return;}
  clearTimeout(summarySearchTimer);
  summarySearchTimer=setTimeout(async()=>{
    let matches=summaryStockList.filter(s=>s[0].toUpperCase().includes(q.toUpperCase())||s[1].toUpperCase().includes(q.toUpperCase())).map(s=>({symbol:s[0],name:s[1]}));
    try{
      const r=await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const d=await r.json();
      if(Array.isArray(d.results)) matches=[...d.results,...matches];
    }catch(e){}
    const seen=new Set();
    matches=matches.filter(s=>{const k=s.symbol.toUpperCase().replace(/\.NS$/,'');if(seen.has(k))return false;seen.add(k);return true;}).slice(0,10);
    box.innerHTML=matches.map(s=>`<div class="stock-suggestion" onclick="showSummaryQuote('${String(s.symbol).replace(/'/g,"\\'")}')"><div class="suggestion-icon"><i class="fa-solid fa-chart-line"></i></div><div class="suggestion-info"><span class="suggestion-name">${s.name}</span><span class="suggestion-symbol">NSE · <strong>${s.symbol}</strong></span></div></div>`).join("");
    box.style.display=matches.length?"block":"none";
  },220);
}

function handleSummarySearch(e){if(e.key==="Enter")showSummaryQuote(document.getElementById("stockInput").value);}
async function renderPeerComparison(selectedSymbol){
  const body=document.getElementById("peerTableBody");
  if(!body) return;
  body.innerHTML='<tr><td colspan="4" class="peer-loading">Finding competitors...</td></tr>';
  try{
    const r=await fetch(`/api/peers?symbol=${encodeURIComponent(selectedSymbol)}`);
    const d=await r.json();
    const peers=Array.isArray(d.peers)?d.peers.slice(0,10):[];
    if(!peers.length){
      body.innerHTML='<tr><td colspan="4" class="peer-loading">Peer data not available for this stock.</td></tr>';
      return;
    }
    body.innerHTML=peers.map(p=>`<tr><td><div class="peer-name"><span class="peer-logo">${(p.symbol||'?').slice(0,1)}</span><span>${p.name||p.symbol}</span></div></td><td>${p.ltp!=null?formatSummaryPrice(p.ltp):"--"}</td><td>${p.pe!=null&&Number(p.pe)>0?Number(p.pe).toFixed(2):"--"}</td><td>${p.rsi!=null?Number(p.rsi).toFixed(2):"--"}</td></tr>`).join("");
  }catch(e){
    body.innerHTML='<tr><td colspan="4" class="peer-loading">Unable to load peer comparison.</td></tr>';
  }
}

async function showSummaryQuote(symbol){
 const normalized=cleanSummarySymbol(symbol);if(!normalized)return;
 const input=document.getElementById("stockInput"),box=document.getElementById("stockSuggestions");if(input)input.value=normalized.replace(/\.NS$/i,"");if(box){box.style.display="none";box.innerHTML="";}
 try{
  const response=await fetch(`/api/stock?symbol=${encodeURIComponent(normalized)}`);const d=await response.json();if(!response.ok||d.error)throw new Error(d.error||"Stock not found");
  const found=summaryStockList.find(s=>cleanSummarySymbol(s[0])===normalized);const hist=d.history||[];const h=hist.map(x=>Number(x.close)).filter(Number.isFinite);const vols=hist.map(x=>Number(x.volume||0)).filter(Number.isFinite);
  const price=Number(d.price),d20=sma(h,20),d50=sma(h,50),d200=sma(h,200),rsi=rsi14(h),avgVol=sma(vols,20),recent=h.slice(-20),support=recent.length?Math.min(...recent):null,resistance=recent.length?Math.max(...recent):null;
  const ret20=pctReturn(h,20),ret50=pctReturn(h,50),ret1y=h.length>1?pctReturn(h,h.length-1):null,vol20=dailyVolatility(h),volRatio=avgVol&&Number(d.volume)?Number(d.volume)/avgVol:null;
  const above20=d20!==null&&price>d20,above50=d50!==null&&price>d50,above200=d200!==null&&price>d200;
  const trendScore=d200!==null?(above20&&above50&&above200?10:above20&&above50?8:above20||above50?6:4):(above20&&above50?10:above20||above50?7:4);
  const momentumScore=ret20==null?null:ret20>=8?10:ret20>=4?9:ret20>=1?8:ret20>=0?7:ret20>=-2?5:ret20>=-5?3:1;
  const rsiScore=rsi==null?null:(rsi>=50&&rsi<=65?10:rsi>=45&&rsi<50?8:rsi>65&&rsi<=75?7:rsi>75?4:rsi>=35?5:2);
  const maScore=(above20?4:0)+(above50?3:0)+(d200!==null&&above200?3:0);const volScore=volRatio==null?null:(volRatio>=1.5?10:volRatio>=1.1?8:volRatio>=0.9?6:4);const volScoreRisk=vol20==null?null:(vol20<=1.5?10:vol20<=2.5?8:vol20<=4?6:vol20<=6?4:2);const rangePct=d.year_low!=null&&d.year_high!=null&&Number(d.year_high)>Number(d.year_low)?((price-Number(d.year_low))/(Number(d.year_high)-Number(d.year_low)))*100:null;const rangeScore=rangePct==null?null:(rangePct>=75?10:rangePct>=55?8:rangePct>=35?6:rangePct>=20?4:2);
  const available=[trendScore,momentumScore,rsiScore,maScore,volScore,volScoreRisk,rangeScore].filter(x=>x!=null);const total=available.length?Math.round(available.reduce((a,b)=>a+b,0)/available.length*10):0;const verdict=total>=75?"BUY":total>=55?"WATCH":"CAUTION";
  setSummary("summarySymbol",normalized.replace(/\.NS$/,""));setSummary("summaryCompany",found?found[1]:normalized);setSummary("summaryPrice",formatSummaryPrice(price));setSummary("summaryChange",`${Number(d.change)>=0?"+":""}${Number(d.change).toFixed(2)} (${Number(d.percent_change)>=0?"+":""}${Number(d.percent_change).toFixed(2)}%)`);setSummary("summaryHigh",formatSummaryPrice(d.day_high));setSummary("summaryLow",formatSummaryPrice(d.day_low));setSummary("summary52High",formatSummaryPrice(d.year_high));setSummary("summary52Low",formatSummaryPrice(d.year_low));setClass("summaryChange","negative",Number(d.change)<0);
  setSummary("verdict",verdict);setSummary("verdictText",`Technical score ${total}/100 based on trend, momentum, moving averages, RSI, volume and volatility.`);
  scoreRing("trendScore",trendScore,trendScore>=8?"Strong":trendScore>=6?"Positive":"Weak",above20&&above50?"Price is above 20 and 50 DMA.":"DMA alignment is mixed.");scoreRing("momentumScore",momentumScore,momentumScore>=8?"Strong":momentumScore>=6?"Positive":"Weak",`20-day return: ${fmtPct(ret20)}.`);scoreRing("rsiScore",rsiScore,rsi>=50&&rsi<=70?"Healthy":rsi>70?"High":"Weak",`RSI (14): ${rsi==null?"--":rsi.toFixed(1)}.`);scoreRing("maScore",maScore,maScore>=8?"Strong":maScore>=5?"Positive":"Weak","Based on available DMA levels.");scoreRing("volumeScore",volScore,volScore>=8?"Active":volScore>=6?"Normal":"Low",`Volume ratio: ${volRatio==null?"--":volRatio.toFixed(2)}x.`);scoreRing("volScore",volScoreRisk,volScoreRisk>=8?"Stable":volScoreRisk>=6?"Moderate":"High",`20-day volatility: ${vol20==null?"--":vol20.toFixed(2)}%.`);scoreRing("rangeScore",rangeScore,rangeScore>=8?"Upper":rangeScore>=5?"Middle":"Lower",`52W position: ${rangePct==null?"--":rangePct.toFixed(0)}%.`);
  const risk=Math.max(1,Math.min(10,Math.round(10-(total/100)*9)));setSummary("riskScore",risk);setSummary("riskLabel",risk<=3?"Low":risk<=6?"Moderate":"High");setSummary("riskText",`Technical risk score from the current market setup: ${risk}/10.`);
  setSummary("return20",fmtPct(ret20));setSummary("return50",fmtPct(ret50));setSummary("return1y",fmtPct(ret1y));setSummary("volatility20",vol20==null?"--":`${vol20.toFixed(2)}%`);setSummary("avgVolume",fmtVol(avgVol));setSummary("volumeRatio",volRatio==null?"--":`${volRatio.toFixed(2)}x`);setSummary("momentumView",ret20>=0?"Positive momentum":"Weak momentum");setSummary("momentumViewText",`20D ${fmtPct(ret20)} • 50D ${fmtPct(ret50)} • 1Y ${fmtPct(ret1y)}.`);
  setSummary("previousClose",formatSummaryPrice(d.previous_close));setSummary("dayRange",`${formatSummaryPrice(d.day_low)} – ${formatSummaryPrice(d.day_high)}`);setSummary("yearRange",`${formatSummaryPrice(d.year_low)} – ${formatSummaryPrice(d.year_high)}`);setSummary("currency",d.currency||"INR");setSummary("marketStatus","Market data connected");setSummary("marketStatusText",`${h.length} daily price records available for this symbol.`);
  setSummary("setup20",formatSummaryPrice(d20));setSummary("setup50",formatSummaryPrice(d50));setSummary("setup200",formatSummaryPrice(d200));setSummary("setupRSI",rsi==null?"--":rsi.toFixed(1));setSummary("setupSupport",formatSummaryPrice(support));setSummary("setupResistance",formatSummaryPrice(resistance));
  setSummary("techTrend",above20&&above50?"Bullish ↑":(!above20&&!above50?"Weak ↓":"Mixed →"));setSummary("tech20",d20===null?"--":above20?"Above ↑":"Below ↓");setSummary("tech50",d50===null?"--":above50?"Above ↑":"Below ↓");setSummary("tech200",d200===null?"N/A":above200?"Above ↑":"Below ↓");setSummary("techRSI",rsi==null?"--":rsi.toFixed(1));setSummary("techVolume",volRatio==null?"--":volRatio>1?"High ↑":"Normal");setSummary("techSupport",formatSummaryPrice(support));setSummary("techResistance",formatSummaryPrice(resistance));setSummary("bottomSupport",formatSummaryPrice(support));setSummary("bottomResistance",formatSummaryPrice(resistance));
  const rf=document.getElementById("rangeFill");if(rf&&rangePct!=null)rf.style.width=Math.max(0,Math.min(100,rangePct))+"%";setSummary("rangeLow",formatSummaryPrice(d.year_low));setSummary("rangeHigh",formatSummaryPrice(d.year_high));
  const buy=[];if(above20)buy.push("Price is above 20 DMA.");if(above50)buy.push("Price is above 50 DMA.");if(rsi>=50&&rsi<=70)buy.push("RSI is in a healthy zone.");if(volRatio>1)buy.push("Volume is above its 20-day average.");if(ret20>0)buy.push("Recent 20-day momentum is positive.");document.getElementById("whyBuy").innerHTML=buy.map(x=>`<li>${x}</li>`).join("")||"<li>No strong positive technical signal right now.</li>";
  const not=[];if(d200!==null&&!above200)not.push("Price is below 200 DMA.");if(rsi>70)not.push("RSI is in overbought territory.");if(rsi<40)not.push("RSI is weak.");if(!above20)not.push("Price is below 20 DMA.");if(ret20<0)not.push("20-day momentum is negative.");document.getElementById("whyNot").innerHTML=not.map(x=>`<li>${x}</li>`).join("")||"<li>No major technical warning detected.</li>";
  const risks=[];if(d200!==null&&!above200)risks.push("Long-term trend is below 200 DMA.");if(vol20>4)risks.push("Price volatility is elevated.");if(rsi>70)risks.push("Short-term overbought condition.");if(rangePct!=null&&rangePct<20)risks.push("Price is near the lower end of its 52-week range.");document.getElementById("topRisks").innerHTML=risks.map(x=>`<li>${x}</li>`).join("")||"<li>Continue monitoring price, volume and market conditions.</li>";
  document.getElementById("drivers").innerHTML=[`<li>Price trend: ${above20?"above":"below"} 20 DMA.</li>`,`<li>20-day momentum: ${fmtPct(ret20)}.</li>`,`<li>Volume ratio: ${volRatio==null?"--":volRatio.toFixed(2)+"x"}.</li>`].join("");
  setSummary("longTerm",total>=70?"ACCUMULATE":total>=50?"WATCH":"WAIT");setSummary("shortTerm",total>=70?"BUY SETUP":total>=50?"WAIT":"AVOID");
  renderPeerComparison(normalized);
 }catch(e){alert("Summary load nahi ho paaya.\n\n"+e.message);}
}
function quickSelectSummary(symbol){showSummaryQuote(symbol);}
window.showSummaryQuote=showSummaryQuote;window.quickSelectSummary=quickSelectSummary;window.quickSelectStock=quickSelectSummary;
document.addEventListener("DOMContentLoaded",()=>{const input=document.getElementById("stockInput");if(input){input.addEventListener("input",showSummarySuggestions);input.addEventListener("keydown",handleSummarySearch);}document.addEventListener("click",e=>{const w=document.querySelector(".search-wrapper"),b=document.getElementById("stockSuggestions");if(w&&!w.contains(e.target)&&b)b.style.display="none";});showSummaryQuote("RELIANCE");});
