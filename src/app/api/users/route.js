import { NextResponse } from 'next/server';
import { DBService } from '@/lib/db';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get('phone');

    if (phone) {
      const user = await DBService.getUserByPhone(phone);
      return NextResponse.json({ success: !!user, user });
    }

    const users = await DBService.getUsers();
    return NextResponse.json({ success: true, users });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err.message || 'Erro ao buscar utilizadores' },
      { status: 500 }
    );
  }
}

