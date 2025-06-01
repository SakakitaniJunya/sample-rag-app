# RAG アプリケーション起動手順

## 前提条件の確認

### 1. postgresの起動
```bash
# Dockerを使用する場合
docker compose up 

### 3. バックエンドサーバーの起動
```bash
cd backend

# 依存関係のインストール（初回のみ）
npm install

# サーバーの起動
npm start
```

### 4. フロントエンドサーバーの起動
新しいターミナルウィンドウで：
```bash
cd frontend

# 依存関係のインストール（初回のみ）
npm install

# 開発サーバーの起動
npm run dev
```

## アクセス

- **フロントエンド**: http://localhost:5173
- **バックエンドAPI**: http://localhost:5001
- **Qdrant Dashboard**: http://localhost:5432/dashboard
>

### 環境変数の確認
backend/.env ファイルが正しく設定されているか確認：
```env
OPENAI_API_KEY=your_actual_api_key_here
DATABASE_URL=postgresql://postgres:password@localhost:5433/rag_db
PORT=5001
```

### 接続テスト
バックエンドが起動したら、以下のURLでテスト：
- http://localhost:5001/api/stats
- http://localhost:6333/collections
