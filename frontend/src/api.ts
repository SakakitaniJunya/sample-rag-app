import axios from 'axios';

const API_BASE = 'http://localhost:5001/api';

// エラーハンドリングを含むaxiosインスタンス
const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
});

// レスポンスインターセプター
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export interface Document {
  id: string;
  text: string;
  metadata?: {
    filename?: string;
    fileType?: string;
    chunkIndex?: number;
    sourceFile?: string;
    created_at?: string;
  };
  created_at?: string;
}

export interface SearchResult extends Document {
  score: number;
}

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

export interface SystemStats {
  totalDocuments: number;
  vectorsCount: number;
  indexedVectorsCount: number;
  collectionStatus: string;
  fileTypes: Record<string, number>;
  lastUpdate: string;
}

/**
 * ドキュメント登録（動的にUIで追加する場合に使うイメージ）
 */
export async function upsert(id: string, text: string) {
  const response = await api.post('/upsert', { id, text });
  return response.data;
}

/**
 * 検索クエリに対して類似ドキュメントを取得
 */
export async function search(query: string, k: number = 5): Promise<SearchResult[]> {
  const response = await api.get('/search', { params: { query, k } });
  return response.data;
}

/**
 * ファイルアップロード
 */
export async function uploadFile(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await api.post('/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  
  return response.data;
}

/**
 * RAG質問回答
 */
export async function askQuestion(question: string): Promise<RAGResponse> {
  const response = await api.post('/ask', { question });
  return response.data;
}

/**
 * ドキュメント一覧取得
 */
export async function getDocuments(limit: number = 50, offset: number = 0): Promise<{
  documents: Document[];
  total: number;
}> {
  const response = await api.get('/documents', { params: { limit, offset } });
  return response.data;
}

/**
 * システム統計情報取得
 */
export async function getSystemStats(): Promise<SystemStats> {
  const response = await api.get('/stats');
  return response.data;
}

/**
 * ドキュメント削除
 */
export async function deleteDocument(id: string) {
  const response = await api.delete(`/documents/${id}`);
  return response.data;
}

/**
 * 複数ドキュメント一括削除
 */
export async function deleteMultipleDocuments(ids: string[]) {
  const response = await api.delete('/documents', { data: { ids } });
  return response.data;
}