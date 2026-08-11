import { NextFunction, Request, Response } from 'express'

import { HttpError } from './errors'

// auth.ts constructs a PrismaClient at import time, which needs no database here.
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({})),
}))

type Middleware = (req: Request, res: Response, next: NextFunction) => void

/**
 * Re-imports the middleware with a specific API_KEYS value, because config.ts
 * reads the environment once at import time.
 */
function loadMiddleware(apiKeys: string): Middleware {
  let middleware: Middleware = () => undefined

  jest.isolateModules(() => {
    process.env.API_KEYS = apiKeys
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    middleware = require('./auth').apiKeyMiddleware
  })

  return middleware
}

function requestWithHeader(value?: string | string[]): Request {
  const headers = value === undefined ? {} : { 'x-api-key': value }
  return { headers } as unknown as Request
}

const res = {} as Response

/**
 * Asserts the middleware rejects with a 401. The isolated module registry gives
 * the middleware its own copy of the error classes, so assert the status, not
 * the constructor identity. Both rejection paths must look identical to a
 * caller, so a probe cannot tell a missing header from a wrong key.
 */
function expectUnauthorized(call: () => void) {
  expect(call).toThrow('Unauthorized')

  try {
    call()
  } catch (error) {
    expect((error as HttpError).HttpStatus).toBe(401)
  }
}

describe('apiKeyMiddleware', () => {
  const originalApiKeys = process.env.API_KEYS

  afterEach(() => {
    process.env.API_KEYS = originalApiKeys
  })

  it('calls next when the key matches', () => {
    const middleware = loadMiddleware('correct-key')
    const next = jest.fn()

    middleware(requestWithHeader('correct-key'), res, next)

    expect(next).toHaveBeenCalledTimes(1)
  })

  it('accepts any key in the list so a rotation can overlap', () => {
    const middleware = loadMiddleware('old-key,new-key')
    const next = jest.fn()

    middleware(requestWithHeader('new-key'), res, next)

    expect(next).toHaveBeenCalledTimes(1)
  })

  it('trims whitespace around the configured keys', () => {
    const middleware = loadMiddleware(' old-key , new-key ')
    const next = jest.fn()

    middleware(requestWithHeader('new-key'), res, next)

    expect(next).toHaveBeenCalledTimes(1)
  })

  it('rejects a request with no header', () => {
    const middleware = loadMiddleware('correct-key')
    const next = jest.fn()

    expectUnauthorized(() => middleware(requestWithHeader(), res, next))
    expect(next).not.toHaveBeenCalled()
  })

  it('rejects an empty header value', () => {
    const middleware = loadMiddleware('correct-key')
    const next = jest.fn()

    expectUnauthorized(() => middleware(requestWithHeader(''), res, next))
    expect(next).not.toHaveBeenCalled()
  })

  it('rejects a wrong key', () => {
    const middleware = loadMiddleware('correct-key')
    const next = jest.fn()

    expectUnauthorized(() =>
      middleware(requestWithHeader('wrong-key'), res, next),
    )
    expect(next).not.toHaveBeenCalled()
  })

  it('rejects a key that only prefixes the real one', () => {
    const middleware = loadMiddleware('correct-key')
    const next = jest.fn()

    expectUnauthorized(() =>
      middleware(requestWithHeader('correct'), res, next),
    )
    expect(next).not.toHaveBeenCalled()
  })

  it('rejects a duplicated header, which arrives as an array', () => {
    const middleware = loadMiddleware('correct-key')
    const next = jest.fn()

    expectUnauthorized(() =>
      middleware(requestWithHeader(['correct-key', 'x']), res, next),
    )
    expect(next).not.toHaveBeenCalled()
  })

  it('denies every request when API_KEYS is empty', () => {
    const middleware = loadMiddleware('')
    const next = jest.fn()

    expectUnauthorized(() =>
      middleware(requestWithHeader('any-key'), res, next),
    )
    expect(next).not.toHaveBeenCalled()
  })
})
