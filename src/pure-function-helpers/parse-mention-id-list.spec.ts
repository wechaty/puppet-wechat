#!/usr/bin/env node --no-warnings --loader ts-node/esm

/**
 *   Wechaty - https://github.com/chatie/wechaty
 *
 *   @copyright 2016-2018 Huan LI <zixia@zixia.net>
 *
 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 *
 */

import { test } from 'tstest'
import type { Puppet } from 'wechaty-puppet'

import { parseMentionIdList } from './parse-mention-id-list.js'

/* eslint-disable quotes */
/* eslint-disable no-useless-escape */
/* eslint-disable no-irregular-whitespace */

test('parseMentionIdList()', async t => {
  const rawObj11 = JSON.parse(`{"MsgId":"6475340302153501409","FromUserName":"@@9cdc696e490bd76c57e7dd54792dc1408e27d65e312178b1943e88579b7939f4","ToUserName":"@cd7d467d7464e8ff6b0acd29364654f3666df5d04551f6082bfc875f90a6afd2","MsgType":1,"Content":"@4c32c97337cbb325442c304d6a44e374:<br/>@_@","Status":3,"ImgStatus":1,"CreateTime":1489823176,"VoiceLength":0,"PlayLength":0,"FileName":"","FileSize":"","MediaId":"","Url":"","AppMsgType":0,"StatusNotifyCode":0,"StatusNotifyUserName":"","RecommendInfo":{"UserName":"","NickName":"","QQNum":0,"Province":"","City":"","Content":"","Signature":"","Alias":"","Scene":0,"VerifyFlag":0,"AttrStatus":0,"Sex":0,"Ticket":"","OpCode":0},"ForwardFlag":0,"AppInfo":{"AppID":"","Type":0},"HasProductId":0,"Ticket":"","ImgHeight":0,"ImgWidth":0,"SubMsgType":0,"NewMsgId":6475340302153502000,"OriContent":"","MMPeerUserName":"@@9cdc696e490bd76c57e7dd54792dc1408e27d65e312178b1943e88579b7939f4","MMDigest":"22acb030-ff09-11e6-8a73-cff62d9268c5:@_@","MMIsSend":false,"MMIsChatRoom":true,"MMUnread":true,"LocalID":"6475340302153501409","ClientMsgId":"6475340302153501409","MMActualContent":"@_@","MMActualSender":"@4c32c97337cbb325442c304d6a44e374","MMDigestTime":"15:46","MMDisplayTime":1489823176,"MMTime":"15:46"}`)

  const rawObj12 = JSON.parse(`{"MsgId":"3670467504370401673","FromUserName":"@@9cdc696e490bd76c57e7dd54792dc1408e27d65e312178b1943e88579b7939f4","ToUserName":"@cd7d467d7464e8ff6b0acd29364654f3666df5d04551f6082bfc875f90a6afd2","MsgType":1,"Content":"@4c32c97337cbb325442c304d6a44e374:<br/>user@email.com","Status":3,"ImgStatus":1,"CreateTime":1489823281,"VoiceLength":0,"PlayLength":0,"FileName":"","FileSize":"","MediaId":"","Url":"","AppMsgType":0,"StatusNotifyCode":0,"StatusNotifyUserName":"","RecommendInfo":{"UserName":"","NickName":"","QQNum":0,"Province":"","City":"","Content":"","Signature":"","Alias":"","Scene":0,"VerifyFlag":0,"AttrStatus":0,"Sex":0,"Ticket":"","OpCode":0},"ForwardFlag":0,"AppInfo":{"AppID":"","Type":0},"HasProductId":0,"Ticket":"","ImgHeight":0,"ImgWidth":0,"SubMsgType":0,"NewMsgId":3670467504370402000,"OriContent":"","MMPeerUserName":"@@9cdc696e490bd76c57e7dd54792dc1408e27d65e312178b1943e88579b7939f4","MMDigest":"22acb030-ff09-11e6-8a73-cff62d9268c5:user@email.com","MMIsSend":false,"MMIsChatRoom":true,"MMUnread":true,"LocalID":"3670467504370401673","ClientMsgId":"3670467504370401673","MMActualContent":"<a target=\'_blank\' href=\'/cgi-bin/mmwebwx-bin/webwxcheckurl?requrl=http%3A%2F%2Fuser%40email.com&skey=%40crypt_ee003aea_5265cdd0c2676aab3df86b0249ae90f7&deviceid=e982718209172853&pass_ticket=undefined&opcode=2&scene=1&username=@cd7d467d7464e8ff6b0acd29364654f3666df5d04551f6082bfc875f90a6afd2\'>user@email.com</a>","MMActualSender":"@4c32c97337cbb325442c304d6a44e374","MMDigestTime":"15:48","MMDisplayTime":1489823176,"MMTime":""}`)

  const rawObj13 = JSON.parse(`{"MsgId":"6796857876930585020","FromUserName":"@@9cdc696e490bd76c57e7dd54792dc1408e27d65e312178b1943e88579b7939f4","ToUserName":"@cd7d467d7464e8ff6b0acd29364654f3666df5d04551f6082bfc875f90a6afd2","MsgType":1,"Content":"@4c32c97337cbb325442c304d6a44e374:<br/>@_@ wow! my email is ruiruibupt@gmail.com","Status":3,"ImgStatus":1,"CreateTime":1489823387,"VoiceLength":0,"PlayLength":0,"FileName":"","FileSize":"","MediaId":"","Url":"","AppMsgType":0,"StatusNotifyCode":0,"StatusNotifyUserName":"","RecommendInfo":{"UserName":"","NickName":"","QQNum":0,"Province":"","City":"","Content":"","Signature":"","Alias":"","Scene":0,"VerifyFlag":0,"AttrStatus":0,"Sex":0,"Ticket":"","OpCode":0},"ForwardFlag":0,"AppInfo":{"AppID":"","Type":0},"HasProductId":0,"Ticket":"","ImgHeight":0,"ImgWidth":0,"SubMsgType":0,"NewMsgId":6796857876930585000,"OriContent":"","MMPeerUserName":"@@9cdc696e490bd76c57e7dd54792dc1408e27d65e312178b1943e88579b7939f4","MMDigest":"22acb030-ff09-11e6-8a73-cff62d9268c5:@_@ wow! my email is ruiruibupt@gmail.com","MMIsSend":false,"MMIsChatRoom":true,"MMUnread":true,"LocalID":"6796857876930585020","ClientMsgId":"6796857876930585020","MMActualContent":"@_@ wow! my email is<a target=\'_blank\' href=\'/cgi-bin/mmwebwx-bin/webwxcheckurl?requrl=http%3A%2F%2Fruiruibupt%40gmail.com&skey=%40crypt_ee003aea_5265cdd0c2676aab3df86b0249ae90f7&deviceid=e982718209172853&pass_ticket=undefined&opcode=2&scene=1&username=@cd7d467d7464e8ff6b0acd29364654f3666df5d04551f6082bfc875f90a6afd2\'> ruiruibupt@gmail.com</a>","MMActualSender":"@4c32c97337cbb325442c304d6a44e374","MMDigestTime":"15:49","MMDisplayTime":1489823387,"MMTime":"15:49"}`)

  const rawObj21 = JSON.parse(`{"MsgId":"2661793617819734017","FromUserName":"@@9cdc696e490bd76c57e7dd54792dc1408e27d65e312178b1943e88579b7939f4","ToUserName":"@cd7d467d7464e8ff6b0acd29364654f3666df5d04551f6082bfc875f90a6afd2","MsgType":1,"Content":"@4c32c97337cbb325442c304d6a44e374:<br/>@小桔同学 你好啊","Status":3,"ImgStatus":1,"CreateTime":1489823541,"VoiceLength":0,"PlayLength":0,"FileName":"","FileSize":"","MediaId":"","Url":"","AppMsgType":0,"StatusNotifyCode":0,"StatusNotifyUserName":"","RecommendInfo":{"UserName":"","NickName":"","QQNum":0,"Province":"","City":"","Content":"","Signature":"","Alias":"","Scene":0,"VerifyFlag":0,"AttrStatus":0,"Sex":0,"Ticket":"","OpCode":0},"ForwardFlag":0,"AppInfo":{"AppID":"","Type":0},"HasProductId":0,"Ticket":"","ImgHeight":0,"ImgWidth":0,"SubMsgType":0,"NewMsgId":2661793617819734000,"OriContent":"","MMPeerUserName":"@@9cdc696e490bd76c57e7dd54792dc1408e27d65e312178b1943e88579b7939f4","MMDigest":"22acb030-ff09-11e6-8a73-cff62d9268c5:@小桔同学 你好啊","MMIsSend":false,"MMIsChatRoom":true,"MMUnread":true,"LocalID":"2661793617819734017","ClientMsgId":"2661793617819734017","MMActualContent":"@小桔同学 你好啊","MMActualSender":"@4c32c97337cbb325442c304d6a44e374","MMDigestTime":"15:52","MMDisplayTime":1489823387,"MMTime":""}`)

  const rawObj22 = JSON.parse(`{"MsgId":"5278536998175085820","FromUserName":"@@9cdc696e490bd76c57e7dd54792dc1408e27d65e312178b1943e88579b7939f4","ToUserName":"@cd7d467d7464e8ff6b0acd29364654f3666df5d04551f6082bfc875f90a6afd2","MsgType":1,"Content":"@4c32c97337cbb325442c304d6a44e374:<br/>@wuli舞哩客服 和@小桔同学 是好朋友","Status":3,"ImgStatus":1,"CreateTime":1489823598,"VoiceLength":0,"PlayLength":0,"FileName":"","FileSize":"","MediaId":"","Url":"","AppMsgType":0,"StatusNotifyCode":0,"StatusNotifyUserName":"","RecommendInfo":{"UserName":"","NickName":"","QQNum":0,"Province":"","City":"","Content":"","Signature":"","Alias":"","Scene":0,"VerifyFlag":0,"AttrStatus":0,"Sex":0,"Ticket":"","OpCode":0},"ForwardFlag":0,"AppInfo":{"AppID":"","Type":0},"HasProductId":0,"Ticket":"","ImgHeight":0,"ImgWidth":0,"SubMsgType":0,"NewMsgId":5278536998175086000,"OriContent":"","MMPeerUserName":"@@9cdc696e490bd76c57e7dd54792dc1408e27d65e312178b1943e88579b7939f4","MMDigest":"22acb030-ff09-11e6-8a73-cff62d9268c5:@wuli舞哩客服 和@小桔同学 是好朋友","MMIsSend":false,"MMIsChatRoom":true,"MMUnread":true,"LocalID":"5278536998175085820","ClientMsgId":"5278536998175085820","MMActualContent":"@wuli舞哩客服 和@小桔同学 是好朋友","MMActualSender":"@4c32c97337cbb325442c304d6a44e374","MMDigestTime":"15:53","MMDisplayTime":1489823598,"MMTime":"15:53"}`)

  const rawObj31 = JSON.parse(`{"MsgId":"7410792097315403535","FromUserName":"@@9cdc696e490bd76c57e7dd54792dc1408e27d65e312178b1943e88579b7939f4","ToUserName":"@cd7d467d7464e8ff6b0acd29364654f3666df5d04551f6082bfc875f90a6afd2","MsgType":1,"Content":"@4c32c97337cbb325442c304d6a44e374:<br/>@wuli舞哩客服 我的邮箱是 ruiruibupt@gmail.com","Status":3,"ImgStatus":1,"CreateTime":1489823684,"VoiceLength":0,"PlayLength":0,"FileName":"","FileSize":"","MediaId":"","Url":"","AppMsgType":0,"StatusNotifyCode":0,"StatusNotifyUserName":"","RecommendInfo":{"UserName":"","NickName":"","QQNum":0,"Province":"","City":"","Content":"","Signature":"","Alias":"","Scene":0,"VerifyFlag":0,"AttrStatus":0,"Sex":0,"Ticket":"","OpCode":0},"ForwardFlag":0,"AppInfo":{"AppID":"","Type":0},"HasProductId":0,"Ticket":"","ImgHeight":0,"ImgWidth":0,"SubMsgType":0,"NewMsgId":7410792097315404000,"OriContent":"","MMPeerUserName":"@@9cdc696e490bd76c57e7dd54792dc1408e27d65e312178b1943e88579b7939f4","MMDigest":"22acb030-ff09-11e6-8a73-cff62d9268c5:@wuli舞哩客服 我的邮箱是 ruiruibupt@gmail.com","MMIsSend":false,"MMIsChatRoom":true,"MMUnread":true,"LocalID":"7410792097315403535","ClientMsgId":"7410792097315403535","MMActualContent":"@wuli舞哩客服 我的邮箱是<a target=\'_blank\' href=\'/cgi-bin/mmwebwx-bin/webwxcheckurl?requrl=http%3A%2F%2Fruiruibupt%40gmail.com&skey=%40crypt_ee003aea_5265cdd0c2676aab3df86b0249ae90f7&deviceid=e982718209172853&pass_ticket=undefined&opcode=2&scene=1&username=@cd7d467d7464e8ff6b0acd29364654f3666df5d04551f6082bfc875f90a6afd2\'> ruiruibupt@gmail.com</a>","MMActualSender":"@4c32c97337cbb325442c304d6a44e374","MMDigestTime":"15:54","MMDisplayTime":1489823598,"MMTime":""}`)

  const rawObj32 = JSON.parse(`{"MsgId":"3807714644369652210","FromUserName":"@@9cdc696e490bd76c57e7dd54792dc1408e27d65e312178b1943e88579b7939f4","ToUserName":"@cd7d467d7464e8ff6b0acd29364654f3666df5d04551f6082bfc875f90a6afd2","MsgType":1,"Content":"@4c32c97337cbb325442c304d6a44e374:<br/>@_@ wow，@wuli舞哩客服 和@小桔同学 看起来很有默契","Status":3,"ImgStatus":1,"CreateTime":1489823764,"VoiceLength":0,"PlayLength":0,"FileName":"","FileSize":"","MediaId":"","Url":"","AppMsgType":0,"StatusNotifyCode":0,"StatusNotifyUserName":"","RecommendInfo":{"UserName":"","NickName":"","QQNum":0,"Province":"","City":"","Content":"","Signature":"","Alias":"","Scene":0,"VerifyFlag":0,"AttrStatus":0,"Sex":0,"Ticket":"","OpCode":0},"ForwardFlag":0,"AppInfo":{"AppID":"","Type":0},"HasProductId":0,"Ticket":"","ImgHeight":0,"ImgWidth":0,"SubMsgType":0,"NewMsgId":3807714644369652000,"OriContent":"","MMPeerUserName":"@@9cdc696e490bd76c57e7dd54792dc1408e27d65e312178b1943e88579b7939f4","MMDigest":"22acb030-ff09-11e6-8a73-cff62d9268c5:@_@ wow，@wuli舞哩客服 和@小桔同学 看起来很有默契","MMIsSend":false,"MMIsChatRoom":true,"MMUnread":true,"LocalID":"3807714644369652210","ClientMsgId":"3807714644369652210","MMActualContent":"@_@ wow，@wuli舞哩客服 和@小桔同学 看起来很有默契","MMActualSender":"@4c32c97337cbb325442c304d6a44e374","MMDigestTime":"15:56","MMDisplayTime":1489823598,"MMTime":""}`)

  // const RAW_OBJ = JSON.parse(`{"domain":null,"_events":{},"_eventsCount":0,"id":"@@9cdc696e490bd76c57e7dd54792dc1408e27d65e312178b1943e88579b7939f4","rawObj":{"Alias":"","AppAccountFlag":0,"AttrStatus":0,"ChatRoomId":0,"City":"","ContactFlag":2,"DisplayName":"","EncryChatRoomId":"@864285b52c943fbdbfd0d8990546c404","HeadImgUrl":"/cgi-bin/mmwebwx-bin/webwxgetheadimg?seq=648035057&username=@@9cdc696e490bd76c57e7dd54792dc1408e27d65e312178b1943e88579b7939f4&skey=","HideInputBarFlag":0,"IsOwner":1,"KeyWord":"","MMFromBatchGet":true,"MMFromBatchget":true,"MMInChatroom":true,"MMOrderSymbol":"FUFEIRUQUN","MemberCount":3,"MemberList":[{"AttrStatus":2147584103,"DisplayName":"","KeyWord":"qq5","MemberStatus":0,"NickName":"22acb030-ff09-11e6-8a73-cff62d9268c5","PYInitial":"","PYQuanPin":"","RemarkPYInitial":"","RemarkPYQuanPin":"","Uin":0,"UserName":"@4c32c97337cbb325442c304d6a44e374"},{"AttrStatus":135205,"DisplayName":"","KeyWord":"","MemberStatus":0,"NickName":"小桔同学","PYInitial":"","PYQuanPin":"","RemarkPYInitial":"","RemarkPYQuanPin":"","Uin":0,"UserName":"@cd7d467d7464e8ff6b0acd29364654f3666df5d04551f6082bfc875f90a6afd2"},{"AttrStatus":233509,"DisplayName":"","KeyWord":"","MemberStatus":0,"NickName":"50fb16c0-ff09-11e6-9fe5-dda97284d25b","PYInitial":"","PYQuanPin":"","RemarkPYInitial":"","RemarkPYQuanPin":"","Uin":0,"UserName":"@36d55130f6a91bae4a2ed2cc5f19c56a9258c65ce3db9777f74f607223ef0855"}],"NickName":"付费入群","OwnerUin":0,"PYInitial":"FFRQ","PYQuanPin":"fufeiruqun","Province":"","RemarkName":"","RemarkPYInitial":"","RemarkPYQuanPin":"","Sex":0,"Signature":"","SnsFlag":0,"StarFriend":0,"Statues":1,"Uin":0,"UniFriend":0,"UserName":"@@9cdc696e490bd76c57e7dd54792dc1408e27d65e312178b1943e88579b7939f4","VerifyFlag":0,"stranger":true},"obj":{"id":"@@9cdc696e490bd76c57e7dd54792dc1408e27d65e312178b1943e88579b7939f4","encryId":"@864285b52c943fbdbfd0d8990546c404","topic":"付费入群","ownerUin":0,"memberList":[{"id":"@4c32c97337cbb325442c304d6a44e374","rawObj":{"Alias":"ruirui_0914","AppAccountFlag":0,"AttrStatus":2147584103,"ChatRoomId":0,"City":"海淀","ContactFlag":3,"DisplayName":"","EncryChatRoomId":"","HeadImgUrl":"/cgi-bin/mmwebwx-bin/webwxgeticon?seq=648035215&username=@4c32c97337cbb325442c304d6a44e374&skey=@crypt_ee003aea_5265cdd0c2676aab3df86b0249ae90f7","HideInputBarFlag":0,"IsOwner":0,"KeyWord":"qq5","MMOrderSymbol":"~","MemberCount":0,"MemberList":[],"NickName":"李佳芮","OwnerUin":0,"PYInitial":"LJR","PYQuanPin":"lijiarui","Province":"北京","RemarkName":"22acb030-ff09-11e6-8a73-cff62d9268c5","RemarkPYInitial":"22ACB030FF0911E68A73CFF62D9268C5","RemarkPYQuanPin":"22acb030ff0911e68a73cff62d9268c5","Sex":2,"Signature":"出洞计划  |  向前一步","SnsFlag":49,"StarFriend":0,"Statues":0,"Uin":0,"UniFriend":0,"UserName":"@4c32c97337cbb325442c304d6a44e374","VerifyFlag":0,"_h":50,"_index":16,"_offsetTop":696,"stranger":false},"obj":{"id":"@4c32c97337cbb325442c304d6a44e374","uin":0,"weixin":"ruirui_0914","name":"李佳芮","alias":"22acb030-ff09-11e6-8a73-cff62d9268c5","sex":2,"province":"北京","city":"海淀","signature":"出洞计划  |  向前一步","address":"ruirui_0914","star":false,"stranger":false,"avatar":"/cgi-bin/mmwebwx-bin/webwxgeticon?seq=648035215&username=@4c32c97337cbb325442c304d6a44e374&skey=@crypt_ee003aea_5265cdd0c2676aab3df86b0249ae90f7"}},{"id":"@cd7d467d7464e8ff6b0acd29364654f3666df5d04551f6082bfc875f90a6afd2","rawObj":{"AppAccountFlag":0,"ContactFlag":0,"HeadImgFlag":1,"HeadImgUrl":"/cgi-bin/mmwebwx-bin/webwxgeticon?seq=665886775&username=@cd7d467d7464e8ff6b0acd29364654f3666df5d04551f6082bfc875f90a6afd2&skey=@crypt_ee003aea_5265cdd0c2676aab3df86b0249ae90f7","HideInputBarFlag":0,"MMOrderSymbol":"~","NickName":"小桔同学","PYInitial":"","PYQuanPin":"","RemarkName":"","RemarkPYInitial":"","RemarkPYQuanPin":"","Sex":0,"Signature":"我是一个性感的机器人","SnsFlag":1,"StarFriend":0,"Uin":244009576,"UserName":"@cd7d467d7464e8ff6b0acd29364654f3666df5d04551f6082bfc875f90a6afd2","VerifyFlag":0,"WebWxPluginSwitch":0,"stranger":false},"obj":{"id":"@cd7d467d7464e8ff6b0acd29364654f3666df5d04551f6082bfc875f90a6afd2","uin":244009576,"name":"小桔同学","alias":"","sex":0,"signature":"我是一个性感的机器人","star":false,"stranger":false,"avatar":"/cgi-bin/mmwebwx-bin/webwxgeticon?seq=665886775&username=@cd7d467d7464e8ff6b0acd29364654f3666df5d04551f6082bfc875f90a6afd2&skey=@crypt_ee003aea_5265cdd0c2676aab3df86b0249ae90f7"}},{"id":"@36d55130f6a91bae4a2ed2cc5f19c56a9258c65ce3db9777f74f607223ef0855","rawObj":{"$$hashKey":"01J","Alias":"dancewuli","AppAccountFlag":0,"AttrStatus":233509,"ChatRoomId":0,"City":"","ContactFlag":3,"DisplayName":"","EncryChatRoomId":"","HeadImgUrl":"/cgi-bin/mmwebwx-bin/webwxgeticon?seq=635310858&username=@36d55130f6a91bae4a2ed2cc5f19c56a9258c65ce3db9777f74f607223ef0855&skey=@crypt_ee003aea_5265cdd0c2676aab3df86b0249ae90f7","HideInputBarFlag":0,"IsOwner":0,"KeyWord":"","MMOrderSymbol":"~","MemberCount":0,"MemberList":[],"NickName":"wuli舞哩客服","OwnerUin":0,"PYInitial":"WULIWLKF","PYQuanPin":"wuliwulikefu","Province":"","RemarkName":"50fb16c0-ff09-11e6-9fe5-dda97284d25b","RemarkPYInitial":"50FB16C0FF0911E69FE5DDA97284D25B","RemarkPYQuanPin":"50fb16c0ff0911e69fe5dda97284d25b","Sex":0,"Signature":"","SnsFlag":1,"StarFriend":0,"Statues":0,"Uin":0,"UniFriend":0,"UserName":"@36d55130f6a91bae4a2ed2cc5f19c56a9258c65ce3db9777f74f607223ef0855","VerifyFlag":0,"_h":50,"_index":10,"_offsetTop":396,"stranger":false},"obj":{"id":"@36d55130f6a91bae4a2ed2cc5f19c56a9258c65ce3db9777f74f607223ef0855","uin":0,"weixin":"dancewuli","name":"wuli舞哩客服","alias":"50fb16c0-ff09-11e6-9fe5-dda97284d25b","sex":0,"province":"","city":"","signature":"","address":"dancewuli","star":false,"stranger":false,"avatar":"/cgi-bin/mmwebwx-bin/webwxgeticon?seq=635310858&username=@36d55130f6a91bae4a2ed2cc5f19c56a9258c65ce3db9777f74f607223ef0855&skey=@crypt_ee003aea_5265cdd0c2676aab3df86b0249ae90f7"}}],"nameMap":{"@4c32c97337cbb325442c304d6a44e374":"22acb030-ff09-11e6-8a73-cff62d9268c5","@cd7d467d7464e8ff6b0acd29364654f3666df5d04551f6082bfc875f90a6afd2":"小桔同学","@36d55130f6a91bae4a2ed2cc5f19c56a9258c65ce3db9777f74f607223ef0855":"50fb16c0-ff09-11e6-9fe5-dda97284d25b"},"aliasMap":{"@4c32c97337cbb325442c304d6a44e374":"","@cd7d467d7464e8ff6b0acd29364654f3666df5d04551f6082bfc875f90a6afd2":"","@36d55130f6a91bae4a2ed2cc5f19c56a9258c65ce3db9777f74f607223ef0855":""}}}`)

  const CONTACT_LIST = JSON.parse(`{"@4c32c97337cbb325442c304d6a44e374":{"Alias":"ruirui_0914","AppAccountFlag":0,"AttrStatus":2147584103,"ChatRoomId":0,"City":"海淀","ContactFlag":3,"DisplayName":"","EncryChatRoomId":"","HeadImgUrl":"/cgi-bin/mmwebwx-bin/webwxgeticon?seq=648035215&username=@4c32c97337cbb325442c304d6a44e374&skey=@crypt_ee003aea_5265cdd0c2676aab3df86b0249ae90f7","HideInputBarFlag":0,"IsOwner":0,"KeyWord":"qq5","MMOrderSymbol":"~","MemberCount":0,"MemberList":[],"NickName":"李佳芮","OwnerUin":0,"PYInitial":"LJR","PYQuanPin":"lijiarui","Province":"北京","RemarkName":"22acb030-ff09-11e6-8a73-cff62d9268c5","RemarkPYInitial":"22ACB030FF0911E68A73CFF62D9268C5","RemarkPYQuanPin":"22acb030ff0911e68a73cff62d9268c5","Sex":2,"Signature":"出洞计划  |  向前一步","SnsFlag":49,"StarFriend":0,"Statues":0,"Uin":0,"UniFriend":0,"UserName":"@4c32c97337cbb325442c304d6a44e374","VerifyFlag":0,"_h":50,"_index":16,"_offsetTop":696,"stranger":false},"@cd7d467d7464e8ff6b0acd29364654f3666df5d04551f6082bfc875f90a6afd2":{"AppAccountFlag":0,"ContactFlag":0,"HeadImgFlag":1,"HeadImgUrl":"/cgi-bin/mmwebwx-bin/webwxgeticon?seq=665886775&username=@cd7d467d7464e8ff6b0acd29364654f3666df5d04551f6082bfc875f90a6afd2&skey=@crypt_ee003aea_5265cdd0c2676aab3df86b0249ae90f7","HideInputBarFlag":0,"MMOrderSymbol":"~","NickName":"小桔同学","PYInitial":"","PYQuanPin":"","RemarkName":"","RemarkPYInitial":"","RemarkPYQuanPin":"","Sex":0,"Signature":"我是一个性感的机器人","SnsFlag":1,"StarFriend":0,"Uin":244009576,"UserName":"@cd7d467d7464e8ff6b0acd29364654f3666df5d04551f6082bfc875f90a6afd2","VerifyFlag":0,"WebWxPluginSwitch":0,"stranger":false},"@36d55130f6a91bae4a2ed2cc5f19c56a9258c65ce3db9777f74f607223ef0855":{"$$hashKey":"01J","Alias":"dancewuli","AppAccountFlag":0,"AttrStatus":233509,"ChatRoomId":0,"City":"","ContactFlag":3,"DisplayName":"","EncryChatRoomId":"","HeadImgUrl":"/cgi-bin/mmwebwx-bin/webwxgeticon?seq=635310858&username=@36d55130f6a91bae4a2ed2cc5f19c56a9258c65ce3db9777f74f607223ef0855&skey=@crypt_ee003aea_5265cdd0c2676aab3df86b0249ae90f7","HideInputBarFlag":0,"IsOwner":0,"KeyWord":"","MMOrderSymbol":"~","MemberCount":0,"MemberList":[],"NickName":"wuli舞哩客服","OwnerUin":0,"PYInitial":"WULIWLKF","PYQuanPin":"wuliwulikefu","Province":"","RemarkName":"50fb16c0-ff09-11e6-9fe5-dda97284d25b","RemarkPYInitial":"50FB16C0FF0911E69FE5DDA97284D25B","RemarkPYQuanPin":"50fb16c0ff0911e69fe5dda97284d25b","Sex":0,"Signature":"","SnsFlag":1,"StarFriend":0,"Statues":0,"Uin":0,"UniFriend":0,"UserName":"@36d55130f6a91bae4a2ed2cc5f19c56a9258c65ce3db9777f74f607223ef0855","VerifyFlag":0,"_h":50,"_index":10,"_offsetTop":396,"stranger":false}}`)

  const ROOM_ID = '@@9cdc696e490bd76c57e7dd54792dc1408e27d65e312178b1943e88579b7939f4'

  // Mock
  async function roomMemberSearch (
    roomId: string,
    name: string,
  ): Promise<string[]> {
    return new Promise(resolve => {
      if (roomId !== ROOM_ID) {
        resolve([])
      }

      const idList = []
      for (const [id, payload] of Object.entries(CONTACT_LIST) as [string, any]) {
        const nameList = [payload.Alias, payload.NickName, payload.RemarkName]
        if (nameList.includes(name)) {
          idList.push(id)
        }
      }

      resolve(idList)
    })
  }

  const puppet = {
    roomMemberSearch,
  } as any as Puppet

  const msg11 = rawObj11.Content
  const room11 = rawObj11.FromUserName
  const mentionContactList11 = await parseMentionIdList(puppet, room11, msg11)
  t.equal(mentionContactList11.length, 0, '@_@ in message should not be treat as contact')

  const msg12 = rawObj12.Content
  const room12 = rawObj12.FromUserName
  const mentionContactList12 = await parseMentionIdList(puppet, room12, msg12)
  t.equal(mentionContactList12.length, 0, 'user@email.com in message should not be treat as contact')

  const msg13 = rawObj13.Content
  const room13 = rawObj13.FromUserName
  const mentionContactList13 = await parseMentionIdList(puppet, room13, msg13)
  t.equal(mentionContactList13.length, 0, '@_@ wow! my email is ruiruibupt@gmail.com in message should not be treat as contact')

  const msg21 = rawObj21.Content
  const room21 = rawObj21.FromUserName
  const mentionContactList21 = await parseMentionIdList(puppet, room21, msg21)
  t.equal(mentionContactList21.length, 1, '@小桔同学 is a contact')
  t.equal(mentionContactList21[0], '@cd7d467d7464e8ff6b0acd29364654f3666df5d04551f6082bfc875f90a6afd2', 'should get 小桔同学 id right')

  const msg22 = rawObj22.Content
  const room22 = rawObj22.FromUserName
  const mentionContactList22 = await parseMentionIdList(puppet, room22, msg22)
  t.equal(mentionContactList22.length, 2, '@小桔同学 and @wuli舞哩客服 is a contact')
  t.equal(mentionContactList22[1], '@cd7d467d7464e8ff6b0acd29364654f3666df5d04551f6082bfc875f90a6afd2', 'should get 小桔同学 id right')
  t.equal(mentionContactList22[0], '@36d55130f6a91bae4a2ed2cc5f19c56a9258c65ce3db9777f74f607223ef0855', 'should get wuli舞哩客服 id right')

  const msg31 = rawObj31.Content
  const room31 = rawObj31.FromUserName
  const mentionContactList31 = await parseMentionIdList(puppet, room31, msg31)
  t.equal(mentionContactList31.length, 1, '@wuli舞哩客服 is a contact')
  t.equal(mentionContactList31[0], '@36d55130f6a91bae4a2ed2cc5f19c56a9258c65ce3db9777f74f607223ef0855', 'should get wuli舞哩客服 id right')

  const msg32 = rawObj32.Content
  const room32 = rawObj32.FromUserName
  const mentionContactList32 = await parseMentionIdList(puppet, room32, msg32)
  t.equal(mentionContactList32.length, 2, '@小桔同学 and @wuli舞哩客服 is a contact')
  t.equal(mentionContactList32[0], '@36d55130f6a91bae4a2ed2cc5f19c56a9258c65ce3db9777f74f607223ef0855', 'should get wuli舞哩客服 id right')
  t.equal(mentionContactList32[1], '@cd7d467d7464e8ff6b0acd29364654f3666df5d04551f6082bfc875f90a6afd2', 'should get 小桔同学 id right')
})
