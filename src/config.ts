/// <reference path="./typings.d.ts" />

import {
  log,
}                  from 'wechaty-puppet'
import {
  FileBox,
}                 from 'file-box'
import qrImage      from 'qr-image'

import { packageJson } from './package-json.js'
import type { Readable } from 'stream'

const VERSION = packageJson.version || '0.0.0'

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
  MEMORY_SLOT,
  qrCodeForChatie,
}
