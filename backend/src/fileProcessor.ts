import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';

export interface ProcessedFile {
  filename: string;
  chunks: string[];
  metadata: {
    fileType: string;
    originalSize: number;
    processedAt: string;
    totalChunks: number;
  };
}

/**
 * テキストを意味のある単位でチャンクに分割する
 * @param text 分割するテキスト
 * @param chunkSize 各チャンクの最大文字数
 * @param overlapSize チャンク間のオーバーラップ文字数
 * @returns 分割されたチャンクの配列
 */
export function chunkText(text: string, chunkSize: number = 1000, overlapSize: number = 100): string[] {
  const startTime = Date.now();
  console.log(`\n📝 チャンク処理開始: ${text.length}文字`);

  if (!text || text.trim().length === 0) {
    console.log('❌ 空のテキスト');
    return [];
  }

  // 段落で分割（空行で区切られた部分）
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  console.log(`📊 段落数: ${paragraphs.length}`);
  
  const chunks: string[] = [];
  let currentChunk = '';
  let totalTokens = 0;

  for (const paragraph of paragraphs) {
    const trimmedParagraph = paragraph.trim();
    
    // 現在のチャンクに段落を追加しても制限を超えない場合
    if ((currentChunk + '\n\n' + trimmedParagraph).length <= chunkSize) {
      currentChunk = currentChunk ? currentChunk + '\n\n' + trimmedParagraph : trimmedParagraph;
    } else {
      // 現在のチャンクが空でない場合は保存
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
        totalTokens += currentChunk.length;
      }

      // 段落が単独でも制限を超える場合は、文単位で分割
      if (trimmedParagraph.length > chunkSize) {
        const sentences = splitIntoSentences(trimmedParagraph);
        let sentenceChunk = '';

        for (const sentence of sentences) {
          if ((sentenceChunk + ' ' + sentence).length <= chunkSize) {
            sentenceChunk = sentenceChunk ? sentenceChunk + ' ' + sentence : sentence;
          } else {
            if (sentenceChunk.trim()) {
              chunks.push(sentenceChunk.trim());
              totalTokens += sentenceChunk.length;
            }
            sentenceChunk = sentence;
          }
        }

        if (sentenceChunk.trim()) {
          currentChunk = sentenceChunk.trim();
        } else {
          currentChunk = '';
        }
      } else {
        // 新しい段落を新しいチャンクとして開始
        currentChunk = trimmedParagraph;
      }
    }
  }

  // 最後のチャンクを追加
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
    totalTokens += currentChunk.length;
  }

  // オーバーラップ処理を追加（隣接するチャンク間で一部重複させる）
  const finalChunks = overlapSize > 0 && chunks.length > 1
    ? addOverlapToChunks(chunks, overlapSize)
    : chunks.filter(chunk => chunk.trim().length > 0);

  const processingTime = Date.now() - startTime;
  console.log(`\n📊 チャンク処理結果:`);
  console.log(`- チャンク数: ${finalChunks.length}`);
  console.log(`- 平均チャンクサイズ: ${Math.round(totalTokens / finalChunks.length)}文字`);
  console.log(`- 処理時間: ${processingTime}ms`);

  return finalChunks;
}

/**
 * テキストを文に分割する
 */
function splitIntoSentences(text: string): string[] {
  // 日本語と英語の文末記号を考慮
  const sentences: string[] = text.match(/[^.!?。！？]+[.!?。！？]+/g) || [];
  
  // マッチしなかった残りのテキストも含める
  const matchedLength = sentences.join('').length;
  if (matchedLength < text.length) {
    const remaining = text.substring(matchedLength).trim();
    if (remaining) {
      sentences.push(remaining);
    }
  }
  
  return sentences.map(s => s.trim()).filter(s => s.length > 0);
}

/**
 * チャンク間にオーバーラップを追加する
 */
function addOverlapToChunks(chunks: string[], overlapSize: number): string[] {
  const overlappedChunks: string[] = [];
  
  for (let i = 0; i < chunks.length; i++) {
    let chunk = chunks[i];
    
    // 前のチャンクからオーバーラップを追加
    if (i > 0) {
      const prevChunk = chunks[i - 1];
      const overlap = prevChunk.substring(Math.max(0, prevChunk.length - overlapSize));
      chunk = overlap + '\n\n' + chunk;
    }
    
    overlappedChunks.push(chunk);
  }
  
  return overlappedChunks;
}

