import type { VercelRequest, VercelResponse } from '@vercel/node';

/** Помилка з HTTP-статусом і машинним кодом (напр. `EMAIL_TAKEN`) — вирушає в JSON-відповідь як є. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}

export function requireMethod(req: VercelRequest, res: VercelResponse, method: string): boolean {
  if (req.method !== method) {
    res.setHeader('Allow', method);
    res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
    return false;
  }
  return true;
}

type Handler = (req: VercelRequest, res: VercelResponse) => Promise<void>;

/** Обгортка для ловлі помилок: HttpError -> її статус/код, будь-що інше -> 500 без деталей назовні. */
export function withErrorHandling(handler: Handler): Handler {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      if (error instanceof HttpError) {
        res.status(error.status).json({ error: error.code });
        return;
      }
      console.error(error);
      res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
  };
}
