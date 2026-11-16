'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { formatKz, TX_META } from '@/lib/utils';

const QPayContext = createContext(null);

export function QPayProvider({ children }) {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [toasts, setToasts] = useState([]);
  const [receiptTx, setReceiptTx] = useState(null);
  const [showDownloadOptions, setShowDownloadOptions] = useState(false);

  const showToast = useCallback((msg, type = 'info', ms = 3200) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, msg, type, leaving: false }]);
    setTimeout(() => {
      setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 350);
    }, ms);
  }, []);

  const refreshUser = useCallback(async (uidOverride) => {
    const uid = uidOverride || (typeof window !== 'undefined' ? localStorage.getItem('qpay_uid') : null);
    if (!uid) {
      setUser(null);
      setLoadingAuth(false);
      return null;
    }
    try {
      const res = await fetch(`/api/users/${uid}`, { cache: 'no-store' });
      const data = await res.json();
      if (data.success && data.user) {
        setUser(data.user);
        setLoadingAuth(false);
        return data.user;
      } else {
        localStorage.removeItem('qpay_uid');
        setUser(null);
        setLoadingAuth(false);
        return null;
      }
    } catch {
      setLoadingAuth(false);
      return null;
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const loginUser = useCallback((u) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('qpay_uid', u.id);
    }
    setUser(u);
  }, []);

  const logout = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('qpay_uid');
    }
    setUser(null);
    router.push('/');
  }, [router]);

  const viewTransactionReceipt = useCallback((tx) => {
    setShowDownloadOptions(false);
    setReceiptTx(tx);
  }, []);

  const downloadReceiptImage = async (tx) => {
    const el = document.getElementById(`receipt-content-${tx.id}`);
    if (!el) return;
    showToast('A gerar imagem...', 'success');
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff' });
      const link = document.createElement('a');
      link.download = `Comprovativo_QPAY_${tx.id}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (e) {
      console.error(e);
      showToast('Erro ao gerar imagem', 'error');
    }
  };

  const downloadReceiptPDF = async (tx) => {
    const el = document.getElementById(`receipt-content-${tx.id}`);
    if (!el) return;
    showToast('A gerar PDF...', 'success');
    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');
      const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: [canvas.width / 2, canvas.height / 2],
      });
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width / 2, canvas.height / 2);
      pdf.save(`Comprovativo_QPAY_${tx.id}.pdf`);
    } catch (e) {
      console.error(e);
      showToast('Erro ao gerar PDF', 'error');
    }
  };

  const shareReceipt = async (tx) => {
    const txt = `✅ Comprovativo QPAY AO\nValor: ${formatKz(tx.amount)}\nDescrição: ${tx.description}\nData: ${new Date(tx.timestamp).toLocaleString('pt-AO')}\nRef: ${tx.id}\n\n🟢 QPAY AO`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Comprovativo QPAY AO', text: txt });
        return;
      } catch (_) {}
    }
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(txt).catch(() => {});
      showToast('Comprovativo copiado!', 'success');
    }
  };

  const meta = receiptTx ? TX_META[receiptTx.type] || TX_META.deposit : null;

  return (
    <QPayContext.Provider
      value={{
        user,
        setUser,
        loadingAuth,
        refreshUser,
        loginUser,
        logout,
        showToast,
        viewTransactionReceipt,
      }}
    >
      {children}

      {/* TOAST CONTAINER */}
      <div className="toast-wrap" id="toast-wrap">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`toast t-${t.type === 'error' ? 'error' : t.type === 'success' ? 'success' : 'info'} ${
              t.leaving ? 'toast-leave' : ''
            }`}
          >
            {t.type === 'success' && (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--success)' }}>
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
            {t.type === 'error' && (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--danger)' }}>
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            )}
            {t.type !== 'success' && t.type !== 'error' && (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--info)' }}>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            )}
            <span className="toast-msg">{t.msg}</span>
          </div>
        ))}
      </div>

      {/* GLOBAL TRANSACTION RECEIPT MODAL */}
      {receiptTx && meta && (
        <div
          id="tx-receipt-modal"
          onClick={(e) => {
            if (e.target.id === 'tx-receipt-modal') setReceiptTx(null);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0,0,0,0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          <div
            style={{
              background: '#1a1a2e',
              width: '100%',
              maxWidth: '430px',
              borderRadius: '24px 24px 0 0',
              padding: '20px 20px 32px',
              maxHeight: '92vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ width: 40, height: 4, background: '#334155', borderRadius: 99, margin: '0 auto 20px' }} />

            <div
              id={`receipt-content-${receiptTx.id}`}
              style={{
                position: 'relative',
                background: '#fff',
                color: '#111',
                borderRadius: 16,
                padding: 24,
                marginBottom: 20,
                overflow: 'hidden',
              }}
            >
              <img
                src="/Img/Qpaylogo.png"
                alt="Watermark"
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: 200,
                  opacity: 0.06,
                  pointerEvents: 'none',
                  zIndex: 0,
                }}
              />
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ textAlign: 'center', marginBottom: 20 }}>
                  <img
                    src="/Img/Qpaylogo.png"
                    alt="QPAY AO"
                    style={{ height: 36, width: 'auto', margin: '0 auto 8px', display: 'block' }}
                  />
                  <div style={{ fontSize: 13, color: '#888', fontWeight: 600 }}>Comprovativo de Operação</div>
                </div>
                <div style={{ borderBottom: '2px dashed #e5e7eb', marginBottom: 20 }} />

                <div style={{ marginBottom: 20, textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.5 }}>
                    Valor
                  </div>
                  <div
                    style={{
                      fontSize: 36,
                      fontWeight: 900,
                      color: meta.credit ? '#16a34a' : '#dc2626',
                      marginTop: 4,
                      letterSpacing: -1,
                    }}
                  >
                    {meta.credit ? '+' : '-'}
                    {formatKz(receiptTx.amount)}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f3f4f6', fontSize: 14 }}>
                  <span style={{ color: '#6b7280' }}>Tipo</span>
                  <strong>{meta.label}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f3f4f6', fontSize: 14 }}>
                  <span style={{ color: '#6b7280' }}>Descrição</span>
                  <strong style={{ maxWidth: '58%', textAlign: 'right' }}>{receiptTx.description}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', fontSize: 14 }}>
                  <span style={{ color: '#6b7280' }}>Data / Hora</span>
                  <strong>{new Date(receiptTx.timestamp).toLocaleString('pt-AO')}</strong>
                </div>

                {receiptTx.note && (
                  <div style={{ background: '#0f172a', border: '1px solid #334155', padding: 12, borderRadius: 10, marginTop: 12 }}>
                    <div style={{ color: '#64748b', fontSize: 11, textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>
                      Nota / Mensagem
                    </div>
                    <div style={{ color: '#e2e8f0', fontWeight: 600, wordBreak: 'break-word', lineHeight: 1.5 }}>{receiptTx.note}</div>
                  </div>
                )}

                <div
                  style={{
                    borderTop: '2px dashed #e5e7eb',
                    marginTop: 16,
                    paddingTop: 16,
                    textAlign: 'center',
                    color: '#9ca3af',
                    fontSize: 11,
                    lineHeight: 1.6,
                  }}
                >
                  Ref: {receiptTx.id}
                  <br />
                  Obrigado por usar a carteira digital QPAY AO!
                </div>
              </div>
            </div>

            {!showDownloadOptions ? (
              <div style={{ marginBottom: 10 }}>
                <button
                  onClick={() => setShowDownloadOptions(true)}
                  style={{
                    width: '100%',
                    padding: 14,
                    background: 'linear-gradient(135deg, #0072ff, #00f2fe)',
                    color: '#030a18',
                    boxShadow: '0 0 16px rgba(0, 242, 254, 0.45)',
                    border: 'none',
                    borderRadius: 12,
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  Baixar Comprovativo
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                <button
                  onClick={() => downloadReceiptImage(receiptTx)}
                  style={{
                    flex: 1,
                    padding: 14,
                    background: '#2563eb',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 12,
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  Imagem
                </button>
                <button
                  onClick={() => downloadReceiptPDF(receiptTx)}
                  style={{
                    flex: 1,
                    padding: 14,
                    background: '#dc2626',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 12,
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  PDF
                </button>
                <button
                  onClick={() => shareReceipt(receiptTx)}
                  style={{
                    flex: 1,
                    padding: 14,
                    background: '#8b5cf6',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 12,
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  Partilhar
                </button>
              </div>
            )}

            <button
              onClick={() => setReceiptTx(null)}
              style={{
                width: '100%',
                padding: 14,
                background: 'transparent',
                color: '#94a3b8',
                border: '1px solid #334155',
                borderRadius: 12,
                fontWeight: 600,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </QPayContext.Provider>
  );
}

export function useQPay() {
  return useContext(QPayContext);
}

