/**
 * POST /api/posts
 * Create a new post with image upload.
 *
 * To use in Postman:
 * - Set method to POST and URL to http://localhost:5000/api/posts
 * - In Body, select 'form-data'
 * - Add a key named 'image' (type: File) and select your image file
 * - Add other fields as needed: caption (String), location (String), hashtags (String or Array)
 * - The backend expects the image in the 'image' field (not as base64 or JSON)
 */
const Post = require('../Models/Post');
const User = require('../Models/User');
const Comment = require('../Models/Comment'); // Add this import
const cloudinary = require('../services/cloudinaryService');
const imageUploader = require('../utils/imageUploader');

// Create new post (supports file upload, base64, and URL)
exports.createPost = async (req, res) => {
  try {
    console.log('=== CREATE POST REQUEST ===');
    console.log('Content-Type:', req.headers['content-type']);
    console.log('Request body:', req.body);
    console.log('Request file:', req.file ? {
      fieldname: req.file.fieldname,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size
    } : null);

    const { caption, location, hashtags, imageBase64, imageUrl } = req.body;
    const userId = req.user.id;
    let uploadResult;

    // File upload (form-data with multer)
    if (req.file) {
      console.log('Processing file upload...');
      
      try {
        // Convert buffer to base64 for Cloudinary upload
        const base64 = req.file.buffer.toString('base64');
        const dataURI = `data:${req.file.mimetype};base64,${base64}`;
        
        uploadResult = await cloudinary.uploader.upload(dataURI, {
          folder: 'instagram_clone/posts',
          resource_type: 'image',
          public_id: `post_${userId}_${Date.now()}`,
          transformation: [
            { width: 1080, height: 1080, crop: 'limit' },
            { quality: 'auto:good' }
          ]
        });
        
        console.log('File upload to Cloudinary successful:', uploadResult.secure_url);
        
      } catch (cloudinaryError) {
        console.error('Cloudinary upload error:', cloudinaryError);
        return res.status(400).json({ 
          success: false,
          message: 'Failed to upload image to Cloudinary', 
          error: cloudinaryError.message 
        });
      }
      
    } else if (imageBase64) {
      // Base64 upload (JSON)
      console.log('Processing base64 upload...');
      
      if (!imageBase64.startsWith('data:image/')) {
        return res.status(400).json({ 
          success: false,
          message: 'Invalid base64 format. Must start with "data:image/"' 
        });
      }
      
      uploadResult = await cloudinary.uploader.upload(imageBase64, {
        folder: 'instagram_clone/posts',
        resource_type: 'image',
        public_id: `post_${userId}_${Date.now()}`,
        transformation: [
          { width: 1080, height: 1080, crop: 'limit' },
          { quality: 'auto:good' }
        ]
      });
      
    } else if (imageUrl) {
      // URL upload (JSON)
      console.log('Processing URL upload...');
      
      if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
        return res.status(400).json({ 
          success: false,
          message: 'Invalid image URL. Must start with http:// or https://' 
        });
      }
      
      uploadResult = await cloudinary.uploader.upload(imageUrl, {
        folder: 'instagram_clone/posts',
        resource_type: 'image',
        public_id: `post_${userId}_${Date.now()}`,
        transformation: [
          { width: 1080, height: 1080, crop: 'limit' },
          { quality: 'auto:good' }
        ]
      });
      
    } else {
      return res.status(400).json({ 
        success: false,
        message: 'Image is required (file upload, base64, or URL)',
        received: {
          hasFile: !!req.file,
          hasBase64: !!imageBase64,
          hasUrl: !!imageUrl,
          bodyKeys: Object.keys(req.body),
          contentType: req.headers['content-type']
        }
      });
    }

    console.log('Upload successful:', uploadResult.secure_url);

    // Parse hashtags if it's a string (from form-data)
    let parsedHashtags = hashtags;
    if (typeof hashtags === 'string') {
      try {
        parsedHashtags = JSON.parse(hashtags);
      } catch (e) {
        // If it's not JSON, split by comma or space
        parsedHashtags = hashtags.split(/[,\s]+/).filter(tag => tag.trim());
      }
    }

    // Create post
    const post = await Post.create({
      user: userId,
      image: uploadResult.secure_url,
      caption: caption || '',
      location: location || '',
      hashtags: parsedHashtags || []
    });

    // Add post to user's posts array
    await User.findByIdAndUpdate(userId, {
      $push: { posts: post._id }
    });

    // Populate user details for response
    const populatedPost = await Post.findById(post._id)
      .populate('user', 'username fullName profilePicture');

    res.status(201).json({
      success: true,
      message: 'Post created successfully',
      post: populatedPost,
      uploadInfo: {
        cloudinaryUrl: uploadResult.secure_url,
        publicId: uploadResult.public_id,
        originalFileName: req.file ? req.file.originalname : null
      }
    });

  } catch (error) {
    console.error('Create post error:', error);
    
    // Handle Cloudinary errors
    if (error.http_code) {
      return res.status(400).json({ 
        success: false,
        message: 'Image upload failed', 
        error: error.message 
      });
    }

    res.status(500).json({ 
      success: false,
      message: 'Failed to create post', 
      error: error.message 
    });
  }
};

