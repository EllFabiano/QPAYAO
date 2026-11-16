# QPAY AO — Next.js + Node.js + Prisma + PostgreSQL

Versão fullstack do sistema de pagamentos digitais por QR Code **QPAY AO**, convertida para **JavaScript + Next.js (App Router) + Node.js API Routes + Prisma ORM (PostgreSQL)**.

---

## 🚀 Como Executar o Projeto

### 1. Entrar na pasta do projeto e instalar dependências
```bash
cd qpay-next
npm install
```

### 2. Configurar o PostgreSQL no `.env`
Edite o ficheiro `.env` com a sua string de conexão PostgreSQL (local, Supabase ou Neon):
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/qpay_ao?schema=public"
```

### 3. Gerar o Prisma Client, criar as tabelas e popular dados demo
```bash
npm run db:generate
npm run db:push
npm run db:seed
```
*(Nota: Mesmo que inicie o servidor antes de ligar o PostgreSQL, o `src/lib/db.js` possui auto-seed e fallback automático para que a aplicação funcione imediatamente!)*

### 4. Iniciar o servidor de desenvolvimento
```bash
npm run dev
```
Abra **http://localhost:3000** no navegador.

---

## 🔑 Contas de Demonstração

| Perfil | Telefone | PIN |
| :--- | :--- | :--- |
| **Utilizador Demo** | `923456789` | `1234` |
| **Agente Demo** | `930000001` | `9999` |
| **Administrador Demo** | `940375951` | `1122` |

