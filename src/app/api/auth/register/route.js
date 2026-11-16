import { NextResponse } from 'next/server';
import { DBService } from '@/lib/db';
import { validateNIF } from '@/lib/utils';

export async function POST(request) {
  try {
    const body = await request.json();
    const name = (body.name || '').trim();
    const cleanPhone = (body.phone || '').replace(/\D/g, '');
    const pin = (body.pin || '').trim();
    const cleanNif = (body.nif || '').toUpperCase().trim();
    const role = body.role === 'agent' ? 'agent' : 'user';

    if (!name || name.length < 2) {
      return NextResponse.json(
        { success: false, message: 'Nome inválido (mínimo 2 caracteres)' },
        { status: 400 }
      );
    }

    if (!cleanPhone || cleanPhone.length !== 9) {
      return NextResponse.json(
        { success: false, message: 'Número de telefone inválido (deve ter 9 dígitos angolanos)' },
        { status: 400 }
      );
    }

    if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      return NextResponse.json(
        { success: false, message: 'PIN deve ter exactamente 4 dígitos' },
        { status: 400 }
      );
    }

    if (!validateNIF(cleanNif)) {
      return NextResponse.json(
        {
          success: false,
          message: 'NIF inválido. Formato: 9 dígitos + 2 letras maiúsculas + 3 dígitos (ex: 008050798UE048)',
        },
        { status: 400 }
      );
    }

    const existingPhone = await DBService.getUserByPhone(cleanPhone);
    if (existingPhone) {
      return NextResponse.json(
        { success: false, message: 'Este número já está registado' },
        { status: 409 }
      );
    }

    const existingNif = await DBService.getUserByNif(cleanNif);
    if (existingNif) {
      return NextResponse.json(
        { success: false, message: 'Este NIF já está registado' },
        { status: 409 }
      );
    }

    const newUser = await DBService.createUser({
      name,
      phone: cleanPhone,
      pin,
      nif: cleanNif,
      role,
    });

    return NextResponse.json({ success: true, user: newUser });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err.message || 'Erro ao criar conta' },
      { status: 500 }
    );
  }
}

