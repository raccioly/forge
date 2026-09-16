/**
 * Forge change-class classifier (v0, rule-based).
 * Input: feedback text + optional parsed core.yaml
 * Output: class + rationale + allowed next step
 */

const CORE_KEYWORDS = [
  /\bauth(entication|orization)?\b/i,
  /\btenanc(y|ies)\b/i,
  /\bbilling\b/i,
  /\bentrypoint\b/i,
  /\bzero[- ]deps?\b/i,
  /\bruntime dependenc/i,
  /\badd(ing)? (several |many |new )?dependenc/i,
  /\bbreaking change\b/i,
  /\brewrite\b/i,
  /\bshared schema\b/i,
  /\bmulti[- ]team\b/i,
];

const BEHAVIORAL_KEYWORDS = [
  /\bby default\b/i,
  /\bdefault (to|is|becomes|output|format|behavior)\b/i,
  /\bchange(s|d)? (the )?default\b/i,
  /\binstead of\b/i,
  /\breplace (the )?old\b/i,
  /\bmigrate\b/i,
  /\brename\b/i,
  /\bexisting (feature|command|api|endpoint|behavior|users?)\b/i,
  /\bbreak(s|ing)? (existing|compat)/i,
  /\bbackwards?[- ]incompat/i,
];

const ADDITIVE_KEYWORDS = [
  /\badd( a| an| new)?\b/i,
  /\bnew (page|docs?|example|template|flag|endpoint|screen|command)\b/i,
  /\bcookbook\b/i,
  /\boptional flag\b/i,
  /\bbehind (a )?feature flag\b/i,
  /\bdoesn'?t change (the )?cli\b/i,
  /\bdon'?t change (the )?cli\b/i,
  /\bwithout changing\b/i,
];

const NEXT = {
  Additive:
    "Forge may clarify → plan → implement on a branch → open a PR.",
  Behavioral:
    "Clarify hard and wait for a Behavioral approver before any code.",
  Core:
    "Refuse to implement. Open a human review brief only (no implementation PR unless Core approvers re-scope).",
};

function globToRegExp(glob) {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "{{GLOBSTAR}}")
    .replace(/\*/g, "[^/]*")
    .replace(/{{GLOBSTAR}}/g, ".*");
  return new RegExp(escaped.replace(/\/\.\*$/, "(/.*)?").replace(/^\.\*/, ".*"), "i");
}

function pathMentioned(ask, pathGlob) {
  const bare = pathGlob.replace(/\/\*\*$/, "/").replace(/\*\*/g, "").replace(/\*/g, "");
  if (bare && ask.toLowerCase().includes(bare.toLowerCase().replace(/\/$/, ""))) {
    return true;
  }
  // Also try matching tokens that look like paths in the ask
  const pathLike = ask.match(/[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.*-]+)+/g) || [];
  const re = globToRegExp(pathGlob);
  return pathLike.some((p) => re.test(p));
}

function hintPathMatch(ask, pathGlob) {
  return pathMentioned(ask, pathGlob);
}

/**
 * @param {string} ask
 * @param {object|null} core
 * @returns {{
 *   class: 'Additive'|'Behavioral'|'Core',
 *   rationale: string,
 *   allowed_next_step: string,
 *   matched: { protected_paths: string[], invariants: string[], signals: string[] },
 *   core_present: boolean,
 *   approvers: { behavioral: string[], core: string[] }
 * }}
 */
