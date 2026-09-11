/* _gen/stamp.js — 构建版本号：给 index.html 里所有本地资源加 ?v=版本戳，
 * 并写出 version.json 供运行时比对（玩家再次打开链接时会自动检测并强刷）
 *
 * 用法：
 *   node _gen/stamp.js            # 用当前时间生成新版本号
 *   node _gen/stamp.js --keep     # 保留已有版本号（只补齐缺失的引用）
 *   node _gen/stamp.js v1.2.3     # 指定版本号
 */
"use strict";
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const HTML = path.join(ROOT, 'index.html');
const VER_JS = path.join(ROOT, 'js', 'version.js');
const VER_JSON = path.join(ROOT, 'version.json');

const args = process.argv.slice(2);
const keep = args.includes('--keep');
const explicit = args.find(a => !a.startsWith('--'));

function makeStamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

/* 1) 决定版本号：显式参数 > 已有 version.js（--keep） > 新时间戳 */
let version = explicit || null;
if (!version && keep && fs.existsSync(VER_JS)) {
  const m = fs.readFileSync(VER_JS, 'utf8').match(/GAME_VERSION\s*=\s*["']([^"']+)["']/);
  if (m) version = m[1];
}
if (!version) version = makeStamp();

/* 2) 重写 index.html：本地 css/js/图片引用统一加/换 ?v=（已存在的旧版本号会被替换） */
let html = fs.readFileSync(HTML, 'utf8');
const localRef = /(src|href)=(["'])((?!https?:|\/\/|data:|#)[^"'?]+?\.(?:js|css|png|jpg|jpeg|webp|svg|json))(\?[^"']*)?\2/g;
let patched = 0;
html = html.replace(localRef, (full, attr, q, url) => {
  patched++;
  return `${attr}=${q}${url}?v=${version}${q}`;
});
fs.writeFileSync(HTML, html, 'utf8');

/* 3) 写 js/version.js 与 version.json */
const verJs = `/* 自动生成：构建版本（_gen/stamp.js）—— 请勿手改 */\nwindow.GAME_VERSION = "${version}";\n`;
fs.writeFileSync(VER_JS, verJs, 'utf8');
fs.writeFileSync(VER_JSON, JSON.stringify({
  version,
  built: new Date().toISOString(),
  note: '把 version.json 里的 version 与页面内 window.GAME_VERSION 比对，不一致即自动清理缓存并强刷',
}, null, 2) + '\n', 'utf8');

console.log(`版本号：${version}`);
console.log(`index.html 资源引用已打戳：${patched} 处`);
console.log(`已写：js/version.js、version.json`);
