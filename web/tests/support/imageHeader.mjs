/**
 * 이미지 파일 머리에서 형식과 픽셀 크기를 읽는다.
 * 이미지 최적화로 PNG·JPEG가 WebP로 바뀌어도 같은 검사를 쓸 수 있게 테스트끼리 나눠 쓴다.
 * JPEG는 형식만 확인하고 크기는 읽지 않는다.
 */
export function readImageHeader(bytes) {
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return { format: 'png', width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return { format: 'jpeg' };
  if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') {
    const chunk = bytes.toString('ascii', 12, 16);
    if (chunk === 'VP8X') {
      return { format: 'webp', width: 1 + bytes.readUIntLE(24, 3), height: 1 + bytes.readUIntLE(27, 3) };
    }
    if (chunk === 'VP8L') {
      const bits = bytes.readUInt32LE(21);
      return { format: 'webp', width: 1 + (bits & 0x3fff), height: 1 + ((bits >>> 14) & 0x3fff) };
    }
    if (chunk === 'VP8 ') {
      return { format: 'webp', width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff };
    }
  }
  return { format: 'unknown' };
}
