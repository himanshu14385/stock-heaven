const summaryStockList = [
    ["RELIANCE", "Reliance Industries Limited"], ["TCS", "Tata Consultancy Services Limited"], ["HDFCBANK", "HDFC Bank Limited"], ["INFY", "Infosys Limited"], ["ICICIBANK", "ICICI Bank Limited"], ["SBIN", "State Bank of India"], ["ITC", "ITC Limited"], ["BHARTIARTL", "Bharti Airtel Limited"], ["TATAGOLD", "Tata Gold Exchange Traded Fund"], ["TATASILV.NS", "Tata Silver Exchange Traded Fund"], ["NIFTYCASE.NS", "Zerodha Nifty 50 ETF"], ["FMCGIETF.NS", "ICICI Prudential Nifty FMCG ETF"], ["MIDCAPIETF.NS", "ICICI Prudential Nifty Midcap 150 ETF"], ["ADANIGREEN", "Adani Green Energy Limited"], ["ADANIENSOL", "Adani Energy Solutions Limited"], ["AWL", "Adani Wilmar Limited"], ["NSLNISP", "NMDC Steel"], ["TMPV", "Tata Motors Passenger Vehicles"]
];

function cleanSummarySymbol(s) { return (s || "").trim().toUpperCase(); }
function formatSummaryPrice(v) { return v == null || Number.isNaN(Number(v)) ? "--" : `₹${Number(v).toLocaleString("en-IN", {minimumFractionDigits:2, maximumFractionDigits:2})}`; }
function setSummary(id, value) { const el=document.getElementById(id); if(el) el.textContent=value; }
function sma(a,n){ if(!a || a.length<n)return null; return a.slice(-n).reduce((x,y)=>x+Number(y),0)/n; }
function rsi14(a){ if(!a || a.length<15)return null; let gains=0,losses=0; for(let i=a.length-14;i<a.length;i++){const d=Number(a[i])-Number(a[i-1]); if(d>0)gains+=d; else losses-=d;} const ag=gains/14, al=losses/14; if(al===0)return 100; return 100-(100/(1+ag/al)); }

