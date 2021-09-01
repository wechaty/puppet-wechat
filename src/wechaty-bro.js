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

/**
 * Wechaty - Wechat for Bot, and human who talk to bot.
 *
 * PuppetWeChat: WechatyBro
 *
 * Inject this js code to browser,
 * in order to interactive with wechat web program.
 *
 * ATTENTION:
 *
 * JavaScript in this file will be ran inside:
 *
 *    BROWSER
 *
 * instead of
 *
 *    NODE.js
 *
 * read more about this in puppet-web-bridge.ts
 */

/* eslint no-undef: off */
/* eslint sort-keys: off */

(function () {
  function init () {
    if (!angularIsReady()) {
      retObj.code = 503 // 503 SERVICE UNAVAILABLE https://httpstatuses.com/503
      retObj.message = 'init() without a ready angular env'
      return retObj
    }

    if (WechatyBro.vars.initState === true) {
      log('WechatyBro.init() called twice: already inited')
      retObj.code = 304 // 304 Not Modified https://www.w3.org/Protocols/rfc2616/rfc2616-sec10.html#sec10.3.5
      retObj.message = 'init() already inited before. returned with do nothing'
      return retObj
    }

    if (MMCgiLogined()) {
      login('page refresh')
    }

    glueToAngular()
    hookEvents()
    hookRecalledMsgProcess()

    log('init() scanCode: ' + WechatyBro.vars.scanCode)
    setTimeout(() => checkScan(), 1000)

    heartBeat(true)

    log('inited!. ;-D')
    WechatyBro.vars.initState = true

    retObj.code = 200
    retObj.message = 'WechatyBro Init Succ'
    return retObj
  }

  function log (text) {
    WechatyBro.emit('log', text)
  }

  /**
  *
  * Functions that Glued with AngularJS
  *
  */
  function MMCgiLogined () {
    return !!(window.MMCgi && window.MMCgi.isLogin)
  }

  function angularIsReady () {
    // don't log inside, because we has not yet init clog here.
    return !!(
      (typeof angular) !== 'undefined'
      && angular.element
      && angular.element('body')
      && angular.element(document).injector()
    )
  }

  function heartBeat (firstTime) {
    const TIMEOUT = 15000 // 15s
    if (firstTime && WechatyBro.vars.heartBeatTimmer) {
      log('heartBeat timer exist when 1st time is true? return for do nothing')
      return
    }
    WechatyBro.emit('heartbeat', 'heartbeat@browser')
    WechatyBro.vars.heartBeatTimmer = setTimeout(heartBeat, TIMEOUT)
    return TIMEOUT
  }

  function glueToAngular () {
    const injector  = angular.element(document).injector()
    if (!injector) {
      throw new Error('glueToAngular cant get injector(right now)')
    }
    const accountFactory  = injector.get('accountFactory')
    // var appFactory      = injector.get('appFactory')
    const chatroomFactory = injector.get('chatroomFactory')
    const chatFactory     = injector.get('chatFactory')
    const contactFactory  = injector.get('contactFactory')
    const confFactory     = injector.get('confFactory')
    const emojiFactory    = injector.get('emojiFactory')
    const loginFactory    = injector.get('loginFactory')
    const utilFactory     = injector.get('utilFactory')

    const http            = injector.get('$http')
    const state           = injector.get('$state')
    const mmHttp          = injector.get('mmHttp')

    const appScope    = angular.element('[ng-controller="appController"]').scope()
    const rootScope   = injector.get('$rootScope')
    const loginScope  = angular.element('[ng-controller="loginController"]').scope()

    /*
    // method 1
    appFactory.syncOrig = appFactory.sync
    appFactory.syncCheckOrig = appFactory.syncCheck
    appFactory.sync = function() { WechatyBro.log('appFactory.sync() !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!'); return appFactory.syncOrig(arguments) }
    appFactory.syncCheck = function() { WechatyBro.log('appFactory.syncCheck() !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!'); return appFactory.syncCheckOrig(arguments) }

    // method 2
    $.ajaxOrig = $.ajax
    $.ajax = function() { WechatyBro.log('$.ajax() !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!'); return $.ajaxOrig(arguments) }

    $.ajax({
      url: "https://wx.qq.com/zh_CN/htmledition/v2/images/webwxgeticon.jpg"
      , type: "GET"
    }).done(function (response) {
      alert("success");
    })

    // method 3 - mmHttp
    mmHttp.getOrig = mmHttp.get
    mmHttp.get = function() { WechatyBro.log('mmHttp.get() !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!'); return mmHttp.getOrig(arguments) }
*/

    /**
     * generate $scope with a contoller (as it is not assigned in html staticly)
     * https://github.com/angular/angular.js/blob/a4e60cb6970d8b6fa9e0af4b9f881ee3ba7fdc99/test/ng/controllerSpec.js#L24
     */
    const contentChatScope  = rootScope.$new()
    injector.get('$controller')('contentChatController', { $scope: contentChatScope })

    // get all we need from wx in browser(angularjs)
    WechatyBro.glue = {
      http,
      injector,
      mmHttp,
      state,

      accountFactory,
      chatFactory,
      chatroomFactory,
      confFactory,
      contactFactory,
      emojiFactory,
      loginFactory,
      utilFactory,

      rootScope,
      appScope,
      loginScope,

      contentChatScope,
    }

    return true
  }

  function checkScan () {
    // log('checkScan()')
    if (loginState()) {
      log('checkScan() - already login, no more check, and return(only)') // but I will emit a login event')
      // login('checkScan found already login')
      return
    }

    const loginScope = WechatyBro.glue.loginScope
    if (!loginScope) {
      log('checkScan() - loginScope disappeared, TODO: find out the reason why this happen')
      // login('loginScope disappeared')
      // return
      return setTimeout(checkScan, 1000)
    }

    // loginScope.code:
    // 0:   显示二维码
    // 408: 未确认（显示二维码后30秒触发）
    // 201: 扫描，未确认
    // 200: 登录成功
    const code  = +loginScope.code
    const url   =  loginScope.qrcodeUrl
    log('checkScan() code:' + code + ' url:' + url + ' scanCode:' + WechatyBro.vars.scanCode)

    if (url && code !== WechatyBro.vars.scanCode) {
      log('checkScan() - code change detected: from '
        + WechatyBro.vars.scanCode
        + ' to '
        + code
      )
      WechatyBro.emit('scan', {
        code : code,
        url  : url,
      })
      WechatyBro.vars.scanCode = code
    }

    if (code !== 200) {
      return setTimeout(checkScan, 1000)
    }

    WechatyBro.vars.scanCode = null
    loginScope.code          = null

    // wait a while because the account maybe blocked by tencent,
    // then there will be a dialog should appear
    setTimeout(() => login('scan code 200'), 1000)
  }

  function loginState (state) {
    if (typeof state === 'undefined') {
      return !!WechatyBro.vars.loginState
    }
    WechatyBro.vars.loginState = state
  }

  function login (data) {
    log('login(' + data + ')')
    loginState(true)
    WechatyBro.emit('login', data)
  }

  function logout (data) {
    log('logout(' + data + ')')

    loginState(false)

    // WechatyBro.emit('logout', data)
    if (WechatyBro.glue.loginFactory) {
      WechatyBro.glue.loginFactory.loginout(0)
    } else {
      log('logout() WechatyBro.glue.loginFactory NOT found')
    }

    setTimeout(() => checkScan(), 1000)
  }

  function ding (data) {
    log('recv ding')
    return data || 'dong'
  }

  function hookEvents () {
    const rootScope = WechatyBro.glue.rootScope
    const appScope = WechatyBro.glue.appScope
    if (!rootScope || !appScope) {
      log('hookEvents() no rootScope')
      return false
    }
    rootScope.$on('message:add:success', function (event, data) {
      // if (!loginState()) { // in case of we missed the pageInit event
      //   login('by event[message:add:success]')
      // }
      WechatyBro.emit('message', data)
    })
    // rootScope.$on('root:pageInit:success', function (event, data) {
    //   login('by event[root:pageInit:success]')
    // })
    // newLoginPage seems not stand for a user login action
    // appScope.$on("newLoginPage", function(event, data) {
    //   login('by event[newLoginPage]')
    // })
    window.addEventListener('unload', function (e) {
      // XXX only 1 event can be emitted here???
      WechatyBro.emit('unload', String(e))
      log('event unload')
    })
    return true
  }

  function hookRecalledMsgProcess () {
    const chatFactory = WechatyBro.glue.chatFactory
    const utilFactory = WechatyBro.glue.utilFactory
    const confFactory = WechatyBro.glue.confFactory

    // hook chatFactory._recalledMsgProcess, resolve emit RECALLED type msg
    const oldRecalledMsgProcess = chatFactory._recalledMsgProcess
    chatFactory._recalledMsgProcess = function (msg) {
      try {
        oldRecalledMsgProcess.call(chatFactory, msg)
      } catch (e) {
        log('call oldRecalledMsgProcess failed:' + e.message)
      }
      const m = Object.assign({}, msg)
      let content = utilFactory.htmlDecode(m.MMActualContent)
      content = utilFactory.encodeEmoji(content)
      // remove <br/> here
      content = content.replace(/<br.*?\/>/g, '')
      const revokemsg = utilFactory.xml2json(content).revokemsg
      if (revokemsg.msgid) {
        // add recalled message
        m.MsgType = confFactory.MSGTYPE_RECALLED
        m.MMActualContent = revokemsg.msgid
        chatFactory.addChatMessage(m)
      }
    }
  }

  /**
   *
   * Help Functions which Proxy to WXAPP AngularJS Scope & Factory
   *  getMsgImg(message.MsgId,'slave')
   *  getMsgImg(message.MsgId,'big',message)
   */
  function getMsgImg (id, type, message) {
    const contentChatScope = WechatyBro.glue.contentChatScope
    if (!contentChatScope) {
      throw new Error('getMsgImg() contentChatScope not found')
    }
    const path = contentChatScope.getMsgImg(id, type, message)
    return window.location.origin + path
    // https://wx.qq.com/?&lang=en_US/cgi-bin/mmwebwx-bin/webwxgetmsgimg?&MsgID=4520385745174034093&skey=%40crypt_f9cec94b_a3aa5c868466d81bc518293eb292926e
    // https://wx.qq.com/cgi-bin/mmwebwx-bin/webwxgetmsgimg?&MsgID=8454987316459381112&skey=%40crypt_f9cec94b_bd210b2224f217afeab8d462af70cf53
  }

  function getMsgEmoticon (id) {
    const chatFactory = WechatyBro.glue.chatFactory

    const message = chatFactory.getMsg(id)
    return message.MMPreviewSrc || getMsgImg(message.MsgId, 'big', message)  || message.MMThumbSrc
  }

  function getMsgVideo (id) {
    const contentChatScope = WechatyBro.glue.contentChatScope
    if (!contentChatScope) {
      throw new Error('getMsgVideo() contentChatScope not found')
    }
    const path = contentChatScope.getMsgVideo(id)
    return window.location.origin + path
  }

  /**
   * from playVoice()
   */
  function getMsgVoice (id) {
    const confFactory     = WechatyBro.glue.confFactory
    const accountFactory  = WechatyBro.glue.accountFactory

    const path = confFactory.API_webwxgetvoice + '?msgid=' + id + '&skey=' + accountFactory.getSkey()
    return window.location.origin + path
  }

  function getMsgPublicLinkImg (id) {
    const path = '/cgi-bin/mmwebwx-bin/webwxgetpubliclinkimg?url=xxx&msgid=' + id + '&pictype=location'
    return window.location.origin + path
  }

  function getBaseRequest () {
    const accountFactory = WechatyBro.glue.accountFactory
    const BaseRequest = accountFactory.getBaseRequest()

    return JSON.stringify(BaseRequest)
  }

  function getPassticket () {
    const accountFactory = WechatyBro.glue.accountFactory
    return accountFactory.getPassticket()
  }

  function getCheckUploadUrl () {
    const confFactory = WechatyBro.glue.confFactory
    return confFactory.API_checkupload
  }

  function getUploadMediaUrl () {
    const confFactory = WechatyBro.glue.confFactory
    return confFactory.API_webwxuploadmedia
  }

  function sendMedia (data) {
    const chatFactory = WechatyBro.glue.chatFactory
    const confFactory = WechatyBro.glue.confFactory

    if (!chatFactory || !confFactory) {
      log('sendMedia() chatFactory or confFactory not exist.')
      return false
    }

    try {
      const d = {
        ToUserName: data.ToUserName,
        MediaId: data.MediaId,
        MsgType: data.MsgType,
        FileName: data.FileName,
        FileSize: data.FileSize,
        MMFileExt: data.MMFileExt,
      }

      if (data.Signature) {
        d.Signature = data.Signature
      }

      const m = chatFactory.createMessage(d)

      m.MMFileStatus = confFactory.MM_SEND_FILE_STATUS_SUCCESS
      m.MMStatus = confFactory.MSG_SEND_STATUS_SUCC
      m.sendByLocal = false

      chatFactory.appendMessage(m)
      chatFactory.sendMessage(m)
    } catch (e) {
      log('sendMedia() exception: ' + e.message)
      return false
    }
    return true
  }

  function forward (baseData, patchData) {
    const chatFactory = WechatyBro.glue.chatFactory
    const confFactory = WechatyBro.glue.confFactory

    if (!chatFactory || !confFactory) {
      log('forward() chatFactory or confFactory not exist.')
      return false
    }

    try {
      let m = chatFactory.createMessage(baseData)

      // Need to override the parametes after called createMessage()
      m = Object.assign(m, patchData)

      chatFactory.appendMessage(m)
      chatFactory.sendMessage(m)
    } catch (e) {
      log('forward() exception: ' + e.message)
      return false
    }
    return true
  }

  function send (ToUserName, Content) {
    const chatFactory = WechatyBro.glue.chatFactory
    const confFactory = WechatyBro.glue.confFactory

    if (!chatFactory || !confFactory) {
      log('send() chatFactory or confFactory not exist.')
      return false
    }
    try {
      const m = chatFactory.createMessage({
        ToUserName: ToUserName,
        Content:    Content,
        MsgType:    confFactory.MSGTYPE_TEXT,
      })
      chatFactory.appendMessage(m)
      chatFactory.sendMessage(m)
    } catch (e) {
      log('send() exception: ' + e.message)
      return false
    }
    return true
  }

  function getMessage (id) {
    const chatFactory = WechatyBro.glue.chatFactory
    if (!chatFactory) {
      log('chatFactory not inited')
      return null
    }
    const msg = chatFactory.getMsg(id)

    if (!msg) {
      return null
    }

    const msgWithoutFunction = {}
    Object.keys(msg).forEach(function (k) {
      if (typeof msg[k] !== 'function') {
        msgWithoutFunction[k] = msg[k]
      }
    })
    return msgWithoutFunction
  }

  function getContact (id) {
    const contactFactory = WechatyBro.glue.contactFactory
    if (!contactFactory) {
      log('contactFactory not inited')
      return null
    }
    let contact = contactFactory.getContact(id)
    let contactWithoutFunction = {}

    if (contact) {
      if (contact.isContact) {
        // extend rawObj to identify `stranger`
        contact.stranger = !(contact.isContact())
      }

      Object.keys(contact).forEach(function (k) {
        if (typeof contact[k] !== 'function') {
          contactWithoutFunction[k] = contact[k]
        }
      })
    } else {
      /**
       * when `id` does not exist in _contact Array, maybe it is belongs to a stranger in a room.
       * try to find in room's member list for this `id`, and return the contact info, if any.
       */
      contact = Object.keys(_contacts)
        .filter(id => id.match(/^@@/))    // only search in room
        .map(id => _contacts[id])         // map to room array
        .filter(r => r.MemberList.length) // get rid of room without member list
        .filter(r => r.MemberList
          .filter(m => m.UserName === id)
          .length
        )
        .map(c => c.MemberList
          .filter(m => m.UserName === id)[0]
        )[0]

      if (contact) {
        contact.stranger = true

        Object.keys(contact).forEach(k => {
          if (typeof contact[k] !== 'function') {
            contactWithoutFunction[k] = contact[k]
          }
        })
      } else {
        // Not found contact id
        contactWithoutFunction = null
      }
    }

    return contactWithoutFunction
  }

  function getUserName () {
    if (!WechatyBro.loginState()) {
      return null
    }
    const accountFactory = WechatyBro.glue.accountFactory
    return accountFactory
      ? accountFactory.getUserName()
      : null
  }

  function contactList () {
    const contactFactory = WechatyBro.glue.contactFactory

    return new Promise(resolve => retryFind(0, resolve))

    // return

    // retry 3 times, sleep 300ms between each time
    function retryFind (attempt, done) {
      attempt = attempt || 0

      const contactIdList = contactFactory
        .getAllFriendContact()
        .map(c => c.UserName)

      if (contactIdList && contactIdList.length) {
        done(contactIdList)
      } else if (attempt > 3) {
        done([])
      } else {
        attempt++
        setTimeout(() => retryFind(attempt, done), 1000)
      }
    }
  }

  function contactRemark (UserName, remark) {
    if (remark === null || remark === undefined) {
      remark = ''
    }

    const contact = _contacts[UserName]
    if (!contact) {
      throw new Error('contactRemark() can not found UserName ' + UserName)
    }

    const accountFactory  = WechatyBro.glue.accountFactory
    const confFactory     = WechatyBro.glue.confFactory
    const emojiFactory    = WechatyBro.glue.emojiFactory
    const mmHttp          = WechatyBro.glue.mmHttp

    return new Promise(resolve => {
      mmHttp({
        method: 'POST',
        url: confFactory.API_webwxoplog,
        data: angular.extend({
          UserName: UserName,
          CmdId: confFactory.oplogCmdId.MODREMARKNAME,
          RemarkName: emojiFactory.formatHTMLToSend(remark),
        }, accountFactory.getBaseRequest()),
        MMRetry: {
          count   : 3,
          timeout : 1e4,
          serial  : !0,
        },
      })
        .success(() => {
          contact.RemarkName = remark
          return resolve(true)
        })
        .error(() => {
          return resolve(false)  // TODO: use reject???
        })
    })
  }

  // function roomFind(filterFunction) {
  function roomList () {
    const contactFactory = WechatyBro.glue.contactFactory

    // var match
    // if (!filterFunction) {
    //   match = () => true
    // } else {
    //   match = eval(filterFunction)
    // }
    // log(match.toString())
    return contactFactory.getAllChatroomContact()
      //  .filter(r => match(r.NickName))
      .map(r => r.UserName)
  }

  function roomDelMember (ChatRoomName, UserName) {
    const chatroomFactory = WechatyBro.glue.chatroomFactory
    return chatroomFactory.delMember(ChatRoomName, UserName)
  }

  function roomAddMember (ChatRoomName, UserName) {
    const chatroomFactory = WechatyBro.glue.chatroomFactory
    // log(ChatRoomName)
    // log(UserName)

    return new Promise(resolve => {
      // There's no return value of addMember :(
      // https://github.com/wechaty/webwx-app-tracker/blob/f22cb043ff4201ee841990dbeb59e22643092f92/formatted/webwxApp.js#L2404-L2413
      const timer = setTimeout(() => {
        log('roomAddMember() timeout')
        // TODO change to reject here. (BREAKING CHANGES)
        return resolve(0)
      }, 10 * 1000)

      chatroomFactory.addMember(ChatRoomName, UserName, function (/* result */) {
        clearTimeout(timer)
        return resolve(1)
      })
    })
  }

  function roomModTopic (ChatRoomName, topic) {
    const chatroomFactory = WechatyBro.glue.chatroomFactory
    return chatroomFactory.modTopic(ChatRoomName, topic)
  }

  function roomCreate (UserNameList/* , topic */) {
    const UserNameListArg = UserNameList.map(function (n) { return { UserName: n } })

    const chatroomFactory = WechatyBro.glue.chatroomFactory
    const state           = WechatyBro.glue.state

    return new Promise(resolve => {
      chatroomFactory.create(UserNameListArg)
        .then(function (r) {
          // eslint-disable-next-line
          if (r.BaseResponse && 0 == r.BaseResponse.Ret || -2013 == r.BaseResponse.Ret) {
            state.go('chat', { userName: r.ChatRoomName }) // BE CAREFUL: key name is userName, not UserName! 20161001
            // if (topic) {
            //   setTimeout(_ => roomModTopic(r.ChatRoomName, topic), 3000)
            // }
            if (!r.ChatRoomName) {
              throw new Error('chatroomFactory.create() got empty r.ChatRoomName')
            }
            resolve(r.ChatRoomName)

          } else {
            reject(new Error('chatroomFactory.create() error with Ret: '
                              + r && r.BaseResponse.Ret
                              + 'with ErrMsg: '
                              + r && r.BaseResponse.ErrMsg
            ))
          }
        })
        .catch(function (e) {
          // TODO change to reject (BREAKIKNG CHANGES)
          resolve(
            JSON.parse(
              JSON.stringify(
                e
                , Object.getOwnPropertyNames(e)
              )
            )
          )
        })
    })
  }

  function verifyUserRequest (UserName, VerifyContent) {
    VerifyContent = VerifyContent || ''

    const contactFactory  = WechatyBro.glue.contactFactory
    const confFactory     = WechatyBro.glue.confFactory

    const Ticket = '' // what's this?

    return new Promise(resolve => {
      contactFactory.verifyUser({
        Opcode: confFactory.VERIFYUSER_OPCODE_SENDREQUEST,
        Scene:  confFactory.ADDSCENE_PF_WEB,
        UserName,
        Ticket,
        VerifyContent,
      })
        .then(() => {  // succ
          // alert('ok')
          // log('friendAdd(' + UserName + ', ' + VerifyContent + ') done')
          return resolve(true)
        })
        .catch((err) => {    // fail
          // alert('not ok')
          log('friendAdd(' + UserName + ', ' + VerifyContent + ') fail: ' + err)
          resolve(false)
        })
    })
  }

  function verifyUserOk (UserName, Ticket) {
    const contactFactory  = WechatyBro.glue.contactFactory
    const confFactory     = WechatyBro.glue.confFactory

    return new Promise(resolve => {
      contactFactory.verifyUser({
        UserName: UserName,
        Opcode:   confFactory.VERIFYUSER_OPCODE_VERIFYOK,
        Scene:    confFactory.ADDSCENE_PF_WEB,
        Ticket:   Ticket,
      }).then(() => {  // succ
        // alert('ok')
        log('friendVerify(' + UserName + ', ' + Ticket + ') done')
        return resolve(true)
      }).catch(err => {       // fail
        // alert('err')
        log('friendVerify(' + UserName + ', ' + Ticket + ') fail' + err)
        return resolve(false)
      })
    })
  }

  // ///////////////////////////////////////////////////////////////////////////
  // ///////////////////////////////////////////////////////////////////////////
  // ///////////////////////////////////////////////////////////////////////////

  /*
   * WechatyBro injectio must return this object.
   * PuppetWeChatBridge need this to decide if injection is successful.
   */
  const retObj = {
    code: 200, // 2XX ok, 4XX/5XX error. HTTP like
    message: 'any message',
  }

  if (typeof this.WechatyBro !== 'undefined') {
    retObj.code    = 201
    retObj.message = 'WechatyBro already injected?'
    return retObj
  }

  const WechatyBro = {
    glue: {
      // will be initialized by glueToAngular() function
    },

    // glue funcs
    // , getLoginStatusCode: function() { return WechatyBro.glue.loginScope.code }
    // , getLoginQrImgUrl:   function() { return WechatyBro.glue.loginScope.qrcodeUrl }
    angularIsReady,

    // variable
    vars: {
      loginState : false,
      initState  : false,

      scanCode        : null,
      heartBeatTimmer : null,
    },

    // funcs
    ding,   // simple return 'dong'
    emit:   window.wechatyPuppetBridgeEmit,  // send event to PuppetWeChatBridge in Node.js
    init,   // initialize WechatyBro @ Browser
    log,    // log to Node.js
    logout, // logout current logined user
    send,   // send message to wechat user

    getContact,
    getMessage,
    getUserName,
    getMsgImg,
    getMsgEmoticon,
    getMsgVideo,
    getMsgVoice,
    getMsgPublicLinkImg,
    getBaseRequest,
    getPassticket,
    getUploadMediaUrl,
    sendMedia,
    forward,
    getCheckUploadUrl,

    // for Wechaty Contact Class
    contactList,
    contactRemark,

    // for Wechaty Room Class
    roomCreate,
    roomAddMember,
    roomList,
    roomDelMember,
    roomModTopic,

    // for Friend Request
    verifyUserRequest,
    verifyUserOk,

    // test purpose
    isLogin: () => {
      log('isLogin() DEPRECATED. use loginState() instead')
      return loginState()
    },
    loginState,
  }

  this.WechatyBro = WechatyBro

  retObj.code    = 200
  retObj.message = 'WechatyBro Inject Done'

  return retObj
}.apply(window))
