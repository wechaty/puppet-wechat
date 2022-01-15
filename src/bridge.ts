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
import { EventEmitter } from 'events'
import fs               from 'fs'
import path             from 'path'
import puppeteer        from 'puppeteer'
import puppeteerExtra   from 'puppeteer-extra'
import stealthPlugin    from 'puppeteer-extra-plugin-stealth'
import { StateSwitch }  from 'state-switch'
import { parseString }  from 'xml2js'

import {
  wrapAsyncError,
  GError,
}                       from 'gerror'
import type {
  MemoryCard,
}                         from 'memory-card'
import {
  log,
}                         from 'wechaty-puppet'

import {
  MEMORY_SLOT,
}                       from './config.js'
import {
  codeRoot,
}                       from './cjs.js'

import type {
  WebContactRawPayload,
  WebMessageMediaPayload,
  WebMessageRawPayload,
  WebRoomRawPayload,
}                        from './web-schemas.js'

import {
  unescapeHtml,
  retryPolicy,
}                       from './pure-function-helpers/mod.js'

export interface InjectResult {
  code:    number,
  message: string,
}

export interface BridgeOptions {
  endpoint?       : string,
  head?           : boolean,
  launchOptions?  : puppeteer.LaunchOptions,
  memory          : MemoryCard,
  stealthless?    : boolean,
  uos?            : boolean,
  uosExtSpam?     : string
}

export type Cookie = puppeteer.Protocol.Network.Cookie

export class Bridge extends EventEmitter {

  private browser : undefined | puppeteer.Browser
  private page    : undefined | puppeteer.Page
  private state   : StateSwitch

  private wrapAsync = wrapAsyncError(e => this.emit('error', e))

  constructor (
    public options: BridgeOptions,
  ) {
    super()
    log.verbose('PuppetWeChatBridge', 'constructor()')

    this.state = new StateSwitch('PuppetWeChatBridge', { log })
  }

  public async start (): Promise<void> {
    log.verbose('PuppetWeChatBridge', 'start()')

    this.state.active('pending')
    try {
      this.browser = await this.initBrowser()
      log.verbose('PuppetWeChatBridge', 'start() initBrowser() done')

      this.on('load', this.wrapAsync(this.onLoad.bind(this)))

      const ready = new Promise(resolve => this.once('ready', resolve))
      this.page = await this.initPage(this.browser)
      await ready

      this.state.active(true)
      log.verbose('PuppetWeChatBridge', 'start() initPage() done')
    } catch (e) {
      log.error('PuppetWeChatBridge', 'start() exception: %s', e as Error)
      this.state.inactive(true)

      try {
        if (this.page) {
          await this.page.close()
        }
        if (this.browser) {
          await this.browser.close()
        }
      } catch (e2) {
        log.error('PuppetWeChatBridge', 'start() exception %s, close page/browser exception %s', e, e2)
      }

      this.emit('error', e)
      throw e
    }
  }

  public async initBrowser (): Promise<puppeteer.Browser> {
    log.verbose('PuppetWeChatBridge', 'initBrowser()')
    const launchOptions     = { ...this.options.launchOptions } as puppeteer.LaunchOptions & puppeteer.BrowserLaunchArgumentOptions
    const headless          = !(this.options.head)
    const launchOptionsArgs = launchOptions.args || []
    if (this.options.endpoint) {
      launchOptions.executablePath = this.options.endpoint
    }

    const options = {
      ...launchOptions,
      args: [
        '--audio-output-channels=0',
        '--disable-default-apps',
        '--disable-translate',
        '--disable-gpu',
        '--disable-setuid-sandbox',
        '--disable-sync',
        '--hide-scrollbars',
        '--mute-audio',
        '--no-sandbox',
        ...launchOptionsArgs,
      ],
      headless,
    }

    log.verbose('PuppetWeChatBridge', 'initBrowser() with options=%s', JSON.stringify(options))

    let browser

    if (!this.options.stealthless) {
      /**
        * Puppeteer 4.0
        *   https://github.com/berstend/puppeteer-extra/issues/211#issuecomment-636283110
        */
      const plugin = stealthPlugin()
      plugin.onBrowser = () => {}
      puppeteerExtra.use(plugin)
      browser = await puppeteerExtra.launch(options)
    } else {
      browser = await puppeteer.launch(options)
    }

    const version = await browser.version()
    log.verbose('PuppetWeChatBridge', 'initBrowser() version: %s', version)

    return browser
  }

  public async onDialog (dialog: puppeteer.Dialog) {
    log.warn('PuppetWeChatBridge',
      'onDialog() page.on(dialog) type:%s message:%s',
      dialog.type, dialog.message(),
    )

    try {
      // XXX: Which ONE is better?
      await dialog.accept()
      // await dialog.dismiss()
    } catch (e) {
      log.error('PuppetWeChatBridge', 'onDialog() dialog.dismiss() reject: %s', e as Error)
    }
    this.emit('error', GError.from(`${dialog.type}(${dialog.message()})`))
  }

