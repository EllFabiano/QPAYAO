import { NextResponse } from 'next/server';
import { DBService } from '@/lib/db';

export async function GET() {
  try {
    const deposits = await DBService.getPendingDeposits();
    return NextResponse.json({ success: true, deposits });
  } catch (err) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { userId, userName, userPhone, amount, bank, reference, notes } = body;

    if (!userId || !amount || Number(amount) <= 0 || !bank || !reference) {
      return NextResponse.json(
        { success: false, message: 'Preencha todos os dados obrigatórios do depósito' },
        { status: 400 }
      );
    }

    const dep = await DBService.createPendingDeposit({
      userId,
      userName,
      userPhone,
      amount: Number(amount),
      bank,
      reference,
      notes: notes || '',
    });

    return NextResponse.json({ success: true, deposit: dep });
  } catch (err) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const body = await request.json();
    const { id, action } = body;

    if (!id || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ success: false, message: 'Parâmetros inválidos' }, { status: 400 });
    }

    if (action === 'approve') {
      const res = await DBService.approvePendingDeposit(id);
      return NextResponse.json({ success: true, ...res });
    } else {
      await DBService.rejectPendingDeposit(id);
      return NextResponse.json({ success: true });
    }
  } catch (err) {
    return NextResponse.json({ success: false, message: err.message }, { status: 400 });
  }
}

