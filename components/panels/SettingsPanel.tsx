import React, { useEffect, useState } from "react";
import { getStoredApiKey, setStoredApiKey } from "../../services/geminiService";

import useDialog from '../ui/useDialog';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ isOpen, onClose }) => {
  const dialogRef = useDialog(isOpen, onClose);
  const [apiKey, setApiKey] = useState("");
  const [status, setStatus] = useState<"idle" | "saved" | "cleared">("idle");

  useEffect(() => {
    if (!isOpen) return;
    const existing = getStoredApiKey() || "";
    setApiKey(existing);
    setStatus("idle");
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    const trimmed = apiKey.trim();
    if (!trimmed) return;
    setStoredApiKey(trimmed);
    setStatus("saved");
  };

  const handleClear = () => {
    setStoredApiKey(undefined);
    setApiKey("");
    setStatus("cleared");
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose}></div>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Settings" tabIndex={-1} className="studio-dialog relative w-[420px] max-w-[90vw] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-2xl p-5 max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Settings</h2>
          <button
            onClick={onClose}
            className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
          >
            Close
          </button>
        </div>

        <div className="space-y-2">
          <label className="text-xs text-gray-500 uppercase font-bold">Gemini API Key</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Paste your Gemini API key"
            className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded px-2 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors"
          />
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            Stored locally in your browser (localStorage). Never sent anywhere except to Gemini.
          </p>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <button
            onClick={handleClear}
            className="text-xs px-3 py-2 rounded border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/40 transition"
          >
            Clear Key
          </button>
          <div className="flex items-center space-x-2">
            {status === "saved" && (
              <span className="text-[11px] text-green-600 dark:text-green-400">Saved</span>
            )}
            {status === "cleared" && (
              <span className="text-[11px] text-gray-500 dark:text-gray-400">Cleared</span>
            )}
            <button
              onClick={handleSave}
              className="text-xs px-3 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white transition"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;
