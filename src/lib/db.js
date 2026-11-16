/* ================================================
   QPAY AO — Camada de Base de Dados (Node.js + Prisma)
   Suporta PostgreSQL via Prisma ORM com auto-seed e
   fallback persistente caso o servidor PostgreSQL
   ainda não esteja ativo.
================================================ */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import prisma from './prisma';

const FALLBACK_PATH = path.join(process.cwd(), 'prisma', 'local-fallback.json');

function uid() {
  return crypto.randomUUID();
}

function getInitialDemoData() {
  const now = Date.now();
  const d = (days, hours = 0) => new Date(now - days * 86400000 - hours * 3600000).toISOString();

  return {
    users: [
      {
        id: 'u-admin-000',
        name: 'Administrador QPAY',
        phone: '940375951',
        pin: '1122',
        role: 'admin',
        nif: '000000000LA000',
        balance: 0.0,
        isBlocked: false,
        fixedQrCode: null,
        avatar: null,
        faceIdEnabled: false,
        createdAt: d(90),
      },
      {
        id: 'u-agent-001',
        name: 'Carlos Agente',
        phone: '930000001',
        pin: '9999',
        role: 'agent',
        nif: '000000001UE001',
        balance: 0.0,
        isBlocked: false,
        fixedQrCode: null,
        avatar: null,
        faceIdEnabled: false,
        createdAt: d(60),
      },
      { id: 'u-faby-001', name: 'Faby Mateus', phone: '923456789', pin: '1234', role: 'user', nif: '001234567LA001', balance: 45750.0, isBlocked: false, fixedQrCode: null, avatar: null, faceIdEnabled: false, createdAt: d(45) },
      { id: 'u-joao-002', name: 'João Manuel', phone: '912345678', pin: '5678', role: 'user', nif: '002345678LA002', balance: 12300.5, isBlocked: false, fixedQrCode: null, avatar: null, faceIdEnabled: false, createdAt: d(40) },
      { id: 'u-mari-003', name: 'Maria Santos', phone: '934567890', pin: '9012', role: 'user', nif: '003456789LA003', balance: 8950.75, isBlocked: false, fixedQrCode: null, avatar: null, faceIdEnabled: false, createdAt: d(35) },
      { id: 'u-pedr-004', name: 'Pedro Luzolo', phone: '945678901', pin: '3456', role: 'user', nif: '004567890LA004', balance: 23500.0, isBlocked: false, fixedQrCode: null, avatar: null, faceIdEnabled: false, createdAt: d(30) },
      { id: 'u-luci-005', name: 'Lúcia Mbemba', phone: '956789012', pin: '7890', role: 'user', nif: '005678901LA005', balance: 5600.0, isBlocked: false, fixedQrCode: null, avatar: null, faceIdEnabled: false, createdAt: d(20) },
    ],
    transactions: [
      { id: uid(), type: 'deposit', amount: 20000, description: 'Depósito inicial em numerário', note: null, fromUserId: null, toUserId: 'u-faby-001', timestamp: d(30), status: 'completed' },
      { id: uid(), type: 'transfer_in', amount: 5000, description: 'Pagamento de João Manuel', note: null, fromUserId: 'u-joao-002', toUserId: 'u-faby-001', timestamp: d(20), status: 'completed' },
      { id: uid(), type: 'qr_payment_in', amount: 3500, description: 'Venda QR · Produtos alimentares', note: null, fromUserId: 'u-mari-003', toUserId: 'u-faby-001', timestamp: d(15), status: 'completed' },
      { id: uid(), type: 'transfer_out', amount: 2500, description: 'Transferência para Maria Santos', note: null, fromUserId: 'u-faby-001', toUserId: 'u-mari-003', timestamp: d(12), status: 'completed' },
      { id: uid(), type: 'deposit', amount: 15000, description: 'Depósito em numerário', note: null, fromUserId: null, toUserId: 'u-faby-001', timestamp: d(10), status: 'completed' },
      { id: uid(), type: 'qr_payment_in', amount: 1800, description: 'Venda QR · Bebidas', note: null, fromUserId: 'u-pedr-004', toUserId: 'u-faby-001', timestamp: d(7), status: 'completed' },
      { id: uid(), type: 'withdrawal', amount: 5000, description: 'Levantamento em dinheiro', note: null, fromUserId: 'u-faby-001', toUserId: null, timestamp: d(5), status: 'completed' },
      { id: uid(), type: 'qr_payment_in', amount: 4200, description: 'Venda QR · Frutas e legumes', note: null, fromUserId: 'u-joao-002', toUserId: 'u-faby-001', timestamp: d(3), status: 'completed' },
      { id: uid(), type: 'transfer_out', amount: 1250, description: 'Transferência para João Manuel', note: null, fromUserId: 'u-faby-001', toUserId: 'u-joao-002', timestamp: d(1, 4), status: 'completed' },
      { id: uid(), type: 'qr_payment_in', amount: 5000, description: 'Venda QR · Snacks e mercearia', note: null, fromUserId: 'u-luci-005', toUserId: 'u-faby-001', timestamp: d(0, 3), status: 'completed' },
    ],
    pendingDeposits: [
      {
        id: 'dep-demo-001',
        userId: 'u-joao-002',
        userName: 'João Manuel',
        userPhone: '912345678',
        amount: 25000,
        bank: 'BFA – Banco de Fomento de Angola',
        reference: 'TRF-BFA-20260709-001',
        notes: 'Transferência bancária de conta poupança',
        status: 'pending',
        createdAt: d(2),
      },
      {
        id: 'dep-demo-002',
        userId: 'u-mari-003',
        userName: 'Maria Santos',
        userPhone: '934567890',
        amount: 10000,
        bank: 'BAI – Banco Angolano de Investimentos',
        reference: 'DEP-BAI-20260710-004',
        notes: '',
        status: 'pending',
        createdAt: d(1),
      },
    ],
  };
}

