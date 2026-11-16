'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQPay } from '@/context/QPayContext';
import { formatKz, formatDate, getInitials, validateNIF, sanitizeNifInput } from '@/lib/utils';

export default function AdminPage() {
  const router = useRouter();
  const { user, loadingAuth, logout, showToast } = useQPay();

  const [section, setSection] = useState('overview'); // 'overview' | 'agents' | 'users'
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [search, setSearch] = useState('');

  // Create Agent Modal
  const [addAgentOpen, setAddAgentOpen] = useState(false);
  const [agentName, setAgentName] = useState('');
  const [agentPhone, setAgentPhone] = useState('');
  const [agentNif, setAgentNif] = useState('');
  const [agentPin, setAgentPin] = useState('');

  // Detail Modals
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userTxs, setUserTxs] = useState([]);

  // Balance & Reset PIN Modals
  const [balanceModal, setBalanceModal] = useState(null); // 'add' | 'remove' | null
  const [balanceAmount, setBalanceAmount] = useState('');
  const [resetTarget, setResetTarget] = useState(null);
  const [newPinVal, setNewPinVal] = useState('');

  const loadUsers = async () => {
    try {
      const res = await fetch('/api/users', { cache: 'no-store' });
      const data = await res.json();
      if (data.success) setAllUsers(data.users || []);
    } catch (_) {}
  };

  useEffect(() => {
    if (!loadingAuth) {
      if (!user || user.role !== 'admin') {
        router.push('/');
        return;
      }
      loadUsers();
    }
  }, [user, loadingAuth, router]);

  if (loadingAuth || !user || user.role !== 'admin') return null;

  const regularUsers = allUsers.filter((u) => u.role === 'user');
  const agents = allUsers.filter((u) => u.role === 'agent');
  const blockedCount = allUsers.filter((u) => u.isBlocked).length;
  const totalBalance = regularUsers.reduce((s, u) => s + (u.balance || 0), 0);

  const filteredUsers = regularUsers.filter((u) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      u.name.toLowerCase().includes(q) ||
      u.phone.includes(q) ||
      (u.nif || '').toLowerCase().includes(q)
    );
  });

  const doCreateAgent = async () => {
    if (!agentName.trim() || agentName.trim().length < 2) {
      showToast('Insira o nome completo do agente.', 'error');
      return;
    }
    if (agentPhone.length !== 9) {
      showToast('Insira os 9 dígitos do telefone.', 'error');
      return;
    }
    if (!validateNIF(agentNif)) {
      showToast('NIF inválido. Formato: 9 dígitos + 2 letras + 3 dígitos.', 'error');
      return;
    }
    if (!/^\d{4}$/.test(agentPin)) {
      showToast('O PIN deve ter 4 dígitos numéricos.', 'error');
      return;
    }

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: agentName.trim(),
          phone: agentPhone,
          nif: agentNif,
          pin: agentPin,
          role: 'agent',
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Agente ${data.user.name} criado com sucesso!`, 'success');
        setAddAgentOpen(false);
        setAgentName('');
        setAgentPhone('');
        setAgentNif('');
        setAgentPin('');
        await loadUsers();
      } else {
        showToast(data.message || 'Erro ao criar agente', 'error');
      }
    } catch {
      showToast('Erro de comunicação com o servidor', 'error');
    }
  };

  const toggleBlock = async (target, block) => {
    try {
      const res = await fetch(`/api/users/${target.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isBlocked: block }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(block ? 'Conta bloqueada.' : 'Conta desbloqueada.', block ? 'error' : 'success');
        setSelectedAgent(null);
        setSelectedUser(null);
        await loadUsers();
      }
    } catch {
      showToast('Erro ao atualizar conta', 'error');
    }
  };

  const openUserDetail = async (u) => {
    setSelectedUser(u);
    try {
      const res = await fetch(`/api/transactions?userId=${u.id}`, { cache: 'no-store' });
      const data = await res.json();
      if (data.success) setUserTxs((data.transactions || []).slice(0, 10));
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
        ? `Crédito Admin (${user.name})`
        : `Débito Admin (${user.name})`;

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
        await loadUsers();
      } else {
        showToast(data.message || 'Erro na operação', 'error');
      }
    } catch {
      showToast('Erro de comunicação', 'error');
    }
  };

  const doResetPin = async () => {
    if (!resetTarget || !/^\d{4}$/.test(newPinVal)) {
      showToast('PIN inválido. Deve ter 4 dígitos numéricos.', 'error');
      return;
    }
    try {
      const res = await fetch(`/api/users/${resetTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: newPinVal }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('PIN reposto com sucesso.', 'success');
        setResetTarget(null);
        setNewPinVal('');
      }
    } catch {
      showToast('Erro ao repor PIN', 'error');
    }
  };

  return (
    <>
      <link rel="stylesheet" href="/css/admin.css" />
      <div className="bg-glow-admin" />
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
            <span className="sidebar-logo-badge badge-admin">Admin</span>
          </div>

          <div className="sidebar-nav">
            <p className="sidebar-section-title">Painel</p>
            <button
              className={`nav-item ${section === 'overview' ? 'active-admin' : ''}`}
              onClick={() => {
                setSection('overview');
                setSidebarOpen(false);
              }}
            >
              Visão Geral
            </button>

            <p className="sidebar-section-title">Gestão</p>
            <button
              className={`nav-item ${section === 'agents' ? 'active-admin' : ''}`}
              onClick={() => {
                setSection('agents');
                setSidebarOpen(false);
              }}
            >
              Agentes
              <span className="nav-badge">{agents.length}</span>
            </button>
            <button
              className={`nav-item ${section === 'users' ? 'active-admin' : ''}`}
              onClick={() => {
                setSection('users');
                setSidebarOpen(false);
              }}
            >
              Utilizadores
            </button>
          </div>

          <div className="sidebar-footer">
            <div className="sidebar-user">
              <div className="sidebar-avatar avatar-admin">{getInitials(user.name)}</div>
              <div className="sidebar-user-info">
                <div className="sidebar-user-name">{user.name}</div>
                <div className="sidebar-user-role">Nível: Administrador</div>
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
                {section === 'overview'
                  ? 'Visão Geral'
                  : section === 'agents'
                  ? 'Gestão de Agentes'
                  : 'Utilizadores'}
              </h1>
              <p className="page-sub">
                {section === 'overview'
                  ? 'Resumo do sistema QPAY AO'
                  : section === 'agents'
                  ? 'Crie e gira as contas de agentes'
                  : 'Todos os utilizadores registados'}
              </p>
            </div>
          </div>

          <div className="page-content">
            {section === 'overview' && (
              <section>
                <div className="stats-grid">
                  <div className="stat-card">
                    <div className="stat-info">
                      <div className="stat-label">Utilizadores</div>
                      <div className="stat-value">{regularUsers.length}</div>
                      <div className="stat-sub">contas ativas</div>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-info">
                      <div className="stat-label">Agentes</div>
                      <div className="stat-value">{agents.length}</div>
                      <div className="stat-sub">agentes ativos</div>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-info">
                      <div className="stat-label">Volume Total em Contas</div>
                      <div className="stat-value" style={{ fontSize: 16 }}>
                        {formatKz(totalBalance)}
                      </div>
                      <div className="stat-sub">saldo acumulado</div>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-info">
                      <div className="stat-label">Contas Bloqueadas</div>
                      <div className="stat-value">{blockedCount}</div>
                      <div className="stat-sub">requerem atenção</div>
                    </div>
                  </div>
                </div>

                <div className="section-card">
                  <div className="section-head">
                    <span className="section-title">Agentes Registados</span>
                    <button className="btn btn-admin btn-sm" onClick={() => setSection('agents')}>
                      Gerir Agentes
                    </button>
                  </div>
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Agente</th>
                        <th>Telefone</th>
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agents.map((a) => (
                        <tr key={a.id} onClick={() => setSelectedAgent(a)} style={{ cursor: 'pointer' }}>
                          <td>
                            <div className="t-user">
                              <div className="t-avatar">{getInitials(a.name)}</div>
                              <div className="t-name">{a.name}</div>
                            </div>
                          </td>
                          <td>{a.phone}</td>
                          <td>
                            {a.isBlocked ? (
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

            {section === 'agents' && (
              <section>
                <div className="section-card">
                  <div className="section-head">
                    <span className="section-title">Gestão de Agentes</span>
                    <button className="btn btn-admin" onClick={() => setAddAgentOpen(true)}>
                      + Adicionar Agente
                    </button>
                  </div>
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Agente</th>
                        <th>Telefone</th>
                        <th>NIF</th>
                        <th>Estado</th>
                        <th>Criado em</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agents.map((a) => (
                        <tr key={a.id} onClick={() => setSelectedAgent(a)} style={{ cursor: 'pointer' }}>
                          <td>
                            <div className="t-user">
                              <div className="t-avatar">{getInitials(a.name)}</div>
                              <div className="t-name">{a.name}</div>
                            </div>
                          </td>
                          <td>{a.phone}</td>
                          <td>{a.nif || '—'}</td>
                          <td>
                            {a.isBlocked ? (
                              <span className="badge badge-blocked">Bloqueado</span>
                            ) : (
                              <span className="badge badge-active">Ativo</span>
                            )}
                          </td>
                          <td>{new Date(a.createdAt).toLocaleDateString('pt-AO')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {section === 'users' && (
              <section>
                <div className="section-card">
                  <div className="section-head">
                    <span className="section-title">Todos os Utilizadores</span>
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

      {/* MODAL: ADD AGENT */}
      <div className={`modal-overlay ${addAgentOpen ? 'open' : ''}`}>
        <div className="modal">
          <div className="modal-header">
            <h3 className="modal-title">Adicionar Novo Agente</h3>
            <button className="modal-close" onClick={() => setAddAgentOpen(false)}>
              ✕
            </button>
          </div>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Nome Completo</label>
              <input
                type="text"
                className="form-input"
                placeholder="Ex: Carlos Silva"
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Telefone Angola (9 dígitos)</label>
              <input
                type="tel"
                className="form-input"
                placeholder="9XX XXX XXX"
                maxLength={9}
                value={agentPhone}
                onChange={(e) => setAgentPhone(e.target.value.replace(/\D/g, '').slice(0, 9))}
              />
            </div>
            <div className="form-group">
              <label className="form-label">NIF (Obrigatório)</label>
              <input
                type="text"
                className="form-input"
                placeholder="000000000AA000"
                maxLength={14}
                value={agentNif}
                onChange={(e) => setAgentNif(sanitizeNifInput(e.target.value))}
                style={{ fontFamily: 'monospace' }}
              />
            </div>
            <div className="form-group">
              <label className="form-label">PIN de Acesso (4 dígitos)</label>
              <input
                type="password"
                className="form-input"
                placeholder="••••"
                maxLength={4}
                value={agentPin}
                onChange={(e) => setAgentPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              />
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={() => setAddAgentOpen(false)}>
              Cancelar
            </button>
            <button className="btn btn-admin" onClick={doCreateAgent}>
              Criar Agente
            </button>
          </div>
        </div>
      </div>

      {/* MODAL: AGENT DETAIL */}
      <div className={`modal-overlay ${selectedAgent ? 'open' : ''}`}>
        {selectedAgent && (
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">Detalhes do Agente</h3>
              <button className="modal-close" onClick={() => setSelectedAgent(null)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="user-profile">
                <div className="user-profile-avatar">{getInitials(selectedAgent.name)}</div>
                <div>
                  <div className="user-profile-name">{selectedAgent.name}</div>
                  <div className="user-profile-sub">{selectedAgent.phone}</div>
                </div>
              </div>
              <div className="info-row">
                <span className="info-row-label">NIF</span>
                <span className="info-row-value">{selectedAgent.nif || 'Não definido'}</span>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setSelectedAgent(null)}>
                Fechar
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setResetTarget(selectedAgent);
                  setNewPinVal('');
                  setSelectedAgent(null);
                }}
              >
                Repor PIN
              </button>
              <button
                className={`btn ${selectedAgent.isBlocked ? 'btn-success' : 'btn-danger'} btn-sm`}
                onClick={() => toggleBlock(selectedAgent, !selectedAgent.isBlocked)}
              >
                {selectedAgent.isBlocked ? 'Desbloquear' : 'Bloquear'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL: USER DETAIL */}
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
                    {selectedUser.phone} · NIF: {selectedUser.nif || '—'}
                  </div>
                </div>
              </div>
              <div className="user-balance-card">
                <div className="user-balance-label">Saldo Actual</div>
                <div className="user-balance-value">{formatKz(selectedUser.balance)}</div>
              </div>
              <div className="action-grid" style={{ marginBottom: 16 }}>
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
                    setResetTarget(selectedUser);
                    setNewPinVal('');
                    setSelectedUser(null);
                  }}
                >
                  Repor PIN
                </button>
                <button
                  className={`btn ${selectedUser.isBlocked ? 'btn-success' : 'btn-danger'} btn-sm`}
                  onClick={() => toggleBlock(selectedUser, !selectedUser.isBlocked)}
                >
                  {selectedUser.isBlocked ? 'Desbloquear' : 'Bloquear'}
                </button>
              </div>
              <div className="tx-list">
                {userTxs.map((tx) => {
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
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODAL: BALANCE ADJUST */}
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

      {/* MODAL: RESET PIN */}
      <div className={`modal-overlay ${resetTarget ? 'open' : ''}`}>
        {resetTarget && (
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">Repor PIN de {resetTarget.name}</h3>
              <button className="modal-close" onClick={() => setResetTarget(null)}>
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
              <button className="btn btn-ghost" onClick={() => setResetTarget(null)}>
                Cancelar
              </button>
              <button className="btn btn-admin" onClick={doResetPin}>
                Confirmar Repor PIN
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

