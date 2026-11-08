// dist/plugins/plugin-loader.mjs
// Phase 11: Plugin Loader — مسؤول عن Auto-Discovery / Validation / Loading / Registration /
//           Dependency Resolution / Health Check / Enable / Disable / Reload / Unload /
//           Isolation / Error Recovery
// يعتمد على plugin-registry.mjs كطبقة metadata خالصة.

import * as _reg from './plugin-registry.mjs';
import { readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

let _logger = {
  info:  (obj, msg) => {},
  warn:  (obj, msg) => {},
  error: (obj, msg) => {},
};

export function setLogger(logger) {
  _logger = logger;
}

// ─── Loading & Registration ────────────────────────────────────────────────────

/**
 * تحقق من الوحدة وسجّلها في Plugin Registry.
 * يُرجع { ok, name, reason } — لا يرمي استثناء أبداً (Error Isolation).
 */
export function loadPlugin(module) {
  try {
    const manifest = module.pluginManifest;
    const validation = _reg.validate(module, manifest);
    if (!validation.ok) {
      _logger.warn({ reason: validation.reason }, `PluginLoader: skipping invalid plugin`);
      return { ok: false, reason: validation.reason };
    }
    const { name } = manifest;
    if (_reg.has(name)) {
      _logger.warn({ name }, 'PluginLoader: plugin already registered — skipping');
      return { ok: false, name, reason: 'already registered' };
    }
    _reg.register(name, module, manifest);
    _logger.info({ name, type: manifest.type }, 'PluginLoader: plugin registered');
    return { ok: true, name };
  } catch (e) {
    _logger.error({ err: String(e) }, 'PluginLoader: unexpected error during loadPlugin');
    return { ok: false, reason: String(e) };
  }
}

/**
 * تحميل مجموعة وحدات دفعةً واحدة — Error Isolation لكل وحدة.
 * يُرجع { loaded, skipped, failed }
 */
export function loadAll(modules) {
  let loaded = 0, skipped = 0, failed = 0;
  for (const mod of modules) {
    const result = loadPlugin(mod);
    if (result.ok)                         loaded++;
    else if (result.reason === 'already registered') skipped++;
    else                                   failed++;
  }
  _logger.info({ loaded, skipped, failed }, 'PluginLoader: loadAll complete');
  return { loaded, skipped, failed };
}

// ─── Auto Discovery ────────────────────────────────────────────────────────────

/**
 * يفحص مجلدًا تلقائيًا ويُحمِّل كل ملف *-handler.mjs يحتوي pluginManifest.
 * يُستخدم للـ Hot Reload أو إضافة plugins جديدة دون تعديل الـ registry.
 * يُرجع { discovered, loaded, skipped, failed }
 */
export async function discover(handlersDir) {
  let discovered = 0, loaded = 0, skipped = 0, failed = 0;
  let files;
  try {
    files = await readdir(handlersDir);
  } catch (e) {
    _logger.error({ dir: handlersDir, err: String(e) }, 'PluginLoader: cannot read handlers dir');
    return { discovered: 0, loaded: 0, skipped: 0, failed: 0 };
  }

  const handlerFiles = files.filter(f => f.endsWith('-handler.mjs'));

  for (const file of handlerFiles) {
    const filePath = join(handlersDir, file);
    try {
      const mod = await import(filePath);
      if (!mod.pluginManifest) continue;  // ليس plugin — تخطَّ
      discovered++;
      const result = loadPlugin(mod);
      if (result.ok)                              loaded++;
      else if (result.reason === 'already registered') skipped++;
      else                                        failed++;
    } catch (e) {
      failed++;
      _logger.error({ file, err: String(e) }, 'PluginLoader: error importing plugin file');
    }
  }

  _logger.info({ discovered, loaded, skipped, failed }, 'PluginLoader: discover complete');
  return { discovered, loaded, skipped, failed };
}

// ─── Dispatch Arrays ──────────────────────────────────────────────────────────

/**
 * يُرجع قائمة الـ plugins المفعَّلة المرتَّبة لمعالجة النصوص (ascending textOrder).
 */
export function getTextHandlers() {
  return _reg.getEnabled()
    .filter(p => typeof p.manifest.textOrder === 'number' && p.manifest.textOrder > 0)
    .sort((a, b) => a.manifest.textOrder - b.manifest.textOrder)
    .map(p => ({ module: p.module, manifest: p.manifest }));
}

/**
 * يُرجع قائمة الـ plugins المفعَّلة المرتَّبة لمعالجة الـ callbacks (ascending cbOrder).
 */
export function getCbHandlers() {
  return _reg.getEnabled()
    .filter(p => typeof p.manifest.cbOrder === 'number' && p.manifest.cbOrder > 0)
    .sort((a, b) => a.manifest.cbOrder - b.manifest.cbOrder)
    .map(p => ({ module: p.module, manifest: p.manifest }));
}

// ─── Dependency Injection ─────────────────────────────────────────────────────

/**
 * يوزِّع الـ deps على جميع الـ plugins المحمَّلة (مكررات مُزالة).
 */
export function distributeDeps(deps) {
  const all = _reg.getAll();
  for (const entry of all) {
    if (typeof entry.module.setDeps === 'function') {
      entry.module.setDeps(deps);
    }
  }
}

// ─── Health ───────────────────────────────────────────────────────────────────

export function recordError(name, errorMsg) {
  _reg.setHealth(name, 'degraded', errorMsg);
  _logger.warn({ name, error: errorMsg }, 'PluginLoader: plugin error recorded');
}

export function markHealthy(name) {
  _reg.setHealth(name, 'healthy');
}

export function markFailed(name, errorMsg) {
  _reg.setHealth(name, 'failed', errorMsg);
  _logger.error({ name, error: errorMsg }, 'PluginLoader: plugin marked as failed');
}

export function getHealthReport() {
  return _reg.getAll().map(p => ({
    name:    p.name,
    enabled: p.enabled,
    status:  p.health.status,
    errors:  p.health.errors.slice(0, 3),
    loadedAt: p.loadedAt,
  }));
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

export function enablePlugin(name) {
  const ok = _reg.enable(name);
  if (ok) _logger.info({ name }, 'PluginLoader: plugin enabled');
  return ok;
}

export function disablePlugin(name) {
  const ok = _reg.disable(name);
  if (ok) _logger.info({ name }, 'PluginLoader: plugin disabled');
  return ok;
}

/**
 * Unload: يُزيل Plugin من الـ Registry.
 * لا يُزيل الـ module من ذاكرة Node.js (ESM caching) — يمنع dispatch فقط.
 */
export function unloadPlugin(name) {
  const ok = _reg.unregister(name);
  if (ok) _logger.info({ name }, 'PluginLoader: plugin unloaded');
  return ok;
}

/**
 * Reload: يُزيل ويُعيد تسجيل Plugin بالـ module نفسه أو بـ module جديد.
 * Note: true hot-reload (swap module code) محدود بـ ESM caching في Node.js.
 */
export function reloadPlugin(name, newModule) {
  const entry = _reg.get(name);
  if (!entry) return { ok: false, reason: `plugin '${name}' not found` };
  const moduleToLoad = newModule || entry.module;
  _reg.unregister(name);
  const result = loadPlugin(moduleToLoad);
  if (result.ok) {
    _logger.info({ name }, 'PluginLoader: plugin reloaded');
  }
  return result;
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export function getStats() {
  return _reg.getStats();
}
