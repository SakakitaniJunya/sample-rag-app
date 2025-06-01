import { Pool, PoolClient } from 'pg';
import OpenAI from 'openai';

// PostgreSQLコネクションプールの設定
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5433/rag_db',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// OpenAIクライアントの初期化
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface Document {
  id: number;
  title?: string;
  content: string;
  content_type?: string;
  metadata?: any;
  embedding?: number[];
  created_at: Date;
  similarity?: number;
}

/**
 * データベースとテーブルの初期化
 * pgvector拡張をインストールし、必要なテーブルを作成
 */
export async function initDatabase(): Promise<void> {
  const client: PoolClient = await pool.connect();
  
  try {
    console.log('🔧 データベースを初期化中...');
    
    // pgvector拡張をインストール
    await client.query('CREATE EXTENSION IF NOT EXISTS vector;');
    console.log('✅ pgvector拡張を有効化しました');
    
    // documentsテーブルの作成
    await client.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id SERIAL PRIMARY KEY,
        title TEXT,
        content TEXT NOT NULL,
        content_type TEXT,
        metadata JSONB DEFAULT '{}',
        embedding vector(1536),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ documentsテーブルを作成しました');
    
    // ベクトル検索用のインデックスを作成（HNSW）
    await client.query(`
      CREATE INDEX IF NOT EXISTS documents_embedding_hnsw_idx 
      ON documents 
      USING hnsw (embedding vector_cosine_ops)
      WITH (m = 16, ef_construction = 64);
    `);
    console.log('✅ ベクトルインデックス（HNSW）を作成しました');
    
    // 追加のインデックス
    await client.query(`
      CREATE INDEX IF NOT EXISTS documents_content_type_idx 
      ON documents (content_type);
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS documents_created_at_idx 
      ON documents (created_at);
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS documents_metadata_idx 
      ON documents USING gin (metadata);
    `);
    
    console.log('✅ 追加インデックスを作成しました');
    
    // サンプルデータの挿入（初回のみ）
    const sampleData = [
      {
        title: 'Welcome Document',
        content: 'Welcome to our RAG system! This is a sample document to test the vector search functionality.',
        content_type: 'text/plain',
        metadata: { type: 'sample', category: 'welcome' }
      },
      {
        title: 'AI Introduction',
        content: 'Artificial Intelligence (AI) is the simulation of human intelligence in machines that are programmed to think and learn.',
        content_type: 'text/plain',
        metadata: { type: 'sample', category: 'education' }
      },
      {
        title: 'RAG Explanation',
        content: 'Retrieval-Augmented Generation (RAG) combines information retrieval with text generation to provide more accurate and contextual responses.',
        content_type: 'text/plain',
        metadata: { type: 'sample', category: 'technical' }
      }
    ];

    // 各サンプルデータをベクトル化して保存
    for (const doc of sampleData) {
      const embedding = await embedText(doc.content);
      const query = `
        INSERT INTO documents (title, content, content_type, metadata, embedding)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT DO NOTHING
      `;
      
      await client.query(query, [
        doc.title,
        doc.content,
        doc.content_type,
        JSON.stringify(doc.metadata),
        `[${embedding.join(',')}]`
      ]);
    }
    
    console.log(`✅ サンプルデータを${sampleData.length}件挿入しました`);
    
    console.log('✅ データベース初期化が完了しました');
    
  } catch (error) {
    console.error('❌ データベース初期化エラー:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * テキストをベクトル化（OpenAI Embedding）
 * @param text ベクトル化するテキスト
 * @returns ベクトル配列
 */
export async function embedText(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error('埋め込み生成エラー:', error);
    throw error;
  }
}

/**
 * ドキュメントをデータベースに保存
 * @param title ドキュメントのタイトル
 * @param content ドキュメントの内容
 * @param contentType コンテンツタイプ
 * @param metadata メタデータ
 * @returns 保存されたドキュメントのID
 */
export async function saveDocument(
  title: string,
  content: string,
  contentType?: string,
  metadata: any = {}
): Promise<number> {
  const client: PoolClient = await pool.connect();
  
  try {
    // テキストをベクトル化
    console.log('🔄 テキストをベクトル化中...');
    const embedding = await embedText(content);
    
    // データベースに保存
    const query = `
      INSERT INTO documents (title, content, content_type, metadata, embedding)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, created_at
    `;
    
    const result = await client.query(query, [
      title,
      content,
      contentType,
      JSON.stringify(metadata),
      `[${embedding.join(',')}]`, // PostgreSQLのvector型として保存
    ]);
    
    const documentId = result.rows[0].id;
    console.log(`✅ ドキュメントを保存しました (ID: ${documentId})`);
    
    return documentId;
    
  } catch (error) {
    console.error('ドキュメント保存エラー:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * シンプルなテキスト登録（後方互換性）
 * @param id 文字列ID（内部で数値IDに変換または新規作成）
 * @param text テキスト内容
 */
export async function upsertDocument(id: string, text: string): Promise<void> {
  const client: PoolClient = await pool.connect();
  
  try {
    // ベクトル化
    const embedding = await embedText(text);
    
    // IDが数値の場合はUPSERT、そうでなければINSERT
    const isNumericId = /^\d+$/.test(id);
    
    if (isNumericId) {
      // UPSERTロジック
      const upsertQuery = `
        INSERT INTO documents (id, title, content, embedding) 
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (id) 
        DO UPDATE SET 
          content = EXCLUDED.content,
          embedding = EXCLUDED.embedding,
          created_at = CURRENT_TIMESTAMP
      `;
      
      await client.query(upsertQuery, [
        parseInt(id),
        `Document ${id}`,
        text,
        `[${embedding.join(',')}]`,
      ]);
    } else {
      // 新規作成（文字列IDは無視して自動採番）
      const insertQuery = `
        INSERT INTO documents (title, content, embedding)
        VALUES ($1, $2, $3)
      `;
      
      await client.query(insertQuery, [
        id, // タイトルとして使用
        text,
        `[${embedding.join(',')}]`,
      ]);
    }
    
  } catch (error) {
    console.error('upsertDocument エラー:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * メタデータ付きでドキュメントを保存/更新
 * @param id ドキュメントID
 * @param text テキスト内容
 * @param metadata メタデータ
 */
export async function upsertDocumentWithMetadata(
  id: string,
  text: string,
  metadata: any = {}
): Promise<void> {
  const client: PoolClient = await pool.connect();
  
  try {
    console.log('🔄 テキストをベクトル化中...');
    const embedding = await embedText(text);
    console.log('✅ ベクトル化完了:', embedding.length, '次元');
    
    const query = `
      INSERT INTO documents (title, content, metadata, embedding)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `;
    
    const result = await client.query(query, [
      metadata.filename || id,
      text,
      JSON.stringify(metadata),
      `[${embedding.join(',')}]`,
    ]);
    
    console.log(`✅ ドキュメントを保存しました (ID: ${result.rows[0].id})`);
    
  } catch (error) {
    console.error('upsertDocumentWithMetadata エラー:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 類似ドキュメントを検索
 * @param query 検索クエリ
 * @param limit 取得する件数
 * @param threshold 類似度の閾値
 * @returns 類似ドキュメントの配列
 */
export async function searchSimilarDocuments(
  query: string,
  limit: number = 5,
  threshold: number = 0.3
): Promise<Array<{ id: string; score: number; text: string }>> {
  const client: PoolClient = await pool.connect();
  
  try {
    console.log('🔍 検索クエリ:', query);
    console.log('📊 検索パラメータ:', { limit, threshold });
    
    // クエリをベクトル化
    console.log('🔄 クエリをベクトル化中...');
    const queryEmbedding = await embedText(query);
    console.log('✅ クエリのベクトル化完了:', queryEmbedding.length, '次元');
    
    // コサイン類似度で検索
    const searchQuery = `
      SELECT 
        id,
        title,
        content,
        metadata,
        1 - (embedding <=> $1) as similarity
      FROM documents
      WHERE 1 - (embedding <=> $1) > $2
      ORDER BY embedding <=> $1
      LIMIT $3
    `;
    
    console.log('🔍 検索クエリ実行中...');
    const result = await client.query(searchQuery, [
      `[${queryEmbedding.join(',')}]`,
      threshold,
      limit,
    ]);
    
    console.log(`📊 検索結果: ${result.rows.length}件`);
    if (result.rows.length > 0) {
      result.rows.forEach((row, index) => {
        console.log(`--- 結果 ${index + 1} (関連度: ${(row.similarity * 100).toFixed(2)}%) ---`);
        console.log(`ID: ${row.id}`);
        console.log(`テキスト: ${row.content.substring(0, 150)}...`);
      });
    } else {
      // 閾値を下げて再検索
      console.log('⚠️ 検索結果なし。閾値を下げて再検索します...');
      const retryQuery = `
        SELECT 
          id,
          title,
          content,
          metadata,
          1 - (embedding <=> $1) as similarity
        FROM documents
        ORDER BY embedding <=> $1
        LIMIT $2
      `;
      
      const retryResult = await client.query(retryQuery, [
        `[${queryEmbedding.join(',')}]`,
        limit,
      ]);
      
      console.log(`📊 再検索結果: ${retryResult.rows.length}件`);
      retryResult.rows.forEach((row, index) => {
        console.log(`--- 結果 ${index + 1} (関連度: ${(row.similarity * 100).toFixed(2)}%) ---`);
        console.log(`ID: ${row.id}`);
        console.log(`テキスト: ${row.content.substring(0, 150)}...`);
      });
      
      return retryResult.rows.map(row => ({
        id: row.id.toString(),
        score: parseFloat(row.similarity),
        text: row.content,
      }));
    }
    
    return result.rows.map(row => ({
      id: row.id.toString(),
      score: parseFloat(row.similarity),
      text: row.content,
    }));
    
  } catch (error) {
    console.error('検索エラー:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * ドキュメントを削除
 * @param id ドキュメントID
 */
export async function deleteDocument(id: string): Promise<void> {
  const client: PoolClient = await pool.connect();
  
  try {
    const query = 'DELETE FROM documents WHERE id = $1';
    await client.query(query, [parseInt(id)]);
  } catch (error) {
    console.error('削除エラー:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 複数のドキュメントを一括削除
 * @param ids ドキュメントIDの配列
 */
export async function deleteMultipleDocuments(ids: string[]): Promise<void> {
  const client: PoolClient = await pool.connect();
  
  try {
    const numericIds = ids.map(id => parseInt(id)).filter(id => !isNaN(id));
    
    if (numericIds.length === 0) return;
    
    const query = 'DELETE FROM documents WHERE id = ANY($1)';
    await client.query(query, [numericIds]);
  } catch (error) {
    console.error('一括削除エラー:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 全ドキュメントを取得
 * @param limit 取得件数
 * @param offset オフセット
 * @returns ドキュメントの配列
 */
export async function getAllDocuments(
  limit: number = 100,
  offset: number = 0
): Promise<Array<{
  id: string | number;
  text: string;
  metadata: any;
  created_at: string;
}>> {
  const client: PoolClient = await pool.connect();
  
  try {
    const query = `
      SELECT id, title, content, metadata, created_at
      FROM documents
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `;
    
    const result = await client.query(query, [limit, offset]);
    
    return result.rows.map(row => ({
      id: row.id,
      text: row.content,
      metadata: row.metadata || {},
      created_at: row.created_at.toISOString(),
    }));
    
  } catch (error) {
    console.error('全ドキュメント取得エラー:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * データベース統計情報を取得
 * @returns 統計情報
 */
export async function getCollectionInfo(): Promise<{
  status: string;
  vectorsCount: number;
  indexedVectorsCount: number;
  pointsCount: number;
  config: any;
}> {
  const client: PoolClient = await pool.connect();
  
  try {
    // ドキュメント数を取得
    const countQuery = 'SELECT COUNT(*) as total FROM documents';
    const countResult = await client.query(countQuery);
    const totalDocs = parseInt(countResult.rows[0].total);
    
    // ベクトル付きドキュメント数を取得
    const vectorCountQuery = 'SELECT COUNT(*) as total FROM documents WHERE embedding IS NOT NULL';
    const vectorCountResult = await client.query(vectorCountQuery);
    const vectorDocs = parseInt(vectorCountResult.rows[0].total);
    
    // インデックス情報を取得
    const indexQuery = `
      SELECT schemaname, tablename, indexname 
      FROM pg_indexes 
      WHERE tablename = 'documents' AND indexname LIKE '%hnsw%'
    `;
    const indexResult = await client.query(indexQuery);
    const hasVectorIndex = indexResult.rows.length > 0;
    
    return {
      status: 'green',
      vectorsCount: vectorDocs,
      indexedVectorsCount: hasVectorIndex ? vectorDocs : 0,
      pointsCount: totalDocs,
      config: {
        database: 'PostgreSQL',
        extension: 'pgvector',
        vectorDimension: 1536,
        distanceMetric: 'cosine',
      },
    };
    
  } catch (error) {
    console.error('統計情報取得エラー:', error);
    return {
      status: 'red',
      vectorsCount: 0,
      indexedVectorsCount: 0,
      pointsCount: 0,
      config: {},
    };
  } finally {
    client.release();
  }
}

/**
 * データベース接続をクリーンアップ
 */
export async function closeDatabase(): Promise<void> {
  await pool.end();
}

// プロセス終了時にコネクションプールをクリーンアップ
process.on('SIGINT', closeDatabase);
process.on('SIGTERM', closeDatabase);

/**
 * データベース内のドキュメントを確認
 */
export async function checkDocuments(): Promise<void> {
  const client: PoolClient = await pool.connect();
  
  try {
    console.log('📊 データベース内のドキュメントを確認中...');
    
    // 全ドキュメント数を取得
    const countQuery = 'SELECT COUNT(*) as total FROM documents';
    const countResult = await client.query(countQuery);
    console.log(`📚 全ドキュメント数: ${countResult.rows[0].total}件`);
    
    // ベクトル付きドキュメント数を取得
    const vectorQuery = 'SELECT COUNT(*) as total FROM documents WHERE embedding IS NOT NULL';
    const vectorResult = await client.query(vectorQuery);
    console.log(`🔢 ベクトル付きドキュメント数: ${vectorResult.rows[0].total}件`);
    
    // 最新のドキュメントを表示
    const recentQuery = `
      SELECT id, title, content, created_at
      FROM documents
      ORDER BY created_at DESC
      LIMIT 5
    `;
    const recentResult = await client.query(recentQuery);
    
    console.log('\n📝 最新のドキュメント:');
    recentResult.rows.forEach((row, index) => {
      console.log(`\n--- ドキュメント ${index + 1} ---`);
      console.log(`ID: ${row.id}`);
      console.log(`タイトル: ${row.title}`);
      console.log(`内容: ${row.content.substring(0, 100)}...`);
      console.log(`作成日時: ${row.created_at}`);
    });
    
  } catch (error) {
    console.error('ドキュメント確認エラー:', error);
    throw error;
  } finally {
    client.release();
  }
}

/*

PostgreSQL + pgvector クライアントの特徴:

✅ **標準SQL**: 馴染みのあるSQLでデータ操作
✅ **ACID準拠**: トランザクションの信頼性
✅ **豊富なデータ型**: JSONB、テキスト検索、地理空間データなど
✅ **拡張性**: 大規模データにも対応
✅ **コスト効率**: オープンソースで無料
✅ **エコシステム**: 豊富なツールとライブラリ
✅ **バックアップ/復旧**: 企業レベルのデータ保護
✅ **インデックス最適化**: HNSW、IVFFlat等の高速検索

メソッド一覧:
- `initDatabase()`: データベースとテーブルの初期化
- `embedText()`: OpenAI APIでテキストをベクトル化
- `saveDocument()`: フル機能でのドキュメント保存
- `upsertDocument()`: シンプルなテキスト登録
- `upsertDocumentWithMetadata()`: メタデータ付き保存
- `searchSimilarDocuments()`: ベクトル類似度検索
- `deleteDocument()`: 単一ドキュメント削除
- `deleteMultipleDocuments()`: 一括削除
- `getAllDocuments()`: 全ドキュメント取得
- `getCollectionInfo()`: 統計情報取得
- `closeDatabase()`: 接続クリーンアップ
- `checkDocuments()`: データベース内のドキュメントを確認

*/
