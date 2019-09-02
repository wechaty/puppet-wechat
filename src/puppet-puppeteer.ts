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

// tslint:disable:member-ordering
// tslint:disable:arrow-parens
// tslint:disable:object-literal-key-quotes

import path    from 'path'
import nodeUrl from 'url'

import BufferList from 'bl'
import md5        from 'md5'
import mime       from 'mime'
import request    from 'request'
import {
  LaunchOptions,
}                 from 'puppeteer'

import {
  FileBox,
}                   from 'file-box'
import {
  ThrottleQueue,
}                   from 'rx-queue'
import {
  Watchdog,
  WatchdogFood,
}                   from 'watchdog'

import {
  ContactPayload,
  ContactType,

  FriendshipPayload,
  FriendshipPayloadConfirm,
  FriendshipPayloadReceive,
  FriendshipType,

  MessagePayload,
  MessageType,

  MiniProgramPayload,

  Puppet,
  PuppetOptions,
  PuppetQrcodeScanEvent,
  Receiver,

  RoomInvitationPayload,
  RoomMemberPayload,
  RoomPayload,

  throwUnsupportedError,

  UrlLinkPayload,
}                           from 'wechaty-puppet'

import {
  envStealthless,
  envHead,
  log,
  MEMORY_SLOT,
  qrCodeForChatie,
  VERSION,
}                           from './config'

import {
  messageFilename,
  messageRawPayloadParser,
  plainText,
  unescapeHtml,
}                           from './pure-function-helpers'

import {
  Bridge,
  Cookie,
}                           from './bridge'
import {
  Event,
}                           from './event'

import {
  WebAppMsgType,
  WebContactRawPayload,
  WebMediaType,
  WebMessageMediaPayload,
  WebMessageRawPayload,
  WebMessageType,
  WebRecomendInfo,
  WebRoomRawMember,
  WebRoomRawPayload,
}                           from './web-schemas'

export type ScanFoodType   = 'scan' | 'login' | 'logout'

export class PuppetPuppeteer extends Puppet {

  public static readonly VERSION = VERSION

  public bridge: Bridge

  public scanPayload? : PuppetQrcodeScanEvent
  public scanWatchdog : Watchdog<ScanFoodType>

  private fileId: number

  constructor (
    public options: PuppetOptions = {},
  ) {
    super(options)

    this.fileId = 0
    this.bridge = new Bridge({
      endpoint      : options.endpoint,
      head          : typeof options.head === 'boolean' ? options.head : envHead(),
      launchOptions : options.launchOptions as LaunchOptions,
      memory        : this.memory,
      stealthless   : typeof options.stealthless === 'boolean' ? options.stealthless : envStealthless(),
    })

    const SCAN_TIMEOUT  = 2 * 60 * 1000 // 2 minutes
    this.scanWatchdog   = new Watchdog<ScanFoodType>(SCAN_TIMEOUT, 'Scan')

    this.initWatchdogForScan()
  }

  public async start (): Promise<void> {
    log.verbose('PuppetPuppeteer', `start() with ${this.memory.name}`)

    this.state.on('pending')

    try {
      /**
       * Overwrite the memory in bridge
       * because it could be changed between constructor() and start()
       */
      this.bridge.options.memory = this.memory

      // this.initWatchdog()
      // this.initWatchdogForScan()

      this.bridge = await this.initBridge()
      log.verbose('PuppetPuppeteer', 'initBridge() done')

      /**
       *  state must set to `live`
       *  before feed Watchdog
       */
      this.state.on(true)

      /**
       * Feed the dog and start watch
       */
      const food: WatchdogFood = {
        data: 'inited',
        timeout: 2 * 60 * 1000, // 2 mins for first login
      }
      this.emit('watchdog', food)

      /**
       * Save cookie for every 5 minutes
       */
      const throttleQueue = new ThrottleQueue(5 * 60 * 1000)
      this.on('watchdog', data => throttleQueue.next(data))
      throttleQueue.subscribe(async (data: any) => {
        log.verbose('PuppetPuppeteer', 'start() throttleQueue.subscribe() new item: %s', data)
        await this.saveCookie()
      })

      log.verbose('PuppetPuppeteer', 'start() done')

      // this.emit('start')
      return

    } catch (e) {
      log.error('PuppetPuppeteer', 'start() exception: %s', e)

      // this.state.off(true)
      this.emit('error', e)
      await this.stop()

      throw e
    }
  }

  /**
   * Deal with SCAN events
   *
   * if web browser stay at login qrcode page long time,
   * sometimes the qrcode will not refresh, leave there expired.
   * so we need to refresh the page after a while
   */
  private initWatchdogForScan (): void {
    log.verbose('PuppetPuppeteer', 'initWatchdogForScan()')

    const puppet = this
    const dog    = this.scanWatchdog

    // clean the dog because this could be re-inited
    // dog.removeAllListeners()

    puppet.on('scan', info => dog.feed({
      data: info,
      type: 'scan',
    }))
    puppet.on('login',  (/* user */) => {
      // dog.feed({
      //   data: user,
      //   type: 'login',
      // })
      // do not monitor `scan` event anymore
      // after user login
      dog.sleep()
    })

    // active monitor again for `scan` event
    puppet.on('logout', user => dog.feed({
      data: user,
      type: 'logout',
    }))

    dog.on('reset', async (food, timePast) => {
      log.warn('PuppetPuppeteer', 'initScanWatchdog() on(reset) lastFood: %s, timePast: %s',
        food.data, timePast
      )
      try {
        await this.bridge.reload()
      } catch (e) {
        log.error('PuppetPuppeteer', 'initScanWatchdog() on(reset) exception: %s', e)
        try {
          log.error('PuppetPuppeteer', 'initScanWatchdog() on(reset) try to recover by bridge.{quit,init}()', e)
          await this.bridge.stop()
          await this.bridge.start()
          log.error('PuppetPuppeteer', 'initScanWatchdog() on(reset) recover successful')
        } catch (e) {
          log.error('PuppetPuppeteer', 'initScanWatchdog() on(reset) recover FAIL: %s', e)
          this.emit('error', e)
        }
      }
    })
  }

