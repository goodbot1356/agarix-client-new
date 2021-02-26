import { createView, shiftKey, generateClientKey } from '../../utils/helpers';
import Reader from '../../utils/Reader'
import { Location, RGB, CellType } from '../../objects/types';
import Socket, { IMapOffsets, IViewport } from './Socket';
import Logger from '../../utils/Logger';
import GameSettings from '../../Settings/Settings';
import GamePerformance from '../../GamePerformance';
import Captcha from '../Captcha';
import PlayerState from '../../states/PlayerState';

export interface ILeaderboardPlayer {
  position: number,
  nick: string,
  accountId: number,
  isMe: boolean
}

export interface IGhostCell { 
  playerX: number, 
  playerY: number, 
  totalMass: number, 
  size: number
}

export default class Receiver {
  private socket: Socket;
  private logger: Logger;
  public reader: Reader;

  constructor(socket: Socket) {
    this.socket = socket;
    this.reader = new Reader();
    this.logger = new Logger('SocketReceiver');
  }

  public handleHandshake(): void {
    switch (this.socket.tabType) {
      case 'FIRST_TAB':
        PlayerState.first.connected = true;
        break;

      case 'SECOND_TAB':
        PlayerState.second.connected = true;
        break;
    }

    this.socket.connectionOpened = true;
    this.socket.connectionOpenedTime = Date.now();

    let view = createView(5);

    view.setUint8(0, 254);
    view.setUint32(1, this.socket.socketData.protocolVersion, true);
    this.socket.send(view);

    view = createView(5);
    view.setUint8(0, 255);
    view.setUint32(1, this.socket.socketData.clientVersionInt, true);
    this.socket.send(view);
  }

  public handleViewportUpdate(): IViewport {
    const x = this.reader.getFloat32();
    const y = this.reader.getFloat32();
    const scale = this.reader.getFloat32();

    return { x, y, scale }
  }

  public shiftKey() {
    this.socket.protocolKey = shiftKey(this.socket.protocolKey);
  }

  public handleAddOwnCell() {
    if (!this.socket.playerSpawned) {
      this.socket.playerSpawned = true;
      
      if (typeof this.socket.onPlayerSpawn === 'function') {
        this.socket.onPlayerSpawn();
      }
    }

    this.socket.world.addPlayer(this.reader.getUint32(), this.socket.tabType);
  }

  public handleLeaderboardUpdate(): Array<ILeaderboardPlayer> {
    let lb: Array<ILeaderboardPlayer> = [];
    let position: number = 0;

    while (!this.reader.endOfBuffer()) {
      position++;

      const flags = this.reader.getUint8();
			let accountId: number = null;
			let nick: string = "An unnamed cell";
			let isMe: boolean = false;
      let isFriend: boolean = false;
      
      if (1 & flags) {
        position = this.reader.getUint16();
      }

      if (2 & flags) {
        const tmp = this.reader.getStringUTF8();
        
        if (tmp) {
          nick = tmp;
        }
      }

      if (4 & flags) {
        accountId = this.reader.getUint32()
      }

			if (8 & flags) {
        isMe = true;
        
        if (this.socket.tabType === 'FIRST_TAB') {
          nick = GameSettings.all.profiles.leftProfileNick;
        } else if (this.socket.tabType === 'SECOND_TAB') {
          nick = GameSettings.all.profiles.rightProfileNick;
        }
      }

      if (16 & flags) {
        isFriend = true;
      }

      lb.push({ position, nick, accountId, isMe });
    }

    return lb;
  }

  public handleGhostCells() {
    const cellLength = this.reader.getUint16();
    let ghostCells: Array<IGhostCell> = [];

    for (let length = 0; length < cellLength; length++) {
      const playerX = this.reader.getInt32();
      const playerY = this.reader.getInt32();
      const totalMass = this.reader.getUint32();
      const size = ~~Math.sqrt(100 * totalMass);

      this.reader.shiftOffset(1);

      ghostCells.push({ playerX, playerY, totalMass, size });
    } 

    return ghostCells;
  }

  public handleRecaptchaV2() {
    Captcha.handleV2(this.socket);
  }

