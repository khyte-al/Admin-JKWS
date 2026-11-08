import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword, updateProfile, reauthenticateWithCredential, EmailAuthProvider } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, collection, doc, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot, writeBatch, arrayUnion, serverTimestamp, Timestamp, query, orderBy, limit, runTransaction } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

/* ============ STEP 1: paste your apiKey (from lib/firebase_options.dart, the "web" section) ============ */
const firebaseConfig = {
    apiKey: "AIzaSyBMXFEJfCjxKx9_vme12L4Ndu3I_B9ha00",
    authDomain: "jkws-beauty.firebaseapp.com",
    projectId: "jkws-beauty",
    storageBucket: "jkws-beauty.firebasestorage.app",
    messagingSenderId: "237971762366",
    appId: "1:237971762366:web:0bce0d3ad3692c125c42ef"
  };
/* ======================================================================================================== */

const auth = getAuth(initializeApp(firebaseConfig));
const auth2 = getAuth(initializeApp(firebaseConfig, "creator")); // only used to create accounts, so the admin stays signed in
const db = getFirestore();

const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const peso = n => "₱" + Number(n || 0).toLocaleString("en-PH", { maximumFractionDigits: 0 });
const fmt = t => t?.toDate ? t.toDate().toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" }) : "-";
const imgSrc = p => !p ? "" : /^(https?:|data:)/.test(p) ? p : "assets/" + p; // bundled paths work when this file sits in the Flutter web folder
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
const toHex = n => n == null ? "" : "#" + (n & 0xFFFFFF).toString(16).padStart(6, "0").toUpperCase();
const fromHex = h => { h = (h || "").trim().replace("#", ""); return /^[0-9a-fA-F]{6}$/.test(h) ? parseInt("FF" + h, 16) : null; };
const app = $("#app"), dlg = $("#editor");
let unsubs = [], view = "products", cache = {};

function toast(m) { const t = $("#toast"); t.textContent = m; t.classList.add("show"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("show"), 2200); }
function thumb(p) { return p ? `<img class="thumb" src="${esc(imgSrc(p))}" alt="" onerror="this.outerHTML='<div class=&quot;thumb&quot;>no photo</div>'">` : `<div class="thumb">no photo</div>`; }
function listen(q, cb) { unsubs.push(onSnapshot(q, cb, e => { $("#list").innerHTML = `<div class="empty">Could not load: ${esc(e.message)}</div>`; })); }

/* ---------- sign in ---------- */
onAuthStateChanged(auth, async user => {
  unsubs.forEach(u => u()); unsubs = [];
  if (!user) return showLogin();
  try {
    const me = await getDoc(doc(db, "users", user.uid));
    const mine = me.data() || {}, role = mine.role;
    if (mine.archived || mine.status === "inactive") return showBlocked(`The account ${user.email} is ${mine.archived ? "archived" : "inactive"}. Ask an admin to make it active again.`);
    if (["admin", "cashier", "delivery"].includes(role)) return showShell(user, role);
    showBlocked(`The account ${user.email} does not have staff access. Ask an admin to give it a role.`);
  } catch (e) { showBlocked("Could not check your account: " + e.message); }
});

/* ---------- login page design ---------- */
// Put your logo at  image/logo.png  (the same file the sidebar uses). Until then a text "JKWS" is shown.
const LOGO_HTML = `<img src="image/JKWS.png" alt="JKWS logo" class="lg-logo" onerror="this.replaceWith(Object.assign(document.createElement('div'), { className: 'lg-wordmark', textContent: 'JKWS' }))">`;
document.head.insertAdjacentHTML("beforeend", `<style id="lg-style">
.lg{min-height:100vh;display:grid;place-items:center;padding:24px;background:radial-gradient(circle at 15% 12%,#f4d9d9 0,transparent 42%),radial-gradient(circle at 88% 90%,#f1d6cb 0,transparent 40%),var(--bg)}
.lg-card{width:100%;max-width:420px;background:var(--card);border-radius:20px;padding:36px 32px 26px;box-shadow:0 20px 60px rgba(129,81,82,.15);text-align:center}
.lg-logo{display:block;max-width:190px;max-height:150px;width:auto;height:auto;margin:0 auto 14px;object-fit:contain}
.lg-wordmark{font-family:"Bodoni Moda",serif;font-size:46px;font-weight:600;color:var(--primary);letter-spacing:.05em;margin-bottom:6px}
.lg-card h1{font-size:26px;margin:2px 0 4px}
.lg-sub{color:var(--muted);font-size:13px;margin:0 0 22px}
.lg-form{display:grid;gap:14px;text-align:left}
.lg-form .f span{font-size:12px;color:var(--muted);font-weight:600}
.lg-pw{position:relative}.lg-pw input{padding-right:70px}
.lg-pw button{position:absolute;right:8px;top:50%;transform:translateY(-50%);border:0;background:none;color:var(--primary);font-weight:600;font-size:12px;cursor:pointer;padding:6px}
.lg-btn{width:100%;padding:13px;font-size:15px;margin-top:2px}
.lg-note{margin-top:22px;font-size:12px;color:var(--outline)}
@media (max-width:480px){.lg{padding:12px}.lg-card{padding:28px 20px 22px}}
</style>`);

function showLogin() {
  app.innerHTML = `<div class="lg"><div class="lg-card">
    ${LOGO_HTML}
    <p class="lg-sub">Sign in to the JKWS admin panel</p>
    <form id="lf" class="lg-form">
      <label class="f"><span>Email</span><input name="email" type="email" required autocomplete="username" placeholder="you@example.com"></label>
      <label class="f"><span>Password</span><div class="lg-pw"><input name="pw" id="lpw" type="password" required autocomplete="current-password" placeholder="Your password"><button type="button" id="pwt">Show</button></div></label>
      <div class="err" id="le"></div>
      <button class="btn lg-btn" id="lb">Sign in</button>
    </form>
    <div class="lg-note">Just Keep Wearing Your Smile · Staff access only</div>
  </div></div>`;
  $("#pwt").onclick = () => { const i = $("#lpw"), show = i.type === "password"; i.type = show ? "text" : "password"; $("#pwt").textContent = show ? "Hide" : "Show"; };
  $("#lf").onsubmit = async e => {
    e.preventDefault(); const f = new FormData(e.target); $("#lb").disabled = true; $("#lb").textContent = "Signing in…"; $("#le").textContent = "";
    try { await signInWithEmailAndPassword(auth, f.get("email").trim(), f.get("pw")); }
    catch (err) {
      $("#le").textContent = err.code === "auth/invalid-api-key" ? "The apiKey in the script is missing or wrong." : err.code === "auth/network-request-failed" ? "No internet connection." : err.code === "auth/too-many-requests" ? "Too many attempts. Please try again in a few minutes." : "Incorrect email or password.";
      $("#lb").disabled = false; $("#lb").textContent = "Sign in";
    }
  };
}
function showBlocked(msg) {
  app.innerHTML = `<div class="lg"><div class="lg-card">${LOGO_HTML}<h1>Access unavailable</h1><p class="lg-sub" style="margin-bottom:18px">${esc(msg)}</p><button class="btn lg-btn" id="so">Sign out</button></div></div>`;
  $("#so").onclick = () => confirmSignOut();
}

function confirmSignOut() {
  dlg.innerHTML = `<div class="ed">
    <h2>Confirm Sign Out</h2>
    <p>Are you sure you want to sign out of JKWS Admin?</p>
    <div class="actions">
      <button type="button" class="btn ghost" id="cxSo">Cancel</button>
      <button type="button" class="btn danger" id="doSo">Sign out</button>
    </div>
  </div>`;
  dlg.showModal();
  $("#cxSo").onclick = () => dlg.close();
  $("#doSo").onclick = () => {
    dlg.close();
    signOut(auth);
  };
}

