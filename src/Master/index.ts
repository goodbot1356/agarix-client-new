import { ISocketData } from "../tabs/Socket/Socket";
import Regions, { PrivateGameServersTypes } from './Regions';
import EnvConfig from './EnvConfig';
import GameMode from './GameMode';
import AgarSkinsList from "./Skins";

import FacebookLogin from "../tabs/Login/FacebookLogin";
import GoogleLogin from "../tabs/Login/GoogleLogin";
import UICommunicationService from '../communication/FrontAPI';
import MasterCache from "./MasterCache";
import Settings from "../Settings/Settings";

export default class Master {
  private readonly AGAR_CORE: string = "https://agar.io/agario.core.js";
  private readonly MC_CORE: string = "https://agar.io/mc/agario.js";
  private readonly cache: MasterCache;

  private clientVersionInt: number = -1;
  private clientVersionString: string = '';
  private supportProtocolVersion: string = '';
  private protocolVersion: number = -1;

  public envConfig: EnvConfig;
  public regions: Regions;
  public gameMode: GameMode;
  public isPrivate: boolean;
  public skins: AgarSkinsList;
  public latestId: number = 0;

  constructor(public settings: Settings) {
    this.envConfig = new EnvConfig();
    this.gameMode = new GameMode();
    this.regions = new Regions(this.gameMode);
    this.skins = new AgarSkinsList();
    this.cache = new MasterCache()

    this.gameMode.set(settings.all.game.mode);
    this.regions.setCurrent(settings.all.game.currentServerIndex);
  }

  private async send(url: string, payload: Uint8Array): Promise<any> {
    return await fetch(url, {
      method: "POST",
      headers: {
				"Accept": "text/plain, */*, q=0.01",
				"Content-Type": `application/octet-stream`,
				"x-support-proto-version": String(this.supportProtocolVersion),
				"x-client-version": String(this.clientVersionInt),
      },
      body: payload
    }).then((res: any) => res.json());
  }

  private async fetch(url: string): Promise<any> {
    return fetch(url, {
      method: "GET",
      headers: {
        'Cache-Control': 'no-cache',
      }
    })
  }

