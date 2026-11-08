// dist/plugins/plugin-registry.mjs
// Phase 11: Plugin Registry — مسؤول فقط عن Registration / Lookup / Discovery / Validation / Metadata / Statistics
// لا يحتوي أي Dispatch Logic أو Business Logic

const _plugins = new Map();  // name → PluginEntry

// ─── Registration ────────────────────────────────────────────────────────────

export function register(name, module, manifest) {
  if (_plugins.has(name)) {
    throw new Error(`Plugin '${name}' is already registered`);
  }
  _plugins.set(name, {
    name,
    module,
    manifest: { ...manifest },
    health: { status: 'healthy', errors: [], lastCheck: new Date() },
    enabled: manifest.enabled !== false,
    loadedAt: new Date(),
  });
}

export function unregister(name) {
  return _plugins.delete(name);
}

// ─── Lookup ───────────────────────────────────────────────────────────────────

export function get(name) {
  return _plugins.get(name) || null;
}

export function has(name) {
  return _plugins.has(name);
}

// ─── Discovery ───────────────────────────────────────────────────────────────

export function getAll() {
  return Array.from(_plugins.values());
}

export function getEnabled() {
  return Array.from(_plugins.values()).filter(p => p.enabled);
}

export function getByType(type) {
  return Array.from(_plugins.values()).filter(p => p.manifest.type === type);
}

export function getNames() {
  return Array.from(_plugins.keys());
}

// ─── Enable / Disable ────────────────────────────────────────────────────────

export function enable(name) {
  const entry = _plugins.get(name);
  if (!entry) return false;
  entry.enabled = true;
  return true;
}

export function disable(name) {
  const entry = _plugins.get(name);
  if (!entry) return false;
  entry.enabled = false;
  return true;
}

// ─── Health ──────────────────────────────────────────────────────────────────

export function setHealth(name, status, error = null) {
  const entry = _plugins.get(name);
  if (!entry) return;
  entry.health.status = status;
  entry.health.lastCheck = new Date();
  if (error) {
    entry.health.errors.unshift(`[${new Date().toISOString()}] ${error}`);
    if (entry.health.errors.length > 10) entry.health.errors.pop();
  }
}

export function getHealth(name) {
  const entry = _plugins.get(name);
  return entry ? { ...entry.health } : null;
}

// ─── Validation ──────────────────────────────────────────────────────────────

export function validate(module, manifest) {
  if (!manifest || typeof manifest !== 'object') {
    return { ok: false, reason: 'pluginManifest is missing or not an object' };
  }
  if (!manifest.name || typeof manifest.name !== 'string') {
    return { ok: false, reason: 'manifest.name is required (string)' };
  }
  if (!manifest.type || typeof manifest.type !== 'string') {
    return { ok: false, reason: 'manifest.type is required (string)' };
  }
  if (typeof manifest.textOrder !== 'number' && typeof manifest.cbOrder !== 'number') {
    return { ok: false, reason: 'manifest must declare textOrder or cbOrder (number)' };
  }
  if (typeof module.handleText !== 'function' && typeof module.handleCallback !== 'function') {
    return { ok: false, reason: 'module must export handleText() or handleCallback()' };
  }
  if (typeof module.setDeps !== 'function') {
    return { ok: false, reason: 'module must export setDeps()' };
  }
  return { ok: true };
}

// ─── Metadata ────────────────────────────────────────────────────────────────

export function getMetadata(name) {
  const entry = _plugins.get(name);
  if (!entry) return null;
  return {
    name: entry.name,
    manifest: { ...entry.manifest },
    enabled: entry.enabled,
    health: { ...entry.health },
    loadedAt: entry.loadedAt,
  };
}

// ─── Statistics ───────────────────────────────────────────────────────────────

export function getStats() {
  const all = Array.from(_plugins.values());
  const healthy  = all.filter(p => p.health.status === 'healthy').length;
  const degraded = all.filter(p => p.health.status === 'degraded').length;
  const failed   = all.filter(p => p.health.status === 'failed').length;
  return {
    total:    all.length,
    enabled:  all.filter(p => p.enabled).length,
    disabled: all.filter(p => !p.enabled).length,
    healthy,
    degraded,
    failed,
    names:    all.map(p => p.name),
  };
}
