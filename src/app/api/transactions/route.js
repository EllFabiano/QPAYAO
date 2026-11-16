import { NextResponse } from 'next/server';
import { DBService } from '@/lib/db';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const filter = searchParams.get('filter') || 'all';

    let txs = await DBService.getTransactions(userId);

    const filterMap = {
      all: null,
      received: ['transfer_in', 'qr_payment_in'],
      sent: ['transfer_out', 'qr_payment_out'],
      deposit: ['deposit'],
      withdrawal: ['withdrawal'],
    };

    if (filter !== 'all' && filterMap[filter]) {
      txs = txs.filter((tx) => filterMap[filter].includes(tx.type));
    }

    return NextResponse.json({ success: true, transactions: txs });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err.message || 'Erro ao carregar transações' },
      { status: 500 }
    );
  }
}

