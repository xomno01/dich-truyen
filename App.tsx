
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AiModel, ConversionLevel, AppMessage, MessageType, TranslationSourceMode, TranslationStyle } from './types';
import { 
    DEFAULT_AI_MODEL, 
    AI_MODEL_OPTIONS, 
    GEMINI_API_KEY_DOC_URL,
    CHAR_LIMIT_OPTIONS,
    DEFAULT_CHAR_LIMIT_OPTION,
    DEFAULT_CUSTOM_CHAR_LIMIT,
    MIN_CUSTOM_CHAR_LIMIT,
    MAX_CUSTOM_CHAR_LIMIT,
    AUTHOR_FACEBOOK_URL,
    CORS_PROXY_URL,
    TRANSLATION_SOURCE_MODE_OPTIONS,
    DEFAULT_TRANSLATION_SOURCE_MODE,
    TRANSLATION_STYLE_OPTIONS,
    DEFAULT_TRANSLATION_STYLE
} from './constants';
import { convertTextWithGemini, setGeminiApiKey } from './services/geminiService';
import Spinner from './components/Spinner';
import JSZip, { JSZipObject } from 'jszip';
import * as pdfjsLib from 'pdfjs-dist';
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://esm.sh/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs';


const App: React.FC = () => {
  const [geminiApiKeyInput, setGeminiApiKeyInput] = useState<string>('');
  const [isApiKeyEffectivelySet, setIsApiKeyEffectivelySet] = useState<boolean>(false);
  const [apiKeyStatusMessage, setApiKeyStatusMessage] = useState<string>("API Key chưa được thiết lập.");

  const [storyUrlInput, setStoryUrlInput] = useState<string>('');
  const [isFetchingUrl, setIsFetchingUrl] = useState<boolean>(false);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileParsingMessage, setFileParsingMessage] = useState<string>('');
  const [isFileParsing, setIsFileParsing] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [inputText, setInputText] = useState<string>('');
  const [outputText, setOutputText] = useState<string>('');
  const [selectedAiModel, setSelectedAiModel] = useState<AiModel>(DEFAULT_AI_MODEL);
  
  const [selectedSourceMode, setSelectedSourceMode] = useState<TranslationSourceMode>(DEFAULT_TRANSLATION_SOURCE_MODE);
  const [selectedStyle, setSelectedStyle] = useState<TranslationStyle>(DEFAULT_TRANSLATION_STYLE);
  const [customStyleKeywords, setCustomStyleKeywords] = useState<string>('');
  const [conversionLevel, setConversionLevel] = useState<ConversionLevel>(ConversionLevel.Fast);
  
  const [selectedCharLimitOption, setSelectedCharLimitOption] = useState<string>(DEFAULT_CHAR_LIMIT_OPTION);
  const [customCharLimitInput, setCustomCharLimitInput] = useState<string>(DEFAULT_CUSTOM_CHAR_LIMIT.toString());

  const [isLoading, setIsLoading] = useState<boolean>(false); 
  const [message, setMessage] = useState<AppMessage | null>(null);
  const [charCount, setCharCount] = useState<number>(0);

  const effectiveMaxCharLimit = useMemo(() => {
    if (selectedCharLimitOption === "custom") {
      const customVal = parseInt(customCharLimitInput, 10);
      if (isNaN(customVal) || customVal < MIN_CUSTOM_CHAR_LIMIT) return MIN_CUSTOM_CHAR_LIMIT;
      if (customVal > MAX_CUSTOM_CHAR_LIMIT) return MAX_CUSTOM_CHAR_LIMIT;
      return customVal;
    }
    return parseInt(selectedCharLimitOption, 10) || DEFAULT_CUSTOM_CHAR_LIMIT;
  }, [selectedCharLimitOption, customCharLimitInput]);

  const showAppMessage = useCallback((text: string, type: MessageType, durationMs?: number) => {
    setMessage({ text, type });
    const duration = durationMs || (type === 'error' ? 7000 : 5000);
    const timer = setTimeout(() => {
      setMessage(null);
    }, duration);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const storedApiKey = localStorage.getItem('geminiApiKey');
    if (storedApiKey) {
      setGeminiApiKeyInput(storedApiKey);
      const result = setGeminiApiKey(storedApiKey);
      if (result.success) {
        setIsApiKeyEffectivelySet(true);
        setApiKeyStatusMessage("API Key đã được tải từ lần sử dụng trước.");
      } else {
        localStorage.removeItem('geminiApiKey');
        setApiKeyStatusMessage(result.message || "API Key đã lưu không hợp lệ.");
        showAppMessage(result.message || "API Key đã lưu không hợp lệ.", "error");
      }
    }
  }, [showAppMessage]);

  const handleApiKeySave = () => {
    if (!geminiApiKeyInput.trim()) {
      showAppMessage("Vui lòng nhập API Key của Gemini.", 'error');
      return;
    }
    setIsLoading(true); 
    setTimeout(() => {
      const result = setGeminiApiKey(geminiApiKeyInput);
      if (result.success) {
        localStorage.setItem('geminiApiKey', geminiApiKeyInput);
        setIsApiKeyEffectivelySet(true);
        setApiKeyStatusMessage("API Key đã được lưu và sử dụng.");
        showAppMessage('API Key đã được lưu thành công!', 'success');
      } else {
        localStorage.removeItem('geminiApiKey');
        setIsApiKeyEffectivelySet(false);
        setApiKeyStatusMessage(result.message || "Lưu API Key thất bại.");
        showAppMessage(result.message || 'Lưu API Key thất bại. Vui lòng kiểm tra lại.', 'error');
      }
      setIsLoading(false);
    }, 200);
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    if (text.length <= effectiveMaxCharLimit) {
      setInputText(text);
      setCharCount(text.length);
    } else {
      setInputText(text.substring(0, effectiveMaxCharLimit));
      setCharCount(effectiveMaxCharLimit);
      showAppMessage(`Văn bản không được vượt quá ${effectiveMaxCharLimit} ký tự.`, 'error', 3000);
    }
  };

  const processAndSetInputText = useCallback((text: string, sourceMessage: string) => {
    if (text.length <= effectiveMaxCharLimit) {
      setInputText(text);
      setCharCount(text.length);
    } else {
      setInputText(text.substring(0, effectiveMaxCharLimit));
      setCharCount(effectiveMaxCharLimit);
      showAppMessage(`${sourceMessage} Nội dung đã được cắt bớt để phù hợp giới hạn ${effectiveMaxCharLimit} ký tự.`, 'info', 7000);
    }
  }, [effectiveMaxCharLimit, showAppMessage]);


  const handleConvert = async (textToConvertOverride?: string) => {
    const currentText = textToConvertOverride !== undefined ? textToConvertOverride : inputText;
    if (!isApiKeyEffectivelySet) {
      showAppMessage('Vui lòng nhập và lưu API Key của Gemini trước.', 'error');
      return;
    }
    if (!currentText.trim()) {
      showAppMessage('Không có văn bản để chuyển đổi.', 'error');
      return;
    }

    setIsLoading(true);
    setOutputText('');

    try {
      const result = await convertTextWithGemini(
        currentText, 
        selectedAiModel, 
        selectedSourceMode,
        selectedStyle,
        customStyleKeywords,
        conversionLevel
      );
      setOutputText(result);
      showAppMessage('Chuyển đổi thành công!', 'success');
    } catch (error: any) {
      console.error("Lỗi khi chuyển đổi:", error);
      showAppMessage((error as Error).message || 'Đã xảy ra lỗi trong quá trình chuyển đổi.', 'error');
      setOutputText('');
       if (error.message && error.message.toLowerCase().includes("api key")) {
        setIsApiKeyEffectivelySet(false);
        setApiKeyStatusMessage("Có lỗi với API Key. Vui lòng kiểm tra và lưu lại.");
        localStorage.removeItem('geminiApiKey');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const extractTextFromHtmlString = (htmlString: string, baseUrl?: string): string => {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlString, 'text/html');
      
      doc.querySelectorAll('script, style, noscript, iframe, header, footer, nav, .nav, .menu, .sidebar, .advertisement, .ads, .comments, .comment-section, form, button, input').forEach(el => el.remove());

      const selectors = [
        '#chapter-content', '.chapter-content', '#storytext', '.entry-content', 
        '.post-content', '.article-content', 'article .content', 'article', 
        '.main-content', '#main', '.content',
        'body' 
      ];

      let mainContentElement: HTMLElement | null = null;
      for (const selector of selectors) {
        mainContentElement = doc.querySelector(selector);
        if (mainContentElement) break;
      }
      
      let extractedText = '';
      const elementToParse = mainContentElement || doc.body;

      if (elementToParse) {
        const walker = doc.createTreeWalker(elementToParse, NodeFilter.SHOW_TEXT, null);
        let node;
        while(node = walker.nextNode()) {
            const parentName = node.parentElement?.nodeName.toLowerCase();
            let text = node.textContent?.trim() || "";
            if (text) {
                if (['p', 'div', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'dd', 'dt', 'blockquote'].includes(parentName || '')) {
                    extractedText += text + "\n";
                } else {
                     extractedText += text + " ";
                }
            }
        }
        extractedText = extractedText.replace(/\s\n/g, '\n').replace(/\n\s/g, '\n');
        extractedText = extractedText.replace(/\n{3,}/g, '\n\n');
      }
      
      return extractedText.trim();
    } catch (error) {
      console.error("Lỗi khi phân tích HTML string:", error);
      return "";
    }
  };


  const handleFetchFromUrlAndConvert = async () => {
    if (!isApiKeyEffectivelySet) {
      showAppMessage('Vui lòng nhập và lưu API Key của Gemini trước.', 'error');
      return;
    }
    if (!storyUrlInput.trim()) {
      showAppMessage('Vui lòng nhập URL của truyện.', 'error');
      return;
    }

    let validUrl = storyUrlInput;
    if (!validUrl.startsWith('http://') && !validUrl.startsWith('https://')) {
        validUrl = 'https://' + validUrl;
    }
    
    try {
        new URL(validUrl);
    } catch (_) {
        showAppMessage('URL không hợp lệ. Vui lòng kiểm tra lại.', 'error');
        return;
    }

    setIsFetchingUrl(true);
    setOutputText('');
    setInputText('');
    setCharCount(0);
    setSelectedFile(null); 
    setFileParsingMessage('');
    showAppMessage('Đang tải nội dung từ URL...', 'info');

    try {
      const response = await fetch(`${CORS_PROXY_URL}${encodeURIComponent(validUrl)}`);
      if (!response.ok) {
        throw new Error(`Lỗi khi tải URL: ${response.status} ${response.statusText}. Proxy có thể không hoạt động.`);
      }
      const data = await response.json(); 
      
      if (!data.contents) {
          throw new Error('Không nhận được nội dung từ proxy. Cấu trúc phản hồi từ proxy không đúng hoặc URL không thể truy cập.');
      }

      const htmlContent = data.contents;
      const extractedText = extractTextFromHtmlString(htmlContent);

      if (!extractedText.trim()) {
        showAppMessage('Không thể trích xuất nội dung truyện từ URL này. Trang có thể có cấu trúc phức tạp hoặc được bảo vệ.', 'error', 7000);
        setInputText('');
        setCharCount(0);
        return;
      }
      
      showAppMessage('Đã tải xong nội dung từ URL. Đang chuẩn bị dịch...', 'success', 3000);
      processAndSetInputText(extractedText, 'Từ URL:');
      
      setTimeout(() => {
        handleConvert(extractedText.substring(0, effectiveMaxCharLimit));
      }, 1000);

    } catch (error: any) {
      console.error("Lỗi khi lấy nội dung từ URL:", error);
      showAppMessage(`Lỗi khi lấy nội dung từ URL: ${error.message}`, 'error');
      setInputText('');
    } finally {
      setIsFetchingUrl(false);
    }
  };

  const parseEpub = async (file: File): Promise<string> => {
    const zip = new JSZip();
    const content = await file.arrayBuffer();
    await zip.loadAsync(content);

    let allTextContent = "";
    const contentFiles: { path: string, order: number, content?: string }[] = [];
    
    const opfFileEntry = Object.values(zip.files).find((f: JSZipObject): f is JSZipObject => f.name.toLowerCase().endsWith('.opf') && !f.dir);
    
    let spineOrder: string[] = [];

    if (opfFileEntry) {
        const typedOpfFile = opfFileEntry as JSZipObject; 
        const opfContent = await typedOpfFile.async('string');
        const parser = new DOMParser();
        const opfDoc = parser.parseFromString(opfContent, 'application/xml');
        const manifestItems = new Map<string, string>(); 
        opfDoc.querySelectorAll('manifest item').forEach(item => {
            const id = item.getAttribute('id');
            const href = item.getAttribute('href');
            if (id && href) {
                const opfPathParts = typedOpfFile.name.split('/');
                opfPathParts.pop(); 
                const basePath = opfPathParts.join('/');
                manifestItems.set(id, (basePath ? basePath + '/' : '') + href);
            }
        });
        
        opfDoc.querySelectorAll('spine itemref').forEach(itemref => {
            const idref = itemref.getAttribute('idref');
            if (idref && manifestItems.has(idref)) {
                spineOrder.push(manifestItems.get(idref)!);
            }
        });
    }

    if (spineOrder.length > 0) {
        for (let i = 0; i < spineOrder.length; i++) {
            const path = spineOrder[i];
            const fileInZip = zip.file(path); 
            if (fileInZip && (path.toLowerCase().endsWith('.html') || path.toLowerCase().endsWith('.xhtml') || path.toLowerCase().endsWith('.htm'))) {
                const typedFileInZip = fileInZip as JSZipObject;
                const htmlContent = await typedFileInZip.async('string');
                contentFiles.push({ path, order: i, content: extractTextFromHtmlString(htmlContent) });
            }
        }
    } else {
        let order = 0;
        for (const path in zip.files) {
            const fileEntry = zip.files[path] as JSZipObject; 
            if (!fileEntry.dir && (path.toLowerCase().endsWith('.html') || path.toLowerCase().endsWith('.xhtml') || path.toLowerCase().endsWith('.htm'))) {
                 if (path.toLowerCase().includes('toc.xhtml')) continue; 
                 const htmlContent = await fileEntry.async('string');
                 contentFiles.push({ path, order: order++, content: extractTextFromHtmlString(htmlContent) });
            }
        }
    }
    
    contentFiles.sort((a,b) => a.order - b.order); 
    allTextContent = contentFiles.map(f => f.content).filter(Boolean).join('\n\n---\n\n'); 

    return allTextContent.trim();
};

  const parsePdf = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let allTextContent = "";

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => ('str' in item ? item.str : '')).join(' ');
      allTextContent += pageText + "\n\n"; 
    }
    return allTextContent.trim();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setSelectedFile(null);
      setFileParsingMessage('');
      return;
    }

    setSelectedFile(file);
    setIsFileParsing(true);
    setInputText(''); 
    setOutputText('');
    setStoryUrlInput(''); 
    setCharCount(0);
    setFileParsingMessage(`Đang xử lý file: ${file.name}...`);
    showAppMessage(`Đang đọc file ${file.name}...`, 'info');

    try {
      let extractedText = "";
      if (file.type === "application/epub+zip" || file.name.toLowerCase().endsWith('.epub')) {
        extractedText = await parseEpub(file);
      } else if (file.type === "application/pdf" || file.name.toLowerCase().endsWith('.pdf')) {
        extractedText = await parsePdf(file);
      } else {
        throw new Error("Định dạng file không được hỗ trợ. Vui lòng chọn file .epub hoặc .pdf.");
      }

      if (!extractedText.trim()) {
        setFileParsingMessage(`Không thể trích xuất nội dung từ file ${file.name}. File có thể trống hoặc có định dạng không đúng.`);
        showAppMessage(`Không thể trích xuất nội dung từ file ${file.name}.`, 'error');
        return;
      }
      
      setFileParsingMessage(`Đã xử lý xong: ${file.name}. Nội dung đã sẵn sàng để dịch.`);
      showAppMessage(`Đã tải xong nội dung từ file ${file.name}. Đang chuẩn bị dịch...`, 'success', 3000);
      processAndSetInputText(extractedText, `Từ file ${file.name}:`);

      setTimeout(() => {
         handleConvert(extractedText.substring(0, effectiveMaxCharLimit));
      }, 1000);

    } catch (error: any) {
      console.error("Lỗi khi xử lý file:", error);
      setFileParsingMessage(`Lỗi khi xử lý file: ${error.message}`);
      showAppMessage(`Lỗi khi xử lý file: ${error.message}`, 'error');
      setInputText('');
    } finally {
      setIsFileParsing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };


  const handleCharLimitOptionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newOption = e.target.value;
    setSelectedCharLimitOption(newOption);
    const newLimit = newOption === "custom" ? parseInt(customCharLimitInput, 10) || DEFAULT_CUSTOM_CHAR_LIMIT : parseInt(newOption, 10);
    if (inputText.length > newLimit) {
        processAndSetInputText(inputText.substring(0, newLimit), "Giới hạn thay đổi:");
    }
  };

  const handleCustomCharLimitInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    setCustomCharLimitInput(value); 
    const numericValue = parseInt(value, 10);
    if (!isNaN(numericValue) && numericValue >= MIN_CUSTOM_CHAR_LIMIT && inputText.length > numericValue) {
        processAndSetInputText(inputText.substring(0, numericValue), "Giới hạn tùy chỉnh:");
    }
  };
  
  const validateAndApplyCustomLimit = () => {
    if (selectedCharLimitOption === "custom") {
        let val = parseInt(customCharLimitInput, 10);
        if (isNaN(val) || val < MIN_CUSTOM_CHAR_LIMIT) {
            val = MIN_CUSTOM_CHAR_LIMIT;
            showAppMessage(`Giới hạn tùy chỉnh phải ít nhất ${MIN_CUSTOM_CHAR_LIMIT} ký tự. Đã đặt lại.`, "info", 3000);
        } else if (val > MAX_CUSTOM_CHAR_LIMIT) {
            val = MAX_CUSTOM_CHAR_LIMIT;
            showAppMessage(`Giới hạn tùy chỉnh không được vượt quá ${MAX_CUSTOM_CHAR_LIMIT} ký tự. Đã đặt lại.`, "info", 3000);
        }
        setCustomCharLimitInput(val.toString());
        if (inputText.length > val) {
            processAndSetInputText(inputText.substring(0, val), "Giới hạn tùy chỉnh áp dụng:");
        }
    }
  };


  const selectClasses = "w-full p-3 bg-slate-700 border border-slate-600 rounded-lg shadow-sm focus:ring-sky-500 focus:border-sky-500 text-gray-100 appearance-none bg-no-repeat bg-[center_right_0.75rem] sm:text-sm bg-[url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e\")]";
  const generalDisabled = !isApiKeyEffectivelySet || isLoading || isFetchingUrl || isFileParsing;
  const mainAreaDisabled = !isApiKeyEffectivelySet;
  const isConversionLevelDisabled = generalDisabled || !(selectedSourceMode === TranslationSourceMode.GenericText && selectedStyle === TranslationStyle.GenericStyle && !customStyleKeywords.trim());


  const inputPlaceholder = useMemo(() => {
    const styleLabel = TRANSLATION_STYLE_OPTIONS.find(o => o.value === selectedStyle)?.label.toLowerCase() || 'đã chọn';
    if (selectedSourceMode === TranslationSourceMode.ChineseText) {
        return `Nhập văn bản tiếng Trung cần dịch theo phong cách ${styleLabel}`;
    }
    return `Nội dung từ URL/File sẽ xuất hiện ở đây, hoặc dán văn bản cần chuyển đổi theo phong cách ${styleLabel}`;
  }, [selectedSourceMode, selectedStyle]);
  
  const outputPlaceholder = useMemo(() => {
    const styleLabel = TRANSLATION_STYLE_OPTIONS.find(o => o.value === selectedStyle)?.label.toLowerCase() || 'đã chọn';
    if (selectedSourceMode === TranslationSourceMode.ChineseText) {
        return `Kết quả dịch tiếng Trung sang tiếng Việt theo phong cách ${styleLabel} sẽ ở đây`;
    }
    return `Kết quả chuyển đổi theo phong cách ${styleLabel} sẽ ở đây`;
  }, [selectedSourceMode, selectedStyle]);


  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-3xl bg-slate-800 shadow-2xl rounded-xl p-6 md:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-center pb-4 border-b border-slate-700">
          <h1 className="text-2xl md:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-sky-400 to-cyan-300 mb-2 sm:mb-0 text-center sm:text-left">
            🐣🐤🐥 Dịch truyện convert by Lưu Vân 🐣🐤🐥
          </h1>
        </div>

        {message && (
          <div className={
            `p-3 rounded-md text-sm transition-all duration-300 fixed top-5 right-5 z-50 shadow-lg max-w-sm
            ${message.type === 'error' ? 'bg-red-200 text-red-800' : ''}
            ${message.type === 'success' ? 'bg-green-200 text-green-800' : ''}
            ${message.type === 'info' ? 'bg-sky-200 text-sky-800' : ''}`
          }>
            {message.text}
          </div>
        )}

        <div className="p-4 bg-slate-700/50 rounded-lg border border-slate-600 space-y-3">
            <h2 className="text-lg font-semibold text-sky-300">Cài đặt API Key Gemini</h2>
            <div>
                <label htmlFor="geminiApiKey" className="block text-sm font-medium text-gray-300 mb-1">
                    Nhập API Key của bạn:
                </label>
                <input
                    type="password"
                    id="geminiApiKey"
                    value={geminiApiKeyInput}
                    onChange={(e) => setGeminiApiKeyInput(e.target.value)}
                    className="w-full p-2 bg-slate-600 border border-slate-500 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 text-gray-100 placeholder-slate-400"
                    placeholder="Dán API Key của bạn vào đây"
                    disabled={isLoading || isFetchingUrl || isFileParsing}
                />
            </div>
            <div className="flex flex-col sm:flex-row items-center sm:space-x-3 space-y-2 sm:space-y-0">
                <button
                    onClick={handleApiKeySave}
                    disabled={isLoading || isFetchingUrl || isFileParsing || !geminiApiKeyInput.trim()}
                    className="w-full sm:w-auto px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white font-semibold rounded-lg shadow-md transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-opacity-75 disabled:opacity-50"
                >
                    {isLoading && !isFetchingUrl && !isFileParsing ? <Spinner className="h-5 w-5 mr-2 inline-block"/> : null}
                    Lưu Key
                </button>
                <a
                    href={GEMINI_API_KEY_DOC_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-sky-400 hover:text-sky-300 underline text-center sm:text-left w-full sm:w-auto"
                >
                    Làm thế nào để lấy API Key?
                </a>
            </div>
            <p className={`text-xs mt-1 ${isApiKeyEffectivelySet ? 'text-green-400' : 'text-yellow-400'}`}>
                Trạng thái: {apiKeyStatusMessage}
            </p>
        </div>
        
        <div className={`p-4 bg-slate-700/30 rounded-lg border border-slate-600/50 space-y-3 ${mainAreaDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
            <h2 className="text-lg font-semibold text-sky-300">Tải File Truyện Lên</h2>
            <div>
                <label htmlFor="fileUpload" className="block text-sm font-medium text-gray-300 mb-1">
                    Chọn file .epub hoặc .pdf:
                </label>
                <input
                    type="file"
                    id="fileUpload"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".epub,.pdf"
                    className="w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-sky-500 file:text-white hover:file:bg-sky-600 disabled:opacity-50"
                    disabled={generalDisabled}
                />
            </div>
            {selectedFile && (
                <p className="text-xs text-slate-400 mt-1">
                    File đã chọn: {selectedFile.name} ({Math.round(selectedFile.size / 1024)} KB)
                </p>
            )}
            {fileParsingMessage && (
                 <p className={`text-xs mt-1 ${isFileParsing ? 'text-yellow-400' : (fileParsingMessage.startsWith("Lỗi") ? 'text-red-400' : 'text-green-400')}`}>
                    {fileParsingMessage}
                </p>
            )}
            {isFileParsing && <Spinner className="h-5 w-5 my-2"/>}
        </div>

        <div className={`p-4 bg-slate-700/40 rounded-lg border border-slate-600/70 space-y-3 ${mainAreaDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
            <h2 className="text-lg font-semibold text-sky-300">Hoặc Dịch từ URL Web Truyện</h2>
             <div>
                <label htmlFor="storyUrlInput" className="block text-sm font-medium text-gray-300 mb-1">
                    Dán Link URL chương truyện:
                </label>
                <input
                    type="url"
                    id="storyUrlInput"
                    value={storyUrlInput}
                    onChange={(e) => setStoryUrlInput(e.target.value)}
                    className="w-full p-2 bg-slate-600 border border-slate-500 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 text-gray-100 placeholder-slate-400"
                    placeholder="https://example.com/truyen/chuong-1"
                    disabled={generalDisabled}
                />
            </div>
            <button
                onClick={handleFetchFromUrlAndConvert}
                disabled={generalDisabled || !storyUrlInput.trim()}
                className="w-full sm:w-auto px-6 py-2 bg-teal-500 hover:bg-teal-600 text-white font-semibold rounded-lg shadow-md transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-opacity-75 disabled:opacity-50 flex items-center justify-center space-x-2"
            >
                {isFetchingUrl ? <Spinner className="h-5 w-5" /> : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                )}
                <span>{isFetchingUrl ? 'Đang tải...' : 'Tải Nội Dung & Dịch Từ URL'}</span>
            </button>
             <p className="text-xs text-slate-400 mt-1">
                Lưu ý: Tính năng này thử nghiệm và có thể không hoạt động với mọi trang web.
            </p>
        </div>

        <div className={`grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-4 items-end ${mainAreaDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
          <div>
            <label htmlFor="sourceModeSelect" className="block text-sm font-medium text-sky-300 mb-1">
              Loại Hình Dịch (Nguồn)
            </label>
            <select
              id="sourceModeSelect"
              value={selectedSourceMode}
              onChange={(e) => setSelectedSourceMode(e.target.value as TranslationSourceMode)}
              className={selectClasses}
              disabled={generalDisabled}
            >
              {TRANSLATION_SOURCE_MODE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
           <div>
            <label htmlFor="styleSelect" className="block text-sm font-medium text-sky-300 mb-1">
              Phong Cách Dịch (Đầu ra)
            </label>
            <select
              id="styleSelect"
              value={selectedStyle}
              onChange={(e) => setSelectedStyle(e.target.value as TranslationStyle)}
              className={selectClasses}
              disabled={generalDisabled}
            >
              {TRANSLATION_STYLE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {selectedStyle === TranslationStyle.CustomStyle && (
            <div className="md:col-span-full">
              <label htmlFor="customStyleKeywords" className="block text-sm font-medium text-sky-300 mb-1">
                Từ khóa phong cách tùy chỉnh:
              </label>
              <input
                type="text"
                id="customStyleKeywords"
                value={customStyleKeywords}
                onChange={(e) => setCustomStyleKeywords(e.target.value)}
                className="w-full p-2 bg-slate-700 border border-slate-600 rounded-lg shadow-sm focus:ring-sky-500 focus:border-sky-500 text-gray-100 placeholder-slate-400 sm:text-sm"
                placeholder="Ví dụ: hài hước, lãng mạn, chính kịch..."
                disabled={generalDisabled}
              />
            </div>
          )}
          
          <div>
            <label htmlFor="aiModelSelect" className="block text-sm font-medium text-sky-300 mb-1">
              Mô hình AI
            </label>
            <select
              id="aiModelSelect"
              value={selectedAiModel}
              onChange={(e) => setSelectedAiModel(e.target.value as AiModel)}
              className={selectClasses}
              disabled={generalDisabled}
            >
              {AI_MODEL_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="conversionLevelSelect" className="block text-sm font-medium text-sky-300 mb-1">
              Mức độ chuyển đổi
            </label>
            <select
              id="conversionLevelSelect"
              value={conversionLevel}
              onChange={(e) => setConversionLevel(e.target.value as ConversionLevel)}
              className={selectClasses}
              disabled={isConversionLevelDisabled}
              title={isConversionLevelDisabled ? "Chỉ áp dụng khi Loại Hình là 'Tổng Quát' và Phong Cách là 'Mặc định' (không có từ khóa tùy chỉnh)." : "Chọn mức độ chuyển đổi"}
            >
              <option value={ConversionLevel.Fast}>Chuyển đổi nhanh</option>
              <option value={ConversionLevel.Accurate}>Chuyển đổi chính xác</option>
            </select>
          </div>
          <div className="md:col-span-full grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-4 items-end">
            <div>
              <label htmlFor="charLimitSelect" className="block text-sm font-medium text-sky-300 mb-1">
                Giới hạn ký tự
              </label>
              <select
                id="charLimitSelect"
                value={selectedCharLimitOption}
                onChange={handleCharLimitOptionChange}
                className={selectClasses}
                disabled={generalDisabled}
              >
                {CHAR_LIMIT_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            {selectedCharLimitOption === "custom" && (
              <div>
                  <label htmlFor="customCharLimitInput" className="block text-sm font-medium text-sky-300 mb-1">
                      Nhập giới hạn ({MIN_CUSTOM_CHAR_LIMIT} - {MAX_CUSTOM_CHAR_LIMIT}):
                  </label>
                  <input
                      type="number"
                      id="customCharLimitInput"
                      value={customCharLimitInput}
                      onChange={handleCustomCharLimitInputChange}
                      onBlur={validateAndApplyCustomLimit} 
                      className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg shadow-sm focus:ring-sky-500 focus:border-sky-500 text-gray-100 sm:text-sm"
                      placeholder={`VD: ${DEFAULT_CUSTOM_CHAR_LIMIT}`}
                      min={MIN_CUSTOM_CHAR_LIMIT}
                      max={MAX_CUSTOM_CHAR_LIMIT}
                      disabled={generalDisabled}
                  />
              </div>
            )}
          </div>
        </div>

        <div className={`space-y-6 ${mainAreaDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
            <div>
                <label htmlFor="inputText" className="block text-sm font-medium text-sky-300 mb-1">Văn bản gốc (hoặc dán/tải vào đây)</label>
                <textarea
                    id="inputText"
                    rows={10}
                    value={inputText}
                    onChange={handleInputChange}
                    className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg shadow-sm focus:ring-sky-500 focus:border-sky-500 text-gray-100 placeholder-slate-400 resize-none"
                    placeholder={inputPlaceholder}
                    disabled={generalDisabled}
                />
                <p className="text-xs text-slate-400 mt-1 text-right" id="charCount">{charCount}/{effectiveMaxCharLimit}</p>
            </div>
             <div className="flex items-center justify-center">
                <button
                    id="convertButton"
                    onClick={() => handleConvert()}
                    disabled={generalDisabled || !inputText.trim()}
                    className="w-full md:w-auto px-8 py-3 bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-600 hover:to-cyan-600 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-opacity-75 flex items-center justify-center space-x-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                    {(isLoading && !isFetchingUrl && !isFileParsing) ? <Spinner className="h-5 w-5" /> : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M8 4a1 1 0 011 1v1.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 111.414-1.414L8 6.586V5a1 1 0 011-1zm10 10a1 1 0 01-1 1h-1.586l-1.293 1.293a1 1 0 11-1.414-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 11-1.414 1.414L16 17.414V19a1 1 0 01-1 1zM2.293 9.293a1 1 0 011.414 0L7 12.586V11a1 1 0 112 0v1.586l3.293-3.293a1 1 0 111.414 1.414l-5 5a1 1 0 01-1.414 0l-5-5a1 1 0 010-1.414z"/>
                        </svg>
                    )}
                    <span>Chuyển đổi văn bản bên trên</span>
                </button>
            </div>
            <div>
                <label htmlFor="outputText" className="block text-sm font-medium text-sky-300 mb-1">Văn bản đã chuyển đổi</label>
                <textarea
                    id="outputText"
                    rows={10}
                    readOnly
                    value={outputText}
                    className="w-full p-3 bg-slate-900 border border-slate-700 rounded-lg shadow-sm text-gray-300 resize-none"
                    placeholder={outputPlaceholder}
                />
            </div>
        </div>

         <div className="text-xs text-slate-500 text-center mt-6 space-y-1">
            <p>Cung cấp bởi Lưu Vân, code và biên tập bởi AI - FREE 4 ALL</p>
            <p>
                <a 
                    href={AUTHOR_FACEBOOK_URL} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sky-400 hover:text-sky-300 underline"
                >
                    Tác giả: Lưu Vân
                </a>
            </p>
        </div>
      </div>
    </div>
  );
};

export default App;