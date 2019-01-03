# WECHATY-PUPPET-PUPPETEER

[![Powered by Wechaty](https://img.shields.io/badge/Powered%20By-Wechaty-blue.svg)](https://github.com/chatie/wechaty)
[![NPM Version](https://badge.fury.io/js/wechaty-puppet-puppeteer.svg)](https://badge.fury.io/js/wechaty-puppet-puppeteer)
[![npm (tag)](https://img.shields.io/npm/v/wechaty-puppet-puppeteer/next.svg)](https://www.npmjs.com/package/wechaty-puppet-puppeteer?activeTab=versions)
[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-blue.svg)](https://www.typescriptlang.org/)
[![Linux/Mac Build Status](https://travis-ci.com/Chatie/wechaty-puppet-puppeteer.svg?branch=master)](https://travis-ci.com/Chatie/wechaty-puppet-puppeteer)
[![Greenkeeper badge](https://badges.greenkeeper.io/Chatie/wechaty-puppet-puppeteer.svg)](https://greenkeeper.io/)

[![Wechaty Puppet Puppeteer](https://chatie.io/wechaty-puppet-puppeteer/images/puppeteer-logo.png)](https://github.com/chatie/wechaty-puppet-puppeteer)

> Picture Credit: [https://www.forsbergplustwo.com](https://www.forsbergplustwo.com/blogs/news/pdf-generation-with-chrome-headless-in-ruby-using-puppeteer-on-heroku)

Wechaty Puppet for Puppeteer

* This repository is a sub module of Wechaty. See: <https://github.com/Chatie/wechaty-puppet-puppeteer/issues/1>
* Source code before moved to here can be found at Wechaty repository: [Wechaty/src/puppet-puppeteer#a2c56e6](https://github.com/Chatie/wechaty/tree/a2c56e62642f9004243e3ad8e9c9d0b0dd1a4761/src/puppet-puppeteer)

## KNOWN LIMITATIONS

1. WeChat Account that registered after 2017 mignt not be able to login Web Wechat, so it can not use PuppetPuppeteer with Wechaty. Please make sure your WeChat Account can be able to login by visiting <https://wx.qq.com>
1. Web API can not create room and invite members to room since 2018.
1. Can not Receive/Send message from Work Wechat.

If you want to break the above limitations, please consider to use a Wechaty Puppet other than using Web API, like [wechaty-puppet-padchat](https://github.com/lijiarui/wechaty-puppet-padchat).

Learn more about the Puppet at [Wechaty wiki: Puppet](https://github.com/Chatie/wechaty/wiki/Puppet)

## Note for Developers in China

Cause `storage.googleapis.com` is blocked in mainland china, you'd better config by following guide.

### `npm` user

```bash
npm config set registry https://registry.npm.taobao.org
npm config set disturl https://npm.taobao.org/dist
npm config set puppeteer_download_host https://storage.googleapis.com.cnpmjs.org
```

then you can check your `$HOME/.npmrc`

### `yarn` user

```bash
yarn config set registry https://registry.npm.taobao.org
yarn config set disturl https://npm.taobao.org/dist
yarn config set puppeteer_download_host https://storage.googleapis.com.cnpmjs.org
```

then you can check your `$HOME/.yarnrc`

## HISTORY

### v0.15 master

### v0.14 Aug 2018

1. First Stable Release
1. Follow latest typings

### v0.2 May 2018

1. Promote to solo package: `wechaty-puppet-puppeteer`

## AUTHOR

[Huan LI](http://linkedin.com/in/zixia) \<zixia@zixia.net\>

<a href="https://stackexchange.com/users/265499">
  <img src="https://stackexchange.com/users/flair/265499.png" width="208" height="58" alt="profile for zixia on Stack Exchange, a network of free, community-driven Q&amp;A sites" title="profile for zixia on Stack Exchange, a network of free, community-driven Q&amp;A sites">
</a>

## COPYRIGHT & LICENSE

* Code & Docs © 2016-2019 Huan LI \<zixia@zixia.net\>
* Code released under the Apache-2.0 License
* Docs released under Creative Commons
