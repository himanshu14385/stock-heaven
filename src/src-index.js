function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...extraHeaders
    }
  });
}

const SCREENER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
  "Referer": "https://www.screener.in/"
};

const ETF_FALLBACK = [
  ["TATAGOLD", "Tata Gold Exchange Traded Fund"],
  ["TATASILV.NS", "Tata Silver Exchange Traded Fund"],
  ["ENERGY.NS", "Mirae Asset Nifty Energy ETF"],
  ["CPSEETF", "CPSE Exchange Traded Fund"],
  ["NIFTYCASE.NS", "Zerodha Nifty 50 ETF"],
  ["FMCGIETF.NS", "ICICI Prudential Nifty FMCG ETF"],
  ["MIDCAPIETF.NS", "ICICI Prudential Nifty Midcap 150 ETF"],
  ["NEXT50IETF.NS", "ICICI Prudential Nifty Next 50 ETF"],
  ["KOTAKALPHA.NS", "Kotak Nifty Alpha 50 ETF"],
  ["ITBEES", "Nippon India ETF Nifty IT BeES"],
  ["HDFCNIFBAN.NS", "HDFC Nifty Bank ETF"],
  ["SMALLCAP.NS", "Mirae Asset Nifty Smallcap 250 Momentum Quality 100 ETF"],
  ["BANKBEES", "Nippon India ETF Nifty Bank BeES"],
  ["GOLDBEES", "Nippon India ETF Gold BeES"]
];

function cleanSymbol(value) {
  return (value || "").trim().toUpperCase().replace(/\.NS$/i, "");
}

function yahooSymbol(value) {
  const s = cleanSymbol(value);
  return `${s}.NS`;
}

