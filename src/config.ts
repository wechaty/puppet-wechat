/// <reference path="./typings.d.ts" />

import { OperationOptions } from 'retry'

import {
  // Brolog,
  log,
}                   from 'brolog'
import { FileBox }  from 'file-box'
import qrImage      from 'qr-image'

import { VERSION } from './version'

import promiseRetry = require('promise-retry')

export async function retry<T> (
  retryableFn: (
    retry: (error: Error) => never,
    attempt: number,
  ) => Promise<T>,
): Promise<T> {
  /**
   * 60 seconds: (to be confirmed)
   *  factor: 3
   *  minTimeout: 10
   *  maxTimeout: 20 * 1000
   *  retries: 9
   */
  const factor     = 3
  const minTimeout = 10
  const maxTimeout = 20 * 1000
  const retries    = 9
  // const unref      = true

  const retryOptions: OperationOptions = {
    factor,
    maxTimeout,
    minTimeout,
    retries,
  }
  return promiseRetry(retryOptions, retryableFn)
}

export function envHead (): boolean {
  const KEY = 'WECHATY_PUPPET_PUPPETEER_HEAD'
  return KEY in process.env
    ? !!process.env[KEY]
    : false

}

export function envStealthless (): boolean {
  const KEY = 'WECHATY_PUPPET_PUPPETEER_STEALTHLESS'
  return !!process.env[KEY]

}

export function qrCodeForChatie (): FileBox {
  const CHATIE_OFFICIAL_ACCOUNT_QRCODE = 'http://weixin.qq.com/r/qymXj7DEO_1ErfTs93y5'
  const name                           = 'qrcode-for-chatie.png'
  const type                           = 'png'

  const qrStream = qrImage.image(CHATIE_OFFICIAL_ACCOUNT_QRCODE, { type })
  return FileBox.fromStream(qrStream, name)
}

export const MEMORY_SLOT = 'PUPPET_PUPPETEER'

export {
  VERSION,
  log,
}
