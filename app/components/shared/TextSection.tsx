import { useState } from 'react'
import { Edit } from 'lucide-react'
import { RichTextEditor } from './RichTextEditor'

interface TextSectionProps {
  title: string
  content: string
  onContentChange?: (content: { title: string; content: string }) => void
  showEditButton?: boolean
  className?: string
  storageKey?: string
}

export function TextSection({
  title,
  content,
  onContentChange,
  showEditButton = true,
  className = 'bg-white rounded-lg border p-4 h-[400px] flex flex-col',
}: TextSectionProps) {
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [localContent, setLocalContent] = useState(content)

  const handleSave = (_savedTitle: string, newContent: string) => {
    setLocalContent(newContent)
    onContentChange?.({ title, content: newContent })
    setIsEditorOpen(false)
  }

  // Inhalt ist HTML (neuer Editor) oder plain text (Alt-Daten)
  const isHtml = /<[a-z][\s\S]*>/i.test(localContent)

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

        <div className="flex-1 overflow-y-auto">
          {isHtml ? (
            <div
              className="rich-content text-sm text-gray-700 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: localContent }}
            />
          ) : (
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{localContent}</p>
          )}
        </div>
      </div>

      <RichTextEditor
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        title={title}
        content={localContent}
        onSave={handleSave}
      />
    </>
  )
}
