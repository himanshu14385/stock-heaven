function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
  });
}

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/json,text/plain,*/*",
  "Accept-Language": "en-IN,en;q=0.9",
  "Referer": "https://scanx.trade/"
};

function stripTags(s) {
  return String(s || "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#8377;/gi, "₹")
    .replace(/\s+/g, " ")
    .trim();
}
function num(v) {
  if (v == null) return null;
  const s = stripTags(v).replace(/,/g, "").replace(/₹/g, "").replace(/%/g, "").trim();
  if (!s || s === "-" || s === "—") return null;
  const n = Number(s.replace(/[^0-9.+-]/g, ""));
  return Number.isFinite(n) ? n : null;
}
function slugifyName(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\bprivate\b/g, "private")
    .replace(/\blimited\b/g, "ltd")
    .replace(/\bltd\.\b/g, "ltd")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
function uniq(a) { return [...new Set(a.filter(Boolean))]; }

async function fetchText(url) {
  const r = await fetch(url, { headers: HEADERS, redirect: "follow" });
  if (!r.ok) return null;
  return await r.text();
}

async function resolveCompany(symbol) {
  const clean = String(symbol || "").trim().toUpperCase().replace(/\.NS$/i, "");
  if (!clean) return null;
  try {
    const r = await fetch(`https://www.screener.in/api/company/search/?q=${encodeURIComponent(clean)}`, {
      headers: { ...HEADERS, Referer: "https://www.screener.in/" }
    });
    if (r.ok) {
      const arr = await r.json();
      const items = Array.isArray(arr) ? arr : [];
      const exact = items.find(x => {
        const m = String(x.url || "").match(/\/company\/([^/]+)\//);
        return m && m[1].toUpperCase() === clean;
      });
      const hit = exact || items[0];
      if (hit) {
        const m = String(hit.url || "").match(/\/company\/([^/]+)\//);
        if (m) return { symbol: m[1].toUpperCase(), name: hit.name || clean };
      }
    }
  } catch (_) {}
  return { symbol: clean, name: clean };
}

function parsePeerTables(html, selected) {
  const tables = [...String(html || "").matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)].map(m => m[0]);
  let best = [];

  for (const table of tables) {
    const plain = stripTags(table).toLowerCase();
    if (!plain.includes("peer comparison") && !plain.includes("competitors") && !plain.includes("p/e ratio")) continue;

    const rows = [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(m => m[1]);
    let headers = [];
    const parsed = [];
    for (const row of rows) {
      const th = [...row.matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi)].map(m => stripTags(m[1]).toUpperCase());
      if (th.length) { headers = th; continue; }
      const td = [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(m => m[1]);
      if (td.length >= 2) parsed.push(td);
    }

    if (!parsed.length) continue;

    const h = headers.join(" | ");
    let nameIdx = headers.findIndex(x => x.includes("COMPETITOR") || x === "NAME" || x.includes("STOCK"));
    let ltpIdx = headers.findIndex(x => x.includes("LTP") || x.includes("CMP"));
    let peIdx = headers.findIndex(x => x.includes("P/E") || x.includes("PE RATIO"));
    let rsiIdx = headers.findIndex(x => x.includes("RSI"));

    // ScanX currently renders: Competitors | LTP | Market Cap | P/E Ratio | ... | RSI
    if (nameIdx < 0) nameIdx = 0;
    if (ltpIdx < 0) ltpIdx = 1;
    if (peIdx < 0) peIdx = 3;
    if (rsiIdx < 0) rsiIdx = headers.length ? headers.length - 1 : 8;

    const peers = [];
    for (const cells of parsed) {
      const nameCell = cells[nameIdx] || "";
      const name = stripTags(nameCell);
      if (!name) continue;
      const lower = name.toLowerCase();
      const selectedName = String(selected.name || "").toLowerCase();
      const selectedSymbol = String(selected.symbol || "").toLowerCase();
      if (lower === selectedName || lower.includes(selectedSymbol) || selectedName.includes(lower)) continue;

      const ltp = num(cells[ltpIdx]);
      const pe = num(cells[peIdx]);
      const rsi = num(cells[rsiIdx]);
      if (ltp == null && pe == null && rsi == null) continue;

      const link = nameCell.match(/href=["'](?:https?:\/\/[^"']+)?\/company\/([^/"']+)/i);
      const peerKey = link ? link[1].toUpperCase() : slugifyName(name);
      peers.push({ symbol: peerKey, name, ltp, pe, rsi });
      if (peers.length >= 10) break;
    }
    if (peers.length > best.length) best = peers;
  }
  return best;
}

async function fetchSelectedMetrics(symbol, fallbackName) {
  const clean = String(symbol || "").trim().toUpperCase().replace(/\.NS$/i, "");
  let pe = null;
  try {
    const html = await fetchText(`https://www.screener.in/company/${encodeURIComponent(clean)}/`);
    if (html) {
      const m = html.match(/Stock P\/E[\s\S]{0,1200}?class=["']number["'][^>]*>\s*([^<]+)/i) ||
                html.match(/Stock P\/E[\s\S]{0,1200}?([0-9]+(?:\.[0-9]+)?)/i);
      if (m) pe = num(m[1]);
    }
  } catch (_) {}
  return { symbol: clean, name: fallbackName || clean, pe };
}

async function fetchYahooScreener(scrId) {
  const u = `https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?count=50&scrIds=${encodeURIComponent(scrId)}&region=IN&lang=en-IN`;
  try {
    const r = await fetch(u, { headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json,text/plain,*/*" } });
    if (!r.ok) return [];
    const body = await r.json();
    return body?.finance?.result?.[0]?.quotes || [];
  } catch (_) { return []; }
}
function marketQuote(q) {
  const symbol = String(q.symbol || "").toUpperCase();
  if (!symbol.endsWith(".NS")) return null;
  const name = q.longName || q.shortName || symbol.replace(/\.NS$/i, "");
  const price = Number(q.regularMarketPrice);
  const changePercent = Number(q.regularMarketChangePercent);
  return {
    symbol: symbol.replace(/\.NS$/i, ""),
    name,
    price: Number.isFinite(price) ? price : null,
    changePercent: Number.isFinite(changePercent) ? changePercent : null,
    distanceFrom52Low: Number.isFinite(Number(q.fiftyTwoWeekLow)) && Number.isFinite(price) && Number(q.fiftyTwoWeekLow) > 0
      ? ((price - Number(q.fiftyTwoWeekLow)) / Number(q.fiftyTwoWeekLow)) * 100 : null
  };
}


