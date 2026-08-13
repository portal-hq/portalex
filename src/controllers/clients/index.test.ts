import { PrismaClient, User } from '@prisma/client'
import { Request, Response } from 'express'
import { Logger } from 'winston'

import { HttpError } from '../../libs/errors'
import ClientsController from './index'

const userRow = (overrides: Partial<User> = {}): User => ({
  address: null,
  apiKey: null,
  apiSecret: null,
  clientApiKey: null,
  clientId: 'client-1',
  exchangeUserId: 42,
  id: 1,
  pushToken: null,
  username: 'user@example.com',
  walletId: null,
  ...overrides,
})

type MockResponse = Response & { status: jest.Mock; json: jest.Mock }

const mockResponse = (): MockResponse => {
  const res = { status: jest.fn(), json: jest.fn() }
  res.status.mockReturnValue(res)

  return res as unknown as MockResponse
}

const request = (body: unknown): Request => ({ body } as Request)

const uniqueError = (target: string[] | string) =>
  Object.assign(new Error('Unique constraint failed'), {
    code: 'P2002',
    meta: { target },
  })

const controllerWith = (user: {
  findUnique: jest.Mock
  create: jest.Mock
}) => ({
  controller: new ClientsController({
    prisma: { user } as unknown as PrismaClient,
    logger: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as unknown as Logger,
  }),
  user,
})

const prismaMock = () => ({ findUnique: jest.fn(), create: jest.fn() })

const validBody = {
  clientId: 'client-1',
  username: 'user@example.com',
}

