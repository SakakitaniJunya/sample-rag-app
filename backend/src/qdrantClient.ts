import axios from 'axios';
import OpenAI from 'openai';

// デバッグ用：環境変数の値を確認
console.log('QdrantClient - QDRANT_URL:', process.env.QDRANT_URL);

const QDRANT_URL = process.env.QDRANT_URL;
if (!QDRANT_URL) {
    throw new Error('QDRANT_URL environment variable is not set');
}

const COLLECTION_NAME = 'documents';


// OpenAIクライアント初期化
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Qdrantコレクションを初期化する
 * ベクトルサイズ1536、コサイン類似度を使用するコレクションを作成
 */
export async function initCollection(){
    await axios.put(`${QDRANT_URL}/collections/${COLLECTION_NAME}`, {
        vectors: {
            size: 1536,
            distance: "Cosine",
        },
    })
}

/**
 * テキストをベクトル化する(embedding)
 * OpenAIのtext-embedding-3-smallモデルを使用してテキストをベクトルに変換
 * @param text - ベクトル化するテキスト
 * @returns テキストのベクトル表現
 */
export async function embedText(text: string){
    const response = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: text,
    });
    return response.data[0].embedding;
}

/**
 * ドキュメントをQdrantに追加または更新する
 * テキストをベクトル化し、指定されたIDでQdrantに保存
 * @param id - ドキュメントの一意の識別子
 * @param text - 保存するテキスト
 */
export async function upsertDocument(id: string, text: string){
    const vector = await embedText(text);
    await axios.put(`${QDRANT_URL}/collections/${COLLECTION_NAME}/points`, {
        points: [
            {
                id: id,
                vector: vector,
            }
        ]
    })
}

/**
 * クエリ文で類似ドキュメントを検索する
 * クエリテキストをベクトル化し、最も類似度の高いドキュメントを返す
 * @param query - 検索クエリのテキスト
 * @param k - 返す結果の数（デフォルト: 5）
 * @returns 類似ドキュメントの配列（id, score, textを含む）
 */
export async function searchSimilarDocuments(query: string, k: number = 5){
    const queryVector = await embedText(query);
    const response = await axios.post(`${QDRANT_URL}/collections/${COLLECTION_NAME}/points/search`, {
        query_vector: queryVector,
        limit: k,
    })
    return response.data.result.map((hit: any) => ({
        id: hit.id,
        score: hit.score,
        text: hit.payload.text,
    }));
}

/**
 * ドキュメントをQdrantから削除する
 * 指定されたIDのドキュメントをコレクションから削除
 * @param id - 削除するドキュメントのID
 */
export async function deleteDocument(id: string){
    await axios.delete(`${QDRANT_URL}/collections/${COLLECTION_NAME}/points/${id}`);
}

/*
 
Qdrantクライアントの各メソッドの簡潔な説明：

- `initCollection()`: 最初の1度だけ呼び出し → コレクションを作成
- `embedText()`: OpenAI埋め込みを得る
- `upsertDocument()`: 任意のIDとテキストをQdrantに登録
- `searchSimilarDocuments()`: 引数テキストと類似する上位5件を返す
- `deleteDocument()`: 指定したIDのドキュメントを削除
*/
