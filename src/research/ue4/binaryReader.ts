export class BinaryReadError extends Error {
  readonly offset: number
  readonly requestedBytes: number
  readonly availableBytes: number

  constructor(
    message: string,
    offset: number,
    requestedBytes: number,
    availableBytes: number,
  ) {
    super(`${message} at byte ${offset} (requested ${requestedBytes}, available ${availableBytes})`)
    this.name = 'BinaryReadError'
    this.offset = offset
    this.requestedBytes = requestedBytes
    this.availableBytes = availableBytes
  }
}

export class BinaryReader {
  private readonly view: DataView
  private position: number
  private readonly baseOffset: number
  readonly bytes: Uint8Array
  readonly label: string

  constructor(
    bytes: Uint8Array,
    offset = 0,
    label = 'binary input',
    baseOffset = 0,
  ) {
    this.bytes = bytes
    this.label = label
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    this.position = offset
    this.baseOffset = baseOffset
    this.assertRange(offset, 0)
  }

  tell(): number {
    return this.position
  }

  absoluteTell(): number {
    return this.baseOffset + this.position
  }

  remaining(): number {
    return this.bytes.byteLength - this.position
  }

  seek(offset: number): void {
    this.assertRange(offset, 0)
    this.position = offset
  }

  skip(length: number): void {
    this.seek(this.position + length)
  }

  readInt8(): number {
    this.assertReadable(1)
    return this.view.getInt8(this.position++)
  }

  readUInt8(): number {
    this.assertReadable(1)
    return this.view.getUint8(this.position++)
  }

  readInt16LE(): number {
    this.assertReadable(2)
    const value = this.view.getInt16(this.position, true)
    this.position += 2
    return value
  }

  readUInt16LE(): number {
    this.assertReadable(2)
    const value = this.view.getUint16(this.position, true)
    this.position += 2
    return value
  }

  readInt32LE(): number {
    this.assertReadable(4)
    const value = this.view.getInt32(this.position, true)
    this.position += 4
    return value
  }

  readUInt32LE(): number {
    this.assertReadable(4)
    const value = this.view.getUint32(this.position, true)
    this.position += 4
    return value
  }

  readInt64LE(): number {
    this.assertReadable(8)
    const value = this.view.getBigInt64(this.position, true)
    this.position += 8
    const numeric = Number(value)
    if (!Number.isSafeInteger(numeric)) throw new BinaryReadError('64-bit value exceeds JavaScript safe integer range', this.position - 8, 8, 8)
    return numeric
  }

  readFloat32LE(): number {
    this.assertReadable(4)
    const value = this.view.getFloat32(this.position, true)
    this.position += 4
    return value
  }

  readBytes(length: number): Uint8Array {
    this.assertReadable(length)
    const result = this.bytes.subarray(this.position, this.position + length)
    this.position += length
    return result
  }

  readFString(): string {
    const start = this.position
    const length = this.readInt32LE()
    if (length === 0) return ''
    if (length === -0x80000000) throw new BinaryReadError('Invalid FString length', start, 4, this.remaining() + 4)
    const unitSize = length < 0 ? 2 : 1
    const units = Math.abs(length)
    const byteLength = units * unitSize
    if (!Number.isSafeInteger(byteLength)) throw new BinaryReadError('Invalid FString byte length', start, byteLength, this.remaining())
    const raw = this.readBytes(byteLength)
    const terminatorSize = unitSize
    if (raw.byteLength < terminatorSize || raw.slice(-terminatorSize).some((byte) => byte !== 0)) {
      throw new BinaryReadError('FString is missing its terminal NUL', start, byteLength, raw.byteLength)
    }
    return new TextDecoder(length < 0 ? 'utf-16le' : 'utf-8', { fatal: true }).decode(raw.subarray(0, raw.byteLength - terminatorSize))
  }

  subReader(length: number, label = this.label): BinaryReader {
    const baseOffset = this.absoluteTell()
    return new BinaryReader(this.readBytes(length), 0, label, baseOffset)
  }

  private assertReadable(length: number): void {
    this.assertRange(this.position, length)
  }

  private assertRange(offset: number, length: number): void {
    if (!Number.isInteger(offset) || !Number.isInteger(length) || offset < 0 || length < 0 || offset + length > this.bytes.byteLength) {
      throw new BinaryReadError(`Out-of-range read in ${this.label}`, offset, length, Math.max(0, this.bytes.byteLength - offset))
    }
  }
}
