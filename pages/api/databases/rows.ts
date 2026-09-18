import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const { pageId } = req.body;
    const row = await prisma.row.create({ data: { pageId }, include: { cells: true } });
    return res.json(row);
  }

  if (req.method === 'DELETE') {
    const { id } = req.body;
    await prisma.row.delete({ where: { id } });
    return res.json({ ok: true });
  }

  res.status(405).end();
}