  public async onLoad (page: puppeteer.Page): Promise<void> {
    log.verbose('PuppetWeChatBridge', 'onLoad() page.url=%s', page.url())

    if (this.state.inactive()) {
      log.verbose('PuppetWeChatBridge', 'onLoad() OFF state detected. NOP')
      return // reject(new Error('onLoad() OFF state detected'))
    }

    try {
      const emitExist = await page.evaluate(() => {
        return typeof window['wechatyPuppetBridgeEmit'] === 'function'
      })
      if (!emitExist) {
        /**
         * expose window['wechatyPuppetBridgeEmit'] at here.
         * enable wechaty-bro.js to emit message to bridge
         */
        await page.exposeFunction('wechatyPuppetBridgeEmit', this.emit.bind(this))
      }

      await this.readyAngular(page)
      await this.inject(page)
      await this.clickSwitchAccount(page)

      this.emit('ready')

    } catch (e) {
      log.error('PuppetWeChatBridge', 'onLoad() exception: %s', e as Error)
      await page.close()
      this.emit('error', e)
    }
  }

  public async initPage (browser: puppeteer.Browser): Promise<puppeteer.Page> {
    log.verbose('PuppetWeChatBridge', 'initPage()')

    // set this in time because the following callbacks
    // might be called before initPage() return.
    const page = this.page =  await browser.newPage()

    /**
     * Can we support UOS with puppeteer? #127
     *  https://github.com/wechaty/wechaty-puppet-wechat/issues/127
     */
    if (this.options.uos) {
      await this.uosPatch(page)
    }

    page.on('error',  e => this.emit('error', e))
    page.on('dialog', this.wrapAsync(this.onDialog.bind(this)))

    const cookieList = (
      await this.options.memory.get(MEMORY_SLOT)
    ) || [] as puppeteer.Protocol.Network.Cookie[]

    const url = this.entryUrl(cookieList)
    log.verbose('PuppetWeChatBridge', 'initPage() before page.goto(url)')

    // Does this related to(?) the CI Error: exception: Navigation Timeout Exceeded: 30000ms exceeded
    await page.goto(url)
    log.verbose('PuppetWeChatBridge', 'initPage() after page.goto(url)')

    // await this.uosPatch(page)
    void this.uosPatch

    if (cookieList.length) {
      await page.setCookie(...cookieList)
      log.silly('PuppetWeChatBridge', 'initPage() page.setCookie() %s cookies set back', cookieList.length)
    }

    page.on('load', () => this.emit('load', page))
    await page.reload() // reload page to make effect of the new cookie.

    return page
  }

