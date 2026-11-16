'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQPay } from '@/context/QPayContext';
import { buildQRPayload, formatKz } from '@/lib/utils';
import { renderQRWithLogo } from '@/lib/qrHelper';
import BottomNav from '@/components/BottomNav';
import QRCanvas from '@/components/QRCanvas';

export default function QRCodePage() {
  const router = useRouter();
  const { user, loadingAuth, showToast } = useQPay();

  const [mode, setMode] = useState('fixed'); // 'fixed' | 'dynamic'
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [durationMins, setDurationMins] = useState(30);
  const [customPayload, setCustomPayload] = useState(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!loadingAuth && !user) {
      router.push('/');
    }
  }, [user, loadingAuth, router]);

  if (loadingAuth || !user) return null;

  const fixedPayload =
    user.fixedQrCode || buildQRPayload('fixed', user, { description: `Pagamento para ${user.name}` });

  // Auto-atualizar payload dinâmico quando utilizador altera valor ou duração no modo dinâmico
  useEffect(() => {
    if (mode === 'dynamic') {
      const amt = parseFloat(amount);
      if (amt && amt > 0) {
        const expiresAt = new Date(Date.now() + durationMins * 60000).toISOString();
        const payload = buildQRPayload('dynamic', user, {
          amount: amt,
          description: description.trim() || `Pagamento de ${amt} Kz`,
          expiresAt,
        });
        setCustomPayload(payload);
      }
    }
  }, [mode, amount, description, durationMins, user]);

  const activePayload = mode === 'fixed' ? fixedPayload : customPayload || fixedPayload;

  const handleGenerateDynamic = () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      showToast('Insira um valor válido em Kz', 'error');
      return;
    }
    const expiresAt = new Date(Date.now() + durationMins * 60000).toISOString();
    const payload = buildQRPayload('dynamic', user, {
      amount: amt,
      description: description.trim() || `Pagamento de ${amt} Kz`,
      expiresAt,
    });
    setCustomPayload(payload);
    showToast('QR Code Dinâmico atualizado!', 'success');
  };

  const downloadPNG = async () => {
    showToast('A preparar imagem PNG...', 'success');
    try {
      const qrCanvas = await renderQRWithLogo({
        payload: activePayload,
        size: 300,
        scale: 2,
      });
      const link = document.createElement('a');
      link.download = `QPAY_QR_${user.phone}.png`;
      link.href = qrCanvas.toDataURL('image/png');
      link.click();
      showToast('QR Code guardado em PNG!', 'success');
    } catch {
      showToast('Erro ao guardar imagem', 'error');
    }
  };

  const downloadPDF = async () => {
    showToast('A gerar PDF em alta resolução...', 'success');
    try {
      const { jsPDF } = await import('jspdf');
      // Renderiza QR em alta definição com o logótipo QPAY AO garantido no centro
      const qrCanvas = await renderQRWithLogo({
        payload: activePayload,
        size: 260,
        scale: 2,
      });

      const imgData = qrCanvas.toDataURL('image/png');
      const pxW = qrCanvas.width + 120; // 520 + 120 = 640px
      const pxH = qrCanvas.height + 280; // Espaço amplo para textos em tamanho aumentado sem corte

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [pxW, pxH] });
      pdf.setFillColor(255, 255, 255);
      pdf.rect(0, 0, pxW, pxH, 'F');

      // Cabeçalho QPAY AO
      pdf.setFontSize(26);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(15, 23, 42);
      pdf.text('QPAY AO', pxW / 2, 42, { align: 'center' });

      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(100, 116, 139);
      const isDynamic = mode === 'dynamic';
      pdf.text(
        isDynamic ? 'QR Code Dinâmico de Pagamento' : 'QR Code Fixo · Pagamento Comercial',
        pxW / 2,
        64,
        { align: 'center' }
      );

      // Imagem do QR Code com o logótipo no centro
      pdf.addImage(imgData, 'PNG', 60, 84, qrCanvas.width, qrCanvas.height);

      // Nome do comerciante/utilizador com tamanho aumentado em 3x (36pt)
      pdf.setFontSize(36);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(15, 23, 42);
      const nameY = 84 + qrCanvas.height + 45;
      pdf.text(user.name, pxW / 2, nameY, { align: 'center' });

      let nextY = nameY + 36;
      // Se for dinâmico e tiver valor, apresenta o valor em destaque
      if (isDynamic && amount) {
        pdf.setFontSize(28);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(5, 150, 105);
        pdf.text(formatKz(amount), pxW / 2, nextY, { align: 'center' });
        nextY += 32;
      }

      // Telefone
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(100, 116, 139);
      pdf.text(`+244 ${user.phone}`, pxW / 2, nextY, { align: 'center' });

      // Rodapé institucional
      pdf.setFontSize(11);
      pdf.setTextColor(148, 163, 184);
      pdf.text('Uíge, Angola · Inclusão Financeira · QPAY AO', pxW / 2, pxH - 20, { align: 'center' });

      pdf.save(`QPAY_QR_${user.phone}.pdf`);
      showToast('PDF descarregado com sucesso!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Erro ao gerar PDF', 'error');
    }
  };

  return (
    <div className="app-wrapper">
      <div className="bg-glow" />

      <div className="header">
        <button className="icon-btn" onClick={() => router.push('/dashboard')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span className="header-title">O Meu QR Code</span>
        <div style={{ width: 38 }} />
      </div>

      <div className="page page-enter">
        <div className="page-inner">
          <div style={{ height: 16 }} />

          <div className="auth-tabs mb-5">
            <div
              className={`auth-tab ${mode === 'fixed' ? 'active' : ''}`}
              onClick={() => setMode('fixed')}
            >
              QR Fixo (Valor Livre)
            </div>
            <div
              className={`auth-tab ${mode === 'dynamic' ? 'active' : ''}`}
              onClick={() => setMode('dynamic')}
            >
              QR Dinâmico (Com Valor)
            </div>
          </div>

          {mode === 'dynamic' && (
            <div className="card mb-5">
              <div className="flex flex-col gap-3">
                <div className="input-group">
                  <label className="input-label">Valor a cobrar (Kz)</label>
                  <input
                    type="number"
                    className="input"
                    placeholder="Ex: 3500"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
                <div className="input-group">
                  <label className="input-label">Descrição (opcional)</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Ex: Produtos alimentares"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
                <div className="input-group">
                  <label className="input-label">Validade</label>
                  <select
                    className="input"
                    value={durationMins}
                    onChange={(e) => setDurationMins(Number(e.target.value))}
                  >
                    <option value={15}>15 minutos</option>
                    <option value={30}>30 minutos</option>
                    <option value={60}>1 hora</option>
                    <option value={1440}>24 horas</option>
                  </select>
                </div>
                <button className="btn btn-primary btn-full" onClick={handleGenerateDynamic}>
                  Atualizar QR Dinâmico
                </button>
              </div>
            </div>
          )}

          <div className="card" style={{ textAlign: 'center', padding: 24 }}>
            <div
              style={{
                display: 'inline-block',
                padding: '4px 12px',
                borderRadius: 99,
                fontSize: 11,
                fontWeight: 700,
                background: 'var(--primary-100)',
                color: 'var(--primary)',
                marginBottom: 14,
              }}
            >
              {mode === 'fixed' ? '🔒 QR FIXO · PERMANENTE' : '⚡ QR DINÂMICO'}
            </div>

            <div className="t-lg fw-bold">{user.name}</div>
            <div className="t-sm text-muted mb-4">+244 {user.phone}</div>

            <div
              style={{
                background: '#fff',
                padding: 18,
                borderRadius: 20,
                display: 'inline-block',
                boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
                marginBottom: 16,
              }}
            >
              <QRCanvas
                payload={activePayload}
                size={210}
                onCanvasReady={(c) => {
                  canvasRef.current = c;
                }}
              />
            </div>

            {mode === 'dynamic' && amount && (
              <div className="t-xl fw-black text-success mb-3">{formatKz(amount)}</div>
            )}

            <div className="flex gap-2 mt-2">
              <button className="btn btn-ghost flex-1" onClick={downloadPNG}>
                Baixar PNG
              </button>
              <button className="btn btn-primary flex-1" onClick={downloadPDF}>
                Baixar PDF
              </button>
            </div>

            <button
              className="btn btn-ghost btn-full mt-2"
              onClick={() => {
                navigator.clipboard?.writeText(activePayload);
                showToast('Código QR copiado para área de transferência!', 'success');
              }}
            >
              📋 Copiar Código QR (para testar no Scanner)
            </button>
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}