  public async stop (): Promise<void> {
    log.verbose('PuppetPuppeteer', 'stop()')

    if (this.state.off()) {
      log.warn('PuppetPuppeteer', 'stop() is called on a OFF puppet. await ready(off) and return.')
      await this.state.ready('off')
      return
    }
    this.state.off('pending')

    log.verbose('PuppetPuppeteer', 'stop() make watchdog sleep before do stop')

    /**
     * Clean listeners for `watchdog`
     */
    // this.watchdog.sleep()
    this.scanWatchdog.sleep()
    // this.watchdog.removeAllListeners()
    this.scanWatchdog.removeAllListeners()
    this.removeAllListeners('watchdog')

    try {
      await this.bridge.stop()
      // register the removeListeners micro task at then end of the task queue
      setImmediate(() => this.bridge.removeAllListeners())
    } catch (e) {
      log.error('PuppetPuppeteer', 'this.bridge.quit() exception: %s', e.message)
      throw e
    } finally {
      this.state.off(true)
      // this.emit('stop')
    }

  }

  private async initBridge (): Promise<Bridge> {
    log.verbose('PuppetPuppeteer', 'initBridge()')

    if (this.state.off()) {
      const e = new Error('initBridge() found targetState != live, no init anymore')
      log.warn('PuppetPuppeteer', e.message)
      throw e
    }

    this.bridge.on('dong',      data => this.emit('dong', data))
    // this.bridge.on('ding'     , Event.onDing.bind(this))
    this.bridge.on('heartbeat', data => this.emit('watchdog', { data, type: 'bridge ding' }))

    this.bridge.on('error',     e => this.emit('error', e))
    this.bridge.on('log',       Event.onLog.bind(this))
    this.bridge.on('login',     Event.onLogin.bind(this))
    this.bridge.on('logout',    Event.onLogout.bind(this))
    this.bridge.on('message',   Event.onMessage.bind(this))
    this.bridge.on('scan',      Event.onScan.bind(this))
    this.bridge.on('unload',    Event.onUnload.bind(this))

    try {
      await this.bridge.start()
    } catch (e) {
      log.error('PuppetPuppeteer', 'initBridge() exception: %s', e.message)
      await this.bridge.stop().catch(e => {
        log.error('PuppetPuppeteer', 'initBridge() this.bridge.stop() rejection: %s', e)
      })
      this.emit('error', e)

      throw e
    }

    return this.bridge
  }

  public async messageRawPayload (id: string): Promise <WebMessageRawPayload> {
    const rawPayload = await this.bridge.getMessage(id)
    return rawPayload
  }

  public async messageRawPayloadParser (
    rawPayload: WebMessageRawPayload,
  ): Promise<MessagePayload> {
    log.verbose('PuppetPuppeteer', 'messageRawPayloadParser(%s) @ %s', rawPayload, this)

    const payload = messageRawPayloadParser(rawPayload)

    return payload
  }

  public async messageFile (messageId: string): Promise<FileBox> {
    const rawPayload = await this.messageRawPayload(messageId)
    const fileBox    = await this.messageRawPayloadToFile(rawPayload)
    return fileBox
  }

  public async messageUrl (messageId: string)  : Promise<UrlLinkPayload> {
    return throwUnsupportedError(messageId)
  }

  public async messageMiniProgram (messageId: string): Promise<MiniProgramPayload> {
    log.verbose('PuppetPuppeteer', 'messageMiniProgram(%s)', messageId)
    return throwUnsupportedError(messageId)
  }

  private async messageRawPayloadToFile (
    rawPayload: WebMessageRawPayload,
  ): Promise<FileBox> {
    let url = await this.messageRawPayloadToUrl(rawPayload)

    if (!url) {
      throw new Error('no url for type ' + MessageType[rawPayload.MsgType])
    }

    // use http instead of https, because https will only success on the very first request!
    url = url.replace(/^https/i, 'http')
    const parsedUrl = new nodeUrl.URL(url)

    const msgFileName = messageFilename(rawPayload)

    if (!msgFileName) {
      throw new Error('no filename')
    }

    const cookies = await this.cookies()

    const headers = {
      Accept: '*/*',
      // 'Accept-Encoding': 'gzip, deflate, sdch',
      // 'Accept-Encoding': 'gzip, deflate, sdch, br', // MsgType.IMAGE | VIDEO
      'Accept-Encoding': 'identity;q=1, *;q=0',

      'Accept-Language': 'zh-CN,zh;q=0.8', // MsgType.IMAGE | VIDEO
      // 'Accept-Language': 'zh-CN,zh;q=0.8,zh-TW;q=0.6,en-US;q=0.4,en;q=0.2',

      Cookie: cookies.map(c => `${c.name}=${c.value}`).join('; '),

      // Accept: 'image/webp,image/*,*/*;q=0.8',
      // Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8', //  MsgType.IMAGE | VIDEO

      Host: parsedUrl.hostname!, // 'wx.qq.com',  // MsgType.VIDEO | IMAGE

      Range: 'bytes=0-',
      // Referer: protocol + '//wx.qq.com/',
      Referer: url,

      // 'Upgrade-Insecure-Requests': 1, // MsgType.VIDEO | IMAGE

      /**
       * pgv_pvi=6639183872; pgv_si=s8359147520; webwx_data_ticket=gSeBbuhX+0kFdkXbgeQwr6Ck
       */
      'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64) '
                    + 'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/50.0.2661.102 Safari/537.36',
    }

    const fileBox = FileBox.fromUrl(url, msgFileName, headers)

    return fileBox
  }

  public async messageSendUrl (
    to             : Receiver,
    urlLinkPayload : UrlLinkPayload,
  ) : Promise<void> {
    throwUnsupportedError(to, urlLinkPayload)
  }

  public async messageSendMiniProgram (receiver: Receiver, miniProgramPayload: MiniProgramPayload): Promise<void> {
    log.verbose('PuppetPuppeteer', 'messageSendMiniProgram("%s", %s)',
      JSON.stringify(receiver),
      JSON.stringify(miniProgramPayload),
    )
    throwUnsupportedError(receiver, miniProgramPayload)
  }

