'use client'

import React, { useState, useRef } from 'react'
import { Edit, Upload, File, Trash2, AlertCircle, X, Download, Eye } from 'lucide-react'
import { getAuthToken } from '@/lib/api-client'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'

const authHeaders = (): Record<string, string> => {
  const token = getAuthToken()
  return token ? { 'Authorization': `Bearer ${token}` } : {}
}

export interface FileItem {
  id: string
  name: string
  size: number
  type: string
  uploadDate: string
  url?: string
}

export interface FileUploadProps {
  title: string
  category: string
  userId: string
  maxFiles?: number
  maxFileSizeMB?: number
  showEditButton?: boolean
  showStorageInfo?: boolean
  showDownloadButton?: boolean
  showPreviewButton?: boolean
  customFiles?: FileItem[]
  onFilesChange?: (files: FileItem[]) => void
  onUpload?: (files: FileList) => Promise<FileItem[]>
  onDelete?: (fileId: string) => Promise<void>
  onRename?: (fileId: string, newName: string) => Promise<void>
  onDownload?: (file: FileItem) => Promise<void>
  onPreview?: (file: FileItem) => void
  className?: string
  height?: string
}

export function FileUpload({
  title,
  category,
  userId,
  maxFiles = 10,
  maxFileSizeMB = 50,
  showEditButton = true,
  showStorageInfo = true,
  showDownloadButton = true,
  showPreviewButton = true,
  customFiles,
  onFilesChange,
  onUpload,
  onDelete,
  onRename,
  onDownload,
  onPreview,
  className = "bg-white rounded-lg border p-4 flex flex-col",
  height = "h-[400px]"
}: FileUploadProps) {
  const [files, setFiles] = useState<FileItem[]>(customFiles || [])
  const [isLoadingFiles, setIsLoadingFiles] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [editingFileIndex, setEditingFileIndex] = useState<number | null>(null)
  const [editingFileName, setEditingFileName] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Calculate storage
  const totalStorageUsed = files.reduce((total, file) => total + file.size, 0)
  const totalStorageUsedMB = (totalStorageUsed / 1024 / 1024).toFixed(1)
  const maxStorageMB = maxFiles * maxFileSizeMB
  const storagePercentage = (totalStorageUsed / (maxStorageMB * 1024 * 1024)) * 100

  // Load files from server
  const loadFiles = async () => {
    setIsLoadingFiles(true)
    try {
      const response = await fetch(`${API_BASE}/api/uploads/list/${category}/${userId}`, {
        headers: authHeaders()
      })
      const serverResponse = await response.json()
      const serverFiles = (serverResponse.files || []).map((file: any, index: number) => ({
        id: file.filename || `${Date.now()}_${index}`,
        name: file.originalname || file.filename,
        size: file.size || 0,
        type: file.type || 'application/octet-stream',
        uploadDate: file.created || new Date().toISOString(),
        url: `${API_BASE}/uploads/${category}/${userId}/${file.filename}`
      }))
      
      setFiles(serverFiles)
      if (onFilesChange) {
        onFilesChange(serverFiles)
      }
    } catch (error) {
      console.error(`Failed to load ${category} files:`, error)
    } finally {
      setIsLoadingFiles(false)
    }
  }

  // Load files on mount
  React.useEffect(() => {
    if (!customFiles) {
      loadFiles()
    }
  }, [category, userId])

  // Validate files
  const validateFiles = (fileList: FileList): string[] => {
    const errors: string[] = []
    
    // Check file count limit
    if (files.length + fileList.length > maxFiles) {
      errors.push(`Die maximale Anzahl von ${maxFiles} Dateien würde überschritten werden`)
    }
    
    // Check individual file sizes
    Array.from(fileList).forEach(file => {
      if (file.size > maxFileSizeMB * 1024 * 1024) {
        errors.push(`${file.name}: Die Datei ist größer als ${maxFileSizeMB}MB`)
      }
    })
    
    return errors
  }

  // Handle file upload
  const handleFileSelect = async (fileList: FileList | null) => {
    if (!fileList) return
    
    const errors = validateFiles(fileList)
    if (errors.length > 0) {
      setUploadError(errors.join('\n'))
      return
    }
    
    setIsUploading(true)
    setUploadError('')
    
    try {
      let uploadedFiles: FileItem[] = []
      
      if (onUpload) {
        uploadedFiles = await onUpload(fileList)
      } else {
        // Default upload logic with server integration
        const formData = new FormData()
        Array.from(fileList).forEach(file => {
          formData.append('files', file)
        })
        
        const response = await fetch(`${API_BASE}/api/uploads/upload/${category}/${userId}`, {
          method: 'POST',
          headers: authHeaders(),
          body: formData
        })
        
        if (!response.ok) {
          throw new Error('Upload failed')
        }
        
        const result = await response.json()
        uploadedFiles = (result.files || []).map((file: any, index: number) => ({
          id: file.filename || `${Date.now()}_${index}`,
          name: file.originalname || file.filename,
          size: file.size || 0,
          type: file.type || 'application/octet-stream',
          uploadDate: new Date().toISOString(),
          url: `${API_BASE}/uploads/${category}/${userId}/${file.filename}`
        }))
      }
      
      const updatedFiles = [...files, ...uploadedFiles]
      setFiles(updatedFiles)
      if (onFilesChange) {
        onFilesChange(updatedFiles)
      }
      
      setShowUploadModal(false)
      // Reload files from server to get the latest state
      await loadFiles()
    } catch (error) {
      setUploadError('Upload fehlgeschlagen. Bitte versuchen Sie es erneut.')
      console.error('Upload error:', error)
    } finally {
      setIsUploading(false)
    }
  }

  // Handle file deletion
  const handleDeleteFile = async (fileId: string) => {
    try {
      if (onDelete) {
        await onDelete(fileId)
      } else {
        // Default delete logic with server integration
        const response = await fetch(`${API_BASE}/api/uploads/delete/${category}/${userId}/${fileId}`, {
          method: 'DELETE',
          headers: authHeaders()
        })
        
        if (!response.ok) {
          throw new Error('Delete failed')
        }
      }
      
      const updatedFiles = files.filter(file => file.id !== fileId)
      setFiles(updatedFiles)
      if (onFilesChange) {
        onFilesChange(updatedFiles)
      }
    } catch (error) {
      console.error('Delete error:', error)
      setUploadError('Löschen fehlgeschlagen. Bitte versuchen Sie es erneut.')
    }
  }

  // Handle file rename
  const handleRenameFile = async (fileId: string, newName: string) => {
    try {
      if (onRename) {
        await onRename(fileId, newName)
      } else {
        // Default rename logic with server integration
        const response = await fetch(`${API_BASE}/api/uploads/rename/${category}/${userId}/${fileId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ newName })
        })
        
        if (!response.ok) {
          throw new Error('Rename failed')
        }
      }
      
      const updatedFiles = files.map(file => 
        file.id === fileId ? { ...file, name: newName } : file
      )
      setFiles(updatedFiles)
      if (onFilesChange) {
        onFilesChange(updatedFiles)
      }
      
      setEditingFileIndex(null)
      setEditingFileName('')
      // Reload files from server to get the latest state
      await loadFiles()
    } catch (error) {
      console.error('Rename error:', error)
      setUploadError('Umbenennen fehlgeschlagen. Bitte versuchen Sie es erneut.')
    }
  }

  // Handle file download
  const handleDownloadFile = async (file: FileItem) => {
    try {
      if (onDownload) {
        await onDownload(file)
      } else if (file.url) {
        const link = document.createElement('a')
        link.href = file.url
        link.download = file.name
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      }
    } catch (error) {
      console.error('Download error:', error)
    }
  }

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  // Format date
  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Get file icon based on type
  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return '🖼️'
    if (type.startsWith('video/')) return '🎥'
    if (type.startsWith('audio/')) return '🎵'
    if (type.includes('pdf')) return '📄'
    if (type.includes('word') || type.includes('document')) return '📝'
    if (type.includes('excel') || type.includes('spreadsheet')) return '📊'
    if (type.includes('powerpoint') || type.includes('presentation')) return '📈'
    if (type.includes('zip') || type.includes('rar') || type.includes('tar')) return '📦'
    return '📎'
  }

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    handleFileSelect(e.dataTransfer.files)
  }

  return (
    <div className={`${className} ${height}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        {showEditButton && (
          <button
            onClick={() => setShowUploadModal(true)}
            className="text-blue-600 hover:text-blue-800 p-1 rounded"
          >
            <Upload className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Storage Info */}
      {showStorageInfo && (
        <div className="mb-3">
          <div className="flex justify-between text-xs text-gray-600 mb-1">
            <span>Speicher: {totalStorageUsedMB}MB / {maxStorageMB}MB</span>
            <span>{files.length} / {maxFiles} Dateien</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(storagePercentage, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* File List */}
      <div className="flex-1 overflow-y-auto">
        {isLoadingFiles ? (
          <div className="flex items-center justify-center h-32 text-gray-500">
            <div className="text-sm">Wird geladen...</div>
          </div>
        ) : files.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-500">
            <File className="w-8 h-8 mb-2 text-gray-400" />
            <div className="text-sm">Keine Dateien vorhanden</div>
            <div className="text-xs mt-1">Klicken Sie auf das Upload-Icon</div>
          </div>
        ) : (
          <div className="space-y-2">
            {files.map((file, index) => (
              <div
                key={file.id}
                className="flex items-center justify-between p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center flex-1 min-w-0">
                  <div className="flex-1 min-w-0">
                    {editingFileIndex === index ? (
                      <input
                        type="text"
                        value={editingFileName}
                        onChange={(e) => setEditingFileName(e.target.value)}
                        onBlur={() => handleRenameFile(file.id, editingFileName)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            handleRenameFile(file.id, editingFileName)
                          }
                        }}
                        className="w-full px-1 py-0.5 text-sm border border-gray-300 rounded"
                        autoFocus
                      />
                    ) : (
                      <div>
                        <div className="text-sm font-medium text-gray-900 truncate">
                          <a
                            href={file.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-blue-600 hover:underline cursor-pointer"
                            title="In neuem Tab öffnen"
                          >
                            {file.name}
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-1 ml-2">
                  {showPreviewButton && onPreview && (
                    <button
                      onClick={() => onPreview(file)}
                      className="p-1 text-gray-600 hover:text-blue-600 rounded"
                      title="Vorschau"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  )}
                  
                  <button
                    onClick={() => {
                      setEditingFileIndex(index)
                      setEditingFileName(file.name)
                    }}
                    className="p-1 text-gray-600 hover:text-blue-600 rounded"
                    title="Umbenennen"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  
                  <button
                    onClick={() => handleDeleteFile(file.id)}
                    className="p-1 text-gray-600 hover:text-red-600 rounded"
                    title="Löschen"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Dateien hochladen</h3>
              <button
                onClick={() => setShowUploadModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragging ? 'border-blue-400 bg-blue-50' : 'border-gray-300'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <div className="text-sm text-gray-600 mb-2">
                Ziehen Sie Dateien hierher oder klicken Sie zur Auswahl
              </div>
              <div className="text-xs text-gray-500 mb-4">
                Max. {maxFileSizeMB}MB pro Datei • {maxFiles} Dateien insgesamt
              </div>
              
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={(e) => handleFileSelect(e.target.files)}
                className="hidden"
              />
              
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
              >
                {isUploading ? 'Wird hochgeladen...' : 'Dateien auswählen'}
              </button>
            </div>

            {uploadError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start">
                  <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 mr-2 flex-shrink-0" />
                  <div className="text-sm text-red-700">{uploadError}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
