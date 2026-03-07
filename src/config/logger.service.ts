import { getConfig } from './config.service';

export function getLoggerConfig() {
  const nodeEnv = getConfig('NODE_ENV') || 'development';
  const logLevel = getConfig('LOG_LEVEL') || 'info';

  if (nodeEnv === 'development') {
    return {
      level: logLevel,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname,reqId,responseTime,req,res',
          messageFormat: '{levelLabel} - {msg}',
          levelFirst: false,
          messageKey: 'msg',
          singleLine: true
        }
      }
    };
  }

  // Production logging - structured JSON
  return {
    level: logLevel,
    serializers: {
      req: (req: any) => ({
        method: req.method,
        url: req.url,
        headers: {
          host: req.headers.host,
          'user-agent': req.headers['user-agent'],
          'content-type': req.headers['content-type']
        }
      }),
      res: (res: any) => ({
        statusCode: res.statusCode,
        headers: {
          'content-type': res.headers['content-type']
        }
      })
    }
  };
} 