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
async function fetchDynamicPeers(symbol) {
  const company = await resolveCompany(symbol);
  if (!company) return null;

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
  return { symbol: company.symbol, name: company.name, source: "ScanX peer comparison", peers: [] };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

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
      const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?range=1y&interval=1d&events=div%2Csplits`;
      try {
        const response = await fetch(yahooUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
        if (!response.ok) return json({ error: "Stock data request failed", status: response.status }, 502);
        const body = await response.json();
        const result = body?.chart?.result?.[0];
        if (!result) return json({ error: "Stock not found" }, 404);
        const timestamps = result.timestamp || [];
        const quote = result.indicators?.quote?.[0] || {};
        const history = timestamps.map((time, i) => ({ time, open: quote.open?.[i] ?? null, high: quote.high?.[i] ?? null, low: quote.low?.[i] ?? null, close: quote.close?.[i] ?? null, volume: quote.volume?.[i] ?? null })).filter(item => item.close !== null);
        if (!history.length) return json({ error: "No price history found" }, 404);
        const last = history[history.length - 1];
        const previous = history.length > 1 ? history[history.length - 2] : last;
        const meta = result.meta || {};

        // Use the latest daily NSE candle as the source of truth for the displayed
        // close and for the previous-close comparison. Yahoo's meta.previousClose
        // can occasionally be stale/mismatched for ETFs, which caused values such
        // as NIFTYCASE 9.64 vs 9.77 and TATAGOLD 14.94 vs an old close.
        // During an active session, regularMarketPrice can be newer than the daily
        // candle, so use it only when Yahoo explicitly reports the market as open.
        const marketPrice = Number(meta.regularMarketPrice);
        const marketState = String(meta.marketState || meta.currentTradingPeriod?.regular?.status || "").toLowerCase();
        const marketIsOpen = marketState === "open";
        const price = marketIsOpen && Number.isFinite(marketPrice) ? marketPrice : last.close;

        // Previous close must be the immediately preceding valid daily NSE close,
        // not meta.previousClose/chartPreviousClose.
        const previousClose = previous.close;

        // For the daily display, take OHLC/volume from the same latest candle as
        // the displayed close so all values belong to one trading session. During
        // an active session, Yahoo's live session OHLC can be used.
        const metaOpen = Number(meta.regularMarketOpen);
        const metaHigh = Number(meta.regularMarketDayHigh);
        const metaLow = Number(meta.regularMarketDayLow);
        const metaVolume = Number(meta.regularMarketVolume);
        const dayOpen = marketIsOpen && Number.isFinite(metaOpen) ? metaOpen : last.open;
        const dayHigh = marketIsOpen && Number.isFinite(metaHigh) ? metaHigh : last.high;
        const dayLow = marketIsOpen && Number.isFinite(metaLow) ? metaLow : last.low;
        const dayVolume = marketIsOpen && Number.isFinite(metaVolume) ? metaVolume : last.volume;
        const change = price - previousClose;
        const percentChange = previousClose !== 0 ? (change / previousClose) * 100 : 0;
        return json({ symbol, yahoo_symbol: yahooSymbol, exchange: "NSE", price, previous_close: previousClose, change, percent_change: percentChange, day_open: dayOpen, day_high: dayHigh, day_low: dayLow, volume: dayVolume, year_high: meta.fiftyTwoWeekHigh ?? null, year_low: meta.fiftyTwoWeekLow ?? null, currency: meta.currency || "INR", as_of: meta.regularMarketTime ?? null, price_source: marketIsOpen && Number.isFinite(marketPrice) ? "Yahoo Finance live market price" : "Yahoo Finance latest daily close", ohlc_source: marketIsOpen && (Number.isFinite(metaOpen) || Number.isFinite(metaHigh) || Number.isFinite(metaLow)) ? "Yahoo Finance live session data" : "Yahoo Finance latest daily candle", history });
      } catch (_) { return json({ error: "Unable to fetch stock data" }, 500); }
    }
    return env.ASSETS.fetch(request);
  }
};
