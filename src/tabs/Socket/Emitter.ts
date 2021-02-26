import PlayerState from '../../states/PlayerState';
import { createView } from '../../utils/helpers';
import Writer from '../../utils/Writer';
import Captcha from '../Captcha';
import Socket from './Socket';

export default class Emitter {
  constructor(private socket: Socket) { }

  public sendSpectate(): void {
    this.sendAction(1);
  }

  public sendFreeSpectate(): void {
    this.sendAction(18);
  }

  public sendFeed(): void {
    this.sendAction(21);
  }

  public sendSplit(): void {
    this.sendAction(17);
  }

  public sendAction(action: 1 | 17 | 18 | 21): void {
    const view = createView(1);
    view.setUint8(0, action);
    this.socket.sendMessage(view);
  }

  public sendPlayerState(state: number): void {
    var view = createView(1);
    view.setUint8(0, state);
    this.socket.send(view);
  }

  public sendSpawn(nick: string, token?: string): void {
    const ue = unescape(encodeURIComponent(nick));
		const fe = ue.length;
		let size = 2 + fe;
		if (token) {
			size += 10 + token.length;
		}
		const he = new DataView(new ArrayBuffer(size));
		let offset = 0;
		he.setUint8(offset++, 0);

		for (let ke = 0; ke < fe; ke++) { he.setUint8(offset++, ue.charCodeAt(ke)); }
		he.setUint8(offset++, 0);

		if (token) {
			for (let ke = 0; ke < token.length; ke++) { he.setUint8(offset++, token.charCodeAt(ke)); }
			he.setUint8(offset++, 0);
    }
    
    this.socket.sendMessage(he);
  }

  public handleSpawnV3(nick: string): void {
    Captcha.handleV3().then((token: string) => this.sendSpawn(nick, token));
  }
  
  public sendMousePosition(dirty?: boolean, x?: number, y?: number): void { 
    const focused = (this.socket.tabType === 'FIRST_TAB' && PlayerState.first.focused) ||
                    (this.socket.tabType === 'SECOND_TAB' && PlayerState.second.focused);

    if (!dirty && !focused && this.socket.tabType !== 'SPEC_TABS') {
      return;
    } 

    let posX: number, posY: number;

    switch (this.socket.tabType) {
      case 'SPEC_TABS': 
        posX = this.socket.mapOffsets.minX + this.socket.spectateAtX;
        posY = this.socket.mapOffsets.minY + this.socket.spectateAtY;
        break;

      case 'FIRST_TAB':
        posX = x ? x : this.socket.world.view.firstTab.cursor.x;
        posY = y ? y : this.socket.world.view.firstTab.cursor.y;
        break;

      case 'SECOND_TAB':
        posX = x ? x : this.socket.world.view.secondTab.cursor.x;
        posY = y ? y : this.socket.world.view.secondTab.cursor.y;
        break;
    }
  
    
    const view = createView(13);
    view.setUint8(0, 16);
    view.setInt32(1, posX, true);
    view.setInt32(5, posY, true);
    view.setUint32(9, this.socket.protocolKey, true);

    this.socket.sendMessage(view); 
  }

  public sendLogin(token: string, type: 2 | 4): void {
    const writer = new Writer(8192);
    const { clientVersionString } = this.socket.socketData;

    writer.setToArray();
		writer.writeBytes([102, 8, 1, 18]);
		writer.writeUint32InLEB128(token.length + clientVersionString.length + 23);
		writer.writeBytes([8, 10, 82]);
		writer.writeUint32InLEB128(token.length + clientVersionString.length + 18);
    writer.writeBytes([8, type, 18, clientVersionString.length + 8, 8, 5, 18,
      clientVersionString.length, ...Buffer.from(clientVersionString),
      24, 0, 32, 0, 26]);
		writer.writeUint32InLEB128(token.length + 3);
		writer.writeBytes([10]);
		writer.writeUint32InLEB128(token.length);
    writer.writeBytes(Buffer.from(token));
    
		this.socket.sendMessage(new DataView(new Uint8Array(Buffer.from(writer.message)).buffer));
	}
}