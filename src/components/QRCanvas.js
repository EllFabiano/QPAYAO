'use client';

import React, { useEffect, useRef } from 'react';
import { renderQRWithLogo } from '@/lib/qrHelper';

export default function QRCanvas({ payload, size = 190, onCanvasReady }) {
  const canvasRef = useRef(null);
  const onCanvasReadyRef = useRef(onCanvasReady);
  onCanvasReadyRef.current = onCanvasReady;

  const lastKeyRef = useRef('');

  useEffect(() => {
    if (!payload || !canvasRef.current) return;

    const currentKey = `${payload}___${size}`;
    if (lastKeyRef.current === currentKey) {
      if (onCanvasReadyRef.current) onCanvasReadyRef.current(canvasRef.current);
      return;
    }

    let isMounted = true;
    renderQRWithLogo({
      payload,
      size,
      scale: 2,
      targetCanvas: canvasRef.current,
    }).then((c) => {
      if (!isMounted || !c) return;
      lastKeyRef.current = currentKey;
      if (onCanvasReadyRef.current) {
        onCanvasReadyRef.current(c);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [payload, size]);

  return <canvas ref={canvasRef} style={{ borderRadius: 8, display: 'block' }} />;
}