/* ---------- shell ---------- */
let ROLE = "admin";
const NAV = { admin: [["dashboard", "Dashboard"], ["products", "Product Management"], ["orders", "Order Management"], ["reports", "Reports"], ["staff", "Staff accounts"], ["customers", "Customer accounts"]], cashier: [["orders", "Order Management"]], delivery: [["orders", "Deliveries"]] };
function showShell(user, role) {
  ROLE = role; view = NAV[role][0][0];
  app.innerHTML = `<div class="shell">
    <aside class="side">
      <div class="brand">
        <button class="menu-toggle" id="menuToggle" aria-label="Toggle navigation">☰</button>
        <img src="image/logo.png" alt="JKWS Logo" class="brand-logo" onerror="this.style.display='none'">
        <span class="brand-title">JKWS</span>
      </div>
      <div class="nav-links-container" id="navLinksContainer">
        ${NAV[role].map(([v, l]) => `<button class="nav" data-v="${v}">${l}</button>`).join("")}
        <button class="nav nav-signout" id="out">Sign out</button>
      </div>
      <div class="who">${esc(user.email)}<br>${esc(role)}</div>
    </aside>
    <main id="main"></main>
  </div>`;

  // Toggle drawer on hamburger click
  $("#menuToggle").onclick = () => {
    $("#navLinksContainer").classList.toggle("open");
  };

  app.querySelectorAll("[data-v]").forEach(b => b.onclick = () => {
    go(b.dataset.v);
    $("#navLinksContainer").classList.remove("open");
  });
  $("#out").onclick = () => confirmSignOut();
  go(view);
}
function go(v) {
  unsubs.forEach(u => u()); unsubs = []; view = v;
  const alias = { inventory: "products", archived: "products", archivedOrders: "orders", archivedStaff: "staff", archivedCustomers: "customers" };
  const nav = alias[v] || v;
  app.querySelectorAll("[data-v]").forEach(b => b.classList.toggle("on", b.dataset.v === nav));
  ({ dashboard: dashboardView, products: productsView, inventory: inventoryView, archived: archivedView, orders: ordersView, archivedOrders: archivedOrdersView, reports: reportsView, staff: staffView, archivedStaff: archivedStaffView, customers: customersView, archivedCustomers: archivedCustomersView })[v]();
}
const pmTabs = active => `<div class="tabs">${[["products", "Brands and products"], ["inventory", "Inventory"], ["archived", "Archived"]].map(([v, l]) => `<button class="tab ${v === active ? "on" : ""}" data-pm="${v}">${l}</button>`).join("")}</div>`;
const orderTabs = active => `<div class="tabs">${[["orders", "Active orders"], ["archivedOrders", "Archived orders"]].map(([v, l]) => `<button class="tab ${v === active ? "on" : ""}" data-ot="${v}">${l}</button>`).join("")}</div>`;
function addPmTabs(active) { $("#main .head").insertAdjacentHTML("afterend", pmTabs(active)); $("#main").querySelectorAll("[data-pm]").forEach(b => b.onclick = () => go(b.dataset.pm)); }
function addOrderTabs(active) { $("#main .head").insertAdjacentHTML("afterend", orderTabs(active)); $("#main").querySelectorAll("[data-ot]").forEach(b => b.onclick = () => go(b.dataset.ot)); }

/* load several collections live and call render(data) whenever any of them changes */
function watch(names, render) {
  const data = {}; names.forEach(n => data[n] = null);
  names.forEach(n => unsubs.push(onSnapshot(collection(db, n), snap => { data[n] = {}; snap.docs.forEach(d => data[n][d.id] = d.data()); if (names.every(k => data[k])) render(data); }, e => { $("#list").innerHTML = `<div class="empty">Could not load ${n}: ${esc(e.message)}</div>`; })));
}
const isSale = o => ["confirmed", "shipped", "delivered"].includes(o.status);
const odate = o => o.createdAt?.toDate ? o.createdAt.toDate() : null;
const ymd = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const LOW = 5;
const stockPill = s => typeof s !== "number" ? `<span class="pill">Not tracked</span>` : s <= 0 ? `<span class="pill out">Out of stock</span>` : s <= LOW ? `<span class="pill low">${s} left</span>` : `<span class="pill ok">${s} in stock</span>`;
function lowStock(products) {
  const out = [];
  Object.entries(products).forEach(([pid, p]) => {
    if (p.active === false) return;
    if ((p.shades || []).length) p.shades.forEach(s => { if (typeof s.stock === "number" && s.stock <= LOW) out.push({ pid, name: p.name, shade: s.name, stock: s.stock }); });
    else if (typeof p.stock === "number" && p.stock <= LOW) out.push({ pid, name: p.name, shade: "", stock: p.stock });
  });
  return out.sort((x, y) => x.stock - y.stock);
}
const page = (title, actions = "") => { $("#main").innerHTML = `<div class="head"><h1>${title}</h1>${actions}</div><div id="list"><div class="empty">Loading…</div></div>`; };

/* ---------- catalog: brands, then products ---------- */
const CATS = ["Concealer", "Foundation", "Blush", "Lip", "Highlighter", "Brow", "Other"];
const inferCats = n => { n = (n || "").toLowerCase(); const c = [];[["concealer", "Concealer"], ["foundation", "Foundation"], ["blush|rouge", "Blush"], ["lip", "Lip"], ["highlighter", "Highlighter"], ["brow", "Brow"]].forEach(([re, l]) => { if (new RegExp(re).test(n)) c.push(l); }); return c.length ? c : ["Other"]; };
let brandsCache = {};

/* shrink a chosen photo to a small JPEG so it can be saved straight in the database */
async function shrink(file, max, cap) {
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); });
  let scale = Math.min(1, max / Math.max(img.width, img.height)), q = .85, out = "";
  for (let k = 0; k < 7; k++) {
    const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(img.width * scale)); c.height = Math.max(1, Math.round(img.height * scale));
    const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
    out = c.toDataURL("image/jpeg", q); if (out.length < cap) break; q = Math.max(.5, q - .08); scale *= .85;
  }
  URL.revokeObjectURL(img.src); return out;
}
const picker = (name, cur, label) => {
  const isData = (cur || "").startsWith("data:"); return `<div class="f wide"><span>${label}</span><div class="pp" data-pp="${name}">
${cur ? `<img src="${esc(imgSrc(cur))}" alt="">` : `<div class="ph"></div>`}
<div style="flex:1;display:grid;gap:6px"><input type="file" accept="image/*" class="pp-file"><input name="${name}Link" placeholder="or paste a link / assets path" value="${esc(isData ? "" : cur || "")}"><input type="hidden" name="${name}Data" value="${isData ? esc(cur) : ""}"></div></div></div>`;
};
function bindPickers(root, max, cap) {
  root.querySelectorAll(".pp").forEach(pp => {
    const file = $(".pp-file", pp), link = $("[name$=Link]", pp), data = $("[name$=Data]", pp);
    file.onchange = async () => { if (!file.files[0]) return; try { const u = await shrink(file.files[0], max, cap); data.value = u; link.value = ""; pp.firstElementChild.outerHTML = `<img src="${u}" alt="">`; } catch { toast("Could not read that photo"); } };
    link.oninput = () => { if (link.value.trim()) data.value = ""; };
  });
}
const pickVal = (f, n) => (f.get(n + "Link") || "").trim() || f.get(n + "Data") || "";

const inp = (label, name, val = "", o = {}) => `<label class="f ${o.wide ? "wide" : ""}"><span>${label}</span>${o.area
  ? `<textarea name="${name}" rows="${o.rows || 3}" placeholder="${esc(o.hint ?? "")}">${esc(val)}</textarea>`
  : `<input name="${name}" value="${esc(val)}" placeholder="${esc(o.hint ?? "")}" ${o.type ? `type="${o.type}"` : ""} ${o.min != null ? `min="${o.min}"` : ""} ${o.ro ? "readonly" : ""}>`}</label>`;
const shadeRow = (s = {}) => {
  const up = (s.image || "").startsWith("data:"); return `<div class="sr" ${up ? `data-up="${esc(s.image)}"` : ""}><input class="s-name" placeholder="Name" value="${esc(s.name)}"><input class="s-sub" placeholder="Subtitle (optional)" value="${esc(s.subtitle)}">
<div class="s-imgcell"><img class="s-prev" ${s.image ? `src="${esc(imgSrc(s.image))}"` : "hidden"} alt=""><input class="s-img" placeholder="link or path" value="${up ? "" : esc(s.image)}"><label class="btn ghost sm" style="white-space:nowrap">Photo<input type="file" accept="image/*" class="s-file" hidden></label></div>
<div class="s-colcell"><input class="s-col" placeholder="#RRGGBB" value="${esc(toHex(s.color))}"><i class="sw" style="background:${esc(toHex(s.color) || "transparent")}"></i></div>
<input class="s-stock" type="number" min="0" placeholder="Stock" value="${s.stock ?? ""}">
<button type="button" class="btn ghost sm s-x" aria-label="Remove shade">✕</button></div>`;
};

