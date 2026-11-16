'use client';

import React from 'react';
import { formatKz, formatDate, TX_META, groupTxsByDate } from '@/lib/utils';
import { useQPay } from '@/context/QPayContext';

export function TxIcon({ type }) {
  if (type === 'deposit') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="8 17 12 21 16 17" />
        <line x1="12" y1="3" x2="12" y2="21" />
      </svg>
    );
  }
  if (type === 'withdrawal') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="16 7 12 3 8 7" />
        <line x1="12" y1="21" x2="12" y2="3" />
      </svg>
    );
  }
  if (type === 'transfer_in') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M5 12h14M12 5l7 7-7 7" />
      </svg>
    );
  }
  if (type === 'transfer_out') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M19 12H5M12 19l-7-7 7-7" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M14 14h.01M14 17h3M17 14h3M17 17v3" />
    </svg>
  );
}

export function TxItem({ tx }) {
  const { viewTransactionReceipt } = useQPay();
  const meta = TX_META[tx.type] || TX_META.deposit;
  const amtClass = meta.credit ? 'pos' : 'neg';
  const amtSign = meta.credit ? '+' : '-';

  return (
    <div
      className="tx-item"
      onClick={() => viewTransactionReceipt(tx)}
      style={{ cursor: 'pointer' }}
    >
      <div className={`tx-icon ${meta.iconClass}`}>
        <TxIcon type={tx.type} />
      </div>
      <div className="tx-info">
        <div className="tx-name">{tx.description}</div>
        <div className="tx-date">{formatDate(tx.timestamp)}</div>
      </div>
      <div className={`tx-amount ${amtClass}`}>
        {amtSign}
        {formatKz(tx.amount)}
      </div>
    </div>
  );
}

export default function TxList({ transactions, grouped = true }) {
  if (!transactions || transactions.length === 0) {
    return (
      <div className="empty-state" style={{ padding: '32px 0' }}>
        <div className="empty-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="2" y="5" width="20" height="14" rx="2" />
            <line x1="2" y1="10" x2="22" y2="10" />
          </svg>
        </div>
        <p className="t-sm text-muted mt-2">Nenhuma transação encontrada</p>
      </div>
    );
  }

  if (!grouped) {
    return (
      <div>
        {transactions.map((tx) => (
          <TxItem key={tx.id} tx={tx} />
        ))}
      </div>
    );
  }

  const groups = groupTxsByDate(transactions);
  return (
    <div>
      {Object.entries(groups).map(([label, items]) => (
        <React.Fragment key={label}>
          <div className="date-label">{label}</div>
          {items.map((tx) => (
            <TxItem key={tx.id} tx={tx} />
          ))}
        </React.Fragment>
      ))}
    </div>
  );
}

