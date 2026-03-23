import React, { useState, useRef } from 'react';
import { Edit, Upload, File, Trash2, AlertCircle, X } from 'lucide-react';
import { uploadFiles, listFiles, deleteFile, renameFile as renameFileApi, openFileInTab } from '@/lib/file-api';

interface UploadSectionProps {
  title: string;
  category: string;
  userId: string;
  maxFiles?: number;
  maxFileSizeMB?: number;
  showEditButton?: boolean;
  customFiles?: any[];
  onFilesChange?: (files: any[]) => void;
  className?: string;
}

export function UploadSection({
  title,
  category,
  userId,
  maxFiles = 10,
  maxFileSizeMB = 50,
  showEditButton = true,
  customFiles,
  onFilesChange,
  className = "bg-white rounded-lg border p-4 h-[400px] flex flex-col"
}: UploadSectionProps) {
  const [files, setFiles] = useState<any[]>(customFiles || []);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [editingFileIndex, setEditingFileIndex] = useState<number | null>(null);
  const [editingFileName, setEditingFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Calculate storage
  const totalStorageUsed = Array.isArray(files) ? files.reduce((total, file) => total + file.size, 0) : 0;
  const totalStorageUsedMB = (totalStorageUsed / 1024 / 1024).toFixed(1);
  const maxStorageMB = maxFiles * maxFileSizeMB;
  const storagePercentage = (totalStorageUsed / (maxStorageMB * 1024 * 1024)) * 100;

  // Load files from server
  const loadFiles = async () => {
    setIsLoadingFiles(true);
    try {
      console.log(`Loading ${category} files from server...`);
      const serverResponse = await listFiles(category, userId);
      console.log(`${category} files response:`, serverResponse);
      const serverFiles = serverResponse.files || [];
      console.log(`${category} files loaded:`, serverFiles);
      console.log('Files array length:', serverFiles.length);
      console.log('First file:', serverFiles[0]);
      setFiles(serverFiles);
      if (onFilesChange) {
        onFilesChange(serverFiles);
      }
    } catch (error) {
      console.error(`Failed to load ${category} server files:`, error);
    } finally {
      setIsLoadingFiles(false);
    }
  };

  // Load files on mount
  React.useEffect(() => {
    if (!customFiles) {
      loadFiles();
    }
  }, [category, userId]);

  // Simple upload handler
  const handleFileSelect = async (files: FileList | null) => {
    if (!files) return;
    
    console.log(`=== ${category.toUpperCase()} UPLOAD DEBUG START ===`);
    console.log('Files selected:', files);
    console.log('Number of files:', files.length);
    
    const errors: string[] = [];
    
    // Check file count limit
    if (files.length > maxFiles) {
      errors.push(`Die maximale Anzahl von ${maxFiles} Dateien würde überschritten werden (${files.length}/${maxFiles})`);
      setUploadError(errors.join('\n'));
      return;
    }
    
    // Check individual file sizes
    Array.from(files).forEach(file => {
      if (file.size > maxFileSizeMB * 1024 * 1024) {
        errors.push(`${file.name}: Die Datei ist größer als ${maxFileSizeMB}MB`);
      }
    });
    
    if (errors.length > 0) {
      setUploadError(errors.join('\n'));
      return;
    }
    
    try {
      console.log(`Calling uploadFiles with:`, { files, category, userId });
      
      // Upload files to server
      const fileArray = Array.from(files);
      const result = await uploadFiles(category, userId, fileArray);
      console.log('Upload result from server:', result);
      
      if (result.success) {
        setUploadError('');
        console.log(`Upload successful, reloading ${category} files...`);
        // Reload files from server
        await loadFiles();
        console.log('Files reloaded, closing modal');
        // Close modal
        setShowUploadModal(false);
        console.log(`=== ${category.toUpperCase()} UPLOAD DEBUG END - SUCCESS ===`);
      } else {
        console.log('Upload failed:', result);
        setUploadError('Upload fehlgeschlagen: ' + (result.message || 'Unbekannter Fehler'));
        console.log(`=== ${category.toUpperCase()} UPLOAD DEBUG END - FAILURE ===`);
      }
    } catch (error) {
      console.error('Upload error:', error);
      setUploadError('Upload fehlgeschlagen: ' + (error as Error).message);
      console.log(`=== ${category.toUpperCase()} UPLOAD DEBUG END - ERROR ===`);
    }
  };

  const removeFile = async (index: number) => {
    try {
      const file = files[index];
      await deleteFile(category, userId, file.filename || file.id);
      // Reload files from server
      await loadFiles();
    } catch (error) {
      console.error('Delete error:', error);
      alert('Fehler beim Löschen der Datei');
    }
  };

  const renameFile = async (index: number, newName: string) => {
    try {
      const file = files[index];
      await renameFileApi(category, userId, file.filename || file.id, newName);
      // Reload files from server
      await loadFiles();
    } catch (error) {
      console.error('Rename error:', error);
      alert('Fehler beim Umbenennen der Datei');
    }
  };

  const openFile = async (file: any) => {
    try {
      // Add category and userId to file object
      const fileWithMeta = { ...file, category, userId };
      await openFileInTab(fileWithMeta);
    } catch (error) {
      console.error('Open file error:', error);
      alert('Fehler beim Öffnen der Datei');
    }
  };

  const startEditingFile = (index: number) => {
    setEditingFileIndex(index);
    setEditingFileName(files[index].originalname || files[index].name);
  };

  const saveEditingFile = async () => {
    console.log('saveEditingFile called:', { editingFileIndex, editingFileName, files });
    
    if (editingFileIndex !== null && editingFileName.trim()) {
      const file = files[editingFileIndex];
      const oldFilename = file.filename;
      console.log('Renaming file:', { oldFilename, newName: editingFileName.trim(), category, userId });
      
      try {
        await renameFileApi(category, userId, oldFilename, editingFileName.trim());
        console.log('Rename successful, reloading files...');
        await loadFiles();
        setEditingFileIndex(null);
        setEditingFileName('');
      } catch (error) {
        console.error('Rename failed:', error);
        alert('Fehler beim Umbenennen der Datei: ' + (error as Error).message);
      }
    } else {
      console.log('Cannot rename: no editing index or empty name');
    }
  };

  const cancelEditingFile = () => {
    setEditingFileIndex(null);
    setEditingFileName('');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  return (
    <>
      <div className={className}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          {showEditButton && (
            <button
              onClick={() => setShowUploadModal(true)}
              className="text-blue-600 hover:text-blue-800 p-1 rounded"
            >
              <Edit className="h-4 w-4" />
            </button>
          )}
        </div>
        
        {/* File List */}
        {files && files.length > 0 ? (
          <div className="space-y-2 flex-grow">
            <div className="space-y-1">
              {files.map((file, index) => (
                <div key={file.filename || index} className="flex items-center justify-between p-1 bg-gray-50 rounded text-sm">
                  {editingFileIndex === index ? (
                    <div className="flex items-center gap-1 flex-1">
                      <input
                        type="text"
                        value={editingFileName}
                        onChange={(e) => setEditingFileName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveEditingFile();
                          if (e.key === 'Escape') cancelEditingFile();
                        }}
                        className="flex-1 px-1 py-0.5 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        autoFocus
                      />
                      <button
                        onClick={saveEditingFile}
                        className="text-green-600 hover:bg-green-50 p-0.5 rounded"
                        title="Speichern"
                      >
                        ✓
                      </button>
                      <button
                        onClick={cancelEditingFile}
                        className="text-red-500 hover:bg-red-50 p-0.5 rounded"
                        title="Abbrechen"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => openFile(file)}
                        className="truncate flex-1 text-left hover:text-blue-600 transition-colors"
                        title="Datei in neuem Tab öffnen"
                      >
                        {file.originalname || file.name}
                      </button>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => startEditingFile(index)}
                          className="text-gray-500 hover:bg-gray-100 p-0.5 rounded"
                          title="Datei umbenennen"
                        >
                          <Edit className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => removeFile(index)}
                          className="text-red-500 hover:bg-red-100 p-0.5 rounded"
                          title="Datei löschen"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                        <span className="text-gray-500 ml-1">
                          ({(file.size / 1024 / 1024).toFixed(1)} MB)
                        </span>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-4 flex-grow flex flex-col justify-center">
            <div className="text-gray-400 text-sm mb-2">
              {isLoadingFiles ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  <span>Lade Dateien...</span>
                </div>
              ) : 'Keine Dateien'}
            </div>
            <button
              onClick={() => setShowUploadModal(true)}
              className="text-blue-600 hover:text-blue-800 text-sm underline"
            >
              Dateien hinzufügen
            </button>
          </div>
        )}
        
        {/* Storage Info */}
        <div className="text-sm text-gray-500 mt-auto">
          <div className="flex items-center justify-between mb-1">
            <span>Speicher genutzt: {totalStorageUsedMB} MB</span>
            <span>{storagePercentage.toFixed(0)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all duration-300 ${
                storagePercentage > 80 ? 'bg-red-500' : 
                storagePercentage > 60 ? 'bg-yellow-500' : 
                'bg-green-500'
              }`}
              style={{ width: `${Math.min(storagePercentage, 100)}%` }}
            />
          </div>
          <div className="text-xs text-gray-400 mt-1">
            Max. {maxFileSizeMB}MB pro Datei • {files.length}/{maxFiles} Dateien
          </div>
        </div>
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Dateien hochladen</h3>
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setUploadError('');
                }}
                className="text-gray-400 hover:text-gray-600 p-1 rounded"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-4">
              {/* Drag & Drop Area */}
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
                }`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
              >
                <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p className="text-gray-600 mb-2">Dateien hier ablegen oder klicken</p>
                <p className="text-sm text-gray-500">
                  Max. {maxFileSizeMB}MB pro Datei • Max. {maxFiles} Dateien
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => handleFileSelect(e.target.files)}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Dateien auswählen
                </button>
              </div>
              
              {/* Error Display */}
              {uploadError && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-start">
                  <AlertCircle className="h-5 w-5 text-red-500 mr-2 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-red-700">{uploadError}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
