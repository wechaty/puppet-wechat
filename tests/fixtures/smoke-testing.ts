#!/usr/bin/env ts-node

// tslint:disable:arrow-parens
// tslint:disable:max-line-length
// tslint:disable:member-ordering
// tslint:disable:no-shadowed-variable
// tslint:disable:unified-signatures
// tslint:disable:no-console

import {
  MemoryCard,
}                   from 'memory-card'

import {
  PuppetPuppeteer,
  log,
}                   from 'wechaty-puppet-puppeteer'

log.level('verbose')

async function main () {
  const puppet = new PuppetPuppeteer({ memory: new MemoryCard() })
  const future = new Promise(r => puppet.once('scan', r))

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
