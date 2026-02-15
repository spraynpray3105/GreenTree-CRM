"use client";
import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function PropertyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id;

  const ENV_API = process.env.NEXT_PUBLIC_API_BASE;
  const API_BASE_DEFAULTS = [ENV_API, "https://greentree-crm.onrender.com", "http://localhost:10000", "http://localhost:8000"].filter(Boolean);

  const [loading, setLoading] = useState(true);
  const [property, setProperty] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let mounted = true;
    const fetchProperty = async () => {
      setLoading(true);
      setError(null);
      let lastErr = null;
      for (const base of API_BASE_DEFAULTS) {
        const url = `${base.replace(/\/$/, "")}/properties/${id}`;
        try {
          const token = localStorage.getItem('access_token');
          const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
          const res = await fetch(url, { headers });
          if (!res.ok) {
            lastErr = new Error(`${res.status} ${res.statusText}`);
            continue;
          }
          const data = await res.json();
          if (!mounted) return;
          setProperty(data);
          setLoading(false);
          return;
        } catch (err) {
          lastErr = err;
        }
      }
      setLoading(false);
      setError(lastErr ? String(lastErr?.message || lastErr) : 'Failed to load property');
    };
    if (id) fetchProperty();
    return () => { mounted = false; };
  }, [id]);

  const togglePaid = async (setTo) => {
    if (!property) return;
    const token = localStorage.getItem('access_token');
    if (!token) {
      alert('You must be logged in to change paid status');
      return;
    }
    setBusy(true);
    try {
      const url = `${API_BASE_DEFAULTS[0].replace(/\/$/, "")}/properties/${property.id}/paid`;
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ paid: !!setTo }) });
      if (!res.ok) {
        const txt = await res.text().catch(()=>null);
        throw new Error(txt || `${res.status} ${res.statusText}`);
      }
      const data = await res.json();
      setProperty(prev => ({ ...(prev || {}), paid: data.paid }));
    } catch (err) {
      alert('Failed to update paid status: ' + String(err?.message || err));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="p-6">Loading property...</div>;
  if (error) return <div className="p-6 text-red-500">Error: {error}</div>;
  if (!property) return <div className="p-6">Property not found.</div>;

  return (
    <div className="p-6">
      <div className="mb-4">
        <button onClick={() => router.back()} className="px-3 py-1 bg-slate-200 rounded-md">← Back</button>
      </div>

      <div className="bg-white dark:bg-[#262626] rounded-lg p-6 shadow-sm">
        <h2 className="text-xl font-bold mb-2">{property.address}</h2>
        <div className="text-sm text-slate-600 dark:text-slate-300 mb-4">Status: <strong>{property.status}</strong></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <div className="text-xs text-slate-500">Price</div>
            <div className="font-medium">${Number(property.price || 0).toFixed(2)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Agent</div>
            <div className="font-medium">{property.agent || '—'}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Company</div>
            <div className="font-medium">{property.company || '—'}</div>
          </div>
        </div>

        <div className="mt-4">
          <div className="text-xs text-slate-500">Photographer</div>
          <div className="font-medium">{property.photographer ? (property.photographer.name || property.photographer) : (property.photographer_id ? `#${property.photographer_id}` : '—')}</div>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <div className="text-sm">Paid: <strong>{property.paid ? 'Yes' : 'No'}</strong></div>
          {!property.paid ? (
            <button disabled={busy} onClick={() => togglePaid(true)} className="px-3 py-1 bg-green-600 text-white rounded-md">Mark as paid</button>
          ) : (
            <button disabled={busy} onClick={() => togglePaid(false)} className="px-3 py-1 bg-yellow-600 text-white rounded-md">Mark as unpaid</button>
          )}
        </div>
      </div>
    </div>
  );
}