// NEW: Raw binary upload endpoint (bypasses multer completely)
exports.uploadBinary = async (req, res) => {
  try {
    console.log('=== BINARY UPLOAD REQUEST ===');
    console.log('Content-Type:', req.headers['content-type']);
    console.log('Content-Length:', req.headers['content-length']);
    
    const { caption, location, hashtags } = req.query; // Get metadata from query params
    const userId = req.user.id;

    // Check if we have binary data
    if (!req.body || req.body.length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'No image data received' 
      });
    }

    // Determine content type
    let mimeType = req.headers['content-type'] || 'image/jpeg';
    if (!mimeType.startsWith('image/')) {
      mimeType = 'image/jpeg'; // Default fallback
    }

    console.log('Processing binary upload, size:', req.body.length);

    // Convert buffer to base64 for Cloudinary
    const base64 = req.body.toString('base64');
    const dataURI = `data:${mimeType};base64,${base64}`;
    
    const uploadResult = await cloudinary.uploader.upload(dataURI, {
      folder: 'instagram_clone/posts',
      resource_type: 'image',
      public_id: `post_${userId}_${Date.now()}`,
      transformation: [
        { width: 1080, height: 1080, crop: 'limit' },
        { quality: 'auto:good' }
      ]
    });
    
    console.log('Binary upload to Cloudinary successful:', uploadResult.secure_url);

    // Parse hashtags
    let parsedHashtags = hashtags;
    if (typeof hashtags === 'string') {
      try {
        parsedHashtags = JSON.parse(hashtags);
      } catch (e) {
        parsedHashtags = hashtags.split(/[,\s]+/).filter(tag => tag.trim());
      }
    }

    // Create post
    const post = await Post.create({
      user: userId,
      image: uploadResult.secure_url,
      caption: caption || '',
      location: location || '',
      hashtags: parsedHashtags || []
    });

    // Add post to user's posts array
    await User.findByIdAndUpdate(userId, {
      $push: { posts: post._id }
    });

    // Populate user details for response
    const populatedPost = await Post.findById(post._id)
      .populate('user', 'username fullName profilePicture');

    res.status(201).json({
      success: true,
      message: 'Post created successfully',
      post: populatedPost
    });

  } catch (error) {
    console.error('Binary upload error:', error);
    
    // Handle Cloudinary errors
    if (error.http_code) {
      return res.status(400).json({ 
        success: false,
        message: 'Image upload failed', 
        error: error.message 
      });
    }

    res.status(500).json({ 
      success: false,
      message: 'Failed to create post', 
      error: error.message 
    });
  }
};