  /**
   * TODO: Test this function if it could work...
   */
  // public async forward(baseData: MsgRawObj, patchData: MsgRawObj): Promise<boolean> {
  public async messageForward (
    receiver  : Receiver,
    messageId : string,
  ): Promise<void> {

    log.silly('PuppetPuppeteer', 'forward(receiver=%s, messageId=%s)',
      receiver,
      messageId,
    )

    let rawPayload = await this.messageRawPayload(messageId)

    // rawPayload = Object.assign({}, rawPayload)

    const newMsg = {} as WebMessageRawPayload
    const largeFileSize = 25 * 1024 * 1024
    // let ret = false
    // if you know roomId or userId, you can use `Room.load(roomId)` or `Contact.load(userId)`
    // let sendToList: Contact[] = [].concat(sendTo as any || [])
    // sendToList = sendToList.filter(s => {
    //   if ((s instanceof Room || s instanceof Contact) && s.id) {
    //     return true
    //   }
    //   return false
    // }) as Contact[]
    // if (sendToList.length < 1) {
    //   throw new Error('param must be Room or Contact and array')
    // }
    if (rawPayload.FileSize >= largeFileSize && !rawPayload.Signature) {
      // if has RawObj.Signature, can forward the 25Mb+ file
      log.warn('MediaMessage', 'forward() Due to webWx restrictions, '
                                + 'more than 25MB of files can not be downloaded and can not be forwarded.')
      throw new Error('forward() Due to webWx restrictions, '
                        + 'more than 25MB of files can not be downloaded and can not be forwarded.')
    }

    newMsg.FromUserName         = this.id || ''
    newMsg.isTranspond          = true
    newMsg.MsgIdBeforeTranspond = rawPayload.MsgIdBeforeTranspond || rawPayload.MsgId
    newMsg.MMSourceMsgId        = rawPayload.MsgId
    // In room msg, the content prefix sender:, need to be removed,
    // otherwise the forwarded sender will display the source message sender,
    // causing self () to determine the error
    newMsg.Content      = unescapeHtml(
      rawPayload.Content.replace(/^@\w+:<br\/>/, '')
    ).replace(/^[\w-]+:<br\/>/, '')
    newMsg.MMIsChatRoom = !!(receiver.roomId)

    // The following parameters need to be overridden after calling createMessage()

    rawPayload = Object.assign(rawPayload, newMsg)
    // for (let i = 0; i < sendToList.length; i++) {
    // newMsg.ToUserName = sendToList[i].id
    // // all call success return true
    // ret = (i === 0 ? true : ret) && await config.puppetInstance().forward(m, newMsg)
    // }
    newMsg.ToUserName = receiver.contactId || receiver.roomId as string
    // ret = await config.puppetInstance().forward(m, newMsg)
    // return ret
    const baseData  = rawPayload
    const patchData = newMsg

    try {
      const ret = await this.bridge.forward(baseData, patchData)
      if (!ret) {
        throw new Error('forward failed')
      }
    } catch (e) {
      log.error('PuppetPuppeteer', 'forward() exception: %s', e.message)
      throw e
    }
  }

  public async messageSendText (
    receiver : Receiver,
    text     : string,
  ): Promise<void> {
    log.verbose('PuppetPuppeteer', 'messageSendText(receiver=%s, text=%s)', JSON.stringify(receiver), text)

    let destinationId

    if (receiver.roomId) {
      destinationId = receiver.roomId
    } else if (receiver.contactId) {
      destinationId = receiver.contactId
    } else {
      throw new Error('PuppetPuppeteer.messageSendText(): message with neither room nor to?')
    }

    log.silly('PuppetPuppeteer', 'messageSendText() destination: %s, text: %s)',
      destinationId,
      text,
    )

    try {
      await this.bridge.send(destinationId, text)
    } catch (e) {
      log.error('PuppetPuppeteer', 'messageSendText() exception: %s', e.message)
      throw e
    }
  }

  public async login (userId: string): Promise<void> {
    return super.login(userId)
  }

  /**
   * logout from browser, then server will emit `logout` event
   */
  public async logout (): Promise<void> {
    log.verbose('PuppetPuppeteer', 'logout()')

    const user = this.selfId()
    if (!user) {
      log.warn('PuppetPuppeteer', 'logout() without self()')
      return
    }

    try {
      await this.bridge.logout()
    } catch (e) {
      log.error('PuppetPuppeteer', 'logout() exception: %s', e.message)
      throw e
    } finally {
      this.id = undefined
      this.emit('logout', user)
    }
  }

  /**
   *
   * ContactSelf
   *
   *
   */
  public async contactSelfQrcode (): Promise<string> {
    return throwUnsupportedError()
  }

  public async contactSelfName (name: string): Promise<void> {
    return throwUnsupportedError(name)
  }

  public async contactSelfSignature (signature: string): Promise<void> {
    return throwUnsupportedError(signature)
  }

  /**
   *
   * Contact
   *
   */
  public async contactRawPayload (id: string): Promise<WebContactRawPayload> {
    log.silly('PuppetPuppeteer', 'contactRawPayload(%s) @ %s', id, this)
    try {
      const rawPayload = await this.bridge.getContact(id) as WebContactRawPayload
      return rawPayload
    } catch (e) {
      log.error('PuppetPuppeteer', 'contactRawPayload(%s) exception: %s', id, e.message)
      throw e
    }

  }

  public async contactRawPayloadParser (
    rawPayload: WebContactRawPayload,
  ): Promise<ContactPayload> {
    log.silly('PuppetPuppeteer', 'contactParseRawPayload(Object.keys(payload).length=%d)',
      Object.keys(rawPayload).length,
    )
    if (!Object.keys(rawPayload).length) {
      log.error('PuppetPuppeteer', 'contactParseRawPayload(Object.keys(payload).length=%d)',
        Object.keys(rawPayload).length,
      )
      log.error('PuppetPuppeteer', 'contactParseRawPayload() got empty rawPayload!')
      throw new Error('empty raw payload')
      // return {
      //   gender: Gender.Unknown,
      //   type:   Contact.Type.Unknown,
      // }
    }

    // this.id = rawPayload.UserName
    // MMActualSender??? MMPeerUserName??? `getUserContact(message.MMActualSender,message.MMPeerUserName).HeadImgUrl`

    // uin:        rawPayload.Uin,    // stable id: 4763975 || getCookie("wxuin")

    return {
      address:    rawPayload.Alias, // XXX: need a stable address for user
      alias:      rawPayload.RemarkName,
      avatar:     rawPayload.HeadImgUrl,
      city:       rawPayload.City,
      friend:     rawPayload.stranger === undefined
        ? undefined
        : !rawPayload.stranger, // assign by injectio.js
      gender:     rawPayload.Sex,
      id:         rawPayload.UserName,
      name:       plainText(rawPayload.NickName || ''),
      province:   rawPayload.Province,
      signature:  rawPayload.Signature,
      star:       !!rawPayload.StarFriend,
      /**
        * @see 1. https://github.com/Chatie/webwx-app-tracker/blob/
        *  7c59d35c6ea0cff38426a4c5c912a086c4c512b2/formatted/webwxApp.js#L3243
        * @see 2. https://github.com/Urinx/WeixinBot/blob/master/README.md
        * @ignore
        */
      type:      (!!rawPayload.UserName && !rawPayload.UserName.startsWith('@@') && !!(rawPayload.VerifyFlag & 8))
        ? ContactType.Official
        : ContactType.Personal,
      weixin:     rawPayload.Alias,  // Wechat ID
    }
  }

