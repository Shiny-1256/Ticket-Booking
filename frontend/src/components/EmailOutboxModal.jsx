import React, { useEffect, useState } from 'react';
import { Mail, X, RefreshCw, Eye } from 'lucide-react';
import { apiRequest } from '../api/client.js';

export default function EmailOutboxModal({ isOpen, onClose }) {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState(null);

  const fetchEmails = async () => {
    setLoading(true);
    try {
      const data = await apiRequest('/emails');
      setEmails(data.emailLogs || []);
      if (data.emailLogs && data.emailLogs.length > 0 && !selectedEmail) {
        setSelectedEmail(data.emailLogs[0]);
      }
    } catch (err) {
      console.error('Failed to fetch email logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchEmails();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-slate-900 border border-slate-750 w-full max-w-5xl h-[85vh] rounded-2xl flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">Simulated Email Outbox & QR Inspector</h2>
              <p className="text-xs text-slate-400">View real-time generated ticket emails and waitlist notifications</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={fetchEmails}
              className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition"
              title="Refresh Emails"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Email List Sidebar */}
          <div className="w-1/3 border-r border-slate-800 bg-slate-950/50 overflow-y-auto p-3 space-y-2">
            {emails.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-sm">
                No emails dispatched yet. Book a seat to generate a ticket!
              </div>
            ) : (
              emails.map((email) => (
                <div
                  key={email.id}
                  onClick={() => setSelectedEmail(email)}
                  className={`p-3 rounded-xl cursor-pointer border transition ${
                    selectedEmail?.id === email.id
                      ? 'bg-indigo-600/20 border-indigo-500 text-white'
                      : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-semibold text-indigo-400 truncate max-w-[180px]">{email.recipient}</span>
                    <span className="text-[10px] text-slate-500">{new Date(email.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <h4 className="text-sm font-medium text-slate-200 mt-1 line-clamp-1">{email.subject}</h4>
                </div>
              ))
            )}
          </div>

          {/* Email Preview Frame */}
          <div className="w-2/3 flex flex-col bg-slate-950 p-4">
            {selectedEmail ? (
              <div className="h-full flex flex-col">
                <div className="mb-3 pb-3 border-b border-slate-800">
                  <div className="text-xs text-slate-400">To: <span className="text-slate-200 font-semibold">{selectedEmail.recipient}</span></div>
                  <div className="text-xs text-slate-400 mt-1">Subject: <span className="text-indigo-300 font-semibold">{selectedEmail.subject}</span></div>
                  <div className="text-[10px] text-slate-500 mt-1">Sent: {new Date(selectedEmail.sent_at).toLocaleString()}</div>
                </div>

                <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                  <iframe
                    title="Email Render"
                    srcDoc={selectedEmail.body_html}
                    className="w-full h-full border-none"
                  />
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                Select an email from the left sidebar to preview its HTML body & QR ticket code.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