  private async xhr(url: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
    
      xhr.open("GET", url, true);

      xhr.onreadystatechange = ()  => {
        if (xhr.readyState == XMLHttpRequest.DONE && xhr.status == 200) {
          resolve(xhr.responseText);   
        }
      }

      xhr.send();
    });
  }

  private async getTokenIp(token: string): Promise<any> {
    const { GET_TOKEN_URL } = this.envConfig;
    const region = this.regions.getCurrent();
    const arr = new Array(10, 4 + region.length, 10, region.length);

		arr[4 + region.length] = 18;
		arr[5 + region.length] = 0;
		arr[6 + region.length] = 26;
		arr[7 + region.length] = 8;
		arr[8 + region.length] = 10;
    arr[9 + region.length] = token.length;
    
		for (let i = 0; i < region.length; i++) { 
      arr[4 + i] = region.charCodeAt(i); 
    }

		for (let i = 0; i < token.length; i++) { 
      arr[10 + region.length + i] = token.charCodeAt(i); 
    }

		return this.send(GET_TOKEN_URL, new Uint8Array(arr));
  }

  private async getRegionsInfo(): Promise<any> {
    const { regions } = await this.send(this.envConfig.REGIONS_INFO_URL, null);

    this.regions.setFetched(regions);
    this.regions.setUpdatingInterval(() => this.getRegionsInfo(), 2.5 * 60000);
  }

  private async getSkins(): Promise<any> {
    const data = await this.xhr(`${this.envConfig.CFG_URL}/${this.latestId}/GameConfiguration.json`);
    this.skins.parse(data, this.envConfig.CFG_URL, this.latestId);
  }

  public changeRegion(index: number): void {
    this.regions.setCurrent(index);
  }

  public async init(): Promise<boolean> {
    return new Promise(async (resolve: any) => {
      await this.envConfig.init();

      FacebookLogin.FB_APP_ID = this.envConfig.FB_APP_ID;
      GoogleLogin.GOOGLE_CLIENT_ID = this.envConfig.GOOGLE_CLIENT_ID;

      const cache = this.cache.get();

      if (cache === null) {
        await this.setClientAndsupportProtocolVersion();
        await this.setProtocolVersion();
        await this.setLatestId();

        this.cache.set({
          clientVersionInt: this.clientVersionInt,
          clientVersionString: this.clientVersionString,
          supportProtocolVersion: this.supportProtocolVersion,
          protocolVersion: this.protocolVersion,
          latestId: this.latestId
        });
      } else {
        this.clientVersionInt = cache.clientVersionInt;
        this.clientVersionString = cache.clientVersionString;
        this.supportProtocolVersion = cache.supportProtocolVersion;
        this.protocolVersion = cache.protocolVersion;
        this.latestId = cache.latestId;
      }

      await this.getRegionsInfo();
      await this.getSkins();

      resolve();
    });
  }

  private connectByServerToken(token: string): ISocketData {
    return {
      address: `wss://live-arena-${token}.agar.io:443`,
      https: `wss://live-arena-${token}.agar.io:443`,
      protocolVersion: this.protocolVersion,
      clientVersionInt: this.clientVersionInt,
      clientVersionString: this.clientVersionString,
      serverToken: token
    }
  }

  public async connect(token?: string, serverToken?: boolean): Promise<ISocketData> {
    this.isPrivate = false;

    if (serverToken) {
      return Promise.resolve(this.connectByServerToken(token));
    }

    if (this.gameMode.get() === ':party') {
      return this.joinParty(token);
    } else {
      return this.getServer();
    }
  }

  private getPrivateServerWs(): string {
    const wsList: { [key in PrivateGameServersTypes]: string } = {
      'Arctida': 'wss://imsolo.pro:2109/',
      'Dagestan': 'wss://imsolo.pro:2108/',
      'Delta FFA': 'wss://delta-ffa.glitch.me',
      'FeelForeverAlone': 'wss://imsolo.pro:2102',
      'N.A. FFA': 'wss://delta-ffa-production.up.railway.app',
      'N.A. Party': 'wss://delta-server-production.up.railway.app',
      'Private Party': 'wss://tragedy-party.glitch.me',
      'Rookery': 'wss://imsolo.pro:2104/',
      'Zimbabwe': 'wss://delta-selffeed.glitch.me',
    }

    return wsList[this.regions.getCurrent()];
  }

  public async connectPrivate(serverToken?: string): Promise<ISocketData> {
    this.isPrivate = true;
    
    let ws = this.getPrivateServerWs();

    if (serverToken) {
      ws = serverToken;
    }

    return Promise.resolve({ 
      address: ws,
      https: ws,
      protocolVersion: 22,
      clientVersionInt: 31100
    });
  }

  public async findServer(): Promise<any> {
    return this.send(this.envConfig.FIND_SERVER_URL, this.setRequestMsg());
  }

  public async getServer(): Promise<ISocketData> {
    const realm = this.regions.getCurrent() + this.gameMode.get();
    const arr = new Array(10, 4 + realm.length, 10, realm.length);

    arr[4 + realm.length] = 18;
    arr[5 + realm.length] = 0;

    for (let i = 0; i < realm.length; i++) {
      arr[4 + i] = realm.charCodeAt(i); 
    }

    const { FIND_SERVER_URL } = this.envConfig;
    const message = this.setRequestMsg();

    return this.send(FIND_SERVER_URL, message).then((data: any) => this.assembleSocketData(data));
  }

  private async joinParty(token?: string): Promise<ISocketData> {
    let data: any;

    if (!token) {
      data = await this.findServer();
    } else {
      data = await this.getTokenIp(token);
    }

    return this.assembleSocketData({ 
      ...data, 
      token: data.token ? data.token : token 
    });
  }

  private setRequestMsg(): Uint8Array {
    const region = this.regions.getCurrent();
    const mode = this.gameMode.get();

    let output = [10, 4 + region.length + mode.length, 10];
        
    const addCharCode = function(data: string) {
      output.push(data.length);
      for (let i = 0; i < data.length; i++) {
        output.push(data.charCodeAt(i));
      }
    }

    addCharCode(region);
    output.push(18);
    addCharCode(mode);

    return new Uint8Array(output);
  }

  private async setLatestId(): Promise<number> {
    this.latestId = await this.xhr(this.envConfig.LATEST_ID_URL);
    return this.latestId;
  }

  private async setClientAndsupportProtocolVersion(): Promise<any> {
    return this.fetch(this.MC_CORE).then((data: any) => data.text()).then((data) => {
      this.clientVersionString = data.match(/versionString="(\d+\.\d+\.\d+)"/)[1]; // 3.10.9

      this.clientVersionInt = 
        10000 
        * parseInt(this.clientVersionString.split(".")[0]) 
        + 100 
        * parseInt(this.clientVersionString.split(".")[1]) 
        + parseInt(this.clientVersionString.split(".")[2]);

      this.supportProtocolVersion = data.match(/x-support-proto-version","(\d+\.\d+\.\d+)"/)[1]; // 15.0.3 
    });
  }

  public async setProtocolVersion(): Promise<any> {
    return this.fetch(this.AGAR_CORE).then((data: any) => data.text()).then((data) => {
      this.protocolVersion = Number(data.match(/\w\[\w\+\d+>>\d\]=\w;\w+\(\w,(\d+)\);/)[1]); // 22
    });
  }

  private assembleSocketData(data: IResponseSocketData): ISocketData {
    const address = data.token ? `wss://${data.endpoints.https}?party_id=${data.token}` : `wss://${data.endpoints.https}`;
    const serverToken = data.endpoints.https.split('-')[2].split('.')[0]; // 'live-arena-1jkvvq9.agar.io:443' -> 1jkvvq9
  
    return {
      address,
      token: data.token,
      serverToken: serverToken, 
      https: data.endpoints.https,
      protocolVersion: this.protocolVersion,
      clientVersionInt: this.clientVersionInt,
      clientVersionString: this.clientVersionString,
    }
  }
}

interface IResponseSocketData {
  token?: string,
  status: string,
  endpoints: {
    https: string,
    http: string
  },
}