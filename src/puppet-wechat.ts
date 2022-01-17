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
import path    from 'path'
import nodeUrl from 'url'

import md5        from 'md5'
import mime       from 'mime'
import request    from 'request'
import type {
  LaunchOptions,
}                 from 'puppeteer'

import {
  ThrottleQueue,
}                           from 'rx-queue'
import {
  Watchdog,
  WatchdogFood,
}                           from 'watchdog'
import * as PUPPET          from 'wechaty-puppet'
import { log }              from 'wechaty-puppet'
import {
  FileBox,
  type FileBoxInterface,
}                           from 'file-box'

import {
  MEMORY_SLOT,
  qrCodeForChatie,
  VERSION,
}                           from './config.js'

import {
  messageFilename,
  messageRawPayloadParser,
  plainText,
  unescapeHtml,
  isRoomId,
}                           from './pure-function-helpers/mod.js'

import {
  Bridge,
  Cookie,
}                           from './bridge.js'
import {
  Event,
}                           from './event.js'
import * as envVars         from './env-vars.js'

import {
  WebAppMsgType,
  WebContactRawPayload,
  UploadMediaType,
  WebMessageMediaPayload,
  WebMessageRawPayload,
  WebMessageType,
  WebRoomRawMember,
  WebRoomRawPayload,
}                             from './web-schemas.js'
import { parseMentionIdList } from './pure-function-helpers/parse-mention-id-list.js'

export type ScanFoodType   = 'scan' | 'login' | 'logout'

type PuppetWeChatOptions = PUPPET.PuppetOptions & {
  head?          : boolean
  launchOptions? : LaunchOptions
  stealthless?   : boolean
  uos?           : boolean
}

export class PuppetWeChat extends PUPPET.Puppet {

  public static override readonly VERSION = VERSION

  public bridge: Bridge

  public scanPayload? : PUPPET.payloads.EventScan
  public scanWatchdog : Watchdog<ScanFoodType>

  private fileId: number

  constructor (
    public override options: PuppetWeChatOptions = {},
  ) {
    super(options)

    this.fileId = 0
    this.bridge = new Bridge({
      endpoint      : envVars.WECHATY_PUPPET_WECHAT_ENDPOINT(options.endpoint),
      head          : envVars.WECHATY_PUPPET_WECHAT_PUPPETEER_HEAD(options.head),
      launchOptions : options.launchOptions,
      memory        : this.memory,
      stealthless   : envVars.WECHATY_PUPPET_WECHAT_PUPPETEER_STEALTHLESS(options.stealthless),
      uos           : envVars.WECHATY_PUPPET_WECHAT_PUPPETEER_UOS(options.uos),
      uosExtSpam    : envVars.WECHATY_PUPPET_WECHAT_TOKEN(options.token),
    })

    const SCAN_TIMEOUT  = 2 * 60 * 1000 // 2 minutes
    this.scanWatchdog   = new Watchdog<ScanFoodType>(SCAN_TIMEOUT, 'Scan')

    this.initWatchdogForScan()
  }

  override async onStart (): Promise<void> {
    log.verbose('PuppetWeChat', `onStart() with ${this.memory.name}`)

    /**
     * Overwrite the memory in bridge
     * because it could be changed between constructor() and start()
     */
    this.bridge.options.memory = this.memory

    // this.initWatchdog()
    // this.initWatchdogForScan()

    this.bridge = await this.initBridge()
    log.verbose('PuppetWeChat', 'onStart() initBridge() done')

    /**
     * Feed the dog and start watch
     */
    const food: WatchdogFood = {
      data: 'inited',
      timeout: 2 * 60 * 1000, // 2 mins for first login
    }
    this.emit('heartbeat', food)

    /**
     * Save cookie for every 5 minutes
     */
    const throttleQueue = new ThrottleQueue(5 * 60 * 1000)
    this.on('heartbeat', data => throttleQueue.next(data))
    throttleQueue.subscribe((data: any) => {
      log.verbose('PuppetWeChat', 'onStart() throttleQueue.subscribe() new item: %s', data)
      this.wrapAsync(this.saveCookie())
    })
  }

  override async onStop (): Promise<void> {
    log.verbose('PuppetWeChat', 'onStop()')

    /**
     * Clean listeners for `watchdog`
     */
    // this.watchdog.sleep()
    this.scanWatchdog.sleep()
    // this.watchdog.removeAllListeners()
    this.scanWatchdog.removeAllListeners()
    this.removeAllListeners('watchdog' as any)

    await this.bridge.stop()
    // register the removeListeners micro task at then end of the task queue
    setImmediate(() => this.bridge.removeAllListeners())
  }

