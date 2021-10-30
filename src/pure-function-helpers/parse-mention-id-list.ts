/**
 * Huan(202109): from Add mention - wechaty/wechaty#362
 *  https://github.com/wechaty/wechaty/pull/362/files
 */
import {
  log,
  Puppet,
}             from 'wechaty-puppet'

/**
 * mobile: \u2005
 * PC、mac: \u0020
 * Web: \s
 */
const AT_SEPRATOR_REGEX = /[\u2005\u0020\s]+/

/**
 *
 * Get message mentioned contactList.
 *
 * Message event table as follows
 *
 * |                                                                            | Web  |  Mac PC Client | iOS Mobile |  android Mobile |
 * | :---                                                                       | :--: |     :----:     |   :---:    |     :---:       |
 * | [You were mentioned] tip ([有人@我]的提示)                                   |  ✘   |        √       |     √      |       √         |
 * | Identify magic code (8197) by copy & paste in mobile                       |  ✘   |        √       |     √      |       ✘         |
 * | Identify magic code (8197) by programming                                  |  ✘   |        ✘       |     ✘      |       ✘         |
 * | Identify two contacts with the same roomAlias by [You were  mentioned] tip |  ✘   |        ✘       |     √      |       √         |
 *
 * @returns {Promise<Contact[]>} - Return message mentioned contactList
 *
 * @example
 * const contactList = await message.mention()
 * console.log(contactList)
 */
async function parseMentionIdList (
  puppet: Puppet,
  roomId: string,
  text: string,
): Promise<string[]> {
  log.verbose('Message', 'mention()')

  const atList = text.split(AT_SEPRATOR_REGEX)
  // console.log('atList: ', atList)
  if (atList.length === 0) return []

  // Using `filter(e => e.indexOf('@') > -1)` to filter the string without `@`
  const mentionNameList = atList
    .filter(str => str.includes('@'))
    .map(str => multipleAt(str))
    .flat()
    .filter(name => !!name)

  // convert 'hello@a@b@c' to [ 'c', 'b@c', 'a@b@c' ]
  function multipleAt (str: string) {
    str = str.replace(/^.*?@/, '@')
    let name = ''
    const nameList: string[] = []
    str.split('@')
      .filter(mentionName => !!mentionName)
      .reverse()
      .forEach(mentionName => {
        // console.log('mentionName: ', mentionName)
        name = mentionName + '@' + name
        nameList.push(name.slice(0, -1)) // get rid of the `@` at beginning
      })
    return nameList
  }

  log.silly('wechaty-puppet-wechat', 'mentionIdList(%s), mentionNameList = "%s"',
    text,
    JSON.stringify(mentionNameList),
  )

  const contactIdListNested = await Promise.all(
    mentionNameList.map(
      name => puppet.roomMemberSearch(roomId, name),
    ),
  )

  const contactIdList = contactIdListNested.flat()

  if (contactIdList.length === 0) {
    log.silly('wechaty-puppet-wechat',
      [
        'mentionIdList() contactIdList can not found member',
        'using roomMemberSearch() from mentionNameList:',
        mentionNameList.join(', '),
      ].join(''),
    )
  }
  return contactIdList
}

export { parseMentionIdList }
