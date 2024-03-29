import UICommunicationService from '../../communication/FrontAPI';
import Socket from '../Socket/Socket';
import PlayerState from '../../states/PlayerState';
import Logger from '../../utils/Logger';
import Controller from '../Contollers/TabsController';
import { ChatAuthor } from '../../communication/Chat';

export default new class FacebookLogin {
  public loggedIn: boolean = false;
  public token: string = null;
  public FB_APP_ID: number = 0;

  private expirationDate: number = 0;
  private SDKLoaded: boolean = false;
  private logger: Logger;
  private initTries: number = 0;
  private MAX_INIT_TRIES: number = 5;
  private INIT_TIMEOUT: number = 4000;

  constructor() {
    this.logger = new Logger('FacebookLogin');

    setTimeout(() => this.initLoginSystem(), this.INIT_TIMEOUT);
  }

  private async initLoginSystem(): Promise<any> {
    if (this.initSDK()) {
      const response = await this.getLoginStatus();

      if (response.status === 'connected') {
        this.handleSuccessfulLogin(response.authResponse.accessToken, response.authResponse.expiresIn);
      } else {
        UICommunicationService.setFacebookLogged(false);
      }
    } else {
      if (this.initTries < this.MAX_INIT_TRIES) {
        this.initTries++;
        setTimeout(() => this.initLoginSystem(), this.INIT_TIMEOUT);
      }
    }
  }

  private initSDK(): boolean {
    if (!window.FB) {
      this.logger.error(`SDK hasn't beed loaded yet (INIT_BEFORE_LOAD_ERROR)`);
      this.SDKLoaded = false;
      return false;
    }

    window.FB.init({
      appId: this.FB_APP_ID,
      cookie: true,
      xfbml: true,
      status: true,
      version: "v3.2",
    });

    this.logger.info('SDK successfully initialized');
    this.SDKLoaded = true;

    return true;
  }

  private async getLoginStatus(): Promise<Facebook.ILoginStatusResponse> {
    return new Promise((resolve, reject) => {
      window.FB.getLoginStatus((response) => {
        resolve(response);
      });
    })
  }

  private handleSuccessfulLogin(token: string, expiresIn: number): void {
    this.token = token;
    this.loggedIn = true;
    this.expirationDate = Date.now() + (1000 * expiresIn);

    const expires = ~~((this.expirationDate - Date.now()) / 1000 / 60); 

    UICommunicationService.setFacebookLogged(true);
    UICommunicationService.sendChatGameMessage(`Logged in. Re-login required in ${expires} minutes.`, ChatAuthor.Facebook);
  }

  public prepareToken(controller: Controller): void {
    if (!this.SDKLoaded) {
      return;
    }

    window.FB.login((response: Facebook.ILoginStatusResponse) => {
      if (response.status === 'connected') {
        this.handleSuccessfulLogin(response.authResponse.accessToken, response.authResponse.expiresIn);
        this.forceSendLogin(controller);
      } else {
        UICommunicationService.sendChatGameMessage('Login error.', ChatAuthor.Facebook);
        UICommunicationService.setFacebookLogged(false);
      }
    }, {
      scope: "public_profile, email",
    });
  }

  public logOut(): void {
    this.token = null;
    this.loggedIn = false;

    window.FB.logout((response) => console.log(response));

    this.logger.info('Log out');

    UICommunicationService.setFacebookLogged(false);
  }

  public forceSendLogin(controller: Controller): void {
    controller.firstTabSocket && this.logIn(controller.firstTabSocket);
    controller.secondTabSocket && this.logIn(controller.secondTabSocket);
  }

  public logIn(socket: Socket): void {
    if (!this.loggedIn || !this.token || !socket) {
      return;
    }

    const { leftProfileLoginType, rightProfileLoginType } = (window as any).GameSettings.all.profiles;

    if (PlayerState.first.loggedIn && socket.tabType === 'FIRST_TAB') {
      return;
    }

    if (PlayerState.second.loggedIn && socket.tabType === 'SECOND_TAB') {
      return;
    }

    const shouldLogInWithFirstTab = socket.tabType === 'FIRST_TAB' && leftProfileLoginType === 'FACEBOOK';
    const shouldLogInWithSecondTab = socket.tabType === 'SECOND_TAB' && rightProfileLoginType === 'FACEBOOK';

    if (shouldLogInWithFirstTab) {
      socket.emitter.sendLogin(this.token, 2);
      PlayerState.first.loggedIn = true;
      this.logger.info('Logged in' + ' [' + socket.tabType + ']');
    } else if (shouldLogInWithSecondTab) {
      socket.emitter.sendLogin(this.token, 2);
      PlayerState.second.loggedIn = true;
      this.logger.info('Logged in' + ' [' + socket.tabType + ']');
    }
  }
}

namespace Facebook {
  export interface ILoginStatusResponse {
    status: 'connected' | 'not_authorized' | 'unknown',
    authResponse: {
      accessToken: string,
      expiresIn: number,
      signedRequest: string,
      userID: string
    }
  }

  export type TLoginParams = {
    scope: string
  }

  export interface SDK {
    init(args: Object): void,
    getLoginStatus(
      cb: (args: ILoginStatusResponse) => void
    ): void,
    login(
      cb: (args: ILoginStatusResponse) => void,
      params: TLoginParams
    ): void,
    logout(
      cb: (args: any) => void
    ): void
  }
}

declare global {
  interface Window {
    FB: Facebook.SDK,
    fbAsyncInit: (cb: () => void) => void
  }
}