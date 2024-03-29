import Cell from '../../objects/Cell/index';
import RemoveAnimation from '../../objects/RemoveAnimation';
import Virus from '../../objects/Virus/Virus';
import World from '../World';
import PlayerState from '../../states/PlayerState';
import SettingsState from '../../states/SettingsState';
import SpawnAnimation from '../../objects/SpawnAnimation';
import Ejected from '../../objects/Ejected';

export default class CellsRenderer {

  constructor(private world: World) { }

  private checkCellRender(cell: Cell | Virus, visible: boolean): Array<boolean> {
    const { firstTab, secondTab } = this.world.view;
    const { type, x, y } = cell;
    let isPlayerCell = false;

    if (PlayerState.first.playing && firstTab.hasInViewBounds(x, y)) {
      visible = false;
    } 
    
    if (PlayerState.second.playing && secondTab.hasInViewBounds(x, y)) {
      visible = false;
    }

    if (PlayerState.first.playing && type === 'CELL' && this.world.playerCells.isFirstTab(cell as Cell)) {
      visible = false;
      isPlayerCell = true;
    }
    
    if (PlayerState.second.playing && type === 'CELL' && this.world.playerCells.isSecondTab(cell as Cell)) {
      visible = false;
      isPlayerCell = true;
    }

    return [visible, isPlayerCell];
  }

  public render(cell: Cell | Virus | RemoveAnimation | Ejected): void {
    if (this.world.view.shouldObjectBeCulled(cell.x, cell.y, cell.width / 2)) {
      cell.renderable = cell.visible = false;
      cell.culled = true;
      
      return;
    } else {
      cell.renderable = cell.visible = true;
      cell.culled = false;
    }

    // if cell subtype is TOP_ONE_TAB or SPEC_TABS and it is a player cell
    // its visibility should be immediately set to false 
    // (we dont have to wait until its opacity slowly goes down - it will make it look ugly)

    const isPrivateServer = this.world.master.gameMode.get() === ':private';
    const fullMapViewEnabled = this.world.settings.all.settings.game.gameplay.spectatorMode === 'Full map';
    const topOneViewEnabled = this.world.settings.all.settings.game.gameplay.spectatorMode === 'Top one';

    const { subtype, type, x, y } = cell;
    const { firstTab, secondTab, topOneTab } = this.world.view;

    // only triggers if top one view is enabled or full map view is enabled
    if (subtype === 'TOP_ONE_TAB') {
      if (type === 'VIRUS' || type === 'REMOVE_ANIMATION') {
        cell.setIsVisible(!fullMapViewEnabled);
        cell.visible = !fullMapViewEnabled;
      } else {
        const [visible, isPlayerCell] = this.checkCellRender(cell as Cell | Virus, true);
        cell.visible = isPlayerCell ? false : true;
        cell.setIsVisible(visible);
      }
    }

    // only triggers if full map view is enabled
    if (subtype === 'SPEC_TABS') {
      if (type === 'CELL') {
        const [visible, isPlayerCell] = this.checkCellRender(cell as Cell | Virus, true);
        cell.visible = isPlayerCell ? false : true;  
        cell.setIsVisible(visible);

        if (visible) {
          if (topOneTab.hasInViewBounds(x, y)) {
            cell.setIsVisible(false);
          } else {
            cell.setIsVisible(true);
          }
        }
      }
    }

    // only triggers if first tab or second tab is connected
    if (subtype === 'FIRST_TAB' || subtype === 'SECOND_TAB') {
      let visible = true;

      // first tab
      if (subtype === 'FIRST_TAB' && type === 'CELL') {
        if (this.world.playerCells.isSecondTab(cell as Cell)) {
          visible = false;
        }/*  else if (!PlayerState.first.playing) {
          visible = false;
        } */
      }

      // second tab
      if (subtype === 'SECOND_TAB' && type === 'CELL') {
        if (this.world.playerCells.isFirstTab(cell as Cell)) {
          visible = false;
        } /* else if (!PlayerState.second.playing) {
          visible = false;
        } */
      }

      if (type === 'VIRUS') {
        if (fullMapViewEnabled && !isPrivateServer) {
          visible = false;
        } else if (this.world.settings.all.settings.game.multibox.enabled) {
          if (PlayerState.first.playing && PlayerState.second.playing) {
            if (subtype === 'SECOND_TAB') {
              visible = !firstTab.hasInViewBounds(x, y);
            }

            if (topOneViewEnabled && visible) {
              visible = !topOneTab.hasInViewBounds(x, y);
            }
          } else {
            if (subtype === 'FIRST_TAB') {
              visible = PlayerState.first.playing;
            }
  
            if (subtype === 'SECOND_TAB') {
              visible = PlayerState.second.playing;
            }
          }
        } else if (topOneViewEnabled && !isPrivateServer) {
          visible = !topOneTab.hasInViewBounds(x, y);
        } else {
          visible = true;
        }
      }

      if (type === 'REMOVE_ANIMATION' && fullMapViewEnabled) {
        visible = false;
      }

      cell.visible = visible; 
      cell.setIsVisible(visible);
    }

    if (fullMapViewEnabled && !SettingsState.fullMapViewRender) {
      if (isPrivateServer) {
        return;
      }
      
      let visible = cell.isVisible;

      if (type === 'VIRUS' && subtype === 'SPEC_TABS') {
        visible = true;
      } else if (type === 'REMOVE_ANIMATION' && subtype === 'SPEC_TABS') {
        visible = this.world.settings.all.settings.game.effects.cellRemoveAnimationForHiddenSpectator;
      } else if (subtype === 'TOP_ONE_TAB' || subtype === 'SPEC_TABS') {
        if (type === 'CELL') {
          visible = false;
        }
      } else if (type === 'SPAWN_ANIMATION') {
        visible = true;
      }

      if (!this.world.settings.all.settings.game.multibox.enabled) {
        if (subtype === 'FIRST_TAB') {
          visible = true;
        }
      } 

      if (subtype === 'FIRST_TAB' && type === 'VIRUS') {
        visible = false;
        cell.visible = false;
      }

      if (type === 'VIRUS' || type === 'CELL') {
        cell.setIsVisible(visible);
      } else {
        cell.visible = visible;
      }
    }
  }
}