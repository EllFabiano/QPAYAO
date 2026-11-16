'use client';

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';

export default function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <nav className="bottom-nav">
      <div
        className={`nav-item ${pathname === '/dashboard' ? 'active' : ''}`}
        onClick={() => router.push('/dashboard')}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
        <span>Início</span>
      </div>

      <div
        className={`nav-item ${pathname === '/historico' ? 'active' : ''}`}
        onClick={() => router.push('/historico')}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
        <span>Histórico</span>
      </div>

      <div
        className="nav-center-btn"
        onClick={() => router.push('/scanner')}
        title="Scanner QR"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="23 7 23 1 17 1" />
          <line x1="23" y1="1" x2="16" y2="8" />
          <polyline points="1 17 1 23 7 23" />
          <line x1="1" y1="23" x2="8" y2="16" />
          <rect x="8" y="8" width="8" height="8" rx="1" opacity=".4" />
        </svg>
      </div>

      <div
        className={`nav-item ${pathname === '/qrcode' ? 'active' : ''}`}
        onClick={() => router.push('/qrcode')}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <path d="M14 14h.01M14 17h3M17 14h3M17 17v3" />
        </svg>
        <span>Meu QR</span>
      </div>

      <div
        className={`nav-item ${pathname === '/transferir' ? 'active' : ''}`}
        onClick={() => router.push('/transferir')}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
        <span>Transferir</span>
      </div>
    </nav>
  );
}

