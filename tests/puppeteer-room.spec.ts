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

import {
  test,
  sinon,
}               from 'tstest'
import {
  log,
}                 from '../src/config.js'

import {
  PuppetWeChat,
}                     from '../src/puppet-wechat.js'
import type {
  WebRoomRawPayload,
}                     from '../src/web-schemas.js'

class PuppetWeChatTest extends PuppetWeChat {

  public override id?: string = undefined

}

const ROOM_RAW_PAYLOAD: WebRoomRawPayload = JSON.parse('{"RemarkPYQuanPin":"","RemarkPYInitial":"","PYInitial":"TZZGQNTSHGFJ","PYQuanPin":"tongzhizhongguoqingniantianshihuiguanfangjia","Uin":0,"UserName":"@@e2355db381dc46a77c0b95516d05e7486135cb6370d8a6af66925d89d50ec278","NickName":"（通知）中国青年天使会官方家","HeadImgUrl":"/cgi-bin/mmwebwx-bin/webwxgetheadimg?seq=670397504&username=@@e2355db381dc46a77c0b95516d05e7486135cb6370d8a6af66925d89d50ec278&skey=","ContactFlag":2,"MemberCount":146,"MemberList":[{"Uin":0,"UserName":"@ecff4a7a86f23455dc42317269aa36ab","NickName":"童玮亮","AttrStatus":103423,"PYInitial":"","PYQuanPin":"","RemarkPYInitial":"","RemarkPYQuanPin":"","MemberStatus":0,"DisplayName":"","KeyWord":"dap","HeadImgUrl":"/cgi-bin/mmwebwx-bin/webwxgeticon?seq=0&username=@ecff4a7a86f23455dc42317269aa36ab&skey=@crypt_f9cec94b_f23a307a23231cfb5098faf91ff759ca&chatroomid=@4b8baa99bdfc354443711412126d2aaf"},{"Uin":0,"UserName":"@eac4377ecfd59e4321262f892177169f","NickName":"麦刚","AttrStatus":33674247,"PYInitial":"","PYQuanPin":"","RemarkPYInitial":"","RemarkPYQuanPin":"","MemberStatus":0,"DisplayName":"","KeyWord":"mai","HeadImgUrl":"/cgi-bin/mmwebwx-bin/webwxgeticon?seq=0&username=@eac4377ecfd59e4321262f892177169f&skey=@crypt_f9cec94b_f23a307a23231cfb5098faf91ff759ca&chatroomid=@4b8baa99bdfc354443711412126d2aaf"},{"Uin":0,"UserName":"@ad85207730aa94e006ddce28f74e6878","NickName":"田美坤Maggie","AttrStatus":112679,"PYInitial":"","PYQuanPin":"","RemarkPYInitial":"","RemarkPYQuanPin":"","MemberStatus":0,"DisplayName":"田美坤","KeyWord":"tia","HeadImgUrl":"/cgi-bin/mmwebwx-bin/webwxgeticon?seq=0&username=@ad85207730aa94e006ddce28f74e6878&skey=@crypt_f9cec94b_f23a307a23231cfb5098faf91ff759ca&chatroomid=@4b8baa99bdfc354443711412126d2aaf"},{"Uin":2351423900,"UserName":"@33cc239d22b20d56395bbbd0967b28b9","NickName":"周宏光","AttrStatus":327869,"PYInitial":"","PYQuanPin":"","RemarkPYInitial":"","RemarkPYQuanPin":"","MemberStatus":0,"DisplayName":"周宏光","KeyWord":"acc","HeadImgUrl":"/cgi-bin/mmwebwx-bin/webwxgeticon?seq=0&username=@33cc239d22b20d56395bbbd0967b28b9&skey=@crypt_f9cec94b_f23a307a23231cfb5098faf91ff759ca&chatroomid=@4b8baa99bdfc354443711412126d2aaf"},{"Uin":0,"UserName":"@5e77381e1e3b5641ddcee44670b6e83a","NickName":"牛文文","AttrStatus":100349,"PYInitial":"","PYQuanPin":"","RemarkPYInitial":"","RemarkPYQuanPin":"","MemberStatus":0,"DisplayName":"","KeyWord":"niu","HeadImgUrl":"/cgi-bin/mmwebwx-bin/webwxgeticon?seq=0&username=@5e77381e1e3b5641ddcee44670b6e83a&skey=@crypt_f9cec94b_f23a307a23231cfb5098faf91ff759ca&chatroomid=@4b8baa99bdfc354443711412126d2aaf"},{"Uin":0,"UserName":"@56941ef97f3e9c70af88667fdd613b44","NickName":"羊东 东方红酒窖","AttrStatus":33675367,"PYInitial":"","PYQuanPin":"","RemarkPYInitial":"","RemarkPYQuanPin":"","MemberStatus":0,"DisplayName":"","KeyWord":"Yan","HeadImgUrl":"/cgi-bin/mmwebwx-bin/webwxgeticon?seq=0&username=@56941ef97f3e9c70af88667fdd613b44&skey=@crypt_f9cec94b_f23a307a23231cfb5098faf91ff759ca&chatroomid=@4b8baa99bdfc354443711412126d2aaf"},{"Uin":0,"UserName":"@72c4767ce32db488871fdd1c27173b81","NickName":"李竹～英诺天使（此号已满）","AttrStatus":235261,"PYInitial":"","PYQuanPin":"","RemarkPYInitial":"","RemarkPYQuanPin":"","MemberStatus":0,"DisplayName":"","KeyWord":"liz","HeadImgUrl":"/cgi-bin/mmwebwx-bin/webwxgeticon?seq=0&username=@72c4767ce32db488871fdd1c27173b81&skey=@crypt_f9cec94b_f23a307a23231cfb5098faf91ff759ca&chatroomid=@4b8baa99bdfc354443711412126d2aaf"},{"Uin":0,"UserName":"@0b0e2eb9501ab2d84f9f800f6a0b4216","NickName":"周静彤 杨宁助理","AttrStatus":230885,"PYInitial":"","PYQuanPin":"","RemarkPYInitial":"","RemarkPYQuanPin":"","MemberStatus":0,"DisplayName":"","KeyWord":"zlo","HeadImgUrl":"/cgi-bin/mmwebwx-bin/webwxgeticon?seq=0&username=@0b0e2eb9501ab2d84f9f800f6a0b4216&skey=@crypt_f9cec94b_f23a307a23231cfb5098faf91ff759ca&chatroomid=@4b8baa99bdfc354443711412126d2aaf"},{"Uin":0,"UserName":"@4bfa767be0cd3fb78409b9735d1dcc57","NickName":"周哲 Jeremy","AttrStatus":33791995,"PYInitial":"","PYQuanPin":"","RemarkPYInitial":"","RemarkPYQuanPin":"","MemberStatus":0,"DisplayName":"","KeyWord":"zho","HeadImgUrl":"/cgi-bin/mmwebwx-bin/webwxgeticon?seq=0&username=@4bfa767be0cd3fb78409b9735d1dcc57&skey=@crypt_f9cec94b_f23a307a23231cfb5098faf91ff759ca&chatroomid=@4b8baa99bdfc354443711412126d2aaf"},{"Uin":0,"UserName":"@ad954bf2159a572b7743a5bc134739f4","NickName":"vicky张","AttrStatus":100477,"PYInitial":"","PYQuanPin":"","RemarkPYInitial":"","RemarkPYQuanPin":"","MemberStatus":0,"DisplayName":"","KeyWord":"hua","HeadImgUrl":"/cgi-bin/mmwebwx-bin/webwxgeticon?seq=0&username=@ad954bf2159a572b7743a5bc134739f4&skey=@crypt_f9cec94b_f23a307a23231cfb5098faf91ff759ca&chatroomid=@4b8baa99bdfc354443711412126d2aaf"}],"RemarkName":"","HideInputBarFlag":0,"Sex":0,"Signature":"","VerifyFlag":0,"OwnerUin":2351423900,"StarFriend":0,"AppAccountFlag":0,"Statues":0,"AttrStatus":0,"Province":"","City":"","Alias":"","SnsFlag":0,"UniFriend":0,"DisplayName":"","ChatRoomId":0,"KeyWord":"","EncryChatRoomId":"@4b8baa99bdfc354443711412126d2aaf","MMFromBatchGet":true,"MMOrderSymbol":"TONGZHIZHONGGUOQINGNIANTIANSHIHUIGUANFANGJIA","MMFromBatchget":true,"MMInChatroom":true}')
const CONTACT_RAW_PAYLOAD_DICT            = JSON.parse('{"@ad85207730aa94e006ddce28f74e6878":{ "UserName": "@ad85207730aa94e006ddce28f74e6878","NickName": "田美坤Maggie","RemarkName": "" },"@72c4767ce32db488871fdd1c27173b81":{ "UserName": "@72c4767ce32db488871fdd1c27173b81","NickName": "李竹～英诺天使（此号已满）","RemarkName": "" },"@ecff4a7a86f23455dc42317269aa36ab":{ "UserName": "@ecff4a7a86f23455dc42317269aa36ab","NickName": "童玮亮","RemarkName": "童玮亮备注" }}')

