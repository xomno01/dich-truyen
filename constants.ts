
import { AiModel, TranslationSourceMode, TranslationStyle } from './types';

export const AI_MODEL_OPTIONS = [
    { value: AiModel.Flash, label: 'AI Flash'},
    { value: AiModel.Pro, label: 'AI Pro (Alternate Prompting)'} // Potentially different system prompt or config
];

export const DEFAULT_AI_MODEL = AI_MODEL_OPTIONS[0].value as AiModel;

export const TRANSLATION_SOURCE_MODE_OPTIONS = [
    { value: TranslationSourceMode.GenericText, label: 'Chuyển đổi/Dịch Tổng Quát'},
    { value: TranslationSourceMode.ChineseText, label: 'Dịch Trực Tiếp Tiếng Trung'}
];
export const DEFAULT_TRANSLATION_SOURCE_MODE = TranslationSourceMode.GenericText;

export const TRANSLATION_STYLE_OPTIONS = [
    { value: TranslationStyle.GenericStyle, label: 'Mặc định/Tổng quát'},
    { value: TranslationStyle.TienHiepStyle, label: 'Phong Cách Tiên Hiệp'},
    { value: TranslationStyle.KiemHiepStyle, label: 'Phong Cách Kiếm Hiệp'},
    { value: TranslationStyle.KinhDiStyle, label: 'Phong Cách Kinh Dị'},
    { value: TranslationStyle.CustomStyle, label: 'Tùy chỉnh phong cách...'}
];
export const DEFAULT_TRANSLATION_STYLE = TranslationStyle.GenericStyle;


export const GEMINI_API_KEY_DOC_URL = "https://aistudio.google.com/apikey";

export const CHAR_LIMIT_OPTIONS = [
  { value: "1000", label: "1,000 ký tự" },
  { value: "2000", label: "2,000 ký tự" },
  { value: "5000", label: "5,000 ký tự" },
  { value: "10000", label: "10,000 ký tự" },
  { value: "custom", label: "Tùy chỉnh..." },
];
export const DEFAULT_CHAR_LIMIT_OPTION = "5000";
export const DEFAULT_CUSTOM_CHAR_LIMIT = 15000; 
export const MIN_CUSTOM_CHAR_LIMIT = 100;
export const MAX_CUSTOM_CHAR_LIMIT = 100000; 
export const AUTHOR_FACEBOOK_URL = "https://www.facebook.com/luu.van.621914";

export const CORS_PROXY_URL = "https://api.allorigins.win/get?url=";