  public handlePingUpdate() {
    const ping = this.reader.getUint16();
    const view = createView(3);

    view.setUint8(0, 227);
    view.setUint16(1, ping);

    this.socket.sendMessage(view);
  }

  public generateKeys() {
    this.socket.protocolKey = this.reader.getUint32();
    this.socket.specialKey = this.socket.protocolKey ^ this.socket.socketData.clientVersionInt;
    this.socket.clientKey = generateClientKey(this.socket.socketData.address, new Uint8Array(this.reader.view.buffer, 5));
  }

  public handleServerTime() {
    this.socket.serverTime = 1000 * this.reader.getUint32();
    this.socket.serverTimeDiff = Date.now() - this.socket.serverTime;
  }

  public handleCompressedMessage(): void {
    this.reader.decompressMessage();
    const opcode = this.reader.getUint8();

    switch (opcode) {
      case 16: 
        this.onWorldUpdate();
        break;

      case 64: 
        this.socket.setMapOffset(this.getMapOffset());
        break;

      default: this.logger.error('Unknown decompress opcode');
    }
  }

  private onWorldUpdate(): void {
    if (this.socket.tabType === 'FIRST_TAB') {
      GamePerformance.updateLoss();
    }

    const eatRecordsLen = this.reader.getUint16();
    for (let i = 0; i < eatRecordsLen; i++) {
      const eaterId = this.reader.getUint32();
      const victimId = this.reader.getUint32(); 

      this.socket.world.removeEaten(victimId);
    }

    let cellUpdate = false;
    let id: number;

    while ((id = this.reader.getUint32()) !== 0) { 
      let cellSkin: string;
      let name: string;
      let isVirus: number;
      let red: number;
      let green: number;
      let blue: number;
      let isFood: number;
      let accountId: number;

      let x = this.reader.getInt32();
      let y = this.reader.getInt32();
      let r = this.reader.getUint16();

      let cellFlags = this.reader.getUint8();
      let cellFlags2: number;

      if (cellFlags & 0x80) {
        cellFlags2 = this.reader.getUint8();
      }

      isVirus = cellFlags & 1;

      if (cellFlags & 0x02) {
        red = this.reader.getUint8();
        green = this.reader.getUint8();
        blue = this.reader.getUint8();
      }

      if (cellFlags & 0x04) {
        cellSkin = this.reader.getStringUTF8();

        if (cellSkin.includes('custom')) {
          cellSkin = cellSkin.replace('%custom', 'skin_custom');
        } else {
          cellSkin = cellSkin.replace('%', '');
        }
      }

      if (cellFlags & 0x08) {
        name = this.reader.getStringUTF8();
      }

      isFood = cellFlags2 & 1;

      if (cellFlags2 & 0x04) {
        accountId = this.reader.getUint32();
      }

      // for FIRST_TAB shifts === 0 
      // only affects SECOND_TAB || TOP_ONE_TAB || SPEC_TABS
      x += this.socket.shiftOffsets.x;
      y += this.socket.shiftOffsets.y;

      const type: CellType = isFood ? 'FOOD' : isVirus ? 'VIRUS' : 'CELL';
      const location: Location = { x, y, r };
      const color: RGB = { red, green, blue };

      if (type === 'CELL') {
        cellUpdate = true;
      }

      this.socket.world.add(id, location, color, name, type, this.socket.tabType, cellSkin);
    } 

    const removeLen = this.reader.getUint16();
    for (let i = 0; i < removeLen; i++) {
      this.socket.world.removeOutOfView(this.reader.getUint32());
    }

    if (this.socket.tabType === 'FIRST_TAB' && cellUpdate) {
      this.socket.world.view.firstTab.sortRequired = true;
    }

    if (this.socket.tabType === 'SECOND_TAB' && cellUpdate) {
      this.socket.world.view.secondTab.sortRequired = true;
    }

    if (this.socket.tabType === 'TOP_ONE_TAB' && cellUpdate) {
      this.socket.world.view.topOneTab.sortRequired = true;
    }
  }

  public getMapOffset(): IMapOffsets {
    const minX = this.reader.getFloat64();
    const minY = this.reader.getFloat64();
    const maxX = this.reader.getFloat64();
    const maxY = this.reader.getFloat64();

    return { minX, minY, maxX, maxY };
  }
}