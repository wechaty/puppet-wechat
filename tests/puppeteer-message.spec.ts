#!/usr/bin/env ts-node
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

// tslint:disable:no-shadowed-variable
// tslint:disable:max-classes-per-file
// tslint:disable:arrow-parens
// tslint:disable:ter-no-irregular-whitespace

import {
  test,
  sinon,
}           from 'tstest'

import {
  // config,
  log,
}                 from '../src/config'

import {
  MessagePayload,
  MessageType,
}                 from 'wechaty-puppet'

import {
  PuppetPuppeteer,
}                         from '../src/puppet-puppeteer'
import {
  WebMessageRawPayload,
  // WebRoomRawPayload,
}                         from '../src/web-schemas'

// class WechatyTest extends Wechaty {
//   public initPuppetAccessory (puppet: PuppetPuppeteer) {
//     super.initPuppetAccessory(puppet)
//   }
// }

class PuppetTest extends PuppetPuppeteer {

  public contactRawPayload (id: string) {
    return super.contactRawPayload(id)
  }
  public roomRawPayload (id: string) {
    return super.roomRawPayload(id)
  }
  public messageRawPayload (id: string) {
    return super.messageRawPayload(id)
  }

}

// class PuppetPuppeteerTest extends PuppetPuppeteer {
//   public id?: string = undefined
// }

test('constructor()', async t => {
  const puppet  = new PuppetTest()
  // const wechaty = new WechatyTest({ puppet })
  // wechaty.initPuppetAccessory(puppet)

  const MOCK_USER_ID = 'TEST-USER-ID'

  /* tslint:disable:max-line-length */
  const rawPayload: WebMessageRawPayload = JSON.parse('{"MsgId":"179242112323992762","FromUserName":"@0bb3e4dd746fdbd4a80546aef66f4085","ToUserName":"@16d20edf23a3bf3bc71bb4140e91619f3ff33b4e33f7fcd25e65c1b02c7861ab","MsgType":1,"Content":"test123","Status":3,"ImgStatus":1,"CreateTime":1461652670,"VoiceLength":0,"PlayLength":0,"FileName":"","FileSize":"","MediaId":"","Url":"","AppMsgType":0,"StatusNotifyCode":0,"StatusNotifyUserName":"","RecommendInfo":{"UserName":"","NickName":"","QQNum":0,"Province":"","City":"","Content":"","Signature":"","Alias":"","Scene":0,"VerifyFlag":0,"AttrStatus":0,"Sex":0,"Ticket":"","OpCode":0},"ForwardFlag":0,"AppInfo":{"AppID":"","Type":0},"HasProductId":0,"Ticket":"","ImgHeight":0,"ImgWidth":0,"SubMsgType":0,"NewMsgId":179242112323992770,"MMPeerUserName":"@0bb3e4dd746fdbd4a80546aef66f4085","MMDigest":"test123","MMIsSend":false,"MMIsChatRoom":false,"MMUnread":true,"LocalID":"179242112323992762","ClientMsgId":"179242112323992762","MMActualContent":"test123","MMActualSender":"@0bb3e4dd746fdbd4a80546aef66f4085","MMDigestTime":"14:37","MMDisplayTime":1461652670,"MMTime":"14:37"}')

  const EXPECTED = {
    from:   '@0bb3e4dd746fdbd4a80546aef66f4085',
    id:     '179242112323992762',
  }
  const sandbox = sinon.createSandbox()
  const mockMessagePayload = async (/* _: string */) => {
    const payload: MessagePayload = {
      fromId    : EXPECTED.from,
      id        : EXPECTED.id,
      timestamp : Date.now(),
      toId      : 'toId',
      type      : MessageType.Text,
    }
    return payload
  }

  sandbox.stub(puppet, 'contactPayload').returns({} as any)
  // sandbox.stub(puppet, 'contactPayloadCache').returns({})

  sandbox.stub(puppet, 'roomPayload').returns({} as any)
  // sandbox.stub(puppet, 'roomPayloadCache').returns({})

  sandbox.stub(puppet, 'messagePayload').callsFake(mockMessagePayload)
  // sandbox.stub(puppet, 'messagePayloadCache').callsFake(mockMessagePayload)

  await puppet.login(MOCK_USER_ID)

  const msgPayload = await puppet.messagePayload(rawPayload.MsgId)

  t.is(msgPayload.id,     EXPECTED.id,    'id right')
  t.is(msgPayload.fromId, EXPECTED.from,  'from right')

  sandbox.restore()
})

