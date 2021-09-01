/// <reference path="./typings.d.ts" />

import {
  FileBox,
  log,
}                  from 'wechaty-puppet'
import qrImage      from 'qr-image'

import { packageJson } from './package-json.js'
import type { Readable } from 'stream'

const VERSION = packageJson.version || '0.0.0'

function envHead (): boolean {
  const KEY = 'WECHATY_PUPPET_WECHAT_PUPPETEER_HEAD'
  return KEY in process.env
    ? !!process.env[KEY]
    : false

}

function envStealthless (): boolean {
  const KEY = 'WECHATY_PUPPET_WECHAT_PUPPETEER_STEALTHLESS'
  return !!process.env[KEY]

}

function qrCodeForChatie (): FileBox {
  const CHATIE_OFFICIAL_ACCOUNT_QRCODE = 'http://weixin.qq.com/r/qymXj7DEO_1ErfTs93y5'
  const name                           = 'qrcode-for-chatie.png'
  const type                           = 'png'

  const qrStream = qrImage.image(CHATIE_OFFICIAL_ACCOUNT_QRCODE, { type })
  return FileBox.fromStream(qrStream as Readable, name)
}

const MEMORY_SLOT = 'PUPPET_WECHAT'

export {
  VERSION,
  log,
  envHead,
  envStealthless,
  MEMORY_SLOT,
  qrCodeForChatie,
}
