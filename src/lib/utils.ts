import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function channelNameOrFallback(channelName: string | undefined) {
  if (channelName === undefined) {
    return "Untitled";
  } else {
    return channelName;
  }
}

export function formatPhone(phone: string) {
  return phone.replace(/(\d{3})(\d{3})(\d{4})/, "($1) $2-$3");
}
