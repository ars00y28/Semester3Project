import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'PUT') {
    const { rowId, columnId, value } = req.body;
    const cell = await prisma.cell.upsert({
      where: { rowId_columnId: { rowId, columnId } },
      update: { value },
      create: { rowId, columnId, value },
    });
    return res.json(cell);
  }
  res.status(405).end();
}
