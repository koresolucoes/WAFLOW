

import type { VercelRequest } from '@vercel/node';
import { Buffer } from 'node:buffer';

export const getRawBody = (req: VercelRequest): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', (err) => reject(err));
  });
};

export const parseMultipartFormData = (body: Buffer, boundary: string): Record<string, string> => {
  const bodyString = body.toString();
  const parts = bodyString.split(`--${boundary}`).slice(1, -1);
  const result: Record<string, string> = {};

  for (const part of parts) {
    const headerMatch = part.match(/Content-Disposition: form-data; name="([^"]+)"/);
    if (headerMatch) {
      const name = headerMatch[1];
      const content = part.split('\r\n\r\n')[1];
      if (content) {
        result[name] = content.trimEnd();
      }
    }
  }
  return result;
};