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
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [photographers, setPhotographers] = useState([]);
  const [agents, setAgents] = useState([]);
  const [matchedAgent, setMatchedAgent] = useState(null);

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
          setForm(data);
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

  useEffect(()=>{
    // fetch photographers for the edit form (best-effort, public endpoint)
    let mounted = true;
    const fetchPhotogs = async () => {
      try {
        const base = API_BASE_DEFAULTS[0].replace(/\/$/, "");
        const res = await fetch(`${base}/photographers`);
        if (!res.ok) return;
        const arr = await res.json();
        if (!mounted) return;
        setPhotographers(arr || []);
      } catch (e) {
        // ignore
      }
    };
    fetchPhotogs();
    return ()=>{ mounted = false };
  }, []);

  useEffect(()=>{
    // fetch agents for agent contact info (best-effort)
    let mounted = true;
    const fetchAgents = async () => {
      try {
        const base = API_BASE_DEFAULTS[0].replace(/\/$/, "");
        const res = await fetch(`${base}/agents`);
        if (!res.ok) return;
        const arr = await res.json();
        if (!mounted) return;
        setAgents(arr || []);
      } catch (e) {
        // ignore
      }
    };
    fetchAgents();
    return ()=>{ mounted = false };
  }, []);

  useEffect(()=>{
    // when we have property and agents loaded, try to resolve contact info from agents table
    try {
      if (!property || !Array.isArray(agents) || agents.length === 0) return;
      // prefer agent_id if present
      if (property.agent_id) {
        const a = agents.find(x => Number(x.id) === Number(property.agent_id));
        if (a) return setMatchedAgent(a);
      }
      // fallback: match by name case-insensitive
      const name = (property.agent || '').toString().trim().toLowerCase();
      if (!name) return setMatchedAgent(null);
      const a = agents.find(x => (x.name||'').toString().trim().toLowerCase() === name);
      setMatchedAgent(a || null);
    } catch (e) {
      // ignore
    }
  }, [property, agents]);

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

  const handleEditToggle = () => {
    // initialize form from latest property snapshot
    setForm(property ? { ...property } : null);
    setIsEditing(v => !v);
  };

  const handleChange = (key, value) => {
    setForm(prev => ({ ...(prev || {}), [key]: value }));
  };

  const saveChanges = async () => {
    if (!form || !property) return;
    const token = localStorage.getItem('access_token');
    if (!token) {
      alert('You must be logged in to save changes');
      return;
    }
    setBusy(true);
    try {
      const base = API_BASE_DEFAULTS[0].replace(/\/$/, "");
      const url = `${base}/properties/${property.id}`;
      // prepare payload with only known fields
      const payload = {
        address: form.address,
        status: form.status,
        price: Number(form.price || 0),
        agent: form.agent || null,
        company: form.company || null,
        photographer_id: form.photographer_id || null,
        paid: form.paid || false,
        image_url: form.image_url || null
      };
      const res = await fetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(payload) });
      if (!res.ok) {
        const txt = await res.text().catch(()=>null);
        throw new Error(txt || `${res.status} ${res.statusText}`);
      }
      const updated = await res.json();
      setProperty(updated);
      setForm(updated);
      setIsEditing(false);
    } catch (err) {
      alert('Failed to save changes: ' + String(err?.message || err));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="p-6">Loading property...</div>;
  if (error) return <div className="p-6 text-red-500">Error: {error}</div>;
  if (!property) return <div className="p-6">Property not found.</div>;
  return (
    // Make the page fill the viewport and use flex column so the card can be pushed to the bottom
    <div className="p-6 min-h-screen flex flex-col">
      <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
          <button onClick={() => router.back()} className="px-3 py-1 bg-slate-200 dark:bg-[#1f2937] dark:text-slate-100 rounded-md">← Back</button>
          {/* Inline primary button classes (THEME not available in this component) */}
          <button onClick={handleEditToggle} className={`px-3 py-1 rounded-md bg-[#3A6353] text-white dark:bg-[#3A6353] dark:hover:bg-[#4D846F]`}>{isEditing ? 'Close' : 'Edit'}</button>
        </div>
        <div>
          <button onClick={() => { navigator.clipboard?.writeText(window.location.href) }} className="px-3 py-1 bg-slate-100 rounded-md">Copy link</button>
        </div>
      </div>

  {/* Make the card grow to fill available vertical space */}
  <div className="bg-white dark:bg-[#262626] rounded-lg p-6 shadow-sm flex flex-col flex-1 min-h-0">
        <div className="md:flex md:gap-6 h-full">
          <div className="md:w-1/2 flex-shrink-0 h-full">
            {/* Image area - fill the column height */}
            { (property.image_url || property.image || (property.images && property.images[0])) ? (
              <div className="w-full h-full overflow-hidden rounded-md mb-4">
                <img src={property.image_url || property.image || property.images[0]} alt="Listing image" className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-full h-full bg-slate-100 dark:bg-slate-800 rounded-md flex items-center justify-center text-slate-400 mb-4">No image</div>
            )}

            {isEditing && (
              <div className="space-y-2">
                <label className="text-xs text-slate-500">Image URL</label>
                <input className="w-full p-2 border rounded bg-white dark:bg-[#1f2937] dark:text-slate-100 border-slate-200 dark:border-slate-700" value={form?.image_url || ''} onChange={(e)=>handleChange('image_url', e.target.value)} />
              </div>
            )}
          </div>

          <div className="md:flex-1">
            {!isEditing ? (
              <>
                <h2 className="text-xl font-bold mb-2">{property.address}</h2>
                <div className="text-sm text-slate-600 dark:text-slate-300 mb-4">Status: <strong>{property.status}</strong></div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <div className="text-xs text-slate-500">Quoted</div>
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

                {/* Agent contact information (if available) */}
                <div className="mt-4">
                  <div className="text-xs text-slate-500">Agent</div>
                  <div className="font-medium">{property.agent || '—'}</div>
                    {matchedAgent || property.agent_email || property.agent_phone ? (
                      <div className="mt-2 text-sm space-y-1">
                        {matchedAgent && matchedAgent.email ? (
                          <div><a href={`mailto:${matchedAgent.email}`} className="text-blue-600 dark:text-blue-400 underline">{matchedAgent.email}</a></div>
                        ) : property.agent_email ? (
                          <div><a href={`mailto:${property.agent_email}`} className="text-blue-600 dark:text-blue-400 underline">{property.agent_email}</a></div>
                        ) : null}
                        {matchedAgent && matchedAgent.phone ? (
                          <div><a href={`tel:${matchedAgent.phone}`} className="text-blue-600 dark:text-blue-400 underline">{matchedAgent.phone}</a></div>
                        ) : property.agent_phone ? (
                          <div><a href={`tel:${property.agent_phone}`} className="text-blue-600 dark:text-blue-400 underline">{property.agent_phone}</a></div>
                        ) : null}
                      </div>
                    ) : (
                      <div className="mt-2 text-sm text-slate-500">No contact information available</div>
                    )}
                </div>

                <div className="mt-6 flex items-center gap-3">
                  <div className="text-sm">Paid: <strong>{property.paid ? 'Yes' : 'No'}</strong></div>
                  {!property.paid ? (
                    <button disabled={busy} onClick={() => togglePaid(true)} className="px-3 py-1 bg-green-600 text-white rounded-md">Mark as paid</button>
                  ) : (
                    <button disabled={busy} onClick={() => togglePaid(false)} className="px-3 py-1 bg-yellow-600 text-white rounded-md">Mark as unpaid</button>
                  )}
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-slate-500">Address</label>
                  <input className="w-full p-2 border rounded bg-white dark:bg-[#1f2937] dark:text-slate-100 border-slate-200 dark:border-slate-700" value={form?.address || ''} onChange={(e)=>handleChange('address', e.target.value)} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs text-slate-500">Status</label>
                    <select className="w-full p-2 border rounded bg-white dark:bg-[#1f2937] dark:text-slate-100 border-slate-200 dark:border-slate-700" value={form?.status || 'Active'} onChange={(e)=>handleChange('status', e.target.value)}>
                      <option>Active</option>
                      <option>Pending</option>
                      <option>Sold</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500">Price</label>
                    <input type="number" className="w-full p-2 border rounded bg-white dark:bg-[#1f2937] dark:text-slate-100 border-slate-200 dark:border-slate-700" value={form?.price || 0} onChange={(e)=>handleChange('price', e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500">Agent</label>
                    <input className="w-full p-2 border rounded bg-white dark:bg-[#1f2937] dark:text-slate-100 border-slate-200 dark:border-slate-700" value={form?.agent || ''} onChange={(e)=>handleChange('agent', e.target.value)} />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-slate-500">Company</label>
                    <input className="w-full p-2 border rounded bg-white dark:bg-[#1f2937] dark:text-slate-100 border-slate-200 dark:border-slate-700" value={form?.company || ''} onChange={(e)=>handleChange('company', e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500">Photographer</label>
                    <select className="w-full p-2 border rounded bg-white dark:bg-[#1f2937] dark:text-slate-100 border-slate-200 dark:border-slate-700" value={form?.photographer_id || ''} onChange={(e)=>handleChange('photographer_id', e.target.value ? Number(e.target.value) : null)}>
                      <option value="">— none —</option>
                      {photographers.map(ph => (
                        <option key={ph.id} value={ph.id}>{ph.name}{ph.company ? ` — ${ph.company}` : ''}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <label className="text-xs text-slate-500">Paid</label>
                  <input type="checkbox" checked={!!form?.paid} onChange={(e)=>handleChange('paid', e.target.checked)} />
                </div>

                <div className="flex items-center gap-3">
                  <button disabled={busy} onClick={saveChanges} className="px-3 py-2 bg-green-600 text-white rounded-md">Save</button>
                  <button disabled={busy} onClick={()=>{ setIsEditing(false); setForm(property); }} className="px-3 py-2 bg-slate-200 rounded-md">Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
