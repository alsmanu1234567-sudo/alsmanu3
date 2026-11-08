/**
 * startup.mjs — نقطة تشغيل البوت مع فحص المكتبات تلقائياً
 * يتحقق من المكتبات المطلوبة ويثبّتها إن غابت، ثم يشغّل index.mjs
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const BOT_DIR    = join(__dirname, '..');

const R = '\x1b[31m';
const G = '\x1b[32m';
const Y = '\x1b[33m';
const N = '\x1b[0m';

const REQUIRED_PACKAGES = [
  'libphonenumber-js',
  '@whiskeysockets/baileys',
  'node-telegram-bot-api',
  'pino',
  'express',
  'uuid',
];

async function checkAndInstall() {
  const _require = createRequire(join(BOT_DIR, 'package.json'));
  const missing = [];

  for (const pkg of REQUIRED_PACKAGES) {
    try {
      const mainFile = join(BOT_DIR, 'node_modules', pkg);
      if (!existsSync(mainFile)) throw new Error('not found');
    } catch {
      missing.push(pkg);
    }
  }

  if (missing.length === 0) {
    console.log(`${G}✅ كل المكتبات موجودة${N}`);
    return;
  }

  console.log(`${Y}⚠️  مكتبات مفقودة: ${missing.join(', ')}${N}`);
  console.log(`${Y}📦 جارٍ التثبيت...${N}`);

  try {
    await promisify(execFile)('npm', ['install', '--no-audit', '--no-fund'], {
      cwd: BOT_DIR,
      timeout: 120_000,
      env: { ...process.env, NODE_ENV: 'production' }
    });
    console.log(`${G}✅ تم تثبيت المكتبات بنجاح${N}`);
  } catch (err) {
    console.error(`${R}❌ فشل تثبيت المكتبات: ${err.message}${N}`);
    // نكمل رغم الخطأ — البوت قد يعمل بدون المكتبة المفقودة
  }
}

async function main() {
  console.log(`${G}🤖 GhostBot — تشغيل البوت${N}`);
  console.log(`${Y}🔍 فحص المكتبات...${N}`);

  await checkAndInstall();

  console.log(`${G}🚀 تشغيل index.mjs...${N}`);

  // شغّل index.mjs في نفس العملية
  await import('./index.mjs');
}

main().catch(err => {
  console.error(`${R}❌ خطأ فادح: ${err.message}${N}`);
  process.exit(1);
});
