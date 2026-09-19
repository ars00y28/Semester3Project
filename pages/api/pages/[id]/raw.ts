import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query as { id: string };

  if (req.method === 'GET') {
    const page = await prisma.page.findUnique({
      where: { id },
      select: { content: true }
    });
    
    if (!page) {
      return res.status(404).send('Not found');
    }
    
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.send(page.content || '');
  }

  res.status(405).end();
}