/* level 1: brands */
function productsView() {
  page("Product Management", `<button class="btn" id="addb">Add brand</button>`);
  addPmTabs("products");
  const st = { b: null, p: null };
  $("#addb").onclick = () => openBrandEditor(null, {});
  const migrate = async () => {   // create brand records for brands that only exist inside products
    if (!st.b || !st.p || migrate.done) return;
    const missing = [...new Set(Object.values(st.p).map(p => p.brand).filter(Boolean))].filter(n => !st.b[slug(n)]);
    if (!missing.length) return; migrate.done = true;
    const w = writeBatch(db); missing.forEach((n, i) => w.set(doc(db, "brands", slug(n)), { name: n, description: "", image: "", active: true, sortOrder: Object.keys(st.b).length + i })); await w.commit();
  };
  const draw = () => {
    if (!st.b || !st.p) return;
    brandsCache = st.b; cache = st.p; migrate();
    const ids = Object.keys(st.b).filter(id => st.b[id].active !== false).sort((x, y) => (st.b[x].sortOrder ?? 99) - (st.b[y].sortOrder ?? 99));
    if (!ids.length) { $("#list").innerHTML = `<div class="empty">No brands yet. Use “Add brand” to start your catalog.</div>`; return; }
    $("#list").innerHTML = ids.map(id => {
      const b = st.b[id], ps = Object.values(st.p).filter(p => p.brand === b.name), arch = ps.filter(p => p.active === false).length;
      return `<div class="row">${b.image ? thumb(b.image) : `<div class="thumb" style="font-weight:700;font-size:20px;color:var(--primary)">${esc((b.name || "?")[0])}</div>`}
  <div class="grow"><div class="t">${esc(b.name)} ${b.active === false ? '<span class="pill warn">Archived</span>' : ""}</div><div class="s">${ps.length} product${ps.length === 1 ? "" : "s"}${arch ? ` · ${arch} archived` : ""}</div></div>
  <button class="btn sm" data-open="${esc(id)}">Open</button><button class="btn ghost sm" data-be="${esc(id)}">Edit</button>
  <button class="btn ghost sm" data-ba="${esc(id)}">${b.active === false ? "Restore" : "Archive"}</button>${ps.length ? "" : `<button class="btn danger sm" data-bd="${esc(id)}">Delete</button>`}</div>`;
    }).join("");
  };
  listen(collection(db, "brands"), snap => { st.b = {}; snap.docs.forEach(d => st.b[d.id] = d.data()); draw(); });
  listen(collection(db, "products"), snap => { st.p = {}; snap.docs.forEach(d => st.p[d.id] = d.data()); draw(); });
  $("#list").onclick = async e => {
    const o = e.target.closest("[data-open]"), ed = e.target.closest("[data-be]"), ar = e.target.closest("[data-ba]"), bd = e.target.closest("[data-bd]");
    if (bd && confirm(`Delete the brand ${st.b[bd.dataset.bd].name}? This cannot be undone.`)) { await deleteDoc(doc(db, "brands", bd.dataset.bd)); toast("Brand deleted"); }
    if (o) brandView(o.dataset.open);
    if (ed) openBrandEditor(ed.dataset.be, st.b[ed.dataset.be]);
    if (ar) {
      const b = st.b[ar.dataset.ba], off = b.active !== false;
      if (off && !confirm(`Archive ${b.name}? The brand and all its products will be hidden from the app. You can restore it any time.`)) return;
      await updateDoc(doc(db, "brands", ar.dataset.ba), { active: !off }); toast(off ? "Brand archived" : "Brand restored");
    }
  };
}

function openBrandEditor(id, b = {}) {
  dlg.innerHTML = `<form class="ed" id="bf"><h2>${id ? "Edit brand" : "Add brand"}</h2><div class="grid">${picker("image", b.image, "Brand photo or logo")}
${inp("Brand name", "name", b.name, { ro: !!id, hint: "e.g. Lucky Beauty" })}<label class="f"><span>In the app</span><label class="switch"><input type="checkbox" name="active" ${b.active === false ? "" : "checked"} style="width:auto"> Visible</label></label>
${inp("Description (optional)", "description", b.description, { area: 1, rows: 3, wide: 1 })}</div>
<div class="err" id="ee"></div><div class="actions"><button type="button" class="btn ghost" id="cx">Cancel</button><button class="btn" id="sv">Save brand</button></div></form>`;
  dlg.showModal(); bindPickers(dlg, 600, 200000); $("#cx").onclick = () => dlg.close();
  $("#bf").onsubmit = async e => {
    e.preventDefault(); const f = new FormData(e.target), name = f.get("name").trim();
    if (!name) { $("#ee").textContent = "Please enter the brand name."; return; }
    const bid = id || slug(name);
    if (!id && (await getDoc(doc(db, "brands", bid))).exists() && !confirm("This brand already exists. Overwrite it?")) return;
    $("#sv").disabled = true;
    try { await setDoc(doc(db, "brands", bid), { name, description: f.get("description").trim(), image: pickVal(f, "image"), active: f.get("active") === "on", sortOrder: b.sortOrder ?? Object.keys(brandsCache).length }); dlg.close(); toast("Brand saved"); }
    catch (err) { $("#ee").textContent = "Could not save: " + err.message; $("#sv").disabled = false; }
  };
}

/* level 2: the products of one brand */
function brandView(bid) {
  unsubs.forEach(u => u()); unsubs = [];
  const b = brandsCache[bid]; if (!b) return go("products");
  $("#main").innerHTML = `<div class="head"><button class="btn ghost sm" id="back">← Product Management</button><h1>${esc(b.name)}</h1><button class="btn danger" id="archiveall">Archive all products</button><button class="btn" id="addp">Add product</button></div>
  <div class="bar2"><label class="f"><span>Search products</span><input id="pq" placeholder="Product name or category" style="width:280px"></label></div>
  <div id="list"><div class="empty">Loading…</div></div>`;
  
  $("#back").onclick = () => go("products");
  let all = {}, showArch = false;
  
  $("#archiveall").onclick = async () => {
    const mine = Object.keys(all).filter(id => all[id].brand === b.name && all[id].active !== false);
    if (!mine.length) return toast("There are no active products to archive");
    if (!confirm(`Archive all ${mine.length} active products of ${b.name}? They will be hidden from the app and moved to the Archived tab.`)) return;
    try {
      const w = writeBatch(db);
      mine.forEach(id => w.update(doc(db, "products", id), { active: false }));
      await w.commit();
      toast("All products archived");
      go("archived");
    } catch (e) {
      toast("Could not archive products: " + e.message);
    }
  };

  const draw = () => {
    const q = ($("#pq")?.value || "").toLowerCase().trim();
    const ids = Object.keys(all).filter(id => {
      const p = all[id];
      if (p.brand !== b.name) return false;
      if (!showArch && p.active === false) return false;
      if (q) {
        const matchName = (p.name || "").toLowerCase().includes(q);
        const matchCats = (p.categories || []).some(c => c.toLowerCase().includes(q));
        if (!matchName && !matchCats) return false;
      }
      return true;
    }).sort((x, y) => (all[x].sortOrder ?? 9999) - (all[y].sortOrder ?? 9999));

    if (!ids.length) { $("#list").innerHTML = `<div class="empty">No products match your search.</div>`; return; }
    $("#list").innerHTML = ids.map(id => {
      const p = all[id], off = p.active === false; return `<div class="row">${thumb(p.image)}
  <div class="grow"><div class="t">${esc(p.name)} ${off ? '<span class="pill warn">Archived</span>' : ""}</div><div class="s">${peso(p.price)} · ${(p.shades || []).length} ${esc((p.shadeLabel || "Shade").toLowerCase())}s · ${esc((p.categories?.length ? p.categories : inferCats(p.name)).join(", "))}</div></div>
  <button class="btn ghost sm" data-edit="${esc(id)}">Edit</button><button class="btn ghost sm" data-arch="${esc(id)}">${off ? "Restore" : "Archive"}</button>${off ? `<button class="btn danger sm" data-del="${esc(id)}">Delete</button>` : ""}</div>`;
    }).join("");
  };

  listen(collection(db, "products"), snap => { all = {}; snap.docs.forEach(d => all[d.id] = d.data()); cache = all; draw(); });
  $("#addp").onclick = () => openEditor(null, { brand: b.name, sortOrder: Object.values(all).length });
  $("#pq").oninput = draw;

  $("#list").onclick = async e => {
    const ed = e.target.closest("[data-edit]"), ar = e.target.closest("[data-arch]"), de = e.target.closest("[data-del]");
    if (ed) openEditor(ed.dataset.edit, all[ed.dataset.edit]);
    if (ar) { const off = all[ar.dataset.arch].active !== false; await updateDoc(doc(db, "products", ar.dataset.arch), { active: !off }); toast(off ? "Archived. It is hidden from the app." : "Restored"); }
    if (de && confirm(`Delete "${all[de.dataset.del].name}" for good? This cannot be undone.`)) { await deleteDoc(doc(db, "products", de.dataset.del)); toast("Deleted"); }
  };
}