  /**
   * Deal with SCAN events
   *
   * if web browser stay at login qrcode page long time,
   * sometimes the qrcode will not refresh, leave there expired.
   * so we need to refresh the page after a while
   */
  private initWatchdogForScan (): void {
    log.verbose('PuppetWeChat', 'initWatchdogForScan()')

    const puppet = this
    const dog    = this.scanWatchdog

    // clean the dog because this could be re-inited
    // dog.removeAllListeners()

    puppet.on('scan', info => {
      dog.feed({
        data: info,
        type: 'scan',
      })
    })
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
    puppet.on('logout', user => {
      dog.feed({
        data: user,
        type: 'logout',
      })
    })

    dog.on('reset', this.wrapAsync(async (food, timePast) => {
      log.warn('PuppetWeChat', 'initScanWatchdog() on(reset) lastFood: %s, timePast: %s',
        food.data, timePast,
      )
      try {
        await this.bridge.reload()
      } catch (e) {
        log.error('PuppetWeChat', 'initScanWatchdog() on(reset) exception: %s', e as Error)
        try {
          log.error('PuppetWeChat', 'initScanWatchdog() on(reset) try to recover by bridge.{quit,init}()', e as Error)
          await this.bridge.stop()
          await this.bridge.start()
          log.error('PuppetWeChat', 'initScanWatchdog() on(reset) recover successful')
        } catch (e) {
          log.error('PuppetWeChat', 'initScanWatchdog() on(reset) recover FAIL: %s', e as Error)
          this.emit('error', e)
        }
      }
    }))
  }

  private async initBridge (): Promise<Bridge> {
    log.verbose('PuppetWeChat', 'initBridge()')

    if (this.state.inactive()) {
      const e = new Error('initBridge() found targetState != live, no init anymore')
      log.warn('PuppetWeChat', (e as Error).message)
      throw e
    }

    this.bridge.on('dong',      (data: string) => this.emit('dong', { data }))
    // this.bridge.on('ding'     , Event.onDing.bind(this))
    this.bridge.on('heartbeat', (data: string) => this.emit('heartbeat', { data: data + 'bridge ding' }))

    this.bridge.on('error',     (e: Error) => this.emit('error', e))
    this.bridge.on('log',       Event.onLog.bind(this))
    this.bridge.on('login',     this.wrapAsync(Event.onLogin.bind(this)))
    this.bridge.on('logout',    this.wrapAsync(Event.onLogout.bind(this)))
    this.bridge.on('message',   this.wrapAsync(Event.onMessage.bind(this)))
    this.bridge.on('scan',      this.wrapAsync(Event.onScan.bind(this)))
    this.bridge.on('unload',    this.wrapAsync(Event.onUnload.bind(this)))

    try {
      await this.bridge.start()
    } catch (e) {
      log.error('PuppetWeChat', 'initBridge() exception: %s', (e as Error).message)
      await this.bridge.stop().catch(e => {
        log.error('PuppetWeChat', 'initBridge() this.bridge.stop() rejection: %s', e as Error)
      })
      this.emit('error', e)

      throw e
    }

    return this.bridge
  }

  private async getBaseRequest (): Promise<any> {
    try {
      const json = await this.bridge.getBaseRequest()
      const obj = JSON.parse(json)
      return obj.BaseRequest
    } catch (e) {
      log.error('PuppetWeChat', 'send() exception: %s', (e as Error).message)
      throw e
    }
  }

  /**
   *
   * Message
   *
   */
  override async messageRawPayload (id: string): Promise <WebMessageRawPayload> {
    const rawPayload = await this.bridge.getMessage(id)
    return rawPayload
  }

  override async messageRawPayloadParser (
    rawPayload: WebMessageRawPayload,
  ): Promise<PUPPET.payloads.Message> {
    log.verbose('PuppetWeChat', 'messageRawPayloadParser(%s) @ %s', rawPayload, this)

    const payload = messageRawPayloadParser(rawPayload)

    /**
     * Huan(202109): generate mention id list
     *  https://github.com/wechaty/wechaty-puppet-wechat/issues/141
     */
    if (payload.roomId && payload.text) {
      (payload as PUPPET.payloads.MessageRoom).mentionIdList = await parseMentionIdList(this, payload.roomId, payload.text)
    }

    return payload
  }

  override async messageRecall (messageId: string): Promise<boolean> {
    return PUPPET.throwUnsupportedError(messageId)
  }

  override async messageFile (messageId: string): Promise<FileBoxInterface> {
    const rawPayload = await this.messageRawPayload(messageId)
    const fileBox    = await this.messageRawPayloadToFile(rawPayload)
    return fileBox
  }

  override async messageUrl (messageId: string)  : Promise<PUPPET.payloads.UrlLink> {
    return PUPPET.throwUnsupportedError(messageId)
  }

  override async messageMiniProgram (messageId: string): Promise<PUPPET.payloads.MiniProgram> {
    log.verbose('PuppetWeChat', 'messageMiniProgram(%s)', messageId)
    return PUPPET.throwUnsupportedError(messageId)
  }

