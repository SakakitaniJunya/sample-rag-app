# ベクトル検索とRAG作成サンプルアプリ

## システム構成

```mermaid
flowchart LR
    FE[フロントエンド<br/>React + TypeScript + Vite]
    BE[バックエンド<br/>Node.js + Express.js + TypeScript]
    DB[(PostgreSQL16＋pgvector<br/>HNSWインデックス)]
    OA((OpenAI<br/>Embeddings & GPT-4))
    FE --> BE
    BE --> DB
    BE --> OA
```

## 🚀 起動手順

> **前提**: Docker（Compose）、Node.js、OpenAI API キー を用意済みとする

1. **リポジトリをクローン**

   ```bash
   git clone <repository-url>
   cd sample-rag-app
   ```

2. **環境変数を設定**

   * **バックエンド**

     ```bash
     cd backend
     cat > .env << EOF
     DATABASE_URL=postgresql://postgres:password@localhost:5433/rag_db
     OPENAI_API_KEY=your_openai_api_key
     PORT=5001
     EOF
     ```

3. **PostgreSQL＋pgvector を立ち上げ**

   ```bash
   cd ..
   docker-compose up -d
   docker-compose ps   # 正常起動を確認
   ```

4. **バックエンドを起動**

   ```bash
   cd backend
   npm install
   npm start           # または npm run dev
   ```

5. **フロントエンドを起動**

   ```bash
   # 別ターミナルで
   cd frontend
   npm install
   npm run dev
   ```

6. **ブラウザでアクセス**

   * フロントエンド → [http://localhost:5173](http://localhost:5173)
   * バックエンド API → [http://localhost:5001](http://localhost:5001)

---

## 📑 設計書（概要）

### 1. システム全体構成

```
[フロントエンド] ←→ [バックエンドAPI] ←→ [PostgreSQL＋pgvector]
                         ↓
                    [OpenAI API]
```

* **フロントエンド**

  * React + TypeScript + Vite
  * Axios で API 呼び出し
* **バックエンド**

  * Node.js + TypeScript + Express.js
  * ファイル受け取り → チャンク化 → pgvector 登録
  * RAG 質問 → ベクトル検索 → OpenAI 呼び出し
* **データベース**

  * PostgreSQL 16
  * pgvector 拡張（HNSW インデックス）
* **外部サービス**

  * OpenAI Embedding（text-embedding-3-small）
  * OpenAI GPT-4（回答生成）

---

### 2. 主要機能とデータフロー

| 機能         | 説明                                                     | フロー概要                                  |
| ---------- | ------------------------------------------------------ | -------------------------------------- |
| ファイルアップロード | PDF/TXT/MD を受け取り、自動で意味に沿ったチャンクに分割し、メタデータとともに JSONB で保存 | クライアント → `/api/upload` → DB登録          |
| ベクトル検索     | チャンク文本体を埋め込み化し、pgvector で類似度検索                         | `/api/search?query=` → pgvector → 結果返却 |
| RAG 質問     | 質問文を埋め込み化 → 類似チャンク検索 → GPT-4 にプロンプト送信 → 根拠付き回答を返却      | `/api/ask` → 検索 → GPT-4 → 回答表示         |
| ドキュメント管理   | 登録済ドキュメント一覧表示・個別／一括削除                                  | `/api/documents` → 表示・削除               |
| システム統計     | 登録件数・ベクトル数・検索速度などのリアルタイム統計                             | `/api/stats` → ダッシュボードに表示              |

---

### 3. 技術スタック

* **バックエンド**

  * Node.js 18+ / TypeScript / Express.js
  * pdf-parse, multer（ファイル処理）
* **フロントエンド**

  * React / TypeScript / Vite
  * Inline CSS, Axios
* **DB・検索**

  * PostgreSQL 16 + pgvector
  * HNSW インデックス, Cosine 類似度
* **AI**

  * OpenAI text-embedding-3-small, GPT-4

---

### ⚙️ カスタマイズポイント

* **チャンク設定**
  `backend/src/fileProcessor.ts` の `chunkText(text, size, overlap)` を調整
* **検索件数**
  API リクエスト時の `k` パラメータで変更可能
* **プロンプト編集**
  `backend/src/ragService.ts` の `generateRAGAnswer` 関数を編集