function stripHtml(value) {
  return (value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function decodeEntities(value) {
  return stripHtml(value);
}

function getAttr(tag, attr) {
  const re = new RegExp(`${attr}=["']([^"']+)["']`, "i");
  return tag.match(re)?.[1] || "";
}

async function screenerSearch(query) {
  const url = `https://www.screener.in/api/company/search/?q=${encodeURIComponent(query)}`;
  const r = await fetch(url, { headers: { ...SCREENER_HEADERS, "X-Requested-With": "XMLHttpRequest" } });
  if (!r.ok) throw new Error(`Screener search ${r.status}`);
  const data = await r.json();
  return Array.isArray(data) ? data : [];
}

async function getScreenerCompany(symbol) {
  const results = await screenerSearch(symbol);
  const normalized = cleanSymbol(symbol);
  const exact = results.find(x => {
    const m = (x.url || "").match(/\/company\/([^/]+)/i)?.[1] || "";
    return cleanSymbol(m) === normalized;
  });
  return exact || results[0] || null;
}

async function getPeersFromScreener(symbol) {
  const company = await getScreenerCompany(symbol);
  if (!company?.url) return [];

  const companyUrl = `https://www.screener.in${company.url}`;
  const page = await fetch(companyUrl, { headers: SCREENER_HEADERS });
  if (!page.ok) return [];
  const html = await page.text();

  const warehouse =
    html.match(/data-warehouse-id=["'](\d+)["']/i)?.[1] ||
    html.match(/warehouse[_-]?id["']?\s*[:=]\s*["'](\d+)["']/i)?.[1] ||
    html.match(/user\/company\/export\/(\d+)/i)?.[1];

  if (!warehouse) return [];

  const peerUrl = `https://www.screener.in/api/company/${warehouse}/peers/`;
  const peersResponse = await fetch(peerUrl, {
    headers: { ...SCREENER_HEADERS, "X-Requested-With": "XMLHttpRequest" }
  });
  if (!peersResponse.ok) return [];
  const peersHtml = await peersResponse.text();

  const rows = [];
  const trMatches = peersHtml.match(/<tr[\s\S]*?<\/tr>/gi) || [];
  for (const tr of trMatches) {
    const cells = tr.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/gi) || [];
    if (cells.length < 4) continue;
    const nameCell = cells[1] || "";
    const name = decodeEntities(nameCell);
    if (!name || /^name$/i.test(name)) continue;

    const anchor = nameCell.match(/<a[^>]+href=["']([^"']*\/company\/([^/"']+)[^"']*)["'][^>]*>/i);
    const peerSymbol = anchor?.[2] || "";
    if (!peerSymbol) continue;

    const cmp = decodeEntities(cells[2] || "");
    const pe = decodeEntities(cells[3] || "");
    const cmpNumber = Number((cmp.match(/-?[\d,]+(?:\.\d+)?/) || [""])[0].replace(/,/g, ""));
    const peNumber = Number((pe.match(/-?[\d,]+(?:\.\d+)?/) || [""])[0].replace(/,/g, ""));

    rows.push({
      symbol: cleanSymbol(peerSymbol),
      name,
      ltp: Number.isFinite(cmpNumber) ? cmpNumber : null,
      pe: Number.isFinite(peNumber) ? peNumber : null
    });
  }

  const unique = [];
  const seen = new Set();
  for (const row of rows) {
    if (seen.has(row.symbol)) continue;
    seen.add(row.symbol);
    unique.push(row);
  }
  return unique.slice(0, 10);
}

async function yahooQuote(symbol) {
  const ys = yahooSymbol(symbol);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ys)}?range=1y&interval=1d&events=div%2Csplits`;
  const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!r.ok) return null;
  const body = await r.json();
  const result = body?.chart?.result?.[0];
  if (!result) return null;
  const timestamps = result.timestamp || [];
  const quote = result.indicators?.quote?.[0] || {};
  const history = timestamps.map((time, i) => ({
    time,
    open: quote.open?.[i] ?? null,
    high: quote.high?.[i] ?? null,
    low: quote.low?.[i] ?? null,
    close: quote.close?.[i] ?? null,
    volume: quote.volume?.[i] ?? null
  })).filter(x => x.close !== null);
  if (!history.length) return null;
  const closes = history.map(x => Number(x.close)).filter(Number.isFinite);
  let gains = 0, losses = 0;
  if (closes.length >= 15) {
    for (let i = closes.length - 14; i < closes.length; i++) {
      const d = closes[i] - closes[i - 1];
      if (d > 0) gains += d; else losses -= d;
    }
  }
  const rsi = closes.length >= 15 ? (losses === 0 ? 100 : 100 - (100 / (1 + (gains / 14) / (losses / 14)))) : null;
  return { price: Number(result.meta?.regularMarketPrice ?? history.at(-1)?.close), rsi };
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/api/stock") {
      const rawSymbol = (url.searchParams.get("symbol") || "").trim().toUpperCase();
      if (!rawSymbol) return json({ error: "Stock symbol missing" }, 400);
      const symbol = rawSymbol.endsWith(".NS") ? rawSymbol.slice(0, -3) : rawSymbol;
      const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol + ".NS")}?range=1y&interval=1d&events=div%2Csplits`;
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
        const price = last.close;
        const previousClose = previous.close;
        const change = price - previousClose;
        const percentChange = previousClose !== 0 ? (change / previousClose) * 100 : 0;
        return json({ symbol, yahoo_symbol: symbol + ".NS", exchange: "NSE", price, previous_close: previousClose, change, percent_change: percentChange, day_high: last.high, day_low: last.low, volume: last.volume, year_high: result.meta?.fiftyTwoWeekHigh ?? null, year_low: result.meta?.fiftyTwoWeekLow ?? null, currency: result.meta?.currency || "INR", history });
      } catch (error) { return json({ error: "Unable to fetch stock data" }, 500); }
    }

    if (url.pathname === "/api/search") {
      const q = (url.searchParams.get("q") || "").trim();
      if (q.length < 1) return json({ results: ETF_FALLBACK.slice(0, 10).map(([symbol, name]) => ({ symbol, name })) });
      try {
        const results = await screenerSearch(q);
        const mapped = results.slice(0, 10).map(x => ({
          symbol: (x.url || "").match(/\/company\/([^/]+)/i)?.[1] || "",
          name: x.name || ""
        })).filter(x => x.symbol && x.name);
        const etfs = ETF_FALLBACK.filter(([symbol, name]) => symbol.toUpperCase().includes(q.toUpperCase()) || name.toUpperCase().includes(q.toUpperCase())).map(([symbol, name]) => ({ symbol, name }));
        const merged = [...mapped, ...etfs].filter((x, i, arr) => arr.findIndex(y => cleanSymbol(y.symbol) === cleanSymbol(x.symbol)) === i).slice(0, 10);
        return json({ results: merged });
      } catch (e) {
        const etfs = ETF_FALLBACK.filter(([symbol, name]) => symbol.toUpperCase().includes(q.toUpperCase()) || name.toUpperCase().includes(q.toUpperCase())).map(([symbol, name]) => ({ symbol, name }));
        return json({ results: etfs, source: "fallback" });
      }
    }

    if (url.pathname === "/api/peers") {
      const symbol = (url.searchParams.get("symbol") || "").trim().toUpperCase();
      if (!symbol) return json({ error: "Stock symbol missing" }, 400);
      const cacheKey = new Request(`${url.origin}/__peer_cache__/${encodeURIComponent(cleanSymbol(symbol))}`);
      const cache = caches.default;
      const cached = await cache.match(cacheKey);
      if (cached) return cached;
      try {
        const peers = await getPeersFromScreener(symbol);
        if (!peers.length) return json({ symbol: cleanSymbol(symbol), peers: [], source: "none" });
        const enriched = await Promise.all(peers.slice(0, 10).map(async peer => {
          const q = await yahooQuote(peer.symbol);
          return { ...peer, ltp: q?.price ?? peer.ltp, rsi: q?.rsi ?? null };
        }));
        const response = json({ symbol: cleanSymbol(symbol), peers: enriched, source: "screener+yahoo" }, 200, { "Cache-Control": "public, max-age=900" });
        ctx.waitUntil(cache.put(cacheKey, response.clone()));
        return response;
      } catch (e) {
        return json({ symbol: cleanSymbol(symbol), peers: [], source: "error" });
      }
    }

    return env.ASSETS.fetch(request);
  }
};
