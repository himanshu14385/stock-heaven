const stuckStocks = [
    {
        symbol: "AWL",
        name: "Adani Wilmar Limited",
        stuckInfo: "208 × 647.73"
    },
    {
        symbol: "ADANIENSOL",
        name: "Adani Energy Solutions Limited",
        stuckInfo: "33 × 2788.12"
    },
    {
        symbol: "FMCGIETF.NS",
        name: "ICICI Pru Nifty FMCG ETF",
        stuckInfo: "550 × 56.07"
    },
    {
        symbol: "AWL",
        name: "Adani Wilmar Limited",
        stuckInfo: "36 × 683.35"
    },
    {
        symbol: "ADANIGREEN",
        name: "Adani Green Energy",
        stuckInfo: "9 × 2333.43"
    },
    {
        symbol: "TMPV",
        name: "Tata Motors Passenger Vehicles",
        stuckInfo: "27 × 508.60"
    },
    {
        symbol: "NSLNISP",
        name: "NMDC Steel",
        stuckInfo: "31 × 52.85"
    }
];

function cleanSymbol(symbol) {
    return String(symbol || "").trim().toUpperCase();
}

function displaySymbol(symbol) {
    return cleanSymbol(symbol).replace(/\.NS$/, "");
}

function formatStuckPrice(value) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return "--";
    return `₹${Number(value).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function showStuckSuggestions() {
    const input = document.getElementById("stuckSearchInput");
    const box = document.getElementById("stuckSuggestions");
    if (!input || !box) return;

    const query = input.value.trim().toUpperCase();
    if (!query) {
        box.innerHTML = "";
        box.style.display = "none";
        return;
    }

    const matches = stuckStocks.filter(stock =>
        stock.symbol.toUpperCase().includes(query) ||
        stock.name.toUpperCase().includes(query)
    ).slice(0, 8);

    if (!matches.length) {
        box.innerHTML = `<div class="suggestion-empty">No stock found</div>`;
        box.style.display = "block";
        return;
    }

    box.innerHTML = matches.map(stock => `
        <button class="stock-suggestion-item" onclick="selectStuckStock('${stock.symbol.replace(/'/g, "\\'")}')">
            <span><strong>${displaySymbol(stock.symbol)}</strong><small>${stock.name}</small></span>
        </button>
    `).join("");
    box.style.display = "block";
}


function selectStuckStock(symbol) {
    const input = document.getElementById("stuckSearchInput");
    const box = document.getElementById("stuckSuggestions");
    if (input) input.value = symbol;
    if (box) {
        box.style.display = "none";
        box.innerHTML = "";
    }
    showStuckQuote(symbol);
}

function handleStuckSearch(event) {
    if (event.key === "Enter") {
        event.preventDefault();
        searchFromStuckPage();
    }
}

async function showStuckQuote(symbol) {
    const input = document.getElementById("stuckSearchInput");
    const box = document.getElementById("stuckSuggestions");
    const card = document.getElementById("stuckQuote");
    const normalized = cleanSymbol(symbol);
    if (!normalized) return;

    if (input) input.value = normalized;
    if (box) {
        box.style.display = "none";
        box.innerHTML = "";
    }
    if (card) card.style.display = "block";

    document.getElementById("stuckSymbol").textContent = displaySymbol(normalized);
    document.getElementById("stuckCompany").textContent = "Loading...";
    document.getElementById("stuckPrice").textContent = "₹--";
    document.getElementById("stuckChange").textContent = "--";
    document.getElementById("stuckHigh").textContent = "--";
    document.getElementById("stuckLow").textContent = "--";
    document.getElementById("stuck52High").textContent = "--";
    document.getElementById("stuck52Low").textContent = "--";

    try {
        const response = await fetch(`/api/stock?symbol=${encodeURIComponent(normalized)}`);
        const result = await response.json();
        if (!response.ok || result.error) throw new Error(result.error || "Stock not found");

        const found = stuckStocks.find(
            stock => cleanSymbol(stock.symbol) === normalized
        );

        document.getElementById("stuckCompany").textContent =
            found ? found.name : normalized;
        document.getElementById("stuckPrice").textContent = formatStuckPrice(result.price);
        document.getElementById("stuckHigh").textContent = formatStuckPrice(result.day_high);
        document.getElementById("stuckLow").textContent = formatStuckPrice(result.day_low);
        document.getElementById("stuck52High").textContent = formatStuckPrice(result.year_high);
        document.getElementById("stuck52Low").textContent = formatStuckPrice(result.year_low);

        const change = Number(result.change);
        const pct = Number(result.percent_change);
        const changeEl = document.getElementById("stuckChange");
        if (!Number.isNaN(change) && !Number.isNaN(pct)) {
            changeEl.textContent = `${change >= 0 ? "+" : ""}${change.toFixed(2)} (${change >= 0 ? "+" : ""}${pct.toFixed(2)}%)`;
            changeEl.classList.toggle("negative", change < 0);
        }
    } catch (error) {
        document.getElementById("stuckCompany").textContent = "Data unavailable";
        document.getElementById("stuckPrice").textContent = "--";
    }
}

function searchFromStuckPage() {
    const input = document.getElementById("stuckSearchInput");
    const symbol = input ? input.value.trim() : "";
    if (!symbol) {
        alert("Stock name ya symbol enter karo");
        return;
    }
    showStuckQuote(symbol);
}

async function getStuckStockPrice(symbol) {
    try {
        const response = await fetch(`/api/stock?symbol=${encodeURIComponent(symbol)}`);
        const result = await response.json();
        if (!response.ok || result.error) throw new Error("Price unavailable");
        return Number(result.price);
    } catch (error) {
        return null;
    }
}

async function loadStuckStocks() {
    const container = document.getElementById("stuckStockList");
    const updated = document.getElementById("stuckUpdated");
    if (!container) return;

    container.innerHTML = `<div class="stuck-loading"><i class="fa-solid fa-spinner fa-spin"></i> Loading prices...</div>`;

    const results = await Promise.all(
        stuckStocks.slice(0, 20).map(async stock => ({
            symbol: stock.symbol,
            name: stock.name,
            stuckInfo: stock.stuckInfo,
            price: await getStuckStockPrice(stock.symbol)
        }))
    );

    container.innerHTML = results.map(stock => `
        <button class="stuck-stock-row" onclick="showStuckQuote('${stock.symbol.replace(/'/g, "\\'")}')">
            <div class="ssname-wrap"><span class="stuck-stock-name">${stock.name}</span><span class="mystuckprice">${stock.stuckInfo}</span></div>
            <span class="stuck-stock-price">${formatStuckPrice(stock.price)}</span>
        </button>
    `).join("");



    if (updated) {
        updated.textContent = "Prices fetched: " + new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
    }
}

document.addEventListener("DOMContentLoaded", loadStuckStocks);
