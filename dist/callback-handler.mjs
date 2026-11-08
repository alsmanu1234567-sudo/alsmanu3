// dist/callback-handler.mjs
// Phase 5: Thin orchestrator — يُفوّض جميع الـ callbacks لـ Registry
// [PATCH_PHASE5_DOMAIN_HANDLERS] كل routing logic انتقلت لـ dist/handlers/

import * as _registry from './handlers/registry.mjs';

let _deps = null;
let _logger = { info: () => {}, warn: () => {} };

export function setDeps(d) {
  _deps = d;
  if (d.logger) _logger = d.logger;
  // يُوزّع الـ deps على جميع الـ domain handlers عبر الـ registry (مع دمج)
  _registry.setDepsAll(d);
}

export async function handleCallback(bot2, query) {
  const { getUser, saveUser, DEVELOPER_ID } = _deps;
  const chatId = query.message?.chat.id;
  const userId = String(query.from.id);
  const data = query.data || "";
  if (!chatId) {
    _logger.warn({ queryId: query.id, userId, data }, 'callbackHandler: no chatId — query dropped');
    return;
  }
  await bot2.answerCallbackQuery(query.id).catch(() => {});
  const user = getUser(userId);
  const isDev2 = userId === DEVELOPER_ID;
  if (chatId && user.telegramChatId !== chatId) {
    saveUser(userId, { telegramChatId: chatId });
  }
  // حماية: منع غير المطورين من الوصول لأوامر المطور
  if (!isDev2 && (
    data.startsWith("dev_") ||
    data.startsWith("god_") ||
    data === "dev_panel" ||
    data.startsWith("devuser_") ||
    data.startsWith("devaction_") ||
    data.startsWith("grantfeature_") ||
    data.startsWith("devecon_") ||
    data === "dev_inbox"
  )) {
    await bot2.sendMessage(chatId, "\u274C \u0647\u0630\u0647 \u0627\u0644\u0645\u064A\u0632\u0629 \u063A\u064A\u0631 \u0645\u062A\u0627\u062D\u0629");
    return;
  }
  if (data === "noop") return;

  // ── [PATCH_PHASE5_DOMAIN_HANDLERS] توجيه الـ callback عبر Registry ─────────
  await _registry.dispatchCallback(bot2, query);
}