  public ding (data?: string): void {
    log.verbose('PuppetPuppeteer', 'ding(%s)', data || '')
    this.bridge.ding(data)
  }

  public async contactAvatar (contactId: string)                : Promise<FileBox>
  public async contactAvatar (contactId: string, file: FileBox) : Promise<void>

  public async contactAvatar (contactId: string, file?: FileBox): Promise<void | FileBox> {
    log.verbose('PuppetPuppeteer', 'contactAvatar(%s)', contactId)

    if (file) {
      throw new Error('not support')
    }

    const payload = await this.contactPayload(contactId)
    if (!payload.avatar) {
      throw new Error('Can not get avatar: no payload.avatar!')
    }

    try {
      const hostname = await this.hostname()
      const avatarUrl = `http://${hostname}${payload.avatar}&type=big` // add '&type=big' to get big image
      const cookieList = await this.cookies()
      log.silly('PuppeteerContact', 'avatar() url: %s', avatarUrl)

      /**
       * FileBox headers (will be used in NodeJS.http.get param options)
       */
      const headers = {
        cookie: cookieList.map(
          c => `${c.name}=${c.value}`
        ).join('; '),
      }

      const fileName = (payload.name || 'unknown') + '-avatar.jpg'
      return FileBox.fromUrl(
        avatarUrl,
        fileName,
        headers,
      )

    } catch (err) {
      log.warn('PuppeteerContact', 'avatar() exception: %s', err.stack)
      throw err
    }
  }

  public async contactQrcode (contactId: string): Promise<string> {
    if (contactId !== this.selfId()) {
      throw new Error('can not set avatar for others')
    }

    throw new Error('not supported')
    // return await this.bridge.WXqr
  }

  public contactAlias (contactId: string)                      : Promise<string>
  public contactAlias (contactId: string, alias: string | null): Promise<void>

  public async contactAlias (
    contactId : string,
    alias?    : string | null,
  ): Promise<string | void> {
    if (typeof alias === 'undefined') {
      throw new Error('to be implement')
    }

    try {
      const ret = await this.bridge.contactAlias(contactId, alias)
      if (!ret) {
        log.warn('PuppetPuppeteer', 'contactRemark(%s, %s) bridge.contactAlias() return false',
          contactId, alias,
        )
        throw new Error('bridge.contactAlias fail')
      }
    } catch (e) {
      log.warn('PuppetPuppeteer', 'contactRemark(%s, %s) rejected: %s', contactId, alias, e.message)
      throw e
    }
  }

  public async contactList (): Promise<string[]> {
    const idList = await this.bridge.contactList()
    return idList
  }

  /**
   *
   * Room
   *
   */
  public async roomRawPayload (id: string): Promise<WebRoomRawPayload> {
    log.verbose('PuppetPuppeteer', 'roomRawPayload(%s)', id)

    try {
      let rawPayload: undefined | WebRoomRawPayload
      // = await this.bridge.getContact(room.id) as PuppeteerRoomRawPayload

      // let currNum = rawPayload.MemberList && rawPayload.MemberList.length || 0
      // let prevNum = room.memberList().length
      // rawPayload && rawPayload.MemberList && this.rawObj.MemberList.length || 0

      let prevLength = 0

      /**
       * @todo use Misc.retry() to replace the following loop
       */
      let ttl = 7
      while (ttl--/* && currNum !== prevNum */) {
        rawPayload = await this.bridge.getContact(id) as undefined | WebRoomRawPayload

        if (rawPayload) {
          const currLength = (rawPayload.MemberList && rawPayload.MemberList.length) || 0

          log.silly('PuppetPuppeteer',
            `roomPayload() this.bridge.getContact(%s) `
              + `MemberList.length:(prev:%d, curr:%d) at ttl:%d`,
            id,
            prevLength,
            currLength,
            ttl,
          )

          if (prevLength === currLength) {
            log.silly('PuppetPuppeteer', `roomPayload() puppet.getContact(%s) done at ttl:%d with length:%d`,
              this.id,
              ttl,
              currLength,
            )
            return rawPayload
          }
          if (currLength >= prevLength) {
            prevLength = currLength
          } else {
            log.warn('PuppetPuppeteer', 'roomRawPayload() currLength(%d) <= prevLength(%d) ???',
              currLength,
              prevLength,
            )
          }
        }

        log.silly('PuppetPuppeteer', `roomPayload() puppet.getContact(${id}) retry at ttl:%d`, ttl)
        await new Promise(resolve => setTimeout(resolve, 1000)) // wait for 1 second
      }

      throw new Error('no payload')

    } catch (e) {
      log.error('PuppetPuppeteer', 'roomRawPayload(%s) exception: %s', id, e.message)
      throw e
    }
  }

