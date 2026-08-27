export class OptimizerInputError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'OptimizerInputError'
    this.code = code
  }
}
