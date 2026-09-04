function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // =========================
    // STOCK API
    // =========================
    if (url.pathname === "/api/stock") {
      const rawSymbol = (
        url.searchParams.get("symbol") || ""
      ).trim().toUpperCase();

      if (!rawSymbol) {
        return json(
          { error: "Stock symbol missing" },
          400
        );
      }

      // Remove .NS if user enters RELIANCE.NS
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
          headers: {
            "User-Agent": "Mozilla/5.0"
          }
        });

        if (!response.ok) {
          return json(
            {
              error: "Stock data request failed",
              status: response.status
            },
            502
          );
        }

        const body = await response.json();
        const result = body?.chart?.result?.[0];

        if (!result) {
          return json(
            { error: "Stock not found" },
            404
          );
        }

        const timestamps = result.timestamp || [];
        const quote =
          result.indicators?.quote?.[0] || {};

        // =========================
        // PRICE HISTORY
        // =========================
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
          return json(
            { error: "No price history found" },
            404
          );
        }

        // =========================
        // CURRENT PRICE
        // =========================
        const last = history[history.length - 1];

        const previous =
          history.length > 1
            ? history[history.length - 2]
            : last;

        const price = last.close;
        const previousClose = previous.close;

        const change =
          price - previousClose;

        const percentChange =
          previousClose !== 0
            ? (change / previousClose) * 100
            : 0;

        // =========================
        // RESPONSE
        // =========================
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

          year_high:
            result.meta?.fiftyTwoWeekHigh ?? null,

          year_low:
            result.meta?.fiftyTwoWeekLow ?? null,

          currency:
            result.meta?.currency || "INR",

          history
        });

      } catch (error) {
        return json(
          {
            error: "Unable to fetch stock data"
          },
          500
        );
      }
    }

    // =========================
    // SERVE WEBSITE
    // =========================
    return env.ASSETS.fetch(request);
  }
};