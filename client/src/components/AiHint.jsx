import React from 'react';

export const openAiSettings = () => window.dispatchEvent(new Event('nexus:ai-settings'));
export const isAiMissing = (msg) => /AI kulcs|LLM_API_KEY/i.test(msg || '');

// Error line for AI tiles; offers a shortcut to the AI settings when no provider/key is configured.
export default function AiError({ error }) {
  if (!error) return null;
  return (
    <div className="w-error sm ai-error">
      <span>{error}</span>
      {isAiMissing(error) && (
        <button className="btn btn-primary sm" onClick={openAiSettings}>
          AI beállítása
        </button>
      )}
    </div>
  );
}
