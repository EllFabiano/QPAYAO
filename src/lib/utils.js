/* ================================================
   QPAY AO — Utilitários Partilhados (Frontend & Backend)
================================================ */

export function formatKz(amount) {
  if (amount === undefined || amount === null || isNaN(amount)) return '0,00 Kz';
  return (
    new Intl.NumberFormat('pt-AO', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(amount)) + ' Kz'
  );
}

export function formatKzNumber(amount) {
  if (amount === undefined || amount === null || isNaN(amount)) return '0,00';
  return new Intl.NumberFormat('pt-AO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount));
}

export function formatDate(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  const now = new Date();
  const diff = Math.floor((now - d) / 86400000);
  const time = d.toLocaleTimeString('pt-AO', { hour: '2-digit', minute: '2-digit' });
  if (diff === 0) return `Hoje às ${time}`;
  if (diff === 1) return `Ontem às ${time}`;
  if (diff < 7 && diff > 0) return `Há ${diff} dias`;
  return d.toLocaleDateString('pt-AO', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function getInitials(name) {
  return (name || '')
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function validateNIF(nif) {
  return /^\d{9}[A-Z]{2}\d{3}$/.test((nif || '').toUpperCase().trim());
}

export function sanitizeNifInput(raw) {
  const v = (raw || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
  let out = '';
  for (let i = 0; i < v.length && out.length < 14; i++) {
    const c = v[i];
    const pos = out.length;
    if (pos < 9) {
      if (/\d/.test(c)) out += c;
    } else if (pos < 11) {
      if (/[A-Z]/.test(c)) out += c;
    } else {
      if (/\d/.test(c)) out += c;
    }
  }
  return out;
}

export function sanitizeForQR(str) {
  if (!str) return '';
  return str
    .replace(/[\u00A0]/g, ' ')
    .replace(/[\u2000-\u200F]/g, '')
    .replace(/[\u2028\u2029]/g, '')
    .replace(/[^\x20-\x7E\xC0-\xFF]/g, '');
}

export function buildQRPayload(type, user, opts = {}) {
  const randomCode = Math.random().toString(36).substring(2, 10).toUpperCase();
  const data = {
    v: '1.0',
    app: 'QPAY-AO',
    type,
    id: user.id,
    name: sanitizeForQR(user.name),
    phone: user.phone,
    amt: opts.amount ? Number(opts.amount) : null,
    desc: opts.description ? sanitizeForQR(opts.description) : null,
    exp: opts.expiresAt || null,
    once: opts.oneUse || false,
    code: 'QPAY-' + randomCode,
    ts: new Date().toISOString(),
  };
  Object.keys(data).forEach((k) => {
    if (data[k] === null || data[k] === false) delete data[k];
  });
  return JSON.stringify(data);
}

export function parseQRPayload(raw) {
  try {
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const mid = data.id || data.merchantId;
    const mname = data.name || data.merchantName;
    if (!mid || !mname || data.app !== 'QPAY-AO') return null;
    return {
      ...data,
      merchantId: mid,
      merchantName: mname,
      merchantPhone: data.phone || data.merchantPhone,
      amount: data.amt || data.amount || null,
      description: data.desc || data.description || null,
      expiresAt: data.exp || data.expiresAt || null,
      oneUse: data.once || data.oneUse || false,
    };
  } catch {
    return null;
  }
}

export function formatExpiry(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return d.toLocaleDateString('pt-AO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const TX_META = {
  deposit: {
    iconClass: 'tx-icon-deposit',
    label: 'Depósito',
    credit: true,
  },
  withdrawal: {
    iconClass: 'tx-icon-withdraw',
    label: 'Levantamento',
    credit: false,
  },
  transfer_in: {
    iconClass: 'tx-icon-in',
    label: 'Recebido',
    credit: true,
  },
  transfer_out: {
    iconClass: 'tx-icon-out',
    label: 'Enviado',
    credit: false,
  },
  qr_payment_in: {
    iconClass: 'tx-icon-in',
    label: 'Venda QR',
    credit: true,
  },
  qr_payment_out: {
    iconClass: 'tx-icon-out',
    label: 'Pagamento QR',
    credit: false,
  },
};

export function groupTxsByDate(txs) {
  const groups = {};
  txs.forEach((tx) => {
    const d = new Date(tx.timestamp);
    const now = new Date();
    const diff = Math.floor((now - d) / 86400000);
    let label;
    if (diff === 0) label = 'Hoje';
    else if (diff === 1) label = 'Ontem';
    else if (diff < 7 && diff > 0) label = `Há ${diff} dias`;
    else label = d.toLocaleDateString('pt-AO', { month: 'long', year: 'numeric' });

    if (!groups[label]) groups[label] = [];
    groups[label].push(tx);
  });
  return groups;
}

