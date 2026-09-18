import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query as { id: string };

  if (req.method === 'GET') {
    const page = await prisma.page.findUnique({
      where: { id },
      include: {
        parent: {
          select: { id: true, title: true, type: true, parentId: true, parent: { select: { id: true, title: true } } }
        },
        children: { orderBy: { createdAt: 'asc' } },
        columns: { orderBy: { order: 'asc' } },
        rows: { orderBy: { createdAt: 'asc' }, include: { cells: true } },
      },
    });
    if (!page) return res.status(404).json({ error: 'Not found' });
    return res.json(page);
  }

  if (req.method === 'PATCH') {
    const { title, content } = req.body;
    const data: any = {};
    if (title !== undefined) data.title = title;
    if (content !== undefined) data.content = content;
    const page = await prisma.page.update({ where: { id }, data });
    return res.json(page);
  }

  if (req.method === 'DELETE') {
    await prisma.page.delete({ where: { id } });
    return res.json({ ok: true });
  }

  res.status(405).end();
}
