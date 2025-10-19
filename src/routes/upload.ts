import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { v4 as uuidv4 } from 'uuid';

import { saveFile } from '../store/files';

const router = Router();

const filesDir = path.resolve('.data', 'files');
fs.mkdirSync(filesDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req: any, _file: any, cb: any) => {
    cb(null, filesDir);
  },
  filename: (_req: any, file: any, cb: any) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  },
});

const upload = multer({ storage });

type UploadRequestFiles = {
  cv?: Express.Multer.File[];
  project_report?: Express.Multer.File[];
};

router.post(
  '/',
  upload.fields([
    { name: 'cv', maxCount: 1 },
    { name: 'project_report', maxCount: 1 },
  ]),
  (req: any, res: any) => {
    const files = req.files as UploadRequestFiles | undefined;
    const cvFile = files?.cv?.[0];
    const projectReportFile = files?.project_report?.[0];

    if (!cvFile || !projectReportFile) {
      return res.status(400).json({ error: 'Both cv and project_report files are required.' });
    }

    const cvId = `cv_${uuidv4()}`;
    const projectReportId = `pr_${uuidv4()}`;

    saveFile({ id: cvId, name: cvFile.originalname, path: path.resolve(cvFile.path) });
    saveFile({ id: projectReportId, name: projectReportFile.originalname, path: path.resolve(projectReportFile.path) });

    return res.json({
      files: [
        {
          id: cvId,
          name: cvFile.originalname,
        },
        {
          id: projectReportId,
          name: projectReportFile.originalname,
        },
      ],
    });
  }
);

export default router;
