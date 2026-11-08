// dist/worker-manager.mjs — Worker Manager Module
// Phase 3 extraction — src/bot/core/workers.ts
// [PATCH_WORKER_MANAGER_SPLIT_APPLIED]
// المسؤولية الوحيدة: إنشاء العمال وإيقافهم وإعادة تشغيلهم ومراقبتهم وجمع إحصائياتهم.
// يُهيَّأ عبر setDeps() — لا يستورد من dist/index.mjs مطلقاً.

let _logger = {
  info:  (obj, msg) => console.log('[WM INFO]',  msg ?? JSON.stringify(obj)),
  warn:  (obj, msg) => console.warn('[WM WARN]', msg ?? JSON.stringify(obj)),
  error: (obj, msg) => console.error('[WM ERR]',  msg ?? JSON.stringify(obj)),
};
let _inMemoryDB = { workerStatus: new Map() };

export function setDeps(d) {
  if (d.logger)      _logger      = d.logger;
  if (d.inMemoryDB)  _inMemoryDB  = d.inMemoryDB;
}

export class WorkerManager {
  workers            = new Map();
  restartTimers      = new Map();
  healthCheckStarted = false;
  reconnectCallbacks = new Map();
  globalReconnect    = null;

  constructor() {
    this.startGlobalHealthCheck();
  }

  // ─── تسجيل دالة إعادة الاتصال (تُستدعى من baileys-session) ───────────────
  registerReconnect(userId, cb) {
    this.reconnectCallbacks.set(userId, cb);
  }

  setGlobalReconnect(cb) {
    this.globalReconnect = cb;
  }

  unregisterReconnect(userId) {
    this.reconnectCallbacks.delete(userId);
  }

  // ─── دورة حياة العمال ─────────────────────────────────────────────────────
  createWorker(userId) {
    const worker = {
      userId,
      status: 'connecting',
      whatsappConnected: false,
      lastPing: new Date(),
      errors: [],
      restartCount: 0,
      memory: 0,
    };
    this.workers.set(userId, worker);
    _inMemoryDB.workerStatus.set(userId, worker);
    _logger.info({ userId }, 'Worker created');
    return worker;
  }

  getWorker(userId) {
    return this.workers.get(userId);
  }

  getOrCreateWorker(userId) {
    return this.workers.get(userId) || this.createWorker(userId);
  }

  setWorkerStatus(userId, status) {
    const worker = this.getOrCreateWorker(userId);
    worker.status   = status;
    worker.lastPing = new Date();
    this.workers.set(userId, worker);
    _inMemoryDB.workerStatus.set(userId, worker);
  }

  setWhatsAppConnected(userId, connected) {
    const worker = this.getOrCreateWorker(userId);
    worker.whatsappConnected = connected;
    worker.status   = connected ? 'running' : 'stopped';
    worker.lastPing = new Date();
    this.workers.set(userId, worker);
    _inMemoryDB.workerStatus.set(userId, worker);
  }

  addError(userId, error) {
    const worker = this.getOrCreateWorker(userId);
    worker.errors.unshift(`[${new Date().toISOString()}] ${error}`);
    if (worker.errors.length > 20) worker.errors.pop();
    worker.status = 'stopped';
    this.workers.set(userId, worker);
    this.scheduleRestart(userId);
  }

  // ─── إعادة التشغيل التلقائي بـ Exponential Back-off ──────────────────────
  scheduleRestart(userId, attempt = 0) {
    if (attempt >= 5) {
      const worker = this.getOrCreateWorker(userId);
      worker.status = 'maintenance';
      this.workers.set(userId, worker);
      _logger.warn({ userId }, 'Worker in maintenance mode after 5 failed restarts');
      return;
    }
    const delays  = [5_000, 15_000, 30_000, 60_000, 120_000];
    const delay   = delays[attempt] ?? 60_000;
    const existing = this.restartTimers.get(userId);
    if (existing) {
      clearTimeout(existing);
      this.restartTimers.delete(userId);
    }
    const timer = setTimeout(async () => {
      this.restartTimers.delete(userId);
      const worker = this.getOrCreateWorker(userId);
      if (worker.whatsappConnected) return;
      worker.status = 'connecting';
      worker.restartCount++;
      this.workers.set(userId, worker);
      _logger.info({ userId, attempt }, 'Worker auto-restarting WhatsApp session');
      try {
        const cb = this.reconnectCallbacks.get(userId) || this.globalReconnect;
        if (cb) {
          await cb(userId);
        } else {
          _logger.warn({ userId }, 'No reconnect callback registered — cannot auto-restart');
          this.scheduleRestart(userId, attempt + 1);
        }
      } catch (err) {
        _logger.error({ err, userId }, 'Auto-restart failed');
        this.scheduleRestart(userId, attempt + 1);
      }
    }, delay);
    this.restartTimers.set(userId, timer);
    _logger.info({ userId, attempt, delayMs: delay }, 'Scheduled WhatsApp restart');
  }

  stopWorker(userId) {
    const existing = this.restartTimers.get(userId);
    if (existing) {
      clearTimeout(existing);
      this.restartTimers.delete(userId);
    }
    const worker = this.getOrCreateWorker(userId);
    worker.status            = 'stopped';
    worker.whatsappConnected = false;
    this.workers.set(userId, worker);
  }

  // ─── فحص صحة عالمي كل 30 ثانية ──────────────────────────────────────────
  startGlobalHealthCheck() {
    if (this.healthCheckStarted) return;
    this.healthCheckStarted = true;
    setInterval(() => {
      const heapMb = process.memoryUsage().heapUsed / 1024 / 1024;
      for (const [, worker] of this.workers) {
        worker.memory = heapMb;
      }
    }, 30_000);
  }

  pingWorker(userId) {
    const worker = this.getOrCreateWorker(userId);
    worker.lastPing = new Date();
    this.workers.set(userId, worker);
  }

  // ─── إحصائيات ─────────────────────────────────────────────────────────────
  getAllWorkers() {
    return Array.from(this.workers.values());
  }

  getStats() {
    const all = this.getAllWorkers();
    return {
      total:       all.length,
      running:     all.filter(w => w.status === 'running').length,
      stopped:     all.filter(w => w.status === 'stopped').length,
      maintenance: all.filter(w => w.status === 'maintenance').length,
      connecting:  all.filter(w => w.status === 'connecting').length,
    };
  }

  restartWorker(userId) {
    const worker = this.getOrCreateWorker(userId);
    worker.status      = 'connecting';
    worker.errors      = [];
    worker.lastPing    = new Date();
    this.workers.set(userId, worker);
    _logger.info({ userId }, 'Worker manually restarted');
    const cb = this.reconnectCallbacks.get(userId) || this.globalReconnect;
    if (cb) {
      cb(userId).catch(err => _logger.error({ err, userId }, 'Manual restart callback failed'));
    }
  }
}

export const workerManager = new WorkerManager();
