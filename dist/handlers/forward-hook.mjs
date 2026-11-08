// dist/handlers/forward-hook.mjs
// Phase 7: Forward Hook — مُستخرَج من dist/index.mjs
// [PATCH_PHASE7_FORWARD_HOOK_EXTRACTED]
//
// الواجهة:
//   register(dispatcherMod) — يُسجَّل prefix 'fw_' في الـ Dispatcher
//
// يُفوّض جميع callbacks التي تبدأ بـ fw_ إلى forward.mjs::handleForwardCallback

export function register(dispatcherMod) {
  dispatcherMod.registerPrefix('fw_', async (_data, _bot, _query) => {
    const { handleForwardCallback: _hfc } = await import('../forward.mjs');
    // [FIX-LIST-NAV] لا نكتم الأخطاء بصمت — نسجلها ونخبر المستخدم بدل زر ميت
    try {
      await _hfc(_query);
    } catch (e) {
      console.error('[FW-HOOK] handleForwardCallback error:', e?.message || e);
      try {
        await _bot.answerCallbackQuery(_query.id, { text: '⚠️ حدث خطأ مؤقت — أعد المحاولة' }).catch(() => {});
      } catch {}
    }
  });
}
