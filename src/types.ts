export type Json = any;

export interface Action {
  Index?: number;
  Type: string;
  Value: Json;
}

export interface FontConfig {
  Family: string;
  Size: number;
  FontStyle: string;
}

export interface TextConfig {
  Text: string;
  Color: string;
  BackColor: string;
  TextAlign: string;
  Font: FontConfig;
  X: number;
  Y: number;
  Width: number;
  Height: number;
}

export interface IconConfig {
  Imagen: string;
  SizeMode: string;
  X: number;
  Y: number;
  Width: number;
  Height: number;
}

export interface PdtdButton {
  Text: TextConfig;
  Icon: IconConfig;
  Actions: Action[];
  X: number;
  Y: number;
  Width: number;
  Height: number;
  [key: string]: Json;
}

export interface Zone {
  BackColor: string;
  Buttons: PdtdButton[];
  Texts: Json[];
  Images: Json[];
  Width: number;
  Height: number;
  Panels: Json[];
  [key: string]: Json;
}

export interface PdtdScreen {
  Index: number;
  ScreenId: number;
  Id: string;
  Header: Zone;
  Body: Zone;
  Footer: Zone;
  HeaderOriginal?: Json;
  BodyOriginal?: Json;
  FooterOriginal?: Json;
  [key: string]: Json;
}

export interface WebDesign {
  PkDiseño?: number;
  Name: string;
  ScreenSize: string;
  OriginalScreenSize: string;
  navigationTypeId: string;
  Screens: PdtdScreen[];
  [key: string]: Json;
}

export interface Product {
  id: number;
  name: string;
  code: string;
  price: number;
  family: string;
  abbreviation?: string;
}

export interface ProjectScreen {
  uid: string;
  compact: PdtdScreen;
  webRaw?: PdtdScreen;
}

export type ProfileId = '1280' | '1080';

export interface DesignProfile {
  id: ProfileId;
  label: string;
  short: string;
  defaultName: string;
  visibleWidth: number;
  visibleHeight: number;
  bodyWidth: number;
  bodyHeight: number;
  portalWidth: number;
  portalHeight: number;
  screenSize: string;
  originalScreenSize: string;
}

export interface Project {
  name: string;
  profileId?: ProfileId;
  source: 'web' | 'caja' | 'new';
  webBase?: WebDesign | null;
  screens: ProjectScreen[];
  products: Product[];
  selectedScreenUid: string | null;
  selectedButtonIndex: number | null;
}

export type ViewMode = 'editor' | 'caja' | 'portal' | 'validate';

export interface ValidationIssue {
  screenUid: string;
  screenIndex: number;
  screenName: string;
  buttonUid?: string;
  level: 'error' | 'warning';
  message: string;
}