describe('registerClient', () => {
  it('creates the user and responds with 201', async () => {
    const user = prismaMock()
    user.findUnique.mockResolvedValue(null)
    user.create.mockResolvedValue(userRow())
    const { controller } = controllerWith(user)
    const res = mockResponse()

    await controller.registerClient(request(validBody), res)

    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json).toHaveBeenCalledWith({
      clientApiKey: null,
      clientId: 'client-1',
      exchangeUserId: 42,
      username: 'user@example.com',
    })
  })

  it('always stores a null clientApiKey', async () => {
    const user = prismaMock()
    user.findUnique.mockResolvedValue(null)
    user.create.mockResolvedValue(userRow())
    const { controller } = controllerWith(user)

    await controller.registerClient(
      request({ ...validBody, clientApiKey: 'supplied-key' }),
      mockResponse(),
    )

    expect(user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ clientApiKey: null }),
    })
  })

  it('trims the clientId and username before storing them', async () => {
    const user = prismaMock()
    user.findUnique.mockResolvedValue(null)
    user.create.mockResolvedValue(userRow())
    const { controller } = controllerWith(user)

    await controller.registerClient(
      request({ clientId: '  client-1 ', username: ' user@example.com  ' }),
      mockResponse(),
    )

    expect(user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        clientId: 'client-1',
        username: 'user@example.com',
      }),
    })
  })

  it('responds with 200 and writes nothing when the client is registered', async () => {
    const existing = userRow({ exchangeUserId: 7 })
    const user = prismaMock()
    user.findUnique.mockResolvedValue(existing)
    const { controller } = controllerWith(user)
    const res = mockResponse()

    await controller.registerClient(request(validBody), res)

    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ exchangeUserId: 7 }),
    )
    expect(user.create).not.toHaveBeenCalled()
  })

  it('responds with 409 when the client is registered to another username', async () => {
    const user = prismaMock()
    user.findUnique.mockResolvedValue(userRow({ username: 'someone@else.com' }))
    const { controller } = controllerWith(user)
    const res = mockResponse()

    await controller.registerClient(request(validBody), res)

    expect(res.status).toHaveBeenCalledWith(409)
    expect(res.json).toHaveBeenCalledWith({
      message: 'Client client-1 is already registered to a different username',
    })
    expect(user.create).not.toHaveBeenCalled()
  })

  it('does not disclose the stored record on a username mismatch', async () => {
    const user = prismaMock()
    user.findUnique.mockResolvedValue(
      userRow({ username: 'someone@else.com', exchangeUserId: 12345 }),
    )
    const { controller } = controllerWith(user)
    const res = mockResponse()

    await controller.registerClient(request(validBody), res)

    const body = JSON.stringify(res.json.mock.calls[0][0])
    expect(body).not.toContain('someone@else.com')
    expect(body).not.toContain('12345')
  })

  it('accepts isAccountAbstracted without persisting it', async () => {
    const user = prismaMock()
    user.findUnique.mockResolvedValue(null)
    user.create.mockResolvedValue(userRow())
    const { controller } = controllerWith(user)
    const res = mockResponse()

    await controller.registerClient(
      request({ ...validBody, isAccountAbstracted: true }),
      res,
    )

    expect(res.status).toHaveBeenCalledWith(201)
    expect(user.create.mock.calls[0][0].data).not.toHaveProperty(
      'isAccountAbstracted',
    )
  })

  it('responds with 409 when the username belongs to another client', async () => {
    const user = prismaMock()
    user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(userRow({ clientId: 'other-client' }))
    const { controller } = controllerWith(user)
    const res = mockResponse()

    await controller.registerClient(request(validBody), res)

    expect(res.status).toHaveBeenCalledWith(409)
    expect(res.json).toHaveBeenCalledWith({
      message:
        'Username user@example.com is already registered to a different client',
    })
    expect(user.create).not.toHaveBeenCalled()
  })

  it.each([
    ['a missing clientId', { username: 'user@example.com' }, 'clientId'],
    ['a missing username', { clientId: 'client-1' }, 'username'],
    ['a blank username', { clientId: 'client-1', username: '   ' }, 'username'],
    [
      'a non-string clientId',
      { clientId: {}, username: 'user@example.com' },
      'clientId',
    ],
  ])('rejects %s with a 400', async (_name, body, param) => {
    const user = prismaMock()
    const { controller } = controllerWith(user)

    const call = controller.registerClient(request(body), mockResponse())

    await expect(call).rejects.toThrow(`Missing parameter: ${param}`)
    await call.catch((error) => {
      expect((error as HttpError).HttpStatus).toBe(400)
    })
    expect(user.create).not.toHaveBeenCalled()
  })

  it('retries with a fresh exchangeUserId after a collision', async () => {
    const user = prismaMock()
    user.findUnique.mockResolvedValue(null)
    user.create
      .mockRejectedValueOnce(uniqueError(['exchangeUserId']))
      .mockResolvedValueOnce(userRow())
    const { controller } = controllerWith(user)
    const res = mockResponse()

    await controller.registerClient(request(validBody), res)

    expect(user.create).toHaveBeenCalledTimes(2)
    expect(user.create.mock.calls[0][0].data.exchangeUserId).not.toBe(
      user.create.mock.calls[1][0].data.exchangeUserId,
    )
    expect(res.status).toHaveBeenCalledWith(201)
  })

  it('gives up after five exchangeUserId collisions', async () => {
    const user = prismaMock()
    user.findUnique.mockResolvedValue(null)
    user.create.mockRejectedValue(uniqueError(['exchangeUserId']))
    const { controller } = controllerWith(user)

    await expect(
      controller.registerClient(request(validBody), mockResponse()),
    ).rejects.toThrow('Could not generate a unique exchangeUserId')
    expect(user.create).toHaveBeenCalledTimes(5)
  })

  it('responds with 200 when a concurrent request registered the client', async () => {
    const user = prismaMock()
    user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(userRow({ exchangeUserId: 99 }))
    user.create.mockRejectedValue(uniqueError(['clientId']))
    const { controller } = controllerWith(user)
    const res = mockResponse()

    await controller.registerClient(request(validBody), res)

    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ exchangeUserId: 99 }),
    )
  })

  it('responds with 409 when a concurrent registration used another username', async () => {
    const user = prismaMock()
    user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(userRow({ username: 'someone@else.com' }))
    user.create.mockRejectedValue(uniqueError(['clientId']))
    const { controller } = controllerWith(user)
    const res = mockResponse()

    await controller.registerClient(request(validBody), res)

    expect(res.status).toHaveBeenCalledWith(409)
    expect(res.json).toHaveBeenCalledWith({
      message: 'Client client-1 is already registered to a different username',
    })
  })

  it('responds with 409 for any other unique constraint violation', async () => {
    const user = prismaMock()
    user.findUnique.mockResolvedValue(null)
    user.create.mockRejectedValue(uniqueError(['clientApiKey']))
    const { controller } = controllerWith(user)
    const res = mockResponse()

    await controller.registerClient(request(validBody), res)

    expect(res.status).toHaveBeenCalledWith(409)
    expect(res.json).toHaveBeenCalledWith({
      message: 'Already registered: clientApiKey',
    })
  })

  it('reads meta.target when it arrives as an index name', async () => {
    const user = prismaMock()
    user.findUnique.mockResolvedValue(null)
    user.create
      .mockRejectedValueOnce(uniqueError('User_exchangeUserId_key'))
      .mockResolvedValueOnce(userRow())
    const { controller } = controllerWith(user)
    const res = mockResponse()

    await controller.registerClient(request(validBody), res)

    expect(user.create).toHaveBeenCalledTimes(2)
    expect(res.status).toHaveBeenCalledWith(201)
  })

  it('rethrows a database error that is not a unique violation', async () => {
    const user = prismaMock()
    user.findUnique.mockResolvedValue(null)
    user.create.mockRejectedValue(new Error('connection lost'))
    const { controller } = controllerWith(user)

    await expect(
      controller.registerClient(request(validBody), mockResponse()),
    ).rejects.toThrow('connection lost')
  })
})
