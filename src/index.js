function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

const SCREENER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/json",
  "Referer": "https://www.screener.in/"
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
    .replace(/\s+/g, " ")
    .trim();
}

function num(v) {
  if (v == null) return null;
  const s = String(v).replace(/,/g, "").replace(/₹/g, "").replace(/%/g, "").trim();
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

async function screenerFetch(url) {
  return fetch(url, { headers: SCREENER_HEADERS });
}

async function resolveScreenerCompany(symbol) {
  const clean = String(symbol || "").trim().toUpperCase().replace(/\.NS$/i, "");
  if (!clean) return null;

  // Screener's search endpoint resolves the NSE symbol to the canonical company URL.
  const searchUrl = `https://www.screener.in/api/company/search/?q=${encodeURIComponent(clean)}`;
  const sr = await screenerFetch(searchUrl);
  if (sr.ok) {
    const items = await sr.json();
    const arr = Array.isArray(items) ? items : [];
    const exact = arr.find(x => {
      const m = String(x.url || "").match(/\/company\/([^/]+)\//);
      return m && m[1].toUpperCase() === clean;
    });
    const hit = exact || arr[0];
    if (hit) {
      const m = String(hit.url || "").match(/\/company\/([^/]+)\//);
      if (m) return { symbol: m[1].toUpperCase(), name: hit.name || clean };
    }
  }

  // Fallback for symbols the search endpoint does not resolve.
  const page = await screenerFetch(`https://www.screener.in/company/${encodeURIComponent(clean)}/`);
  if (!page.ok) return null;
  return { symbol: clean, name: clean };
}

async function fetchDynamicPeers(symbol) {
  const company = await resolveScreenerCompany(symbol);
  if (!company) return null;

  const companyUrl = `https://www.screener.in/company/${encodeURIComponent(company.symbol)}/`;
  const page = await screenerFetch(companyUrl);
  if (!page.ok) return { symbol: company.symbol, name: company.name, peers: [] };

  const html = await page.text();

  // Screener exposes the warehouse/company id on the company page; its peer table
  // is loaded from /api/company/{warehouse_id}/peers/.
  const idMatch =
    html.match(/data-warehouse-id=["'](\d+)["']/i) ||
    html.match(/data-company-id=["'](\d+)["']/i);

  if (!idMatch) return { symbol: company.symbol, name: company.name, peers: [] };

  const warehouseId = idMatch[1];
  const peersUrl = `https://www.screener.in/api/company/${warehouseId}/peers/`;
  const pr = await screenerFetch(peersUrl);
  if (!pr.ok) return { symbol: company.symbol, name: company.name, peers: [] };

  const peerHtml = await pr.text();

  // Read the table header so CMP/P-E columns remain correct if Screener changes
  // their order.
  const rowMatches = [...peerHtml.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(m => m[1]);
  if (!rowMatches.length) return { symbol: company.symbol, name: company.name, peers: [] };

  let headers = [];
  let dataRows = [];

  for (const row of rowMatches) {
    const ths = [...row.matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi)].map(m => stripTags(m[1]));
    if (ths.length) {
      headers = ths.map(x => x.toUpperCase());
      continue;
    }
    const tds = [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(m => m[1]);
    if (tds.length) dataRows.push(tds);
  }

  // If the fragment has no explicit <th> row, the current Screener peer layout
  // uses: S.No., Name, CMP, P/E, ...
  if (!headers.length) headers = ["S.NO.", "NAME", "CMP", "P/E"];

  const findHeader = (...names) => {
    for (const n of names) {
      const i = headers.findIndex(h => h.includes(n));
      if (i >= 0) return i;
    }
    return -1;
  };

  const nameIdx = findHeader("NAME");
  const cmpIdx = findHeader("CMP");
  const peIdx = findHeader("P/E");

  const peers = [];

  for (const cells of dataRows) {
    const nameHtml = cells[nameIdx >= 0 ? nameIdx : 1] || "";
    const linkMatch = nameHtml.match(/href=["']\/company\/([^/"']+)\/?["']/i);
    const peerSymbol = linkMatch ? linkMatch[1].toUpperCase() : null;
    const peerName = stripTags(nameHtml);

    if (!peerName || !peerSymbol || peerSymbol === company.symbol) continue;

    const cmpCell = cells[cmpIdx >= 0 ? cmpIdx : 2];
    const peCell = cells[peIdx >= 0 ? peIdx : 3];

    const ltp = num(stripTags(cmpCell));
    const pe = num(stripTags(peCell));

    peers.push({
      symbol: peerSymbol,
      name: peerName,
      ltp,
      pe
    });

    if (peers.length >= 10) break;
  }

  return { symbol: company.symbol, name: company.name, peers };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/search") {
      const q = (url.searchParams.get("q") || "").trim();
      if (!q) return json({ results: [] });

      try {
        const sr = await screenerFetch(
          `https://www.screener.in/api/company/search/?q=${encodeURIComponent(q)}`
        );

        if (!sr.ok) {
          return json({ error: "Stock search failed", status: sr.status }, 502);
        }

        const items = await sr.json();
        const results = (Array.isArray(items) ? items : [])
          .map(item => {
            const m = String(item.url || "").match(/\/company\/([^/]+)\//);
            return m ? {
              symbol: m[1].toUpperCase(),
              name: item.name || m[1].toUpperCase()
            } : null;
          })
          .filter(Boolean)
          .slice(0, 10);

        return json({ results });
      } catch (error) {
        return json({ error: "Unable to search stocks" }, 500);
      }
    }

    if (url.pathname === "/api/peers") {
      const symbol = (url.searchParams.get("symbol") || "").trim().toUpperCase();
      if (!symbol) return json({ error: "Stock symbol missing" }, 400);

      try {
        const result = await fetchDynamicPeers(symbol);
        if (!result) return json({ error: "Stock not found" }, 404);
        return json(result);
      } catch (error) {
        return json({ error: "Unable to fetch peer comparison" }, 502);
      }
    }

    if (url.pathname === "/api/stock") {
      const rawSymbol = (url.searchParams.get("symbol") || "").trim().toUpperCase();

      if (!rawSymbol) {
        return json({ error: "Stock symbol missing" }, 400);
      }

      const symbol = rawSymbol.endsWith(".NS")
        ? rawSymbol.slice(0, -3)
        : rawSymbol;

      const yahooSymbol = `${symbol}.NS`;

      const yahooUrl =
        `https://query1.finance.yahoo.com/v8/finance/chart/` +
        `${encodeURIComponent(yahooSymbol)}` +
        `?range=1y&interval=1d&events=div%2Csplits`;

      try {
        const response = await fetch(yahooUrl, {
          headers: { "User-Agent": "Mozilla/5.0" }
        });

        if (!response.ok) {
          return json({
            error: "Stock data request failed",
            status: response.status
          }, 502);
        }

        const body = await response.json();
        const result = body?.chart?.result?.[0];

        if (!result) {
          return json({ error: "Stock not found" }, 404);
        }

        const timestamps = result.timestamp || [];
        const quote = result.indicators?.quote?.[0] || {};

        const history = timestamps
          .map((time, i) => ({
            time,
            open: quote.open?.[i] ?? null,
            high: quote.high?.[i] ?? null,
            low: quote.low?.[i] ?? null,
            close: quote.close?.[i] ?? null,
            volume: quote.volume?.[i] ?? null
          }))
          .filter(item => item.close !== null);

        if (!history.length) {
          return json({ error: "No price history found" }, 404);
        }

        const last = history[history.length - 1];
        const previous = history.length > 1
          ? history[history.length - 2]
          : last;

        const price = last.close;
        const previousClose = previous.close;
        const change = price - previousClose;
        const percentChange =
          previousClose !== 0
            ? (change / previousClose) * 100
            : 0;

        return json({
          symbol,
          yahoo_symbol: yahooSymbol,
          exchange: "NSE",
          price,
          previous_close: previousClose,
          change,
          percent_change: percentChange,
          day_high: last.high,
          day_low: last.low,
          volume: last.volume,
          year_high: result.meta?.fiftyTwoWeekHigh ?? null,
          year_low: result.meta?.fiftyTwoWeekLow ?? null,
          currency: result.meta?.currency || "INR",
          history
        });
      } catch (error) {
        return json({ error: "Unable to fetch stock data" }, 500);
      }
    }

    return env.ASSETS.fetch(request);
  }
};
