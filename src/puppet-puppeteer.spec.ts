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
// tslint:disable:no-var-requires
// tslint:disable:only-arrow-functions
// tslint:disable:arrow-parens

import { test, sinon } from 'tstest'// const sinonTest   = require('sinon-test')(sinon, {
//   useFakeTimers: {  // https://github.com/sinonjs/lolex
//     advanceTimeDelta  : 10,
//     shouldAdvanceTime : true,
//   },
// })

// import { log }    from './config'
// log.level('silly')

import { Bridge }           from './bridge'
import { Event }            from './event'
import { PuppetPuppeteer }  from './puppet-puppeteer'

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

// test('Puppet smoke testing', async t => {
//   const puppet  = new PuppetTest()
//   const wechaty = new WechatyTest({ puppet })
//   wechaty.initPuppetAccessory(puppet)

//   t.ok(puppet.state.off(), 'should be OFF state after instanciate')
//   puppet.state.on('pending')
//   t.ok(puppet.state.on(), 'should be ON state after set')
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
    t.is(puppet.logonoff(), false, 'should be not logined')

    const future = new Promise(resolve => puppet.once('login', resolve))
      .catch(e => t.fail(e))
    puppet.bridge.emit('login', 'TestPuppetPuppeteer')
    await future

    t.is(puppet.logonoff(), true, 'should be logined')

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
     * 3, 4, 5 is PuppetPuppeteer.waitStable() for `unchangedNum` to reach 3 times.
     */
    t.is((Bridge.prototype.contactList as any).callCount, 6, 'should call stubContacList 6 times')

    t.ok(readySpy.called, 'should emit ready event, after login')

    const logoutPromise = new Promise((resolve) => puppet.once('logout', () => resolve('logoutFired')))
    puppet.bridge.emit('logout')
    t.is(await logoutPromise, 'logoutFired', 'should fire logout event')
    t.is(puppet.logonoff(), false, 'should be logouted')

    await puppet.stop()
  } catch (e) {
    t.fail(e)
  } finally {
    sandbox.restore()
  }
})

test('restart() 3 times', async t => {
  const puppet = new PuppetPuppeteer()

  let n = 3

  while (n--) {
    await puppet.start()
    await puppet.stop()
  }

  t.pass('restarted many times')
})
