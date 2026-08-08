/* Muster embeddable chat widget.
 *
 * Drop this on any site:
 *   <script src="https://YOUR-BACKEND/widget.js"
 *           data-agent="AGENT_ID" data-key="msk_..."></script>
 *
 * Renders a floating chat bubble that talks to a published agent via the
 * public API. Vanilla JS, rendered inside a shadow root so the host page's
 * styles never leak in or out.
 */
(function () {
  var script = document.currentScript;
  if (!script) return;
  var agent = script.getAttribute("data-agent");
  var key = script.getAttribute("data-key");
  var title = script.getAttribute("data-title") || "Ask a question";
  var greeting =
    script.getAttribute("data-greeting") || "Hi! How can I help you today?";
  var api = script.getAttribute("data-api") || new URL(script.src).origin;

  if (!agent || !key) {
    console.error("[Muster] widget needs data-agent and data-key attributes");
    return;
  }

  var host = document.createElement("div");
  document.body.appendChild(host);
  var root = host.attachShadow({ mode: "open" });

  root.innerHTML =
    '<style>' +
    ':host{all:initial}' +
    '*{box-sizing:border-box;font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}' +
    '.bubble{position:fixed;right:20px;bottom:20px;width:56px;height:56px;border-radius:50%;' +
    'background:#0a0a0a;color:#fff;border:none;cursor:pointer;font-size:24px;box-shadow:0 4px 14px rgba(0,0,0,.25);z-index:2147483000}' +
    '.panel{position:fixed;right:20px;bottom:88px;width:360px;max-width:calc(100vw - 40px);height:520px;max-height:calc(100vh - 120px);' +
    'background:#fff;border:1px solid #e5e5e5;border-radius:14px;box-shadow:0 10px 40px rgba(0,0,0,.18);display:flex;flex-direction:column;overflow:hidden;z-index:2147483000}' +
    '.hidden{display:none}' +
    '.head{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid #e5e5e5}' +
    '.head b{font-size:14px;color:#0a0a0a}.head button{background:none;border:none;font-size:18px;color:#6b7280;cursor:pointer}' +
    '.msgs{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px}' +
    '.m{max-width:85%;padding:8px 11px;border-radius:12px;font-size:13px;line-height:1.45;white-space:pre-wrap}' +
    '.me{align-self:flex-end;background:#0a0a0a;color:#fff}' +
    '.bot{align-self:flex-start;background:#f7f7f7;color:#0a0a0a;border:1px solid #e5e5e5}' +
    '.foot{display:flex;gap:6px;padding:10px;border-top:1px solid #e5e5e5}' +
    '.foot input{flex:1;border:1px solid #e5e5e5;border-radius:9px;padding:8px 10px;font-size:13px;outline:none}' +
    '.foot input:focus{border-color:#0a0a0a}' +
    '.foot button{background:#0a0a0a;color:#fff;border:none;border-radius:9px;padding:0 14px;font-size:13px;cursor:pointer}' +
    '.foot button:disabled{opacity:.4}' +
    '.brand{padding:6px;text-align:center;font-size:10px;color:#9ca3af}' +
    '</style>' +
    '<button class="bubble" aria-label="Open chat">💬</button>' +
    '<div class="panel hidden">' +
    '  <div class="head"><b></b><button class="x" aria-label="Close">✕</button></div>' +
    '  <div class="msgs"></div>' +
    '  <div class="foot"><input type="text" placeholder="Type a message…"/><button class="send">Send</button></div>' +
    '  <div class="brand">powered by Muster</div>' +
    '</div>';

  var bubble = root.querySelector(".bubble");
  var panel = root.querySelector(".panel");
  var msgs = root.querySelector(".msgs");
  var input = root.querySelector(".foot input");
  var sendBtn = root.querySelector(".send");
  root.querySelector(".head b").textContent = title;

  var started = false;
  function addMsg(who, text) {
    var el = document.createElement("div");
    el.className = "m " + (who === "me" ? "me" : "bot");
    el.textContent = text;
    msgs.appendChild(el);
    msgs.scrollTop = msgs.scrollHeight;
    return el;
  }
  function clean(text) {
    // Hide internal [chunk N] / 【chunk N】 citation tags from end users.
    return (text || "").replace(/[\[【]\s*chunk\s*\d+\s*[\]】]/gi, "").trim();
  }

  function toggle() {
    var open = panel.classList.contains("hidden");
    panel.classList.toggle("hidden");
    bubble.textContent = open ? "✕" : "💬";
    if (open && !started) {
      started = true;
      addMsg("bot", greeting);
      input.focus();
    }
  }
  bubble.addEventListener("click", toggle);
  root.querySelector(".x").addEventListener("click", toggle);

  function send() {
    var q = input.value.trim();
    if (!q) return;
    input.value = "";
    addMsg("me", q);
    sendBtn.disabled = true;
    var thinking = addMsg("bot", "…");
    fetch(api + "/public/agents/" + agent + "/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Agent-Key": key },
      body: JSON.stringify({ question: q }),
    })
      .then(function (r) {
        return r.ok ? r.json() : Promise.reject(r.status);
      })
      .then(function (d) {
        thinking.textContent = clean(d.answer) || "Sorry, I don't have an answer.";
      })
      .catch(function () {
        thinking.textContent = "Sorry, something went wrong. Please try again.";
      })
      .finally(function () {
        sendBtn.disabled = false;
        msgs.scrollTop = msgs.scrollHeight;
      });
  }
  sendBtn.addEventListener("click", send);
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter") send();
  });
})();
