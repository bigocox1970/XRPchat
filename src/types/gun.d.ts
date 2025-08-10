declare module 'gun' {
  interface GunInstance {
    get(key: string): GunInstance;
    put(data: any): GunInstance;
    on(callback: (data: any, key: string) => void): GunInstance;
    once(callback: (data: any, key: string) => void): GunInstance;
    off(): GunInstance;
    map(): GunInstance;
    user(): GunUserInstance;
    channel(name: string): any;
    is?: string;
    pub?: string;
  }

  interface GunUserInstance extends GunInstance {
    create(alias: string, pass: string, callback?: (ack: any) => void): GunUserInstance;
    auth(alias: string, pass: string, callback?: (ack: any) => void): GunUserInstance;
    leave(): GunUserInstance;
    is: string;
  }

  interface GunConstructor {
    (options?: any): GunInstance;
    SEA: any;
  }

  const Gun: GunConstructor;
  export = Gun;
}

declare module 'gun/sea' {}
declare module 'gun/lib/radix' {}
declare module 'gun/lib/radisk' {}
declare module 'gun/lib/store' {}