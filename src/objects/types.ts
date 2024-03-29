export type Subtype = 'FIRST_TAB' | 'SECOND_TAB' | 'TOP_ONE_TAB' | 'SPEC_TABS';
export type RemoveType = 'REMOVE_CELL_OUT_OF_VIEW' | 'REMOVE_EATEN_CELL';
export type CellType = 'FOOD' | 'VIRUS' | 'CELL' | 'SPAWN_ANIMATION' | 'REMOVE_ANIMATION' | 'EJECTED';

export interface Location {
  x: number,
  y: number,
  r: number
}

export interface Vector {
  x: number, 
  y: number
}

export interface Distance extends Vector {
  total: number
}

export interface RGB {
  red: number,
  green: number, 
  blue: number,
  alpha?: number
}

export interface IMainGameObject {
  type: CellType,
  subtype: Subtype,
  culled: boolean,
  isVisible: boolean,
  isPlayerCell: boolean,
  isDestroyed: boolean,
  update: (location: Location) => void,
  remove: (type: RemoveType) => void,
  animate: (animationSpeed: number, fadeSpeed: number, soakSpeed: number) => void,
  setIsVisible: (visible: boolean) => void,
}