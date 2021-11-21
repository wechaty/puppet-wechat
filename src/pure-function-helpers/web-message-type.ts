import {
  WebAppMsgType,
  WebMessageRawPayload,
  WebMessageType,
}                         from '../web-schemas.js'

import * as PUPPET from 'wechaty-puppet'

export function webMessageType (
  rawPayload: WebMessageRawPayload,
): PUPPET.types.Message {

  switch (rawPayload.MsgType) {
    case WebMessageType.TEXT:
      switch (rawPayload.SubMsgType) {
        case WebMessageType.LOCATION:
          return PUPPET.types.Message.Attachment

        default:
          return PUPPET.types.Message.Text
      }

    case WebMessageType.EMOTICON:
    case WebMessageType.IMAGE:
      return PUPPET.types.Message.Image

    case WebMessageType.VOICE:
      return PUPPET.types.Message.Audio

    case WebMessageType.MICROVIDEO:
    case WebMessageType.VIDEO:
      return PUPPET.types.Message.Video

    case WebMessageType.APP:
      switch (rawPayload.AppMsgType) {
        case WebAppMsgType.ATTACH:
        case WebAppMsgType.URL:
        case WebAppMsgType.READER_TYPE:
          return PUPPET.types.Message.Attachment

        default:
          return PUPPET.types.Message.Text
      }

    /**
     * Treat those Types as TEXT
     *
     * Friendship is a SYS message
     * FIXME: should we use better message type at here???
     */
    case WebMessageType.SYS:
      return PUPPET.types.Message.Text
    // add recall type
    case WebMessageType.RECALLED:
      return PUPPET.types.Message.Recalled
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
      return PUPPET.types.Message.Text
  }
}
