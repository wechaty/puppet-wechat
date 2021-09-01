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

/**
 * Process the Message to find which event to FIRE
 */

import { test } from 'tstest'

import { Firer }              from './firer.js'
import type { PuppetWeChat }  from './puppet-wechat.js'

const SELF_ID = 'self-id'
const mockPuppetWeChat = {
  selfId: () => SELF_ID,
} as any as PuppetWeChat

test('parseFriendConfirm()', async (t) => {
  const contentList = [
    [
      'You have added 李卓桓 as your WeChat contact. Start chatting!',
      '李卓桓',
    ],
    [
      '你已添加了李卓桓，现在可以开始聊天了。',
      '李卓桓',
    ],
    [
      'johnbassserver@gmail.com just added you to his/her contacts list. Send a message to him/her now!',
      'johnbassserver@gmail.com',
    ],
    [
      'johnbassserver@gmail.com刚刚把你添加到通讯录，现在可以开始聊天了。',
      'johnbassserver@gmail.com',
    ],
  ]
  let result: boolean

  const firer = new Firer(mockPuppetWeChat)

  contentList.forEach(([content]) => {
    result = (firer as any).parseFriendConfirm(content)
    t.true(result, 'should be truthy for confirm msg: ' + content)
  })

  result = (firer as any).parseFriendConfirm('fsdfsdfasdfasdfadsa')
  t.false(result, 'should be falsy for other msg')
})

test('parseRoomJoin()', async (t) => {
  const contentList: Array<[string, string, string[]]> = [
    [
      'You invited 管理员 to the group chat.   ',
      'You',
      ['管理员'],
    ],
    [
      'You invited 李卓桓.PreAngel、Bruce LEE to the group chat.   ',
      'You',
      ['李卓桓.PreAngel', 'Bruce LEE'],
    ],
    [
      '管理员 invited 小桔建群助手 to the group chat',
      '管理员',
      ['小桔建群助手'],
    ],
    [
      '管理员 invited 庆次、小桔妹 to the group chat',
      '管理员',
      ['庆次', '小桔妹'],
    ],
    [
      '你邀请"管理员"加入了群聊  ',
      '你',
      ['管理员'],
    ],
    [
      '"管理员"邀请"宁锐锋"加入了群聊',
      '管理员',
      ['宁锐锋'],
    ],
    [
      '"管理员"通过扫描你分享的二维码加入群聊  ',
      '你',
      ['管理员'],
    ],
    [
      '" 桔小秘"通过扫描"李佳芮"分享的二维码加入群聊',
      '李佳芮',
      ['桔小秘'],
    ],
    [
      '"管理员" joined group chat via the QR code you shared.  ',
      'you',
      ['管理员'],
    ],
    [
      '"宁锐锋" joined the group chat via the QR Code shared by "管理员".',
      '管理员',
      ['宁锐锋'],
    ],
  ]

  const firer = new Firer(mockPuppetWeChat)

  let result
  contentList.forEach(([content, inviter, inviteeList]) => {
    result = (firer as any).parseRoomJoin(content)
    t.ok(result, 'should check room join message right for ' + content)
    t.same(result[0], inviteeList, 'should get inviteeList right')
    t.equal(result[1], inviter, 'should get inviter right')
  })

  t.throws(() => {
    (firer as any).parseRoomJoin('fsadfsadfsdfsdfs')
  }, Error, 'should throws if message is not expected')
})

test('parseRoomLeave()', async (t) => {
  const contentLeaverList = [
    [
      'You removed "Bruce LEE" from the group chat',
      'Bruce LEE',
    ],
    [
      '你将"李佳芮"移出了群聊',
      '李佳芮',
    ],
  ]

  const contentRemoverList = [
    [
      'You were removed from the group chat by "桔小秘"',
      '桔小秘',
    ],
    [
      '你被"李佳芮"移出群聊',
      '李佳芮',
    ],
  ]

  const firer = new Firer(mockPuppetWeChat)

  contentLeaverList.forEach(([content, leaver]) => {
    const resultLeaver = (firer as any).parseRoomLeave(content)[0]
    t.ok(resultLeaver, 'should get leaver for leave message: ' + content)
    t.equal(resultLeaver, leaver, 'should get leaver name right')
  })

  contentRemoverList.forEach(([content, remover]) => {
    const resultRemover = (firer as any).parseRoomLeave(content)[1]
    t.ok(resultRemover, 'should get remover for leave message: ' + content)
    t.equal(resultRemover, remover, 'should get leaver name right')
  })

  t.throws(() => {
    (firer as any).parseRoomLeave('fafdsfsdfafa')
  }, Error, 'should throw if message is not expected')
})

test('parseRoomTopic()', async (t) => {
  const contentList = [
    [
      '"李卓桓.PreAngel" changed the group name to "ding"',
      '李卓桓.PreAngel',
      'ding',
    ],
    [
      '"李佳芮"修改群名为“dong”',
      '李佳芮',
      'dong',
    ],
  ]

  const firer = new Firer(mockPuppetWeChat)

  let result
  contentList.forEach(([content, changer, topic]) => {
    result = (firer as any).parseRoomTopic(content)
    t.ok(result, 'should check topic right for content: ' + content)
    t.equal(topic,   result[0], 'should get right topic')
    t.equal(changer, result[1], 'should get right changer')
  })

  t.throws(() => {
    (firer as any).parseRoomTopic('fafdsfsdfafa')
  }, Error, 'should throw if message is not expected')

})