async function fetchEquityPanditQuote(symbol) {
  const clean = String(symbol || "").trim().toLowerCase().replace(/\.ns$/i, "");
  if (!clean) return null;
  try {
    const html = await fetchText(`https://www.equitypandit.com/historical-data/${encodeURIComponent(clean)}`);
    if (!html) return null;

    const rows = [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
      .map(m => [...m[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(x => stripTags(x[1])))
      .filter(cells => cells.length >= 6);

    const dateRe = /^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/;
    const parsed = [];
    for (const cells of rows) {
      const dateText = String(cells[0] || "").trim();
      if (!dateRe.test(dateText)) continue;
      const price = num(cells[1]);
      const open = num(cells[2]);
      const high = num(cells[3]);
      const low = num(cells[4]);
      const volume = num(cells[5]);
      if ([price, open, high, low].some(v => v == null)) continue;
      parsed.push({ date: dateText, price, open, high, low, volume });
      if (parsed.length >= 2) break;
    }
    if (!parsed.length) return null;

    const latest = parsed[0];
    const previous = parsed[1] || latest;
    const change = latest.price - previous.price;
    const percentChange = previous.price ? (change / previous.price) * 100 : 0;
    return {
      price: latest.price,
      previous_close: previous.price,
      change,
      percent_change: percentChange,
      day_open: latest.open,
      day_high: latest.high,
      day_low: latest.low,
      volume: latest.volume,
      as_of: latest.date,
      price_source: "EquityPandit NSE historical data",
      ohlc_source: "EquityPandit NSE historical data",
      previous_date: previous.date
    };
  } catch (_) { return null; }
}

async function fetchSelectedPE(symbol) {
  const clean = String(symbol || "").trim().toUpperCase().replace(/\.NS$/i, "");
  try {
    const html = await fetchText(`https://www.screener.in/company/${encodeURIComponent(clean)}/`);
    if (!html) return null;
    const m = html.match(/Stock P\/E[\s\S]{0,500}?class=["']number["'][^>]*>\s*([^<]+)/i) ||
              html.match(/Stock P\/E[\s\S]{0,500}?([0-9]+(?:\.[0-9]+)?)/i);
    return m ? num(m[1]) : null;
  } catch (_) { return null; }
}
const SERVER_PEER_FALLBACKS = {
  RELIANCE:[['ONGC','Oil & Natural Gas Corporation'],['IOC','Indian Oil Corporation'],['BPCL','Bharat Petroleum Corporation'],['HINDPETRO','Hindustan Petroleum Corporation'],['MRPL','Mangalore Refinery & Petroleum'],['CHENNPETRO','Chennai Petroleum Corporation'],['GAIL','GAIL (India) Limited']],
  TCS:[['INFY','Infosys Limited'],['HCLTECH','HCL Technologies'],['WIPRO','Wipro Limited'],['TECHM','Tech Mahindra'],['LTIM','LTIMindtree'],['MPHASIS','Mphasis'],['COFORGE','Coforge']],
  INFY:[['TCS','Tata Consultancy Services'],['HCLTECH','HCL Technologies'],['WIPRO','Wipro Limited'],['TECHM','Tech Mahindra'],['LTIM','LTIMindtree'],['MPHASIS','Mphasis'],['COFORGE','Coforge']],
  HDFCBANK:[['ICICIBANK','ICICI Bank'],['SBIN','State Bank of India'],['AXISBANK','Axis Bank'],['KOTAKBANK','Kotak Mahindra Bank'],['INDUSINDBK','IndusInd Bank'],['BANKBARODA','Bank of Baroda'],['PNB','Punjab National Bank']],
  ICICIBANK:[['HDFCBANK','HDFC Bank'],['SBIN','State Bank of India'],['AXISBANK','Axis Bank'],['KOTAKBANK','Kotak Mahindra Bank'],['INDUSINDBK','IndusInd Bank'],['BANKBARODA','Bank of Baroda'],['PNB','Punjab National Bank']],
  SBIN:[['HDFCBANK','HDFC Bank'],['ICICIBANK','ICICI Bank'],['AXISBANK','Axis Bank'],['KOTAKBANK','Kotak Mahindra Bank'],['BANKBARODA','Bank of Baroda'],['PNB','Punjab National Bank'],['CANBK','Canara Bank']],
  ITC:[['HINDUNILVR','Hindustan Unilever'],['NESTLEIND','Nestle India'],['BRITANNIA','Britannia Industries'],['GODREJCP','Godrej Consumer Products'],['MARICO','Marico'],['DABUR','Dabur India']],
  BHARTIARTL:[['TATACOMM','Tata Communications'],['INDUSTOWER','Indus Towers'],['IDEA','Vodafone Idea'],['RCOM','Reliance Communications'],['JIOFIN','Jio Financial Services']],
  AWL:[['DABUR','Dabur India'],['GODREJCP','Godrej Consumer Products'],['EMAMILTD','Emami'],['MARICO','Marico'],['HINDUNILVR','Hindustan Unilever'],['ITC','ITC Limited']],
  ADANIENSOL:[['ADANIGREEN','Adani Green Energy'],['NTPC','NTPC'],['POWERGRID','Power Grid Corporation'],['TATAPOWER','Tata Power'],['JSWENERGY','JSW Energy'],['ADANIPOWER','Adani Power']],
  ADANIGREEN:[['ADANIPOWER','Adani Power'],['NTPC','NTPC'],['POWERGRID','Power Grid Corporation'],['TATAPOWER','Tata Power'],['JSWENERGY','JSW Energy'],['RPOWER','Reliance Power']],
  NSLNISP:[['JINDALSTEL','Jindal Steel & Power'],['SAIL','Steel Authority of India'],['TATASTEEL','Tata Steel'],['JSWSTEEL','JSW Steel'],['HINDALCO','Hindalco Industries'],['NMDC','NMDC']],
  TMPV:[['MARUTI','Maruti Suzuki India'],['M&M','Mahindra & Mahindra'],['EICHERMOT','Eicher Motors'],['HEROMOTOCO','Hero MotoCorp'],['BAJAJ-AUTO','Bajaj Auto']],
  HINDUNILVR:[['ITC','ITC Limited'],['NESTLEIND','Nestle India'],['BRITANNIA','Britannia Industries'],['GODREJCP','Godrej Consumer Products'],['MARICO','Marico'],['DABUR','Dabur India']],
  AXISBANK:[['HDFCBANK','HDFC Bank'],['ICICIBANK','ICICI Bank'],['SBIN','State Bank of India'],['KOTAKBANK','Kotak Mahindra Bank'],['INDUSINDBK','IndusInd Bank']],
  KOTAKBANK:[['HDFCBANK','HDFC Bank'],['ICICIBANK','ICICI Bank'],['SBIN','State Bank of India'],['AXISBANK','Axis Bank'],['INDUSINDBK','IndusInd Bank']],
  TATAGOLD:[['GOLDBEES','Nippon India ETF Gold BeES']],
  GOLDBEES:[['TATAGOLD','Tata Gold Exchange Traded Fund']],
  ITBEES:[['TCS','Tata Consultancy Services'],['INFY','Infosys Limited'],['HCLTECH','HCL Technologies'],['WIPRO','Wipro Limited'],['TECHM','Tech Mahindra']],
  BANKBEES:[['HDFCBANK','HDFC Bank'],['ICICIBANK','ICICI Bank'],['SBIN','State Bank of India'],['AXISBANK','Axis Bank'],['KOTAKBANK','Kotak Mahindra Bank']]
};
function serverFallbackPeers(symbol){
  const key=String(symbol||'').trim().toUpperCase().replace(/\.NS$/i,'');
  const list=SERVER_PEER_FALLBACKS[key]||[['HDFCBANK','HDFC Bank'],['ICICIBANK','ICICI Bank'],['SBIN','State Bank of India'],['AXISBANK','Axis Bank'],['KOTAKBANK','Kotak Mahindra Bank'],['ITC','ITC Limited'],['TCS','Tata Consultancy Services']];
  return list.map(([symbol,name])=>({symbol,name,ltp:null,pe:null,rsi:null}));
}

function parseScreenerPeerTables(html, selectedSymbol){
  const tables=[...String(html||'').matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)].map(m=>m[0]);
  let best=[];
  const selected=String(selectedSymbol||'').toUpperCase().replace(/\.NS$/i,'');
  for(const table of tables){
    const headerMatch=table.match(/<thead[\s\S]*?<\/thead>/i);
    const header=stripTags(headerMatch?headerMatch[0]:table).toLowerCase();
    if(!(/p\s*\/\s*e|p\.e/.test(header) && /(cmp|current market price|price)/.test(header))) continue;
    const rows=[...table.matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi)].map(m=>m[0]);
    const headCells=headerMatch?[...headerMatch[0].matchAll(/<t[dh]\b[^>]*>[\s\S]*?<\/t[dh]>/gi)].map(m=>stripTags(m[0]).toLowerCase()):[];
    const cmpIdx=headCells.findIndex(x=>/cmp|current market price|price/.test(x));
    const peIdx=headCells.findIndex(x=>/p\s*\/\s*e|p\.e/.test(x));
    const peers=[];
    for(const row of rows){
      const cells=[...row.matchAll(/<t[dh]\b[^>]*>[\s\S]*?<\/t[dh]>/gi)].map(m=>m[0]);
      if(cells.length<3) continue;
      const plain=cells.map(c=>stripTags(c));
      const nameCell=cells.find(c=>/href=["'][^"']*\/company\//i.test(c)) || cells[0];
      const link=nameCell.match(/\/company\/([^/"']+)/i);
      const symbol=link?link[1].toUpperCase():'';
      const name=stripTags(nameCell).replace(/\s+/g,' ').trim();
      if(!name || !symbol || symbol===selected) continue;
      const ltp=cmpIdx>=0?num(plain[cmpIdx]):num(plain[1]);
      const pe=peIdx>=0?num(plain[peIdx]):num(plain[2]);
      if(ltp==null && pe==null) continue;
      peers.push({symbol,name,ltp,pe,rsi:null});
      if(peers.length>=10) break;
    }
    if(peers.length>best.length) best=peers;
  }
  return best;
}

async function fetchDynamicPeers(symbol) {
  const company = await resolveCompany(symbol);
  if (!company) return null;

  const screenerHtml = await fetchText(`https://www.screener.in/company/${encodeURIComponent(company.symbol)}/`);
  if (screenerHtml) {
    const peers = parseScreenerPeerTables(screenerHtml, company.symbol);
    if (peers.length) {
      const selected = await fetchSelectedMetrics(company.symbol, company.name);
      return { symbol: company.symbol, name: company.name, source: "Screener peer comparison", selected, peers: peers.slice(0, 10) };
    }
  }

  const base = slugifyName(company.name);
  const variants = uniq([
    base,
    base.replace(/-ltd$/, "-limited"),
    base.replace(/-limited$/, "-ltd"),
    base.replace(/-limited$/, ""),
    String(company.symbol).toLowerCase()
  ]);
  for (const slug of variants) {
    const html = await fetchText(`https://scanx.trade/company/${encodeURIComponent(slug)}/`);
    if (!html) continue;
    const peers = parsePeerTables(html, company);
    if (peers.length) {
      const selected = await fetchSelectedMetrics(company.symbol, company.name);
      return { symbol: company.symbol, name: company.name, source: "ScanX peer comparison", selected, peers: peers.slice(0, 10) };
    }
  }
  return { symbol: company.symbol, name: company.name, source: "Screener + ScanX + fallback", peers: serverFallbackPeers(company.symbol) };
}


const AUTH_PAGES = new Set(["index.html","stuck-stock.html","summary.html","alert.html","fav-stock.html","admin.html"]);
const DEFAULT_GUEST_USERNAME = "guest";
const DEFAULT_GUEST_PASSWORD = "Guest@2026";
const ADMIN_FALLBACK_USERNAME = "admin";
const ADMIN_FALLBACK_PASSWORD = "StockHeaven@2026";
const GUEST_SESSION_SECONDS = 5 * 60;
const ADMIN_SESSION_SECONDS = 10 * 365 * 24 * 60 * 60;

function authCookie(token, maxAge) {
  return `__Host-stock_heaven_session=${token}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}
function clearAuthCookie(){ return "__Host-stock_heaven_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax"; }
function getCookie(request,name){
  const raw=request.headers.get("Cookie")||"";
  for(const part of raw.split(";")){const [k,...v]=part.trim().split("=");if(k===name)return v.join("=");}
  return null;
}
function nowIso(){return new Date().toISOString();}
function bytesToB64(bytes){let s="";for(const b of bytes)s+=String.fromCharCode(b);return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");}
function b64ToBytes(s){const x=s.replace(/-/g,"+").replace(/_/g,"/")+"===".slice((s.length+3)%4);const bin=atob(x);return Uint8Array.from(bin,c=>c.charCodeAt(0));}
async function randomSecret(){return bytesToB64(crypto.getRandomValues(new Uint8Array(32)));}
async function sha256(text){const buf=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(text));return bytesToB64(new Uint8Array(buf));}
async function passwordHash(password,saltB64){
  const salt=saltB64?b64ToBytes(saltB64):crypto.getRandomValues(new Uint8Array(16));
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(password),"PBKDF2",false,["deriveBits"]);
  const bits=await crypto.subtle.deriveBits({name:"PBKDF2",salt,iterations:100000,hash:"SHA-256"},key,256);
  return {salt:bytesToB64(salt),hash:bytesToB64(new Uint8Array(bits))};
}
async function verifyPassword(password,hash,salt){const x=await passwordHash(password,salt);return x.hash===hash;}
async function authInit(env){
  if(!env.AUTH_DB) throw new Error("AUTH_DB binding missing");
  const db=env.AUTH_DB;
  // D1 schema is provisioned by schema.sql. Keep runtime initialization
  // lightweight and idempotent; do not run ALTER TABLE migrations per request.
  await db.prepare(`CREATE TABLE IF NOT EXISTS auth_settings (id INTEGER PRIMARY KEY CHECK (id=1),guest_username TEXT NOT NULL,guest_password_hash TEXT NOT NULL,guest_password_salt TEXT NOT NULL,guest_version INTEGER NOT NULL DEFAULT 1,updated_at TEXT NOT NULL)`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS auth_sessions (id INTEGER PRIMARY KEY AUTOINCREMENT,token_hash TEXT NOT NULL UNIQUE,role TEXT NOT NULL CHECK(role IN ('admin','guest')),username TEXT NOT NULL,created_at TEXT NOT NULL,expires_at TEXT)`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS auth_restrictions (page TEXT PRIMARY KEY,restricted INTEGER NOT NULL DEFAULT 0,updated_at TEXT NOT NULL)`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS auth_login_logs (id INTEGER PRIMARY KEY AUTOINCREMENT,role TEXT NOT NULL,username TEXT NOT NULL,login_at TEXT NOT NULL)`).run();
  const row=await db.prepare(`SELECT id FROM auth_settings WHERE id=1`).first();
  if(!row){
    const hp=await passwordHash(env.DEFAULT_GUEST_PASSWORD||DEFAULT_GUEST_PASSWORD);
    await db.prepare(`INSERT INTO auth_settings (id,guest_username,guest_password_hash,guest_password_salt,guest_version,updated_at) VALUES (1,?,?,?,?,?)`).bind(env.DEFAULT_GUEST_USERNAME||DEFAULT_GUEST_USERNAME,hp.hash,hp.salt,1,nowIso()).run();
  }
  for(const page of ["index.html","stuck-stock.html","summary.html","alert.html","fav-stock.html"]){
    await db.prepare(`INSERT OR IGNORE INTO auth_restrictions(page,restricted,updated_at) VALUES (?,0,?)`).bind(page,nowIso()).run();
  }
}
async function currentAuth(request,env){
  await authInit(env);
  const token=getCookie(request,"__Host-stock_heaven_session"); if(!token)return null;
  const th=await sha256(token);
  const row=await env.AUTH_DB.prepare(`SELECT role,username,created_at,expires_at FROM auth_sessions WHERE token_hash=?`).bind(th).first();
  if(!row)return null;
  if(row.expires_at && new Date(row.expires_at).getTime()<=Date.now()){await env.AUTH_DB.prepare(`DELETE FROM auth_sessions WHERE token_hash=?`).bind(th).run();return null;}
  return row;
}
async function createSession(env,role,username){
  const token=await randomSecret(), th=await sha256(token), now=Date.now();
  const expires=role==='guest'?new Date(now+GUEST_SESSION_SECONDS*1000).toISOString():null;
  await env.AUTH_DB.prepare(`INSERT INTO auth_sessions(token_hash,role,username,created_at,expires_at) VALUES (?,?,?,?,?)`).bind(th,role,username,new Date(now).toISOString(),expires).run();
  return {token,expiresAt:expires};
}
async function requireAdmin(request,env){const s=await currentAuth(request,env);return s&&s.role==='admin'?s:null;}
function adminCreds(env){return {username:env.ADMIN_USERNAME||ADMIN_FALLBACK_USERNAME,password:env.ADMIN_PASSWORD||ADMIN_FALLBACK_PASSWORD};}
async function authJson(request,env,url){
  if(url.pathname==='/api/auth/login'&&request.method==='POST'){
    await authInit(env); let body={};try{body=await request.json()}catch(_){return json({error:"Invalid request"},400)}
    const role=body.role==='admin'?'admin':'guest', username=String(body.username||'').trim(), password=String(body.password||'');
    if(!username||!password)return json({error:"Username and password required"},400);
    let ok=false, loginUsername=username;
    if(role==='admin'){const c=adminCreds(env);ok=username===c.username&&password===c.password;}
    else {const row=await env.AUTH_DB.prepare(`SELECT guest_username,guest_password_hash,guest_password_salt FROM auth_settings WHERE id=1`).first();ok=!!row&&username===row.guest_username&&await verifyPassword(password,row.guest_password_hash,row.guest_password_salt);loginUsername=row?.guest_username||username;}
    if(!ok)return json({error:"Invalid credentials"},401);
    const session=await createSession(env,role,loginUsername);
    await env.AUTH_DB.prepare(`INSERT INTO auth_login_logs(role,username,login_at) VALUES (?,?,?)`).bind(role,loginUsername,nowIso()).run();
    const headers=new Headers({"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","Set-Cookie":authCookie(session.token,role==='guest'?GUEST_SESSION_SECONDS:ADMIN_SESSION_SECONDS)});
    return new Response(JSON.stringify({ok:true,session:{role,username:loginUsername,expiresAt:session.expiresAt}}),{status:200,headers});
  }
  if(url.pathname==='/api/auth/me'&&request.method==='GET'){
    const s=await currentAuth(request,env); if(!s)return json({authenticated:false},401);
    return json({authenticated:true,session:{role:s.role,username:s.username,loginAt:s.created_at,expiresAt:s.expires_at}});
  }
  if(url.pathname==='/api/auth/logout'&&request.method==='POST'){
    const token=getCookie(request,"__Host-stock_heaven_session");if(token){await env.AUTH_DB.prepare(`DELETE FROM auth_sessions WHERE token_hash=?`).bind(await sha256(token)).run();}
    return new Response(JSON.stringify({ok:true}),{status:200,headers:new Headers({"Content-Type":"application/json","Cache-Control":"no-store","Set-Cookie":clearAuthCookie()})});
  }
  if(url.pathname==='/api/admin/guest-credentials'){
    if(request.method==='GET'){if(!await requireAdmin(request,env))return json({error:"Admin only"},403);const row=await env.AUTH_DB.prepare(`SELECT guest_username,guest_version,updated_at FROM auth_settings WHERE id=1`).first();return json({username:row.guest_username,version:row.guest_version,updatedAt:row.updated_at});}
    if(request.method==='POST'){if(!await requireAdmin(request,env))return json({error:"Admin only"},403);let b={};try{b=await request.json()}catch(_){return json({error:"Invalid request"},400)}const u=String(b.username||'').trim(),p=String(b.password||'');if(u.length<3||p.length<4)return json({error:"Username min 3 and password min 4 characters"},400);const hp=await passwordHash(p);const old=await env.AUTH_DB.prepare(`SELECT guest_version FROM auth_settings WHERE id=1`).first();const version=Number(old?.guest_version||0)+1;await env.AUTH_DB.prepare(`UPDATE auth_settings SET guest_username=?,guest_password_hash=?,guest_password_salt=?,guest_version=?,updated_at=? WHERE id=1`).bind(u,hp.hash,hp.salt,version,nowIso()).run();await env.AUTH_DB.prepare(`DELETE FROM auth_sessions WHERE role='guest'`).run();return json({ok:true,username:u,version});}
  }
  if(url.pathname==='/api/auth/restrictions' && request.method==='GET'){
    const s=await currentAuth(request,env);
    if(!s)return json({error:'Authentication required'},401);
    const rows=await env.AUTH_DB.prepare(`SELECT page,restricted FROM auth_restrictions`).all();
    const restrictions={};
    for(const r of rows.results||[]) restrictions[r.page]=!!r.restricted;
    return json({restrictions});
  }
  if(url.pathname==='/api/admin/restrictions'){
    if(!await requireAdmin(request,env))return json({error:"Admin only"},403);
    if(request.method==='GET'){const rows=await env.AUTH_DB.prepare(`SELECT page,restricted FROM auth_restrictions`).all();const restrictions={};for(const r of rows.results||[])restrictions[r.page]=!!r.restricted;return json({restrictions});}
    if(request.method==='POST'){let b={};try{b=await request.json()}catch(_){return json({error:"Invalid request"},400)}const r=b.restrictions||{};for(const page of ["index.html","stuck-stock.html","summary.html","alert.html","fav-stock.html"]){await env.AUTH_DB.prepare(`INSERT INTO auth_restrictions(page,restricted,updated_at) VALUES (?,?,?) ON CONFLICT(page) DO UPDATE SET restricted=excluded.restricted,updated_at=excluded.updated_at`).bind(page,r[page]?1:0,nowIso()).run();}return json({ok:true});}
  }
  if(url.pathname==='/api/admin/login-log'){
    if(!await requireAdmin(request,env))return json({error:"Admin only"},403);
    if(request.method==='GET'){const rows=await env.AUTH_DB.prepare(`SELECT role,username,login_at FROM auth_login_logs ORDER BY id DESC LIMIT 200`).all();return json({logs:(rows.results||[]).map(x=>({role:x.role,username:x.username,loginAt:x.login_at}))});}
    if(request.method==='DELETE'){await env.AUTH_DB.prepare(`DELETE FROM auth_login_logs`).run();return json({ok:true});}
  }
  return null;
}


const DEFAULT_STUCK = [
  {symbol:"AWL",name:"Adani Wilmar Limited",stuckInfo:"208 × 647.73"},
  {symbol:"ADANIENSOL",name:"Adani Energy Solutions Limited",stuckInfo:"33 × 2788.12"},
  {symbol:"AWL",name:"Adani Wilmar Limited",stuckInfo:"36 × 683.35"},
  {symbol:"ADANIGREEN",name:"Adani Green Energy",stuckInfo:"9 × 2333.43"},
  {symbol:"FMCGIETF.NS",name:"ICICI Pru Nifty FMCG ETF",stuckInfo:"550 × 56.07"},
  {symbol:"TMPV",name:"Tata Motors Passenger Vehicles",stuckInfo:"27 × 508.60"},
  {symbol:"NSLNISP",name:"NMDC Steel",stuckInfo:"31 × 52.85"}
];
const DEFAULT_ALERTS = [
 {symbol:"AWL",name:"AWL",alertPrice:""},{symbol:"ADANIENSOL",name:"ADANIENSOL",alertPrice:""},
 {symbol:"ADANIGREEN",name:"ADANIGREEN",alertPrice:""},{symbol:"NSLNISP",name:"NMDC Steel",alertPrice:""},
 {symbol:"TMPV",name:"TMPV",alertPrice:""},{symbol:"RELIANCE",name:"Reliance Industries",alertPrice:""},
 {symbol:"HDFCBANK",name:"HDFC Bank",alertPrice:""},{symbol:"TCS",name:"Tata Consultancy Services",alertPrice:""},
 {symbol:"INFY",name:"Infosys",alertPrice:""},{symbol:"HINDUNILVR",name:"Hindustan Unilever",alertPrice:""},
 {symbol:"ICICIBANK",name:"ICICI Bank",alertPrice:""},{symbol:"SBIN",name:"State Bank of India",alertPrice:""}
];

function parseStuckInfo(info){
  const m=String(info||"").match(/^\s*([0-9]+(?:\.[0-9]+)?)\s*[×x*]\s*([0-9]+(?:\.[0-9]+)?)\s*$/i);
  return {quantity:m?Number(m[1]):0,buyPrice:m?Number(m[2]):0};
}
async function getStuckData(env){
  let rows=await env.AUTH_DB.prepare(`SELECT id,symbol,name,quantity,buy_price,sort_order FROM stuck_stocks ORDER BY sort_order,id`).all();
  if(!(rows.results||[]).length){
    const stm=DEFAULT_STUCK.map((x,i)=>{const p=parseStuckInfo(x.stuckInfo);return env.AUTH_DB.prepare(`INSERT INTO stuck_stocks(symbol,name,quantity,buy_price,sort_order) VALUES (?,?,?,?,?)`).bind(x.symbol,x.name,p.quantity,p.buyPrice,i)});
    await env.AUTH_DB.batch(stm);
    rows=await env.AUTH_DB.prepare(`SELECT id,symbol,name,quantity,buy_price,sort_order FROM stuck_stocks ORDER BY sort_order,id`).all();
  }
  return (rows.results||[]).map(r=>({id:r.id,symbol:r.symbol,name:r.name||r.symbol,stuckInfo:`${r.quantity} × ${Number(r.buy_price).toFixed(2)}`}));
}
async function replaceStuckData(env,items){
  const arr=Array.isArray(items)?items:[];
  const stm=[env.AUTH_DB.prepare(`DELETE FROM stuck_stocks`)];
  arr.forEach((x,i)=>{const symbol=String(x.symbol||"").trim().toUpperCase();if(!symbol)return;const p=parseStuckInfo(x.stuckInfo);stm.push(env.AUTH_DB.prepare(`INSERT INTO stuck_stocks(symbol,name,quantity,buy_price,sort_order) VALUES (?,?,?,?,?)`).bind(symbol,String(x.name||symbol).trim(),p.quantity,p.buyPrice,i));});
  await env.AUTH_DB.batch(stm);
}
async function getAlertsData(env){
  let rows=await env.AUTH_DB.prepare(`SELECT id,symbol,name,target_price,sort_order FROM alerts ORDER BY sort_order,id`).all();
  if(!(rows.results||[]).length){
    await env.AUTH_DB.batch(DEFAULT_ALERTS.map((x,i)=>env.AUTH_DB.prepare(`INSERT INTO alerts(symbol,name,target_price,sort_order) VALUES (?,?,?,?)`).bind(x.symbol,x.name,x.alertPrice===""?null:Number(x.alertPrice),i)));
    rows=await env.AUTH_DB.prepare(`SELECT id,symbol,name,target_price,sort_order FROM alerts ORDER BY sort_order,id`).all();
  }
  return (rows.results||[]).map(r=>({id:r.id,symbol:r.symbol,name:r.name||r.symbol,alertPrice:r.target_price==null?"":String(r.target_price)}));
}
async function replaceAlertsData(env,items){
  const arr=Array.isArray(items)?items:[];
  const stm=[env.AUTH_DB.prepare(`DELETE FROM alerts`)];
  arr.forEach((x,i)=>{const symbol=String(x.symbol||"").trim().toUpperCase();if(!symbol)return;const raw=String(x.alertPrice??"").trim();const target=raw===""?null:Number(raw);stm.push(env.AUTH_DB.prepare(`INSERT INTO alerts(symbol,name,target_price,sort_order) VALUES (?,?,?,?)`).bind(symbol,String(x.name||symbol).trim(),Number.isFinite(target)?target:null,i));});
  await env.AUTH_DB.batch(stm);
}
async function getFavoritesData(env){
  const gr=await env.AUTH_DB.prepare(`SELECT id,title,sort_order,collapsed FROM favorite_groups ORDER BY sort_order,id`).all();
  const sr=await env.AUTH_DB.prepare(`SELECT id,group_id,symbol,name,note,sort_order FROM favorite_stocks ORDER BY group_id,sort_order,id`).all();
  const stocks=sr.results||[];
  return (gr.results||[]).map(g=>({id:g.id,title:g.title,collapsed:!!g.collapsed,stocks:stocks.filter(s=>s.group_id===g.id).map(s=>({id:s.id,symbol:s.symbol,name:s.name||s.symbol,note:s.note||""}))}));
}
async function replaceFavoritesData(env,groups){
  const gs=Array.isArray(groups)?groups:[];
  const stm=[env.AUTH_DB.prepare(`DELETE FROM favorite_stocks`),env.AUTH_DB.prepare(`DELETE FROM favorite_groups`)];
  gs.forEach((g,i)=>{const title=String(g.title||"").trim();if(title)stm.push(env.AUTH_DB.prepare(`INSERT INTO favorite_groups(title,sort_order,collapsed) VALUES (?,?,?)`).bind(title,i,g.collapsed?1:0));});
  await env.AUTH_DB.batch(stm);
  const fresh=await env.AUTH_DB.prepare(`SELECT id,sort_order FROM favorite_groups ORDER BY sort_order,id`).all();
  const ins=[];
  (fresh.results||[]).forEach((g,i)=>{const src=gs[i]||{};(Array.isArray(src.stocks)?src.stocks:[]).forEach((x,j)=>{const symbol=String(x.symbol||"").trim().toUpperCase();if(symbol)ins.push(env.AUTH_DB.prepare(`INSERT INTO favorite_stocks(group_id,symbol,name,note,sort_order) VALUES (?,?,?,?,?)`).bind(g.id,symbol,String(x.name||symbol).trim(),String(x.note||""),j));});});
  if(ins.length)await env.AUTH_DB.batch(ins);
}
async function dataJson(request,env,url){
  if(!url.pathname.startsWith('/api/data/'))return null;
  const session=await currentAuth(request,env);if(!session)return json({error:'Authentication required'},401);
  const admin=session.role==='admin';
  if(url.pathname==='/api/data/stuck'){
    if(request.method==='GET')return json({items:await getStuckData(env)});
    if(!admin)return json({error:'Admin only'},403);
    if(request.method==='PUT'){let b={};try{b=await request.json()}catch(_){return json({error:'Invalid request'},400)};await replaceStuckData(env,b.items);return json({ok:true,items:await getStuckData(env)});}
  }
  if(url.pathname==='/api/data/alerts'){
    if(request.method==='GET')return json({items:await getAlertsData(env)});
    if(!admin)return json({error:'Admin only'},403);
    if(request.method==='PUT'){let b={};try{b=await request.json()}catch(_){return json({error:'Invalid request'},400)};await replaceAlertsData(env,b.items);return json({ok:true,items:await getAlertsData(env)});}
  }
  if(url.pathname==='/api/data/favorites'){
    if(request.method==='GET')return json({groups:await getFavoritesData(env)});
    if(!admin)return json({error:'Admin only'},403);
    if(request.method==='PUT'){let b={};try{b=await request.json()}catch(_){return json({error:'Invalid request'},400)};await replaceFavoritesData(env,b.groups);return json({ok:true,groups:await getFavoritesData(env)});}
  }
  return json({error:'Method not allowed'},405);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/data/")) {
      try { const out = await dataJson(request, env, url); if (out) return out; } catch (e) { return json({ error: "Data service unavailable", detail: String(e?.message || e) }, 500); }
    }

    if (url.pathname.startsWith("/api/auth/") || url.pathname.startsWith("/api/admin/")) {
      try { const out = await authJson(request, env, url); if (out) return out; } catch (e) { return json({ error: "Authentication service unavailable", detail: String(e?.message || e) }, 500); }
    }

    const protectedPage = url.pathname === "/" ? "index.html" : url.pathname.replace(/^\//, "");
    if (AUTH_PAGES.has(protectedPage)) {
      let s;
      try { s = await currentAuth(request, env); }
      catch (e) {
        const msg=String(e?.message||e).replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]));
        return new Response(`<h1>Authentication service error</h1><p>Please refresh and try again.</p><pre>${msg}</pre>`,{status:500,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"}});
      }
      if (!s) return new Response("<h1>Login required</h1><p>Please login to Stock Heaven.</p><a href=\"/login.html\">Go to Login</a>",{status:401,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"}});
      if (protectedPage === "admin.html" && s.role !== "admin") return new Response("<h1>Admin only</h1>",{status:403,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"}});
      if (s.role === "guest" && protectedPage !== "admin.html") {
        const rr = await env.AUTH_DB.prepare(`SELECT restricted FROM auth_restrictions WHERE page=?`).bind(protectedPage).first();
        if (Number(rr?.restricted) === 1) {
          return new Response("<h1>Page Restricted</h1><p>Admin ne is page ko Guest ke liye restrict kiya hai.</p><a href=\"/index.html\">Back to Dashboard</a>", {
            status: 403,
            headers: {"Content-Type":"text/html; charset=utf-8", "Cache-Control":"no-store"}
          });
        }
      }
    }

    if (["/api/search","/api/market-stats","/api/stock","/api/peers","/api/pe"].includes(url.pathname)) {
      const s = await currentAuth(request, env);
      if (!s) return json({error:"Authentication required"},401);
    }

    if (url.pathname === "/api/search") {
      const q = (url.searchParams.get("q") || "").trim();
      if (!q) return json({ results: [] });
      try {
        const r = await fetch(`https://www.screener.in/api/company/search/?q=${encodeURIComponent(q)}`, {
          headers: { ...HEADERS, Referer: "https://www.screener.in/" }
        });
        if (!r.ok) return json({ error: "Stock search failed", status: r.status }, 502);
        const items = await r.json();
        const results = (Array.isArray(items) ? items : []).map(item => {
          const m = String(item.url || "").match(/\/company\/([^/]+)\//);
          return m ? { symbol: m[1].toUpperCase(), name: item.name || m[1].toUpperCase() } : null;
        }).filter(Boolean).slice(0, 10);
        return json({ results });
      } catch (_) { return json({ error: "Unable to search stocks" }, 500); }
    }

    if (url.pathname === "/api/peers") {
      const symbol = (url.searchParams.get("symbol") || "").trim().toUpperCase();
      if (!symbol) return json({ error: "Stock symbol missing" }, 400);
      try { return json(await fetchDynamicPeers(symbol)); }
      catch (_) { return json({ error: "Unable to fetch peer comparison" }, 502); }
    }

    if (url.pathname === "/api/market-stats") {
      try {
        const [gRaw, lRaw, lowRaw] = await Promise.all([
          fetchYahooScreener("day_gainers"),
          fetchYahooScreener("day_losers"),
          fetchYahooScreener("52_week_lows")
        ]);
        const mapList = raw => raw.map(marketQuote).filter(Boolean);
        const gainers = mapList(gRaw).sort((a,b)=>(b.changePercent??-999)-(a.changePercent??-999)).slice(0,8);
        const losers = mapList(lRaw).sort((a,b)=>(a.changePercent??999)-(b.changePercent??999)).slice(0,8);
        let low52 = mapList(lowRaw);
        if (!low52.length) {
          const alt = await fetchYahooScreener("fifty_two_wk_losers");
          low52 = mapList(alt);
        }
        low52 = low52.sort((a,b)=>(a.distanceFrom52Low??999)-(b.distanceFrom52Low??999)).slice(0,8);
        return json({ gainers, losers, low52 });
      } catch (_) { return json({ error: "Unable to fetch market statistics" }, 502); }
    }

    if (url.pathname === "/api/pe") {
      const symbol = (url.searchParams.get("symbol") || "").trim().toUpperCase();
      if (!symbol) return json({ pe: null });
      return json({ pe: await fetchSelectedPE(symbol) });
    }


    if (url.pathname === "/api/stock") {
      const rawSymbol = (url.searchParams.get("symbol") || "").trim().toUpperCase();
      if (!rawSymbol) return json({ error: "Stock symbol missing" }, 400);
      const symbol = rawSymbol.endsWith(".NS") ? rawSymbol.slice(0, -3) : rawSymbol;
      const yahooSymbol = `${symbol}.NS`;

      // Always fetch Yahoo history separately. The displayed quote/OHLC can come
      // from the NSE historical source, but the dashboard needs the full daily
      // history for 20/50/200 DMA and other technical calculations.
      const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?range=2y&interval=1d&events=div%2Csplits`;
      let yahooData = null;
      try {
        const response = await fetch(yahooUrl, {
          headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json,text/plain,*/*" },
          cache: "no-store"
        });
        if (response.ok) {
          const body = await response.json();
          const result = body?.chart?.result?.[0];
          if (result) {
            const timestamps = result.timestamp || [];
            const quote = result.indicators?.quote?.[0] || {};
            const history = timestamps.map((time, i) => ({
              time,
              open: quote.open?.[i] ?? null,
              high: quote.high?.[i] ?? null,
              low: quote.low?.[i] ?? null,
              close: quote.close?.[i] ?? null,
              volume: quote.volume?.[i] ?? null
            })).filter(item => item.close !== null && Number.isFinite(Number(item.close)));
            yahooData = {
              history,
              meta: result.meta || {}
            };
          }
        }
      } catch (_) {}

      // NSE historical data remains the primary source for the displayed latest
      // price/OHLC because Yahoo can occasionally expose a stale ETF candle.
      const ep = await fetchEquityPanditQuote(symbol);
      if (ep) {
        return json({
          symbol,
          yahoo_symbol: yahooSymbol,
          exchange: "NSE",
          currency: "INR",
          ...ep,
          year_high: yahooData?.meta?.fiftyTwoWeekHigh ?? null,
          year_low: yahooData?.meta?.fiftyTwoWeekLow ?? null,
          history: yahooData?.history || []
        });
      }

      // If the NSE historical source is unavailable, use Yahoo for both quote
      // and history.
      const history = yahooData?.history || [];
      if (!history.length) return json({ error: "No price history found" }, 404);
      const last = history[history.length - 1];
      const previous = history.length > 1 ? history[history.length - 2] : last;
      const change = Number(last.close) - Number(previous.close);
      const percentChange = Number(previous.close) ? (change / Number(previous.close)) * 100 : 0;
      return json({
        symbol,
        yahoo_symbol: yahooSymbol,
        exchange: "NSE",
        price: Number(last.close),
        previous_close: Number(previous.close),
        change,
        percent_change: percentChange,
        day_open: last.open,
        day_high: last.high,
        day_low: last.low,
        volume: last.volume,
        year_high: yahooData.meta?.fiftyTwoWeekHigh ?? null,
        year_low: yahooData.meta?.fiftyTwoWeekLow ?? null,
        currency: yahooData.meta?.currency || "INR",
        as_of: last.time,
        price_source: "Yahoo Finance daily fallback",
        ohlc_source: "Yahoo Finance daily fallback",
        history
      });
    }
    return env.ASSETS.fetch(request);
  }
};