export function classify(ask, core = null) {
  const text = (ask || "").trim();
  if (!text) {
    return {
      class: "Behavioral",
      rationale: "Empty ask — default to Behavioral until clarified.",
      allowed_next_step: NEXT.Behavioral,
      matched: { protected_paths: [], invariants: [], signals: ["empty-ask"] },
      core_present: Boolean(core),
      approvers: core?.approvers || { behavioral: [], core: [] },
    };
  }

  const matched = {
    protected_paths: [],
    invariants: [],
    signals: [],
  };

  const corePresent = Boolean(core);

  if (core?.protected_paths?.length) {
    for (const entry of core.protected_paths) {
      if (entry.path && pathMentioned(text, entry.path)) {
        matched.protected_paths.push(entry.path);
      }
    }
  }

  if (core?.invariants?.length) {
    for (const inv of core.invariants) {
      const idHit = inv.id && new RegExp(`\\b${inv.id.replace(/[-_]/g, '[-_]?')}\\b`, "i").test(text);
      const summaryHit =
        inv.summary &&
        inv.summary
          .split(/\s+/)
          .filter((w) => w.length > 5)
          .some((w) => text.toLowerCase().includes(w.toLowerCase()));
      // Prefer keyword overlap with invariant themes
      const themeHit =
        (/dependenc/i.test(inv.id + inv.summary) && /dependenc/i.test(text)) ||
        (/bin|entrypoint|cli/i.test(inv.id + inv.summary) &&
          /\b(bin|entrypoint)\b/i.test(text)) ||
        (/node|engines/i.test(inv.id + inv.summary) && /\b(engines?|node\s*18)\b/i.test(text));
      if (idHit || themeHit) {
        matched.invariants.push(inv.id);
      } else if (summaryHit && /dependenc|entrypoint|bin|engines|zero/i.test(inv.id + inv.summary)) {
        matched.invariants.push(inv.id);
      }
    }
  }

  for (const re of CORE_KEYWORDS) {
    if (re.test(text)) matched.signals.push(`core-keyword:${re.source}`);
  }
  for (const re of BEHAVIORAL_KEYWORDS) {
    if (re.test(text)) matched.signals.push(`behavioral-keyword:${re.source}`);
  }
  for (const re of ADDITIVE_KEYWORDS) {
    if (re.test(text)) matched.signals.push(`additive-keyword:${re.source}`);
  }

  let additiveHintHit = false;
  if (core?.additive_hints?.length) {
    for (const hint of core.additive_hints) {
      for (const p of hint.paths || []) {
        if (hintPathMatch(text, p)) {
          additiveHintHit = true;
          matched.signals.push(`additive-hint:${p}`);
        }
      }
    }
  }

  // Decision order: Core → Behavioral → Additive → default
  if (matched.protected_paths.length || matched.invariants.length) {
    const bits = [];
    if (matched.protected_paths.length) {
      bits.push(`touches protected path(s): ${matched.protected_paths.join(", ")}`);
    }
    if (matched.invariants.length) {
      bits.push(`threatens invariant(s): ${matched.invariants.join(", ")}`);
    }
    return {
      class: "Core",
      rationale: bits.join("; ") + ".",
      allowed_next_step: NEXT.Core,
      matched,
      core_present: corePresent,
      approvers: core?.approvers || { behavioral: [], core: [] },
    };
  }

  // Strong core keywords without path match still escalate when they imply contract breakage
  const strongCore = matched.signals.some((s) =>
    s.startsWith("core-keyword:") &&
    /dependenc|entrypoint|rewrite|breaking|tenanc|billing|auth|zero/i.test(s)
  );
  if (strongCore && /\b(move|rewrite|add.+dependenc|breaking)\b/i.test(text)) {
    return {
      class: "Core",
      rationale:
        "Ask signals Core-risk themes (entrypoint/deps/breaking rewrite) even without an exact protected_paths hit.",
      allowed_next_step: NEXT.Core,
      matched,
      core_present: corePresent,
      approvers: core?.approvers || { behavioral: [], core: [] },
    };
  }

  const behavioralHit = matched.signals.some((s) => s.startsWith("behavioral-keyword:"));
  if (behavioralHit) {
    return {
      class: "Behavioral",
      rationale:
        "Ask changes how an existing feature behaves (defaults, replacements, migrations, or existing contracts).",
      allowed_next_step: NEXT.Behavioral,
      matched,
      core_present: corePresent,
      approvers: core?.approvers || { behavioral: [], core: [] },
    };
  }

  const additiveHit = matched.signals.some((s) => s.startsWith("additive-keyword:"));
  if (additiveHit && (additiveHintHit || /\b(docs?|examples?|templates?|benchmarks?|cookbook|optional)\b/i.test(text))) {
    return {
      class: "Additive",
      rationale: additiveHintHit
        ? "Ask is framed as new/additive work under additive_hints paths (or clearly docs/examples) without changing existing behavior."
        : "Ask is framed as new/additive work without signals that existing behavior changes.",
      allowed_next_step: NEXT.Additive,
      matched,
      core_present: corePresent,
      approvers: core?.approvers || { behavioral: [], core: [] },
    };
  }

  if (additiveHit && !behavioralHit) {
    return {
      class: "Additive",
      rationale:
        "Ask looks Additive (new capability language) with no Behavioral/Core signals. Confirm it does not change defaults or existing contracts.",
      allowed_next_step: NEXT.Additive,
      matched,
      core_present: corePresent,
      approvers: core?.approvers || { behavioral: [], core: [] },
    };
  }

  // Missing core.yaml or unclear → Behavioral (safe default)
  return {
    class: "Behavioral",
    rationale: corePresent
      ? "Unclear ask — default to Behavioral until proven Additive (per change policy)."
      : "No core.yaml provided — treat target as Behavioral (no silent auto-ship).",
    allowed_next_step: NEXT.Behavioral,
    matched,
    core_present: corePresent,
    approvers: core?.approvers || { behavioral: [], core: [] },
  };
}

export { NEXT };
