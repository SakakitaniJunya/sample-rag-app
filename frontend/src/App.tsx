import { useState } from 'react';
import { search, upsert } from './api';

function App() {
  // UIのステート管理
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Array<{ id: string; score: number; text: string }>>([]);
  const [docText, setDocText] = useState('');
  const [docId, setDocId] = useState('');

  // 検索ボタン押下時
  const handleSearch = async () => {
    if (!query.trim()) return;
    const res = await search(query);
    setResults(res);
  };

  // ドキュメント登録ボタン押下時（デモ用）
  const handleUpsert = async () => {
    if (!docId.trim() || !docText.trim()) return;
    await upsert(docId, docText);
    alert('Document upserted!');
    setDocId('');
    setDocText('');
  };

  return (
    <div style={{ maxWidth: 600, margin: 'auto', padding: 20 }}>
      <h2>🔍 RAG質問デモ</h2>
      <div style={{ marginBottom: 24 }}>
        <input
          type="text"
          placeholder="検索クエリを入力..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ width: '80%', padding: 8 }}
        />
        <button onClick={handleSearch} style={{ padding: '8px 16px', marginLeft: 8 }}>
          検索
        </button>
      </div>
      <div>
        {results.length > 0 && (
          <ul>
            {results.map((r) => (
              <li key={r.id} style={{ marginBottom: 12 }}>
                <strong>({r.id}) score: {r.score.toFixed(3)}</strong><br />
                <span>{r.text}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <hr style={{ margin: '40px 0' }} />

      <h3>📄 ドキュメント登録 (デモ用)</h3>
      <div style={{ marginBottom: 12 }}>
        <input
          type="text"
          placeholder="IDを入力 (任意)"
          value={docId}
          onChange={(e) => setDocId(e.target.value)}
          style={{ width: '30%', padding: 6, marginRight: 8 }}
        />
        <input
          type="text"
          placeholder="テキストを入力..."
          value={docText}
          onChange={(e) => setDocText(e.target.value)}
          style={{ width: '50%', padding: 6, marginRight: 8 }}
        />
        <button onClick={handleUpsert} style={{ padding: '6px 12px' }}>
          登録
        </button>
      </div>
      <p style={{ fontSize: 12, color: '#666' }}>
        * 登録したドキュメントは即時検索に反映されます。
      </p>
    </div>
  );
}

export default App;