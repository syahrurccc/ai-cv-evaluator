import express from 'express';
import dotenv from 'dotenv';
import multer from 'multer';

import uploadRouter from './routes/upload';
import evaluateRouter from './routes/evaluate';
import resultRouter from './routes/result';

dotenv.config();

const app = express();
const multipart = multer();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(multipart.any());

app.use('/upload', uploadRouter);
app.use('/evaluate', evaluateRouter);
app.use('/result', resultRouter);

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

export default app;
