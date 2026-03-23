import React, { useState, useEffect } from 'react';
import { Edit } from 'lucide-react';
import { FreeTextEditor } from './FreeTextEditor';

// Simple Markdown to HTML converter
const markdownToHtml = (text: string): string => {
  if (!text) return '';
  
  return text
    // Bold: **text** -> <strong>text</strong>
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // Italic: *text* -> <em>text</em>
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // Underline: __text__ -> <u>text</u>
    .replace(/__(.*?)__/g, '<u>$1</u>')
    // Strikethrough: ~~text~~ -> <del>text</del>
    .replace(/~~(.*?)~~/g, '<del>$1</del>')
    // Horizontal rule: <hr> -> <hr>
    .replace(/<hr>/g, '<hr>')
    // Line breaks
    .replace(/\n/g, '<br>');
};

interface TextSectionProps {
  title: string;
  content: string;
  onContentChange?: (content: { title: string; content: string }) => void;
  showEditButton?: boolean;
  className?: string;
  editorTitle?: string;
  height?: string;
  storageKey?: string; // Neu: localStorage Key
}

export function TextSection({
  title,
  content,
  onContentChange,
  showEditButton = true,
  className = "bg-white rounded-lg border p-4 h-[400px] flex flex-col",
  editorTitle = "Text bearbeiten",
  height = "h-[400px]",
  storageKey = "textSection" // Default localStorage key
}: TextSectionProps) {
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [localContent, setLocalContent] = useState(content);

  // Load from localStorage on mount
  useEffect(() => {
    if (storageKey) {
      const saved = localStorage.getItem(`protouring_${storageKey}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        setLocalContent(parsed.content || '');
        if (onContentChange) {
          onContentChange({ title: parsed.title || title, content: parsed.content || '' });
        }
      }
    }
  }, [storageKey, title]); // ✅ onContentChange entfernt

  const handleSaveContent = async (newTitle: string, newContent: string) => {
    const updatedContent = { title: newTitle, content: newContent };
    
    // Save to localStorage
    if (storageKey) {
      localStorage.setItem(`protouring_${storageKey}`, JSON.stringify(updatedContent));
    }
    
    // Update local state
    setLocalContent(newContent);
    
    // Notify parent
    if (onContentChange) {
      onContentChange(updatedContent);
    }
    
    setIsEditorOpen(false);
  };

  return (
    <>
      <div className={className}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          {showEditButton && (
            <button
              onClick={() => setIsEditorOpen(true)}
              className="text-blue-600 hover:text-blue-800 p-1 rounded"
            >
              <Edit className="h-4 w-4" />
            </button>
          )}
        </div>
        
        <div className="space-y-2 flex-grow">
          <div 
            className="text-sm text-gray-600 whitespace-pre-wrap overflow-hidden"
            dangerouslySetInnerHTML={{ __html: markdownToHtml(localContent) }}
          />
        </div>
      </div>

      {/* Text Editor Modal */}
      {isEditorOpen && (
        <FreeTextEditor
          isOpen={isEditorOpen}
          onClose={() => setIsEditorOpen(false)}
          title={title}
          content={localContent}
          onSave={handleSaveContent}
        />
      )}
    </>
  );
}
