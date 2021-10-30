import {
  WebAppMsgType,
  WebMessageRawPayload,
  WebMessageType,
}                         from '../web-schemas.js'

import * as PUPPET from 'wechaty-puppet'

export function webMessageType (
  rawPayload: WebMessageRawPayload,
): PUPPET.type.Message {

  switch (rawPayload.MsgType) {
    case WebMessageType.TEXT:
      switch (rawPayload.SubMsgType) {
        case WebMessageType.LOCATION:
          return PUPPET.type.Message.Attachment

        default:
          return PUPPET.type.Message.Text
      }

    case WebMessageType.EMOTICON:
    case WebMessageType.IMAGE:
      return PUPPET.type.Message.Image

    case WebMessageType.VOICE:
      return PUPPET.type.Message.Audio

    case WebMessageType.MICROVIDEO:
    case WebMessageType.VIDEO:
      return PUPPET.type.Message.Video

    case WebMessageType.APP:
      switch (rawPayload.AppMsgType) {
        case WebAppMsgType.ATTACH:
        case WebAppMsgType.URL:
        case WebAppMsgType.READER_TYPE:
          return PUPPET.type.Message.Attachment

        default:
          return PUPPET.type.Message.Text
      }

    /**
     * Treat those Types as TEXT
     *
     * Friendship is a SYS message
     * FIXME: should we use better message type at here???
     */
    case WebMessageType.SYS:
      return PUPPET.type.Message.Text
    // add recall type
    case WebMessageType.RECALLED:
      return PUPPET.type.Message.Recalled
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
      return PUPPET.type.Message.Text
  }
}
