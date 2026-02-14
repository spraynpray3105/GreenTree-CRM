"use client";
import React, { useState, useEffect } from 'react';
import { Home, DollarSign, Mail, Search, Moon, Sun } from 'lucide-react';

export default function Dashboard() {
  const [darkMode, setDarkMode] = useState(false);
  const [expandedIds, setExpandedIds] = useState([]); // <-- new: track expanded rows
  const [properties] = useState([
    { id: 1, address: "123 Maple Ave", status: "Active", price: 450, agent: "Sarah Smith" },
    { id: 2, address: "888 Ocean Blvd", status: "Sold", price: 600, agent: "John Doe" },
    { id: 3, address: "45 Pine St", status: "Pending", price: 350, agent: "Sarah Smith" },
  ]);

  // Toggle function
  const toggleDarkMode = () => setDarkMode(!darkMode);

  // Toggle expanded details for a property
  const toggleExpand = (id) => {
    setExpandedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleEmailEscrow = (e, prop) => {
    e.stopPropagation();
    // TODO: replace with real email logic
    alert(`Emailing escrow for ${prop.address}`);
  };

  return (
    // This wrapper div now switches classes based on darkMode state
    <div className={`${darkMode ? 'dark' : ''}`}>
      <div className="flex min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 transition-colors duration-300">
        
        {/* SIDEBAR */}
        <aside className="w-64 bg-white dark:bg-slate-800 border-r dark:border-slate-700 p-6 space-y-8">
          <h1 className="text-xl font-bold text-blue-600 dark:text-blue-400 flex items-center gap-2">
            <Home size={24} /> Green Tree
          </h1>
          <nav className="space-y-4">
            <a href="#" className="flex items-center gap-3 text-blue-600 dark:text-blue-400 font-medium"><Home size={20}/> Dashboard</a>
            <a href="#" className="flex items-center gap-3 text-slate-500 dark:text-slate-400 hover:text-blue-600"><Search size={20}/> Watcher</a>
            
            {/* DARK MODE TOGGLE BUTTON */}
            <button 
              onClick={toggleDarkMode}
              className="flex items-center gap-3 w-full text-slate-500 dark:text-slate-400 hover:text-blue-600 transition"
            >
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
              {darkMode ? 'Light Mode' : 'Dark Mode'}
            </button>
          </nav>
        </aside>

        {/* MAIN CONTENT */}
        <main className="flex-1 p-10">
          <header className="flex justify-between items-center mb-10">
            <div>
              <h2 className="text-3xl font-bold">Main Dashboard</h2>
              <p className="text-slate-500 dark:text-slate-400">Manage your real estate photography escrow.</p>
            </div>
            <button className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700">
              + Add New Shoot
            </button>
          </header>

          {/* STATS CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
              <p className="text-slate-500 dark:text-slate-400 text-sm font-semibold text-green-600">READY TO BILL</p>
              <p className="text-3xl font-bold mt-2">$600.00</p>
            </div>
          </div>

          {/* TABLE */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 text-sm">
                <tr>
                  <th className="p-4 text-left font-medium">Address</th>
                  <th className="p-4 text-left font-medium">Status</th>
                  <th className="p-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-slate-700">
                {properties.map((prop) => (
                  <React.Fragment key={prop.id}>
                    <tr
                      onClick={() => toggleExpand(prop.id)}
                      className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition cursor-pointer"
                      aria-expanded={expandedIds.includes(prop.id)}
                    >
                      <td className="p-4 font-medium">{prop.address}</td>
                      <td className="p-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          prop.status === 'Sold' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                        }`}>
                          {prop.status}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        {prop.status === 'Sold' && (
                          <button
                            onClick={(e) => handleEmailEscrow(e, prop)}
                            className="bg-green-600 text-white px-4 py-1 rounded-md text-sm"
                          >
                            Email Escrow
                          </button>
                        )}
                      </td>
                    </tr>

                    {/* DETAILS ROW */}
                    {expandedIds.includes(prop.id) && (
                      <tr key={`${prop.id}-details`} className="bg-slate-50 dark:bg-slate-800">
                        <td colSpan="3" className="p-4 text-sm text-slate-700 dark:text-slate-300">
                          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                            <div>
                              <p className="text-xs text-slate-500 dark:text-slate-400">Price</p>
                              <p className="font-medium">${prop.price.toFixed(2)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500 dark:text-slate-400">Agent</p>
                              <p className="font-medium">{prop.agent}</p>
                            </div>
                            <div className="flex items-center gap-3">
                              <button
                                onClick={(e) => { e.stopPropagation(); /* TODO: view details */ }}
                                className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm"
                              >
                                View
                              </button>
                              <button
                                onClick={(e) => handleEmailEscrow(e, prop)}
                                className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-md text-sm flex items-center gap-2"
                              >
                                <Mail size={16} /> Email Escrow
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </div>
  );
}