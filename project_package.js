(function () {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder("utf-8");
  const crcTable = buildCrcTable();

  function buildCrcTable() {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
    return table;
  }

  function crc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  function dosDateTime(date = new Date()) {
    const year = Math.max(1980, date.getFullYear());
    return {
      time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
      date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
    };
  }

  async function toBytes(value) {
    if (value instanceof Uint8Array) return value;
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    if (value instanceof Blob) return new Uint8Array(await value.arrayBuffer());
    return encoder.encode(String(value));
  }

  function concat(parts) {
    const size = parts.reduce((sum, part) => sum + part.length, 0);
    const output = new Uint8Array(size);
    let offset = 0;
    for (const part of parts) {
      output.set(part, offset);
      offset += part.length;
    }
    return output;
  }

  async function createZip(entries) {
    const localParts = [];
    const centralParts = [];
    let localOffset = 0;
    const stamp = dosDateTime();

    for (const entry of entries) {
      const name = encoder.encode(entry.name.replaceAll("\\", "/"));
      const bytes = await toBytes(entry.data);
      const crc = crc32(bytes);
      const local = new Uint8Array(30 + name.length);
      const localView = new DataView(local.buffer);
      localView.setUint32(0, 0x04034b50, true);
      localView.setUint16(4, 20, true);
      localView.setUint16(6, 0x0800, true);
      localView.setUint16(8, 0, true);
      localView.setUint16(10, stamp.time, true);
      localView.setUint16(12, stamp.date, true);
      localView.setUint32(14, crc, true);
      localView.setUint32(18, bytes.length, true);
      localView.setUint32(22, bytes.length, true);
      localView.setUint16(26, name.length, true);
      local.set(name, 30);
      localParts.push(local, bytes);

      const central = new Uint8Array(46 + name.length);
      const centralView = new DataView(central.buffer);
      centralView.setUint32(0, 0x02014b50, true);
      centralView.setUint16(4, 20, true);
      centralView.setUint16(6, 20, true);
      centralView.setUint16(8, 0x0800, true);
      centralView.setUint16(10, 0, true);
      centralView.setUint16(12, stamp.time, true);
      centralView.setUint16(14, stamp.date, true);
      centralView.setUint32(16, crc, true);
      centralView.setUint32(20, bytes.length, true);
      centralView.setUint32(24, bytes.length, true);
      centralView.setUint16(28, name.length, true);
      centralView.setUint32(42, localOffset, true);
      central.set(name, 46);
      centralParts.push(central);

      localOffset += local.length + bytes.length;
    }

    const centralDirectory = concat(centralParts);
    const end = new Uint8Array(22);
    const endView = new DataView(end.buffer);
    endView.setUint32(0, 0x06054b50, true);
    endView.setUint16(8, entries.length, true);
    endView.setUint16(10, entries.length, true);
    endView.setUint32(12, centralDirectory.length, true);
    endView.setUint32(16, localOffset, true);
    return new Blob([...localParts, centralDirectory, end], { type: "application/zip" });
  }

  async function readZip(file) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const endOffset = findEndRecord(view);
    const entryCount = view.getUint16(endOffset + 10, true);
    let offset = view.getUint32(endOffset + 16, true);
    const entries = new Map();

    for (let index = 0; index < entryCount; index++) {
      if (view.getUint32(offset, true) !== 0x02014b50) throw new Error("ZIP central directory is invalid.");
      const method = view.getUint16(offset + 10, true);
      const expectedCrc = view.getUint32(offset + 16, true);
      const compressedSize = view.getUint32(offset + 20, true);
      const uncompressedSize = view.getUint32(offset + 24, true);
      const nameLength = view.getUint16(offset + 28, true);
      const extraLength = view.getUint16(offset + 30, true);
      const commentLength = view.getUint16(offset + 32, true);
      const localHeaderOffset = view.getUint32(offset + 42, true);
      const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength));

      if (method !== 0) throw new Error(`Unsupported compressed ZIP entry: ${name}`);
      if (view.getUint32(localHeaderOffset, true) !== 0x04034b50) throw new Error(`Invalid ZIP entry: ${name}`);
      const localNameLength = view.getUint16(localHeaderOffset + 26, true);
      const localExtraLength = view.getUint16(localHeaderOffset + 28, true);
      const dataOffset = localHeaderOffset + 30 + localNameLength + localExtraLength;
      const data = bytes.slice(dataOffset, dataOffset + compressedSize);
      if (data.length !== uncompressedSize || crc32(data) !== expectedCrc) throw new Error(`ZIP entry checksum failed: ${name}`);
      entries.set(name, data);
      offset += 46 + nameLength + extraLength + commentLength;
    }
    return entries;
  }

  function findEndRecord(view) {
    const lowerBound = Math.max(0, view.byteLength - 65557);
    for (let offset = view.byteLength - 22; offset >= lowerBound; offset--) {
      if (view.getUint32(offset, true) === 0x06054b50) return offset;
    }
    throw new Error("ZIP end record was not found.");
  }

  function text(bytes) {
    return decoder.decode(bytes);
  }

  function mimeFromName(name) {
    const extension = name.split(".").pop()?.toLowerCase();
    return {
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      webp: "image/webp",
      gif: "image/gif",
      bmp: "image/bmp",
      json: "application/json",
    }[extension] ?? "application/octet-stream";
  }

  window.CVL_PROJECT_PACKAGE = { createZip, readZip, text, mimeFromName };
})();
