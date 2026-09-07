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

let stuckAddSelectedSymbol = "";
let stuckAddSearchTimer = null;
let stuckAddSearchResults = [];

function clearStuckAddSelection() {
    stuckAddSelectedSymbol = "";
    const nameInput = document.getElementById("stuckAddName");
    if (nameInput) nameInput.dataset.selected = "";
}

function showStuckAddSuggestions() {
    const input = document.getElementById("stuckAddName");
    const box = document.getElementById("stuckAddSuggestions");
    if (!input || !box) return;

    clearTimeout(stuckAddSearchTimer);
    const query = input.value.trim();
    if (!query) {
        box.innerHTML = "";
        box.style.display = "none";
        clearStuckAddSelection();
        return;
    }

    // Typing after selecting a stock means the previous selection is no longer valid.
    clearStuckAddSelection();
    if (query.length < 2) {
        box.innerHTML = "";
        box.style.display = "none";
        return;
    }

    box.innerHTML = `<div class="suggestion-empty">Searching stocks...</div>`;
    box.style.display = "block";

    stuckAddSearchTimer = setTimeout(async () => {
        try {
            const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { cache: "no-store" });
            const data = await response.json().catch(() => ({}));
            if (!response.ok || data.error) throw new Error(data.error || "Stock search failed");

            const matches = Array.isArray(data.results) ? data.results.slice(0, 8) : [];
            stuckAddSearchResults = matches.map(stock => ({
                symbol: cleanSymbol(stock.symbol || ""),
                name: String(stock.name || stock.symbol || "").trim()
            }));
            if (!matches.length) {
                box.innerHTML = `<div class="suggestion-empty">No stock found</div>`;
                box.style.display = "block";
                return;
            }

            box.innerHTML = stuckAddSearchResults.map((stock, index) => `
                <button type="button" class="stuck-add-suggestion-item" onclick="selectStuckAddStockByIndex(${index})">
                    <strong>${escapeStuckHtml(stock.name)}</strong>
                    <small>${escapeStuckHtml(displaySymbol(stock.symbol))}</small>
                </button>
            `).join("");
            box.style.display = "block";
        } catch (_) {
            box.innerHTML = `<div class="suggestion-empty">Stock search unavailable</div>`;
            box.style.display = "block";
        }
    }, 250);
}

function selectStuckAddStockByIndex(index) {
    const stock = stuckAddSearchResults[index];
    if (!stock) return;
    const nameInput = document.getElementById("stuckAddName");
    const box = document.getElementById("stuckAddSuggestions");
    stuckAddSelectedSymbol = cleanSymbol(stock.symbol);
    if (nameInput) {
        nameInput.value = stock.name || stuckAddSelectedSymbol;
        nameInput.dataset.selected = stuckAddSelectedSymbol;
    }
    if (box) {
        box.style.display = "none";
        box.innerHTML = "";
    }
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
        <div class="stuck-stock-row" draggable="true" data-stuck-index="${index}" data-stuck-id="${escapeStuckHtml(stock.id ?? '')}">
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

    bindStuckDragDrop();

    if (updated) {
        updated.textContent = "Prices fetched: " + new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
    }
}

function openAddStuckStock() {
    if (!window.requireAdmin()) return;
    const modal = document.getElementById("stuckAddModal");
    if (!modal) return;
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    const form = document.getElementById("stuckAddForm");
    if (form) form.reset();
    stuckAddSelectedSymbol = "";
    stuckAddSearchResults = [];
    const suggestions = document.getElementById("stuckAddSuggestions");
    if (suggestions) { suggestions.style.display = "none"; suggestions.innerHTML = ""; }
    const status = document.getElementById("stuckAddStatus");
    if (status) status.textContent = "";
    setTimeout(() => document.getElementById("stuckAddName")?.focus(), 50);
}

function closeAddStuckStock(event) {
    if (event && event.target !== event.currentTarget) return;
    const modal = document.getElementById("stuckAddModal");
    if (!modal) return;
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
}

function handleAddStuckKey(event) {
    if (event.key === "Escape") closeAddStuckStock();
}

