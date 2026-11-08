// dist/handlers/sitegen-handler.mjs
// [NEW-FEATURE-SITEGEN] أداة المطوّر: مواقع مؤقتة عامة عبر أمر نصي "اداة"
// مقفولة بالكامل على DEVELOPER_ID — أي شخص آخر يرى رسالة قفل فقط.

export const pluginManifest = {
  name: 'sitegen',
  version: '1.0.0',
  type: 'handler',
  description: 'أداة المطوّر: مواقع مؤقتة عامة (اداة تشغيل/ايقاف/قائمة)',
  textOrder: 5, // مبكر — يجب أن يعترض أمر "اداة" قبل أي معالج نصي عام آخر
  cbOrder: 5,
  enabled: true,
};

let _deps = null;
export function setDeps(d) { _deps = d; }

const LOCK_MSG = "\u{1F512} \u0647\u0630\u0647 \u0627\u0644\u0623\u062F\u0627\u0629 \u0645\u062E\u0635\u0651\u0635\u0629 \u0644\u0645\u0637\u0648\u0651\u0631 \u0627\u0644\u0628\u0648\u062A \u0641\u0642\u0637.";

export async function handleText(bot, msg) {
  const text = msg.text || '';
  if (!text.trim()) return false;
  const parts = text.trim().split(/\s+/);
  if (parts[0] !== 'اداة') return false;

  const chatId = msg.chat.id;
  const userId = String(msg.from?.id);

  if (!_deps || userId !== _deps.DEVELOPER_ID) {
    await bot.sendMessage(chatId, LOCK_MSG);
    return true;
  }

  await _deps.handleSiteGenCommand(bot, chatId, text);
  return true;
}

// لا callbacks خاصة بهذا الـ plugin — زر "mymsgs_show_sitegen" يُعالَج داخل my-msgs.mjs
export async function handleCallback(bot, query) {
  return false;
}
