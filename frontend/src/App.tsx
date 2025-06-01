import { useState } from 'react';
import { search, upsert } from './api';
import FileUpload from './FileUpload';
import RAGChat from './RAGChat';
import DocumentManager from './DocumentManager';
import SystemStatsDisplay from './SystemStatsDisplay';

function App() {
  // UIのステート管理
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Array<{ id: string; score: number; text: string }>>([]);
  const [docText, setDocText] = useState('');
  const [docId, setDocId] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [activeTab, setActiveTab] = useState<'search' | 'rag' | 'upload' | 'documents'>('upload');
  const [searchLoading, setSearchLoading] = useState(false);
  const [upsertLoading, setUpsertLoading] = useState(false);

  // 検索ボタン押下時
  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearchLoading(true);
    try {
      const res = await search(query);
      setResults(res);
    } catch (error) {
      console.error('Search error:', error);
      alert('検索に失敗しました');
    } finally {
      setSearchLoading(false);
    }
  };

  // ドキュメント登録ボタン押下時（デモ用）
  const handleUpsert = async () => {
    if (!docId.trim() || !docText.trim()) return;
    setUpsertLoading(true);
    try {
      await upsert(docId, docText);
      alert('ドキュメントを登録しました！');
      setDocId('');
      setDocText('');
      // ドキュメント一覧を更新
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error('Upsert error:', error);
      alert('登録に失敗しました');
    } finally {
      setUpsertLoading(false);
    }
  };

  // ファイルアップロード成功時のコールバック
  const handleUploadSuccess = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  // RAG質問実行時のコールバック
  const handleQuestionAsked = () => {
    // 必要に応じて統計情報を更新
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div style={{ maxWidth: 1200, margin: 'auto', padding: 20, fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ textAlign: 'center', marginBottom: 30 }}>
        <h1 style={{ color: '#333', margin: '0 0 8px 0' }}>🔍 拡張RAGデモアプリ</h1>
        <p style={{ color: '#666', margin: 0 }}>
          ファイルアップロード → チャンキング → ベクトル検索 → RAG回答
        </p>
      </header>

      {/* システム統計 */}
      <SystemStatsDisplay refreshTrigger={refreshTrigger} />

      {/* タブナビゲーション */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid #ddd',
        marginBottom: 20
      }}>
        {[
          { key: 'upload', label: '📁 ファイルアップロード' },
          { key: 'rag', label: '🤖 RAG質問' },
          { key: 'search', label: '🔍 ベクトル検索' },
          { key: 'documents', label: '📚 ドキュメント管理' }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            style={{
              padding: '12px 20px',
              border: 'none',
              backgroundColor: activeTab === tab.key ? '#2196f3' : 'transparent',
              color: activeTab === tab.key ? 'white' : '#666',
              cursor: 'pointer',
              borderRadius: '4px 4px 0 0',
              marginRight: '4px',
              fontSize: '14px'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* タブコンテンツ */}
      {activeTab === 'upload' && (
        <FileUpload onUploadSuccess={handleUploadSuccess} />
      )}

      {activeTab === 'rag' && (
        <RAGChat onQuestionAsked={handleQuestionAsked} />
      )}

      {activeTab === 'search' && (
        <div style={{ 
          border: '1px solid #ddd', 
          borderRadius: '8px', 
          padding: '20px', 
          backgroundColor: '#fff'
        }}>
          <h3 style={{ margin: '0 0 16px 0' }}>🔍 ベクトル検索デモ</h3>
          <div style={{ marginBottom: 24 }}>
            <input
              type="text"
              placeholder="検索クエリを入力..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              style={{ 
                width: '70%', 
                padding: 12, 
                borderRadius: '4px',
                border: '1px solid #ccc',
                fontSize: '14px'
              }}
            />
            <button 
              onClick={handleSearch} 
              disabled={searchLoading || !query.trim()}
              style={{ 
                padding: '12px 20px', 
                marginLeft: 8,
                backgroundColor: searchLoading ? '#ccc' : '#2196f3',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: searchLoading ? 'not-allowed' : 'pointer',
                fontSize: '14px'
              }}
            >
              {searchLoading ? '検索中...' : '検索'}
            </button>
          </div>
          
          {results.length > 0 && (
            <div>
              <h4 style={{ color: '#333', marginBottom: '12px' }}>
                検索結果 ({results.length}件)
              </h4>
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {results.map((r) => (
                  <div key={r.id} style={{ 
                    marginBottom: 16, 
                    padding: 16,
                    border: '1px solid #eee',
                    borderRadius: '4px',
                    backgroundColor: '#fafafa'
                  }}>
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between',
                      marginBottom: 8
                    }}>
                      <strong style={{ color: '#333' }}>ID: {r.id}</strong>
                      <span style={{ 
                        padding: '2px 8px',
                        backgroundColor: '#e3f2fd',
                        borderRadius: '12px',
                        fontSize: '12px',
                        color: '#1976d2'
                      }}>
                        類似度: {(r.score * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div style={{ 
                      fontSize: '14px', 
                      lineHeight: '1.5',
                      color: '#555'
                    }}>
                      {r.text.length > 300 ? r.text.substring(0, 300) + '...' : r.text}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'documents' && (
        <DocumentManager refreshTrigger={refreshTrigger} />
      )}

      {/* デモ用の手動登録機能 */}
      <div style={{
        marginTop: 40,
        padding: 20,
        backgroundColor: '#f9f9f9',
        borderRadius: '8px',
        border: '1px solid #e0e0e0'
      }}>
        <h3 style={{ margin: '0 0 16px 0' }}>📝 手動テキスト登録 (デモ用)</h3>
        <div style={{ marginBottom: 12 }}>
          <input
            type="text"
            placeholder="IDを入力 (例: demo_text_1)"
            value={docId}
            onChange={(e) => setDocId(e.target.value)}
            style={{ 
              width: '30%', 
              padding: 8, 
              marginRight: 8,
              border: '1px solid #ccc',
              borderRadius: '4px'
            }}
          />
          <input
            type="text"
            placeholder="テキストを入力..."
            value={docText}
            onChange={(e) => setDocText(e.target.value)}
            style={{ 
              width: '50%', 
              padding: 8, 
              marginRight: 8,
              border: '1px solid #ccc',
              borderRadius: '4px'
            }}
          />
          <button 
            onClick={handleUpsert}
            disabled={upsertLoading || !docId.trim() || !docText.trim()}
            style={{ 
              padding: '8px 16px',
              backgroundColor: upsertLoading ? '#ccc' : '#4caf50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: upsertLoading ? 'not-allowed' : 'pointer'
            }}
          >
            {upsertLoading ? '登録中...' : '登録'}
          </button>
        </div>
        <p style={{ fontSize: 12, color: '#666', margin: 0 }}>
          * 登録したドキュメントは即座に検索に反映されます。
        </p>
      </div>

      {/* 使い方ガイド */}
      <div style={{
        marginTop: 30,
        padding: 20,
        backgroundColor: '#e8f5e9',
        borderRadius: '8px',
        border: '1px solid #c8e6c9'
      }}>
        <h3 style={{ margin: '0 0 12px 0', color: '#2e7d32' }}>📖 使い方ガイド</h3>
        <ol style={{ margin: 0, paddingLeft: 20, color: '#1b5e20' }}>
          <li style={{ marginBottom: 8 }}>
            <strong>ファイルアップロード:</strong> PDF、テキスト、Markdownファイルをアップロードして自動的にチャンクに分割
          </li>
          <li style={{ marginBottom: 8 }}>
            <strong>RAG質問:</strong> アップロードした文書の内容について自然言語で質問
          </li>
          <li style={{ marginBottom: 8 }}>
            <strong>ベクトル検索:</strong> 意味的類似性に基づく検索を体験
          </li>
          <li style={{ marginBottom: 8 }}>
            <strong>ドキュメント管理:</strong> 登録されたドキュメントの確認・削除
          </li>
        </ol>
      </div>
    </div>
  );
}

export default App;