/**
 * PDFファイルからテキストを抽出する
 * @param filePath PDFファイルのパス
 * @returns 抽出されたテキスト
 */
export async function extractTextFromPDF(filePath: string): Promise<string> {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`PDFファイルが見つかりません: ${filePath}`);
    }

    const dataBuffer = fs.readFileSync(filePath);
    if (dataBuffer.length === 0) {
      throw new Error('PDFファイルが空です');
    }

    const pdfData = await pdfParse(dataBuffer);
    if (!pdfData || !pdfData.text) {
      throw new Error('PDFからテキストを抽出できませんでした');
    }

    console.log(`📄 PDF処理: ${pdfData.numpages}ページ, ${pdfData.text.length}文字`);
    return pdfData.text;
  } catch (error) {
    console.error('PDF processing error:', error);
    throw new Error(`PDFの処理に失敗しました: ${error}`);
  }
}

/**
 * テキストファイルからテキストを読み込む
 * @param filePath テキストファイルのパス
 * @returns ファイルの内容
 */
export async function extractTextFromTextFile(filePath: string): Promise<string> {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`テキストファイルが見つかりません: ${filePath}`);
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    if (!content || content.trim().length === 0) {
      throw new Error('テキストファイルが空です');
    }

    console.log(`📄 テキスト処理: ${content.length}文字`);
    return content;
  } catch (error) {
    console.error('Text file processing error:', error);
    throw new Error(`テキストファイルの処理に失敗しました: ${error}`);
  }
}

/**
 * ファイルの種類に応じてテキストを抽出し、チャンクに分割する
 * @param filePath アップロードされたファイルのパス
 * @param originalName 元のファイル名
 * @param mimetype ファイルのMIMEタイプ
 * @returns 処理結果
 */
export async function processUploadedFile(
  filePath: string, 
  originalName: string, 
  mimetype: string
): Promise<ProcessedFile> {
  console.log(`\n📁 ファイル処理開始: ${originalName} (${mimetype})`);
  
  if (!filePath || !originalName || !mimetype) {
    throw new Error('必要なパラメータが不足しています');
  }

  if (!fs.existsSync(filePath)) {
    throw new Error(`ファイルが見つかりません: ${filePath}`);
  }

  const fileStats = fs.statSync(filePath);
  if (fileStats.size === 0) {
    throw new Error('ファイルが空です');
  }

  let extractedText = '';

  try {
    // ファイルタイプに応じてテキストを抽出
    switch (mimetype) {
      case 'application/pdf':
        extractedText = await extractTextFromPDF(filePath);
        break;
      case 'text/plain':
      case 'text/markdown':
        extractedText = await extractTextFromTextFile(filePath);
        break;
      default:
        throw new Error(`サポートされていないファイル形式です: ${mimetype}`);
    }

    if (!extractedText || extractedText.trim().length === 0) {
      throw new Error('ファイルからテキストを抽出できませんでした');
    }

    // テキストをチャンクに分割
    const chunks = chunkText(extractedText, 1500, 150);

    if (chunks.length === 0) {
      throw new Error('チャンクの生成に失敗しました');
    }

    // メタデータを作成
    const metadata = {
      fileType: mimetype,
      originalSize: fileStats.size,
      processedAt: new Date().toISOString(),
      totalChunks: chunks.length
    };

    console.log(`✅ ファイル処理完了: ${chunks.length}チャンク`);

    return {
      filename: originalName,
      chunks,
      metadata
    };

  } catch (error) {
    console.error('File processing error:', error);
    throw error;
  } finally {
    // 一時ファイルを削除
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log('🗑️ 一時ファイルを削除しました');
      }
    } catch (unlinkError) {
      console.warn('Failed to delete temporary file:', unlinkError);
    }
  }
}

/**
 * サポートされているファイル形式かチェックする
 * @param mimetype ファイルのMIMEタイプ
 * @returns サポートされている場合はtrue
 */
export function isSupportedFileType(mimetype: string): boolean {
  const supportedTypes = [
    'application/pdf',
    'text/plain',
    'text/markdown'
  ];
  
  return supportedTypes.includes(mimetype);
}
