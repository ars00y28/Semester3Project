import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';

async function deletePageAndDescendants(pageId: string) {
  // Find all children recursively
  const children = await prisma.page.findMany({
    where: { parentId: pageId },
    select: { id: true },
  });
  for (const child of children) {
    await deletePageAndDescendants(child.id);
  }

  // Delete all cells, columns, rows for this page
  const rows = await prisma.row.findMany({ where: { pageId }, select: { id: true } });
  const rowIds = rows.map(r => r.id);
  if (rowIds.length > 0) {
    await prisma.cell.deleteMany({ where: { rowId: { in: rowIds } } });
  }
  await prisma.column.deleteMany({ where: { pageId } });
  await prisma.row.deleteMany({ where: { pageId } });
  await prisma.page.delete({ where: { id: pageId } });
}

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
    try {
      await deletePageAndDescendants(id);
      if ((global as any).io) {
        (global as any).io.emit('sidebar:refresh');
      }
      return res.json({ ok: true });
    } catch (err: any) {
      console.error('Failed to delete page:', err);
      return res.status(500).json({ error: err.message || 'Failed to delete' });
    }
  }

  res.status(405).end();
}
