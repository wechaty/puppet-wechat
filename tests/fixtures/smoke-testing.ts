#!/usr/bin/env node --no-warnings --loader ts-node/esm
import {
  PuppetWeChat,
  VERSION,
  log,
}                   from 'wechaty-puppet-wechat'

log.level('verbose')

async function main () {
  const puppet = new PuppetWeChat()
  const future = new Promise(resolve => puppet.once('scan', resolve))

  await puppet.start()
  await future

  log.info('SmokeTesting', 'main() event `scan` received!')

  await puppet.stop()

  if (VERSION === '0.0.0') {
    throw new Error('VERSION should not be 0.0.0 when publishing')
  }

  log.info('SmokeTesting', `Puppet v${puppet.version()} smoke testing passed.`)
  return 0
}

main()
  .then(process.exit)
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