  private async uosPatch (page: puppeteer.Page) {
    /**
     * Can we support UOS with puppeteer? #127
     *  https://github.com/wechaty/wechaty-puppet-wechat/issues/127
     *
     * Credit: @luvletter2333 https://github.com/luvletter2333
     */
    const UOS_PATCH_CLIENT_VERSION = '2.0.0'
    const UOS_PATCH_EXTSPAM = this.options.uosExtSpam ?? 'Gp8ICJkIEpkICggwMDAwMDAwMRAGGoAI1GiJSIpeO1RZTq9QBKsRbPJdi84ropi16EYI10WB6g74sGmRwSNXjPQnYUKYotKkvLGpshucCaeWZMOylnc6o2AgDX9grhQQx7fm2DJRTyuNhUlwmEoWhjoG3F0ySAWUsEbH3bJMsEBwoB//0qmFJob74ffdaslqL+IrSy7LJ76/G5TkvNC+J0VQkpH1u3iJJs0uUYyLDzdBIQ6Ogd8LDQ3VKnJLm4g/uDLe+G7zzzkOPzCjXL+70naaQ9medzqmh+/SmaQ6uFWLDQLcRln++wBwoEibNpG4uOJvqXy+ql50DjlNchSuqLmeadFoo9/mDT0q3G7o/80P15ostktjb7h9bfNc+nZVSnUEJXbCjTeqS5UYuxn+HTS5nZsPVxJA2O5GdKCYK4x8lTTKShRstqPfbQpplfllx2fwXcSljuYi3YipPyS3GCAqf5A7aYYwJ7AvGqUiR2SsVQ9Nbp8MGHET1GxhifC692APj6SJxZD3i1drSYZPMMsS9rKAJTGz2FEupohtpf2tgXm6c16nDk/cw+C7K7me5j5PLHv55DFCS84b06AytZPdkFZLj7FHOkcFGJXitHkX5cgww7vuf6F3p0yM/W73SoXTx6GX4G6Hg2rYx3O/9VU2Uq8lvURB4qIbD9XQpzmyiFMaytMnqxcZJcoXCtfkTJ6pI7a92JpRUvdSitg967VUDUAQnCXCM/m0snRkR9LtoXAO1FUGpwlp1EfIdCZFPKNnXMeqev0j9W9ZrkEs9ZWcUEexSj5z+dKYQBhIICviYUQHVqBTZSNy22PlUIeDeIs11j7q4t8rD8LPvzAKWVqXE+5lS1JPZkjg4y5hfX1Dod3t96clFfwsvDP6xBSe1NBcoKbkyGxYK0UvPGtKQEE0Se2zAymYDv41klYE9s+rxp8e94/H8XhrL9oGm8KWb2RmYnAE7ry9gd6e8ZuBRIsISlJAE/e8y8xFmP031S6Lnaet6YXPsFpuFsdQs535IjcFd75hh6DNMBYhSfjv456cvhsb99+fRw/KVZLC3yzNSCbLSyo9d9BI45Plma6V8akURQA/qsaAzU0VyTIqZJkPDTzhuCl92vD2AD/QOhx6iwRSVPAxcRFZcWjgc2wCKh+uCYkTVbNQpB9B90YlNmI3fWTuUOUjwOzQRxJZj11NsimjOJ50qQwTTFj6qQvQ1a/I+MkTx5UO+yNHl718JWcR3AXGmv/aa9rD1eNP8ioTGlOZwPgmr2sor2iBpKTOrB83QgZXP+xRYkb4zVC+LoAXEoIa1+zArywlgREer7DLePukkU6wHTkuSaF+ge5Of1bXuU4i938WJHj0t3D8uQxkJvoFi/EYN/7u2P1zGRLV4dHVUsZMGCCtnO6BBigFMAA='

    const uosHeaders = {
      'client-version' : UOS_PATCH_CLIENT_VERSION,
      extspam : UOS_PATCH_EXTSPAM,
    }
    // add RequestInterception
    await page.setRequestInterception(true)
    page.on('request', req => {
      const url = new URL(req.url())
      if (url.pathname === '/' && url.search.indexOf('target=t') === -1) {
        if (url.search === '' || url.search === '?') {
          url.search = '?'
        } else {
          url.search += '&'
        }
        url.search += 'target=t'
        this.wrapAsync(req.continue({ url: url.toString() }))

      } else if (url.pathname === '/cgi-bin/mmwebwx-bin/webwxnewloginpage') {
        const override = {
          headers: {
            ...req.headers(),
            ...uosHeaders,
          },
        }
        this.wrapAsync(req.continue(override))

      } else {
        this.wrapAsync(req.continue())
      }
    })
  }

  public async readyAngular (page: puppeteer.Page): Promise<void> {
    log.verbose('PuppetWeChatBridge', 'readyAngular()')

    try {
      await page.waitForFunction("typeof window.angular !== 'undefined'")
    } catch (e) {
      log.verbose('PuppetWeChatBridge', 'readyAngular() exception: %s', e as Error)

      const blockedMessage = await this.testBlockedMessage()
      if (blockedMessage) {  // Wechat Account Blocked
        // TODO: advertise for puppet-padchat
        log.info('PuppetWeChatBridge', `

        Please see: Account Login Issue <https://github.com/wechaty/wechaty/issues/872>

        `)
        throw new Error(blockedMessage)
      } else {
        throw e
      }
    }
  }

  public async inject (page: puppeteer.Page): Promise<void> {
    log.verbose('PuppetWeChatBridge', 'inject()')

    const WECHATY_BRO_JS_FILE = path.join(
      codeRoot,
      'src',
      'wechaty-bro.js',
    )

    try {
      const sourceCode = fs.readFileSync(WECHATY_BRO_JS_FILE)
        .toString()

      let retObj = await page.evaluate(sourceCode) as undefined | InjectResult

      if (retObj && /^(2|3)/.test(retObj.code.toString())) {
        // HTTP Code 2XX & 3XX
        log.silly('PuppetWeChatBridge', 'inject() eval(Wechaty) return code[%d] message[%s]',
          retObj.code, retObj.message)
      } else {  // HTTP Code 4XX & 5XX
        throw new Error('execute injectio error: ' + retObj?.code + ', ' + retObj?.message)
      }

      retObj = await this.proxyWechaty('init')
      if (retObj && /^(2|3)/.test(retObj.code.toString())) {
        // HTTP Code 2XX & 3XX
        log.silly('PuppetWeChatBridge', 'inject() Wechaty.init() return code[%d] message[%s]',
          retObj.code, retObj.message)
      } else {  // HTTP Code 4XX & 5XX
        throw new Error('execute proxyWechaty(init) error: ' + retObj?.code + ', ' + retObj?.message)
      }

      const SUCCESS_CIPHER = 'ding() OK!'
      const future = new Promise(resolve => this.once('dong', resolve))
      this.ding(SUCCESS_CIPHER)
      const r = await future
      if (r !== SUCCESS_CIPHER) {
        throw new Error('fail to get right return from call ding()')
      }
      log.silly('PuppetWeChatBridge', 'inject() ding success')

    } catch (e) {
      log.verbose('PuppetWeChatBridge', 'inject() exception: %s. stack: %s', (e as Error).message, (e as Error).stack)
      throw e
    }
  }

