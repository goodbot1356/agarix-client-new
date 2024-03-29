import UICommunicationService from "../../communication/FrontAPI";
import Controller from "../Contollers/TabsController";
import Emitter from "../Socket/Emitter";
import PlayerState from "../../states/PlayerState";
import SettingsState from "../../states/SettingsState";
import { ChatAuthor } from "../../communication/Chat";
import QuickRespawn from "./QuickRespawn";

class Hotkeys implements IGameAPIHotkeys {
  private macroFeedInterval: any;
  private controller: Controller;
  private quickRespawnHandler: QuickRespawn;
  
  constructor(controller: Controller) {
    this.controller = controller;
    this.quickRespawnHandler = new QuickRespawn(controller);
    (window as any).GameAPI.hotkeys = this;
  }

  private splitTimes(times: number, emitter: Emitter) {
    for (let i = 0; i < times; i++) {
      setTimeout(() => {
        emitter.sendMousePosition(true);
        emitter.sendSplit();
      }, i * 41);
    }
  }

  public feed(): void {
    const { firstTabSocket, secondTabSocket, currentFocusedTab } = this.controller;

    if (currentFocusedTab === 'FIRST_TAB') {
      firstTabSocket.emitter.sendFeed();
    } else {
      secondTabSocket.emitter.sendFeed();
    }
  }

  public macroFeed(): void {
    const { firstTabSocket, secondTabSocket, currentFocusedTab } = this.controller;

    if (!this.macroFeedInterval) {
      if (currentFocusedTab === 'FIRST_TAB') {
        firstTabSocket.emitter.sendFeed();
      } else {
        secondTabSocket.emitter.sendFeed();
      } 

      this.macroFeedInterval = setInterval(() => {
        if (currentFocusedTab === 'FIRST_TAB') {
          firstTabSocket.emitter.sendFeed();
        } else {
          secondTabSocket.emitter.sendFeed();
        }
      }, 40);
    }
  }

  public stopFeed(): void {
    clearTimeout(this.macroFeedInterval);
    this.macroFeedInterval = null;
  }

  public split(): void {
    if (this.controller.currentFocusedTab === 'FIRST_TAB') {
      this.splitTimes(1, this.controller.firstTabSocket.emitter);
    } else {
      this.splitTimes(1, this.controller.secondTabSocket.emitter);
    }
  }

  public doubleSplit(): void {
    if (this.controller.currentFocusedTab === 'FIRST_TAB') {
      this.splitTimes(2, this.controller.firstTabSocket.emitter);
    } else {
      this.splitTimes(2, this.controller.secondTabSocket.emitter);
    }
  }

  public tripleSplit(): void {
    if (this.controller.currentFocusedTab === 'FIRST_TAB') {
      this.splitTimes(3, this.controller.firstTabSocket.emitter);
    } else {
      this.splitTimes(3, this.controller.secondTabSocket.emitter);
    }
  }

  public split16(): void {
    if (this.controller.currentFocusedTab === 'FIRST_TAB') {
      this.splitTimes(4, this.controller.firstTabSocket.emitter);
    } else {
      this.splitTimes(4, this.controller.secondTabSocket.emitter);
    }
  }

  public async quickRespawn(): Promise<any> {
    this.quickRespawnHandler.handle();
  }

  // toggle
  public pauseCell(): void {
    const { firstTabSocket, secondTabSocket, currentFocusedTab } = this.controller;

    if (PlayerState.first.playing && currentFocusedTab === 'FIRST_TAB') {
      if (firstTabSocket.isPaused()) {
        firstTabSocket.resumeCell();
      } else {
        firstTabSocket.stopCell();
      }
    }

    if (PlayerState.second.playing && currentFocusedTab === 'SECOND_TAB') {
      if (secondTabSocket.isPaused()) {
        secondTabSocket.resumeCell();
      } else {
        secondTabSocket.stopCell();
      }
    }
  }

  public toggleCellHelpers(): void {
    
  }

  public toggleCellSkins(): void {
    SettingsState.allowSkins = !SettingsState.allowSkins;
  }

  public toggleMyCellStats(): void {
    SettingsState.showMassMyCell = !SettingsState.showMassMyCell;
    SettingsState.showNickMyCell = !SettingsState.showNickMyCell;
  }

