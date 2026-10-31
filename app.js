(() => {
  const UPSTREAM = "ooooorion/Luna-s-Decompilation-List";
  const LIVE_URL = `https://raw.githubusercontent.com/${UPSTREAM}/main/README.md`;
  const SNAPSHOT_URL = "list.md"; // refreshed by the sync workflow, used if the live fetch fails

  const $ = (id) => document.getElementById(id);
  const state = { items: [], type: "all", platform: "all", q: "" };

  // ---------- Parsing ----------

  const isOther = (p) => /other|multi/i.test(p);
  const TYPES = { DECOMPILATIONS: "Decompilation", RECOMPILATIONS: "Recompilation" };

  // "Legend of Zelda, The: Ocarina of Time" -> "The Legend of Zelda: Ocarina of Time"
  const unInvert = (t) => t.replace(/^(.+?), (The|A|An)\b(?=[:\s]|$)/, "$2 $1");

  function parse(md) {
    const items = [];
    let type = null, platform = null, sub = null;
    for (const raw of md.split(/\r?\n/)) {
      const line = raw.trim();
      let m;
      if ((m = line.match(/^#\s+(.+)/))) {
        const key = m[1].trim().toUpperCase();
        type = TYPES[key] || (type && key.endsWith("S") ? key[0] + key.slice(1, -1).toLowerCase() : null);
        platform = sub = null;
      } else if (!type) {
        continue; // skip the intro / notes block
      } else if ((m = line.match(/^##\s+(.+)/))) {
        platform = m[1].trim(); sub = null;
      } else if ((m = line.match(/^###\s+(.+)/))) {
        // Human-made / AI-made is intentionally dropped: everything is one list.
        if (!/^(human|ai)[\s-]*made$/i.test(m[1].trim())) sub = m[1].trim();
      } else if ((m = line.match(/^[*-]\s+\[(.+)\]\((https?:\/\/[^)\s]+)\)/)) && platform) {
        items.push(makeItem(m[1], m[2], type, platform, sub));
      }
    }
    return items;
  }

  function makeItem(text, url, type, platform, sub) {
    const owner = (url.match(/github\.com\/([^/]+)/i) || [])[1] || "";
    let parts = text.split(/\s+-\s+/).map((s) => s.trim());
    let author = owner, note = "";
    const last = parts[parts.length - 1];
    if (parts.length > 1 && owner && last.toLowerCase().startsWith(owner.toLowerCase())) {
      parts.pop();
      note = (last.match(/\((.+)\)/) || [])[1] || "";
    } else if (parts.length > 1 && !isOther(platform)) {
      author = parts.pop();
    }
    let hint = "";
    if (isOther(platform) && parts.length > 1) hint = parts.shift();
    const sortTitle = parts.join(" - ");
    return {
      title: unInvert(sortTitle),
      sortTitle: sortTitle.toLowerCase(),
      author, note, url, type,
      platform: isOther(platform) ? "Other & Multiplatform" : platform,
      hint: hint && !/^multiple$/i.test(hint) ? hint : (isOther(platform) && sub && /kit/i.test(sub) ? "SDK" : ""),
    };
  }

  // ---------- Presentation helpers ----------

  const SHORT = [
    [/windows/i, "PC"], [/xbox one/i, "One"], [/xbox 360/i, "360"], [/xbox/i, "XB"],
    [/3ds/i, "3DS"], [/64/, "N64"], [/\bds\b/i, "DS"], [/gamecube/i, "GC"], [/gba|advance/i, "GBA"],
    [/switch/i, "NS"], [/wii u/i, "WiiU"], [/wii/i, "Wii"], [/playstation 1|ps1|psx/i, "PS1"],
    [/playstation 2|ps2/i, "PS2"], [/playstation 3|ps3/i, "PS3"], [/psp/i, "PSP"], [/super nintendo|snes/i, "SNES"],
    [/game ?boy/i, "GB"], [/genesis|mega drive/i, "MD"], [/dreamcast/i, "DC"], [/saturn/i, "SAT"],
    [/other|multi/i, "•••"],
  ];
  const short = (p) => (SHORT.find(([re]) => re.test(p)) || [, p.replace(/[^A-Z0-9]/g, "").slice(0, 3) || p.slice(0, 2)])[1];
  const label = (p) => p.replace(/^(Nintendo|Sony|Microsoft)\s+/, "").replace(/^Super Nintendo Entertainment System$/, "SNES").replace(/^XBOX/i, "Xbox").replace(/^64$/, "N64");

  const PALETTE = ["#ff3b30", "#ff9500", "#34c759", "#00c7be", "#30b0c7", "#007aff", "#5856d6", "#af52de", "#ff2d55", "#a2845e"];
  const colorFor = (p) => {
    if (isOther(p)) return "#8e8e93";
    let h = 0;
    for (const c of p) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return PALETTE[h % PALETTE.length];
  };

  const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const fold = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  function highlight(text, q) {
    if (!q) return esc(text);
    const i = fold(text).indexOf(q);
    if (i < 0) return esc(text);
    return esc(text.slice(0, i)) + "<mark>" + esc(text.slice(i, i + q.length)) + "</mark>" + esc(text.slice(i + q.length));
  }

  // ---------- Rendering ----------

  function platforms() {
    const counts = new Map();
    for (const it of state.items) if (state.type === "all" || it.type === state.type) counts.set(it.platform, (counts.get(it.platform) || 0) + 1);
    return [...counts];
  }

  function renderChips() {
    const list = platforms();
    if (state.platform !== "all" && !list.some(([p]) => p === state.platform)) state.platform = "all";
    const total = list.reduce((a, [, n]) => a + n, 0);
    $("chips").innerHTML = [["all", total], ...list].map(([p, n]) =>
      `<button class="chip" data-p="${esc(p)}" aria-pressed="${state.platform === p}">${p === "all" ? "All Platforms" : esc(label(p))}<span class="n">${n}</span></button>`
    ).join("");
  }

  function renderList() {
    const q = fold(state.q.trim());
    const groups = new Map();
    for (const it of state.items) {
      if (state.type !== "all" && it.type !== state.type) continue;
      if (state.platform !== "all" && it.platform !== state.platform) continue;
      if (q && !fold([it.title, it.sortTitle, it.author, it.platform, label(it.platform), it.hint, it.type].join(" ")).includes(q)) continue;
      if (!groups.has(it.platform)) groups.set(it.platform, []);
      groups.get(it.platform).push(it);
    }
    const chev = `<svg class="chev" viewBox="0 0 8 14" aria-hidden="true"><path d="M1.5 1.5L6.5 7l-5 5.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    let html = "";
    for (const [p, items] of groups) {
      items.sort((a, b) => a.sortTitle.localeCompare(b.sortTitle) || a.author.localeCompare(b.author));
      html += `<section class="group"><div class="group-head"><span>${esc(label(p))}</span><span class="n">${items.length}</span></div><div class="card">`;
      for (const it of items) {
        const tags = [it.hint, it.type === "Recompilation" ? "Recomp" : ""].filter(Boolean);
        html += `<a class="row" href="${esc(it.url)}" target="_blank" rel="noopener">
          <span class="glyph" style="background:${colorFor(p)}" aria-hidden="true">${esc(short(p))}</span>
          <span class="meta"><div class="name">${highlight(it.title, q)}</div><div class="by">${highlight(it.author, q)}${it.note ? " · " + esc(it.note) : ""}</div></span>
          ${tags.map((t) => `<span class="tag">${esc(t)}</span>`).join("")}${chev}</a>`;
      }
      html += `</div></section>`;
    }
    $("list").innerHTML = html;
    $("empty").hidden = groups.size > 0 || !state.items.length;
  }

  function renderSummary() {
    const dec = state.items.filter((i) => i.type === "Decompilation").length;
    const rec = state.items.filter((i) => i.type === "Recompilation").length;
    const plats = new Set(state.items.map((i) => i.platform)).size;
    const parts = [`${dec} decomp${dec === 1 ? "" : "s"}`];
    if (rec) parts.push(`${rec} recomp${rec === 1 ? "" : "s"}`);
    $("summary").textContent = `${state.items.length} projects across ${plats} platforms · ${parts.join(", ")}`;
  }

  const render = () => { renderChips(); renderList(); };

  // ---------- Controls ----------

  const seg = $("seg"), thumb = $("thumb");
  function moveThumb() {
    const btn = seg.querySelector('[aria-selected="true"]');
    thumb.style.width = btn.offsetWidth + "px";
    thumb.style.transform = `translateX(${btn.offsetLeft - 2}px)`;
  }
  // Respond on press, not release.
  seg.addEventListener("pointerdown", (e) => {
    const btn = e.target.closest("button");
    if (!btn || btn.getAttribute("aria-selected") === "true") return;
    seg.querySelectorAll("button").forEach((b) => b.setAttribute("aria-selected", b === btn));
    state.type = btn.dataset.type;
    moveThumb();
    render();
  });
  seg.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    e.target.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
  });
  addEventListener("resize", moveThumb);

  $("chips").addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    state.platform = chip.dataset.p;
    render();
    if (scrollY > $("list").offsetTop - 160) scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  });

  const input = $("q");
  input.addEventListener("input", () => { state.q = input.value; $("clear").hidden = !input.value; renderList(); });
  $("clear").addEventListener("pointerdown", (e) => { e.preventDefault(); input.value = ""; input.dispatchEvent(new Event("input")); input.focus(); });
  addEventListener("keydown", (e) => {
    if (e.key === "/" && document.activeElement !== input) { e.preventDefault(); input.focus(); }
    if (e.key === "Escape" && document.activeElement === input) { input.value = ""; input.dispatchEvent(new Event("input")); input.blur(); }
  });

  const bar = $("bar"), h1 = document.querySelector("h1");
  const onScroll = () => bar.classList.toggle("scrolled", h1.getBoundingClientRect().bottom < bar.offsetHeight);
  addEventListener("scroll", onScroll, { passive: true });
  document.addEventListener("touchstart", () => {}, { passive: true }); // enables :active on iOS

  // ---------- Load ----------

  async function load() {
    let md = null;
    for (const url of [LIVE_URL + "?t=" + Math.floor(Date.now() / 60000), SNAPSHOT_URL]) {
      try {
        const r = await fetch(url, { cache: "no-store" });
        if (r.ok) { md = await r.text(); break; }
      } catch {}
    }
    if (!md) { $("summary").textContent = "Couldn't load the list. Check your connection and refresh."; return; }
    state.items = parse(md);
    renderSummary();
    render();
    moveThumb();
    onScroll();

    try {
      const r = await fetch(`https://api.github.com/repos/${UPSTREAM}/commits?path=README.md&per_page=1`);
      const [c] = await r.json();
      const d = new Date(c.commit.committer.date);
      $("synced").textContent = "List last updated " + d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    } catch {}
  }

  moveThumb();
  load();
})();
