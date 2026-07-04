/**
 * Uploads a logo file to ImgBB via POST request.
 * If no API key is provided, defaults to the specified key: 3299ac654560e9a1b6f75312431ac909.
 */
export async function uploadToImgBB(file: File, apiKey?: string): Promise<string> {
  const activeKey = apiKey && apiKey.trim() !== '' ? apiKey.trim() : '3299ac654560e9a1b6f75312431ac909';

  const formData = new FormData();
  formData.append('image', file);

  try {
    const response = await fetch(`https://api.imgbb.com/1/upload?key=${activeKey}`, {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    if (data.success && data.data && data.data.url) {
      return data.data.url;
    } else {
      throw new Error(data.error?.message || 'ImgBB response indicated failure.');
    }
  } catch (err: any) {
    console.error('ImgBB API Upload Error, falling back to local data URL:', err);
    // Fall back to data URL so the UI doesn't crash during testing/local environment
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Failed to convert file to data URL.'));
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }
}