  public async roomRawPayloadParser (
    rawPayload: WebRoomRawPayload,
  ): Promise<RoomPayload> {
    log.verbose('PuppetPuppeteer', 'roomRawPayloadParser(%s)', rawPayload)

    // const payload = await this.roomPayload(rawPayload.UserName)

    // console.log(rawPayload)
    // const memberList = (rawPayload.MemberList || [])
    //                     .map(m => this.Contact.load(m.UserName))
    // await Promise.all(memberList.map(c => c.ready()))

    const id            = rawPayload.UserName
    // const rawMemberList = rawPayload.MemberList || []
    // const memberIdList  = rawMemberList.map(rawMember => rawMember.UserName)

    // const nameMap         = await this.roomParseMap('name'        , rawPayload.MemberList)
    // const roomAliasMap    = await this.roomParseMap('roomAlias'   , rawPayload.MemberList)
    // const contactAliasMap = await this.roomParseMap('contactAlias', rawPayload.MemberList)

    // const aliasDict = {} as { [id: string]: string | undefined }

    // if (Array.isArray(rawPayload.MemberList)) {
    //   rawPayload.MemberList.forEach(rawMember => {
    //     aliasDict[rawMember.UserName] = rawMember.DisplayName
    //   })
    //   // const memberListPayload = await Promise.all(
    //   //   rawPayload.MemberList
    //   //     .map(rawMember => rawMember.UserName)
    //   //     .map(contactId => this.contactPayload(contactId)),
    //   // )
    //   // console.log(memberListPayload)
    //   // memberListPayload.forEach(payload => aliasDict[payload.id] = payload.alias)
    //   // console.log(aliasDict)
    // }

    const memberIdList = rawPayload.MemberList
      ? rawPayload.MemberList.map(m => m.UserName)
      : []

    const roomPayload: RoomPayload = {
      id,
      memberIdList,
      topic: plainText(rawPayload.NickName || ''),
      // aliasDict,
      // nameMap,
      // roomAliasMap,
      // contactAliasMap,
    }
    // console.log(roomPayload)
    return roomPayload
  }

  public async roomList (): Promise<string[]> {
    log.verbose('PuppetPupppeteer', 'roomList()')

    const idList = await this.bridge.roomList()
    return idList
  }

  public async roomDel (
    roomId    : string,
    contactId : string,
  ): Promise<void> {
    try {
      await this.bridge.roomDelMember(roomId, contactId)
    } catch (e) {
      log.warn('PuppetPuppeteer', 'roomDelMember(%s, %d) rejected: %s', roomId, contactId, e.message)
      throw e
    }
  }

  public async roomAvatar (roomId: string): Promise<FileBox> {
    log.verbose('PuppetPuppeteer', 'roomAvatar(%s)', roomId)

    const payload = await this.roomPayload(roomId)

    if (payload.avatar) {
      return FileBox.fromUrl(payload.avatar)
    }
    log.warn('PuppetPuppeteer', 'roomAvatar() avatar not found, use the chatie default.')
    return qrCodeForChatie()
  }

  public async roomAdd (
    roomId    : string,
    contactId : string,
  ): Promise<void> {
    try {
      await this.bridge.roomAddMember(roomId, contactId)
    } catch (e) {
      log.warn('PuppetPuppeteer', 'roomAddMember(%s) rejected: %s', contactId, e.message)
      throw e
    }
  }

  public async roomTopic (roomId: string)                : Promise<string>
  public async roomTopic (roomId: string, topic: string) : Promise<void>

  public async roomTopic (
    roomId : string,
    topic? : string,
  ): Promise<void | string> {
    if (!topic) {
      const payload = await this.roomPayload(roomId)
      return payload.topic
    }

    try {
      await this.bridge.roomModTopic(roomId, topic)
    } catch (e) {
      log.warn('PuppetPuppeteer', 'roomTopic(%s) rejected: %s', topic, e.message)
      throw e
    }
  }

  public async roomCreate (
    contactIdList : string[],
    topic         : string,
  ): Promise<string> {
    try {
      const roomId = await this.bridge.roomCreate(contactIdList, topic)
      if (!roomId) {
        throw new Error('PuppetPuppeteer.roomCreate() roomId "' + roomId + '" not found')
      }
      return roomId

    } catch (e) {
      log.warn('PuppetPuppeteer', 'roomCreate(%s, %s) rejected: %s', contactIdList.join(','), topic, e.message)
      throw e
    }
  }

  public async roomAnnounce (roomId: string)                : Promise<string>
  public async roomAnnounce (roomId: string, text: string)  : Promise<void>

  public async roomAnnounce (roomId: string, text?: string) : Promise<void | string> {
    log.warn('PuppetPuppeteer', 'roomAnnounce(%s, %s) not supported', roomId, text || '')

    if (text) {
      return
    }
    return ''
  }

  public async roomQuit (roomId: string): Promise<void> {
    log.warn('PuppetPuppeteer', 'roomQuit(%s) not supported by Web API', roomId)
  }

  public async roomQrcode (roomId: string): Promise<string> {
    throw new Error('not support ' + roomId)
  }

  public async roomMemberList (roomId: string) : Promise<string[]> {
    log.verbose('PuppetPuppeteer', 'roommemberList(%s)', roomId)
    const rawPayload = await this.roomRawPayload(roomId)

    const memberIdList = (rawPayload.MemberList || [])
      .map(member => member.UserName)

    return memberIdList
  }

  public async roomMemberRawPayload (roomId: string, contactId: string): Promise<WebRoomRawMember>  {
    log.verbose('PuppetPuppeteer', 'roomMemberRawPayload(%s, %s)', roomId, contactId)
    const rawPayload = await this.roomRawPayload(roomId)

    const memberPayloadList = rawPayload.MemberList || []

    const memberPayloadResult = memberPayloadList.filter(payload => payload.UserName === contactId)
    if (memberPayloadResult.length > 0) {
      return memberPayloadResult[0]
    } else {
      throw new Error('not found')
    }
  }

  public async roomMemberRawPayloadParser (rawPayload: WebRoomRawMember): Promise<RoomMemberPayload>  {
    log.verbose('PuppetPuppeteer', 'roomMemberRawPayloadParser(%s)', rawPayload)

    const payload: RoomMemberPayload = {
      avatar    : rawPayload.HeadImgUrl,
      id        : rawPayload.UserName,
      name      : rawPayload.NickName,
      roomAlias : rawPayload.DisplayName,
    }
    return payload
  }

  /**
   *
   * Room Invitation
   *
   */
  public async roomInvitationAccept (roomInvitationId: string): Promise<void> {
    return throwUnsupportedError(roomInvitationId)
  }

  public async roomInvitationRawPayload (roomInvitationId: string): Promise<any> {
    return throwUnsupportedError(roomInvitationId)
  }

  public async roomInvitationRawPayloadParser (rawPayload: any): Promise<RoomInvitationPayload> {
    return throwUnsupportedError(rawPayload)
  }

  /**
   *
   * Friendship
   *
   */
  public async friendshipRawPayload (id: string): Promise<WebMessageRawPayload> {
    log.warn('PuppetPuppeteer', 'friendshipRawPayload(%s)', id)

    const rawPayload = await this.bridge.getMessage(id)
    if (!rawPayload) {
      throw new Error('no rawPayload')
    }
    return rawPayload
  }

