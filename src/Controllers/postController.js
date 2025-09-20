const Post = require('../Models/Post');
const User = require('../Models/User');
const cloudinary = require('../services/cloudinaryService');

// Create new post
exports.createPost = async (req, res) => {
  try {
    const { caption, location, hashtags, imageBase64 } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!imageBase64) {
      return res.status(400).json({ message: 'Image is required' });
    }

    // Upload image to Cloudinary
    const uploadResult = await cloudinary.uploader.upload(imageBase64, {
      folder: 'instagram_clone/posts',
      resource_type: 'image',
      transformation: [
        { width: 1080, height: 1080, crop: 'limit' },
        { quality: 'auto:good' }
      ]
    });

    // Create post
    const post = await Post.create({
      user: userId,
      image: uploadResult.secure_url,
      caption: caption || '',
      location: location || '',
      hashtags: hashtags || []
    });

    // Add post to user's posts array
    await User.findByIdAndUpdate(userId, {
      $push: { posts: post._id }
    });

    // Populate user details for response
    const populatedPost = await Post.findById(post._id)
      .populate('user', 'username fullName profilePicture')
      .populate('comments');

    res.status(201).json({
      message: 'Post created successfully',
      post: populatedPost
    });

  } catch (error) {
    console.error('Create post error:', error);
    
    // Handle Cloudinary errors
    if (error.http_code) {
      return res.status(400).json({ 
        message: 'Image upload failed', 
        error: error.message 
      });
    }

    res.status(500).json({ 
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

    // Get current user's following list
    const currentUser = await User.findById(userId);
    const followingUsers = [...currentUser.following, userId]; // Include own posts

    // Get posts from followed users
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

    // Add like status for current user
    const postsWithLikeStatus = posts.map(post => ({
      ...post.toObject(),
      isLiked: post.likes.includes(userId),
      likesCount: post.likes.length,
      commentsCount: post.comments.length
    }));

    res.json({
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
      return res.status(404).json({ message: 'Post not found' });
    }

    // Add like status for current user
    const postWithStatus = {
      ...post.toObject(),
      isLiked: post.likes.includes(userId),
      likesCount: post.likes.length,
      commentsCount: post.comments.length
    };

    res.json({
      message: 'Post retrieved successfully',
      post: postWithStatus
    });

  } catch (error) {
    console.error('Get post error:', error);
    res.status(500).json({ 
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
      return res.status(404).json({ message: 'Post not found' });
    }

    const isLiked = post.likes.includes(userId);

    if (isLiked) {
      // Unlike the post
      post.likes = post.likes.filter(like => like.toString() !== userId);
      await post.save();

      res.json({
        message: 'Post unliked successfully',
        isLiked: false,
        likesCount: post.likes.length
      });
    } else {
      // Like the post
      post.likes.push(userId);
      await post.save();

      res.json({
        message: 'Post liked successfully',
        isLiked: true,
        likesCount: post.likes.length
      });
    }

  } catch (error) {
    console.error('Like post error:', error);
    res.status(500).json({ 
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
      return res.status(404).json({ message: 'Post not found' });
    }

    // Check if user owns the post
    if (post.user.toString() !== userId) {
      return res.status(403).json({ message: 'Not authorized to delete this post' });
    }

    // Delete image from Cloudinary
    if (post.image) {
      try {
        // Extract public_id from Cloudinary URL
        const publicId = post.image.split('/').pop().split('.')[0];
        await cloudinary.uploader.destroy(`instagram_clone/posts/${publicId}`);
      } catch (cloudinaryError) {
        console.error('Cloudinary deletion error:', cloudinaryError);
        // Continue with post deletion even if Cloudinary fails
      }
    }

    // Remove post from user's posts array
    await User.findByIdAndUpdate(userId, {
      $pull: { posts: post._id }
    });

    // Delete the post
    await Post.findByIdAndDelete(id);

    res.json({
      message: 'Post deleted successfully'
    });

  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ 
      message: 'Failed to delete post', 
      error: error.message 
    });
  }
};