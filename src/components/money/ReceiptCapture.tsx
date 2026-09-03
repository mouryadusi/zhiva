'use client';

import { useRef, useState } from 'react';
import { Card } from '@/components/design-system/Primitives';
import { extractReceiptFields } from '@/lib/receipt-ocr';

export function ReceiptCapture({ onOpenChange }: { onOpenChange?: (open: boolean) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  async function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      setPreview(dataUrl);
      onOpenChange?.(true);
      setChecking(true);
      const result = await extractReceiptFields(dataUrl);
      setChecking(false);
      setStatus(result.available ? null : result.reason ?? null);
    };
    reader.readAsDataURL(file);
  }

  function clear() {
    setPreview(null);
    setStatus(null);
    onOpenChange?.(false);
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div>
      <label htmlFor="receipt-photo" className="text-sm font-medium text-accent">
        {preview ? 'Change photo' : '+ Attach a receipt photo'}
      </label>
      <input
        id="receipt-photo"
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />

      {preview && (
        <Card className="mt-3 !p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Receipt preview" className="max-h-56 w-full rounded-lg object-contain" />
          <p className="mt-2 text-xs text-ink-faint">
            {checking
              ? 'Checking for automatic extraction…'
              : status ?? 'Details extracted — review before saving.'}
          </p>
          <p className="mt-1 text-xs text-ink-faint">
            This photo is for reference only right now — it isn&apos;t uploaded or saved with the
            transaction yet. Read the amount and merchant below and enter them in the form.
          </p>
          <button type="button" onClick={clear} className="mt-2 text-xs font-medium text-critical">
            Remove photo
          </button>
        </Card>
      )}
    </div>
  );
}
