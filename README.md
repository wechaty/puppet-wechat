# WECHATY-PUPPET-WECHAT

[![Powered by Wechaty](https://img.shields.io/badge/Powered%20By-Wechaty-blue.svg)](https://github.com/wechaty/wechaty)
[![NPM Version](https://badge.fury.io/js/wechaty-puppet-wechat.svg)](https://badge.fury.io/js/wechaty-puppet-wechat)
[![npm (tag)](https://img.shields.io/npm/v/wechaty-puppet-wechat/next.svg)](https://www.npmjs.com/package/wechaty-puppet-wechat?activeTab=versions)
[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-blue.svg)](https://www.typescriptlang.org/)
[![NPM](https://github.com/wechaty/wechaty-puppet-wechat/workflows/NPM/badge.svg)](https://github.com/wechaty/wechaty-puppet-wechat/actions?query=workflow%3ANPM)
[![ES Modules](https://img.shields.io/badge/ES-Modules-brightgreen)](https://github.com/Chatie/tsconfig/issues/16)

[![Wechaty Puppet Puppeteer](docs/images/wechaty-puppet-wechat.png)](https://github.com/wechaty/wechaty-puppet-wechat)

> Picture Credit: [https://www.forsbergplustwo.com](https://www.forsbergplustwo.com/blogs/news/pdf-generation-with-chrome-headless-in-ruby-using-puppeteer-on-heroku)

Wechaty Puppet for WeChat

- This repository is a sub module of Wechaty. See: <https://github.com/wechaty/wechaty-puppet-wechat/issues/1>
- Source code before moved to here can be found at Wechaty repository: [Wechaty/src/puppet-puppeteer#a2c56e6](https://github.com/wechaty/wechaty/tree/a2c56e62642f9004243e3ad8e9c9d0b0dd1a4761/src/puppet-puppeteer)

## KNOWN LIMITATIONS

1. Solved by UOS. ~~WeChat Account that registered after 2017 mignt not be able to login Web Wechat, so it can not use PuppetWeChat with Wechaty. Please make sure your WeChat Account can be able to login by visiting <https://wx.qq.com>~~
1. Web API can not create room and invite members to room since 2018.
1. Can not Receive/Send message from Work Wechat.

If you want to break the above limitations, please consider to use a Wechaty Puppet other than using Web API, like [wechaty-puppet-padchat](https://github.com/lijiarui/wechaty-puppet-padchat).

Learn more about the Puppet at [Wechaty wiki: Puppet](https://github.com/wechaty/wechaty/wiki/Puppet)

## Note for Developers in China

Cause `storage.googleapis.com` is blocked in mainland china, you'd better config by following guide.

### 1. Linux & Mac

```shell
PUPPETEER_DOWNLOAD_HOST=https://registry.npmmirror.com/mirrors npm install wechaty-puppet-wechat
```

### 2. Windows

```shell
SET PUPPETEER_DOWNLOAD_HOST=https://registry.npmmirror.com/mirrors npm install wechaty-puppet-wechat
```

Learn more from <https://github.com/GoogleChrome/puppeteer/issues/1597#issuecomment-351945645>

## How to set puppeteer launchOptions?

An example of adding executablePath to puppeteer.launch():

```js
const bot = new Wechaty({
  name: 'mybot',
  puppet: 'wechaty-puppet-wechat',
  // ...
  puppetOptions: {
    endpoint: '<executablePath>'
  }
});

// or
const bot = new Wechaty({
  name: 'mybot',
  puppet: 'wechaty-puppet-wechat',
  // ...
  puppetOptions: {
    launchOptions: {
      executablePath: '<executablePath>',
      // ... others launchOptions, see: https://github.com/GoogleChrome/puppeteer/blob/v1.18.1/docs/api.md#puppeteerlaunchoptions
    }
  }
});
```

We use [stealth](https://www.npmjs.com/package/puppeteer-extra-plugin-stealth) to make puppeteer more like a normal browser, if you want to disabled it, just set the `WECHATY_PUPPET_WECHAT_PUPPETEER_STEALTHLESS` environment variable to `1`. eg. `WECHATY_PUPPET_WECHAT_PUPPETEER_STEALTHLESS=1 ts-node your-bot.ts`

[In rare cases](https://github.com/wechaty/matrix-appservice-wechaty/issues/78#issuecomment-882208894), we could meet some problem and see `Error: Could not find expected browser` when we start PuppetWeChatBridge and try to run `initBrowser()`. A easy way to solve this problem is set `WECHATY_PUPPET_WECHAT_ENDPOINT` environment variable to `<your executablePath>`. eg. `WECHATY_PUPPET_WECHAT_ENDPOINT=/usr/bin/chromium-browser ts-node your-bot.ts`

## puppetOptions

| Option        |  value  | default value | description                                                                                                                 |
| ------------- | :-----: | :-----------: | :-------------------------------------------------------------------------------------------------------------------------- |
| token         | string  |       -       | your own uos extspam value, see [#127](https://github.com/wechaty/wechaty-puppet-wechat/issues/127)                         |
| endpoint      | string  |       -       | puppeteerlaunchoptions.executablePath                                                                                       |
| head          | boolean |     false     | puppeteerlaunchoptions.headless                                                                                             |
| launchOptions | object  |       -       | same to [puppeteerlaunchoptions](https://github.com/GoogleChrome/puppeteer/blob/v1.18.1/docs/api.md#puppeteerlaunchoptions) |
| stealthless   | boolean |     false     | disabled [puppeteer-extra-plugin-stealth](https://www.npmjs.com/package/puppeteer-extra-plugin-stealth) or not              |
| uos           | boolean |     false     | enable [UOS patch](https://github.com/wechaty/puppet-wechat/issues/127) or not                                              |

## HISTORY

### master v1.12 (Mar 11, 2022)

Release stable for the standard Web Protocol

### v1.0 (Oct 30, 2021)

Release 1.0 of Wechaty Puppet for WeChat

1. v0.30 (Sep, 2021): ESM support.

### v0.28 (Apr 13, 2021)

[重磅：绕过登录限制，wechaty免费版web协议重放荣光](https://wechaty.js.org/2021/04/13/wechaty-uos-web/)

1. Support UOS with puppeteer [#127](https://github.com/wechaty/wechaty-puppet-wechat/issues/127)
1. 添加uos请求头支持 [#129](https://github.com/wechaty/wechaty-puppet-wechat/pull/129)

### v0.26 (Mar 4, 2021)

Rename NPM package name from `wechaty-puppet-puppeteer` to `wechaty-puppet-wechat`

### v0.24 (Feb 20, 2021)

1. Puppeteer from v5 to v7
1. Upgrade other deps

### v0.22 (Jun 18, 2020)

Release a version before upgrade.

### v0.14 (Aug, 2018)

1. First Stable Release
1. Follow latest typings

### v0.2 (May, 2018)

1. Promote to solo package: `wechaty-puppet-puppeteer`

## FAQ

### 1. chrome-linux/chrome: error while loading shared libraries: libXXX.so.x: cannot open shared object file: No such file or directory

You need to be able to run chrome in your Linux environment. If you are using Ubuntu Linux:

- _error while loading shared libraries: libnss3.so: cannot open shared object file: No such file or directory_
  - `apt install libnss3`
- _error while loading shared libraries: libgbm.so.1: cannot open shared object file: No such file or directory_
  - `apt install libgbm-dev`
- _error while loading shared libraries: libxshmfence.so.1: cannot open shared object file: No such file or directory_
  - `apt install libxshmfence-dev`
- _error while loading shared libraries: libX11.so.6: cannot open shared object file: No such file or directory_
  - `apt install libxss1`

See: <https://github.com/wechaty/wechaty/issues/1152>

## AUTHOR

[Huan LI](http://linkedin.com/in/zixia) Tencent TVP of Chatbot \<zixia@zixia.net\>

<!-- markdownlint-disable MD033 -->
<a href="https://stackexchange.com/users/265499">
  <img src="https://stackexchange.com/users/flair/265499.png" width="208" height="58" alt="profile for zixia on Stack Exchange, a network of free, community-driven Q&amp;A sites" title="profile for zixia on Stack Exchange, a network of free, community-driven Q&amp;A sites">
</a>

## COPYRIGHT & LICENSE

- Code & Docs © 2016-now Huan LI \<zixia@zixia.net\>
- Code released under the Apache-2.0 License
- Docs released under Creative Commons
