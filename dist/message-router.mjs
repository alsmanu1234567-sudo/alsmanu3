// dist/message-router.mjs — Message Routing Registry & Entry Point
// المسؤولية الوحيدة: تسجيل الـ handlers وتوجيه الرسائل حسب نوعها.

let _logger = { info: ()=>{}, warn: ()=>{} };
let _messageHandler  = null;  // handleTextMessage — رسائل النص
let _paymentHandler  = null;  // successful_payment
let _mediaHandler    = null;  // photo / video
let _documentHandler = null;  // document (بدون نص)

export function setDeps(d) {
  if (d.logger) _logger = d.logger;
}

const _modules = new Map();  // module name → module reference (observability)

// ─── تسجيل الـ Handlers ────────────────────────────────────────────────────

export function setMessageHandler(fn) {
  _messageHandler = fn;
  _logger.info({ handler: fn?.name || 'anonymous' }, 'Router: text message handler registered');
}

export function setPaymentHandler(fn) {
  _paymentHandler = fn;
  _logger.info({ handler: fn?.name || 'anonymous' }, 'Router: payment handler registered');
}

export function setMediaHandler(fn) {
  _mediaHandler = fn;
  _logger.info({ handler: fn?.name || 'anonymous' }, 'Router: media handler registered');
}

export function setDocumentHandler(fn) {
  _documentHandler = fn;
  _logger.info({ handler: fn?.name || 'anonymous' }, 'Router: document handler registered');
}

// ─── توجيه شامل لجميع أنواع الرسائل ─────────────────────────────────────────

export async function routeMessage(bot, msg) {
  // 1. successful_payment — لا يحتاج subscription check
  if (msg.successful_payment) {
    if (_paymentHandler) {
      await _paymentHandler(bot, msg);
      return true;
    }
    _logger.warn('Router: no payment handler — payment message dropped');
    return false;
  }

  // 2. photo / video — state-based (status upload)
  if (msg.photo || msg.video) {
    if (_mediaHandler) {
      const handled = await _mediaHandler(bot, msg);
      if (handled) return true;
    }
    return false;
  }

  // 3. document بدون نص — state-based (JSON import)
  if (msg.document && !msg.text) {
    if (!_documentHandler) {
      _logger.warn('Router: no document handler — document message dropped');
      return false;
    }
    await _documentHandler(bot, msg);
    return true;
  }

  // 4. رسائل بدون نص (sticker, voice, …) — لا handler
  if (!msg.text) return false;

  // 5. رسائل نصية → handleTextMessage
  if (!_messageHandler) {
    _logger.warn('Router: no text message handler registered — message dropped');
    return false;
  }
  await _messageHandler(bot, msg);
  return true;
}

// ─── تسجيل الوحدات (للـ Observability فقط) ──────────────────────────────────

export function registerModule(name, mod) {
  _modules.set(name, mod);
  _logger.info({ module: name }, 'Module registered in router');
}

export function getModule(name) {
  return _modules.get(name);
}

export function getRegisteredModules() {
  return Array.from(_modules.keys());
}

// ─── إحصائيات ─────────────────────────────────────────────────────────────

export function getStats() {
  return {
    modules:            _modules.size,
    hasMessageHandler:  !!_messageHandler,
    hasPaymentHandler:  !!_paymentHandler,
    hasMediaHandler:    !!_mediaHandler,
    hasDocumentHandler: !!_documentHandler,
  };
}
