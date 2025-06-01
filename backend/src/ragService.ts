import OpenAI from 'openai';
import { searchSimilarDocuments } from './pgClient';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface RAGResponse {
  answer: string;
  sources: Array<{
    id: string;
    score: number;
    text: string;
    chunk_preview: string;
  }>;
  responseTime: number;
  tokensUsed?: number;
}

/**
 * RAGを使用して質問に回答を生成する
 * @param question ユーザーの質問
 * @param maxSources 参考にする文書の最大数
 * @returns RAG回答結果
 */
export async function generateRAGAnswer(question: string, maxSources: number = 3): Promise<RAGResponse> {
  const startTime = Date.now();
  
  try {
    // 1. 関連ドキュメントを検索
    console.log('\n🔍 検索クエリ:', question);
    console.log('📊 最大検索数:', maxSources);
    
    const searchResults = await searchSimilarDocuments(question, maxSources);
    
    console.log('\n📚 検索結果 (上位5件):');
    searchResults.slice(0, 5).forEach((result, index) => {
      console.log(`\n--- 結果 ${index + 1} (関連度: ${(result.score * 100).toFixed(2)}%) ---`);
      console.log(`ID: ${result.id}`);
      console.log(`テキスト: ${result.text.substring(0, 150)}...`);
    });
    
    if (searchResults.length === 0) {
      console.log('\n❌ 検索結果なし');
      return {
        answer: '申し訳ございませんが、関連する情報が見つかりませんでした。質問を変えて再度お試しください。',
        sources: [],
        responseTime: Date.now() - startTime
      };
    }

    // 2. コンテキストを構築
    console.log('\n📝 コンテキスト構築中...');
    const context = searchResults
      .map((doc: { text: string; score: number }, index: number) => {
        const preview = doc.text.length > 100 
          ? doc.text.substring(0, 100) + '...' 
          : doc.text;
        
        return `[ソース${index + 1}] (関連度: ${(doc.score * 100).toFixed(1)}%)\n${doc.text}`;
      })
      .join('\n\n---\n\n');

    // 3. プロンプトを構築
    console.log('\n🤖 AI回答生成中...');
    const systemPrompt = `あなたは提供された情報に基づいて回答する専門アシスタントです。

以下のルールに従って回答してください：
1. 提供された情報を優先的に使用してください
2. 提供された情報に不足がある場合は、あなたの知識を補完的に使用して回答を充実させてください
3. 情報の出典を明確にしてください：
   - 提供された情報からの場合は「ソースXによると...」と明記
   - あなたの知識からの場合は「一般的に...」や「知られているところでは...」と明記
4. 推測や憶測は避け、事実に基づいて回答してください
5. 回答は分かりやすく、構造化して提供してください`;

    const userPrompt = `以下の情報を参考にして質問に答えてください。
必要に応じて、あなたの知識も活用して回答を充実させてください。

【参考情報】
${context}

【質問】
${question}

【回答】`;

    // 4. OpenAI APIで回答生成
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.2,
      max_tokens: 1500,
    });

    const answer = response.choices[0].message.content || 'エラーが発生しました';
    const tokensUsed = response.usage?.total_tokens;

    // 5. レスポンスを構築
    const sources = searchResults.map((doc: { id: string; score: number; text: string }) => ({
      id: doc.id,
      score: doc.score,
      text: doc.text,
      chunk_preview: doc.text.length > 150 
        ? doc.text.substring(0, 150) + '...' 
        : doc.text
    }));

    const responseTime = Date.now() - startTime;

    console.log('\n✅ 回答生成完了');
    console.log(`⏱️ 処理時間: ${responseTime}ms`);
    console.log(`📊 使用トークン数: ${tokensUsed}`);
    console.log('\n📝 生成された回答:');
    console.log(answer);

    return {
      answer,
      sources,
      responseTime,
      tokensUsed
    };

  } catch (error) {
    console.error('\n❌ RAG回答生成エラー:', error);
    throw new Error(`回答の生成に失敗しました: ${error}`);
  }
}

/**
 * 質問の品質をチェックする
 * @param question チェックする質問
 * @returns 品質チェック結果
 */
export function validateQuestion(question: string): { isValid: boolean; message?: string } {
  if (!question || question.trim().length === 0) {
    return { isValid: false, message: '質問が入力されていません' };
  }

  if (question.trim().length < 5) {
    return { isValid: false, message: '質問が短すぎます（5文字以上で入力してください）' };
  }

  if (question.length > 1000) {
    return { isValid: false, message: '質問が長すぎます（1000文字以内で入力してください）' };
  }

  return { isValid: true };
}

/**
 * 簡単な質問分解機能（将来の拡張用）
 * @param question 分解する質問
 * @returns 分解された副質問のリスト
 */
export async function decomposeQuestion(question: string): Promise<string[]> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: '複雑な質問を、検索に適した複数の小さなクエリに分解してください。各クエリは独立して検索可能である必要があります。'
        },
        {
          role: 'user',
          content: `以下の質問を検索クエリに分解してください（JSON配列形式で返してください）:\n${question}`
        }
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' }
    });

    const result = JSON.parse(response.choices[0].message.content || '{"queries": []}');
    return result.queries || [question];
  } catch (error) {
    console.warn('質問分解に失敗しました:', error);
    return [question]; // フォールバック：元の質問をそのまま使用
  }
}