function openEditor(id, p = {}) {
  const bnames = Object.values(brandsCache).map(x => x.name); if (p.brand && !bnames.includes(p.brand)) bnames.push(p.brand);
  const cats = p.categories?.length ? p.categories : (p.name ? inferCats(p.name) : []);
  let banners = [...(p.banners || [])];
  dlg.innerHTML = `<form class="ed" id="ef"><h2>${id ? "Edit product" : "Add product"}</h2><div class="grid">
${picker("image", p.image, "Main product photo")}
${inp("Product name", "name", p.name)}<label class="f"><span>Brand</span><select name="brand" style="width:100%">${bnames.map(n => `<option ${n === p.brand ? "selected" : ""}>${esc(n)}</option>`).join("")}</select></label>
${inp("Price (PHP)", "price", p.price ?? "", { type: "number", min: 0 })}
<label class="f"><span>Variants are called</span><select name="shadeLabel" style="width:100%"><option ${p.shadeLabel === "Option" ? "" : "selected"}>Shade</option><option ${p.shadeLabel === "Option" ? "selected" : ""}>Option</option></select></label>
<div class="f wide"><span>Product type (used for filtering in the app)</span><div class="cats">${CATS.map(c => `<label><input type="checkbox" name="cat" value="${c}" ${cats.includes(c) ? "checked" : ""}> ${c}</label>`).join("")}</div></div>
${inp("Description", "description", p.description, { area: 1, rows: 4, wide: 1 })}
<div class="f wide"><span>Banner photos, such as shade guides (optional)</span><div id="bnr"></div><input type="file" accept="image/*" multiple id="bfile"><input id="blink" placeholder="or paste a link / assets path and press Enter"></div>
${inp("Price note (optional)", "priceNote", p.priceNote)}${inp("Sort order", "sortOrder", p.sortOrder ?? 0, { type: "number" })}${inp("Stock (only for a product without shades)", "stock", p.stock ?? "", { type: "number", min: 0 })}
${inp("Banner shape (2 = wide, 1 = square)", "bannerRatio", p.bannerRatio ?? 2, { type: "number" })}
<label class="f"><span>In the app</span><label class="switch"><input type="checkbox" name="active" ${p.active === false ? "" : "checked"} style="width:auto"> Visible</label></label></div>
<div class="shades"><div class="bar"><h3>Shades and options</h3><button type="button" class="btn ghost sm" id="addS">Add shade</button></div><div id="srows">${(p.shades || []).map(shadeRow).join("")}</div></div>
<div class="err" id="ee"></div><div class="actions"><button type="button" class="btn ghost" id="cx">Cancel</button><button class="btn" id="sv">Save product</button></div></form>`;
  dlg.showModal(); bindPickers(dlg, 800, 180000);
  const drawB = () => $("#bnr").innerHTML = `<div class="chips">${banners.map((b, i) => `<div class="bn"><img src="${esc(imgSrc(b))}" alt="" style="width:110px;height:62px;object-fit:cover;border-radius:8px;background:var(--low)"><button type="button" class="btn ghost sm b-x" data-i="${i}" style="position:absolute;top:2px;right:2px;padding:1px 8px">✕</button></div>`).join("")}</div>`;
  drawB();
  $("#bnr").onclick = e => { const x = e.target.closest(".b-x"); if (x) { banners.splice(+x.dataset.i, 1); drawB(); } };
  $("#bfile").onchange = async e => { for (const file of e.target.files) { try { banners.push(await shrink(file, 1200, 150000)); } catch { toast("Could not read a photo"); } } e.target.value = ""; drawB(); };
  $("#blink").onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); if (e.target.value.trim()) { banners.push(e.target.value.trim()); e.target.value = ""; drawB(); } } };
  $("#cx").onclick = () => dlg.close();
  $("#addS").onclick = () => $("#srows").insertAdjacentHTML("beforeend", shadeRow());
  $("#srows").onclick = e => e.target.closest(".s-x")?.closest(".sr").remove();
  $("#srows").oninput = e => {
    const t = e.target, row = t.closest(".sr");
    if (t.classList.contains("s-col")) t.nextElementSibling.style.background = fromHex(t.value) != null ? "#" + t.value.replace("#", "") : "transparent";
    if (t.classList.contains("s-img")) { delete row.dataset.up; const pv = $(".s-prev", row); pv.src = imgSrc(t.value.trim()); pv.hidden = !t.value.trim(); }
    if (t.classList.contains("s-stock") && parseFloat(t.value) < 0) { t.value = 0; }
  };
  $("#srows").onchange = async e => {
    if (!e.target.classList.contains("s-file") || !e.target.files[0]) return;
    const row = e.target.closest(".sr");
    try { const u = await shrink(e.target.files[0], 480, 38000); row.dataset.up = u; $(".s-img", row).value = ""; const pv = $(".s-prev", row); pv.src = u; pv.hidden = false; } catch { toast("Could not read that photo"); }
  };
  $("#ef").onsubmit = async e => {
    e.preventDefault(); const f = new FormData(e.target), name = f.get("name").trim(), brand = f.get("brand"), price = parseFloat(f.get("price"));
    if (!name || !brand || isNaN(price)) { $("#ee").textContent = "Name, brand and a valid price are required."; return; }
    if (price < 0) { $("#ee").textContent = "Price cannot be a negative number."; return; }
    const pid = id || slug(name);
    if (!id && (await getDoc(doc(db, "products", pid))).exists() && !confirm("A product with this name already exists. Overwrite it?")) return;
    const nz = v => v.trim() || null;
    const data = {
      name, brand, price, description: f.get("description").trim(), image: pickVal(f, "image"), banners, bannerRatio: parseFloat(f.get("bannerRatio")) || 2,
      categories: f.getAll("cat"), shadeLabel: f.get("shadeLabel"), priceNote: nz(f.get("priceNote")), sortOrder: parseInt(f.get("sortOrder")) || 0, active: f.get("active") === "on", stock: f.get("stock") === "" ? null : Math.max(0, parseInt(f.get("stock")) || 0),
      shades: [...dlg.querySelectorAll(".sr")].map(r => ({ name: r.querySelector(".s-name").value.trim(), subtitle: nz(r.querySelector(".s-sub").value), image: r.dataset.up || nz(r.querySelector(".s-img").value), color: fromHex(r.querySelector(".s-col").value), stock: r.querySelector(".s-stock").value === "" ? null : Math.max(0, parseInt(r.querySelector(".s-stock").value) || 0) })).filter(s => s.name)
    };
    if (JSON.stringify(data).length > 900000) { $("#ee").textContent = "The photos are too large together. Remove a banner photo or a shade photo and try again."; return; }
    $("#sv").disabled = true;
    try { await setDoc(doc(db, "products", pid), data); dlg.close(); toast("Saved"); }
    catch (err) { $("#ee").textContent = "Could not save: " + err.message; $("#sv").disabled = false; }
  };
}

/* ---------- orders (Table format with search & delete) ---------- */
const shadeText = s => s.subtitle ? `${s.name} (${s.subtitle})` : s.name;
async function adjustStock(items, sign) {
  const by = {}; items.forEach(i => { if (i.productId) (by[i.productId] ||= []).push(i); });
  const ids = Object.keys(by); if (!ids.length) return;
  await runTransaction(db, async tx => {
    const snaps = await Promise.all(ids.map(id => tx.get(doc(db, "products", id))));
    snaps.forEach((snap, k) => {
      if (!snap.exists()) return;
      const p = snap.data(), shades = (p.shades || []).map(s => ({ ...s })); let stock = p.stock, changed = false;
      by[ids[k]].forEach(it => {
        const sh = shades.find(s => (it.shadeName && s.name === it.shadeName) || (it.shade && shadeText(s) === it.shade));
        if (sh && typeof sh.stock === "number") { sh.stock = Math.max(0, sh.stock + sign * (it.qty || 0)); changed = true; }
        else if (!sh && typeof stock === "number") { stock = Math.max(0, stock + sign * (it.qty || 0)); changed = true; }
      });
      if (changed) tx.update(doc(db, "products", ids[k]), { shades, stock: stock ?? null });
    });
  });
}

/* When a customer cancels a confirmed order, the stock taken for it is given back here (the shop app cannot edit products). */
async function restoreStock(id) {
  try {
    await runTransaction(db, async tx => {
      const oref = doc(db, "orders", id), o = (await tx.get(oref)).data();
      if (!o || o.status !== "cancelled" || o.stockDeducted !== true) return;
      const by = {}; (o.items || []).forEach(i => { if (i.productId) (by[i.productId] ||= []).push(i); });
      const ids = Object.keys(by), snaps = await Promise.all(ids.map(pid => tx.get(doc(db, "products", pid))));
      snaps.forEach((snap, k) => {
        if (!snap.exists()) return;
        const p = snap.data(), shades = (p.shades || []).map(s => ({ ...s })); let stock = p.stock, changed = false;
        by[ids[k]].forEach(it => {
          const sh = shades.find(s => (it.shadeName && s.name === it.shadeName) || (it.shade && shadeText(s) === it.shade));
          if (sh && typeof sh.stock === "number") { sh.stock += it.qty || 0; changed = true; }
          else if (!sh && typeof stock === "number") { stock += it.qty || 0; changed = true; }
        });
        if (changed) tx.update(doc(db, "products", ids[k]), { shades, stock: stock ?? null });
      });
      tx.update(oref, { stockDeducted: false });
    });
  } catch (e) { console.warn("Stock was not restored:", e.message); }
}

const STATUSES = ["pending", "confirmed", "shipped", "delivered", "cancelled"];
const statusOptions = cur => { const base = ROLE === "delivery" ? ["shipped", "delivered"] : STATUSES; return base.includes(cur) ? base : [cur || "pending", ...base]; };
const NOTE = {
  pending: ["Order received", "We received your order."],
  confirmed: ["Order confirmed", "Your order has been confirmed and is being prepared."],
  shipped: ["Order shipped", "Your order is on its way."],
  delivered: ["Order delivered", "Your order was delivered. Thank you for shopping with JKWS!"],
  cancelled: ["Order cancelled", "Your order was cancelled. Contact us if you have questions."]
};
let orders = {};

function setupOrderSearchBar() {
  if (!$("#oq")) {
    $("#main .tabs").insertAdjacentHTML("afterend", `
      <div class="bar2">
        <label class="f">
          <span>Search orders</span>
          <input id="oq" placeholder="Order ID, Customer, Email, or Product" style="width: 300px;">
        </label>
      </div>
    `);
  }
}

function ordersView() {
  page(ROLE === "delivery" ? "Deliveries" : "Order Management");
  addOrderTabs("orders");
  setupOrderSearchBar();
  
  initOrderListeners();

  listen(collection(db, "orders"), snap => {
    orders = {}; snap.docs.forEach(d => orders[d.id] = d.data());
    if (ROLE !== "delivery") snap.docs.forEach(d => { const o = d.data(); if (o.status === "cancelled" && o.stockDeducted === true) restoreStock(d.id); });
    renderFilteredOrders(false);
  });

  $("#oq").oninput = () => renderFilteredOrders(false);
}

