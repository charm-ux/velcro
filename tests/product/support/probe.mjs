// The inherited-API probe's in-page measurement. makeProbe is serialized into the page (it must not close over anything), so
// the spec and the negative controls in probe.spec.mjs run exactly the same code.
export function makeProbe(host) {
  const nodes = () => {
    const out = [host, ...host.children];
    const walk = root => { for (const el of root.querySelectorAll('*')) { out.push(el); if (el.shadowRoot) walk(el.shadowRoot); } };
    walk(host.shadowRoot);
    return out;
  };
  // Every computed value of every node (custom properties excluded), as a flat array. The node list and each node's property
  // list are read once per snapshot, not once per value.
  const snapshot = () => {
    const out = [];
    for (const el of nodes()) {
      const cs = getComputedStyle(el);
      for (let i = 0; i < cs.length; i++) {
        const p = cs[i];
        if (p.charCodeAt(0) !== 45 || p.charCodeAt(1) !== 45) out.push(cs.getPropertyValue(p));
      }
    }
    return out;
  };
  const differs = (a, b) => {
    if (a.length !== b.length) return true;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return true;
    return false;
  };
  return {
    // Independent measurement: each candidate is set alone to each value in turn and listed when any computed style in the
    // tree changes (stopping at its first changing value). getComputedStyle recalculates synchronously, so the current state
    // (including a held pointer) is measured as is. No candidate is ever skipped on the strength of another's result.
    measure(candidates, values) {
      const base = snapshot();
      const hit = [];
      for (const name of candidates) {
        for (const v of values) {
          host.style.setProperty(name, v);
          const changed = differs(snapshot(), base);
          host.style.removeProperty(name);
          if (changed) { hit.push(name); break; }
        }
      }
      return hit;
    },
  };
}
