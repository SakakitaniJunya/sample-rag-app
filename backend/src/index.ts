import dotenv from 'dotenv';
// 環境変数の読み込みを最初に行う
dotenv.config();

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import { 
    initDatabase, 
    upsertDocument, 
    upsertDocumentWithMetadata,
    searchSimilarDocuments, 
    deleteDocument,
    deleteMultipleDocuments,
    getAllDocuments,
    getCollectionInfo
} from './pgClient';
import { processUploadedFile, isSupportedFileType } from './fileProcessor';
import { generateRAGAnswer, validateQuestion } from './ragService';

// デバッグ用：環境変数の値を確認
console.log('Environment variables:', {
    DATABASE_URL: process.env.DATABASE_URL?.replace(/:\/\/.*@/, '://***@'), // パスワードを隠す
    PORT: process.env.PORT
});

// 環境変数がセットされているか確認
function envCheck(){
    const requiredEnvVars = ['DATABASE_URL', 'OPENAI_API_KEY'];
    const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
    if(missingEnvVars.length > 0){
        console.error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
        process.exit(1);
    }
}

// 環境変数のチェックを最初に実行
envCheck();

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:3000'],
    credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// アップロードディレクトリの作成
import fs from 'fs';
const uploadDir = './uploads';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Multerの設定
const upload = multer({
    dest: uploadDir,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
    },
    fileFilter: (req, file, cb) => {
        if (isSupportedFileType(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(`サポートされていないファイル形式です: ${file.mimetype}`));
        }
    }
});


// アプリ起動時にデータベースを初期化(存在していなければ常に作成)
(async () => {
    try{
        await initDatabase();
        console.log('PostgreSQLデータベースを初期化しました');
    } catch (error){
        console.error('データベースの初期化に失敗しました:', error);
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
app.get('/api/search', async( req,res ) => {
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

// ファイルアップロードエンドポイント
app.post('/api/upload', upload.single('file'), async (req, res) => {
    try {
        const file = req.file;
        if (!file) {
            return res.status(400).json({ error: 'ファイルがアップロードされていません' });
        }

        console.log(`📁 ファイル処理開始: ${file.originalname}`);
        
        // ファイルを処理してチャンクに分割
        const processedFile = await processUploadedFile(
            file.path,
            file.originalname,
            file.mimetype
        );

        // 各チャンクをベクトルDBに保存
        const savedChunks = [];
        for (let i = 0; i < processedFile.chunks.length; i++) {
            const chunkId = `${processedFile.filename}_chunk_${i + 1}`;
            const chunkMetadata = {
                ...processedFile.metadata,
                chunkIndex: i + 1,
                sourceFile: processedFile.filename
            };
            
            await upsertDocumentWithMetadata(
                chunkId,
                processedFile.chunks[i],
                chunkMetadata
            );
            
            savedChunks.push({
                id: chunkId,
                text: processedFile.chunks[i],
                metadata: chunkMetadata
            });
        }

        console.log(`✅ ファイル処理完了: ${processedFile.chunks.length} チャンクを保存`);

        res.json({
            success: true,
            filename: processedFile.filename,
            totalChunks: processedFile.chunks.length,
            chunks: savedChunks,
            metadata: processedFile.metadata
        });
    } catch (error) {
        console.error('ファイルアップロードエラー:', error);
        res.status(500).json({ 
            error: 'ファイルの処理に失敗しました',
            details: (error as Error).message
        });
    }
});

// RAG回答生成エンドポイント
app.post('/api/ask', async (req, res) => {
    try {
        const { question } = req.body;
        
        // 質問の検証
        const validation = validateQuestion(question);
        if (!validation.isValid) {
            return res.status(400).json({ error: validation.message });
        }

        console.log(`❓ RAG質問: ${question}`);
        
        // RAG回答を生成
        const ragResponse = await generateRAGAnswer(question);
        
        res.json(ragResponse);
    } catch (error) {
        console.error('RAG回答エラー:', error);
        res.status(500).json({
            error: '回答の生成に失敗しました',
            details: (error as Error).message
        });
    }
});

// ドキュメント一覧取得エンドポイント
app.get('/api/documents', async (req, res) => {
    try {
        const { limit = 50, offset = 0 } = req.query;
        const documents = await getAllDocuments(
            parseInt(limit as string),
            parseInt(offset as string)
        );
        
        res.json({
            documents,
            total: documents.length
        });
    } catch (error) {
        console.error('ドキュメント取得エラー:', error);
        res.status(500).json({ error: 'ドキュメントの取得に失敗しました' });
    }
});

// システム統計情報エンドポイント
app.get('/api/stats', async (req, res) => {
    try {
        const collectionInfo = await getCollectionInfo();
        const documents = await getAllDocuments(1000); // 最大1000件取得して統計算出
        
        // ファイル種別の統計
        const fileTypes = documents.reduce((acc: any, doc: any) => {
            const fileType = doc.metadata?.fileType || 'unknown';
            acc[fileType] = (acc[fileType] || 0) + 1;
            return acc;
        }, {});
        
        res.json({
            totalDocuments: collectionInfo.pointsCount,
            vectorsCount: collectionInfo.vectorsCount,
            indexedVectorsCount: collectionInfo.indexedVectorsCount,
            collectionStatus: collectionInfo.status,
            fileTypes,
            lastUpdate: new Date().toISOString()
        });
    } catch (error) {
        console.error('統計情報取得エラー:', error);
        res.status(500).json({ error: '統計情報の取得に失敗しました' });
    }
});

// ドキュメント削除エンドポイント
app.delete('/api/documents/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await deleteDocument(id);
        
        res.json({ success: true, message: 'ドキュメントを削除しました' });
    } catch (error) {
        console.error('ドキュメント削除エラー:', error);
        res.status(500).json({ error: 'ドキュメントの削除に失敗しました' });
    }
});

// 複数ドキュメント一括削除エンドポイント
app.delete('/api/documents', async (req, res) => {
    try {
        const { ids } = req.body;
        
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: '削除するドキュメントIDを指定してください' });
        }
        
        await deleteMultipleDocuments(ids);
        
        res.json({ 
            success: true, 
            message: `${ids.length}個のドキュメントを削除しました` 
        });
    } catch (error) {
        console.error('一括削除エラー:', error);
        res.status(500).json({ error: 'ドキュメントの一括削除に失敗しました' });
    }
});

// エラーハンドリングミドルウェア
app.use((err: any, req: any, res: any, next: any) => {
    console.error('Error occurred:', err);
    res.status(500).json({ error: 'Internal Server Error', details: err.message });
});

// 404ハンドリング
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});