function archivedOrdersView() {
  page(ROLE === "delivery" ? "Deliveries" : "Order Management");
  addOrderTabs("archivedOrders");
  setupOrderSearchBar();
  
  initOrderListeners();

  listen(collection(db, "orders"), snap => {
    orders = {}; snap.docs.forEach(d => orders[d.id] = d.data());
    if (ROLE !== "delivery") snap.docs.forEach(d => { const o = d.data(); if (o.status === "cancelled" && o.stockDeducted === true) restoreStock(d.id); });
    renderFilteredOrders(true);
  });

  $("#oq").oninput = () => renderFilteredOrders(true);
}

function renderFilteredOrders(isArchived) {
  const q = ($("#oq")?.value || "").toLowerCase().trim();
  const docs = Object.entries(orders).filter(([id, o]) => {
    if (isArchived ? o.archived !== true : o.archived === true) return false;
    if (ROLE === "delivery" && !["confirmed", "shipped", "delivered"].includes(o.status)) return false;
    
    if (q) {
      const matchId = id.toLowerCase().includes(q);
      const matchName = (o.userName || "").toLowerCase().includes(q);
      const matchEmail = (o.userEmail || "").toLowerCase().includes(q);
      const matchItems = (o.items || []).some(i => (i.name || "").toLowerCase().includes(q));
      if (!matchId && !matchName && !matchEmail && !matchItems) return false;
    }
    return true;
  }).map(([id, data]) => ({ id, data })).sort((a, b) => (b.data.createdAt?.seconds ?? 0) - (a.data.createdAt?.seconds ?? 0));

  if (!docs.length) {
    return $("#list").innerHTML = `<div class="empty">${q ? "No matching orders found." : "No orders found."}</div>`;
  }
  renderOrdersTable(docs, isArchived);
}

function renderOrdersTable(docs, isArchived) {
  $("#list").innerHTML = `
    <div class="panel" style="overflow-x: auto;">
      <table class="tbl" style="width: 100%; min-width: 980px;">
        <thead>
          <tr>
            <th>Order ID</th>
            <th>Customer</th>
            <th>Items</th>
            <th>Shipping Address</th>
            <th>Total</th>
            <th>Status</th>
            <th>Details / Notes</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${docs.map(({ id, data: o }) => {
            const sh = o.shipping || {};
            const orderIdShort = esc(id.slice(0, 6).toUpperCase());
            const itemsList = (o.items || []).map(i => `${esc(i.qty)}× ${esc(i.name)}${i.shade ? ` (${esc(i.shade)})` : ""}`).join("<br>");
            
            return `
              <tr>
                <td style="font-weight: 700; white-space: nowrap;">#${orderIdShort}</td>
                <td>
                  <b>${esc(o.userName || "Customer")}</b>
                  <div class="note">${esc(o.userEmail || "")}</div>
                  <div class="note">${fmt(o.createdAt)}</div>
                </td>
                <td><div style="max-height: 100px; overflow-y: auto;">${itemsList}</div></td>
                <td>
                  ${sh.address ? `<b>${esc(sh.name)}</b> (${esc(sh.phone)})<br><span class="note">${esc(sh.address)}</span>` : '<span class="note">N/A</span>'}
                </td>
                <td style="font-weight: 700; white-space: nowrap;">${peso(o.subtotal)}</td>
                <td>
                  <select data-st="${esc(id)}" style="width: 100%; min-width: 120px;" ${isArchived ? "disabled" : ""}>
                    ${statusOptions(o.status).map(s => `<option ${s === (o.status || "pending") ? "selected" : ""}>${s}</option>`).join("")}
                  </select>
                </td>
                <td>
                  <div class="note" style="min-width: 180px;">
                    ${o.paymentLabel ? `Payment: ${esc(o.paymentLabel)} (${esc(o.paymentStatus || "-")})` : ""}
                    ${o.deliveryNote ? `<br>Note: ${esc(o.deliveryNote)}` : ""}
                    ${o.cancelReason ? `<br><b>Cancelled by ${esc(o.cancelledBy || "staff")}:</b> ${esc(o.cancelReason)}` : ""}
                    ${o.updatedBy ? `<br>Updated by: ${esc(o.updatedBy)}` : ""}
                  </div>
                </td>
                <td>
                  <div style="display:flex; gap:6px; flex-wrap:nowrap;">
                    <button class="btn ghost sm" data-archive="${esc(id)}" data-val="${isArchived ? "false" : "true"}">
                      ${isArchived ? "Restore" : "Archive"}
                    </button>
                    ${isArchived ? `<button class="btn danger sm" data-delete-order="${esc(id)}">Delete</button>` : ""}
                  </div>
                </td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function initOrderListeners() {
  if (window._orderListenersInitialized) return;
  window._orderListenersInitialized = true;

  app.onchange = async e => {
    const s = e.target.closest("[data-st]"); if (!s) return;
    const id = s.dataset.st, status = s.value, who = auth.currentUser.email;
    try {
      const o = orders[id] || {}; let flag;
      if (ROLE !== "delivery") {   
        if (["confirmed", "shipped", "delivered"].includes(status) && !o.stockDeducted) { await adjustStock(o.items || [], -1); flag = true; }
        else if (status === "cancelled" && o.stockDeducted) { await adjustStock(o.items || [], 1); flag = false; }
      }
      const b = writeBatch(db);
      b.update(doc(db, "orders", id), { status, updatedAt: serverTimestamp(), updatedBy: who, ...(flag === undefined ? {} : { stockDeducted: flag }), statusHistory: arrayUnion({ status, at: Timestamp.now(), by: who }) });
      if (orders[id]?.userId) b.set(doc(collection(db, "notifications")), { userId: orders[id].userId, orderId: id, title: NOTE[status][0], body: NOTE[status][1], read: false, createdAt: serverTimestamp() });
      await b.commit(); toast("Status updated and the customer was notified");
    } catch (err) { toast("Could not update: " + err.message); }
  };

  app.onclick = async e => {
    const archBtn = e.target.closest("[data-archive]");
    if (archBtn) {
      const id = archBtn.dataset.archive;
      const archiveVal = archBtn.dataset.val === "true";
      try {
        await updateDoc(doc(db, "orders", id), { archived: archiveVal });
        toast(archiveVal ? "Order archived" : "Order restored");
      } catch (err) {
        toast("Could not archive/restore: " + err.message);
      }
      return;
    }

    const delBtn = e.target.closest("[data-delete-order]");
    if (delBtn) {
      const id = delBtn.dataset.deleteOrder || delBtn.getAttribute("data-delete-order");
      if (confirm(`Permanently delete order #${id.slice(0, 6).toUpperCase()}? This action cannot be undone.`)) {
        try {
          await deleteDoc(doc(db, "orders", id));
          toast("Order permanently deleted");
        } catch (err) {
          toast("Could not delete order: " + err.message);
        }
      }
    }
  };
}

/* ---------- dashboard ---------- */
function dashboardView() {
  page("Dashboard");
  watch(["orders", "products"], ({ orders, products }) => {
    const now = new Date(), start = new Date(now.getFullYear(), now.getMonth(), 1);
    const all = Object.entries(orders).map(([id, o]) => ({ id, ...o })).sort((a, b) => (odate(b) || 0) - (odate(a) || 0));
    const month = all.filter(o => odate(o) && odate(o) >= start), sold = month.filter(isSale);
    const total = sold.reduce((s, o) => s + (o.subtotal || 0), 0);
    const pending = all.filter(o => (o.status || "pending") === "pending").length;
    const tally = {}; sold.forEach(o => (o.items || []).forEach(i => { const k = `${i.name}${i.shade ? " — " + i.shade : ""}`; tally[k] = (tally[k] || 0) + (i.qty || 0); }));
    const top = Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, 5), low = lowStock(products);
    const monthName = now.toLocaleString("en-PH", { month: "long" });
    $("#list").innerHTML = `<div class="stats">
  <div class="stat"><div class="n">${peso(total)}</div><div class="l">Sales in ${monthName}</div></div>
  <div class="stat"><div class="n">${month.length}</div><div class="l">Orders in ${monthName}</div></div>
  <div class="stat"><div class="n">${pending}</div><div class="l">Waiting for confirmation</div></div>
  <div class="stat"><div class="n">${low.length}</div><div class="l">Low or sold-out items</div></div></div>
  <div class="two"><div class="panel"><h3>Recent orders</h3>${all.length ? `<table class="tbl">${all.slice(0, 6).map(o => `<tr><td><b>${esc(o.userName || o.userEmail || "Customer")}</b><div class="note">${fmt(o.createdAt)}</div></td><td class="r">${peso(o.subtotal)}</td><td class="r"><span class="pill">${esc(o.status || "pending")}</span></td></tr>`).join("")}</table>` : `<div class="note">No orders yet.</div>`}</div>
  <div class="panel"><h3>Top-selling shades this month</h3>${top.length ? `<table class="tbl">${top.map(([k, n], i) => `<tr><td>${i + 1}. ${esc(k)}</td><td class="r">${n} sold</td></tr>`).join("")}</table>` : `<div class="note">No sales this month yet.</div>`}</div></div>
  <div class="panel"><h3>Low-stock alerts</h3>${low.length ? `<table class="tbl">${low.slice(0, 10).map(x => `<tr><td>${esc(x.name)}${x.shade ? " — " + esc(x.shade) : ""}</td><td class="r">${stockPill(x.stock)}</td></tr>`).join("")}</table>${low.length > 10 ? `<div class="note" style="margin-top:8px">and ${low.length - 10} more. See Product Management → Inventory.</div>` : ""}` : `<div class="note">Nothing is running low. Alerts appear for items with ${LOW} or fewer left. Stock is only tracked for items where you enter a number in Inventory.</div>`}</div>
  <div class="note">Sales count orders that are confirmed, shipped or delivered.</div>`;
  });
}

