(function () {
  "use strict";

  var POLL_MS = 30000; // demo copy: the feed is a static sample file
  var OFFLINE_AFTER = 2;
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var TIERS = {
    prohibited: { word: "Prohibited", sentence: "Banned in the EU.", chars: "10" },
    high: { word: "High-risk", sentence: "Allowed, with strict duties.", chars: "9" },
    limited: { word: "Limited", sentence: "Allowed if people know it's AI.", chars: "7" },
    minimal: { word: "Minimal", sentence: "Allowed. Few AI Act duties.", chars: "7.6" },
    incomplete: { word: "Incomplete", sentence: "Not enough answers to decide.", chars: "11.4" }
  };

  var screen = document.getElementById("screen");
  var checks = null;
  var newestId;
  var renderedKey;
  var failures = 0;
  var offline = false;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function glyph() {
    var g = el("span", "ac-glyph");
    g.setAttribute("aria-hidden", "true");
    return g;
  }

  function tierInfo(tier) {
    return TIERS[tier] || TIERS.incomplete;
  }

  function hhmm(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return new Intl.DateTimeFormat("en-IE", {
      hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Europe/Dublin"
    }).format(d);
  }

  function longDate(ymd) {
    var p = String(ymd).split("-");
    return Number(p[2]) + " " + MONTHS[Number(p[1]) - 1] + " " + p[0];
  }

  function todayYmd() {
    var parts = new Intl.DateTimeFormat("en-CA", {
      year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Europe/Dublin"
    }).format(new Date());
    return parts;
  }

  function usd(n) {
    return (Math.round(n * 100) / 100).toFixed(2);
  }

  function amountText(a) {
    var n = Number(a);
    return isNaN(n) ? String(a) : usd(n);
  }

  function shortId(id) {
    id = String(id || "");
    return id.length > 13 ? id.slice(0, 8) + "\u2026" + id.slice(-4) : id;
  }

  function shortTitle(title) {
    var t = String(title || "");
    var i = t.indexOf(" (");
    if (i > 0) t = t.slice(0, i);
    i = t.indexOf(" and ");
    if (i > 0) t = t.slice(0, i);
    return t;
  }

  function shortArticle(article) {
    var a = String(article || "");
    var m = a.match(/Annex [IVXLC]+/);
    if (m) return m[0];
    return a.split(",")[0].trim();
  }

  function whyLine(v) {
    if (v.tier === "incomplete") {
      var n = (v.missing || []).length;
      return n + (n === 1 ? " question unanswered" : " questions unanswered");
    }
    var parts = [];
    var rule = (v.matched || []).filter(function (m) { return m.tier === v.tier; })[0];
    if (rule) {
      parts.push(shortTitle(rule.title));
      parts.push(shortArticle(rule.article));
    }
    var latest = "";
    (v.obligations || []).forEach(function (o) {
      if (o.law === "AI Act" && o.applies_from && o.applies_from > latest) latest = o.applies_from;
    });
    if (latest) parts.push((latest > todayYmd() ? "from " : "since ") + longDate(latest));
    return parts.join(" \u00b7 ");
  }

  // Obligations arrive grouped by law, AI Act first (contract 2). The screen shows at most 3
  // AI Act duties, one GDPR line and a count of the rest (design spec, 22-obligation rule).
  function pickDuties(v) {
    var obs = v.obligations || [];
    var aiAct = obs.filter(function (o) { return o.law === "AI Act"; });
    var notArt4 = function (o) { return o.article !== "Art. 4"; };
    var duties = aiAct.filter(function (o) { return o.key && notArt4(o); });
    if (!duties.length) duties = aiAct.filter(notArt4);
    if (!duties.length) duties = aiAct.filter(function (o) { return o.key; });
    if (!duties.length) duties = aiAct;
    return duties.slice(0, 3).map(function (o) { return o.text; });
  }

  function moreText(n) {
    return "+" + n + " more in the agent's answer";
  }

  function buildBar(list) {
    var bar = el("header", "ac-bar");
    var logo = el("span", "ac-bar__logo");
    logo.setAttribute("role", "img");
    logo.setAttribute("aria-label", "AIwithDiego");
    bar.appendChild(logo);
    bar.appendChild(el("h1", "ac-bar__product", "AI Act Check"));
    var end = el("div", "ac-bar__end");
    var earned = el("span");
    if (list.length) {
      var total = list.reduce(function (s, c) { var n = Number(c.amount); return s + (isNaN(n) ? 0 : n); }, 0);
      earned.appendChild(document.createTextNode("Earned "));
      earned.appendChild(el("b", null, usd(total) + " USD"));
      earned.appendChild(document.createTextNode(" from " + list.length + (list.length === 1 ? " check" : " checks")));
    } else {
      earned.textContent = "No checks yet";
    }
    end.appendChild(earned);
    end.appendChild(buildStatus());
    bar.appendChild(end);
    return bar;
  }

  function buildStatus() {
    if (!offline) {
      var s = el("span", "ac-status", "Live");
      s.setAttribute("role", "status");
      return s;
    }
    var banner = el("span", "ac-banner");
    banner.setAttribute("role", "alert");
    banner.appendChild(el("span", "ac-status is-offline", "Can't reach the server."));
    banner.appendChild(el("span", null, "Last check stays up."));
    return banner;
  }

  function buildHero(check) {
    var v = check.verdict;
    var info = tierInfo(v.tier);
    var hero = el("div", "ac-hero");
    hero.appendChild(el("p", "ac-whose", "Latest check \u00b7 bought by an agent at " + hhmm(check.at)));
    var answer = el("h2", "ac-answer");
    answer.setAttribute("data-tier", v.tier);
    answer.style.setProperty("--chars", info.chars);
    answer.appendChild(el("span", "ac-mark", info.word));
    hero.appendChild(answer);
    var meaning = el("p", "ac-meaning");
    meaning.setAttribute("data-tier", v.tier);
    meaning.appendChild(glyph());
    meaning.appendChild(document.createTextNode(info.sentence));
    hero.appendChild(meaning);
    hero.appendChild(el("p", "ac-why", whyLine(v)));
    return hero;
  }

  function buildTodo(v, dropped) {
    var incomplete = v.tier === "incomplete";
    var head = incomplete ? "Still to answer" : "What you must do";
    var items, total;
    if (incomplete) {
      var missing = v.missing || [];
      items = missing.slice(0, 3).map(function (id) { return String(id).replace(/_/g, " "); });
      total = missing.length;
    } else {
      items = pickDuties(v);
      total = (v.obligations || []).length;
    }
    items = items.slice(0, Math.max(0, items.length - dropped));
    var todo = el("section", "ac-todo");
    todo.setAttribute("data-tier", v.tier);
    todo.setAttribute("aria-label", head);
    todo.appendChild(el("h3", "ac-todo__head", head));
    var ul = el("ul", "ac-todo__list");
    items.forEach(function (t) { ul.appendChild(el("li", null, t)); });
    todo.appendChild(ul);
    var gdpr = v.gdpr_short || [];
    var hasGdpr = (v.obligations || []).some(function (o) { return o.law === "GDPR"; });
    if (!incomplete && v.tier !== "prohibited" && hasGdpr && gdpr.length) {
      var g = el("p", "ac-gdpr");
      g.appendChild(el("b", null, "GDPR too:"));
      g.appendChild(document.createTextNode(" " + gdpr.join(", ")));
      todo.appendChild(g);
    }
    var more = total - items.length;
    if (more > 0) todo.appendChild(el("p", "ac-more", moreText(more)));
    return { node: todo, shown: items.length };
  }

  function buildSlide(list, dropped) {
    var main = el("main", "ac-slide");
    var body = el("div", "ac-slide__body");
    var todo = null;
    if (!list.length) {
      body.appendChild(el("h2", "ac-idle-title", "Waiting for an agent to pay"));
      body.appendChild(el("p", "ac-why", "It reads the free questions, gets a 402, pays 0.60 USD over Stripe MPP, and the verdict lands here."));
      main.appendChild(body);
      return { node: main, body: body, todo: null };
    }
    var v = list[0].verdict;
    body.appendChild(buildHero(list[0]));
    todo = buildTodo(v, dropped);
    body.appendChild(todo.node);
    main.appendChild(body);
    main.appendChild(el("p", "ac-disclaimer", (v.disclaimer || "") + " Rules version " + (v.rules_version || "") + "."));
    return { node: main, body: body, todo: todo };
  }

  function buildStrip(list) {
    var strip = el("footer", "ac-strip");
    var paid = el("p", "ac-strip__paid");
    if (!list.length) {
      paid.textContent = "Paid checks line up here.";
      strip.appendChild(paid);
      return strip;
    }
    var latest = list[0];
    var tick = el("span", "ac-paid__tick");
    tick.setAttribute("aria-hidden", "true");
    paid.appendChild(tick);
    var line = el("span");
    line.appendChild(el("b", null, "Paid " + amountText(latest.amount) + " USD"));
    line.appendChild(document.createTextNode(" \u00b7 receipt " + shortId(latest.receipt_id) + " \u00b7 " + hhmm(latest.at)));
    paid.appendChild(line);
    strip.appendChild(paid);
    var earlier = list.slice(1, 5);
    if (earlier.length) {
      var box = el("div", "ac-strip__earlier");
      box.appendChild(el("span", null, "Earlier checks"));
      var ul = el("ul", "ac-strip__pills");
      ul.setAttribute("aria-label", "Earlier checks");
      earlier.forEach(function (c) {
        var tier = c.verdict && c.verdict.tier;
        var li = el("li", "ac-pill");
        li.setAttribute("data-tier", tier);
        li.appendChild(glyph());
        li.appendChild(el("b", null, tierInfo(tier).word));
        li.appendChild(el("time", null, hhmm(c.at)));
        ul.appendChild(li);
      });
      box.appendChild(ul);
      strip.appendChild(box);
    }
    return strip;
  }

  function render(list) {
    screen.classList.remove("is-new");
    var dropped = 0;
    var slide;
    for (;;) {
      slide = buildSlide(list, dropped);
      screen.replaceChildren(buildBar(list), slide.node, buildStrip(list));
      var overflow = slide.body.scrollHeight > slide.body.clientHeight;
      if (!overflow || !slide.todo || slide.todo.shown < 3) break;
      dropped++;
    }
    fitAnswer(slide.node);
  }

  // Fallback font runs wider: shrink only the tier word, never the body type.
  function fitAnswer(main) {
    var answer = main.querySelector(".ac-answer");
    if (!answer) return;
    answer.style.removeProperty("font-size");
    var avail = main.querySelector(".ac-slide__body").clientWidth;
    var mark = answer.querySelector(".ac-mark");
    var w = mark.getBoundingClientRect().width;
    if (w > avail && avail > 0) {
      var fs = parseFloat(getComputedStyle(answer).fontSize);
      answer.style.fontSize = Math.floor(fs * avail / w) + "px";
    }
  }

  function arrive() {
    screen.classList.remove("is-new");
    void screen.offsetWidth;
    screen.classList.add("is-new");
  }

  function setOffline(next) {
    if (next === offline) return;
    offline = next;
    var end = screen.querySelector(".ac-bar__end");
    if (!end) return;
    var old = end.querySelector(".ac-banner") || end.querySelector(".ac-status");
    if (old) end.replaceChild(buildStatus(), old);
  }

  function update(list) {
    var first = checks === null;
    var nextNewest = list.length ? list[0].receipt_id : null;
    var key = list.map(function (c) { return c.receipt_id; }).join("|");
    checks = list;
    if (key !== renderedKey) {
      renderedKey = key;
      render(list);
      if (!first && nextNewest && nextNewest !== newestId) arrive();
    }
    newestId = nextNewest;
  }

  function poll() {
    fetch("data/feed.json", { cache: "no-store" })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (data) {
        failures = 0;
        setOffline(false);
        update(Array.isArray(data && data.checks) ? data.checks : []);
      })
      .catch(function () {
        failures++;
        if (checks === null) update([]);
        if (failures >= OFFLINE_AFTER) setOffline(true);
      })
      .then(function () { setTimeout(poll, POLL_MS); });
  }

  var resizeTimer;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { if (checks) render(checks); }, 150);
  });

  poll();
})();