function readFallback() {
  try {
    if (fs.existsSync(FALLBACK_PATH)) {
      return JSON.parse(fs.readFileSync(FALLBACK_PATH, 'utf-8'));
    }
  } catch (_) {}
  const initial = getInitialDemoData();
  writeFallback(initial);
  return initial;
}

function writeFallback(data) {
  try {
    fs.mkdirSync(path.dirname(FALLBACK_PATH), { recursive: true });
    fs.writeFileSync(FALLBACK_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (_) {}
}

let _seededPrisma = false;

async function ensurePrismaSeeded() {
  if (_seededPrisma) return;
  const count = await prisma.user.count();
  if (count === 0) {
    const demo = getInitialDemoData();
    for (const u of demo.users) {
      await prisma.user.create({
        data: {
          ...u,
          createdAt: new Date(u.createdAt),
        },
      });
    }
    for (const t of demo.transactions) {
      await prisma.transaction.create({
        data: {
          ...t,
          timestamp: new Date(t.timestamp),
        },
      });
    }
    for (const d of demo.pendingDeposits) {
      await prisma.pendingDeposit.create({
        data: {
          ...d,
          createdAt: new Date(d.createdAt),
        },
      });
    }
  }
  _seededPrisma = true;
}

export const DBService = {
  // ===== USERS =====
  async getUsers() {
    try {
      await ensurePrismaSeeded();
      return await prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
    } catch {
      return readFallback().users;
    }
  },

  async getUserById(id) {
    try {
      await ensurePrismaSeeded();
      return await prisma.user.findUnique({ where: { id } });
    } catch {
      return readFallback().users.find((u) => u.id === id) || null;
    }
  },

  async getUserByPhone(phone) {
    const clean = (phone || '').replace(/\s/g, '');
    try {
      await ensurePrismaSeeded();
      return await prisma.user.findUnique({ where: { phone: clean } });
    } catch {
      return readFallback().users.find((u) => u.phone === clean) || null;
    }
  },

  async getUserByNif(nif) {
    const clean = (nif || '').toUpperCase().trim();
    if (!clean) return null;
    try {
      await ensurePrismaSeeded();
      return await prisma.user.findUnique({ where: { nif: clean } });
    } catch {
      return readFallback().users.find((u) => u.nif && u.nif.toUpperCase() === clean) || null;
    }
  },

  async createUser(userData) {
    const record = {
      id: uid(),
      name: userData.name.trim(),
      phone: userData.phone.replace(/\D/g, ''),
      pin: userData.pin,
      role: userData.role || 'user',
      nif: userData.nif ? userData.nif.toUpperCase().trim() : null,
      balance: userData.balance ?? 0.0,
      isBlocked: false,
      fixedQrCode: null,
      avatar: null,
      faceIdEnabled: false,
    };
    try {
      await ensurePrismaSeeded();
      return await prisma.user.create({ data: record });
    } catch {
      const store = readFallback();
      const created = { ...record, createdAt: new Date().toISOString() };
      store.users.push(created);
      writeFallback(store);
      return created;
    }
  },

  async updateUser(id, fields) {
    try {
      await ensurePrismaSeeded();
      return await prisma.user.update({
        where: { id },
        data: fields,
      });
    } catch {
      const store = readFallback();
      const idx = store.users.findIndex((u) => u.id === id);
      if (idx === -1) return null;
      store.users[idx] = { ...store.users[idx], ...fields };
      writeFallback(store);
      return store.users[idx];
    }
  },

  // ===== TRANSACTIONS =====
  async getTransactions(userId = null) {
    try {
      await ensurePrismaSeeded();
      if (!userId) {
        return await prisma.transaction.findMany({ orderBy: { timestamp: 'desc' } });
      }
      const all = await prisma.transaction.findMany({
        where: {
          OR: [{ fromUserId: userId }, { toUserId: userId }],
        },
        orderBy: { timestamp: 'desc' },
      });
      return all.filter((tx) => {
        if (tx.type === 'transfer_out' || tx.type === 'qr_payment_out') return tx.fromUserId === userId;
        if (tx.type === 'transfer_in' || tx.type === 'qr_payment_in') return tx.toUserId === userId;
        return tx.fromUserId === userId || tx.toUserId === userId;
      });
    } catch {
      const all = readFallback().transactions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      if (!userId) return all;
      return all.filter((tx) => {
        if (tx.type === 'transfer_out' || tx.type === 'qr_payment_out') return tx.fromUserId === userId;
        if (tx.type === 'transfer_in' || tx.type === 'qr_payment_in') return tx.toUserId === userId;
        return tx.fromUserId === userId || tx.toUserId === userId;
      });
    }
  },

  async adjustBalance({ userId, delta, type, description, note = null }) {
    try {
      await ensurePrismaSeeded();
      return await prisma.$transaction(async (txPrisma) => {
        const user = await txPrisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new Error('Utilizador não encontrado');
        const newBal = Math.round((user.balance + delta) * 100) / 100;
        if (newBal < 0) throw new Error('Saldo insuficiente');

        const updatedUser = await txPrisma.user.update({
          where: { id: userId },
          data: { balance: newBal },
        });

        const txRecord = await txPrisma.transaction.create({
          data: {
            type,
            amount: Math.abs(delta),
            description,
            note,
            fromUserId: delta < 0 ? userId : null,
            toUserId: delta > 0 ? userId : null,
            status: 'completed',
          },
        });

        return { user: updatedUser, transaction: txRecord };
      });
    } catch (err) {
      if (err.message === 'Saldo insuficiente' || err.message === 'Utilizador não encontrado') {
        throw err;
      }
      const store = readFallback();
      const idx = store.users.findIndex((u) => u.id === userId);
      if (idx === -1) throw new Error('Utilizador não encontrado');
      const newBal = Math.round((store.users[idx].balance + delta) * 100) / 100;
      if (newBal < 0) throw new Error('Saldo insuficiente');
      store.users[idx].balance = newBal;
      const txRecord = {
        id: uid(),
        type,
        amount: Math.abs(delta),
        description,
        note,
        fromUserId: delta < 0 ? userId : null,
        toUserId: delta > 0 ? userId : null,
        timestamp: new Date().toISOString(),
        status: 'completed',
      };
      store.transactions.unshift(txRecord);
      writeFallback(store);
      return { user: store.users[idx], transaction: txRecord };
    }
  },

  async executeTransfer({ fromUserId, toPhone, amount, note = '', isQr = false, qrDescription = '' }) {
    const cleanPhone = (toPhone || '').replace(/\s/g, '');
    try {
      await ensurePrismaSeeded();
      return await prisma.$transaction(async (txPrisma) => {
        const fromUser = await txPrisma.user.findUnique({ where: { id: fromUserId } });
        const toUser = await txPrisma.user.findUnique({ where: { phone: cleanPhone } });

        if (!fromUser) throw new Error('Utilizador remetente não encontrado');
        if (!toUser) throw new Error('Destinatário não encontrado. Verifique o número.');
        if (fromUser.id === toUser.id) throw new Error('Não pode transferir para si mesmo');
        if (fromUser.balance < amount) throw new Error('Saldo insuficiente');

        const updatedFrom = await txPrisma.user.update({
          where: { id: fromUser.id },
          data: { balance: Math.round((fromUser.balance - amount) * 100) / 100 },
        });

        const updatedTo = await txPrisma.user.update({
          where: { id: toUser.id },
          data: { balance: Math.round((toUser.balance + amount) * 100) / 100 },
        });

        const outTx = await txPrisma.transaction.create({
          data: {
            type: isQr ? 'qr_payment_out' : 'transfer_out',
            amount,
            description: isQr ? `Pagamento QR · ${qrDescription || toUser.name}` : `Transferência para ${toUser.name}`,
            note: note || null,
            fromUserId: fromUser.id,
            toUserId: toUser.id,
            status: 'completed',
          },
        });

        await txPrisma.transaction.create({
          data: {
            type: isQr ? 'qr_payment_in' : 'transfer_in',
            amount,
            description: isQr ? `Venda QR · ${qrDescription || 'Pagamento recebido'}` : `Transferência de ${fromUser.name}`,
            note: note || null,
            fromUserId: fromUser.id,
            toUserId: toUser.id,
            status: 'completed',
          },
        });

        return { fromUser: updatedFrom, toUser: updatedTo, transaction: outTx };
      });
    } catch (err) {
      const known = [
        'Utilizador remetente não encontrado',
        'Destinatário não encontrado. Verifique o número.',
        'Não pode transferir para si mesmo',
        'Saldo insuficiente',
      ];
      if (known.includes(err.message)) throw err;

      const store = readFallback();
      const fromIdx = store.users.findIndex((u) => u.id === fromUserId);
      const toIdx = store.users.findIndex((u) => u.phone === cleanPhone);
      if (fromIdx === -1) throw new Error('Utilizador remetente não encontrado');
      if (toIdx === -1) throw new Error('Destinatário não encontrado. Verifique o número.');
      if (fromIdx === toIdx) throw new Error('Não pode transferir para si mesmo');
      if (store.users[fromIdx].balance < amount) throw new Error('Saldo insuficiente');

      store.users[fromIdx].balance = Math.round((store.users[fromIdx].balance - amount) * 100) / 100;
      store.users[toIdx].balance = Math.round((store.users[toIdx].balance + amount) * 100) / 100;

      const nowIso = new Date().toISOString();
      const outTx = {
        id: uid(),
        type: isQr ? 'qr_payment_out' : 'transfer_out',
        amount,
        description: isQr
          ? `Pagamento QR · ${qrDescription || store.users[toIdx].name}`
          : `Transferência para ${store.users[toIdx].name}`,
        note: note || null,
        fromUserId: store.users[fromIdx].id,
        toUserId: store.users[toIdx].id,
        timestamp: nowIso,
        status: 'completed',
      };
      const inTx = {
        id: uid(),
        type: isQr ? 'qr_payment_in' : 'transfer_in',
        amount,
        description: isQr
          ? `Venda QR · ${qrDescription || 'Pagamento recebido'}`
          : `Transferência de ${store.users[fromIdx].name}`,
        note: note || null,
        fromUserId: store.users[fromIdx].id,
        toUserId: store.users[toIdx].id,
        timestamp: nowIso,
        status: 'completed',
      };

      store.transactions.unshift(outTx, inTx);
      writeFallback(store);
      return { fromUser: store.users[fromIdx], toUser: store.users[toIdx], transaction: outTx };
    }
  },

  // ===== PENDING DEPOSITS =====
  async getPendingDeposits() {
    try {
      await ensurePrismaSeeded();
      return await prisma.pendingDeposit.findMany({
        where: { status: 'pending' },
        orderBy: { createdAt: 'desc' },
      });
    } catch {
      return readFallback().pendingDeposits.filter((d) => d.status === 'pending');
    }
  },

  async createPendingDeposit({ userId, userName, userPhone, amount, bank, reference, notes = '' }) {
    try {
      await ensurePrismaSeeded();
      return await prisma.pendingDeposit.create({
        data: {
          userId,
          userName,
          userPhone,
          amount: Number(amount),
          bank,
          reference,
          notes,
          status: 'pending',
        },
      });
    } catch {
      const store = readFallback();
      const dep = {
        id: 'dep-' + uid().slice(0, 8),
        userId,
        userName,
        userPhone,
        amount: Number(amount),
        bank,
        reference,
        notes,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };
      store.pendingDeposits.unshift(dep);
      writeFallback(store);
      return dep;
    }
  },

  async approvePendingDeposit(depId) {
    try {
      await ensurePrismaSeeded();
      return await prisma.$transaction(async (txPrisma) => {
        const dep = await txPrisma.pendingDeposit.findUnique({ where: { id: depId } });
        if (!dep || dep.status !== 'pending') throw new Error('Depósito não encontrado ou já processado');

        const user = await txPrisma.user.findUnique({ where: { id: dep.userId } });
        if (!user) throw new Error('Utilizador não encontrado');

        const updatedUser = await txPrisma.user.update({
          where: { id: user.id },
          data: { balance: Math.round((user.balance + dep.amount) * 100) / 100 },
        });

        await txPrisma.transaction.create({
          data: {
            type: 'deposit',
            amount: dep.amount,
            description: `Depósito bancário aprovado · ${dep.bank}`,
            fromUserId: null,
            toUserId: user.id,
            status: 'completed',
          },
        });

        await txPrisma.pendingDeposit.delete({ where: { id: depId } });
        return { dep, user: updatedUser };
      });
    } catch (err) {
      if (err.message.includes('não encontrado')) throw err;
      const store = readFallback();
      const depIdx = store.pendingDeposits.findIndex((d) => d.id === depId);
      if (depIdx === -1) throw new Error('Depósito não encontrado');
      const dep = store.pendingDeposits[depIdx];
      const uIdx = store.users.findIndex((u) => u.id === dep.userId);
      if (uIdx === -1) throw new Error('Utilizador não encontrado');

      store.users[uIdx].balance = Math.round((store.users[uIdx].balance + dep.amount) * 100) / 100;
      store.transactions.unshift({
        id: uid(),
        type: 'deposit',
        amount: dep.amount,
        description: `Depósito bancário aprovado · ${dep.bank}`,
        fromUserId: null,
        toUserId: dep.userId,
        timestamp: new Date().toISOString(),
        status: 'completed',
      });
      store.pendingDeposits.splice(depIdx, 1);
      writeFallback(store);
      return { dep, user: store.users[uIdx] };
    }
  },

  async rejectPendingDeposit(depId) {
    try {
      await ensurePrismaSeeded();
      await prisma.pendingDeposit.delete({ where: { id: depId } });
      return true;
    } catch {
      const store = readFallback();
      store.pendingDeposits = store.pendingDeposits.filter((d) => d.id !== depId);
      writeFallback(store);
      return true;
    }
  },
};

