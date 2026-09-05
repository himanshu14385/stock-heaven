let stuckStocks = [];
let editingStuckIndex = null;

async function loadStuckData(){
  try { const r=await fetch('/api/data/stuck',{cache:'no-store'}); const d=await r.json(); if(!r.ok) throw new Error(d.error||'Unable to load'); stuckStocks=Array.isArray(d.items)?d.items:[]; }
  catch(e){ stuckStocks=[]; alert('Stuck Stock data load nahi ho paya.'); }
}
async function saveStuckStockSettings(){
  const r=await fetch('/api/data/stuck',{method:'PUT',credentials:'same-origin',headers:{'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify({items:stuckStocks})});
  const d=await r.json(); if(!r.ok) throw new Error(d.error||'Unable to save'); stuckStocks=d.items||stuckStocks;
}

function escapeStuckHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    }[char]));
}

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

    container.innerHTML = results.map((stock, index) => `
        <div class="stuck-stock-row" onclick="showStuckQuote('${stock.symbol.replace(/'/g, "\'")}')">
            <div class="ssname-wrap">
                <span class="stuck-stock-name">${escapeStuckHtml(stock.name)}</span>
                <span class="mystuckprice dnone">${escapeStuckHtml(stock.stuckInfo)}</span>
            </div>
            <div class="stuck-row-right">
                ${editingStuckIndex !== index
                    ? `<div class="stuck-actions" onclick="event.stopPropagation()">
                        <button class="stuck-action stuck-edit" onclick="editStuck(${index})" title="Edit"><i class="fa-solid fa-pen"></i></button>
                        <button class="stuck-action stuck-delete" onclick="deleteStuck(${index})" title="Delete"><i class="fa-solid fa-trash-can"></i></button>
                       </div>`
                    : ``}			
                <div class="ssname-wrap">
                    <span class="stuck-stock-price">${formatStuckPrice(stock.price)}</span>
                    ${editingStuckIndex === index
                        ? `<div class="stuck-edit-wrap" onclick="event.stopPropagation()">
                            <input class="stuck-info-input" id="stuckInfoInput${index}" type="text" value="${escapeStuckHtml(stock.stuckInfo)}" aria-label="Edit stuck stock quantity and price" onkeydown="handleStuckEditKey(event, ${index})">
                            <button class="stuck-action stuck-save" onclick="saveStuckEdit(${index})" title="Save"><i class="fa-solid fa-check"></i></button>
                            <button class="stuck-action stuck-cancel" onclick="cancelStuckEdit(event)" title="Cancel"><i class="fa-solid fa-xmark"></i></button>
                          </div>`
                        : `<span class="mystuckprice">${escapeStuckHtml(stock.stuckInfo)}</span>`}
                </div>
            </div>
        </div>
    `).join("");


    if (updated) {
        updated.textContent = "Prices fetched: " + new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
    }
}

function editStuck(index) {
    if (!window.requireAdmin()) return;
    editingStuckIndex = index;
    loadStuckStocks();
}

function saveStuckEdit(index) {
    if (!window.requireAdmin()) return;
    const input = document.getElementById(`stuckInfoInput${index}`);
    if (!input) return;

    const value = input.value.trim();
    if (!value) {
        alert("Quantity aur price enter kijiye");
        input.focus();
        return;
    }

    stuckStocks[index].stuckInfo = value;
    editingStuckIndex = null;
    saveStuckStockSettings().then(loadStuckStocks).catch(e=>alert(e.message||"Save failed"));
}

function cancelStuckEdit(event) {
    if (!window.requireAdmin()) return;
    if (event) event.stopPropagation();
    editingStuckIndex = null;
    loadStuckStocks();
}

function handleStuckEditKey(event, index) {
    if (event.key === "Enter") {
        event.preventDefault();
        saveStuckEdit(index);
    } else if (event.key === "Escape") {
        event.preventDefault();
        editingStuckIndex = null;
        loadStuckStocks();
    }
}

function deleteStuck(index) {
    if (!window.requireAdmin()) return;
    const stock = stuckStocks[index];
    if (!stock) return;

    if (!confirm(`Delete ${stock.name} from Stuck Stock?`)) return;

    stuckStocks.splice(index, 1);
    editingStuckIndex = null;
    saveStuckStockSettings().then(loadStuckStocks).catch(e=>alert(e.message||"Delete failed"));
}

document.addEventListener("DOMContentLoaded", async ()=>{ await loadStuckData(); await loadStuckStocks(); });