  public async logout (): Promise<any> {
    log.verbose('PuppetWeChatBridge', 'logout()')
    try {
      return await this.proxyWechaty('logout')
    } catch (e) {
      log.error('PuppetWeChatBridge', 'logout() exception: %s', (e as Error).message)
      throw e
    }
  }

  public async stop (): Promise<void> {
    log.verbose('PuppetWeChatBridge', 'stop()')

    if (!this.page) {
      throw new Error('no page')
    }
    if (!this.browser) {
      throw new Error('no browser')
    }

    this.state.inactive('pending')

    try {
      await this.page.close()
      log.silly('PuppetWeChatBridge', 'stop() page.close()-ed')
    } catch (e) {
      log.warn('PuppetWeChatBridge', 'stop() page.close() exception: %s', e as Error)
    }

    try {
      await this.browser.close()
      log.silly('PuppetWeChatBridge', 'stop() browser.close()-ed')
    } catch (e) {
      log.warn('PuppetWeChatBridge', 'stop() browser.close() exception: %s', e as Error)
    }

    this.state.inactive(true)
  }

  public async getUserName (): Promise<string> {
    log.verbose('PuppetWeChatBridge', 'getUserName()')

    try {
      const userName = await this.proxyWechaty('getUserName')
      return userName
    } catch (e) {
      log.error('PuppetWeChatBridge', 'getUserName() exception: %s', (e as Error).message)
      throw e
    }
  }

  public async contactAlias (contactId: string, alias: null | string): Promise<boolean> {
    try {
      return await this.proxyWechaty('contactRemark', contactId, alias)
    } catch (e) {
      log.verbose('PuppetWeChatBridge', 'contactRemark() exception: %s', (e as Error).message)
      // Issue #509 return false instead of throw when contact is not a friend.
      // throw e
      log.warn('PuppetWeChatBridge', 'contactRemark() does not work on contact is not a friend')
      return false
    }
  }

  public async contactList (): Promise<string[]> {
    try {
      return await this.proxyWechaty('contactList')
    } catch (e) {
      log.error('PuppetWeChatBridge', 'contactList() exception: %s', (e as Error).message)
      throw e
    }
  }

  public async roomList (): Promise<string[]> {
    try {
      return await this.proxyWechaty('roomList')
    } catch (e) {
      log.error('PuppetWeChatBridge', 'roomList() exception: %s', (e as Error).message)
      throw e
    }
  }

  public async roomDelMember (
    roomId:     string,
    contactId:  string,
  ): Promise<number> {
    if (!roomId || !contactId) {
      throw new Error('no roomId or contactId')
    }
    try {
      return await this.proxyWechaty('roomDelMember', roomId, contactId)
    } catch (e) {
      log.error('PuppetWeChatBridge', 'roomDelMember(%s, %s) exception: %s', roomId, contactId, (e as Error).message)
      throw e
    }
  }

  public async roomAddMember (
    roomId:     string,
    contactId:  string,
  ): Promise<number> {
    log.verbose('PuppetWeChatBridge', 'roomAddMember(%s, %s)', roomId, contactId)

    if (!roomId || !contactId) {
      throw new Error('no roomId or contactId')
    }
    try {
      return await this.proxyWechaty('roomAddMember', roomId, contactId)
    } catch (e) {
      log.error('PuppetWeChatBridge', 'roomAddMember(%s, %s) exception: %s', roomId, contactId, (e as Error).message)
      throw e
    }
  }

  public async roomModTopic (
    roomId: string,
    topic:  string,
  ): Promise<string> {
    if (!roomId) {
      throw new Error('no roomId')
    }
    try {
      await this.proxyWechaty('roomModTopic', roomId, topic)
      return topic
    } catch (e) {
      log.error('PuppetWeChatBridge', 'roomModTopic(%s, %s) exception: %s', roomId, topic, (e as Error).message)
      throw e
    }
  }

  public async roomCreate (contactIdList: string[], topic?: string): Promise<string> {
    if (!Array.isArray(contactIdList)) {
      throw new Error('no valid contactIdList')
    }

    try {
      const roomId = await this.proxyWechaty('roomCreate', contactIdList, topic)
      if (typeof roomId === 'object') {
        // It is a Error Object send back by callback in browser(WechatyBro)
        throw roomId
      }
      return roomId
    } catch (e) {
      log.error('PuppetWeChatBridge', 'roomCreate(%s) exception: %s', contactIdList, (e as Error).message)
      throw e
    }
  }

