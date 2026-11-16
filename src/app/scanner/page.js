'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useQPay } from '@/context/QPayContext';
import { parseQRPayload, buildQRPayload, formatKz, getInitials } from '@/lib/utils';
import BottomNav from '@/components/BottomNav';

export default function ScannerPage() {
  const router = useRouter();
  const { user, loadingAuth, refreshUser, showToast, viewTransactionReceipt } = useQPay();

  const [merchants, setMerchants] = useState([]);
  const [rawInput, setRawInput] = useState('');
  const [parsedQR, setParsedQR] = useState(null);
  const [customAmount, setCustomAmount] = useState('');
  const [pin, setPin] = useState(['', '', '', '']);
  const [paying, setPaying] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const pinRefs = [useRef(null), useRef(null), useRef(null), useRef(null)];

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
            setMerchants((d.users || []).filter((u) => u.id !== user.id && u.role === 'user'));
          }
        })
        .catch(() => {});
    }
  }, [user, loadingAuth, router]);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  if (loadingAuth || !user) return null;

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      setCameraActive(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      }, 100);
    } catch {
      showToast('Câmara não disponível neste navegador. Use a simulação ou cole o QR abaixo.', 'info');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const handleDecodePayload = (raw) => {
    const parsed = parseQRPayload(raw);
    if (!parsed) {
      showToast('QR Code QPAY inválido', 'error');
      return;
    }
    if (parsed.merchantId === user.id) {
      showToast('Não pode pagar ao seu próprio QR Code', 'error');
      return;
    }
    if (parsed.expiresAt && new Date(parsed.expiresAt) < new Date()) {
      showToast('Este QR Code já expirou', 'error');
      return;
    }
    stopCamera();
    setParsedQR(parsed);
    setCustomAmount(parsed.amount ? String(parsed.amount) : '');
    setPin(['', '', '', '']);
  };

  const simulateMerchantQR = (merchant, withAmount = null) => {
    const payload = buildQRPayload(withAmount ? 'dynamic' : 'fixed', merchant, {
      amount: withAmount,
      description: withAmount ? `Venda QR · ${merchant.name}` : `QR Fixo · ${merchant.name}`,
    });
    handleDecodePayload(payload);
  };

  const handlePinChange = (i, val) => {
    const d = val.replace(/\D/g, '').slice(-1);
    const next = [...pin];
    next[i] = d;
    setPin(next);
    if (d && i < 3) pinRefs[i + 1].current?.focus();
  };

  const confirmQRPayment = async () => {
    const finalAmount = parsedQR.amount ? Number(parsedQR.amount) : parseFloat(customAmount);
    if (!finalAmount || finalAmount <= 0) {
      showToast('Insira um valor válido para pagar', 'error');
      return;
    }
    const pinCode = pin.join('');
    if (pinCode.length !== 4) {
      showToast('Confirme com o seu PIN de 4 dígitos', 'error');
      return;
    }

    setPaying(true);
    try {
      const res = await fetch('/api/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'payByQR',
          payerUserId: user.id,
          pin: pinCode,
          qrData: {
            ...parsedQR,
            amount: finalAmount,
          },
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Pagamento de ${formatKz(finalAmount)} concluído! 🎉`, 'success');
        await refreshUser(user.id);
        setParsedQR(null);
        if (data.transaction) {
          viewTransactionReceipt(data.transaction);
        }
      } else {
        showToast(data.message || 'Erro no pagamento QR', 'error');
      }
    } catch {
      showToast('Erro de comunicação com o servidor', 'error');
    } finally {
      setPaying(false);
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
        <span className="header-title">Pagar com QR Code</span>
        <div style={{ width: 38 }} />
      </div>

      <div className="page page-enter">
        <div className="page-inner">
          <div style={{ height: 16 }} />

          {!parsedQR ? (
            <>
              {/* CAMERA VIEWPORT */}
              <div
                className="card mb-5"
                style={{
                  textAlign: 'center',
                  padding: 24,
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {cameraActive ? (
                  <div>
                    <video
                      ref={videoRef}
                      style={{ width: '100%', maxHeight: 260, borderRadius: 16, background: '#000', objectFit: 'cover' }}
                      playsInline
                      muted
                    />
                    <button className="btn btn-ghost btn-full mt-3" onClick={stopCamera}>
                      Desligar Câmara
                    </button>
                  </div>
                ) : (
                  <div>
                    <div
                      style={{
                        width: 180,
                        height: 180,
                        margin: '0 auto 16px',
                        border: '2px dashed var(--primary)',
                        borderRadius: 24,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'var(--primary-50)',
                        color: 'var(--primary)',
                      }}
                    >
                      <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <rect x="3" y="3" width="7" height="7" rx="1" />
                        <rect x="14" y="3" width="7" height="7" rx="1" />
                        <rect x="3" y="14" width="7" height="7" rx="1" />
                        <path d="M14 14h.01M14 17h3M17 14h3M17 17v3" />
                      </svg>
                      <span className="t-xs fw-bold mt-2">Leitor QR QPAY</span>
                    </div>
                    <button className="btn btn-primary btn-full" onClick={startCamera}>
                      📷 Abrir Câmara para Escanear
                    </button>
                  </div>
                )}
              </div>

              {/* PASTE QR PAYLOAD */}
              <div className="card mb-5">
                <div className="t-sm fw-bold mb-2">Colar Código QR</div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="input"
                    placeholder='Cole aqui o código {"v":"1.0","app":"QPAY-AO"...}'
                    value={rawInput}
                    onChange={(e) => setRawInput(e.target.value)}
                  />
                  <button
                    className="btn btn-primary"
                    onClick={() => handleDecodePayload(rawInput)}
                    style={{ flexShrink: 0 }}
                  >
                    Ler
                  </button>
                </div>
              </div>

              {/* QUICK DEMO MERCHANTS */}
              <div className="sec-header">
                <span className="sec-title">Simular Leitura de QR (Comerciantes Demo)</span>
              </div>
              <div className="flex flex-col gap-2 mb-6">
                {merchants.map((m) => (
                  <div key={m.id} className="card" style={{ padding: 14 }}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="avatar avatar-sm">{getInitials(m.name)}</div>
                        <div>
                          <div className="t-sm fw-bold">{m.name}</div>
                          <div className="t-xs text-muted">+244 {m.phone}</div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => simulateMerchantQR(m, null)}
                        >
                          QR Fixo
                        </button>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => simulateMerchantQR(m, 2500)}
                        >
                          QR 2.500 Kz
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            /* PAYMENT CONFIRMATION PANEL */
            <div className="card">
              <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <div className="avatar avatar-lg" style={{ margin: '0 auto 10px' }}>
                  {getInitials(parsedQR.merchantName)}
                </div>
                <div className="t-lg fw-bold">{parsedQR.merchantName}</div>
                <div className="t-sm text-muted">+244 {parsedQR.merchantPhone || '—'}</div>
                <div
                  style={{
                    display: 'inline-block',
                    marginTop: 8,
                    padding: '4px 12px',
                    borderRadius: 20,
                    fontSize: 11,
                    fontWeight: 700,
                    background: 'var(--primary-100)',
                    color: 'var(--primary)',
                  }}
                >
                  {parsedQR.amount ? '⚡ QR Dinâmico (Valor Fixo)' : '🔒 QR Fixo (Valor Livre)'}
                </div>
              </div>

              <div className="input-group mb-4">
                <label className="input-label">Valor a Pagar (Kz)</label>
                <input
                  type="number"
                  className="input input-amount"
                  placeholder="0,00"
                  value={customAmount}
                  readOnly={Boolean(parsedQR.amount)}
                  onChange={(e) => setCustomAmount(e.target.value)}
                />
                <div className="t-xs text-muted mt-1">
                  Saldo disponível: <strong className="text-success">{formatKz(user.balance)}</strong>
                </div>
              </div>

              {parsedQR.description && (
                <div className="mb-4" style={{ background: 'var(--surface-raised)', padding: 12, borderRadius: 10 }}>
                  <div className="t-xs text-muted">Descrição</div>
                  <div className="t-sm fw-semibold">{parsedQR.description}</div>
                </div>
              )}

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
                <button className="btn btn-ghost flex-1" onClick={() => setParsedQR(null)}>
                  Cancelar
                </button>
                <button className="btn btn-primary flex-1" onClick={confirmQRPayment} disabled={paying}>
                  {paying ? <div className="spinner" /> : 'Confirmar Pagamento'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}

