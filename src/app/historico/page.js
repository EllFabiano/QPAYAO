'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQPay } from '@/context/QPayContext';
import { formatKz, TX_META } from '@/lib/utils';
import BottomNav from '@/components/BottomNav';
import TxList from '@/components/TxList';

export default function HistoricoPage() {
  const router = useRouter();
  const { user, loadingAuth, showToast } = useQPay();

  const [allTxs, setAllTxs] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!loadingAuth) {
      if (!user) {
        router.push('/');
        return;
      }
      fetch(`/api/transactions?userId=${user.id}`, { cache: 'no-store' })
        .then((r) => r.json())
        .then((d) => {
          if (d.success) setAllTxs(d.transactions || []);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [user, loadingAuth, router]);

  if (loadingAuth || !user) return null;

  const filterMap = {
    all: null,
    received: ['transfer_in', 'qr_payment_in'],
    sent: ['transfer_out', 'qr_payment_out'],
    deposit: ['deposit'],
    withdrawal: ['withdrawal'],
  };

  let filteredTxs =
    filter === 'all' || !filterMap[filter]
      ? allTxs
      : allTxs.filter((t) => filterMap[filter].includes(t.type));

  if (search.trim()) {
    const q = search.toLowerCase().trim();
    filteredTxs = filteredTxs.filter(
      (tx) =>
        (tx.description || '').toLowerCase().includes(q) ||
        String(tx.amount).includes(q)
    );
  }

  const credited = ['deposit', 'transfer_in', 'qr_payment_in'];
  const debited = ['withdrawal', 'transfer_out', 'qr_payment_out'];
  const totalIn = allTxs
    .filter((t) => credited.includes(t.type))
    .reduce((s, t) => s + t.amount, 0);
  const totalOut = allTxs
    .filter((t) => debited.includes(t.type))
    .reduce((s, t) => s + t.amount, 0);

  const exportPDF = async () => {
    if (filteredTxs.length === 0) {
      showToast('Nenhuma transacção para exportar', 'error');
      return;
    }
    const el = document.getElementById('pdf-template');
    if (!el) return;
    el.style.display = 'block';
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
      pdf.save(`QPAY_Extrato_${user.name.replace(/\s+/g, '_')}.pdf`);
      showToast('Extrato (PDF) descarregado!', 'success');
    } catch {
      showToast('Erro ao gerar PDF', 'error');
    } finally {
      el.style.display = 'none';
    }
  };

  return (
    <div className="app-wrapper">
      <div className="bg-glow" />

      <div className="header">
        <button className="icon-btn" onClick={() => router.push('/dashboard')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span className="header-title">Histórico</span>
        <button
          className="btn btn-sm btn-ghost"
          onClick={exportPDF}
          style={{ color: 'var(--primary)', fontWeight: 600, fontSize: 12, padding: '4px 10px' }}
        >
          Extrato (PDF)
        </button>
      </div>

      <div className="page page-enter">
        <div className="page-inner">
          <div style={{ height: 16 }} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 20 }}>
            <div className="card" style={{ padding: 14, textAlign: 'center' }}>
              <div className="t-xs text-muted">Total Recebido</div>
              <div className="t-base fw-bold text-success mt-1">{formatKz(totalIn)}</div>
            </div>
            <div className="card" style={{ padding: 14, textAlign: 'center' }}>
              <div className="t-xs text-muted">Total Enviado</div>
              <div className="t-base fw-bold text-danger mt-1">{formatKz(totalOut)}</div>
            </div>
            <div className="card" style={{ padding: 14, textAlign: 'center' }}>
              <div className="t-xs text-muted">Transacções</div>
              <div className="t-base fw-bold mt-1">{allTxs.length}</div>
            </div>
          </div>

          <div className="input-group mb-4">
            <div className="input-wrap">
              <div className="input-icon-wrap left">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 18, height: 18 }}>
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </div>
              <input
                type="search"
                className="input input-icon-l"
                placeholder="Pesquisar transacções..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="filter-bar mb-5">
            {[
              { id: 'all', label: 'Todas' },
              { id: 'received', label: '▲ Recebido' },
              { id: 'sent', label: '▼ Enviado' },
              { id: 'deposit', label: '💰 Depósitos' },
              { id: 'withdrawal', label: '🏧 Levantamentos' },
            ].map((f) => (
              <div
                key={f.id}
                className={`filter-chip ${filter === f.id ? 'active' : ''}`}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
              </div>
            ))}
          </div>

          <div className="card" style={{ padding: '8px 16px', minHeight: 200 }}>
            {loading ? (
              <div className="flex items-center justify-center" style={{ height: 160 }}>
                <div className="spinner" />
              </div>
            ) : (
              <TxList transactions={filteredTxs} grouped={true} />
            )}
          </div>
        </div>
      </div>

      {/* HIDDEN PDF TEMPLATE */}
      <div
        id="pdf-template"
        style={{
          display: 'none',
          position: 'absolute',
          top: -9999,
          left: -9999,
          width: 600,
          padding: 40,
          background: '#fff',
          color: '#111',
          fontFamily: 'Inter, sans-serif',
          zIndex: -1,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            borderBottom: '2px solid #2563eb',
            paddingBottom: 20,
            marginBottom: 30,
          }}
        >
          <div>
            <h2 style={{ margin: 0, color: '#2563eb', fontWeight: 900, fontSize: 32 }}>QPAY AO</h2>
            <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 14 }}>Extrato de Transacções</p>
          </div>
          <div style={{ textAlign: 'right', fontSize: 12, color: '#475569', lineHeight: 1.6 }}>
            <strong>Data de Emissão:</strong> {new Date().toLocaleString('pt-AO')}
            <br />
            <strong>Titular:</strong> {user.name}
            <br />
            <strong>Conta:</strong> {user.phone}
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 30 }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              <th style={{ padding: '12px 10px', textAlign: 'left', fontSize: 11, color: '#64748b', borderBottom: '2px solid #e2e8f0' }}>
                Data / Hora
              </th>
              <th style={{ padding: '12px 10px', textAlign: 'left', fontSize: 11, color: '#64748b', borderBottom: '2px solid #e2e8f0' }}>
                Detalhes da Transacção
              </th>
              <th style={{ padding: '12px 10px', textAlign: 'right', fontSize: 11, color: '#64748b', borderBottom: '2px solid #e2e8f0' }}>
                Valor (Kz)
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredTxs.map((tx) => {
              const meta = TX_META[tx.type] || {};
              const credit = meta.credit;
              return (
                <tr key={tx.id}>
                  <td style={{ padding: 10, borderBottom: '1px solid #e2e8f0', fontSize: 11, color: '#475569' }}>
                    {new Date(tx.timestamp).toLocaleString('pt-AO')}
                  </td>
                  <td style={{ padding: 10, borderBottom: '1px solid #e2e8f0', fontSize: 12, fontWeight: 500 }}>
                    {meta.label || tx.type}
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{tx.description}</div>
                  </td>
                  <td
                    style={{
                      padding: 10,
                      borderBottom: '1px solid #e2e8f0',
                      fontSize: 12,
                      fontWeight: 700,
                      color: credit ? '#16a34a' : '#dc2626',
                      textAlign: 'right',
                    }}
                  >
                    {credit ? '+' : '-'}
                    {formatKz(tx.amount)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <BottomNav />
    </div>
  );
}

