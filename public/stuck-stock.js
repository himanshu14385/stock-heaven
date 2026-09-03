
const stuckStocks = [
    ["RELIANCE", "Reliance"],
    ["AWL", "AWL"],
    ["ADANIENSOL", "Adani Energy Solutions"],
    ["ADANIGREEN", "Adani Green Energy"],
    ["NSLNISP", "NMDC Steel"],
    ["TMPV", "Tata Motors Passenger Vehicles"],
    ["TATAGOLD", "Tata Gold ETF"],
    ["NIFTYCASE.NS", "Zerodha Nifty 50 ETF"],
    ["TATASILV.NS", "Tata Silver ETF"],
    ["ENERGY.NS", "Mirae Asset Nifty Energy ETF"],
    ["FMCGIETF.NS", "ICICI Prudential FMCG ETF"],
    ["MIDCAPIETF.NS", "ICICI Prudential Midcap 150 ETF"]
];

function formatPrice(price) {
    if (price === null || price === undefined || Number.isNaN(price)) {
        return "--";
    }

    return `₹${Number(price).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}`;
}

async function getStuckStockPrice(symbol) {
    try {
        const response = await fetch(
            `/api/stock?symbol=${encodeURIComponent(symbol)}`
        );

        const result = await response.json();

        if (!response.ok || result.error) {
            throw new Error("Price unavailable");
        }

        return Number(result.price);
    } catch (error) {
        return null;
    }
}

async function loadStuckStocks() {
    const container = document.getElementById("stuckStockList");
    const updated = document.getElementById("stuckUpdated");

    if (!container) {
        return;
    }

    container.innerHTML = `
        <div class="stuck-loading">
            <i class="fa-solid fa-spinner fa-spin"></i>
            Loading prices...
        </div>
    `;

    const results = await Promise.all(
        stuckStocks.map(async ([symbol, name]) => ({
            symbol,
            name,
            price: await getStuckStockPrice(symbol)
        }))
    );

    container.innerHTML = results.map(stock => `
        <button
            class="stuck-stock-row"
            onclick="openStockFromStuck('${stock.symbol}')"
        >
            <span class="stuck-stock-name">
                ${stock.name}
            </span>

            <span class="stuck-stock-price">
                ${formatPrice(stock.price)}
            </span>
        </button>
    `).join("");

    if (updated) {
        const now = new Date();

        updated.textContent =
            "Prices fetched: " +
            now.toLocaleTimeString("en-IN", {
                hour: "2-digit",
                minute: "2-digit"
            });
    }
}

function openStockFromStuck(symbol) {
    window.location.href =
        `index.html?symbol=${encodeURIComponent(symbol)}`;
}

function searchFromStuckPage() {
    const input = document.getElementById("stuckSearchInput");
    const symbol = input ? input.value.trim() : "";

    if (!symbol) {
        alert("Stock symbol enter karo");
        return;
    }

    openStockFromStuck(symbol);
}

function handleStuckSearch(event) {
    if (event.key === "Enter") {
        searchFromStuckPage();
    }
}

document.addEventListener(
    "DOMContentLoaded",
    loadStuckStocks
);
