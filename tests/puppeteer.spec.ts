#!/usr/bin/env node --no-warnings --loader ts-node/esm
/**
 *   Wechaty - https://github.com/chatie/wechaty
 *
 *   @copyright 2016-2018 Huan LI <zixia@zixia.net>
 *
 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 *
 */
import fs    from 'fs'
import path  from 'path'

import {
  test,
  sinon,
}                 from 'tstest'
import puppeteer  from 'puppeteer'

import {
  codeRoot,
}                 from '../src/cjs.js'

const PUPPETEER_LAUNCH_OPTIONS = {
  args: [
    '--disable-gpu',
    '--disable-setuid-sandbox',
    '--no-sandbox',
  ],
  headless: true,
}

test('Puppeteer smoke testing', async t => {
  let browser
  let page

  try {
    browser = await puppeteer.launch(PUPPETEER_LAUNCH_OPTIONS)
    t.ok(browser, 'Browser instnace')

    const version = await browser.version()
    t.ok(version, 'should get version')

    page = await browser.newPage()
    t.pass('should create newPage for browser')
    await page.goto('https://wx.qq.com/')
    t.pass('should open wx.qq.com')

    const result = await page.evaluate(() => 42)
    t.equal(result, 42, 'should get 42')

  } catch (e) {
    t.fail(e as any)
  } finally {
    if (page) {
      await page.close()
    }
    if (browser) {
      await browser.close()
    }
  }
})

test('evaluate() a function that returns a Promise', async t => {
  try {
    const browser = await puppeteer.launch(PUPPETEER_LAUNCH_OPTIONS)
    const page    = await browser.newPage()

    const result = await page.evaluate(() => Promise.resolve(42))
    t.equal(result, 42, 'should get resolved value of promise inside browser')

    await page.close()
    await browser.close()
  } catch (e) {
    t.fail(e as any)
  }
})

test('evaluate() a file and get the returns value', async t => {
  const EXPECTED_OBJ = {
    code: 42,
    message: 'meaning of the life',
  }

  try {
    const browser = await puppeteer.launch(PUPPETEER_LAUNCH_OPTIONS)
    const page = await browser.newPage()

    const file = path.join(
      codeRoot,
      'tests',
      'fixtures/inject-file.js',
    )
    const source = fs.readFileSync(file).toString()

    const result = await page.evaluate(source)
    t.same(result, EXPECTED_OBJ, 'should inject file inside browser and return the value')

    const noWechaty = await page.evaluate('typeof WechatyBro === "undefined"')
    t.equal(noWechaty, true, 'should no wechaty by default')

    const hasWindow = await page.evaluate('typeof window === "object"')
    t.equal(hasWindow, true, 'should has window by default')

    await page.close()
    await browser.close()

  } catch (e) {
    t.fail(e as any)
  }
})

test('page.on(console)', async t => {
  const EXPECTED_ARG1 = 'arg1'
  const EXPECTED_ARG2 = 2
  // const EXPECTED_ARG3 = { arg3: 3 }

  const browser = await puppeteer.launch(PUPPETEER_LAUNCH_OPTIONS)
  const page    = await browser.newPage()

  const spy = sinon.spy()

  page.on('console', spy)
  await page.evaluate((...args) => {
    console.info.apply(console, args as [any?, ...any[]])
  }, EXPECTED_ARG1, EXPECTED_ARG2) // , EXPECTED_ARG3)

  // wait a while to let chrome fire the event
  await new Promise(resolve => setTimeout(resolve, 3))

  t.ok(spy.calledOnce, 'should be called once')

  const consoleMessage = spy.firstCall.args[0]
  t.equal(consoleMessage.type(), 'info', 'should get info type for `console.info`')
  t.equal(consoleMessage.text(), EXPECTED_ARG1 + ' ' + EXPECTED_ARG2, 'should get console.info 1st/2nd arg')

  await page.close()
  await browser.close()
})

test('page.exposeFunction()', async t => {
  const browser = await puppeteer.launch(PUPPETEER_LAUNCH_OPTIONS)
  const page    = await browser.newPage()

  const spy = sinon.spy()

  await page.exposeFunction('nodeFunc', spy)
  await page.evaluate('nodeFunc(42)')
  t.ok(spy.calledOnce, 'should be called once inside browser')
  t.equal(spy.firstCall.args[0], 42, 'should be called with 42')

  await page.close()
  await browser.close()
})

test('other demos', async t => {
  const EXPECTED_URL = 'https://github.com/'

  try {
    const browser = await puppeteer.launch(PUPPETEER_LAUNCH_OPTIONS)

    const version = await browser.version()
    t.ok(version, 'should get version')

    const page = await browser.newPage()
    await page.goto(EXPECTED_URL)
    // await page.goto('https://www.chromestatus.com/features', {waitUntil: 'networkidle'});
    // await page.waitForSelector('h3 a');
    // await page.click('input[type="submit"]');

    // not the same with the document of ConsoleMessage???

    page.on('dialog', async dialog => {
      console.info(dialog)
      console.info('dialog:', dialog.type, dialog.message())
      await dialog.accept('ok')
    })

    page.on('error', (e, ...args) => {
      console.error('error', e as Error)
      console.error('error:args:', args)
    })
    page.on('pageerror', (e, ...args) => {
      console.error('pageerror', e as Error)
      console.error('pageerror:args:', args)
    })

    page.on('load', (e, ...args) => {
      console.info('load:e:', e as Error)
      console.info('load:args:', args)
    })

    await page.setRequestInterception(true)

    page.on('request', async interceptedRequest => {
      if (interceptedRequest.url().endsWith('.png')
        || interceptedRequest.url().endsWith('.jpg')
      ) {
        await interceptedRequest.abort()
      } else {
        await interceptedRequest.continue()
      }
    })

    page.on('requestfailed', (...args: any[]) => {
      console.info('requestfailed:args:', args)
    })

    page.on('response', (/* res, ...args */) => {
      // console.info('response:res:', res)
      // console.info('response:args:', args)
    })

    // page.click(selector[, options])
    // await page.injectFile(path.join(__dirname, 'wechaty-bro.js'))
    const cookieList = await page.cookies()
    t.ok(cookieList.length,   'should get cookies')
    t.ok(cookieList[0]?.name,  'should get cookies with name')

    /**
     * Huan(202109): skip the below Error
     *  message: "Protocol error (Network.setCookies): Invalid cookie fields"
     */
    // const cookie: puppeteer.Protocol.Network.CookieParam = {
    //   domain   : 'qq.com',
    //   expires  : 1234324132,
    //   httpOnly : false,
    //   name     : 'test-name',
    //   path     : '/',
    //   priority: 'Medium',
    //   sameParty: true,
    //   sameSite : 'Strict',
    //   secure   : false,
    //   value    : 'test-value',
    // }
    // await page.setCookie(cookie)

    const result = await page.evaluate(() => 8 * 7)
    t.equal(result, 56, 'should evaluated function for () => 8 * 7 = 56')

    t.equal(await page.evaluate('1 + 2'), 3, 'should evaluated 1 + 2 = 3')

    const url = page.url()
    t.equal(url, EXPECTED_URL, 'should get the url right')
    // await new Promise(r => setTimeout(r, 3000))

    await page.close()
    await browser.close()
  } catch (e) {
    t.fail(e as any)
  }
})
