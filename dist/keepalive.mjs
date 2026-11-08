// dist/keepalive.mjs — Keepalive Watchdog Module
// Phase 3 extraction — src/bot/core/keepalive.ts
// [PATCH_KEEPALIVE_SPLIT_APPLIED]
// المسؤولية الوحيدة: مراقبة حياة البوت وإعادة تشغيله عند الجمود.

let _logger = {
  info:  (msg)       => console.log('[KA INFO]',  msg),
  warn:  (obj, msg)  => console.warn('[KA WARN]', msg ?? JSON.stringify(obj)),
  error: (obj, msg)  => console.error('[KA ERR]',  msg ?? JSON.stringify(obj)),
};

export function setDeps(d) {
  if (d.logger) _logger = d.logger;
}

let _restartFn        = null;
let _isAlive          = true;
let _heartbeatInterval = null;
let _watchdogInterval  = null;
let _lastHeartbeat    = Date.now();
let _restartCount     = 0;

// ─── API العام ────────────────────────────────────────────────────────────────

export function registerRestartFn(fn) {
  _restartFn = fn;
}

export function heartbeat() {
  _lastHeartbeat = Date.now();
}

export function startKeepalive() {
  if (_heartbeatInterval) clearInterval(_heartbeatInterval);
  if (_watchdogInterval)  clearInterval(_watchdogInterval);

  // نبضة كل 10 ثوانٍ
  _heartbeatInterval = setInterval(() => {
    heartbeat();
  }, 10_000);

  // مراقب كل 30 ثانية — إذا مرت دقيقة بلا نبضة → إعادة تشغيل
  _watchdogInterval = setInterval(async () => {
    const now     = Date.now();
    const elapsed = now - _lastHeartbeat;
    if (elapsed > 60_000 && _restartFn) {
      _logger.warn({ elapsed, restartCount: _restartCount }, 'Watchdog: bot seems unresponsive, restarting...');
      _restartCount++;
      try {
        await _restartFn();
      } catch (err) {
        _logger.error({ err }, 'Watchdog restart failed');
      }
    }
  }, 30_000);

  _logger.info('Keepalive watchdog started');
}

export function getKeepaliveStats() {
  return {
    lastHeartbeat:  new Date(_lastHeartbeat).toISOString(),
    restartCount:   _restartCount,
    uptimeSeconds:  Math.round(process.uptime()),
    memoryMB:       Math.round(process.memoryUsage().rss / 1024 / 1024),
    isAlive:        _isAlive,
  };
}
