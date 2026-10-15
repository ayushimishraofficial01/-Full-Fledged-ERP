const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');

const PRODUCT_DIR = path.join(env.uploadDir, 'products');
const SALES_VISIT_DIR = path.resolve(env.uploadDir, '..', 'sales-visit-evidence');
const ATTENDANCE_PHOTO_DIR = path.resolve(env.uploadDir, '..', 'attendance-photos');
const HR_DOCUMENT_DIR = path.resolve(env.uploadDir, '..', 'hr-private-documents');
const SALES_EXPENSE_DIR = path.join(env.uploadDir, 'sales-expense-receipts');
fs.mkdirSync(PRODUCT_DIR, { recursive: true });
fs.mkdirSync(SALES_VISIT_DIR, { recursive: true });
fs.mkdirSync(ATTENDANCE_PHOTO_DIR, { recursive: true });
fs.mkdirSync(HR_DOCUMENT_DIR, { recursive: true });
fs.mkdirSync(SALES_EXPENSE_DIR, { recursive: true });

const IMAGE_TYPES = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
};

const imageUpload = multer({
  storage: multer.diskStorage({
    destination: PRODUCT_DIR,
    // Never trust the client filename: generate a random one with a whitelisted extension.
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() === '.png' ? '.png'
        : path.extname(file.originalname).toLowerCase() === '.webp' ? '.webp' : '.jpg';
      cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`);
    },
  }),
  limits: { fileSize: env.maxImageSizeMb * 1024 * 1024, files: 1, fields: 30 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExt = IMAGE_TYPES[file.mimetype];
    if (!allowedExt || !allowedExt.includes(ext)) {
      return cb(ApiError.badRequest('Only JPG, JPEG, PNG and WEBP images are allowed.'));
    }
    cb(null, true);
  },
});

const salesVisitUpload = multer({
  storage: multer.diskStorage({
    destination: SALES_VISIT_DIR,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() === '.png' ? '.png'
        : path.extname(file.originalname).toLowerCase() === '.webp' ? '.webp' : '.jpg';
      cb(null, `${Date.now()}-${crypto.randomBytes(12).toString('hex')}${ext}`);
    },
  }),
  limits: { fileSize: env.maxImageSizeMb * 1024 * 1024, files: 1, fields: 10 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExt = IMAGE_TYPES[file.mimetype];
    if (!allowedExt || !allowedExt.includes(ext)) return cb(ApiError.badRequest('Only JPG, JPEG, PNG and WEBP images are allowed.'));
    cb(null, true);
  },
});

const attendancePhotoUpload = multer({
  storage: multer.diskStorage({
    destination: ATTENDANCE_PHOTO_DIR,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() === '.png' ? '.png'
        : path.extname(file.originalname).toLowerCase() === '.webp' ? '.webp' : '.jpg';
      cb(null, `${Date.now()}-${crypto.randomBytes(12).toString('hex')}${ext}`);
    },
  }),
  limits: { fileSize: env.maxImageSizeMb * 1024 * 1024, files: 1, fields: 10 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExt = IMAGE_TYPES[file.mimetype];
    if (!allowedExt || !allowedExt.includes(ext)) return cb(ApiError.badRequest('Only JPG, JPEG, PNG and WEBP images are allowed.'));
    cb(null, true);
  },
});

const DOCUMENT_TYPES = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
};
const privateDocumentUpload = multer({
  storage: multer.diskStorage({
    destination: HR_DOCUMENT_DIR,
    filename: (req, file, cb) => cb(null, `${crypto.randomBytes(24).toString('hex')}${DOCUMENT_TYPES[file.mimetype] || ''}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 5 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const validExtension = (file.mimetype === 'application/pdf' && ext === '.pdf') ||
      (file.mimetype === 'image/jpeg' && ['.jpg', '.jpeg'].includes(ext)) ||
      (file.mimetype === 'image/png' && ext === '.png');
    if (!validExtension) return cb(ApiError.badRequest('Only PDF, JPG and PNG documents are allowed.'));
    cb(null, true);
  },
});

const expenseReceiptUpload = multer({
  storage: multer.diskStorage({
    destination: SALES_EXPENSE_DIR,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const safeExt = ['.jpg', '.jpeg', '.png', '.pdf', '.webp'].includes(ext) ? ext : '.jpg';
      cb(null, `${Date.now()}-${crypto.randomBytes(12).toString('hex')}${safeExt}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 10 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedMime = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    const validExtension = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'].includes(ext);
    if (!allowedMime.includes(file.mimetype) || !validExtension) {
      return cb(ApiError.badRequest('Receipt can be a PDF, JPG, JPEG, PNG, or WEBP file.'));
    }
    cb(null, true);
  },
});
const privateProfilePhotoUpload = multer({
  storage: multer.diskStorage({
    destination: HR_DOCUMENT_DIR,
    filename: (req, file, cb) => cb(null, `${crypto.randomBytes(24).toString('hex')}${IMAGE_TYPES[file.mimetype]?.[0] || ''}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 5 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!IMAGE_TYPES[file.mimetype]?.includes(ext)) return cb(ApiError.badRequest('Profile photos must be JPG, JPEG, PNG or WEBP images.'));
    cb(null, true);
  },
});

function hasDocumentSignature(filePath, mimeType) {
  const fd = fs.openSync(filePath, 'r');
  const buf = Buffer.alloc(8);
  try {
    const bytesRead = fs.readSync(fd, buf, 0, buf.length, 0);
    if (mimeType === 'application/pdf') return buf.slice(0, bytesRead).toString('ascii').startsWith('%PDF-');
    if (mimeType === 'image/jpeg') return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
    if (mimeType === 'image/png') return buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    if (mimeType === 'image/webp') return buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP';
    return false;
  } finally {
    fs.closeSync(fd);
  }
}

function hrDocument(req, res, next) {
  privateDocumentUpload.single('document')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') return next(ApiError.badRequest('Documents must be smaller than 10 MB.'));
      return next(err);
    }
    if (!req.file) return next(ApiError.badRequest('Please choose a document to upload.'));
    if (!hasDocumentSignature(req.file.path, req.file.mimetype)) {
      fs.unlink(req.file.path, () => {});
      return next(ApiError.badRequest('The uploaded file content does not match its file type.'));
    }
    next();
  });
}

