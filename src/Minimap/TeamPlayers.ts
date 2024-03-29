import { Container, utils } from "pixi.js";
import Cell from '../objects/Cell/index';
import World from "../render/World";
import PlayerState from "../states/PlayerState";
import { transformMinimapLocation } from "../utils/helpers";

export default class TeamPlayers extends Container {
  private buffer: Map<number, Cell>;

  constructor(private world: World) {
    super();

    this.zIndex = 0;

    this.buffer = new Map();
  }

  public changeCellShadowTexture(): void {
    this.buffer.forEach((cell) => (cell as Cell).changeShadowTexture())
  }

  public reset(): void {
    this.buffer.clear();

    while (this.children.length > 0) {
      this.removeChildAt(0);
    }
  }

  public renderTick(): void {
    const { playerSize } = this.world.settings.all.settings.theming.minimap;

    const animationSpeed = this.world.animationSettingsProvider.getAnimationSpeed();
    const fadeSpeed = this.world.animationSettingsProvider.getFadeSpeed();
    const soakSpeed = this.world.animationSettingsProvider.getSoakSpeed();

    this.world.ogar.firstTab.team.forEach((player) => {
      if (this.buffer.has(player.id)) {

        const cell = this.buffer.get(player.id);

        const location = transformMinimapLocation({ 
            x: player.position.x, 
            y: player.position.y, 
            r: 0 
          }, 
          this.world.view.firstTab.getShiftedMapOffsets(),
          this.world.settings,
          true
        );

        cell.update({ x: location.x, y: location.y, r: playerSize / 2 });

        if (!player.alive) {
          this.removeChild(cell);
          this.buffer.delete(player.id);
        } else {
          cell.animate(animationSpeed, fadeSpeed, soakSpeed);
        }

      } else {

        if (!player.alive) {
          return;
        }

        if (player.nick === this.world.settings.all.profiles.rightProfileNick && PlayerState.second.playing) {
          return;
        }

         const location = transformMinimapLocation({ 
            x: player.position.x, 
            y: player.position.y, 
            r: 0 
          }, 
          this.world.view.firstTab.getShiftedMapOffsets(),
          this.world.settings,
          true
        );

        const cell = new Cell('FIRST_TAB', location, { red: 0, green: 0, blue: 0 }, player.nick, '', this.world)
        cell.setIsMinimapCell(playerSize / 4);
        cell.isTeam = true;
        cell.update({ x: location.x, y: location.y, r: playerSize / 2 });
        cell.cell.tint = utils.string2hex(player.color.cell);

        this.buffer.set(player.id, cell);
        this.addChild(cell);

      }
    });

    this.buffer.forEach((cell, key) => {
      if (!this.world.ogar.firstTab.team.has(key)) {
        this.removeChild(cell);
        this.buffer.delete(key);
      }
    });
  }
}