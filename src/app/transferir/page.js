'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useQPay } from '@/context/QPayContext';
import { formatKz, getInitials } from '@/lib/utils';
import BottomNav from '@/components/BottomNav';

export default function TransferirPage() {
  const router = useRouter();
  const { user, loadingAuth, refreshUser, showToast } = useQPay();

  const [step, setStep] = useState(0); // 0: recipient, 1: amount, 2: confirm, 3: success
  const [contacts, setContacts] = useState([]);
  const [recipientPhone, setRecipientPhone] = useState('');
  const [selectedRecipient, setSelectedRecipient] = useState(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [pin, setPin] = useState(['', '', '', '']);
  const [submitting, setSubmitting] = useState(false);
  const [resultData, setResultData] = useState(null);
  const [showReceiptOptions, setShowReceiptOptions] = useState(false);

  const pinRefs = [useRef(null), useRef(null), useRef(null), useRef(null)];
  const stepTitles = ['Transferir', 'Valor a enviar', 'Confirmar', 'Concluído'];

  useEffect(() => {
    if (!loadingAuth) {
      if (!user) {
        router.push('/');
        return;
      }
      fetch('/api/users')
        .then((r) => r.json())
        .then((d) => {
          if (d.success) {
            const list = (d.users || []).filter((u) => u.id !== user.id && u.role === 'user');
            setContacts(list);
          }
        })
        .catch(() => {});
    }
  }, [user, loadingAuth, router]);

  if (loadingAuth || !user) return null;

  const selectContact = (c) => {
    setSelectedRecipient(c);
    setRecipientPhone(c.phone);
  };

  const goToAmount = async () => {
    const clean = recipientPhone.replace(/\s/g, '');
    if (!clean) {
      showToast('Seleccione ou insira o número do destinatário', 'error');
      return;
    }

    let rec = selectedRecipient;
    if (!rec || rec.phone !== clean) {
      rec = contacts.find((c) => c.phone === clean) || null;
      if (!rec) {
        const res = await fetch(`/api/users?phone=${clean}`);
        const data = await res.json();
        if (data.success) rec = data.user;
      }
    }

    if (!rec) {
      showToast('Número não encontrado no QPAY AO', 'error');
      return;
    }
    if (rec.id === user.id) {
      showToast('Não pode transferir para si mesmo', 'error');
      return;
    }

    setSelectedRecipient(rec);
    setStep(1);
  };

  const goToConfirm = () => {
    const amt = parseFloat(amount);
    if (!amt || amt < 50) {
      showToast('Valor mínimo: 50 Kz', 'error');
      return;
    }
    if (amt > user.balance) {
      showToast('Saldo insuficiente', 'error');
      return;
    }
    setPin(['', '', '', '']);
    setStep(2);
    setTimeout(() => pinRefs[0].current?.focus(), 100);
  };

  const handlePinChange = (i, val) => {
    const d = val.replace(/\D/g, '').slice(-1);
    const next = [...pin];
    next[i] = d;
    setPin(next);
    if (d && i < 3) pinRefs[i + 1].current?.focus();
  };

  const doTransfer = async () => {
    const pinCode = pin.join('');
    if (pinCode.length !== 4) {
      showToast('PIN incompleto', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'transfer',
          fromUserId: user.id,
          toPhone: selectedRecipient.phone,
          amount: parseFloat(amount),
          note: note.trim(),
          pin: pinCode,
        }),
      });
      const data = await res.json();
      if (data.success) {
        await refreshUser(user.id);
        setResultData({
          recipient: data.recipient,
          amount: parseFloat(amount),
          newBalance: data.newBalance,
          date: new Date().toLocaleString('pt-AO'),
          note: note.trim() || '---',
          txId: data.transaction?.id || 'TX' + Date.now().toString(36).toUpperCase(),
        });
        setShowReceiptOptions(false);
        setStep(3);
      } else {
        showToast(data.message || 'Erro na transferência', 'error');
      }
    } catch {
      showToast('Erro de comunicação com o servidor', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const downloadReceiptImage = async () => {
    const el = document.getElementById('receipt-template');
    if (!el) return;
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff' });
      const link = document.createElement('a');
      link.download = `Comprovativo_QPAY_${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      showToast('Comprovativo (Imagem) baixado!', 'success');
    } catch {
      showToast('Erro ao gerar imagem', 'error');
    }
  };

  const downloadReceiptPDF = async () => {
    const el = document.getElementById('receipt-template');
    if (!el) return;
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
      pdf.save(`Comprovativo_QPAY_${Date.now()}.pdf`);
      showToast('Comprovativo (PDF) baixado!', 'success');
    } catch {
      showToast('Erro ao gerar PDF', 'error');
    }
  };

  return (
    <div className="app-wrapper">
      <div className="bg-glow" />

      <div className="header">
        <button
          className="icon-btn"
          style={{ visibility: step === 3 ? 'hidden' : 'visible' }}
          onClick={() => (step === 0 ? router.push('/dashboard') : setStep(step - 1))}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span className="header-title">{stepTitles[step]}</span>
        <div style={{ width: 38 }} />
      </div>

      <div className="page page-enter">
        <div className="page-inner">
          <div style={{ height: 16 }} />

          <div className="step-dots mb-6">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className={`step-dot ${i <= step && step < 3 ? 'active' : ''}`} />
            ))}
          </div>

          {/* STEP 0: RECIPIENT */}
          {step === 0 && (
            <div>
              <div className="t-xl fw-bold mb-1">Quem vai receber?</div>
              <div className="t-sm text-muted mb-5">Seleccione um contacto ou insira o número</div>

              <div className="input-group mb-4">
                <label className="input-label">Número de telefone</label>
                <div className="input-wrap">
                  <input
                    type="tel"
                    className="input"
                    placeholder="9XX XXX XXX"
                    maxLength={9}
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value.replace(/\D/g, '').slice(0, 9))}
                  />
                </div>
              </div>

              <div className="sec-title mb-3">Contactos QPAY AO</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {contacts.map((u) => (
                  <div
                    key={u.id}
                    className={`contact-item ${selectedRecipient?.id === u.id ? 'selected' : ''}`}
                    onClick={() => selectContact(u)}
                  >
                    <div className="avatar avatar-md">{getInitials(u.name)}</div>
                    <div className="contact-info">
                      <div className="name">{u.name}</div>
                      <div className="phone">{u.phone.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3')}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ height: 20 }} />
              <button className="btn btn-primary btn-full" onClick={goToAmount}>
                Continuar
              </button>
            </div>
          )}

          {/* STEP 1: AMOUNT */}
          {step === 1 && selectedRecipient && (
            <div>
              <div style={{ textAlign: 'center', marginBottom: 28 }}>
                <div className="avatar avatar-lg" style={{ margin: '0 auto 12px' }}>
                  {getInitials(selectedRecipient.name)}
                </div>
                <div className="t-lg fw-bold">{selectedRecipient.name}</div>
                <div className="t-sm text-muted mt-1">
                  {selectedRecipient.phone.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3')}
                </div>
              </div>

              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-muted)', textAlign: 'center' }}>Kz</div>
              <input
                type="number"
                className="input"
                placeholder="0,00"
                style={{
                  fontSize: 48,
                  fontWeight: 900,
                  textAlign: 'center',
                  border: 'none',
                  background: 'transparent',
                  outline: 'none',
                  width: '100%',
                  marginBottom: 8,
                }}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <div className="t-sm text-center text-muted mb-6">
                Saldo disponível: <span className="text-success fw-semibold">{formatKz(user.balance)}</span>
              </div>

              <div className="flex gap-2 mb-5 justify-center flex-wrap">
                {[500, 1000, 2500, 5000].map((v) => (
                  <button key={v} className="btn btn-ghost btn-sm" onClick={() => setAmount(String(v))}>
                    {v} Kz
                  </button>
                ))}
              </div>

              <div className="input-group mb-5">
                <label className="input-label">Nota (opcional)</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Ex: Pagamento de aluguer"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>

              <button className="btn btn-primary btn-full" onClick={goToConfirm}>
                Continuar
              </button>
            </div>
          )}

          {/* STEP 2: CONFIRM */}
          {step === 2 && selectedRecipient && (
            <div>
              <div className="t-xl fw-bold mb-1">Confirmar Transferência</div>
              <div className="t-sm text-muted mb-5">Verifique os dados antes de confirmar</div>

              <div className="card mb-5">
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <span className="t-sm text-secondary">Para</span>
                  <span className="t-sm fw-semibold">{selectedRecipient.name}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <span className="t-sm text-secondary">Número</span>
                  <span className="t-sm fw-semibold">{selectedRecipient.phone}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <span className="t-sm text-secondary">Valor</span>
                  <span className="t-lg fw-black text-primary-c">{formatKz(amount)}</span>
                </div>
                {note && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                    <span className="t-sm text-secondary">Nota</span>
                    <span className="t-sm fw-medium">{note}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0' }}>
                  <span className="t-sm text-secondary">Saldo após</span>
                  <span className="t-sm fw-semibold">{formatKz(user.balance - parseFloat(amount))}</span>
                </div>
              </div>

              <div className="t-sm fw-medium text-center mb-3" style={{ color: 'var(--text-secondary)' }}>
                🔒 Confirme com o seu PIN
              </div>
              <div className="pin-row mb-5">
                {[0, 1, 2, 3].map((i) => (
                  <input
                    key={i}
                    ref={pinRefs[i]}
                    type="password"
                    className="pin-digit"
                    maxLength={1}
                    inputMode="numeric"
                    value={pin[i]}
                    onChange={(e) => handlePinChange(i, e.target.value)}
                  />
                ))}
              </div>

              <div className="flex gap-3">
                <button className="btn btn-ghost flex-1" onClick={() => setStep(1)}>
                  Voltar
                </button>
                <button className="btn btn-primary flex-1" onClick={doTransfer} disabled={submitting}>
                  {submitting ? <div className="spinner" /> : 'Transferir'}
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: SUCCESS */}
          {step === 3 && resultData && (
            <div style={{ textAlign: 'center', padding: '32px 0 20px' }}>
              <div className="success-ring">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div className="t-2xl fw-black mt-5">Transferência Enviada!</div>
              <div className="t-base text-muted mt-2">O dinheiro foi entregue com sucesso</div>

              <div className="card mt-6 mb-5" style={{ textAlign: 'left' }}>
                <div className="info-row">
                  <span className="label">Transferido para</span>
                  <span className="value">{resultData.recipient.name}</span>
                </div>
                <div className="info-row">
                  <span className="label">Valor transferido</span>
                  <span className="value text-success">{formatKz(resultData.amount)}</span>
                </div>
                <div className="info-row">
                  <span className="label">Novo saldo</span>
                  <span className="value">{formatKz(resultData.newBalance)}</span>
                </div>
                <div className="info-row" style={{ border: 'none' }}>
                  <span className="label">Data/Hora</span>
                  <span className="value">{resultData.date}</span>
                </div>
              </div>

              {!showReceiptOptions ? (
                <button
                  className="btn btn-primary btn-full mb-4"
                  onClick={() => setShowReceiptOptions(true)}
                  style={{ background: 'var(--primary)', color: '#000', border: 'none' }}
                >
                  Baixar Comprovativo
                </button>
              ) : (
                <div className="flex gap-2 mb-4">
                  <button
                    className="btn flex-1"
                    onClick={downloadReceiptImage}
                    style={{ background: '#2563eb', color: '#fff', border: 'none' }}
                  >
                    Imagem
                  </button>
                  <button
                    className="btn flex-1"
                    onClick={downloadReceiptPDF}
                    style={{ background: '#dc2626', color: '#fff', border: 'none' }}
                  >
                    PDF
                  </button>
                </div>
              )}

              <div className="flex gap-3">
                <button className="btn btn-ghost flex-1" onClick={() => router.push('/historico')}>
                  Histórico
                </button>
                <button className="btn btn-primary flex-1" onClick={() => router.push('/dashboard')}>
                  Início
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* HIDDEN RECEIPT TEMPLATE */}
      {resultData && (
        <div
          id="receipt-template"
          style={{
            position: 'absolute',
            top: -9999,
            left: -9999,
            width: 400,
            padding: 30,
            background: '#fff',
            color: '#111',
            fontFamily: 'Inter, sans-serif',
            borderRadius: 12,
            zIndex: -1,
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <h2 style={{ margin: 0, color: '#2563eb', fontWeight: 900, fontSize: 28 }}>QPAY AO</h2>
            <p style={{ margin: '4px 0 0', color: '#666', fontSize: 14 }}>Comprovativo de Transferência</p>
          </div>
          <div style={{ borderBottom: '2px dashed #ddd', marginBottom: 20 }} />
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: '#888', textTransform: 'uppercase', fontWeight: 600 }}>
              Valor da Transferência
            </div>
            <div style={{ fontSize: 34, fontWeight: 900, color: '#111', marginTop: 4 }}>
              {formatKz(resultData.amount)}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontSize: 14 }}>
            <span style={{ color: '#666' }}>Data / Hora</span>
            <strong>{resultData.date}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontSize: 14 }}>
            <span style={{ color: '#666' }}>Remetente</span>
            <strong>{user.name}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontSize: 14 }}>
            <span style={{ color: '#666' }}>Destinatário</span>
            <strong>{resultData.recipient.name}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontSize: 14 }}>
            <span style={{ color: '#666' }}>Nº Telefone</span>
            <strong>{resultData.recipient.phone}</strong>
          </div>
          <div style={{ borderTop: '2px dashed #ddd', paddingTop: 20, textAlign: 'center', color: '#888', fontSize: 12 }}>
            ID de Transacção: {resultData.txId}
            <br />
            Obrigado por usar a carteira digital QPAY AO!
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}