  public async friendshipRawPayloadParser (rawPayload: WebMessageRawPayload): Promise<FriendshipPayload> {
    log.warn('PuppetPuppeteer', 'friendshipRawPayloadParser(%s)', rawPayload)

    const timestamp = Math.floor(Date.now() / 1000) // in seconds

    switch (rawPayload.MsgType) {
      case WebMessageType.VERIFYMSG:
        if (!rawPayload.RecommendInfo) {
          throw new Error('no RecommendInfo')
        }
        const recommendInfo: WebRecomendInfo = rawPayload.RecommendInfo

        if (!recommendInfo) {
          throw new Error('no recommendInfo')
        }

        const payloadReceive: FriendshipPayloadReceive = {
          contactId : recommendInfo.UserName,
          hello     : recommendInfo.Content,
          id        : rawPayload.MsgId,
          ticket    : recommendInfo.Ticket,
          timestamp,
          type      : FriendshipType.Receive,
        }
        return payloadReceive

      case WebMessageType.SYS:
        const payloadConfirm: FriendshipPayloadConfirm = {
          contactId : rawPayload.FromUserName,
          id        : rawPayload.MsgId,
          timestamp,
          type      : FriendshipType.Confirm,
        }
        return payloadConfirm
      default:
        throw new Error('not supported friend request message raw payload')
    }
  }

  public async friendshipAdd (
    contactId : string,
    hello     : string,
  ): Promise<void> {
    try {
      await this.bridge.verifyUserRequest(contactId, hello)
    } catch (e) {
      log.warn('PuppetPuppeteer', 'friendshipAdd() bridge.verifyUserRequest(%s, %s) rejected: %s',
        contactId,
        hello,
        e.message,
      )
      throw e
    }
  }

  public async friendshipAccept (
    friendshipId : string,
  ): Promise<void> {
    const payload = await this.friendshipPayload(friendshipId) as any as FriendshipPayloadReceive

    try {
      await this.bridge.verifyUserOk(payload.contactId, payload.ticket)
    } catch (e) {
      log.warn('PuppetPuppeteer', 'bridge.verifyUserOk(%s, %s) rejected: %s',
        payload.contactId,
        payload.ticket,
        e.message,
      )
      throw e
    }
  }

  /**
   * @private
   * For issue #668
   */
  public async waitStable (): Promise<void> {
    log.verbose('PuppetPuppeteer', 'waitStable()')

    let maxNum  = 0
    let curNum = 0
    let unchangedNum = 0

    const SLEEP_SECOND = 1
    const STABLE_CHECK_NUM = 3

    while (unchangedNum < STABLE_CHECK_NUM) {

      // wait 1 second
      await new Promise(resolve => setTimeout(resolve, SLEEP_SECOND * 1000))

      const contactList = await this.contactList()
      curNum = contactList.length

      if (curNum > 0 && curNum === maxNum) {
        unchangedNum++
      } else /* curNum < maxNum */ {
        unchangedNum = 0
      }

      if (curNum > maxNum) {
        maxNum = curNum
      }

      log.silly('PuppetPuppeteer', 'readyStable() while() curNum=%s, maxNum=%s, unchangedNum=%s',
        curNum, maxNum, unchangedNum,
      )

    }

    log.verbose('PuppetPuppeteer', 'readyStable() emit(ready)')
    this.emit('ready')
  }

  /**
   * https://www.chatie.io:8080/api
   * location.hostname = www.chatie.io
   * location.host = www.chatie.io:8080
   * See: https://stackoverflow.com/a/11379802/1123955
   */
  private async hostname (): Promise<string> {
    try {
      const name = await this.bridge.hostname()
      if (!name) {
        throw new Error('no hostname found')
      }
      return name
    } catch (e) {
      log.error('PuppetPuppeteer', 'hostname() exception:%s', e)
      this.emit('error', e)
      throw e
    }
  }

  private async cookies (): Promise<Cookie[]> {
    return this.bridge.cookies()
  }

  public async saveCookie (): Promise<void> {
    const cookieList = await this.bridge.cookies()
    await this.memory.set(MEMORY_SLOT, cookieList)
    await this.memory.save()
  }

  private extToType (ext: string): WebMessageType {
    switch (ext) {
      case '.bmp':
      case '.jpeg':
      case '.jpg':
      case '.png':
        return WebMessageType.IMAGE
      case '.gif':
        return WebMessageType.EMOTICON
      case '.mp4':
        return WebMessageType.VIDEO
      default:
        return WebMessageType.APP
    }
  }

  // public async readyMedia(): Promise<this> {
  private async messageRawPayloadToUrl (
    rawPayload: WebMessageRawPayload,
  ): Promise<null | string> {
    log.silly('PuppetPuppeteer', 'readyMedia()')

    // let type = MessageType.Unknown
    let url: undefined | string

    try {

      switch (rawPayload.MsgType) {
        case WebMessageType.EMOTICON:
          // type = MessageType.Emoticon
          url = await this.bridge.getMsgEmoticon(rawPayload.MsgId)
          break
        case WebMessageType.IMAGE:
          // type = MessageType.Image
          url = await this.bridge.getMsgImg(rawPayload.MsgId)
          break
        case WebMessageType.VIDEO:
        case WebMessageType.MICROVIDEO:
          // type = MessageType.Video
          url = await this.bridge.getMsgVideo(rawPayload.MsgId)
          break
        case WebMessageType.VOICE:
          // type = MessageType.Audio
          url = await this.bridge.getMsgVoice(rawPayload.MsgId)
          break

        case WebMessageType.APP:
          switch (rawPayload.AppMsgType) {
            case WebAppMsgType.ATTACH:
              if (!rawPayload.MMAppMsgDownloadUrl) {
                throw new Error('no MMAppMsgDownloadUrl')
              }
              // had set in Message
              // type = MessageType.Attachment
              url = rawPayload.MMAppMsgDownloadUrl
              break

            case WebAppMsgType.URL:
            case WebAppMsgType.READER_TYPE:
              if (!rawPayload.Url) {
                throw new Error('no Url')
              }
              // had set in Message
              // type = MessageType.Attachment
              url = rawPayload.Url
              break

            default:
              const e = new Error('ready() unsupported typeApp(): ' + rawPayload.AppMsgType)
              log.warn('PuppeteerMessage', e.message)
              throw e
          }
          break

        case WebMessageType.TEXT:
          if (rawPayload.SubMsgType === WebMessageType.LOCATION) {
            // type = MessageType.Image
            url = await this.bridge.getMsgPublicLinkImg(rawPayload.MsgId)
          }
          break

        default:
          /**
           * not a support media message, do nothing.
           */
          return null
          // return this
      }

      if (!url) {
        // if (!this.payload.url) {
        //   /**
        //    * not a support media message, do nothing.
        //    */
        //   return this
        // }
        // url = this.payload.url
        // return {
        //   type: MessageType.Unknown,
        // }
        return null
      }

    } catch (e) {
      log.warn('PuppetPuppeteer', 'ready() exception: %s', e.message)
      throw e
    }

    return url

  }

