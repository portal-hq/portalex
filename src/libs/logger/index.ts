import { createLogger, format, transports } from 'winston'

import { WinstonConfig, ServerConfig, env } from '../../config'

const { combine, timestamp, label, printf, colorize, errors, metadata } = format

/*
 * DataDog options config.
 */
export const transporterOption = {
  host: 'http-intake.logs.datadoghq.com',
  path: `/api/v2/logs?dd-api-key=${WinstonConfig.datadogKey}&ddsource=nodejs&service=${ServerConfig.serviceName}&host=${ServerConfig.host}`,
  ssl: true,
}

/*
 * Local formatting used for printing to console.
 */
export const localFormat = printf(({ level, message, label, timestamp }) => {
  return `${timestamp} [${label}] ${level}: ${message}`
})

/*
 * Standard logger powered by Winston. Prints nice messages to console when
 * env == 'dev', otherwise sends it to Datadog.
 * Attaches standard metadata (env, service, host)
 */
export const logger = createLogger({
  level: WinstonConfig.level,
  exitOnError: false,
  format:
    env === 'dev'
      ? combine(
          errors({ stack: true }),
          label({ label: ServerConfig.serviceName }),
          timestamp(),
          localFormat,
          colorize({ all: true }),
          metadata(),
        )
      : format.json(),
  transports: [
    env === 'dev'
      ? new transports.Console()
      : new transports.Http(transporterOption),
  ],
  silent: WinstonConfig.silent,
  defaultMeta: {
    env,
    service: ServerConfig.serviceName,
    host: ServerConfig.host,
  },
})
