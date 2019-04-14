import {
  WebAppMsgType,
  WebMessageRawPayload,
  WebMessageType,
}                         from '../web-schemas'

import {
  MessageType,
}                 from 'wechaty-puppet'

export function webMessageType (
  rawPayload: WebMessageRawPayload,
): MessageType {

  switch (rawPayload.MsgType) {
    case WebMessageType.TEXT:
      switch (rawPayload.SubMsgType) {
        case WebMessageType.LOCATION:
          return MessageType.Attachment

        default:
          return MessageType.Text
      }

    case WebMessageType.EMOTICON:
    case WebMessageType.IMAGE:
      return MessageType.Image

    case WebMessageType.VOICE:
      return MessageType.Audio

    case WebMessageType.MICROVIDEO:
    case WebMessageType.VIDEO:
      return MessageType.Video

    case WebMessageType.APP:
      switch (rawPayload.AppMsgType) {
        case WebAppMsgType.ATTACH:
        case WebAppMsgType.URL:
        case WebAppMsgType.READER_TYPE:
          return MessageType.Attachment

        default:
          return MessageType.Text
      }

    /**
     * Treat those Types as TEXT
     *
     * Friendship is a SYS message
     * FIXME: should we use better message type at here???
     */
    case WebMessageType.SYS:
      return MessageType.Text
    // add recall type
    case WebMessageType.RECALLED:
      return MessageType.Recalled
    // VERIFYMSG           = 37,
    // POSSIBLEFRIEND_MSG  = 40,
    // SHARECARD           = 42,
    // LOCATION            = 48,
    // VOIPMSG             = 50,
    // STATUSNOTIFY        = 51,
    // VOIPNOTIFY          = 52,
    // VOIPINVITE          = 53,
    // SYSNOTICE           = 9999,
    // RECALLED            = 10002,
    default:
      return MessageType.Text
  }
}