  public async verifyUserRequest (
    contactId:  string,
    hello:      string,
  ): Promise<boolean> {
    log.verbose('PuppetWeChatBridge', 'verifyUserRequest(%s, %s)', contactId, hello)

    if (!contactId) {
      throw new Error('no valid contactId')
    }
    try {
      return await this.proxyWechaty('verifyUserRequest', contactId, hello)
    } catch (e) {
      log.error('PuppetWeChatBridge', 'verifyUserRequest(%s, %s) exception: %s', contactId, hello, (e as Error).message)
      throw e
    }
  }

  public async verifyUserOk (
    contactId:  string,
    ticket:     string,
  ): Promise<boolean> {
    log.verbose('PuppetWeChatBridge', 'verifyUserOk(%s, %s)', contactId, ticket)

    if (!contactId || !ticket) {
      throw new Error('no valid contactId or ticket')
    }
    try {
      return await this.proxyWechaty('verifyUserOk', contactId, ticket)
    } catch (e) {
      log.error('PuppetWeChatBridge', 'verifyUserOk(%s, %s) exception: %s', contactId, ticket, (e as Error).message)
      throw e
    }
  }

  public async send (
    toUserName: string,
    text:       string,
  ): Promise<void> {
    log.verbose('PuppetWeChatBridge', 'send(%s, %s)', toUserName, text)

    if (!toUserName) {
      throw new Error('UserName not found')
    }
    if (!text) {
      throw new Error('cannot say nothing')
    }

    try {
      const ret = await this.proxyWechaty('send', toUserName, text)
      if (!ret) {
        throw new Error('send fail')
      }
    } catch (e) {
      log.error('PuppetWeChatBridge', 'send() exception: %s', (e as Error).message)
      throw e
    }
  }

  public async getMsgImg (id: string): Promise<string> {
    log.verbose('PuppetWeChatBridge', 'getMsgImg(%s)', id)

    try {
      return await this.proxyWechaty('getMsgImg', id)
    } catch (e) {
      log.silly('PuppetWeChatBridge', 'proxyWechaty(getMsgImg, %d) exception: %s', id, (e as Error).message)
      throw e
    }
  }

  public async getMsgEmoticon (id: string): Promise<string> {
    log.verbose('PuppetWeChatBridge', 'getMsgEmoticon(%s)', id)

    try {
      return await this.proxyWechaty('getMsgEmoticon', id)
    } catch (e) {
      log.silly('PuppetWeChatBridge', 'proxyWechaty(getMsgEmoticon, %d) exception: %s', id, (e as Error).message)
      throw e
    }
  }

  public async getMsgVideo (id: string): Promise<string> {
    log.verbose('PuppetWeChatBridge', 'getMsgVideo(%s)', id)

    try {
      return await this.proxyWechaty('getMsgVideo', id)
    } catch (e) {
      log.silly('PuppetWeChatBridge', 'proxyWechaty(getMsgVideo, %d) exception: %s', id, (e as Error).message)
      throw e
    }
  }

  public async getMsgVoice (id: string): Promise<string> {
    log.verbose('PuppetWeChatBridge', 'getMsgVoice(%s)', id)

    try {
      return await this.proxyWechaty('getMsgVoice', id)
    } catch (e) {
      log.silly('PuppetWeChatBridge', 'proxyWechaty(getMsgVoice, %d) exception: %s', id, (e as Error).message)
      throw e
    }
  }

  public async getMsgPublicLinkImg (id: string): Promise<string> {
    log.verbose('PuppetWeChatBridge', 'getMsgPublicLinkImg(%s)', id)

    try {
      return await this.proxyWechaty('getMsgPublicLinkImg', id)
    } catch (e) {
      log.silly('PuppetWeChatBridge', 'proxyWechaty(getMsgPublicLinkImg, %d) exception: %s', id, (e as Error).message)
      throw e
    }
  }

  public async getMessage (id: string): Promise<WebMessageRawPayload> {
    const doGet = async () => {
      const rawPayload = await this.proxyWechaty('getMessage', id)

      if (rawPayload && Object.keys(rawPayload).length > 0) {
        return rawPayload
      }
      throw new Error('doGet fail')
    }

    try {
      const rawPayload = await retryPolicy.execute(doGet)
      return rawPayload
    } catch (e) {
      log.error('PuppetWeChatBridge', 'getMessage() rejection: %s', (e as Error).message)
      throw e
    }
  }

  public async getContact (id: string): Promise<WebContactRawPayload | WebRoomRawPayload> {
    const doGet = async () => {
      const rawPayload = await this.proxyWechaty('getContact', id)

      if (rawPayload && Object.keys(rawPayload).length > 0) {
        return rawPayload
      }
      throw new Error('doGet fail')
    }

    try {
      const rawPayload = await retryPolicy.execute(doGet)
      return rawPayload
    } catch (e) {
      log.error('PuppetWeChatBridge', 'getContact() rejection: %s', (e as Error).message)
      throw e
    }
  }

