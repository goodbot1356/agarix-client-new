import Stage from '../Stage/Stage';
import TestCase from '../TestCase';
import UICommunicationService from '../communication/FrontAPI';
import Master from '../Master';
import SocketInitializer from './SocketInitializer';
import GameSettings from '../Settings/Settings';

const stage = new Stage();

export const initializeGame = async () => {
  window.Game = stage;
  window.Master = Master;

  if (window.location.hostname.includes('localhost')) {
    await stage.init();

    stage.world.view.mouse.zoomValue = 0.1;

    const testCase = new TestCase(stage);

    setTimeout(() => stage.unblurGameScene(true), 100);
  } else {
    UICommunicationService.setGameVersion();

    await Master.init();
    await stage.init();
    
    SocketInitializer
      .setStage(stage)
      .try(3)
      .start(GameSettings.all.game.token);
  }
}

window.GameAPI.init = () => initializeGame();

if (window.location.hostname.includes('localhost')) {
  initializeGame();
}

declare global {
  interface Window {
    Game: Stage,
    Master: typeof Master
  }
}