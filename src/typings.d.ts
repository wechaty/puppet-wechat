// declare const window: any

// Extend the `Window` from Browser
interface Window {
  wechatyPuppetBridgeEmit?: Function, // from puppeteer
}

declare const WechatyBro: any

declare module 'puppeteer-extra-plugin-stealth' {
  function plugin(config?:any): any;
  export = plugin;
}

declare module 'puppeteer-extra' {
  import { Browser, LaunchOptions } from 'puppeteer'
  export function use(plugin:any): any;
  export function launch(opts?:LaunchOptions): Promise<Browser>;
}
