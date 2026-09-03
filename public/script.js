async function analyzeStock() {

    const stock = document.getElementById("stockInput").value
        .trim()
        .toUpperCase();

    if (!stock) {
        alert("Stock symbol enter karo");
        return;
    }

    try {

        // Cloudflare Worker API
        const url = `/api/stock?symbol=${encodeURIComponent(stock)}`;

        const response = await fetch(url);

        console.log("Response status:", response.status);

        const result = await response.json();

        console.log("API RESULT:", result);

        if (!response.ok || result.error) {
            throw new Error(result.error || "Stock not found");
        }

        // =========================
        // STOCK OVERVIEW
        // =========================

        document.getElementById("stockSymbol").textContent =
            result.symbol || stock;

        document.getElementById("stockExchange").textContent =
            result.exchange || "NSE";

        document.getElementById("stockPrice").textContent =
            `₹${Number(result.price).toLocaleString("en-IN", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            })}`;

        const change = Number(result.change || 0);
        const percentChange = Number(result.percent_change || 0);

        document.getElementById("stockChange").textContent =
            `${change >= 0 ? "+" : ""}${change.toFixed(2)} (${percentChange >= 0 ? "+" : ""}${percentChange.toFixed(2)}%)`;

        // =========================
        // INDICATORS
        // =========================

        document.getElementById("volume").textContent =
            result.volume
                ? Number(result.volume).toLocaleString("en-IN")
                : "-";

        document.getElementById("high52").textContent =
            result.year_high
                ? `₹${Number(result.year_high).toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                })}`
                : "-";

        console.log("Price:", result.price);
        console.log("Change:", result.change);
        console.log("52W High:", result.year_high);
        console.log("52W Low:", result.year_low);
        console.log("Volume:", result.volume);
        console.log("History:", result.history);

        // =========================
        // TEMPORARY STATUS
        // =========================

        document.getElementById("signal").textContent =
            "LIVE DATA";

    } catch (error) {

        console.error("API ERROR:", error);

        alert(
            "Stock data load nahi ho paaya.\n\n" +
            "Symbol check karo aur dobara try karo."
        );
    }
}
