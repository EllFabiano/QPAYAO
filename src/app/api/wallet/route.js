import { NextResponse } from 'next/server';
import { DBService } from '@/lib/db';

export async function POST(request) {
  try {
    const body = await request.json();
    const { action } = body;

    // 1. LEVANTAMENTO (WITHDRAW)
    if (action === 'withdraw') {
      const amount = Number(body.amount);
      if (!amount || amount < 100) {
        return NextResponse.json(
          { success: false, message: 'Valor mínimo de levantamento: 100 Kz' },
          { status: 400 }
        );
      }
      const res = await DBService.adjustBalance({
        userId: body.userId,
        delta: -amount,
        type: 'withdrawal',
        description: body.description || 'Levantamento em dinheiro',
      });
      return NextResponse.json({ success: true, newBalance: res.user.balance, user: res.user, transaction: res.transaction });
    }

    // 2. DEPÓSITO DIRETO / AJUSTE DE SALDO (ADMIN & AGENTE)
    if (action === 'adjustBalance') {
      const amount = Number(body.amount);
      const mode = body.mode === 'remove' ? 'remove' : 'add';
      if (!amount || amount <= 0) {
        return NextResponse.json({ success: false, message: 'Insira um valor válido' }, { status: 400 });
      }
      const res = await DBService.adjustBalance({
        userId: body.userId,
        delta: mode === 'add' ? amount : -amount,
        type: mode === 'add' ? 'deposit' : 'withdrawal',
        description: body.description || (mode === 'add' ? 'Crédito em conta' : 'Débito em conta'),
      });
      return NextResponse.json({ success: true, newBalance: res.user.balance, user: res.user, transaction: res.transaction });
    }

    // 3. TRANSFERÊNCIA ENTRE CONTAS
    if (action === 'transfer') {
      const amount = Number(body.amount);
      if (!amount || amount < 50) {
        return NextResponse.json({ success: false, message: 'Transferência mínima: 50 Kz' }, { status: 400 });
      }

      if (body.pin) {
        const sender = await DBService.getUserById(body.fromUserId);
        if (!sender || sender.pin !== body.pin) {
          return NextResponse.json({ success: false, message: 'PIN incorrecto' }, { status: 401 });
        }
      }

      const res = await DBService.executeTransfer({
        fromUserId: body.fromUserId,
        toPhone: body.toPhone,
        amount,
        note: body.note || '',
        isQr: false,
      });

      return NextResponse.json({
        success: true,
        recipient: res.toUser,
        newBalance: res.fromUser.balance,
        transaction: res.transaction,
      });
    }

    // 4. PAGAMENTO VIA QR CODE
    if (action === 'payByQR') {
      const { payerUserId, qrData, pin } = body;
      if (!qrData || (!qrData.merchantId && !qrData.merchantPhone)) {
        return NextResponse.json({ success: false, message: 'QR Code inválido' }, { status: 400 });
      }

      if (qrData.expiresAt && new Date(qrData.expiresAt) < new Date()) {
        return NextResponse.json({ success: false, message: 'QR Code expirado' }, { status: 400 });
      }

      const amount = Number(qrData.amount);
      if (!amount || amount <= 0) {
        return NextResponse.json({ success: false, message: 'Valor inválido no QR Code' }, { status: 400 });
      }

      const payer = await DBService.getUserById(payerUserId);
      if (!payer) {
        return NextResponse.json({ success: false, message: 'Pagador não encontrado' }, { status: 404 });
      }

      if (pin && payer.pin !== pin) {
        return NextResponse.json({ success: false, message: 'PIN incorrecto' }, { status: 401 });
      }

      let merchant = await DBService.getUserById(qrData.merchantId);
      if (!merchant && qrData.merchantPhone) {
        merchant = await DBService.getUserByPhone(qrData.merchantPhone);
      }

      if (!merchant) {
        return NextResponse.json({ success: false, message: 'Comerciante não encontrado no sistema' }, { status: 404 });
      }

      const res = await DBService.executeTransfer({
        fromUserId: payer.id,
        toPhone: merchant.phone,
        amount,
        note: qrData.description || '',
        isQr: true,
        qrDescription: qrData.description || merchant.name,
      });

      return NextResponse.json({
        success: true,
        merchant: res.toUser,
        newBalance: res.fromUser.balance,
        transaction: res.transaction,
      });
    }

    return NextResponse.json({ success: false, message: 'Ação desconhecida' }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err.message || 'Erro ao processar operação' },
      { status: 400 }
    );
  }
}