  private async messageRawPayloadToFile (
    rawPayload: WebMessageRawPayload,
  ): Promise<FileBoxInterface> {
    const url = await this.messageRawPayloadToUrl(rawPayload)

    if (!url) {
      throw new Error('no url for type ' + PUPPET.types.Message[rawPayload.MsgType])
    }

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

  override async messageSendUrl (
    conversationId : string,
    urlLinkPayload : PUPPET.payloads.UrlLink,
  ) : Promise<void> {
    PUPPET.throwUnsupportedError(conversationId, urlLinkPayload)
  }

  override async messageSendMiniProgram (conversationId: string, miniProgramPayload: PUPPET.payloads.MiniProgram): Promise<void> {
    log.verbose('PuppetWeChat', 'messageSendMiniProgram("%s", %s)',
      conversationId,
      JSON.stringify(miniProgramPayload),
    )
    PUPPET.throwUnsupportedError(conversationId, miniProgramPayload)
  }

  /**
   * TODO: Test this function if it could work...
   */
  // public async forward(baseData: MsgRawObj, patchData: MsgRawObj): Promise<boolean> {
  override async messageForward (
    conversationId  : string,
    messageId : string,
  ): Promise<void> {

    log.silly('PuppetWeChat', 'forward(receiver=%s, messageId=%s)',
      conversationId,
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

    newMsg.FromUserName         = this.currentUserId
    newMsg.isTranspond          = true
    newMsg.MsgIdBeforeTranspond = rawPayload.MsgIdBeforeTranspond || rawPayload.MsgId
    newMsg.MMSourceMsgId        = rawPayload.MsgId
    // In room msg, the content prefix sender:, need to be removed,
    // otherwise the forwarded sender will display the source message sender,
    // causing self () to determine the error
    newMsg.Content      = unescapeHtml(
      rawPayload.Content.replace(/^@\w+:<br\/>/, ''),
    ).replace(/^[\w-]+:<br\/>/, '')
    newMsg.MMIsChatRoom = isRoomId(conversationId)

    // The following parameters need to be overridden after calling createMessage()

    rawPayload = Object.assign(rawPayload, newMsg)
    // for (let i = 0; i < sendToList.length; i++) {
    // newMsg.ToUserName = sendToList[i].id
    // // all call success return true
    // ret = (i === 0 ? true : ret) && await config.puppetInstance().forward(m, newMsg)
    // }
    newMsg.ToUserName = conversationId
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
      log.error('PuppetWeChat', 'forward() exception: %s', (e as Error).message)
      throw e
    }
  }

  override async messageSendText (
    conversationId : string,
    text           : string,
  ): Promise<void> {
    log.verbose('PuppetWeChat', 'messageSendText(%s, %s)', conversationId, text)

    try {
      await this.bridge.send(conversationId, text)
    } catch (e) {
      log.error('PuppetWeChat', 'messageSendText() exception: %s', (e as Error).message)
      throw e
    }
  }

  /**
   * logout from browser, then server will emit `logout` event
   */
  override async logout (reason?: string): Promise<void> {
    log.verbose('PuppetWeChat', 'logout(%s)', reason)

    if (!this.isLoggedIn) {
      log.warn('PuppetWeChat', 'logout() without self()')
      return
    }

    try {
      await this.bridge.logout()
    } catch (e) {
      log.error('PuppetWeChat', 'logout() exception: %s', (e as Error).message)
      throw e
    } finally {
      await super.logout(reason)
    }
  }

  /**
   *
   * ContactSelf
   *
   *
   */
  override async contactSelfQRCode (): Promise<string> {
    return PUPPET.throwUnsupportedError()
  }

  override async contactSelfName (name: string): Promise<void> {
    return PUPPET.throwUnsupportedError(name)
  }

  override async contactSelfSignature (signature: string): Promise<void> {
    return PUPPET.throwUnsupportedError(signature)
  }

  /**
   *
   * Contact
   *
   */
  override async contactRawPayload (id: string): Promise<WebContactRawPayload> {
    log.silly('PuppetWeChat', 'contactRawPayload(%s) @ %s', id, this)
    try {
      const rawPayload = await this.bridge.getContact(id) as WebContactRawPayload
      return rawPayload
    } catch (e) {
      log.error('PuppetWeChat', 'contactRawPayload(%s) exception: %s', id, (e as Error).message)
      throw e
    }

  }

  override async contactRawPayloadParser (
    rawPayload: WebContactRawPayload,
  ): Promise<PUPPET.payloads.Contact> {
    log.silly('PuppetWeChat', 'contactParseRawPayload(Object.keys(payload).length=%d)',
      Object.keys(rawPayload).length,
    )
    if (!Object.keys(rawPayload).length) {
      log.error('PuppetWeChat', 'contactParseRawPayload(Object.keys(payload).length=%d)',
        Object.keys(rawPayload).length,
      )
      log.error('PuppetWeChat', 'contactParseRawPayload() got empty rawPayload!')
      throw new Error('empty raw payload')
      // return {
      //   gender: Gender.Unknown,
      //   type:   Contact.Type.Unknown,
      // }
    }

    // this._currentUserId = rawPayload.UserName
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
      phone: [],
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
        ? PUPPET.types.Contact.Official
        : PUPPET.types.Contact.Individual,
      weixin:     rawPayload.Alias,  // Wechat ID
    }
  }

