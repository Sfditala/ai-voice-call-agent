(() => {
  const $ = (id) => document.getElementById(id);
  const P = window.PROJECT;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const COLORS = { trigger: "#ef5a66", agent: "#f5c04e", model: "#b18cff", knowledge: "#4fd1a5", tool: "#63b3ff", gate: "#ff9f5a", output: "#e6e6e6" };

  const state = { call: null, i: -1, timer: null, wf: null, agent: null };

  function el(tag, attrs = {}, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") e.className = v;
      else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v);
    }
    for (const kid of kids) if (kid != null) e.append(kid);
    return e;
  }
  const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  /* ---------- architecture strip ---------- */
  function drawArch() {
    const box = $("arch");
    box.replaceChildren();
    const groups = [["The conversation · ElevenLabs", ["caller", "voice", "llm", "kb"]], ["The actions · n8n over MCP", ["mcp", "save_lead", "notify_tala"]]];
    for (const [title, ids] of groups) {
      box.append(el("div", { class: "arch-row-label" }, title));
      for (const id of ids) {
        const n = P.arch.find((a) => a.id === id);
        const c = COLORS[n.kind];
        const node = el("div", { class: "anode", "data-id": id, style: `--c:${c}` },
          el("span", { class: "k", style: `background:${c}` }), el("b", {}, n.label), el("small", {}, n.sub));
        box.append(node);
      }
    }
  }
  function light(ids, failId) {
    document.querySelectorAll(".anode").forEach((n) => {
      n.classList.toggle("lit", ids.includes(n.dataset.id) && n.dataset.id !== failId);
      n.classList.toggle("fail", n.dataset.id === failId);
    });
  }
  function litFor(line) {
    if (line.who === "caller") return [["caller", "voice"]];
    if (line.who === "agent") return [line.kb ? ["voice", "llm", "kb"] : ["voice", "llm"]];
    if (line.who === "tool") return [["llm", "mcp", line.tool], line.ok ? null : line.tool];
    return [[]];
  }

  /* ---------- the call ---------- */
  function renderPicks() {
    const box = $("callPicks");
    box.replaceChildren();
    P.calls.forEach((c, idx) => {
      const b = el("button", { class: "sig-card", "aria-pressed": String(state.call === c), onclick: () => pick(idx, true) },
        el("span", { class: "sig-label" }, c.label), el("span", { class: "sig-tag" }, c.tag));
      box.append(b);
    });
    let sum = document.querySelector(".call-summary");
    if (!sum) { sum = el("p", { class: "call-summary" }); $("calls").append(sum); }
    sum.textContent = state.call.summary;
  }

  function pick(idx, autoplay) {
    stop();
    state.call = P.calls[idx];
    state.i = -1;
    $("transcript").replaceChildren(el("p", { class: "hint" }, "Press ▶ Play call to start the replay."));
    $("events").replaceChildren(el("p", { class: "empty" }, "Tool calls from n8n will appear here as they happen."));
    $("clock").textContent = "00:00";
    setStatus("Ready", "");
    light([]);
    renderPicks();
    if (autoplay) {
      if (window.matchMedia("(max-width: 900px)").matches) document.querySelector(".callstage").scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
      play();
    }
  }

  function setStatus(text, mode) {
    $("status").textContent = text;
    const a = $("avatar");
    a.classList.toggle("talking", mode === "talking");
    a.classList.toggle("listening", mode === "listening");
  }

  function show(line) {
    const t = $("transcript");
    t.querySelector(".hint")?.remove();
    $("clock").textContent = mmss(line.t);
    const [ids, fail] = litFor(line);
    light(ids, fail);

    if (line.who === "agent" || line.who === "caller") {
      const meta = el("div", { class: "meta" }, line.who === "agent" ? "Agent" : "Caller");
      if (line.mood) meta.append(el("span", { class: "mood" }, line.mood));
      if (line.kb) meta.append(el("span", { class: "kbflag" }, "▤ from the CV"));
      if (line.bad) meta.append(el("span", { class: "badflag" }, "✕ invented"));
      t.append(el("div", { class: `bubble ${line.who}${line.bad ? " bad" : ""}`, dir: "auto" }, meta, line.text));
      setStatus(line.who === "agent" ? "Speaking…" : "Listening…", line.who === "agent" ? "talking" : "listening");
    } else if (line.who === "tool") {
      t.append(el("div", { class: `toolpill ${line.ok ? "ok" : "err"}` }, `⚙ ${line.tool} ${line.ok ? "✓" : "✕ failed"}`));
      setStatus(`Calling ${line.tool}…`, "");
      logEvent(line);
    } else if (line.who === "fix") {
      t.append(el("div", { class: "fixnote" }, line.text));
      setStatus("Fixed", "");
    }
    t.scrollTop = t.scrollHeight;
  }

  function logEvent(line) {
    const box = $("events");
    box.querySelector(".empty")?.remove();
    const ev = el("div", { class: `ev ${line.ok ? "ok" : "err"}` },
      el("div", { class: "ev-head" }, el("span", {}, `${mmss(line.t)} · ${line.tool}`), el("span", { class: "st" }, line.ok ? "success" : "error")),
      el("pre", {}, `arguments ${JSON.stringify(line.args, null, 2)}\n\nresult    ${line.result}`),
      line.note ? el("p", {}, line.note) : null);
    box.append(ev);
    box.scrollTop = box.scrollHeight;
  }

  function step() {
    const lines = state.call.lines;
    if (state.i >= lines.length - 1) { stop(); setStatus("Call ended", ""); light([]); return false; }
    state.i += 1;
    show(lines[state.i]);
    return true;
  }
  function delayFor(line) {
    const speed = Number($("speed").value);
    const base = line.who === "tool" ? 1500 : line.who === "fix" ? 3200 : 900 + line.text.length * 32;
    return Math.min(base, 7000) / speed;
  }
  function loop() {
    if (!step()) return;
    state.timer = setTimeout(loop, delayFor(state.call.lines[state.i]));
  }
  function play() {
    if (state.timer) return stop();
    if (state.i >= state.call.lines.length - 1) pick(P.calls.indexOf(state.call), false);
    $("play").textContent = "❚❚ Pause";
    loop();
  }
  function stop() {
    clearTimeout(state.timer);
    state.timer = null;
    $("play").textContent = state.call && state.i >= 0 && state.i < state.call.lines.length - 1 ? "▶ Resume" : "▶ Play call";
  }

  /* ---------- under the hood ---------- */
  function fromAI(expr) {
    const m = /\$fromAI\('([^']+)',\s*'([^']*)'/.exec(expr || "");
    return m ? [m[1], m[2]] : null;
  }
  function toolsView() {
    const wrap = el("div");
    const tools = state.wf.nodes.filter((n) => n.parameters?.toolDescription);
    for (const n of tools) {
      const p = n.parameters;
      const params = [];
      for (const [col, v] of Object.entries(p.columns?.value || {})) {
        const ai = fromAI(v);
        params.push([col, ai ? `the agent fills it: ${ai[1]}` : `fixed: ${v.replace(/^=/, "")}`]);
      }
      if (p.text) { const ai = fromAI(p.text); if (ai) params.push([ai[0], `the agent fills it: ${ai[1]}`]); }
      if (p.chatId) params.push(["chatId", `fixed: ${p.chatId}`]);
      const table = el("table", {}, el("tr", {}, el("th", {}, "field"), el("th", {}, "where it comes from")));
      params.forEach(([a, b]) => table.append(el("tr", {}, el("td", {}, el("code", {}, a)), el("td", {}, b))));
      wrap.append(el("div", { class: "tool" }, el("h3", {}, n.name), el("p", {}, `${n.type.replace("n8n-nodes-base.", "")} · "${p.toolDescription}"`), table));
    }
    return wrap;
  }
  function connectionView() {
    const a = state.agent.mcp_server;
    const trig = state.wf.nodes.find((n) => n.type.includes("mcpTrigger"));
    const rows = [
      ["n8n side", `MCP Server Trigger · path /mcp/${trig.parameters.path} · auth: ${trig.parameters.authentication}`],
      ["ElevenLabs side", `${a.name} · ${a.transport}`],
      ["URL", a.url],
      ["Header", `Authorization: ${a.request_headers.Authorization}`],
      ["Approval", `${a.approval_policy} (a voice call can't wait for a click)`],
      ["Gotcha", "The server has to be attached to the agent itself, not only added to the workspace."],
    ];
    const table = el("table");
    rows.forEach(([k, v]) => table.append(el("tr", {}, el("th", {}, k), el("td", {}, el("code", {}, v)))));
    return table;
  }
  function settingsView() {
    const ag = state.agent;
    const rows = [
      ["Languages", `${ag.conversation.default_language} (default) + ${ag.conversation.additional_languages.join(", ")}, detected per caller`],
      ["First message (ar)", ag.conversation.first_message.ar],
      ["First message (en)", ag.conversation.first_message.en],
      ["Model", `${ag.llm.model} · temperature ${ag.llm.temperature}`],
      ["Voice", `${ag.voice.mode} · ${ag.voice.tts_model}`],
      ...ag.knowledge_base.map((k) => [`Knowledge: ${k.name}`, `${k.usage_mode}${k.why ? ` · ${k.why}` : ""}`]),
      ["Embeddings", `${ag.rag.embedding_model} · ${ag.rag.why}`],
    ];
    const table = el("table");
    rows.forEach(([k, v]) => table.append(el("tr", {}, el("th", {}, k), el("td", { dir: "auto" }, v))));
    return table;
  }
  function renderHood() {
    const tabs = [
      ["System prompt", () => el("pre", { dir: "rtl" }, state.agent.system_prompt)],
      ["n8n tools", toolsView],
      ["The MCP connection", connectionView],
      ["Agent settings", settingsView],
    ];
    const bar = $("hoodTabs");
    const body = $("hoodBody");
    const open = (i) => {
      bar.querySelectorAll("button").forEach((b, j) => b.setAttribute("aria-selected", String(i === j)));
      body.replaceChildren(tabs[i][1]());
    };
    tabs.forEach(([name], i) => bar.append(el("button", { role: "tab", onclick: () => open(i) }, name)));
    open(0);
  }

  /* ---------- story ---------- */
  function renderStory() {
    const story = $("story");
    const sec = (title, cls = "") => { const s = el("div", { class: cls }, el("h3", {}, title)); story.append(s); return s; };
    sec("The problem").append(el("p", { style: "margin:0;color:var(--muted)" }, P.problem));
    const chips = el("div", { class: "chips" });
    P.stack.forEach((t) => chips.append(el("span", {}, t)));
    sec("Built with").append(chips);
    const d = el("ul", { class: "list" });
    P.decisions.forEach(([a, b]) => d.append(el("li", {}, el("b", {}, a), el("span", {}, b))));
    sec("Design decisions").append(d);
    const l = el("ul", { class: "list" });
    P.lessons.forEach(([a, b]) => l.append(el("li", {}, el("span", {}, a), el("span", { class: "fix" }, b))));
    sec("What broke, and the fix").append(l);
    const steps = el("ol", { class: "steps" });
    P.setup.forEach((s) => {
      const li = el("li");
      s.split(/(YOUR_[A-Z_]+|workflow\.json|agent\/elevenlabs-agent\.json)/).forEach((part, i) => li.append(i % 2 ? el("code", {}, part) : part));
      steps.append(li);
    });
    const run = sec("Run it yourself", "wide");
    run.append(steps, el("a", { class: "btn solid dl", href: "workflow.json", download: `${P.slug}.json` }, "Download the n8n JSON"));
  }

  async function init() {
    const [wf, agent] = await Promise.all([fetch("workflow.json").then((r) => r.json()), fetch("agent/elevenlabs-agent.json").then((r) => r.json())]);
    state.wf = wf;
    state.agent = agent;
    drawArch();
    state.call = P.calls[0];
    pick(0, false);
    $("play").onclick = play;
    $("step").onclick = () => { stop(); step(); stop(); };
    $("restart").onclick = () => pick(P.calls.indexOf(state.call), false);
    renderHood();
    renderStory();
    const toolCount = wf.nodes.filter((n) => n.parameters?.toolDescription).length;
    const toolCalls = P.calls.flatMap((c) => c.lines).filter((l) => l.who === "tool").length;
    for (const [v, k] of [[P.calls.length, "calls to replay"], [toolCount, "n8n tools over MCP"], [2, "languages"], [toolCalls, "real tool calls shown"]]) {
      $("stats").append(el("div", {}, el("dt", {}, k), el("dd", {}, String(v))));
    }
  }
  init().catch((err) => { $("transcript").textContent = `The project files couldn't load: ${err.message}`; });
})();
