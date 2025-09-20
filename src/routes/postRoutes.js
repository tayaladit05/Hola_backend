const express = require('express');
const router = express.Router();
const authMiddleware = require('../Controllers/authMiddleware');
const postController = require('../Controllers/postController');

// POST /api/posts - Create new post (with file upload support)
router.post('/', authMiddleware, postController.uploadMiddleware, postController.createPost);

// GET /api/posts/feed - Get user feed
router.get('/feed', authMiddleware, postController.getFeed);

// GET /api/posts/:id - Get single post
router.get('/:id', authMiddleware, postController.getPost);

// POST /api/posts/:id/like - Like/Unlike post
router.post('/:id/like', authMiddleware, postController.likePost);

// DELETE /api/posts/:id - Delete post
router.delete('/:id', authMiddleware, postController.deletePost);

module.exports = router;