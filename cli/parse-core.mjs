/**
 * Minimal subset parser for Forge core.yaml (v1 shape).
 * Zero dependencies — only the fields Forge classify needs.
 */

function stripComment(line) {
  let out = "";
  let quote = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quote) {
      out += ch;
      if (ch === quote && line[i - 1] !== "\\") quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      out += ch;
      continue;
    }
    if (ch === "#") break;
    out += ch;
  }
  return out.trimEnd();
}

function unquote(value) {
  const v = value.trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    return v.slice(1, -1);
  }
  if (/^-?\d+$/.test(v)) return Number(v);
  if (v === "true") return true;
  if (v === "false") return false;
  return v;
}

/**
 * @param {string} text
 */
export function parseCoreYaml(text) {
  const lines = text.split(/\r?\n/).map(stripComment);
  const result = {
    approvers: { behavioral: [], core: [] },
    invariants: [],
    protected_paths: [],
    additive_hints: [],
  };

  /** @type {string|null} */
  let section = null;
  let currentObj = null;
  let additive = null;
  let inAdditivePaths = false;

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) continue;

    const indent = line.match(/^\s*/)[0].length;
    const trimmed = line.trim();

    if (indent === 0 && trimmed.includes(":")) {
      const idx = trimmed.indexOf(":");
      const key = trimmed.slice(0, idx).trim();
      const rest = trimmed.slice(idx + 1).trim();
      section = null;
      currentObj = null;
      additive = null;
      inAdditivePaths = false;

      if (key === "version") result.version = Number(unquote(rest));
      else if (key === "product") result.product = String(unquote(rest));
      else if (key === "default_branch")
        result.default_branch = String(unquote(rest));
      else if (key === "approvers") section = "approvers";
      else if (key === "invariants") section = "invariants";
      else if (key === "protected_paths") section = "protected_paths";
      else if (key === "additive_hints") section = "additive_hints";
      continue;
    }

    if (
      (section === "approvers" ||
        section === "approvers.behavioral" ||
        section === "approvers.core") &&
      indent === 2 &&
      trimmed.includes(":") &&
      !trimmed.startsWith("- ")
    ) {
      const idx = trimmed.indexOf(":");
      const key = trimmed.slice(0, idx).trim();
      if (key === "behavioral") section = "approvers.behavioral";
      else if (key === "core") section = "approvers.core";
      continue;
    }

    if (
      (section === "approvers.behavioral" || section === "approvers.core") &&
      trimmed.startsWith("- ")
    ) {
      const name = String(unquote(trimmed.slice(2)));
      if (section === "approvers.behavioral") result.approvers.behavioral.push(name);
      else result.approvers.core.push(name);
      continue;
    }

    if (section === "invariants") {
      if (trimmed.startsWith("- ")) {
        currentObj = { id: "", summary: "" };
        result.invariants.push(currentObj);
        const rest = trimmed.slice(2).trim();
        if (rest.includes(":")) {
          const idx = rest.indexOf(":");
          const k = rest.slice(0, idx).trim();
          const v = rest.slice(idx + 1).trim();
          if (k === "id" || k === "summary") currentObj[k] = String(unquote(v));
        }
        continue;
      }
      if (currentObj && indent >= 4 && trimmed.includes(":")) {
        const idx = trimmed.indexOf(":");
        const k = trimmed.slice(0, idx).trim();
        const v = trimmed.slice(idx + 1).trim();
        if (k === "id" || k === "summary") currentObj[k] = String(unquote(v));
      }
      continue;
    }

    if (section === "protected_paths") {
      if (trimmed.startsWith("- ")) {
        currentObj = { path: "", reason: "" };
        result.protected_paths.push(currentObj);
        const rest = trimmed.slice(2).trim();
        if (rest.includes(":")) {
          const idx = rest.indexOf(":");
          const k = rest.slice(0, idx).trim();
          const v = rest.slice(idx + 1).trim();
          if (k === "path" || k === "reason") currentObj[k] = String(unquote(v));
        }
        continue;
      }
      if (currentObj && indent >= 4 && trimmed.includes(":")) {
        const idx = trimmed.indexOf(":');
        const k = trimmed.slice(0, idx).trim();
        const v = trimmed.slice(idx + 1).trim();
        if (k === "path" || k === "reason") currentObj[k] = String(unquote(v));
      }
      continue;
    }

    if (section === "additive_hints") {
      // New hint object: "- paths:" or "- notes: ..."
      if (indent === 2 && trimmed.startsWith("- ")) {
        additive = { paths: [], notes: undefined };
        result.additive_hints.push(additive);
        inAdditivePaths = false;
        const rest = trimmed.slice(2).trim();
        if (rest === "paths:" || rest.startsWith("paths:")) {
          inAdditivePaths = true;
          const inline = rest.slice("paths:".length).trim();
          if (inline) additive.paths.push(String(unquote(inline)));
        } else if (rest.startsWith("notes:")) {
          additive.notes = String(unquote(rest.slice("notes:".length)));
        }
        continue;
      }

      if (!additive) continue;

      if (trimmed === "paths:" || trimmed.startsWith("paths:")) {
        inAdditivePaths = true;
        const inline = trimmed.slice("paths:".length).trim();
        if (inline) additive.paths.push(String(unquote(inline)));
        continue;
      }

      if (trimmed.startsWith("notes:")) {
        inAdditivePaths = false;
        additive.notes = String(unquote(trimmed.slice("notes:".length)));
        continue;
      }

      if (inAdditivePaths && trimmed.startsWith("- ")) {
        additive.paths.push(String(unquote(trimmed.slice(2))));
        continue;
      }
    }
  }

  return result;
}