  override ding (data?: string): void {
    log.verbose('PuppetWeChat', 'ding(%s)', data || '')
    this.bridge.ding(data)
  }

  override async contactAvatar (contactId: string)                          : Promise<FileBoxInterface>
  override async contactAvatar (contactId: string, file: FileBoxInterface)  : Promise<void>

  override async contactAvatar (contactId: string, file?: FileBoxInterface) : Promise<void | FileBoxInterface> {
    log.verbose('PuppetWeChat', 'contactAvatar(%s)', contactId)

    if (file) {
      throw new Error('not support')
    }

    const payload = await this.contactPayload(contactId)
    if (!payload.avatar) {
      throw new Error('Can not get avatar: no payload.avatar!')
    }

    try {
      const hostname = await this.hostname()
      const avatarUrl = `https://${hostname}${payload.avatar}&type=big` // add '&type=big' to get big image
      const cookieList = await this.cookies()
      log.silly('PuppeteerContact', 'avatar() url: %s', avatarUrl)

      /**
       * FileBox headers (will be used in NodeJS.http.get param options)
       */
      const headers = {
        cookie: cookieList.map(
          c => `${c.name}=${c.value}`,
        ).join('; '),
      }

      const fileName = (payload.name || 'unknown') + '-avatar.jpg'
      return FileBox.fromUrl(
        avatarUrl,
        fileName,
        headers,
      )

    } catch (err) {
      log.warn('PuppeteerContact', 'avatar() exception: %s', (err as Error).stack)
      throw err
    }
  }

  override contactAlias (contactId: string)                      : Promise<string>
  override contactAlias (contactId: string, alias: string | null): Promise<void>

  override async contactAlias (
    contactId : string,
    alias?    : string | null,
  ): Promise<string | void> {
    if (typeof alias === 'undefined') {
      throw new Error('to be implement')
    }

    try {
      const ret = await this.bridge.contactAlias(contactId, alias)
      if (!ret) {
        log.warn('PuppetWeChat', 'contactRemark(%s, %s) bridge.contactAlias() return false',
          contactId, alias,
        )
        throw new Error('bridge.contactAlias fail')
      }
    } catch (e) {
      log.warn('PuppetWeChat', 'contactRemark(%s, %s) rejected: %s', contactId, alias, (e as Error).message)
      throw e
    }
  }

  override async contactList (): Promise<string[]> {
    const idList = await this.bridge.contactList()
    return idList
  }

  /**
   *
   * Room
   *
   */
  override async roomRawPayload (id: string): Promise<WebRoomRawPayload> {
    log.verbose('PuppetWeChat', 'roomRawPayload(%s)', id)

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

          log.silly('PuppetWeChat',
            'roomPayload() this.bridge.getContact(%s) '
              + 'MemberList.length:(prev:%d, curr:%d) at ttl:%d',
            id,
            prevLength,
            currLength,
            ttl,
          )

          if (prevLength === currLength) {
            log.silly('PuppetWeChat', 'roomPayload() puppet.getContact(%s) done at ttl:%d with length:%d',
              this.currentUserId,
              ttl,
              currLength,
            )
            return rawPayload
          }
          if (currLength >= prevLength) {
            prevLength = currLength
          } else {
            log.warn('PuppetWeChat', 'roomRawPayload() currLength(%d) <= prevLength(%d) ???',
              currLength,
              prevLength,
            )
          }
        }

