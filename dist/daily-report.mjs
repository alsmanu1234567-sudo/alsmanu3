// dist/daily-report.mjs — Daily Report Module
// Phase 3 extraction — src/bot/core/daily-report.ts
// [PATCH_DAILY_REPORT_SPLIT_APPLIED]
// المسؤولية الوحيدة: إرسال تقرير يومي للمطوّر عند الساعة 6 صباحاً.

let _logger        = {
  info:  (obj, msg) => console.log('[DR INFO]',  msg ?? JSON.stringify(obj)),
  error: (obj, msg) => console.error('[DR ERR]',  msg ?? JSON.stringify(obj)),
};
let _getAllUsers    = () => [];
let _inMemoryDB    = { sessions: new Map() };
let _workerManager = { getAllWorkers: () => [] };
let _DEVELOPER_ID  = '';

export function setDeps(d) {
  if (d.logger)        _logger        = d.logger;
  if (d.getAllUsers)    _getAllUsers    = d.getAllUsers;
  if (d.inMemoryDB)    _inMemoryDB    = d.inMemoryDB;
  if (d.workerManager) _workerManager = d.workerManager;
  if (d.DEVELOPER_ID)  _DEVELOPER_ID  = d.DEVELOPER_ID;
}

let _botRef            = null;
let _dailyReportTimer  = null;

export function setBotRefForReport(bot) {
  _botRef = bot;
}

function msUntilNext6AM() {
  const now  = new Date();
  const next = new Date();
  next.setHours(6, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}

export async function sendDailyReport() {
  if (!_botRef) return;
  const devId = parseInt(_DEVELOPER_ID);
  if (isNaN(devId)) return;
  try {
    const users          = _getAllUsers();
    const totalUsers     = users.length;
    const activeToday    = users.filter(u => {
      const last = new Date(u.lastSeen || 0);
      return Date.now() - last.getTime() < 24 * 60 * 60 * 1_000;
    }).length;
    const mizajUsers     = users.filter(u => u.tier === 'mizaj').length;
    const proUsers       = users.filter(u => ['pro', 'promax', 'khariq', 'khariqpro'].includes(u.tier)).length;
    const totalPoints    = users.reduce((s, u) => s + (u.points || 0), 0);
    const connectedWA    = Array.from(_inMemoryDB.sessions.values()).length;
    const workers        = _workerManager.getAllWorkers();
    const runningWorkers = workers.filter(w => w.status === 'running').length;
    const ram            = Math.round(process.memoryUsage().rss / 1024 / 1024);
    const uptime         = Math.round(process.uptime() / 3_600);
    const now            = new Date().toLocaleString('ar-SA', { timeZone: 'Asia/Riyadh' });

    const text = `📊 *التقرير اليومي — واتساب برو*
🗓 ${now}

━━━━━━━━━━━━━━━━
👥 *المستخدمون*
• الإجمالي: *${totalUsers}*
• نشط اليوم: *${activeToday}*
• ميزاج: *${mizajUsers}* | مدفوع آخر: *${proUsers}*
• نقاط إجمالية: *${totalPoints.toLocaleString()}*

━━━━━━━━━━━━━━━━
📱 *واتساب & السيرفر*
• أرقام متصلة: *${connectedWA}*
• Workers تعمل: *${runningWorkers}/${workers.length}*

━━━━━━━━━━━━━━━━
💾 *الأداء*
• RAM: *${ram} MB*
• وقت التشغيل: *${uptime} ساعة*

✅ البوت يعمل بشكل طبيعي`;

    await _botRef.sendMessage(devId, text, { parse_mode: 'Markdown' });
    _logger.info('Daily report sent to developer');
  } catch (err) {
    _logger.error({ err }, 'Failed to send daily report');
  }
}

export function startDailyReport(bot) {
  setBotRefForReport(bot);
  if (_dailyReportTimer) clearTimeout(_dailyReportTimer);
  const scheduleNext = () => {
    const delay = msUntilNext6AM();
    _dailyReportTimer = setTimeout(async () => {
      await sendDailyReport();
      scheduleNext();
    }, delay);
    _logger.info({ nextReportIn: `${Math.round(delay / 60_000)} دقيقة` }, 'Daily report scheduled');
  };
  scheduleNext();
}