/* ---------- inventory ---------- */
function inventoryView() {
  page("Product Management");
  addPmTabs("inventory");
  $("#main .tabs").insertAdjacentHTML("afterend", `<div class="bar2"><label class="f"><span>Search</span><input id="iq" placeholder="Product or shade" style="width:260px"></label><label class="switch" style="padding-bottom:10px"><input type="checkbox" id="il" style="width:auto"> Low or sold-out only</label></div>`);
  let data = null;
  const draw = () => {
    if (!data) return;
    const q = $("#iq").value.toLowerCase(), lowOnly = $("#il").checked;
    const items = Object.entries(data.products).filter(([, p]) => p.active !== false).sort((a, b) => (a[1].brand || "").localeCompare(b[1].brand || "") || (a[1].sortOrder ?? 99) - (b[1].sortOrder ?? 99));
    const html = items.map(([pid, p]) => {
      const rows = (p.shades || []).length ? p.shades.map((s, i) => ({ i, name: s.name, stock: s.stock })) : [{ i: "", name: "(whole product)", stock: p.stock }];
      const shown = rows.filter(r => (!q || (p.name + " " + r.name + " " + p.brand).toLowerCase().includes(q)) && (!lowOnly || (typeof r.stock === "number" && r.stock <= LOW)));
      if (!shown.length) return "";
      return `<div class="panel"><div style="display:flex;gap:10px;align-items:center;margin-bottom:8px">${thumb(p.image)}<div><b>${esc(p.name)}</b><div class="note">${esc(p.brand || "")}</div></div></div>
    <table class="tbl"><tr><th>${esc(p.shadeLabel || "Shade")}</th><th>Stock</th><th>Status</th></tr>${shown.map(r => `<tr><td>${esc(r.name)}</td><td><input class="stk" type="number" min="0" placeholder="not tracked" data-p="${esc(pid)}" data-i="${r.i}" value="${r.stock ?? ""}"></td><td>${stockPill(r.stock)}</td></tr>`).join("")}</table></div>`;
    }).join("");
    $("#list").innerHTML = html || `<div class="empty">Nothing to show.</div>`;
  };
  watch(["products"], d => { data = d; draw(); });
  $("#iq").oninput = draw; $("#il").onchange = draw;
  
  $("#list").oninput = e => {
    const el = e.target.closest(".stk"); if (!el) return;
    if (parseFloat(el.value) < 0) { el.value = 0; }
  };

  $("#list").onchange = async e => {
    const el = e.target.closest(".stk"); if (!el) return;
    const pid = el.dataset.p, v = el.value === "" ? null : Math.max(0, parseInt(el.value) || 0), p = data.products[pid];
    try {
      if (el.dataset.i === "") await updateDoc(doc(db, "products", pid), { stock: v });
      else { const shades = p.shades.map(s => ({ ...s })); shades[+el.dataset.i].stock = v; await updateDoc(doc(db, "products", pid), { shades }); }
      toast("Stock saved");
    } catch (err) { toast("Could not save: " + err.message); }
  };
}

/* ---------- archived ---------- */
function archivedView() {
  page("Product Management");
  addPmTabs("archived");
  watch(["brands", "products"], ({ brands, products }) => {
    const ab = Object.entries(brands).filter(([, b]) => b.active === false), ap = Object.entries(products).filter(([, p]) => p.active === false);
    $("#list").innerHTML = `<h2 style="font-size:20px;margin:6px 0 10px">Archived brands</h2>${ab.length ? ab.map(([id, b]) => `<div class="row">${b.image ? thumb(b.image) : `<div class="thumb">${esc((b.name || "?")[0])}</div>`}<div class="grow"><div class="t">${esc(b.name)}</div><div class="s">Hidden from the app together with its products</div></div><button class="btn sm" data-rb="${esc(id)}">Restore</button><button class="btn danger sm" data-bx="${esc(id)}">Delete</button></div>`).join("") : `<div class="empty">No archived brands.</div>`}
  <h2 style="font-size:20px;margin:22px 0 10px">Archived products</h2>${ap.length ? ap.map(([id, p]) => `<div class="row">${thumb(p.image)}<div class="grow"><div class="t">${esc(p.name)}</div><div class="s">${esc(p.brand || "")} · ${peso(p.price)}</div></div><button class="btn sm" data-rp="${esc(id)}">Restore</button><button class="btn danger sm" data-dp="${esc(id)}">Delete</button></div>`).join("") : `<div class="empty">No archived products.</div>`}`;
    $("#list").onclick = async e => {
      const rb = e.target.closest("[data-rb]"), rp = e.target.closest("[data-rp]"), dp = e.target.closest("[data-dp]"), bx = e.target.closest("[data-bx]");
      if (bx) {
        const name = brands[bx.dataset.bx]?.name, mine = Object.entries(products).filter(([, p]) => p.brand === name).map(([pid]) => pid);
        if (confirm(`Delete the brand ${name} for good${mine.length ? `, together with its ${mine.length} product${mine.length === 1 ? "" : "s"}` : ""}? This cannot be undone.`)) {
          try { const w = writeBatch(db); mine.forEach(pid => w.delete(doc(db, "products", pid))); w.delete(doc(db, "brands", bx.dataset.bx)); await w.commit(); toast("Brand deleted"); } catch (err) { toast("Could not delete: " + err.message); }
        }
      }
      if (rb) { await updateDoc(doc(db, "brands", rb.dataset.rb), { active: true }); toast("Brand restored"); }
      if (rp) { await updateDoc(doc(db, "products", rp.dataset.rp), { active: true }); toast("Product restored"); }
      if (dp && confirm(`Delete "${products[dp.dataset.dp]?.name}" for good? This cannot be undone.`)) { await deleteDoc(doc(db, "products", dp.dataset.dp)); toast("Deleted"); }
    };
  });
}

/* ---------- reports ---------- */
function reportsView() {
  page("Reports", `<button class="btn ghost" id="csv">Download orders (CSV)</button>`);
  $("#main .head").insertAdjacentHTML("afterend", `<div class="bar2"><label class="f"><span>Period</span><select id="rp" style="width:100%"><option value="month">This month</option><option value="last">Last month</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="year">This year</option><option value="custom">Custom range</option></select></label>
<label class="f"><span>From</span><input type="date" id="rf1"></label><label class="f"><span>To</span><input type="date" id="rf2"></label></div>`);
  let data = null, current = [];
  const range = () => {
    const now = new Date(), d0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()), day = 864e5, p = $("#rp").value; let a, b = new Date(d0.getTime() + day);
    if (p === "month") a = new Date(now.getFullYear(), now.getMonth(), 1);
    else if (p === "last") { a = new Date(now.getFullYear(), now.getMonth() - 1, 1); b = new Date(now.getFullYear(), now.getMonth(), 1); }
    else if (p === "7") a = new Date(d0.getTime() - 6 * day);
    else if (p === "30") a = new Date(d0.getTime() - 29 * day);
    else if (p === "year") a = new Date(now.getFullYear(), 0, 1);
    else { a = $("#rf1").value ? new Date($("#rf1").value + "T00:00") : new Date(2000, 0, 1); if ($("#rf2").value) b = new Date(new Date($("#rf2").value + "T00:00").getTime() + day); }
    if (p !== "custom") { $("#rf1").value = ymd(a); $("#rf2").value = ymd(new Date(b.getTime() - day)); }
    return [a, b];
  };
  const bump = (m, k, n, t) => { (m[k] ||= { n: 0, t: 0 }); m[k].n += n; m[k].t += t; };
  const rows = (m, a = "Name") => { const e = Object.entries(m).sort((x, y) => y[1].t - x[1].t || y[1].n - x[1].n); return e.length ? `<table class="tbl"><tr><th>${a}</th><th class="r">Qty / orders</th><th class="r">Sales</th></tr>${e.map(([k, v]) => `<tr><td>${esc(k)}</td><td class="r">${v.n}</td><td class="r">${peso(v.t)}</td></tr>`).join("")}</table>` : `<div class="note">No data for this period.</div>`; };
  const draw = () => {
    if (!data) return; const [a, b] = range();
    current = Object.entries(data.orders).map(([id, o]) => ({ id, ...o })).filter(o => { const d = odate(o); return d && d >= a && d < b; }).sort((x, y) => odate(x) - odate(y));
    const sales = current.filter(isSale), total = sales.reduce((s, o) => s + (o.subtotal || 0), 0), cancelled = current.filter(o => o.status === "cancelled").length;
    const day = {}, pay = {}, prod = {}, shade = {}, st = {};
    sales.forEach(o => { bump(day, ymd(odate(o)), 1, o.subtotal || 0); bump(pay, o.paymentLabel || "Not set", 1, o.subtotal || 0); (o.items || []).forEach(i => { const amt = (i.price || 0) * (i.qty || 0); bump(prod, i.name || "?", i.qty || 0, amt); bump(shade, `${i.name}${i.shade ? " — " + i.shade : ""}`, i.qty || 0, amt); }); });
    current.forEach(o => st[o.status || "pending"] = (st[o.status || "pending"] || 0) + 1);
    $("#list").innerHTML = `<div class="stats">
  <div class="stat"><div class="n">${peso(total)}</div><div class="l">Total sales</div></div><div class="stat"><div class="n">${current.length}</div><div class="l">Orders placed</div></div>
  <div class="stat"><div class="n">${sales.length}</div><div class="l">Orders counted as sales</div></div><div class="stat"><div class="n">${peso(sales.length ? total / sales.length : 0)}</div><div class="l">Average order</div></div>
  <div class="stat"><div class="n">${cancelled}</div><div class="l">Cancelled orders</div></div></div>
  <div class="two"><div class="panel"><h3>Sales by day</h3>${rows(day, "Day")}</div><div class="panel"><h3>Payment methods</h3>${rows(pay, "Method")}</div></div>
  <div class="two"><div class="panel"><h3>Products</h3>${rows(prod, "Product")}</div><div class="panel"><h3>Shades</h3>${rows(shade, "Shade")}</div></div>
  <div class="panel"><h3>Orders by status</h3>${Object.keys(st).length ? Object.entries(st).map(([k, n]) => `<span class="pill" style="margin-right:8px">${esc(k)}: ${n}</span>`).join(""): `<div class="note">No orders in this period.</div>`}</div>
  <div class="note">Sales count orders that are confirmed, shipped or delivered. Pending and cancelled orders are not included.</div>`;
  };
  watch(["orders"], d => { data = d; draw(); });
  $("#rp").onchange = draw; $("#rf1").oninput = $("#rf2").oninput = () => { $("#rp").value = "custom"; draw(); };
  $("#csv").onclick = () => {
    const q = v => '"' + String(v ?? "").replace(/"/g, '""') + '"';
    const lines = [["Order", "Date", "Customer", "Email", "Status", "Payment", "Items", "Total"].map(q).join(",")];
    current.forEach(o => lines.push([o.id, odate(o) ? odate(o).toLocaleString("en-PH") : "", o.userName, o.userEmail, o.status, o.paymentLabel, (o.items || []).map(i => `${i.qty} x ${i.name}${i.shade ? " (" + i.shade + ")" : ""}`).join("; "), o.subtotal].map(q).join(",")));
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["\ufeff" + lines.join("\r\n")], { type: "text/csv" })); a.download = `jkws-orders-${ymd(new Date())}.csv`; a.click(); URL.revokeObjectURL(a.href);
  };
}

