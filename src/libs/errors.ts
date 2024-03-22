import HttpStatusCodes from 'http-status-codes'

export class EntityNotFoundError extends Error {
  constructor(entity: string, id: string) {
    super(`Count not find ${entity} with identifier ${id}`)
  }
}

export abstract class HttpError extends Error {
  public readonly HttpStatus = HttpStatusCodes.BAD_REQUEST

  constructor(msg: string, httpStatus: number) {
    super(msg)
    this.HttpStatus = httpStatus
  }
}

export class MissingParameterError extends HttpError {
  public static readonly Msg = 'Missing parameter: '
  public static readonly HttpStatus = HttpStatusCodes.BAD_REQUEST

  constructor(param: string) {
    super(MissingParameterError.Msg + param, MissingParameterError.HttpStatus)
  }
}

export class UnauthorizedError extends HttpError {
  public static readonly Msg = 'Unauthorized'
  public static readonly HttpStatus = HttpStatusCodes.UNAUTHORIZED

  constructor() {
    super(UnauthorizedError.Msg, UnauthorizedError.HttpStatus)
  }
}

export class WrongTokenFormatError extends HttpError {
  public static readonly Msg = 'Incorrect token format'
  public static readonly HttpStatus = HttpStatusCodes.UNAUTHORIZED

  constructor() {
    super(WrongTokenFormatError.Msg, WrongTokenFormatError.HttpStatus)
  }
}