  public async getBaseRequest (): Promise<string> {
    log.verbose('PuppetWeChatBridge', 'getBaseRequest()')

    try {
      return await this.proxyWechaty('getBaseRequest')
    } catch (e) {
      log.silly('PuppetWeChatBridge', 'proxyWechaty(getBaseRequest) exception: %s', (e as Error).message)
      throw e
    }
  }

  public async getPassticket (): Promise<string> {
    log.verbose('PuppetWeChatBridge', 'getPassticket()')

    try {
      return await this.proxyWechaty('getPassticket')
    } catch (e) {
      log.silly('PuppetWeChatBridge', 'proxyWechaty(getPassticket) exception: %s', (e as Error).message)
      throw e
    }
  }

  public async getCheckUploadUrl (): Promise<string> {
    log.verbose('PuppetWeChatBridge', 'getCheckUploadUrl()')

    try {
      return await this.proxyWechaty('getCheckUploadUrl')
    } catch (e) {
      log.silly('PuppetWeChatBridge', 'proxyWechaty(getCheckUploadUrl) exception: %s', (e as Error).message)
      throw e
    }
  }

  public async getUploadMediaUrl (): Promise<string> {
    log.verbose('PuppetWeChatBridge', 'getUploadMediaUrl()')

    try {
      return await this.proxyWechaty('getUploadMediaUrl')
    } catch (e) {
      log.silly('PuppetWeChatBridge', 'proxyWechaty(getUploadMediaUrl) exception: %s', (e as Error).message)
      throw e
    }
  }

  public async sendMedia (mediaData: WebMessageMediaPayload): Promise<boolean> {
    log.verbose('PuppetWeChatBridge', 'sendMedia(mediaData)')

    if (!mediaData.ToUserName) {
      throw new Error('UserName not found')
    }
    if (!mediaData.MediaId) {
      throw new Error('cannot say nothing')
    }
    try {
      return await this.proxyWechaty('sendMedia', mediaData)
    } catch (e) {
      log.error('PuppetWeChatBridge', 'sendMedia() exception: %s', (e as Error).message)
      throw e
    }
  }

  public async forward (baseData: WebMessageRawPayload, patchData: WebMessageRawPayload): Promise<boolean> {
    log.verbose('PuppetWeChatBridge', 'forward()')

    if (!baseData.ToUserName) {
      throw new Error('UserName not found')
    }
    if (!patchData.MMActualContent && !patchData.MMSendContent && !patchData.Content) {
      throw new Error('cannot say nothing')
    }
    try {
      return await this.proxyWechaty('forward', baseData, patchData)
    } catch (e) {
      log.error('PuppetWeChatBridge', 'forward() exception: %s', (e as Error).message)
      throw e
    }
  }

  /**
   * Proxy Call to Wechaty in Bridge
   */
  public async proxyWechaty (
    wechatyFunc : string,
    ...args     : any[]
  ): Promise<any> {
    log.silly('PuppetWeChatBridge', 'proxyWechaty(%s%s)',
      wechatyFunc,
      args.length === 0
        ? ''
        : ', ' + args.join(', '),
    )

    if (!this.page) {
      throw new Error('no page')
    }

    try {
      const noWechaty = await this.page.evaluate(() => {
        return typeof WechatyBro === 'undefined'
      })
      if (noWechaty) {
        const e = new Error('there is no WechatyBro in browser(yet)')
        throw e
      }
    } catch (e) {
      log.warn('PuppetWeChatBridge', 'proxyWechaty() noWechaty exception: %s', e as Error)
      throw e
    }

    const argsEncoded = Buffer.from(
      encodeURIComponent(
        JSON.stringify(args),
      ),
    ).toString('base64')
    // see: http://blog.sqrtthree.com/2015/08/29/utf8-to-b64/
    const argsDecoded = `JSON.parse(decodeURIComponent(window.atob('${argsEncoded}')))`

    const wechatyScript = `
      WechatyBro
        .${wechatyFunc}
        .apply(
          undefined,
          ${argsDecoded},
        )
    `.replace(/[\n\s]+/, ' ')
    // log.silly('PuppetWeChatBridge', 'proxyWechaty(%s, ...args) %s', wechatyFunc, wechatyScript)
    // console.log('proxyWechaty wechatyFunc args[0]: ')
    // console.log(args[0])

    try {
      const ret = await this.page.evaluate(wechatyScript)
      return ret
    } catch (e) {
      log.verbose('PuppetWeChatBridge', 'proxyWechaty(%s, %s) ', wechatyFunc, args.join(', '))
      log.warn('PuppetWeChatBridge', 'proxyWechaty() exception: %s', (e as Error).message)
      throw e
    }
  }

