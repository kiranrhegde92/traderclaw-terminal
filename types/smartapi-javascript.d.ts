declare module 'smartapi-javascript' {
  export default class SmartAPI {
    constructor(opts: { key: string })
    setSessionExpiryHook(fn: () => void): void
    setAccessToken(token: string): void
    generateSession(clientCode: string, password: string, totp: string): Promise<any>
    getProfile(refreshToken: string): Promise<any>
    getHolding(): Promise<any>
    getPosition(): Promise<any>
    placeOrder(params: any): Promise<any>
    getCandleData(params: any): Promise<any>
  }
  export { SmartAPI }
}