  private async uploadMedia (
    file       : FileBox,
    toUserName : string,
  ): Promise<WebMessageMediaPayload> {
    const filename = file.name
    const ext      = path.extname(filename) //  message.ext()

    // const contentType = Misc.mime(ext)
    const contentType = mime.getType(ext)
    // const contentType = message.mimeType()
    if (!contentType) {
      throw new Error('no MIME Type found on mediaMessage: ' + file.name)
    }
    let mediatype: WebMediaType

    switch (ext) {
      case '.bmp':
      case '.jpeg':
      case '.jpg':
      case '.png':
      case '.gif':
        mediatype = WebMediaType.Image
        break
      case '.mp4':
        mediatype = WebMediaType.Video
        break
      default:
        mediatype = WebMediaType.Attachment
    }

    const buffer = await new Promise<Buffer>((resolve, reject) => {
      file.pipe(new BufferList((err: Error, data: Buffer) => {
        if (err) reject(err)
        else resolve(data)
      }))
    })

    // Sending video files is not allowed to exceed 20MB
    // https://github.com/Chatie/webwx-app-tracker/blob/
    //  7c59d35c6ea0cff38426a4c5c912a086c4c512b2/formatted/webwxApp.js#L1115
    const MAX_FILE_SIZE   = 100 * 1024 * 1024
    const LARGE_FILE_SIZE = 25 * 1024 * 1024
    const MAX_VIDEO_SIZE  = 20 * 1024 * 1024

    if (mediatype === WebMediaType.Video && buffer.length > MAX_VIDEO_SIZE) {
      throw new Error(`Sending video files is not allowed to exceed ${MAX_VIDEO_SIZE / 1024 / 1024}MB`)
    }
    if (buffer.length > MAX_FILE_SIZE) {
      throw new Error(`Sending files is not allowed to exceed ${MAX_FILE_SIZE / 1024 / 1024}MB`)
    }

    const fileMd5 = md5(buffer)

    const baseRequest     = await this.getBaseRequest()
    const passTicket      = await this.bridge.getPassticket()
    const uploadMediaUrl  = await this.bridge.getUploadMediaUrl()
    const checkUploadUrl  = await this.bridge.getCheckUploadUrl()
    const cookie          = await this.bridge.cookies()
    const first           = cookie.find(c => c.name === 'webwx_data_ticket')
    const webwxDataTicket = first && first.value
    const size            = buffer.length
    const fromUserName    = this.selfId()
    const id              = 'WU_FILE_' + this.fileId
    this.fileId++

    const hostname = await this.bridge.hostname()
    const headers = {
      Cookie       : cookie.map(c => c.name + '=' + c.value).join('; '),
      Referer      : `https://${hostname}`,
      'User-Agent' : 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 '
                      + '(KHTML, like Gecko) Chrome/50.0.2661.102 Safari/537.36',
    }

    log.silly('PuppetPuppeteer', 'uploadMedia() headers:%s', JSON.stringify(headers))

    const uploadMediaRequest = {
      AESKey:        '',
      BaseRequest:   baseRequest,
      ClientMediaId: +new Date(),
      DataLen:       size,
      FileMd5:       fileMd5,
      FromUserName:  fromUserName,
      MediaType:     WebMediaType.Attachment,
      Signature:     '',
      StartPos:      0,
      ToUserName:    toUserName,
      TotalLen:      size,
      UploadType:    2,
    }

    const checkData = {
      BaseRequest:  baseRequest,
      FileMd5:      fileMd5,
      FileName:     filename,
      FileSize:     size,
      FileType:     7,              // If do not have this parameter, the api will fail
      FromUserName: fromUserName,
      ToUserName:   toUserName,
    }

    const mediaData = {
      FileMd5:    fileMd5,
      FileName:   filename,
      FileSize:   size,
      MMFileExt:  ext,
      MediaId:    '',
      ToUserName: toUserName,
    } as WebMessageMediaPayload

    // If file size > 25M, must first call checkUpload to get Signature and AESKey, otherwise it will fail to upload
    // https://github.com/Chatie/webwx-app-tracker/blob/
    //  7c59d35c6ea0cff38426a4c5c912a086c4c512b2/formatted/webwxApp.js#L1132 #1182
    if (size > LARGE_FILE_SIZE) {
      let ret
      try {
        ret = await new Promise<any>((resolve, reject) => {
          const r = {
            headers,
            json: checkData,
            url: `https://${hostname}${checkUploadUrl}`,
          }
          request.post(r, (err, _ /* res */, body) => {
            try {
              if (err) {
                reject(err)
              } else {
                let obj = body
                if (typeof body !== 'object') {
                  log.silly('PuppetPuppeteer', 'updateMedia() typeof body = %s', typeof body)
                  try {
                    obj = JSON.parse(body)
                  } catch (e) {
                    log.error('PuppetPuppeteer', 'updateMedia() body = %s', body)
                    log.error('PuppetPuppeteer', 'updateMedia() exception: %s', e)
                    this.emit('error', e)
                  }
                }
                if (typeof obj !== 'object' || obj.BaseResponse.Ret !== 0) {
                  const errMsg = obj.BaseResponse || 'api return err'
                  log.silly('PuppetPuppeteer', 'uploadMedia() checkUpload err:%s \nreq:%s\nret:%s',
                    JSON.stringify(errMsg), JSON.stringify(r), body)
                  reject(new Error('chackUpload err:' + JSON.stringify(errMsg)))
                }
                resolve({
                  AESKey    : obj.AESKey,
                  Signature : obj.Signature,
                })
              }
            } catch (e) {
              reject(e)
            }
          })
        })
      } catch (e) {
        log.error('PuppetPuppeteer', 'uploadMedia() checkUpload exception: %s', e.message)
        throw e
      }
      if (!ret.Signature) {
        log.error('PuppetPuppeteer', 'uploadMedia(): chackUpload failed to get Signature')
        throw new Error('chackUpload failed to get Signature')
      }
      uploadMediaRequest.Signature = ret.Signature
      uploadMediaRequest.AESKey    = ret.AESKey
      mediaData.Signature          = ret.Signature
    } else {
      delete uploadMediaRequest.Signature
      delete uploadMediaRequest.AESKey
    }

    log.verbose('PuppetPuppeteer', 'uploadMedia() webwx_data_ticket: %s', webwxDataTicket)
    log.verbose('PuppetPuppeteer', 'uploadMedia() pass_ticket: %s', passTicket)

    /**
     * If FILE.SIZE > 1M, file buffer need to split for upload.
     * Split strategy：
     *  BASE_LENGTH: 512 * 1024
     *  chunks: split number
     *  chunk: the index of chunks
     */
    const BASE_LENGTH = 512 * 1024
    const chunks = Math.ceil(buffer.length / BASE_LENGTH)

    const bufferData = []
    for (let i = 0; i < chunks; i++) {
      let tempBuffer = buffer.slice(i * BASE_LENGTH, (i + 1) * BASE_LENGTH)
      bufferData.push(tempBuffer)
    }

    async function getMediaId (buffer: Buffer, index: number) : Promise <string> {
      const formData = {
        chunk: index,
        chunks,
        filename: {
          options: {
            contentType,
            filename,
            size,
          },
          value: buffer,
        },
        id,
        lastModifiedDate: Date().toString(),
        mediatype,
        name: filename,
        pass_ticket: passTicket || '',
        size,
        type: contentType,
        uploadmediarequest: JSON.stringify(uploadMediaRequest),
        webwx_data_ticket: webwxDataTicket,
      }
      try {
        return await new Promise<string>((resolve, reject) => {
          try {
            request.post({
              formData,
              headers,
              url: uploadMediaUrl + '?f=json',
            }, (err, _, body) => {
              if (err) {
                reject(err)
              } else {
                let obj = body
                if (typeof body !== 'object') {
                  obj = JSON.parse(body)
                }
                resolve(obj.MediaId || '')
              }
            })
          } catch (e) {
            reject(e)
          }
        })
      } catch (e) {
        log.error('PuppetPuppeteer', 'uploadMedia() uploadMedia exception: %s', e.message)
        throw new Error('uploadMedia err: ' + e.message)
      }
    }
    let mediaId = ''
    for (let i = 0; i < bufferData.length; i++) {
      mediaId = await getMediaId(bufferData[i], i)
    }
    if (!mediaId) {
      log.error('PuppetPuppeteer', 'uploadMedia(): upload fail')
      throw new Error('PuppetPuppeteer.uploadMedia(): upload fail')
    }
    return Object.assign(mediaData, { MediaId: mediaId })
  }

