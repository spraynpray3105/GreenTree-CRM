"use client";
import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AssistantPage() {
  const router = useRouter();
  const [messages, setMessages] = useState([
    { role: 'system', text: 'AI Assistant — ask questions about your agents and properties.' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const scroller = useRef(null);

  useEffect(() => {
    // autoscroll
    if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight;
  }, [messages]);

  const append = (m) => setMessages((s) => [...s, m]);

  const makeLocalAnswer = async (q) => {
    // lightweight fallback: try to fetch agents and properties to answer simple queries
    try {
      const [agsRes, propsRes] = await Promise.all([
        fetch('/agents').then(r => r.ok ? r.json() : []),
        fetch('/properties').then(r => r.ok ? r.json() : []),
      ]);
      const ql = q.toLowerCase();
      if (ql.includes('agent') || ql.includes('agents')) {
        if (Array.isArray(agsRes) && agsRes.length) {
          const lines = agsRes.slice(0, 8).map(a => `${a.name}${a.email ? ` — ${a.email}` : ''}${a.phone ? ` — ${a.phone}` : ''}`);
          return `Agents found (${agsRes.length}):\n` + lines.join('\n');
        }
        return 'No agents found in local data.';
      }
      if (ql.includes('property') || ql.includes('listing') || ql.includes('address')) {
        if (Array.isArray(propsRes) && propsRes.length) {
          const lines = propsRes.slice(0, 8).map(p => `${p.address}${p.status ? ` — ${p.status}` : ''}`);
          return `Properties (${propsRes.length}):\n` + lines.join('\n');
        }
        return 'No properties found in local data.';
      }
      // default fallback
      return "AI backend unavailable. Try: 'list agents' or 'list properties', or ask about a specific address or agent.";
    } catch (err) {
      return "AI backend unavailable and local fallback failed.";
    }
  };

  const send = async () => {
    const q = input.trim();
    if (!q) return;
    append({ role: 'user', text: q });
    setInput('');
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/ai/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      });
      if (!res.ok) throw new Error('AI backend error');
      const data = await res.json();
      const text = data?.answer || data?.response || data?.text || JSON.stringify(data);
      append({ role: 'assistant', text });
    } catch (err) {
      // fallback local synthesizer
      const local = await makeLocalAnswer(q);
      append({ role: 'assistant', text: local });
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const clear = () => setMessages([{ role: 'system', text: 'AI Assistant — ask questions about your agents and properties.' }]);

  return (
    <div className="p-6 md:p-10">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">AI Assistant</h1>
            <p className="text-sm text-slate-500">Ask questions about your agents and properties. Uses the AI backend when available.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => router.push('/')} className="px-3 py-2 bg-slate-100 rounded-md">Back</button>
            <button onClick={clear} className="px-3 py-2 bg-slate-100 rounded-md">New convo</button>
          </div>
        </div>

        <div ref={scroller} className="border rounded-lg p-4 h-[60vh] overflow-y-auto bg-white dark:bg-[#262626]">
          {messages.map((m, i) => (
            <div key={i} className={`mb-4 ${m.role === 'user' ? '' : 'text-slate-700 dark:text-slate-200'}`}>
              <div className="text-xs text-slate-400 mb-1">{m.role === 'user' ? 'You' : m.role === 'system' ? 'System' : 'Assistant'}</div>
              <div className={`whitespace-pre-wrap bg-${m.role === 'user' ? 'green-50' : 'slate-50'} p-3 rounded`}>{m.text}</div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex gap-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask something about your listings or agents..."
            className="flex-1 p-3 rounded-md border resize-none h-20"
          />
          <div className="flex flex-col gap-2">
            <button onClick={send} disabled={loading} className="px-4 py-2 bg-green-400 text-white rounded-md">{loading ? 'Thinking…' : 'Send'}</button>
            <button onClick={() => { setInput(''); }} className="px-4 py-2 bg-slate-100 rounded-md">Clear</button>
          </div>
        </div>
        {error && <div className="mt-3 text-sm text-red-500">{error}</div>}
      </div>
    </div>
  );
}
