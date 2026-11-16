'use client';

import QRCode from 'qrcode';

/**
 * Carrega uma imagem de forma segura, com timeout e fallback.
 */
function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    const timer = setTimeout(() => resolve(null), 3000);
    img.onload = () => {
      clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timer);
      resolve(null);
    };
    img.src = src;
  });
}

/**
 * Gera um QR Code de alta resolução com o logótipo QPAY AO no centro.
 * Aguarda o logótipo estar 100% desenhado antes de resolver a Promise.
 */
export async function renderQRWithLogo({ payload, size = 220, scale = 2, targetCanvas = null }) {
  if (!payload) return null;

  const canvas = targetCanvas || document.createElement('canvas');
  const totalPixels = size * scale;
  canvas.width = totalPixels;
  canvas.height = totalPixels;
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;

  // 1. Gerar QR base num canvas temporário (errorCorrectionLevel H = 30% de area livre no centro)
  const tempCanvas = document.createElement('canvas');
  await QRCode.toCanvas(tempCanvas, payload, {
    width: totalPixels,
    margin: 1,
    color: { dark: '#000000', light: '#ffffff' },
    errorCorrectionLevel: 'H',
  });

  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tempCanvas, 0, 0, totalPixels, totalPixels);

  // 2. Escudo branco central para o logótipo
  const plateSize = Math.round(totalPixels * 0.26);
  const plateRadius = Math.round(plateSize * 0.2);
  const px = (totalPixels - plateSize) / 2;
  const py = (totalPixels - plateSize) / 2;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(px + plateRadius, py);
  ctx.lineTo(px + plateSize - plateRadius, py);
  ctx.arcTo(px + plateSize, py, px + plateSize, py + plateRadius, plateRadius);
  ctx.lineTo(px + plateSize, py + plateSize - plateRadius);
  ctx.arcTo(px + plateSize, py + plateSize, px + plateSize - plateRadius, py + plateSize, plateRadius);
  ctx.lineTo(px + plateRadius, py + plateSize);
  ctx.arcTo(px, py + plateSize, px, py + plateSize - plateRadius, plateRadius);
  ctx.lineTo(px, py + plateRadius);
  ctx.arcTo(px, py, px + plateRadius, py, plateRadius);
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.18)';
  ctx.shadowBlur = 7 * scale;
  ctx.shadowOffsetY = 2 * scale;
  ctx.fill();
  ctx.restore();

  // 3. Carregar e desenhar o logótipo QPAY AO (430x209 → proporcional)
  const logoImg = await loadImage('/Img/Qpaylogo.png');
  if (logoImg && logoImg.naturalWidth > 0) {
    const aspect = logoImg.naturalWidth / logoImg.naturalHeight; // ≈ 2.06
    const maxW = plateSize * 0.86;
    const maxH = plateSize * 0.86;
    let drawW = maxW;
    let drawH = drawW / aspect;
    if (drawH > maxH) {
      drawH = maxH;
      drawW = drawH * aspect;
    }
    const lx = (totalPixels - drawW) / 2;
    const ly = (totalPixels - drawH) / 2;
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(logoImg, lx, ly, drawW, drawH);
    ctx.restore();
  }

  return canvas;
}
