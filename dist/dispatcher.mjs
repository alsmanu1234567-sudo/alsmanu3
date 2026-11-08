// dist/dispatcher.mjs — Callback / Event Dispatcher & Entry Point
// المسؤولية الوحيدة: تسجيل prefix → handler وتوجيه الـ callbacks عبر handler مسجَّل.

let _logger = { info: ()=>{}, warn: ()=>{} };
let _callbackHandler = null;  // الـ fallback الافتراضي لجميع الـ callbacks غير المُوجَّهة

export function setDeps(d) {
  if (d.logger) _logger = d.logger;
}

const _prefixHandlers = new Map();  // prefix string → handler fn

// ─── تسجيل وتوجيه الـ callbacks ──────────────────────────────────────────────

export function setCallbackHandler(fn) {
  _callbackHandler = fn;
  _logger.info({ handler: fn?.name || 'anonymous' }, 'Dispatcher: callback handler registered');
}

export async function routeCallback(bot, query) {
  if (!_callbackHandler) {
    _logger.warn('Dispatcher: no callback handler registered — query dropped');
    return false;
  }
  const data = query.data || '';
  return dispatch(data, bot, query);
}

// ─── تسجيل المعالِجات ──────────────────────────────────────────────────────

export function registerPrefix(prefix, handler) {
  _prefixHandlers.set(prefix, handler);
  _logger.info({ prefix }, 'Dispatcher: prefix handler registered');
}

// ─── استعراض ──────────────────────────────────────────────────────────────

export function getRegisteredPrefixes() {
  return Array.from(_prefixHandlers.keys());
}

export function getStats() {
  return {
    prefixes:           _prefixHandlers.size,
    hasCallbackHandler: !!_callbackHandler,
  };
}

// ─── توجيه (prefix → callbackHandler) ───────────────────────────────────────

export async function dispatch(data, ...args) {
  if (!data) return false;

  // تطابق prefix
  for (const [prefix, handler] of _prefixHandlers) {
    if (data.startsWith(prefix)) {
      await handler(data, ...args);
      return true;
    }
  }

  // fallback → callback handler المسجَّل
  if (_callbackHandler) {
    await _callbackHandler(...args);
    return true;
  }

  return false;
}