function hrProfilePhoto(req, res, next) {
  privateProfilePhotoUpload.single('photo')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') return next(ApiError.badRequest('Profile photos must be smaller than 5 MB.'));
      return next(err);
    }
    if (!req.file) return next(ApiError.badRequest('Please choose a profile photo.'));
    if (!hasImageSignature(req.file.path)) {
      fs.unlink(req.file.path, () => {});
      return next(ApiError.badRequest('The uploaded file is not a valid image.'));
    }
    next();
  });
}

function privateDocumentPath(storageName) {
  if (!storageName || path.basename(storageName) !== storageName) return null;
  return path.join(HR_DOCUMENT_DIR, storageName);
}

/** Checks the real file signature so a renamed non-image cannot be stored. */
function hasImageSignature(filePath) {
  const fd = fs.openSync(filePath, 'r');
  const buf = Buffer.alloc(12);
  fs.readSync(fd, buf, 0, 12, 0);
  fs.closeSync(fd);
  const isJpeg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  const isPng = buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isWebp = buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP';
  return isJpeg || isPng || isWebp;
}

/** Wraps multer so its errors reach the JSON error handler, then verifies the image bytes. */
function productImage(req, res, next) {
  imageUpload.single('image')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') return next(ApiError.badRequest(`Image must be smaller than ${env.maxImageSizeMb} MB.`));
      return next(err);
    }
    if (req.file && !hasImageSignature(req.file.path)) {
      fs.unlink(req.file.path, () => {});
      return next(ApiError.badRequest('The uploaded file is not a valid image.'));
    }
    next();
  });
}

function salesVisitImage(req, res, next) {
  salesVisitUpload.single('image')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') return next(ApiError.badRequest(`Image must be smaller than ${env.maxImageSizeMb} MB.`));
      return next(err);
    }
    if (!req.file) return next(ApiError.badRequest('A visit photo is required.'));
    if (!hasImageSignature(req.file.path)) {
      fs.unlink(req.file.path, () => {});
      return next(ApiError.badRequest('The uploaded file is not a valid image.'));
    }
    next();
  });
}

function attendanceImage(req, res, next) {
  attendancePhotoUpload.single('image')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') return next(ApiError.badRequest(`Image must be smaller than ${env.maxImageSizeMb} MB.`));
      return next(err);
    }
    if (req.file && !hasImageSignature(req.file.path)) {
      fs.unlink(req.file.path, () => {});
      return next(ApiError.badRequest('The uploaded file is not a valid image.'));
    }
    next();
  });
}

function salesExpenseReceipt(req, res, next) {
  expenseReceiptUpload.single('receipt')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') return next(ApiError.badRequest('Receipt must be smaller than 5 MB.'));
      return next(err);
    }
    if (req.file) {
      const isImage = hasImageSignature(req.file.path);
      const isPdf = req.file.mimetype === 'application/pdf' && req.file.path.toLowerCase().endsWith('.pdf');
      if (!isImage && !isPdf) {
        fs.unlink(req.file.path, () => {});
        return next(ApiError.badRequest('The uploaded receipt is not a valid PDF or image file.'));
      }
    }
    next();
  });
}

const EXCEL_EXT = ['.xlsx', '.xls', '.csv'];

const excelUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxImportSizeMb * 1024 * 1024, files: 1, fields: 10 },
  fileFilter: (req, file, cb) => {
    if (!EXCEL_EXT.includes(path.extname(file.originalname).toLowerCase())) {
      return cb(ApiError.badRequest('Please upload an Excel file (.xlsx, .xls) or CSV.'));
    }
    cb(null, true);
  },
});

function excelFile(req, res, next) {
  excelUpload.single('file')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') return next(ApiError.badRequest(`File must be smaller than ${env.maxImportSizeMb} MB.`));
      return next(err);
    }
    if (!req.file) return next(ApiError.badRequest('Please choose a file to upload.'));
    next();
  });
}

function removeUploadedFile(relativePath) {
  if (!relativePath) return;
  const abs = path.resolve(env.uploadDir, relativePath.replace(/^\/?uploads\//, ''));
  if (!abs.startsWith(env.uploadDir)) return; // path traversal guard
  fs.unlink(abs, () => {});
}

function removeSalesVisitEvidence(filename) {
  if (!filename || path.basename(filename) !== filename) return;
  fs.unlink(path.join(SALES_VISIT_DIR, filename), () => {});
}

function salesVisitEvidencePath(filename) {
  if (!filename || path.basename(filename) !== filename) return null;
  return path.join(SALES_VISIT_DIR, filename);
}

module.exports = { productImage, salesVisitImage, attendanceImage, salesExpenseReceipt, salesVisitEvidencePath, removeSalesVisitEvidence, excelFile, hrDocument, hrProfilePhoto, privateDocumentPath, removeUploadedFile };
