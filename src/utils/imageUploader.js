const multer = require('multer');

// 10MB file size limit
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const imageFileFilter = (req, file, cb) => {
  if (file.mimetype && file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

const imageUploader = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: imageFileFilter,
});

module.exports = imageUploader;
