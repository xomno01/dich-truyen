
export enum AiModel {
  Flash = 'gemini-2.5-flash-preview-04-17',
  Pro = 'gemini-2.5-flash-preview-04-17', 
}

export enum ConversionLevel {
  Fast = 'fast',
  Accurate = 'accurate',
}

// Renamed from TranslationMode
export enum TranslationSourceMode {
  GenericText = 'genericText', // For general text conversion/styling
  ChineseText = 'chineseText', // For direct Chinese to Vietnamese translation
}

export enum TranslationStyle {
  GenericStyle = 'genericStyle', // Default/general conversion
  TienHiepStyle = 'tienHiepStyle',
  KiemHiepStyle = 'kiemHiepStyle',
  KinhDiStyle = 'kinhDiStyle',
  CustomStyle = 'customStyle', // User-defined style
}

export type MessageType = 'info' | 'success' | 'error';

export interface AppMessage {
  text: string;
  type: MessageType;
}
