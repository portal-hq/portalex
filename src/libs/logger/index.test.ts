import morgan from 'morgan'
import { transports, format } from 'winston'

import {
  logger,
  LoggerStream,
  MorganRequestMiddleware,
  MorganResponseMiddleware,
} from '.'

jest.mock('morgan')

describe('Logging Module', () => {
  afterEach(() => {
    jest.resetAllMocks()
  })

  beforeEach(() => {
    jest.mock('winston', () => ({
      format: {
        colorize: jest.fn(),
        combine: jest.fn(),
        errors: jest.fn(),
        json: jest.fn(),
        label: jest.fn(),
        metadata: jest.fn(),
        printf: jest.fn(),
        timestamp: jest.fn(),
      },
      transports: {
        Console: jest.fn(),
        Http: jest.fn(),
      },
      createLogger: jest.fn(() => ({
        format: {
          colorize: jest.fn(),
          combine: jest.fn(),
          errors: jest.fn(),
          json: jest.fn(),
          label: jest.fn(),
          metadata: jest.fn(),
          printf: jest.fn(),
          timestamp: jest.fn(),
        },
        transports: {
          Console: jest.fn(),
          Http: jest.fn(),
        },
      })),
    }))
  })

  describe('logger', () => {
    it('uses the correct logger format for development', () => {
      jest.mock('@config', () => ({
        env: 'dev',
      }))

      expect(logger).toHaveProperty('format')
    })

    it('uses the correct logger format for production', () => {
      process.env.NODE_ENV = 'production'

      expect(logger.format).toEqual(format.json())
    })

    it('uses the correct transport option for production', () => {
      process.env.NODE_ENV = 'production'

      expect(logger.transports[0]).toBeInstanceOf(transports.Http)
    })
  })

  describe('LoggerStream', () => {
    it('logs messages correctly', () => {
      const mockLogger = {
        info: jest.fn(),
      }
      const stream = new LoggerStream(mockLogger as any)

      stream.write('Test message')

      expect(mockLogger.info).toHaveBeenCalledWith('Test message')
    })
  })

  describe('Morgan Middleware', () => {
    const mockRequest = {
      logger: jest.fn(),
    }
    const mockResponse = {
      statusCode: 200,
    }
    const mockNext = jest.fn()

    beforeEach(() => {
      // Mock morgan to return a jest function
      ;(morgan as jest.MockedFunction<typeof morgan>).mockReturnValue(jest.fn())
      jest.mock('winston', () => ({
        format: {
          colorize: jest.fn(),
          combine: jest.fn(),
          errors: jest.fn(),
          json: jest.fn(),
          label: jest.fn(),
          metadata: jest.fn(),
          printf: jest.fn(),
          timestamp: jest.fn(),
        },
        transports: {
          Console: jest.fn(),
          Http: jest.fn(),
        },
        createLogger: jest.fn(() => ({
          format: {
            colorize: jest.fn(),
            combine: jest.fn(),
            errors: jest.fn(),
            json: jest.fn(),
            label: jest.fn(),
            metadata: jest.fn(),
            printf: jest.fn(),
            timestamp: jest.fn(),
          },
          transports: {
            Console: jest.fn(),
            Http: jest.fn(),
          },
        })),
      }))
    })

    it('uses the correct format for production (Request)', () => {
      process.env.NODE_ENV = 'production'

      MorganRequestMiddleware(mockRequest as any, mockResponse as any, mockNext)

      expect(morgan).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(Object),
      )
    })

    it('uses the correct format for production (Response)', () => {
      process.env.NODE_ENV = 'production'

      MorganResponseMiddleware(
        mockRequest as any,
        mockResponse as any,
        mockNext,
      )

      expect(morgan).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(Object),
      )
    })
  })
})
