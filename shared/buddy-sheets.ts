export const MAX_BUDDY_SHEET_SIZE = 10 * 1024 * 1024;

export function validateBuddySheetFile(file: { type: string; size: number }) {
  if (file.type !== "application/pdf") return "Choose a PDF file.";
  if (file.size === 0) return "The PDF file is empty.";
  if (file.size > MAX_BUDDY_SHEET_SIZE)
    return "PDF files must be 10 MB or smaller.";
  return null;
}

export function buddySheetFileName(name?: string) {
  return name?.trim() || "Buddy sheet.pdf";
}
