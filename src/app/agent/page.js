'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQPay } from '@/context/QPayContext';
import { formatKz, formatDate, getInitials, buildQRPayload, formatExpiry } from '@/lib/utils';
import QRCanvas from '@/components/QRCanvas';

export default function AgentPage() {
  const router = useRouter();
  const { user, loadingAuth, logout, showToast } = useQPay();

  const [section, setSection] = useState('deposits'); // 'deposits' | 'users'
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [deposits, setDeposits] = useState([]);
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');

  // Selected user detail modal
  const [selectedUser, setSelectedUser] = useState(null);
  const [detailTab, setDetailTab] = useState('ops'); // 'ops' | 'qr' | 'extrato'
  const [userTxs, setUserTxs] = useState([]);

  // Balance modal
  const [balanceModal, setBalanceModal] = useState(null); // 'add' | 'remove' | null
  const [balanceAmount, setBalanceAmount] = useState('');

  // Reset PIN modal
  const [resetPinOpen, setResetPinOpen] = useState(false);
  const [newPinVal, setNewPinVal] = useState('');

  // Dynamic QR modal
  const [dynamicQrOpen, setDynamicQrOpen] = useState(false);
  const [dqrAmount, setDqrAmount] = useState('');
  const [dqrDesc, setDqrDesc] = useState('');
  const [dqrExpiry, setDqrExpiry] = useState(30);

  // QR Preview modal
  const [qrModalData, setQrModalData] = useState(null);

  const loadAgentData = async () => {
    try {
      const [depRes, usrRes] = await Promise.all([
        fetch('/api/deposits', { cache: 'no-store' }),
        fetch('/api/users', { cache: 'no-store' }),
      ]);
      const depJson = await depRes.json();
      const usrJson = await usrRes.json();
      if (depJson.success) setDeposits(depJson.deposits || []);
      if (usrJson.success) {
        setUsers((usrJson.users || []).filter((u) => u.role === 'user'));
      }
    } catch (_) {}
  };

  useEffect(() => {
    if (!loadingAuth) {
      if (!user || user.role !== 'agent') {
        router.push('/');
        return;
      }
      loadAgentData();
    }
  }, [user, loadingAuth, router]);

  if (loadingAuth || !user || user.role !== 'agent') return null;

  const approveDeposit = async (depId) => {
    try {
      const res = await fetch('/api/deposits', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: depId, action: 'approve' }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Depósito bancário aprovado com sucesso!', 'success');
        await loadAgentData();
      } else {
        showToast(data.message || 'Erro ao aprovar depósito', 'error');
      }
    } catch {
      showToast('Erro de comunicação', 'error');
    }
  };

  const rejectDeposit = async (depId) => {
    try {
      const res = await fetch('/api/deposits', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: depId, action: 'reject' }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Depósito rejeitado.', 'error');
        await loadAgentData();
      }
    } catch {
      showToast('Erro de comunicação', 'error');
    }
  };

  const openUserDetail = async (u) => {
    setSelectedUser(u);
    setDetailTab('ops');
    try {
      const res = await fetch(`/api/transactions?userId=${u.id}`, { cache: 'no-store' });
      const data = await res.json();
      if (data.success) setUserTxs((data.transactions || []).slice(0, 8));
    } catch (_) {}
  };

  const doConfirmBalance = async () => {
    const amt = parseFloat(balanceAmount);
    if (!amt || amt <= 0) {
      showToast('Insira um valor válido.', 'error');
      return;
    }
    const desc =
      balanceModal === 'add'
        ? `Crédito Agente (${user.name})`
        : `Débito Agente (${user.name})`;

    try {
      const res = await fetch('/api/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'adjustBalance',
          userId: selectedUser.id,
          amount: amt,
          mode: balanceModal,
          description: desc,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(
          balanceModal === 'add'
            ? `✅ ${formatKz(amt)} adicionados com sucesso!`
            : `🔴 ${formatKz(amt)} removidos da conta.`,
          balanceModal === 'add' ? 'success' : 'info'
        );
        setBalanceModal(null);
        setBalanceAmount('');
        setSelectedUser(null);
        await loadAgentData();
      } else {
        showToast(data.message || 'Erro ao ajustar saldo', 'error');
      }
    } catch {
      showToast('Erro ao comunicar com o servidor', 'error');
    }
  };

  const toggleBlockUser = async (targetUser, block) => {
    try {
      const res = await fetch(`/api/users/${targetUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isBlocked: block }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(block ? 'Utilizador bloqueado.' : 'Utilizador desbloqueado.', block ? 'error' : 'success');
        setSelectedUser(null);
        await loadAgentData();
      }
    } catch {
      showToast('Erro ao atualizar estado', 'error');
    }
  };

  const doResetPin = async () => {
    if (!newPinVal || !/^\d{4}$/.test(newPinVal)) {
      showToast('PIN inválido. Deve ter 4 dígitos.', 'error');
      return;
    }
    try {
      const res = await fetch(`/api/users/${selectedUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: newPinVal }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('PIN reposto com sucesso.', 'success');
        setResetPinOpen(false);
        setNewPinVal('');
      }
    } catch {
      showToast('Erro ao repor PIN', 'error');
    }
  };

  const generateFixedQR = async () => {
    if (!selectedUser) return;
    const payload = buildQRPayload('fixed', selectedUser, { description: `QR Fixo — ${selectedUser.name}` });
    const res = await fetch(`/api/users/${selectedUser.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fixedQrCode: payload }),
    });
    const data = await res.json();
    if (data.success) {
      setSelectedUser(data.user);
      await loadAgentData();
      setQrModalData({
        title: 'QR Code Fixo',
        type: 'fixed',
        payload,
        user: data.user,
        amount: null,
        expiry: null,
      });
    }
  };

  const cancelFixedQR = async () => {
    if (!selectedUser) return;
    const res = await fetch(`/api/users/${selectedUser.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fixedQrCode: null }),
    });
    const data = await res.json();
    if (data.success) {
      setSelectedUser(data.user);
      await loadAgentData();
      showToast('QR Code Fixo cancelado.', 'info');
    }
  };

  const doGenerateDynamicQR = () => {
    const amt = parseFloat(dqrAmount);
    if (!amt || amt <= 0) {
      showToast('Insira um valor válido.', 'error');
      return;
    }
    const expiry = new Date(Date.now() + Number(dqrExpiry) * 60000).toISOString();
    const payload = buildQRPayload('dynamic', selectedUser, {
      amount: amt,
      description: dqrDesc.trim() || 'Pagamento via Agente',
      expiresAt: expiry,
    });
    setDynamicQrOpen(false);
    setQrModalData({
      title: 'QR Code Dinâmico',
      type: 'dynamic',
      payload,
      user: selectedUser,
      amount: amt,
      expiry,
    });
  };

  const filteredUsers = users.filter((u) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      u.name.toLowerCase().includes(q) ||
      u.phone.includes(q) ||
      (u.nif || '').toLowerCase().includes(q)
    );
  });

  return (
    <>
      <link rel="stylesheet" href="/css/admin.css" />
      <div className="bg-glow-agent" />
      <div
        className={`overlay-bg ${sidebarOpen ? 'show' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      <div className="admin-layout">
        {/* SIDEBAR */}
        <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
          <div className="sidebar-logo">
            <img
              src="/Img/Qpaylogo.png"
              alt="QPAY AO"
              style={{ height: 38, width: 'auto', borderRadius: 8, marginRight: 10 }}
            />
            <span className="sidebar-logo-text">QPAY AO</span>
            <span className="sidebar-logo-badge badge-agent">Agente</span>
          </div>

          <div className="sidebar-nav">
            <p className="sidebar-section-title">Painel</p>
            <button
              className={`nav-item ${section === 'deposits' ? 'active-agent' : ''}`}
              onClick={() => {
                setSection('deposits');
                setSidebarOpen(false);
              }}
            >
              Depósitos Bancários
              <span className="nav-badge">{deposits.length}</span>
            </button>

            <p className="sidebar-section-title">Utilizadores</p>
            <button
              className={`nav-item ${section === 'users' ? 'active-agent' : ''}`}
              onClick={() => {
                setSection('users');
                setSidebarOpen(false);
              }}
            >
              Gerir Utilizadores
            </button>
          </div>

          <div className="sidebar-footer">
            <div className="sidebar-user">
              <div className="sidebar-avatar avatar-agent">{getInitials(user.name)}</div>
              <div className="sidebar-user-info">
                <div className="sidebar-user-name">{user.name}</div>
                <div className="sidebar-user-role">Nível: Agente</div>
              </div>
              <button className="btn-logout" title="Sair" onClick={logout}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </button>
            </div>
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <main className="main-content">
          <div className="page-header">
            <button className="mobile-menu-btn" onClick={() => setSidebarOpen(true)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <div>
              <h1 className="page-title">
                {section === 'deposits' ? 'Depósitos Bancários' : 'Gerir Utilizadores'}
              </h1>
              <p className="page-sub">
                {section === 'deposits'
                  ? 'Analise e aprove transferências bancárias'
                  : 'Pesquise e gira as contas de utilizadores'}
              </p>
            </div>
          </div>

          <div className="page-content">
            {section === 'deposits' ? (
              <section>
                <div className="stats-grid">
                  <div className="stat-card">
                    <div className="stat-info">
                      <div className="stat-label">Pendentes</div>
                      <div className="stat-value">{deposits.length}</div>
                      <div className="stat-sub">aguardam aprovação</div>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-info">
                      <div className="stat-label">Total de Utilizadores</div>
                      <div className="stat-value">{users.length}</div>
                      <div className="stat-sub">contas ativas</div>
                    </div>
                  </div>
                </div>

                <div className="section-card">
                  <div className="section-head">
                    <span className="section-title">Depósitos Bancários Pendentes</span>
                    <span className="badge badge-pending">{deposits.length} pendentes</span>
                  </div>
                  <div className="deposit-cards">
                    {deposits.length === 0 ? (
                      <div className="empty-state-a">
                        <p>Sem depósitos pendentes. Tudo em dia!</p>
                      </div>
                    ) : (
                      deposits.map((dep) => (
                        <div className="deposit-card" key={dep.id}>
                          <div className="deposit-card-top">
                            <div>
                              <div className="dep-user-name">{dep.userName}</div>
                              <div className="dep-meta">
                                {dep.userPhone} &nbsp;·&nbsp; {formatDate(dep.createdAt)}
                              </div>
                              <div className="dep-meta">{dep.bank}</div>
                              <div className="dep-ref">{dep.reference}</div>
                              {dep.notes && (
                                <div className="dep-meta" style={{ marginTop: 6, fontStyle: 'italic' }}>
                                  &ldquo;{dep.notes}&rdquo;
                                </div>
                              )}
                            </div>
                            <div className="dep-amount">+{formatKz(dep.amount)}</div>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span className="badge badge-pending">
                              <span className="badge-dot" />
                              Pendente
                            </span>
                            <div className="dep-actions">
                              <button
                                className="btn btn-danger btn-sm"
                                onClick={() => rejectDeposit(dep.id)}
                              >
                                Rejeitar
                              </button>
                              <button
                                className="btn btn-success btn-sm"
                                onClick={() => approveDeposit(dep.id)}
                              >
                                Aprovar
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </section>
            ) : (
              <section>
                <div className="section-card">
                  <div className="section-head">
                    <span className="section-title">Gerir Utilizadores</span>
                    <div className="search-wrap">
                      <input
                        type="text"
                        placeholder="Pesquisar por nome, telefone ou NIF…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>
                  </div>
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Utilizador</th>
                        <th>Telefone</th>
                        <th>NIF</th>
                        <th>Saldo</th>
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((u) => (
                        <tr key={u.id} onClick={() => openUserDetail(u)} style={{ cursor: 'pointer' }}>
                          <td>
                            <div className="t-user">
                              <div className="t-avatar">{getInitials(u.name)}</div>
                              <div>
                                <div className="t-name">{u.name}</div>
                                <div className="t-phone">{u.phone}</div>
                              </div>
                            </div>
                          </td>
                          <td>{u.phone}</td>
                          <td>{u.nif || '—'}</td>
                          <td style={{ fontWeight: 600 }}>{formatKz(u.balance)}</td>
                          <td>
                            {u.isBlocked ? (
                              <span className="badge badge-blocked">Bloqueado</span>
                            ) : (
                              <span className="badge badge-active">Ativo</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </div>
        </main>
      </div>

      {/* USER DETAIL MODAL */}
      <div className={`modal-overlay ${selectedUser ? 'open' : ''}`}>
        {selectedUser && (
          <div className="modal" style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <h3 className="modal-title">Conta do Utilizador</h3>
              <button className="modal-close" onClick={() => setSelectedUser(null)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="user-profile">
                <div className="user-profile-avatar">{getInitials(selectedUser.name)}</div>
                <div>
                  <div className="user-profile-name">{selectedUser.name}</div>
                  <div className="user-profile-sub">
                    {selectedUser.phone}
                    {selectedUser.nif ? ` · NIF: ${selectedUser.nif}` : ''}
                  </div>
                </div>
              </div>

              <div className="user-balance-card">
                <div className="user-balance-label">Saldo Actual</div>
                <div className="user-balance-value">{formatKz(selectedUser.balance)}</div>
              </div>

              <div className="tabs-row">
                {['ops', 'qr', 'extrato'].map((t) => (
                  <button
                    key={t}
                    className={`tab-btn ${detailTab === t ? 'active-agent' : ''}`}
                    onClick={() => setDetailTab(t)}
                  >
                    {t === 'ops' ? 'Operações' : t === 'qr' ? 'QR Codes' : 'Extrato'}
                  </button>
                ))}
              </div>

              {detailTab === 'ops' && (
                <div className="action-grid">
                  <button
                    className="btn btn-success btn-sm"
                    onClick={() => {
                      setBalanceAmount('');
                      setBalanceModal('add');
                    }}
                  >
                    Adicionar Saldo
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => {
                      setBalanceAmount('');
                      setBalanceModal('remove');
                    }}
                  >
                    Remover Saldo
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setNewPinVal('');
                      setResetPinOpen(true);
                    }}
                  >
                    Repor PIN
                  </button>
                  <button
                    className={`btn ${selectedUser.isBlocked ? 'btn-success' : 'btn-danger'} btn-sm`}
                    onClick={() => toggleBlockUser(selectedUser, !selectedUser.isBlocked)}
                  >
                    {selectedUser.isBlocked ? 'Desbloquear' : 'Bloquear'}
                  </button>
                </div>
              )}

              {detailTab === 'qr' && (
                <div style={{ display: 'grid', gap: 10 }}>
                  <button
                    className="btn btn-primary btn-full"
                    onClick={() => {
                      setDqrAmount('');
                      setDqrDesc('');
                      setDynamicQrOpen(true);
                    }}
                  >
                    Gerar QR Code Dinâmico (com valor)
                  </button>
                  {selectedUser.fixedQrCode ? (
                    <>
                      <button
                        className="btn btn-agent btn-full"
                        onClick={() =>
                          setQrModalData({
                            title: 'QR Code Fixo (Activo)',
                            type: 'fixed',
                            payload: selectedUser.fixedQrCode,
                            user: selectedUser,
                            amount: null,
                            expiry: null,
                          })
                        }
                      >
                        Ver QR Fixo Activo
                      </button>
                      <button className="btn btn-danger btn-full" onClick={cancelFixedQR}>
                        Cancelar QR Fixo Activo
                      </button>
                    </>
                  ) : (
                    <button className="btn btn-agent btn-full" onClick={generateFixedQR}>
                      Gerar QR Code Fixo (permanente)
                    </button>
                  )}
                </div>
              )}

              {detailTab === 'extrato' && (
                <div className="tx-list">
                  {userTxs.length === 0 ? (
                    <p style={{ textAlign: 'center', padding: 20 }}>Sem transações</p>
                  ) : (
                    userTxs.map((tx) => {
                      const isCredit = tx.toUserId === selectedUser.id;
                      return (
                        <div className="tx-item-admin" key={tx.id}>
                          <div className="txa-info">
                            <div className="txa-desc">{tx.description}</div>
                            <div className="txa-date">{formatDate(tx.timestamp)}</div>
                          </div>
                          <div className={`txa-amount ${isCredit ? 'txa-pos' : 'txa-neg'}`}>
                            {isCredit ? '+' : '-'}
                            {formatKz(tx.amount)}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* BALANCE MODAL */}
      <div className={`modal-overlay ${balanceModal ? 'open' : ''}`}>
        {selectedUser && balanceModal && (
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">
                {balanceModal === 'add' ? 'Adicionar Saldo' : 'Remover Saldo'}
              </h3>
              <button className="modal-close" onClick={() => setBalanceModal(null)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Valor (Kz)</label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="Ex: 5000"
                  value={balanceAmount}
                  onChange={(e) => setBalanceAmount(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setBalanceModal(null)}>
                Cancelar
              </button>
              <button
                className={`btn ${balanceModal === 'add' ? 'btn-success' : 'btn-danger'}`}
                onClick={doConfirmBalance}
              >
                Confirmar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* RESET PIN MODAL */}
      <div className={`modal-overlay ${resetPinOpen ? 'open' : ''}`}>
        <div className="modal">
          <div className="modal-header">
            <h3 className="modal-title">Repor PIN</h3>
            <button className="modal-close" onClick={() => setResetPinOpen(false)}>
              ✕
            </button>
          </div>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Novo PIN (4 dígitos)</label>
              <input
                type="password"
                className="form-input"
                maxLength={4}
                placeholder="••••"
                value={newPinVal}
                onChange={(e) => setNewPinVal(e.target.value.replace(/\D/g, '').slice(0, 4))}
              />
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={() => setResetPinOpen(false)}>
              Cancelar
            </button>
            <button className="btn btn-agent" onClick={doResetPin}>
              Confirmar
            </button>
          </div>
        </div>
      </div>

      {/* DYNAMIC QR MODAL */}
      <div className={`modal-overlay ${dynamicQrOpen ? 'open' : ''}`}>
        <div className="modal">
          <div className="modal-header">
            <h3 className="modal-title">Gerar QR Code Dinâmico</h3>
            <button className="modal-close" onClick={() => setDynamicQrOpen(false)}>
              ✕
            </button>
          </div>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Valor (Kz)</label>
              <input
                type="number"
                className="form-input"
                placeholder="Ex: 5000"
                value={dqrAmount}
                onChange={(e) => setDqrAmount(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Descrição (opcional)</label>
              <input
                type="text"
                className="form-input"
                placeholder="Ex: Pagamento de serviço"
                value={dqrDesc}
                onChange={(e) => setDqrDesc(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Validade</label>
              <select
                className="form-input"
                value={dqrExpiry}
                onChange={(e) => setDqrExpiry(Number(e.target.value))}
              >
                <option value={15}>15 minutos</option>
                <option value={30}>30 minutos</option>
                <option value={60}>1 hora</option>
                <option value={240}>4 horas</option>
              </select>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={() => setDynamicQrOpen(false)}>
              Cancelar
            </button>
            <button className="btn btn-primary" onClick={doGenerateDynamicQR}>
              Gerar QR Code
            </button>
          </div>
        </div>
      </div>

      {/* QR DISPLAY MODAL */}
      <div className={`modal-overlay ${qrModalData ? 'open' : ''}`}>
        {qrModalData && (
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">{qrModalData.title}</h3>
              <button className="modal-close" onClick={() => setQrModalData(null)}>
                ✕
              </button>
            </div>
            <div className="modal-body" style={{ textAlign: 'center' }}>
              <div style={{ background: '#fff', padding: 16, borderRadius: 16, display: 'inline-block', marginBottom: 12 }}>
                <QRCanvas payload={qrModalData.payload} size={200} />
              </div>
              <div className="qr-label">{qrModalData.user.name} · {qrModalData.user.phone}</div>
              <div className="qr-label" style={{ fontWeight: 700, fontSize: 16 }}>
                {qrModalData.amount ? formatKz(qrModalData.amount) : 'Valor livre (Fixo)'}
              </div>
              {qrModalData.expiry && (
                <div className="qr-label" style={{ fontSize: 11 }}>
                  Válido até: {formatExpiry(qrModalData.expiry)}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setQrModalData(null)}>
                Fechar
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