/* ---------- manage accounts ---------- */
const ROLES = { admin: "Full access: catalog, orders and accounts", cashier: "Orders and payments", delivery: "Delivery orders only", customer: "Shopping app only, no staff access" };
let accountsCache = {};

/* every access change is written to an append-only log */
const logAction = (action, uid, u, from, to) => setDoc(doc(collection(db, "auditLogs")), { action, targetUid: uid, targetName: u.name || "", targetEmail: u.email || "", from: from ?? null, to: to ?? null, by: auth.currentUser.uid, byEmail: auth.currentUser.email, at: serverTimestamp() });
const logText = l => l.action === "account_created" ? `Account created for ${l.targetEmail} as ${l.to}`
  : l.action === "account_archived" ? `${l.targetName || l.targetEmail} was archived`
  : l.action === "account_restored" ? `${l.targetName || l.targetEmail} was restored`
  : l.action === "account_deleted" ? `${l.targetName || l.targetEmail} was deleted`
  : `${l.targetName || l.targetEmail}: ${l.from} → ${l.to}`;
const STAFF = ["admin", "cashier", "delivery"];
const statusOf = u => u.archived ? "archived" : u.status === "inactive" ? "inactive" : "active";
const statusPill = u => ({ active: `<span class="pill ok">Active</span>`, inactive: `<span class="pill low">Inactive</span>`, archived: `<span class="pill">Archived</span>` })[statusOf(u)];
const accountButtons = (id, u) => `<button class="btn ghost sm" data-acc="${statusOf(u) === "inactive" ? "activate" : "deactivate"}" data-id="${esc(id)}">${statusOf(u) === "inactive" ? "Set active" : "Set inactive"}</button><button class="btn ghost sm" data-acc="archive" data-id="${esc(id)}">Archive</button>`;
const ACC_TABS = { staff: [["staff", "Accounts"], ["archivedStaff", "Archived"]], customers: [["customers", "Accounts"], ["archivedCustomers", "Archived"]] };
function addAccTabs(kind, active) {
  $("#main .head").insertAdjacentHTML("afterend", `<div class="tabs">${ACC_TABS[kind].map(([v, l]) => `<button class="tab ${v === active ? "on" : ""}" data-at="${v}">${l}</button>`).join("")}</div>`);
  $("#main").querySelectorAll("[data-at]").forEach(b => b.onclick = () => go(b.dataset.at));
}
const accClick = e => { const b = e.target.closest("[data-acc]"); if (b) openAccountChange(b.dataset.id, accountsCache[b.dataset.id], b.dataset.acc); };

/* set active or inactive, archive, restore, or delete (always confirmed first and written to the change log) */
function openAccountChange(uid, u, action) {
  if (!u) return;
  const name = u.name || u.email;
  const text = {
    deactivate: [`Set ${name} inactive?`, "They will not be able to sign in or use their account until you set it active again. Their orders and history are kept.", "Set inactive"],
    activate: [`Set ${name} active?`, "They will be able to sign in again.", "Set active"],
    archive: [`Archive ${name}?`, "The account moves to the Archived tab and is set to inactive, so it cannot sign in. You can restore it at any time.", "Archive"],
    restore: [`Restore ${name}?`, "The account becomes active again and can sign in.", "Restore"],
    delete: [`Permanently delete ${name}?`, "This will permanently remove the account record from the database. This action cannot be undone.", "Delete permanently"]
  }[action];
  dlg.oncancel = null;
  dlg.innerHTML = `<form class="ed" id="cf"><h2>${esc(text[0])}</h2><p style="color:var(--muted);font-size:14px">${esc(text[1])}</p><div class="err" id="ee"></div>
    <div class="actions"><button type="button" class="btn ghost" id="cx">Cancel</button><button class="btn ${["archive", "deactivate", "delete"].includes(action) ? "danger" : ""}" id="sv">${text[2]}</button></div></form>`;
  dlg.showModal(); $("#cx").onclick = () => dlg.close();
  $("#cf").onsubmit = async e => {
    e.preventDefault();
    if (action === "delete") {
      $("#sv").disabled = true;
      try {
        await deleteDoc(doc(db, "users", uid));
        await logAction("account_deleted", uid, u, "archived", "deleted");
        dlg.close(); 
        toast("Account permanently deleted");
      } catch (err) {
        $("#ee").textContent = err.code === "permission-denied" ? "Permission denied. Update the Firestore rules, then try again." : "Could not delete: " + (err.message || err.code);
        $("#sv").disabled = false;
      }
      return;
    }

    if (["archive", "deactivate"].includes(action) && u.role === "admin" && !Object.entries(accountsCache).some(([id, x]) => id !== uid && x.role === "admin" && statusOf(x) === "active")) { $("#ee").textContent = "At least one active admin must remain."; return; }
    $("#sv").disabled = true;
    try {
      await updateDoc(doc(db, "users", uid), { deactivate: { status: "inactive" }, activate: { status: "active" }, archive: { archived: true, status: "inactive", archivedAt: serverTimestamp() }, restore: { archived: false, status: "active" } }[action]);
      const l = { deactivate: ["status_changed", "active", "inactive"], activate: ["status_changed", "inactive", "active"], archive: ["account_archived", null, "archived"], restore: ["account_restored", "archived", "active"] }[action];
      await logAction(l[0], uid, u, l[1], l[2]);
      dlg.close(); toast({ deactivate: "Account set inactive", activate: "Account set active", archive: "Account archived", restore: "Account restored" }[action]);
    } catch (err) {
      $("#ee").textContent = err.code === "permission-denied" ? "Permission denied. Update the Firestore rules, then try again." : "Could not save: " + (err.message || err.code);
      $("#sv").disabled = false;
    }
  };
}

/* archived accounts, one page for staff and one for customers */
function archivedAccountsView(kind) {
  const staff = kind === "staff";
  page(staff ? "Staff accounts" : "Customer accounts");
  addAccTabs(kind, staff ? "archivedStaff" : "archivedCustomers");
  listen(collection(db, "users"), snap => {
    accountsCache = {}; snap.docs.forEach(d => accountsCache[d.id] = d.data());
    const docs = snap.docs.filter(d => d.data().archived && STAFF.includes(d.data().role) === staff).sort((a, b) => (a.data().name || "").localeCompare(b.data().name || ""));
    $("#list").innerHTML = docs.length ? docs.map(d => { 
      const u = d.data(); 
      return `<div class="row">
        <div class="grow">
          <div class="t">${esc(u.name || "-")} <span class="pill">Archived</span>${staff ? ` <span class="pill">${esc(u.role)}</span>` : ""}</div>
          <div class="s">${esc(u.email || "")} · archived ${fmt(u.archivedAt)}</div>
        </div>
        <button class="btn sm" data-acc="restore" data-id="${esc(d.id)}">Restore</button>
        <button class="btn danger sm" data-acc="delete" data-id="${esc(d.id)}">Delete</button>
      </div>`; 
    }).join("") : `<div class="empty">No archived ${staff ? "staff" : "customer"} accounts.</div>`;
  });
  $("#list").onclick = accClick;
}
function archivedStaffView() { archivedAccountsView("staff"); }
function archivedCustomersView() { archivedAccountsView("customers"); }
const askPassword = pw => reauthenticateWithCredential(auth.currentUser, EmailAuthProvider.credential(auth.currentUser.email, pw || ""));
const badPw = err => ["auth/wrong-password", "auth/invalid-credential", "auth/missing-password"].includes(err.code);

