import type {
  MessagePayload,
  MessageType,
}                 from 'wechaty-puppet'

import type {
  WebMessageRawPayload,
}                         from '../web-schemas.js'

import {
  isRoomId,
}                 from './is-type.js'

import {
  messageFilename,
}                 from './message-filename.js'
import {
  webMessageType,
}                 from './web-message-type.js'

export function messageRawPayloadParser (
  rawPayload: WebMessageRawPayload,
): MessagePayload {
  const id                           = rawPayload.MsgId
  const fromId                       = rawPayload.MMActualSender               // MMPeerUserName
  const text: string                 = rawPayload.MMActualContent              // Content has @id prefix added by wx
  const timestamp: number            = rawPayload.MMDisplayTime                // Javascript timestamp of milliseconds
  const msgFileName: undefined | string = messageFilename(rawPayload) || undefined

  let roomId : undefined | string
  let toId   : undefined | string

  // FIXME: has there any better method to know the room ID?
  if (rawPayload.MMIsChatRoom) {
    if (isRoomId(rawPayload.FromUserName)) {
      roomId = rawPayload.FromUserName // MMPeerUserName always eq FromUserName ?
    } else if (isRoomId(rawPayload.ToUserName)) {
      roomId = rawPayload.ToUserName
    } else {
      throw new Error('parse found a room message, but neither FromUserName nor ToUserName is a room(/^@@/)')
    }

    // console.log('rawPayload.FromUserName: ', rawPayload.FromUserName)
    // console.log('rawPayload.ToUserName: ', rawPayload.ToUserName)
    // console.log('rawPayload.MMPeerUserName: ', rawPayload.MMPeerUserName)
  }

  if (rawPayload.ToUserName) {
    if (!isRoomId(rawPayload.ToUserName)) {
      // if a message in room without any specific receiver, then it will set to be `undefined`
      toId = rawPayload.ToUserName
    }
  }

  const type: MessageType = webMessageType(rawPayload)

  const payloadBase = {
    filename: msgFileName,
    fromId,
    id,
    mentionIdList: [],
    text,
    timestamp,
    type,
  }

  let payload: MessagePayload

  if (toId) {
    payload = {
      ...payloadBase,
      roomId,
      toId,
    }
  } else if (roomId) {
    payload = {
      ...payloadBase,
      roomId,
      toId,
    }
  } else {
    throw new Error('neither roomId nor toId')
  }

  return payload
}
