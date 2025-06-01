
# PostgreSQL + pgvector RAGデモアプリケーション
![gamen_optimized](https://github.com/user-attachments/assets/210760a9-322c-4519-94e1-2373b0b4b23f)

本アプリケーションは、RAG（Retrieval-Augmented Generation）システムの実装例として、PostgreSQL + pgvectorを使用したベクトル検索とAI回答生成の一連の流れを体験できるサンプルアプリです。

## 🌟 主要機能

### 📁 ファイルアップロード機能
- **対応形式**: PDF、テキストファイル (.txt)、Markdown (.md)
- **自動チャンキング**: 長い文書を意味のある単位で自動分割
- **メタデータ管理**: ファイル名、種別、アップロード日時などの情報をJSONBで保存

### 🤖 RAG質問システム
- **自然言語質問**: アップロードした文書について自然言語で質問
- **コンテキスト検索**: 質問に関連する文書をベクトル類似度で自動検索
- **根拠付き回答**: 回答の根拠となるソース文書を表示
- **応答時間表示**: 処理時間とトークン使用量を表示

### 🔍 ベクトル検索機能
- **意味的検索**: キーワードマッチングではなく、意味的類似性で検索
- **類似度スコア**: 各検索結果の類似度を数値で表示
- **高速検索**: HNSWインデックスによる高速ベクトル検索

### 📚 ドキュメント管理
- **一覧表示**: 登録済みドキュメントをファイル別にグループ化表示
- **メタデータ表示**: ファイル種別、チャンク番号、登録日時などの詳細情報
- **削除機能**: 個別またはバッチでのドキュメント削除

### 📊 システム統計
- **リアルタイム統計**: 登録ドキュメント数、ベクトル数などの状況表示
- **ファイル種別統計**: アップロードされたファイルの種類別集計
- **データベース状態**: PostgreSQLの健全性監視

## 🏗️ 技術スタック

### バックエンド
- **Runtime**: Node.js + TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL 16 + pgvector
- **Embeddings**: OpenAI text-embedding-3-small
- **LLM**: OpenAI GPT-4
- **File Processing**: pdf-parse, multer

### フロントエンド
- **Framework**: React + TypeScript
- **Build Tool**: Vite
- **Styling**: Inline CSS (no external dependencies)
- **HTTP Client**: Axios

### データベース
- **RDBMS**: PostgreSQL 16
- **Vector Extension**: pgvector
- **Vector Index**: HNSW (Hierarchical Navigable Small World)
- **Distance Metric**: Cosine Similarity

## 📋 セットアップ手順

### 前提条件
- Docker & Docker Compose
- Node.js (v18以上)
- OpenAI API キー

### 1. リポジトリのクローン
```bash
git clone <repository-url>
cd sample-rag-app
```

### 2. 環境変数の設定

バックエンドディレクトリに`.env`ファイルを作成します：

```bash
cd backend

# .envファイルを作成
cat > .env << EOF
DATABASE_URL=postgresql://postgres:password@localhost:5433/rag_db
OPENAI_API_KEY=your_openai_api_key_here
PORT=5001
EOF
```

**重要**: `OPENAI_API_KEY`を実際のAPIキーに置き換えてください。

### 3. PostgreSQLサーバーの起動
```bash
# プロジェクトルートディレクトリに戻る
cd ..

# Docker Composeを使用してPostgreSQL + pgvectorを起動
docker-compose up -d

# 起動確認
docker-compose ps
```

### 4. バックエンドのセットアップ
```bash
cd backend

# 依存関係のインストール
npm install

# サーバーの起動
npm start
```

初回起動時にデータベースとテーブルが自動的に作成されます。

### 5. フロントエンドのセットアップ
```bash
# 新しいターミナルウィンドウで
cd frontend

# 依存関係のインストール
npm install

# 開発サーバーの起動
npm run dev
```

### 6. アプリケーションへのアクセス
- フロントエンド: http://localhost:5173
- バックエンドAPI: http://localhost:5001
- PostgreSQL: localhost:5433

## 🚀 使い方

### ステップ1: ファイルアップロード
1. 「📁 ファイルアップロード」タブを選択
2. PDF、テキスト、またはMarkdownファイルをアップロード
3. ファイルが自動的にチャンクに分割され、ベクトル化されて保存されます

### ステップ2: RAG質問
1. 「🤖 RAG質問」タブを選択
2. アップロードした文書の内容について質問を入力
3. AIが関連する文書を検索し、根拠付きで回答を生成します

### ステップ3: ベクトル検索体験
1. 「🔍 ベクトル検索」タブを選択
2. 検索キーワードを入力
3. 意味的に類似した文書が類似度スコア付きで表示されます

### ステップ4: ドキュメント管理
1. 「📚 ドキュメント管理」タブを選択
2. 登録済みドキュメントの確認・削除が可能です

## 📡 API エンドポイント

### ファイル操作
- `POST /api/upload` - ファイルアップロードとチャンキング
- `GET /api/documents` - ドキュメント一覧取得
- `DELETE /api/documents/:id` - ドキュメント削除

### 検索・RAG
- `GET /api/search` - ベクトル検索
- `POST /api/ask` - RAG質問回答
- `POST /api/upsert` - 手動ドキュメント登録

### システム情報
- `GET /api/stats` - システム統計情報

## 🔧 設定ファイル

### 環境変数設定 (.env)
```env
DATABASE_URL=postgresql://postgres:password@localhost:5433/rag_db
OPENAI_API_KEY=your_openai_api_key_here
PORT=5001
```

### サポートファイル形式
- **PDF**: application/pdf
- **テキスト**: text/plain
- **Markdown**: text/markdown

### ファイルサイズ制限
- 最大ファイルサイズ: 10MB
- チャンクサイズ: 1500文字（オーバーラップ150文字）

## 🛠️ カスタマイズ

### チャンキング設定の変更
`backend/src/fileProcessor.ts` の `chunkText` 関数でパラメータを調整:
```typescript
const chunks = chunkText(extractedText, 1500, 150); // (テキスト, サイズ, オーバーラップ)
```

### 検索結果数の変更
デフォルトは5件ですが、APIリクエストの `k` パラメータで調整可能:
```typescript
const results = await search(query, 10); // 10件取得
```

### プロンプトのカスタマイズ
`backend/src/ragService.ts` の `generateRAGAnswer` 関数でプロンプトを調整可能

## 📚 学習リソース

このアプリケーションで学べる概念:

1. **RAGアーキテクチャ**: 検索拡張生成の仕組み
2. **ベクトル検索**: 意味的類似性に基づく検索
3. **チャンキング戦略**: 長文書の効果的な分割手法
4. **埋め込み（Embeddings）**: テキストのベクトル化
5. **プロンプトエンジニアリング**: 効果的なAI回答生成

## 🐛 トラブルシューティング

### よくある問題

**PostgreSQLに接続できない**
- Dockerコンテナが起動しているか確認: `docker-compose ps`
- ポート5433が他のアプリケーションで使用されていないか確認
- DATABASE_URLのポート番号が5433になっているか確認

**ファイルアップロードが失敗する**
- ファイルサイズが10MB以下か確認
- サポートされているファイル形式か確認
- uploadsディレクトリが作成されているか確認

**OpenAI API エラー**
- API キーが正しく設定されているか確認
- API使用量制限に達していないか確認
- インターネット接続を確認

**pgvector拡張が見つからない**
- pgvector対応のPostgreSQLイメージを使用しているか確認
- `docker-compose.yml`で`pgvector/pgvector:pg16`イメージを指定しているか確認

## 📄 ライセンス

このプロジェクトはMITライセンスの下で公開されています。