function staffView() {
  page("Staff accounts", `<button class="btn" id="adda">Add staff account</button>`);
  addAccTabs("staff", "staff");
  $("#main").insertAdjacentHTML("beforeend", `<h2 style="margin:28px 0 10px;font-size:20px">Recent access changes</h2><div id="logs"></div>`);
  $("#adda").onclick = openAccountEditor;
  listen(collection(db, "users"), snap => {
    accountsCache = {}; snap.docs.forEach(d => accountsCache[d.id] = d.data());
    const docs = snap.docs.filter(d => STAFF.includes(d.data().role) && !d.data().archived).sort((a, b) => ((a.data().role || "customer") === "customer") - ((b.data().role || "customer") === "customer") || (a.data().name || "").localeCompare(b.data().name || ""));
    $("#list").innerHTML = docs.map(d => {
      const u = d.data(), me = d.id === auth.currentUser.uid, r = u.role || "customer"; return `<div class="row"><div class="grow"><div class="t">${esc(u.name || "-")} ${me ? '<span class="pill">You</span>' : ""} ${statusPill(u)}</div><div class="s">${esc(u.email || "")} · joined ${fmt(u.createdAt)}</div></div>
  <select data-role="${esc(d.id)}" data-cur="${esc(r)}" ${me ? "disabled" : ""} title="${me ? "You cannot change your own access" : "Change access"}">${Object.keys(ROLES).map(x => `<option value="${x}" ${x === r ? "selected" : ""}>${x}</option>`).join("")}</select>${me ? "" : accountButtons(d.id, u)}</div>`;
    }).join("");
  });
  unsubs.push(onSnapshot(query(collection(db, "auditLogs"), orderBy("at", "desc"), limit(15)), snap => {
    $("#logs").innerHTML = snap.empty ? `<div class="empty">No changes recorded yet.</div>` : snap.docs.map(d => { const l = d.data(); return `<div class="row"><div class="grow"><div class="t">${esc(logText(l))}</div><div class="s">by ${esc(l.byEmail)} · ${fmt(l.at)}</div></div></div>`; }).join("");
  }, e => { $("#logs").innerHTML = `<div class="empty">Could not load the log: ${esc(e.message)}</div>`; }));
  $("#list").onchange = e => {
    const s = e.target.closest("[data-role]"); if (!s) return;
    const u = accountsCache[s.dataset.role]; if (!u || s.value === s.dataset.cur) return;
    openRoleChange(s.dataset.role, u, s.value, s);
  };
  $("#list").onclick = accClick;
}

function openRoleChange(uid, u, to, sel) {
  const from = u.role || "customer";
  dlg.innerHTML = `<form class="ed" id="rf"><h2>Change access</h2>
<p>Are you sure you want to change <b>${esc(u.name || u.email)}</b>'s access from <b>${esc(from)}</b> to <b>${esc(to)}</b>?</p>
<p style="color:var(--muted);font-size:13px">${esc(to)}: ${esc(ROLES[to])}</p>
${to === "admin" ? `<label class="f"><span>Enter your own password to give admin access</span><input type="password" name="mypw" autocomplete="current-password"></label>` : ""}
<div class="err" id="ee"></div><div class="actions"><button type="button" class="btn ghost" id="cx">Cancel</button><button class="btn" id="sv">Save changes</button></div></form>`;
  dlg.showModal();
  dlg.oncancel = () => { sel.value = from; };
  $("#cx").onclick = () => { sel.value = from; dlg.close(); };
  $("#rf").onsubmit = async e => {
    e.preventDefault();
    if (from === "admin" && to !== "admin" && Object.values(accountsCache).filter(x => x.role === "admin").length <= 1) { $("#ee").textContent = "At least one admin must remain. Make someone else an admin first."; return; }
    $("#sv").disabled = true;
    try {
      if (to === "admin") await askPassword(new FormData(e.target).get("mypw"));
      await updateDoc(doc(db, "users", uid), { role: to });
      await logAction("role_changed", uid, u, from, to);
      dlg.close(); toast("Access updated");
    } catch (err) {
      $("#ee").textContent = badPw(err) ? "Wrong password. Nothing was changed." : err.code === "permission-denied" ? "Permission denied. Update the Firestore rules, then try again." : "Could not save: " + (err.message || err.code);
      $("#sv").disabled = false;
    }
  };
}

function openAccountEditor() {
  dlg.oncancel = null;
  dlg.innerHTML = `<form class="ed" id="af"><h2>Add account</h2><div class="grid">${inp("Full name", "name", "")}${inp("Email", "email", "", { type: "email" })}
${inp("Temporary password (at least 6 characters)", "pw", "")}
<label class="f"><span>Access</span><select name="role" style="width:100%">${["admin", "cashier", "delivery"].map(r => `<option value="${r}">${r}</option>`).join("")}</select></label>
${inp("Your own password (only needed when creating an admin)", "mypw", "", { type: "password" })}
<div class="f wide" style="font-size:12px;color:var(--muted)">${["admin", "cashier", "delivery"].map(r => `<div><b>${r}</b>: ${esc(ROLES[r])}</div>`).join("")}</div></div>
<div class="err" id="ee"></div><div class="actions"><button type="button" class="btn ghost" id="cx">Cancel</button><button class="btn" id="sv">Create account</button></div></form>`;
  dlg.showModal(); $("#cx").onclick = () => dlg.close();
  $("#af").onsubmit = async e => {
    e.preventDefault(); const f = new FormData(e.target), name = f.get("name").trim(), email = f.get("email").trim().toLowerCase(), pw = f.get("pw"), role = f.get("role");
    if (!name || !email.includes("@") || pw.length < 6) { $("#ee").textContent = "Enter a name, a valid email and a password of at least 6 characters."; return; }
    $("#sv").disabled = true;
    try {
      if (role === "admin") await askPassword(f.get("mypw"));
      const cred = await createUserWithEmailAndPassword(auth2, email, pw);
      await updateProfile(cred.user, { displayName: name });
      await setDoc(doc(db, "users", cred.user.uid), { name, email, role, createdAt: serverTimestamp() });
      await logAction("account_created", cred.user.uid, { name, email }, null, role);
      await signOut(auth2); dlg.close(); toast("Account created. Give them the email and password so they can sign in.");
    } catch (err) {
      $("#ee").textContent = badPw(err) ? "Wrong password. Nothing was created." : err.code === "auth/email-already-in-use" ? "That email already has an account. Find it in the list and change its access there." : err.code === "permission-denied" ? "Permission denied. Update the Firestore rules (users and auditLogs), then try again." : "Could not create the account: " + (err.message || err.code);
      $("#sv").disabled = false;
    }
  };
}

/* ---------- customer accounts ---------- */
function customersView() {
  page("Customer accounts");
  $("#main .head").insertAdjacentHTML("afterend", `<div class="bar2"><label class="f"><span>Search</span><input id="cq" placeholder="Name or email" style="width:280px"></label></div>`);
  addAccTabs("customers", "customers");
  let data = null;
  const draw = () => {
    if (!data) return; 
    const q = $("#cq").value.toLowerCase(), stats = {};
    Object.values(data.orders).forEach(o => { 
      if (!o.userId) return; 
      (stats[o.userId] ||= { n: 0, t: 0 }).n++; 
      if (isSale(o)) stats[o.userId].t += o.subtotal || 0; 
    });
    
    const list = Object.entries(data.users)
      .filter(([, u]) => (u.role || "customer") === "customer" && !u.archived && ((u.name || "") + " " + (u.email || "")).toLowerCase().includes(q))
      .sort((x, y) => (y[1].createdAt?.seconds ?? 0) - (x[1].createdAt?.seconds ?? 0));
      
    $("#list").innerHTML = list.length ? list.map(([id, u]) => {
      const s = stats[id] || { n: 0, t: 0 }; 
      return `<div class="row">
        <div class="grow">
          <div class="t">${esc(u.name || "-")} ${statusPill(u)}</div>
          <div class="s">${esc(u.email || "")} · joined ${fmt(u.createdAt)} · ${s.n} order${s.n === 1 ? "" : "s"} · ${peso(s.t)} spent</div>
        </div>
      ${accountButtons(id, u)}</div>`;
    }).join("") : `<div class="empty">No customers found.</div>`;
  };

  watch(["users", "orders"], d => { data = d; accountsCache = d.users; draw(); });
  $("#cq").oninput = draw;
  $("#list").onclick = accClick;
}