function showSummarySuggestions(){
    const input=document.getElementById("stockInput"); const box=document.getElementById("stockSuggestions"); if(!input||!box)return;
    const q=input.value.trim().toUpperCase(); if(!q){box.style.display="none";box.innerHTML="";return;}
    const matches=summaryStockList.filter(s=>s[0].toUpperCase().includes(q)||s[1].toUpperCase().includes(q)).slice(0,7);
    box.innerHTML=matches.map(s=>`<div class="stock-suggestion" onclick="showSummaryQuote('${s[0].replace(/'/g,"\\'")}')"><div class="suggestion-icon"><i class="fa-solid fa-chart-line"></i></div><div class="suggestion-info"><span class="suggestion-name">${s[1]}</span><span class="suggestion-symbol">NSE · <strong>${s[0]}</strong></span></div></div>`).join("");
    box.style.display=matches.length?"block":"none";
}
function handleSummarySearch(e){if(e.key==="Enter")showSummaryQuote(document.getElementById("stockInput").value);}
async function showSummaryQuote(symbol){
    const normalized=cleanSummarySymbol(symbol); if(!normalized)return;
    const input=document.getElementById("stockInput"); const box=document.getElementById("stockSuggestions"); if(input)input.value=normalized; if(box){box.style.display="none";box.innerHTML="";}
    try{
      const r=await fetch(`/api/stock?symbol=${encodeURIComponent(normalized)}`); const d=await r.json(); if(!r.ok||d.error)throw new Error(d.error||"Stock not found");
      const found=summaryStockList.find(s=>cleanSummarySymbol(s[0])===normalized);
      const h=(d.history||[]).map(x=>Number(x.close)).filter(Number.isFinite); const vols=(d.history||[]).map(x=>Number(x.volume||0)).filter(Number.isFinite);
      const price=Number(d.price), d20=sma(h,20), d50=sma(h,50), d200=sma(h,200), r=rsi14(h), avgVol=sma(vols,20), recent=h.slice(-20);
      const support=recent.length?Math.min(...recent):null, resistance=recent.length?Math.max(...recent):null;
      const nearHigh=d.year_high?((Number(d.year_high)-price)/Number(d.year_high))*100:null;
      const above20=d20!==null&&price>d20, above50=d50!==null&&price>d50, above200=d200!==null&&price>d200;
      let score=0; if(above20)score+=20; if(above50)score+=20; if(d200!==null&&above200)score+=20; if(r!==null){if(r>=50&&r<=70)score+=20;else if(r>=40&&r<50)score+=12;else if(r>70)score+=8;} if(avgVol!==null&&Number(d.volume)>avgVol)score+=20; score=Math.round(score);
      const verdict=score>=75?"BUY":score>=55?"WATCH":"CAUTION";
      setSummary("summarySymbol",normalized.replace(/\.NS$/,"")); setSummary("summaryCompany",found?found[1]:normalized); setSummary("summaryPrice",formatSummaryPrice(price)); setSummary("summaryChange",`${Number(d.change)>=0?"+":""}${Number(d.change).toFixed(2)} (${Number(d.percent_change)>=0?"+":""}${Number(d.percent_change).toFixed(2)}%)`); setSummary("summaryHigh",formatSummaryPrice(d.day_high)); setSummary("summaryLow",formatSummaryPrice(d.day_low)); setSummary("summary52High",formatSummaryPrice(d.year_high)); setSummary("summary52Low",formatSummaryPrice(d.year_low));
      const ch=document.getElementById("summaryChange"); if(ch)ch.classList.toggle("negative",Number(d.change)<0);
      setSummary("verdict",verdict); setSummary("verdictText",`Technical score ${score}/100 based on trend, moving averages, RSI and volume.`);
      setSummary("techTrend",above20&&above50?"Bullish ↑":(!above20&&!above50?"Weak ↓":"Mixed →")); setSummary("tech20",d20===null?"--":above20?"Above ↑":"Below ↓"); setSummary("tech50",d50===null?"--":above50?"Above ↑":"Below ↓"); setSummary("tech200",d200===null?"N/A":above200?"Above ↑":"Below ↓"); setSummary("techRSI",r===null?"--":r.toFixed(1)); setSummary("techVolume",avgVol===null?"--":Number(d.volume)>avgVol?"High ↑":"Normal"); setSummary("techSupport",formatSummaryPrice(support)); setSummary("techResistance",formatSummaryPrice(resistance));
      const risk=Math.max(1,Math.min(10,Math.round(10-(score/100)*9))); setSummary("riskScore",risk); setSummary("riskLabel",risk<=3?"Low":risk<=6?"Moderate":"High"); setSummary("riskText",`Technical risk score derived from the current setup: ${risk}/10.`);
      const rf=document.getElementById("rangeFill"); if(rf&&d.year_low!=null&&d.year_high!=null&&Number(d.year_high)>Number(d.year_low)){const pct=((price-Number(d.year_low))/(Number(d.year_high)-Number(d.year_low)))*100;rf.style.width=Math.max(0,Math.min(100,pct))+"%";} setSummary("rangeLow",formatSummaryPrice(d.year_low));setSummary("rangeHigh",formatSummaryPrice(d.year_high));
      document.getElementById("whyBuy").innerHTML=(above20?["Price is above 20 DMA."]:[]).concat(above50?["Price is above 50 DMA."]:[]).concat(r!==null&&r>=50&&r<=70?["RSI is in a relatively healthy zone."]:[]).concat(Number(d.volume)>avgVol?["Volume is above its 20-day average."]:[]).map(x=>`<li>${x}</li>`).join("")||"<li>Technical setup does not currently provide a strong positive signal.</li>";
      document.getElementById("whyNot").innerHTML=(d200!==null&&!above200?["Price is below 200 DMA."]:[]).concat(r!==null&&r>70?["RSI is in overbought territory."]:[]).concat(r!==null&&r<40?["RSI is weak."]:[]).concat(!above20?["Price is below 20 DMA."]:[]).map(x=>`<li>${x}</li>`).join("")||"<li>No major technical warning detected from the available data.</li>";
      document.getElementById("topRisks").innerHTML=(d200!==null&&!above200?["Long-term trend is below 200 DMA."]:[]).concat(r!==null&&r>70?["Short-term overbought condition."]:[]).concat(r!==null&&r<40?["Weak momentum."]:[]).concat(nearHigh!==null&&nearHigh<5?["Price is close to the 52-week high."]:[]).map(x=>`<li>${x}</li>`).join("")||"<li>Continue monitoring price, volume and market conditions.</li>";
      setSummary("longTerm",score>=70?"ACCUMULATE":"WATCH"); setSummary("shortTerm",score>=70?"BUY SETUP":score>=50?"WAIT":"AVOID");
    }catch(e){alert("Summary load nahi ho paaya.\n\n"+e.message);}
}

function quickSummarySelect(symbol){showSummaryQuote(symbol);}
window.showSummaryQuote=showSummaryQuote; window.quickSelectStock=quickSummarySelect;

document.addEventListener("DOMContentLoaded",()=>{
 const input=document.getElementById("stockInput"); if(input){input.setAttribute("oninput","showSummarySuggestions()"); input.setAttribute("onkeydown","handleSummarySearch(event)");}
 document.addEventListener("click",e=>{const w=document.querySelector(".search-wrapper"),b=document.getElementById("stockSuggestions");if(w&&!w.contains(e.target)&&b){b.style.display="none";}});
 showSummaryQuote("RELIANCE");
});
