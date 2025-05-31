import axios from 'axios';

const API_BASE = 'http://localhost:5001/api';

/**
 * ドキュメント登録（動的にUIで追加する場合に使うイメージ）
 */
export async function upsert(id: string, text: string) {
  return axios.post(`${API_BASE}/upsert`, { id, text });
}

/**
 * 検索クエリに対して類似ドキュメントを取得
 */
export async function search(query: string) {
  const resp = await axios.get(`${API_BASE}/search`, { params: { query } });
  return resp.data  
}