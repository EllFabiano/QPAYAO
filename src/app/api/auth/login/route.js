import { NextResponse } from 'next/server';
import { DBService } from '@/lib/db';

export async function POST(request) {
  try {
    const body = await request.json();
    const phone = (body.phone || '').replace(/\s/g, '');
    const pin = (body.pin || '').trim();

    if (!phone || !pin) {
      return NextResponse.json(
        { success: false, message: 'Insira o número de telefone e o PIN' },
        { status: 400 }
      );
    }

    const user = await DBService.getUserByPhone(phone);
    if (!user || user.pin !== pin) {
      return NextResponse.json(
        { success: false, message: 'Número de telefone ou PIN incorrectos' },
        { status: 401 }
      );
    }

    if (user.isBlocked) {
      return NextResponse.json(
        { success: false, message: 'Conta bloqueada. Contacte o seu agente.' },
        { status: 403 }
      );
    }

    return NextResponse.json({ success: true, user });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err.message || 'Erro interno no servidor' },
      { status: 500 }
    );
  }
}

