(function () {
  "use strict";
  var DEX = window.DEX;
  var GENS = Object.keys(DEX).sort(function (a, b) { return a - b; });
  var $ = function (id) { return document.getElementById(id); };
  var state = { gen: GENS[0], view: "guide" };

  // ---------- storage (wrapped: storage can be unavailable) ----------
  function key(g) { return "livingdex:gen" + g; }
  function load(g) {
    try { return JSON.parse(localStorage.getItem(key(g)) || "{}"); } catch (e) { return {}; }
  }
  function save(g, obj) {
    try { localStorage.setItem(key(g), JSON.stringify(obj)); } catch (e) { /* ignore */ }
  }
  // A row's id stays stable even if rows are reordered later.
  function rowId(r) { return [r[0], r[1], r[2], r[3]].join("|"); }

  // ---------- links ----------
  function bulba(name) {
    return "https://bulbapedia.bulbagarden.net/wiki/" +
      encodeURIComponent(name.replace(/ /g, "_")).replace(/%3A/g, ":") + "_(Pok%C3%A9mon)";
  }
  function placeLink(where) {
    var PLACE = /\b(Route|Routes|Cave|Forest|Island|City|Town|Lake|Mountain|Mt\.|Province|Desert|Woods|Tower|Meadow|Ruins|Beach|Bay|Falls|Field|Tangle|Wilderness|Village|Garden|Marsh|Hill|Jungle|Canyon|Grove|Temple|Shrine|Chasm|Passage|Castle|Mine|Mines|Resort|Ranch|Outskirts|Tunnel|Underpass|Pillar|Sewers|Windworks|Cavern|Fieldlands|Coastlands|Mirelands|Highlands|Mirror|Area Zero|Kitakami|Terarium|Hollow|Megamart|Wilds)\b/;
    var parts = where.split(/[;(,]| \/ | or |—|→|:/).map(function (s) { return s.trim(); });
    for (var i = 0; i < parts.length; i++) {
      if (PLACE.test(parts[i])) {
        var q = parts[i].replace(/^(Fishing|Dive|Surfing|Surf on|DexNav near|Story|Gift at|Gift in|Egg gift from the)\s*/i, "")
          .replace(/\b(the|rare|very rare|post-game|at night|overcast)\b/gi, " ").replace(/\s+/g, " ").trim();
        if (/^Routes? \d/.test(q)) q = q.replace(/^Routes (\d+).*/, "Route $1");
        return "https://bulbapedia.bulbagarden.net/w/index.php?search=" + encodeURIComponent(q);
      }
    }
    return "";
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  // ---------- gen picker ----------
  GENS.forEach(function (g) {
    var o = document.createElement("option");
    o.value = g;
    o.textContent = DEX[g].label + " — " + DEX[g].region;
    $("gen").appendChild(o);
  });
  $("gen").addEventListener("change", function () { go(this.value, state.view); });

  // ---------- tabs ----------
  document.querySelectorAll(".tabs button").forEach(function (b) {
    b.addEventListener("click", function () { go(state.gen, b.dataset.view); });
  });

  function go(gen, view) {
    location.hash = "gen" + gen + (view === "tracker" ? "/tracker" : "");
  }
  function fromHash() {
    var m = /gen(\d+)(\/tracker)?/.exec(location.hash);
    var g = m && DEX[m[1]] ? m[1] : (state.gen || GENS[0]);
    var v = m && m[2] ? "tracker" : "guide";
    var genChanged = g !== state.gen || !$("guide").innerHTML;
    state.gen = g; state.view = v;
    $("gen").value = g;
    $("games").textContent = DEX[g].games;
    document.title = DEX[g].label + " " + DEX[g].region + " — Living Dex Guide";
    $("tab-guide").setAttribute("aria-selected", v === "guide");
    $("tab-tracker").setAttribute("aria-selected", v === "tracker");
    $("view-guide").hidden = v !== "guide";
    $("view-tracker").hidden = v !== "tracker";
    if (genChanged) { renderGuide(); fillCarts(); renderBoxes(); window.scrollTo(0, 0); }
    renderTracker();
  }
  window.addEventListener("hashchange", fromHash);

  // ---------- guide ----------
  function renderGuide() {
    var d = DEX[state.gen];
    var el = $("guide");
    el.innerHTML = d.guide;
    linkNames(el, d);
    buildSteps(el, d);
  }
  // Turn Pokémon names in the guide text into Bulbapedia links (first mention per section).
  function linkNames(root, d) {
    var names = {};
    d.rows.concat(d.unob).forEach(function (r) { names[r[1]] = 1; });
    var list = Object.keys(names).sort(function (a, b) { return b.length - a.length; })
      .map(function (n) { return n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); });
    if (!list.length) return;
    var re = new RegExp("(^|[^\\wÀ-ɏ])(" + list.join("|") + ")(?![\\wÀ-ɏ])");
    var seen = {};
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        var p = n.parentNode;
        while (p && p !== root) {
          if (p.tagName === "A" || p.tagName === "H2" || p.tagName === "TH") return NodeFilter.FILTER_REJECT;
          p = p.parentNode;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function (node) {
      var text = node.nodeValue, frag = null, m;
      while ((m = re.exec(text))) {
        var name = m[2];
        var start = m.index + m[1].length;
        if (seen[name]) {
          frag = frag || document.createDocumentFragment();
          frag.appendChild(document.createTextNode(text.slice(0, start + name.length)));
          text = text.slice(start + name.length);
          continue;
        }
        seen[name] = 1;
        frag = frag || document.createDocumentFragment();
        frag.appendChild(document.createTextNode(text.slice(0, start)));
        var a = document.createElement("a");
        a.href = bulba(name); a.target = "_blank"; a.rel = "noopener"; a.className = "dex";
        a.title = name + " on Bulbapedia (sprites, forms, locations)";
        a.textContent = name;
        frag.appendChild(a);
        text = text.slice(start + name.length);
      }
      if (frag) { frag.appendChild(document.createTextNode(text)); node.parentNode.replaceChild(frag, node); }
    });
  }

  // ---------- tracker ----------
  function fillCarts() {
    var sel = $("cart"), carts = {};
    DEX[state.gen].rows.forEach(function (r) { if (r[5]) carts[r[5]] = 1; });
    sel.innerHTML = '<option value="">Any cart</option>';
    Object.keys(carts).sort().forEach(function (c) {
      var o = document.createElement("option"); o.value = c; o.textContent = c; sel.appendChild(o);
    });
  }
  function renderTracker() {
    var d = DEX[state.gen], done = load(state.gen);
    var q = $("q").value.trim().toLowerCase(), show = $("show").value, cart = $("cart").value;
    var html = [];
    d.rows.forEach(function (r) {
      var id = rowId(r), isDone = !!done[id];
      if (show === "todo" && isDone) return;
      if (show === "done" && !isDone) return;
      if (cart && r[5] !== cart) return;
      if (q && r.join(" ").toLowerCase().indexOf(q) < 0) return;
      var map = placeLink(r[4] || "");
      html.push(
        '<tr class="' + (isDone ? "is-done" : "") + '">' +
        '<td class="c-done"><input type="checkbox" data-id="' + esc(id) + '"' + (isDone ? " checked" : "") +
        ' aria-label="' + esc(r[1] + " " + (r[2] === "—" ? "" : r[2])) + ' done"></td>' +
        '<td class="num">' + r[0] + "</td>" +
        '<td class="mon" data-k="Pokémon"><a href="' + bulba(r[1]) + '" target="_blank" rel="noopener" title="Sprites and forms on Bulbapedia">' + esc(r[1]) + "</a></td>" +
        '<td data-k="Form"' + (r[2] === "—" ? ' class="empty"' : "") + ">" + esc(r[2]) + "</td>" +
        '<td data-k="Box">' + esc(r[3]) + "</td>" +
        '<td data-k="Where">' + esc(r[4]) + (map ? ' <a class="map" href="' + map + '" target="_blank" rel="noopener" title="Location page and map on Bulbapedia">map ↗</a>' : "") + "</td>" +
        '<td class="cart" data-k="Cart">' + esc(r[5]) + "</td>" +
        '<td class="note' + (r[6] ? "" : " empty") + '" data-k="Notes">' + esc(r[6] || "") + "</td></tr>"
      );
    });
    $("rows").innerHTML = html.join("") ||
      '<tr><td colspan="8" class="muted">Nothing matches.</td></tr>';
    $("unob").innerHTML = d.unob.map(function (r) {
      return "<tr><td>" + r[0] + '</td><td><a href="' + bulba(r[1]) + '" target="_blank" rel="noopener">' + esc(r[1]) +
        "</a></td><td>" + esc(r[2]) + "</td><td>" + esc(r[4]) + "</td><td>" + esc(r[5]) + "</td></tr>";
    }).join("");
    $("unob-wrap").hidden = !d.unob.length;
    updateProgress();
  }
  function updateProgress() {
    var d = DEX[state.gen], done = load(state.gen), n = 0;
    d.rows.forEach(function (r) { if (done[rowId(r)]) n++; });
    var pct = d.rows.length ? Math.round(n * 100 / d.rows.length) : 0;
    $("pfill").style.width = pct + "%";
    $("pbar").setAttribute("aria-valuenow", pct);
    $("ptext").textContent = n + " / " + d.rows.length + " slots (" + pct + "%)";
    $("bcount").textContent = n + " / " + d.rows.length + " collected";
  }
  $("rows").addEventListener("change", function (e) {
    var cb = e.target; if (!cb.dataset.id) return;
    setDone(cb.dataset.id, cb.checked);
  });
  ["q", "show", "cart"].forEach(function (id) {
    $(id).addEventListener(id === "q" ? "input" : "change", renderTracker);
  });


  // ---------- shared toggle ----------
  function setDone(id, on) {
    var done = load(state.gen);
    if (on) done[id] = 1; else delete done[id];
    save(state.gen, done);
    refreshMarks();
  }
  // Update every view in place (box slots, tracker rows, guide steps, progress).
  function refreshMarks() {
    var done = load(state.gen);
    document.querySelectorAll(".slot[data-id]").forEach(function (b) {
      var on = !!done[b.dataset.id];
      b.classList.toggle("got", on); b.setAttribute("aria-pressed", on);
    });
    document.querySelectorAll(".box").forEach(function (box) {
      var ids = box.querySelectorAll(".slot[data-id]"), n = 0;
      ids.forEach(function (b) { if (done[b.dataset.id]) n++; });
      box.querySelector(".bc").textContent = n + "/" + ids.length;
      box.classList.toggle("full", n === ids.length);
    });
    document.querySelectorAll("#rows input[type=checkbox]").forEach(function (cb) {
      var on = !!done[cb.dataset.id];
      cb.checked = on; cb.closest("tr").classList.toggle("is-done", on);
    });
    updateSteps(done);
    updateGuideSprites(done);
    updateProgress();
  }

  // ---------- sprites (PokeAPI) ----------
  var SPR = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/";
  var formCache = {};
  try { formCache = JSON.parse(localStorage.getItem("livingdex:sprites") || "{}"); } catch (e) {}
  function cacheForm(slug, url) {
    formCache[slug] = url || "";
    try { localStorage.setItem("livingdex:sprites", JSON.stringify(formCache)); } catch (e) {}
  }
  function setSprite(img, r) {
    var meta = r[7] || {}, base = SPR + r[0] + ".png";
    img.onerror = function () {
      if (img.src !== base) { img.src = base; return; }
      img.onerror = null; img.replaceWith(altText(r));
    };
    if (meta.f) {
      if (meta.f in formCache) { img.src = formCache[meta.f] || base; return; }
      img.src = base;
      fetch("https://pokeapi.co/api/v2/pokemon-form/" + meta.f + "/")
        .then(function (res) { if (!res.ok) throw 0; return res.json(); })
        .then(function (j) { var u = j.sprites && j.sprites.front_default; cacheForm(meta.f, u); if (u) img.src = u; })
        .catch(function () { cacheForm(meta.f, ""); });
    } else if (meta.fem) {
      img.src = SPR + "female/" + r[0] + ".png";
    } else {
      img.src = base;
    }
  }
  function altText(r) {
    var s = document.createElement("span"); s.className = "alt";
    s.textContent = r[1]; return s;
  }
  function shortTag(r) {
    var f = r[2] || "";
    if (f === "Male") return "♂"; if (f === "Female") return "♀";
    if (f === "—" || !f) return "";
    return f.replace(/ (Form|Forme|Cloak|Style|Pattern|Size|Plumage|Mode|Core|Flower|Sweet)\b/g, "").split(/[ \/]/)[0].slice(0, 6);
  }

  // ---------- boxes ----------
  function renderBoxes() {
    var d = DEX[state.gen], wrap = $("boxes");
    wrap.innerHTML = "";
    for (var b = 0; b * 30 < d.rows.length; b++) {
      var det = document.createElement("details");
      det.className = "box"; det.open = true;
      var sum = document.createElement("summary");
      sum.innerHTML = "<span>Box " + (b + 1) + '</span><span class="bc"></span>';
      det.appendChild(sum);
      var grid = document.createElement("div"); grid.className = "grid";
      for (var i = 0; i < 30; i++) {
        var r = d.rows[b * 30 + i];
        var btn = document.createElement("button");
        btn.type = "button";
        if (!r) { btn.className = "slot empty"; btn.disabled = true; btn.setAttribute("aria-hidden", "true"); grid.appendChild(btn); continue; }
        btn.className = "slot";
        btn.dataset.id = rowId(r);
        var label = r[1] + (r[2] && r[2] !== "—" ? " (" + r[2] + ")" : "");
        btn.title = "#" + r[0] + " " + label + "\nBox: " + r[3] + "\n" + r[4];
        btn.setAttribute("aria-label", label);
        var img = document.createElement("img");
        img.alt = ""; img.loading = "lazy"; img.decoding = "async"; img.width = 68; img.height = 56;
        btn.appendChild(img); setSprite(img, r);
        var t = shortTag(r);
        if (t) { var tg = document.createElement("span"); tg.className = "tag"; tg.textContent = t; btn.appendChild(tg); }
        grid.appendChild(btn);
      }
      det.appendChild(grid);
      wrap.appendChild(det);
    }
    refreshMarks();
  }
  $("boxes").addEventListener("click", function (e) {
    var b = e.target.closest(".slot[data-id]"); if (!b) return;
    setDone(b.dataset.id, !b.classList.contains("got"));
  });
  $("btoggle").addEventListener("click", function () {
    var boxes = document.querySelectorAll(".box");
    var anyOpen = Array.prototype.some.call(boxes, function (x) { return x.open; });
    boxes.forEach(function (x) { x.open = !anyOpen; });
    this.textContent = anyOpen ? "Expand all" : "Collapse all";
  });

  // ---------- guide steps ----------
  var steps = [];
  function baseName(box) {
    return box.replace(/\(.*?\)/g, "").replace(/^(Male|Female)\s+/, "").replace(/[♂♀]/g, "")
      .split(",")[0].replace(/\s+(any)$/, "").trim();
  }
  function formToken(f) {
    if (!f || f === "—" || f === "Male" || f === "Female") return "";
    return f.toLowerCase().replace(/\b(form|forme|cloak|style|pattern|size|plumage|mode|core|flower|sweet|sea)\b/g, "")
      .split("/")[0].trim();
  }
  // Small clickable sprites next to each Pokémon named in a step.
  // One click ticks the next uncollected slot of that species; when all are ticked, a click clears them.
  var gsprites = [];
  function addGuideSprites(it, groups) {
    var names = Object.keys(groups).sort(function (a, b) { return b.length - a.length; });
    function textNodes() {
      var w = document.createTreeWalker(it, NodeFilter.SHOW_TEXT, {
        acceptNode: function (n) { return n.parentNode.closest(".gsprite,.step-badge") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; }
      });
      var out = []; while (w.nextNode()) out.push(w.currentNode); return out;
    }
    names.forEach(function (n) {
      var re = new RegExp("(^|[^\\wÀ-ɏ])" + n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?![\\wÀ-ɏ])");
      var node = null, m = null;
      textNodes().some(function (t) { m = re.exec(t.nodeValue); if (m) node = t; return !!m; });
      if (!node) return;
      var rows = groups[n];
      var show = rows.filter(function (r) { return r[1] === n; })[0] || rows[0];
      var btn = document.createElement("button");
      btn.type = "button"; btn.className = "gsprite";
      btn.dataset.ids = rows.map(rowId).join("\n");
      btn.dataset.name = n;
      var img = document.createElement("img"); img.alt = ""; img.loading = "lazy"; img.width = 32; img.height = 32;
      setSprite(img, show);
      btn.appendChild(img);
      if (rows.length > 1) { var c = document.createElement("span"); c.className = "gs-count"; btn.appendChild(c); }
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        var done = load(state.gen), list = btn.dataset.ids.split("\n");
        var next = list.filter(function (id) { return !done[id]; })[0];
        if (next) done[next] = 1; else list.forEach(function (id) { delete done[id]; });
        save(state.gen, done); refreshMarks();
      });
      var p = node.parentNode;
      if (p.tagName === "A" && p.textContent.trim() === n) { p.parentNode.insertBefore(btn, p); return; }
      p.insertBefore(btn, node.splitText(m.index + m[1].length));
    });
    gsprites = gsprites.concat(Array.prototype.slice.call(it.querySelectorAll(".gsprite")));
  }
  function updateGuideSprites(done) {
    gsprites.forEach(function (b) {
      var list = b.dataset.ids.split("\n"), n = 0;
      list.forEach(function (id) { if (done[id]) n++; });
      var all = n === list.length;
      b.classList.toggle("got", all); b.classList.toggle("part", n > 0 && !all);
      b.title = b.dataset.name + ": " + n + " of " + list.length + " collected. " + (all ? "Click to clear." : "Click to mark one collected.");
      b.setAttribute("aria-label", b.title);
      var c = b.querySelector(".gs-count"); if (c) c.textContent = n + "/" + list.length;
    });
  }
  function buildSteps(root, d) {
    steps = []; gsprites = [];
    var byName = {};   // species or base name -> row ids
    d.rows.forEach(function (r) {
      var id = rowId(r);
      [r[1], baseName(r[3])].forEach(function (n) {
        if (!n) return; (byName[n] = byName[n] || []).push(r);
      });
    });
    var names = Object.keys(byName).sort(function (a, b) { return b.length - a.length; });
    var re = names.map(function (n) {
      return [n, new RegExp("(^|[^\\wÀ-ɏ])" + n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?![\\wÀ-ɏ])")];
    });
    var section = "";
    var EXCL = /what to box|can't|cannot|unobtainable|not obtainable|costly|event slots|slots you/i;
    Array.prototype.forEach.call(root.children, function (el) {
      if (/^H[1-3]$/.test(el.tagName)) { section = el.textContent; return; }
      if (!/^Part\s*\d/i.test(section) || EXCL.test(section)) return;
      var items = [];
      if (el.matches(".tablewrap")) {
        var heads = el.querySelector("tr") ? el.querySelector("tr").textContent : "";
        if (/\b(Time|Slots|Why|Status|Pattern)\b/.test(heads) && !/Catch|Get/.test(heads)) return;
        el.querySelectorAll("tr").forEach(function (tr) { if (tr.querySelector("td")) items.push(tr); });
      } else if (/^(UL|OL)$/.test(el.tagName)) {
        el.querySelectorAll(":scope > li").forEach(function (li) { items.push(li); });
      }
      items.forEach(function (it) {
        var text = (it.tagName === "TR" ? Array.prototype.map.call(it.children, function (c) { return c.textContent; }).join(" | ") : it.textContent).normalize("NFC"), low = text.toLowerCase(), hit = {}, ids = {};
        var masked = text;
        re.forEach(function (p) {
          if (p[1].test(masked)) {
            hit[p[0]] = 1;
            masked = masked.replace(new RegExp(p[1].source, "g"), "$1 ");  // so "Pyroar" doesn't re-match inside longer names
          }
        });
        var groups = {};
        Object.keys(hit).forEach(function (n) {
          var cands = byName[n];
          var withForm = cands.filter(function (r) { var t = formToken(r[2]); return t && low.indexOf(t) >= 0; });
          var hasFormRows = cands.some(function (r) { return formToken(r[2]); });
          var seenIds = {};
          groups[n] = (hasFormRows && withForm.length ? withForm : cands).filter(function (r) {
            var k = rowId(r); if (seenIds[k]) return false; seenIds[k] = 1; return true;
          });
          groups[n].forEach(function (r) { ids[rowId(r)] = 1; });
        });
        // Two names for the same slots (e.g. "Mankey" and "Annihilape"): keep one sprite, on the species' own name.
        var bySet = {};
        Object.keys(groups).forEach(function (n) {
          var k = groups[n].map(rowId).sort().join("\n"), own = groups[n].some(function (r) { return r[1] === n; });
          if (!bySet[k] || (own && !bySet[k].own)) bySet[k] = { n: n, own: own };
        });
        var keep = {}; Object.keys(bySet).forEach(function (k) { keep[bySet[k].n] = groups[bySet[k].n]; });
        addGuideSprites(it, keep);
        var list = Object.keys(ids);
        if (!list.length) return;
        var badge = document.createElement("span");
        badge.className = "step-badge";
        badge.title = "Box slots this step covers";
        var host = it.tagName === "TR" ? it.querySelector("td") : (it.querySelector(":scope > p") || it);
        host.insertBefore(badge, host.firstChild);
        steps.push({ el: it, badge: badge, ids: list });
      });
    });
  }
  function updateSteps(done) {
    steps.forEach(function (s) {
      var n = 0; s.ids.forEach(function (id) { if (done[id]) n++; });
      var ok = n === s.ids.length;
      s.badge.textContent = ok ? "✓" : n + "/" + s.ids.length;
      s.badge.classList.toggle("ok", ok);
      s.el.classList.toggle("step-done", ok);
    });
  }

  // ---------- export / import / reset ----------
  var bk = $("backup"), pending = null;
  function count(obj) { return Object.keys(obj || {}).filter(function (k) { return obj[k]; }).length; }
  function rowIds(g) {
    var ids = {}; (DEX[g].rows || []).forEach(function (r) { ids[rowId(r)] = 1; }); return ids;
  }
  function scopeGens() {
    var v = (document.querySelector('input[name="bk-scope"]:checked') || {}).value;
    return v === "gen" ? [state.gen] : GENS;
  }
  function payload() {
    var p = {}; scopeGens().forEach(function (g) { p[g] = load(g); });
    return { livingdex: 2, exported: new Date().toISOString(), progress: p };
  }
  function status(msg, bad) { var el = $("bk-status"); el.textContent = msg; el.classList.toggle("bad", !!bad); }
  function describe(prog) {
    return GENS.filter(function (g) { return prog[g] && count(prog[g]); }).map(function (g) {
      return DEX[g].label + ": " + count(prog[g]) + " / " + DEX[g].rows.length;
    }).join(" · ");
  }
  function refreshBackup() {
    var lbl = DEX[state.gen].label;
    $("bk-genlabel").textContent = lbl; $("bk-genlabel2").textContent = lbl;
    $("bk-summary").textContent = describe(payload().progress) || "Nothing ticked yet.";
  }
  function openBackup() {
    refreshBackup(); status("");
    if (bk.showModal) bk.showModal(); else bk.setAttribute("open", "");
  }
  $("backup-btn").addEventListener("click", openBackup);
  Array.prototype.forEach.call(document.querySelectorAll(".open-backup"), function (b) { b.addEventListener("click", openBackup); });
  bk.addEventListener("click", function (e) { if (e.target === bk) bk.close(); });
  Array.prototype.forEach.call(document.querySelectorAll('input[name="bk-scope"]'), function (r) { r.addEventListener("change", refreshBackup); });

  // Text codes: "LDX1:" + base64 of the JSON, so they survive chat apps and notes.
  function toCode(obj) {
    var bytes = new TextEncoder().encode(JSON.stringify(obj)), bin = "";
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return "LDX1:" + btoa(bin);
  }
  function parseAny(text) {
    text = (text || "").trim();
    var m = text.match(/LDX1:([A-Za-z0-9+/=\s]+)/);
    if (m) {
      var bin = atob(m[1].replace(/\s+/g, "")), bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      text = new TextDecoder().decode(bytes);
    }
    var data = JSON.parse(text);
    if (!data || typeof data.progress !== "object") throw new Error("not an export");
    var out = {};
    Object.keys(data.progress).forEach(function (g) {
      if (!DEX[g] || typeof data.progress[g] !== "object") return;
      var clean = {};
      Object.keys(data.progress[g]).forEach(function (id) { if (data.progress[g][id]) clean[id] = 1; });
      out[g] = clean;
    });
    if (!Object.keys(out).length) throw new Error("no gens");
    return out;
  }

  $("bk-download").addEventListener("click", function () {
    var gens = scopeGens();
    var name = "living-dex-" + (gens.length === 1 ? "gen" + gens[0] : "all") + "-" + new Date().toISOString().slice(0, 10) + ".json";
    var blob = new Blob([JSON.stringify(payload(), null, 1)], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    status("Saved " + name + ".");
  });
  $("bk-copy").addEventListener("click", function () {
    var code = toCode(payload());
    function fallback() { $("bk-text").value = code; $("bk-text").select(); status("Couldn't reach the clipboard. The text is in the box below: copy it from there."); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code).then(function () { status("Copied. Paste it into Import on the other device."); }, fallback);
    } else fallback();
  });

  function preview(text) {
    pending = null; $("bk-apply").disabled = true;
    var box = $("bk-preview");
    if (!text.trim()) { box.hidden = true; return; }
    try {
      pending = parseAny(text);
      var unknown = 0;
      Object.keys(pending).forEach(function (g) {
        var ids = rowIds(g); Object.keys(pending[g]).forEach(function (id) { if (!ids[id]) unknown++; });
      });
      box.textContent = "Found " + describe(pending) + (unknown ? " (" + unknown + (unknown === 1 ? " tick no longer matches a slot" : " ticks no longer match a slot") + "; kept but not shown)" : "");
      box.classList.remove("bad"); box.hidden = false; $("bk-apply").disabled = false;
    } catch (e) {
      box.textContent = "That isn't a living dex export."; box.classList.add("bad"); box.hidden = false;
    }
  }
  $("bk-text").addEventListener("input", function () { preview(this.value); });
  $("bk-file").addEventListener("change", function () {
    var f = this.files[0]; if (!f) return;
    var r = new FileReader();
    r.onload = function () { $("bk-text").value = r.result.length > 4000 ? "" : r.result; preview(r.result); if (pending) status("Loaded " + f.name + "."); };
    r.readAsText(f); this.value = "";
  });
  $("bk-apply").addEventListener("click", function () {
    if (!pending) return;
    var mode = (document.querySelector('input[name="bk-mode"]:checked') || {}).value;
    if (mode === "replace" && !confirm("Replace your ticks for " + Object.keys(pending).map(function (g) { return DEX[g].label; }).join(", ") + "? This can't be undone.")) return;
    Object.keys(pending).forEach(function (g) {
      var cur = mode === "merge" ? load(g) : {};
      Object.keys(pending[g]).forEach(function (id) { cur[id] = 1; });
      save(g, cur);
    });
    renderTracker(); refreshMarks(); refreshBackup();
    status("Imported (" + (mode === "merge" ? "merged" : "replaced") + ").");
    pending = null; $("bk-apply").disabled = true; $("bk-text").value = ""; $("bk-preview").hidden = true;
  });
  $("bk-reset").addEventListener("click", function () {
    if (confirm("Clear every tick for " + DEX[state.gen].label + "?")) {
      save(state.gen, {}); renderTracker(); refreshMarks(); refreshBackup(); status(DEX[state.gen].label + " cleared.");
    }
  });

  if (!location.hash) history.replaceState(null, "", "#gen" + GENS[0]);
  fromHash();
})();
