import { supabase, supabaseAdmin } from './client';
import { updateProfile } from './auth';

// Use the main client for storage operations since we want to maintain the user's session

export const uploadAvatar = async (file: File, userId: string) => {
  try {
    console.log('Starting avatar upload for user:', userId);
    
    // Create a unique file path including user ID and timestamp to prevent caching issues
    const fileExt = file.name.split('.').pop();
    const timestamp = new Date().getTime();
    const filePath = `${userId}/avatar_${timestamp}.${fileExt}`;

    console.log('Uploading file to path:', filePath);

    // Use the main client for storage operations
    const { error: uploadError, data } = await supabase.storage
      .from('avatar-storage')
      .upload(filePath, file, {
        upsert: true, // Replace if exists
        cacheControl: 'no-cache', // Prevent caching
        contentType: file.type // Ensure correct MIME type
      });

    if (uploadError) {
      console.error('Error uploading to storage:', uploadError);
      throw uploadError;
    }

    // Get the public URL for the uploaded file
    const { data: urlData } = supabase.storage
      .from('avatar-storage')
      .getPublicUrl(filePath);

    if (!urlData?.publicUrl) {
      throw new Error('Failed to get public URL for uploaded file');
    }

    const publicUrl = urlData.publicUrl;
    console.log('File uploaded successfully with URL:', publicUrl);

    // Update the user's profile with the new avatar file path (not full URL)
    try {
      await updateProfile(userId, { 
        avatar_url: filePath 
      });
      console.log('Profile updated with new avatar file path');
    } catch (updateError) {
      console.error('Error updating profile with new avatar:', updateError);
      // Continue anyway as the upload was successful
    }

    return filePath;
  } catch (error) {
    console.error('Error uploading avatar:', error);
    throw error;
  }
};

export const uploadChatImage = async (file: File | Blob, threadId: string, userId: string) => {
  try {
    // Debug log for file type and instance
    console.log('[uploadChatImage] file info:', {
      type: file.type,
      size: file.size,
      instance: file instanceof File,
      isBlob: file instanceof Blob
    });
    // Validate file type
    if (!file.type.startsWith('image/')) {
      throw new Error('Only image files are allowed');
    }
    // Limit file size to 5MB
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new Error('Image size should be less than 5MB');
    }
    // Create a unique file path
    let fileExt = 'png';
    if (file instanceof File) {
      fileExt = file.name.split('.').pop() || 'png';
    }
    const timestamp = new Date().getTime();
    const filePath = `${threadId}/${userId}_${timestamp}.${fileExt}`;
    // Upload to chat-images bucket
    const { error: uploadError } = await supabase.storage
      .from('chat-images')
      .upload(filePath, file, {
        upsert: false,
        cacheControl: 'no-cache',
        contentType: file.type
      });
    if (uploadError) throw uploadError;
    // Get public URL
    const { data } = supabase.storage.from('chat-images').getPublicUrl(filePath);
    return data.publicUrl;
  } catch (error) {
    console.error('[uploadChatImage] Error:', error);
    throw error;
  }
};
