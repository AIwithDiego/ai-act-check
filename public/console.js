(function () {
  "use strict";

  var TIERS = {
    prohibited: { word: "Prohibited", sentence: "Banned in the EU." },
    high: { word: "High-risk", sentence: "Allowed, with strict duties." },
    limited: { word: "Limited", sentence: "Allowed if people know it's AI." },
    minimal: { word: "Minimal", sentence: "Allowed. Few AI Act duties." },
    incomplete: { word: "Incomplete", sentence: "Not enough answers to decide." }
  };
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var MAX_DUTIES = 5;
  var MAX_WAITS = 12;
  var WAIT_MS = 1300;

  var casesEl = document.getElementById("cases");
  var runEl = document.getElementById("run");
  var stepsEl = document.getElementById("steps");
  var answerEl = document.getElementById("answer");
  var priceEl = document.getElementById("price");
  var price = "0.60";
  var busy = false;
  var auto = new URLSearchParams(location.search).get("run");

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function longDate(ymd) {
    var p = String(ymd || "").split("-");
    if (p.length !== 3) return String(ymd || "");
    return Number(p[2]) + " " + MONTHS[Number(p[1]) - 1] + " " + p[0];
  }

  function secs(ms) {
    return ms < 1000 ? Math.round(ms) + " ms" : (ms / 1000).toFixed(1) + " s";
  }

  function step(title, note, state) {
    var li = el("li");
    li.dataset.state = state;
    li.appendChild(el("b", null, title));
    if (note) li.appendChild(el("small", null, note));
    stepsEl.appendChild(li);
    return li;
  }

  function setStep(li, state, note) {
    li.dataset.state = state;
    if (note == null) return;
    var s = li.querySelector("small") || li.appendChild(el("small"));
    s.textContent = note;
  }

  function buttons() {
    return Array.prototype.slice.call(casesEl.querySelectorAll("button"));
  }

  function showVerdict(v) {
    var info = TIERS[v.tier] || TIERS.incomplete;
    var tier = el("div", "cn-tier");
    var word = el("span", "cn-tier-word", info.word);
    word.dataset.tier = TIERS[v.tier] ? v.tier : "incomplete";
    tier.appendChild(word);
    answerEl.appendChild(tier);
    answerEl.appendChild(el("p", "cn-meaning", info.sentence));
    var first = (v.matched || [])[0];
    if (first) answerEl.appendChild(el("p", "cn-why", first.title + " · " + first.article));

    var duties = v.obligations || [];
    var key = duties.filter(function (o) { return o.key; });
    var shown = (key.length ? key : duties).slice(0, MAX_DUTIES);
    if (shown.length) {
      answerEl.appendChild(el("h2", "cn-h2", "Key duties" + (v.role ? " as " + (v.role === "both" ? "provider and deployer" : v.role) : "")));
      var ul = el("ul", "cn-list");
      shown.forEach(function (o) {
        var li = el("li");
        var law = el("span", "cn-law", o.law);
        law.dataset.law = o.law;
        li.appendChild(law);
        li.appendChild(document.createTextNode(o.text));
        li.appendChild(el("small", null, o.article + " · applies from " + longDate(o.applies_from)));
        ul.appendChild(li);
      });
      answerEl.appendChild(ul);
      if (duties.length > shown.length) {
        answerEl.appendChild(el("p", "cn-more", "The full answer lists " + duties.length + " duties. An agent gets all of them."));
      }
    }
    if (v.disclaimer) answerEl.appendChild(el("p", "cn-more", v.disclaimer));
  }

  function run(id, btn) {
    if (busy) return;
    busy = true;
    buttons().forEach(function (b) {
      b.disabled = true;
      b.setAttribute("aria-pressed", b === btn ? "true" : "false");
    });
    runEl.hidden = false;
    stepsEl.textContent = "";
    answerEl.textContent = "";
    var s1 = step("Asked without paying", "POST /classify", "doing");
    var s2 = step("Paid " + price + " USD from the test wallet", null, "todo");
    var s3 = step("Got the answer", null, "todo");
    var timer = setTimeout(function () {
      if (s1.dataset.state !== "doing") return;
      setStep(s1, "done", "The API answered 402 Payment Required: " + price + " USD.");
      setStep(s2, "doing", "Stripe Machine Payments Protocol, on Tempo testnet.");
    }, 900);
    runEl.scrollIntoView({ behavior: "smooth", block: "start" });

    var tries = 0;
    function ask() {
      return fetch("/console/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ case: id })
      }).then(function (res) {
        return res.json().then(function (body) {
          // Checks run one at a time. In a full room, wait for the turn instead of failing.
          if (res.status === 429 && body && body.busy && tries < MAX_WAITS) {
            tries += 1;
            clearTimeout(timer);
            setStep(s1, "doing", "Waiting for a turn. Checks run one at a time.");
            return new Promise(function (ok) { setTimeout(ok, WAIT_MS); }).then(ask);
          }
          return { ok: res.ok, body: body };
        });
      });
    }

    ask()
      .then(function (r) {
        clearTimeout(timer);
        if (!r.ok) throw new Error(r.body && r.body.error ? r.body.error : "The check failed. Try again.");
        var d = r.body;
        setStep(s1, "done", "The API answered 402 Payment Required: " + d.amount + " USD. " + secs(d.asked_ms));
        setStep(s2, "done", "Stripe Machine Payments Protocol, on " + d.network + ". " + secs(d.paid_ms));
        setStep(s3, "done", d.receipt_id ? "200 OK. Receipt " + d.receipt_id : "200 OK.");
        showVerdict(d.verdict);
      })
      .catch(function (err) {
        clearTimeout(timer);
        [s1, s2, s3].forEach(function (s) { if (s.dataset.state !== "done") s.dataset.state = "fail"; });
        answerEl.appendChild(el("p", "cn-error", err.message || "The check failed. Try again."));
      })
      .then(function () {
        busy = false;
        buttons().forEach(function (b) { b.disabled = false; });
      });
  }

  fetch("/console/cases")
    .then(function (res) { return res.json(); })
    .then(function (d) {
      price = d.price || price;
      priceEl.textContent = price;
      casesEl.textContent = "";
      d.cases.forEach(function (c) {
        var b = el("button", "cn-case");
        b.type = "button";
        b.setAttribute("aria-pressed", "false");
        b.appendChild(el("b", null, c.label));
        b.appendChild(el("span", null, c.use_case));
        b.addEventListener("click", function () { run(c.id, b); });
        casesEl.appendChild(b);
        if (auto === c.id) run(c.id, b);
      });
    })
    .catch(function () {
      casesEl.textContent = "";
      casesEl.appendChild(el("p", "cn-error", "The cases did not load. Refresh the page."));
    });
})();