const ROOM_EXPECTED = {
  encryId:      '@4b8baa99bdfc354443711412126d2aaf',
  id:           '@@e2355db381dc46a77c0b95516d05e7486135cb6370d8a6af66925d89d50ec278',
  memberId1:    '@ad85207730aa94e006ddce28f74e6878',
  memberId2:    '@72c4767ce32db488871fdd1c27173b81',
  memberId3:    '@ecff4a7a86f23455dc42317269aa36ab',
  memberNick1:  '田美坤',
  memberNick2:  '李竹～英诺天使（此号已满）',
  memberNick3:  '童玮亮备注',
  ownerId:      '@33cc239d22b20d56395bbbd0967b28b9',
  topic:        '（通知）中国青年天使会官方家',
}

test('Room smoke testing', async t => {

  // Mock
  const mockContactRoomRawPayload = (id: string) => {
    log.verbose('PuppeteerRoomTest', 'mockContactRawPayload(%s)', id)
    return new Promise<any>(resolve => {
      if (id === ROOM_EXPECTED.id) {
        setImmediate(() => resolve(ROOM_RAW_PAYLOAD))
      } else if (id in CONTACT_RAW_PAYLOAD_DICT) {
        setImmediate(() => resolve(CONTACT_RAW_PAYLOAD_DICT[id]))
      } else {
        // ignore other ids
        setImmediate(() => resolve({ id }))
      }
    })
  }

  const sandbox = sinon.createSandbox()

  const puppet = new PuppetWeChatTest()

  sandbox.stub(puppet, 'contactRawPayload').callsFake(mockContactRoomRawPayload)
  sandbox.stub(puppet, 'roomRawPayload').callsFake(mockContactRoomRawPayload)

  sandbox.stub(puppet, 'id').value('pretend-to-be-logined')

  const roomPayload = await puppet.roomPayload(ROOM_EXPECTED.id)

  t.equal(roomPayload.id, ROOM_EXPECTED.id, 'should set id/UserName right')

  // t.is((r as any).payload[.('encryId') , EXPECTED.encryId, 'should set EncryChatRoomId')

  t.equal(roomPayload.topic, ROOM_EXPECTED.topic, 'should set topic/NickName')

  // const contact1 = new wechaty.Contact(ROOM_EXPECTED.memberId1)
  // const alias1 = await room.alias(contact1)
  // const contactPayload1    = await puppet.contactPayload(ROOM_EXPECTED.memberId1)
  const roomMemberPayload1 = await puppet.roomMemberPayload(ROOM_EXPECTED.id, ROOM_EXPECTED.memberId1)

  t.equal(roomMemberPayload1.roomAlias, ROOM_EXPECTED.memberNick1, 'should get roomAlias')

  // const name1 = r.alias(contact1)
  // t.is(name1, EXPECTED.memberNick1, 'should get roomAlias')

  // const contact2 = wechaty.Contact.load(ROOM_EXPECTED.memberId2)
  // const alias2 = await room.alias(contact2)
  // const contactPayload2 = await puppet.contactPayload(ROOM_EXPECTED.memberId2)
  const memberPayload2  = await puppet.roomMemberPayload(ROOM_EXPECTED.id, ROOM_EXPECTED.memberId2)

  t.equal(memberPayload2.roomAlias, '', 'should return null if not set roomAlias')

  // const name2 = r.alias(contact2)
  // t.is(name2, null, 'should return null if not set roomAlias')
  const memberIdList = await puppet.roomMemberList(ROOM_EXPECTED.id)
  t.equal(memberIdList.includes(ROOM_EXPECTED.memberId1), true, 'should has contact1')

  // const noSuchContact = wechaty.Contact.load('not exist id')
  // t.equal(await room.has(noSuchContact), false, 'should has no this member')

  // const owner = room.owner()
  // t.true(owner === null || owner instanceof wechaty.Contact, 'should get Contact instance for owner, or null')

  // wxApp hide uin for all contacts.
  // t.is(r.owner().id, EXPECTED.ownerId, 'should get owner right by OwnerUin & Uin')

  // const contactA = await room.member(ROOM_EXPECTED.memberNick1)

  // if (!contactA) {
  //   throw new Error(`member(${ROOM_EXPECTED.memberNick1}) should get member by roomAlias by default`)
  // }

  const resultA = await puppet.roomMemberSearch(ROOM_EXPECTED.id, ROOM_EXPECTED.memberNick1)
  const resultB = await puppet.roomMemberSearch(ROOM_EXPECTED.id, ROOM_EXPECTED.memberNick2)
  const resultC = await puppet.roomMemberSearch(ROOM_EXPECTED.id, ROOM_EXPECTED.memberNick3)
  const resultD = await puppet.roomMemberSearch(ROOM_EXPECTED.id, { roomAlias: ROOM_EXPECTED.memberNick1 })
  // const contactB = await room.member(ROOM_EXPECTED.memberNick2)
  // const contactC = await room.member(ROOM_EXPECTED.memberNick3)
  // const contactD = await room.member({ roomAlias: ROOM_EXPECTED.memberNick1 })

  t.equal(resultA[0], ROOM_EXPECTED.memberId1, `should get the right id from ${ROOM_EXPECTED.memberId1}, find member by default`)
  t.equal(resultB[0], ROOM_EXPECTED.memberId2, `should get the right id from ${ROOM_EXPECTED.memberId2}, find member by default`)
  t.equal(resultC[0], ROOM_EXPECTED.memberId3, `should get the right id from ${ROOM_EXPECTED.memberId3}, find member by default`)
  t.equal(resultD[0], ROOM_EXPECTED.memberId1, `should get the right id from ${ROOM_EXPECTED.memberId1}, find member by roomAlias`)

  sandbox.restore()
})

// test('Room static method', async t => {

//   const puppet = new PuppetWeChat()
//   const wechaty = new WechatyTest({ puppet })
//   wechaty.initPuppetAccessory(puppet)

//   try {
//     const result = await wechaty.Room.find({ topic: 'xxx' })
//     t.equal(result, null, `should return null if cannot find the room`)
//   } catch (e) {
//     t.pass('should throw before login or not found')
//   }

//   const roomList = await wechaty.Room.findAll({
//     topic: 'yyy',
//   })

//   t.equal(roomList.length, 0, 'should return empty array before login')
// })
