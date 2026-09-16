const $ = (id) => document.getElementById(id);

const askEl = $("ask");
const coreEl = $("core");
const resultEl = $("result");
const errorEl = $("error");
const classBadge = $("class-badge");
const rationaleEl = $("rationale");
const nextEl = $("next");
const approversEl = $("approvers");
const briefEl = $("brief");
const coreFlag = $("core-flag");
const samplesEl = $("samples");

function showError(msg) {
  errorEl.textContent = msg;
  errorEl.classList.remove("hidden");
  resultEl.classList.add("hidden");
}

function clearError() {
  errorEl.classList.add("hidden");
  errorEl.textContent = "";
}

async function loadExamples() {
  const res = await fetch("/api/examples");
  const data = await res.json();
  samplesEl.innerHTML = "";
  for (const ex of data.examples || []) {
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

$("load-example").addEventListener("click", async () => {
  clearError();
  const res = await fetch("/api/example-core");
  if (!res.ok) return showError("Could not load example core.yaml");
  coreEl.value = await res.text();
});

$("clear-core").addEventListener("click", () => {
  coreEl.value = "";
});

$("classify").addEventListener("click", async () => {
  clearError();
  const ask = askEl.value;
  if (!ask.trim()) return showError("Enter some feedback first.");

  const body = { ask };
  if (coreEl.value.trim()) body.core_yaml = coreEl.value;

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
  rationaleEl.textContent = data.rationale;
  nextEl.textContent = data.allowed_next_step;
  coreFlag.textContent = data.core_present
    ? "core.yaml loaded"
    : "no core.yaml — Behavioral default if unclear";

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
      <p><strong>Humans should decide:</strong></p>
      <ul>${qs}</ul>
    `;
  } else {
    briefEl.classList.add("hidden");
    briefEl.innerHTML = "";
  }
});

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

loadExamples().catch((err) => showError(String(err?.message || err)));
