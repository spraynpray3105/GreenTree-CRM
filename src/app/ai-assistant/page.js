"use client";
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AIAssistantPage(){
  const router = useRouter();
  const ENV_API = process.env.NEXT_PUBLIC_API_BASE;
  const API_BASE_DEFAULTS = [ENV_API, "https://greentree-crm.onrender.com", "http://localhost:10000", "http://localhost:8000"].filter(Boolean);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const sendMessage = async () => {
    if (!input) return;
    const text = input;
    setMessages(prev => [...prev, { id: Date.now(), role: 'user', text }]);
    setInput('');
    setLoading(true);
    setError(null);
    try {
      // If the input looks like an address, call the existing /ai/summary endpoint as a convenience.
      const looksLikeAddress = /\d+\s+\w+/.test(text);
      if (looksLikeAddress) {
        let data = null;
        let lastErr = null;
        for (const baseRaw of API_BASE_DEFAULTS) {
          const base = baseRaw.replace(/\/$/, "");
          const url = `${base}/ai/summary?address=${encodeURIComponent(text)}`;
          try {
            const token = localStorage.getItem('access_token');
            const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
            const res = await fetch(url, { headers, credentials: 'include' });
            if (!res.ok) {
              const t = await res.text().catch(()=>null);
              throw new Error(t || `${res.status} ${res.statusText}`);
            }
            data = await res.json().catch(()=>null);
            break;
          } catch (err) {
            lastErr = err;
            console.warn('AI summary failed for', url, err);
          }
        }
        if (!data) throw lastErr || new Error('AI summary failed');
        setMessages(prev => [...prev, { id: Date.now()+1, role: 'assistant', text: data.summary || data.preview || JSON.stringify(data) }]);
      } else {
        // Free-text: call the /ai/ask endpoint on the backend (try each API base)
        let data = null;
        let lastErr = null;
        for (const baseRaw of API_BASE_DEFAULTS) {
          const base = baseRaw.replace(/\/$/, "");
          const url = `${base}/ai/ask`;
          try {
            const token = localStorage.getItem('access_token');
            const headers = token ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
            const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ question: text }), credentials: 'include' });
            if (!res.ok) {
              const t = await res.text().catch(()=>null);
              throw new Error(t || `${res.status} ${res.statusText}`);
            }
            data = await res.json().catch(()=>null);
            // attach source info if available
            data = data || {};
            data.__source = base;
            break;
          } catch (err) {
            lastErr = err;
            console.warn('AI ask failed for', url, err);
          }
        }
        if (!data) {
          const errMsg = lastErr ? String(lastErr?.message || lastErr) : 'AI ask failed';
          setMessages(prev => [...prev, { id: Date.now()+1, role: 'assistant', text: 'Error: ' + errMsg }]);
          setError(errMsg);
        } else {
          const answer = data.answer || data.result || data.response || JSON.stringify(data);
          const via = data.__source ? ` (via ${data.__source})` : '';
          setMessages(prev => [...prev, { id: Date.now()+1, role: 'assistant', text: answer + via }]);
          setError(null);
        }
      }
    } catch (err) {
      console.error('Assistant error', err);
      setError(String(err?.message || err));
      setMessages(prev => [...prev, { id: Date.now()+1, role: 'assistant', text: 'Error: ' + String(err?.message || err) }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">AI Assistant</h1>
          <div className="text-sm text-slate-500">Ask the assistant about properties or paste an address to get a summary.</div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => router.back()} className="px-3 py-1 rounded-md bg-slate-200 dark:bg-[#1f2937]">← Back</button>
        </div>
      </div>

      <div className="max-w-3xl">
        <div className="mb-4">
          <div className="space-y-2">
            <label className="text-xs text-slate-500">Message or address</label>
            <textarea value={input} onChange={(e)=>setInput(e.target.value)} placeholder="e.g. 123 Main St" className="w-full p-3 border rounded resize-none" rows={3} />
            <div className="flex items-center gap-2">
              <button disabled={loading} onClick={sendMessage} className={`px-3 py-1 rounded-md bg-green-400 text-white ${loading ? 'opacity-60 cursor-not-allowed' : 'hover:bg-green-500'}`}>{loading ? 'Working…' : 'Ask AI'}</button>
              <button onClick={() => { setMessages([]); setError(null); }} className="px-3 py-1 rounded-md border">Clear</button>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {messages.length === 0 ? (
            <div className="text-sm text-slate-500">No messages yet. Ask something or paste a property address.</div>
          ) : (
            messages.map(m => (
              <div key={m.id} className={`p-3 rounded ${m.role === 'user' ? 'bg-slate-100 text-slate-900' : 'bg-[#f3f8f7] text-slate-900'}`}>
                <div className="text-xs text-slate-500 font-medium">{m.role === 'user' ? 'You' : 'Assistant'}</div>
                <div className="mt-1 whitespace-pre-wrap">{m.text}</div>
              </div>
            ))
          )}
        </div>

        {error && <div className="mt-4 text-red-500">Error: {error}</div>}
      </div>
    </div>
  );
}
