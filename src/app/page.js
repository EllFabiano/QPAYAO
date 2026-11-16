'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQPay } from '@/context/QPayContext';
import { validateNIF, sanitizeNifInput } from '@/lib/utils';

export default function LoginPage() {
  const router = useRouter();
  const { user, loginUser, showToast } = useQPay();

  const [tab, setTab] = useState('login');
  const [loginPhone, setLoginPhone] = useState('');
  const [loginPin, setLoginPin] = useState(['', '', '', '']);
  const [submitting, setSubmitting] = useState(false);

  // Register state
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regNif, setRegNif] = useState('');
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [newPin, setNewPin] = useState(['', '', '', '']);
  const [confirmPin, setConfirmPin] = useState(['', '', '', '']);

  const lpRefs = [useRef(null), useRef(null), useRef(null), useRef(null)];
  const npRefs = [useRef(null), useRef(null), useRef(null), useRef(null)];
  const cpRefs = [useRef(null), useRef(null), useRef(null), useRef(null)];

  useEffect(() => {
    if (user) {
      if (user.role === 'admin') router.push('/admin');
      else if (user.role === 'agent') router.push('/agent');
      else router.push('/dashboard');
    }
  }, [user, router]);

  const handlePinChange = (index, val, arr, setArr, refs) => {
    const digit = val.replace(/\D/g, '').slice(-1);
    const next = [...arr];
    next[index] = digit;
    setArr(next);
    if (digit && index < 3 && refs[index + 1].current) {
      refs[index + 1].current.focus();
    }
  };

  const handlePinKeyDown = (index, e, arr, refs) => {
    if (e.key === 'Backspace' && !arr[index] && index > 0 && refs[index - 1].current) {
      refs[index - 1].current.focus();
    }
  };

  const fillDemo = (phone, pin) => {
    setLoginPhone(phone);
    setLoginPin(pin.split(''));
    showToast('Credenciais demo preenchidas! Clique em Entrar.', 'info');
  };

  const doLogin = async () => {
    const phone = loginPhone.trim();
    const pin = loginPin.join('');
    if (!phone) {
      showToast('Insira o número de telefone', 'error');
      return;
    }
    if (pin.length !== 4) {
      showToast('PIN incompleto', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, pin }),
      });
      const data = await res.json();
      if (data.success) {
        loginUser(data.user);
        showToast(`Bem-vindo(a), ${data.user.name.split(' ')[0]}! 👋`, 'success');
        if (data.user.role === 'admin') router.push('/admin');
        else if (data.user.role === 'agent') router.push('/agent');
        else router.push('/dashboard');
      } else {
        showToast(data.message || 'Erro no login', 'error');
      }
    } catch {
      showToast('Erro de comunicação com o servidor', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const doRegisterNext = () => {
    const name = regName.trim();
    const phone = regPhone.replace(/\D/g, '');
    const nif = regNif.trim().toUpperCase();

    if (!name || name.length < 2) {
      showToast('Insira o nome completo.', 'error');
      return;
    }
    if (!phone || phone.length !== 9) {
      showToast('Insira 9 dígitos do telefone (sem o +244).', 'error');
      return;
    }
    if (!validateNIF(nif)) {
      showToast('NIF inválido. Formato: 9 dígitos + 2 letras + 3 dígitos (ex: 008050798UE048)', 'error');
      return;
    }

    setNewPin(['', '', '', '']);
    setConfirmPin(['', '', '', '']);
    setPinModalOpen(true);
    setTimeout(() => npRefs[0].current?.focus(), 150);
  };

  const finalizeRegister = async () => {
    const pin = newPin.join('');
    const pinConf = confirmPin.join('');

    if (pin.length !== 4) {
      showToast('O PIN deve ter 4 dígitos.', 'error');
      return;
    }
    if (pin !== pinConf) {
      showToast('Os PINs não coincidem.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: regName.trim(),
          phone: regPhone.replace(/\D/g, ''),
          nif: regNif.trim().toUpperCase(),
          pin,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setPinModalOpen(false);
        loginUser(data.user);
        showToast('Conta criada com sucesso! 🎉', 'success');
        router.push('/dashboard');
      } else {
        showToast(data.message || 'Erro ao criar conta', 'error');
      }
    } catch {
      showToast('Erro de comunicação com o servidor', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const nifValid = regNif.length === 14 && validateNIF(regNif);

  return (
    <div className="app-wrapper">
      <div className="bg-glow" />

      <div className="landing-wrap page-enter">
        {/* LOGO NO TOPO */}
        <div className="landing-top">
          <div className="logo" style={{ justifyContent: 'center' }}>
            <img
              src="/Img/Qpaylogo.png"
              alt="QPAY AO"
              style={{ height: 38, width: 'auto', borderRadius: 8, marginRight: 10 }}
            />
            <span className="logo-name gradient-text">QPAY AO</span>
          </div>
        </div>

        {/* AUTH FORM */}
        <div className="auth-box">
          <div className="auth-tabs">
            <div
              className={`auth-tab ${tab === 'login' ? 'active' : ''}`}
              onClick={() => setTab('login')}
            >
              Entrar
            </div>
            <div
              className={`auth-tab ${tab === 'register' ? 'active' : ''}`}
              onClick={() => setTab('register')}
            >
              Criar Conta
            </div>
          </div>

          {tab === 'login' ? (
            <div className="flex flex-col gap-4">
              <div className="input-group">
                <label className="input-label">Número de Telefone</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
                  <div
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 12,
                      padding: '0 14px',
                      display: 'flex',
                      alignItems: 'center',
                      fontSize: 14,
                      fontWeight: 700,
                      color: 'var(--primary)',
                      whiteSpace: 'nowrap',
                      letterSpacing: '.04em',
                      flexShrink: 0,
                    }}
                  >
                    +244
                  </div>
                  <div className="input-wrap" style={{ flex: 1 }}>
                    <input
                      type="tel"
                      className="input"
                      placeholder="9XX XXX XXX"
                      maxLength={9}
                      inputMode="numeric"
                      value={loginPhone}
                      onChange={(e) => setLoginPhone(e.target.value.replace(/\D/g, '').slice(0, 9))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') lpRefs[0].current?.focus();
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="input-group">
                <label className="input-label">PIN (4 dígitos)</label>
                <div className="pin-row">
                  {[0, 1, 2, 3].map((i) => (
                    <input
                      key={i}
                      ref={lpRefs[i]}
                      type="password"
                      className="pin-digit"
                      maxLength={1}
                      inputMode="numeric"
                      autoComplete="off"
                      value={loginPin[i]}
                      onChange={(e) => handlePinChange(i, e.target.value, loginPin, setLoginPin, lpRefs)}
                      onKeyDown={(e) => handlePinKeyDown(i, e, loginPin, lpRefs)}
                    />
                  ))}
                </div>
              </div>

              <button
                className="btn btn-primary btn-full mt-2"
                onClick={doLogin}
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <div className="spinner" /> A verificar...
                  </>
                ) : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                      <polyline points="10 17 15 12 10 7" />
                      <line x1="15" y1="12" x2="3" y2="12" />
                    </svg>
                    Entrar na Carteira
                  </>
                )}
              </button>

              <div className="demo-hint">
                <div style={{ fontWeight: 700, color: 'var(--primary)', marginBottom: 8, textTransform: 'uppercase', fontSize: 11, letterSpacing: '.05em', textAlign: 'center' }}>
                  Contas Demo (clique para preencher)
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'left', fontSize: 12 }}>
                  <div
                    style={{ cursor: 'pointer', padding: '6px 10px', borderRadius: 8, background: 'rgba(0,242,254,0.06)', border: '1px solid rgba(0,242,254,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                    onClick={() => fillDemo('940375951', '1122')}
                  >
                    <div>👑 <strong>Admin:</strong> 940375951</div>
                    <div>PIN: <strong style={{ color: 'var(--primary)' }}>1122</strong></div>
                  </div>
                  <div
                    style={{ cursor: 'pointer', padding: '6px 10px', borderRadius: 8, background: 'rgba(0,242,254,0.06)', border: '1px solid rgba(0,242,254,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                    onClick={() => fillDemo('930000001', '9999')}
                  >
                    <div>🏦 <strong>Agente:</strong> 930000001</div>
                    <div>PIN: <strong style={{ color: 'var(--primary)' }}>9999</strong></div>
                  </div>
                  <div
                    style={{ cursor: 'pointer', padding: '6px 10px', borderRadius: 8, background: 'rgba(0,242,254,0.06)', border: '1px solid rgba(0,242,254,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                    onClick={() => fillDemo('923456789', '1234')}
                  >
                    <div>👤 <strong>Utilizador:</strong> 923456789</div>
                    <div>PIN: <strong style={{ color: 'var(--primary)' }}>1234</strong></div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="input-group">
                <label className="input-label">Nome Completo</label>
                <div className="input-wrap">
                  <div className="input-icon-wrap left">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 18, height: 18 }}>
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    className="input input-icon-l"
                    placeholder="Ex: João Manuel"
                    autoComplete="name"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                  />
                </div>
              </div>

              <div className="input-group">
                <label className="input-label">Número de Telefone</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
                  <div
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 12,
                      padding: '0 14px',
                      display: 'flex',
                      alignItems: 'center',
                      fontSize: 14,
                      fontWeight: 700,
                      color: 'var(--primary)',
                      whiteSpace: 'nowrap',
                      letterSpacing: '.04em',
                      flexShrink: 0,
                    }}
                  >
                    +244
                  </div>
                  <div className="input-wrap" style={{ flex: 1 }}>
                    <input
                      type="tel"
                      className="input"
                      placeholder="9XX XXX XXX"
                      maxLength={9}
                      inputMode="numeric"
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value.replace(/\D/g, '').slice(0, 9))}
                    />
                  </div>
                </div>
              </div>

              <div className="input-group">
                <label className="input-label">
                  NIF — Número de Identificação Fiscal <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <div className="input-wrap">
                  <input
                    type="text"
                    className="input"
                    placeholder="000000000AA000"
                    maxLength={14}
                    value={regNif}
                    onChange={(e) => setRegNif(sanitizeNifInput(e.target.value))}
                    style={{ fontFamily: 'monospace', letterSpacing: '.06em', fontSize: 15 }}
                  />
                </div>
                <p
                  style={{
                    fontSize: 11,
                    marginTop: 5,
                    color:
                      regNif.length === 0
                        ? 'var(--text-muted)'
                        : nifValid
                        ? 'var(--success)'
                        : 'var(--warning)',
                  }}
                >
                  {regNif.length === 0
                    ? 'Formato: 9 dígitos + 2 letras maiúsculas + 3 dígitos (ex: 008050798UE048)'
                    : nifValid
                    ? '✓ NIF válido'
                    : `${14 - regNif.length} caractere(s) em falta`}
                </p>
              </div>

              <button className="btn btn-primary btn-full mt-2" onClick={doRegisterNext}>
                Continuar
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* INFORMAÇÕES E VANTAGENS (Abaixo do formulário) */}
        <div className="landing-info-bottom">
          <p className="hero-sub">
            Carteira digital segura para pequenos comerciantes e vendedores da província do Uíge
          </p>

          <div className="feature-chips">
            <div className="f-chip">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              Seguro
            </div>
            <div className="f-chip">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              Rápido
            </div>
            <div className="f-chip">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="5" width="20" height="14" rx="2" />
                <line x1="2" y1="10" x2="22" y2="10" />
              </svg>
              Sem Conta Bancária
            </div>
            <div className="f-chip">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              Para Todos
            </div>
          </div>
        </div>

        <p style={{ textAlign: 'center', marginTop: 18, fontSize: 11, color: 'var(--text-muted)' }}>
          © 2026 QPAY AO · Uíge, Angola · Next.js + Prisma
        </p>
      </div>

      {/* MODAL: CRIAR PIN */}
      <div className={`modal-overlay ${pinModalOpen ? 'open' : ''}`}>
        <div className="modal">
          <div className="modal-header">
            <h3 className="modal-title">Definir PIN de Segurança</h3>
            <button className="modal-close" onClick={() => setPinModalOpen(false)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <div className="modal-body">
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
              Crie um PIN de 4 dígitos para proteger a sua conta.
            </p>

            <div className="input-group">
              <label className="input-label">Novo PIN</label>
              <div className="pin-row">
                {[0, 1, 2, 3].map((i) => (
                  <input
                    key={i}
                    ref={npRefs[i]}
                    type="password"
                    className="pin-digit"
                    maxLength={1}
                    inputMode="numeric"
                    autoComplete="off"
                    value={newPin[i]}
                    onChange={(e) => handlePinChange(i, e.target.value, newPin, setNewPin, npRefs)}
                    onKeyDown={(e) => handlePinKeyDown(i, e, newPin, npRefs)}
                  />
                ))}
              </div>
            </div>

            <div className="input-group" style={{ marginTop: 20 }}>
              <label className="input-label">Confirmar PIN</label>
              <div className="pin-row">
                {[0, 1, 2, 3].map((i) => (
                  <input
                    key={i}
                    ref={cpRefs[i]}
                    type="password"
                    className="pin-digit"
                    maxLength={1}
                    inputMode="numeric"
                    autoComplete="off"
                    value={confirmPin[i]}
                    onChange={(e) => handlePinChange(i, e.target.value, confirmPin, setConfirmPin, cpRefs)}
                    onKeyDown={(e) => handlePinKeyDown(i, e, confirmPin, cpRefs)}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="modal-footer" style={{ padding: '16px 24px', borderTop: '1px solid var(--border-default)' }}>
            <button className="btn btn-ghost" onClick={() => setPinModalOpen(false)} style={{ flex: 1 }}>
              Cancelar
            </button>
            <button
              className="btn btn-primary"
              onClick={finalizeRegister}
              disabled={submitting}
              style={{ flex: 2 }}
            >
              {submitting ? (
                <>
                  <div className="spinner" /> A criar conta...
                </>
              ) : (
                <>
                  Criar Conta
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12l5 5L20 7" />
                  </svg>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

