/// <reference path="../src/typings.d.ts" />

import {
  Browser,
}                       from 'puppeteer'
import puppeteer from 'puppeteer-extra'
import stealthPlugin from 'puppeteer-extra-plugin-stealth'

puppeteer.use(stealthPlugin())

// puppeteer usage as normal
puppeteer.launch({
  args: [
    '--audio-output-channels=0',
    '--disable-default-apps',
    '--disable-extensions',
    '--disable-translate',
    '--disable-gpu',
    '--disable-setuid-sandbox',
    '--disable-sync',
    '--hide-scrollbars',
    '--mute-audio',
    '--no-sandbox',
  ],
  headless: false,
}).then(async (browser:Browser) => {
  const page = await browser.newPage()
  await page.setViewport({ height: 1000, width: 1000 })
  await page.goto('https://bot.sannysoft.com')
  await page.waitFor(5000)
  await page.screenshot({ fullPage: true, path:'bot-check-with-plugin.png' })
  await browser.close()
  return browser
}).catch((err: Error) => {
  console.error(err)
})
