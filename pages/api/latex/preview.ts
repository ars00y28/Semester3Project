import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).end();
  }

  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).send('Missing page id');
  }

  const host = req.headers.host || '';
  
  // If running locally, latexonline.cc won't be able to fetch our local raw endpoint.
  // We'll have to use ?text= compilation which is limited by URL size.
  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    const page = await prisma.page.findUnique({
      where: { id },
      select: { content: true }
    });
    
    if (!page) {
      return res.status(404).send('Not found');
    }

    const text = page.content || '';
    if (text.length > 5000) {
      // Too large for GET text compile
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(`
        <div style="font-family: sans-serif; padding: 20px; text-align: center; color: #555;">
          <h2>Document Too Large for Local Preview</h2>
          <p>Please deploy to Render to preview LaTeX documents larger than 5,000 characters.</p>
        </div>
      `);
    }

    return res.redirect(`https://latexonline.cc/compile?text=${encodeURIComponent(text)}`);
  }

  // If running in production (Render), we can give latexonline.cc the public URL to our raw endpoint!
  // This supports documents of any size.
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const publicRawUrl = `${protocol}://${host}/api/pages/${id}/raw`;
  
  return res.redirect(`https://latexonline.cc/compile?url=${encodeURIComponent(publicRawUrl)}`);
}
