import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const pages = await prisma.page.findMany({ orderBy: { createdAt: 'asc' } });
    return res.json(pages);
  }

  if (req.method === 'POST') {
    const { title, type, parentId } = req.body;
    let initialContent = null;
    
    if (type === 'LATEX') {
      initialContent = `\\documentclass{article}
\\usepackage[utf8]{inputenc}
\\usepackage{amsmath}

\\title{Untitled LaTeX Document}
\\author{Engineering Notion User}
\\date{\\today}

\\begin{document}

\\maketitle

\\section{Introduction}
Welcome to your new LaTeX document. This editor behaves like Overleaf.

\\subsection{Math Example}
Here is a famous equation:
\\begin{equation}
    E = mc^2
\\end{equation}

\\end{document}`;
    }

    const page = await prisma.page.create({
      data: { 
        title: title || 'Untitled', 
        type: type || 'DOCUMENT', 
        parentId: parentId || null,
        content: initialContent
      },
    });
    if (type === 'DATABASE') {
      const colName = await prisma.column.create({ data: { pageId: page.id, name: 'Task / Item', type: 'TEXT', order: 0 } });
      const colStatus = await prisma.column.create({ data: { pageId: page.id, name: 'Status', type: 'STATUS', order: 1 } });
      const colDate = await prisma.column.create({ data: { pageId: page.id, name: 'Date', type: 'DATE', order: 2 } });
      const colPriority = await prisma.column.create({ data: { pageId: page.id, name: 'Priority', type: 'TEXT', order: 3 } });
      
      const today = new Date().toISOString().split('T')[0];
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

      // Starter row 1
      const row1 = await prisma.row.create({ data: { pageId: page.id } });
      await prisma.cell.create({ data: { rowId: row1.id, columnId: colName.id, value: 'Design system architecture' } });
      await prisma.cell.create({ data: { rowId: row1.id, columnId: colStatus.id, value: 'In Progress' } });
      await prisma.cell.create({ data: { rowId: row1.id, columnId: colDate.id, value: today } });
      await prisma.cell.create({ data: { rowId: row1.id, columnId: colPriority.id, value: 'High' } });

      // Starter row 2
      const row2 = await prisma.row.create({ data: { pageId: page.id } });
      await prisma.cell.create({ data: { rowId: row2.id, columnId: colName.id, value: 'Implement backend API' } });
      await prisma.cell.create({ data: { rowId: row2.id, columnId: colStatus.id, value: 'Not Started' } });
      await prisma.cell.create({ data: { rowId: row2.id, columnId: colDate.id, value: tomorrow } });
      await prisma.cell.create({ data: { rowId: row2.id, columnId: colPriority.id, value: 'Medium' } });
    }
    return res.json(page);
  }

  res.status(405).end();
}