// Add a simple test endpoint to bypass multer completely
exports.createPostSimple = async (req, res) => {
  try {
    console.log('=== SIMPLE CREATE POST REQUEST ===');
    console.log('Request body:', req.body);

    const { caption, location, hashtags, imageBase64, imageUrl } = req.body;
    const userId = req.user.id;

    if (!imageUrl && !imageBase64) {
      return res.status(400).json({ 
        success: false,
        message: 'Image URL or base64 is required' 
      });
    }

    let uploadResult;

    if (imageUrl) {
      uploadResult = await cloudinary.uploader.upload(imageUrl, {
        folder: 'instagram_clone/posts',
        resource_type: 'image',
        public_id: `post_${userId}_${Date.now()}`,
        transformation: [
          { width: 1080, height: 1080, crop: 'limit' },
          { quality: 'auto:good' }
        ]
      });
    } else {
      uploadResult = await cloudinary.uploader.upload(imageBase64, {
        folder: 'instagram_clone/posts',
        resource_type: 'image',
        public_id: `post_${userId}_${Date.now()}`,
        transformation: [
          { width: 1080, height: 1080, crop: 'limit' },
          { quality: 'auto:good' }
        ]
      });
    }

    const post = await Post.create({
      user: userId,
      image: uploadResult.secure_url,
      caption: caption || '',
      location: location || '',
      hashtags: hashtags || []
    });

    await User.findByIdAndUpdate(userId, {
      $push: { posts: post._id }
    });

    const populatedPost = await Post.findById(post._id)
      .populate('user', 'username fullName profilePicture');

    res.status(201).json({
      success: true,
      message: 'Post created successfully',
      post: populatedPost
    });

  } catch (error) {
    console.error('Simple create post error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to create post', 
      error: error.message 
    });
  }
};

// Get user feed (posts from followed users)
exports.getFeed = async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const currentUser = await User.findById(userId);
    const followingUsers = [...currentUser.following, userId];

    const posts = await Post.find({ user: { $in: followingUsers } })
      .populate('user', 'username fullName profilePicture')
      .populate({
        path: 'comments',
        populate: {
          path: 'user',
          select: 'username fullName profilePicture'
        },
        options: { limit: 3, sort: { createdAt: -1 } }
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const postsWithLikeStatus = posts.map(post => ({
      ...post.toObject(),
      isLiked: post.likes.includes(userId),
      likesCount: post.likes.length,
      commentsCount: post.comments.length
    }));

    res.json({
      success: true,
      message: 'Feed retrieved successfully',
      posts: postsWithLikeStatus,
      pagination: {
        currentPage: page,
        totalPosts: posts.length,
        hasMore: posts.length === limit
      }
    });

  } catch (error) {
    console.error('Get feed error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to get feed', 
      error: error.message 
    });
  }
};

// Get single post by ID
exports.getPost = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const post = await Post.findById(id)
      .populate('user', 'username fullName profilePicture')
      .populate({
        path: 'comments',
        populate: {
          path: 'user',
          select: 'username fullName profilePicture'
        },
        options: { sort: { createdAt: -1 } }
      });

    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    const postWithStatus = {
      ...post.toObject(),
      isLiked: post.likes.includes(userId),
      likesCount: post.likes.length,
      commentsCount: post.comments.length
    };

    res.json({
      success: true,
      message: 'Post retrieved successfully',
      post: postWithStatus
    });

  } catch (error) {
    console.error('Get post error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to get post', 
      error: error.message 
    });
  }
};

// Like/Unlike post
exports.likePost = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    const isLiked = post.likes.includes(userId);

    if (isLiked) {
      post.likes = post.likes.filter(like => like.toString() !== userId);
      await post.save();

      res.json({
        success: true,
        message: 'Post unliked successfully',
        isLiked: false,
        likesCount: post.likes.length
      });
    } else {
      post.likes.push(userId);
      await post.save();

      res.json({
        success: true,
        message: 'Post liked successfully',
        isLiked: true,
        likesCount: post.likes.length
      });
    }

  } catch (error) {
    console.error('Like post error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to like/unlike post', 
      error: error.message 
    });
  }
};

// Delete post
exports.deletePost = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    if (post.user.toString() !== userId) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this post' });
    }

    if (post.image) {
      try {
        const publicId = post.image.split('/').slice(-2).join('/').split('.')[0];
        await cloudinary.uploader.destroy(publicId);
        console.log('Image deleted from Cloudinary:', publicId);
      } catch (cloudinaryError) {
        console.error('Cloudinary deletion error:', cloudinaryError);
      }
    }

    await User.findByIdAndUpdate(userId, {
      $pull: { posts: post._id }
    });

    await Post.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Post deleted successfully'
    });

  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to delete post', 
      error: error.message 
    });
  }
};