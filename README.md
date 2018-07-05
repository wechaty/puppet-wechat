# WECHATY-PUPPET-PUPPETEER

[![NPM Version](https://badge.fury.io/js/wechaty-puppet-puppeteer.svg)](https://badge.fury.io/js/wechaty-puppet-puppeteer)
[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-blue.svg)](https://www.typescriptlang.org/)
[![Linux/Mac Build Status](https://travis-ci.com/Chatie/wechaty-puppet-puppeteer.svg?branch=master)](https://travis-ci.com/Chatie/wechaty-puppet-puppeteer)

[![Wechaty Puppet Puppeteer](https://chatie.io/wechaty-puppet-puppeteer/images/puppeteer-logo.png)](https://github.com/chatie/wechaty-puppet-puppeteer)

> Picture Credit: [https://www.forsbergplustwo.com](https://www.forsbergplustwo.com/blogs/news/pdf-generation-with-chrome-headless-in-ruby-using-puppeteer-on-heroku)

Wechaty Puppet for Puppeteer

* This repository is a sub module of Wechaty. See: <https://github.com/Chatie/wechaty-puppet-puppeteer/issues/1>
* Source code before moved to here can be found at Wechaty repository: [Wechaty/src/puppet-puppeteer#a2c56e6](https://github.com/Chatie/wechaty/tree/a2c56e62642f9004243e3ad8e9c9d0b0dd1a4761/src/puppet-puppeteer)

## KNOWN LIMITATIONS

1. WeChat Account that registered after 2017 mignt not be able to login Web Wechat, so it can not use PuppetPuppeteer with Wechaty. Please make sure your WeChat Account can be able to login by visiting https://wx.qq.com
1. Web API can not create room and invite members to room since 2018.

If you want to break the above limitations, please consider to use a Wechaty Puppet other than using Web API, like [wechaty-puppet-padchat](https://github.com/lijiarui/wechaty-puppet-padchat).

Learn more about the Puppet at [Wechaty wiki: Puppet](https://github.com/Chatie/wechaty/wiki/Puppet)

## AUTHOR

[Huan LI](http://linkedin.com/in/zixia) \<zixia@zixia.net\>

<a href="https://stackexchange.com/users/265499">
  <img src="https://stackexchange.com/users/flair/265499.png" width="208" height="58" alt="profile for zixia on Stack Exchange, a network of free, community-driven Q&amp;A sites" title="profile for zixia on Stack Exchange, a network of free, community-driven Q&amp;A sites">
</a>

## COPYRIGHT & LICENSE

* Code & Docs © 2016-2018 Huan LI \<zixia@zixia.net\>
* Code released under the Apache-2.0 License
* Docs released under Creative Commons