  public toggleCellRings(): void {
    SettingsState.rings = !SettingsState.rings;
  }

  public switchTabs(): void {
    if (!this.controller.world.scene.settings.all.settings.game.multibox.enabled) {
      return;
    }

    if (PlayerState.first.playing && PlayerState.second.playing) {

      if (this.controller.currentFocusedTab === 'FIRST_TAB') {
        this.controller.setSecondTabActive();
      } else {
        this.controller.setFirstTabActive();
      }

      return;
    }

    if (PlayerState.first.playing) {

      if (!PlayerState.second.spawning) {
        PlayerState.second.spawning = true;
        UICommunicationService.sendChatGameMessage('Attempting to spawn second tab.');
      
        this.controller.spawnSecondTab().then(() => {
          this.controller.setSecondTabActive();
          PlayerState.second.spawning = false;
          PlayerState.second.shouldBeReconnected = false;
        }).catch(() => {
          UICommunicationService.sendChatGameMessage('Second tab spawn failed.');
          PlayerState.second.spawning = false;
          PlayerState.second.shouldBeReconnected = false;
        });
      } else {
        if (PlayerState.second.shouldBeReconnected) {
          UICommunicationService.sendChatGameMessage('Reconnecting second tab.');
          PlayerState.second.shouldBeReconnected = false;

          this.controller.disconnectSecondTab();
          this.controller.connectSecondPlayerTab().then(() => {
            PlayerState.second.spawning = true;
            UICommunicationService.sendChatGameMessage('Attempting to spawn second tab.');

            this.controller.spawnSecondTab().then(() => {
              this.controller.setSecondTabActive();
              PlayerState.second.spawning = false;
            });
          });
        } else {
          UICommunicationService.sendChatGameMessage('Second tab is already attempting to spawn. Press again to reconnect.');
          PlayerState.second.shouldBeReconnected = true;
        }
      }

    } 

    if (PlayerState.second.playing) {

      if (!PlayerState.first.spawning) {
        PlayerState.first.spawning = true;
        UICommunicationService.sendChatGameMessage('Attempting to spawn first tab.');
      
        this.controller.spawnFirstTab().then(() => {
          this.controller.setFirstTabActive();
          PlayerState.first.spawning = false;
          PlayerState.first.shouldBeReconnected = false;
        }).catch(() => {
          UICommunicationService.sendChatGameMessage('First tab spawn failed.');
          PlayerState.first.spawning = false;
          PlayerState.first.shouldBeReconnected = false;
        });
      } else {
        if (PlayerState.first.shouldBeReconnected) {
          UICommunicationService.sendChatGameMessage('Reconnecting first tab.');
          PlayerState.first.shouldBeReconnected = false;

          this.controller.disconnectFirstTab();
          this.controller.connectFirstPlayerTab().then(() => {
            PlayerState.first.spawning = true;
            UICommunicationService.sendChatGameMessage('Attempting to spawn first tab.');

            this.controller.spawnFirstTab().then(() => {
              this.controller.setFirstTabActive();
              PlayerState.first.spawning = false;
            });
          });
        } else {
          UICommunicationService.sendChatGameMessage('First tab is already attempting to spawn. Press again to reconnect.');
          PlayerState.first.shouldBeReconnected = true;
        }
        
      }

      return;
    }
  }

  public toggleFullmapViewRender(): void {
    SettingsState.fullMapViewRender = !SettingsState.fullMapViewRender;

    const message = SettingsState.fullMapViewRender ? 'Is now shown' : 'Is now hidden';
    UICommunicationService.sendChatGameMessage(message, ChatAuthor.Spectator);
  }

  public sendCommand(text: string): void { 
    this.controller.world.ogar.firstTab.sendChatCommander(text);
  }
}

export default Hotkeys;

interface IGameAPIHotkeys {
  sendCommand(text: string): void,
  toggleFullmapViewRender(): void,
  switchTabs(): void,
  toggleCellRings(): void,
  toggleMyCellStats(): void,
  toggleCellSkins(): void,
  toggleCellHelpers(): void,
  pauseCell(): void,
  quickRespawn(): Promise<any>,
  split16(): void,
  tripleSplit(): void,
  doubleSplit(): void,
  split(): void,
  stopFeed(): void,
  macroFeed(): void,
  feed(): void,
}