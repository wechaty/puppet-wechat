#!/usr/bin/env ts-node

// tslint:disable:arrow-parens
// tslint:disable:max-line-length
// tslint:disable:member-ordering
// tslint:disable:no-shadowed-variable
// tslint:disable:unified-signatures
// tslint:disable:no-console

import {
  PuppetPuppeteer,
  VERSION,
  log,
}                   from 'wechaty-puppet-puppeteer'

log.level('verbose')

async function main () {
  if (VERSION === '0.0.0') {
    throw new Error('VERSION should not be 0.0.0 when publishing')
  }

  const puppet = new PuppetPuppeteer()
  const future = new Promise(resolve => puppet.once('scan', resolve))

  await puppet.start()
  await future

  log.info('SmokeTesting', 'main() event `scan` received!')

  await puppet.stop()

  log.info('SmokeTesting', `Puppet v${puppet.version()} smoke testing passed.`)
  return 0
}

main()
  .then(process.exit)
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
