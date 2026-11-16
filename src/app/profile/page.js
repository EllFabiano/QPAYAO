'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQPay } from '@/context/QPayContext';
import { getInitials } from '@/lib/utils';

export default function ProfilePage() {
  const router = useRouter();
  const { user, setUser, loadingAuth, logout, showToast } = useQPay();

  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  useEffect(() => {
    if (!loadingAuth && !user) {
      router.push('/');
    }
  }, [user, loadingAuth, router]);

  if (loadingAuth || !user) return null;

  const handleAvatarUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64Img = e.target.result;
      try {
        const res = await fetch(`/api/users/${user.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ avatar: base64Img }),
        });
        const data = await res.json();
        if (data.success) {
          setUser(data.user);
          showToast('Foto de perfil atualizada com sucesso!', 'success');
        }
      } catch {
        showToast('Erro ao atualizar foto', 'error');
      }
    };
    reader.readAsDataURL(file);
  };

  const toggleFaceId = async (checked) => {
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ faceIdEnabled: checked }),
      });
      const data = await res.json();
      if (data.success) {
        setUser(data.user);
        showToast(
          checked ? 'Aprovação por Face ID ativada' : 'Aprovação por Face ID desativada',
          checked ? 'success' : 'info'
        );
      }
    } catch {
      showToast('Erro ao atualizar preferência', 'error');
    }
  };

  const saveNewPin = async () => {
    if (!currentPin || !newPin || !confirmPin) {
      showToast('Preencha todos os campos', 'error');
      return;
    }
    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      showToast('O novo PIN deve ter exatamente 4 dígitos', 'error');
      return;
    }
    if (newPin !== confirmPin) {
      showToast('Os novos PINs não coincidem', 'error');
      return;
    }

    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPin, newPin }),
      });
      const data = await res.json();
      if (data.success) {
        setUser(data.user);
        setPinModalOpen(false);
        setCurrentPin('');
        setNewPin('');
        setConfirmPin('');
        showToast('PIN alterado com sucesso!', 'success');
      } else {
        showToast(data.message || 'Erro ao alterar PIN', 'error');
      }
    } catch {
      showToast('Erro ao comunicar com o servidor', 'error');
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
        <span className="header-title">O Meu Perfil</span>
        <div style={{ width: 38 }} />
      </div>

      <div className="page page-enter">
        <div className="page-inner">
          <div style={{ textAlign: 'center', padding: '30px 20px', marginBottom: 24 }}>
            <div style={{ position: 'relative', display: 'inline-block', marginBottom: 16 }}>
              <div
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: '50%',
                  background: 'var(--surface-raised)',
                  color: 'var(--primary)',
                  fontSize: 32,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px solid var(--primary)',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  backgroundImage: user.avatar ? `url(${user.avatar})` : 'none',
                }}
              >
                {!user.avatar ? getInitials(user.name) : ''}
              </div>
              <label
                htmlFor="avatar-upload"
                style={{
                  position: 'absolute',
                  bottom: 0,
                  right: -5,
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: 'var(--primary)',
                  color: '#000',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
              </label>
              <input
                type="file"
                id="avatar-upload"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleAvatarUpload}
              />
            </div>
            <div className="t-lg fw-bold">{user.name}</div>
            <div className="t-sm text-muted mt-1">+244 {user.phone}</div>
            {user.nif && <div className="t-xs text-muted mt-1">NIF: {user.nif}</div>}
          </div>

          <div
            className="t-xs text-muted fw-bold mb-3"
            style={{ textTransform: 'uppercase', letterSpacing: 1, paddingLeft: 4 }}
          >
            Definições de Conta
          </div>

          <div
            onClick={() => setPinModalOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 16,
              background: 'var(--surface-raised)',
              borderRadius: 'var(--r-md)',
              marginBottom: 12,
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: 'var(--secondary-100)',
                  color: 'var(--secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Alterar PIN de Acesso / Pagamento</div>
            </div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 16,
              background: 'var(--surface-raised)',
              borderRadius: 'var(--r-md)',
              marginBottom: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: 'var(--info-100)',
                  color: 'var(--info)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z" />
                  <path d="M12 6v6l4 2" />
                </svg>
              </div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Pagamento com Face ID</div>
            </div>
            <input
              type="checkbox"
              checked={Boolean(user.faceIdEnabled)}
              onChange={(e) => toggleFaceId(e.target.checked)}
              style={{ width: 20, height: 20, accentColor: 'var(--primary)', cursor: 'pointer' }}
            />
          </div>

          <div style={{ height: 20 }} />

          <div
            onClick={logout}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 16,
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: 'var(--r-md)',
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--danger)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--danger)' }}>Terminar sessão</div>
            </div>
          </div>
        </div>
      </div>

      <div className={`overlay ${pinModalOpen ? 'open' : ''}`} onClick={() => setPinModalOpen(false)} />

      <div className={`sheet ${pinModalOpen ? 'open' : ''}`}>
        <div className="sheet-handle" />
        <div className="sheet-title">Alterar PIN</div>

        <div className="input-group">
          <label className="input-label">PIN Atual</label>
          <input
            type="password"
            className="input"
            placeholder="••••"
            maxLength={4}
            inputMode="numeric"
            value={currentPin}
            onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
          />
        </div>

        <div className="input-group mt-3">
          <label className="input-label">Novo PIN</label>
          <input
            type="password"
            className="input"
            placeholder="••••"
            maxLength={4}
            inputMode="numeric"
            value={newPin}
            onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
          />
        </div>

        <div className="input-group mt-3">
          <label className="input-label">Confirmar Novo PIN</label>
          <input
            type="password"
            className="input"
            placeholder="••••"
            maxLength={4}
            inputMode="numeric"
            value={confirmPin}
            onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
          />
        </div>

        <div className="flex gap-3 mt-4">
          <button className="btn btn-ghost flex-1" onClick={() => setPinModalOpen(false)}>
            Cancelar
          </button>
          <button className="btn btn-primary flex-1" onClick={saveNewPin}>
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

