
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { AiModel, ConversionLevel, TranslationSourceMode, TranslationStyle } from "../types";

let genAIInstance: GoogleGenAI | null = null;
let currentApiKey: string | null = null;

export const setGeminiApiKey = (apiKey: string): { success: boolean; message?: string } => {
  if (!apiKey || apiKey.trim() === "") {
    genAIInstance = null;
    currentApiKey = null;
    return { success: false, message: "API Key không được để trống." };
  }
  try {
    genAIInstance = new GoogleGenAI({ apiKey });
    currentApiKey = apiKey;
    console.log("Gemini API Key đã được thiết lập và client đã được khởi tạo.");
    return { success: true };
  } catch (error: any) {
    genAIInstance = null;
    currentApiKey = null;
    console.error("Lỗi khởi tạo Gemini client với API Key:", error);
    return { success: false, message: `Lỗi khởi tạo Gemini client: ${error.message}. Vui lòng kiểm tra lại API Key.` };
  }
};

export const isGeminiApiKeySet = (): boolean => {
  return !!genAIInstance && !!currentApiKey;
};

export const convertTextWithGemini = async (
  textToConvert: string,
  model: AiModel,
  sourceMode: TranslationSourceMode,
  style: TranslationStyle,
  customStyleKeywords: string | undefined,
  conversionLevel: ConversionLevel // Used only if style is GenericStyle and source is GenericText
): Promise<string> => {
  if (!isGeminiApiKeySet() || !genAIInstance) {
    throw new Error("Vui lòng nhập và lưu API Key của Gemini hợp lệ trước khi chuyển đổi.");
  }

  let systemInstructionParts: string[] = [];
  let promptForUserRole: string = textToConvert;

  // 1. Determine base task based on sourceMode
  if (sourceMode === TranslationSourceMode.ChineseText) {
    systemInstructionParts.push("Nhiệm vụ chính của bạn là dịch văn bản tiếng Trung được cung cấp sang tiếng Việt một cách chính xác và tự nhiên.");
  } else { // GenericText
    systemInstructionParts.push("Nhiệm vụ chính của bạn là xử lý và chuyển đổi văn bản được cung cấp theo các chỉ dẫn về phong cách sau đây. Nếu văn bản đầu vào không phải là tiếng Việt, hãy dịch nó sang tiếng Việt trước khi áp dụng phong cách.");
  }

  // 2. Apply style instructions
  switch (style) {
    case TranslationStyle.TienHiepStyle:
      systemInstructionParts.push(`Hãy áp dụng văn phong chuẩn tiên hiệp cho bản dịch/chuyển đổi.
      Chú ý sử dụng đúng các thuật ngữ, cách xưng hô, và văn phong đặc trưng của thể loại này.
      Ví dụ về xưng hô: 'tại hạ', 'bổn tọa', 'lão phu', 'tiểu nữ', 'chư vị đạo hữu', 'tiền bối', 'sư tôn', 'đồ nhi', 'bệ hạ', 'thái tử', 'công tử', 'thiếu gia', 'chưởng môn', 'tông chủ'.
      Ví dụ về thuật ngữ: 'Luyện Khí kỳ', 'Trúc Cơ cảnh', 'Kim Đan đại đạo', 'Nguyên Anh chân quân', 'Hóa Thần', 'phi kiếm', 'linh đan', 'thượng phẩm linh thạch', 'pháp bảo', 'tâm pháp', 'công pháp', 'động phủ', 'Yêu Thú Sơn Mạch', 'Vạn Kiếm Tông', 'Ma Viêm Cốc', 'độ kiếp', 'thiên kiếp'.
      Bản dịch/chuyển đổi phải mạch lạc, tự nhiên, giàu hình ảnh và truyền tải được không khí huyền huyễn, kỳ ảo của truyện tiên hiệp. Ưu tiên độ chính xác về mặt thuật ngữ và ngữ cảnh của thể loại.`);
      break;
    case TranslationStyle.KiemHiepStyle:
      systemInstructionParts.push(`Hãy áp dụng văn phong chuẩn kiếm hiệp cho bản dịch/chuyển đổi.
      Chú trọng vào các yếu tố võ thuật, giang hồ, ân oán, tình huynh đệ, nghĩa khí.
      Ví dụ về xưng hô: ' tại hạ', 'tiểu đệ', 'đại hiệp', 'nữ hiệp', 'bang chủ', 'minh chủ', 'chưởng môn nhân', 'sư phụ', 'đồ đệ', 'kẻ hèn này', 'các hạ'.
      Ví dụ về thuật ngữ: 'nội công tâm pháp', 'ngoại công chiêu thức', 'kinh mạch', 'điểm huyệt', 'khinh công', 'ám khí', 'võ lâm ngũ bá', 'minh giáo', 'cái bang', 'thiếu lâm tự', 'võ đang sơn', 'tuyệt thế thần binh', 'huyết hải thâm thù'.
      Văn phong cần hào sảng, mạnh mẽ, đôi khi có chút cổ trang. Truyền tải được tinh thần thượng võ và các mối quan hệ phức tạp trong võ lâm.`);
      break;
    case TranslationStyle.KinhDiStyle:
      systemInstructionParts.push(`Hãy áp dụng văn phong kinh dị, rùng rợn cho bản dịch/chuyển đổi.
      Tập trung tạo không khí u ám, căng thẳng, gây sợ hãi hoặc ám ảnh.
      Sử dụng từ ngữ gợi hình ảnh ghê rợn, âm thanh kỳ quái, cảm giác bất an.
      Ví dụ về từ ngữ: 'bóng đen ghê rợn', 'tiếng thét ai oán', 'không gian méo mó', 'cảm giác lạnh sống lưng', 'mùi tử khí nồng nặc', 'đôi mắt vô hồn', 'nụ cười quỷ dị', 'bàn tay xương xẩu'.
      Miêu tả chi tiết các yếu tố gây sợ hãi, tâm lý nhân vật trong tình huống kinh hoàng. Tạo sự hồi hộp và bất ngờ.`);
      break;
    case TranslationStyle.CustomStyle:
      if (customStyleKeywords && customStyleKeywords.trim() !== "") {
        systemInstructionParts.push(`Hãy áp dụng phong cách được mô tả bởi các từ khóa sau: "${customStyleKeywords}".
        Cố gắng truyền tải đúng tinh thần và đặc điểm của các từ khóa này vào văn bản cuối cùng.`);
      } else {
        // Fallback to GenericStyle if custom keywords are empty
        if (sourceMode === TranslationSourceMode.GenericText) {
          // This will be handled by the promptForUserRole logic below for GenericText + GenericStyle
        } else {
            systemInstructionParts.push("Dịch một cách tự nhiên và chính xác nhất có thể.");
        }
      }
      break;
    case TranslationStyle.GenericStyle:
    default:
      if (sourceMode === TranslationSourceMode.GenericText) {
        // For GenericText and GenericStyle, specific prompts are constructed for promptForUserRole
        // systemInstructionParts can remain minimal here or add a very general instruction.
        systemInstructionParts.push("Xử lý văn bản một cách tổng quát.");
      } else { // ChineseText with GenericStyle
         systemInstructionParts.push("Dịch một cách tự nhiên và chính xác nhất có thể, giữ nguyên ý nghĩa gốc.");
      }
      break;
  }

  // 3. Final instruction
  systemInstructionParts.push("Quan trọng: Chỉ trả về phần văn bản đã được xử lý theo yêu cầu. Không thêm bất kỳ lời giải thích, bình luận, tiêu đề, hay bất kỳ văn bản nào khác ngoài nội dung đã hoàn thiện.");
  
  const finalSystemInstruction = systemInstructionParts.join('\n\n');

  // Construct promptForUserRole for GenericText + GenericStyle case (using conversionLevel)
  if (sourceMode === TranslationSourceMode.GenericText && style === TranslationStyle.GenericStyle && (!customStyleKeywords || customStyleKeywords.trim() === "")) {
    if (model === AiModel.Pro) {
        promptForUserRole = `Văn bản gốc:\n\n"${textToConvert}"\n\nYêu cầu: Thực hiện chuyển đổi cực kỳ chính xác và chi tiết cho văn bản trên. Ưu tiên giữ nguyên ý nghĩa sâu sắc và văn phong gốc (nếu có). Nếu văn bản không phải tiếng Việt, hãy dịch sang tiếng Việt rồi áp dụng yêu cầu.`;
    } else if (conversionLevel === ConversionLevel.Fast) {
        promptForUserRole = `Văn bản gốc:\n\n"${textToConvert}"\n\nYêu cầu: Thực hiện chuyển đổi nhanh cho văn bản trên, ưu tiên tốc độ. Nếu văn bản không phải tiếng Việt, hãy dịch sang tiếng Việt rồi áp dụng yêu cầu.`;
    } else { // Accurate
        promptForUserRole = `Văn bản gốc:\n\n"${textToConvert}"\n\nYêu cầu: Thực hiện chuyển đổi chính xác cho văn bản trên. Đảm bảo giữ đúng ngữ pháp, bám sát nội dung gốc và hạn chế tối đa việc cắt giảm hay thay đổi ý nghĩa. Nếu văn bản không phải tiếng Việt, hãy dịch sang tiếng Việt rồi áp dụng yêu cầu.`;
    }
  }
  
  try {
    const geminiModelToUse = model as string;
    
    const requestPayload: any = {
        model: geminiModelToUse,
        contents: promptForUserRole,
    };

    if (finalSystemInstruction.trim() !== "") {
        requestPayload.config = {
            systemInstruction: finalSystemInstruction
        };
    }
    
    console.log("Final System Instruction:", finalSystemInstruction);
    console.log("Prompt for User Role:", promptForUserRole);

    const result: GenerateContentResponse = await genAIInstance.models.generateContent(requestPayload);
    const textOutput = result.text;

    if (textOutput === undefined || textOutput === null || textOutput.trim() === "") {
        const candidate = result.candidates?.[0];
        if (candidate?.finishReason && candidate.finishReason !== "STOP" && candidate.finishReason !== "FINISH_REASON_UNSPECIFIED") {
            throw new Error(`Không nhận được nội dung từ AI. Lý do: ${candidate.finishReason}. Vui lòng thử lại, điều chỉnh đầu vào, hoặc kiểm tra API key và model.`);
        } else if (result.promptFeedback?.blockReason) {
            throw new Error(`Nội dung bị chặn bởi AI. Lý do: ${result.promptFeedback.blockReason}. Vui lòng kiểm tra lại nội dung đầu vào.`);
        } else {
            throw new Error("Không nhận được nội dung hợp lệ từ AI (phản hồi trống). Có thể API Key hoặc model không hợp lệ, hoặc nội dung đầu vào không phù hợp.");
        }
    }
    return textOutput;

  } catch (error: any) {
    console.error("Lỗi API Gemini:", error);
    if (error.message) {
        if (error.message.includes("API key not valid")) {
            throw new Error("API Key của Gemini không hợp lệ. Vui lòng kiểm tra lại.");
        }
        if (error.message.includes("billing account")) {
             throw new Error("Lỗi API Gemini: Có vấn đề với tài khoản thanh toán của bạn hoặc bạn đã hết hạn mức sử dụng miễn phí. Vui lòng kiểm tra Google AI Studio.");
        }
         if (error.message.includes("User location is not supported")) {
            throw new Error("Lỗi API Gemini: Khu vực của bạn không được hỗ trợ để sử dụng API này. Vui lòng kiểm tra lại.");
        }
        throw new Error(`Lỗi từ API Gemini: ${error.message}. Hãy đảm bảo API key có quyền truy cập model ${model}.`);
    }
    throw new Error("Đã xảy ra lỗi không xác định khi giao tiếp với API Gemini.");
  }
};
