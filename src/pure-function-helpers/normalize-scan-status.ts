import { ScanStatus } from 'wechaty-puppet'

export function normalizeScanStatus (
  status: number,
): ScanStatus {
  switch (status) {
    case 0:
      return ScanStatus.Waiting

    case 200:
      return ScanStatus.Confirmed

    case 201:
      return ScanStatus.Scanned

    case 408:
      // No scan after 2 minute ...
      return ScanStatus.Timeout

    default:
      throw new Error('unsupported scan status: ' + status)
  }
}
