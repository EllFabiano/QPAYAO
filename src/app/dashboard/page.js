'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useQPay } from '@/context/QPayContext';
import { formatKz, formatKzNumber, getInitials, buildQRPayload } from '@/lib/utils';
import { renderQRWithLogo } from '@/lib/qrHelper';
import BottomNav from '@/components/BottomNav';
import TxList from '@/components/TxList';
import QRCanvas from '@/components/QRCanvas';

export default function DashboardPage() {
  const router = useRouter();
  const { user, loadingAuth, refreshUser, logout, showToast } = useQPay();

  const [transactions, setTransactions] = useState([]);
  const [activeSheet, setActiveSheet] = useState(null); // 'depositar' | 'levantar' | null
  const [receberTab, setReceberTab] = useState('qr'); // 'qr' | 'express' | 'banco'

  // QR Generator state
  const [qrType, setQrType] = useState('dynamic'); // 'dynamic' | 'fixed'
  const [qrStep, setQrStep] = useState(1); // 1 | 2 | 3 | 4
  const [qrDuration, setQrDuration] = useState(0); // ms; 0 = 1 uso; -1 = permanente
  const [qrAmount, setQrAmount] = useState('');
  const [generatedQR, setGeneratedQR] = useState(null); // { payload, type, amount, durationLabel, expiresAt }
  const [countdownText, setCountdownText] = useState('—');
  const qrCanvasRef = useRef(null);

  // Express QR popup
  const [expressAmount, setExpressAmount] = useState('');
  const [expressPopup, setExpressPopup] = useState(null);

  // Withdraw state
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);

  const loadTransactions = async (uid) => {
    try {
      const res = await fetch(`/api/transactions?userId=${uid}`, { cache: 'no-store' });
      const data = await res.json();
      if (data.success) setTransactions(data.transactions || []);
    } catch (_) {}
  };

  useEffect(() => {
    if (!loadingAuth) {
      if (!user) {
        router.push('/');
        return;
      }
      if (user.role === 'admin') {
        router.push('/admin');
        return;
      }
      if (user.role === 'agent') {
        router.push('/agent');
        return;
      }
      loadTransactions(user.id);
    }
  }, [user, loadingAuth, router]);

  // Countdown timer for dynamic QR
  useEffect(() => {
    if (!generatedQR || !generatedQR.expiresAt || qrDuration === 0) return;
    const expMs = new Date(generatedQR.expiresAt).getTime();
    const tick = () => {
      const diff = expMs - Date.now();
      if (diff <= 0) {
        setCountdownText('EXPIRADO');
        return;
      }
      const h = Math.floor(diff / 3600000).toString().padStart(2, '0');
      const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
      const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
      setCountdownText(diff >= 3600000 ? `${h}:${m}:${s}` : `${m}:${s}`);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [generatedQR, qrDuration]);

  if (loadingAuth || !user) return null;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthTxs = transactions.filter((tx) => new Date(tx.timestamp) >= startOfMonth);
  const monthReceived = monthTxs
    .filter((t) => ['deposit', 'transfer_in', 'qr_payment_in'].includes(t.type) && t.toUserId === user.id)
    .reduce((s, t) => s + t.amount, 0);
  const monthSent = monthTxs
    .filter((t) => ['withdrawal', 'transfer_out', 'qr_payment_out'].includes(t.type) && t.fromUserId === user.id)
    .reduce((s, t) => s + t.amount, 0);

  const openReceiveSheet = () => {
    setReceberTab('qr');
    setQrType('dynamic');
    setQrStep(1);
    setGeneratedQR(null);
    setActiveSheet('depositar');
  };

  const executeQRGeneration = () => {
    if (qrType === 'fixed') {
      const payload = buildQRPayload('fixed', user, { description: 'QR Fixo QPAY' });
      setGeneratedQR({
        payload,
        type: 'fixed',
        amount: null,
        durationLabel: 'Permanente',
        expiresAt: null,
      });
      setQrStep(4);
      return;
    }

    const amt = parseFloat(qrAmount);
    if (!amt || amt <= 0) {
      showToast('O valor é obrigatório para QR dinâmicos.', 'error');
      return;
    }

    let expiresAt = null;
    let durationLabel = '';
    if (qrDuration === 0) {
      expiresAt = new Date(Date.now() + 15 * 60000).toISOString();
      durationLabel = '1 Utilização';
    } else if (qrDuration === -1) {
      expiresAt = null;
      durationLabel = 'Permanente';
    } else {
      expiresAt = new Date(Date.now() + qrDuration).toISOString();
      const mins = qrDuration / 60000;
      if (mins < 60) durationLabel = `${mins} minutos`;
      else if (mins < 1440) durationLabel = `${mins / 60} hora${mins / 60 > 1 ? 's' : ''}`;
      else if (mins < 10080) durationLabel = `${mins / 1440} dia${mins / 1440 > 1 ? 's' : ''}`;
      else durationLabel = '1 semana';
    }

    const payload = buildQRPayload('dynamic', user, {
      description: `Pagamento de ${amt} Kz`,
      amount: amt,
      expiresAt,
      oneUse: qrDuration === 0,
    });

    setGeneratedQR({
      payload,
      type: 'dynamic',
      amount: amt,
      durationLabel,
      expiresAt,
    });
    setQrStep(4);
  };

  const downloadQRasImage = async () => {
    if (!generatedQR) {
      showToast('Gere primeiro um QR Code', 'error');
      return;
    }
    showToast('A guardar PNG em alta resolução...', 'success');
    try {
      const qrCanvas = await renderQRWithLogo({
        payload: generatedQR.payload,
        size: 300,
        scale: 2,
      });
      const link = document.createElement('a');
      link.download = `QRCode_QPAY_${user.phone || 'digital'}.png`;
      link.href = qrCanvas.toDataURL('image/png');
      link.click();
      showToast('QR Code guardado em PNG!', 'success');
    } catch {
      showToast('Erro ao guardar PNG', 'error');
    }
  };

  const downloadQRasPDF = async () => {
    if (!generatedQR) {
      showToast('Gere primeiro um QR Code', 'error');
      return;
    }
    showToast('A gerar PDF com logótipo...', 'success');
    try {
      const { jsPDF } = await import('jspdf');
      // Renderiza QR em alta definição com o logótipo QPAY AO garantido no centro
      const qrCanvas = await renderQRWithLogo({
        payload: generatedQR.payload,
        size: 260,
        scale: 2,
      });

      const imgData = qrCanvas.toDataURL('image/png');
      const pxW = qrCanvas.width + 120; // 520 + 120 = 640px
      const pxH = qrCanvas.height + 280; // Altura ampla para acomodar nome em 3x

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [pxW, pxH] });
      pdf.setFillColor(255, 255, 255);
      pdf.rect(0, 0, pxW, pxH, 'F');

      // Cabeçalho
      pdf.setFontSize(26);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(15, 23, 42);
      pdf.text('QPAY AO', pxW / 2, 42, { align: 'center' });

      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(100, 116, 139);
      const isDynamic = generatedQR?.type === 'dynamic';
      const typeLabel = isDynamic
        ? `QR Code Dinâmico${generatedQR?.durationLabel ? ` (${generatedQR.durationLabel})` : ''}`
        : 'QR Code Fixo · Pagamento Comercial';
      pdf.text(typeLabel, pxW / 2, 64, { align: 'center' });

      // QR Code com logótipo central
      pdf.addImage(imgData, 'PNG', 60, 84, qrCanvas.width, qrCanvas.height);

      // Nome do comerciante/titular em tamanho 3x (36pt)
      pdf.setFontSize(36);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(15, 23, 42);
      const nameY = 84 + qrCanvas.height + 45;
      pdf.text(user.name, pxW / 2, nameY, { align: 'center' });

      let nextY = nameY + 36;
      if (isDynamic && generatedQR?.amount) {
        pdf.setFontSize(28);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(5, 150, 105);
        pdf.text(formatKz(generatedQR.amount), pxW / 2, nextY, { align: 'center' });
        nextY += 32;
      }

      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(100, 116, 139);
      pdf.text(`+244 ${user.phone}`, pxW / 2, nextY, { align: 'center' });

      pdf.setFontSize(11);
      pdf.setTextColor(148, 163, 184);
      pdf.text('Powered by QPAY AO · Uíge, Angola', pxW / 2, pxH - 20, { align: 'center' });

      pdf.save('QRCode_QPAY.pdf');
      showToast('PDF guardado com sucesso!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Erro ao gerar PDF', 'error');
    }
  };

  const generateExpressQR = () => {
    const amt = parseFloat(expressAmount);
    if (!amt || amt < 1) {
      showToast('Insira um valor válido', 'error');
      return;
    }
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const payload = buildQRPayload('dynamic', user, {
      description: `Pagamento de ${amt} Kz`,
      amount: amt,
      expiresAt,
    });
    setExpressPopup({ payload, amount: amt });
  };

  const doWithdraw = async () => {
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount < 100) {
      showToast('Valor mínimo: 100 Kz', 'error');
      return;
    }

    setWithdrawing(true);
    try {
      const res = await fetch('/api/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'withdraw',
          userId: user.id,
          amount,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setActiveSheet(null);
        setWithdrawAmount('');
        showToast(`${formatKz(amount)} levantados com sucesso!`, 'success');
        await refreshUser(user.id);
        await loadTransactions(user.id);
      } else {
        showToast(data.message || 'Erro no levantamento', 'error');
      }
    } catch {
      showToast('Erro ao comunicar com o servidor', 'error');
    } finally {
      setWithdrawing(false);
    }
  };

  const atmRef = (user.phone || '000000000').replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3');
  const atmValidityDate = new Date();
  atmValidityDate.setMonth(atmValidityDate.getMonth() + 3);

  return (
    <div className="app-wrapper">
      <div className="bg-glow" />

      {/* HEADER */}
      <div className="header">
        <div
          className="flex items-center gap-3"
          onClick={() => router.push('/profile')}
          style={{ cursor: 'pointer' }}
        >
          <div
            className="avatar avatar-sm"
            style={{
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundImage: user.avatar ? `url(${user.avatar})` : 'none',
            }}
          >
            {!user.avatar ? getInitials(user.name) : ''}
          </div>
          <div>
            <div className="t-xs text-muted">Bem-vindo(a) de volta 👋</div>
            <div className="t-base fw-bold">{user.name.split(' ')[0]}</div>
          </div>
        </div>
        <button className="icon-btn" onClick={logout} title="Sair">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </div>

      <div className="page page-enter">
        <div style={{ height: 20 }} />

        {/* BALANCE CARD */}
        <div className="balance-card" style={{ margin: '0 20px' }}>
          <div className="balance-label">Saldo Disponível</div>
          <div className="balance-amount">
            <span className="balance-currency">Kz</span>
            <span>{formatKzNumber(user.balance)}</span>
          </div>
          <div className="balance-footer flex items-center justify-between">
            <span>💳 Carteira Digital QPAY AO</span>
            <span>{new Date().toLocaleDateString('pt-AO', { day: '2-digit', month: 'short' })}</span>
          </div>
        </div>

        <div className="page-inner">
          <div style={{ height: 20 }} />

          {/* QUICK ACTIONS */}
          <div className="action-grid">
            <div className="action-item" onClick={openReceiveSheet}>
              <div className="action-icon" style={{ background: 'var(--info-100)', color: 'var(--info)' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2v20M2 12l10 10 10-10" />
                </svg>
              </div>
              <span className="action-label">Receber</span>
            </div>

            <div className="action-item" onClick={() => setActiveSheet('levantar')}>
              <div className="action-icon" style={{ background: 'var(--warning-100)', color: 'var(--warning)' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="16 7 12 3 8 7" />
                  <line x1="12" y1="21" x2="12" y2="3" />
                </svg>
              </div>
              <span className="action-label">Levantar</span>
            </div>

            <div className="action-item" onClick={() => router.push('/transferir')}>
              <div className="action-icon" style={{ background: 'var(--secondary-100)', color: 'var(--secondary)' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </div>
              <span className="action-label">Transferir</span>
            </div>

            <div className="action-item" onClick={() => router.push('/scanner')}>
              <div className="action-icon" style={{ background: 'var(--primary-100)', color: 'var(--primary)' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                  <path d="M14 14h.01M14 17h3M17 14h3M17 17v3" />
                </svg>
              </div>
              <span className="action-label">Pagar QR</span>
            </div>
          </div>

          <div style={{ height: 24 }} />

          {/* STATS ROW */}
          <div className="sec-header">
            <span className="sec-title">Resumo Mensal</span>
            <span className="sec-link" style={{ cursor: 'pointer' }} onClick={() => router.push('/estatisticas')}>
              Relatórios de Vendas
            </span>
          </div>
          <div className="flex gap-3 mb-6" onClick={() => router.push('/estatisticas')} style={{ cursor: 'pointer' }}>
            <div className="card flex-1" style={{ padding: 16, textAlign: 'center' }}>
              <div className="t-xs text-muted mb-1">Recebido (mês)</div>
              <div className="t-lg fw-bold text-success">{formatKz(monthReceived)}</div>
            </div>
            <div className="card flex-1" style={{ padding: 16, textAlign: 'center' }}>
              <div className="t-xs text-muted mb-1">Enviado (mês)</div>
              <div className="t-lg fw-bold text-danger">{formatKz(monthSent)}</div>
            </div>
          </div>

          {/* RECENT TRANSACTIONS */}
          <div className="sec-header">
            <span className="sec-title">Transacções Recentes</span>
            <span className="sec-link" style={{ cursor: 'pointer' }} onClick={() => router.push('/historico')}>
              Ver todas
            </span>
          </div>

          <div className="card" style={{ padding: '8px 16px' }}>
            <TxList transactions={transactions.slice(0, 5)} grouped={false} />
          </div>

          <div style={{ height: 16 }} />

          {/* MY QR CODE SHORTCUT */}
          <div
            className="card"
            style={{ background: 'var(--primary-50)', borderColor: 'rgba(0,214,143,0.15)', cursor: 'pointer' }}
            onClick={() => router.push('/qrcode')}
          >
            <div className="flex items-center gap-3">
              <div
                className="action-icon"
                style={{ background: 'var(--primary-100)', color: 'var(--primary)', width: 48, height: 48 }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 24, height: 24 }}>
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                  <path d="M14 14h.01M14 17h3M17 14h3M17 17v3" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="t-base fw-semibold">O Meu QR Code</div>
                <div className="t-sm text-muted mt-1">Mostrar QR para receber pagamentos</div>
              </div>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--primary)' }}>
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <BottomNav />

      {/* OVERLAY */}
      <div className={`overlay ${activeSheet ? 'open' : ''}`} onClick={() => setActiveSheet(null)} />

      {/* SHEET: RECEBER */}
      <div className={`sheet sheet-tall ${activeSheet === 'depositar' ? 'open' : ''}`}>
        <div className="sheet-handle" />
        <div className="sheet-title">Receber</div>

        <div
          style={{
            display: 'flex',
            gap: 8,
            marginBottom: 20,
            background: 'var(--surface-raised)',
            borderRadius: 'var(--r-md)',
            padding: 4,
          }}
        >
          {['qr', 'express', 'banco'].map((t) => (
            <button
              key={t}
              onClick={() => setReceberTab(t)}
              style={{
                flex: 1,
                padding: '8px 6px',
                border: 'none',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                background: receberTab === t ? 'var(--primary)' : 'transparent',
                color: receberTab === t ? '#000' : 'var(--text-muted)',
                transition: 'all .2s',
              }}
            >
              {t === 'qr' ? 'QR Code' : t === 'express' ? 'Express' : 'Banco / ATM'}
            </button>
          ))}
        </div>

        {receberTab === 'qr' && (
          <div>
            {qrStep === 1 && (
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Passo 1: Tipo de QR Code</div>
                <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
                  <button
                    onClick={() => setQrType('dynamic')}
                    style={{
                      flex: 1,
                      padding: '14px 8px',
                      borderRadius: 14,
                      border: qrType === 'dynamic' ? '2px solid var(--primary)' : '2px solid var(--border-default)',
                      background: qrType === 'dynamic' ? 'var(--primary-100)' : 'transparent',
                      color: qrType === 'dynamic' ? 'var(--primary)' : 'var(--text-muted)',
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: 'pointer',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: 20, marginBottom: 4 }}>⚡</div>
                    <div>Dinâmico</div>
                    <div style={{ fontSize: 10, fontWeight: 400, marginTop: 2, opacity: 0.8 }}>Expira com o tempo</div>
                  </button>
                  <button
                    onClick={() => setQrType('fixed')}
                    style={{
                      flex: 1,
                      padding: '14px 8px',
                      borderRadius: 14,
                      border: qrType === 'fixed' ? '2px solid var(--primary)' : '2px solid var(--border-default)',
                      background: qrType === 'fixed' ? 'var(--primary-100)' : 'transparent',
                      color: qrType === 'fixed' ? 'var(--primary)' : 'var(--text-muted)',
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: 'pointer',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: 20, marginBottom: 4 }}>🔒</div>
                    <div>Fixo</div>
                    <div style={{ fontSize: 10, fontWeight: 400, marginTop: 2, opacity: 0.8 }}>Sem expiração</div>
                  </button>
                </div>
                <button
                  onClick={() => (qrType === 'fixed' ? executeQRGeneration() : setQrStep(2))}
                  className="btn btn-primary btn-full"
                >
                  {qrType === 'fixed' ? 'Gerar QR Code' : 'Próximo'}
                </button>
              </div>
            )}

            {qrStep === 2 && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <button
                    onClick={() => setQrStep(1)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text)', fontSize: 20, cursor: 'pointer' }}
                  >
                    ←
                  </button>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>Passo 2: Duração</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 24 }}>
                  {[
                    { label: '1 Uso', ms: 0 },
                    { label: '15 min', ms: 900000 },
                    { label: '1 hora', ms: 3600000 },
                    { label: '24 h', ms: 86400000 },
                    { label: '1 sem', ms: 604800000 },
                    { label: 'Perm.', ms: -1 },
                  ].map((opt) => (
                    <button
                      key={opt.label}
                      onClick={() => setQrDuration(opt.ms)}
                      style={{
                        padding: '10px 4px',
                        borderRadius: 9,
                        border: qrDuration === opt.ms ? '1.5px solid var(--primary)' : '1.5px solid var(--border-default)',
                        background: qrDuration === opt.ms ? 'var(--primary-100)' : 'transparent',
                        color: qrDuration === opt.ms ? 'var(--primary)' : 'var(--text-muted)',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <button onClick={() => setQrStep(3)} className="btn btn-primary btn-full">
                  Próximo
                </button>
              </div>
            )}

            {qrStep === 3 && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <button
                    onClick={() => setQrStep(2)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text)', fontSize: 20, cursor: 'pointer' }}
                  >
                    ←
                  </button>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>Passo 3: Valor (Obrigatório)</div>
                </div>
                <div style={{ marginBottom: 24 }}>
                  <input
                    type="number"
                    placeholder="Introduzir montante em Kz (Ex: 5000)"
                    inputMode="decimal"
                    value={qrAmount}
                    onChange={(e) => setQrAmount(e.target.value)}
                    style={{
                      width: '100%',
                      padding: 14,
                      borderRadius: 12,
                      border: '1.5px solid var(--border-default)',
                      background: 'var(--surface-raised)',
                      color: 'var(--text)',
                      fontSize: 15,
                      fontWeight: 700,
                    }}
                  />
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
                    O pagador transferirá este valor exato.
                  </div>
                </div>
                <button onClick={executeQRGeneration} className="btn btn-primary btn-full">
                  Gerar QR Code
                </button>
              </div>
            )}

            {qrStep === 4 && generatedQR && (
              <div>
                <div
                  style={{
                    textAlign: 'center',
                    margin: '0 auto 12px',
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '5px 14px',
                    borderRadius: 20,
                    background: generatedQR.type === 'dynamic' ? 'rgba(0,242,254,0.18)' : 'rgba(148,163,184,0.15)',
                    color: generatedQR.type === 'dynamic' ? '#00f2fe' : '#94a3b8',
                    border: generatedQR.type === 'dynamic' ? '1px solid rgba(0,242,254,0.3)' : '1px solid transparent',
                    boxShadow: generatedQR.type === 'dynamic' ? '0 0 12px rgba(0,242,254,0.25)' : 'none',
                  }}
                >
                  {generatedQR.type === 'dynamic'
                    ? `⚡ QR DINÂMICO — ${generatedQR.durationLabel.toUpperCase()}`
                    : '🔒 QR FIXO — PERMANENTE'}
                </div>

                {generatedQR.expiresAt && qrDuration !== 0 && (
                  <div style={{ textAlign: 'center', marginBottom: 12 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Expira em: </span>
                    <span style={{ fontSize: 14, fontWeight: 900, color: 'var(--primary)', fontFamily: 'monospace' }}>
                      {countdownText}
                    </span>
                  </div>
                )}

                <div
                  style={{
                    background: 'var(--surface-raised)',
                    borderRadius: 10,
                    padding: '10px 14px',
                    marginBottom: 12,
                    fontSize: 13,
                    color: 'var(--text-muted)',
                  }}
                >
                  {generatedQR.amount ? (
                    <>
                      💰 Valor fixo: <strong style={{ color: 'var(--primary)' }}>{formatKz(generatedQR.amount)}</strong>
                    </>
                  ) : (
                    <>🔓 Valor livre — O pagador escolhe o valor a transferir.</>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                  <div style={{ background: '#fff', borderRadius: 20, padding: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
                    <QRCanvas
                      payload={generatedQR.payload}
                      size={180}
                      onCanvasReady={(c) => {
                        qrCanvasRef.current = c;
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                  <button
                    onClick={downloadQRasImage}
                    style={{
                      padding: '11px 6px',
                      borderRadius: 10,
                      border: '1px solid #2563eb',
                      background: 'rgba(37,99,235,0.1)',
                      color: '#60a5fa',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Baixar PNG
                  </button>
                  <button
                    onClick={downloadQRasPDF}
                    style={{
                      padding: '11px 6px',
                      borderRadius: 10,
                      border: '1px solid #dc2626',
                      background: 'rgba(220,38,38,0.1)',
                      color: '#f87171',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Baixar PDF
                  </button>
                </div>

                <button
                  onClick={() => {
                    setQrAmount('');
                    setQrStep(1);
                  }}
                  style={{
                    width: '100%',
                    padding: 11,
                    background: 'transparent',
                    border: '1px solid var(--border-default)',
                    borderRadius: 10,
                    color: 'var(--text-muted)',
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  🔄 Criar Outro QR Code
                </button>
              </div>
            )}

            <div style={{ marginTop: 16 }}>
              <button className="btn btn-ghost" style={{ width: '100%' }} onClick={() => setActiveSheet(null)}>
                Fechar Janela
              </button>
            </div>
          </div>
        )}

        {receberTab === 'express' && (
          <div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 18px', textAlign: 'center' }}>
              Receba fundos de forma rápida através de outro utilizador QPAY
            </p>

            <div style={{ background: 'var(--surface-raised)', borderRadius: 'var(--r-lg)', padding: 16, marginBottom: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>QR Express (Valor Fixo)</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                Gere um QR com valor pré-definido para cobranças rápidas
              </div>
              <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                <input
                  type="number"
                  placeholder="Valor em Kz"
                  value={expressAmount}
                  onChange={(e) => setExpressAmount(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: '1px solid var(--border-default)',
                    background: 'var(--surface-raised)',
                    color: 'var(--text)',
                    fontSize: 14,
                  }}
                />
                <button
                  onClick={generateExpressQR}
                  style={{
                    padding: '10px 16px',
                    background: 'var(--primary)',
                    color: '#000',
                    border: 'none',
                    borderRadius: 10,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Gerar QR
                </button>
              </div>
            </div>

            <div style={{ background: 'var(--surface-raised)', borderRadius: 'var(--r-lg)', padding: 16, marginBottom: 18 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Link de Pagamento</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                Partilhe o seu link de pagamento pessoal via WhatsApp ou SMS
              </div>
              <button
                onClick={() => {
                  const link = `${window.location.origin}/transferir?to=${user.phone}`;
                  navigator.clipboard?.writeText(link);
                  showToast('Link copiado! 📋', 'success');
                }}
                style={{
                  marginTop: 12,
                  width: '100%',
                  padding: 10,
                  background: 'transparent',
                  border: '1px solid var(--border-default)',
                  borderRadius: 10,
                  color: 'var(--text)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: 13,
                }}
              >
                📤 Copiar Link de Pagamento
              </button>
            </div>

            <button className="btn btn-ghost" style={{ width: '100%' }} onClick={() => setActiveSheet(null)}>
              Fechar
            </button>
          </div>
        )}

        {receberTab === 'banco' && (
          <div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 18px', textAlign: 'center' }}>
              Deposite via rede bancária tradicional
            </p>

            <div style={{ background: 'var(--surface-raised)', borderRadius: 'var(--r-lg)', padding: 16, marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>Depósito por IBAN / Transferência Bancária</div>
              <div style={{ background: '#0f172a', borderRadius: 8, padding: '10px 12px', marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', fontWeight: 600 }}>
                  IBAN
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700 }}>
                  AO06 0040 0000 0000 0000 0000 0
                </div>
              </div>
              <div style={{ background: '#0f172a', borderRadius: 8, padding: '10px 12px', marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', fontWeight: 600 }}>
                  Titular
                </div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{user.name}</div>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard?.writeText('AO06 0040 0000 0000 0000 0000 0');
                  showToast('IBAN copiado! 📋', 'success');
                }}
                style={{
                  width: '100%',
                  padding: 9,
                  background: 'transparent',
                  border: '1px solid var(--border-default)',
                  borderRadius: 9,
                  color: 'var(--text)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                📋 Copiar IBAN
              </button>
            </div>

            <div style={{ background: 'var(--surface-raised)', borderRadius: 'var(--r-lg)', padding: 16, marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>Pagamento por Referência (ATM)</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                <div style={{ background: '#0f172a', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', fontWeight: 600 }}>
                    Entidade
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 900, fontFamily: 'monospace' }}>11333</div>
                </div>
                <div style={{ background: '#0f172a', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', fontWeight: 600 }}>
                    Referência
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--primary)', fontFamily: 'monospace' }}>
                    {atmRef}
                  </div>
                </div>
              </div>
              <div style={{ background: '#0f172a', borderRadius: 8, padding: '10px 12px', marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', fontWeight: 600 }}>
                  Validade
                </div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>
                  {atmValidityDate.toLocaleDateString('pt-AO', { day: '2-digit', month: 'long', year: 'numeric' })}
                </div>
              </div>
            </div>

            <button className="btn btn-ghost" style={{ width: '100%' }} onClick={() => setActiveSheet(null)}>
              Fechar
            </button>
          </div>
        )}
      </div>

      {/* SHEET: LEVANTAR */}
      <div className={`sheet ${activeSheet === 'levantar' ? 'open' : ''}`}>
        <div className="sheet-handle" />
        <div className="sheet-title">Levantar Fundos</div>
        <div className="flex flex-col gap-4">
          <div
            style={{
              background: 'var(--warning-100)',
              border: '1px solid rgba(245,158,11,0.2)',
              borderRadius: 'var(--r-md)',
              padding: '12px 14px',
            }}
            className="flex items-center gap-2"
          >
            <span className="t-sm" style={{ color: 'var(--warning)' }}>
              Saldo disponível: <strong>{formatKz(user.balance)}</strong>
            </span>
          </div>
          <div className="input-group">
            <label className="input-label">Valor a levantar (Kz)</label>
            <input
              type="number"
              className="input input-amount"
              placeholder="0,00"
              min="100"
              inputMode="decimal"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
            />
          </div>
          <div className="flex gap-3 mt-2">
            <button className="btn btn-ghost flex-1" onClick={() => setActiveSheet(null)}>
              Cancelar
            </button>
            <button className="btn btn-primary flex-1" onClick={doWithdraw} disabled={withdrawing}>
              {withdrawing ? <div className="spinner" /> : 'Confirmar'}
            </button>
          </div>
        </div>
      </div>

      {/* EXPRESS QR POPUP */}
      {expressPopup && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setExpressPopup(null);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              background: '#1a1a2e',
              borderRadius: 24,
              padding: 28,
              textAlign: 'center',
              maxWidth: 300,
              width: '90%',
              border: '1px solid rgba(0,242,254,0.3)',
              boxShadow: '0 24px 64px rgba(0,0,0,0.8), 0 0 30px rgba(0,242,254,0.25)',
              background: 'rgba(8,20,44,0.92)',
              backdropFilter: 'blur(24px)',
            }}
          >
            <div style={{ fontWeight: 900, fontSize: 20, marginBottom: 4, color: '#fff' }}>QR Express</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: '#00f2fe', textShadow: '0 0 16px rgba(0,242,254,0.5)', marginBottom: 16 }}>
              {formatKz(expressPopup.amount)}
            </div>
            <div style={{ background: '#fff', borderRadius: 16, padding: 14, display: 'inline-block', marginBottom: 14 }}>
              <QRCanvas payload={expressPopup.payload} size={180} />
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>⏱ Expira em 30 minutos</div>
            <button
              onClick={() => setExpressPopup(null)}
              style={{
                width: '100%',
                padding: 12,
                background: 'transparent',
                border: '1px solid #334155',
                borderRadius: 10,
                color: '#94a3b8',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

