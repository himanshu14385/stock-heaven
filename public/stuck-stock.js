let stuckStocks = [];
let stuckPrices = {};
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

function renderStuckStocks(animateFrom = null) {
    const container = document.getElementById("stuckStockList");
    const updated = document.getElementById("stuckUpdated");
    if (!container) return;

    const visibleStocks = stuckStocks.slice(0, 20);
    container.innerHTML = visibleStocks.map((stock, index) => {
        const price = stuckPrices[String(stock.id ?? stock.symbol)] ?? null;
        return `
        <div class="stuck-stock-row" draggable="true" data-stuck-index="${index}" data-stuck-id="${escapeStuckHtml(stock.id ?? '')}"
             onclick="showStuckQuote('${String(stock.symbol || '').replace(/'/g, "\\'")}')"
             ondragstart="dragStuck(event, ${index})" ondragover="allowStuckDrop(event)" ondrop="dropStuck(event, ${index})">
            <div class="stuck-drag-handle" title="Drag to reorder" aria-label="Drag to reorder"><i class="fa-solid fa-grip-vertical"></i></div>
            <div class="ssname-wrap">
                <span class="stuck-stock-name">${escapeStuckHtml(stock.name)}</span>
                <span class="mystuckprice dnone">${escapeStuckHtml(stock.stuckInfo)}</span>
            </div>
            <div class="stuck-row-right">
                ${editingStuckIndex !== index
                    ? `<div class="stuck-actions" onclick="event.stopPropagation()">
                        <button class="stuck-action stuck-edit" onclick="event.stopPropagation();editStuck(${index})" title="Edit"><i class="fa-solid fa-pen"></i></button>
                        <button class="stuck-action stuck-delete" onclick="event.stopPropagation();deleteStuck(${index})" title="Delete"><i class="fa-solid fa-trash-can"></i></button>
                       </div>`
                    : ``}
                <div class="ssname-wrap">
                    <span class="stuck-stock-price">${formatStuckPrice(price)}</span>
                    ${editingStuckIndex === index
                        ? `<div class="stuck-edit-wrap" onclick="event.stopPropagation()">
                            <input class="stuck-info-input" id="stuckInfoInput${index}" type="text" value="${escapeStuckHtml(stock.stuckInfo)}" aria-label="Edit stuck stock quantity and price" onkeydown="handleStuckEditKey(event, ${index})">
                            <button class="stuck-action stuck-save" onclick="event.stopPropagation();saveStuckEdit(${index})" title="Save"><i class="fa-solid fa-check"></i></button>
                            <button class="stuck-action stuck-cancel" onclick="event.stopPropagation();cancelStuckEdit(event)" title="Cancel"><i class="fa-solid fa-xmark"></i></button>
                          </div>`
                        : `<span class="mystuckprice">${escapeStuckHtml(stock.stuckInfo)}</span>`}
                </div>
            </div>
        </div>`;
    }).join("");

    if (updated) {
        updated.textContent = "Prices fetched: " + new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
    }

    // FLIP animation: after a swap, cards travel from their old grid
    // positions to their new grid positions instead of appearing to jump.
    if (animateFrom && animateFrom.size) {
        requestAnimationFrame(() => {
            container.querySelectorAll('.stuck-stock-row[data-stuck-id]').forEach(row => {
                const id = String(row.dataset.stuckId || '');
                const previous = animateFrom.get(id);
                if (!previous) return;
                const current = row.getBoundingClientRect();
                const dx = previous.left - current.left;
                const dy = previous.top - current.top;
                if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
                row.animate(
                    [
                        { transform: `translate(${dx}px, ${dy}px)` },
                        { transform: 'translate(0, 0)' }
                    ],
                    { duration: 220, easing: 'cubic-bezier(.2,.8,.2,1)' }
                );
            });
        });
    }
}

