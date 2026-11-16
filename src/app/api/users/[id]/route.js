import { NextResponse } from 'next/server';
import { DBService } from '@/lib/db';

export async function GET(_request, { params }) {
  try {
    const { id } = params;
    const user = await DBService.getUserById(id);
    if (!user) {
      return NextResponse.json({ success: false, message: 'Utilizador não encontrado' }, { status: 404 });
    }
    return NextResponse.json({ success: true, user });
  } catch (err) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const { id } = params;
    const body = await request.json();

    // Se for alteração de PIN pelo próprio utilizador (requer currentPin)
    if (body.currentPin !== undefined) {
      const existing = await DBService.getUserById(id);
      if (!existing) {
        return NextResponse.json({ success: false, message: 'Utilizador não encontrado' }, { status: 404 });
      }
      if (existing.pin !== body.currentPin) {
        return NextResponse.json({ success: false, message: 'PIN atual incorreto' }, { status: 400 });
      }
      if (!body.newPin || !/^\d{4}$/.test(body.newPin)) {
        return NextResponse.json(
          { success: false, message: 'O novo PIN deve ter exatamente 4 dígitos' },
          { status: 400 }
        );
      }
      const updated = await DBService.updateUser(id, { pin: body.newPin });
      return NextResponse.json({ success: true, user: updated });
    }

    const allowed = {};
    if (body.name !== undefined) allowed.name = body.name;
    if (body.pin !== undefined) allowed.pin = body.pin;
    if (body.isBlocked !== undefined) allowed.isBlocked = Boolean(body.isBlocked);
    if (body.fixedQrCode !== undefined) allowed.fixedQrCode = body.fixedQrCode;
    if (body.avatar !== undefined) allowed.avatar = body.avatar;
    if (body.faceIdEnabled !== undefined) allowed.faceIdEnabled = Boolean(body.faceIdEnabled);

    const updated = await DBService.updateUser(id, allowed);
    if (!updated) {
      return NextResponse.json({ success: false, message: 'Utilizador não encontrado' }, { status: 404 });
    }
    return NextResponse.json({ success: true, user: updated });
  } catch (err) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