        log.silly('PuppetWeChat', `roomPayload() puppet.getContact(${id}) retry at ttl:%d`, ttl)
        await new Promise(resolve => setTimeout(resolve, 1000)) // wait for 1 second
      }

      throw new Error('no payload')

    } catch (e) {
      log.error('PuppetWeChat', 'roomRawPayload(%s) exception: %s', id, (e as Error).message)
      throw e
    }
  }

  override async roomRawPayloadParser (
    rawPayload: WebRoomRawPayload,
  ): Promise<PUPPET.payloads.Room> {
    log.verbose('PuppetWeChat', 'roomRawPayloadParser(%s)', rawPayload)

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

    const roomPayload: PUPPET.payloads.Room = {
      adminIdList: [],
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

  override async roomList (): Promise<string[]> {
    log.verbose('PuppetPupppeteer', 'roomList()')

    const idList = await this.bridge.roomList()
    return idList
  }

  override async roomDel (
    roomId    : string,
    contactId : string,
  ): Promise<void> {
    try {
      await this.bridge.roomDelMember(roomId, contactId)
    } catch (e) {
      log.warn('PuppetWeChat', 'roomDelMember(%s, %d) rejected: %s', roomId, contactId, (e as Error).message)
      throw e
    }
  }

  override async roomAvatar (roomId: string): Promise<FileBoxInterface> {
    log.verbose('PuppetWeChat', 'roomAvatar(%s)', roomId)

    const payload = await this.roomPayload(roomId)

    if (payload.avatar) {
      return FileBox.fromUrl(payload.avatar)
    }
    log.warn('PuppetWeChat', 'roomAvatar() avatar not found, use the chatie default.')
    return qrCodeForChatie()
  }

  override async roomAdd (
    roomId    : string,
    contactId : string,
  ): Promise<void> {
    try {
      await this.bridge.roomAddMember(roomId, contactId)
    } catch (e) {
      log.warn('PuppetWeChat', 'roomAddMember(%s) rejected: %s', contactId, (e as Error).message)
      throw e
    }
  }

  override async roomTopic (roomId: string)                : Promise<string>
  override async roomTopic (roomId: string, topic: string) : Promise<void>

  override async roomTopic (
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
      log.warn('PuppetWeChat', 'roomTopic(%s) rejected: %s', topic, (e as Error).message)
      throw e
    }
  }

  override async roomCreate (
    contactIdList : string[],
    topic         : string,
  ): Promise<string> {
    try {
      const roomId = await this.bridge.roomCreate(contactIdList, topic)
      if (!roomId) {
        throw new Error('PuppetWeChat.roomCreate() roomId "' + roomId + '" not found')
      }
      return roomId

    } catch (e) {
      log.warn('PuppetWeChat', 'roomCreate(%s, %s) rejected: %s', contactIdList.join(','), topic, (e as Error).message)
      throw e
    }
  }

  override async roomAnnounce (roomId: string)                : Promise<string>
  override async roomAnnounce (roomId: string, text: string)  : Promise<void>

  override async roomAnnounce (roomId: string, text?: string) : Promise<void | string> {
    log.warn('PuppetWeChat', 'roomAnnounce(%s, %s) not supported', roomId, text || '')

    if (text) {
      return
    }
    return ''
  }

  override async roomQuit (roomId: string): Promise<void> {
    log.warn('PuppetWeChat', 'roomQuit(%s) not supported by Web API', roomId)
  }

  override async roomQRCode (roomId: string): Promise<string> {
    return PUPPET.throwUnsupportedError(roomId)
  }

  override async roomMemberList (roomId: string) : Promise<string[]> {
    log.verbose('PuppetWeChat', 'roommemberList(%s)', roomId)
    const rawPayload = await this.roomRawPayload(roomId)

    const memberIdList = (rawPayload.MemberList || [])
      .map(member => member.UserName)

    return memberIdList
  }

  override async roomMemberRawPayload (roomId: string, contactId: string): Promise<WebRoomRawMember>  {
    log.verbose('PuppetWeChat', 'roomMemberRawPayload(%s, %s)', roomId, contactId)
    const rawPayload = await this.roomRawPayload(roomId)

    const memberPayloadList = rawPayload.MemberList || []

    const memberPayloadResult = memberPayloadList.filter(payload => payload.UserName === contactId)
    if (memberPayloadResult.length > 0) {
      return memberPayloadResult[0]!
    } else {
      throw new Error('not found')
    }
  }

  override async roomMemberRawPayloadParser (rawPayload: WebRoomRawMember): Promise<PUPPET.payloads.RoomMember>  {
    log.verbose('PuppetWeChat', 'roomMemberRawPayloadParser(%s)', rawPayload)

    const payload: PUPPET.payloads.RoomMember = {
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
  override async roomInvitationAccept (roomInvitationId: string): Promise<void> {
    return PUPPET.throwUnsupportedError(roomInvitationId)
  }

  override async roomInvitationRawPayload (roomInvitationId: string): Promise<any> {
    return PUPPET.throwUnsupportedError(roomInvitationId)
  }

  override async roomInvitationRawPayloadParser (rawPayload: any): Promise<PUPPET.payloads.RoomInvitation> {
    return PUPPET.throwUnsupportedError(rawPayload)
  }

  /**
   *
   * Friendship
   *
   */
  override async friendshipRawPayload (id: string): Promise<WebMessageRawPayload> {
    log.warn('PuppetWeChat', 'friendshipRawPayload(%s)', id)

    const rawPayload = await this.bridge.getMessage(id)
    return rawPayload
  }

  override async friendshipRawPayloadParser (rawPayload: WebMessageRawPayload): Promise<PUPPET.payloads.Friendship> {
    log.warn('PuppetWeChat', 'friendshipRawPayloadParser(%s)', rawPayload)

    const timestamp = Math.floor(Date.now() / 1000) // in seconds

    switch (rawPayload.MsgType) {
      case WebMessageType.VERIFYMSG: {
        const recommendInfo = rawPayload.RecommendInfo
        if (!recommendInfo) {
          throw new Error('no RecommendInfo')
        }

        const payloadReceive: PUPPET.payloads.FriendshipReceive = {
          contactId : recommendInfo.UserName,
          hello     : recommendInfo.Content,
          id        : rawPayload.MsgId,
          ticket    : recommendInfo.Ticket,
          timestamp,
          type      : PUPPET.types.Friendship.Receive,
        }
        return payloadReceive
      }
      case WebMessageType.SYS: {
        const payloadConfirm: PUPPET.payloads.FriendshipConfirm = {
          contactId : rawPayload.FromUserName,
          id        : rawPayload.MsgId,
          timestamp,
          type      : PUPPET.types.Friendship.Confirm,
        }
        return payloadConfirm
      }
      default:
        throw new Error('not supported friend request message raw payload')
    }
  }

  override async friendshipSearchPhone (phone: string): Promise<null | string> {
    throw PUPPET.throwUnsupportedError(phone)
  }

  override async friendshipSearchWeixin (weixin: string): Promise<null | string> {
    throw PUPPET.throwUnsupportedError(weixin)
  }

  override async friendshipAdd (
    contactId : string,
    hello     : string,
  ): Promise<void> {
    try {
      await this.bridge.verifyUserRequest(contactId, hello)
    } catch (e) {
      log.warn('PuppetWeChat', 'friendshipAdd() bridge.verifyUserRequest(%s, %s) rejected: %s',
        contactId,
        hello,
        (e as Error).message,
      )
      throw e
    }
  }

  override async friendshipAccept (
    friendshipId : string,
  ): Promise<void> {
    const payload = await this.friendshipPayload(friendshipId) as any as PUPPET.payloads.FriendshipReceive

    try {
      await this.bridge.verifyUserOk(payload.contactId, payload.ticket)
    } catch (e) {
      log.warn('PuppetWeChat', 'bridge.verifyUserOk(%s, %s) rejected: %s',
        payload.contactId,
        payload.ticket,
        (e as Error).message,
      )
      throw e
    }
  }

  /**
   * @private
   * For issue #668
   */
  async waitStable (): Promise<void> {
    log.verbose('PuppetWeChat', 'waitStable()')

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

      log.silly('PuppetWeChat', 'readyStable() while() curNum=%s, maxNum=%s, unchangedNum=%s',
        curNum, maxNum, unchangedNum,
      )

    }

    log.verbose('PuppetWeChat', 'readyStable() emit(ready)')
    this.emit('ready', { data: 'stable' })
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
      log.error('PuppetWeChat', 'hostname() exception:%s', e as Error)
      this.emit('error', e)
      throw e
    }
  }

  private async cookies (): Promise<Cookie[]> {
    return this.bridge.cookies()
  }

  async saveCookie (): Promise<void> {
    if (this.state.inactive() === true) {
      log.warn('PuppetWeChat', 'saveCookie() found state inactive, skipped.')
      return
    }
    const cookieList = await this.bridge.cookies()
    await this.memory.set(MEMORY_SLOT, cookieList)
    await this.memory.save()
  }

  /**
   * `isImg()` @see https://github.com/wechaty/webwx-app-tracker/blob/a12c78fb8bd7186c0f3bb0e18dd611151e6b8aac/formatted/webwxApp.js#L3441-L3450
   * `getMsgType()` @see https://github.com/wechaty/webwx-app-tracker/blob/a12c78fb8bd7186c0f3bb0e18dd611151e6b8aac/formatted/webwxApp.js#L3452-L3463
   */
  protected getMsgType (ext: string): WebMessageType {
    switch (ext.toLowerCase()) {
      case 'bmp':
      case 'jpeg':
      case 'jpg':
      case 'png':
        return WebMessageType.IMAGE
      case 'gif':
        return WebMessageType.EMOTICON
      case 'mp4':
        return WebMessageType.VIDEO
      default:
        return WebMessageType.APP
    }
  }

  // public async readyMedia(): Promise<this> {
  private async messageRawPayloadToUrl (
    rawPayload: WebMessageRawPayload,
  ): Promise<null | string> {
    log.silly('PuppetWeChat', 'readyMedia()')

    // let type = PUPPET.types.Message.Unknown
    let url: undefined | string

    try {

      switch (rawPayload.MsgType) {
        case WebMessageType.EMOTICON:
          // type = PUPPET.types.Message.Emoticon
          url = await this.bridge.getMsgEmoticon(rawPayload.MsgId)
          break
        case WebMessageType.IMAGE:
          // type = PUPPET.types.Message.Image
          url = await this.bridge.getMsgImg(rawPayload.MsgId)
          break
        case WebMessageType.VIDEO:
        case WebMessageType.MICROVIDEO:
          // type = PUPPET.types.Message.Video
          url = await this.bridge.getMsgVideo(rawPayload.MsgId)
          break
        case WebMessageType.VOICE:
          // type = PUPPET.types.Message.Audio
          url = await this.bridge.getMsgVoice(rawPayload.MsgId)
          break

        case WebMessageType.APP:
          switch (rawPayload.AppMsgType) {
            case WebAppMsgType.ATTACH:
              if (!rawPayload.MMAppMsgDownloadUrl) {
                throw new Error('no MMAppMsgDownloadUrl')
              }
              // had set in Message
              // type = PUPPET.types.Message.Attachment
              url = rawPayload.MMAppMsgDownloadUrl
              break

            case WebAppMsgType.URL:
            case WebAppMsgType.READER_TYPE:
              if (!rawPayload.Url) {
                throw new Error('no Url')
              }
              // had set in Message
              // type = PUPPET.types.Message.Attachment
              url = rawPayload.Url
              break

            default: {
              const e = new Error('ready() unsupported typeApp(): ' + rawPayload.AppMsgType)
              log.warn('PuppeteerMessage', (e as Error).message)
              throw e
            }
          }
          break

        case WebMessageType.TEXT:
          if (rawPayload.SubMsgType === WebMessageType.LOCATION) {
            // type = PUPPET.types.Message.Image
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
        //   type: PUPPET.types.Message.Unknown,
        // }
        return null
      }

    } catch (e) {
      log.warn('PuppetWeChat', 'ready() exception: %s', (e as Error).message)
      throw e
    }

    return url

  }

  protected getExtName (filename:string) {
    return path.extname(filename).slice(1)
  }

  private async uploadMedia (
    file       : FileBoxInterface,
    toUserName : string,
  ): Promise<WebMessageMediaPayload> {
    const filename = file.name
    const ext      = this.getExtName(filename)
    const msgType  = this.getMsgType(ext)
    const contentType = mime.getType(ext) || file.mediaType || undefined
    if (!contentType) {
      throw new Error('no MIME Type found on mediaMessage: ' + file.name)
    }

    let mediatype: 'pic'|'video'|'doc'
    switch (msgType) {
      // case WebMessageType.EMOTICON:  //gif cannot be "pic", it will cause sending wrong picture. #178
      case WebMessageType.IMAGE:
        mediatype = 'pic'
        break
      case WebMessageType.VIDEO:
        mediatype = 'video'
        break
      default:
        mediatype = 'doc'
    }

    // const buffer = await new Promise<Buffer>((resolve, reject) => {
    //   const bl = new BufferList((err: undefined | Error, data: Buffer) => {
    //     if (err) reject(err)
    //     else resolve(data)
    //   })
    //   file.pipe(bl)
    // })
    // Huan(202201): fix bl not a standard Writable problem
    const buffer = await file.toBuffer()

    // Sending video files is not allowed to exceed 20MB
    // https://github.com/Chatie/webwx-app-tracker/blob/
    //  7c59d35c6ea0cff38426a4c5c912a086c4c512b2/formatted/webwxApp.js#L1115
    const MAX_FILE_SIZE   = 100 * 1024 * 1024
    const LARGE_FILE_SIZE = 25 * 1024 * 1024
    const MAX_VIDEO_SIZE  = 20 * 1024 * 1024

    if (msgType === WebMessageType.VIDEO && buffer.length > MAX_VIDEO_SIZE) {
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
    const fromUserName    = this.currentUserId
    const id              = 'WU_FILE_' + this.fileId
    this.fileId++

    const hostname = await this.bridge.hostname()
    const headers = {
      Cookie       : cookie.map(c => c.name + '=' + c.value).join('; '),
      Referer      : `https://${hostname}`,
      'User-Agent' : 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 '
                      + '(KHTML, like Gecko) Chrome/50.0.2661.102 Safari/537.36',
    }

    log.silly('PuppetWeChat', 'uploadMedia() headers:%s', JSON.stringify(headers))

    const uploadMediaRequest = {
      AESKey:        '',
      BaseRequest:   baseRequest,
      ClientMediaId: +new Date(),
      DataLen:       size,
      FileMd5:       fileMd5,
      FromUserName:  fromUserName,
      MediaType:     UploadMediaType.Attachment,
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
                  log.silly('PuppetWeChat', 'updateMedia() typeof body = %s', typeof body)
                  try {
                    obj = JSON.parse(body)
                  } catch (e) {
                    log.error('PuppetWeChat', 'updateMedia() body = %s', body)
                    log.error('PuppetWeChat', 'updateMedia() exception: %s', e as Error)
                    this.emit('error', e)
                  }
                }
                if (typeof obj !== 'object' || obj.BaseResponse.Ret !== 0) {
                  const errMsg = obj.BaseResponse || 'api return err'
                  log.silly('PuppetWeChat', 'uploadMedia() checkUpload err:%s \nreq:%s\nret:%s',
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
        log.error('PuppetWeChat', 'uploadMedia() checkUpload exception: %s', (e as Error).message)
        throw e
      }
      if (!ret.Signature) {
        log.error('PuppetWeChat', 'uploadMedia(): chackUpload failed to get Signature')
        throw new Error('chackUpload failed to get Signature')
      }
      uploadMediaRequest.Signature = ret.Signature
      uploadMediaRequest.AESKey    = ret.AESKey
      mediaData.Signature          = ret.Signature
    } else {
      delete (uploadMediaRequest as any).Signature
      delete (uploadMediaRequest as any).AESKey
    }

    log.verbose('PuppetWeChat', 'uploadMedia() webwx_data_ticket: %s', webwxDataTicket)
    log.verbose('PuppetWeChat', 'uploadMedia() pass_ticket: %s', passTicket)

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
      const tempBuffer = buffer.slice(i * BASE_LENGTH, (i + 1) * BASE_LENGTH)
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
        log.error('PuppetWeChat', 'uploadMedia() uploadMedia exception: %s', (e as Error).message)
        throw new Error('uploadMedia err: ' + (e as any).message)
      }
    }
    let mediaId = ''
    for (let i = 0; i < bufferData.length; i++) {
      mediaId = await getMediaId(bufferData[i]!, i)
    }
    if (!mediaId) {
      log.error('PuppetWeChat', 'uploadMedia(): upload fail')
      throw new Error('PuppetWeChat.uploadMedia(): upload fail')
    }
    return Object.assign(mediaData, { MediaId: mediaId })
  }

  override async messageSendFile (
    conversationId : string,
    file           : FileBoxInterface,
  ): Promise<void> {
    log.verbose('PuppetWeChat', 'messageSendFile(%s, file=%s)',
      conversationId,
      file.toString(),
    )

    let mediaData: WebMessageMediaPayload
    let rawPayload = {} as undefined | WebMessageRawPayload

    if (!rawPayload || !rawPayload.MediaId) {
      try {
        mediaData = await this.uploadMedia(file, conversationId)
        rawPayload = Object.assign(rawPayload, mediaData)
        log.silly('PuppetWeChat', 'Upload completed, new rawObj:%s', JSON.stringify(rawPayload))
      } catch (e) {
        log.error('PuppetWeChat', 'sendMedia() exception: %s', (e as Error).message)
        throw e
      }
    } else {
      // To support forward file
      log.silly('PuppetWeChat', 'skip upload file, rawObj:%s', JSON.stringify(rawPayload))
      mediaData = {
        FileName   : rawPayload.FileName,
        FileSize   : rawPayload.FileSize,
        MMFileExt  : rawPayload.MMFileExt,
        MediaId    : rawPayload.MediaId,
        MsgType    : rawPayload.MsgType,
        ToUserName : conversationId,
      }
      if (rawPayload.Signature) {
        mediaData.Signature = rawPayload.Signature
      }
    }
    // console.log('mediaData.MsgType', mediaData.MsgType)
    // console.log('rawObj.MsgType', message.rawObj && message.rawObj.MsgType)

    mediaData.MsgType = this.getMsgType(this.getExtName(file.name))
    log.silly('PuppetWeChat', 'sendMedia() destination: %s, mediaId: %s, MsgType; %s)',
      conversationId,
      mediaData.MediaId,
      mediaData.MsgType,
    )
    let ret = false
    try {
      ret = await this.bridge.sendMedia(mediaData)
    } catch (e) {
      log.error('PuppetWeChat', 'sendMedia() exception: %s', (e as Error).message)
      throw e
    }
    if (!ret) {
      throw new Error('sendMedia fail')
    }
  }

  override async messageSendContact (
    conversationId : string,
    contactId      : string,
  ): Promise<void> {
    log.verbose('PuppetWeChat', 'messageSend("%s", %s)', conversationId, contactId)
    return PUPPET.throwUnsupportedError()
  }

  override async messageImage (messageId: string, imageType: PUPPET.types.Image): Promise<FileBoxInterface> {
    log.verbose('PuppetWeChat', 'messageImage(%s, %s)', messageId, imageType)
    return this.messageFile(messageId)
  }

  override async messageContact (messageId: string): Promise<string> {
    log.verbose('PuppetWeChat', 'messageContact(%s)', messageId)
    return PUPPET.throwUnsupportedError(messageId)
  }

  /**
   *
   * Tag
   *
   */
  override async tagContactAdd (tagId: string, contactId: string): Promise<void> {
    return PUPPET.throwUnsupportedError(tagId, contactId)
  }

  override async tagContactRemove (tagId: string, contactId: string): Promise<void> {
    return PUPPET.throwUnsupportedError(tagId, contactId)
  }

  override async tagContactDelete (tagId: string) : Promise<void> {
    return PUPPET.throwUnsupportedError(tagId)
  }

  override async tagContactList (contactId?: string) : Promise<string[]> {
    return PUPPET.throwUnsupportedError(contactId)
  }

  override async contactCorporationRemark (contactId: string, corporationRemark: string | null) {
    return PUPPET.throwUnsupportedError(contactId, corporationRemark)
  }

  override async contactDescription (contactId: string, description: string | null) {
    return PUPPET.throwUnsupportedError(contactId, description)
  }

  override async contactPhone (contactId: string, phoneList: string[]): Promise<void> {
    return PUPPET.throwUnsupportedError(contactId, phoneList)
  }

  override conversationReadMark (
    conversationId: string,
    hasRead = true,
  ) : Promise<void> {
    return PUPPET.throwUnsupportedError(conversationId, hasRead)
  }

}

export default PuppetWeChat
