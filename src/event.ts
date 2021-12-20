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
import type {
  WatchdogFood,
}                 from 'watchdog'
import { GError } from 'gerror'

import {
  log,
}                 from './config.js'
// import {
//   PuppetScanEvent,
// }                 from 'wechaty-puppet'

import {
  Firer,
}                         from './firer.js'
import type {
  PuppetWeChat,
}                         from './puppet-wechat.js'
import {
  WebMessageRawPayload,
  WebMessageType,
}                         from './web-schemas.js'

import {
  normalizeScanStatus,
}                         from './pure-function-helpers/normalize-scan-status.js'

export const Event = {
  onDing,

  onLog,
  onLogin,
  onLogout,

  onMessage,
  onScan,
  onUnload,

}

function onDing (
  this: PuppetWeChat,
  data: any,
): void {
  log.silly('PuppetWeChatEvent', 'onDing(%s)', data)
  this.emit('heartbeat', { data })
}

async function onScan (
  this    : PuppetWeChat,
  // Do not use PuppetScanPayload at here, use { code: number, url: string } instead,
  //  because this is related with Browser Hook Code:
  //    wechaty-bro.js
  payloadFromBrowser : { code: number, url: string },
): Promise<void> {
  log.verbose('PuppetWeChatEvent', 'onScan({code: %d, url: %s})', payloadFromBrowser.code, payloadFromBrowser.url)

  // if (this.state.inactive()) {
  //   log.verbose('PuppetWeChatEvent', 'onScan(%s) state.inactive()=%s, NOOP',
  //                                 payload, this.state.inactive())
  //   return
  // }

  this.scanPayload = {
    qrcode: payloadFromBrowser.url,
    status: payloadFromBrowser.code,
  }

  /**
   * When wx.qq.com push a new QRCode to Scan, there will be cookie updates(?)
   */
  await this.saveCookie()

  if (this.isLoggedIn) {
    log.verbose('PuppetWeChatEvent', 'onScan() there has user when got a scan event. emit logout and set it to null')
    await this.logout()
  }

  // feed watchDog a `scan` type of food
  const food: WatchdogFood = {
    data: payloadFromBrowser,
    type: 'scan',
  }
  this.emit('heartbeat', food)

  const qrcode = payloadFromBrowser.url.replace(/\/qrcode\//, '/l/')
  const status = normalizeScanStatus(payloadFromBrowser.code)

  this.emit('scan', { qrcode, status })
}

function onLog (data: any): void {
  log.silly('PuppetWeChatEvent', 'onLog(%s)', data)
}

async function onLogin (
  this: PuppetWeChat,
  note: string,
  ttl = 30,
): Promise<void> {
  log.verbose('PuppetWeChatEvent', 'onLogin(%s, %d)', note, ttl)

  const TTL_WAIT_MILLISECONDS = 1 * 1000
  if (ttl <= 0) {
    log.verbose('PuppetWeChatEvent', 'onLogin(%s) TTL expired')
    this.emit('error', GError.from('onLogin() TTL expired.'))
    return
  }

  // if (this.state.inactive()) {
  //   log.verbose('PuppetWeChatEvent', 'onLogin(%s, %d) state.inactive()=%s, NOOP',
  //                                 note, ttl, this.state.inactive())
  //   return
  // }

  if (this.isLoggedIn) {
    throw new Error('onLogin() user had already logined: ' + this.currentUserId)
    // await this.logout()
  }

  this.scanPayload = undefined

  try {
    /**
     * save login user id to this.userId
     *
     * issue #772: this.bridge might not inited if the 'login' event fired too fast(because of auto login)
     */
    const userId = await this.bridge.getUserName()

    if (!userId) {
      log.verbose('PuppetWeChatEvent', 'onLogin() browser not fully loaded(ttl=%d), retry later', ttl)
      const html = await this.bridge.innerHTML()
      log.silly('PuppetWeChatEvent', 'onLogin() innerHTML: %s', html.substr(0, 500))
      setTimeout(this.wrapAsync(onLogin.bind(this, note, ttl - 1)), TTL_WAIT_MILLISECONDS)
      return
    }

    log.silly('PuppetWeChatEvent', 'bridge.getUserName: %s', userId)

    // const user = this.Contact.load(userId)
    // await user.ready()

    log.silly('PuppetWeChatEvent', `onLogin() user ${userId} logined`)

    // if (this.state.active() === true) {
    await this.saveCookie()
    // }

    // fix issue https://github.com/Chatie/wechaty-puppet-wechat/issues/107
    // we do not wait `ready` before emit `login`
    this.waitStable().catch(e => {
      log.error('PuppetWeChatEvent', 'onLogin() this.waitStable() rejection: %s', e && (e as Error).message)
    })

    await this.login(userId)

  } catch (e) {
    log.error('PuppetWeChatEvent', 'onLogin() exception: %s', e as Error)
    throw e
  }
}

async function onLogout (
  this: PuppetWeChat,
  data: any,
): Promise<void> {
  log.verbose('PuppetWeChatEvent', 'onLogout(%s)', data)

  if (this.isLoggedIn) {
    await this.logout()
  } else {
    // not logged-in???
    log.error('PuppetWeChatEvent', 'onLogout() without self-user')
  }
}

async function onMessage (
  this       : PuppetWeChat,
  rawPayload : WebMessageRawPayload,
): Promise<void> {
  const firer = new Firer(this)

  /**
   * Fire Events if match message type & content
   */
  switch (rawPayload.MsgType) {

    case WebMessageType.VERIFYMSG:
      this.emit('friendship', { friendshipId: rawPayload.MsgId })
      // firer.checkFriendRequest(rawPayload)
      break

    case WebMessageType.SYS:
      /**
       * /^@@/.test() return true means it's a room
       */
      if (/^@@/.test(rawPayload.FromUserName)) {
        const joinResult  = await firer.checkRoomJoin(rawPayload)
        const leaveResult = await firer.checkRoomLeave(rawPayload)
        const topicRestul = await firer.checkRoomTopic(rawPayload)

        if (!joinResult && !leaveResult && !topicRestul) {
          log.silly('PuppetWeChatEvent', `checkRoomSystem message: <${rawPayload.Content}> not found`)
        }
      } else {
        await firer.checkFriendConfirm(rawPayload)
      }
      break
  }

  this.emit('message', { messageId: rawPayload.MsgId })
}

async function onUnload (this: PuppetWeChat): Promise<void> {
  log.silly('PuppetWeChatEvent', 'onUnload()')
  /*
  try {
    await this.quit()
    await this.init()
  } catch (e) {
    log.error('PuppetWeChatEvent', 'onUnload() exception: %s', e as Error)
    this.emit('error', e)
    throw e
  }
  */
}
