export class OptimizerInputError extends Error {
  readonly code: string

  readonly instanceIds?: readonly string[]

  constructor(code: string, message: string, instanceIds?: readonly string[]) {
    super(message)
    this.name = 'OptimizerInputError'
    this.code = code
    this.instanceIds = instanceIds
  }
}
