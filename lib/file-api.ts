// File API functions for server communication

const API_BASE = 'http://localhost:3002/api/uploads';

export const uploadFiles = async (category: string, userId: string, files: any[]) => {
  console.log('uploadFiles called with:', { category, userId, files, isArray: Array.isArray(files) });
  
  const formData = new FormData();
  
  // Ensure files is an array
  const filesArray = Array.isArray(files) ? files : [files];
  
  filesArray.forEach((file, index) => {
    console.log(`Appending file ${index}:`, file);
    formData.append('files', file);
  });

  try {
    const response = await fetch(`${API_BASE}/upload/${category}/${userId}`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Response not ok:', response.status, errorText);
      throw new Error(`Upload failed: ${response.status} ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Upload error:', error);
    throw error;
  }
};

export const listFiles = async (category: string, userId: string) => {
  try {
    const response = await fetch(`${API_BASE}/list/${category}/${userId}`);
    
    if (!response.ok) {
      throw new Error('List files failed');
    }

    return await response.json();
  } catch (error) {
    console.error('List files error:', error);
    throw error;
  }
};

export const deleteFile = async (category: string, userId: string, filename: string) => {
  try {
    const response = await fetch(`${API_BASE}/delete/${category}/${userId}/${filename}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error('Delete failed');
    }

    return await response.json();
  } catch (error) {
    console.error('Delete error:', error);
    throw error;
  }
};

export const renameFile = async (category: string, userId: string, oldName: string, newName: string) => {
  try {
    const url = `${API_BASE}/rename/${category}/${userId}/${oldName}`;
    console.log('Rename request:', { url, category, userId, oldName, newName });
    
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ newName }),
    });

    console.log('Rename response status:', response.status);
    console.log('Rename response ok:', response.ok);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Rename response error:', errorText);
      throw new Error(`Rename failed: ${response.status} ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Rename error:', error);
    throw error;
  }
};

export const openFileInTab = (file: any) => {
  // Create a download link and open in new tab
  const fileUrl = `http://localhost:3002/api/uploads/file/${file.category}/${file.userId}/${file.filename}`;
  
  // Open in new tab
  window.open(fileUrl, '_blank');
  
  return { success: true };
};