  public async messageSendFile (
    receiver : Receiver,
    file     : FileBox,
  ): Promise<void> {
    log.verbose('PuppetPuppeteer', 'messageSendFile(receiver=%s, file=%s)',
      JSON.stringify(receiver),
      file.toString(),
    )

    let destinationId

    if (receiver.roomId) {
      destinationId = receiver.roomId
    } else if (receiver.contactId) {
      destinationId = receiver.contactId
    } else {
      throw new Error('PuppetPuppeteer.messageSendFile(): message with neither room nor to?')
    }

    let mediaData: WebMessageMediaPayload
    let rawPayload = {} as WebMessageRawPayload

    if (!rawPayload || !rawPayload.MediaId) {
      try {
        mediaData = await this.uploadMedia(file, destinationId)
        rawPayload = Object.assign(rawPayload, mediaData)
        log.silly('PuppetPuppeteer', 'Upload completed, new rawObj:%s', JSON.stringify(rawPayload))
      } catch (e) {
        log.error('PuppetPuppeteer', 'sendMedia() exception: %s', e.message)
        throw e
      }
    } else {
      // To support forward file
      log.silly('PuppetPuppeteer', 'skip upload file, rawObj:%s', JSON.stringify(rawPayload))
      mediaData = {
        FileName   : rawPayload.FileName,
        FileSize   : rawPayload.FileSize,
        MMFileExt  : rawPayload.MMFileExt,
        MediaId    : rawPayload.MediaId,
        MsgType    : rawPayload.MsgType,
        ToUserName : destinationId,
      }
      if (rawPayload.Signature) {
        mediaData.Signature = rawPayload.Signature
      }
    }
    // console.log('mediaData.MsgType', mediaData.MsgType)
    // console.log('rawObj.MsgType', message.rawObj && message.rawObj.MsgType)

    mediaData.MsgType = this.extToType(path.extname(file.name))
    log.silly('PuppetPuppeteer', 'sendMedia() destination: %s, mediaId: %s, MsgType; %s)',
      destinationId,
      mediaData.MediaId,
      mediaData.MsgType,
    )
    let ret = false
    try {
      ret = await this.bridge.sendMedia(mediaData)
    } catch (e) {
      log.error('PuppetPuppeteer', 'sendMedia() exception: %s', e.message)
      throw e
    }
    if (!ret) {
      throw new Error('sendMedia fail')
    }
  }

  public async messageSendContact (
    receiver  : Receiver,
    contactId : string,
  ): Promise<void> {
    log.verbose('PuppetPuppeteer', 'messageSend("%s", %s)', JSON.stringify(receiver), contactId)
    throw new Error('not support')
  }

  private async getBaseRequest (): Promise<any> {
    try {
      const json = await this.bridge.getBaseRequest()
      const obj = JSON.parse(json)
      return obj.BaseRequest
    } catch (e) {
      log.error('PuppetPuppeteer', 'send() exception: %s', e.message)
      throw e
    }
  }

  public unref (): void {
    log.verbose('PuppetPuppeteer', 'unref ()')
    super.unref()

    if (this.scanWatchdog) {
      this.scanWatchdog.unref()
    }

    // TODO: unref() the puppeteer
  }

}

export default PuppetPuppeteer
