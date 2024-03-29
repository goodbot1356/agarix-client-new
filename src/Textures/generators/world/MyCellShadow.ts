import { GlowFilter } from "@pixi/filter-glow";
import { Sprite } from "pixi.js";
import { MIPMAP_MODES, SCALE_MODES, Texture } from "pixi.js";
import Globals from "../../../Globals";
import Settings from '../../../Settings/Settings';

const generateMyCellShadow = (settings: Settings) => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  const size = 512;
  const lineWidth = 6;
  const { myShadowDistance, myShadowStrength } = settings.all.settings.theming.cells;

  canvas.width = canvas.height = size + myShadowDistance * 2;

  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = lineWidth;
  ctx.arc(size / 2 + myShadowDistance, size / 2 + myShadowDistance, size / 2 - lineWidth, 0, Math.PI * 2);
  ctx.stroke();
  
  if (settings.all.settings.game.performance.glowFilterShaderType === 'GPU-1') {
    const sprite = new Sprite(Texture.from(canvas));
    // @ts-ignore
    sprite.filters = [new GlowFilter({
      color: 0xFFFFFF,
      distance: myShadowDistance,
      outerStrength: myShadowStrength,
      quality: 0.175
    })];

    const texture = Globals.app.renderer.generateTexture(sprite, SCALE_MODES.LINEAR, 1);
    texture.baseTexture.scaleMode = SCALE_MODES.LINEAR;
    texture.baseTexture.mipmap = MIPMAP_MODES.POW2;

    return texture;

  } else if (settings.all.settings.game.performance.glowFilterShaderType === 'Canvas') {
    ctx.shadowColor = '#FFFFFF';
    ctx.shadowBlur = myShadowDistance - lineWidth;

    for (let i = 0; i < myShadowStrength; i++) {
      ctx.stroke();
    }
  }

  let texture = Texture.from(canvas);
  texture.baseTexture.mipmap = MIPMAP_MODES.ON;
  texture.baseTexture.scaleMode = SCALE_MODES.LINEAR;

  return texture;
}

export default generateMyCellShadow;