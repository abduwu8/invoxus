import { X } from 'lucide-react'

type NewFeatureModalProps = {
  onClose: () => void
  onTryCold: () => void
}

export function NewFeatureModal({ onClose, onTryCold }: NewFeatureModalProps) {
  return (
    <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-black border border-gray-800 rounded-lg shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-lg font-semibold text-white">What's New</div>
              <div className="text-sm text-gray-400">Enhanced Cold Email Features</div>
            </div>
            <button 
              onClick={onClose} 
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          <div className="space-y-4 text-gray-300">
            <div>
              <div className="text-sm font-medium text-white mb-1">Enhanced TLDR Mode</div>
              <div className="text-xs text-gray-400">Creative, memorable emails with unique tech metaphors and personality throughout both paragraphs - no more boring intros</div>
            </div>

            <div>
              <div className="text-sm font-medium text-white mb-1">Optimized Email Structure</div>
              <div className="text-xs text-gray-400">Streamlined to 2 focused paragraphs with strategic bullet points for maximum impact and readability</div>
            </div>

            <div>
              <div className="text-sm font-medium text-white mb-1">Enhanced AI Intelligence</div>
              <div className="text-xs text-gray-400">Smarter content generation with improved tone matching and completely unique content every time</div>
            </div>

            <div>
              <div className="text-sm font-medium text-white mb-1">Resume Attachment Support</div>
              <div className="text-xs text-gray-400">Upload and attach your resume (PDF, DOC, DOCX) directly to cold emails for complete professional presentation</div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-8 flex gap-3">
            <button 
              onClick={onClose} 
              className="flex-1 px-4 py-2 text-sm font-medium text-gray-400 bg-gray-900 border border-gray-700 rounded-lg hover:bg-gray-800 hover:text-white transition-colors"
            >
              Later
            </button>
            <button 
              onClick={onTryCold} 
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Try Now
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

