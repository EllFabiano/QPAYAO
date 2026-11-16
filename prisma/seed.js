/* ================================================
   QPAY AO — Prisma Seed (Dados de Demonstração)
   Executar com: npm run db:seed
================================================ */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 A inicializar dados de demonstração QPAY AO no PostgreSQL...');

  const now = Date.now();
  const d = (days, hours = 0) => new Date(now - days * 86400000 - hours * 3600000);

  // 1. Criar Utilizadores (Admin, Agente e Utilizadores Demo)
  const users = [
    {
      id: 'u-admin-000',
      name: 'Administrador QPAY',
      phone: '940375951',
      pin: '1122',
      role: 'admin',
      nif: '000000000LA000',
      balance: 0.0,
      isBlocked: false,
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
      createdAt: d(60),
    },
    {
      id: 'u-faby-001',
      name: 'Faby Mateus',
      phone: '923456789',
      pin: '1234',
      role: 'user',
      nif: '001234567LA001',
      balance: 45750.0,
      isBlocked: false,
      createdAt: d(45),
    },
    {
      id: 'u-joao-002',
      name: 'João Manuel',
      phone: '912345678',
      pin: '5678',
      role: 'user',
      nif: '002345678LA002',
      balance: 12300.5,
      isBlocked: false,
      createdAt: d(40),
    },
    {
      id: 'u-mari-003',
      name: 'Maria Santos',
      phone: '934567890',
      pin: '9012',
      role: 'user',
      nif: '003456789LA003',
      balance: 8950.75,
      isBlocked: false,
      createdAt: d(35),
    },
    {
      id: 'u-pedr-004',
      name: 'Pedro Luzolo',
      phone: '945678901',
      pin: '3456',
      role: 'user',
      nif: '004567890LA004',
      balance: 23500.0,
      isBlocked: false,
      createdAt: d(30),
    },
    {
      id: 'u-luci-005',
      name: 'Lúcia Mbemba',
      phone: '956789012',
      pin: '7890',
      role: 'user',
      nif: '005678901LA005',
      balance: 5600.0,
      isBlocked: false,
      createdAt: d(20),
    },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { phone: u.phone },
      update: {},
      create: u,
    });
  }

  // 2. Criar Transações Demo (apenas se a tabela estiver vazia)
  const txCount = await prisma.transaction.count();
  if (txCount === 0) {
    await prisma.transaction.createMany({
      data: [
        { type: 'deposit', amount: 20000, description: 'Depósito inicial em numerário', fromUserId: null, toUserId: 'u-faby-001', timestamp: d(30), status: 'completed' },
        { type: 'transfer_in', amount: 5000, description: 'Pagamento de João Manuel', fromUserId: 'u-joao-002', toUserId: 'u-faby-001', timestamp: d(20), status: 'completed' },
        { type: 'qr_payment_in', amount: 3500, description: 'Venda QR · Produtos alimentares', fromUserId: 'u-mari-003', toUserId: 'u-faby-001', timestamp: d(15), status: 'completed' },
        { type: 'transfer_out', amount: 2500, description: 'Transferência para Maria Santos', fromUserId: 'u-faby-001', toUserId: 'u-mari-003', timestamp: d(12), status: 'completed' },
        { type: 'deposit', amount: 15000, description: 'Depósito em numerário', fromUserId: null, toUserId: 'u-faby-001', timestamp: d(10), status: 'completed' },
        { type: 'qr_payment_in', amount: 1800, description: 'Venda QR · Bebidas', fromUserId: 'u-pedr-004', toUserId: 'u-faby-001', timestamp: d(7), status: 'completed' },
        { type: 'withdrawal', amount: 5000, description: 'Levantamento em dinheiro', fromUserId: 'u-faby-001', toUserId: null, timestamp: d(5), status: 'completed' },
        { type: 'qr_payment_in', amount: 4200, description: 'Venda QR · Frutas e legumes', fromUserId: 'u-joao-002', toUserId: 'u-faby-001', timestamp: d(3), status: 'completed' },
        { type: 'transfer_out', amount: 1250, description: 'Transferência para João Manuel', fromUserId: 'u-faby-001', toUserId: 'u-joao-002', timestamp: d(1, 4), status: 'completed' },
        { type: 'qr_payment_in', amount: 5000, description: 'Venda QR · Snacks e mercearia', fromUserId: 'u-luci-005', toUserId: 'u-faby-001', timestamp: d(0, 3), status: 'completed' },
      ],
    });
  }

  // 3. Criar Depósitos Bancários Pendentes Demo
  const depCount = await prisma.pendingDeposit.count();
  if (depCount === 0) {
    await prisma.pendingDeposit.createMany({
      data: [
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
    });
  }

  console.log('✅ Base de dados QPAY AO populada com sucesso!');
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

