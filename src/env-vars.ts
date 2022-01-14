import { log } from 'wechaty-puppet'

function WECHATY_PUPPET_WECHAT_PUPPETEER_HEAD (value?: boolean): boolean {
  if (typeof value !== 'undefined') {
    return value
  }
  return !!process.env['WECHATY_PUPPET_WECHAT_PUPPETEER_HEAD']
}

const WECHATY_PUPPET_WECHAT_PUPPETEER_STEALTHLESS = (value?: boolean): boolean => {
  if (typeof value !== 'undefined') {
    return value
  }
  return !!process.env['WECHATY_PUPPET_WECHAT_PUPPETEER_STEALTHLESS']
}

const WECHATY_PUPPET_WECHAT_ENDPOINT = (value?: string): undefined | string => {
  if (typeof value !== 'undefined') {
    return value
  }

  if (process.env['WECHATY_PUPPET_WECHAT_ENDPOINT']) {
    return process.env['WECHATY_PUPPET_WECHAT_ENDPOINT']
  }

  if (process.env['WECHATY_PUPPET_PUPPETEER_ENDPOINT']) {
    log.warn('PuppetWeChat', 'WECHATY_PUPPET_PUPPETEER_ENDPOINT deprecated, use WECHATY_PUPPET_WECHAT_ENDPOINT instead.')
    return process.env['WECHATY_PUPPET_PUPPETEER_ENDPOINT']
  }

  return undefined
}

const WECHATY_PUPPET_WECHAT_TOKEN = (value?: string): undefined | string => {
  if (typeof value !== 'undefined') {
    return value
  }
  return process.env['WECHATY_PUPPET_WECHAT_TOKEN']
}

const WECHATY_PUPPET_WECHAT_PUPPETEER_UOS = (value?: boolean): boolean => {
  if (typeof value !== 'undefined') {
    return value
  }
  return /^(true|1)$/i.test(String(process.env['WECHATY_PUPPET_WECHAT_PUPPETEER_UOS']))
}

export {
  WECHATY_PUPPET_WECHAT_PUPPETEER_HEAD,
  WECHATY_PUPPET_WECHAT_PUPPETEER_STEALTHLESS,
  WECHATY_PUPPET_WECHAT_ENDPOINT,
  WECHATY_PUPPET_WECHAT_TOKEN,
  WECHATY_PUPPET_WECHAT_PUPPETEER_UOS,
}
