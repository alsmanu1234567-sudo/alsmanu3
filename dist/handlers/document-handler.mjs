// dist/handlers/document-handler.mjs
// Phase 7: Document Handler — مُستخرَج من dist/index.mjs
// [PATCH_PHASE7_DOCUMENT_EXTRACTED]
//
// الواجهة:
//   setDeps({ _getState, _getAutoReply, saveAutoReply }) — DI
//   handleDocument(bot, msg)                             — exported handler
//
// يعالج:
//   - awaiting_reply_import_json → استيراد ردود تلقائية من JSON
//   - awaiting_code_parts        → استيراد أجزاء كود

let _deps = {};

export function setDeps(d) {
  _deps = { ..._deps, ...d };
}

export async function handleDocument(bot2, msg2) {
  const { _getState, _getAutoReply, saveAutoReply } = _deps;
  const _uid = String(msg2.from?.id);
  const { getState: _gsD, clearState: _clr } = await Promise.resolve().then(_getState);
  const _dst = _gsD(_uid);

  if (_dst.state === "awaiting_reply_import_json" || _dst.state === "awaiting_code_parts") {
    try {
      const _fl = await bot2.getFileLink(msg2.document.file_id);
      const _ft = await (await fetch(_fl)).text();
      const { saveAutoReply: _sar } = await Promise.resolve().then(_getAutoReply)
        .catch(() => ({ saveAutoReply }));
      _clr(_uid);
      try {
        const _imp = JSON.parse(_ft);
        const _arr = Array.isArray(_imp) ? _imp : [_imp];
        let _cnt = 0;
        for (const _r of _arr.slice(0, 100)) {
          if (_r.trigger && _r.replyContent !== undefined) {
            try { _sar(_uid, _r); _cnt++; } catch { saveAutoReply(_uid, _r); _cnt++; }
          }
        }
        await bot2.sendMessage(msg2.chat.id, "\u2705 \u062A\u0645 \u0627\u0633\u062A\u064A\u0631\u0627\u062F " + _cnt + " \u0631\u062F\u0651\u0627\u064B \u0645\u0646 \u0627\u0644\u0645\u0644\u0641!");
      } catch (_e) {
        await bot2.sendMessage(msg2.chat.id, "\u274C \u0645\u0644\u0641 JSON \u063A\u064A\u0631 \u0635\u062D\u064A\u062D: " + _e.message);
      }
    } catch (_e) {
      await bot2.sendMessage(msg2.chat.id, "\u274C \u062E\u0637\u0623 \u0641\u064A \u062A\u062D\u0645\u064A\u0644 \u0627\u0644\u0645\u0644\u0641: " + _e.message);
    }
  }
}
