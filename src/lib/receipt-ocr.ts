// Isolates receipt-OCR behind an interface so a real provider (Google
// Vision, AWS Textract, a self-hosted model, etc.) can be wired in
// later by implementing this function differently — nothing in the UI
// needs to change. No provider is configured in this codebase, so this
// always returns `available: false`. It never guesses at field values;
// there is no fallback heuristic that invents a merchant or amount.

export interface ReceiptExtraction {
  available: boolean;
  reason?: string;
  merchant?: string;
  date?: string;
  total?: number;
  currency?: string;
  tax?: number;
  category?: string;
  lineItems?: { description: string; amount: number }[];
}

export async function extractReceiptFields(_imageDataUrl: string): Promise<ReceiptExtraction> {
  return {
    available: false,
    reason:
      'Receipt scanning requires an OCR provider (e.g. Google Vision, AWS Textract) to be connected — none is configured. Enter the details manually below; your receipt photo stays visible for reference while you type.',
  };
}
