"use client";
import React, { useState } from 'react';
import { Home, DollarSign, Mail, Search, CheckCircle } from 'lucide-react';

export default function Dashboard() {
  // 1. Mock Data (Later this will come from your Python Backend)
  const [properties] = useState([
    { id: 1, address: "123 Maple Ave", status: "Active", price: 450, agent: "Sarah Smith" },
    { id: 2, address: "888 Ocean Blvd", status: "Sold", price: 600, agent: "John Doe" },
    { id: 3, address: "45 Pine St", status: "Pending", price: 350, agent: "Sarah Smith" },
  ]);

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      
      {/* SIDEBAR */}
      <aside className="w-64 bg-white border-r p-6 space-y-8">
        <h1 className="text-xl font-bold text-blue-600 flex items-center gap-2">
          <Home size={24} /> Green Tree CRM
        </h1>
        <nav className="space-y-4">
          <a href="#" className="flex items-center gap-3 text-blue-600 font-medium"><Home size={20}/> Dashboard</a>
          <a href="#" className="flex items-center gap-3 text-slate-500 hover:text-blue-600"><Search size={20}/> Property Watcher</a>
          <a href="#" className="flex items-center gap-3 text-slate-500 hover:text-blue-600"><DollarSign size={20}/> Billing</a>
        </nav>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 p-10">
        <header className="flex justify-between items-center mb-10">
          <div>
            <h2 className="text-3xl font-bold">Main Dashboard</h2>
            <p className="text-slate-500">Welcome back, here is your escrow status.</p>
          </div>
          <button className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition">
            + Add Customer
          </button>
        </header>

        {/* TOP STATS CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <p className="text-slate-500 text-sm font-semibold">TOTAL IN ESCROW</p>
            <p className="text-3xl font-bold mt-2">$1,400.00</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 border-l-4 border-l-green-500">
            <p className="text-slate-500 text-sm font-semibold text-green-600">READY TO BILL (SOLD)</p>
            <p className="text-3xl font-bold mt-2">$600.00</p>
          </div>
        </div>

        {/* PROPERTY LIST TABLE */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b">
            <h3 className="font-bold text-lg">Active Watchlist</h3>
          </div>
          <table className="w-full">
            <thead className="bg-slate-50 text-slate-500 text-sm">
              <tr>
                <th className="p-4 text-left font-medium">Property Address</th>
                <th className="p-4 text-left font-medium">Agent</th>
                <th className="p-4 text-left font-medium">Status</th>
                <th className="p-4 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {properties.map((prop) => (
                <tr key={prop.id} className="hover:bg-slate-50 transition">
                  <td className="p-4 font-medium">{prop.address}</td>
                  <td className="p-4 text-slate-600">{prop.agent}</td>
                  <td className="p-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      prop.status === 'Sold' ? 'bg-green-100 text-green-700' : 
                      prop.status === 'Pending' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {prop.status}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    {prop.status === 'Sold' ? (
                      <button className="flex items-center gap-2 bg-green-600 text-white px-4 py-1.5 rounded-md text-sm ml-auto hover:bg-green-700">
                        <Mail size={16}/> Email Escrow
                      </button>
                    ) : (
                      <button className="text-slate-400 hover:text-slate-600 text-sm">Monitor</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}