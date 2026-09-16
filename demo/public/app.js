const $ = (id) => document.getElementById(id);

const state = {
  target: null,
  coreText: "",
};

const repoEl = $("repo");
const askEl = $("ask");
const coreEl = $("core");
const resultEl = $("result");
const errorEl = $("error");
const classBadge = $("class-badge");
const rationaleEl = $("rationale");
const nextEl = $("next");
const approversEl = $("approvers");
const briefEl = $("brief");
const targetFlag = $("target-flag");
const samplesEl = $("samples");
const presetsEl = $("presets");
const targetCard = $("target-card");
const askPanel = $("ask-panel");
const askBody = $("ask-body");
const lockMsg = $("lock-msg");
const classifyBtn = $("classify");
const laneHeadline = $("lane-headline");
const jiraPath = $("jira-path");
const forgePath = $("forge-path");

function showError(msg) {
  errorEl.textContent = msg;
  errorEl.classList.remove("hidden");
}

function clearError() {
  errorEl.classList.add("hidden");
  errorEl.textContent = "";
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function setAskEnabled(on) {
  askEl.disabled = !on;
  coreEl.disabled = !on;
  classifyBtn.disabled = !on;
  if (on) {
    askPanel.classList.remove("locked");
    askBody.classList.remove("is-locked");
    lockMsg.classList.add("hidden");
  } else {
    askPanel.classList.add("locked");
    askBody.classList.add("is-locked");
    lockMsg.classList.remove("hidden");
  }
}

function renderTarget(data) {
  state.target = data.target;
  state.coreText = data.core_yaml?.text || "";
  coreEl.value = state.coreText;

  const core = data.core_yaml;
  const pills = [];
  if (core?.found) {
    pills.push(`<span class="pill">core.yaml · ${escapeHtml(core.path)}</span>`);
    pills.push(
      `<span class="pill">${core.protected_path_count || 0} protected paths</span>`
    );
  } else {
    pills.push(`<span class="pill warn">No core.yaml · Behavioral default</span>`);
  }
  if (data.target.private) pills.push(`<span class="pill warn">private</span>`);

  targetCard.classList.remove("hidden");
  targetCard.innerHTML = `
    <div class="name">TARGET · ${escapeHtml(data.target.full_name)}</div>
    <p class="meta">
      Branch <code>${escapeHtml(data.target.ref)}</code>
      ${data.target.description ? " · " + escapeHtml(data.target.description) : ""}
    </p>
    <p class="meta">${core?.found ? escapeHtml(`Loaded from ${core.source}`) : escapeHtml(core?.message || "")}</p>
    <div>${pills.join("")}</div>
  `;
  setAskEnabled(true);
}

async function bindRepo(repo) {
  clearError();
  resultEl.classList.add("hidden");
  const res = await fetch("/api/bind", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ repo }),
  });
  const data = await res.json();
  if (!res.ok) {
    setAskEnabled(false);
    targetCard.classList.add("hidden");
    throw new Error(data.error || "Bind failed");
  }
  renderTarget(data);
}

$("bind").addEventListener("click", async () => {
  try {
    await bindRepo(repoEl.value);
  } catch (err) {
    showError(String(err?.message || err));
  }
});

repoEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") $("bind").click();
});

classifyBtn.addEventListener("click", async () => {
  clearError();
  if (!state.target) return showError("Bind a target repo first.");
  const ask = askEl.value;
  if (!ask.trim()) return showError("Enter a mission ask first.");

  const body = {
    ask,
    target: state.target.full_name,
    core_yaml: coreEl.value,
  };

  let data;
  try {
    const res = await fetch("/api/classify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    data = await res.json();
    if (!res.ok) return showError(data.error || "Classify failed");
  } catch (err) {
    return showError(String(err?.message || err));
  }

  resultEl.classList.remove("hidden");
  classBadge.textContent = data.class;
  classBadge.className = `badge ${data.class}`;
  laneHeadline.textContent = data.lane?.headline || "";
  jiraPath.textContent = data.lane?.jira || "";
  forgePath.textContent = data.lane?.forge || "";
  rationaleEl.textContent = data.rationale;
  nextEl.textContent = data.allowed_next_step;
  targetFlag.textContent = `Classified for ${data.target || state.target.full_name}${
    data.core_present ? " · core.yaml active" : " · no core.yaml (Behavioral-safe default)"
  }`;

  if (data.core_present) {
    const b = (data.approvers?.behavioral || []).join(", ") || "(none)";
    const c = (data.approvers?.core || []).join(", ") || "(none)";
    approversEl.textContent = `Approvers — behavioral: ${b} · core: ${c}`;
  } else {
    approversEl.textContent = "";
  }

  if (data.brief) {
    briefEl.classList.remove("hidden");
    const paths = (data.brief.matched_protected_paths || []).join(", ") || "(none named)";
    const inv = (data.brief.matched_invariants || []).join(", ") || "(none named)";
    const qs = (data.brief.humans_should_decide || [])
      .map((q) => `<li>${escapeHtml(q)}</li>`)
      .join("");
    briefEl.innerHTML = `
      <h3>${escapeHtml(data.brief.title)}</h3>
      <p><strong>Forge will:</strong> ${escapeHtml(data.brief.forge_will)}</p>
      <p><strong>Protected paths:</strong> ${escapeHtml(paths)}</p>
      <p><strong>Invariants:</strong> ${escapeHtml(inv)}</p>
      <p><strong>Core approvers:</strong> ${escapeHtml((data.brief.approvers_core || []).join(", ") || "(none)")}</p>
      <p><strong>Abort checklist:</strong></p>
      <ul>${qs}</ul>
    `;
  } else {
    briefEl.classList.add("hidden");
    briefEl.innerHTML = "";
  }
});

async function boot() {
  setAskEnabled(false);
  const health = await fetch("/api/health").then((r) => r.json());
  if (health.product !== "forge") showError("This port is not serving Forge.");

  const presets = await fetch("/api/presets").then((r) => r.json());
  presetsEl.innerHTML = "";
  for (const p of presets.presets || []) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip";
    btn.textContent = p.label;
    btn.title = p.note || "";
    btn.addEventListener("click", async () => {
      repoEl.value = p.id;
      try {
        await bindRepo(p.id);
      } catch (err) {
        showError(String(err?.message || err));
      }
    });
    presetsEl.appendChild(btn);
  }

  const examples = await fetch("/api/examples").then((r) => r.json());
  samplesEl.innerHTML = "";
  for (const ex of examples.examples || []) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip";
    btn.textContent = ex.label;
    btn.addEventListener("click", () => {
      askEl.value = ex.ask;
    });
    samplesEl.appendChild(btn);
  }
}

boot().catch((err) => showError(String(err?.message || err)));
