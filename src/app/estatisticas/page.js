'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQPay } from '@/context/QPayContext';
import { formatKz } from '@/lib/utils';
import TxList from '@/components/TxList';

export default function EstatisticasPage() {
  const router = useRouter();
  const { user, loadingAuth } = useQPay();

  const [incomingTxs, setIncomingTxs] = useState([]);
  const [period, setPeriod] = useState('hoje');
  const [specificDate, setSpecificDate] = useState('');
  const [specificMonth, setSpecificMonth] = useState('');

  useEffect(() => {
    if (!loadingAuth) {
      if (!user) {
        router.push('/');
        return;
      }
      fetch(`/api/transactions?userId=${user.id}`, { cache: 'no-store' })
        .then((r) => r.json())
        .then((d) => {
          if (d.success) {
            const validTypes = ['qr_payment_in', 'transfer_in', 'deposit'];
            const inc = (d.transactions || []).filter(
              (tx) => tx.toUserId === user.id && validTypes.includes(tx.type) && tx.status === 'completed'
            );
            setIncomingTxs(inc);
          }
        })
        .catch(() => {});
    }
  }, [user, loadingAuth, router]);

  if (loadingAuth || !user) return null;

  const now = new Date();
  let titleLabel = 'Vendas';
  let filtered = [];

  if (period === 'specific-date' && specificDate) {
    titleLabel = `Vendas (${specificDate.split('-').reverse().join('/')})`;
    filtered = incomingTxs.filter((tx) => {
      const txDate = new Date(tx.timestamp);
      const tzOffset = txDate.getTimezoneOffset() * 60000;
      const localISOTime = new Date(txDate - tzOffset).toISOString().slice(0, -1);
      return localISOTime.split('T')[0] === specificDate;
    });
  } else if (period === 'specific-month' && specificMonth) {
    const [yyyy, mm] = specificMonth.split('-');
    titleLabel = `Vendas (${mm}/${yyyy})`;
    filtered = incomingTxs.filter((tx) => {
      const txDate = new Date(tx.timestamp);
      return txDate.getFullYear() === parseInt(yyyy) && txDate.getMonth() + 1 === parseInt(mm);
    });
  } else {
    filtered = incomingTxs.filter((tx) => {
      const txDate = new Date(tx.timestamp);
      if (period === 'hoje') {
        titleLabel = 'Vendas (Hoje)';
        return (
          txDate.getDate() === now.getDate() &&
          txDate.getMonth() === now.getMonth() &&
          txDate.getFullYear() === now.getFullYear()
        );
      }
      if (period === 'semana') {
        titleLabel = 'Vendas (Esta Semana)';
        const diffDays = Math.ceil((now - txDate) / (1000 * 60 * 60 * 24));
        return diffDays <= 7;
      }
      if (period === 'mes') {
        titleLabel = 'Vendas (Este Mês)';
        return txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear();
      }
      if (period === 'ano') {
        titleLabel = 'Vendas (Este Ano)';
        return txDate.getFullYear() === now.getFullYear();
      }
      titleLabel = 'Vendas (Todo o Histórico)';
      return true;
    });
  }

  const totalRevenue = filtered.reduce((sum, tx) => sum + tx.amount, 0);

  return (
    <div className="app-wrapper">
      <div className="bg-glow" />

      <div className="header">
        <button className="icon-btn" onClick={() => router.push('/dashboard')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span className="header-title">Estatísticas de Vendas</span>
        <div style={{ width: 38 }} />
      </div>

      <div className="page page-enter">
        <div className="page-inner">
          <div style={{ height: 16 }} />

          <div className="filter-bar mb-4">
            {[
              { id: 'hoje', label: 'Hoje' },
              { id: 'semana', label: 'Semana' },
              { id: 'mes', label: 'Mês' },
              { id: 'ano', label: 'Ano' },
              { id: 'sempre', label: 'Sempre' },
            ].map((p) => (
              <div
                key={p.id}
                className={`filter-chip ${period === p.id ? 'active' : ''}`}
                onClick={() => {
                  setPeriod(p.id);
                  setSpecificDate('');
                  setSpecificMonth('');
                }}
              >
                {p.label}
              </div>
            ))}
          </div>

          <div className="card mb-5" style={{ padding: '12px 16px' }}>
            <div className="t-xs text-muted mb-2 fw-bold" style={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Pesquisa Personalizada
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div className="input-group" style={{ flex: 1 }}>
                <div className="t-xs text-muted mb-1" style={{ fontSize: 10 }}>
                  Dia Exato
                </div>
                <input
                  type="date"
                  className="input"
                  value={specificDate}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSpecificDate(val);
                    setSpecificMonth('');
                    setPeriod(val ? 'specific-date' : 'hoje');
                  }}
                />
              </div>
              <div className="input-group" style={{ flex: 1 }}>
                <div className="t-xs text-muted mb-1" style={{ fontSize: 10 }}>
                  Mês Específico
                </div>
                <input
                  type="month"
                  className="input"
                  value={specificMonth}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSpecificMonth(val);
                    setSpecificDate('');
                    setPeriod(val ? 'specific-month' : 'hoje');
                  }}
                />
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 }}>
            <div className="card" style={{ padding: 16, textAlign: 'center' }}>
              <div className="t-xs text-muted mb-1" style={{ textTransform: 'uppercase', fontWeight: 700 }}>
                Faturamento Total
              </div>
              <div className="t-lg fw-bold text-success">{formatKz(totalRevenue)}</div>
            </div>
            <div className="card" style={{ padding: 16, textAlign: 'center' }}>
              <div className="t-xs text-muted mb-1" style={{ textTransform: 'uppercase', fontWeight: 700 }}>
                Total de Entradas
              </div>
              <div className="t-lg fw-bold" style={{ color: 'var(--primary)' }}>
                {filtered.length}
              </div>
            </div>
          </div>

          <div className="sec-header">
            <span className="sec-title">{titleLabel}</span>
          </div>
          <div className="card" style={{ padding: '8px 16px', minHeight: 200 }}>
            <TxList transactions={filtered} grouped={true} />
          </div>
        </div>
      </div>
    </div>
  );
}

