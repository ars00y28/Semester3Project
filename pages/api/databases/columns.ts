import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const { pageId, name, type, options } = req.body;
    const count = await prisma.column.count({ where: { pageId } });
    const column = await prisma.column.create({
      data: {
        pageId,
        name: name || 'Column',
        type: type || 'TEXT',
        order: count,
        options: options ? (typeof options === 'string' ? options : JSON.stringify(options)) : null,
      },
    });
    return res.json(column);
  }

  if (req.method === 'PATCH') {
    const { id, name, type, options } = req.body;
    const data: any = {};
    if (name !== undefined) data.name = name;
    if (type !== undefined) data.type = type;
    if (options !== undefined) data.options = options ? (typeof options === 'string' ? options : JSON.stringify(options)) : null;
    const column = await prisma.column.update({
      where: { id },
      data,
    });
    return res.json(column);
  }

  if (req.method === 'DELETE') {
    const { id } = req.body;
    await prisma.column.delete({ where: { id } });
    return res.json({ ok: true });
  }

  res.status(405).end();
}