async function loadStuckStocks() {
    const container = document.getElementById("stuckStockList");
    if (!container) return;

    container.innerHTML = `<div class="stuck-loading"><i class="fa-solid fa-spinner fa-spin"></i> Loading prices...</div>`;

    const results = await Promise.all(
        stuckStocks.slice(0, 20).map(async stock => {
            const price = await getStuckStockPrice(stock.symbol);
            return { id: stock.id, symbol: stock.symbol, price };
        })
    );

    results.forEach(item => {
        stuckPrices[String(item.id ?? item.symbol)] = item.price;
    });

    renderStuckStocks();
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

// Native full-row drag/drop, matching the Favourite Stock interaction.
// A drop is a TRUE SWAP: the dragged card and target card exchange positions.
function dragStuck(event, index) {
    if (!window.requireAdmin() || editingStuckIndex !== null || stuckReorderSaving) {
        event.preventDefault();
        return;
    }
    draggedStuckIndex = Number(index);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(index));
    event.currentTarget.classList.add("stuck-dragging");
}

function allowStuckDrop(event) {
    if (draggedStuckIndex === null) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";

    document.querySelectorAll("#stuckStockList .stuck-stock-row.stuck-drag-over").forEach(row => {
        if (row !== event.currentTarget) row.classList.remove("stuck-drag-over");
    });
    if (event.currentTarget !== event.target.closest?.('.stuck-stock-row')) return;
    event.currentTarget.classList.add("stuck-drag-over");
}

function dropStuck(event, targetIndex) {
    if (!window.requireAdmin()) return;
    event.preventDefault();
    event.stopPropagation();

    if (draggedStuckIndex === null) return;

    const from = Number(draggedStuckIndex);
    const target = Number(targetIndex);
    draggedStuckIndex = null;

    document.querySelectorAll("#stuckStockList .stuck-stock-row").forEach(row => {
        row.classList.remove("stuck-dragging", "stuck-drag-over");
    });

    if (!Number.isInteger(from) || !Number.isInteger(target) || from === target) return;
    if (!stuckStocks[from] || !stuckStocks[target]) return;

    // Capture positions before changing the grid so the two cards can
    // animate directly into each other's old position.
    const previousRects = new Map();
    document.querySelectorAll("#stuckStockList .stuck-stock-row[data-stuck-id]").forEach(row => {
        previousRects.set(String(row.dataset.stuckId || ''), row.getBoundingClientRect());
    });

    // TRUE SWAP — do not splice/remove/insert. This prevents the cards
    // between source and target from shifting position.
    const temp = stuckStocks[from];
    stuckStocks[from] = stuckStocks[target];
    stuckStocks[target] = temp;

    renderStuckStocks(previousRects);

    const orderedIds = stuckStocks
        .map(stock => Number(stock.id))
        .filter(Number.isInteger);

    if (orderedIds.length === stuckStocks.length) {
        persistStuckOrder(orderedIds);
    }
}

document.addEventListener("dragend", () => {
    document.querySelectorAll("#stuckStockList .stuck-stock-row").forEach(row => {
        row.classList.remove("stuck-dragging", "stuck-drag-over");
    });
    draggedStuckIndex = null;
});

async function persistStuckOrder(order) {
    if (!window.requireAdmin() || stuckReorderSaving || !Array.isArray(order) || order.length < 2) return;
    stuckReorderSaving = true;
    try {
        const response = await fetch('/api/data/stuck', {
            method: 'PATCH',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            cache: 'no-store',
            body: JSON.stringify({ order })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.error) throw new Error(data.error || 'Reorder failed');

        if (Array.isArray(data.items) && data.items.length === stuckStocks.length) {
            const serverById = new Map(data.items.map(item => [String(item.id), item]));
            stuckStocks = order.map(id => serverById.get(String(id))).filter(Boolean);
            renderStuckStocks();
        }
    } catch (error) {
        console.error('Stuck Stock reorder save failed:', error);
        try {
            await loadStuckData();
            renderStuckStocks();
        } catch (_) {}
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
