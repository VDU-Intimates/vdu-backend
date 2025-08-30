import express, { Express, Request, Response } from 'express';

const app: Express = express();
const port = 5000;

app.get('/', (_req: Request, res: Response) => {
  res.send('Hello World!');
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});