// Issue #445
// XXX have to use test.serial() because mockGetContact can not be parallel
test('ready()', async t => {

  // must different with other rawData, because Contact class with load() will cache the result. or use Contact.resetPool()
  /* tslint:disable:max-line-length */
  const rawPayload: WebMessageRawPayload = JSON.parse('{"MsgId":"3009511950433684462","FromUserName":"@0748ee480711bf20af91c298a0d7dcc77c30a680c1004157386b81cf13474823","ToUserName":"@b58f91e0c5c9e841e290d862ddb63c14","MsgType":1,"Content":"哈哈","Status":3,"ImgStatus":1,"CreateTime":1462887888,"VoiceLength":0,"PlayLength":0,"FileName":"","FileSize":"","MediaId":"","Url":"","AppMsgType":0,"StatusNotifyCode":0,"StatusNotifyUserName":"","RecommendInfo":{"UserName":"","NickName":"","QQNum":0,"Province":"","City":"","Content":"","Signature":"","Alias":"","Scene":0,"VerifyFlag":0,"AttrStatus":0,"Sex":0,"Ticket":"","OpCode":0},"ForwardFlag":0,"AppInfo":{"AppID":"","Type":0},"HasProductId":0,"Ticket":"","ImgHeight":0,"ImgWidth":0,"SubMsgType":0,"NewMsgId":3009511950433684500,"MMPeerUserName":"@0748ee480711bf20af91c298a0d7dcc77c30a680c1004157386b81cf13474823","MMDigest":"哈哈","MMIsSend":false,"MMIsChatRoom":false,"MMUnread":false,"LocalID":"3009511950433684462","ClientMsgId":"3009511950433684462","MMActualContent":"哈哈","MMActualSender":"@0748ee480711bf20af91c298a0d7dcc77c30a680c1004157386b81cf13474823","MMDigestTime":"21:44","MMDisplayTime":1462887888,"MMTime":"21:44","_h":104,"_index":0,"_offsetTop":0,"$$hashKey":"098"}')

  const expectedFromUserName = '@0748ee480711bf20af91c298a0d7dcc77c30a680c1004157386b81cf13474823'
  const expectedToUserName   = '@b58f91e0c5c9e841e290d862ddb63c14'
  const expectedFromNickName = 'From Nick Name@Test'
  const expectedToNickName   = 'To Nick Name@Test'
  const expectedMsgId        = '3009511950433684462'

  // Mock
  function mockContactRawPayload (id: string) {
    log.silly('TestMessage', `mocked getContact(%s)`, id)
    return new Promise<any>(resolve => {
      let obj = {}
      switch (id) {
        case expectedFromUserName:
          obj = {
            NickName: expectedFromNickName,
            UserName: expectedFromUserName,
          }
          break
        case expectedToUserName:
          obj = {
            NickName: expectedToNickName,
            UserName: expectedToUserName,
          }
          break
        default:
          log.error('TestMessage', `mocked getContact(%s) unknown`, id)
          t.fail(`mocked getContact(${id}) unknown`)
          break
      }
      log.silly('TestMessage', 'setTimeout mocked getContact')
      setTimeout(() => {
        log.silly('TestMessage', 'mocked getContact resolved')
        return resolve(obj)
      }, 100)
    })
  }

  async function mockMessageRawPayload (id: string) {
    if (id === rawPayload.MsgId) {
      return rawPayload as any
    }
    return {}
  }

  const sandbox = sinon.createSandbox()

  const puppet = new PuppetTest()

  // const wechaty = new WechatyTest({ puppet })
  // wechaty.initPuppetAccessory(puppet)

  sandbox.stub(puppet, 'contactRawPayload').callsFake(mockContactRawPayload)
  sandbox.stub(puppet, 'messageRawPayload').callsFake(mockMessageRawPayload)

  // const m = wechaty.Message.create(rawPayload.MsgId)
  const msgPayload = await puppet.messagePayload(rawPayload.MsgId)

  t.is(msgPayload.id, expectedMsgId, 'id/MsgId right')

  const fromId = msgPayload.fromId
  const toId   = msgPayload.toId

  if (!fromId || !toId) {
    throw new Error('no fc or no tc')
  }

  const fromContactPayload = await puppet.contactPayload(fromId)
  const toContactPayload   = await puppet.contactPayload(toId)

  t.is(fromId,                  expectedFromUserName, 'contact ready for FromUserName')
  t.is(fromContactPayload.name, expectedFromNickName, 'contact ready for FromNickName')
  t.is(toId,                    expectedToUserName,   'contact ready for ToUserName')
  t.is(toContactPayload.name,   expectedToNickName,   'contact ready for ToNickName')

  sandbox.restore()
})

// test('find()', async t => {
//   const puppet  = new PuppetPuppeteer()
//   // const wechaty = new WechatyTest({ puppet })
//   // wechaty.initPuppetAccessory(puppet)

//   const sandbox = sinon.createSandbox()

//   sandbox.stub(puppet, 'contactPayload').resolves({})
//   sandbox.stub(puppet, 'contactPayloadCache').returns({})

//   const MOCK_USER_ID = 'TEST-USER-ID'
//   await puppet.login(MOCK_USER_ID)

//   const msg = await wechaty.Message.find({
//     id: 'xxx',
//   })

//   t.ok(msg, 'Message found')
//   t.ok(msg!.id, 'Message.id is ok')

//   sandbox.restore()
// })

// test('findAll()', async t => {
//   const puppet  = new PuppetTest()
//   const wechaty = new WechatyTest({ puppet })
//   wechaty.initPuppetAccessory(puppet)

//   const sandbox = sinon.createSandbox()

//   sandbox.stub(puppet, 'contactPayload').resolves({})
//   sandbox.stub(puppet, 'contactPayloadCache').returns({})

//   const MOCK_USER_ID = 'TEST-USER-ID'
//   await puppet.login(MOCK_USER_ID)

//   const msgList = await wechaty.Message.findAll({
//     from: 'yyy',
//   })

//   t.is(msgList.length, 2, 'Message.findAll with limit 2')

//   sandbox.restore()
// })
