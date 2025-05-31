import dotenv from 'dotenv';
// 環境変数の読み込みを最初に行う
dotenv.config();

import express from 'express';
import cors from 'cors';
import { initCollection, upsertDocument, searchSimilarDocuments, deleteDocument } from './qdrantClient';

// デバッグ用：環境変数の値を確認
console.log('Environment variables:', {
    QDRANT_URL: process.env.QDRANT_URL,
    PORT: process.env.PORT
});

// 環境変数がセットされているか確認
function envCheck(){
    const requiredEnvVars = ['QDRANT_URL', 'OPENAI_API_KEY'];
    const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
    if(missingEnvVars.length > 0){
        console.error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
        process.exit(1);
    }
}

// 環境変数のチェックを最初に実行
envCheck();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());


// アプリ起動時にコレクションを初期化(存在していなければ常に作成)
(async () => {
    try{
        await initCollection();
        console.log('Qdrantコレクションを初期化しました');
    } catch (error){
        console.error('コレクションの初期化に失敗しました:', error);
    }
})();

// ドキュメント登録エンドポイント
app.post('/api/upsert', async (req, res) => {
  const { id, text } = req.body;
  if (!id || !text) return res.status(400).json({ error: 'id and text are required' });
  try {
    await upsertDocument(id, text);
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to upsert' });
  }
});


// 類似ドキュメント検索エンドポイント
app.get('api/search', async( req,res ) => {
    const { query, k = 5 } = req.query;
    if(!query) return res.status(400).json({ error: 'query is required' });
    try{
        const results = await searchSimilarDocuments(query as string, parseInt(k as string));
        return res.json(results);
    } catch (err){
        console.error(err);
        return res.status(500).json({ error: 'Failed to search' });
    }
})

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});