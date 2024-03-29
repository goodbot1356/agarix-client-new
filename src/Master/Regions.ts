import UICommunicationService from "../communication/FrontAPI";
import GameMode from "./GameMode";

export default class Regions {
  private selected: number = 0;
  private data: Array<IGameServer> = [];
  private readonly privateServersList: Array<IGameServer> = [];
  public updatingInterval: any = null;

  constructor(private gameMode: GameMode) {
    const privateServersData: Array<PrivateGameServersTypes> = [
      'Arctida', 'Dagestan', 'Delta FFA', 'FeelForeverAlone', 'N.A. FFA', 'N.A. Party', 'Private Party', 'Rookery', 'Zimbabwe'
    ];

    privateServersData.forEach((name, i) => {
      this.privateServersList[i] = {
        location: name,
        playersAmount: -1
      }
    });
  }

  private getName(region: string): GameServerLocationTypes {
    switch (region) {
      case "EU-London": return "Europe";
      case "US-Atlanta": return "North America";
      case "RU-Russia": return "Russia";
      case "BR-Brazil": return "South America";
      case "TK-Turkey": return "Turkey";
      case "JP-Tokyo": return "East Asia";
      case "CN-China": return "China";
      case "SG-Singapore": return "Oceania";
      
      default: return "Europe";
    }
  }

  private unname(name: MixedGamesServers): GameServerOriginalLocationTypes | PrivateGameServersTypes {
    switch (name) {
      case "Europe": return "EU-London";
      case "North America": return "US-Atlanta";
      case "Russia": return "RU-Russia";
      case "South America": return "BR-Brazil";
      case "Turkey": return "TK-Turkey";
      case "East Asia": return "JP-Tokyo";
      case "China": return "CN-China";
      case "Oceania": return "SG-Singapore";

      default: return name;
    }
  }

  public setFetched(regions: any): void {
    this.data.length = 0;

    for (const region in regions) {
      const displayedRegionName = this.getName(region);
      const { numPlayers } = regions[region];

      this.data.push({ 
        location: displayedRegionName,
        playersAmount: numPlayers
      });
    }

    UICommunicationService.setRegions([
      ...this.data,
      ...this.privateServersList
    ]);
  }

  public setCurrent(index: number): void {
    this.selected = index;
  }

  public getCurrent(): GameServerOriginalLocationTypes | PrivateGameServersTypes {
    if (this.gameMode.get() === ':private') {
      return this.unname(this.privateServersList[this.selected].location);
    } else {
      return this.unname(this.data[this.selected].location);
    }
  }

  public setUpdatingInterval(callback: () => void, time: number): void {
    if (this.updatingInterval) {
      return;
    }

    this.updatingInterval = setInterval(() => callback(), time);
  }

  public clearUpdatingInterval(): void {
    clearInterval(this.updatingInterval);
    this.updatingInterval = null;
  }
}

export type GameServerLocationTypes = 'South America' | 'China' | 'Europe' | 'East Asia' | 'Russia' | 'Oceania' | 'Turkey' | 'North America';
export type PrivateGameServersTypes = 'Delta FFA' | 'Private Party' | 'N.A. FFA' | 'N.A. Party' | 'FeelForeverAlone' | 'Zimbabwe' | 'Arctida' | 'Dagestan' | 'Rookery';
export type MixedGamesServers = GameServerLocationTypes | PrivateGameServersTypes;
export type GameServerOriginalLocationTypes = 'EU-London' | 'US-Atlanta' | 'RU-Russia' | 'BR-Brazil' | 'TK-Turkey' | 'JP-Tokyo' | 'CN-China' | 'SG-Singapore';

export interface IGameServer {
  location: MixedGamesServers,
  playersAmount: number,
}

