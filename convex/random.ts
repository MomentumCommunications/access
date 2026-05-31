export function fillRandomBytes(bytes: Uint8Array) {
  crypto.getRandomValues(bytes as Uint8Array<ArrayBuffer>);
}