async function addStuckStock() {
    if (!window.requireAdmin()) return;

    const nameInput = document.getElementById("stuckAddName");
    const qtyInput = document.getElementById("stuckAddQty");
    const buyInput = document.getElementById("stuckAddBuyPrice");
    const status = document.getElementById("stuckAddStatus");
    const saveBtn = document.getElementById("stuckAddSave");

    const name = nameInput?.value.trim() || "";
    const symbol = cleanSymbol(stuckAddSelectedSymbol || nameInput?.dataset.selected || "");
    const quantity = Number(qtyInput?.value);
    const buyPrice = Number(buyInput?.value);

    if (!name) { alert("Stock name enter kijiye"); nameInput?.focus(); return; }
    if (!symbol) { alert("Suggestion me se stock select kijiye"); nameInput?.focus(); return; }
    if (!Number.isFinite(quantity) || quantity <= 0) { alert("Valid quantity enter kijiye"); qtyInput?.focus(); return; }
    if (!Number.isFinite(buyPrice) || buyPrice <= 0) { alert("Valid buy price enter kijiye"); buyInput?.focus(); return; }

    if (status) { status.className = "stuck-add-status loading"; status.textContent = "Database me stock add ho raha hai..."; }
    if (saveBtn) { saveBtn.disabled = true; saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Adding...'; }

    try {
        const response = await fetch('/api/data/stuck', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            cache: 'no-store',
            body: JSON.stringify({ symbol, name, quantity, buyPrice })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.error) throw new Error(data.error || "Stock add nahi hua.");

        stuckStocks = Array.isArray(data.items) ? data.items : stuckStocks;
        closeAddStuckStock();
        await loadStuckStocks();
    } catch (error) {
        if (status) { status.className = "stuck-add-status error"; status.textContent = error.message || "Stock add nahi hua."; }
    } finally {
        if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Add Stock'; }
    }
}

document.addEventListener("keydown", handleAddStuckKey);

let draggedStuckIndex = null;
let stuckReorderSaving = false;

function bindStuckDragDrop() {
    const container = document.getElementById("stuckStockList");
    if (!container) return;
    const cards = container.querySelectorAll(".stuck-stock-row[draggable='true']");
    cards.forEach(card => {
        card.addEventListener("dragstart", event => {
            if (!window.requireAdmin() || editingStuckIndex !== null || stuckReorderSaving) {
                event.preventDefault();
                return;
            }
            draggedStuckIndex = Number(card.dataset.stuckIndex);
            card.classList.add("stuck-dragging");
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", String(draggedStuckIndex));
        });
        card.addEventListener("dragover", event => {
            if (draggedStuckIndex === null) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
            card.classList.add("stuck-drag-over");
        });
        card.addEventListener("dragleave", () => card.classList.remove("stuck-drag-over"));
        card.addEventListener("drop", async event => {
            event.preventDefault();
            card.classList.remove("stuck-drag-over");
            const from = draggedStuckIndex;
            const to = Number(card.dataset.stuckIndex);
            draggedStuckIndex = null;
            if (!Number.isInteger(from) || !Number.isInteger(to) || from === to) return;
            await reorderStuckByDrag(from, to);
        });
        card.addEventListener("dragend", () => {
            draggedStuckIndex = null;
            cards.forEach(c => c.classList.remove("stuck-dragging", "stuck-drag-over"));
        });
    });
}

function applyStuckDomOrder() {
    const container = document.getElementById("stuckStockList");
    if (!container) return;

    const cards = Array.from(container.querySelectorAll(".stuck-stock-row[draggable='true']"));
    const byId = new Map(cards.map(card => [String(card.dataset.stuckId || ""), card]));

    stuckStocks.forEach((stock, index) => {
        const card = byId.get(String(stock.id ?? ""));
        if (!card) return;
        card.dataset.stuckIndex = String(index);
        container.appendChild(card);
    });
}

async function reorderStuckByDrag(from, to) {
    if (!window.requireAdmin() || stuckReorderSaving) return;
    if (from < 0 || from >= stuckStocks.length || to < 0 || to >= stuckStocks.length) return;

    const next = [...stuckStocks];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    stuckReorderSaving = true;
    try {
        const response = await fetch('/api/data/stuck', {
            method: 'PATCH',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            cache: 'no-store',
            body: JSON.stringify({ order: next.map(stock => stock.id) })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.error) throw new Error(data.error || 'Reorder failed');
        // Reorder only the existing DOM cards. Do NOT call loadStuckStocks() here:
        // that function refetches every live price and briefly shows "Loading prices...".
        // Drag/drop should move the cards instantly while keeping their already-fetched prices.
        stuckStocks = Array.isArray(data.items) ? data.items : next;
        applyStuckDomOrder();
    } catch (error) {
        await loadStuckData();
        await loadStuckStocks();
        alert(error.message || 'Reorder failed');
    } finally {
        stuckReorderSaving = false;
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
