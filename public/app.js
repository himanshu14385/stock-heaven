(() => {
const nav = document.querySelector("#mainNav");
const username = document.querySelector("#username");
const role = document.querySelector("#role");

async function loadNavigation() {
  const r = await fetch("/api/navigation", { cache: "no-store" });
  if (!r.ok) throw new Error("Navigation failed");
  const data = await r.json();
  const current = document.body.dataset.page || "home";
  nav.innerHTML = data.navigation.map(item =>
    `<a class="${item.key === current ? "active" : ""}" href="${item.href}">${item.label}</a>`
  ).join("");
}
async function loadSession() {
  const r = await fetch("/api/session", { cache: "no-store" });
  if (!r.ok) return;
  const data = await r.json();
  if (data.user) {
    username.textContent = data.user.username;
    role.textContent = data.user.role === "admin" ? "Administrator" : "Guest";
  }
}
loadNavigation().catch(console.error);
loadSession().catch(console.error);
})();
