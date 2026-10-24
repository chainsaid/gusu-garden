import puppeteer from 'puppeteer-core';
import { findChrome } from './lib/chrome.mjs';

async function run() {
  const CHROME = findChrome();
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1707 });
  await page.goto('file:///C:/Users/lielo/.gemini/antigravity/brain/babb32d7-80d4-487f-b7dc-fe8c45b31634/pagoda_ref_detail.jpg');
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({
    path: 'C:/Users/lielo/.gemini/antigravity/brain/babb32d7-80d4-487f-b7dc-fe8c45b31634/spire_ref_zoom.png',
    clip: { x: 500, y: 360, width: 300, height: 450 }
  });
  await browser.close();
  console.log('Saved zoom!');
}
run();