  public ding (data: any): void {
    log.verbose('PuppetWeChatBridge', 'ding(%s)', data || '')

    this.proxyWechaty('ding', data)
      .then(dongData => {
        return this.emit('dong', dongData)
      })
      .catch(e => {
        log.error('PuppetWeChatBridge', 'ding(%s) exception: %s', data, (e as Error).message)
        this.emit('error', e)
      })
  }

  public preHtmlToXml (text: string): string {
    log.verbose('PuppetWeChatBridge', 'preHtmlToXml()')

    const preRegex = /^<pre[^>]*>([^<]+)<\/pre>$/i
    const matches = text.match(preRegex)
    if (!matches) {
      return text
    }
    return unescapeHtml(matches[1])
  }

  public async innerHTML (): Promise<string> {
    const html = await this.evaluate(() => {
      return window.document.body.innerHTML
    })
    return html
  }

  /**
   * Throw if there's a blocked message
   */
  public async testBlockedMessage (text?: string): Promise<string | false> {
    if (!text) {
      text = await this.innerHTML()
    }
    if (!text) {
      throw new Error('testBlockedMessage() no text found!')
    }

    const textSnip = text.substr(0, 50).replace(/\n/, '')
    log.verbose('PuppetWeChatBridge', 'testBlockedMessage(%s)',
      textSnip)

    interface BlockedMessage {
      error?: {
        ret     : number,
        message : string,
      }
    }
    let obj: undefined | BlockedMessage

    try {
      // see unit test for detail
      const tryXmlText = this.preHtmlToXml(text)
      // obj = JSON.parse(toJson(tryXmlText))
      obj = await new Promise((resolve, reject) => {
        parseString(tryXmlText, { explicitArray: false }, (err: any, result) => {
          if (err) {
            return reject(err)
          }
          return resolve(result)
        })
      })
    } catch (e) {
      log.warn('PuppetWeChatBridge', 'testBlockedMessage() toJson() exception: %s', e as Error)
      return false
    }

    if (!obj) {
      // FIXME: when will this happen?
      log.warn('PuppetWeChatBridge', 'testBlockedMessage() toJson(%s) return empty obj', textSnip)
      return false
    }
    if (!obj.error) {
      return false
    }
    const ret     = +obj.error.ret
    const message =  obj.error.message

    log.warn('PuppetWeChatBridge', 'testBlockedMessage() error.ret=%s', ret)

    if (ret === 1203) {
      // <error>
      // <ret>1203</ret>
      // <message>当前登录环境异常。为了你的帐号安全，暂时不能登录web微信。你可以通过手机客户端或者windows微信登录。</message>
      // </error>
      return message
    }
    return message // other error message

    // return new Promise<string | false>(resolve => {
    //   parseString(tryXmlText, { explicitArray: false }, (err, obj: BlockedMessage) => {
    //     if (err) {  // HTML can not be parsed to JSON
    //       return resolve(false)
    //     }
    //     if (!obj) {
    //       // FIXME: when will this happen?
    //       log.warn('PuppetWeChatBridge', 'testBlockedMessage() parseString(%s) return empty obj', textSnip)
    //       return resolve(false)
    //     }
    //     if (!obj.error) {
    //       return resolve(false)
    //     }
    //     const ret     = +obj.error.ret
    //     const message =  obj.error.message

    //     log.warn('PuppetWeChatBridge', 'testBlockedMessage() error.ret=%s', ret)

    //     if (ret === 1203) {
    //       // <error>
    //       // <ret>1203</ret>
    //       // <message>当前登录环境异常。为了你的帐号安全，暂时不能登录web微信。你可以通过手机客户端或者windows微信登录。</message>
    //       // </error>
    //       return resolve(message)
    //     }
    //     return resolve(message) // other error message
    //   })
    // })
  }

