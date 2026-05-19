// E:\md2word-converter\frontend\src\components\ConfigModal.tsx
import React, { useState, useEffect } from 'react';

interface ConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUrl: string;
  onSave: (url: string) => void;
}

export const ConfigModal: React.FC<ConfigModalProps> = ({
  isOpen,
  onClose,
  currentUrl,
  onSave,
}) => {
  const [url, setUrl] = useState(currentUrl);

  useEffect(() => {
    setUrl(currentUrl);
  }, [currentUrl]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(url);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>配置 Mermaid 渲染服务</h2>
        <label htmlFor="mermaid-url">渲染服务地址</label>
        <input
          id="mermaid-url"
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/render"
        />
        <div className="modal-actions">
          <button onClick={onClose}>取消</button>
          <button onClick={handleSave}>保存</button>
        </div>
      </div>
    </div>
  );
};