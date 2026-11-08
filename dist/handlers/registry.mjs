// dist/handlers/registry.mjs
// Phase 5: Handler Registry — auto-registration & unified dispatch
// Phase 11: Plugin Platform — إعادة تصميم كامل باستخدام Plugin Loader + Plugin Registry
//           المسؤولية الوحيدة: تسجيل الـ plugins + توزيع الـ dispatch
//           الـ Metadata / Health / Enable / Disable منفصلة في plugin-registry.mjs + plugin-loader.mjs

import * as _sys    from './system-handler.mjs';
import * as _dl     from './download-handler.mjs';
import * as _link   from './linking-handler.mjs';
import * as _ar     from './auto-reply-handler.mjs';
import * as _pts    from './points-handler.mjs';
import * as _grp    from './groups-handler.mjs';
import * as _ai     from './ai-handler.mjs';
import * as _per    from './persons-handler.mjs';
import * as _br     from './bridge-handler.mjs';
import * as _sec    from './security-handler.mjs';
import * as _dev    from './developer-handler.mjs';
import * as _num    from './numbers-handler.mjs';
import * as _sta    from './status-handler.mjs';
import * as _cal    from './calls-handler.mjs';
import * as _rep    from './reports-handler.mjs';
import * as _sch    from './schedule-handler.mjs';
import * as _msgs   from './msgs-handler.mjs';
import * as _gh     from './github-handler.mjs';
import * as _sitegen from './sitegen-handler.mjs';

import * as _loader from '../plugins/plugin-loader.mjs';

// ─── Auto-Registration عند تحميل الوحدة ──────────────────────────────────────
// Plugin Loader يتحقق من pluginManifest لكل وحدة ويسجّلها في Plugin Registry
// الترتيب الفعلي في dispatch مُحدَّد من manifest.textOrder و manifest.cbOrder

_loader.loadAll([
  _sys, _dl, _link, _ar, _pts, _grp, _ai, _per,
  _br, _sec, _dev, _num, _sta, _cal, _rep, _sch, _msgs, _gh, _sitegen,
]);

let _mergedDeps = {};

// ─── Dependency Injection ─────────────────────────────────────────────────────

/**
 * يدمج الـ deps الواردة مع السابقة ويُوزّعها على جميع الـ plugins المسجَّلة.
 * يُستدعى من text-handler وcallback-handler — الدمج يضمن وصول الجميع لكل الـ deps.
 */
export function setDepsAll(d) {
  _mergedDeps = { ..._mergedDeps, ...d };
  _loader.distributeDeps(_mergedDeps);
}

// ─── Dispatch ─────────────────────────────────────────────────────────────────

/**
 * توجيه رسالة نصية — يُعيد true عند أول معالج ناجح.
 * الترتيب: ascending textOrder من pluginManifest لكل plugin مُفعَّلة.
 */
export async function dispatchText(bot, msg) {
  for (const { module: h, manifest } of _loader.getTextHandlers()) {
    if (typeof h.handleText !== 'function') continue;
    try {
      const handled = await h.handleText(bot, msg);
      if (handled) return true;
    } catch (e) {
      _loader.recordError(manifest.name, String(e));
    }
  }
  return false;
}

/**
 * توجيه callback — يُعيد true عند أول معالج ناجح.
 * الترتيب: ascending cbOrder من pluginManifest لكل plugin مُفعَّلة.
 */
export async function dispatchCallback(bot, query) {
  for (const { module: h, manifest } of _loader.getCbHandlers()) {
    if (typeof h.handleCallback !== 'function') continue;
    try {
      const handled = await h.handleCallback(bot, query);
      if (handled) return true;
    } catch (e) {
      _loader.recordError(manifest.name, String(e));
    }
  }
  return false;
}

// ─── Statistics & Plugin Lifecycle ───────────────────────────────────────────

export function getStats() {
  return _loader.getStats();
}

export function getHealthReport() {
  return _loader.getHealthReport();
}

export function enablePlugin(name) {
  return _loader.enablePlugin(name);
}

export function disablePlugin(name) {
  return _loader.disablePlugin(name);
}
