#!/usr/bin/env -S node --no-warnings --loader ts-node/esm
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
}               from 'tstest'// const sinonTest   = require('sinon-test')(sinon, {
//   useFakeTimers: {  // https://github.com/sinonjs/lolex
//     advanceTimeDelta  : 10,
//     shouldAdvanceTime : true,
//   },
// })

// import { log }    from './config'
// log.level('silly')
import whyIsNodeRunning     from 'why-is-node-running'

import { Bridge }           from './bridge.js'
import { Event }            from './event.js'
import { PuppetWeChat }  from './puppet-wechat.js'

class PuppetTest extends PuppetWeChat {

  override contactRawPayload (id: string) {
    return super.contactRawPayload(id)
  }

  override roomRawPayload (id: string) {
    return super.roomRawPayload(id)
  }

  override messageRawPayload (id: string) {
    return super.messageRawPayload(id)
  }

}

// test('Puppet smoke testing', async t => {
//   const puppet  = new PuppetTest()
//   const wechaty = new WechatyTest({ puppet })
//   wechaty.initPuppetAccessory(puppet)

//   t.ok(puppet.state.inactive(), 'should be OFF state after instanciate')
//   puppet.state.active('pending')
//   t.ok(puppet.state.active(), 'should be ON state after set')
//   t.ok(puppet.state.pending(), 'should be pending state after set')
// })

test('login/logout events', async t => {
  const sandbox = sinon.createSandbox()

  try {
    const puppet  = new PuppetTest()

    sandbox.stub(Event, 'onScan') // block the scan event to prevent reset logined user

    sandbox.stub(Bridge.prototype, 'getUserName').resolves('mockedUserName')
    sandbox.stub(Bridge.prototype, 'contactList')
      .onFirstCall().resolves([])
      .onSecondCall().resolves(['1'])
      .resolves(['1', '2'])

    sandbox.stub(puppet, 'contactRawPayload').resolves({
      NickName: 'mockedNickName',
      UserName: 'mockedUserName',
    } as any)
    // sandbox.stub(puppet, 'waitStable').resolves()

    const readySpy = sandbox.spy()
    puppet.on('ready', readySpy)

    await puppet.start()
    t.pass('should be inited')
    t.equal(puppet.isLoggedIn, false, 'should be not logined')

    const future = new Promise(resolve => puppet.once('login', resolve))
      .catch(e => t.fail(e))
    puppet.bridge.emit('login', 'TestPuppetWeChat')
    await future

    t.equal(puppet.isLoggedIn, true, 'should be logined')

    t.ok((puppet.bridge.getUserName as any).called, 'bridge.getUserName should be called')

    // FIXME: improve the performance of the test by mocking the time
    // TODO(huan) July 2018: use sinon.clock / sinon.useFakeTimers() at here
    await new Promise(resolve => setTimeout(resolve, 7000))

    // Puppet will not ready the contact, so the contactRawPayload might not be called at here. Huan, 2018.6
    // t.ok((puppet.contactRawPayload as any).called,  'puppet.contactRawPayload should be called')

    t.ok((Bridge.prototype.contactList as any).called, 'contactList stub should be called')

    /**
     * 6 times is:
     *
     * 0, 1, 2 is for first 3 calls for contactList()
     *
     * 3, 4, 5 is PuppetWeChat.waitStable() for `unchangedNum` to reach 3 times.
     */
    t.equal((Bridge.prototype.contactList as any).callCount, 6, 'should call stubContacList 6 times')

    t.ok(readySpy.called, 'should emit ready event, after login')

    const LOGOUT_FIRED = 'logoutFired'
    const logoutPromise = new Promise((resolve) => puppet.once('logout', () => resolve(LOGOUT_FIRED)))
    puppet.bridge.emit('logout')
    t.equal(await logoutPromise, LOGOUT_FIRED, 'should fire logout event')
    await new Promise(setImmediate)
    t.equal(puppet.isLoggedIn, false, 'should be logouted')

    await puppet.stop()
  } catch (e) {
    t.fail(e as any)
  } finally {
    sandbox.restore()
  }
})

/**
 * FIXME: increase test times from 1 to 3 Huan(202006)
 */
test('PuppetWechat perfect restart', async t => {
  const puppet = new PuppetWeChat()

  let n = 1

  while (n--) {
    await puppet.start()
    // await new Promise(resolve => setTimeout(resolve, 1000))
    await puppet.stop()
    t.pass(`perfect restart #${n}`)
  }

  void whyIsNodeRunning
  // setInterval(whyIsNodeRunning, 5000)
})
