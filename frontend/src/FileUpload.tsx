import React, { useState } from 'react';
import { uploadFile } from './api';

interface FileUploadProps {
  onUploadSuccess: (result: any) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onUploadSuccess }) => {
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<string>('');
  const [error, setError] = useState<string>('');

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // サポートされているファイル形式をチェック
    const supportedTypes = ['application/pdf', 'text/plain', 'text/markdown'];
    if (!supportedTypes.includes(file.type)) {
      setError('サポートされていないファイル形式です。PDF、テキストファイル、Markdownファイルのみサポートしています。');
      return;
    }

    // ファイルサイズチェック（10MB）
    if (file.size > 10 * 1024 * 1024) {
      setError('ファイルサイズが大きすぎます。10MB以下のファイルを選択してください。');
      return;
    }

    setUploading(true);
    setError('');
    setUploadResult('');

    try {
      console.log('📤 ファイルをアップロード中...', file.name);
      const result = await uploadFile(file);
      
      setUploadResult(
        `✅ ${result.filename} を ${result.totalChunks} チャンクに分割して登録しました`
      );
      
      onUploadSuccess(result);
      
      // ファイル入力をリセット
      event.target.value = '';
    } catch (error: any) {
      console.error('Upload error:', error);
      setError(
        `❌ アップロードに失敗しました: ${error.response?.data?.error || error.message}`
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ 
      border: '2px dashed #ccc', 
      borderRadius: '8px', 
      padding: '20px', 
      margin: '16px 0',
      textAlign: 'center',
      backgroundColor: '#fafafa'
    }}>
      <h3 style={{ margin: '0 0 16px 0' }}>📁 ファイルアップロード</h3>
      
      <input
        type="file"
        accept=".pdf,.txt,.md"
        onChange={handleFileUpload}
        disabled={uploading}
        style={{
          margin: '8px',
          padding: '8px',
          borderRadius: '4px',
          border: '1px solid #ccc'
        }}
      />
      
      <div style={{ marginTop: '12px', fontSize: '14px', color: '#666' }}>
        サポート形式: PDF, テキスト (.txt), Markdown (.md)
        <br />
        最大ファイルサイズ: 10MB
      </div>
      
      {uploading && (
        <div style={{ 
          marginTop: '12px', 
          padding: '8px', 
          backgroundColor: '#e3f2fd',
          borderRadius: '4px',
          color: '#1976d2'
        }}>
          📤 処理中... ファイルを読み込んでチャンクに分割しています
        </div>
      )}
      
      {uploadResult && (
        <div style={{ 
          marginTop: '12px', 
          padding: '8px', 
          backgroundColor: '#e8f5e8',
          borderRadius: '4px',
          color: '#2e7d32'
        }}>
          {uploadResult}
        </div>
      )}
      
      {error && (
        <div style={{ 
          marginTop: '12px', 
          padding: '8px', 
          backgroundColor: '#ffebee',
          borderRadius: '4px',
          color: '#c62828'
        }}>
          {error}
        </div>
      )}
    </div>
  );
};

export default FileUpload;