  public async clickSwitchAccount (page: puppeteer.Page): Promise<boolean> {
    log.verbose('PuppetWeChatBridge', 'clickSwitchAccount()')

    // https://github.com/GoogleChrome/puppeteer/issues/537#issuecomment-334918553
    // async function listXpath(thePage: Page, xpath: string): Promise<ElementHandle[]> {
    //   log.verbose('PuppetWeChatBridge', 'clickSwitchAccount() listXpath()')

    //   try {
    //     const nodeHandleList = await (thePage as any).evaluateHandle(xpathInner => {
    //       const nodeList: Node[] = []
    //       const query = document.evaluate(xpathInner, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null)
    //       for (let i = 0, length = query.snapshotLength; i < length; ++i) {
    //         nodeList.push(query.snapshotItem(i))
    //       }
    //       return nodeList
    //     }, xpath)
    //     const properties = await nodeHandleList.getProperties()

    //     const elementHandleList:  ElementHandle[] = []
    //     const releasePromises:    Promise<void>[] = []

    //     for (const property of properties.values()) {
    //       const element = property.asElement()
    //       if (element)
    //         elementHandleList.push(element)
    //       else
    //         releasePromises.push(property.dispose())
    //     }
    //     await Promise.all(releasePromises)
    //     return elementHandleList
    //   } catch (e) {
    //     log.verbose('PuppetWeChatBridge', 'clickSwitchAccount() listXpath() exception: %s', e as Error)
    //     return []
    //   }
    // }

    // TODO: use page.$x() (with puppeteer v1.1 or above) to replace DIY version of listXpath() instead.
    // See: https://github.com/GoogleChrome/puppeteer/blob/v1.1.0/docs/api.md#pagexexpression

    const XPATH_SELECTOR
      = "//div[contains(@class,'association') and contains(@class,'show')]/a[@ng-click='qrcodeLogin()']"

    try {
      // const [button] = await listXpath(page, XPATH_SELECTOR)
      const [button] = await page.$x(XPATH_SELECTOR)
      if (button) {
        await button.click()
        log.silly('PuppetWeChatBridge', 'clickSwitchAccount() clicked!')
        return true

      } else {
        log.silly('PuppetWeChatBridge', 'clickSwitchAccount() button not found')
        return false
      }

    } catch (e) {
      log.silly('PuppetWeChatBridge', 'clickSwitchAccount() exception: %s', e as Error)
      throw e
    }
  }

  public async hostname (): Promise<string | null> {
    log.verbose('PuppetWeChatBridge', 'hostname()')

    if (!this.page) {
      throw new Error('no page')
    }

    try {
      const hostname = await this.page.evaluate(() => window.location.hostname)
      log.silly('PuppetWeChatBridge', 'hostname() got %s', hostname)
      return hostname
    } catch (e) {
      log.error('PuppetWeChatBridge', 'hostname() exception: %s', e as Error)
      this.emit('error', e)
      return null
    }
  }

  public async cookies (cookieList: Cookie[]): Promise<void>
  public async cookies (): Promise<Cookie[]>

  public async cookies (cookieList?: puppeteer.Protocol.Network.Cookie[]): Promise<void | puppeteer.Protocol.Network.Cookie[]> {
    if (!this.page) {
      throw new Error('no page')
    }

    if (cookieList) {
      try {
        await this.page.setCookie(...cookieList)
      } catch (e) {
        log.error('PuppetWeChatBridge', 'cookies(%s) reject: %s', cookieList, e as Error)
        this.emit('error', e)
      }
      // RETURN
    } else {
      cookieList = await this.page.cookies()
      return cookieList
    }
  }

  /**
   * name
   */
  public entryUrl (cookieList?: puppeteer.Protocol.Network.Cookie[]): string {
    log.verbose('PuppetWeChatBridge', 'cookieDomain(%s)', cookieList)

    /**
     * `?target=t` is from https://github.com/wechaty/wechaty-puppet-wechat/pull/129
     */
    const DEFAULT_URL = 'https://wx.qq.com'

    if (!cookieList || cookieList.length === 0) {
      log.silly('PuppetWeChatBridge', 'cookieDomain() no cookie, return default %s', DEFAULT_URL)
      return DEFAULT_URL
    }

    const wxCookieList = cookieList.filter(c => /^webwx_auth_ticket|webwxuvid$/.test(c.name))
    if (!wxCookieList.length) {
      log.silly('PuppetWeChatBridge', 'cookieDomain() no valid cookie, return default hostname')
      return DEFAULT_URL
    }
    let domain = wxCookieList[0]!.domain
    if (!domain) {
      log.silly('PuppetWeChatBridge', 'cookieDomain() no valid domain in cookies, return default hostname')
      return DEFAULT_URL
    }

    domain = domain.slice(1)
    if (domain === 'wechat.com') {
      domain = 'web.wechat.com'
    }

    let url
    if (/^http/.test(domain)) {
      url = domain
    } else {
      // Protocol error (Page.navigate): Cannot navigate to invalid URL undefined
      url = `https://${domain}`
    }
    log.silly('PuppetWeChatBridge', 'cookieDomain() got %s', url)

    return url
  }

  public async reload (): Promise<void> {
    log.verbose('PuppetWeChatBridge', 'reload()')

    if (!this.page) {
      throw new Error('no page')
    }

    await this.page.reload()
  }

  public async evaluate (fn: () => any, ...args: any[]): Promise<any> {
    log.silly('PuppetWeChatBridge', 'evaluate()')

    if (!this.page) {
      throw new Error('no page')
    }

    try {
      return await this.page.evaluate(fn, ...args)
    } catch (e) {
      log.error('PuppetWeChatBridge', 'evaluate() exception: %s', e as Error)
      this.emit('error', e)
      return null
    }
  }

}

export default Bridge
